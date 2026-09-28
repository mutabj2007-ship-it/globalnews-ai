import { Injectable, Logger } from '@nestjs/common';
import type { PrismaClient } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ComputeMeterService } from './compute-meter.service';
import { breakerScope, windowBucket, withDeadline } from './compute-scopes';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R2 CONSOLIDATED INTEGRATION R1 · GATE B — PROVIDER CIRCUIT BREAKER (F 02 §10)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *   CLOSED ──(fail ratio ≥ TRIP over ≥ MIN_SAMPLES in WINDOW)──▶ OPEN
 *   OPEN ──(cooldown elapsed)──▶ HALF_OPEN: ≤ TRIAL_CALLS concurrent trials
 *   HALF_OPEN ──(TRIAL_SUCCESSES)──▶ CLOSED   ·   ──(any trial failure)──▶ OPEN, cooldown ×2 (≤ MAX)
 *
 * B-1 one breaker per provider. B-2 state shared in Postgres (window counts are meter rows,
 * state is `CircuitBreakerState`), reads cached ≤ ASK_BREAKER_CACHE_MS — N replicas learn an
 * outage once. B-3 a ratio over a minimum sample count, never a single failure or a bare count.
 * B-4 timeouts count as failures; REFUSALS do not. OPEN takes the degraded path IMMEDIATELY —
 * no timeout is paid. An unreadable store denies the call (T-5, fail closed).
 */

export type BreakerOutcome = 'SUCCESS' | 'FAILURE' | 'TIMEOUT' | 'REFUSAL';
export interface BreakerPermit {
  readonly allowed: boolean;
  readonly trial: boolean;
  readonly state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' | 'UNKNOWN';
}

type BreakerDb = Pick<
  PrismaClient,
  '$queryRaw' | '$executeRaw' | 'circuitBreakerState' | 'computeReservation' | '$transaction'
