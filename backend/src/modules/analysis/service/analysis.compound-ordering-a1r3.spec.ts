/*
  P0 NEWS QUERY A1 R3 — COMPOUND ORDERING (integrator). The route is decided before the generic
  string is judged:
    a valid compound plan        → its bounded searches, whatever the unused generic string is;
    no plan, a sendable query    → the ordinary generic search;
    neither                      → no provider call, the honest non-retrievable state.
  Real AnalysisService, fixture providers; no live provider and no model call.
*/
import type { CountryNewsResponse, NewsResponse } from '@globalnews-ai/shared';
import { ANALYSIS_TOTAL_BUDGET_MS, resolveCountryByAnyIdentifier } from '@globalnews-ai/shared';
import type { AnalysisProvider } from '../interfaces';
import type { AnalysisConfigService } from '../config/analysis-config.service';
import { makeGenericProviderQuery } from '../query/news-query-reduction.util';
import { AnalysisService } from './analysis.service';

jest.setTimeout(60000);

const GNEWS_MAX = 200;

function harness() {
  const sent: string[] = [];
  const empty = (): NewsResponse =>
    ({ articles: [], totalResults: 0, providers: ['gnews'], dataMode: 'live', generatedAt: new Date().toISOString() }) as unknown as NewsResponse;
  const newsService = {
    search: jest.fn(async (query: string) => {
      sent.push(query);
      return empty();
    }),
    topHeadlines: jest.fn(async () => empty()),
    findArticleById: jest.fn(async () => null),
    findRetainedByCountry: jest.fn(async () => []),
    findRetainedByQuery: jest.fn(async () => []),
    findRetainedHeadlines: jest.fn(async () => []),
  };
  const countryNewsService = {
    getCountryNews: jest.fn(async (identifier: string): Promise<CountryNewsResponse> => {
      const country = resolveCountryByAnyIdentifier(identifier);
      return { countryCode: country?.iso3 ?? identifier, countryName: country?.name ?? identifier, articles: [], totalResults: 0, providers: ['gnews'], dataMode: 'live', generatedAt: new Date().toISOString() } as unknown as CountryNewsResponse;
    }),
  };
  const provider: AnalysisProvider = { id: 'mock', displayName: 'Mock', isMock: true, analyzeNews: jest.fn() };
  const config = { get: () => ({ maxArticles: 8, maxArticleChars: 1200, timeoutMs: 20000, totalBudgetMs: ANALYSIS_TOTAL_BUDGET_MS, cacheTtlSeconds: 0, openAiApiKey: undefined, openAiModel: 'gpt-4o-mini', executionMode: 'development' as const, retryAttempts: 2, retryBaseDelayMs: 300, maxCompletionTokens: 2000 }) } as unknown as AnalysisConfigService;
  return { service: new AnalysisService(newsService as never, countryNewsService as never, provider, config), sent, provider };
}

/* a compound question (eastern DRC × security/humanitarian) whose generic string is over the GNews limit */
const COMPOUND =
  'What are the most recent verified security or territorial changes in eastern Democratic Republic of the Congo, and what effects on civilians or displacement are currently reported? Separate confirmed facts from analytical inference, identify important claims that remain disputed, distinguish event dates from publication dates, and cite independent local/regional, official, and international sources where available.';
/* no compound plan, no safe-reduction pattern, over the GNews limit */
const UNPLANNED_OVERLONG =
  'The interlocking consequence of every structural settlement remains an interlocking consequence of ' +
  'every structural settlement, and the interlocking consequence of every structural settlement ' +
  'continues to be an interlocking consequence of every structural settlement throughout.';

describe('A1 R3 compound ordering — route before verdict', () => {
  it('a compound plan runs its bounded searches even when the unused generic string is not safely reducible', async () => {
    expect(makeGenericProviderQuery(COMPOUND).outcome).toBe('NOT_SAFELY_REDUCIBLE');
    const h = harness();
    await h.service.analyzeNews(COMPOUND, 'en');
    expect(h.sent).toEqual(['eastern Congo', 'Congo', 'eastern Congo fighting', 'eastern Congo displaced']);
  });

  it('no plan and no sendable query: zero provider calls, the full question kept, a truthful not-attempted trace, no model call', async () => {
    expect(makeGenericProviderQuery(UNPLANNED_OVERLONG).outcome).toBe('NOT_SAFELY_REDUCIBLE');
    const h = harness();
    const response = await h.service.analyzeNews(UNPLANNED_OVERLONG, 'en');
    expect(h.sent).toEqual([]);
    expect(response.query).toBe(UNPLANNED_OVERLONG);
    expect(response.articles).toEqual([]);
    expect(response.retrievalContext?.outcome).toBe('NO_RELEVANT_EVIDENCE');
    expect(response.retrievalContext?.retrievalTrace?.sentQueries).toEqual([
      { role: 'PRIMARY', outcome: 'SKIPPED_NO_QUERY', query: null, lanes: [] },
    ]);
    expect(response.retrievalContext?.retrievalTrace?.aggregateOutcome).toBe('RETRIEVAL_NOT_ATTEMPTED');
    expect(h.provider.analyzeNews).not.toHaveBeenCalled();
  });

  it('a sendable generic query with no plan follows the ordinary path, never above the GNews limit', async () => {
    const h = harness();
    await h.service.analyzeNews(
      'What are the most significant recent economic security diplomatic social infrastructure and technological developments currently reshaping global supply chains, and how are disruptions influencing international trade relationships and long-term geopolitical stability, considering shifting alliances, emerging regulatory frameworks, and evolving multilateral cooperation efforts?',
      'en',
    );
    expect(h.sent[0]).toBe('global supply chains');
    for (const q of h.sent) expect(Array.from(q).length).toBeLessThanOrEqual(GNEWS_MAX);
  });
});
