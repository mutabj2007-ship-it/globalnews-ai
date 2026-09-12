import { Injectable, Logger } from '@nestjs/common';
import type { ProductEventName } from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { isAccountScoped, type AccountScopedEvent } from './account-scoped-events';

/**
 * R3/T7 — the telemetry service.
 *
 * APPEND-ONLY, AND THAT IS A PROPERTY OF THIS FILE RATHER THAN A POLICY
 * WRITTEN DOWN ELSEWHERE. There is no update, no upsert and no delete
 * path anywhere in this class, and `telemetry.privacy.spec.ts` scans the
 * source and fails if one appears. A telemetry store that can be edited
 * is not a record of what happened.
 *
 * ACCOUNT LINKAGE IS DECIDED HERE, ONCE, FROM ONE LIST. Only the three
 * account-scoped events may carry a userId; for every other name the
 * session is DISCARDED rather than stored, even when the caller is
 * signed in. See `account-scoped-events.ts` for why that is stricter
 * than "attach the session if you have one", and why the difference
 * matters.
 *
 * NO PII REACHES THIS FILE. It never reads a request, a header, an IP or
 * a user-agent — it takes primitives from its callers, and the models it
 * writes have no column any of those could occupy.
 *
 * EVERY WRITE IS BEST-EFFORT AND CANNOT FAIL THE CALLER. Telemetry is
 * observation, not product function. A user must never lose a support
 * reply, a follow, or an analysis answer because a metrics row would not
 * insert, so every write is wrapped and a failure is logged and
 * swallowed. That is a deliberate asymmetry: losing a measurement is
 * cheap, losing the thing being measured is not.
 *
 * FAILURE WAS HANDLED; LOAD WAS NOT. That distinction is E1's, it is
 * correct, and it is what the global ceiling below exists to close. A
 * public unauthenticated endpoint that performs one INSERT per request
 * into an append-only table that nothing prunes is unbounded write
 * amplification, and a per-caller rate limit cannot bound it because the
 * attacker chooses how many callers to be. 20 requests/minute across 100
 * source addresses is 2.88 million rows a day, indefinitely, from an
 * endpoint requiring no credential. Disk exhaustion on a shared database
 * is a PRODUCT outage, not a telemetry outage — exactly the failure mode
 * this module says must not exist.
 */
/**
 * The GLOBAL anonymous ingest ceiling: the maximum number of
 * publicly-submitted product events written per rolling minute, counted
 * ACROSS ALL CALLERS rather than per caller.
 *
 * WHY A GLOBAL COUNT IS THE ONLY BOUND THAT WORKS. A per-caller limit is
 * defeated by using more callers, which costs an attacker almost nothing.
 * A global ceiling is a bound the attacker does not control: past it,
 * events are dropped and no INSERT is attempted, whatever the source.
 *
 * HOW THE NUMBER WAS CHOSEN, AND THE ASSUMPTION IT RESTS ON. One human
 * browsing session emits a today_view, a handful of today_item_open and
 * the occasional country_filter — comfortably under 20 events a minute.
 * At MVP scale, which this product has not yet reached, tens of
 * concurrent sessions would produce a few hundred events a minute at
 * peak. 600/minute leaves roughly an order of magnitude of headroom over
 * that expected peak while capping the worst case at ~864,000 rows a day
 * instead of an unbounded number.
 *
 * THAT ASSUMPTION IS THE WEAK PART AND IS STATED RATHER THAN BURIED: it
 * is a forecast about traffic this platform has not yet served. REVISIT
 * IT when real traffic is known, and again when retention is actually
 * enforced — a ceiling bounds the RATE of accumulation, it does not prune
 * anything, and enforced 90-day retention is still the missing half.
 *
 * DROPPING IS FREE, WHICH IS WHY IT IS THE RIGHT RESPONSE. The endpoint
 * already reports nothing to the client and every write is already
 * best-effort by design, so a dropped event costs a measurement and
 * nothing else. It is not free of CONSEQUENCE, though: a drop is a silent
 * undercount, and an invisible undercount is worse for a metrics system
 * than it sounds. That is why drops are logged rather than swallowed.
 */
export const ANONYMOUS_INGEST_CEILING_PER_WINDOW = 600;

