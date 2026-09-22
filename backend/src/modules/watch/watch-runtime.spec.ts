import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import { WatchRuntime } from './watch-runtime';
import { WATCH_RUNTIME_ACTIVE } from './watch-runtime.policy';

const connectionString = process.env.WATCH_TEST_DATABASE_URL;
// Explicit opt-in; refuse any database other than this disposable localhost fixture.
if (
  connectionString &&
  connectionString !== 'postgresql://watch_test@127.0.0.1:55439/watch_runtime_test'
) {
  throw new Error('Watch integration tests require the isolated localhost fixture');
}

describe('Watch production HOLD', () => {
  it('defaults to inactive without accessing the database', async () => {
    const runtime = new WatchRuntime({} as PrismaClient);
    expect(WATCH_RUNTIME_ACTIVE).toBe(false);
    expect(await runtime.tick()).toEqual({ active: false, visited: 0 });
    expect(await runtime.claim('unused')).toBeNull();
    await expect(runtime.setStatus('u', 's', 'ACTIVE')).rejects.toThrow('WATCH_RUNTIME_INACTIVE');
  });
  it('preserves the frontend gate and has no runtime registration or Follow coupling', () => {
    const root = join(__dirname, '../../../..');
    expect(
      readFileSync(join(root, 'frontend/src/lib/map/monetization/watchRuntimeGate.ts'), 'utf8'),
    ).toContain('WATCH_RUNTIME_ACTIVE = false');
    const app = readFileSync(join(root, 'backend/src/app.module.ts'), 'utf8');
    expect(app).not.toMatch(/import .*Watch/);
    const follow = readFileSync(join(__dirname, '../follows/follows.service.ts'), 'utf8');
    expect(follow).not.toMatch(/watchSubscription|WatchRuntime/);
  });
});

