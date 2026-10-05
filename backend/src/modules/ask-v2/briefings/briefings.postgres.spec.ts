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
 * R2 · D1 — DURABLE BRIEFINGS against REAL PostgreSQL and the REAL HTTP surface.
 *
 * Proves: the gate (404 unless ASK_BRIEFINGS_ENABLED='true'); a version stores our structured
 * output + evidence REFERENCES only; reopening a version runs nothing (no plan, no execution, no
 * new stored result); versions are append-only and an older one discloses that it is superseded;
 * private (another reader's briefing and a missing one are the same 404; a foreign turn cannot be
 * saved); CSRF on mutations; explicit delete; account deletion cascades; the StoredResult can
 * expire and be deleted while the briefing stays readable.
 *
 * Runs on the dedicated loopback test cluster only (ask_v2_test or a trust_r2_* rehearsal DB).
 */
const url = process.env.ASK_V2_TEST_DATABASE_URL;
if (
  url &&
  !/^postgresql:\/\/askv2test@127\.0\.0\.1:\d+\/(?:ask_v2_test|trust_r2_[a-z0-9_]+)$/.test(url)
) {
  throw new Error('Briefing live tests require a dedicated loopback test database');
}
jest.setTimeout(60000);
const live = url ? describe : describe.skip;

const ARTICLE_TEXT_MARKER = 'FULL-ARTICLE-BODY-MUST-NOT-BE-STORED';