/** The window the ceiling is counted over. */
export const ANONYMOUS_INGEST_WINDOW_MS = 60_000;

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);

  /**
   * The ceiling's entire state: a window start, an admitted count and a
   * dropped count. No identity, no address, no user-agent, no
   * fingerprint, no visitor id — nothing that could identify a caller
   * exists here, because the ceiling deliberately does not distinguish
   * between callers at all. In-process by design: no schema, no new
   * dependency, no shared store.
   *
   * KNOWN AND ACCEPTED: in-process means PER PROCESS. Two backend
   * instances would each carry their own ceiling, so the effective
   * platform-wide bound is the ceiling times the instance count. Recorded
   * because it matters before horizontal scaling, and not solved here —
   * solving it would need a shared store, which is a dependency this
   * repair is not authorized to add and does not need at MVP scale.
   */
  private windowStartedAt = 0;
  private windowAdmitted = 0;
  private windowDropped = 0;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Record a product event submitted by the PUBLIC INGEST ENDPOINT.
   *
   * THIS IS THE ONLY PATH SUBJECT TO THE GLOBAL CEILING, and the
   * separation is the point. Everything arriving here is
   * attacker-controllable: anyone on the internet can call POST /events
   * with no credential. Everything arriving through the two methods below
   * is emitted by this server's own code after it has already done the
   * work being measured, so dropping those would discard a measurement of
   * something that definitely happened while doing nothing to bound an
   * attacker.
   *
   * A separate method rather than a boolean flag: a caller has to choose
   * the public path deliberately, and the choice is visible at the call
   * site rather than hidden in an argument.
   */
  async recordPublicEvent(
    name: ProductEventName,
    dimensions: { countryCode?: string; language?: string; subjectId?: string } = {},
  ): Promise<void> {
    if (!this.admitAnonymousEvent()) {
      // DROPPED. No INSERT is attempted — that is the whole purpose of
      // the ceiling, so a flood costs the database nothing at all.
      return;
    }

    await this.write(name, null, dimensions);
  }

  /**
   * Record an ANONYMOUS product event emitted SERVER-SIDE.
   *
   * Used by TelemetryInterceptor for analysis_started/analysis_completed.
   * It takes no user identifier at all — not an optional one — so an
   * anonymous event cannot acquire an account by accident at this layer.
   *
   * NOT subject to the global ceiling: these are emitted after a request
   * the platform already served and already rate-limited on its own terms
   * (POST /analysis/news is 5/60s), so they are bounded by that route
   * rather than by this one.
   */
  async recordProductEvent(
    name: ProductEventName,
    dimensions: { countryCode?: string; language?: string; subjectId?: string } = {},
  ): Promise<void> {
    await this.write(name, null, dimensions);
  }

  /**
   * Record an ACCOUNT-SCOPED product event.
   *
   * The name is typed as AccountScopedEvent, so passing an ordinary
   * event name here is a COMPILE ERROR rather than a privacy incident
   * caught in review. The runtime guard below is the second line of
   * defence for a value that reached here untyped.
   */
  async recordAccountEvent(
    name: AccountScopedEvent,
    userId: string,
    dimensions: { countryCode?: string; language?: string; subjectId?: string } = {},
  ): Promise<void> {
    if (!isAccountScoped(name)) {
      // Unreachable through the type system. If it is ever reached, the
      // event is still recorded — anonymously. Dropping the account is
      // the safe failure; dropping the event would hide a real action.
      this.logger.warn(`Refusing to link a non-account-scoped event to a user: ${name}`);
      await this.write(name, null, dimensions);
      return;
    }

    await this.write(name, userId, dimensions);
  }

  /**
   * Record one analysis run, from the server's own view of a completed
   * request.
   *
   * NO userId PARAMETER. POST /analysis/news is unauthenticated and an
   * analysis is not account-scoped, so there is no argument to pass and
   * no column to put one in.
   */
  async recordAnalysisRun(run: {
    provider: string;
    model?: string;
    status: string;
    failureReason?: string;
    latencyMs?: number;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    cached: boolean;
  }): Promise<void> {
    try {
      await this.prisma.analysisRun.create({
        data: {
          provider: run.provider,
          model: run.model ?? null,
          status: run.status,
          failureReason: run.failureReason ?? null,
          latencyMs: run.latencyMs ?? null,
          promptTokens: run.promptTokens ?? null,
          completionTokens: run.completionTokens ?? null,
          totalTokens: run.totalTokens ?? null,
          cached: run.cached,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Analysis telemetry write failed: ${(error as Error)?.message ?? 'unknown'}`,
      );
    }
  }

  /**
   * The ceiling, in one place.
   *
   * A clearly bounded fixed window rather than a sliding one: the state
   * is three numbers and the boundary is explicit, which is easy to
   * reason about and impossible to get subtly wrong. The cost is that a
   * burst can straddle two windows and briefly admit up to twice the
   * ceiling; at these magnitudes that is irrelevant to the property being
   * defended, which is boundedness rather than smoothness.
   *
   * LOGGING IS BOUNDED TO AT MOST TWO LINES PER WINDOW, never one per
   * dropped event — a log line per drop would turn a flood of writes into
   * a flood of logs, which is the same denial with a different target.
   * One line when dropping starts, so the signal is immediate; one when
   * the window closes, carrying the true total, so the undercount is
   * VISIBLE rather than silent.
   */
  private admitAnonymousEvent(now: number = Date.now()): boolean {
    if (now - this.windowStartedAt >= ANONYMOUS_INGEST_WINDOW_MS) {
      if (this.windowDropped > 0) {
        this.logger.warn(
          `Anonymous telemetry ingest window closed having dropped ${this.windowDropped} ` +
            `event(s) over the ceiling of ${ANONYMOUS_INGEST_CEILING_PER_WINDOW}. ` +
            `Product-event counts for that window are an undercount.`,
        );
      }
      this.windowStartedAt = now;
      this.windowAdmitted = 0;
      this.windowDropped = 0;
    }

    if (this.windowAdmitted >= ANONYMOUS_INGEST_CEILING_PER_WINDOW) {
      this.windowDropped += 1;
      if (this.windowDropped === 1) {
        this.logger.warn(
          `Anonymous telemetry ingest ceiling of ${ANONYMOUS_INGEST_CEILING_PER_WINDOW} ` +
            `per ${ANONYMOUS_INGEST_WINDOW_MS}ms reached; dropping further public events ` +
            `until the window closes. No database write is attempted for a dropped event.`,
        );
      }
      return false;
    }

    this.windowAdmitted += 1;
    return true;
  }

  private async write(
    name: ProductEventName,
    userId: string | null,
    dimensions: { countryCode?: string; language?: string; subjectId?: string },
  ): Promise<void> {
    try {
      await this.prisma.productEvent.create({
        data: {
          name,
          // Belt and braces: even on this private path the account is
          // dropped for a name that is not account-scoped.
          userId: userId !== null && isAccountScoped(name) ? userId : null,
          countryCode: dimensions.countryCode ?? null,
          language: dimensions.language ?? null,
          subjectId: dimensions.subjectId ?? null,
        },
      });
    } catch (error) {
      this.logger.warn(`Telemetry write failed: ${(error as Error)?.message ?? 'unknown'}`);
    }
  }
}