(connectionString ? describe : describe.skip)(
  'Watch durable PostgreSQL lifecycle (controlled clock)',
  () => {
    let db: PrismaClient;
    let runtime: WatchRuntime;
    let time: Date;
    const advance = (seconds: number) => {
      time = new Date(time.getTime() + seconds * 1000);
    };
    const subrow = (id: string) => db.watchSubscription.findUniqueOrThrow({ where: { id } });
    const runrow = (id: string) => db.watchRun.findUniqueOrThrow({ where: { id } });
    async function ready(options: Parameters<WatchRuntime['create']>[2] = {}) {
      const sub = await runtime.create('owner', 'POL', options);
      await runtime.setStatus('owner', sub.id, 'ACTIVE');
      advance(3600);
      return sub;
    }
    beforeAll(() => {
      db = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 6 }) });
    });
    beforeEach(async () => {
      await db.watchSubscription.deleteMany();
      await db.article.deleteMany();
      await db.user.deleteMany();
      await db.user.createMany({
        data: [
          { id: 'owner', email: 'watch@test.invalid' },
          { id: 'other', email: 'other@test.invalid' },
        ],
      });
      time = new Date('2026-09-22T00:00:00.000Z');
      runtime = new WatchRuntime(db, () => new Date(time), true);
    });
    afterAll(async () => {
      await db.$disconnect();
    });

    it('creates paused and idempotently, without creating a Follow or run', async () => {
      const [a, b] = await Promise.all([
        runtime.create('owner', 'POL'),
        runtime.create('owner', 'POL'),
      ]);
      expect(a.id).toBe(b.id);
      expect(a.status).toBe('PAUSED');
      expect(await db.countryFollow.count()).toBe(0);
      expect(await db.watchRun.count()).toBe(0);
    });
    it.each(['PL', 'POL', ' pl ', ' pOl '])(
      'normalizes %s to the existing ISO3 subscription identity',
      async (input) => {
        const sub = await runtime.create('owner', input);
        expect(sub.countryCode).toBe('POL');
        expect(sub.subjectId).toBe('watch:map:place:727bed200a74');
        expect((await runtime.create('owner', 'POL')).id).toBe(sub.id);
        expect(await db.watchSubscription.count()).toBe(1);
      },
    );
    it.each(['ZZ', 'ZZZ', '', 'Poland', 'UK'])(
      'refuses unsupported country input %s without persistence',
      async (input) => {
        await expect(runtime.create('owner', input)).rejects.toThrow('UNSUPPORTED_COUNTRY');
        expect(await db.watchSubscription.count()).toBe(0);
      },
    );
    it('reuses a baseline ISO3 identity across aliases without reactivating cancellation', async () => {
      const baseline = await db.watchSubscription.create({
        data: {
          userId: 'owner',
          subjectId: 'watch:map:place:727bed200a74',
          countryCode: 'POL',
          status: 'CANCELLED',
          nextRunAt: time,
          budgetDay: time,
        },
      });
      for (const input of ['PL', 'POL', ' pl ', ' pol ']) {
        expect(await runtime.create('owner', input)).toEqual(baseline);
      }
      expect(await db.watchSubscription.count()).toBe(1);
      expect(await db.watchRun.count()).toBe(0);
    });
    it.each([
      ['PL', 'POL'],
      ['GB', 'GBR'],
    ])(
      'looks up retained ISO2 evidence for %s after persistence and reload',
      async (iso2, iso3) => {
        const sub = await runtime.create('owner', iso3);
        await runtime.setStatus('owner', sub.id, 'ACTIVE');
        advance(3600);
        await db.article.createMany({
          data: [iso2, 'US'].map((countryCode) => ({
            id: countryCode,
            title: countryCode,
            summary: '',
            url: `https://example.invalid/${countryCode}`,
            sourceId: 'test',
            sourceName: 'Test',
            category: 'world',
            countryCode,
            publishedAt: time,
            fetchedAt: time,
          })),
        });
        const reloadedDb = new PrismaClient({
          adapter: new PrismaPg({ connectionString, max: 2 }),
        });
        try {
          const reloaded = new WatchRuntime(reloadedDb, () => new Date(time), true);
          expect((await reloaded.list('owner'))[0]).toMatchObject({
            id: sub.id,
            countryCode: iso3,
          });
          expect((await reloaded.create('owner', iso2)).id).toBe(sub.id);
          expect(await reloaded.tick()).toEqual({ active: true, visited: 1 });
          expect(await reloaded.tick()).toEqual({ active: true, visited: 0 });
          const run = await reloadedDb.watchRun.findFirstOrThrow({
            include: { observation: true },
          });
          expect(run.status).toBe('SUCCEEDED');
          expect(run.observation?.evidence).toEqual([expect.objectContaining({ articleId: iso2 })]);
          expect(await reloadedDb.watchSubscription.count()).toBe(1);
          expect(await reloadedDb.watchObservation.count()).toBe(1);
        } finally {
          await reloadedDb.$disconnect();
        }
      },
    );
    it('refuses an unsupported persisted code without an unfiltered evidence read', async () => {
      const sub = await ready({ maxAttempts: 1 });
      await db.watchSubscription.update({ where: { id: sub.id }, data: { countryCode: 'ZZZ' } });
      await runtime.tick();
      expect((await db.watchRun.findFirstOrThrow()).status).toBe('FAILED');
      expect(await db.watchObservation.count()).toBe(0);
    });
    it('enforces validation and owner quota under concurrent creation', async () => {
      await expect(runtime.create('owner', 'ZZZ')).rejects.toThrow('UNSUPPORTED_COUNTRY');
      for (const value of [0, 101, NaN, 1.5])
        await expect(runtime.create('owner', 'POL', { evidenceLimit: value })).rejects.toThrow(
          'INVALID_WATCH_BUDGET',
        );
      const codes = [
        'POL',
        'USA',
        'GBR',
        'FRA',
        'DEU',
        'ESP',
        'ITA',
        'CAN',
        'MEX',
        'BRA',
        'ARG',
        'CHL',
        'PER',
        'JPN',
        'CHN',
        'IND',
        'AUS',
        'NZL',
        'RWA',
        'KEN',
        'UGA',
      ];
      const results = await Promise.allSettled(codes.map((code) => runtime.create('owner', code)));
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(20);
      expect(await db.watchSubscription.count()).toBe(20);
    });
    it('rejects cross-owner access and cancelled reactivation', async () => {
      const sub = await runtime.create('owner', 'POL');
      await expect(runtime.setStatus('other', sub.id, 'CANCELLED')).rejects.toThrow(
        'WATCH_NOT_FOUND',
      );
      expect(await runtime.list('other')).toEqual([]);
      await runtime.setStatus('owner', sub.id, 'CANCELLED');
      await expect(runtime.setStatus('owner', sub.id, 'ACTIVE')).rejects.toThrow('WATCH_CANCELLED');
      expect((await runtime.create('owner', 'POL')).status).toBe('CANCELLED');
    });
    it('distinguishes not-due from exact due time', async () => {
      const sub = await runtime.create('owner', 'POL');
      await runtime.setStatus('owner', sub.id, 'ACTIVE');
      advance(3599);
      expect(await runtime.claim(sub.id)).toBeNull();
      advance(1);
      expect(await runtime.claim(sub.id)).not.toBeNull();
    });
    it('serializes duplicate claims and reserves one logical run', async () => {
      const sub = await ready();
      const claims = await Promise.all(Array.from({ length: 8 }, () => runtime.claim(sub.id)));
      expect(claims.filter(Boolean)).toHaveLength(1);
      expect(await db.watchRun.count()).toBe(1);
      expect((await subrow(sub.id)).runsUsed).toBe(1);
      expect((await subrow(sub.id)).attemptsUsed).toBe(1);
    });
    it('commits no-evidence once across replay and process restart', async () => {
      const sub = await ready();
      const claim = (await runtime.claim(sub.id))!;
      await Promise.all([
        runtime.execute(claim),
        new WatchRuntime(db, () => time, true).execute(claim),
      ]);
      expect((await runrow(claim.runId)).status).toBe('NO_EVIDENCE');
      expect(await db.watchObservation.count()).toBe(1);
      expect((await db.watchObservation.findFirstOrThrow()).evidence).toEqual([]);
      expect((await subrow(sub.id)).lastSuccessAt).toEqual(time);
      expect((await subrow(sub.id)).nextRunAt).toEqual(new Date('2026-09-22T02:00:00Z'));
      expect((await subrow(sub.id)).runsUsed).toBe(1);
    });
    it('reuses bounded retained evidence, preserves provenance and reports truncation', async () => {
      const sub = await ready({ evidenceLimit: 1 });
      await db.article.createMany({
        data: ['a', 'b', 'future', 'outside'].map((id) => ({
          id,
          title: id,
          summary: '',
          url: `https://example.invalid/${id}`,
          sourceId: 'test',
          sourceName: 'Test',
          category: 'world',
          countryCode: id === 'outside' ? 'US' : 'PL',
          publishedAt: time,
          publishedAtBasis: 'observed',
          fetchedAt: id === 'future' ? new Date(time.getTime() + 1000) : time,
        })),
      });
      const claim = (await runtime.claim(sub.id))!;
      await runtime.execute(claim);
      const observation = await db.watchObservation.findFirstOrThrow();
      expect(observation.truncated).toBe(true);
      expect(observation.evidence).toEqual([
        expect.objectContaining({ articleId: 'a', publishedAtBasis: 'observed' }),
      ]);
      expect((await runrow(claim.runId)).status).toBe('SUCCEEDED');
    });
    it('retries the same run at the backoff boundary without double reservation', async () => {
      const sub = await ready();
      const first = (await runtime.claim(sub.id))!;
      await runtime.fail(first);
      expect((await runrow(first.runId)).status).toBe('RETRY_WAIT');
      advance(59);
      expect(await runtime.claim(sub.id)).toBeNull();
      advance(1);
      const second = (await runtime.claim(sub.id))!;
      expect(second).toEqual({ ...first, attempt: 2 });
      await runtime.execute(second);
      expect((await subrow(sub.id)).runsUsed).toBe(1);
      expect((await subrow(sub.id)).attemptsUsed).toBe(2);
      expect((await subrow(sub.id)).lastFailureAt).not.toBeNull();
    });
    it('terminates after bounded failures and advances next run', async () => {
      const sub = await ready();
      for (let i = 1; i <= 3; i++) {
        const claim = (await runtime.claim(sub.id))!;
        await runtime.fail(claim);
        if (i < 3) advance(60 * 2 ** (i - 1));
      }
      expect((await db.watchRun.findFirstOrThrow()).status).toBe('FAILED');
      expect((await subrow(sub.id)).lastFailureCode).toBe('STORED_EVIDENCE_READ_FAILED');
      expect((await subrow(sub.id)).nextRunAt.getTime()).toBe(time.getTime() + 3600000);
      expect(await db.watchObservation.count()).toBe(0);
    });
    it('fences stale workers after lease expiry and recovery', async () => {
      const sub = await ready();
      const first = (await runtime.claim(sub.id))!;
      advance(60);
      const recovered = (await runtime.claim(sub.id))!;
      await runtime.execute(first);
      await runtime.fail(first);
      expect(await db.watchObservation.count()).toBe(0);
      await runtime.execute(recovered);
      expect(await db.watchObservation.count()).toBe(1);
      expect((await subrow(sub.id)).runsUsed).toBe(1);
    });
    it('terminalizes exhausted leases after repeated worker crashes', async () => {
      const sub = await ready({ maxAttempts: 1 });
      const claim = (await runtime.claim(sub.id))!;
      advance(60);
      expect(await runtime.claim(sub.id)).toBeNull();
      expect((await runrow(claim.runId)).status).toBe('FAILED');
    });
    it.each(['PAUSED', 'CANCELLED'] as const)(
      'prevents execution after %s and rejects stale completion',
      async (status) => {
        const sub = await ready();
        const claim = (await runtime.claim(sub.id))!;
        await runtime.setStatus('owner', sub.id, status);
        await runtime.execute(claim);
        await runtime.fail(claim);
        advance(7200);
        expect(await runtime.claim(sub.id)).toBeNull();
        expect(await db.watchObservation.count()).toBe(0);
        expect((await runrow(claim.runId)).status).toBe('CANCELLED');
      },
    );
    it('resumes a paused watch on a fresh slot without replaying cancelled work', async () => {
      const sub = await ready();
      const old = (await runtime.claim(sub.id))!;
      await runtime.setStatus('owner', sub.id, 'PAUSED');
      await runtime.setStatus('owner', sub.id, 'ACTIVE');
      advance(3600);
      const next = (await runtime.claim(sub.id))!;
      expect(next.runId).not.toBe(old.runId);
      await runtime.execute(old);
      await runtime.execute(next);
      expect(await db.watchObservation.count()).toBe(1);
    });
    it('enforces daily run budgets, replay safety and UTC reset', async () => {
      const sub = await ready({ dailyRunLimit: 1 });
      await runtime.tick();
      advance(3600);
      expect(await runtime.claim(sub.id)).toBeNull();
      expect(
        (await db.watchRun.findFirstOrThrow({ where: { status: 'BUDGET_EXHAUSTED' } })).attempts,
      ).toBe(0);
      expect(await runtime.claim(sub.id)).toBeNull();
      expect((await subrow(sub.id)).runsUsed).toBe(1);
      time = new Date('2026-09-23T00:00:00Z');
      expect(await runtime.claim(sub.id)).not.toBeNull();
      expect((await subrow(sub.id)).runsUsed).toBe(1);
      expect((await subrow(sub.id)).attemptsUsed).toBe(1);
    });
    it('enforces attempt budget across retries', async () => {
      const sub = await ready({ dailyAttemptLimit: 1 });
      const claim = (await runtime.claim(sub.id))!;
      await runtime.fail(claim);
      advance(60);
      expect(await runtime.claim(sub.id)).toBeNull();
      expect((await runrow(claim.runId)).status).toBe('BUDGET_EXHAUSTED');
      expect((await subrow(sub.id)).attemptsUsed).toBe(1);
    });
    it('database rejects duplicate runs and observations', async () => {
      const sub = await ready();
      const claim = (await runtime.claim(sub.id))!;
      const run = await runrow(claim.runId);
      await expect(
        db.watchRun.create({
          data: { subscriptionId: sub.id, scheduledAt: run.scheduledAt, status: 'RUNNING' },
        }),
      ).rejects.toThrow();
      await runtime.execute(claim);
      await expect(
        db.watchObservation.create({
          data: {
            runId: run.id,
            outcome: 'NO_EVIDENCE',
            evidence: [],
            truncated: false,
            observedAt: time,
          },
        }),
      ).rejects.toThrow();
      await expect(
        db.watchSubscription.update({ where: { id: sub.id }, data: { dailyRunLimit: 999 } }),
      ).rejects.toThrow();
    });
    it('rolls back partial result writes, then retries without duplicate observation', async () => {
      const sub = await ready();
      const claim = (await runtime.claim(sub.id))!;
      await db.$executeRawUnsafe(
        `CREATE FUNCTION watch_test_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test failure'; END $$`,
      );
      await db.$executeRawUnsafe(
        `CREATE TRIGGER watch_test_failure BEFORE UPDATE ON "WatchRun" FOR EACH ROW WHEN (NEW.status = 'NO_EVIDENCE') EXECUTE FUNCTION watch_test_failure()`,
      );
      try {
        await runtime.execute(claim);
        expect(await db.watchObservation.count()).toBe(0);
        expect((await runrow(claim.runId)).status).toBe('RETRY_WAIT');
      } finally {
        await db.$executeRawUnsafe('DROP TRIGGER watch_test_failure ON "WatchRun"');
        await db.$executeRawUnsafe('DROP FUNCTION watch_test_failure()');
      }
      advance(60);
      await runtime.execute((await runtime.claim(sub.id))!);
      expect(await db.watchObservation.count()).toBe(1);
    });
    it('bounds each tick and does not let leased work starve other due watches', async () => {
      await db.watchSubscription.createMany({
        data: Array.from({ length: 21 }, (_, i) => ({
          id: `fixture-${i.toString().padStart(2, '0')}`,
          userId: i < 20 ? 'owner' : 'other',
          subjectId: `fixture-subject-${i}`,
          countryCode: 'POL',
          status: 'ACTIVE' as const,
          nextRunAt: time,
          budgetDay: time,
        })),
      });
      const first = await runtime.tick();
      expect(first.visited).toBe(20);
      expect(await db.watchRun.count()).toBe(20);
      expect((await runtime.tick()).visited).toBe(1);
      advance(3600);
      for (let i = 0; i < 20; i++) await runtime.claim(`fixture-${i.toString().padStart(2, '0')}`);
      expect((await runtime.tick()).visited).toBe(1);
    });
    it('cascades account deletion through subscription, run and observation', async () => {
      await ready();
      await runtime.tick();
      await db.user.delete({ where: { id: 'owner' } });
      expect(await db.watchSubscription.count()).toBe(0);
      expect(await db.watchRun.count()).toBe(0);
      expect(await db.watchObservation.count()).toBe(0);
    });
  },
);
