import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import {
  HOST_COOKIE_PREFIX,
  resolveAuthCookieNames,
  buildCsrfCookieOptions,
  clearAuthCookies,
} from '../../auth/cookie.util';
import { resolveFrontendOrigin } from '../../../security/cors-startup-validator';
import { ComputeMeterService } from '../../compute-controls/compute-meter.service';
import { OperationalSwitchService } from '../../compute-controls/operational-switch.service';
import { dayBucket, guestIssuanceScope } from '../../compute-controls/compute-scopes';
import {
  GUEST_ANSWER_ALLOWANCE,
  resolveGuestTrialConfig,
  type GuestTrialConfig,
} from './guest-trial.config';
import { guestRefusal } from './ask-principal';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK GUEST TRIAL R3 — THE SERVER-ISSUED GUEST SESSION
 * ════════════════════════════════════════════════════════════════════════════
 *
 * - IDENTITY: 32 random bytes, issued only by the server, only on the first EXPLICIT guest
 *   submission (never on page load, so crawlers and prefetches mint nothing). The browser holds
 *   the raw token in an HttpOnly, Secure (in production), SameSite=Lax, host-only cookie
 *   (`__Host-` prefix when secure); the database holds its SHA-256 only.
 * - LIFETIME: ABSOLUTE from creation (CTO D2). Nothing extends it — not activity, not a
 *   cancelled sign-in. Expiry is enforced on EVERY access, independently of the cleanup sweep.
 * - CSRF: the guest's CSRF value is an HMAC of the session's token hash under a server key, so
 *   it is bound to THIS guest; a forged or tossed CSRF cookie cannot match the header check.
 * - NO FINGERPRINTING, no IP stored on the session. Issuance is bounded per trusted IP scope
 *   through the existing meter table (counts only). Cookie deletion or a private window loses
 *   the identity; that is disclosed to the reader, not hidden.
 */

export const GUEST_COOKIE_BASE = 'gna_guest';

/**
 * T5 PART B — the CONFIGURED guest data policy, published on `GET /ask-v2/guest/status` so the
 * notices state real values instead of hard-coded "3 / 7 days / 24 hours". Read-only; it reveals
 * none of the spending or abuse limits.
 */
export interface GuestDataPolicy {
  readonly allowance: number;
  /** Absolute session lifetime from creation (hours, ≤ 168). Nothing extends it. */
  readonly sessionLifetimeH: number;
  /** Physical deletion by the always-on sweep runs this long AFTER `expiresAt` (hours). */
  readonly purgeGraceH: number;
  /** The sweep runs at least this often (seconds); deletion can lag `purgeAfter` by one tick. */
  readonly sweepIntervalS: number;
}

export interface ResolvedGuest {
  readonly id: string;
  readonly expiresAt: Date;
}

@Injectable()
export class GuestSessionService {
  private readonly logger = new Logger(GuestSessionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly meter: ComputeMeterService,
    private readonly switches: OperationalSwitchService,
  ) {}

  /** The resolved guest configuration, validated against the live outer ceilings. */
  trialConfig(): GuestTrialConfig {
    return resolveGuestTrialConfig((name) => this.config.get<string>(name), this.meter.config);
  }

  /** T5 PART B — the configured guest data policy (see GuestDataPolicy). */
  policy(): GuestDataPolicy {
    const { sessionLifetimeH, purgeGraceH, sweepIntervalS } = this.trialConfig().lifetimes;
    return { allowance: GUEST_ANSWER_ALLOWANCE, sessionLifetimeH, purgeGraceH, sweepIntervalS };
  }

  /** When the always-on sweep becomes ENTITLED to delete a session (expiry + grace). */
  purgeAfter(expiresAt: Date): Date {
    return new Date(expiresAt.getTime() + this.trialConfig().lifetimes.purgeGraceH * 3_600_000);
  }

