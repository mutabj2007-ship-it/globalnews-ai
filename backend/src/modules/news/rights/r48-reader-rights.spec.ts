import { ANALYSIS_TOTAL_BUDGET_MS, type CountryNewsResponse, type NewsArticle, type NewsResponse } from '@globalnews-ai/shared';
import { lastValueFrom, of } from 'rxjs';

/*
  MASTER CTO R48 / #96 — Production emergency source-use containment (E1-R46 adapted to e7b8105).
  Production's reviewed feed registry holds NO cleared feed, so this file adds ONE test-only CLEARED
  publisher feed to prove the gate does not over-block (E1 R46-12, mandatory no-false-negative).
*/

import { FEED_SOURCES, type FeedSourceEntry } from '../providers/feed-source-registry';
// eslint-disable-next-line import/first
import {
  __setReaderRightsFixtureModeForTests,
  __setReaderRightsTestFeeds,
  partitionReaderRights,
  readerRightsDecision,
  SOURCE_RIGHTS_WITHHELD_BASIS,
  withholdAskPayload,
  withholdThirdPartyArticles,
} from './reader-rights';
// eslint-disable-next-line import/first
import { ReaderRightsInterceptor } from './reader-rights.interceptor';
// eslint-disable-next-line import/first
import { AnalysisService } from '../../analysis/service/analysis.service';
// eslint-disable-next-line import/first
import type { AnalysisConfigService } from '../../analysis/config/analysis-config.service';
// eslint-disable-next-line import/first
import { MockAnalysisProvider } from '../../analysis/providers/mock-analysis.provider';

beforeAll(() => {
  __setReaderRightsFixtureModeForTests(false);
  __setReaderRightsTestFeeds([
    ...FEED_SOURCES,
    {
      sourceId: 'feed:r48-test-cleared',
      displayName: 'R48 Test Cleared Publisher',
      countryCode: 'KE',
      sourceType: 'NEWS_PROVIDER',
      feedUrl: 'https://cleared.example/feed',
      canonicalHost: 'cleared.example',
      language: 'en',
      enabled: false,
      provenanceNote: 'TEST ONLY — R48 no-false-negative fixture.',
      verifiedAt: '2026-10-13',
      rights: { state: 'CLEARED', evidence: 'TEST ONLY' },
    } as unknown as FeedSourceEntry,
  ]);
});
afterAll(() => {
  __setReaderRightsTestFeeds(null);
  __setReaderRightsFixtureModeForTests(true);
});

const CLEARED = 'feed:r48-test-cleared';
const article = (id: string, sourceId: string, over: Partial<NewsArticle> = {}): NewsArticle => ({
  id,
  title: `Kenya budget ${id} report`,
  summary: 'Kenya budget summary',
  url: `https://news.example/${id}`,
  imageUrl: `https://img.example/${id}.jpg`,
  sourceId,
  sourceName: 'Some Publisher',
  category: 'world',
  sourcesCount: 1,
  countryCode: 'KEN',
  publishedAt: new Date(Date.now() - 3_600_000).toISOString(),
  publishedAtBasis: 'publisher',
  ...over,
});

describe('R48-P1 · the per-use decision is affirmative: only a CLEARED publisher feed', () => {
  it.each([
    ['GNews publisher slug', 'reuters', false, 'NO_RECORDED_RIGHTS'],
    ['GDELT domain slug', 'example-com', false, 'NO_RECORDED_RIGHTS'],
    ['empty / missing', '', false, 'NO_RECORDED_RIGHTS'],
    ['feed not in the registry', 'feed:unknown-paper', false, 'UNKNOWN_FEED'],
    ['registry feed UNRESOLVED (KT Press)', 'feed:ktpress-rw', false, 'FEED_NOT_CLEARED'],
    ['registry feed CLEARED (test-only)', CLEARED, true, undefined],
  ])('%s', (_label, sourceId, allowed, reason) => {
    const decision = readerRightsDecision(sourceId);
    expect(decision.allowed).toBe(allowed);
    if (!decision.allowed) expect(decision.reason).toBe(reason);
  });
  it('a signed-in reader is no different: the decision takes no audience or identity input at all', () => {
    expect(readerRightsDecision.length).toBeLessThanOrEqual(2);
  });
});