live('R2 · D1 durable briefings — live PostgreSQL, HTTP, privacy, zero AI on read', () => {
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
  const plan = (): AskPlan => ({
    revision: 'rev-1',
    scope: 'scope:KE:7d',
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
  let summary = 'Kenya held its policy rate; Tanzania cut [1][2].';
  /* EAST AFRICA P0 · A — the governed specialist basis the answer was built on. */
  let intelligence: unknown = null;
  const payload = () => ({
    schema: 'ask-r2-result/1',
    answer: { state: 'CURRENT_REPORTING' },
    checkedAt: new Date().toISOString(),
    analysis: {
      articles: [{ id: 'a1', content: ARTICLE_TEXT_MARKER }],
      analysis: {
        summary,
        keyFacts: [{ claim: 'Kenya held at 9.5%', sourceArticleIds: ['a1'] }],
        agreements: [{ point: 'Both cite inflation', sourceArticleIds: ['a1', 'a2'] }],
        differences: [
          {
            topic: 'Policy rate',
            positions: [{ description: 'Tanzania cut by 25bp', sourceArticleIds: ['a2'] }],
          },
        ],
        unknowns: ['No official statement from Uganda'],
        sources: [
          {
            articleId: 'a1',
            publisher: 'Pub One',
            title: 'Kenya holds rate',
            url: 'https://one.example/k',
            publishedAt: '2026-10-01T08:00:00Z',
          },
          {
            articleId: 'a2',
            publisher: 'Pub Two',
            title: 'Tanzania cuts',
            url: 'https://two.example/t',
            publishedAt: '2026-10-02T08:00:00Z',
          },
        ],
      },
    },
    background: null,
    intelligence,
  });
  const http = () => request(app.getHttpServer());
  const as = (who: 'a' | 'b') => [`${SESSION_COOKIE_NAME}=${who}`, `${CSRF_COOKIE_NAME}=csrf`];

  async function completedTurn(userId: string, question: string) {
    const t = await service.createThread(accountPrincipal(userId), {
      idempotencyKey: randomUUID(),
      language: 'en',
    });
    const q = await service.quote(accountPrincipal(userId), t.id, {
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
    const rows = await db.askTurn.findMany({
      where: { threadId: t.id },
      orderBy: { sequence: 'desc' },
    });
    return rows[0].id;
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
    summary = 'Kenya held its policy rate; Tanzania cut [1][2].';
    intelligence = null;
    prepare.mockReset();
    execute.mockReset();
    prepare.mockImplementation(async () => plan());
    execute.mockImplementation(async () => ({
      succeeded: true,
      payloadJson: JSON.stringify(payload()),
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
  });
  afterEach(async () => {
    await db.user.deleteMany({ where: { id: { in: [ids.a, ids.b] } } });
  });
  afterAll(async () => {
    await app?.close();
    await db?.$disconnect();
  });

  function save(who: 'a' | 'b', turnId: string) {
    return http()
      .post('/ask-v2/briefings')
      .set('Cookie', as(who))
      .set('x-csrf-token', 'csrf')
      .send({ turnId, title: 'East Africa rates', countryCode: 'ken' });
  }

  it('is a bare 404 unless ASK_BRIEFINGS_ENABLED is exactly "true"', async () => {
    for (const value of [undefined, 'false', 'TRUE', '1', '']) {
      configValues.ASK_BRIEFINGS_ENABLED = value as string;
      if (value === undefined) delete configValues.ASK_BRIEFINGS_ENABLED;
      await http().get('/ask-v2/briefings').set('Cookie', as('a')).expect(404);
    }
  });

  it('saves version 1: our output and evidence references only, never article text', async () => {
    const turnId = await completedTurn(ids.a, 'Compare Kenya and Tanzania interest rates');
    const res = await save('a', turnId).expect(201);
    expect(res.body).toMatchObject({ title: 'East Africa rates', version: 1 });
    const v = await db.briefingVersion.findFirstOrThrow({
      where: { briefing: { id: res.body.id } },
    });
    expect(JSON.stringify(v)).not.toContain(ARTICLE_TEXT_MARKER);
    expect(v.evidenceRefs).toEqual([
      expect.objectContaining({ id: 'a1', host: 'one.example', url: 'https://one.example/k' }),
      expect.objectContaining({ id: 'a2', host: 'two.example' }),
    ]);
    expect(
      (v.blocks as { comparisonTable: { rows: unknown[] } }).comparisonTable.rows,
    ).toHaveLength(2);
    expect(v.coverageGaps).toEqual(['No official statement from Uganda']);
    const b = await db.briefing.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(b.scope).toMatchObject({ kind: 'ASK_QUESTION', countryCode: 'KEN', language: 'en' });
  });

  it('EAST AFRICA P0 · A — the specialist intelligence basis survives save → reload → reopen', async () => {
    const SPECIALIST = {
      considered: ['ECONOMY_CPI', 'CONFLICT'],
      contributions: [
        {
          contributorId: 'ECONOMY_CPI',
          domain: 'economic',
          status: 'USED',
          applicability: 'SUPPLEMENTARY',
          observations: [
            {
              reference: 'NISR:CPI:2026-08',
              kind: 'CPI_HEADLINE',
              label: 'Urban CPI, year on year',
              value: '6.1',
              unit: '%',
              period: '2026-08',
              geography: 'RWA',
              source: { name: 'NISR', url: 'https://statistics.gov.rw/cpi', licence: null },
              retainedAt: '2026-09-12T06:00:00Z',
            },
          ],
          temporalBasis: 'RETAINED_PERIODIC',
          geographyBasis: 'RWA',
          disclosures: ['RETAINED_NOT_CURRENT'],
          degradationReason: null,
        },
        {
          contributorId: 'CONFLICT',
          domain: 'security',
          status: 'NO_MATCH',
          applicability: 'CONTEXT',
          observations: [],
          temporalBasis: 'NONE',
          geographyBasis: 'RWA',
          disclosures: [],
          degradationReason: null,
        },
      ],
    };
    intelligence = SPECIALIST;
    const turnId = await completedTurn(ids.a, 'How is inflation in Rwanda affecting traders?');
    const { body } = await save('a', turnId).expect(201);
    const before = { prepare: prepare.mock.calls.length, execute: execute.mock.calls.length };
    // Reopen after the source result is gone: only the saved snapshot can answer.
    await db.storedResult.deleteMany({ where: { userId: ids.a } });
    const v = await http()
      .get(`/ask-v2/briefings/${body.id}/versions/1`)
      .set('Cookie', as('a'))
      .expect(200);
    expect(v.body.blocks.intelligence).toEqual(SPECIALIST);
    // Reporting citations are kept beside it, unchanged.
    expect(v.body.evidenceRefs.map((r: { id: string }) => r.id)).toEqual(['a1', 'a2']);
    // Reopening ran nothing: no plan, no execution, no provider, no recompute.
    expect(v.body.aiExecuted).toBe(false);
    expect(prepare.mock.calls.length).toBe(before.prepare);
    expect(execute.mock.calls.length).toBe(before.execute);
    const again = await http()
      .get(`/ask-v2/briefings/${body.id}/versions/1`)
      .set('Cookie', as('a'))
      .expect(200);
    expect(again.body.blocks).toEqual(v.body.blocks);
  });

  it('EAST AFRICA P0 · A — a reporting-only briefing records that no specialist was used', async () => {
    const turnId = await completedTurn(ids.a, 'Compare Kenya and Tanzania interest rates');
    const { body } = await save('a', turnId).expect(201);
    const v = await http()
      .get(`/ask-v2/briefings/${body.id}/versions/1`)
      .set('Cookie', as('a'))
      .expect(200);
    expect(v.body.blocks).toHaveProperty('intelligence', null);
    expect(v.body.evidenceRefs).toHaveLength(2);
  });

  it('reopening a version runs nothing and survives the StoredResult being deleted', async () => {
    const turnId = await completedTurn(ids.a, 'Compare Kenya and Tanzania interest rates');
    const { body } = await save('a', turnId).expect(201);
    const before = {
      prepare: prepare.mock.calls.length,
      execute: execute.mock.calls.length,
      results: await db.storedResult.count({ where: { userId: ids.a } }),
    };
    await db.storedResult.deleteMany({ where: { userId: ids.a } });
    const v = await http()
      .get(`/ask-v2/briefings/${body.id}/versions/1`)
      .set('Cookie', as('a'))
      .expect(200);
    expect(v.body).toMatchObject({ version: 1, aiExecuted: false, supersededBy: null });
    expect(v.body.blocks.summary).toContain('Kenya held');
    expect(prepare.mock.calls.length).toBe(before.prepare);
    expect(execute.mock.calls.length).toBe(before.execute);
  });

  it('a later version is appended; the old one is unchanged and says it is superseded', async () => {
    const t1 = await completedTurn(ids.a, 'Compare Kenya and Tanzania interest rates');
    const { body } = await save('a', t1).expect(201);
    summary = 'UPDATED: Kenya now cut as well [1].';
    const t2 = await completedTurn(ids.a, 'What changed since then for Kenya rates?');
    const added = await http()
      .post(`/ask-v2/briefings/${body.id}/versions`)
      .set('Cookie', as('a'))
      .set('x-csrf-token', 'csrf')
      .send({ turnId: t2 })
      .expect(201);
    expect(added.body.version).toBe(2);
    const v1 = await http()
      .get(`/ask-v2/briefings/${body.id}/versions/1`)
      .set('Cookie', as('a'))
      .expect(200);
    expect(v1.body.blocks.summary).toContain('Kenya held');
    expect(v1.body.supersededBy).toBe(2);
    const v2 = await http()
      .get(`/ask-v2/briefings/${body.id}/versions/2`)
      .set('Cookie', as('a'))
      .expect(200);
    expect(v2.body.blocks.summary).toContain('UPDATED');
    expect(new Date(v2.body.windowFrom).getTime()).toBe(new Date(v1.body.asOf).getTime());
  });

  it('is private: foreign and missing briefings are the same 404; a foreign turn cannot be saved', async () => {
    const turnA = await completedTurn(ids.a, 'Compare Kenya and Tanzania interest rates');
    const { body } = await save('a', turnA).expect(201);
    const foreign = await http().get(`/ask-v2/briefings/${body.id}`).set('Cookie', as('b'));
    const missing = await http().get(`/ask-v2/briefings/${randomUUID()}`).set('Cookie', as('b'));
    expect(foreign.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(foreign.body).toEqual(missing.body);
    await http().get(`/ask-v2/briefings/${body.id}/versions/1`).set('Cookie', as('b')).expect(404);
    await save('b', turnA).expect(404);
    expect((await http().get('/ask-v2/briefings').set('Cookie', as('b')).expect(200)).body).toEqual(
      [],
    );
    const del = await http()
      .delete(`/ask-v2/briefings/${body.id}`)
      .set('Cookie', as('b'))
      .set('x-csrf-token', 'csrf')
      .expect(200);
    expect(del.body.removed).toBe(false);
    expect(await db.briefing.count({ where: { id: body.id } })).toBe(1);
  });

  it('mutations require CSRF; signed-out is refused', async () => {
    const turnId = await completedTurn(ids.a, 'Compare Kenya and Tanzania interest rates');
    await http().post('/ask-v2/briefings').set('Cookie', as('a')).send({ turnId }).expect(403);
    await http().get('/ask-v2/briefings').expect(401);
  });

  it('explicit delete removes the briefing and its versions; account deletion cascades', async () => {
    const t1 = await completedTurn(ids.a, 'Compare Kenya and Tanzania interest rates');
    const one = (await save('a', t1).expect(201)).body;
    const two = (await save('a', t1).expect(201)).body;
    await http()
      .delete(`/ask-v2/briefings/${one.id}`)
      .set('Cookie', as('a'))
      .set('x-csrf-token', 'csrf')
      .expect(200);
    expect(await db.briefingVersion.count({ where: { briefingId: one.id } })).toBe(0);
    await db.user.delete({ where: { id: ids.a } });
    expect(await db.briefing.count({ where: { id: two.id } })).toBe(0);
    expect(await db.briefingVersion.count({ where: { briefingId: two.id } })).toBe(0);
  });

  it('the database refuses an ungoverned status or version', async () => {
    const turnId = await completedTurn(ids.a, 'Compare Kenya and Tanzania interest rates');
    const { body } = await save('a', turnId).expect(201);
    await expect(
      db.briefing.update({ where: { id: body.id }, data: { status: 'SHARED' } }),
    ).rejects.toThrow();
    await expect(
      db.briefingVersion.create({
        data: {
          briefingId: body.id,
          version: 0,
          asOf: new Date(),
          blocks: {},
          evidenceRefs: [],
          evidenceRevision: 'x',
          coverageGaps: [],
        },
      }),
    ).rejects.toThrow();
  });
});
