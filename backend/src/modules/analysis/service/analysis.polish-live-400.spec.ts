import { ANALYSIS_TOTAL_BUDGET_MS } from '@globalnews-ai/shared';
import type { NewsArticle, NewsResponse } from '@globalnews-ai/shared';
import { AnalysisService } from './analysis.service';
import type { AnalysisProvider } from '../interfaces';
import { AnalysisConfigService } from '../config/analysis-config.service';
import { makeProviderSafeNewsQuery } from '../query/derive-generic-news-query.util';
import { scoreGenericRelevance } from '../../news/relevance/generic-relevance.util';
import { attachProviderFailures } from '../../news/news.service';

/**
 * R4 POLISH LIVE 400 — PL1..PL13, modelled on the EXACT live request.
 *
 * The request:   { query: "Polska, bezpieczeństwo", requestedLanguage: "pl" }
 * The failure:   GNews /top-headlines?lang=pl&q=Polska%2C+… -> HTTP 400
 *                then /search?lang=en with the same string -> HTTP 429
 *
 * The provider contract these tests encode is MEASURED, not assumed. The host
 * ran two probes, one variable each:
 *     /top-headlines lang=pl q="Polska bezpieczeństwo" -> 200
 *     /search        lang=en q="Polska bezpieczeństwo" -> 200
 * so the interior comma was the cause and the diacritics are accepted.
 */

const LIVE_QUERY = 'Polska, bezpieczeństwo';
const LIVE_SAFE = 'Polska bezpieczeństwo';

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

