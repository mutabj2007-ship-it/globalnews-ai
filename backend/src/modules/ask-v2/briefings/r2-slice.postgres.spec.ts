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
import { computeArticleRef } from '../../news/identity/article-ref.util';
import { StoryIdentityService } from '../../stories/story-identity.service';
import { AlertsService } from '../../stories/alerts.service';
import { AskV2Module } from '../ask-v2.module';
import { AskV2Service } from '../ask-v2.service';
import { accountPrincipal } from '../guest/ask-principal';
import { ASK_EXECUTION_PORT, AskPlan, AskRequest, ExecutionResult } from '../ask-compute.contract';

/**
 * R2-S1 — THE FIRST END-TO-END SLICE, on real PostgreSQL (CTO checkpoint 3 ruling §11/§20.12):
 *
 *   question → evidence-linked comparison table → saved briefing (v1) → explicit follow
 *   (a Story Alert on the briefing's canonical story — option B, the narrower pilot "follow")
 *   → one real material update (a report from a NEW host proven to join; Story.briefVersion 1→2)
 *   → the alert names what changed AND the briefing reports the update
 *   → the update's Ask turn → briefing v2; v1 unchanged and marked superseded.
 *
 * Model execution is the test port (no provider, no AI); everything else is the real code path:
 * Stage-B story identity and alerts, the Ask V2 HTTP surface, the read-time table projection,
 * and the briefing service. NOT measured here: the frontend's "Ask about this update" draft
 * (askAlertWhatChanged/AlertsCentre specs) and live retrieval quality (Alpha, PO rows).
 */
const url = process.env.ASK_V2_TEST_DATABASE_URL;
if (
  url &&
  !/^postgresql:\/\/askv2test@127\.0\.0\.1:\d+\/(?:ask_v2_test|trust_r2_[a-z0-9_]+)$/.test(url)
) {
  throw new Error('R2 slice live tests require a dedicated loopback test database');
}
jest.setTimeout(90000);
const live = url ? describe : describe.skip;

