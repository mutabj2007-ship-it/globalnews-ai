import { randomBytes, randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import type { ConfigService } from '@nestjs/config';
import { PrismaClient } from '../../generated/prisma/client';
import type { PrismaService } from '../../database/prisma.service';
import { ComputeMeterService } from '../compute-controls/compute-meter.service';
import { CircuitBreakerService } from '../compute-controls/circuit-breaker.service';
import { OperationalSwitchService } from '../compute-controls/operational-switch.service';
import {
  CONCURRENCY_BUCKET,
  GUEST_POOL_DAY_SCOPE,
  GUEST_POOL_HOUR_SCOPE,
  concurrencyScope,
  guestScope,
} from '../compute-controls/compute-scopes';
import { AskV2Service } from './ask-v2.service';
import { AskR2ExecutionAdapter } from './ask-r2-execution.adapter';
import { GuestSessionService } from './guest/guest-session.service';
import { accountPrincipal, guestPrincipal } from './guest/ask-principal';
import { askRequestContext, type AskRequestContext } from './ask-request-context';

/**
 * UNIFIED INTELLIGENCE BINDING R2A.1 — guest background compute-meter parity, LIVE.
 *
 * Real AskV2Service, real GuestSessionService, real ComputeMeterService, real breaker and
 * switches, real adapter on PostgreSQL. Only the model providers are faked (no live OpenAI or
 * GNews call). Proves, against the rows the meter actually writes:
 *   - a guest REFERENCE_BACKGROUND answer is charged to guest-pool-hour, guest-pool-day,
 *     guest-session-units and concurrent-guest, and settlement releases the concurrency slot;
 *   - each guest control refuses a background answer BEFORE the provider is called;
 *   - an account background answer carries no guest charge;
 *   - entitlement is unchanged: one committed GuestSlot per substantive answer, never two,
 *     and a no-answer outcome consumes nothing.
 */

const url = process.env.ASK_V2_TEST_DATABASE_URL;
if (url && !/^postgresql:\/\/askv2test@127\.0\.0\.1:\d+\/ask_v2_test$/.test(url)) {
  throw new Error('Ask R2 live tests require the dedicated loopback test database');
}
jest.setTimeout(60000);
const live = url ? describe : describe.skip;

const GUEST_LIMITS: Record<string, string> = {
  ASK_GUEST_ATTEMPTS_PER_SESSION: '8',
  ASK_GUEST_UNITS_PER_SESSION: '48000',
  ASK_GUEST_POOL_UNITS_PER_HOUR: '100000',
  ASK_GUEST_POOL_UNITS_PER_DAY: '500000',
  ASK_GUEST_SESSIONS_PER_IP_DAY: '1000',
  ASK_GUEST_EXECUTIONS_PER_IP_DAY: '1000',
  ASK_GUEST_EXECUTIONS_PER_DAY: '1000',
  ASK_GUEST_CONCURRENT_PER_SESSION: '1',
  ASK_GUEST_COOLDOWN_AFTER_NO_ANSWER: '3',
  ASK_GUEST_COOLDOWN_S: '600',
};
const BACKGROUND_Q = 'What is inflation?';

interface Charge {
  readonly scope: string;
  readonly bucketStart: string;
  readonly units: number;
  readonly kind: 'units' | 'concurrency';
}

live('R2A.1 — guest background meter parity on PostgreSQL', () => {
  let db: PrismaClient;
  let values: Record<string, string>;
  let service: AskV2Service;
  let meter: ComputeMeterService;
  let switches: OperationalSwitchService;
  const analyzeNews = jest.fn();
  const answerBackground = jest.fn();
  const config = { get: (key: string) => values[key] } as unknown as ConfigService;
  const createdGuests: string[] = [];
  const createdUsers: string[] = [];

  beforeAll(async () => {
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url!, max: 8 }) });
    await db.$connect();
  });
  afterAll(async () => {
    await db.guestSession.deleteMany({ where: { id: { in: createdGuests } } });
    await db.user.deleteMany({ where: { id: { in: createdUsers } } });
    await db.$disconnect();
  });

  beforeEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE "ComputeMeter", "ComputeReservation", "CircuitBreakerState", "OperationalSwitch", "OperationalSwitchAudit"',
    );
    values = {
      ASK_V2_ENABLED: 'true',
      ASK_R2_ENABLED: 'true',
      ASK_PUBLIC_COMPUTE_ENABLED: 'true',
      ASK_GUEST_TRIAL_ENABLED: 'true',
      ASK_FLAG_CACHE_MS: '0',
      ASK_BREAKER_CACHE_MS: '0',
      /* Outer ceilings as the guest suite uses them (the meter reads these at construction). */
      ASK_UNITS_PER_REQUEST_MAX: '16000',
      ASK_GLOBAL_UNITS_PER_HOUR: '1000000',
      ASK_GLOBAL_UNITS_PER_DAY: '5000000',
      ASK_PROVIDER_UNITS_PER_HOUR: '1000000',
      ASK_IP_UNITS_PER_DAY: '360000',
      ASK_CONCURRENT_GLOBAL: '8',
      ...GUEST_LIMITS,
    };
    answerBackground.mockReset();
    answerBackground.mockImplementation(
      async (input: {
        usageSink?: (u: { promptTokens: number; completionTokens: number }) => void;
      }) => {
        input.usageSink?.({ promptTokens: 500, completionTokens: 200 });
        return { text: 'General background answer.' };
      },
    );
    analyzeNews.mockReset();

    meter = new ComputeMeterService(db as unknown as PrismaService, config);
    const breaker = new CircuitBreakerService(db as unknown as PrismaService, meter);
    switches = new OperationalSwitchService(db as unknown as PrismaService, config, meter);
    const guests = new GuestSessionService(db as unknown as PrismaService, config, meter, switches);
    const adapter = new AskR2ExecutionAdapter(
      { analyzeNews } as never,
      { id: 'openai', displayName: 'OpenAI', isMock: false } as never,
      {
        id: 'mock',
        displayName: 'Mock General Background',
        isMock: true,
        answerBackground,
      } as never,
      meter,
      breaker,
      switches,
      {
        get: () => ({ maxArticles: 8, maxArticleChars: 1200, maxCompletionTokens: 2000 }),
      } as never,
      { registeredDomains: () => ['CONFLICT'] } as never,
      { record: async () => true } as never,
      {
        boundSpecialistDomains: () => ['CONFLICT'],
        read: async () => ({ considered: [], contributions: [] }),
      } as never,
      guests,
    );
    service = new AskV2Service(
      db as unknown as PrismaService,
      config,
      adapter,
      guests,
      switches,
      meter,
    );
    await switches.set('ASK_R2_ENABLED', true, 'r2a1-live-spec', 'test');
    await switches.set('ASK_PUBLIC_COMPUTE_ENABLED', true, 'r2a1-live-spec', 'test');
    await switches.set('ASK_GUEST_TRIAL_ENABLED', true, 'r2a1-live-spec', 'test');
    switches.forget();
  });

  /* ── helpers ─────────────────────────────────────────────────────────── */
  async function newGuest(): Promise<{ id: string; threadId: string; who: AskRequestContext }> {
    const row = await db.guestSession.create({
      data: {
        tokenHash: randomBytes(32).toString('hex'),
        expiresAt: new Date(Date.now() + 24 * 3_600_000),
      },
      select: { id: true },
    });
    createdGuests.push(row.id);
    const who: AskRequestContext = {
      accountId: null,
      guestSessionId: row.id,
      ipScope: `ip:v4:198.51.100.${Math.floor(Math.random() * 200) + 1}`,
    };
    const thread = await askRequestContext.run(who, () =>
      service.createThread(guestPrincipal(row.id), { idempotencyKey: 'thread', language: 'en' }),
    );
    return { id: row.id, threadId: thread.id, who };
  }
  const submitAsGuest = (
    g: { id: string; threadId: string; who: AskRequestContext },
    key = randomUUID(),
  ) =>
    askRequestContext.run(g.who, () =>
      service.submit(guestPrincipal(g.id), g.threadId, {
        idempotencyKey: key,
        question: BACKGROUND_Q,
        language: 'en',
        intent: 'ask',
      }),
    );
  const reservations = async () =>
    (await db.computeReservation.findMany({ orderBy: { createdAt: 'asc' } })).map((r) => ({
      outcome: r.outcome,
      settled: r.settledAt !== null,
      charges: r.charges as unknown as Charge[],
    }));
  const meterUnits = async (scope: string, bucket?: Date) => {
    const rows = await db.computeMeter.findMany({
      where: { scope, ...(bucket ? { bucketStart: bucket } : {}) },
    });
    return rows.reduce((sum, r) => sum + Number(r.units), 0);
  };
  const slotsOf = (guestSessionId: string) =>
    db.guestSlot.findMany({ where: { guestSessionId }, orderBy: { createdAt: 'asc' } });

  /* ── the four guest controls are charged on the background path ─────── */
  it('a guest REFERENCE_BACKGROUND answer is charged to all four guest controls, then settles', async () => {
    const g = await newGuest();
    const op = await submitAsGuest(g);
    expect(op.status).toBe('COMPLETED');
    expect(answerBackground).toHaveBeenCalledTimes(1);
    expect(analyzeNews).not.toHaveBeenCalled();

    const [res] = await reservations();
    expect(res).toBeDefined();
    const scopes = res!.charges.map((c) => `${c.kind}:${c.scope}`);
    expect(scopes).toEqual(
      expect.arrayContaining([
        `units:${GUEST_POOL_HOUR_SCOPE}`,
        `units:${GUEST_POOL_DAY_SCOPE}`,
        `units:${guestScope(g.id)}`,
        `concurrency:${concurrencyScope(guestScope(g.id))}`,
      ]),
    );
    /* Settled once, as SUCCESS; the guest concurrency slot is free again. */
    expect(res).toMatchObject({ settled: true, outcome: 'SUCCESS' });
    expect(await meterUnits(concurrencyScope(guestScope(g.id)), CONCURRENCY_BUCKET)).toBe(0);
    /* Session lifetime and pool carry the ACTUAL units: 500 + outputWeight × 200. */
    const actual = 500 + meter.config.outputWeight * 200;
    expect(await meterUnits(guestScope(g.id), CONCURRENCY_BUCKET)).toBe(actual);
    expect(await meterUnits(GUEST_POOL_HOUR_SCOPE)).toBe(actual);
    expect(await meterUnits(GUEST_POOL_DAY_SCOPE)).toBe(actual);
  });

  it('an ACCOUNT background answer carries no guest charge (unchanged)', async () => {
    const userId = randomUUID();
    createdUsers.push(userId);
    await db.user.create({ data: { id: userId, email: `r2a1-${userId}@example.invalid` } });
    const who: AskRequestContext = { accountId: userId, ipScope: 'ip:v4:198.51.100.250' };
    const thread = await askRequestContext.run(who, () =>
      service.createThread(accountPrincipal(userId), { idempotencyKey: 'thread', language: 'en' }),
    );
    const op = await askRequestContext.run(who, () =>
      service.submit(accountPrincipal(userId), thread.id, {
        idempotencyKey: randomUUID(),
        question: BACKGROUND_Q,
        language: 'en',
        intent: 'ask',
      }),
    );
    expect(op.status).toBe('COMPLETED');
    const [res] = await reservations();
    expect(res!.charges.some((c) => c.scope.startsWith('guest'))).toBe(false);
    expect(res!.charges.some((c) => c.scope.includes('guest'))).toBe(false);
  });

  /* ── each guest control refuses BEFORE the provider ─────────────────── */
  it('guest-session-units exhausted: the background provider is never called; the slot is released REFUSED', async () => {
    const g = await newGuest();
    await db.computeMeter.create({
      data: {
        scope: guestScope(g.id),
        bucketStart: CONCURRENCY_BUCKET,
        units: BigInt(GUEST_LIMITS.ASK_GUEST_UNITS_PER_SESSION),
      },
    });
    const op = await submitAsGuest(g);
    expect(op).toMatchObject({
      status: 'RELEASED',
      failureCode: 'BUDGET_REFUSED:guest-session-units',
    });
    expect(answerBackground).not.toHaveBeenCalled();
    const slots = await slotsOf(g.id);
    expect(slots.map((s) => [s.state, s.releaseReason])).toEqual([['RELEASED', 'REFUSED']]);
  });

  it('guest pool hour exhausted: DEGRADED refusal before the provider; slot released REFUSED', async () => {
    const g = await newGuest();
    const hour = new Date();
    hour.setUTCMinutes(0, 0, 0);
    await db.computeMeter.create({
      data: {
        scope: GUEST_POOL_HOUR_SCOPE,
        bucketStart: hour,
        units: BigInt(GUEST_LIMITS.ASK_GUEST_POOL_UNITS_PER_HOUR),
      },
    });
    const op = await submitAsGuest(g);
    expect(op).toMatchObject({
      status: 'RELEASED',
      failureCode: 'BUDGET_DEGRADED:guest-pool-hour',
    });
    expect(answerBackground).not.toHaveBeenCalled();
    expect((await slotsOf(g.id)).map((s) => s.releaseReason)).toEqual(['REFUSED']);
  });

  it('guest pool day exhausted: DEGRADED refusal before the provider', async () => {
    const g = await newGuest();
    const day = new Date();
    day.setUTCHours(0, 0, 0, 0);
    await db.computeMeter.create({
      data: {
        scope: GUEST_POOL_DAY_SCOPE,
        bucketStart: day,
        units: BigInt(GUEST_LIMITS.ASK_GUEST_POOL_UNITS_PER_DAY),
      },
    });
    const op = await submitAsGuest(g);
    expect(op).toMatchObject({
      status: 'RELEASED',
      failureCode: 'BUDGET_DEGRADED:guest-pool-day',
    });
    expect(answerBackground).not.toHaveBeenCalled();
  });

  it('guest session concurrency held: refused before the provider; released concurrency admits the next', async () => {
    const g = await newGuest();
    const held = await meter.reserve({
      accountId: null,
      ipScope: 'ip:v4:192.0.2.77',
      provider: 'other-provider',
      estimatedUnits: 100,
      guest: {
        sessionId: g.id,
        unitsPerSession: 48000,
        poolUnitsPerHour: 100000,
        poolUnitsPerDay: 500000,
        concurrentPerSession: 1,
      },
    });
    expect(held.admitted).toBe(true);
    const refused = await submitAsGuest(g);
    expect(refused).toMatchObject({
      status: 'RELEASED',
      failureCode: 'BUDGET_REFUSED:concurrent-guest',
    });
    expect(answerBackground).not.toHaveBeenCalled();
    if (held.admitted) await meter.settle(held.reservationId, 100, 'SUCCESS');
    const ran = await submitAsGuest(g);
    expect(ran.status).toBe('COMPLETED');
    expect(answerBackground).toHaveBeenCalledTimes(1);
  });

  /* ── entitlement semantics: unchanged ───────────────────────────────── */
  it('one substantive background answer commits ONE slot; a retry of the same Send commits nothing more', async () => {
    const g = await newGuest();
    const key = randomUUID();
    const first = await submitAsGuest(g, key);
    const again = await submitAsGuest(g, key);
    expect(again.operationId).toBe(first.operationId);
    expect(answerBackground).toHaveBeenCalledTimes(1);
    const slots = await slotsOf(g.id);
    expect(slots.map((s) => s.state)).toEqual(['COMMITTED']);
    expect(await reservations()).toHaveLength(1);
  });

  it('a declined background question (CAPABILITY_UNAVAILABLE) consumes no visible guest answer', async () => {
    answerBackground.mockImplementation(async () => ({ text: null }));
    const g = await newGuest();
    const op = await submitAsGuest(g);
    expect(op.status).toBe('COMPLETED');
    const slots = await slotsOf(g.id);
    expect(slots.map((s) => [s.state, s.releaseReason])).toEqual([['RELEASED', 'NO_ANSWER']]);
    /* Still metered and settled, as before: the model was invoked. */
    const [res] = await reservations();
    expect(res).toMatchObject({ settled: true, outcome: 'NO_EVIDENCE' });
    expect(await meterUnits(concurrencyScope(guestScope(g.id)), CONCURRENCY_BUCKET)).toBe(0);
  });
});
