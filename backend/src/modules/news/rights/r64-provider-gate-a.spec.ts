import { ANALYSIS_TOTAL_BUDGET_MS, type NewsArticle } from '@globalnews-ai/shared';
import { ConfigService } from '@nestjs/config';
import { FEED_SOURCES, type FeedSourceEntry } from '../providers/feed-source-registry';
import { NewsService } from '../news.service';
import { CountryNewsService } from '../country/country-news.service';
import { ProviderExecutionRegistry } from '../telemetry/provider-execution.registry';
import { NewsStartupConfigurationError, NewsStartupValidator } from '../startup/news-startup-validator';
import { EvidenceDiscoveryService } from '../evidence/evidence-discovery.service';
import { __setReaderRightsFixtureModeForTests, __setReaderRightsTestFeeds } from './reader-rights';
import { __setProviderAdmissionTestFeeds, admittedFeedSources, providerAdmission } from './provider-admission';
import { AnalysisService } from '../../analysis/service/analysis.service';
import type { AnalysisConfigService } from '../../analysis/config/analysis-config.service';
import { MockAnalysisProvider } from '../../analysis/providers/mock-analysis.provider';

/*
  MASTER CTO R62 / R64 · #96 — GATE A: no provider request without a recorded per-use right.
  Every provider double below FAILS THE TEST IF CALLED unless it is the admitted control. Offline:
  no network, no provider, no model, no database. E1 A-1…A-5 map to GA-1…GA-5.
*/
const CLEARED_FEED = {
  sourceId: 'feed:r64-test-cleared',
  displayName: 'R64 Test Cleared Publisher',
  countryCode: 'KE',
  sourceType: 'NEWS_PROVIDER',
  feedUrl: 'https://cleared.example/feed',
  canonicalHost: 'cleared.example',
  language: 'en',
  enabled: false,
  provenanceNote: 'TEST ONLY — R64 Gate A positive control.',
  verifiedAt: '2026-10-14',
  rights: { state: 'CLEARED', evidence: 'TEST ONLY' },
} as unknown as FeedSourceEntry;
const UNCLEARED_FEED = { ...CLEARED_FEED, sourceId: 'feed:r64-test-uncleared', rights: { state: 'UNRESOLVED', evidence: 'TEST ONLY' } } as unknown as FeedSourceEntry;

const article = (id: string, sourceId: string): NewsArticle => ({
  id,
  title: `Kenya budget ${id}`,
  summary: 'Kenya budget summary',
  url: `https://news.example/${id}`,
  sourceId,
  sourceName: 'Publisher',
  category: 'world',
  sourcesCount: 1,
  countryCode: 'KE',
  publishedAt: new Date(Date.now() - 3_600_000).toISOString(),
  publishedAtBasis: 'publisher',
});

/** A provider double that fails the test if any method is called. */
const forbidden = (id: string, isMock = false) => {
  const fail = (m: string) => jest.fn(() => {
    throw new Error(`GATE A BREACH: ${id}.${m} was called`);
  });
  return { id, displayName: id, isMock, capabilities: ['search', 'top-headlines', 'category'], search: fail('search'), topHeadlines: fail('topHeadlines'), category: fail('category'), health: jest.fn() };
};
const calls = (p: ReturnType<typeof forbidden>) => p.search.mock.calls.length + p.topHeadlines.mock.calls.length + p.category.mock.calls.length;
const persistence = () => ({
  persistMany: jest.fn().mockResolvedValue(new Map()),
  findRecent: jest.fn().mockResolvedValue([]),
  findById: jest.fn().mockResolvedValue(null),
  findByUrl: jest.fn().mockResolvedValue(null),
  findRecentByCountry: jest.fn().mockResolvedValue([]),
  findRetainedByUrl: jest.fn().mockResolvedValue(null),
  persistCountryRelations: jest.fn().mockResolvedValue(undefined),
});
function newsService(primary: object[], fallback: object[] = []): { service: NewsService; registry: ProviderExecutionRegistry } {
  const all = [...primary, ...fallback];
  const service = new NewsService([...primary, ...fallback] as never, all as never, fallback as never, persistence() as never);
  const registry = new ProviderExecutionRegistry();
  (service as unknown as { executions: ProviderExecutionRegistry }).executions = registry;
  return { service, registry };
}

beforeEach(() => {
  __setReaderRightsFixtureModeForTests(false);
  __setReaderRightsTestFeeds(null);
  __setProviderAdmissionTestFeeds(null);
});
afterAll(() => {
  __setReaderRightsTestFeeds(null);
  __setProviderAdmissionTestFeeds(null);
  __setReaderRightsFixtureModeForTests(true);
});

