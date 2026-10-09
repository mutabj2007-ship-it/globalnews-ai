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
import { SESSION_COOKIE_NAME, CSRF_COOKIE_NAME } from '../../auth/cookie.util';
import { AskV2Module } from '../ask-v2.module';
import { AskV2Service } from '../ask-v2.service';
import { accountPrincipal } from '../guest/ask-principal';
import { ASK_EXECUTION_PORT, AskPlan, AskRequest, ExecutionResult } from '../ask-compute.contract';

/**
 * REASON TO RETURN R1 — FOLLOWED QUESTIONS (§8 / G8 / G9) and CONVERSATION DELETE + SEARCH
 * (§7 / G7), against REAL PostgreSQL and the REAL HTTP surface.
 *
 * A check is an ordinary Ask turn (the port below stands in for the engine, so no provider or
 * model is reached); recording it runs nothing. Proves: follow → manual checks → versions only
 * on a usable changed reading; a failed check keeps the baseline; repeated checks; pause/edit;
 * idempotency; mismatched or stale turns refused; two-account isolation; thread delete removes
 * every private copy and refuses an in-flight thread; history search spans every turn.
 */
const url = process.env.ASK_V2_TEST_DATABASE_URL;
if (
  url &&
  !/^postgresql:\/\/askv2test@127\.0\.0\.1:\d+\/(?:ask_v2_test|trust_r2_[a-z0-9_]+)$/.test(url)
) {
  throw new Error('Followed-question live tests require a dedicated loopback test database');
}
jest.setTimeout(60000);
const live = url ? describe : describe.skip;

const QUESTION = 'What is happening with fuel prices in Kenya?';

interface Src {
  id: string;
  title?: string;
  publishedAt: string | null;
}

