import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import { ComputeMeterService } from '../../compute-controls/compute-meter.service';
import { countsAsGuestAnswer, releaseReasonOf, settleSlot } from './guest-allowance';
import { GuestSessionService } from './guest-session.service';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK GUEST TRIAL R3 — REQUEST-INDEPENDENT GUEST MAINTENANCE (CTO D2)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * No new service, no paid scheduler: a bounded sweep inside the existing backend process.
 *
 *   INTERVAL   ASK_GUEST_SWEEP_INTERVAL_S (default 900 s); the first run is 30 s after boot, so a
 *              restart catches up without waiting a full interval — bounded by the same batch.
 *   REPLICAS   each run holds a TRANSACTION-scoped Postgres advisory lock
 *              (pg_try_advisory_xact_lock): one replica sweeps, the others skip that tick.
 *   BOUNDS     at most ASK_GUEST_SWEEP_BATCH rows per step, a 20 s transaction timeout; a run
 *              that leaves work behind logs its backlog and the next tick continues.
 *   DOWNTIME   nothing runs while the process is down; LOGICAL expiry does not depend on the
 *              sweep — every access checks `expiresAt` itself — so a stopped sweep delays only
 *              PHYSICAL deletion, never access control.
 *
 * Steps, each bounded:
 *   1. expire PENDING claims past their TTL;
 *   2. settle stale RESERVED slots from their operation's real outcome (late completion,
 *      crashed worker, expired lease — never counting what did not complete);
 *   3. reap unsettled meter reservations (releases concurrency held by a crashed request; the
 *      units stay charged — the existing L-9 reaper, which nothing scheduled before);
 *   4. physically delete guest sessions whose ABSOLUTE lifetime ended more than
 *      ASK_GUEST_PURGE_GRACE_H ago (cascade: threads, turns, operations, stored results, slots,
 *      claims). Conversations already moved to an account are not guest content any more and
 *      are untouched. Backups follow the platform's database backup policy; deletion here is
 *      not a claim of immediate erasure from backups.
 */

const ADVISORY_LOCK_KEY = 7_311_2026_03; // stable, arbitrary: "ask guest sweep"
const FIRST_RUN_DELAY_MS = 30_000;
const LEASE_GRACE_MS = 10 * 60_000;

export interface SweepReport {
  readonly ran: boolean;
  readonly claimsExpired: number;
  readonly slotsSettled: number;
  readonly reservationsReaped: number;
  readonly sessionsPurged: number;
  readonly backlog: boolean;
}