describe('GA-1 (E1 A-1) · the reviewed registry has no CLEARED feed → NO provider is started on any public route', () => {
  it('the reviewed registry still holds no CLEARED feed (the premise of every GA-1 case)', () => {
    expect(FEED_SOURCES.filter((f) => f.rights.state === 'CLEARED')).toEqual([]);
  });

  it.each([
    ['GET /news/search', (s: NewsService) => s.search('kenya budget', 10)],
    ['GET /news/top-headlines', (s: NewsService) => s.topHeadlines(10)],
    ['GET /news/category/:category', (s: NewsService) => s.byCategory('business', 10)],
  ])('%s: GNews, GDELT, the mock and a newly registered provider are never called; "not searched", never "no news"', async (_route, run) => {
    const gnews = forbidden('gnews');
    const gdelt = forbidden('gdelt-doc');
    const next = forbidden('some-new-provider');
    const { service, registry } = newsService([gnews, next], [gdelt]);
    const out = (await run(service)) as unknown as Record<string, unknown>;
    expect(calls(gnews) + calls(gdelt) + calls(next)).toBe(0);
    /* nothing was executed, so nothing was counted against any quota */
    expect(registry.totalExecutions()).toBe(0);
    expect(out.articles).toEqual([]);
    expect(out.dataMode).toBe('unavailable');
    expect(out.acquisition).toEqual({ state: 'SOURCE_RIGHTS_UNCLEARED', notSearched: ['gnews', 'some-new-provider', 'gdelt-doc'] });
  });

  it('a production process with NO usable key gets the mock as its only provider: it is not started and the answer is never "mock"', async () => {
    const mock = forbidden('mock', true);
    const { service } = newsService([mock]);
    const out = (await service.topHeadlines(10)) as unknown as Record<string, unknown>;
    expect(calls(mock)).toBe(0);
    expect(out.dataMode).toBe('unavailable');
    expect(out.articles).toEqual([]);
  });

  it('GET /news/country/:code (CountryNewsService over the gated NewsService): no provider is started', async () => {
    const gnews = forbidden('gnews');
    const { service } = newsService([gnews]);
    const country = new CountryNewsService(service, new ConfigService({}), persistence() as never);
    await country.getCountryNews('KEN');
    expect(calls(gnews)).toBe(0);
  });

  it('the social discovery lanes are not started either (configured but not admitted → unavailable)', async () => {
    const search = jest.fn(() => {
      throw new Error('GATE A BREACH: social lane called');
    });
    const lane = { id: 'x-recent', configured: () => true, search };
    const out = await new EvidenceDiscoveryService([lane] as never).discover('kenya');
    expect(search).not.toHaveBeenCalled();
    expect(out.lanes).toEqual([{ lane: 'x-recent', status: 'unavailable' }]);
  });
});

describe('GA-1 · Ask / POST /analysis/news: retrieval reaches the gated NewsService and no provider is started', () => {
  it('a news question: no provider call, no model call, and it is never answered as "no reporting"', async () => {
    const gnews = forbidden('gnews');
    const { service } = newsService([gnews]);
    const country = new CountryNewsService(service, new ConfigService({}), persistence() as never);
    const model = new MockAnalysisProvider();
    const spy = jest.spyOn(model, 'analyzeNews');
    const config = {
      get: () => ({
        maxArticles: 8, maxArticleChars: 1200, timeoutMs: 20000, totalBudgetMs: ANALYSIS_TOTAL_BUDGET_MS, cacheTtlSeconds: 0,
        openAiApiKey: undefined, openAiModel: 'gpt-4o-mini', executionMode: 'development' as const, retryAttempts: 2, retryBaseDelayMs: 300, maxCompletionTokens: 2000,
      }),
    } as unknown as AnalysisConfigService;
    const result = await new AnalysisService(service, country, model, config).analyzeNews('What is happening in Kenya this week?');
    expect(calls(gnews)).toBe(0);
    expect(spy).not.toHaveBeenCalled();
    expect(result.articles).toEqual([]);
    expect(result.analysisError).toMatch(/^Current reporting was not searched: no news source is cleared for use here./);
    expect(result.analysisError).not.toMatch(/No related articles/);
    expect(result.retrievalContext.evidenceState).toBe('degraded-fallback');
    /* the provider was not searched: recorded as unavailable (incomplete), never a completed zero */
    expect((result.retrievalContext as { providerFailures?: unknown[] }).providerFailures ?? []).toEqual(
      expect.arrayContaining([expect.objectContaining({ providerId: 'gnews', kind: 'unavailable' })]),
    );
  });
});

