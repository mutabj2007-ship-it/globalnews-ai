import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { SessionService } from '../../auth/session.service';
import { SESSION_COOKIE_NAME, CSRF_COOKIE_NAME } from '../../auth/cookie.util';

/**
 * PH-1 — BOUNDED ANONYMOUS ANALYSIS.
 *
 * ────────────────────────────────────────────────────────────────────────
 * WHAT THIS EXISTS TO STOP
 *
 * POST /analysis/news is PUBLIC, and it stays public: anonymous analysis is
 * an intentional product capability, stated in require-auth.guard.ts's own
 * doc comment and preserved deliberately when accounts were introduced. This
 * guard does not authenticate the endpoint. It BOUNDS it.
 *
 * One accepted request is expensive twice over: AnalysisService performs up
 * to seven news-provider retrieval calls, and the OpenAI provider performs
 * `retryAttempts + 1` HTTP calls (three by default). The pre-existing
 * @Throttle(5/60s) is per IP, which bounds one visitor's behaviour and says
 * nothing about aggregate spend.
 *
 * ────────────────────────────────────────────────────────────────────────
 * WHERE IT RUNS, AND WHY THAT IS THE WHOLE POINT
 *
 * A guard. Guards run before the controller method, therefore before
 * AnalysisService is entered at all — before retrieval, before dedup, before
 * the OpenAI call. A rejected request costs one map lookup. There is no path
 * by which expensive work happens and is then thrown away.
 *
 * It is ADDITIVE to the existing @Throttle(5/60s), which is left exactly as
 * it was. That one remains the short-window burst guard; this one carries the
 * 15-minute tier policy and the global ceiling. Two ceilings, the tighter
 * binds, and nothing previously reviewed was removed.
 */

/** CTO-approved initial MVP ceilings. */
export const ANALYSIS_WINDOW_MS = 15 * 60_000;
export const ANONYMOUS_LIMIT_PER_WINDOW = 5;
export const AUTHENTICATED_LIMIT_PER_WINDOW = 30;
export const GLOBAL_LIMIT_PER_WINDOW = 300;

export type AnalysisCallerTier = 'anonymous' | 'authenticated';

export interface AnalysisCallerIdentity {
  tier: AnalysisCallerTier;
  /** `ip:<addr>` or `user:<id>`. Never a caller-supplied value — see resolveIdentity. */
  key: string;
}

interface WindowCounter {
  windowStartedAt: number;
  count: number;
}

