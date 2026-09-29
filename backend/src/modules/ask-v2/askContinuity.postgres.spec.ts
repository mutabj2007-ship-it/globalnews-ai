import { Test } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { INestApplication } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SessionService } from '../auth/session.service';
import { SESSION_COOKIE_NAME, CSRF_COOKIE_NAME } from '../auth/cookie.util';
import { AskV2Module } from './ask-v2.module';
import { AskV2Service } from './ask-v2.service';
import { ASK_EXECUTION_PORT, AskPlan, AskRequest, ExecutionResult } from './ask-compute.contract';

/**
 * ASK A+H QUALIFICATION R1 — Recent + Saved continuity against REAL PostgreSQL and the REAL
 * HTTP surface (AskV2EnabledGuard, RequireAuthGuard, CsrfGuard, ValidationPipe).
 *
 * Two readers, A and B, each with a completed Ask turn. Proves the AskBookmark shape, its
 * keys and cascades, idempotency, IDOR refusal (a foreign turn and a nonexistent turn are
 * indistinguishable), signed-out and CSRF refusal, and that every continuity read/write
 * performs zero compute: no plan, no execution, no meter, no ledger, no new stored result.
 */
const url = process.env.ASK_V2_TEST_DATABASE_URL;
if (url && !/^postgresql:\/\/askv2test@127\.0\.0\.1:\d+\/ask_v2_test$/.test(url)) {
  throw new Error('Ask continuity live tests require the dedicated loopback test database');
}
jest.setTimeout(60000);
const live = url ? describe : describe.skip;

