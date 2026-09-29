import { PrismaPg } from '@prisma/adapter-pg';
import type { ConfigService } from '@nestjs/config';
import { PrismaClient } from '../../generated/prisma/client';
import type { PrismaService } from '../../database/prisma.service';
import { ComputeMeterService } from './compute-meter.service';
import {
  accountScope,
  clientIpScope,
  concurrencyScope,
  dayBucket,
  GLOBAL_DAY_SCOPE,
  GLOBAL_HOUR_SCOPE,
  GLOBAL_SCOPE,
  hourBucket,
  providerScope,
} from './compute-scopes';

/**
 * COMPUTE METER GLOBAL BUCKET COLLISION R1 (P1) — deterministic midnight-boundary proof on a
 * live PostgreSQL meter. `now` is injected, so every case runs at the exact UTC instant it
 * names, whatever the wall clock says.
 *
 * Before the repair, global-hour and global-day both charged scope 'global'; the row key is
 * (scope, bucketStart) and during 00:00:00–00:59:59 UTC hourBucket === dayBucket, so one
 * request wrote 2 × its units into ONE row and each ceiling read the other's usage too.
 */
const url = process.env.ASK_V2_TEST_DATABASE_URL;
if (url && !/^postgresql:\/\/askv2test@127\.0\.0\.1:\d+\/ask_v2_test$/.test(url)) {
  throw new Error('Compute-meter live tests require the dedicated loopback test database');
}
jest.setTimeout(60000);
const live = url ? describe : describe.skip;

const E = 100; // estimate per request
const ACCOUNT = '00000000-0000-4000-8000-000000000001';
const IP = clientIpScope('10.1.2.3');
const base = {
  ASK_UNITS_PER_REQUEST_MAX: '1000',
  ASK_GLOBAL_UNITS_PER_HOUR: '100000',
  ASK_GLOBAL_UNITS_PER_DAY: '100000',
  ASK_PROVIDER_UNITS_PER_HOUR: '100000',
  ASK_ACCOUNT_UNITS_PER_DAY: '100000',
  ASK_NEW_ACCOUNT_UNITS_PER_DAY: '100000',
  ASK_IP_UNITS_PER_DAY: '100000',
  ASK_CONCURRENT_GLOBAL: '1000',
  ASK_CONCURRENT_PER_ACCOUNT: '1000',
  ASK_CONCURRENT_PER_IP_PREFIX: '1000',
};
const at = (iso: string) => new Date(iso);
const TIMES = [
  ['00:00:00 UTC', '2031-01-01T00:00:00Z', true],
  ['00:30:00 UTC', '2031-01-01T00:30:00Z', true],
  ['00:59:59 UTC', '2031-01-01T00:59:59Z', true],
  ['01:00:00 UTC', '2031-01-01T01:00:00Z', false],
  ['13:30:00 UTC (midday)', '2031-01-01T13:30:00Z', false],
] as const;