describe('R48-P2 · AI input (R46-9): the model never receives an article without a recorded right', () => {
  function service(country: CountryNewsResponse, provider: MockAnalysisProvider): AnalysisService {
    const empty: NewsResponse = { articles: [], totalResults: 0, providers: ['gnews'], dataMode: 'live', generatedAt: new Date().toISOString() };
    const config = {
      get: () => ({
        maxArticles: 8,
        maxArticleChars: 1200,
        timeoutMs: 20000,
        totalBudgetMs: ANALYSIS_TOTAL_BUDGET_MS,
        cacheTtlSeconds: 0,
        openAiApiKey: undefined,
        openAiModel: 'gpt-4o-mini',
        executionMode: 'development' as const,
        retryAttempts: 2,
        retryBaseDelayMs: 300,
        maxCompletionTokens: 2000,
      }),
    } as unknown as AnalysisConfigService;
    return new AnalysisService(
      { search: jest.fn().mockResolvedValue(empty), topHeadlines: jest.fn().mockResolvedValue(empty), findArticleById: jest.fn().mockResolvedValue(null) } as never,
      { getCountryNews: jest.fn().mockResolvedValue(country) } as never,
      provider,
      config,
    );
  }
  const country = (articles: NewsArticle[]): CountryNewsResponse => ({
    countryCode: 'KEN',
    countryName: 'Kenya',
    articles,
    totalResults: articles.length,
    providers: ['gnews'],
    dataMode: 'live',
    feedTier: 'delayed',
    providerDisplayName: 'GNews',
    generatedAt: new Date().toISOString(),
  });

  it('GNews-only evidence: no model call, no article returned, withheld counted, and the reader is told it was withheld (never "no reporting")', async () => {
    const provider = new MockAnalysisProvider();
    const spy = jest.spyOn(provider, 'analyzeNews');
    const result = await service(country([article('g1', 'some-publisher'), article('g2', 'reuters')]), provider).analyzeNews('What is happening in Kenya?');
    expect(spy).not.toHaveBeenCalled();
    expect(result.articles).toEqual([]);
    expect(result.retrievalContext.rightsWithheld).toEqual({ count: 2 });
    expect(result.analysisError).toMatch(/^Reporting was found, but it cannot be shown or used here because its source-use rights are not established\./);
  });

  it('R46-12 no-false-negative: a CLEARED feed article reaches the model and the reader unchanged; a GNews one beside it does not', async () => {
    const provider = new MockAnalysisProvider();
    const spy = jest.spyOn(provider, 'analyzeNews');
    const result = await service(country([article('c1', CLEARED), article('g1', 'some-publisher')]), provider).analyzeNews('What is happening in Kenya?');
    expect(spy).toHaveBeenCalledTimes(1);
    const sent = (spy.mock.calls[0][0] as { articles: NewsArticle[] }).articles.map((a) => a.id);
    expect(sent).toEqual(['c1']);
    expect(result.articles.map((a) => a.id)).toEqual(['c1']);
    expect(result.retrievalContext.rightsWithheld).toEqual({ count: 1 });
  });
});

const askPayload = (articles: unknown[], extra: Record<string, unknown> = {}) => ({
  schema: 'ask-r2-result/1',
  answer: { state: 'CURRENT_REPORTING', basis: 'REQUIRED_EVIDENCE_OBTAINED', missingRoles: [] },
  analysis: {
    articles,
    analysis: {
      summary: 'Model prose written from the evidence [1].',
      sources: (articles as Array<{ id: string; title: string; url: string }>).map((a) => ({
        articleId: a.id,
        publisher: 'Some Publisher',
        title: a.title,
        url: a.url,
        publishedAt: '2026-10-12T08:00:00Z',
      })),
    },
    retrievalContext: { dataMode: 'live' },
  },
  comparisonTable: { rows: [] },
  ...extra,
});

