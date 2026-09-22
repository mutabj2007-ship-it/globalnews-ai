import { Test } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { INestApplication } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SessionService } from '../auth/session.service';
import { SESSION_COOKIE_NAME, CSRF_COOKIE_NAME } from '../auth/cookie.util';
import { AskV2Module } from './ask-v2.module';
import { AskV2Service } from './ask-v2.service';
import { ASK_EXECUTION_PORT, AskPlan, AskRequest, ExecutionResult } from './ask-compute.contract';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';

// Never fall back to DATABASE_URL. Only this dedicated, loopback test database is accepted.
const url = process.env.ASK_V2_TEST_DATABASE_URL;
if (url && !/^postgresql:\/\/askv2test@127\.0\.0\.1:\d+\/ask_v2_test$/.test(url)) {
  throw new Error('Ask V2 live tests require the dedicated loopback test database');
}
jest.setTimeout(30000);
const live = url ? describe : describe.skip;
live('Ask V2 PostgreSQL durability, lifecycle and HTTP authorization', () => {
  let db: PrismaClient;
  let replicaDb: PrismaClient;
  let service: AskV2Service;
  let replica: AskV2Service;
  let app: INestApplication;
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
  const quoteInput = (key: string = randomUUID(), question = 'What changed?') => ({
    idempotencyKey: key,
    question,
    language: 'en' as const,
    intent: 'ask' as const,
  });
  const cookie = () => [`${SESSION_COOKIE_NAME}=valid`, `${CSRF_COOKIE_NAME}=csrf`];
  async function quoted() {
    return service.quote(userId, threadId, quoteInput());
  }
  async function reserved() {
    const op = await quoted();
    await service.accept(userId, op.operationId);
    await service.reserve(userId, op.operationId);
    return op;
  }
  const success = (): ExecutionResult => ({
    succeeded: true,
    payloadJson: JSON.stringify({ answer: 'Generated prose is display-only', language: 'en' }),
    evidenceRevision: plan.revision,
    validUntil: plan.validUntil,
  });

  beforeAll(async () => {
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url!, max: 8 }) });
    replicaDb = new PrismaClient({ adapter: new PrismaPg({ connectionString: url!, max: 8 }) });
    await db.$connect();
    await replicaDb.$connect();
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
        validateSession: async (token: string) => (token === 'valid' ? { userId } : null),
      })
      .overrideProvider(ASK_EXECUTION_PORT)
      .useValue({ prepare, execute })
      .compile();
    service = module.get(AskV2Service);
    replica = new AskV2Service(replicaDb as PrismaService, config, { prepare, execute });
    app = module.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });
  beforeEach(async () => {
    configValues = {
      ASK_V2_ENABLED: 'true',
      SAND_LEDGER_ENABLED: 'true',
      SAND_CHARGING_ENABLED: 'true',
      SAND_CHARGING: 'true',
    };
    prepare.mockReset();
    execute.mockReset();
    plan = {
      revision: 'authoritative-revision-1',
      scope: 'scope:RW:7d',
      contract: 'test-cto-v1',
      executionKey: 'planned-ask',
      validUntil: new Date(Date.now() + 3600000).toISOString(),
      contextual: false,
      deepRequested: false,
      reportRequested: false,
      countryCount: 1,
      domainCount: 1,
      timeWindowDays: 7,
    };
    prepare.mockImplementation(async () => ({ ...plan }));
    execute.mockImplementation(async () => success());
    userId = randomUUID();
    otherUserId = randomUUID();
    await db.user.createMany({
      data: [
        { id: userId, email: 'ask-v2-test@example.invalid' },
        { id: otherUserId, email: 'other@example.invalid' },
      ],
    });
    threadId = (
      await service.createThread(userId, {
        idempotencyKey: 'thread',
        language: 'en',
        returnPath: '/map?country=RW',
      })
    ).id;
  });
  afterEach(async () => {
    await db.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
  });
  afterAll(async () => {
    await app?.close();
    await db?.$disconnect();
    await replicaDb?.$disconnect();
  });

  test.each([
    ['FRESH_BOUNDED', false, 'en'],
    ['FRESH_BOUNDED', false, 'pl'],
    ['CONTEXTUAL', true, 'en'],
    ['CONTEXTUAL', true, 'pl'],
  ] as const)(
    'HTTP single-turn %s (%s, %s) needs no acceptance clicks or consent timestamp',
    async (workClass, contextual, language) => {
      plan.contextual = contextual;
      const input = { ...quoteInput('conversational'), language };
      const response = await request(app.getHttpServer())
        .post('/ask-v2/threads/' + threadId + '/turns')
        .set('Cookie', cookie())
        .set('x-csrf-token', 'csrf')
        .send(input)
        .expect(201);
      expect(response.body.computeClass).toBe(workClass);
      expect(response.body.requiresAcceptance).toBe(false);
      expect(response.body.acceptedAt).toBeNull();
      expect(response.body.status).toBe('COMPLETED');
      expect(response.body.chargingEnabled).toBe(false);
      expect(
        response.body.ledger.map((entry: { entryType: string }) => entry.entryType).sort(),
      ).toEqual(['QUOTE', 'RESERVE', 'SETTLE']);
      await request(app.getHttpServer())
        .post('/ask-v2/threads/' + threadId + '/turns')
        .set('Cookie', cookie())
        .set('x-csrf-token', 'csrf')
        .send(input)
        .expect(201);
      expect(execute).toHaveBeenCalledTimes(1);
      expect(await db.computeOperation.count({ where: { userId } })).toBe(1);
      expect((await service.getThread(userId, threadId)).turns).toHaveLength(1);
    },
  );
  test.each(['deep-analysis', 'research-report'] as const)(
    '%s submission stops at confirmation but its stored reuse does not',
    async (intent) => {
      const input = { ...quoteInput(), intent };
      const op = await service.submit(userId, threadId, input);
      expect(op.requiresAcceptance).toBe(true);
      expect(op.status).toBe('QUOTED');
      expect(execute).not.toHaveBeenCalled();
      await expect(service.execute(userId, op.operationId)).rejects.toThrow('Reserve');
      await expect(service.reserve(userId, op.operationId)).rejects.toThrow('Accept');
      await expect(
        db.computeOperation.update({ where: { id: op.operationId }, data: { status: 'RESERVED' } }),
      ).rejects.toThrow();
      await service.accept(userId, op.operationId);
      await service.reserve(userId, op.operationId);
      const completed = await service.execute(userId, op.operationId);
      execute.mockClear();
      const reused = await service.submit(userId, threadId, {
        ...input,
        idempotencyKey: randomUUID(),
      });
      expect(reused.computeClass).toBe('STORED');
      expect(reused.requiresAcceptance).toBe(false);
      expect(reused.acceptedAt).toBeNull();
      expect(reused.status).toBe('COMPLETED');
      expect(reused.result?.id).toBe(completed.result?.id);
      expect(execute).not.toHaveBeenCalled();
    },
  );
  test('concurrent ordinary submissions internally reserve and execute only once across replicas', async () => {
    const input = quoteInput('ordinary-retry');
    await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        (index % 2 ? service : replica).submit(userId, threadId, input),
      ),
    );
    const final = await service.submit(userId, threadId, input);
    expect(final.status).toBe('COMPLETED');
    expect(final.acceptedAt).toBeNull();
    expect(execute).toHaveBeenCalledTimes(1);
    expect(final.ledger.map((entry) => entry.entryType).sort()).toEqual([
      'QUOTE',
      'RESERVE',
      'SETTLE',
    ]);
  });
  test('quote-only remains inert and direct ordinary execute bypasses manual accept/reserve', async () => {
    const op = await quoted();
    expect(op.requiresAcceptance).toBe(false);
    expect(execute).not.toHaveBeenCalled();
    expect((await service.accept(userId, op.operationId)).acceptedAt).toBeNull();
    expect((await service.execute(userId, op.operationId)).status).toBe('COMPLETED');
  });
  test.each([
    { deepRequested: true },
    { reportRequested: true },
    { deepRequested: true, reportRequested: true },
  ])(
    'contradictory plan %j is rejected before operation, turn, ledger or execution',
    async (flags) => {
      plan = { ...plan, contextual: true, ...flags };
      await expect(service.submit(userId, threadId, quoteInput())).rejects.toThrow(
        'ASK_PLAN_INVALID',
      );
      expect(execute).not.toHaveBeenCalled();
      expect(await db.computeOperation.count({ where: { userId } })).toBe(0);
      expect((await service.getThread(userId, threadId)).turns).toHaveLength(0);
    },
  );
  test('pending contradictory R1 plan releases before the adapter can execute', async () => {
    const op = await quoted();
    await db.computeOperation.update({
      where: { id: op.operationId },
      data: { plan: { ...plan, contextual: true, deepRequested: true } },
    });
    const result = await service.execute(userId, op.operationId);
    expect(result.status).toBe('RELEASED');
    expect(result.failureCode).toBe('ASK_PLAN_INVALID');
    expect(execute).not.toHaveBeenCalled();
  });
  test('single-turn submission preserves HTTP ownership and strict payload boundary', async () => {
    const other = await service.createThread(otherUserId, {
      idempotencyKey: 'other-turn',
      language: 'en',
    });
    await request(app.getHttpServer())
      .post('/ask-v2/threads/' + other.id + '/turns')
      .set('Cookie', cookie())
      .set('x-csrf-token', 'csrf')
      .send(quoteInput())
      .expect(404);
    await request(app.getHttpServer())
      .post('/ask-v2/threads/' + threadId + '/turns')
      .set('Cookie', cookie())
      .set('x-csrf-token', 'csrf')
      .send({ ...quoteInput(), requiresAcceptance: false, previousAnswers: ['AI prose'] })
      .expect(400);
    expect(execute).not.toHaveBeenCalled();
  });

  test('thread create is durable, owner-scoped and idempotent across replicas', async () => {
    const threads = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        (i % 2 ? service : replica).createThread(userId, {
          idempotencyKey: 'thread',
          language: 'en',
          returnPath: '/map?country=RW',
        }),
      ),
    );
    expect(new Set(threads.map((t) => t.id))).toEqual(new Set([threadId]));
    expect((await replica.getThread(userId, threadId)).returnPath).toBe('/map?country=RW');
    await expect(
      service.createThread(userId, { idempotencyKey: 'thread', language: 'pl' }),
    ).rejects.toThrow('different request');
    await expect(service.getThread(otherUserId, threadId)).rejects.toThrow();
  });
  test('concurrent unique turns allocate a stable ordered sequence', async () => {
    await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        (i % 2 ? service : replica).quote(
          userId,
          threadId,
          quoteInput(`key-${i}`, `Question ${i}`),
        ),
      ),
    );
    const result = await replica.getThread(userId, threadId);
    expect(result.turns.map((t) => t.sequence)).toEqual([1, 2, 3, 4, 5, 6]);
    expect((await service.getThread(userId, threadId, 3)).turns.map((t) => t.sequence)).toEqual([
      4, 5, 6,
    ]);
  });
  test('simultaneous duplicate submission creates one operation, one turn and one quote ledger row', async () => {
    const input = quoteInput('one-submission');
    const ops = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        (i % 2 ? service : replica).quote(userId, threadId, input),
      ),
    );
    expect(new Set(ops.map((o) => o.operationId)).size).toBe(1);
    expect(await db.computeOperation.count({ where: { userId } })).toBe(1);
    expect((await service.getThread(userId, threadId)).turns).toHaveLength(1);
    expect(ops[0].ledger.map((l) => l.entryType)).toEqual(['QUOTE']);
    await expect(
      service.quote(userId, threadId, { ...input, question: 'A different question' }),
    ).rejects.toThrow('different request');
  });
  test('deep quote, acceptance and reservation are distinct; no execution before acceptance', async () => {
    plan.deepRequested = true;
    const op = await quoted();
    expect(op.status).toBe('QUOTED');
    expect(op.acceptedAt).toBeNull();
    await expect(service.reserve(userId, op.operationId)).rejects.toThrow('Accept');
    await expect(service.execute(userId, op.operationId)).rejects.toThrow('Reserve');
    expect((await service.accept(userId, op.operationId)).status).toBe('ACCEPTED');
    expect((await service.reserve(userId, op.operationId)).status).toBe('RESERVED');
    expect(execute).not.toHaveBeenCalled();
  });
  test('cross-replica reserve/execute/settle retries never double-dispatch or double-charge', async () => {
    plan.countryCount = 3;
    const input = quoteInput('retry');
    const op = await service.quote(userId, threadId, input);
    await service.accept(userId, op.operationId);
    await Promise.all([
      service.reserve(userId, op.operationId),
      replica.reserve(userId, op.operationId),
    ]);
    execute.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      return success();
    });
    await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        (i % 2 ? service : replica).execute(userId, op.operationId),
      ),
    );
    await service.settle(userId, op.operationId, 'retried-token', success());
    const finished = await replica.getOperation(userId, op.operationId);
    expect(finished.status).toBe('COMPLETED');
    expect(execute).toHaveBeenCalledTimes(1);
    expect(finished.ledger.map((l) => l.entryType).sort()).toEqual(['QUOTE', 'RESERVE', 'SETTLE']);
    expect(finished.ledger.every((l) => l.finalSand === 0 && l.reservedSand === 0)).toBe(true);
    expect(finished.chargingEnabled).toBe(false);
    expect(finished.quotedSand).toBe(24);
    prepare.mockClear();
    expect((await replica.quote(userId, threadId, input)).operationId).toBe(op.operationId);
    expect(prepare).not.toHaveBeenCalled();
    expect(await db.computeOperation.count({ where: { userId } })).toBe(1);
  });
  test('stored result reuse survives client reconnection and invokes no execution/provider', async () => {
    const first = await reserved();
    await service.execute(userId, first.operationId);
    await replicaDb.$disconnect();
    await replicaDb.$connect();
    execute.mockClear();
    const second = await replica.quote(userId, threadId, quoteInput());
    expect(second.computeClass).toBe('STORED');
    expect(second.quotedSand).toBe(0);
    await replica.accept(userId, second.operationId);
    await replica.reserve(userId, second.operationId);
    const replay = await replica.execute(userId, second.operationId);
    expect(replay.result?.id).toBe(
      (await service.getOperation(userId, first.operationId)).result?.id,
    );
    expect(replay.result?.displayOnly).toBe(true);
    expect(execute).not.toHaveBeenCalled();
  });
  test('language, revision and ownership prevent unsafe stored reuse', async () => {
    const first = await reserved();
    await service.execute(userId, first.operationId);
    const pl = await service.quote(userId, threadId, { ...quoteInput(), language: 'pl' });
    expect(pl.computeClass).toBe('FRESH_BOUNDED');
    plan.revision = 'new-evidence';
    expect((await quoted()).computeClass).toBe('FRESH_BOUNDED');
    plan.revision = 'authoritative-revision-1';
    const otherThread = await service.createThread(otherUserId, {
      idempotencyKey: 't',
      language: 'en',
    });
    expect((await service.quote(otherUserId, otherThread.id, quoteInput())).computeClass).toBe(
      'FRESH_BOUNDED',
    );
    await expect(service.getOperation(otherUserId, first.operationId)).rejects.toThrow();
  });
  test('history and contextual navigation are read-only and cannot pass prior prose to execution', async () => {
    const first = await reserved();
    await service.execute(userId, first.operationId);
    const before = await db.sandLedgerEntry.count();
    prepare.mockClear();
    execute.mockClear();
    await service.listThreads(userId);
    await service.getThread(userId, threadId);
    await service.getOperation(userId, first.operationId);
    expect(await db.sandLedgerEntry.count()).toBe(before);
    expect(prepare).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
    const next = await service.quote(userId, threadId, quoteInput('next', 'What about today?'));
    await service.accept(userId, next.operationId);
    await service.reserve(userId, next.operationId);
    await service.execute(userId, next.operationId);
    expect(execute.mock.calls[0][0]).toEqual({
      question: 'What about today?',
      language: 'en',
      intent: 'ask',
    });
    expect(JSON.stringify(execute.mock.calls)).not.toContain('Generated prose');
    expect(JSON.stringify(execute.mock.calls)).not.toContain('/map');
  });
  test('expired stored quote releases instead of silently executing fresh work', async () => {
    const first = await reserved();
    await service.execute(userId, first.operationId);
    const second = await quoted();
    await service.accept(userId, second.operationId);
    await service.reserve(userId, second.operationId);
    await db.storedResult.update({
      where: { id: second.storedResultId! },
      data: { expiresAt: new Date(0) },
    });
    execute.mockClear();
    expect((await service.execute(userId, second.operationId)).failureCode).toBe(
      'STORED_RESULT_EXPIRED',
    );
    expect(execute).not.toHaveBeenCalled();
    expect((await service.getOperation(userId, first.operationId)).result?.expired).toBe(true);
  });
  test('deleted stored result cannot fall through to fresh execution', async () => {
    const first = await reserved();
    await service.execute(userId, first.operationId);
    const second = await quoted();
    await service.accept(userId, second.operationId);
    await service.reserve(userId, second.operationId);
    await db.storedResult.delete({ where: { id: second.storedResultId! } });
    execute.mockClear();
    expect((await service.execute(userId, second.operationId)).failureCode).toBe(
      'STORED_RESULT_EXPIRED',
    );
    expect(execute).not.toHaveBeenCalled();
  });
  test('expired deep quotes reject acceptance and reserved expiry releases', async () => {
    plan.deepRequested = true;
    const op = await quoted();
    await db.computeOperation.update({
      where: { id: op.operationId },
      data: { quoteExpiresAt: new Date(0) },
    });
    await expect(service.accept(userId, op.operationId)).rejects.toThrow('expired');
    const other = await reserved();
    await db.computeOperation.update({
      where: { id: other.operationId },
      data: { quoteExpiresAt: new Date(0) },
    });
    expect((await service.execute(userId, other.operationId)).status).toBe('RELEASED');
    expect(execute).not.toHaveBeenCalled();
  });
  test.each(['throw', 'failure', 'invalid-json', 'revision-mismatch'])(
    'failure %s releases once and cannot reexecute with same identity',
    async (kind) => {
      const op = await reserved();
      execute.mockImplementation(async () => {
        if (kind === 'throw') throw new Error('provider unavailable');
        return {
          ...success(),
          ...(kind === 'failure' ? { succeeded: false } : {}),
          ...(kind === 'invalid-json' ? { payloadJson: 'not json' } : {}),
          ...(kind === 'revision-mismatch' ? { evidenceRevision: 'other' } : {}),
        };
      });
      await service.execute(userId, op.operationId);
      await Promise.all([
        service.release(userId, op.operationId),
        replica.release(userId, op.operationId),
        service.execute(userId, op.operationId),
      ]);
      const final = await service.getOperation(userId, op.operationId);
      expect(final.status).toBe('RELEASED');
      expect(final.ledger.filter((l) => l.entryType === 'RELEASE')).toHaveLength(1);
      expect(final.ledger.some((l) => l.entryType === 'SETTLE')).toBe(false);
      expect(execute).toHaveBeenCalledTimes(1);
    },
  );
  test('cancellation fences a late provider result', async () => {
    const op = await reserved();
    let finish!: (r: ExecutionResult) => void;
    let started!: () => void;
    const began = new Promise<void>((r) => {
      started = r;
    });
    execute.mockImplementation(() => {
      started();
      return new Promise((r) => {
        finish = r;
      });
    });
    const running = service.execute(userId, op.operationId);
    await began;
    await replica.release(userId, op.operationId);
    finish(success());
    await running;
    const final = await service.getOperation(userId, op.operationId);
    expect(final.status).toBe('RELEASED');
    expect(final.result).toBeNull();
    expect(await db.storedResult.count({ where: { userId } })).toBe(0);
  });
  test('expired worker lease releases an ambiguous execution without redispatch', async () => {
    const op = await reserved();
    await db.computeOperation.update({
      where: { id: op.operationId },
      data: { status: 'RUNNING', runToken: 'lost', leaseExpiresAt: new Date(0) },
    });
    const result = await replica.execute(userId, op.operationId);
    expect(result.failureCode).toBe('EXECUTION_OUTCOME_UNKNOWN');
    expect(execute).not.toHaveBeenCalled();
  });
  test('refund is a separate zero-value terminal event and concurrent retries write it once', async () => {
    const op = await reserved();
    await service.execute(userId, op.operationId);
    await Promise.all([
      service.refund(userId, op.operationId),
      replica.refund(userId, op.operationId),
    ]);
    const result = await service.getOperation(userId, op.operationId);
    expect(result.status).toBe('REFUNDED');
    expect(result.ledger.filter((l) => l.entryType === 'REFUND')).toHaveLength(1);
    expect(result.ledger.every((l) => l.finalSand === 0)).toBe(true);
  });
  test('ledger defaults off and charging remains off even with hostile environment settings', async () => {
    delete configValues.SAND_LEDGER_ENABLED;
    const op = await reserved();
    configValues.SAND_LEDGER_ENABLED = 'true';
    const result = await service.execute(userId, op.operationId);
    expect(result.ledger).toEqual([]);
    expect(result.chargingEnabled).toBe(false);
  });
  test('database constraints reject real reservations, real charges and duplicate ledger events', async () => {
    const op = await quoted();
    for (const data of [{ reservedSand: 1 }, { finalSand: 1 }]) {
      await expect(
        db.sandLedgerEntry.create({
          data: { operationId: op.operationId, entryType: 'RESERVE', ...data },
        }),
      ).rejects.toThrow();
    }
    await expect(
      db.sandLedgerEntry.create({ data: { operationId: op.operationId, entryType: 'QUOTE' } }),
    ).rejects.toThrow();
  });
  test('settlement database failure rolls back result and ledger together; retry does not redispatch', async () => {
    const op = await reserved();
    await db.$executeRawUnsafe(
      `CREATE FUNCTION ask_v2_test_reject_settle() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."entryType" = 'SETTLE' THEN RAISE EXCEPTION 'injected settlement failure'; END IF; RETURN NEW; END $$`,
    );
    await db.$executeRawUnsafe(
      `CREATE TRIGGER ask_v2_test_reject_settle BEFORE INSERT ON "SandLedgerEntry" FOR EACH ROW EXECUTE FUNCTION ask_v2_test_reject_settle()`,
    );
    try {
      await expect(service.execute(userId, op.operationId)).rejects.toThrow();
      expect((await service.getOperation(userId, op.operationId)).status).toBe('RUNNING');
      expect(await db.storedResult.count({ where: { userId } })).toBe(0);
      await replica.execute(userId, op.operationId);
      expect(execute).toHaveBeenCalledTimes(1);
    } finally {
      await db.$executeRawUnsafe('DROP TRIGGER ask_v2_test_reject_settle ON "SandLedgerEntry"');
      await db.$executeRawUnsafe('DROP FUNCTION ask_v2_test_reject_settle()');
    }
    expect((await service.release(userId, op.operationId)).status).toBe('RELEASED');
  });
  test('account deletion cascades every private Ask record', async () => {
    const op = await reserved();
    await service.execute(userId, op.operationId);
    await db.user.delete({ where: { id: userId } });
    expect(await db.askThread.count({ where: { userId } })).toBe(0);
    expect(await db.computeOperation.count({ where: { userId } })).toBe(0);
    expect(await db.storedResult.count({ where: { userId } })).toBe(0);
    expect(await db.askTurn.count({ where: { threadId } })).toBe(0);
    expect(await db.sandLedgerEntry.count({ where: { operationId: op.operationId } })).toBe(0);
  });
  test('HTTP module is default-off; every read requires a valid authenticated session', async () => {
    delete configValues.ASK_V2_ENABLED;
    await request(app.getHttpServer()).get('/ask-v2/threads').set('Cookie', cookie()).expect(404);
    configValues.ASK_V2_ENABLED = 'true';
    for (const path of [
      '/ask-v2/threads',
      `/ask-v2/threads/${threadId}`,
      '/ask-v2/operations/unknown',
    ]) {
      await request(app.getHttpServer()).get(path).expect(401);
      await request(app.getHttpServer())
        .get(path)
        .set('Cookie', `${SESSION_COOKIE_NAME}=invalid`)
        .expect(401);
    }
    const response = await request(app.getHttpServer())
      .get(`/ask-v2/threads/${threadId}`)
      .set('Cookie', cookie())
      .expect(200);
    expect(response.headers['cache-control']).toBe('private, no-store');
  });
  test('HTTP mutations enforce authentication and CSRF before work', async () => {
    const op = await quoted();
    for (const path of [
      '/ask-v2/threads',
      `/ask-v2/threads/${threadId}/quote`,
      `/ask-v2/threads/${threadId}/turns`,
      ...['accept', 'reserve', 'execute', 'release'].map(
        (action) => `/ask-v2/operations/${op.operationId}/${action}`,
      ),
    ]) {
      await request(app.getHttpServer()).post(path).expect(401);
      await request(app.getHttpServer()).post(path).set('Cookie', cookie()).expect(403);
    }
    expect(execute).not.toHaveBeenCalled();
  });
  test('HTTP ownership checks cover every operation mutation and thread route', async () => {
    const otherThread = await service.createThread(otherUserId, {
      idempotencyKey: 'other',
      language: 'pl',
    });
    const op = await service.quote(otherUserId, otherThread.id, quoteInput());
    for (const path of [
      `/ask-v2/threads/${otherThread.id}`,
      `/ask-v2/operations/${op.operationId}`,
    ]) {
      await request(app.getHttpServer()).get(path).set('Cookie', cookie()).expect(404);
    }
    for (const action of ['accept', 'reserve', 'execute', 'release']) {
      await request(app.getHttpServer())
        .post(`/ask-v2/operations/${op.operationId}/${action}`)
        .set('Cookie', cookie())
        .set('x-csrf-token', 'csrf')
        .expect(404);
    }
    await request(app.getHttpServer())
      .post(`/ask-v2/threads/${otherThread.id}/quote`)
      .set('Cookie', cookie())
      .set('x-csrf-token', 'csrf')
      .send(quoteInput())
      .expect(404);
  });
  test('HTTP rejects client evidence, compute class, prior prose and unsafe navigation; EN/PL preserved', async () => {
    for (const extra of [
      { evidence: 'caller data' },
      { previousAnswers: ['model prose'] },
      { computeClass: 'STORED' },
      { context: { title: 'made-up evidence' } },
    ]) {
      await request(app.getHttpServer())
        .post(`/ask-v2/threads/${threadId}/quote`)
        .set('Cookie', cookie())
        .set('x-csrf-token', 'csrf')
        .send({ ...quoteInput(), ...extra })
        .expect(400);
    }
    await request(app.getHttpServer())
      .post('/ask-v2/threads')
      .set('Cookie', cookie())
      .set('x-csrf-token', 'csrf')
      .send({ idempotencyKey: 'bad', language: 'en', returnPath: '//evil.test' })
      .expect(400);
    const pl = await request(app.getHttpServer())
      .post('/ask-v2/threads')
      .set('Cookie', cookie())
      .set('x-csrf-token', 'csrf')
      .send({ idempotencyKey: 'pl', language: 'pl', returnPath: '/map?country=PL' })
      .expect(201);
    const history = await request(app.getHttpServer())
      .get(`/ask-v2/threads/${pl.body.id}`)
      .set('Cookie', cookie())
      .expect(200);
    expect(history.body.returnLabel).toBe('Wróć');
    expect(execute).not.toHaveBeenCalled();
  });
});
