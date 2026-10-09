import { randomBytes, randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { INestApplication } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { PrismaClient } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SessionService } from '../auth/session.service';
import { SESSION_COOKIE_NAME, CSRF_COOKIE_NAME } from '../auth/cookie.util';
import { AskV2Module } from './ask-v2.module';
import { AskV2Service } from './ask-v2.service';
import { ASK_EXECUTION_PORT, AskPlan, AskRequest, ExecutionResult } from './ask-compute.contract';
import { ComputeMeterService } from '../compute-controls/compute-meter.service';
import { CircuitBreakerService } from '../compute-controls/circuit-breaker.service';
import { OperationalSwitchService } from '../compute-controls/operational-switch.service';
import { AskR2ExecutionAdapter } from './ask-r2-execution.adapter';
import { GuestSessionService } from './guest/guest-session.service';
import { guestPrincipal } from './guest/ask-principal';
import { askRequestContext, type AskRequestContext } from './ask-request-context';

/**
 * CTO P0 ALPHA PROXY TIMEOUT R1 — THE LOST RESPONSE (live Alpha, db95d4e, 2026-10-09).
 *
 * The frontend proxy gave up at 30 s while the backend went on to complete the operation
 * (201 at 31 s, aiExecuted=true). The reader's recovery is a replay of the SAME idempotency key.
 * Proven here on PostgreSQL, over HTTP for the account and through the real guest controls:
 *   - a replay after completion returns THAT operation, completed — the work ran once;
 *   - a replay while the first run is still RUNNING returns it RUNNING and never runs it again;
 *     the operation read then shows the completed answer;
 *   - a follow-up turn (whose composed question depends on the thread it was written into) is
 *     still recognised as the same submission after its own turn exists;
 *   - a key reused for different words, intent or thread is refused (409), and another reader
 *     cannot reach this reader's operation through the key (owner-scoped);
 *   - a guest replay consumes no second guest slot and no second execution admission.
 */
const url = process.env.ASK_V2_TEST_DATABASE_URL;
if (url && !/^postgresql:\/\/askv2test@127\.0\.0\.1:\d+\/ask_v2_test$/.test(url)) {
  throw new Error('Ask V2 live tests require the dedicated loopback test database');
}
jest.setTimeout(60000);
const live = url ? describe : describe.skip;

const QUESTION =
  'What changed in trade and transportation between Tanzania and Rwanda during the past 30 days?';

