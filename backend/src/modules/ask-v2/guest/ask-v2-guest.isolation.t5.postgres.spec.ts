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
 * STAGE 2 · T5 PART A — GUEST ISOLATION, QUOTA KEY, FLAGS AND RETENTION (LIVE POSTGRES + HTTP)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Extends (never edits) the R3 guest suites with the isolation facts the Public-Beta consent /
 * guest-trial contract relies on (docs/convergence/stage2/T5-CONSENT-GUEST-TRIAL.md §3):
 *
 *   I1  guest A cannot read guest B's threads, operations or stored results, nor list them
 *   I2  the stored-result replay never crosses owners (guest↔guest, account→guest)
 *   I3  a signed-in reader's rows never reach the guest surface; a browser holding BOTH cookies
 *       is refused on the guest surface and its status reveals no guest data
 *   I4  a claim moves ONLY the claimant guest session's rows (measured: ALL of that session's
 *       threads, not only the named one) and never another guest's
 *   I5  a forged / malformed guest cookie authorizes nothing and mints nothing
 *   I6  the quota key is the guest SESSION; a new cookie does NOT bypass the per-IP-scope bounds
 *   I7  flags: Ask V2 off ⇒ every guest route 404; guest switch two-key (literal 'true' AND row)
 *   I8  retention: the sweep purges only sessions past absolute lifetime + grace; it runs with
 *       Ask V2 OFF (the retention promise must not depend on the feature flag)
 *   I9  cookie attributes as disclosed on /cookies (HttpOnly guest token, SameSite=Lax, Path=/,
 *       lifetime ≤ 7 days; CSRF readable by the page); status never sets a cookie
 *
 * Opt-in exactly like the R3 suites (ASK_V2_TEST_DATABASE_URL, dedicated loopback database);
 * skipped otherwise. The execution port is stubbed: no provider, no model.
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

