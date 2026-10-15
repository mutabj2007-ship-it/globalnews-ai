import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ANALYSIS_TOTAL_BUDGET_MS } from '@globalnews-ai/shared';
import type { NewsArticle } from '@globalnews-ai/shared';
import { AnalysisService } from './analysis.service';
import type { AnalysisProvider, AnalysisProviderInput } from '../interfaces';
import type { AnalysisConfigService } from '../config/analysis-config.service';
import { NewsService } from '../../news/news.service';
import { CountryNewsService } from '../../news/country/country-news.service';
import type { NewsProvider } from '../../news/interfaces';
import { ALL_NEWS_PROVIDERS, FALLBACK_NEWS_PROVIDERS, NEWS_PROVIDERS } from '../../news/providers/provider.tokens';
import { ArticlePersistenceService } from '../../news/persistence/article-persistence.service';
import { observedRetrievalOf, retrievalIncomplete } from '../../ask-v2/retrieval-outcome';
import { __setReaderRightsFixtureModeForTests, __setReaderRightsTestFeeds } from '../../news/rights/reader-rights';
import { FEED_SOURCES, type FeedSourceEntry } from '../../news/providers/feed-source-registry';
jest.setTimeout(180000);
/*
  E1 R96 (E1_R96_WINDOW_COUNT_HOLD) W-5 — the window count is rights-partitioned at the sink.
  Fixture mode ON (providers run; this is a window-and-rights REPORTING test). A test-only CLEARED feed
  is the positive control (R-B): without it an implementation that always reports 0 would pass.
  Offline: no live provider, model, network or clock. No real publisher appears in any assertion.
*/
const CLEARED_FEED = {
  sourceId: 'feed:r96-test-cleared',
  displayName: 'R96 Test Cleared Publisher',
  countryCode: 'KE',
  sourceType: 'NEWS_PROVIDER',
  feedUrl: 'https://cleared-r96.example/feed',
  canonicalHost: 'cleared-r96.example',
  language: 'en',
  enabled: false,
  provenanceNote: 'TEST ONLY — R96 W-5 positive control.',
  verifiedAt: '2026-10-15',
  rights: { state: 'CLEARED', evidence: 'TEST ONLY' },
} as unknown as FeedSourceEntry;
beforeAll(() => {
  __setReaderRightsFixtureModeForTests(true);
  __setReaderRightsTestFeeds([...FEED_SOURCES, CLEARED_FEED]);
});
afterAll(() => {
  __setReaderRightsTestFeeds(null);
  __setReaderRightsFixtureModeForTests(false);
});
const WINDOW = { statedPeriod: 'this week', from: '2026-10-12T00:00:00.000Z', to: '2026-10-16T00:00:00.000Z' } as const;
const art = (id: string, publishedAt: string | undefined, basis: 'publisher' | undefined = 'publisher'): NewsArticle =>
  ({ id, title: 'Fuel prices adjusted again', summary: 'A fuel price change was announced in the market.',
     url: `https://${id}.example/${id}`, sourceId: `src-${id}`, sourceName: `Outlet ${id}`, category: 'business',
     sourcesCount: 1, publishedAt, publishedAtBasis: basis, sourceLanguage: 'en' }) as unknown as NewsArticle;
function stub(id: string, arts: readonly NewsArticle[], fail?: Error): NewsProvider {
  return { id, displayName: id, isMock: false, capabilities: ['search', 'topHeadlines', 'category'],
    async search() { if (fail) throw fail; return [...arts]; },
    async topHeadlines() { if (fail) throw fail; return [...arts]; },
    async category() { return []; },
    async health() { return { providerId: id, displayName: id, status: 'ok' as const, checkedAt: '' }; } } as unknown as NewsProvider;
}
async function svc(primary: NewsProvider[], fallback: NewsProvider[] = []) {
  const persistence = { persistMany: jest.fn().mockResolvedValue(new Map()), findRecent: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue(null), findRetainedByUrl: jest.fn().mockResolvedValue(null),
    findRecentByCountry: jest.fn().mockResolvedValue([]), persistCountryRelations: jest.fn().mockResolvedValue(undefined) };
  const all = [...primary, ...fallback];
  const m = await Test.createTestingModule({ providers: [NewsService, CountryNewsService,
    { provide: ConfigService, useValue: { get: () => undefined } }, { provide: NEWS_PROVIDERS, useValue: all },
    { provide: ALL_NEWS_PROVIDERS, useValue: all }, { provide: FALLBACK_NEWS_PROVIDERS, useValue: fallback },
    { provide: ArticlePersistenceService, useValue: persistence }] }).compile();
  const model: AnalysisProvider = { id: 'openai', displayName: 'm', isMock: false,
    analyzeNews: async (_i: AnalysisProviderInput) => ({ summary: 'x', keyPoints: [], sentiment: 'neutral', topics: [] } as never) };
  const config = { get: () => ({ maxArticles: 8, maxArticleChars: 1200, timeoutMs: 20000, totalBudgetMs: ANALYSIS_TOTAL_BUDGET_MS,
    cacheTtlSeconds: 0, openAiApiKey: undefined, openAiModel: 'f', executionMode: 'development' as const, retryAttempts: 1,
    retryBaseDelayMs: 1, maxCompletionTokens: 2000 }) } as unknown as AnalysisConfigService;
  return new AnalysisService(m.get(NewsService), m.get(CountryNewsService), model, config);
}
/* a report from the test-only CLEARED feed (admissible) or from an uncleared provider slug (inadmissible) */
const cleared = (id: string, publishedAt: string): NewsArticle =>
  ({ ...art(id, publishedAt), sourceId: CLEARED_FEED.sourceId, url: `https://cleared-r96.example/${id}` }) as NewsArticle;