live('P0 · a lost Ask response is recovered by replaying its key — account, over HTTP', () => {
  let db: PrismaClient;
  let app: INestApplication;
  let service: AskV2Service;
  let userId: string;
  let otherUserId: string;
  let threadId: string;
  let plan: AskPlan;
  let configValues: Record<string, string> = {};
  const prepare = jest.fn<Promise<AskPlan>, [Readonly<AskRequest>]>();
  const execute = jest.fn<
    Promise<ExecutionResult>,
    [Readonly<AskRequest>, Readonly<AskPlan>, string]
  >();
  const success = (): ExecutionResult => ({
    succeeded: true,
    payloadJson: JSON.stringify({
      answer: { state: 'REFERENCE_BACKGROUND' },
      background: { text: 'Display-only prose' },
      language: 'en',
    }),
    evidenceRevision: plan.revision,
    validUntil: plan.validUntil,
  });
  const as = (who: () => string) => ({
    post: (path: string, body: object) =>
      request(app.getHttpServer())
        .post(path)
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${who()}`, `${CSRF_COOKIE_NAME}=csrf`])
        .set('x-csrf-token', 'csrf')
        .send(body),
    get: (path: string) =>
      request(app.getHttpServer())
        .get(path)
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${who()}`, `${CSRF_COOKIE_NAME}=csrf`]),
  });
  const reader = as(() => 'reader');
  const other = as(() => 'other');
  const turn = (key: string, question = QUESTION, intent = 'ask') => ({
    idempotencyKey: key,
    question,
    language: 'en',
    intent,
  });

  beforeAll(async () => {
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url!, max: 8 }) });
    await db.$connect();
    const config = { get: (key: string) => configValues[key] } as ConfigService;
    const module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), AskV2Module],
    })
      .overrideProvider(PrismaService)
      .useValue(db)
      .overrideProvider(ConfigService)
      .useValue(config)
      .overrideProvider(SessionService)
      .useValue({
        validateSession: async (token: string) =>
          token === 'reader' ? { userId } : token === 'other' ? { userId: otherUserId } : null,
      })
      .overrideProvider(ASK_EXECUTION_PORT)
      .useValue({ prepare, execute })
      .compile();
    service = module.get(AskV2Service);
    app = module.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });
  beforeEach(async () => {
    configValues = { ASK_V2_ENABLED: 'true', SAND_LEDGER_ENABLED: 'true' };
    prepare.mockReset();
    execute.mockReset();
    plan = {
      revision: 'rev-1',
      scope: 'scope:TZA,RWA:30d',
      contract: 'test-cto-v1',
      executionKey: 'planned-ask',
      validUntil: new Date(Date.now() + 3600000).toISOString(),
      contextual: false,
      deepRequested: false,
      reportRequested: false,
      countryCount: 2,
      domainCount: 1,
      timeWindowDays: 30,
    };
    prepare.mockImplementation(async () => ({ ...plan }));
    execute.mockImplementation(async () => success());
    userId = randomUUID();
    otherUserId = randomUUID();
    await db.user.createMany({
      data: [
        { id: userId, email: 'p0-replay@example.invalid' },
        { id: otherUserId, email: 'p0-replay-other@example.invalid' },
      ],
    });
    const created = await reader.post('/ask-v2/threads', { idempotencyKey: 'thread', language: 'en' });
    threadId = created.body.id;
    void service;
  });
  afterEach(async () => {
    await db.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
  });
  afterAll(async () => {
    await app?.close();
    await db?.$disconnect();
  });

  it('the backend completed after the client lost the response: the replay returns THAT completed operation; nothing runs twice', async () => {
    const first = await reader.post(`/ask-v2/threads/${threadId}/turns`, turn('k-lost')).expect(201);
    /* the 201 above is the response the proxy dropped; the reader never saw it */
    const replay = await reader.post(`/ask-v2/threads/${threadId}/turns`, turn('k-lost')).expect(201);
    expect(replay.body.operationId).toBe(first.body.operationId);
    expect(replay.body.status).toBe('COMPLETED');
    expect(replay.body.question).toBe(QUESTION);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(await db.computeOperation.count({ where: { userId } })).toBe(1);
    expect(await db.askTurn.count({ where: { threadId } })).toBe(1);
  });

  it('a follow-up turn is still the same submission after its own turn exists (composition reads the thread)', async () => {
    await reader.post(`/ask-v2/threads/${threadId}/turns`, turn('k-1')).expect(201);
    const followUp = 'And in Kenya?';
    const first = await reader.post(`/ask-v2/threads/${threadId}/turns`, turn('k-2', followUp)).expect(201);
    const replay = await reader.post(`/ask-v2/threads/${threadId}/turns`, turn('k-2', followUp)).expect(201);
    expect(replay.body.operationId).toBe(first.body.operationId);
    expect(await db.computeOperation.count({ where: { userId } })).toBe(2);
    expect(await db.askTurn.count({ where: { threadId } })).toBe(2);
  });

  it('a turn whose own record now changes the inherited place (a released run) is still the same submission on replay', async () => {
    /* turn 1 names Kenya; turn 2 names no place, so on its first submission it inherits Kenya */
    await reader.post(`/ask-v2/threads/${threadId}/turns`, turn('k-ken', 'What changed in Kenya this week?')).expect(201);
    prepare.mockImplementationOnce(async () => ({
      ...plan,
      scope: JSON.stringify({ geography: ['country:UGA'] }),
    }));
    execute.mockImplementationOnce(async () => {
      throw new Error('provider failed');
    });
    const first = await reader
      .post(`/ask-v2/threads/${threadId}/turns`, turn('k-released', 'What about inflation?'))
      .expect(201);
    expect(first.body.status).toBe('RELEASED');
    /* its OWN released turn is now the newest record in the thread; the replay must still be it */
    const replay = await reader
      .post(`/ask-v2/threads/${threadId}/turns`, turn('k-released', 'What about inflation?'))
      .expect(201);
    expect(replay.body.operationId).toBe(first.body.operationId);
    expect(execute).toHaveBeenCalledTimes(2);
    expect(await db.computeOperation.count({ where: { userId } })).toBe(2);
  });

  it('a replay while the first run is still RUNNING returns it RUNNING, never runs it again; the read shows the answer once it lands', async () => {
    let finish!: () => void;
    execute.mockImplementationOnce(
      () => new Promise<ExecutionResult>((resolve) => (finish = () => resolve(success()))),
    );
    const firstRequest = reader.post(`/ask-v2/threads/${threadId}/turns`, turn('k-slow')).then((r) => r);
    for (let i = 0; i < 100 && execute.mock.calls.length === 0; i++) await new Promise((r) => setTimeout(r, 50));
    expect(execute).toHaveBeenCalledTimes(1);
    const replay = await reader.post(`/ask-v2/threads/${threadId}/turns`, turn('k-slow')).expect(201);
    expect(replay.body.status).toBe('RUNNING');
    expect(execute).toHaveBeenCalledTimes(1);
    finish();
    const first = await firstRequest;
    expect(first.status).toBe(201);
    expect(first.body.operationId).toBe(replay.body.operationId);
    const read = await reader.get(`/ask-v2/operations/${replay.body.operationId}`).expect(200);
    expect(read.body.status).toBe('COMPLETED');
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('a key reused for different words or intent is refused; nothing new is created', async () => {
    await reader.post(`/ask-v2/threads/${threadId}/turns`, turn('k-x')).expect(201);
    await reader.post(`/ask-v2/threads/${threadId}/turns`, turn('k-x', 'What is inflation?')).expect(409);
    await reader.post(`/ask-v2/threads/${threadId}/turns`, turn('k-x', QUESTION, 'deep-analysis')).expect(409);
    const second = await reader.post('/ask-v2/threads', { idempotencyKey: 'thread-2', language: 'en' });
    await reader.post(`/ask-v2/threads/${second.body.id}/turns`, turn('k-x')).expect(409);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(await db.computeOperation.count({ where: { userId } })).toBe(1);
  });

  it('isolation: another reader cannot replay into this thread, and the same key in their own thread is their own operation', async () => {
    const mine = await reader.post(`/ask-v2/threads/${threadId}/turns`, turn('k-shared')).expect(201);
    await other.post(`/ask-v2/threads/${threadId}/turns`, turn('k-shared')).expect(404);
    await other.get(`/ask-v2/operations/${mine.body.operationId}`).expect(404);
    const theirThread = await other.post('/ask-v2/threads', { idempotencyKey: 'thread', language: 'en' });
    const theirs = await other
      .post(`/ask-v2/threads/${theirThread.body.id}/turns`, turn('k-shared'))
      .expect(201);
    expect(theirs.body.operationId).not.toBe(mine.body.operationId);
    expect(execute).toHaveBeenCalledTimes(2);
  });
});

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

