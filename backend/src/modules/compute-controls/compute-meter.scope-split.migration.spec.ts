import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import { GLOBAL_DAY_SCOPE, GLOBAL_HOUR_SCOPE, GLOBAL_SCOPE } from './compute-scopes';

/**
 * COMPUTE METER GLOBAL BUCKET COLLISION R1 (P1) — the data-only carry-over migration, executed
 * verbatim against seeded legacy rows. The split must not reset today's global usage, must be
 * idempotent, must never lower an existing value, and must ignore stale days.
 */
const MIGRATION = readFileSync(
  join(
    __dirname,
    '../../../prisma/migrations/20260929140000_ask_compute_meter_global_scope_split/migration.sql',
  ),
  'utf8',
);
const statements = MIGRATION.split(/;\s*(?:\r?\n|$)/)
  .map((s) => s.replace(/^\s*--.*$/gm, '').trim())
  .filter((s) => s.length > 0);

const url = process.env.ASK_V2_TEST_DATABASE_URL;
if (url && !/^postgresql:\/\/askv2test@127\.0\.0\.1:\d+\/ask_v2_test$/.test(url)) {
  throw new Error('Compute-meter live tests require the dedicated loopback test database');
}
jest.setTimeout(60000);
const live = url ? describe : describe.skip;

describe('scope-split migration — shape', () => {
  it('is data-only: no DDL, only the two keyed INSERT … ON CONFLICT … GREATEST statements', () => {
    expect(MIGRATION).not.toMatch(/\b(CREATE|ALTER|DROP|TRUNCATE|DELETE)\b/i);
    expect(statements).toHaveLength(2);
    for (const s of statements) {
      expect(s).toMatch(/^INSERT INTO "ComputeMeter"/);
      expect(s).toMatch(/GREATEST\("ComputeMeter"\."units", EXCLUDED\."units"\)/);
    }
  });
});

live('scope-split migration — live PostgreSQL', () => {
  let db: PrismaClient;
  type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];
  const dayStart = (offsetDays: number) => {
    const d = new Date();
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + offsetDays));
  };
  const plusH = (d: Date, h: number) => new Date(d.getTime() + h * 3_600_000);
  const units = async (tx: Tx, scope: string, bucketStart: Date) =>
    Number(
      (await tx.computeMeter.findUnique({ where: { scope_bucketStart: { scope, bucketStart } } }))
        ?.units ?? -1n,
    );
  const migrate = async (tx: Tx) => {
    for (const s of statements) await tx.$executeRawUnsafe(s);
  };
  /*
    ISOLATION. Every case runs inside ONE transaction that is ALWAYS rolled back: it starts
    from an empty global meter, seeds, migrates and asserts — and no other live suite sharing
    this database ever sees (or loses) a row because of it.
  */
  class Rollback extends Error {}
  const isolated = async (work: (tx: Tx) => Promise<void>) => {
    await expect(
      db.$transaction(
        async (tx) => {
          await tx.$executeRawUnsafe(
            `DELETE FROM "ComputeMeter" WHERE "scope" IN ('global', 'global:hour', 'global:day')`,
          );
          await work(tx);
          throw new Rollback('rollback');
        },
        { timeout: 30_000 },
      ),
    ).rejects.toBeInstanceOf(Rollback);
  };

  beforeAll(async () => {
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url!, max: 2 }) });
    await db.$connect();
  });
  afterAll(async () => db?.$disconnect());

  it('carries today and yesterday into both keys, conservatively, idempotently; ignores stale days', async () => {
    await isolated(async (tx) => {
      const today = dayStart(0);
      const yesterday = dayStart(-1);
      const stale = dayStart(-3);
      await tx.computeMeter.createMany({
        data: [
          { scope: GLOBAL_SCOPE, bucketStart: today, units: 300n }, // collided: day total + hour 00
          { scope: GLOBAL_SCOPE, bucketStart: plusH(today, 5), units: 100n }, // hour 05
          { scope: GLOBAL_SCOPE, bucketStart: yesterday, units: 50n },
          { scope: GLOBAL_SCOPE, bucketStart: plusH(yesterday, 22), units: 20n },
          { scope: GLOBAL_SCOPE, bucketStart: stale, units: 999n },
          /* a post-deploy charge already written under the new key must never be lowered */
          { scope: GLOBAL_HOUR_SCOPE, bucketStart: plusH(today, 5), units: 140n },
        ],
      });
      await migrate(tx);
      await migrate(tx); // idempotent

      expect(await units(tx, GLOBAL_HOUR_SCOPE, today)).toBe(300);
      expect(await units(tx, GLOBAL_HOUR_SCOPE, plusH(today, 5))).toBe(140); // GREATEST(140, 100)
      expect(await units(tx, GLOBAL_HOUR_SCOPE, yesterday)).toBe(50);
      expect(await units(tx, GLOBAL_HOUR_SCOPE, plusH(yesterday, 22))).toBe(20);
      expect(await units(tx, GLOBAL_DAY_SCOPE, today)).toBe(300);
      expect(await units(tx, GLOBAL_DAY_SCOPE, yesterday)).toBe(50);
      /* hour rows are not day buckets; stale days are not carried */
      expect(await units(tx, GLOBAL_DAY_SCOPE, plusH(today, 5))).toBe(-1);
      expect(await units(tx, GLOBAL_HOUR_SCOPE, stale)).toBe(-1);
      expect(await units(tx, GLOBAL_DAY_SCOPE, stale)).toBe(-1);
      /* legacy rows untouched */
      expect(await tx.computeMeter.count({ where: { scope: GLOBAL_SCOPE } })).toBe(5);
      expect(await units(tx, GLOBAL_SCOPE, today)).toBe(300);
    });
  });

  it('with no legacy global rows it writes nothing (clean database: a no-op)', async () => {
    await isolated(async (tx) => {
      await migrate(tx);
      expect(
        await tx.computeMeter.count({
          where: { scope: { in: [GLOBAL_SCOPE, GLOBAL_HOUR_SCOPE, GLOBAL_DAY_SCOPE] } },
        }),
      ).toBe(0);
    });
  });
});