live('P1 — global hour/day meter identities never collide (live PostgreSQL)', () => {
  let db: PrismaClient;
  const meterWith = (values: Record<string, string> = {}) =>
    new ComputeMeterService(
      db as unknown as PrismaService,
      { get: (k: string) => ({ ...base, ...values })[k as keyof typeof base] } as ConfigService,
    );
  const who = (now: Date, over: Record<string, unknown> = {}) => ({
    accountId: ACCOUNT,
    ipScope: IP,
    provider: 'openai',
    estimatedUnits: E,
    now,
    ...over,
  });
  const units = async (scope: string, bucket: Date) =>
    Number(
      (
        await db.computeMeter.findUnique({
          where: { scope_bucketStart: { scope, bucketStart: bucket } },
        })
      )?.units ?? 0n,
    );

  beforeAll(async () => {
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url!, max: 4 }) });
    await db.$connect();
  });
  afterAll(async () => db?.$disconnect());
  beforeEach(async () => {
    await db.$executeRawUnsafe('TRUNCATE "ComputeMeter", "ComputeReservation"');
  });

  it.each(TIMES)(
    '%s: one request charges the hourly global bucket once and the daily global bucket once, in distinct rows',
    async (_label, iso, collidingWindow) => {
      const now = at(iso);
      /* the boundary itself: the buckets ARE equal exactly in the first UTC hour */
      expect(hourBucket(now).getTime() === dayBucket(now).getTime()).toBe(collidingWindow);

      const r = await meterWith().reserve(who(now));
      expect(r.admitted).toBe(true);
      expect(await units(GLOBAL_HOUR_SCOPE, hourBucket(now))).toBe(E);
      expect(await units(GLOBAL_DAY_SCOPE, dayBucket(now))).toBe(E);
      /* distinct rows even when the bucket instants are identical; no legacy 'global' row */
      const globalRows = await db.computeMeter.findMany({
        where: { scope: { in: [GLOBAL_HOUR_SCOPE, GLOBAL_DAY_SCOPE, GLOBAL_SCOPE] } },
      });
      expect(globalRows.map((g) => g.scope).sort()).toEqual([GLOBAL_DAY_SCOPE, GLOBAL_HOUR_SCOPE]);
      expect(globalRows.every((g) => Number(g.units) === E)).toBe(true);
    },
  );

  it('00:30 UTC — the HOURLY ceiling reads only hourly usage (day ceiling at E, hour ceiling at E: admitted)', async () => {
    /* Pre-repair this was refused as DEGRADED global-day: the day step saw 2E in the shared row. */
    const meter = meterWith({
      ASK_GLOBAL_UNITS_PER_HOUR: String(E),
      ASK_GLOBAL_UNITS_PER_DAY: String(E),
    });
    expect(await meter.reserve(who(at('2031-01-01T00:30:00Z')))).toMatchObject({ admitted: true });
  });

  it('00:30 UTC — the hourly ceiling refuses on hourly usage alone and compensates BOTH global rows', async () => {
    const meter = meterWith({ ASK_GLOBAL_UNITS_PER_HOUR: String(E * 1.5) });
    const now = at('2031-01-01T00:30:00Z');
    expect((await meter.reserve(who(now))).admitted).toBe(true);
    expect(await meter.reserve(who(now))).toMatchObject({
      admitted: false,
      kind: 'DEGRADED',
      control: 'global-hour',
    });
    expect(await units(GLOBAL_HOUR_SCOPE, hourBucket(now))).toBe(E);
    expect(await units(GLOBAL_DAY_SCOPE, dayBucket(now))).toBe(E);
  });

  it('00:30 UTC — the DAILY ceiling reads only daily usage, independent of the hour row', async () => {
    const meter = meterWith({ ASK_GLOBAL_UNITS_PER_DAY: String(E * 2) });
    /* earlier today (hour 00) and now (hour 00 still): the day row sums both, hour rows are separate */
    const now = at('2031-01-01T00:30:00Z');
    expect((await meter.reserve(who(at('2031-01-01T00:05:00Z')))).admitted).toBe(true);
    expect((await meter.reserve(who(now))).admitted).toBe(true);
    expect(await meter.reserve(who(now))).toMatchObject({ admitted: false, control: 'global-day' });
    expect(await units(GLOBAL_DAY_SCOPE, dayBucket(now))).toBe(2 * E);
    expect(await units(GLOBAL_HOUR_SCOPE, hourBucket(now))).toBe(2 * E);
    /* and a later hour of the same day is still bounded by the day row */
    expect(await meter.reserve(who(at('2031-01-01T13:30:00Z')))).toMatchObject({
      admitted: false,
      control: 'global-day',
    });
    expect(await units(GLOBAL_HOUR_SCOPE, hourBucket(at('2031-01-01T13:30:00Z')))).toBe(0);
  });

  it.each(TIMES)(
    '%s: a downstream refusal (account-day) compensates global hour, global day and provider exactly',
    async (_label, iso) => {
      const now = at(iso);
      const meter = meterWith({ ASK_ACCOUNT_UNITS_PER_DAY: String(E - 1) });
      expect(await meter.reserve(who(now))).toMatchObject({
        admitted: false,
        control: 'account-day',
      });
      expect(await units(GLOBAL_HOUR_SCOPE, hourBucket(now))).toBe(0);
      expect(await units(GLOBAL_DAY_SCOPE, dayBucket(now))).toBe(0);
      expect(await units(providerScope('openai'), hourBucket(now))).toBe(0);
      expect(await units(accountScope(ACCOUNT), dayBucket(now))).toBe(0);
      expect(await db.computeReservation.count()).toBe(0);
    },
  );

  it.each(TIMES)(
    '%s: settlement moves BOTH global rows from estimate to actual, and releases concurrency',
    async (_label, iso) => {
      const now = at(iso);
      const meter = meterWith();
      const r = await meter.reserve(who(now, { estimatedUnits: 400 }));
      if (!r.admitted) throw new Error('not admitted');
      expect(await units(concurrencyScope(GLOBAL_SCOPE), new Date(0))).toBe(1);
      expect(await meter.settle(r.reservationId, 150, 'SUCCESS')).toBe(true);
      expect(await units(GLOBAL_HOUR_SCOPE, hourBucket(now))).toBe(150);
      expect(await units(GLOBAL_DAY_SCOPE, dayBucket(now))).toBe(150);
      expect(await units(providerScope('openai'), hourBucket(now))).toBe(150);
      expect(await units(accountScope(ACCOUNT), dayBucket(now))).toBe(150);
      expect(await units(IP, dayBucket(now))).toBe(150);
      /* concurrency accounting is unchanged: same `conc:global` key, released on settle */
      expect(await units(concurrencyScope(GLOBAL_SCOPE), new Date(0))).toBe(0);
      expect(await units(concurrencyScope(accountScope(ACCOUNT)), new Date(0))).toBe(0);
      expect(await units(concurrencyScope(IP), new Date(0))).toBe(0);
    },
  );

  it('provider / account / IP / concurrency keep their exact keys (only the two global rate scopes changed)', async () => {
    const now = at('2031-01-01T00:30:00Z');
    await meterWith().reserve(who(now));
    const scopes = (await db.computeMeter.findMany({ select: { scope: true, bucketStart: true } }))
      .map((m) => `${m.scope}@${m.bucketStart.toISOString()}`)
      .sort();
    expect(scopes).toEqual(
      [
        `${GLOBAL_DAY_SCOPE}@${dayBucket(now).toISOString()}`,
        `${GLOBAL_HOUR_SCOPE}@${hourBucket(now).toISOString()}`,
        `acct:${ACCOUNT}@${dayBucket(now).toISOString()}`,
        `conc:acct:${ACCOUNT}@1970-01-01T00:00:00.000Z`,
        `conc:global@1970-01-01T00:00:00.000Z`,
        `conc:${IP}@1970-01-01T00:00:00.000Z`,
        `${IP}@${dayBucket(now).toISOString()}`,
        `provider:openai@${hourBucket(now).toISOString()}`,
      ].sort(),
    );
  });

  it('a reservation recorded BEFORE the repair (scope "global") settles against exactly the charges it recorded', async () => {
    const bucket = at('2031-01-01T00:00:00Z');
    await db.computeMeter.create({
      data: { scope: GLOBAL_SCOPE, bucketStart: bucket, units: 200n },
    });
    const legacy = await db.computeReservation.create({
      data: {
        charges: [
          { scope: GLOBAL_SCOPE, bucketStart: bucket.toISOString(), units: E, kind: 'units' },
          { scope: GLOBAL_SCOPE, bucketStart: bucket.toISOString(), units: E, kind: 'units' },
        ] as unknown as object,
        units: BigInt(E),
        expiresAt: at('2031-01-01T01:00:00Z'),
      },
    });
    expect(await meterWith().settle(legacy.id, 40, 'SUCCESS')).toBe(true);
    expect(await units(GLOBAL_SCOPE, bucket)).toBe(200 - 2 * (E - 40));
    expect(
      await db.computeMeter.count({
        where: { scope: { in: [GLOBAL_HOUR_SCOPE, GLOBAL_DAY_SCOPE] } },
      }),
    ).toBe(0);
  });
});
