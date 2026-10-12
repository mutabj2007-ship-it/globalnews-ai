import { UnprocessableEntityException } from '@nestjs/common';
import type { NewsArticle } from '@globalnews-ai/shared';
import { computeArticleRef } from '../identity/article-ref.util';
import {
  GEO_IDENTITY_QUARANTINE,
  isGeoQuarantined,
  isGeoQuarantinedRef,
  partitionGeoQuarantined,
} from './geo-identity-quarantine';
import { ArticlePersistenceService } from '../persistence/article-persistence.service';
import { StoryIdentityService } from '../../stories/story-identity.service';
import { AskContextRefused, AskContextResolver } from '../../ask-v2/context/ask-context.resolver';
import { ANALYSIS_TOTAL_BUDGET_MS } from '@globalnews-ai/shared';
import { AnalysisService } from '../../analysis/service/analysis.service';
import { MockAnalysisProvider } from '../../analysis/providers/mock-analysis.provider';

/**
 * MASTER CTO P0 #85 — URL-KEYED PATHS, PROVED WITH THE REAL MATCHER.
 *
 * The held reports' URLs are publisher links and are kept out of the code, so a path that needs the
 * URL itself (a re-fetch under another id, BW-EA-Q7; a story ensure, whose ref must hash its URL)
 * is proved with ONE synthetic identity appended to the list for this file only: same entry shape,
 * same Set, same articleRef matcher as the five. Everything below runs the production guard.
 */
const SYNTHETIC_URL = 'https://wire.example/world/africa/held-story-1';
jest.mock('./geo-identity-quarantine.list', () => {
  const actual = jest.requireActual('./geo-identity-quarantine.list');
  const { computeArticleRef: ref } = jest.requireActual('../identity/article-ref.util');
  return {
    GEO_IDENTITY_QUARANTINE: Object.freeze([
      ...actual.GEO_IDENTITY_QUARANTINE,
      Object.freeze({
        articleId: 'gnews-synthetic-held-1',
        articleRef: ref('https://wire.example/world/africa/held-story-1'),
        reason: 'GEO_IDENTITY_UNDER_REVIEW',
        storedCountry: 'CG',
        ruling: '#85',
      }),
    ]),
  };
});

const SYNTHETIC_REF = computeArticleRef(SYNTHETIC_URL);
/* BW-EA-Q7 — the same report re-fetched under a DIFFERENT id, URL spelled differently */
const REFETCH_ID = 'gnews-refetch-777';
const REFETCH_URL = `${SYNTHETIC_URL}?utm_source=feed`;
const NOW = Date.now();

describe('#85 · the synthetic identity is a faithful stand-in', () => {
  it('the list still holds the five measured identities, plus the one synthetic entry for this file', () => {
    expect(GEO_IDENTITY_QUARANTINE).toHaveLength(6);
    expect(GEO_IDENTITY_QUARANTINE.slice(0, 5).map((e) => e.articleId)).toEqual([
      'gnews-914413795', 'gnews-1235004559', 'gnews-1879033220', 'gnews-1458247823', 'gnews-356962950',
    ]);
  });
  it('the re-fetched spelling normalizes to the same articleRef, under an id the list does not name (non-vacuous)', () => {
    expect(computeArticleRef(REFETCH_URL)).toBe(SYNTHETIC_REF);
    expect(isGeoQuarantined({ id: REFETCH_ID })).toBe(false);
    expect(isGeoQuarantinedRef(SYNTHETIC_REF)).toBe(true);
  });
});

/* ── persistence, with the store holding the re-fetched copy under its new id ── */
const row = (id: string, url: string, countryCode: string | null) => ({
  id, title: 'Synthetic headline', summary: 'Synthetic summary.', url, imageUrl: null, sourceId: 'synthetic-wire',
  sourceName: 'Synthetic Wire', sourcesCount: 1, category: 'world', publishedAt: new Date(NOW - 3_600_000),
  fetchedAt: new Date(NOW - 3_600_000), publishedAtBasis: 'publisher', countryCode, countryName: countryCode === null ? null : 'X',
  relevanceScore: null, confidenceScore: null, createdAt: new Date(NOW), updatedAt: new Date(NOW),
});
const ROWS = [row(REFETCH_ID, REFETCH_URL, 'CG'), row('control-1', 'https://wire.example/world/africa/other-story', 'CD')];
function store() {
  const upserts: string[] = [];
  const pick = (where: any) =>
    ROWS.find((r) => (where?.id !== undefined ? r.id === where.id : true) && (where?.url?.in !== undefined ? where.url.in.includes(r.url) : true)) ?? null;
  const prisma = {
    article: {
      findMany: jest.fn(async () => ROWS),
      findFirst: jest.fn(async (q: { where?: any }) => {
        const hit = pick(q.where);
        return hit === null ? null : { ...hit, countries: [] };
      }),
      upsert: jest.fn((q: { where: { url: string } }) => {
        upserts.push(q.where.url);
        return { url: q.where.url, fetchedAt: new Date(NOW) };
      }),
    },
    $transaction: jest.fn(async (ops: unknown[]) => ops),
  };
  return { svc: new ArticlePersistenceService(prisma as never), upserts };
}

