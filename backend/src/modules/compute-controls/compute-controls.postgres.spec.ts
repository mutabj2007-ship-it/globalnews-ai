import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import type { ConfigService } from '@nestjs/config';
import { PrismaClient } from '../../generated/prisma/client';
import type { PrismaService } from '../../database/prisma.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { ComputeMeterService } from './compute-meter.service';
import { clientIpScope } from './compute-scopes';
import { OperationalSwitchService } from './operational-switch.service';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R2 CONSOLIDATED INTEGRATION R1 · GATE B — OPERATIONAL CONTROLS, LIVE POSTGRES
 * ════════════════════════════════════════════════════════════════════════════
 * F 07 test matrix: T-1, T-2, T-3, T-8, T-13, T-14, T-18, T-19 and L-10 (fail closed), run
 * against a real PostgreSQL — the atomicity claims (L-8, B-2) are properties of the database,
 * not of a mock. Two PrismaClients stand in for two replicas.
 *
 * Only the dedicated loopback test database is accepted (never DATABASE_URL).
 * Implementation-facing evidence; E1/F verify independently.
 */
const url = process.env.ASK_V2_TEST_DATABASE_URL;
if (url && !/^postgresql:\/\/askv2test@127\.0\.0\.1:\d+\/ask_v2_test$/.test(url)) {
  throw new Error('Compute-control live tests require the dedicated loopback test database');
}
jest.setTimeout(60000);
const live = url ? describe : describe.skip;

