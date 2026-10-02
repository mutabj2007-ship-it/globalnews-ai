import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  NETWORK_CONCURRENCY_PREFIX,
  NETWORK_SCOPE_PREFIXES,
  NETWORK_WINDOW_DAYS,
  ago,
  resolveRetentionPolicy,
  type RetentionPolicy,
} from './retention-policy';

export interface RetentionSweepResult {
  readonly accountThreads: number;
  readonly supportTickets: number;
  readonly productEvents: number;
  readonly analysisRuns: number;
  readonly usageMeters: number;
  readonly networkMeters: number;
  readonly networkConcurrency: number;
  readonly reservations: number;
}

/**
 * TRUST & CONVERSATIONAL EXPERIENCE R1 — enforces the Beta retention policy (retention-policy.ts).
 *
 * Bounded batches per category, oldest first; every category is independent, so one failing
 * delete never stops the others, and a failure is logged and swallowed (the service must keep
 * answering readers). Age is the ONLY predicate: no identifier is ever accepted from a caller.
 * A process sweeps at most once per interval (timer is unref'd); N replicas sweep idempotently.
 */
@Injectable()
export class DataRetentionService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(DataRetentionService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: RetentionPolicy = resolveRetentionPolicy(),
  ) {}

  onApplicationBootstrap(): void {
    if (!this.policy.enabled || process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.sweep(), this.policy.intervalMs);
    this.timer.unref();
    setTimeout(() => void this.sweep(), 60_000).unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async step(label: string, work: () => Promise<number>): Promise<number> {
    try {
      return await work();
    } catch (error) {
      this.logger.warn(
        `retention ${label} did not complete: ${(error as Error)?.message ?? 'unknown'}`,
      );
      return 0;
    }
  }

  async sweep(now: Date = new Date()): Promise<RetentionSweepResult> {
    const p = this.policy;
    const take = p.batch;

    const accountThreads = await this.step('account-conversations', async () => {
      const threads = await this.prisma.askThread.findMany({
        where: {
          userId: { not: null },
          updatedAt: { lt: ago(now, p.accountConversationDays) },
          /* A Saved (bookmarked) turn keeps its thread: the reader's Saved lifecycle governs it. */
          turns: { none: { bookmarks: { some: {} } } },
        },
        orderBy: { updatedAt: 'asc' },
        take,
        select: { id: true, turns: { select: { operationId: true } } },
      });
      if (threads.length === 0) return 0;
      const operationIds = threads.flatMap((t) => t.turns.map((turn) => turn.operationId));
      const results = await this.prisma.computeOperation.findMany({
        where: { id: { in: operationIds }, storedResultId: { not: null } },
        select: { storedResultId: true },
      });
      await this.prisma.$transaction([
        this.prisma.computeOperation.deleteMany({ where: { id: { in: operationIds } } }),
        this.prisma.storedResult.deleteMany({
          where: { id: { in: results.map((r) => r.storedResultId as string) } },
        }),
        this.prisma.askThread.deleteMany({ where: { id: { in: threads.map((t) => t.id) } } }),
      ]);
      return threads.length;
    });

    const supportTickets = await this.step('support', async () => {
      const tickets = await this.prisma.supportTicket.findMany({
        where: { status: 'RESOLVED', updatedAt: { lt: ago(now, p.supportResolvedDays) } },
        orderBy: { updatedAt: 'asc' },
        take,
        select: { id: true },
      });
      if (tickets.length === 0) return 0;
      return (
        await this.prisma.supportTicket.deleteMany({
          where: { id: { in: tickets.map((t) => t.id) } },
        })
      ).count;
    });

    const usageCutoff = ago(now, p.usageDays);
    const productEvents = await this.step('product-events', async () => {
      const rows = await this.prisma.productEvent.findMany({
        where: { createdAt: { lt: usageCutoff } },
        orderBy: { createdAt: 'asc' },
        take,
        select: { id: true },
      });
      if (rows.length === 0) return 0;
      return (
        await this.prisma.productEvent.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } })
      ).count;
    });
    const analysisRuns = await this.step('analysis-runs', async () => {
      const rows = await this.prisma.analysisRun.findMany({
        where: { createdAt: { lt: usageCutoff } },
        orderBy: { createdAt: 'asc' },
        take,
        select: { id: true },
      });
      if (rows.length === 0) return 0;
      return (
        await this.prisma.analysisRun.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } })
      ).count;
    });

    const networkCutoff = ago(now, NETWORK_WINDOW_DAYS + p.rateLimitGraceDays);
    const networkMeters = await this.step(
      'network-meters',
      async () =>
        (
          await this.prisma.computeMeter.deleteMany({
            where: {
              bucketStart: { lt: networkCutoff },
              OR: NETWORK_SCOPE_PREFIXES.map((prefix) => ({ scope: { startsWith: prefix } })),
            },
          })
        ).count,
    );
    /* Concurrency rows sit in a fixed bucket; an IDLE one (nothing in flight) is safe to remove. */
    const networkConcurrency = await this.step(
      'network-concurrency',
      async () =>
        (
          await this.prisma.computeMeter.deleteMany({
            where: { scope: { startsWith: NETWORK_CONCURRENCY_PREFIX }, units: { lte: 0 } },
          })
        ).count,
    );
    const usageMeters = await this.step(
      'usage-meters',
      async () =>
        (
          await this.prisma.computeMeter.deleteMany({
            where: {
              bucketStart: { lt: usageCutoff, gt: new Date(0) },
              NOT: [
                ...NETWORK_SCOPE_PREFIXES.map((prefix) => ({ scope: { startsWith: prefix } })),
                { scope: { startsWith: 'conc:' } },
              ],
            },
          })
        ).count,
    );
    /* Settled reservations list the meter scopes they charged (network ones included). */
    const reservations = await this.step(
      'reservations',
      async () =>
        (
          await this.prisma.computeReservation.deleteMany({
            where: { settledAt: { not: null }, createdAt: { lt: networkCutoff } },
          })
        ).count,
    );

    const result = {
      accountThreads,
      supportTickets,
      productEvents,
      analysisRuns,
      usageMeters,
      networkMeters,
      networkConcurrency,
      reservations,
    };
    if (Object.values(result).some((n) => n > 0))
      this.logger.log(`retention sweep ${JSON.stringify(result)}`);
    return result;
  }
}
