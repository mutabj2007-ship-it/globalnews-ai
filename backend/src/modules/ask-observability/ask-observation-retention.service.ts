import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { withDeadline } from '../compute-controls/compute-scopes';
import {
  ASK_OBSERVATION_RETENTION_BATCH,
  ASK_OBSERVATION_RETENTION_DAYS,
  ASK_OBSERVATION_RETENTION_SWEEP_INTERVAL_MS,
  ASK_OBSERVATION_STORE_DEADLINE_MS,
} from './ask-observation.contract';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK PUBLIC BETA OPERATIONS R1 — RETENTION THAT IS ENFORCED, NOT DECLARED
 * ════════════════════════════════════════════════════════════════════════════
 *
 * THE EXISTING TELEMETRY DISCLOSES THE OPPOSITE, AND THAT DISCLOSURE IS WHY THIS EXISTS.
 * `AdminAnalyticsService` ships a retention rule with `enforced: false`, because this
 * backend has no scheduler and no purge job — a 90-day rule that nothing applies is a
 * comment. Public Beta puts a new table on a public-facing path, so "bounded" had to
 * become a property of the code.
 *
 * AN OPPORTUNISTIC SWEEP, NOT A SCHEDULER, AND THE CHOICE IS DELIBERATE. Introducing a
 * timer would add a background process to a backend that has none, with its own failure
 * modes and its own review surface. Instead the writer offers this service a chance to
 * sweep after it has already finished its own work; the service sweeps at most once per
 * interval per process, deletes at most one bounded batch, and returns.
 *
 * WHAT IT MAY DELETE, AND NOTHING ELSE. Rows whose `occurredAt` is older than the
 * retention horizon, and counter buckets older than the same horizon. There is no other
 * predicate in this file, no identifier is accepted from anywhere, and
 * `askObservationRetention.spec.ts` asserts that a row inside the window is never touched
 * — with a positive control proving the same sweep does remove one outside it.
 *
 * KNOWN AND STATED: in-process rate limiting means PER PROCESS, so N replicas each sweep
 * up to once per interval. Deletes by age are idempotent, so that is a small amount of
 * duplicated work rather than a correctness problem. It is recorded because it matters
 * before horizontal scaling, exactly as the telemetry module records the same property of
 * its own in-process ceiling.
 *
 * IT CANNOT FAIL THE CALLER. Every path is wrapped, bounded by the same deadline the
 * writer uses, and a failure is logged and swallowed. Ask must answer whether or not
 * yesterday's rows could be removed.
 */
@Injectable()
export class AskObservationRetentionService {
  private readonly logger = new Logger(AskObservationRetentionService.name);
  private lastSweptAt = 0;

  constructor(private readonly prisma: PrismaService) {}

  /** The horizon. Anything strictly older than this instant is out of retention. */
  cutoff(now: Date): Date {
    return new Date(now.getTime() - ASK_OBSERVATION_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  }

  /** True when this process has not swept within the interval. */
  private due(nowMs: number): boolean {
    return nowMs - this.lastSweptAt >= ASK_OBSERVATION_RETENTION_SWEEP_INTERVAL_MS;
  }

  /**
   * Offer the store a chance to sweep. Returns how many rows were removed, for tests.
   *
   * The clock is advanced BEFORE the work, so a sweep that throws does not turn into a
   * sweep on every subsequent write.
   */
  async sweepIfDue(now: Date = new Date()): Promise<number> {
    if (!this.due(now.getTime())) return 0;
    this.lastSweptAt = now.getTime();
    return this.sweep(now);
  }

  /** The sweep itself, exposed so a test can run it without waiting for an interval. */
  async sweep(now: Date = new Date()): Promise<number> {
    const cutoff = this.cutoff(now);
    try {
      /*
        A BOUNDED BATCH, NOT `deleteMany` OVER THE WHOLE BACKLOG. An unbounded delete on a
        table that has been accumulating is a long transaction holding locks on the path
        that answers readers. The ids are chosen first, oldest first, and only those are
        removed — so the work per sweep is bounded no matter how far behind retention is.
      */
      const stale = await withDeadline(
        this.prisma.askObservation.findMany({
          where: { occurredAt: { lt: cutoff } },
          orderBy: { occurredAt: 'asc' },
          take: ASK_OBSERVATION_RETENTION_BATCH,
          select: { id: true },
        }),
        ASK_OBSERVATION_STORE_DEADLINE_MS,
        'ask-retention-scan',
      );

      let removed = 0;
      if (stale.length > 0) {
        const result = await withDeadline(
          this.prisma.askObservation.deleteMany({
            where: { id: { in: stale.map((row) => row.id) } },
          }),
          ASK_OBSERVATION_STORE_DEADLINE_MS,
          'ask-retention-observations',
        );
        removed = result.count;
      }

      const counters = await withDeadline(
        this.prisma.askAccessCounter.deleteMany({ where: { bucketStart: { lt: cutoff } } }),
        ASK_OBSERVATION_STORE_DEADLINE_MS,
        'ask-retention-counters',
      );

      if (removed > 0 || counters.count > 0) {
        this.logger.log(
          `ask retention removed ${removed} observation(s) and ${counters.count} counter bucket(s) older than ${cutoff.toISOString()}`,
        );
      }
      return removed;
    } catch (error) {
      this.logger.warn(
        `ask retention sweep did not complete: ${(error as Error)?.message ?? 'unknown'}`,
      );
      return 0;
    }
  }
}
