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
    expect(out).toEqual({ articles: [] });
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
