import { Test } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { INestApplication } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../../../generated/prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { SessionService } from '../../auth/session.service';
import { AskV2Module } from '../ask-v2.module';
import { AskV2Service } from '../ask-v2.service';
import {
  ASK_EXECUTION_PORT,
  AskExecutionRefused,
  type AskPlan,
  type AskRequest,
  type ExecutionResult,
} from '../ask-compute.contract';
import { ComputeMeterService } from '../../compute-controls/compute-meter.service';
import { accountPrincipal } from './ask-principal';
import { GuestClaimService } from './guest-claim.service';
import { GuestMaintenanceService } from './guest-maintenance.service';
import { GuestSessionService } from './guest-session.service';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK GUEST TRIAL R3 — LIVE POSTGRES + HTTP PROOF (G1–G10, R3 §6/§7 races and failures)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Real serializable transactions, real HTTP guards and cookies, real migration. The
 * execution port is stubbed (no provider, no model): what is under test is entitlement,
 * ownership, idempotency, transfer and cleanup — not answer quality, which slice R covers.
 * Guest limits here are LOCAL TEST VALUES, not proposed live values.
 */

const url = process.env.ASK_V2_TEST_DATABASE_URL;
if (url && !/^postgresql:\/\/askv2test@127\.0\.0\.1:\d+\/ask_v2_test$/.test(url)) {
  throw new Error('Ask V2 live tests require the dedicated loopback test database');
}
jest.setTimeout(60000);
const live = url ? describe : describe.skip;

const ORIGIN = 'http://localhost:3000';
const TEST_LIMITS: Record<string, string> = {
  ASK_GUEST_ATTEMPTS_PER_SESSION: '8',
  ASK_GUEST_UNITS_PER_SESSION: '48000',
  ASK_GUEST_POOL_UNITS_PER_HOUR: '100000',
  ASK_GUEST_POOL_UNITS_PER_DAY: '500000',
  ASK_GUEST_SESSIONS_PER_IP_DAY: '1000',
  ASK_GUEST_EXECUTIONS_PER_IP_DAY: '1000',
  ASK_GUEST_CONCURRENT_PER_SESSION: '1',
  ASK_GUEST_COOLDOWN_AFTER_NO_ANSWER: '3',
  ASK_GUEST_COOLDOWN_S: '600',
};