describe('R48-P3 · Ask results read by ANY reader — fresh, reopened, guest, signed-in (R46-1/2/5)', () => {
  it('an answer resting on a GNews article is withheld at read time: no headline, publisher, link, image or model prose', () => {
    const stored = askPayload([article('g1', 'some-publisher')]);
    const before = JSON.stringify(stored);
    const { payload, withheld } = withholdAskPayload(stored);
    const text = JSON.stringify(payload);
    expect(withheld).toBeGreaterThan(0);
    expect((payload as unknown as { answer: { state: string; basis: string } }).answer).toMatchObject({ state: 'CAPABILITY_UNAVAILABLE', basis: SOURCE_RIGHTS_WITHHELD_BASIS });
    expect((payload as unknown as { analysis: unknown }).analysis).toBeNull();
    expect(text).not.toMatch(/Kenya budget g1 report|news\.example|img\.example|Some Publisher|Model prose/);
    /* the stored row is never rewritten */
    expect(JSON.stringify(stored)).toBe(before);
  });
  it('an answer whose analysis recorded a pre-model withholding (no evidence left) reads as withheld, not as "no reporting"', () => {
    const stored = { ...askPayload([]), answer: { state: 'INSUFFICIENT', basis: 'NO_REQUIRED_EVIDENCE_OBTAINED', missingRoles: ['REPORTING'] } };
    (stored.analysis.retrievalContext as Record<string, unknown>).rightsWithheld = { count: 3 };
    const { payload } = withholdAskPayload(stored);
    expect((payload as unknown as { answer: { basis: string } }).answer.basis).toBe(SOURCE_RIGHTS_WITHHELD_BASIS);
  });
  it('R46-12: an answer resting only on a CLEARED feed is returned unchanged', () => {
    const stored = askPayload([article('c1', CLEARED)]);
    expect(withholdAskPayload(stored)).toEqual({ payload: stored, withheld: 0 });
  });
  it('recentReporting (R46-2 METADATA) items without a recorded right are removed even when the answer itself is cleared', () => {
    const stored = askPayload([article('c1', CLEARED)], {
      recentReporting: { items: [{ title: 'Other headline', url: 'https://news.example/x', publisher: 'Some Publisher', publishedAt: '2026-10-12T08:00:00Z' }] },
    });
    const { payload, withheld } = withholdAskPayload(stored);
    expect(withheld).toBe(1);
    expect((payload as unknown as { recentReporting: { items: unknown[] } }).recentReporting.items).toEqual([]);
    expect((payload as unknown as { analysis: { articles: unknown[] } }).analysis.articles).toHaveLength(1);
  });
  it('the read gate is wired into getOperation (fresh, reopen and guest all return through it) and into prior-answer re-use (R46-10)', () => {
    const { readFileSync } = jest.requireActual('fs') as typeof import('fs');
    const { join } = jest.requireActual('path') as typeof import('path');
    const service = readFileSync(join(__dirname, '..', '..', 'ask-v2', 'ask-v2.service.ts'), 'utf8');
    expect(service).toMatch(/payload: readerRightsEnforced\(\)\s*\?\s*withholdAskPayload\(withComparisonTable\(result\.payload\)\)\.payload/);
    expect(service).toContain('if (readerRightsEnforced() && payload != null && withholdAskPayload(payload).withheld > 0) return undefined;');
    /* no ungated read: both occurrences sit inside the enforced / test-fixture ternary */
    expect(service.match(/withComparisonTable\(result\.payload\)/g)).toHaveLength(2);
  });
});