function makeSearchResponse(
  articles: NewsArticle[],
  overrides: Partial<NewsResponse> = {},
): NewsResponse {
  return {
    articles,
    totalResults: articles.length,
    providers: ['mock-wire'],
    dataMode: 'mock',
    generatedAt: new Date().toISOString(),
    ...overrides,
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

function buildService(newsService: Record<string, unknown>, provider?: AnalysisProvider) {
  const analysisProvider: AnalysisProvider = provider ?? {
    id: 'openai',
    displayName: 'OpenAI',
    isMock: false,
    analyzeNews: jest.fn().mockRejectedValue(new Error('not exercised in this test')),
  };

  return new AnalysisService(
    newsService as never,
    { getCountryNews: jest.fn() } as never,
    analysisProvider,
    makeConfigService(),
  );
}

const RELEVANT_PL_ARTICLE = makeArticle({
  id: 'pl-1',
  url: 'https://example.pl/1',
  title: 'Polska bezpieczeństwo priorytetem rządu',
  summary: 'Rząd ogłosił, że Polska bezpieczeństwo traktuje priorytetowo.',
  sourceLanguage: 'pl',
});

describe('PL1 / PL6 — Unicode survives, and no diacritic is altered', () => {
  it('the provider-safe form keeps every Polish letter', () => {
    expect(makeProviderSafeNewsQuery(LIVE_QUERY)).toBe(LIVE_SAFE);
    expect(makeProviderSafeNewsQuery(LIVE_QUERY)).toContain('bezpieczeństwo');
  });

  it('PL13 — the retained Unicode regression', () => {
    expect(makeProviderSafeNewsQuery('Łódź, bezpieczeństwo, Polska')).toBe(
      'Łódź bezpieczeństwo Polska',
    );
  });

  it('no transliteration and no ASCII filtering: an ASCII-only sanitizer would have broken these', () => {
    const sent = makeProviderSafeNewsQuery('Łódź, bezpieczeństwo') as string;
    expect(sent.startsWith('Ł')).toBe(true);
    expect(sent).not.toContain('bezpiecze stwo');
    expect(sent).not.toContain('Lodz');
  });
});

describe('PL2 / PL3 / PL4 / PL5 — the first provider call', () => {
  it('sends topHeadlines FIRST, with lang=pl and the provider-safe topic', async () => {
    const topHeadlines = jest.fn().mockResolvedValue(makeSearchResponse([RELEVANT_PL_ARTICLE]));
    const search = jest.fn();
    const service = buildService({ topHeadlines, search, findArticleById: jest.fn() });

    await service.analyzeNews(LIVE_QUERY, 'pl');

    expect(topHeadlines).toHaveBeenCalledTimes(1);
    expect(search).not.toHaveBeenCalled();

    const [, options] = topHeadlines.mock.calls[0];
    expect(options.lang).toBe('pl');
    expect(options.q).toBe(LIVE_SAFE);
  });

  it('PL2 — the comma never reaches provider syntax', async () => {
    const topHeadlines = jest.fn().mockResolvedValue(makeSearchResponse([RELEVANT_PL_ARTICLE]));
    const service = buildService({ topHeadlines, search: jest.fn(), findArticleById: jest.fn() });

    await service.analyzeNews(LIVE_QUERY, 'pl');

    const sent = String(topHeadlines.mock.calls[0][1].q);
    expect(sent).not.toContain(',');
    expect(sent).toMatch(/^[\p{L}\p{N}\s]+$/u);
  });
});

describe('PL1 — the user-visible query is untouched', () => {
  it('response.query and normalizedQuery keep the user’s own comma', async () => {
    const topHeadlines = jest.fn().mockResolvedValue(makeSearchResponse([RELEVANT_PL_ARTICLE]));
    const service = buildService({ topHeadlines, search: jest.fn(), findArticleById: jest.fn() });

    const response = await service.analyzeNews(LIVE_QUERY, 'pl');

    expect(response.query).toBe(LIVE_QUERY);
    expect(response.normalizedQuery).toBe(LIVE_QUERY);
    expect(response.requestedLanguage).toBe('pl');
    expect(response.responseLanguage).toBe('pl');
  });
});

describe('PL8 / PL10 — a genuine HTTP-200 zero-result still gets exactly ONE fallback', () => {
  it('falls back once to Search, in English, with the provider-safe topic', async () => {
    const topHeadlines = jest.fn().mockResolvedValue(makeSearchResponse([]));
    const search = jest.fn().mockResolvedValue(makeSearchResponse([]));
    const service = buildService({ topHeadlines, search, findArticleById: jest.fn() });

    await service.analyzeNews(LIVE_QUERY, 'pl');

    expect(topHeadlines).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledTimes(1);
    expect(search.mock.calls[0][0]).toBe(LIVE_SAFE);
  });

  it('PL7 — the fallback never asks Search for Polish', async () => {
    const topHeadlines = jest.fn().mockResolvedValue(makeSearchResponse([]));
    const search = jest.fn().mockResolvedValue(makeSearchResponse([]));
    const service = buildService({ topHeadlines, search, findArticleById: jest.fn() });

    await service.analyzeNews(LIVE_QUERY, 'pl');

    const options = search.mock.calls[0][3];
    expect(options === undefined || options.lang !== 'pl').toBe(true);
  });

  it('PL10 — total provider calls stay at or below 2', async () => {
    const topHeadlines = jest.fn().mockResolvedValue(makeSearchResponse([]));
    const search = jest.fn().mockResolvedValue(makeSearchResponse([]));
    const service = buildService({ topHeadlines, search, findArticleById: jest.fn() });

    await service.analyzeNews(LIVE_QUERY, 'pl');

    expect(topHeadlines.mock.calls.length + search.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it('an HTTP-200 response whose articles are simply irrelevant is still a zero-result, not a refusal', async () => {
    const irrelevant = makeArticle({
      id: 'pl-x',
      url: 'https://example.pl/x',
      title: 'Nowa wystawa w muzeum',
      summary: 'Wystawa potrwa do maja.',
      sourceLanguage: 'pl',
    });
    const topHeadlines = jest.fn().mockResolvedValue(makeSearchResponse([irrelevant]));
    const search = jest.fn().mockResolvedValue(makeSearchResponse([]));
    const service = buildService({ topHeadlines, search, findArticleById: jest.fn() });

    await service.analyzeNews(LIVE_QUERY, 'pl');

    expect(search).toHaveBeenCalledTimes(1);
  });
});

describe('PL9 — a deterministic refusal suppresses the fallback completely', () => {
  /**
   * This is the test that models the measured live failure. Under the old
   * code the fallback fired anyway and earned a 429; here it must not fire at
   * all. The refusal is carried on the same Symbol channel NewsService uses,
   * so the response is constructed through NewsService's own attach path
   * rather than faked.
   */
  function refusedTopHeadlines(kind: 'bad-request' | 'rate-limited' | 'auth' | 'unavailable') {
    // The GENUINE channel: attachProviderFailures is the same function
    // NewsService.topHeadlines() itself calls, and readProviderFailures() is
    // what AnalysisService reads. A hand-built object literal cannot carry the
    // non-enumerable Symbol these use, so a faked refusal would prove nothing.
    return attachProviderFailures(
      makeSearchResponse([], {
        dataMode: 'unavailable',
        fallbackReason: 'provider-error',
        providers: [],
      }),
      [{ providerId: 'gnews', kind }],
    );
  }

  it('a bad-request on stage 1 means NO second provider call — the measured 429 can no longer happen', async () => {
    const topHeadlines = jest.fn().mockResolvedValue(refusedTopHeadlines('bad-request'));
    const search = jest.fn();
    const service = buildService({ topHeadlines, search, findArticleById: jest.fn() });

    await service.analyzeNews(LIVE_QUERY, 'pl');

    expect(topHeadlines).toHaveBeenCalledTimes(1);
    expect(search).not.toHaveBeenCalled();
  });

  it.each(['rate-limited', 'auth', 'unavailable'] as const)(
    'a %s refusal also suppresses it — the same rule the English branch already uses',
    async (kind) => {
      const topHeadlines = jest.fn().mockResolvedValue(refusedTopHeadlines(kind));
      const search = jest.fn();
      const service = buildService({ topHeadlines, search, findArticleById: jest.fn() });

      await service.analyzeNews(LIVE_QUERY, 'pl');

      expect(search).not.toHaveBeenCalled();
    },
  );

  it('PL11 — a refusal still means zero evidence, so OpenAI is never invoked', async () => {
    const analyzeNews = jest.fn();
    const topHeadlines = jest.fn().mockResolvedValue(refusedTopHeadlines('bad-request'));
    const service = buildService(
      { topHeadlines, search: jest.fn(), findArticleById: jest.fn() },
      { id: 'openai', displayName: 'OpenAI', isMock: false, analyzeNews },
    );

    const response = await service.analyzeNews(LIVE_QUERY, 'pl');

    expect(analyzeNews).not.toHaveBeenCalled();
    expect(response.articles).toEqual([]);
    expect(response.analysis).toBeNull();
    expect(response.responseLanguage).toBe('pl');
  });
});

describe('PL12 — evidence present means analysis may run, still in Polish', () => {
  it('invokes the analysis provider and keeps responseLanguage=pl', async () => {
    const analyzeNews = jest.fn().mockRejectedValue(new Error('provider unavailable'));
    const topHeadlines = jest.fn().mockResolvedValue(makeSearchResponse([RELEVANT_PL_ARTICLE]));
    const service = buildService(
      { topHeadlines, search: jest.fn(), findArticleById: jest.fn() },
      { id: 'openai', displayName: 'OpenAI', isMock: false, analyzeNews },
    );

    const response = await service.analyzeNews(LIVE_QUERY, 'pl');

    expect(analyzeNews).toHaveBeenCalled();
    expect(response.articles).toHaveLength(1);
    expect(response.responseLanguage).toBe('pl');
  });
});

describe('P1 edge — a Polish question with no lexical content asks nothing', () => {
  it('makes no provider call and returns the honest zero-evidence state', async () => {
    const topHeadlines = jest.fn();
    const search = jest.fn();
    const analyzeNews = jest.fn();
    const service = buildService(
      { topHeadlines, search, findArticleById: jest.fn() },
      { id: 'openai', displayName: 'OpenAI', isMock: false, analyzeNews },
    );

    const response = await service.analyzeNews('!!! ??? ...', 'pl');

    expect(topHeadlines).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
    expect(analyzeNews).not.toHaveBeenCalled();
    expect(response.articles).toEqual([]);
    expect(response.retrievalContext.dataMode).toBe('unavailable');
    expect(response.retrievalContext.articlesRetrieved).toBe(0);
  });
});

describe('the relevance gate is unaffected by moving to the provider-safe topic', () => {
  /**
   * scoreGenericRelevance normalizes with /[^\p{L}\p{N}]+/gu before matching,
   * so a comma is already invisible to it. That is asserted rather than
   * assumed, on a positive AND a negative fixture, because the correction
   * changes which of the two strings the gate is given.
   */
  const fixtures = [
    makeArticle({ title: 'Polska, bezpieczeństwo i gospodarka', summary: 'Szczyt omawia tematy.' }),
    makeArticle({
      title: 'Polska bezpieczeństwo priorytetem',
      summary: 'Rząd ogłosił priorytety.',
    }),
    makeArticle({ title: 'Nowa wystawa w muzeum', summary: 'Wystawa potrwa do maja.' }),
  ];

  fixtures.forEach((article) => {
    it(`verdict is identical with and without the comma: "${article.title}"`, () => {
      expect(scoreGenericRelevance(article, LIVE_QUERY).isRelevant).toBe(
        scoreGenericRelevance(article, LIVE_SAFE).isRelevant,
      );
    });
  });
});