function config(values: Record<string, string>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

live('Gate B operational controls — live PostgreSQL', () => {
  let a: PrismaClient;
  let b: PrismaClient;

  beforeAll(async () => {
    a = new PrismaClient({ adapter: new PrismaPg({ connectionString: url!, max: 8 }) });
    b = new PrismaClient({ adapter: new PrismaPg({ connectionString: url!, max: 8 }) });
    await a.$connect();
    await b.$connect();
  });
  afterAll(async () => {
    await a.$disconnect();
    await b.$disconnect();
  });
  beforeEach(async () => {
    await a.$executeRawUnsafe(
      'TRUNCATE "ComputeMeter", "ComputeReservation", "CircuitBreakerState", "OperationalSwitch", "OperationalSwitchAudit"',
    );
  });

  const meterWith = (values: Record<string, string>, db: PrismaClient = a) =>
    new ComputeMeterService(db as unknown as PrismaService, config(values));
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
  const caller = (over: Partial<Parameters<ComputeMeterService['reserve']>[0]> = {}) => ({
    accountId: randomUUID(),
    ipScope: clientIpScope(
      `10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
    ),
    provider: 'openai',
    estimatedUnits: 100,
    now: new Date(Date.UTC(2031, 0, 1, 12)),
    ...over,
  });

  describe('T-1 — every ceiling refuses AT its bound and admits EXACTLY the bound', () => {
    it.each([
      ['per-request-units', { ASK_UNITS_PER_REQUEST_MAX: '100' }, 'REFUSED'],
      ['global-hour', { ASK_GLOBAL_UNITS_PER_HOUR: '300' }, 'DEGRADED'],
      ['global-day', { ASK_GLOBAL_UNITS_PER_DAY: '300' }, 'DEGRADED'],
      ['provider-hour', { ASK_PROVIDER_UNITS_PER_HOUR: '300' }, 'DEGRADED'],
      ['account-day', { ASK_ACCOUNT_UNITS_PER_DAY: '300' }, 'REFUSED'],
      ['ip-day', { ASK_IP_UNITS_PER_DAY: '300' }, 'REFUSED'],
    ] as const)('%s', async (control, override, kind) => {
      const meter = meterWith({ ...base, ...override });
      const who = caller();
      if (control === 'per-request-units') {
        expect((await meter.reserve({ ...who, estimatedUnits: 100 })).admitted).toBe(true);
        expect(await meter.reserve({ ...who, estimatedUnits: 101 })).toEqual({
          admitted: false,
          kind,
          control,
        });
        return;
      }
      for (let i = 0; i < 3; i += 1) expect((await meter.reserve(who)).admitted).toBe(true); // 300 = exactly the bound
      expect(await meter.reserve(who)).toEqual({ admitted: false, kind, control });
    });

    it('new accounts get the lower tier; established accounts the normal one', async () => {
      const meter = meterWith({
        ...base,
        ASK_ACCOUNT_UNITS_PER_DAY: '500',
        ASK_NEW_ACCOUNT_UNITS_PER_DAY: '100',
      });
      const now = new Date(Date.UTC(2031, 0, 1, 12));
      const fresh = caller({ accountCreatedAt: new Date(now.getTime() - 3_600_000), now });
      expect((await meter.reserve(fresh)).admitted).toBe(true);
      expect(await meter.reserve(fresh)).toMatchObject({
        admitted: false,
        control: 'new-account-day',
      });
      const old = caller({ accountCreatedAt: new Date(now.getTime() - 30 * 86_400_000), now });
      expect((await meter.reserve(old)).admitted).toBe(true);
      expect((await meter.reserve(old)).admitted).toBe(true);
    });
  });

  it('T-2 — the GLOBAL ceiling is evaluated first: an untouched account is refused, and never charged', async () => {
    const meter = meterWith({ ...base, ASK_GLOBAL_UNITS_PER_HOUR: '100' });
    expect((await meter.reserve(caller())).admitted).toBe(true);
    const untouched = caller();
    expect(await meter.reserve(untouched)).toEqual({
      admitted: false,
      kind: 'DEGRADED',
      control: 'global-hour',
    });
    /* Global-first means the per-caller meter is never TOUCHED — not charged-then-compensated. */
    expect(await a.computeMeter.count({ where: { scope: `acct:${untouched.accountId}` } })).toBe(0);
    expect(await a.computeMeter.count({ where: { scope: untouched.ipScope } })).toBe(0);
  });

  it('T-2 — with BOTH the global and the caller ceiling exhausted, the refusal is the global one', async () => {
    const meter = meterWith({
      ...base,
      ASK_GLOBAL_UNITS_PER_HOUR: '100',
      ASK_ACCOUNT_UNITS_PER_DAY: '100',
    });
    const who = caller({ now: new Date(Date.UTC(2031, 0, 1, 13)) });
    expect((await meter.reserve(who)).admitted).toBe(true); // exhausts both at once
    expect(await meter.reserve(who)).toEqual({
      admitted: false,
      kind: 'DEGRADED',
      control: 'global-hour',
    });
  });

  it('T-3 — two replicas reserving concurrently admit EXACTLY the ceiling (no over-admit)', async () => {
    const values = { ...base, ASK_GLOBAL_UNITS_PER_HOUR: '2000' };
    const replicaA = meterWith(values, a);
    const replicaB = meterWith(values, b);
    const now = new Date(Date.UTC(2031, 0, 2, 12));
    const attempts = Array.from({ length: 60 }, (_, i) =>
      (i % 2 === 0 ? replicaA : replicaB).reserve(caller({ now })),
    );
    const results = await Promise.all(attempts);
    expect(results.filter((r) => r.admitted)).toHaveLength(20); // 20 × 100 = 2000
    const hour = await a.computeMeter.findFirst({
      where: { scope: 'global', bucketStart: new Date(Date.UTC(2031, 0, 2, 12)) },
    });
    expect(hour?.units).toBe(2000n); // compensation left exactly the admitted total
  });

  it('T-8 — concurrency: N+1 refused with no queue; the slot frees only when the call SETTLES; the reaper frees stale slots', async () => {
    const meter = meterWith({
      ...base,
      ASK_CONCURRENT_PER_ACCOUNT: '2',
      ASK_RESERVATION_TTL_S: '60',
    });
    const now = new Date(Date.UTC(2031, 0, 3, 12));
    const who = caller({ now });
    const r1 = await meter.reserve(who);
    const r2 = await meter.reserve(who);
    expect(r1.admitted && r2.admitted).toBe(true);
    expect(await meter.reserve(who)).toMatchObject({
      admitted: false,
      kind: 'REFUSED',
      control: 'concurrent-account',
    });
    if (!r1.admitted || !r2.admitted) throw new Error('unreachable');
    expect(await meter.settle(r1.reservationId, 90, 'SUCCEEDED')).toBe(true);
    expect(await meter.settle(r1.reservationId, 90, 'SUCCEEDED')).toBe(false); // idempotent
    expect((await meter.reserve(who)).admitted).toBe(true);
    /* r2 is never settled: after its TTL the reaper releases the slot and keeps its units charged. */
    expect(await meter.reapExpired(new Date(now.getTime() + 61_000))).toBeGreaterThanOrEqual(1);
    expect((await meter.reserve(who)).admitted).toBe(true);
  });

  it('settle writes the ACTUAL units back (L-9, L-14)', async () => {
    const meter = meterWith(base);
    const now = new Date(Date.UTC(2031, 0, 4, 12));
    const r = await meter.reserve(caller({ now, estimatedUnits: 400 }));
    if (!r.admitted) throw new Error('not admitted');
    await meter.settle(r.reservationId, 150, 'SUCCEEDED');
    const hour = await a.computeMeter.findFirst({
      where: { scope: 'global', bucketStart: new Date(Date.UTC(2031, 0, 4, 12)) },
    });
    expect(hour?.units).toBe(150n);
  });

  it('L-10 — an unwritable meter refuses model spend (fail closed, DEGRADED)', async () => {
    const broken = {
      $queryRaw: () => Promise.reject(new Error('connection refused')),
    } as unknown as PrismaClient;
    const meter = meterWith(base);
    expect(await meter.reserve(caller(), broken)).toEqual({
      admitted: false,
      kind: 'DEGRADED',
      control: 'meter-unavailable',
    });
  });

  it('T-5 — a hung meter store refuses within the deadline instead of awaiting forever', async () => {
    const hung = { $queryRaw: () => new Promise(() => undefined) } as unknown as PrismaClient;
    const meter = meterWith({ ...base, ASK_CONTROL_STORE_DEADLINE_MS: '200' });
    const started = Date.now();
    expect(await meter.reserve(caller(), hung)).toMatchObject({
      admitted: false,
      control: 'meter-unavailable',
    });
    expect(Date.now() - started).toBeLessThan(1500);
  });

  describe('T-13 / T-14 — the provider circuit breaker', () => {
    const breakerValues = {
      ...base,
      ASK_BREAKER_MIN_SAMPLES: '10',
      ASK_BREAKER_TRIP_RATIO: '0.5',
      ASK_BREAKER_COOLDOWN_S: '30',
      ASK_BREAKER_COOLDOWN_MAX_S: '600',
      ASK_BREAKER_TRIAL_CALLS: '2',
      ASK_BREAKER_TRIAL_SUCCESSES: '2',
      ASK_BREAKER_CACHE_MS: '1000',
    };
    const breakerOn = (db: PrismaClient) =>
      new CircuitBreakerService(db as unknown as PrismaService, meterWith(breakerValues, db));

    it('does NOT trip below the minimum sample count, trips at the ratio once samples suffice', async () => {
      const br = breakerOn(a);
      const t = new Date(Date.UTC(2031, 0, 5, 12, 0, 1));
      for (let i = 0; i < 9; i += 1) await br.record('p1', 'FAILURE', false, t);
      br.forget();
      expect((await br.permit('p1', t)).state).toBe('CLOSED'); // 9 failures < 10 samples
      await br.record('p1', 'FAILURE', false, t);
      br.forget();
      expect(await br.permit('p1', t)).toEqual({ allowed: false, trial: false, state: 'OPEN' });
    });

    it('REFUSALS never count toward the trip (B-4); a mixed window under the ratio stays CLOSED', async () => {
      const br = breakerOn(a);
      const t = new Date(Date.UTC(2031, 0, 5, 13, 0, 1));
      for (let i = 0; i < 30; i += 1) await br.record('p2', 'REFUSAL', false, t);
      for (let i = 0; i < 12; i += 1)
        await br.record('p2', i < 5 ? 'FAILURE' : 'SUCCESS', false, t);
      br.forget();
      expect((await br.permit('p2', t)).state).toBe('CLOSED'); // 5/12 < 0.5
    });

    it('OPEN takes the degraded path without paying a timeout; HALF_OPEN admits exactly TRIAL_CALLS; a trial failure re-opens with a doubled cooldown; successes close it', async () => {
      const br = breakerOn(a);
      const t0 = new Date(Date.UTC(2031, 0, 5, 14, 0, 1));
      for (let i = 0; i < 10; i += 1) await br.record('p3', 'TIMEOUT', false, t0);
      br.forget();
      const started = Date.now();
      expect((await br.permit('p3', t0)).allowed).toBe(false);
      expect(Date.now() - started).toBeLessThan(500);

      const t1 = new Date(t0.getTime() + 31_000);
      br.forget();
      const trials = [
        await br.permit('p3', t1),
        await br.permit('p3', t1),
        await br.permit('p3', t1),
      ];
      expect(trials.map((p) => p.allowed)).toEqual([true, true, false]);
      await br.record('p3', 'FAILURE', true, t1);
      const reopened = await a.circuitBreakerState.findUnique({ where: { provider: 'p3' } });
      expect(reopened?.state).toBe('OPEN');
      expect(reopened?.cooldownS).toBe(60);

      const t2 = new Date(t1.getTime() + 61_000);
      br.forget();
      expect((await br.permit('p3', t2)).trial).toBe(true);
      expect((await br.permit('p3', t2)).trial).toBe(true);
      await br.record('p3', 'SUCCESS', true, t2);
      await br.record('p3', 'SUCCESS', true, t2);
      br.forget();
      expect((await br.permit('p3', t2)).state).toBe('CLOSED');
    });

    it('T-14 — replica A’s trip is observed by replica B once B’s cache (≤ ASK_BREAKER_CACHE_MS) expires', async () => {
      const replicaA = breakerOn(a);
      const replicaB = breakerOn(b);
      const t = new Date(Date.UTC(2031, 0, 5, 15, 0, 1));
      expect((await replicaB.permit('p4', t)).state).toBe('CLOSED'); // B caches CLOSED
      for (let i = 0; i < 10; i += 1) await replicaA.record('p4', 'FAILURE', false, t);
      expect((await replicaB.permit('p4', new Date(t.getTime() + 500))).allowed).toBe(true); // within B's cache window
      expect((await replicaB.permit('p4', new Date(t.getTime() + 1500))).allowed).toBe(false); // cache expired: shared OPEN seen
    });

    it('an unreadable breaker store denies the call (fail closed)', async () => {
      const br = new CircuitBreakerService(
        {
          circuitBreakerState: { findUnique: () => Promise.reject(new Error('down')) },
        } as unknown as PrismaService,
        meterWith(breakerValues),
      );
      expect(await br.permit('p5')).toEqual({ allowed: false, trial: false, state: 'UNKNOWN' });
    });
  });

  describe('T-18 / T-19 — kill switches', () => {
    const switchesWith = (env: Record<string, string>, db: PrismaClient = a) =>
      new OperationalSwitchService(
        db as unknown as PrismaService,
        config({ ...base, ASK_FLAG_CACHE_MS: '5000', ...env }),
        meterWith(base, db),
      );

    it.each([
      ['unset', undefined],
      ['empty', ''],
      ['whitespace', '   '],
      ["'TRUE'", 'TRUE'],
      ["'1'", '1'],
      ["'yes'", 'yes'],
      ["' true'", ' true'],
      ['malformed', 'tru'],
    ])('deployment value %s ⇒ OFF even with the row enabled', async (_label, value) => {
      const env: Record<string, string> =
        value === undefined ? {} : { ASK_PUBLIC_COMPUTE_ENABLED: value };
      const sw = switchesWith(env);
      await sw.set('ASK_PUBLIC_COMPUTE_ENABLED', true, 'test-operator', 'fail-closed matrix');
      expect(await sw.isEnabled('ASK_PUBLIC_COMPUTE_ENABLED')).toBe(false);
    });

    it("'true' alone is not enough: a named, audited row is the second key; an unreadable store is OFF", async () => {
      const sw = switchesWith({ ASK_PUBLIC_COMPUTE_ENABLED: 'true' });
      expect(await sw.isEnabled('ASK_PUBLIC_COMPUTE_ENABLED')).toBe(false); // no row
      await sw.set('ASK_PUBLIC_COMPUTE_ENABLED', true, 'operator-a', 'enable for rehearsal');
      expect(await sw.isEnabled('ASK_PUBLIC_COMPUTE_ENABLED')).toBe(true);
      expect(
        await a.operationalSwitchAudit.count({
          where: { name: 'ASK_PUBLIC_COMPUTE_ENABLED', setBy: 'operator-a' },
        }),
      ).toBe(1);
      await expect(sw.set('ASK_PUBLIC_COMPUTE_ENABLED', true, '  ', null)).rejects.toThrow(
        'named actor',
      );
      const unreadable = new OperationalSwitchService(
        {
          operationalSwitch: { findUnique: () => Promise.reject(new Error('down')) },
        } as unknown as PrismaService,
        config({ ...base, ASK_PUBLIC_COMPUTE_ENABLED: 'true' }),
        meterWith(base),
      );
      expect(await unreadable.isEnabled('ASK_PUBLIC_COMPUTE_ENABLED')).toBe(false);
    });

    it('T-19 — an incident switch-off on one replica takes effect on another within ASK_FLAG_CACHE_MS, without a restart; it does not close itself', async () => {
      const replicaA = switchesWith({ ASK_R2_ENABLED: 'true' }, a);
      const replicaB = switchesWith({ ASK_R2_ENABLED: 'true' }, b);
      await replicaA.set('ASK_R2_ENABLED', true, 'operator-a', 'on');
      const t = Date.now();
      expect(await replicaB.isEnabled('ASK_R2_ENABLED', t)).toBe(true);
      await replicaA.set('ASK_R2_ENABLED', false, 'incident-commander', 'provider incident');
      expect(await replicaB.isEnabled('ASK_R2_ENABLED', t + 1000)).toBe(true); // still inside B's 5 s cache
      expect(await replicaB.isEnabled('ASK_R2_ENABLED', t + 5001)).toBe(false); // bitten, no restart
      expect(await replicaB.isEnabled('ASK_R2_ENABLED', t + 60_000)).toBe(false); // does not close itself
    });
  });
});