  /**
   * T5 PART B — "delete my guest data now". Physically deletes the guest session behind
   * `tokenHash` with the SAME cascade the maintenance sweep uses (threads, turns, operations,
   * stored results, slots, claims). Only an ACTIVE session is deleted (expired-but-unpurged
   * counts: its rows still exist). A CLAIMED session's conversations already belong to an
   * account and are not guest data — nothing is deleted. Account rows are never addressed: the
   * delete is keyed by the guest session id only, and claimed rows carry `guestSessionId: null`.
   *
   * Refused while an answer is in progress (a RESERVED slot), exactly like a claim, so a running
   * execution never loses its rows mid-flight. Per-IP and pool meter rows are NOT refunded:
   * they are counters, not the guest's content, and refunding them would let delete-and-retry
   * bypass the shared bounds. Idempotent: a second call finds nothing and deletes nothing.
   */
  async forget(tokenHash: string): Promise<{ readonly deleted: boolean }> {
    return this.prisma.$transaction(
      async (tx) => {
        const row = await tx.guestSession.findUnique({
          where: { tokenHash },
          select: { id: true, status: true },
        });
        if (row === null || row.status !== 'ACTIVE') return { deleted: false };
        const inFlight = await tx.guestSlot.count({
          where: { guestSessionId: row.id, state: 'RESERVED' },
        });
        if (inFlight > 0) throw guestRefusal('GUEST_ANSWER_IN_PROGRESS');
        const gone = await tx.guestSession.deleteMany({ where: { id: row.id, status: 'ACTIVE' } });
        return { deleted: gone.count === 1 };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  cookieName(): string {
    return resolveAuthCookieNames().secure
      ? `${HOST_COOKIE_PREFIX}${GUEST_COOKIE_BASE}`
      : GUEST_COOKIE_BASE;
  }

  private frontendOrigin(): string | undefined {
    try {
      return resolveFrontendOrigin(process.env.NODE_ENV, process.env.FRONTEND_ORIGIN);
    } catch {
      return undefined;
    }
  }

  private csrfKey(): Buffer | null {
    const secret = process.env.OAUTH_FLOW_SECRET;
    if (!secret) return null;
    return createHash('sha256').update(`ask-guest-csrf:${secret}`).digest();
  }

  static hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  /** The CSRF value bound to one guest session, or null when no server key exists. */
  csrfFor(tokenHash: string): string | null {
    const key = this.csrfKey();
    return key === null ? null : createHmac('sha256', key).update(tokenHash).digest('base64url');
  }

  /** Constant-time check that `presented` is this guest's bound CSRF value. */
  csrfMatches(tokenHash: string, presented: string | undefined): boolean {
    const expected = this.csrfFor(tokenHash);
    if (expected === null || typeof presented !== 'string' || presented.length === 0) return false;
    const a = Buffer.from(expected);
    const b = Buffer.from(presented);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  rawTokenFrom(request: Request): string | undefined {
    const raw = request.cookies?.[this.cookieName()] as unknown;
    return typeof raw === 'string' && /^[0-9a-f]{64}$/.test(raw) ? raw : undefined;
  }

  /** The ACTIVE, unexpired guest behind the request's cookie — or null. Expiry is enforced here. */
  async resolve(request: Request, now: Date = new Date()): Promise<ResolvedGuest | null> {
    const raw = this.rawTokenFrom(request);
    if (raw === undefined) return null;
    const row = await this.prisma.guestSession.findUnique({
      where: { tokenHash: GuestSessionService.hashToken(raw) },
      select: { id: true, status: true, expiresAt: true },
    });
    if (row === null || row.status !== 'ACTIVE' || row.expiresAt.getTime() <= now.getTime()) {
      return null;
    }
    return { id: row.id, expiresAt: row.expiresAt };
  }

  /**
   * Issue a new session for an explicit first guest submission. Refuses (before minting) when
   * the guest switch is off, the configuration is invalid, or this IP scope has reached its
   * daily issuance bound.
   */
  async issue(
    ipScope: string,
    response: Response,
    now: Date = new Date(),
  ): Promise<ResolvedGuest & { csrf: string }> {
    const config = this.trialConfig();
    if (!config.valid) throw guestRefusal('GUEST_TRIAL_NOT_CONFIGURED');
    if (!(await this.switches.isEnabled('ASK_GUEST_TRIAL_ENABLED'))) {
      throw guestRefusal('GUEST_TRIAL_UNAVAILABLE');
    }
    if (this.csrfKey() === null) throw guestRefusal('GUEST_TRIAL_NOT_CONFIGURED');
    const admitted = await this.meter.admitCount(
      guestIssuanceScope(ipScope),
      dayBucket(now),
      config.limits.sessionsPerIpScopePerDay,
    );
    if (!admitted) throw guestRefusal('GUEST_TEMPORARILY_LIMITED');

    const raw = randomBytes(32).toString('hex');
    const tokenHash = GuestSessionService.hashToken(raw);
    const expiresAt = new Date(now.getTime() + config.lifetimes.sessionLifetimeH * 3_600_000);
    const row = await this.prisma.guestSession.create({
      data: { tokenHash, expiresAt },
      select: { id: true, expiresAt: true },
    });
    const csrf = this.csrfFor(tokenHash) as string;
    this.setCookies(response, raw, csrf, expiresAt, now);
    return { id: row.id, expiresAt: row.expiresAt, csrf };
  }

  /** The bound CSRF value for the request's guest (re-issued to the cookie on every read). */
  csrfForRequest(request: Request): string | null {
    const raw = this.rawTokenFrom(request);
    return raw === undefined ? null : this.csrfFor(GuestSessionService.hashToken(raw));
  }

  private setCookies(
    response: Response,
    raw: string,
    csrf: string,
    expiresAt: Date,
    now: Date,
  ): void {
    const secure = resolveAuthCookieNames().secure;
    const maxAge = Math.max(0, expiresAt.getTime() - now.getTime());
    response.cookie(this.cookieName(), raw, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
      maxAge,
    });
    response.cookie(
      resolveAuthCookieNames().csrf,
      csrf,
      buildCsrfCookieOptions(process.env.NODE_ENV, maxAge, this.frontendOrigin()),
    );
  }

  clearCookie(response: Pick<Response, 'clearCookie'>): void {
    const secure = resolveAuthCookieNames().secure;
    response.clearCookie(
      this.cookieName(),
      secure ? { path: '/', secure: true, sameSite: 'lax' } : { path: '/' },
    );
  }

  /** T5 PART B — clear BOTH guest cookies (token and its bound CSRF value) after `forget`. */
  clearGuestCookies(response: Pick<Response, 'clearCookie'>): void {
    this.clearCookie(response);
    clearAuthCookies(response, ['csrf']);
  }

  /** Origin check for guest mutations: the request must come from the product's own origin. */
  originAllowed(request: Request): boolean {
    const expected = this.frontendOrigin();
    const origin = request.headers.origin;
    return typeof expected === 'string' && typeof origin === 'string' && origin === expected;
  }

  logIssuanceProblem(problems: readonly string[]): void {
    this.logger.warn(`guest trial configuration invalid: ${problems.length} problem(s)`);
  }
}