live('P0 · a guest replay of a lost response — real guest controls', () => {
  let db: PrismaClient;
  let values: Record<string, string>;
  let service: AskV2Service;
  const answerBackground = jest.fn();
  const config = { get: (key: string) => values[key] } as unknown as ConfigService;
  const createdGuests: string[] = [];

  beforeAll(async () => {
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url!, max: 8 }) });
    await db.$connect();
  });
  afterAll(async () => {
    await db.guestSession.deleteMany({ where: { id: { in: createdGuests } } });
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
      async (input: { usageSink?: (u: { promptTokens: number; completionTokens: number }) => void }) => {
        input.usageSink?.({ promptTokens: 500, completionTokens: 200 });
        return { text: 'General background answer.' };
      },
    );
    const meter = new ComputeMeterService(db as unknown as PrismaService, config);
    const breaker = new CircuitBreakerService(db as unknown as PrismaService, meter);
    const switches = new OperationalSwitchService(db as unknown as PrismaService, config, meter);
    const guests = new GuestSessionService(db as unknown as PrismaService, config, meter, switches);
    const adapter = new AskR2ExecutionAdapter(
      { analyzeNews: jest.fn() } as never,
      { id: 'openai', displayName: 'OpenAI', isMock: false } as never,
      { id: 'mock', displayName: 'Mock General Background', isMock: true, answerBackground } as never,
      meter,
      breaker,
      switches,
      { get: () => ({ maxArticles: 8, maxArticleChars: 1200, maxCompletionTokens: 2000 }) } as never,
      { registeredDomains: () => ['CONFLICT'] } as never,
      { record: async () => true } as never,
      { boundSpecialistDomains: () => ['CONFLICT'], read: async () => ({ considered: [], contributions: [] }) } as never,
      guests,
    );
    service = new AskV2Service(db as unknown as PrismaService, config, adapter, guests, switches, meter);
    await switches.set('ASK_R2_ENABLED', true, 'p0-replay-spec', 'test');
    await switches.set('ASK_PUBLIC_COMPUTE_ENABLED', true, 'p0-replay-spec', 'test');
    await switches.set('ASK_GUEST_TRIAL_ENABLED', true, 'p0-replay-spec', 'test');
    switches.forget();
  });

  it('the guest replay returns the same operation; one execution, one committed guest slot, one execution admission', async () => {
    const row = await db.guestSession.create({
      data: { tokenHash: randomBytes(32).toString('hex'), expiresAt: new Date(Date.now() + 86_400_000) },
      select: { id: true },
    });
    createdGuests.push(row.id);
    const who: AskRequestContext = { accountId: null, guestSessionId: row.id, ipScope: 'ip:v4:198.51.100.77' };
    const run = <T>(fn: () => Promise<T>) => askRequestContext.run(who, fn);
    const thread = await run(() =>
      service.createThread(guestPrincipal(row.id), { idempotencyKey: 'thread', language: 'en' }),
    );
    const body = { idempotencyKey: 'g-lost', question: 'What is inflation?', language: 'en' as const, intent: 'ask' as const };
    const first = await run(() => service.submit(guestPrincipal(row.id), thread.id, body));
    const meterBefore = await db.computeMeter.findMany({ orderBy: [{ scope: 'asc' }, { bucketStart: 'asc' }] });
    const replay = await run(() => service.submit(guestPrincipal(row.id), thread.id, body));
    expect(replay.operationId).toBe(first.operationId);
    expect(replay.status).toBe(first.status);
    expect(answerBackground).toHaveBeenCalledTimes(1);
    expect(await db.computeOperation.count({ where: { guestSessionId: row.id } })).toBe(1);
    expect(await db.guestSlot.count({ where: { guestSessionId: row.id } })).toBe(1);
    const meterAfter = await db.computeMeter.findMany({ orderBy: [{ scope: 'asc' }, { bucketStart: 'asc' }] });
    expect(meterAfter.map((m) => [m.scope, String(m.units)])).toEqual(
      meterBefore.map((m) => [m.scope, String(m.units)]),
    );
  });
});