@Injectable()
export class GuestMaintenanceService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(GuestMaintenanceService.name);
  private timer: NodeJS.Timeout | null = null;
  private first: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly guests: GuestSessionService,
    private readonly meter: ComputeMeterService,
  ) {}

  onApplicationBootstrap(): void {
    if (process.env.NODE_ENV === 'test') return;
    const intervalMs = this.guests.trialConfig().lifetimes.sweepIntervalS * 1000;
    this.first = setTimeout(() => void this.tick(), FIRST_RUN_DELAY_MS);
    this.first.unref();
    this.timer = setInterval(() => void this.tick(), intervalMs);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.first) clearTimeout(this.first);
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const report = await this.sweep();
      if (report.ran && (report.backlog || report.sessionsPurged + report.slotsSettled > 0)) {
        this.logger.log(
          `guest sweep: claims ${report.claimsExpired}, slots ${report.slotsSettled}, ` +
            `reservations ${report.reservationsReaped}, sessions purged ${report.sessionsPurged}` +
            (report.backlog ? ' — backlog remains' : ''),
        );
      }
    } catch (error) {
      this.logger.warn(`guest sweep failed: ${(error as Error).name}`);
    } finally {
      this.running = false;
    }
  }

  /** One bounded sweep. Public for tests and for an operator-run catch-up. */
  async sweep(now: Date = new Date()): Promise<SweepReport> {
    const { sweepBatch: batch, purgeGraceH } = this.guests.trialConfig().lifetimes;
    const locked = await this.prisma.$transaction(
      async (tx) => {
        const [{ got }] = await tx.$queryRaw<{ got: boolean }[]>`
          SELECT pg_try_advisory_xact_lock(${ADVISORY_LOCK_KEY}::bigint) AS got`;
        if (!got) return null;

        /* 1 · claims */
        const staleClaims = await tx.guestClaim.findMany({
          where: { status: 'PENDING', expiresAt: { lte: now } },
          select: { id: true },
          take: batch,
        });
        if (staleClaims.length > 0) {
          await tx.guestClaim.updateMany({
            where: { id: { in: staleClaims.map((c) => c.id) }, status: 'PENDING' },
            data: { status: 'EXPIRED' },
          });
        }

        /* 2 · stale reserved slots, settled from the operation's REAL outcome */
        const staleSlots = await tx.guestSlot.findMany({
          where: { state: 'RESERVED', createdAt: { lt: new Date(now.getTime() - LEASE_GRACE_MS) } },
          select: {
            operationId: true,
            operation: {
              select: {
                id: true,
                status: true,
                failureCode: true,
                leaseExpiresAt: true,
                quoteExpiresAt: true,
                storedResult: { select: { payload: true } },
              },
            },
          },
          take: batch,
        });
        let slotsSettled = 0;
        for (const slot of staleSlots) {
          const op = slot.operation;
          let moved = false;
          if (op.status === 'COMPLETED') {
            moved = await settleSlot(
              tx,
              op.id,
              countsAsGuestAnswer(op.storedResult?.payload ?? null)
                ? { commit: true }
                : { commit: false, reason: 'NO_ANSWER' },
              now,
            );
          } else if (op.status === 'RELEASED' || op.status === 'REFUNDED') {
            moved = await settleSlot(
              tx,
              op.id,
              { commit: false, reason: releaseReasonOf(op.failureCode ?? 'UNKNOWN') },
              now,
            );
          } else if (
            (op.status === 'RUNNING' && op.leaseExpiresAt !== null && op.leaseExpiresAt <= now) ||
            (op.status !== 'RUNNING' && op.quoteExpiresAt <= now)
          ) {
            const code = op.status === 'RUNNING' ? 'EXECUTION_OUTCOME_UNKNOWN' : 'QUOTE_EXPIRED';
            await tx.computeOperation.updateMany({
              where: { id: op.id, status: op.status },
              data: { status: 'RELEASED', failureCode: code, completedAt: now, runToken: null },
            });
            moved = await settleSlot(
              tx,
              op.id,
              { commit: false, reason: releaseReasonOf(code) },
              now,
            );
          }
          if (moved) slotsSettled += 1;
        }

        /* 4 · physical deletion after the absolute lifetime + grace */
        const purgeBefore = new Date(now.getTime() - purgeGraceH * 3_600_000);
        const expired = await tx.guestSession.findMany({
          where: { expiresAt: { lt: purgeBefore } },
          select: { id: true },
          take: batch,
        });
        if (expired.length > 0) {
          await tx.guestSession.deleteMany({ where: { id: { in: expired.map((s) => s.id) } } });
        }
        return {
          claimsExpired: staleClaims.length,
          slotsSettled,
          sessionsPurged: expired.length,
          backlog:
            staleClaims.length === batch || staleSlots.length === batch || expired.length === batch,
        };
      },
      { timeout: 20_000, isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
    if (locked === null) {
      return {
        ran: false,
        claimsExpired: 0,
        slotsSettled: 0,
        reservationsReaped: 0,
        sessionsPurged: 0,
        backlog: false,
      };
    }
    /* 3 · meter reservations (idempotent per reservation; safe from any replica) */
    const reservationsReaped = await this.meter.reapExpired(now).catch(() => 0);
    return { ran: true, ...locked, reservationsReaped };
  }
}