describe('R48-P4 · reader JSON on every public route (/news/*, /analysis/news, stories, history …) — R46-1/2/7/11/13', () => {
  it('a NewsResponse keeps only CLEARED-feed articles; images go with their article; other values untouched', () => {
    const at = new Date('2026-10-13T00:00:00Z');
    const body = {
      articles: [article('g1', 'some-publisher'), article('c1', CLEARED), article('u1', 'feed:unknown-paper')],
      generatedAt: at,
      officialSource: { name: 'National Statistics', url: 'https://stats.example', licence: 'CC-BY' },
    };
    const { value, withheld } = withholdThirdPartyArticles(body);
    expect(withheld).toBe(2);
    expect(value.articles.map((a) => a.id)).toEqual(['c1']);
    expect(value.generatedAt).toBe(at);
    expect(value.officialSource).toEqual(body.officialSource);
    expect(JSON.stringify(value)).not.toContain('img.example/g1');
  });
  it('a cited source is kept only when it points at a CLEARED article in the same response', () => {
    const { value, withheld } = withholdThirdPartyArticles({
      articles: [article('c1', CLEARED), article('g1', 'gnews-pub')],
      sources: [
        { articleId: 'c1', publisher: 'P', title: 'Cleared headline', url: 'https://cleared.example/c1' },
        { articleId: 'g1', publisher: 'P', title: 'GNews headline', url: 'https://news.example/g1' },
      ],
    });
    expect(withheld).toBe(2);
    expect(value.sources.map((s) => s.articleId)).toEqual(['c1']);
    expect(value.articles.map((a) => a.id)).toEqual(['c1']);
  });
  it('briefing evidence refs (no sourceId) are withheld; nested single article properties are dropped', () => {
    const { value, withheld } = withholdThirdPartyArticles({
      evidenceRefs: [{ id: 'e1', host: 'news.example', url: 'https://news.example/e1', title: 'A headline', publisher: 'P' }],
      lead: { title: 'Lead headline', url: 'https://news.example/l', sourceId: 'reuters' },
    });
    expect(withheld).toBe(2);
    expect(value).toEqual({ evidenceRefs: [] });
  });
  it('partitionReaderRights keeps order and counts', () => {
    expect(partitionReaderRights([article('c1', CLEARED), article('g1', 'x'), article('c2', CLEARED)])).toEqual({
      allowed: [article('c1', CLEARED), article('c2', CLEARED)].map((a) => expect.objectContaining({ id: a.id })),
      withheld: 1,
    });
  });
  const ctx = (path: string, headers: Record<string, string>) =>
    ({
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => ({ originalUrl: path }), getResponse: () => ({ setHeader: (k: string, v: string) => (headers[k] = v) }) }),
    }) as never;
  it('the interceptor withholds on reader routes and counts it in a header', async () => {
    const headers: Record<string, string> = {};
    const out = await lastValueFrom(
      new ReaderRightsInterceptor().intercept(ctx('/news/search?q=kenya', headers), { handle: () => of({ articles: [article('g1', 'gnews-pub')] }) }),
    );
    /* R52 · P-5 — the JSON says why the list is empty: never a completed no-match */
    expect(out).toEqual({ articles: [], sourceRightsWithheld: { count: 1, reason: 'SOURCE_RIGHTS_WITHHELD' } });
    expect(headers['X-Source-Rights-Withheld']).toBe('1');
  });
  it('internal admin routes are not reader surfaces and are left unchanged', async () => {
    const body = { articles: [article('g1', 'gnews-pub')] };
    const out = await lastValueFrom(new ReaderRightsInterceptor().intercept(ctx('/admin/news', {}), { handle: () => of(body) }));
    expect(out).toBe(body);
  });
  it('the interceptor is registered globally', () => {
    const { readFileSync } = jest.requireActual('fs') as typeof import('fs');
    const { join } = jest.requireActual('path') as typeof import('path');
    const app = readFileSync(join(__dirname, '..', '..', '..', 'app.module.ts'), 'utf8');
    expect(app).toMatch(/provide: APP_INTERCEPTOR,\s*useClass: ReaderRightsInterceptor,/);
  });
});