describe('#85 · BW-EA-Q7: a held report re-fetched under another id is still withheld (articleRef key)', () => {
  it('not obtainable by its new id or by either URL spelling; the control is', async () => {
    const { svc } = store();
    expect(await svc.findById(REFETCH_ID)).toBeNull();
    expect(await svc.findRetainedByUrl(REFETCH_URL)).toBeNull();
    expect((await svc.findById('control-1'))?.countryCode).toBe('CD');
  });
  it('retained reads carry it without its stored country; the control keeps CD', async () => {
    const { svc } = store();
    const byId = new Map((await svc.findRecent({ limit: 10, maxAgeMinutes: 1440 })).map((a) => [a.id, a]));
    expect(byId.get(REFETCH_ID)!.countryCode).toBeUndefined();
    expect(byId.get('control-1')!.countryCode).toBe('CD');
  });
  it('never written again, and withheld at the evidence point', async () => {
    const { svc, upserts } = store();
    const fresh = { id: REFETCH_ID, url: REFETCH_URL, title: 't', summary: 's', sourceId: 'synthetic-wire', sourceName: 'S', category: 'world', sourcesCount: 1, publishedAt: new Date(NOW).toISOString() } as NewsArticle;
    await svc.persistMany([fresh]);
    expect(upserts).toEqual([]);
    expect(partitionGeoQuarantined([fresh]).held).toHaveLength(1);
  });
});

describe('#85 · Ask STORY by {articleRef, url} with the real URL of a held report', () => {
  it('→ ASK_CONTEXT_STORY_LOCATION_UNDER_REVIEW, before any read', async () => {
    const findRetainedArticleByUrl = jest.fn(async () => null);
    const resolver = new AskContextResolver({ findRetainedArticleByUrl, findArticleById: jest.fn() } as never);
    let code = 'RESOLVED';
    try {
      await resolver.resolve({ kind: 'STORY', articleRef: SYNTHETIC_REF, url: REFETCH_URL });
    } catch (e) {
      code = e instanceof AskContextRefused ? e.code : 'OTHER';
    }
    expect(code).toBe('ASK_CONTEXT_STORY_LOCATION_UNDER_REVIEW');
    expect(findRetainedArticleByUrl).not.toHaveBeenCalled();
  });
});

describe('#85 · EA P11 / Q-4: ensureStoryForArticle refuses a held report, fail closed', () => {
  const prisma = (stored: ReturnType<typeof row> | null) => ({
    storyArticle: { findUnique: jest.fn(async () => (stored === null ? null : { storyId: 's1' })) },
    story: {
      findUnique: jest.fn(async () => ({ id: 's1', mergedIntoId: null, briefVersion: 1, briefUpdatedAt: null, discussionLockedAt: null })),
      findMany: jest.fn(async () => []),
    },
    article: { findFirst: jest.fn(async () => stored) },
  });
  const refusal = async (p: Promise<unknown>) => {
    try {
      await p;
      return 'ALLOWED';
    } catch (e) {
      return e instanceof UnprocessableEntityException ? (e.getResponse() as { message?: string }).message : 'OTHER';
    }
  };

  it('by ref (the real URL of a held report): LOCATION_UNDER_REVIEW, nothing read, nothing written', async () => {
    const db = prisma(null);
    expect(await refusal(new StoryIdentityService(db as never).ensureStoryForArticle({ articleRef: SYNTHETIC_REF, url: REFETCH_URL }))).toBe('LOCATION_UNDER_REVIEW');
    expect(db.storyArticle.findUnique).not.toHaveBeenCalled();
    expect(db.article.findFirst).not.toHaveBeenCalled();
  });
  it('by the stored row (a held id reached under another URL spelling): LOCATION_UNDER_REVIEW', async () => {
    const otherUrl = 'https://wire.example/world/africa/another-spelling';
    const db = prisma(null);
    db.article.findFirst.mockResolvedValue(row('gnews-914413795', otherUrl, 'CG') as never);
    expect(await refusal(new StoryIdentityService(db as never).ensureStoryForArticle({ articleRef: computeArticleRef(otherUrl), url: otherUrl }))).toBe('LOCATION_UNDER_REVIEW');
  });
  it('control: an unheld report with an existing story resolves (EXISTING)', async () => {
    const url = 'https://wire.example/world/africa/other-story';
    const db = prisma(row('control-1', url, 'CD'));
    const out = await new StoryIdentityService(db as never).ensureStoryForArticle({ articleRef: computeArticleRef(url), url });
    expect(out.outcome).toBe('EXISTING');
  });
});

