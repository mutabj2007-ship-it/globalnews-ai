import type { PrismaClient, Prisma } from '../../generated/prisma/client';
import { findCountryByIso2, findCountryByIso3 } from '@globalnews-ai/shared';
import { deriveWatchSubject } from './watch-subject.identity';
import { WATCH_LIMITS as L, WATCH_RUNTIME_ACTIVE } from './watch-runtime.policy';

type Tx = Prisma.TransactionClient;
type State = 'ACTIVE' | 'PAUSED' | 'CANCELLED';
type Claim = { runId: string; subscriptionId: string; attempt: number };
const day = (now: Date) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
const plus = (now: Date, seconds: number) => new Date(now.getTime() + seconds * 1000);
const terminal = new Set(['SUCCEEDED', 'NO_EVIDENCE', 'FAILED', 'BUDGET_EXHAUSTED', 'CANCELLED']);

/** Internal foundation only: no controller, module registration, cron, provider or payment dependency. */
export class WatchRuntime {
  constructor(
    private readonly db: PrismaClient,
    private readonly clock: () => Date = () => new Date(),
    // Tests explicitly supply true. Production default is the source-controlled HOLD.
    private readonly active: boolean = WATCH_RUNTIME_ACTIVE,
  ) {}

  private now(): Date {
    const now = this.clock();
    if (!Number.isFinite(now.getTime())) throw new Error('INVALID_CLOCK');
    return now;
  }