describe('GA-2 (E1 A-2) · positive control: an admitted publisher-feed lane IS started and its CLEARED item is served', () => {
  it('with one CLEARED feed recorded, the feed lane runs and GNews beside it still does not', async () => {
    __setProviderAdmissionTestFeeds([...FEED_SOURCES, CLEARED_FEED]);
    __setReaderRightsTestFeeds([...FEED_SOURCES, CLEARED_FEED]);
    const gnews = forbidden('gnews');
    const feed = {
      id: 'rss-feeds', displayName: 'Publisher Feeds', isMock: false, capabilities: ['search', 'top-headlines'],
      search: jest.fn().mockResolvedValue([article('c1', CLEARED_FEED.sourceId)]),
      topHeadlines: jest.fn().mockResolvedValue([article('c1', CLEARED_FEED.sourceId)]),
      category: jest.fn(), health: jest.fn(),
    };
    const { service } = newsService([gnews, feed]);
    const out = (await service.topHeadlines(10)) as unknown as Record<string, unknown>;
    expect(feed.topHeadlines).toHaveBeenCalledTimes(1);
    expect(calls(gnews)).toBe(0);
    expect((out.articles as NewsArticle[]).map((a) => a.id)).toEqual(['c1']);
    expect(out.acquisition).toBeUndefined();
  });

  it('per feed, never inherited: only a feed whose OWN entry is CLEARED is fetched', () => {
    __setProviderAdmissionTestFeeds([...FEED_SOURCES, CLEARED_FEED, UNCLEARED_FEED]);
    expect(admittedFeedSources([CLEARED_FEED, UNCLEARED_FEED, ...FEED_SOURCES]).map((f) => f.sourceId)).toEqual([CLEARED_FEED.sourceId]);
  });

  it('a CLEARED entry admits the feed lane only; no other provider id is admitted by it', () => {
    __setProviderAdmissionTestFeeds([...FEED_SOURCES, CLEARED_FEED]);
    expect(providerAdmission({ id: 'rss-feeds' })).toEqual({ admitted: true });
    for (const id of ['gnews', 'gdelt-doc', 'gdelt', 'event-registry', 'x-recent', 'youtube', 'some-new-provider']) {
      expect(providerAdmission({ id }).admitted).toBe(false);
    }
    expect(providerAdmission({ id: 'mock', isMock: true })).toEqual({ admitted: false, reason: 'MOCK_NOT_PERMITTED' });
  });
});

describe('GA-4 (E1 A-4) · allowlist polarity: an unknown provider is inadmissible by default', () => {
  it.each(['gnews', 'gdelt-doc', 'brand-new-provider-2027'])('"%s" → NO_RECORDED_RIGHT', (id) => {
    expect(providerAdmission({ id })).toEqual({ admitted: false, reason: 'NO_RECORDED_RIGHT' });
  });
  it('the feed lane without any CLEARED feed → NO_CLEARED_FEED', () => {
    expect(providerAdmission({ id: 'rss-feeds' })).toEqual({ admitted: false, reason: 'NO_CLEARED_FEED' });
  });
});

describe('GA-5 (E1 A-5 as amended by CTO R62/R64) · boot no longer needs the Free GNews key', () => {
  /* a plain stub: Nest ConfigService reads process.env first, where Jest sets NODE_ENV=test */
  const validator = (env: Record<string, string>) => new NewsStartupValidator({ get: (k: string) => env[k] } as unknown as ConfigService);
  it('production with NO usable key and no CLEARED feed boots (no-permitted-news mode)', () => {
    expect(() => validator({ NODE_ENV: 'production' }).onApplicationBootstrap()).not.toThrow();
    expect(() => validator({ NODE_ENV: 'production', GNEWS_API_KEY: '   ' }).onApplicationBootstrap()).not.toThrow();
  });
  it('production with the key configured still boots, and GNews is reported as not admitted', () => {
    expect(() => validator({ NODE_ENV: 'production', GNEWS_API_KEY: 'k'.repeat(32) }).onApplicationBootstrap()).not.toThrow();
    expect(providerAdmission({ id: 'gnews' }).admitted).toBe(false);
  });
  it('outside enforcement (Jest fixture mode only) the original refusal is unchanged', () => {
    __setReaderRightsFixtureModeForTests(true);
    expect(() => validator({ NODE_ENV: 'production' }).onApplicationBootstrap()).toThrow(NewsStartupConfigurationError);
  });
});