describe('R48-P5 · briefings (R46-6): a stored version resting on evidence with no recorded right is withheld (451)', () => {
  it('getVersion refuses with 451 SOURCE_RIGHTS_WITHHELD and never rewrites the version', () => {
    const { readFileSync } = jest.requireActual('fs') as typeof import('fs');
    const { join } = jest.requireActual('path') as typeof import('path');
    const svc = readFileSync(join(__dirname, '..', '..', 'ask-v2', 'briefings', 'briefings.service.ts'), 'utf8');
    expect(svc).toMatch(/if \(readerRightsEnforced\(\) && withholdThirdPartyArticles\(row\.evidenceRefs\)\.withheld > 0\) \{\s*throw new HttpException\(\{ statusCode: 451, reason: 'SOURCE_RIGHTS_WITHHELD' \}, 451\);/);
  });
});

describe('R52 · U-1 imageUrl zero-leak (E1 M-18): no third-party image survives without a recorded right', () => {
  const g = article('g9', 'gnews-pub');
  const c = article('c9', CLEARED);
  const nested = {
    stories: [
      /* a story card that copied its lead article's image and headline but carries no link */
      { id: 'story-1', title: 'Story headline from GNews', imageUrl: g.imageUrl, leadArticleId: 'g9', articles: [g, c] },
    ],
    hero: { imageUrl: 'https://img.example/hero-from-gnews.jpg', caption: 'Hero' },
    thumbs: [{ thumbnail: 'https://img.example/thumb-gnews.jpg', label: 'x' }],
    country: { articles: [{ ...g, id: 'g10', imageUrl: 'https://img.example/g10.jpg' }] },
    flag: 'https://static.globalnews.example/flags/ke.svg',
  };
  it('a deep reader response keeps no uncleared image, link or headline anywhere — nested cards, hero, thumbnails included', () => {
    const { value, withheld } = withholdThirdPartyArticles(nested);
    const json = JSON.stringify(value);
    for (const leak of ['img.example/g9', 'img.example/g10', 'hero-from-gnews', 'thumb-gnews', 'news.example/g9', 'Kenya budget g9 report']) {
      expect(json).not.toContain(leak);
    }
    expect(withheld).toBeGreaterThanOrEqual(5);
    /* non-image values are untouched (a flag asset under a non-image key, captions, labels, ids) */
    expect(value.flag).toBe(nested.flag);
    expect((value as typeof nested).hero.caption).toBe('Hero');
  });
  it('positive control: a CLEARED feed article keeps its own image, link and headline', () => {
    const { value } = withholdThirdPartyArticles(nested);
    const json = JSON.stringify(value);
    expect(json).toContain('img.example/c9.jpg');
    expect(json).toContain('Kenya budget c9 report');
  });
  it('an Ask answer read by any reader carries no uncleared image anywhere in its payload', () => {
    const payload = {
      schema: 'ask-r2-result/1',
      answer: { state: 'CURRENT_REPORTING', basis: 'REQUIRED_EVIDENCE_OBTAINED', missingRoles: [] },
      analysis: { articles: [g], analysis: { summary: 'x', sources: [{ articleId: 'g9', publisher: 'P', title: 'T', url: g.url }] } },
      recentReporting: { items: [{ ...g, id: 'g11', imageUrl: 'https://img.example/g11.jpg' }] },
    };
    const json = JSON.stringify(withholdAskPayload(payload).payload);
    expect(json).not.toMatch(/img\.example\/g(9|11)/);
  });
});

describe('R52 · E1 P-11 — every public news route, in JSON, route by route, with the CLEARED control', () => {
  const g = article('gx', 'gnews-pub');
  const c = article('cx', CLEARED);
  const at = '2026-10-13T00:00:00.000Z';
  const route = (path: string) =>
    ({
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => ({ originalUrl: path }), getResponse: () => ({ setHeader: () => undefined }) }),
    }) as never;
  const bodies: Array<[string, () => Record<string, unknown>]> = [
    ['/news/search?q=kenya', () => ({ articles: [g, c], totalResults: 2, providers: ['gnews'], dataMode: 'live', generatedAt: at })],
    ['/news/top-headlines?country=ke', () => ({ articles: [g, c], totalResults: 2, providers: ['gnews'], dataMode: 'live', generatedAt: at })],
    ['/news/top-headlines/retained', () => ({ articles: [g, c], totalResults: 2, providers: [], dataMode: 'cached', generatedAt: at })],
    ['/news/category/world', () => ({ articles: [g, c], totalResults: 2, providers: ['gnews'], dataMode: 'live', generatedAt: at })],
    ['/news/country/KE', () => ({ articles: [g, c], countryCode: 'KE', countryName: 'Kenya', feedTier: 'delayed', generatedAt: at })],
    [
      '/analysis/news',
      () => ({
        articles: [g, c],
        analysis: { summary: 'x', sources: [{ articleId: 'gx', publisher: 'P', title: 'G', url: g.url }, { articleId: 'cx', publisher: 'P', title: 'C', url: c.url }] },
        retrievalContext: { dataMode: 'live' },
      }),
    ],
  ];
  it.each(bodies)('%s: the GNews item (headline, snippet, publisher, link, image) is gone, the CLEARED item stays, the reason is in the JSON', async (path, make) => {
    const out = (await lastValueFrom(new ReaderRightsInterceptor().intercept(route(path), { handle: () => of(make()) }))) as Record<string, unknown>;
    const json = JSON.stringify(out);
    for (const leak of [g.url, g.imageUrl as string, g.title, 'news.example/gx']) expect(json).not.toContain(leak);
    expect(json).toContain(c.url);
    expect(json).toContain(c.imageUrl as string);
    expect((out.articles as NewsArticle[]).map((a) => a.id)).toEqual(['cx']);
    expect(out.sourceRightsWithheld).toEqual({ count: expect.any(Number), reason: 'SOURCE_RIGHTS_WITHHELD' });
  });
  it('a response with nothing to withhold is returned unchanged (no reason field added)', async () => {
    const body = { articles: [c], totalResults: 1 };
    const out = await lastValueFrom(new ReaderRightsInterceptor().intercept(route('/news/search?q=x'), { handle: () => of(body) }));
    expect(out).toBe(body);
  });
  it('the routes under test are the real public controller routes', () => {
    const { readFileSync } = jest.requireActual('fs') as typeof import('fs');
    const { join } = jest.requireActual('path') as typeof import('path');
    const news = readFileSync(join(__dirname, '..', 'news.controller.ts'), 'utf8');
    for (const r of ["@Get('search')", "@Get('top-headlines')", "@Get('top-headlines/retained')", "@Get('category/:category')"]) expect(news).toContain(r);
    expect(readFileSync(join(__dirname, '..', 'country', 'country-news.controller.ts'), 'utf8')).toContain("@Controller('news/country')");
    const analysis = readFileSync(join(__dirname, '..', '..', 'analysis', 'controller', 'analysis.controller.ts'), 'utf8');
    expect(analysis).toContain("@Controller('analysis')");
    expect(analysis).toContain("@Post('news')");
  });
});

