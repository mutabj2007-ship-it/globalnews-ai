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
  const dayStart = (offsetDays: number) => {
    const d = new Date();
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + offsetDays));
  };
  const plusH = (d: Date, h: number) => new Date(d.getTime() + h * 3_600_000);
  const units = async (scope: string, bucketStart: Date) =>
    Number(
      (await db.computeMeter.findUnique({ where: { scope_bucketStart: { scope, bucketStart } } }))
        ?.units ?? -1n,
    );
  const migrate = async () => {
    for (const s of statements) await db.$executeRawUnsafe(s);
  };

  beforeAll(async () => {
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url!, max: 2 }) });
    await db.$connect();
  });
  afterAll(async () => db?.$disconnect());
  beforeEach(async () => {
    await db.$executeRawUnsafe('TRUNCATE "ComputeMeter", "ComputeReservation"');
  });

  it('carries today and yesterday into both keys, conservatively, idempotently; ignores stale days', async () => {
    const today = dayStart(0);
    const yesterday = dayStart(-1);
    const stale = dayStart(-3);
    await db.computeMeter.createMany({
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
    await migrate();
    await migrate(); // idempotent

    expect(await units(GLOBAL_HOUR_SCOPE, today)).toBe(300);
    expect(await units(GLOBAL_HOUR_SCOPE, plusH(today, 5))).toBe(140); // GREATEST(140, 100)
    expect(await units(GLOBAL_HOUR_SCOPE, yesterday)).toBe(50);
    expect(await units(GLOBAL_HOUR_SCOPE, plusH(yesterday, 22))).toBe(20);
    expect(await units(GLOBAL_DAY_SCOPE, today)).toBe(300);
    expect(await units(GLOBAL_DAY_SCOPE, yesterday)).toBe(50);
    /* hour rows are not day buckets; stale days are not carried */
    expect(await units(GLOBAL_DAY_SCOPE, plusH(today, 5))).toBe(-1);
    expect(await units(GLOBAL_HOUR_SCOPE, stale)).toBe(-1);
    expect(await units(GLOBAL_DAY_SCOPE, stale)).toBe(-1);
    /* legacy rows untouched */
    expect(await db.computeMeter.count({ where: { scope: GLOBAL_SCOPE } })).toBe(5);
    expect(await units(GLOBAL_SCOPE, today)).toBe(300);
  });

  it('on an empty meter (clean database) it is a no-op', async () => {
    await migrate();
    expect(await db.computeMeter.count()).toBe(0);
  });
});