live('REASON TO RETURN R1 — followed questions + conversation delete/search (live PG, HTTP)', () => {
  let db: PrismaClient;
  let app: INestApplication;
  let service: AskV2Service;
  let configValues: Record<string, string> = {};
  const ids = { a: '', b: '' };
  const prepare = jest.fn<Promise<AskPlan>, [Readonly<AskRequest>]>();
  const execute = jest.fn<
    Promise<ExecutionResult>,
    [Readonly<AskRequest>, Readonly<AskPlan>, string]
  >();
  /* each turn plans a distinct execution so a check is never served the earlier stored result */
  const plan = (): AskPlan => ({
    revision: 'rev-1',
    scope: 'scope:KE:7d',
    contract: 'qual-v1',
    executionKey: `planned-${randomUUID()}`,
    validUntil: new Date(Date.now() + 3600000).toISOString(),
    contextual: false,
    deepRequested: false,
    reportRequested: false,
    countryCount: 1,
    domainCount: 1,
    timeWindowDays: 7,
  });

  /* what the next execution returns */
  let sources: Src[] = [];
  let facts: { claim: string; sourceArticleIds: string[] }[] = [];
  let failed = false;
  let answerState = 'CURRENT_REPORTING';
  /* CTO R1-B §3 — the governed specialist basis, exactly as the coordinator writes payload.intelligence */
  let intelligence: unknown = null;
  const conflictObs = (reference: string, over: Record<string, unknown> = {}) => ({
    reference,
    kind: 'UCDP_STATE_BASED',
    label: `Event ${reference}`,
    value: '3',
    unit: 'best-estimate fatalities',
    period: '2026-08-20',
    geography: 'COD',
    source: { name: 'UCDP GED candidate', url: 'https://ucdp.uu.se/', licence: null },
    retainedAt: '2026-09-24T00:00:00.000Z',
    ...over,
  });
  const conflictIntel = (status: string, observations: unknown[]) => ({
    considered: ['CONFLICT'],
    contributions: [
      {
        contributorId: 'CONFLICT',
        domain: 'security',
        status,
        applicability: 'SUPPLEMENTARY',
        observations,
        temporalBasis: 'RETAINED_EVENT_RECORD',
        geographyBasis: 'COD',
        disclosures: ['RETAINED_NOT_CURRENT'],
        degradationReason: status === 'DEGRADED' ? 'TIMEOUT' : null,
      },
    ],
  });
  const payload = () => ({
    schema: 'ask-r2-result/1',
    answer: { state: answerState },
    checkedAt: new Date().toISOString(),
    analysis: {
      retrievalContext: failed
        ? { dataMode: 'unavailable', providers: [], providerFailures: [{ providerId: 'gnews', kind: 'TIMEOUT' }] }
        : { dataMode: 'live', providers: ['gnews'] },
      analysis:
        sources.length === 0
          ? { summary: '', keyFacts: [], sources: [], unknowns: [] }
          : {
              summary: 'Fuel prices in Kenya [1].',
              keyFacts: facts,
              unknowns: [],
              sources: sources.map((s) => ({
                articleId: s.id,
                publisher: 'Pub',
                title: s.title ?? `Fuel report ${s.id}`,
                url: `https://news.example/${s.id}`,
                publishedAt: s.publishedAt,
              })),
            },
    },
    background: null,
    intelligence,
  });

  const http = () => request(app.getHttpServer());
  const as = (who: 'a' | 'b') => [`${SESSION_COOKIE_NAME}=${who}`, `${CSRF_COOKIE_NAME}=csrf`];
  const post = (who: 'a' | 'b', path: string, body: object) =>
    http().post(path).set('Cookie', as(who)).set('x-csrf-token', 'csrf').send(body);
  const patch = (who: 'a' | 'b', path: string, body: object) =>
    http().patch(path).set('Cookie', as(who)).set('x-csrf-token', 'csrf').send(body);

  async function turnIn(userId: string, question: string, threadId?: string) {
    const t =
      threadId ??
      (
        await service.createThread(accountPrincipal(userId), {
          idempotencyKey: randomUUID(),
          language: 'en',
        })
      ).id;
    const q = await service.quote(accountPrincipal(userId), t, {
      idempotencyKey: randomUUID(),
      question,
      language: 'en',
      intent: 'ask',
    });
    if (q.status !== 'COMPLETED') {
      await service.accept(accountPrincipal(userId), q.operationId);
      await service.reserve(accountPrincipal(userId), q.operationId);
      await service.execute(accountPrincipal(userId), q.operationId);
    }
    const rows = await db.askTurn.findMany({ where: { threadId: t }, orderBy: { sequence: 'desc' } });
    return { turnId: rows[0].id, threadId: t, operationId: q.operationId };
  }

  async function follow(who: 'a' | 'b') {
    const { turnId } = await turnIn(ids[who], QUESTION);
    const res = await post(who, '/ask-v2/briefings', { turnId });
    expect(res.status).toBe(201);
    return res.body.id as string;
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
      ASK_BRIEFINGS_ENABLED: 'true',
      SAND_LEDGER_ENABLED: 'true',
      SAND_CHARGING_ENABLED: 'false',
    };
    sources = [{ id: 'a1', publishedAt: '2026-10-01T08:00:00Z' }];
    facts = [{ claim: 'Pump prices held in September', sourceArticleIds: ['a1'] }];
    failed = false;
    answerState = 'CURRENT_REPORTING';
    intelligence = null;
    prepare.mockReset();
    execute.mockReset();
    prepare.mockImplementation(async () => plan());
    execute.mockImplementation(async () => ({
      succeeded: true,
      payloadJson: JSON.stringify(payload()),
      evidenceRevision: 'rev-1',
      validUntil: new Date(Date.now() + 3600000).toISOString(),
    }));
    ids.a = randomUUID();
    ids.b = randomUUID();
    await db.user.createMany({
      data: [
        { id: ids.a, email: `a-${ids.a}@example.invalid` },
        { id: ids.b, email: `b-${ids.b}@example.invalid` },
      ],
    });
  });
  afterEach(async () => {
    await db.user.deleteMany({ where: { id: { in: [ids.a, ids.b] } } });
  });
  afterAll(async () => {
    await app?.close();
    await db?.$disconnect();
  });

  it('follow → unchanged check → new-evidence check → failed check keeps the baseline', async () => {
    const id = await follow('a');

    /* 1 · same evidence: recorded, no new version */
    const same = await turnIn(ids.a, QUESTION);
    const c1 = await post('a', `/ask-v2/briefings/${id}/checks`, { turnId: same.turnId }).expect(201);
    expect(c1.body).toMatchObject({ outcome: 'UNCHANGED', baselineVersion: 1, resultingVersion: null, aiExecuted: false });

    /* 2 · a report published after the baseline + a key point citing it */
    sources = [
      { id: 'a1', publishedAt: '2026-10-01T08:00:00Z' },
      { id: 'n1', publishedAt: new Date(Date.now() + 60_000).toISOString() },
    ];
    facts = [{ claim: 'Regulator raised pump prices by 4%', sourceArticleIds: ['n1'] }];
    const fresh = await turnIn(ids.a, QUESTION);
    const c2 = await post('a', `/ask-v2/briefings/${id}/checks`, { turnId: fresh.turnId }).expect(201);
    expect(c2.body).toMatchObject({ outcome: 'MATERIAL_CHANGE', baselineVersion: 1, resultingVersion: 2 });
    expect(c2.body.assessment.supportedChanges).toEqual([
      { claim: 'Regulator raised pump prices by 4%', sourceArticleIds: ['n1'] },
    ]);

    /* 3 · the search fails: recorded as incomplete, version 2 stays the baseline */
    failed = true;
    sources = [];
    facts = [];
    const broken = await turnIn(ids.a, QUESTION);
    const c3 = await post('a', `/ask-v2/briefings/${id}/checks`, { turnId: broken.turnId }).expect(201);
    expect(c3.body).toMatchObject({ outcome: 'INCOMPLETE_CHECK', baselineVersion: 2, resultingVersion: null });
    const versions = await db.briefingVersion.findMany({ where: { briefingId: id }, orderBy: { version: 'asc' } });
    expect(versions.map((v) => v.version)).toEqual([1, 2]);

    /* My updates row: latest check is the incomplete one; the last SUCCESSFUL check is #2 */
    const list = await http().get('/ask-v2/briefings').set('Cookie', as('a')).expect(200);
    expect(list.body[0]).toMatchObject({ id, latestVersion: 2, latestCheck: { outcome: 'INCOMPLETE_CHECK' } });
    expect(new Date(list.body[0].lastSuccessfulCheckAt).getTime()).toBe(new Date(c2.body.checkedAt).getTime());

    /* detail view: every check, newest first, with its outcome */
    const detail = await http().get(`/ask-v2/briefings/${id}`).set('Cookie', as('a')).expect(200);
    expect(detail.body.checks.map((c: { outcome: string }) => c.outcome)).toEqual([
      'INCOMPLETE_CHECK',
      'MATERIAL_CHANGE',
      'UNCHANGED',
    ]);
  });

  it('recording the same check twice returns the first record (no duplicate, no second version)', async () => {
    const id = await follow('a');
    sources = [{ id: 'n2', publishedAt: new Date(Date.now() + 60_000).toISOString() }];
    const t = await turnIn(ids.a, QUESTION);
    const first = await post('a', `/ask-v2/briefings/${id}/checks`, { turnId: t.turnId }).expect(201);
    const again = await post('a', `/ask-v2/briefings/${id}/checks`, { turnId: t.turnId }).expect(201);
    expect(again.body.id).toBe(first.body.id);
    expect(await db.briefingCheck.count({ where: { briefingId: id } })).toBe(1);
    expect(await db.briefingVersion.count({ where: { briefingId: id } })).toBe(2);
  });

  it('refuses a turn that asks a different question, or that predates the baseline', async () => {
    const early = await turnIn(ids.a, QUESTION);
    const id = await follow('a');
    const other = await turnIn(ids.a, 'What is happening with maize prices in Uganda?');
    await post('a', `/ask-v2/briefings/${id}/checks`, { turnId: other.turnId })
      .expect(422)
      .expect((r) => expect(r.body.code).toBe('BRIEFING_CHECK_QUESTION_MISMATCH'));
    await post('a', `/ask-v2/briefings/${id}/checks`, { turnId: early.turnId })
      .expect(422)
      .expect((r) => expect(r.body.code).toBe('BRIEFING_CHECK_TURN_NOT_NEWER'));
  });

  it('pause blocks checks; resume allows them; editing the question restarts comparability', async () => {
    const id = await follow('a');
    await patch('a', `/ask-v2/briefings/${id}`, { status: 'PAUSED' }).expect(200);
    const t = await turnIn(ids.a, QUESTION);
    await post('a', `/ask-v2/briefings/${id}/checks`, { turnId: t.turnId })
      .expect(409)
      .expect((r) => expect(r.body.code).toBe('BRIEFING_NOT_ACTIVE'));
    await patch('a', `/ask-v2/briefings/${id}`, { status: 'ACTIVE' }).expect(200);

    const edited = 'What is happening with diesel prices in Kenya?';
    const e = await patch('a', `/ask-v2/briefings/${id}`, { question: edited, title: 'Diesel' }).expect(200);
    expect(e.body.scope).toMatchObject({ question: edited, scopeRevision: 1 });
    sources = [{ id: 'n3', publishedAt: new Date(Date.now() + 60_000).toISOString() }];
    const after = await turnIn(ids.a, edited);
    const c = await post('a', `/ask-v2/briefings/${id}/checks`, { turnId: after.turnId }).expect(201);
    expect(c.body.outcome).toBe('INSUFFICIENT_BASELINE');
    expect(c.body.assessment.reasons[0]).toBe('QUESTION_EDITED_SINCE_BASELINE');
    expect(c.body.resultingVersion).toBe(2);
  });

  it('two-account isolation: B cannot read, check, edit or delete A\'s followed question', async () => {
    const id = await follow('a');
    const bTurn = await turnIn(ids.b, QUESTION);
    await http().get(`/ask-v2/briefings/${id}`).set('Cookie', as('b')).expect(404);
    await post('b', `/ask-v2/briefings/${id}/checks`, { turnId: bTurn.turnId }).expect(404);
    await patch('b', `/ask-v2/briefings/${id}`, { status: 'PAUSED' }).expect(404);
    await http().delete(`/ask-v2/briefings/${id}`).set('Cookie', as('b')).set('x-csrf-token', 'csrf').expect(200);
    expect(await db.briefing.count({ where: { id } })).toBe(1);
    /* and A cannot record a check from B's turn */
    await post('a', `/ask-v2/briefings/${id}/checks`, { turnId: bTurn.turnId }).expect(404);
    const listB = await http().get('/ask-v2/briefings').set('Cookie', as('b')).expect(200);
    expect(listB.body).toEqual([]);
  });

  it('mutations need CSRF and a session', async () => {
    const id = await follow('a');
    await http().patch(`/ask-v2/briefings/${id}`).set('Cookie', as('a')).send({ status: 'PAUSED' }).expect(403);
    await http().post(`/ask-v2/briefings/${id}/checks`).send({ turnId: randomUUID() }).expect(401);
  });

  describe('CTO R1-B §3 — governed specialist records, through the real recording path', () => {
    it('A · a new Conflict record with no new news is a MATERIAL_CHANGE, versioned; a degraded reader then keeps the baseline', async () => {
      intelligence = conflictIntel('USED', [conflictObs('ucdp:1')]);
      const id = await follow('a');
      const v1 = await db.briefingVersion.findFirstOrThrow({ where: { briefingId: id, version: 1 } });
      /* C-2: the followed question's stored version carries payload.intelligence */
      expect((v1.blocks as { intelligence?: unknown }).intelligence).toEqual(intelligence);

      intelligence = conflictIntel('USED', [
        conflictObs('ucdp:1'),
        conflictObs('ucdp:2', { period: '2099-01-02', retainedAt: '2099-01-03T00:00:00.000Z' }),
      ]);
      const t1 = await turnIn(ids.a, QUESTION);
      const c1 = await post('a', `/ask-v2/briefings/${id}/checks`, { turnId: t1.turnId }).expect(201);
      expect(c1.body).toMatchObject({ outcome: 'MATERIAL_CHANGE', resultingVersion: 2 });
      expect(c1.body.assessment.structured.newEvents.map((r: { reference: string }) => r.reference)).toEqual(['ucdp:2']);

      intelligence = conflictIntel('DEGRADED', []);
      const t2 = await turnIn(ids.a, QUESTION);
      const c2 = await post('a', `/ask-v2/briefings/${id}/checks`, { turnId: t2.turnId }).expect(201);
      expect(c2.body).toMatchObject({ outcome: 'INCOMPLETE_CHECK', resultingVersion: null, baselineVersion: 2 });
      expect(c2.body.assessment.structured.unassessed).toEqual(['CONFLICT:COD:DEGRADED']);
      expect(await db.briefingVersion.count({ where: { briefingId: id } })).toBe(2);
      const list = await http().get('/ask-v2/briefings').set('Cookie', as('a')).expect(200);
      expect(list.body[0].latestCheck).toMatchObject({
        outcome: 'INCOMPLETE_CHECK',
        partial: true,
        structuredUnassessed: ['CONFLICT:COD:DEGRADED'],
      });
    });

    it('H · two accounts follow similar questions: no check state or specialist evidence crosses between them', async () => {
      intelligence = conflictIntel('USED', [conflictObs('ucdp:1')]);
      const idA = await follow('a');
      intelligence = conflictIntel('USED', [conflictObs('ucdp:B-only', { label: 'B PRIVATE RECORD' })]);
      const idB = await follow('b');
      intelligence = conflictIntel('USED', [conflictObs('ucdp:1')]);
      const tA = await turnIn(ids.a, QUESTION);
      const cA = await post('a', `/ask-v2/briefings/${idA}/checks`, { turnId: tA.turnId }).expect(201);
      expect(cA.body.outcome).toBe('UNCHANGED');
      expect(JSON.stringify(cA.body)).not.toContain('B PRIVATE RECORD');
      /* A can neither read B's followed question nor record a check against it */
      await http().get(`/ask-v2/briefings/${idB}`).set('Cookie', as('a')).expect(404);
      await post('a', `/ask-v2/briefings/${idB}/checks`, { turnId: tA.turnId }).expect(404);
      const listA = await http().get('/ask-v2/briefings').set('Cookie', as('a')).expect(200);
      expect(listA.body.map((r: { id: string }) => r.id)).toEqual([idA]);
      expect(await db.briefingCheck.count({ where: { briefingId: idB } })).toBe(0);
    });
  });

  describe('§7 / G7 — one conversation deleted, and history search', () => {
    it('delete removes thread, turns, bookmarks, operations and stored results — owner only', async () => {
      const t = await turnIn(ids.a, 'Explain how the Northern Corridor works');
      await post('a', '/ask-v2/bookmarks', { turnId: t.turnId }).expect(201);
      const op = await db.computeOperation.findUniqueOrThrow({ where: { id: t.operationId } });

      await http().delete(`/ask-v2/threads/${t.threadId}`).set('Cookie', as('b')).set('x-csrf-token', 'csrf').expect(404);
      await http().delete(`/ask-v2/threads/${t.threadId}`).set('Cookie', as('a')).expect(403);
      const res = await http()
        .delete(`/ask-v2/threads/${t.threadId}`)
        .set('Cookie', as('a'))
        .set('x-csrf-token', 'csrf')
        .expect(200);
      expect(res.body).toEqual({ id: t.threadId, removed: true });

      expect(await db.askThread.count({ where: { id: t.threadId } })).toBe(0);
      expect(await db.askTurn.count({ where: { threadId: t.threadId } })).toBe(0);
      expect(await db.askBookmark.count({ where: { userId: ids.a } })).toBe(0);
      expect(await db.computeOperation.count({ where: { id: t.operationId } })).toBe(0);
      if (op.storedResultId) {
        expect(await db.storedResult.count({ where: { id: op.storedResultId } })).toBe(0);
      }
      /* reopening the deleted answer is a bare 404 */
      await http().get(`/ask-v2/operations/${t.operationId}`).set('Cookie', as('a')).expect(404);
      await http().get(`/ask-v2/threads/${t.threadId}`).set('Cookie', as('a')).expect(404);
    });

    it('a followed question survives deleting the conversation it came from', async () => {
      const id = await follow('a');
      const threads = await db.askThread.findMany({ where: { userId: ids.a } });
      for (const th of threads) {
        await http().delete(`/ask-v2/threads/${th.id}`).set('Cookie', as('a')).set('x-csrf-token', 'csrf').expect(200);
      }
      const v1 = await http().get(`/ask-v2/briefings/${id}/versions/1`).set('Cookie', as('a')).expect(200);
      expect(v1.body.evidenceRefs.map((r: { id: string }) => r.id)).toEqual(['a1']);
    });

    it('an in-flight thread is refused, not deleted underneath its execution', async () => {
      const t = await service.createThread(accountPrincipal(ids.a), { idempotencyKey: randomUUID(), language: 'en' });
      const q = await service.quote(accountPrincipal(ids.a), t.id, {
        idempotencyKey: randomUUID(),
        question: 'Explain inflation simply',
        language: 'en',
        intent: 'ask',
      });
      await service.accept(accountPrincipal(ids.a), q.operationId);
      /* reserved = the execution may start at any moment: the thread must not vanish under it */
      await service.reserve(accountPrincipal(ids.a), q.operationId);
      await http()
        .delete(`/ask-v2/threads/${t.id}`)
        .set('Cookie', as('a'))
        .set('x-csrf-token', 'csrf')
        .expect(409)
        .expect((r) => expect(r.body.code).toBe('ASK_THREAD_BUSY'));
      expect(await db.askThread.count({ where: { id: t.id } })).toBe(1);
    });

    it('search matches ANY turn of the reader\'s own threads, case-insensitively, never another reader\'s', async () => {
      const first = await turnIn(ids.a, 'Explain the shilling exchange rate');
      await turnIn(ids.a, 'And what about Mombasa port congestion?', first.threadId);
      await turnIn(ids.a, 'Explain photosynthesis');
      await turnIn(ids.b, 'Mombasa port congestion today');

      const hit = await http().get('/ask-v2/threads?q=mombasa').set('Cookie', as('a')).expect(200);
      expect(hit.body.map((t: { id: string }) => t.id)).toEqual([first.threadId]);
      const none = await http().get('/ask-v2/threads?q=volcano').set('Cookie', as('a')).expect(200);
      expect(none.body).toEqual([]);
      const all = await http().get('/ask-v2/threads').set('Cookie', as('a')).expect(200);
      expect(all.body).toHaveLength(2);
    });
  });
});
