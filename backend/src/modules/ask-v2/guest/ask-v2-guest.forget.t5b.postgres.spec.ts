import { Test } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { INestApplication } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { randomBytes, randomUUID } from 'node:crypto';
import { PrismaClient } from '../../../generated/prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { SessionService } from '../../auth/session.service';
import { AskV2Module } from '../ask-v2.module';
import { AskV2Service } from '../ask-v2.service';
import {
  ASK_EXECUTION_PORT,
  type AskPlan,
  type AskRequest,
  type ExecutionResult,
} from '../ask-compute.contract';
import { askRequestContext } from '../ask-request-context';
import { accountPrincipal } from './ask-principal';
import { GuestClaimService } from './guest-claim.service';
import { GuestMaintenanceService } from './guest-maintenance.service';
import { GuestSessionService } from './guest-session.service';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * STAGE 2 · T5 PART B — GUEST DATA POLICY ON STATUS + "DELETE MY GUEST DATA NOW" (LIVE POSTGRES)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *   F1  `status.policy` equals the CONFIGURED lifetime / grace / sweep interval (defaults and
 *       overrides); `session.purgeAfter` = expiresAt + grace; status still mints nothing
 *   F2  forget deletes ONLY the caller's own guest rows (session, all its threads, turns,
 *       operations, stored results, slots, claims), clears both cookies, kills the token;
 *       guest B is untouched and still reads its own; the per-IP / pool meter rows are NOT
 *       refunded
 *   F3  idempotent: repeating it (no cookie, or the dead token) deletes nothing, answers 200
 *   F4  Origin + x-requested-with + the guest-bound CSRF value are all required
 *   F5  conversations already claimed to an account are never deleted; a signed-in browser is
 *       refused (account data is out of reach)
 *   F6  refused while an answer is in progress (RESERVED slot) — nothing deleted
 *   F7  Ask V2 off ⇒ 404 like every guest route; guest switch off ⇒ still deletes (the switch
 *       gates NEW work, not the deletion of what exists)
 *
 * Opt-in exactly like the R3 / T5 suites (ASK_V2_TEST_DATABASE_URL); skipped otherwise. The
 * execution port is stubbed: no provider, no model.
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
  ASK_GUEST_EXECUTIONS_PER_DAY: '1000',
  ASK_GUEST_CONCURRENT_PER_SESSION: '1',
  ASK_GUEST_COOLDOWN_AFTER_NO_ANSWER: '3',
  ASK_GUEST_COOLDOWN_S: '600',
};

