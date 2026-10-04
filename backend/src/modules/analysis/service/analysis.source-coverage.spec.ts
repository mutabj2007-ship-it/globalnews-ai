import { ANALYSIS_TOTAL_BUDGET_MS } from '@globalnews-ai/shared';
import type { CountryNewsResponse, NewsArticle, NewsResponse } from '@globalnews-ai/shared';
import { AnalysisService } from './analysis.service';
import type { AnalysisProvider } from '../interfaces';
import { AnalysisConfigService } from '../config/analysis-config.service';

/**
 * T1 COVERAGE TRUTHFULNESS — retrievalContext.sourceCoverage. (Fixtures copied
 * from analysis.geo-precision.spec.ts.)
 *
 * ORIGINAL FIXTURE NOTE — GEO-PRECISION — G3, THE ANALYSIS LOCATION SCAN.
 *
 * The shrinking scan tries the longest prefix of a captured phrase first and
 * gives up a word at a time. Measured before this repair:
 *
 *     resolveCountryByAnyIdentifier('Niger State') -> no match
 *     resolveCountryByAnyIdentifier('Niger')       -> Niger (NER)
 *
 * so "in Niger State" failed at two words, discarded "State", matched the bare
 * head word, and routed retrieval into the sovereign Niger country feed — a
 * second, independent instance of the same defect, on a different code path
 * from the article annotator.
 *
 * These tests observe the ROUTING DECISION, which is the only externally
 * visible consequence: a country-branch request calls CountryNewsService, a
 * generic one does not.
 */

function makeArticle(overrides: Partial<NewsArticle> = {}): NewsArticle {
  return {
    id: 'id',
    title: 'title',
    summary: 'summary',
    url: 'https://example.com',
    sourceId: 'src',
    sourceName: 'Source',
    category: 'world',
    sourcesCount: 1,
    publishedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeSearchResponse(articles: NewsArticle[]): NewsResponse {
  return {
    articles,
    totalResults: articles.length,
    providers: ['mock-wire'],
    dataMode: 'mock',
    generatedAt: new Date().toISOString(),
  };
}

function makeCountryResponse(articles: NewsArticle[]): CountryNewsResponse {
  return {
    countryCode: 'KEN',
    countryName: 'Kenya',
    articles,
    totalResults: articles.length,
    providers: ['mock-wire'],
    dataMode: 'mock',
    feedTier: 'delayed',
    providerDisplayName: 'Mock',
    generatedAt: new Date().toISOString(),
  };
}

function makeConfigService(): AnalysisConfigService {
  return {
    get: () => ({
      maxArticles: 8,
      maxArticleChars: 1200,
      timeoutMs: 20000,
      /*
        REV B — STATED, NOT INHERITED. AnalysisService arms its total response
        deadline from this field. Every double in this repository predates it, so
        each one silently supplied `undefined`; `withResponseDeadline` now resolves
        that to the shared authority rather than to an accidental zero, but a test
        that exercises the real service should say which budget it is running
        under rather than rely on a fallback. This is the shipped value, so no
        existing timing expectation changes.
      */
      totalBudgetMs: ANALYSIS_TOTAL_BUDGET_MS,
      cacheTtlSeconds: 300,
      openAiApiKey: undefined,
      openAiModel: 'gpt-4o-mini',
      executionMode: 'development' as const,
      retryAttempts: 2,
      retryBaseDelayMs: 300,
      maxCompletionTokens: 2000,
    }),
  } as unknown as AnalysisConfigService;
}

function buildService() {
  const search = jest.fn().mockResolvedValue(makeSearchResponse([]));
  const topHeadlines = jest.fn().mockResolvedValue(makeSearchResponse([]));
  const findArticleById = jest.fn().mockResolvedValue(null);
  const getCountryNews = jest.fn().mockResolvedValue(makeCountryResponse([]));

  const provider: AnalysisProvider = {
    id: 'openai',
    displayName: 'OpenAI',
    isMock: false,
    analyzeNews: jest.fn().mockRejectedValue(new Error('not exercised in this test')),
  };

  const service = new AnalysisService(
    { search, topHeadlines, findArticleById } as never,
    { getCountryNews } as never,
    provider,
    makeConfigService(),
  );

  return { service, search, getCountryNews };
}

describe('T1 · analysis retrievalContext carries the canonical coverage fact', () => {
  it('a country question stamps sourceCoverage for that country — no extra provider call', async () => {
    const { service, getCountryNews, search } = buildService();

    const response = await service.analyzeNews('What is happening in Kenya?');

    expect(getCountryNews).toHaveBeenCalledTimes(1);
    expect(response.retrievalContext.countryCode).toBe('KEN');
    expect(response.retrievalContext.sourceCoverage).toMatchObject({
      iso3: 'KEN',
      governed: true,
      state: 'COVERAGE_GAP',
      notice: 'LOCAL_COVERAGE_ABSENT',
    });
    /* The coverage fact itself issued no search. */
    expect(search.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it('an anchored ISO2 country resolves to its ISO3 coverage', async () => {
    const anchor = makeArticle({
      id: 'anchor-au',
      url: 'https://example.com/anchor',
      title: 'Hotel worker charged with sexually assaulting Australian three-year-old in Penang',
      summary: 'A hotel worker has been charged in Penang.',
      countryCode: 'AU',
      countryName: 'Australia',
    });
    const service = new AnalysisService(
      {
        search: jest.fn().mockResolvedValue(makeSearchResponse([])),
        topHeadlines: jest.fn(),
        findArticleById: jest.fn().mockResolvedValue(anchor),
      } as never,
      { getCountryNews: jest.fn() } as never,
      {
        id: 'openai',
        displayName: 'OpenAI',
        isMock: false,
        analyzeNews: jest.fn().mockRejectedValue(new Error('not exercised')),
      },
      makeConfigService(),
    );
    const response = await service.analyzeNews(anchor.title, 'en', {
      title: anchor.title,
      articleId: 'anchor-au',
      countryCode: 'AU',
    });
    expect(response.retrievalContext.sourceCoverage).toMatchObject({
      iso3: 'AUS',
      governed: false,
      state: 'COVERAGE_GAP',
    });
  });

  it('no established country, no sourceCoverage field', async () => {
    const { service } = buildService();
    const response = await service.analyzeNews('What are the latest developments in semiconductors?');
    expect(response.retrievalContext.countryCode).toBeUndefined();
    expect(response.retrievalContext).not.toHaveProperty('sourceCoverage');
  });
});