@Injectable()
export class AnalysisRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(AnalysisRateLimitGuard.name);

  /**
   * Per-identity fixed windows, and one global fixed window.
   *
   * A fixed window rather than a sliding one, mirroring TelemetryService's
   * global ingest ceiling exactly: the state is two numbers per key and the
   * boundary is explicit. A burst straddling two windows can briefly admit up
   * to twice the ceiling; at these magnitudes the property being defended is
   * boundedness, not smoothness.
   *
   * IN-PROCESS BY DESIGN, AND THIS IS A REAL LIMITATION, RECORDED NOT BURIED.
   * Two backend instances each carry their own counters, so the effective
   * platform-wide bound is the ceiling times the instance count, and a restart
   * resets every window. Solving that needs a shared store — a dependency this
   * repair is explicitly not authorized to add and does not need at MVP scale,
   * where the deployment is a single instance. It is the same trade, made the
   * same way, as the telemetry ceiling two modules away.
   */
  private readonly identityWindows = new Map<string, WindowCounter>();
  private globalWindow: WindowCounter = { windowStartedAt: 0, count: 0 };
  private globalRejected = 0;

  constructor(private readonly sessionService: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const now = Date.now();

    /*
     * THE GLOBAL EMERGENCY CEILING IS CHECKED FIRST, DELIBERATELY.
     *
     * It is the bound an attacker does not control. Per-identity limits are
     * defeated by using more identities, which costs almost nothing; the
     * global ceiling is what actually caps spend when that happens. Checking
     * it before identity resolution also means a flood costs no session
     * lookup — the database is not consulted for a request that cannot run.
     */
    if (!this.admitGlobal(now)) {
      this.setRetryAfter(response, this.globalWindow.windowStartedAt, now);
      throw new HttpException(
        'Analysis is temporarily at capacity. Please try again shortly.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const identity = await this.resolveIdentity(request);
    const limit =
      identity.tier === 'authenticated'
        ? AUTHENTICATED_LIMIT_PER_WINDOW
        : ANONYMOUS_LIMIT_PER_WINDOW;

    if (!this.admitIdentity(identity.key, limit, now)) {
      this.setRetryAfter(response, this.identityWindows.get(identity.key)?.windowStartedAt, now);
      throw new HttpException(
        identity.tier === 'authenticated'
          ? 'You have reached the analysis limit for now. Please try again shortly.'
          : 'You have reached the anonymous analysis limit. Please try again shortly, or sign in.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  /**
   * WHO THE CALLER IS — AND WHY NEITHER ANSWER CAN BE CHOSEN BY THE CALLER.
   *
   * AUTHENTICATED requires ALL THREE of:
   *   1. a `gna_session` cookie that SessionService validates server-side
   *      against the Session table. The userId comes from that row, never
   *      from anything the request said about itself;
   *   2. a `gna_csrf` cookie;
   *   3. an `X-CSRF-Token` header equal to it.
   *
   * WHY (2) AND (3) GATE THE ELEVATION, AND WHY THIS IS NOT CSRF THEATRE.
   * Adding `credentials: 'include'` to the analysis client means the browser
   * now sends cookies here. Express parses urlencoded bodies, so a plain
   * cross-site HTML form POST is a "simple request", takes no CORS preflight,
   * and would arrive carrying the victim's cookies. Without (2)+(3) such a
   * request would consume the VICTIM'S 30-per-window authenticated allowance
   * from an attacker's page. A form cannot set a custom header, and an
   * attacker cannot read the victim's `gna_csrf` cookie value across origins,
   * so requiring the double-submit echo makes that elevation unreachable.
   *
   * FAILING THE CSRF CHECK IS NOT AN ERROR HERE. It falls back to the
   * ANONYMOUS tier rather than throwing 403, because this endpoint must keep
   * serving anonymous callers who have no cookies at all. That is strictly
   * MORE protection than existed before — this route had no CSRF semantics
   * whatsoever — and it weakens nothing: CsrfGuard still fails closed on
   * every mutating authenticated route it already protects.
   *
   * ANONYMOUS is keyed on `req.ip`. That is trustworthy in THIS architecture
   * specifically because resolveTrustProxySetting() REJECTS `TRUST_PROXY=true`
   * at boot: Express only believes X-Forwarded-For from a configured hop count
   * or IP allowlist, so a client cannot mint a fresh identity by sending a
   * header. Were `true` ever permitted, this key would become caller-chosen
   * and this guard would be decorative — which is exactly why B-1 made that
   * value unreachable.
   */
  private async resolveIdentity(request: Request): Promise<AnalysisCallerIdentity> {
    const anonymous: AnalysisCallerIdentity = {
      tier: 'anonymous',
      key: `ip:${request.ip ?? 'unknown'}`,
    };

    const cookies = (request as Request & { cookies?: Record<string, string> }).cookies;
    const sessionToken = cookies?.[SESSION_COOKIE_NAME];
    if (!sessionToken) {
      return anonymous;
    }

    const csrfCookie = cookies?.[CSRF_COOKIE_NAME];
    const csrfHeader = request.headers['x-csrf-token'];
    if (
      !csrfCookie ||
      typeof csrfHeader !== 'string' ||
      csrfHeader.length === 0 ||
      csrfHeader !== csrfCookie
    ) {
      return anonymous;
    }

    let session: { userId: string } | null = null;
    try {
      session = await this.sessionService.validateSession(sessionToken);
    } catch (error) {
      /*
       * FAIL TOWARDS THE TIGHTER CEILING, NEVER TOWARDS THE LOOSER ONE.
       * If the session store is unreachable we cannot prove who this is, so
       * the caller is treated as anonymous and gets 5, not 30. An error here
       * must never become a free upgrade.
       */
      this.logger.warn(
        `Session validation failed while resolving an analysis rate-limit identity; ` +
          `treating the caller as anonymous. ${(error as Error)?.message ?? 'unknown error'}`,
      );
      return anonymous;
    }

    return session ? { tier: 'authenticated', key: `user:${session.userId}` } : anonymous;
  }

  /**
   * Retry-After, on every 429 this guard raises.
   *
   * A 429 without it tells the caller they are blocked and nothing about for
   * how long, so a client's only strategy is to keep asking — which is the
   * behaviour the ceiling exists to stop. The window here is FIXED, not
   * sliding, so the exact reset instant is already known:
   * windowStartedAt + ANALYSIS_WINDOW_MS.
   *
   * Floor of 1 rather than 0: RFC 9110 permits 0, but a client that reads it
   * as "retry immediately" would hammer the boundary. Ceiling rather than
   * round for the same reason — never advertise an instant earlier than the
   * real one.
   *
   * `windowStartedAt` is optional only for total control flow. Both call
   * sites reject on a live window, so the counter is always present; the
   * fallback advertises a full window, which errs long and never short.
   */
  private setRetryAfter(
    response: Response,
    windowStartedAt: number | undefined,
    now: number,
  ): void {
    const resetAt = (windowStartedAt ?? now) + ANALYSIS_WINDOW_MS;
    const seconds = Math.max(1, Math.ceil((resetAt - now) / 1000));
    response.setHeader('Retry-After', String(seconds));
  }

  /** The per-identity fixed window. */
  private admitIdentity(key: string, limit: number, now: number): boolean {
    const existing = this.identityWindows.get(key);

    if (!existing || now - existing.windowStartedAt >= ANALYSIS_WINDOW_MS) {
      this.identityWindows.set(key, { windowStartedAt: now, count: 1 });
      this.pruneExpired(now);
      return true;
    }

    if (existing.count >= limit) {
      return false;
    }

    existing.count += 1;
    return true;
  }

  /**
   * The global emergency ceiling, in one place.
   *
   * Logging is bounded to at most two lines per window — one when rejection
   * starts, one when the window closes carrying the true total — never one
   * line per rejected request. A log line per rejection would turn a flood of
   * requests into a flood of logs, which is the same denial with a different
   * target. The same discipline TelemetryService applies to its ceiling.
   */
  private admitGlobal(now: number): boolean {
    if (now - this.globalWindow.windowStartedAt >= ANALYSIS_WINDOW_MS) {
      if (this.globalRejected > 0) {
        this.logger.warn(
          `Global analysis window closed having rejected ${this.globalRejected} request(s) ` +
            `over the emergency ceiling of ${GLOBAL_LIMIT_PER_WINDOW} per ${ANALYSIS_WINDOW_MS}ms.`,
        );
      }
      this.globalWindow = { windowStartedAt: now, count: 0 };
      this.globalRejected = 0;
    }

    if (this.globalWindow.count >= GLOBAL_LIMIT_PER_WINDOW) {
      this.globalRejected += 1;
      if (this.globalRejected === 1) {
        this.logger.warn(
          `Global analysis emergency ceiling of ${GLOBAL_LIMIT_PER_WINDOW} per ` +
            `${ANALYSIS_WINDOW_MS}ms reached; rejecting further analysis requests until the ` +
            'window closes. No provider retrieval and no AI call is attempted for a rejected request.',
        );
      }
      return false;
    }

    this.globalWindow.count += 1;
    return true;
  }

  /**
   * Bounded memory: identity windows whose window has fully elapsed are
   * dropped. Without this the map would grow one entry per distinct address
   * seen since boot, which is itself a slow denial-of-service against the
   * process this guard exists to protect.
   */
  private pruneExpired(now: number): void {
    for (const [key, counter] of this.identityWindows) {
      if (now - counter.windowStartedAt >= ANALYSIS_WINDOW_MS) {
        this.identityWindows.delete(key);
      }
    }
  }
}