>;

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly cache = new Map<
    string,
    { at: number; state: string; openUntil: number | null }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly meter: ComputeMeterService,
  ) {}

  private get cfg() {
    return this.meter.config;
  }

  private async readState(provider: string, db: BreakerDb, nowMs: number) {
    const hit = this.cache.get(provider);
    if (hit && nowMs - hit.at < this.cfg.breakerCacheMs) return hit;
    const row = await db.circuitBreakerState.findUnique({ where: { provider } });
    const fresh = {
      at: nowMs,
      state: row?.state ?? 'CLOSED',
      openUntil: row?.openUntil ? row.openUntil.getTime() : null,
    };
    this.cache.set(provider, fresh);
    return fresh;
  }

  /** Ask before calling the provider. Never pays a timeout when OPEN. */
  async permit(
    provider: string,
    now: Date = new Date(),
    db: BreakerDb = this.prisma,
  ): Promise<BreakerPermit> {
    try {
      return await withDeadline(
        this.permitInner(provider, now, db),
        this.cfg.storeDeadlineMs,
        'breaker',
      );
    } catch (error) {
      this.logger.warn(
        `breaker store unavailable for ${provider}; call denied (${(error as Error).message})`,
      );
      return { allowed: false, trial: false, state: 'UNKNOWN' };
    }
  }

  private async permitInner(provider: string, now: Date, db: BreakerDb): Promise<BreakerPermit> {
    const nowMs = now.getTime();
    const s = await this.readState(provider, db, nowMs);
    if (s.state === 'CLOSED') return { allowed: true, trial: false, state: 'CLOSED' };
    if (s.state === 'OPEN' && s.openUntil !== null && nowMs < s.openUntil) {
      return { allowed: false, trial: false, state: 'OPEN' };
    }
    /* Cooldown elapsed (or already HALF_OPEN): move OPEN → HALF_OPEN once, then claim a trial slot atomically. */
    await db.$executeRaw`
      UPDATE "CircuitBreakerState" SET "state" = 'HALF_OPEN', "trialsInFlight" = 0, "trialSuccesses" = 0, "updatedAt" = ${now}
      WHERE "provider" = ${provider} AND "state" = 'OPEN' AND "openUntil" <= ${now}`;
    const claimed = await db.$queryRaw<{ provider: string }[]>`
      UPDATE "CircuitBreakerState" SET "trialsInFlight" = "trialsInFlight" + 1, "updatedAt" = ${now}
      WHERE "provider" = ${provider} AND "state" = 'HALF_OPEN' AND "trialsInFlight" < ${this.cfg.breakerTrialCalls}
      RETURNING "provider"`;
    this.cache.delete(provider);
    return claimed.length === 1
      ? { allowed: true, trial: true, state: 'HALF_OPEN' }
      : { allowed: false, trial: false, state: 'HALF_OPEN' };
  }

  /** Report how the call went. REFUSAL never counts (B-4). */
  async record(
    provider: string,
    outcome: BreakerOutcome,
    trial: boolean,
    now: Date = new Date(),
    db: BreakerDb = this.prisma,
  ): Promise<void> {
    if (outcome === 'REFUSAL') {
      if (trial) {
        await db.$executeRaw`UPDATE "CircuitBreakerState" SET "trialsInFlight" = GREATEST("trialsInFlight" - 1, 0) WHERE "provider" = ${provider}`;
      }
      return;
    }
    const failed = outcome === 'FAILURE' || outcome === 'TIMEOUT';
    const cfg = this.cfg;
    if (trial) {
      if (failed) {
        await db.$executeRaw`
          UPDATE "CircuitBreakerState"
          SET "state" = 'OPEN', "cooldownS" = LEAST("cooldownS" * 2, ${cfg.breakerCooldownMaxS}),
              "openUntil" = ${now}::timestamptz + make_interval(secs => LEAST("cooldownS" * 2, ${cfg.breakerCooldownMaxS})),
              "trialsInFlight" = 0, "trialSuccesses" = 0, "updatedAt" = ${now}
          WHERE "provider" = ${provider} AND "state" = 'HALF_OPEN'`;
        this.logger.warn(`breaker ${provider}: HALF_OPEN -> OPEN (trial failed; cooldown doubled)`);
      } else {
        const rows = await db.$queryRaw<{ trialSuccesses: number }[]>`
          UPDATE "CircuitBreakerState"
          SET "trialSuccesses" = "trialSuccesses" + 1, "trialsInFlight" = GREATEST("trialsInFlight" - 1, 0), "updatedAt" = ${now}
          WHERE "provider" = ${provider} AND "state" = 'HALF_OPEN'
          RETURNING "trialSuccesses"`;
        if (rows.length === 1 && rows[0]!.trialSuccesses >= cfg.breakerTrialSuccesses) {
          await db.$executeRaw`
            UPDATE "CircuitBreakerState" SET "state" = 'CLOSED', "cooldownS" = ${cfg.breakerCooldownS},
              "openUntil" = NULL, "trialsInFlight" = 0, "trialSuccesses" = 0, "updatedAt" = ${now}
            WHERE "provider" = ${provider} AND "state" = 'HALF_OPEN'`;
          this.logger.log(`breaker ${provider}: HALF_OPEN -> CLOSED`);
        }
      }
      this.cache.delete(provider);
      return;
    }

    /* Window counts are meter rows, so every replica contributes to one ratio (B-2). */
    const bucket = windowBucket(now, cfg.breakerWindowS);
    const bump = async (kind: 'fail' | 'ok', by: number): Promise<number> => {
      const rows = await db.$queryRaw<{ units: bigint }[]>`
        INSERT INTO "ComputeMeter" ("scope", "bucketStart", "units") VALUES (${breakerScope(kind, provider)}, ${bucket}, ${BigInt(by)})
        ON CONFLICT ("scope", "bucketStart") DO UPDATE SET "units" = "ComputeMeter"."units" + EXCLUDED."units"
        RETURNING "units"`;
      return Number(rows[0]!.units);
    };
    const fails = await bump('fail', failed ? 1 : 0);
    const oks = await bump('ok', failed ? 0 : 1);
    const samples = fails + oks;
    if (failed && samples >= cfg.breakerMinSamples && fails / samples >= cfg.breakerTripRatio) {
      await db.$executeRaw`
        INSERT INTO "CircuitBreakerState" ("provider", "state", "openUntil", "cooldownS", "updatedAt")
        VALUES (${provider}, 'OPEN', ${new Date(now.getTime() + cfg.breakerCooldownS * 1000)}, ${cfg.breakerCooldownS}, ${now})
        ON CONFLICT ("provider") DO UPDATE SET "state" = 'OPEN', "openUntil" = EXCLUDED."openUntil",
          "cooldownS" = EXCLUDED."cooldownS", "trialsInFlight" = 0, "trialSuccesses" = 0, "updatedAt" = EXCLUDED."updatedAt"
        WHERE "CircuitBreakerState"."state" = 'CLOSED'`;
      this.logger.warn(
        `breaker ${provider}: CLOSED -> OPEN (ratio ${(fails / samples).toFixed(2)} over ${samples} samples)`,
      );
      this.cache.delete(provider);
    }
  }

  /** Test/ops seam: drop the in-process cache so the next read is the shared store. */
  forget(provider?: string): void {
    if (provider) this.cache.delete(provider);
    else this.cache.clear();
  }
}