describe('R53 · the stored conversation artifact of a sourced answer is withheld with it (components, evidenceUrls, evidenceRefs)', () => {
  const CLAIM = 'Fuel prices in Kigali rose 4% this week, the report says';
  const g = article('ga', 'gnews-pub');
  const c = article('ca', CLEARED);
  const sourcedArtifact = (a: NewsArticle) => ({
    kind: 'SOURCED_ANSWER',
    label: 'Kigali fuel prices',
    components: [CLAIM, 'Transport fares followed'],
    provenance: 'SOURCED_REPORTING',
    citable: false,
    evidenceUrls: [a.url],
    evidenceRefs: [a.id],
  });
  const answered = (a: NewsArticle) => ({
    schema: 'ask-r2-result/1',
    answer: { state: 'CURRENT_REPORTING', basis: 'REQUIRED_EVIDENCE_OBTAINED', missingRoles: [] },
    analysis: { articles: [a], analysis: { summary: CLAIM, sources: [{ articleId: a.id, publisher: 'P', title: 'T', url: a.url }] } },
    artifact: sourcedArtifact(a),
  });
  it('a historical GNews-sourced answer: no claim point, evidence URL or ref survives; the stored payload is not mutated', () => {
    const stored = answered(g);
    const before = JSON.stringify(stored);
    const { payload, withheld } = withholdAskPayload(stored);
    const json = JSON.stringify(payload);
    expect(withheld).toBeGreaterThan(0);
    expect(json).not.toContain(CLAIM);
    expect(json).not.toContain('Transport fares followed');
    expect(json).not.toContain(g.url);
    expect((payload as Record<string, unknown>).artifact).toBeUndefined();
    expect(JSON.stringify(stored)).toBe(before);
  });
  it('a sourced artifact left on a payload whose analysis is gone is withheld alone and counted (so prior-work reuse stops)', () => {
    const stored = { schema: 'ask-r2-result/1', answer: { state: 'CURRENT_REPORTING', basis: 'REQUIRED_EVIDENCE_OBTAINED', missingRoles: [] }, analysis: null, artifact: sourcedArtifact(g) };
    const { payload, withheld } = withholdAskPayload(stored);
    expect(withheld).toBe(1);
    expect(JSON.stringify(payload)).not.toContain(CLAIM);
    expect((payload as Record<string, unknown>).sourceRightsWithheld).toEqual({ count: 1 });
  });
  it('a SOURCED artifact naming no evidence cannot be verified and is withheld', () => {
    const { artifact } = answered(g);
    const stored = { schema: 'ask-r2-result/1', answer: { state: 'CURRENT_REPORTING' }, analysis: null, artifact: { ...artifact, evidenceUrls: [], evidenceRefs: [] } };
    expect(withholdAskPayload(stored).withheld).toBe(1);
  });
  it('preserved: an unsourced general-knowledge answer and its reasoning artifact are returned unchanged', () => {
    const general = {
      schema: 'ask-r2-result/1',
      answer: { state: 'REFERENCE_BACKGROUND', basis: 'PLAN_NO_REQUIRED_EVIDENCE', missingRoles: [] },
      analysis: null,
      background: { text: 'Kigali is the capital of Rwanda.' },
      artifact: { kind: 'EXPLANATION', label: 'Kigali', components: ['capital of Rwanda'], provenance: 'MODEL_REASONING', citable: false },
    };
    const { payload, withheld } = withholdAskPayload(general);
    expect(withheld).toBe(0);
    expect(payload).toEqual(general);
  });
  it('positive control: a CLEARED-feed sourced answer keeps its artifact, claims and evidence URL', () => {
    const { payload, withheld } = withholdAskPayload(answered(c));
    expect(withheld).toBe(0);
    expect(JSON.stringify(payload)).toContain(CLAIM);
    expect((payload as { artifact: { evidenceUrls: string[] } }).artifact.evidenceUrls).toEqual([c.url]);
  });
});
