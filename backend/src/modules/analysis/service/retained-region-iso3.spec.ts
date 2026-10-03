import type { AnalysisConfigService } from '../config/analysis-config.service';
import type { AnalysisProviderInput } from '../interfaces/analysis-provider.interface';
import { MockAnalysisProvider } from '../providers/mock-analysis.provider';
import { AnalysisService } from './analysis.service';
import { attachProviderFailures } from '../../news/news.service';
import { EAST_AFRICA, resolveRegionMembers } from '../region/declared-regions';
import type { NewsArticle, NewsResponse } from '@globalnews-ai/shared';

/**
 * CTO CHECKPOINT 5 §4 — the retained-evidence fallback reads by ISO3, the ArticleCountry key.
 *
 * `retrieveRetainedForRegion` called `findRetainedByCountry(member.iso2, …)`; the relation is keyed
 * by ISO3, so the regional, relational-regional and per-side comparison fallbacks admitted no
 * retained evidence at all (same storage-key class as Ask defect A). The persistence contract
 * itself (ISO3 finds, ISO2 does not) is pinned on real PostgreSQL in
 * news/persistence/retained-country-key.postgres.spec.ts; this spec pins the CALLERS.
 */
const KENYA_STORED: NewsArticle = {
  id: 'ke-stored',
  title: 'Kenya central bank holds rate as inflation eases',
  summary: 'Kenyan officials in Nairobi said inflation eased while the policy rate was held.',
  url: 'https://example.org/ke-stored',
  sourceId: 'wire',
  sourceName: 'International Wire',
  category: 'business',
  sourcesCount: 1,
  publishedAt: new Date(Date.now() - 6 * 3600_000).toISOString(),
  publishedAtBasis: 'publisher',
  countryCode: 'KE',
} as NewsArticle;

function failed(): NewsResponse {
  return attachProviderFailures(
    {
      articles: [],
      totalResults: 0,
      providers: [],
      dataMode: 'unavailable',
      fallbackReason: 'provider-error',
      generatedAt: new Date().toISOString(),
    } as NewsResponse,
    [{ providerId: 'gnews', kind: 'rate-limited' }],
  );
}

function harness() {
  const findRetainedByCountry = jest.fn(async (code: string) =>
    code === 'KEN' ? [KENYA_STORED] : [],
  );
  const news = {
    search: jest.fn(async () => failed()),
    topHeadlines: jest.fn(async () => failed()),
    findArticleById: jest.fn(async () => null),
    findRetainedByCountry,
    findRetainedByQuery: jest.fn(async () => []),
  };
  const analyzeNews = jest.fn(async (input: AnalysisProviderInput) =>
    new MockAnalysisProvider().analyzeNews(input),
  );
  const country = { getCountryNews: jest.fn(async () => failed()) };
  const config = {
    get: () => ({
      maxArticles: 8,
      maxArticleChars: 1200,
      timeoutMs: 20000,
      totalBudgetMs: 60000,
      cacheTtlSeconds: 0,
      openAiModel: 'test',
      executionMode: 'development',
      retryAttempts: 0,
      maxCompletionTokens: 2000,
    }),
  } as unknown as AnalysisConfigService;
  const service = new AnalysisService(
    news as never,
    country as never,
    { id: 'test', displayName: 'Test', isMock: true, analyzeNews },
    config,
  );
  return { service, news, country, analyzeNews };
}

describe('CTO checkpoint 5 §4 — retained regional fallback reads by ISO3', () => {
  it('the regional fallback asks for every member by ISO3 and never by ISO2', async () => {
    const h = harness();
    const members = resolveRegionMembers(EAST_AFRICA);
    const read = await (
      h.service as unknown as {
        retrieveRetainedForRegion(m: unknown): Promise<NewsArticle[]>;
      }
    ).retrieveRetainedForRegion(members);
    const asked = h.news.findRetainedByCountry.mock.calls.map(([code]) => code);
    expect(asked.sort()).toEqual(members.map((m) => m.iso3).sort());
    expect(asked.every((code) => /^[A-Z]{3}$/.test(code))).toBe(true);
    /* only the member's own retained rows come back: no unrelated country evidence */
    expect(read.map((a) => a.id)).toEqual(['ke-stored']);
  });

  it('provider failure → the regional question admits the relevant stored evidence, disclosed as retained', async () => {
    const h = harness();
    const result = await h.service.analyzeNews('What is happening in East Africa?', 'en');
    expect(h.news.findRetainedByCountry.mock.calls.length).toBeGreaterThan(0);
    expect(h.news.findRetainedByCountry.mock.calls.every(([code]) => /^[A-Z]{3}$/.test(code))).toBe(
      true,
    );
    expect(result.articles.map((a) => a.id)).toContain('ke-stored');
    /* disclosed: the answer did not come from live retrieval */
    expect(result.retrievalContext.dataMode).not.toBe('live');
    expect(result.retrievalContext.outcome).toMatch(/RETAINED|DEGRADED|PARTIAL/);
  });

  it('no provider retry is introduced: each live call happens at most once per member', async () => {
    const h = harness();
    await h.service.analyzeNews('What is happening in East Africa?', 'en');
    const live = [...h.news.search.mock.calls, ...h.news.topHeadlines.mock.calls];
    const members = resolveRegionMembers(EAST_AFRICA).length;
    expect(live.length + h.country.getCountryNews.mock.calls.length).toBeLessThanOrEqual(
      members + 1,
    );
  });

  it('the relational regional fallback reads by ISO3 through the same path and stays relationship-gated', async () => {
    const h = harness();
    const read = await (
      h.service as unknown as {
        retrieveRetainedRelationalForRegion(
          relation: { x: string; y: string },
          region: unknown,
          named: unknown[],
        ): Promise<NewsArticle[]>;
      }
    ).retrieveRetainedRelationalForRegion({ x: 'Iran', y: 'East Africa' }, EAST_AFRICA, []);
    expect(h.news.findRetainedByCountry.mock.calls.every(([code]) => /^[A-Z]{3}$/.test(code))).toBe(
      true,
    );
    /* a Kenya rate story says nothing about Iran: the relationship gate keeps it out */
    expect(read).toEqual([]);
  });
});