live('Ask continuity (Recent + Saved) — live PostgreSQL, HTTP authorization, zero compute', () => {
  let db: PrismaClient;
  let app: INestApplication;
  let service: AskV2Service;
  let configValues: Record<string, string> = {};
  const ids = { a: '', b: '' };
  const turn = { a: '', b: '' };
  const op = { a: '', b: '' };
  const thread = { a: '', b: '' };
  const prepare = jest.fn<Promise<AskPlan>, [Readonly<AskRequest>]>();
  const execute = jest.fn<
    Promise<ExecutionResult>,
    [Readonly<AskRequest>, Readonly<AskPlan>, string]
  >();
  const plan = (): AskPlan => ({
    revision: 'rev-1',
    scope: 'scope:RW:7d',
    contract: 'qual-v1',
    executionKey: 'planned-ask',
    validUntil: new Date(Date.now() + 3600000).toISOString(),
    contextual: false,
    deepRequested: false,
    reportRequested: false,
    countryCount: 1,
    domainCount: 1,
    timeWindowDays: 7,
  });
  const http = () => request(app.getHttpServer());
  const as = (who: 'a' | 'b') => [`${SESSION_COOKIE_NAME}=${who}`, `${CSRF_COOKIE_NAME}=csrf`];

  async function completedTurn(userId: string, question: string) {
    const t = await service.createThread(userId, { idempotencyKey: randomUUID(), language: 'en' });
    const q = await service.quote(userId, t.id, {
      idempotencyKey: randomUUID(),
      question,
      language: 'en',
      intent: 'ask',
    });
    if (q.status !== 'COMPLETED') {
      await service.accept(userId, q.operationId);
      await service.reserve(userId, q.operationId);
      await service.execute(userId, q.operationId);
    }
    const row = await db.askTurn.findFirstOrThrow({ where: { threadId: t.id } });
    return { threadId: t.id, turnId: row.id, operationId: q.operationId };
  }
  /** Everything compute leaves behind, so "zero compute" is a before/after equality. */
  async function computeFootprint() {
    const [ops, results, ledger, meter] = await Promise.all([
      db.computeOperation.count(),
      db.storedResult.findMany({
        select: { id: true, createdAt: true, expiresAt: true, payload: true },
        orderBy: { id: 'asc' },
      }),
      db.sandLedgerEntry.count(),
      db.$queryRawUnsafe<{ n: bigint }[]>(
        `SELECT count(*)::bigint AS n FROM information_schema.tables WHERE table_name ILIKE 'computemeter%' OR table_name ILIKE 'compute_meter%'`,
      ),
    ]);
    return {
      prepare: prepare.mock.calls.length,
      execute: execute.mock.calls.length,
      ops,
      results: JSON.stringify(results),
      ledger,
      meterTables: Number(meter[0]?.n ?? 0),
    };
  }

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
          token === 'a' ? { userId: ids.a } : token === 'b' ? { userId: ids.b } : null,
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
    configValues = {
      ASK_V2_ENABLED: 'true',
      SAND_LEDGER_ENABLED: 'true',
      SAND_CHARGING_ENABLED: 'false',
    };
    prepare.mockReset();
    execute.mockReset();
    prepare.mockImplementation(async () => plan());
    execute.mockImplementation(async () => ({
      succeeded: true,
      payloadJson: JSON.stringify({
        schema: 'ask-r2-result/1',
        answer: { state: 'CURRENT_REPORTING' },
      }),
      evidenceRevision: 'rev-1',
      validUntil: plan().validUntil,
    }));
    ids.a = randomUUID();
    ids.b = randomUUID();
    await db.user.createMany({
      data: [
        { id: ids.a, email: `a-${ids.a}@example.invalid` },
        { id: ids.b, email: `b-${ids.b}@example.invalid` },
      ],
    });
    const a = await completedTurn(ids.a, 'What changed in Rwanda this week?');
    const b = await completedTurn(ids.b, 'Who is the president of Kenya?');
    Object.assign(turn, { a: a.turnId, b: b.turnId });
    Object.assign(op, { a: a.operationId, b: b.operationId });
    Object.assign(thread, { a: a.threadId, b: b.threadId });
  });
  afterEach(async () => {
    await db.user.deleteMany({ where: { id: { in: [ids.a, ids.b] } } });
  });
  afterAll(async () => {
    await app?.close();
    await db?.$disconnect();
  });

  describe('AskBookmark is a relationship, not a copy', () => {
    it('exactly id, userId, turnId, createdAt — no question, answer, evidence or StoredResult payload', async () => {
      const cols = await db.$queryRawUnsafe<{ column_name: string; data_type: string }[]>(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'AskBookmark' ORDER BY column_name`,
      );
      expect(cols.map((c) => c.column_name)).toEqual(['createdAt', 'id', 'turnId', 'userId']);
      expect(cols.find((c) => c.column_name === 'createdAt')?.data_type).toBe(
        'timestamp without time zone',
      );
    });

    it('UNIQUE (userId, turnId); FK userId → User ON DELETE CASCADE; FK turnId → AskTurn ON DELETE CASCADE', async () => {
      const fks = await db.$queryRawUnsafe<{ col: string; ref: string; del: string }[]>(
        `SELECT kcu.column_name AS col, ccu.table_name AS ref, rc.delete_rule AS del
           FROM information_schema.referential_constraints rc
           JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = rc.constraint_name
           JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = rc.constraint_name
          WHERE kcu.table_name = 'AskBookmark' ORDER BY kcu.column_name`,
      );
      expect(fks).toEqual([
        { col: 'turnId', ref: 'AskTurn', del: 'CASCADE' },
        { col: 'userId', ref: 'User', del: 'CASCADE' },
      ]);
      const unique = await db.$queryRawUnsafe<{ def: string }[]>(
        `SELECT indexdef AS def FROM pg_indexes WHERE tablename = 'AskBookmark' AND indexdef ILIKE '%UNIQUE%' AND indexdef NOT ILIKE '%(id)%'`,
      );
      expect(unique.map((u) => u.def.replace(/.*\(/, '('))).toEqual(['("userId", "turnId")']);
    });
  });

  describe('database behaviour', () => {
    it('bookmark twice = one bookmark; unbookmark twice is safe', async () => {
      for (let i = 0; i < 2; i += 1)
        await http()
          .post('/ask-v2/bookmarks')
          .set('Cookie', as('a'))
          .set('x-csrf-token', 'csrf')
          .send({ turnId: turn.a })
          .expect(201);
      expect(await db.askBookmark.count({ where: { userId: ids.a } })).toBe(1);
      const first = await http()
        .delete(`/ask-v2/bookmarks/${turn.a}`)
        .set('Cookie', as('a'))
        .set('x-csrf-token', 'csrf')
        .expect(200);
      const second = await http()
        .delete(`/ask-v2/bookmarks/${turn.a}`)
        .set('Cookie', as('a'))
        .set('x-csrf-token', 'csrf')
        .expect(200);
      expect([first.body.removed, second.body.removed]).toEqual([true, false]);
      expect(await db.askBookmark.count({ where: { userId: ids.a } })).toBe(0);
    });

    it('a racing double bookmark still yields exactly one row', async () => {
      await Promise.all([service.addBookmark(ids.a, turn.a), service.addBookmark(ids.a, turn.a)]);
      expect(await db.askBookmark.count({ where: { userId: ids.a, turnId: turn.a } })).toBe(1);
    });

    it('account deletion cascades to the reader’s bookmarks', async () => {
      await service.addBookmark(ids.a, turn.a);
      await db.user.delete({ where: { id: ids.a } });
      expect(await db.askBookmark.count({ where: { turnId: turn.a } })).toBe(0);
    });

    it('turn deletion cascades to its bookmarks', async () => {
      await service.addBookmark(ids.a, turn.a);
      await db.askTurn.delete({ where: { id: turn.a } });
      expect(await db.askBookmark.count({ where: { userId: ids.a } })).toBe(0);
    });
  });

  describe('IDOR — user B against user A’s rows', () => {
    it('B cannot read A’s thread or A’s operation/result', async () => {
      await http().get(`/ask-v2/threads/${thread.a}`).set('Cookie', as('b')).expect(404);
      const r = await http().get(`/ask-v2/operations/${op.a}`).set('Cookie', as('b')).expect(404);
      expect(JSON.stringify(r.body)).not.toContain('CURRENT_REPORTING');
    });

    it('B cannot bookmark A’s turn — and it is indistinguishable from a nonexistent turn', async () => {
      const foreign = await http()
        .post('/ask-v2/bookmarks')
        .set('Cookie', as('b'))
        .set('x-csrf-token', 'csrf')
        .send({ turnId: turn.a });
      const missing = await http()
        .post('/ask-v2/bookmarks')
        .set('Cookie', as('b'))
        .set('x-csrf-token', 'csrf')
        .send({ turnId: randomUUID() });
      expect(foreign.status).toBe(404);
      expect(missing.status).toBe(404);
      expect(foreign.body).toEqual(missing.body);
      expect(await db.askBookmark.count({ where: { turnId: turn.a } })).toBe(0);
    });

    it('B cannot remove or infer A’s bookmark', async () => {
      await service.addBookmark(ids.a, turn.a);
      const removed = await http()
        .delete(`/ask-v2/bookmarks/${turn.a}`)
        .set('Cookie', as('b'))
        .set('x-csrf-token', 'csrf')
        .expect(200);
      const absent = await http()
        .delete(`/ask-v2/bookmarks/${randomUUID()}`)
        .set('Cookie', as('b'))
        .set('x-csrf-token', 'csrf')
        .expect(200);
      /* Same answer whether A saved it or nothing exists: nothing to infer. */
      expect(removed.body.removed).toBe(false);
      expect({ ...removed.body, turnId: 'x' }).toEqual({ ...absent.body, turnId: 'x' });
      expect(await db.askBookmark.count({ where: { userId: ids.a, turnId: turn.a } })).toBe(1);
      const listB = await http().get('/ask-v2/bookmarks').set('Cookie', as('b')).expect(200);
      expect(listB.body).toEqual([]);
      const threadsB = await http().get('/ask-v2/threads').set('Cookie', as('b')).expect(200);
      expect(JSON.stringify(threadsB.body)).not.toContain(thread.a);
    });
  });

  describe('signed out and CSRF', () => {
    it('signed-out list, bookmark and unbookmark are refused', async () => {
      await http().get('/ask-v2/bookmarks').expect(401);
      await http()
        .post('/ask-v2/bookmarks')
        .set('Cookie', [`${CSRF_COOKIE_NAME}=csrf`])
        .set('x-csrf-token', 'csrf')
        .send({ turnId: turn.a })
        .expect(401);
      await http()
        .delete(`/ask-v2/bookmarks/${turn.a}`)
        .set('Cookie', [`${CSRF_COOKIE_NAME}=csrf`])
        .set('x-csrf-token', 'csrf')
        .expect(401);
    });

    it('POST and DELETE without a valid CSRF token are refused and change nothing', async () => {
      await http()
        .post('/ask-v2/bookmarks')
        .set('Cookie', as('a'))
        .send({ turnId: turn.a })
        .expect(403);
      await http()
        .post('/ask-v2/bookmarks')
        .set('Cookie', as('a'))
        .set('x-csrf-token', 'wrong')
        .send({ turnId: turn.a })
        .expect(403);
      expect(await db.askBookmark.count({ where: { userId: ids.a } })).toBe(0);
      await service.addBookmark(ids.a, turn.a);
      await http().delete(`/ask-v2/bookmarks/${turn.a}`).set('Cookie', as('a')).expect(403);
      expect(await db.askBookmark.count({ where: { userId: ids.a } })).toBe(1);
    });
  });

  describe('owner path', () => {
    it('A bookmarks, lists (newest first, preview only) and removes their own turn', async () => {
      await http()
        .post('/ask-v2/bookmarks')
        .set('Cookie', as('a'))
        .set('x-csrf-token', 'csrf')
        .send({ turnId: turn.a })
        .expect(201);
      const list = await http().get('/ask-v2/bookmarks').set('Cookie', as('a')).expect(200);
      expect(list.body).toHaveLength(1);
      expect(list.body[0]).toMatchObject({
        turnId: turn.a,
        threadId: thread.a,
        operationId: op.a,
        question: 'What changed in Rwanda this week?',
      });
      expect(JSON.stringify(list.body)).not.toMatch(/payload|CURRENT_REPORTING/);
      await http()
        .delete(`/ask-v2/bookmarks/${turn.a}`)
        .set('Cookie', as('a'))
        .set('x-csrf-token', 'csrf')
        .expect(200);
      expect((await http().get('/ask-v2/bookmarks').set('Cookie', as('a'))).body).toEqual([]);
    });
  });

  describe('Save control relation — the operation read names the reader’s own turn', () => {
    it('getOperation returns turnId and a truthful bookmarked flag, owner-scoped, with zero compute', async () => {
      const before = await computeFootprint();
      const r1 = await http().get(`/ask-v2/operations/${op.a}`).set('Cookie', as('a')).expect(200);
      expect(r1.body).toMatchObject({ operationId: op.a, turnId: turn.a, bookmarked: false });
      await service.addBookmark(ids.a, turn.a);
      const r2 = await http().get(`/ask-v2/operations/${op.a}`).set('Cookie', as('a')).expect(200);
      expect(r2.body).toMatchObject({ turnId: turn.a, bookmarked: true });
      /* B saving nothing of A's, and B cannot read A's operation (so never A's turnId). */
      await http().get(`/ask-v2/operations/${op.a}`).set('Cookie', as('b')).expect(404);
      const rb = await http().get(`/ask-v2/operations/${op.b}`).set('Cookie', as('b')).expect(200);
      expect(rb.body).toMatchObject({ turnId: turn.b, bookmarked: false });
      expect(await computeFootprint()).toEqual(before);
    });
  });

  describe('zero compute — every continuity read/write', () => {
    it('Recent list, Saved list, reopen, bookmark, unbookmark: 0 plan · 0 execution · 0 new operations · 0 ledger · stored results untouched', async () => {
      await service.addBookmark(ids.a, turn.a);
      const before = await computeFootprint();
      await http().get('/ask-v2/threads').set('Cookie', as('a')).expect(200); // Recent
      await http().get('/ask-v2/bookmarks').set('Cookie', as('a')).expect(200); // Saved
      await http().get(`/ask-v2/threads/${thread.a}`).set('Cookie', as('a')).expect(200); // reopen Recent
      const reopened = await http()
        .get(`/ask-v2/operations/${op.a}`)
        .set('Cookie', as('a'))
        .expect(200); // reopen Saved
      await http()
        .delete(`/ask-v2/bookmarks/${turn.a}`)
        .set('Cookie', as('a'))
        .set('x-csrf-token', 'csrf')
        .expect(200);
      await http()
        .post('/ask-v2/bookmarks')
        .set('Cookie', as('a'))
        .set('x-csrf-token', 'csrf')
        .send({ turnId: turn.a })
        .expect(201);
      expect(await computeFootprint()).toEqual(before);
      /* Reopen reads the stored operation as it is — no silent refresh. */
      expect(reopened.body.status).toBe('COMPLETED');
      expect(reopened.body.result?.displayOnly).toBe(true);
    });
  });
});