  async create(
    userId: string,
    countryCode: string,
    options: {
      intervalSeconds?: number;
      maxAttempts?: number;
      dailyRunLimit?: number;
      dailyAttemptLimit?: number;
      evidenceLimit?: number;
    } = {},
  ) {
    const country = findCountryByIso3(countryCode) ?? findCountryByIso2(countryCode);
    if (!country) throw new Error('UNSUPPORTED_COUNTRY');
    countryCode = country.iso3; // Preserve the persisted ISO3 subject identity.
    const values = {
      intervalSeconds: options.intervalSeconds ?? 3600,
      maxAttempts: options.maxAttempts ?? 3,
      dailyRunLimit: options.dailyRunLimit ?? 24,
      dailyAttemptLimit: options.dailyAttemptLimit ?? 48,
      evidenceLimit: options.evidenceLimit ?? 100,
    };
    const ranges: Record<keyof typeof values, [number, number]> = {
      intervalSeconds: [L.minIntervalSeconds, L.maxIntervalSeconds],
      maxAttempts: [1, L.maxAttempts],
      dailyRunLimit: [1, L.maxDailyRuns],
      dailyAttemptLimit: [1, L.maxDailyAttempts],
      evidenceLimit: [1, L.maxEvidence],
    };
    for (const key of Object.keys(values) as (keyof typeof values)[]) {
      const value = values[key];
      if (!Number.isInteger(value) || value < ranges[key][0] || value > ranges[key][1]) {
        throw new Error('INVALID_WATCH_BUDGET');
      }
    }
    const subject = deriveWatchSubject({
      surface: 'MAP',
      subjectType: 'PLACE',
      geographyId: `country:${countryCode}`,
    }).subject!;
    return this.db.$transaction(async (tx) => {
      // Serialize creation per owner, including the count predicate. Never mutate the owner.
      const owners = await tx.$queryRaw<
        { id: string }[]
      >`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
      if (!owners.length) throw new Error('OWNER_NOT_FOUND');
      const existing = await tx.watchSubscription.findUnique({
        where: { userId_subjectId: { userId, subjectId: subject.subjectId } },
      });
      if (existing) return existing; // Idempotent, including cancellation; never implicitly reactivate.
      if ((await tx.watchSubscription.count({ where: { userId } })) >= L.subscriptionsPerUser)
        throw new Error('SUBSCRIPTION_QUOTA');
      const now = this.now();
      return tx.watchSubscription.create({
        data: {
          userId,
          subjectId: subject.subjectId,
          countryCode,
          ...values,
          nextRunAt: now,
          budgetDay: day(now),
        },
      });
    });
  }

  private async lock(tx: Tx, id: string) {
    await tx.$queryRaw`SELECT "id" FROM "WatchSubscription" WHERE "id" = ${id} FOR UPDATE`;
    return tx.watchSubscription.findUnique({ where: { id } });
  }

  async setStatus(userId: string, id: string, status: State) {
    if (!['ACTIVE', 'PAUSED', 'CANCELLED'].includes(status)) throw new Error('INVALID_STATUS');
    if (status === 'ACTIVE' && !this.active) throw new Error('WATCH_RUNTIME_INACTIVE');
    return this.db.$transaction(async (tx) => {
      const sub = await this.lock(tx, id);
      if (!sub || sub.userId !== userId) throw new Error('WATCH_NOT_FOUND');
      if (sub.status === 'CANCELLED' && status !== 'CANCELLED') throw new Error('WATCH_CANCELLED');
      const now = this.now();
      if (status !== 'ACTIVE') {
        await tx.watchRun.updateMany({
          where: { subscriptionId: id, status: { in: ['RUNNING', 'RETRY_WAIT'] } },
          data: { status: 'CANCELLED', completedAt: now, leaseUntil: null, retryAt: null },
        });
      }
      return tx.watchSubscription.update({
        where: { id },
        data: {
          status,
          ...(status !== sub.status ? { nextRunAt: plus(now, sub.intervalSeconds) } : {}),
        },
      });
    });
  }

  async list(userId: string) {
    return this.db.watchSubscription.findMany({
      where: { userId },
      take: L.subscriptionsPerUser,
      orderBy: { id: 'asc' },
      include: {
        runs: { take: 10, orderBy: { scheduledAt: 'desc' }, include: { observation: true } },
      },
    });
  }

  /** A bounded tick, deliberately never registered with a timer. */
  async tick() {
    if (!this.active) return { active: false, visited: 0 };
    const now = this.now();
    const due = await this.db.watchSubscription.findMany({
      where: {
        status: 'ACTIVE',
        nextRunAt: { lte: now },
        runs: {
          none: {
            OR: [
              { status: 'RUNNING', leaseUntil: { gt: now } },
              { status: 'RETRY_WAIT', retryAt: { gt: now } },
            ],
          },
        },
      },
      orderBy: [{ nextRunAt: 'asc' }, { id: 'asc' }],
      take: L.batchSize,
      select: { id: true },
    });
    for (const sub of due) {
      const claim = await this.claim(sub.id);
      if (claim) await this.execute(claim);
    }
    return { active: true, visited: due.length };
  }

  async claim(id: string): Promise<Claim | null> {
    if (!this.active) return null;
    return this.db.$transaction(async (tx) => {
      const sub = await this.lock(tx, id);
      const now = this.now(); // Read time after acquiring the lock.
      if (!sub || sub.status !== 'ACTIVE' || sub.nextRunAt > now) return null;
      let run = await tx.watchRun.findUnique({
        where: { subscriptionId_scheduledAt: { subscriptionId: id, scheduledAt: sub.nextRunAt } },
      });
      if (
        run &&
        (terminal.has(run.status) ||
          (run.leaseUntil && run.leaseUntil > now) ||
          (run.retryAt && run.retryAt > now))
      )
        return null;
      const budgetDay = day(now);
      const reset = sub.budgetDay < budgetDay;
      const runsUsed = reset ? 0 : sub.runsUsed;
      const attemptsUsed = reset ? 0 : sub.attemptsUsed;
      if (run && run.attempts >= sub.maxAttempts) {
        await this.finishFailure(tx, sub, run.id, now, 'ATTEMPTS_EXHAUSTED');
        return null;
      }
      if ((!run && runsUsed >= sub.dailyRunLimit) || attemptsUsed >= sub.dailyAttemptLimit) {
        if (!run)
          run = await tx.watchRun.create({
            data: { subscriptionId: id, scheduledAt: sub.nextRunAt, status: 'BUDGET_EXHAUSTED' },
          });
        await tx.watchRun.update({
          where: { id: run.id },
          data: {
            status: 'BUDGET_EXHAUSTED',
            completedAt: now,
            failureCode: 'BUDGET_EXHAUSTED',
            leaseUntil: null,
            retryAt: null,
          },
        });
        await tx.watchSubscription.update({
          where: { id },
          data: {
            nextRunAt: new Date(
              Math.max(plus(budgetDay, 86400).getTime(), plus(now, sub.intervalSeconds).getTime()),
            ),
            lastFailureAt: now,
            lastFailureCode: 'BUDGET_EXHAUSTED',
          },
        });
        return null;
      }
      const first = !run;
      if (!run)
        run = await tx.watchRun.create({
          data: { subscriptionId: id, scheduledAt: sub.nextRunAt, status: 'RUNNING' },
        });
      const attempt = run.attempts + 1;
      await tx.watchRun.update({
        where: { id: run.id },
        data: {
          status: 'RUNNING',
          attempts: attempt,
          leaseUntil: plus(now, L.leaseSeconds),
          retryAt: null,
        },
      });
      await tx.watchSubscription.update({
        where: { id },
        data: { budgetDay, runsUsed: runsUsed + Number(first), attemptsUsed: attemptsUsed + 1 },
      });
      return { runId: run.id, subscriptionId: id, attempt };
    });
  }

  /** Only bounded stored-Article reads. The transaction contains no remote work. */
  async execute(claim: Claim): Promise<void> {
    if (!this.active) return;
    try {
      await this.db.$transaction(
        async (tx) => {
          const sub = await this.lock(tx, claim.subscriptionId);
          const now = this.now();
          const run = await tx.watchRun.findUnique({ where: { id: claim.runId } });
          if (
            !sub ||
            sub.status !== 'ACTIVE' ||
            !run ||
            run.subscriptionId !== sub.id ||
            run.status !== 'RUNNING' ||
            run.attempts !== claim.attempt ||
            !run.leaseUntil ||
            run.leaseUntil <= now
          )
            return;
          // Subscriptions retain ISO3 identity; stored Article.countryCode uses ISO2.
          const country = findCountryByIso3(sub.countryCode);
          if (!country) throw new Error('UNSUPPORTED_COUNTRY');
          const rows = await tx.article.findMany({
            where: {
              countryCode: country.iso2,
              fetchedAt: { gte: plus(run.scheduledAt, -86400), lte: run.scheduledAt },
            },
            orderBy: [{ fetchedAt: 'desc' }, { id: 'asc' }],
            take: sub.evidenceLimit + 1,
            select: {
              id: true,
              url: true,
              title: true,
              sourceId: true,
              fetchedAt: true,
              publishedAt: true,
              publishedAtBasis: true,
            },
          });
          const evidence = rows.slice(0, sub.evidenceLimit).map((row) => ({
            articleId: row.id,
            url: row.url.slice(0, 2048),
            title: row.title.slice(0, 500),
            sourceId: row.sourceId.slice(0, 200),
            fetchedAt: row.fetchedAt.toISOString(),
            publishedAt: row.publishedAt.toISOString(),
            publishedAtBasis: ['publisher', 'observed'].includes(row.publishedAtBasis)
              ? row.publishedAtBasis
              : 'unproven',
          }));
          const status = evidence.length ? 'SUCCEEDED' : 'NO_EVIDENCE';
          await tx.watchObservation.create({
            data: {
              runId: run.id,
              observedAt: now,
              outcome: evidence.length ? 'EVIDENCE_OBSERVED' : 'NO_EVIDENCE',
              evidence,
              truncated: rows.length > sub.evidenceLimit,
            },
          });
          await tx.watchRun.update({
            where: { id: run.id },
            data: { status, completedAt: now, leaseUntil: null, retryAt: null, failureCode: null },
          });
          await tx.watchSubscription.update({
            where: { id: sub.id },
            data: { lastSuccessAt: now, nextRunAt: plus(now, sub.intervalSeconds) },
          });
        },
        { timeout: 10000 },
      );
    } catch {
      // No exception text or provider data is persisted. If recording fails, lease expiry recovers.
      await this.fail(claim);
    }
  }

  async fail(claim: Claim): Promise<void> {
    if (!this.active) return;
    await this.db.$transaction(async (tx) => {
      const sub = await this.lock(tx, claim.subscriptionId);
      const now = this.now();
      const run = await tx.watchRun.findUnique({ where: { id: claim.runId } });
      if (
        !sub ||
        sub.status !== 'ACTIVE' ||
        !run ||
        run.subscriptionId !== sub.id ||
        run.status !== 'RUNNING' ||
        run.attempts !== claim.attempt ||
        !run.leaseUntil ||
        run.leaseUntil <= now
      )
        return;
      if (run.attempts >= sub.maxAttempts) {
        await this.finishFailure(tx, sub, run.id, now, 'STORED_EVIDENCE_READ_FAILED');
      } else {
        const retryAt = plus(now, L.retrySeconds * 2 ** (run.attempts - 1));
        await tx.watchRun.update({
          where: { id: run.id },
          data: {
            status: 'RETRY_WAIT',
            retryAt,
            leaseUntil: null,
            failureCode: 'STORED_EVIDENCE_READ_FAILED',
          },
        });
        await tx.watchSubscription.update({
          where: { id: sub.id },
          data: { lastFailureAt: now, lastFailureCode: 'STORED_EVIDENCE_READ_FAILED' },
        });
      }
    });
  }

  private async finishFailure(
    tx: Tx,
    sub: { id: string; intervalSeconds: number },
    runId: string,
    now: Date,
    code: string,
  ) {
    await tx.watchRun.update({
      where: { id: runId },
      data: {
        status: 'FAILED',
        failureCode: code,
        completedAt: now,
        leaseUntil: null,
        retryAt: null,
      },
    });
    await tx.watchSubscription.update({
      where: { id: sub.id },
      data: {
        lastFailureAt: now,
        lastFailureCode: code,
        nextRunAt: plus(now, sub.intervalSeconds),
      },
    });
  }
}