describe('#85 · BW-EA-Q5 by URL: legacy /analysis/news ignores the client country of a story held by its URL', () => {
  const run = async (story: { title: string; url: string; countryCode: string }) => {
    const empty = { articles: [], totalResults: 0, providers: ['gnews'], dataMode: 'live', generatedAt: new Date().toISOString() };
    const getCountryNews = jest.fn(async (iso3: string) => ({ ...empty, countryCode: iso3, countryName: iso3, feedTier: 'delayed', providerDisplayName: 'GNews' }));
    const config = { get: () => ({ maxArticles: 8, maxArticleChars: 1200, timeoutMs: 20000, totalBudgetMs: ANALYSIS_TOTAL_BUDGET_MS, cacheTtlSeconds: 0, openAiApiKey: undefined, openAiModel: 'gpt-4o-mini', executionMode: 'development', retryAttempts: 2, retryBaseDelayMs: 300, maxCompletionTokens: 2000 }) };
    const news = { search: jest.fn(async () => empty), topHeadlines: jest.fn(async () => empty), findArticleById: jest.fn(async () => null), findRetainedByQuery: jest.fn(async () => []), findRetainedHeadlines: jest.fn(async () => []), findRetainedByCountry: jest.fn(async () => []) };
    const svc = new AnalysisService(news as never, { getCountryNews } as never, new MockAnalysisProvider(), config as never);
    await svc.analyzeNews('What is the latest on this story?', 'en', story);
    return getCountryNews.mock.calls.map((c) => c[0]);
  };
  it('{url: held (another spelling), countryCode: CG} → never scoped to COG', async () => {
    expect(await run({ title: 'Synthetic', url: REFETCH_URL, countryCode: 'CG' })).not.toContain('COG');
  });
  it('control: an unheld URL with countryCode CG is still scoped to COG', async () => {
    expect(await run({ title: 'Synthetic', url: 'https://wire.example/world/africa/other-story', countryCode: 'CG' })).toContain('COG');
  });
});

describe('#85 · story identity: observe, backfill and rung-3 never place or join a held report', () => {
  const HELD_ROW = row('gnews-914413795', 'https://wire.example/world/africa/held-row', 'CG');
  const CONTROL_ROW = row('control-1', 'https://wire.example/world/africa/other-story', 'CD');
  /* a transaction double that records what placement asked of the store */
  const tx = () => ({
    storyArticle: {
      findUnique: jest.fn(async (_q: unknown) => null),
      findMany: jest.fn(async (_q: unknown) => [] as unknown[]),
      create: jest.fn(async (_q: unknown) => ({})),
    },
    storyAlert: { count: jest.fn(async () => 0) },
    story: { create: jest.fn(async () => ({ id: 'new-story' })) },
    storyIdentityEvent: { create: jest.fn(async () => ({})) },
  });
  const build = (rows: ReturnType<typeof row>[], alerts: number) => {
    const t = tx();
    const prisma = {
      storyAlert: { count: jest.fn(async () => alerts) },
      article: { findMany: jest.fn(async () => rows) },
    };
    const svc = new StoryIdentityService(prisma as never);
    jest.spyOn(svc, 'atomic').mockImplementation(async (work: (x: never) => Promise<unknown>) => work(t as never) as never);
    return { svc, t, prisma };
  };

  it('observe: a held row is not placed; the control is', async () => {
    const { svc, t } = build([HELD_ROW, CONTROL_ROW], 1);
    const out = await svc.observeRetainedForAlerts([{ url: HELD_ROW.url } as NewsArticle, { url: CONTROL_ROW.url } as NewsArticle]);
    expect(out.has(computeArticleRef(HELD_ROW.url))).toBe(false);
    expect(out.has(computeArticleRef(CONTROL_ROW.url))).toBe(true);
    const created = t.storyArticle.create.mock.calls.map((c) => (c[0] as { data: { articleUrl: string } }).data.articleUrl);
    expect(created).not.toContain(HELD_ROW.url);
  });

  it('backfill: a held row is skipped (counted), the control is created', async () => {
    const { svc, t } = build([HELD_ROW, CONTROL_ROW], 0);
    const report = await svc.backfill({ limit: 10 });
    expect(report.skipped).toBe(1);
    expect(report.created).toBe(1);
    const created = t.storyArticle.create.mock.calls.map((c) => (c[0] as { data: { articleUrl: string } }).data.articleUrl);
    expect(created).toEqual([CONTROL_ROW.url]);
  });

  it('rung-3: a held report with the same headline is never a join candidate (its ref is never looked up)', async () => {
    /* placement of the control: the rung-3 read returns the held row as a same-title candidate */
    const prisma2 = { article: { findMany: jest.fn(async () => [HELD_ROW]) }, storyAlert: { count: jest.fn(async () => 0) } };
    const svc2 = new StoryIdentityService(prisma2 as never);
    const t2 = tx();
    jest.spyOn(svc2, 'atomic').mockImplementation(async (work: (x: never) => Promise<unknown>) => work(t2 as never) as never);
    await (svc2 as unknown as { placeArticle(ref: string, r: unknown, m: string): Promise<unknown> }).placeArticle(
      computeArticleRef(CONTROL_ROW.url),
      CONTROL_ROW,
      'explicit',
    );
    const looked = t2.storyArticle.findMany.mock.calls.flatMap((c) => (c[0] as { where: { articleRef: { in: string[] } } }).where.articleRef.in);
    expect(looked).not.toContain(computeArticleRef(HELD_ROW.url));
  });
});