live('T5 Part B · guest status policy and POST /ask-v2/guest/forget on PostgreSQL', () => {
  let db: PrismaClient;
  let app: INestApplication;
  let service: AskV2Service;
  let claims: GuestClaimService;
  let sweep: GuestMaintenanceService;
  const users: string[] = [];
  const BASE_CONFIG: Record<string, string> = {
    ASK_V2_ENABLED: 'true',
    ASK_GUEST_TRIAL_ENABLED: 'true',
    ASK_FLAG_CACHE_MS: '0',
    ASK_UNITS_PER_REQUEST_MAX: '16000',
    ASK_GLOBAL_UNITS_PER_HOUR: '1000000',
    ASK_GLOBAL_UNITS_PER_DAY: '5000000',
    ASK_PROVIDER_UNITS_PER_HOUR: '1000000',
    ASK_IP_UNITS_PER_DAY: '360000',
    ASK_CONCURRENT_GLOBAL: '8',
  };
  /* Filled BEFORE the module compiles: the meter reads its outer ceilings at construction. */
  const configValues: Record<string, string | undefined> = { ...BASE_CONFIG, ...TEST_LIMITS };
  let signedInUser: string | null = null;
  const prepare = jest.fn<Promise<AskPlan>, [Readonly<AskRequest>]>();
  const execute = jest.fn<
    Promise<ExecutionResult>,
    [Readonly<AskRequest>, Readonly<AskPlan>, string]
  >();
  let plan: AskPlan;
  /* REFERENCE_BACKGROUND is time-independent, so the owner-scoped replay is reachable. */
  let answerState: [string, string] = ['REFERENCE_BACKGROUND', 'REFERENCE_BACKGROUND'];

  const payload = (state: string, basis: string) =>
    JSON.stringify({ schema: 'ask-r2-result/1', answer: { state, basis, missingRoles: [] } });

  beforeAll(async () => {
    process.env.FRONTEND_ORIGIN = ORIGIN;
    process.env.OAUTH_FLOW_SECRET = process.env.OAUTH_FLOW_SECRET ?? 'test-flow-secret-t5b';
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
          token === 'valid' && signedInUser ? { userId: signedInUser } : null,
      })
      .overrideProvider(ASK_EXECUTION_PORT)
      .useValue({ prepare, execute })
      .compile();
    service = module.get(AskV2Service);
    claims = module.get(GuestClaimService);
    sweep = module.get(GuestMaintenanceService);
    app = module.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  beforeEach(async () => {
    for (const k of Object.keys(configValues)) delete configValues[k];
    Object.assign(configValues, BASE_CONFIG, TEST_LIMITS);
    await db.operationalSwitch.upsert({
      where: { name: 'ASK_GUEST_TRIAL_ENABLED' },
      create: {
        name: 'ASK_GUEST_TRIAL_ENABLED',
        enabled: true,
        setBy: 't5b-test',
        reason: 'local',
      },
      update: { enabled: true },
    });
    await db.$executeRawUnsafe(`DELETE FROM "ComputeMeter" WHERE "scope" LIKE 'guest%'`);
    signedInUser = null;
    answerState = ['REFERENCE_BACKGROUND', 'REFERENCE_BACKGROUND'];
    prepare.mockReset();
    execute.mockReset();
    plan = {
      revision: 't5-revision',
      scope: 'scope:KE:7d',
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
    execute.mockImplementation(async () => ({
      succeeded: true,
      payloadJson: payload(answerState[0], answerState[1]),
      evidenceRevision: plan.revision,
      validUntil: plan.validUntil,
    }));
  });

  afterAll(async () => {
    await db.guestSession.deleteMany({});
    await db.askThread.deleteMany({ where: { userId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.operationalSwitch.deleteMany({ where: { name: 'ASK_GUEST_TRIAL_ENABLED' } });
    await app.close();
    await db.$disconnect();
  });

  /* ── helpers (same shapes as ask-v2-guest.postgres.spec.ts) ───────────── */
  const FIRST = { Origin: ORIGIN, 'X-Requested-With': 'globalnews-ask' };
  function setCookies(res: request.Response): string[] {
    return ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  }
  function cookieValue(res: request.Response, name: string): string | undefined {
    const hit = setCookies(res).find((c) => c.startsWith(`${name}=`));
    return hit?.split(';')[0].split('=')[1];
  }
  interface Guest {
    agent: ReturnType<typeof request.agent>;
    csrf: string;
    token: string;
    threadId: string;
    sessionId: string;
  }
  async function newGuest(): Promise<Guest> {
    const agent = request.agent(app.getHttpServer());
    const res = await agent
      .post('/ask-v2/guest/threads')
      .set(FIRST)
      .send({ idempotencyKey: randomUUID(), language: 'en' });
    expect(res.status).toBe(201);
    const token = cookieValue(res, 'gna_guest') as string;
    const row = await db.guestSession.findUniqueOrThrow({
      where: { tokenHash: GuestSessionService.hashToken(token) },
    });
    return {
      agent,
      csrf: cookieValue(res, 'gna_csrf') as string,
      token,
      threadId: res.body.id,
      sessionId: row.id,
    };
  }
  async function newThread(g: Guest): Promise<string> {
    const res = await g.agent
      .post('/ask-v2/guest/threads')
      .set({ ...FIRST, 'x-csrf-token': g.csrf })
      .send({ idempotencyKey: randomUUID(), language: 'en' });
    expect(res.status).toBe(201);
    return res.body.id;
  }
  const ask = (g: Guest, question: string, threadId = g.threadId) =>
    g.agent
      .post(`/ask-v2/guest/threads/${threadId}/turns`)
      .set({ ...FIRST, 'x-csrf-token': g.csrf })
      .send({ idempotencyKey: randomUUID(), question, language: 'en', intent: 'ask' });
  const status = async (g: Guest) => (await g.agent.get('/ask-v2/guest/status')).body;
  async function account(): Promise<string> {
    const id = randomUUID();
    await db.user.create({ data: { id, email: `t5b-${id}@example.invalid` } });
    users.push(id);
    return id;
  }
  async function accountAsk(userId: string, question: string) {
    const thread = await service.createThread(accountPrincipal(userId), {
      idempotencyKey: randomUUID(),
      language: 'en',
    });
    const op = await askRequestContext.run(
      { accountId: userId, ipScope: 'ip:v4:198.51.100.9' },
      () =>
        service.submit(accountPrincipal(userId), thread.id, {
          idempotencyKey: randomUUID(),
          question,
          language: 'en',
          intent: 'ask',
        }),
    );
    return { threadId: thread.id, operationId: op.operationId as string };
  }

  const FORGET = (g: Guest) => ({ ...FIRST, 'x-csrf-token': g.csrf });
  const forget = (g: Guest) => g.agent.post('/ask-v2/guest/forget').set(FORGET(g)).send({});
  const rowsOf = async (sessionId: string) => ({
    session: await db.guestSession.count({ where: { id: sessionId } }),
    threads: await db.askThread.count({ where: { guestSessionId: sessionId } }),
    operations: await db.computeOperation.count({ where: { guestSessionId: sessionId } }),
    results: await db.storedResult.count({ where: { guestSessionId: sessionId } }),
    slots: await db.guestSlot.count({ where: { guestSessionId: sessionId } }),
    claims: await db.guestClaim.count({ where: { guestSessionId: sessionId } }),
  });
  const cleared = (res: request.Response, name: string) =>
    setCookies(res).some((c) => c.startsWith(`${name}=;`) && /Expires=Thu, 01 Jan 1970/.test(c));

  /* ── F1 ─────────────────────────────────────────────────────────────── */
  it('F1 · status publishes the configured policy and purge date, and still mints nothing', async () => {
    const anon = request.agent(app.getHttpServer());
    const st = await anon.get('/ask-v2/guest/status');
    expect(st.body.policy).toEqual({
      allowance: 3,
      sessionLifetimeH: 168,
      purgeGraceH: 24,
      sweepIntervalS: 900,
    });
    expect(st.body.session).toBeNull();
    expect(setCookies(st)).toEqual([]);

    configValues.ASK_GUEST_SESSION_LIFETIME_H = '48';
    configValues.ASK_GUEST_PURGE_GRACE_H = '6';
    configValues.ASK_GUEST_SWEEP_INTERVAL_S = '600';
    const g = await newGuest();
    const body = await status(g);
    expect(body.policy).toEqual({
      allowance: 3,
      sessionLifetimeH: 48,
      purgeGraceH: 6,
      sweepIntervalS: 600,
    });
    const expiresAt = new Date(body.session.expiresAt).getTime();
    const created = (await db.guestSession.findUniqueOrThrow({ where: { id: g.sessionId } }))
      .createdAt;
    expect(Math.abs(expiresAt - created.getTime() - 48 * 3_600_000)).toBeLessThan(5_000);
    expect(new Date(body.session.purgeAfter).getTime()).toBe(expiresAt + 6 * 3_600_000);
    /* An out-of-range value falls back to the default (never above the 7-day cap). */
    configValues.ASK_GUEST_SESSION_LIFETIME_H = '500';
    expect((await status(g)).policy.sessionLifetimeH).toBe(168);
  });

  /* ── F2 ─────────────────────────────────────────────────────────────── */
  it('F2 · forget deletes only the caller’s own guest rows, clears both cookies, and refunds no shared bound', async () => {
    const a = await newGuest();
    const b = await newGuest();
    const aSecond = await newThread(a);
    const a1 = await ask(a, 'What is the history of the African Union?');
    const a2 = await ask(a, 'What is the history of ECOWAS?', aSecond);
    const b1 = await ask(b, 'What is the history of the Commonwealth?');
    for (const r of [a1, a2, b1]) expect(r.body.status).toBe('COMPLETED');
    /* A pending claim is guest data too — it goes with the session. */
    await a.agent
      .post('/ask-v2/guest/claim')
      .set({ ...FIRST, 'x-csrf-token': a.csrf })
      .send({ threadId: a.threadId });
    const before = await rowsOf(a.sessionId);
    expect(before).toMatchObject({ session: 1, threads: 2, operations: 2, results: 2, claims: 1 });
    expect(before.slots).toBeGreaterThan(0);
    const bBefore = await rowsOf(b.sessionId);
    const turnsBefore = await db.askTurn.count({ where: { threadId: a.threadId } });
    expect(turnsBefore).toBe(1);
    const shared = await db.computeMeter.findMany({
      where: {
        OR: [
          { scope: { startsWith: 'guestiss:' } },
          { scope: { startsWith: 'guestexec:' } },
          { scope: { startsWith: 'guestpool' } },
        ],
      },
      select: { scope: true, bucketStart: true, units: true },
      orderBy: [{ scope: 'asc' }, { bucketStart: 'asc' }],
    });
    expect(shared.length).toBeGreaterThan(0);

    const res = await forget(a);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ forgotten: true, deleted: true });
    expect(cleared(res, 'gna_guest')).toBe(true);
    expect(cleared(res, 'gna_csrf')).toBe(true);

    expect(await rowsOf(a.sessionId)).toEqual({
      session: 0,
      threads: 0,
      operations: 0,
      results: 0,
      slots: 0,
      claims: 0,
    });
    expect(await db.askThread.count({ where: { id: { in: [a.threadId, aSecond] } } })).toBe(0);
    expect(await db.askTurn.count({ where: { threadId: a.threadId } })).toBe(0);
    expect(
      await db.computeOperation.count({
        where: { id: { in: [a1.body.operationId, a2.body.operationId] } },
      }),
    ).toBe(0);

    /* B untouched, and still reads its own conversation and answer. */
    expect(await rowsOf(b.sessionId)).toEqual(bBefore);
    expect((await b.agent.get(`/ask-v2/guest/threads/${b.threadId}`)).status).toBe(200);
    expect((await b.agent.get(`/ask-v2/guest/operations/${b1.body.operationId}`)).status).toBe(200);
    expect(await status(b)).toMatchObject({ committed: 1, remaining: 2 });

    /* A's old token is dead everywhere. */
    const old = `gna_guest=${a.token}`;
    expect(
      (await request(app.getHttpServer()).get('/ask-v2/guest/threads').set('Cookie', old)).status,
    ).toBe(401);
    expect(
      (await request(app.getHttpServer()).get('/ask-v2/guest/status').set('Cookie', old)).body
        .session,
    ).toBeNull();

    /* Shared bounds are counters, not the guest's content: never refunded. */
    const after = await db.computeMeter.findMany({
      where: {
        OR: [
          { scope: { startsWith: 'guestiss:' } },
          { scope: { startsWith: 'guestexec:' } },
          { scope: { startsWith: 'guestpool' } },
        ],
      },
      select: { scope: true, bucketStart: true, units: true },
      orderBy: [{ scope: 'asc' }, { bucketStart: 'asc' }],
    });
    expect(after).toEqual(shared);
  });

  /* ── F3 ─────────────────────────────────────────────────────────────── */
  it('F3 · forget is idempotent: no cookie, or the dead token, deletes nothing and answers 200', async () => {
    const a = await newGuest();
    await ask(a, 'What is the history of the OECD?');
    expect((await forget(a)).body).toEqual({ forgotten: true, deleted: true });
    /* The agent dropped the cleared cookies: a plain repeat. */
    const again = await a.agent.post('/ask-v2/guest/forget').set(FIRST).send({});
    expect(again.status).toBe(200);
    expect(again.body).toEqual({ forgotten: true, deleted: false });
    /* The dead token presented again (with its bound CSRF value): nothing left to delete. */
    const replay = await request(app.getHttpServer())
      .post('/ask-v2/guest/forget')
      .set({ ...FIRST, 'x-csrf-token': a.csrf })
      .set('Cookie', [`gna_guest=${a.token}`, `gna_csrf=${a.csrf}`])
      .send({});
    expect(replay.status).toBe(200);
    expect(replay.body).toEqual({ forgotten: true, deleted: false });
    /* Anonymous visitor who never had a session: 200, nothing set or minted. */
    const sessions = await db.guestSession.count();
    const anon = await request(app.getHttpServer())
      .post('/ask-v2/guest/forget')
      .set(FIRST)
      .send({});
    expect(anon.body).toEqual({ forgotten: true, deleted: false });
    expect(setCookies(anon)).toEqual([]);
    expect(await db.guestSession.count()).toBe(sessions);
  });

  /* ── F4 ─────────────────────────────────────────────────────────────── */
  it('F4 · Origin, x-requested-with and the guest-bound CSRF value are all required', async () => {
    const a = await newGuest();
    const b = await newGuest();
    await ask(a, 'What is the history of the WTO?');
    const before = await rowsOf(a.sessionId);
    const post = () => a.agent.post('/ask-v2/guest/forget');
    expect(
      (await post().set({ 'X-Requested-With': 'globalnews-ask', 'x-csrf-token': a.csrf }).send({}))
        .status,
    ).toBe(403);
    expect(
      (
        await post()
          .set({
            Origin: 'https://evil.example',
            'X-Requested-With': 'globalnews-ask',
            'x-csrf-token': a.csrf,
          })
          .send({})
      ).status,
    ).toBe(403);
    expect((await post().set({ Origin: ORIGIN, 'x-csrf-token': a.csrf }).send({})).status).toBe(
      403,
    );
    expect((await post().set(FIRST).send({})).status).toBe(403);
    /* Another guest's CSRF value never matches this guest's token. */
    expect(
      (
        await post()
          .set({ ...FIRST, 'x-csrf-token': b.csrf })
          .send({})
      ).status,
    ).toBe(403);
    expect(await rowsOf(a.sessionId)).toEqual(before);
    expect((await a.agent.get('/ask-v2/guest/threads')).status).toBe(200);
  });

  /* ── F5 ─────────────────────────────────────────────────────────────── */
  it('F5 · claimed-to-account conversations are never deleted; a signed-in browser is refused', async () => {
    const a = await newGuest();
    const a1 = await ask(a, 'What is the history of the Danube Commission?');
    expect(a1.body.status).toBe('COMPLETED');
    await a.agent
      .post('/ask-v2/guest/claim')
      .set({ ...FIRST, 'x-csrf-token': a.csrf })
      .send({ threadId: a.threadId });
    const claimId = (await claims.pendingClaimFor(a.sessionId)) as string;
    const userId = await account();
    expect(await claims.transfer(claimId, GuestSessionService.hashToken(a.token), userId)).toEqual({
      transferred: true,
      threadId: a.threadId,
    });
    /* The old (claimed) token presented with its bound CSRF value: nothing is guest data. */
    const res = await request(app.getHttpServer())
      .post('/ask-v2/guest/forget')
      .set({ ...FIRST, 'x-csrf-token': a.csrf })
      .set('Cookie', [`gna_guest=${a.token}`, `gna_csrf=${a.csrf}`])
      .send({});
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ forgotten: true, deleted: false });
    expect(await db.askThread.count({ where: { id: a.threadId, userId } })).toBe(1);
    expect(await db.computeOperation.count({ where: { id: a1.body.operationId, userId } })).toBe(1);
    expect(await db.storedResult.count({ where: { userId } })).toBe(1);
    expect(await db.guestSession.count({ where: { id: a.sessionId, status: 'CLAIMED' } })).toBe(1);

    /* A browser holding a live guest cookie AND a valid account session is refused outright. */
    const c = await newGuest();
    await ask(c, 'What is the history of the Rhine Commission?');
    const cBefore = await rowsOf(c.sessionId);
    signedInUser = userId;
    const both = await request(app.getHttpServer())
      .post('/ask-v2/guest/forget')
      .set({ ...FIRST, 'x-csrf-token': c.csrf })
      .set('Cookie', [`gna_session=valid`, `gna_guest=${c.token}`, `gna_csrf=${c.csrf}`])
      .send({});
    expect(both.status).toBe(409);
    expect(both.body.code).toBe('SIGNED_IN_USE_ACCOUNT');
    expect(setCookies(both)).toEqual([]);
    expect(await rowsOf(c.sessionId)).toEqual(cBefore);
    expect(await db.askThread.count({ where: { userId } })).toBe(1);
  });

  /* ── F6 ─────────────────────────────────────────────────────────────── */
  it('F6 · refused while an answer is in progress; nothing deleted', async () => {
    const a = await newGuest();
    const a1 = await ask(a, 'What is the history of NATO?');
    expect(a1.body.status).toBe('COMPLETED');
    await db.guestSlot.update({
      where: { operationId: a1.body.operationId },
      data: { state: 'RESERVED', settledAt: null },
    });
    const before = await rowsOf(a.sessionId);
    const res = await forget(a);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('GUEST_ANSWER_IN_PROGRESS');
    expect(setCookies(res)).toEqual([]);
    expect(await rowsOf(a.sessionId)).toEqual(before);
  });

  /* ── F7 ─────────────────────────────────────────────────────────────── */
  it('F7 · Ask V2 off ⇒ 404; guest switch off ⇒ deletion still works', async () => {
    const a = await newGuest();
    await ask(a, 'What is the history of the Nordic Council?');
    configValues.ASK_V2_ENABLED = 'false';
    const off = await forget(a);
    expect(off.status).toBe(404);
    expect(setCookies(off)).toEqual([]);
    expect((await rowsOf(a.sessionId)).session).toBe(1);

    configValues.ASK_V2_ENABLED = 'true';
    await db.operationalSwitch.update({
      where: { name: 'ASK_GUEST_TRIAL_ENABLED' },
      data: { enabled: false },
    });
    const res = await forget(a);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ forgotten: true, deleted: true });
    expect((await rowsOf(a.sessionId)).session).toBe(0);
  });

  /* The sweep and the forget action agree on what a guest session's data is. */
  it('F8 · after forget the sweep has nothing of that session left to purge', async () => {
    const a = await newGuest();
    await ask(a, 'What is the history of the Benelux Union?');
    await forget(a);
    const report = await sweep.sweep(new Date(Date.now() + 400 * 3_600_000));
    expect(report.ran).toBe(true);
    expect(await db.guestSession.count({ where: { id: a.sessionId } })).toBe(0);
  });
});