live('T5 · guest isolation, quota key, flags and retention on PostgreSQL', () => {
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
    process.env.OAUTH_FLOW_SECRET = process.env.OAUTH_FLOW_SECRET ?? 'test-flow-secret-t5';
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
      create: { name: 'ASK_GUEST_TRIAL_ENABLED', enabled: true, setBy: 't5-test', reason: 'local' },
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
    await db.user.create({ data: { id, email: `t5-${id}@example.invalid` } });
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

  /* ── I1 ─────────────────────────────────────────────────────────────── */
  it('I1 · guest A cannot read guest B: threads, operations, stored results and lists are owner-scoped', async () => {
    const a = await newGuest();
    const b = await newGuest();
    const aOp = await ask(a, 'What is the history of the East African Community?');
    expect(aOp.body.status).toBe('COMPLETED');
    const aOperationId = aOp.body.operationId as string;

    /* B reads A's operation (and so A's stored result) — the bare owner-404. */
    const foreignOp = await b.agent.get(`/ask-v2/guest/operations/${aOperationId}`);
    expect(foreignOp.status).toBe(404);
    expect(JSON.stringify(foreignOp.body)).not.toContain('REFERENCE_BACKGROUND');
    expect((await b.agent.get(`/ask-v2/guest/operations/${randomUUID()}`)).status).toBe(404);
    /* B's list is B's only; A's list is A's only. */
    const bList = (await b.agent.get('/ask-v2/guest/threads')).body as { id: string }[];
    expect(bList.map((t) => t.id)).toEqual([b.threadId]);
    const aList = (await a.agent.get('/ask-v2/guest/threads')).body as { id: string }[];
    expect(aList.map((t) => t.id)).toEqual([a.threadId]);
    /* B's allowance is untouched by A's answer. */
    expect(await status(b)).toMatchObject({ committed: 0, remaining: 3 });
    expect(await status(a)).toMatchObject({ committed: 1, remaining: 2 });
    /* Positive control: A still reads its own. */
    expect((await a.agent.get(`/ask-v2/guest/operations/${aOperationId}`)).status).toBe(200);
  });

  /* ── I2 ─────────────────────────────────────────────────────────────── */
  it('I2 · the stored-result replay never crosses owners (guest↔guest, account→guest)', async () => {
    const Q = 'What is the history of the African Union?';
    const userId = await account();
    const acct = await accountAsk(userId, Q);
    expect(execute).toHaveBeenCalledTimes(1);

    const a = await newGuest();
    const first = await ask(a, Q);
    expect(first.body.status).toBe('COMPLETED');
    /* Not replayed from the ACCOUNT's identical stored result: the guest's own work ran. */
    expect(execute).toHaveBeenCalledTimes(2);

    /* Positive control: the SAME owner asking again IS replayed (no new execution). */
    const again = await ask(a, Q);
    expect(again.body.status).toBe('COMPLETED');
    expect(execute).toHaveBeenCalledTimes(2);

    /* Another guest with the identical question: never A's stored result. */
    const b = await newGuest();
    const bRes = await ask(b, Q);
    expect(bRes.body.status).toBe('COMPLETED');
    expect(execute).toHaveBeenCalledTimes(3);

    const ops = await db.computeOperation.findMany({
      where: { id: { in: [acct.operationId, first.body.operationId, bRes.body.operationId] } },
      select: { id: true, storedResultId: true, userId: true, guestSessionId: true },
    });
    const results = await db.storedResult.findMany({
      where: { id: { in: ops.map((o) => o.storedResultId as string) } },
      select: { id: true, userId: true, guestSessionId: true },
    });
    expect(new Set(results.map((r) => r.id)).size).toBe(3);
    for (const op of ops) {
      const r = results.find((x) => x.id === op.storedResultId)!;
      expect({ userId: r.userId, guestSessionId: r.guestSessionId }).toEqual({
        userId: op.userId,
        guestSessionId: op.guestSessionId,
      });
    }
  });

  /* ── I3 ─────────────────────────────────────────────────────────────── */
  it('I3 · a signed-in reader’s rows never reach a guest; both cookies at once ⇒ guest surface refused', async () => {
    const userId = await account();
    const acct = await accountAsk(userId, 'What is the history of ECOWAS?');
    const g = await newGuest();
    expect((await g.agent.get(`/ask-v2/guest/threads/${acct.threadId}`)).status).toBe(404);
    expect((await g.agent.get(`/ask-v2/guest/operations/${acct.operationId}`)).status).toBe(404);
    expect((await ask(g, 'x?', acct.threadId)).status).toBe(404);
    const claimAcct = await g.agent
      .post('/ask-v2/guest/claim')
      .set({ ...FIRST, 'x-csrf-token': g.csrf })
      .send({ threadId: acct.threadId });
    expect(claimAcct.status).toBe(404);
    const list = (await g.agent.get('/ask-v2/guest/threads')).body as { id: string }[];
    expect(list.map((t) => t.id)).not.toContain(acct.threadId);

    /* One browser, one principal: with a valid session cookie the guest surface refuses. */
    signedInUser = userId;
    const both = `gna_guest=${g.token}; gna_session=valid`;
    const refusedRead = await request(app.getHttpServer())
      .get(`/ask-v2/guest/threads/${g.threadId}`)
      .set('Cookie', both);
    expect(refusedRead.status).toBe(409);
    expect(refusedRead.body.code).toBe('SIGNED_IN_USE_ACCOUNT');
    const st = await request(app.getHttpServer()).get('/ask-v2/guest/status').set('Cookie', both);
    expect(st.body).toEqual({ signedIn: true, available: false });
    /* And the account surface never serves the guest's thread. */
    expect(
      (
        await request(app.getHttpServer())
          .get(`/ask-v2/threads/${g.threadId}`)
          .set('Cookie', 'gna_session=valid')
      ).status,
    ).toBe(404);
  });

  /* ── I4 ─────────────────────────────────────────────────────────────── */
  it('I4 · a claim moves ONLY the claimant session’s rows — all of its threads — never another guest’s', async () => {
    const a = await newGuest();
    const b = await newGuest();
    const aSecond = await newThread(a);
    const a1 = await ask(a, 'What is the history of the Nile Basin Initiative?');
    const a2 = await ask(a, 'What is the history of SADC?', aSecond);
    const b1 = await ask(b, 'What is the history of IGAD?');
    for (const r of [a1, a2, b1]) expect(r.body.status).toBe('COMPLETED');

    await a.agent
      .post('/ask-v2/guest/claim')
      .set({ ...FIRST, 'x-csrf-token': a.csrf })
      .send({ threadId: a.threadId });
    const claimId = (await claims.pendingClaimFor(a.sessionId)) as string;
    const userId = await account();
    expect(
      await claims.transfer(claimId, GuestSessionService.hashToken(a.token), userId),
    ).toEqual({ transferred: true, threadId: a.threadId });

    /* MEASURED CONTRACT: every thread / operation / stored result of the claimant SESSION moves,
       not only the named thread (the named one is what the continuation restores). */
    const moved = await db.askThread.findMany({ where: { userId }, select: { id: true } });
    expect(moved.map((t) => t.id).sort()).toEqual([a.threadId, aSecond].sort());
    expect(await db.computeOperation.count({ where: { userId } })).toBe(2);
    expect(await db.storedResult.count({ where: { userId } })).toBe(2);
    expect(await db.askThread.count({ where: { guestSessionId: a.sessionId } })).toBe(0);
    expect(await claims.continuationFor(userId)).toBe(a.threadId);

    /* B is untouched and still reads its own conversation and answer. */
    expect(await db.askThread.count({ where: { guestSessionId: b.sessionId } })).toBe(1);
    expect((await b.agent.get(`/ask-v2/guest/threads/${b.threadId}`)).status).toBe(200);
    expect((await b.agent.get(`/ask-v2/guest/operations/${b1.body.operationId}`)).status).toBe(
      200,
    );
    expect(await status(b)).toMatchObject({ committed: 1, remaining: 2 });
    /* B's thread can never be reached through the claimant's account. */
    signedInUser = userId;
    expect(
      (
        await request(app.getHttpServer())
          .get(`/ask-v2/threads/${b.threadId}`)
          .set('Cookie', 'gna_session=valid')
      ).status,
    ).toBe(404);
    /* The claimant's old guest cookie is dead. */
    expect((await a.agent.get('/ask-v2/guest/threads')).status).toBe(401);
  });

  /* ── I5 ─────────────────────────────────────────────────────────────── */
  it('I5 · a forged or malformed guest cookie authorizes nothing and mints nothing', async () => {
    const g = await newGuest();
    await ask(g, 'What is the history of the Arab League?');
    const sessionsBefore = await db.guestSession.count();
    const forged = randomBytes(32).toString('hex');
    for (const value of [forged, 'not-a-token', g.token.toUpperCase(), `${g.token}0`]) {
      const cookie = `gna_guest=${value}`;
      expect(
        (await request(app.getHttpServer()).get('/ask-v2/guest/threads').set('Cookie', cookie))
          .status,
      ).toBe(401);
      expect(
        (
          await request(app.getHttpServer())
            .get(`/ask-v2/guest/threads/${g.threadId}`)
            .set('Cookie', cookie)
        ).status,
      ).toBe(401);
      const st = await request(app.getHttpServer())
        .get('/ask-v2/guest/status')
        .set('Cookie', cookie);
      expect(st.body).toMatchObject({ signedIn: false, session: null, remaining: 3 });
      expect(setCookies(st)).toEqual([]);
    }
    expect(await db.guestSession.count()).toBe(sessionsBefore);
  });

  /* ── I6 ─────────────────────────────────────────────────────────────── */
  it('I6 · quota key = guest session; a fresh cookie cannot exceed the per-IP-scope bounds', async () => {
    configValues.ASK_GUEST_EXECUTIONS_PER_IP_DAY = '4';
    configValues.ASK_GUEST_SESSIONS_PER_IP_DAY = '2';
    const first = await newGuest();
    for (let i = 0; i < 3; i += 1) {
      expect((await ask(first, `What is the history of region ${i}?`)).body.status).toBe(
        'COMPLETED',
      );
    }
    const fourth = await ask(first, 'What is the history of region 3?');
    expect(fourth.status).toBe(409);
    expect(fourth.body.code).toBe('GUEST_TRIAL_EXHAUSTED');

    /* "Clear cookies": a second session from the same network — its OWN allowance (per session)… */
    const second = await newGuest();
    expect(await status(second)).toMatchObject({ remaining: 3, committed: 0 });
    expect((await ask(second, 'What is the history of region 4?')).body.status).toBe('COMPLETED');
    /* …but the cookie-independent per-IP-scope execution bound (4/day) holds across sessions. */
    const capped = await ask(second, 'What is the history of region 5?');
    expect(capped.status).toBe(429);
    expect(capped.body.code).toBe('GUEST_TEMPORARILY_LIMITED');
    /* And a third session from the same network is not issued (2/day): no cookie, no row. */
    const before = await db.guestSession.count();
    const third = await request
      .agent(app.getHttpServer())
      .post('/ask-v2/guest/threads')
      .set(FIRST)
      .send({ idempotencyKey: randomUUID(), language: 'en' });
    expect(third.status).toBe(429);
    expect(third.body.code).toBe('GUEST_TEMPORARILY_LIMITED');
    expect(setCookies(third).some((c) => c.startsWith('gna_guest='))).toBe(false);
    expect(await db.guestSession.count()).toBe(before);
    /* The meter holds counts under a pseudonymous IP scope — never the raw address. */
    const scopes = await db.computeMeter.findMany({
      where: { scope: { startsWith: 'guest' } },
      select: { scope: true },
    });
    for (const { scope } of scopes) expect(scope).not.toMatch(/127\.0\.0\.1|::1|v4:|v6:/);
  });

  /* ── I7 ─────────────────────────────────────────────────────────────── */
  it('I7 · Ask V2 off ⇒ every guest route is 404 and nothing is minted', async () => {
    const g = await newGuest();
    configValues.ASK_V2_ENABLED = 'false';
    const anon = request.agent(app.getHttpServer());
    expect((await anon.get('/ask-v2/guest/status')).status).toBe(404);
    const mint = await anon
      .post('/ask-v2/guest/threads')
      .set(FIRST)
      .send({ idempotencyKey: randomUUID(), language: 'en' });
    expect(mint.status).toBe(404);
    expect(setCookies(mint)).toEqual([]);
    expect((await g.agent.get('/ask-v2/guest/threads')).status).toBe(404);
    expect((await ask(g, 'x?')).status).toBe(404);
  });

  it('I7 · the guest switch is two-key: a non-literal deployment value or a disabled row is OFF', async () => {
    for (const [env, row] of [
      ['TRUE', true],
      ['1', true],
      [undefined, true],
      ['true', false],
    ] as const) {
      configValues.ASK_GUEST_TRIAL_ENABLED = env;
      await db.operationalSwitch.update({
        where: { name: 'ASK_GUEST_TRIAL_ENABLED' },
        data: { enabled: row },
      });
      const anon = request.agent(app.getHttpServer());
      expect((await anon.get('/ask-v2/guest/status')).body).toMatchObject({ available: false });
      const before = await db.guestSession.count();
      const res = await anon
        .post('/ask-v2/guest/threads')
        .set(FIRST)
        .send({ idempotencyKey: randomUUID(), language: 'en' });
      expect(res.status).toBe(503);
      expect(res.body.code).toBe('GUEST_TRIAL_UNAVAILABLE');
      expect(setCookies(res)).toEqual([]);
      expect(await db.guestSession.count()).toBe(before);
    }
  });

  /* ── I8 ─────────────────────────────────────────────────────────────── */
  it('I8 · the sweep purges only past lifetime + grace, keeps claimed conversations, and runs with Ask V2 OFF', async () => {
    configValues.ASK_V2_ENABLED = 'false';
    configValues.ASK_GUEST_PURGE_GRACE_H = '24';
    const now = Date.now();
    const mk = (expiresAt: Date, status = 'ACTIVE') =>
      db.guestSession.create({
        data: { tokenHash: randomBytes(32).toString('hex'), expiresAt, status },
      });
    const active = await mk(new Date(now + 3_600_000));
    const inGrace = await mk(new Date(now - 3_600_000));
    const past = await mk(new Date(now - 25 * 3_600_000));
    const claimed = await mk(new Date(now - 25 * 3_600_000), 'CLAIMED');
    const userId = await account();
    const movedThread = await db.askThread.create({
      data: { userId, clientKey: randomUUID(), requestHash: 'h', language: 'en' },
    });
    const pastThread = await db.askThread.create({
      data: { guestSessionId: past.id, clientKey: randomUUID(), requestHash: 'h', language: 'en' },
    });

    const report = await sweep.sweep(new Date(now));
    expect(report.ran).toBe(true);
    const left = await db.guestSession.findMany({
      where: { id: { in: [active.id, inGrace.id, past.id, claimed.id] } },
      select: { id: true },
    });
    expect(left.map((s) => s.id).sort()).toEqual([active.id, inGrace.id].sort());
    expect(await db.askThread.findUnique({ where: { id: pastThread.id } })).toBeNull();
    /* A conversation already moved to an account is not guest content any more. */
    expect(await db.askThread.findUnique({ where: { id: movedThread.id } })).not.toBeNull();
  });

  /* ── I9 ─────────────────────────────────────────────────────────────── */
  it('I9 · cookie attributes match the disclosure; status and reads never set a cookie', async () => {
    const anon = request.agent(app.getHttpServer());
    const st = await anon.get('/ask-v2/guest/status');
    expect(setCookies(st)).toEqual([]);
    const res = await anon
      .post('/ask-v2/guest/threads')
      .set(FIRST)
      .send({ idempotencyKey: randomUUID(), language: 'en' });
    const guest = setCookies(res).find((c) => c.startsWith('gna_guest='))!;
    const csrf = setCookies(res).find((c) => c.startsWith('gna_csrf='))!;
    expect(guest).toMatch(/; HttpOnly/);
    expect(guest).toMatch(/; SameSite=Lax/);
    expect(guest).toMatch(/; Path=\//);
    expect(guest).not.toMatch(/; Domain=/);
    const maxAge = Number(/Max-Age=(\d+)/.exec(guest)?.[1]);
    expect(maxAge).toBeGreaterThan(0);
    expect(maxAge).toBeLessThanOrEqual(7 * 24 * 3600);
    /* The CSRF value is read by the page for the double-submit header: not HttpOnly, same life. */
    expect(csrf).not.toMatch(/HttpOnly/);
    expect(Number(/Max-Age=(\d+)/.exec(csrf)?.[1])).toBe(maxAge);
    const reads = [
      await anon.get('/ask-v2/guest/status'),
      await anon.get('/ask-v2/guest/threads'),
      await anon.get(`/ask-v2/guest/threads/${res.body.id}`),
    ];
    for (const r of reads) expect(setCookies(r)).toEqual([]);
  });
});