live('R2-S1 end-to-end slice — live PostgreSQL', () => {
  let db: PrismaClient;
  let app: INestApplication;
  let ask: AskV2Service;
  let identity: StoryIdentityService;
  let alerts: AlertsService;
  const stamp = randomUUID().slice(0, 8);
  let reader = '';
  const execute = jest.fn<
    Promise<ExecutionResult>,
    [Readonly<AskRequest>, Readonly<AskPlan>, string]
  >();
  const plan = (): AskPlan => ({
    revision: `rev-${stamp}`,
    scope: 'scope:KE:7d',
    contract: 'qual-v1',
    executionKey: 'planned-ask',
    validUntil: new Date(Date.now() + 3600000).toISOString(),
    contextual: false,
    deepRequested: false,
    reportRequested: false,
    countryCount: 2,
    domainCount: 1,
    timeWindowDays: 7,
  });
  const http = () => request(app.getHttpServer());
  const cookie = () => [`${SESSION_COOKIE_NAME}=r`, `${CSRF_COOKIE_NAME}=csrf`];

  async function retained(host: string, title: string, image: string, minutes: number) {
    const articleUrl = `https://${host}/r2-${stamp}-${minutes}`;
    await db.article.create({
      data: {
        id: `r2-${stamp}-${minutes}`,
        title,
        summary: 'Retained summary',
        url: articleUrl,
        imageUrl: image,
        sourceId: host,
        sourceName: host,
        category: 'business',
        publishedAt: new Date(Date.UTC(2026, 9, 2, 8, minutes)),
      },
    });
    return { url: articleUrl, articleRef: computeArticleRef(articleUrl), title, host };
  }

  function payloadFor(summary: string, sources: { id: string; url: string; title: string }[]) {
    return {
      schema: 'ask-r2-result/1',
      answer: { state: 'CURRENT_REPORTING' },
      checkedAt: new Date().toISOString(),
      analysis: {
        analysis: {
          summary,
          keyFacts: [{ claim: 'Kenya held its policy rate', sourceArticleIds: [sources[0].id] }],
          agreements: [
            { point: 'Both cite food prices', sourceArticleIds: sources.map((s) => s.id) },
          ],
          differences: [
            {
              topic: 'Policy rate',
              positions: [
                { description: 'Kenya: held', sourceArticleIds: [sources[0].id] },
                {
                  description: 'Tanzania: cut',
                  sourceArticleIds: [sources[sources.length - 1].id],
                },
              ],
            },
          ],
          unknowns: [],
          sources: sources.map((s) => ({
            articleId: s.id,
            publisher: 'Publisher',
            title: s.title,
            url: s.url,
            publishedAt: '2026-10-02T08:00:00Z',
          })),
        },
      },
      background: null,
    };
  }
  let nextPayload: unknown = null;

  async function askTurn(question: string) {
    const t = await ask.createThread(accountPrincipal(reader), {
      idempotencyKey: randomUUID(),
      language: 'en',
    });
    const q = await ask.quote(accountPrincipal(reader), t.id, {
      idempotencyKey: randomUUID(),
      question,
      language: 'en',
      intent: 'ask',
    });
    if (q.status !== 'COMPLETED') {
      await ask.accept(accountPrincipal(reader), q.operationId);
      await ask.reserve(accountPrincipal(reader), q.operationId);
      await ask.execute(accountPrincipal(reader), q.operationId);
    }
    const turn = await db.askTurn.findFirstOrThrow({ where: { threadId: t.id } });
    return { turnId: turn.id, operationId: q.operationId };
  }

  beforeAll(async () => {
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url!, max: 8 }) });
    await db.$connect();
    const values: Record<string, string> = {
      ASK_V2_ENABLED: 'true',
      ASK_BRIEFINGS_ENABLED: 'true',
      SAND_LEDGER_ENABLED: 'true',
      SAND_CHARGING_ENABLED: 'false',
    };
    const module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), AskV2Module],
    })
      .overrideProvider(PrismaService)
      .useValue(db)
      .overrideProvider(ConfigService)
      .useValue({ get: (k: string) => values[k] } as ConfigService)
      .overrideProvider(SessionService)
      .useValue({ validateSession: async (t: string) => (t === 'r' ? { userId: reader } : null) })
      .overrideProvider(ASK_EXECUTION_PORT)
      .useValue({ prepare: async () => plan(), execute })
      .compile();
    ask = module.get(AskV2Service);
    app = module.createNestApplication();
    app.use(cookieParser());
    await app.init();
    const prisma = db as unknown as PrismaService;
    identity = new StoryIdentityService(prisma);
    alerts = new AlertsService(prisma, identity);
    execute.mockImplementation(async () => ({
      succeeded: true,
      payloadJson: JSON.stringify(nextPayload),
      evidenceRevision: `rev-${stamp}`,
      validUntil: plan().validUntil,
    }));
    reader = (await db.user.create({ data: { email: `${randomUUID()}@r2-slice.test` } })).id;
  });
  afterAll(async () => {
    await db?.user.deleteMany({ where: { id: reader } });
    await app?.close();
    await db?.$disconnect();
  });

  it('question → table → briefing → follow → material update → contextual Ask → v2', async () => {
    const image = `https://img.example/${stamp}/rates.jpg`;
    const headline = `East African central banks diverge on rates ${stamp}`;

    /* 1 · the reporting the question is answered from (retained, one canonical story) */
    const first = await retained('one.example', headline, image, 0);
    const second = await retained('two.example', headline, image, 10);
    const story = await identity.ensureStoryForArticle(first);
    await identity.ensureStoryForArticle(second);
    const v0 = await identity.describe(story.story.storyId);
    expect(v0?.briefVersion).toBe(2);

    /* 2 · question → answer with an evidence-linked comparison table (read-time projection) */
    nextPayload = payloadFor('Kenya held while Tanzania cut [1][2].', [
      { id: first.articleRef, url: first.url, title: first.title },
      { id: second.articleRef, url: second.url, title: second.title },
    ]);
    const q1 = await askTurn('Compare Kenya and Tanzania interest rate decisions');
    const op1 = await http().get(`/ask-v2/operations/${q1.operationId}`).set('Cookie', cookie());
    expect(op1.status).toBe(200);
    const table = op1.body.result.payload.comparisonTable;
    expect(table.schema).toBe('ask-comparison-table/1');
    expect(table.rows.map((r: { statement: string }) => r.statement)).toEqual([
      'Kenya: held',
      'Tanzania: cut',
      'Both cite food prices',
    ]);
    for (const row of table.rows) expect(row.sourceArticleIds.length).toBeGreaterThan(0);

    /* 3 · saved as a durable briefing, scoped to the canonical story */
    const saved = await http()
      .post('/ask-v2/briefings')
      .set('Cookie', cookie())
      .set('x-csrf-token', 'csrf')
      .send({ turnId: q1.turnId, title: 'EAC rates', storyId: story.story.storyId })
      .expect(201);
    const briefingId = saved.body.id as string;
    const before = await http().get(`/ask-v2/briefings/${briefingId}`).set('Cookie', cookie());
    expect(before.body.update).toMatchObject({ available: false, recordedBriefVersion: 2 });

    /* 4 · explicit follow: the reader sets a Story Alert on that story (not Country Follow) */
    const alert = await alerts.create(reader, first);
    expect(alert).toMatchObject({ storyId: story.story.storyId, change: 'NO_CHANGE_YET' });
    expect(await db.countryFollow.count({ where: { userId: reader } })).toBe(0);

    /* 5 · one real material update: a report from a NEW host is proven to join */
    const third = await retained('three.example', headline, image, 20);
    const joined = await identity.ensureStoryForArticle(third);
    expect(joined.outcome).toBe('JOINED');
    expect(joined.story.briefVersion).toBe(3);

    /* 6 · the alert names what changed; the briefing reports the update */
    const inbox = await alerts.inbox(reader, false);
    expect(inbox.unread.developments).toBe(1);
    expect(inbox.developments[0].newEvidence).toMatchObject({ articleRef: third.articleRef });
    const after = await http().get(`/ask-v2/briefings/${briefingId}`).set('Cookie', cookie());
    expect(after.body.update).toMatchObject({
      kind: 'STORY_MATERIAL_UPDATE',
      available: true,
      recordedBriefVersion: 2,
      currentBriefVersion: 3,
    });

    /* 7 · the contextual Ask about the update → appended as v2 */
    nextPayload = payloadFor('Since then, a third outlet reports Kenya may follow [3].', [
      { id: first.articleRef, url: first.url, title: first.title },
      { id: third.articleRef, url: third.url, title: third.title },
    ]);
    const q2 = await askTurn('What changed in this story since my briefing?');
    await http()
      .post(`/ask-v2/briefings/${briefingId}/versions`)
      .set('Cookie', cookie())
      .set('x-csrf-token', 'csrf')
      .send({ turnId: q2.turnId })
      .expect(201);
    const settled = await http().get(`/ask-v2/briefings/${briefingId}`).set('Cookie', cookie());
    expect(settled.body.versions.map((v: { version: number }) => v.version)).toEqual([1, 2]);
    expect(settled.body.update).toMatchObject({ available: false, recordedBriefVersion: 3 });

    const v1 = await http()
      .get(`/ask-v2/briefings/${briefingId}/versions/1`)
      .set('Cookie', cookie())
      .expect(200);
    expect(v1.body.blocks.summary).toBe('Kenya held while Tanzania cut [1][2].');
    expect(v1.body.supersededBy).toBe(2);
    expect(v1.body.evidenceRefs.map((r: { id: string }) => r.id)).toEqual([
      first.articleRef,
      second.articleRef,
    ]);
    const v2 = await http()
      .get(`/ask-v2/briefings/${briefingId}/versions/2`)
      .set('Cookie', cookie())
      .expect(200);
    expect(v2.body.evidenceRefs.map((r: { id: string }) => r.id)).toContain(third.articleRef);
    expect(v2.body.aiExecuted).toBe(false);
    /* two Ask turns executed (the port); reopening versions added none */
    expect(execute).toHaveBeenCalledTimes(2);
  });
});