const uncleared = (id: string, publishedAt: string): NewsArticle => art(id, publishedAt);
const IN_DAY = '2026-10-14T06:00:00.000Z';
const OUT_DAY = '2026-10-01T06:00:00.000Z';

describe('E1 R96 W-5 — the reader window count is rights-partitioned; a rights hold is never a date filter', () => {
  const run = async (arts: NewsArticle[]) => {
    const service = await svc([stub('gnews', arts)]);
    const r = await service.analyzeNews('fuel prices', 'en', undefined, undefined, undefined, undefined,
      { reportingWindow: WINDOW } as never);
    return {
      ids: (r.articles ?? []).map((a) => a.id),
      excluded: r.retrievalContext?.reportingWindow?.excludedOutsideWindow ?? null,
      unevaluated: r.retrievalContext?.reportingWindow?.exclusionsUnevaluated ?? false,
      rightsCount: r.retrievalContext?.rightsExcluded?.count ?? 0,
      observed: observedRetrievalOf(r as never).retrievalOutcome,
      incomplete: retrievalIncomplete(r as never),
      json: JSON.stringify(r.retrievalContext ?? {}),
    };
  };

  it('POSITIVE CONTROL — a CLEARED in-window report is admitted and a CLEARED out-of-window one is counted: reader count 1', async () => {
    const o = await run([cleared('c-in', IN_DAY), cleared('c-out', OUT_DAY)]);
    expect(o.ids).toEqual(['c-in']);
    expect(o.excluded).toBe(1);
    expect(o.observed).toBe('MATCHED');
  });

  it('POSITIVE CONTROL — only a CLEARED out-of-window report: reader count 1, ALL_FILTERED (the period wording applies)', async () => {
    const o = await run([cleared('c-out', OUT_DAY)]);
    expect(o.excluded).toBe(1);
    expect(o.rightsCount).toBe(0);
    expect(o.observed).toBe('ALL_FILTERED');
    expect(o.incomplete).toBe(false);
  });

  it('BITING CASE — every report out of window AND rights-inadmissible: reader count 0, RIGHTS_WITHHELD, never the period wording or COMPLETED_NO_MATCH', async () => {
    const o = await run([uncleared('u-out-1', OUT_DAY), uncleared('u-out-2', OUT_DAY)]);
    expect(o.excluded).toBe(0);
    expect(o.rightsCount).toBe(2);
    expect(o.observed).toBe('RIGHTS_WITHHELD');
    expect(o.observed).not.toBe('ALL_FILTERED');
    expect(o.observed).not.toBe('COMPLETED_NO_MATCH');
  });

  it('MIXED — a CLEARED and an uncleared report, both out of window: count 1 (admissible only); the uncleared one is rights-withheld', async () => {
    const o = await run([cleared('c-out', OUT_DAY), uncleared('u-out', OUT_DAY)]);
    expect(o.excluded).toBe(1);
    expect(o.rightsCount).toBe(1);
    expect(o.observed).toBe('RIGHTS_WITHHELD'); /* rights keeps precedence (4de7dfa ordering, unchanged) */
  });

  it('the unrestricted retrieval count never reaches the reader JSON (W-4); no ids are serialised', async () => {
    const o = await run([cleared('c-out', OUT_DAY), uncleared('u-out', OUT_DAY)]);
    expect(o.json).not.toMatch(/excludedOutsideWindowRetrieved|windowExcludedIds|windowExcludedSources/);
    /* no excluded report id is serialised (rightsExcluded.sourceIds is E1-R96-W-2, tracked separately) */
    expect(o.json).not.toContain('"u-out"');
    expect(o.unevaluated).toBe(false); /* every exclusion here had an article object */
  });
});
