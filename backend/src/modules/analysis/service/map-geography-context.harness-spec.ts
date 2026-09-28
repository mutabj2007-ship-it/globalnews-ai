import type { CountryNewsResponse, NewsArticle, NewsResponse } from '@globalnews-ai/shared';
import { ANALYSIS_TOTAL_BUDGET_MS, resolveCountryByAnyIdentifier } from '@globalnews-ai/shared';

import type { AnalysisProvider } from '../interfaces';
import type { AnalysisConfigService } from '../config/analysis-config.service';
import { AnalysisService } from './analysis.service';
import { scoreCountryRelevance } from '../../news/country/country-relevance.util';

/**
 * MAP ASK GEOGRAPHY CONTEXT R1 — the landed service harness, moved out of
 * map-geography-context.spec.ts unchanged so G's context-integrity matrix and the
 * ASK R2 Gate H qualification reuse the ONE definition of the seam under test
 * (G matrix harness 'service': 'REUSE IT. Do not build a second harness').
 *
 * The shipped AnalysisService runs for real. NewsService and CountryNewsService are
 * stubbed at their own boundaries; the country stub applies the REAL country-relevance
 * gate. The analysis provider records what it was given and then THROWS.
 * Test-only: the `-spec.ts` suffix keeps it out of the production build.
 */
export function harness(corpus: NewsArticle[] = []) {
  const countryCalls: string[] = [];
  const searchCalls: string[] = [];
  const providerInputs: unknown[] = [];

  const newsService = {
    search: jest.fn(async (query: string): Promise<NewsResponse> => {
      searchCalls.push(query);
      return {
        articles: [],
        totalResults: 0,
        providers: ['gnews'],
        dataMode: 'live',
        generatedAt: new Date().toISOString(),
      } as NewsResponse;
    }),
    topHeadlines: jest.fn(
      async (): Promise<NewsResponse> =>
        ({
          articles: [],
          totalResults: 0,
          providers: ['gnews'],
          dataMode: 'live',
          generatedAt: new Date().toISOString(),
        }) as NewsResponse,
    ),
    findArticleById: jest.fn(async () => null),
    findRetainedArticleByUrl: jest.fn(async () => null),
    findRetainedByCountry: jest.fn(async () => []),
    findRetainedByQuery: jest.fn(async () => []),
  };

  const countryNewsService = {
    getCountryNews: jest.fn(async (identifier: string): Promise<CountryNewsResponse> => {
      countryCalls.push(identifier);
      const country = resolveCountryByAnyIdentifier(identifier);
      const articles = country
        ? corpus.filter((candidate) => scoreCountryRelevance(candidate, country).isRelevant)
        : [];
      return {
        countryCode: country?.iso3 ?? identifier,
        countryName: country?.name ?? identifier,
        articles,
        totalResults: articles.length,
        providers: ['gnews'],
        dataMode: 'live',
        generatedAt: new Date().toISOString(),
      } as unknown as CountryNewsResponse;
    }),
  };

  const provider: AnalysisProvider = {
    id: 'mock-analysis',
    displayName: 'Mock',
    isMock: true,
    analyzeNews: jest.fn(async (...args: unknown[]) => {
      providerInputs.push(args);
      throw new Error('analysis provider reached');
    }),
  };

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

  return {
    service: new AnalysisService(
      newsService as never,
      countryNewsService as never,
      provider,
      config,
    ),
    countryCalls,
    searchCalls,
    providerInputs,
    provider,
  };
}
