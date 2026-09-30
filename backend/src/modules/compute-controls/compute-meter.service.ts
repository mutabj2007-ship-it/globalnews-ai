import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PrismaClient } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  resolveComputeControlsConfig,
  type ComputeControlsConfig,
} from './compute-controls.config';
import {
  accountScope,
  CONCURRENCY_BUCKET,
  concurrencyScope,
  dayBucket,
  GLOBAL_DAY_SCOPE,
  GLOBAL_HOUR_SCOPE,
  GLOBAL_SCOPE,
  accountGuestAttributionScope,
  GUEST_POOL_DAY_SCOPE,
  GUEST_POOL_HOUR_SCOPE,
  guestScope,
  hourBucket,
  providerScope,
  withDeadline,
} from './compute-scopes';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R2 CONSOLIDATED INTEGRATION R1 · GATE B — THE SHARED COMPUTE METER
 * ════════════════════════════════════════════════════════════════════════════
 *
 * F 01 §0 ordering, steps 2 and 5: RESERVE before the provider call, SETTLE after it.
 *
 * - L-8  every charge is ONE atomic statement (`INSERT … ON CONFLICT DO UPDATE … RETURNING`),
 *        so N replicas cannot interleave into an over-admit. A scope that comes back over its
 *        ceiling is compensated and the request refused: concurrent callers may over-REFUSE
 *        for a moment, never over-ADMIT.
 * - L-0  the GLOBAL ceiling is evaluated before any per-caller ceiling.
 * - L-9  reserve an estimate; settle the actual; a reaper releases concurrency held by a
 *        reservation nobody settled. A request that dies mid-flight stays CHARGED — the safe
 *        direction.
 * - L-10 FAIL CLOSED: an unreadable/unwritable meter refuses model spend (reader: D3).
 * - L-13 a global/provider ceiling is DEGRADED (D2/D3), a per-caller ceiling or concurrency
 *        is REFUSED (D5) — and L-24: ONE refusal shape per kind; the exact control is
 *        operator telemetry only.
 * - L-21/L-22/L-23 concurrency is a bound, not a rate; no queue; a slot is released when the
 *        call SETTLES, never when a reader's race resolves.
 */

export type ComputeRefusalKind = 'REFUSED' | 'DEGRADED';

export interface ReserveInput {
  /** Server-resolved account id, or null for an anonymous caller (L-3). */
  readonly accountId: string | null;
  /** When the account was created — the new-account tier (L-2). */
  readonly accountCreatedAt?: Date | null;
  /** From `clientIpScope(request.ip)` — never a caller-supplied value. */
  readonly ipScope: string;
  /** The model provider this spend goes to (B-1, `provider:<name>`). */
  readonly provider: string;
  /** Estimated units: input + outputWeight × expected output (L-12, L-14). */
  readonly estimatedUnits: number;
  /**
   * ASK GUEST TRIAL R3 — present only for a server-issued guest session. Adds the guest
   * scopes INSIDE the existing controls (never instead of them): the aggregate guest pool
   * (hour, day), the session lifetime units, and the session concurrency.
   */
  readonly guest?: GuestComputeScope;
  readonly now?: Date;
}

export interface GuestComputeScope {
  readonly sessionId: string;
  readonly unitsPerSession: number;
  readonly poolUnitsPerHour: number;
  readonly poolUnitsPerDay: number;
  readonly concurrentPerSession: number;
}

export type ReserveOutcome =
  | { readonly admitted: true; readonly reservationId: string; readonly estimatedUnits: number }
  | { readonly admitted: false; readonly kind: ComputeRefusalKind; readonly control: string };

interface Charge {
  readonly scope: string;
  readonly bucketStart: string;
  readonly units: number;
  readonly kind: 'units' | 'concurrency';
}

type MeterClient = Pick<PrismaClient, '$queryRaw' | 'computeReservation' | '$transaction'>;