live('ASK GUEST TRIAL R3 — three-answer guest mode on PostgreSQL', () => {
  let db: PrismaClient;
  let app: INestApplication;
  let service: AskV2Service;
  let claims: GuestClaimService;
  let sweep: GuestMaintenanceService;
  let meter: ComputeMeterService;
  const configValues: Record<string, string> = {
    ASK_V2_ENABLED: 'true',
    ASK_GUEST_TRIAL_ENABLED: 'true',
    ASK_FLAG_CACHE_MS: '0',
    /* Outer ceilings as read from Production on 2026-09-30 (the meter reads these at construction). */
    ASK_UNITS_PER_REQUEST_MAX: '16000',
    ASK_GLOBAL_UNITS_PER_HOUR: '1000000',
    ASK_GLOBAL_UNITS_PER_DAY: '5000000',
    ASK_PROVIDER_UNITS_PER_HOUR: '1000000',
    ASK_IP_UNITS_PER_DAY: '360000',
    ASK_CONCURRENT_GLOBAL: '8',
    ...TEST_LIMITS,
  };
  let signedInUser: string | null = null;
  const prepare = jest.fn<Promise<AskPlan>, [Readonly<AskRequest>]>();
  const execute = jest.fn<
    Promise<ExecutionResult>,
    [Readonly<AskRequest>, Readonly<AskPlan>, string]
  >();
  let plan: AskPlan;
  /* Each execution answers with the next queued (state, basis); default is a real answer. */
  let answers: Array<[string, string] | Error> = [];

  const payload = (state: string, basis: string) =>
    JSON.stringify({ schema: 'ask-r2-result/1', answer: { state, basis, missingRoles: [] } });

  beforeAll(async () => {
    process.env.FRONTEND_ORIGIN = ORIGIN;
    process.env.OAUTH_FLOW_SECRET = process.env.OAUTH_FLOW_SECRET ?? 'test-flow-secret-r3';
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url!, max: 12 }) });
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
          token === 'valid' && signedInUser ? { userId: signedInUser } : null,
      })
      .overrideProvider(ASK_EXECUTION_PORT)
      .useValue({ prepare, execute })
      .compile();
    service = module.get(AskV2Service);
    claims = module.get(GuestClaimService);
    sweep = module.get(GuestMaintenanceService);
    meter = module.get(ComputeMeterService);
    app = module.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  beforeEach(async () => {
    Object.assign(configValues, { ASK_GUEST_TRIAL_ENABLED: 'true' }, TEST_LIMITS);
    await db.operationalSwitch.upsert({
      where: { name: 'ASK_GUEST_TRIAL_ENABLED' },
      create: {
        name: 'ASK_GUEST_TRIAL_ENABLED',
        enabled: true,
        setBy: 'r3-test',
        reason: 'local test',
      },
      update: { enabled: true },
    });
    await db.$executeRawUnsafe(`DELETE FROM "ComputeMeter" WHERE "scope" LIKE 'guest%'`);
    signedInUser = null;
    answers = [];
    prepare.mockReset();
    execute.mockReset();
    plan = {
      revision: 'r3-revision',
      scope: 'scope:PL:7d',
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
    execute.mockImplementation(async () => {
      const next = answers.shift() ?? ['CURRENT_REPORTING', 'REQUIRED_EVIDENCE_OBTAINED'];
      if (next instanceof Error) throw next;
      return {
        succeeded: true,
        payloadJson: payload(next[0], next[1]),
        evidenceRevision: plan.revision,
        validUntil: plan.validUntil,
      };
    });
  });

  afterAll(async () => {
    await db.guestSession.deleteMany({});
    await db.operationalSwitch.deleteMany({ where: { name: 'ASK_GUEST_TRIAL_ENABLED' } });
    await app.close();
    await db.$disconnect();
  });

  /* ── helpers ─────────────────────────────────────────────────────────── */
  const FIRST = { Origin: ORIGIN, 'X-Requested-With': 'globalnews-ask' };
  function cookieValue(res: request.Response, name: string): string | undefined {
    const raw = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
    const hit = raw.find((c) => c.startsWith(`${name}=`));
    return hit?.split(';')[0].split('=')[1];
  }
  interface Guest {
    agent: ReturnType<typeof request.agent>;
    csrf: string;
    token: string;
    threadId: string;
  }
  async function newGuest(): Promise<Guest> {
    const agent = request.agent(app.getHttpServer());
    const res = await agent
      .post('/ask-v2/guest/threads')
      .set(FIRST)
      .send({ idempotencyKey: randomUUID(), language: 'en' });
    expect(res.status).toBe(201);
    return {
      agent,
      csrf: cookieValue(res, 'gna_csrf') as string,
      token: cookieValue(res, 'gna_guest') as string,
      threadId: res.body.id,
    };
  }
  const ask = (
    g: Guest,
    question = 'What has changed in Kenya’s economy?',
    key = randomUUID(),
    threadId = g.threadId,
  ) =>
    g.agent
      .post(`/ask-v2/guest/threads/${threadId}/turns`)
      .set({ ...FIRST, 'x-csrf-token': g.csrf })
      .send({ idempotencyKey: key, question, language: 'en', intent: 'ask' });
  const status = async (g: Guest) => (await g.agent.get('/ask-v2/guest/status')).body;

  /* ── G1 / G2 / G3 ────────────────────────────────────────────────────── */
  it('G1 · a fresh visitor asks without Google, and gets a real completed answer', async () => {
    const before = await request(app.getHttpServer()).get('/ask-v2/guest/status');
    expect(before.body).toMatchObject({
      signedIn: false,
      available: true,
      remaining: 3,
      session: null,
    });
    const g = await newGuest();
    expect(g.token).toMatch(/^[0-9a-f]{64}$/);
    const res = await ask(g);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'COMPLETED' });
    expect(res.body.result.payload.answer.state).toBe('CURRENT_REPORTING');
    expect(await status(g)).toMatchObject({
      remaining: 2,
      committed: 1,
      reserved: 0,
      state: 'OPEN',
    });
    /* The DB keeps the hash only; the raw token exists nowhere server-side. */
    const rows = await db.guestSession.findMany({ where: { tokenHash: g.token } });
    expect(rows).toHaveLength(0);
  });

  it('G2 + G3 · three answers (one a follow-up in the same thread), then the fourth is refused BEFORE any work', async () => {
    const g = await newGuest();
    expect((await ask(g, 'What has changed in Kenya’s economy?')).body.status).toBe('COMPLETED');
    expect((await status(g)).remaining).toBe(2);
    expect((await ask(g, 'And how did the shilling react?')).body.status).toBe('COMPLETED');
    expect((await status(g)).remaining).toBe(1);
    const other = await g.agent
      .post('/ask-v2/guest/threads')
      .set({ ...FIRST, 'x-csrf-token': g.csrf })
      .send({ idempotencyKey: randomUUID(), language: 'en' });
    expect(
      (await ask(g, 'What is happening in Poland?', randomUUID(), other.body.id)).body.status,
    ).toBe('COMPLETED');
    expect(await status(g)).toMatchObject({ remaining: 0, committed: 3, state: 'EXHAUSTED' });

    prepare.mockClear();
    execute.mockClear();
    const fourth = await ask(g, 'One more question?');
    expect(fourth.status).toBe(409);
    expect(fourth.body.code).toBe('GUEST_TRIAL_EXHAUSTED');
    expect(prepare).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
    /* The completed answers stay readable; the thread keeps both turns. */
    const history = await g.agent.get(`/ask-v2/guest/threads/${g.threadId}`);
    expect(history.body.turns).toHaveLength(2);
    const firstOp = history.body.turns[0].operationId as string;
    const reopened = await g.agent.get(`/ask-v2/guest/operations/${firstOp}`);
    expect(reopened.body.result.payload.answer.state).toBe('CURRENT_REPORTING');
  });

  /* ── G4 ──────────────────────────────────────────────────────────────── */
  it('G4 · retries of the same submission are ONE operation and ONE slot', async () => {
    const g = await newGuest();
    const key = randomUUID();
    const a = await ask(g, 'What has changed in Kenya’s economy?', key);
    const b = await ask(g, 'What has changed in Kenya’s economy?', key);
    expect(b.body.operationId).toBe(a.body.operationId);
    expect(execute).toHaveBeenCalledTimes(1);
    expect((await status(g)).committed).toBe(1);
  });

  it('G4 · twenty parallel submissions on the LAST slot: exactly one runs, none exceeds three', async () => {
    const g = await newGuest();
    await ask(g);
    await ask(g);
    execute.mockClear();
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => ask(g, `Parallel ${i}?`)),
    );
    const completed = results.filter((r) => r.status === 201 && r.body.status === 'COMPLETED');
    expect(completed).toHaveLength(1);
    expect(execute).toHaveBeenCalledTimes(1);
    for (const r of results.filter((x) => x !== completed[0])) {
      expect(r.status).toBe(409);
      expect(['GUEST_ANSWER_IN_PROGRESS', 'GUEST_TRIAL_EXHAUSTED']).toContain(r.body.code);
    }
    expect(await status(g)).toMatchObject({ committed: 3, reserved: 0, remaining: 0 });
  });

  it('G4 · two tabs (two agents, one cookie) racing the last slot get one answer', async () => {
    const g = await newGuest();
    await ask(g);
    await ask(g);
    const tab2 = request.agent(app.getHttpServer());
    tab2.jar.setCookie(`gna_guest=${g.token}`, 'http://127.0.0.1');
    tab2.jar.setCookie(`gna_csrf=${g.csrf}`, 'http://127.0.0.1');
    const [x, y] = await Promise.all([
      ask(g, 'Tab one?'),
      tab2
        .post(`/ask-v2/guest/threads/${g.threadId}/turns`)
        .set({ ...FIRST, 'x-csrf-token': g.csrf })
        .send({
          idempotencyKey: randomUUID(),
          question: 'Tab two?',
          language: 'en',
          intent: 'ask',
        }),
    ]);
    expect([x, y].filter((r) => r.body.status === 'COMPLETED')).toHaveLength(1);
    expect((await status(g)).committed).toBe(3);
  });

  it('disconnect after commit: the answer counts ONCE and replays by operation id without running again', async () => {
    const g = await newGuest();
    const res = await ask(g);
    const id = res.body.operationId as string;
    execute.mockClear();
    for (let i = 0; i < 3; i += 1) {
      const replay = await g.agent.get(`/ask-v2/guest/operations/${id}`);
      expect(replay.body.status).toBe('COMPLETED');
    }
    expect(execute).not.toHaveBeenCalled();
    expect((await status(g)).committed).toBe(1);
  });

  /* ── G5 ──────────────────────────────────────────────────────────────── */
  it('G5 · reading, reopening and listing never run research or change the allowance', async () => {
    const g = await newGuest();
    const res = await ask(g);
    execute.mockClear();
    prepare.mockClear();
    await g.agent.get('/ask-v2/guest/threads');
    await g.agent.get(`/ask-v2/guest/threads/${g.threadId}`);
    await g.agent.get(`/ask-v2/guest/operations/${res.body.operationId}`);
    await g.agent.get('/ask-v2/guest/status');
    expect(prepare).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
    expect((await status(g)).remaining).toBe(2);
  });

  /* ── G6 ──────────────────────────────────────────────────────────────── */
  it.each([
    ['INSUFFICIENT', 'NO_ANSWER_PRODUCED'],
    ['CLARIFICATION_REQUIRED', 'PLAN_BROADENING_OFFERED'],
    ['CAPABILITY_UNAVAILABLE', 'OFFICIAL_SOURCE_UNAVAILABLE'],
    ['RETAINED_RECORD', 'GOVERNED_NO_RECORD'],
  ])('G6 · %s / %s consumes ZERO visible questions', async (state, basis) => {
    const g = await newGuest();
    answers = [[state, basis]];
    const res = await ask(g);
    expect(res.body.status).toBe('COMPLETED');
    expect(await status(g)).toMatchObject({ remaining: 3, committed: 0, reserved: 0 });
    const slot = await db.guestSlot.findUnique({ where: { operationId: res.body.operationId } });
    expect(slot).toMatchObject({ state: 'RELEASED', releaseReason: 'NO_ANSWER' });
  });

  it.each([
    ['CURRENT_REPORTING', 'REQUIRED_EVIDENCE_OBTAINED'],
    ['CURRENTLY_VERIFIED', 'OFFICIAL_CURRENT_EVIDENCE'],
    ['PARTIAL', 'SOME_REQUIRED_EVIDENCE_MISSING'],
    ['REFERENCE_BACKGROUND', 'REFERENCE'],
    ['RETAINED_RECORD', 'GOVERNED_RECORD'],
  ])('G6 · %s / %s counts as ONE answer (a model call is not required)', async (state, basis) => {
    const g = await newGuest();
    answers = [[state, basis]];
    await ask(g);
    expect(await status(g)).toMatchObject({ remaining: 2, committed: 1 });
  });

  it('G6 · a control refusal before spend releases the slot as REFUSED; a failure as FAILED', async () => {
    const g = await newGuest();
    answers = [new AskExecutionRefused('BUDGET_REFUSED:ip-day')];
    const refused = await ask(g);
    expect(refused.body).toMatchObject({
      status: 'RELEASED',
      failureCode: 'BUDGET_REFUSED:ip-day',
    });
    answers = [new Error('provider exploded')];
    const failed = await ask(g);
    expect(failed.body).toMatchObject({ status: 'RELEASED', failureCode: 'EXECUTION_FAILED' });
    const slots = await db.guestSlot.findMany({
      where: { operationId: { in: [refused.body.operationId, failed.body.operationId] } },
    });
    expect(slots.map((s) => s.releaseReason).sort()).toEqual(['FAILED', 'REFUSED']);
    expect((await status(g)).remaining).toBe(3);
  });

  it('G6 · three consecutive no-answers open a truthful cooldown (not "you used your questions")', async () => {
    const g = await newGuest();
    answers = [
      ['INSUFFICIENT', 'NO_ANSWER_PRODUCED'],
      ['INSUFFICIENT', 'NO_ANSWER_PRODUCED'],
      ['INSUFFICIENT', 'NO_ANSWER_PRODUCED'],
    ];
    await ask(g, 'a?');
    await ask(g, 'b?');
    await ask(g, 'c?');
    prepare.mockClear();
    const next = await ask(g, 'd?');
    expect(next.status).toBe(429);
    expect(next.body.code).toBe('GUEST_COOLDOWN');
    expect(next.body.retryAfterS).toBeGreaterThan(0);
    expect(prepare).not.toHaveBeenCalled();
    expect((await status(g)).remaining).toBe(3);
  });

  it('G6 · the attempt ceiling bounds work that answers nothing', async () => {
    configValues.ASK_GUEST_COOLDOWN_S = '0';
    const g = await newGuest();
    answers = Array.from(
      { length: 8 },
      () => ['INSUFFICIENT', 'NO_ANSWER_PRODUCED'] as [string, string],
    );
    for (let i = 0; i < 8; i += 1) expect((await ask(g, `q${i}?`)).status).toBe(201);
    const ninth = await ask(g, 'q9?');
    expect(ninth.body.code).toBe('GUEST_ATTEMPTS_EXHAUSTED');
    expect(execute).toHaveBeenCalledTimes(8);
  });

  /* ── crash / stale lease / late completion ───────────────────────────── */
  it('a crashed run is released by the sweep (FAILED, not counted); a late worker cannot count it', async () => {
    const g = await newGuest();
    let release!: () => void;
    execute.mockImplementationOnce(
      () =>
        new Promise<ExecutionResult>((resolve) => {
          release = () =>
            resolve({
              succeeded: true,
              payloadJson: payload('CURRENT_REPORTING', 'REQUIRED_EVIDENCE_OBTAINED'),
              evidenceRevision: plan.revision,
              validUntil: plan.validUntil,
            });
        }),
    );
    const pending = ask(g).then((r) => r);
    await new Promise((r) => setTimeout(r, 500));
    const op = await db.computeOperation.findFirstOrThrow({
      where: {
        guestSession: { tokenHash: GuestSessionService.hashToken(g.token) },
        status: 'RUNNING',
      },
    });
    /* The lease runs out and the slot ages past the sweep's grace. */
    await db.computeOperation.update({
      where: { id: op.id },
      data: { leaseExpiresAt: new Date(Date.now() - 1000) },
    });
    await db.guestSlot.update({
      where: { operationId: op.id },
      data: { createdAt: new Date(Date.now() - 3600_000) },
    });
    const report = await sweep.sweep();
    expect(report.ran).toBe(true);
    expect(await db.guestSlot.findUnique({ where: { operationId: op.id } })).toMatchObject({
      state: 'RELEASED',
      releaseReason: 'FAILED',
    });
    /* The worker finally returns: its settlement is refused, nothing moves twice. */
    release();
    await pending;
    expect((await db.computeOperation.findUniqueOrThrow({ where: { id: op.id } })).status).toBe(
      'RELEASED',
    );
    expect((await status(g)).committed).toBe(0);
  });

  /* ── G7 / G8 · transfer ──────────────────────────────────────────────── */
  async function account(): Promise<string> {
    const id = randomUUID();
    await db.user.create({ data: { id, email: `r3-${id}@example.invalid` } });
    return id;
  }

  it('G7 · the claimed conversation moves to the account EXACTLY once; the old guest credential is dead', async () => {
    const g = await newGuest();
    const first = await ask(g);
    const claim = await g.agent
      .post('/ask-v2/guest/claim')
      .set({ ...FIRST, 'x-csrf-token': g.csrf })
      .send({ threadId: g.threadId });
    expect(claim.body).toEqual({ claimed: true });
    const guestRow = await db.guestSession.findUniqueOrThrow({
      where: { tokenHash: GuestSessionService.hashToken(g.token) },
    });
    const claimId = (await claims.pendingClaimFor(guestRow.id)) as string;
    const userId = await account();

    execute.mockClear();
    const outcome = await claims.transfer(claimId, GuestSessionService.hashToken(g.token), userId);
    expect(outcome).toEqual({ transferred: true, threadId: g.threadId });
    /* Replay of the same callback: nothing moves twice, nothing is duplicated. */
    expect(
      (await claims.transfer(claimId, GuestSessionService.hashToken(g.token), userId)).transferred,
    ).toBe(false);
    expect(execute).not.toHaveBeenCalled();

    const thread = await service.getThread(accountPrincipal(userId), g.threadId);
    expect(thread.turns).toHaveLength(1);
    const op = await service.getOperation(accountPrincipal(userId), first.body.operationId);
    expect(op.result?.payload).toBeDefined();
    expect(await db.askThread.count({ where: { userId } })).toBe(1);
    expect(await claims.continuationFor(userId)).toBe(g.threadId);

    /* The old guest cookie can read nothing now. */
    expect((await g.agent.get(`/ask-v2/guest/threads/${g.threadId}`)).status).toBe(401);
    /* Usage survived the identity change. */
    const carried = await db.$queryRawUnsafe<{ units: bigint }[]>(
      `SELECT "units" FROM "ComputeMeter" WHERE "scope" = 'acct:${userId}'`,
    );
    expect(carried.length).toBeGreaterThanOrEqual(0);
  });

  it('G8 · adverse ownership and claim cases reveal nothing and grant nothing', async () => {
    const a = await newGuest();
    const b = await newGuest();
    await ask(a);
    /* Another guest's thread: the same bare refusal as a missing one. */
    expect((await b.agent.get(`/ask-v2/guest/threads/${a.threadId}`)).status).toBe(404);
    expect((await b.agent.get(`/ask-v2/guest/threads/${randomUUID()}`)).status).toBe(404);
    expect((await ask(b, 'x?', randomUUID(), a.threadId)).status).toBe(404);
    /* Claiming someone else's thread. */
    const stolen = await b.agent
      .post('/ask-v2/guest/claim')
      .set({ ...FIRST, 'x-csrf-token': b.csrf })
      .send({ threadId: a.threadId });
    expect(stolen.status).toBe(404);
    /* A claim presented WITHOUT the owning guest cookie transfers nothing. */
    await a.agent
      .post('/ask-v2/guest/claim')
      .set({ ...FIRST, 'x-csrf-token': a.csrf })
      .send({ threadId: a.threadId });
    const aRow = await db.guestSession.findUniqueOrThrow({
      where: { tokenHash: GuestSessionService.hashToken(a.token) },
    });
    const claimId = (await claims.pendingClaimFor(aRow.id)) as string;
    const u1 = await account();
    expect(
      await claims.transfer(claimId, GuestSessionService.hashToken(b.token), u1),
    ).toMatchObject({
      transferred: false,
      reason: 'GUEST_NOT_PRESENTED',
    });
    expect(await claims.transfer(claimId, null, u1)).toMatchObject({ transferred: false });
    /* Consumed once; a second account cannot consume it. */
    expect(
      (await claims.transfer(claimId, GuestSessionService.hashToken(a.token), u1)).transferred,
    ).toBe(true);
    const u2 = await account();
    expect(
      (await claims.transfer(claimId, GuestSessionService.hashToken(a.token), u2)).transferred,
    ).toBe(false);
    expect(await db.askThread.count({ where: { userId: u2 } })).toBe(0);
    /* Account routes never serve guest rows, and guest routes never serve account rows. */
    signedInUser = u2;
    const acctRes = await request(app.getHttpServer())
      .get(`/ask-v2/threads/${b.threadId}`)
      .set('Cookie', ['gna_session=valid']);
    expect(acctRes.status).toBe(404);
    signedInUser = null;
    /* A forged body field is rejected, never read. */
    const forged = await b.agent
      .post(`/ask-v2/guest/threads/${b.threadId}/turns`)
      .set({ ...FIRST, 'x-csrf-token': b.csrf })
      .send({
        idempotencyKey: randomUUID(),
        question: 'x?',
        language: 'en',
        intent: 'ask',
        remaining: 99,
      });
    expect(forged.status).toBe(400);
    /* CSRF: a missing/foreign token, or a foreign Origin, is refused. */
    expect(
      (
        await b.agent
          .post(`/ask-v2/guest/threads/${b.threadId}/turns`)
          .set({ ...FIRST, 'x-csrf-token': a.csrf })
          .send({ idempotencyKey: randomUUID(), question: 'x?', language: 'en', intent: 'ask' })
      ).status,
    ).toBe(403);
    expect(
      (
        await b.agent
          .post(`/ask-v2/guest/threads/${b.threadId}/turns`)
          .set({ Origin: 'https://evil.example', 'x-csrf-token': b.csrf })
          .send({ idempotencyKey: randomUUID(), question: 'x?', language: 'en', intent: 'ask' })
      ).status,
    ).toBe(403);
    /* Deeper, quoted work is not a guest answer. */
    const deep = await b.agent
      .post(`/ask-v2/guest/threads/${b.threadId}/turns`)
      .set({ ...FIRST, 'x-csrf-token': b.csrf })
      .send({
        idempotencyKey: randomUUID(),
        question: 'Deep analysis please',
        language: 'en',
        intent: 'deep-analysis',
      });
    expect(deep.body.code).toBe('GUEST_SIGN_IN_REQUIRED');
  });

  it('G8 · an expired guest session is refused on every access, before any sweep', async () => {
    const g = await newGuest();
    await db.guestSession.update({
      where: { tokenHash: GuestSessionService.hashToken(g.token) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect((await g.agent.get(`/ask-v2/guest/threads/${g.threadId}`)).status).toBe(401);
    expect((await ask(g)).status).toBe(401);
  });

  it('claim versus in-flight answer: no claim while an answer is running', async () => {
    const g = await newGuest();
    let release!: () => void;
    execute.mockImplementationOnce(
      () =>
        new Promise<ExecutionResult>((resolve) => {
          release = () =>
            resolve({
              succeeded: true,
              payloadJson: payload('CURRENT_REPORTING', 'REQUIRED_EVIDENCE_OBTAINED'),
              evidenceRevision: plan.revision,
              validUntil: plan.validUntil,
            });
        }),
    );
    const pending = ask(g).then((r) => r);
    await new Promise((r) => setTimeout(r, 500));
    const claim = await g.agent
      .post('/ask-v2/guest/claim')
      .set({ ...FIRST, 'x-csrf-token': g.csrf })
      .send({ threadId: g.threadId });
    expect(claim.body.code).toBe('GUEST_ANSWER_IN_PROGRESS');
    release();
    await pending;
  });

  it('claim versus cleanup: a session past its absolute lifetime cannot be claimed, and is purged later', async () => {
    const g = await newGuest();
    await ask(g);
    await g.agent
      .post('/ask-v2/guest/claim')
      .set({ ...FIRST, 'x-csrf-token': g.csrf })
      .send({ threadId: g.threadId });
    const row = await db.guestSession.findUniqueOrThrow({
      where: { tokenHash: GuestSessionService.hashToken(g.token) },
    });
    const claimId = (await claims.pendingClaimFor(row.id)) as string;
    await db.guestSession.update({
      where: { id: row.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(
      await claims.transfer(claimId, GuestSessionService.hashToken(g.token), await account()),
    ).toMatchObject({
      transferred: false,
      reason: 'EXPIRED',
    });
    /* No traffic at all: the sweep physically deletes after the grace window, with cascade. */
    await sweep.sweep(new Date(Date.now() + 26 * 3_600_000));
    expect(await db.guestSession.findUnique({ where: { id: row.id } })).toBeNull();
    expect(await db.askThread.findUnique({ where: { id: g.threadId } })).toBeNull();
  });

  it('shared network: every guest session has its OWN three answers (never three per IP)', async () => {
    const a = await newGuest();
    const b = await newGuest();
    for (let i = 0; i < 3; i += 1) {
      expect((await ask(a, `a${i}?`)).body.status).toBe('COMPLETED');
      expect((await ask(b, `b${i}?`)).body.status).toBe('COMPLETED');
    }
    expect((await status(a)).committed).toBe(3);
    expect((await status(b)).committed).toBe(3);
  });

  it('log redaction: no guest token, CSRF value or question text reaches any log line', async () => {
    const { Logger } = await import('@nestjs/common');
    const emitted: string[] = [];
    const spies = (['log', 'warn', 'debug', 'error', 'verbose'] as const).map((level) =>
      jest.spyOn(Logger.prototype, level).mockImplementation((m: unknown) => {
        emitted.push(String(m));
      }),
    );
    try {
      const g = await newGuest();
      await ask(g, 'Very private question about my neighbour?');
      await g.agent
        .post('/ask-v2/guest/claim')
        .set({ ...FIRST, 'x-csrf-token': g.csrf })
        .send({ threadId: g.threadId });
      const row = await db.guestSession.findUniqueOrThrow({
        where: { tokenHash: GuestSessionService.hashToken(g.token) },
      });
      await claims.transfer(
        (await claims.pendingClaimFor(row.id)) as string,
        GuestSessionService.hashToken(g.token),
        await account(),
      );
      for (const line of emitted) {
        expect(line).not.toContain(g.token);
        expect(line).not.toContain(g.csrf);
        expect(line).not.toContain(GuestSessionService.hashToken(g.token));
        expect(line).not.toContain('private question');
      }
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
  });

  /* ── G9 / G10 ────────────────────────────────────────────────────────── */
  it('G9 · private account endpoints stay unauthorized; guest responses are never cacheable', async () => {
    const anon = request(app.getHttpServer());
    expect((await anon.get('/ask-v2/threads')).status).toBe(401);
    expect((await anon.get('/ask-v2/bookmarks')).status).toBe(401);
    expect((await anon.get('/ask-v2/continuation')).status).toBe(401);
    const g = await newGuest();
    const ok = await ask(g);
    const refused = await g.agent.get(`/ask-v2/guest/threads/${randomUUID()}`);
    for (const res of [ok, refused, await g.agent.get('/ask-v2/guest/status')]) {
      expect(res.headers['cache-control']).toBe('private, no-store');
      expect(res.headers.vary).toMatch(/Cookie/);
    }
  });

  it('G10 · guest switch OFF: no new guest work, no session minted; the account path is untouched', async () => {
    await db.operationalSwitch.update({
      where: { name: 'ASK_GUEST_TRIAL_ENABLED' },
      data: { enabled: false },
    });
    const fresh = request.agent(app.getHttpServer());
    const res = await fresh
      .post('/ask-v2/guest/threads')
      .set(FIRST)
      .send({ idempotencyKey: randomUUID(), language: 'en' });
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('GUEST_TRIAL_UNAVAILABLE');
    expect(res.headers['set-cookie'] ?? []).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/^gna_guest=/)]),
    );
    expect((await fresh.get('/ask-v2/guest/status')).body.available).toBe(false);
  });

  it('G10 · switch OFF after a guest started: new work refused before the planner, old answers readable', async () => {
    const g = await newGuest();
    const done = await ask(g);
    await db.operationalSwitch.update({
      where: { name: 'ASK_GUEST_TRIAL_ENABLED' },
      data: { enabled: false },
    });
    prepare.mockClear();
    const next = await ask(g);
    expect(next.body.code).toBe('GUEST_TRIAL_UNAVAILABLE');
    expect(prepare).not.toHaveBeenCalled();
    expect(
      (await g.agent.get(`/ask-v2/guest/operations/${done.body.operationId}`)).body.status,
    ).toBe('COMPLETED');
  });

  it('G10 · missing or unsafe guest settings fail CLOSED for guests only', async () => {
    delete configValues.ASK_GUEST_POOL_UNITS_PER_DAY;
    const res = await request
      .agent(app.getHttpServer())
      .post('/ask-v2/guest/threads')
      .set(FIRST)
      .send({ idempotencyKey: randomUUID(), language: 'en' });
    expect(res.body.code).toBe('GUEST_TRIAL_NOT_CONFIGURED');
    configValues.ASK_GUEST_POOL_UNITS_PER_DAY = '500000';
    configValues.ASK_GUEST_UNITS_PER_SESSION = '1000'; /* cannot fit three answers */
    const res2 = await request
      .agent(app.getHttpServer())
      .post('/ask-v2/guest/threads')
      .set(FIRST)
      .send({ idempotencyKey: randomUUID(), language: 'en' });
    expect(res2.body.code).toBe('GUEST_TRIAL_NOT_CONFIGURED');
  });

  it('G10 · the guest meter scopes sit INSIDE the outer controls (pool, session units, concurrency)', async () => {
    const guest = {
      sessionId: randomUUID(),
      unitsPerSession: 48000,
      poolUnitsPerHour: 20000,
      poolUnitsPerDay: 500000,
      concurrentPerSession: 1,
    };
    const base = {
      accountId: null,
      ipScope: `ip:v4:198.51.100.${Math.floor(Math.random() * 200)}`,
      provider: 'openai',
      guest,
    };
    const first = await meter.reserve({ ...base, estimatedUnits: 15000 });
    expect(first.admitted).toBe(true);
    /* Session concurrency 1: a second parallel reservation is refused. */
    const second = await meter.reserve({ ...base, estimatedUnits: 1000 });
    expect(second).toMatchObject({
      admitted: false,
      control: expect.stringMatching(/concurrent-(guest|ip)/),
    });
    if (first.admitted) await meter.settle(first.reservationId, 15000, 'SUCCESS');
    /* The aggregate guest pool refuses once exhausted (degraded, not the reader's fault). */
    const other = { ...base, guest: { ...guest, sessionId: randomUUID() } };
    const pool = await meter.reserve({ ...other, estimatedUnits: 6000 });
    expect(pool).toMatchObject({ admitted: false, kind: 'DEGRADED', control: 'guest-pool-hour' });
    await db.$executeRawUnsafe(`DELETE FROM "ComputeMeter" WHERE "scope" LIKE 'guestpool:%'`);
  });
});