@Injectable()
export class ComputeMeterService {
  private readonly logger = new Logger(ComputeMeterService.name);
  readonly config: ComputeControlsConfig;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.config = resolveComputeControlsConfig((name) => config.get<string>(name));
  }

  /** The atomic statement (L-8). Returns the scope's total AFTER this increment. */
  private async increment(
    db: MeterClient,
    scope: string,
    bucketStart: Date,
    units: number,
  ): Promise<number> {
    const rows = await db.$queryRaw<{ units: bigint }[]>`
      INSERT INTO "ComputeMeter" ("scope", "bucketStart", "units")
      VALUES (${scope}, ${bucketStart}, ${BigInt(units)})
      ON CONFLICT ("scope", "bucketStart")
      DO UPDATE SET "units" = "ComputeMeter"."units" + EXCLUDED."units"
      RETURNING "units"`;
    return Number(rows[0]!.units);
  }

  private async compensate(db: MeterClient, charges: readonly Charge[]): Promise<void> {
    for (const c of charges) await this.increment(db, c.scope, new Date(c.bucketStart), -c.units);
  }

  /**
   * Admit or refuse ONE unit of model spend. Order is the contract: request size, then
   * GLOBAL hour/day, provider hour (DEGRADED), then account/ip day, then concurrency
   * global/account/ip (REFUSED). Nothing here calls a provider.
   */
  async reserve(input: ReserveInput, db: MeterClient = this.prisma): Promise<ReserveOutcome> {
    const cfg = this.config;
    const now = input.now ?? new Date();
    const estimate = Math.ceil(input.estimatedUnits);
    if (!Number.isFinite(estimate) || estimate < 0 || estimate > cfg.unitsPerRequestMax) {
      return { admitted: false, kind: 'REFUSED', control: 'per-request-units' };
    }

    const newAccount =
      input.accountCreatedAt != null &&
      now.getTime() - input.accountCreatedAt.getTime() < cfg.newAccountAgeH * 3_600_000;
    const hour = hourBucket(now);
    const day = dayBucket(now);

    type Step = {
      control: string;
      kind: ComputeRefusalKind;
      scope: string;
      bucket: Date;
      units: number;
      ceiling: number;
      charge: Charge['kind'];
    };
    const steps: Step[] = [
      {
        control: 'global-hour',
        kind: 'DEGRADED',
        /* P1 R1 — distinct from global-day: at 00:xx UTC the two buckets are equal. */
        scope: GLOBAL_HOUR_SCOPE,
        bucket: hour,
        units: estimate,
        ceiling: cfg.globalUnitsPerHour,
        charge: 'units',
      },
      {
        control: 'global-day',
        kind: 'DEGRADED',
        scope: GLOBAL_DAY_SCOPE,
        bucket: day,
        units: estimate,
        ceiling: cfg.globalUnitsPerDay,
        charge: 'units',
      },
      {
        control: 'provider-hour',
        kind: 'DEGRADED',
        scope: providerScope(input.provider),
        bucket: hour,
        units: estimate,
        ceiling: cfg.providerUnitsPerHour,
        charge: 'units',
      },
    ];
    if (input.guest !== undefined) {
      const g = input.guest;
      steps.push(
        {
          control: 'guest-pool-hour',
          kind: 'DEGRADED',
          scope: GUEST_POOL_HOUR_SCOPE,
          bucket: hour,
          units: estimate,
          ceiling: g.poolUnitsPerHour,
          charge: 'units',
        },
        {
          control: 'guest-pool-day',
          kind: 'DEGRADED',
          scope: GUEST_POOL_DAY_SCOPE,
          bucket: day,
          units: estimate,
          ceiling: g.poolUnitsPerDay,
          charge: 'units',
        },
        {
          /* Lifetime of the session: one fixed bucket, like concurrency. */
          control: 'guest-session-units',
          kind: 'REFUSED',
          scope: guestScope(g.sessionId),
          bucket: CONCURRENCY_BUCKET,
          units: estimate,
          ceiling: g.unitsPerSession,
          charge: 'units',
        },
      );
    }
    if (input.accountId !== null) {
      steps.push({
        control: newAccount ? 'new-account-day' : 'account-day',
        kind: 'REFUSED',
        scope: accountScope(input.accountId),
        bucket: day,
        units: estimate,
        ceiling: newAccount ? cfg.newAccountUnitsPerDay : cfg.accountUnitsPerDay,
        charge: 'units',
      });
    }
    steps.push({
      control: 'ip-day',
      kind: 'REFUSED',
      scope: input.ipScope,
      bucket: day,
      units: estimate,
      ceiling: cfg.ipUnitsPerDay,
      charge: 'units',
    });
    steps.push({
      control: 'concurrent-global',
      kind: 'REFUSED',
      scope: concurrencyScope(GLOBAL_SCOPE),
      bucket: CONCURRENCY_BUCKET,
      units: 1,
      ceiling: cfg.concurrentGlobal,
      charge: 'concurrency',
    });
    if (input.accountId !== null) {
      steps.push({
        control: 'concurrent-account',
        kind: 'REFUSED',
        scope: concurrencyScope(accountScope(input.accountId)),
        bucket: CONCURRENCY_BUCKET,
        units: 1,
        ceiling: cfg.concurrentPerAccount,
        charge: 'concurrency',
      });
    }
    if (input.guest !== undefined) {
      steps.push({
        control: 'concurrent-guest',
        kind: 'REFUSED',
        scope: concurrencyScope(guestScope(input.guest.sessionId)),
        bucket: CONCURRENCY_BUCKET,
        units: 1,
        ceiling: input.guest.concurrentPerSession,
        charge: 'concurrency',
      });
    }
    steps.push({
      control: 'concurrent-ip',
      kind: 'REFUSED',
      scope: concurrencyScope(input.ipScope),
      bucket: CONCURRENCY_BUCKET,
      units: 1,
      ceiling: cfg.concurrentPerIpPrefix,
      charge: 'concurrency',
    });

    const applied: Charge[] = [];
    try {
      return await withDeadline(
        (async (): Promise<ReserveOutcome> => {
          for (const step of steps) {
            const total = await this.increment(db, step.scope, step.bucket, step.units);
            applied.push({
              scope: step.scope,
              bucketStart: step.bucket.toISOString(),
              units: step.units,
              kind: step.charge,
            });
            if (total > step.ceiling) {
              await this.compensate(db, applied);
              applied.length = 0;
              return { admitted: false, kind: step.kind, control: step.control };
            }
          }
          const reservation = await db.computeReservation.create({
            data: {
              charges: applied as unknown as object,
              units: BigInt(estimate),
              expiresAt: new Date(now.getTime() + cfg.reservationTtlS * 1000),
            },
          });
          return { admitted: true, reservationId: reservation.id, estimatedUnits: estimate };
        })(),
        cfg.storeDeadlineMs,
        'reserve',
      );
    } catch (error) {
      /* L-10 — fail closed. Best-effort compensation; if the store is gone, the reaper cannot
         run either, and the charge stands (the safe direction). */
      try {
        await this.compensate(db, applied);
      } catch {
        /* store unavailable */
      }
      this.logger.warn(`meter unavailable, model spend refused (${(error as Error).message})`);
      return { admitted: false, kind: 'DEGRADED', control: 'meter-unavailable' };
    }
  }

  /**
   * ASK GUEST TRIAL R3 — an atomic EVENT counter on the same meter table (L-8): +1 in
   * `scope` for `bucket`, admitted only while the total stays within `ceiling`; an
   * over-ceiling increment is compensated in place. Used for guest-session issuance and guest
   * executions per trusted IP scope — counts, not model units. Fails CLOSED.
   */
  async admitCount(
    scope: string,
    bucket: Date,
    ceiling: number,
    db: MeterClient = this.prisma,
  ): Promise<boolean> {
    try {
      return await withDeadline(
        (async () => {
          const total = await this.increment(db, scope, bucket, 1);
          if (total > ceiling) {
            await this.increment(db, scope, bucket, -1);
            return false;
          }
          return true;
        })(),
        this.config.storeDeadlineMs,
        'count',
      );
    } catch {
      return false;
    }
  }

  /** Best-effort compensation of an event count taken for work that was then not created. */
  async adjustCount(
    scope: string,
    bucket: Date,
    delta: number,
    db: MeterClient = this.prisma,
  ): Promise<void> {
    try {
      await withDeadline(
        this.increment(db, scope, bucket, delta),
        this.config.storeDeadlineMs,
        'count',
      );
    } catch {
      /* the count stands — the conservative direction */
    }
  }

  /**
   * ASK GUEST TRIAL R3 · CONTINUATION BUDGET CLOSEOUT — what an identity change does to usage.
   *
   * Guest work was metered ONCE, when it ran: into the guest session scope (lifetime), the
   * aggregate guest pool, the trusted IP scope, the provider and the global buckets. Those rows
   * are never touched here — moving usage between identity-specific records must not debit the
   * shared totals again, and login must not erase them.
   *
   * At a completed claim the guest's lifetime units are ATTRIBUTED to the account, once, in a
   * separate `acctguest:<id>` day record with NO ceiling. It is an audit fact, not an
   * eligibility control: the account's own `acct:<id>` bucket (new-account 15,000/day by
   * default) counts only work the account itself runs. Debiting it with the guest's usage made
   * the advertised "sign in to continue" follow-up predictably impossible for a new account,
   * and charged the same work a second time against a second identity limit.
   *
   * Replay cannot repeat this: it runs only after a claim moved PENDING → CONSUMED exactly once.
   * Best-effort by design: a failure here never blocks the reader's sign-in.
   */
  async recordGuestUsageForAccount(
    accountId: string,
    units: number,
    now: Date = new Date(),
    db: MeterClient = this.prisma,
  ): Promise<void> {
    if (!(units > 0)) return;
    try {
      await withDeadline(
        this.increment(
          db,
          accountGuestAttributionScope(accountId),
          dayBucket(now),
          Math.ceil(units),
        ),
        this.config.storeDeadlineMs,
        'attribute',
      );
    } catch {
      this.logger.warn('guest-to-account usage attribution could not be written');
    }
  }

  /** Units a guest session has consumed over its lifetime (0 when unreadable). */
  async guestSessionUnits(sessionId: string, db: MeterClient = this.prisma): Promise<number> {
    try {
      const rows = await db.$queryRaw<{ units: bigint }[]>`
        SELECT "units" FROM "ComputeMeter"
        WHERE "scope" = ${guestScope(sessionId)} AND "bucketStart" = ${CONCURRENCY_BUCKET}`;
      return rows.length === 0 ? 0 : Number(rows[0]!.units);
    } catch {
      return 0;
    }
  }

  /**
   * Settle: write the ACTUAL units back (L-9, L-14) and release concurrency (L-23). Idempotent —
   * a reservation settles (or is reaped) exactly once; a second settle is a no-op.
   */
  async settle(
    reservationId: string,
    actualUnits: number | null,
    outcome: string,
    db: MeterClient = this.prisma,
  ): Promise<boolean> {
    const claimed = await db.$transaction(async (tx) => {
      const row = await tx.computeReservation.findUnique({ where: { id: reservationId } });
      if (!row || row.settledAt !== null) return null;
      const updated = await tx.computeReservation.updateMany({
        where: { id: reservationId, settledAt: null },
        data: { settledAt: new Date(), outcome },
      });
      return updated.count === 1 ? row : null;
    });
    if (claimed === null) return false;
    const charges = claimed.charges as unknown as Charge[];
    const estimate = Number(claimed.units);
    /* A null actual (provider reported nothing) keeps the estimate charged — safe direction. */
    const delta = actualUnits === null ? 0 : Math.ceil(actualUnits) - estimate;
    for (const c of charges) {
      if (c.kind === 'concurrency') await this.increment(db, c.scope, new Date(c.bucketStart), -1);
      else if (delta !== 0) await this.increment(db, c.scope, new Date(c.bucketStart), delta);
    }
    return true;
  }

  /**
   * L-9 reaper: a reservation never settled within its TTL releases its CONCURRENCY slots; its
   * units stay charged (the call may have run). Returns how many were reaped.
   */
  async reapExpired(now: Date = new Date(), db: MeterClient = this.prisma): Promise<number> {
    const stale = await db.computeReservation.findMany({
      where: { settledAt: null, expiresAt: { lt: now } },
      select: { id: true },
      take: 500,
    });
    let reaped = 0;
    for (const { id } of stale) if (await this.settle(id, null, 'REAPED', db)) reaped += 1;
    return reaped;
  }
}
