import type { CountryNewsResponse, NewsArticle, NewsResponse } from '@globalnews-ai/shared';
import { AnalysisService } from './analysis.service';
import type { AnalysisProvider } from '../interfaces';
import { AnalysisConfigService } from '../config/analysis-config.service';

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

function makeCountryResponse(
  countryCode: string,
  countryName: string,
  articles: NewsArticle[],
  overrides: Partial<CountryNewsResponse> = {},
): CountryNewsResponse {
  return {
    countryCode,
    countryName,
    articles,
    totalResults: articles.length,
    providers: ['mock-wire'],
    dataMode: 'mock',
    feedTier: 'delayed',
    providerDisplayName: 'Mock',
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeConfigService(
  overrides: Partial<ReturnType<AnalysisConfigService['get']>> = {},
): AnalysisConfigService {
  const config = {
    maxArticles: 8,
    maxArticleChars: 1200,
    timeoutMs: 20000,
    cacheTtlSeconds: 300,
    openAiApiKey: undefined,
    openAiModel: 'gpt-4o-mini',
    // Milestone #30 defaults — 'development' matches today's existing
    // (pre-M30) behavior for every test that doesn't care about it.
    executionMode: 'development' as const,
    retryAttempts: 2,
    retryBaseDelayMs: 300,
    maxCompletionTokens: 2000,
    ...overrides,
  };

  return {
    get: () => config,
  } as unknown as AnalysisConfigService;
}

/**
 * Milestone #31: cites the request-local evidenceId "S1" for the first
 * article, rather than a real article ID. This is correct as long as
 * `articles[0]` is also the first entry of whatever final bounded
 * array AnalysisService actually resolves (`deduped`) — true for every
 * existing test here, since none of them reorder or remove the first
 * article ahead of the one this helper cites (see
 * build-analysis-prompt.util.ts's buildEvidenceReferences for the
 * S{index+1} assignment this relies on).
 */
function validCandidateFor(articles: NewsArticle[]) {
  return {
    headline: 'Headline',
    summary: 'Summary',
    keyFacts: [
      {
        claim: articles[0].title,
        evidenceIds: ['S1'],
      },
    ],
    agreements: [],
    differences: [],
    unknowns: [],
    uncertainties: [],
    timeline: [],
    confidence: {
      level: 'medium',
      score: 50,
      explanation: 'x',
    },
    entities: {
      countries: [],
      locations: [],
      people: [],
      organizations: [],
      topics: [],
    },
  };
}

describe('AnalysisService', () => {
  function makeCountryNewsService() {
    return {
      getCountryNews: jest.fn().mockResolvedValue(makeCountryResponse('ESP', 'Spain', [])),
    };
  }

  it('returns a clear analysisError and empty articles when no news results are found', async () => {
    const newsService = {
      search: jest.fn().mockResolvedValue(makeSearchResponse([])),
    };

    const countryNewsService = makeCountryNewsService();

    const provider: AnalysisProvider = {
      id: 'mock-analysis',
      displayName: 'Mock',
      isMock: true,
      analyzeNews: jest.fn(),
    };

    const service = new AnalysisService(
      newsService as never,
      countryNewsService as never,
      provider,
      makeConfigService(),
    );

    const response = await service.analyzeNews('nonexistent query');

    expect(response.articles).toEqual([]);
    expect(response.analysis).toBeNull();

    expect(response.analysisError).toMatch(/no related articles/i);

    expect(provider.analyzeNews).not.toHaveBeenCalled();

    // retrievalContext must still be present when retrieval
    // succeeded but returned zero articles.
    expect(response.retrievalContext).toEqual(
      expect.objectContaining({
        dataMode: 'mock',
        articlesRetrieved: 0,
      }),
    );
  });

  it('falls back to showing articles with an explanation when the AI provider fails', async () => {
    const articles = [
      makeArticle({
        id: 'a1',
      }),
    ];

    const newsService = {
      search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
    };

    const countryNewsService = makeCountryNewsService();

    const provider: AnalysisProvider = {
      id: 'openai',
      displayName: 'OpenAI',
      isMock: false,
      analyzeNews: jest.fn().mockRejectedValue(new Error('OpenAI rate limit exceeded.')),
    };

    const service = new AnalysisService(
      newsService as never,
      countryNewsService as never,
      provider,
      makeConfigService(),
    );

    const response = await service.analyzeNews('test query');

    expect(response.analysis).toBeNull();
    expect(response.articles).toHaveLength(1);

    expect(response.analysisError).toMatch(/temporarily unavailable/i);

    // retrievalContext must still be present when the AI provider
    // fails after articles were successfully retrieved.
    expect(response.retrievalContext).toEqual(
      expect.objectContaining({
        dataMode: 'mock',
        articlesRetrieved: 1,
      }),
    );
  });

  it('returns a validated analysis on success', async () => {
    const articles = [
      makeArticle({
        id: 'a1',
      }),
    ];

    const newsService = {
      search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
    };

    const countryNewsService = makeCountryNewsService();

    const provider: AnalysisProvider = {
      id: 'mock-analysis',
      displayName: 'Mock',
      isMock: true,
      analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
    };

    const service = new AnalysisService(
      newsService as never,
      countryNewsService as never,
      provider,
      makeConfigService(),
    );

    const response = await service.analyzeNews('test query');

    expect(response.analysis).not.toBeNull();

    expect(response.analysis?.analysisMode).toBe('mock-ai');

    expect(response.analysisError).toBeUndefined();
  });

  describe('Milestone #30: provenance', () => {
    it('exposes truthful provenance for a live-AI success', async () => {
      const articles = [makeArticle({ id: 'a1' })];
      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
      };
      const countryNewsService = makeCountryNewsService();

      const provider: AnalysisProvider = {
        id: 'openai',
        displayName: 'OpenAI',
        isMock: false,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService({ executionMode: 'production', openAiModel: 'gpt-4o-mini' }),
      );

      const response = await service.analyzeNews('test query');

      expect(response.provenance).toEqual({
        provider: 'openai',
        model: 'gpt-4o-mini',
        executionMode: 'production',
        analysisMode: 'live-ai',
        status: 'success',
        cached: false,
        latencyMs: expect.any(Number),
      });
    });

    it('exposes truthful provenance for a mock-AI success, with no model reported', async () => {
      const articles = [makeArticle({ id: 'a1' })];
      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
      };
      const countryNewsService = makeCountryNewsService();

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response = await service.analyzeNews('test query');

      expect(response.provenance).toEqual({
        provider: 'mock-analysis',
        model: undefined,
        executionMode: 'development',
        analysisMode: 'mock-ai',
        status: 'success',
        cached: false,
        latencyMs: expect.any(Number),
      });
    });

    it("classifies a provider failure using the error's own failureReason when present", async () => {
      const articles = [makeArticle({ id: 'a1' })];
      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
      };
      const countryNewsService = makeCountryNewsService();

      // Deliberately a plain object shape (not an import of
      // OpenAiAnalysisError) — AnalysisService classifies failures via
      // duck-typing (isClassifiedProviderError), not by importing a
      // concrete provider's error class, to stay provider-agnostic.
      const classifiedError = Object.assign(new Error('rate limited'), {
        failureReason: 'provider-rate-limited',
        retryable: true,
      });

      const provider: AnalysisProvider = {
        id: 'openai',
        displayName: 'OpenAI',
        isMock: false,
        analyzeNews: jest.fn().mockRejectedValue(classifiedError),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response = await service.analyzeNews('test query');

      expect(response.analysis).toBeNull();
      expect(response.articles).toHaveLength(1);
      expect(response.provenance).toMatchObject({
        status: 'failed',
        failureReason: 'provider-rate-limited',
        cached: false,
      });
      expect(response.provenance.latencyMs).toEqual(expect.any(Number));
    });

    it('falls back to provider-unavailable when a provider throws an unclassified error', async () => {
      const articles = [makeArticle({ id: 'a1' })];
      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
      };
      const countryNewsService = makeCountryNewsService();

      const provider: AnalysisProvider = {
        id: 'openai',
        displayName: 'OpenAI',
        isMock: false,
        analyzeNews: jest.fn().mockRejectedValue(new Error('something unexpected')),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response = await service.analyzeNews('test query');

      expect(response.provenance).toMatchObject({
        status: 'failed',
        failureReason: 'provider-unavailable',
      });
    });

    it('exposes validation-rejected provenance when the provider returns a fundamentally invalid candidate', async () => {
      const articles = [makeArticle({ id: 'a1' })];
      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
      };
      const countryNewsService = makeCountryNewsService();

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        // Missing required "headline" — validateAnalysisResult throws.
        analyzeNews: jest.fn().mockResolvedValue({ ...validCandidateFor(articles), headline: '' }),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response = await service.analyzeNews('test query');

      expect(response.analysis).toBeNull();
      // Retrieved articles must survive even a validation rejection.
      expect(response.articles).toHaveLength(1);
      expect(response.provenance).toMatchObject({
        status: 'validation-rejected',
        failureReason: 'validation-rejected',
      });
    });

    it('exposes not-attempted provenance with no failureReason when there are zero articles', async () => {
      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse([])),
      };
      const countryNewsService = makeCountryNewsService();

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn(),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response = await service.analyzeNews('nonexistent query');

      expect(provider.analyzeNews).not.toHaveBeenCalled();
      expect(response.provenance).toMatchObject({
        status: 'not-attempted',
        analysisMode: 'mock-ai',
      });
      expect(response.provenance.failureReason).toBeUndefined();
    });

    it('marks provenance.cached=true only on the cache-hit response, not the original', async () => {
      const articles = [makeArticle({ id: 'a1' })];
      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
      };
      const countryNewsService = makeCountryNewsService();

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const first = await service.analyzeNews('test query');
      const second = await service.analyzeNews('test query');

      expect(first.provenance.cached).toBe(false);
      expect(second.provenance.cached).toBe(true);
      // Everything else about provenance is preserved from the original generation.
      expect(second.provenance.status).toBe('success');
      expect(provider.analyzeNews).toHaveBeenCalledTimes(1);
    });

    it('does not replay a failed response for the full success cache TTL', async () => {
      const articles = [makeArticle({ id: 'a1' })];
      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
      };
      const countryNewsService = makeCountryNewsService();

      const analyzeNewsMock = jest
        .fn()
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce(validCandidateFor(articles));

      const provider: AnalysisProvider = {
        id: 'openai',
        displayName: 'OpenAI',
        isMock: false,
        analyzeNews: analyzeNewsMock,
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        // A long success TTL, so if a failure ever got cached at the
        // SAME TTL, this test would still find it cached 20s later —
        // proving the failure got the shorter TTL is the point here.
        makeConfigService({ cacheTtlSeconds: 300 }),
      );

      let now = 1_000_000;
      const dateSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);

      const first = await service.analyzeNews('test query');
      expect(first.analysis).toBeNull();
      expect(first.provenance.status).toBe('failed');

      // Still within the short failure TTL: served from cache.
      now += 5_000;
      const second = await service.analyzeNews('test query');
      expect(second.provenance.cached).toBe(true);
      expect(analyzeNewsMock).toHaveBeenCalledTimes(1);

      // Past a short failure TTL but still well within the 300s success
      // TTL: must NOT be served from the stale cached failure.
      now += 20_000;
      const third = await service.analyzeNews('test query');
      expect(third.provenance.cached).toBe(false);
      expect(third.analysis).not.toBeNull();
      expect(analyzeNewsMock).toHaveBeenCalledTimes(2);

      dateSpy.mockRestore();
    });
  });

  it('caches a successful response and does not call the news service again for the same query', async () => {
    const articles = [
      makeArticle({
        id: 'a1',
      }),
    ];

    const newsService = {
      search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
    };

    const countryNewsService = makeCountryNewsService();

    const provider: AnalysisProvider = {
      id: 'mock-analysis',
      displayName: 'Mock',
      isMock: true,
      analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
    };

    const service = new AnalysisService(
      newsService as never,
      countryNewsService as never,
      provider,
      makeConfigService(),
    );

    await service.analyzeNews('Same Query');

    await service.analyzeNews('same query');

    expect(newsService.search).toHaveBeenCalledTimes(1);
  });

  it('does not cache when cacheTtlSeconds is 0', async () => {
    const articles = [
      makeArticle({
        id: 'a1',
      }),
    ];

    const newsService = {
      search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
    };

    const countryNewsService = makeCountryNewsService();

    const provider: AnalysisProvider = {
      id: 'mock-analysis',
      displayName: 'Mock',
      isMock: true,
      analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
    };

    const service = new AnalysisService(
      newsService as never,
      countryNewsService as never,
      provider,
      makeConfigService({
        cacheTtlSeconds: 0,
      }),
    );

    await service.analyzeNews('test query');

    await service.analyzeNews('test query');

    expect(newsService.search).toHaveBeenCalledTimes(2);
  });

  it("shares one cache entry across normalized-equivalent requests, while each response exposes its own request's query", async () => {
    // Reproduces the exact Milestone 27 acceptance-test scenario:
    // "what;s happening in kigali?" then "What's happening in Kigali?"
    const articles = [
      makeArticle({
        id: 'kigali-cache-contract-1',
        title: 'Rwanda headline',
      }),
    ];

    const newsService = {
      search: jest.fn(),
    };

    const countryNewsService = {
      getCountryNews: jest
        .fn()
        .mockResolvedValue(makeCountryResponse('RWA', 'Rwanda', articles, { city: 'kigali' })),
    };

    const provider: AnalysisProvider = {
      id: 'mock-analysis',
      displayName: 'Mock',
      isMock: true,
      analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
    };

    const service = new AnalysisService(
      newsService as never,
      countryNewsService as never,
      provider,
      makeConfigService(),
    );

    const first = await service.analyzeNews('what;s happening in kigali?');

    const second = await service.analyzeNews("What's happening in Kigali?");

    // Both variants normalize to the same text, so they share one
    // cache entry and retrieval/AI analysis only ran once.
    expect(countryNewsService.getCountryNews).toHaveBeenCalledTimes(1);

    expect(provider.analyzeNews).toHaveBeenCalledTimes(1);

    // Both variants normalize to the same *cache key* (lowercased),
    // so retrieval/AI is shared — but normalizeQuery itself does not
    // change case, so each response's normalizedQuery still reflects
    // that request's own casing/punctuation-repair, not a forced
    // canonical form.
    expect(first.normalizedQuery).toBe("what's happening in kigali?");
    expect(second.normalizedQuery).toBe("What's happening in Kigali?");
    // own literal input, never the other caller's — this is the bug:
    // the cache must not leak the first caller's raw query onto a
    // later cache-hit response.
    expect(first.query).toBe('what;s happening in kigali?');
    expect(second.query).toBe("What's happening in Kigali?");

    // The shared underlying analysis/articles/retrievalContext are
    // still identical across both responses (only the envelope's
    // query fields differ).
    expect(second.articles).toEqual(first.articles);
    expect(second.analysis).toEqual(first.analysis);
    expect(second.retrievalContext).toEqual(first.retrievalContext);
  });

  it("caches a typo'd and correctly-punctuated variant of the same question together", async () => {
    const articles = [makeArticle({ id: 'normalize-cache-1' })];

    const newsService = {
      search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
    };

    const countryNewsService = makeCountryNewsService();

    const provider: AnalysisProvider = {
      id: 'mock-analysis',
      displayName: 'Mock',
      isMock: true,
      analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
    };

    const service = new AnalysisService(
      newsService as never,
      countryNewsService as never,
      provider,
      makeConfigService(),
    );

    await service.analyzeNews('What;s the latest on markets?');

    await service.analyzeNews("What's the latest on markets?");

    // Both variants normalize to the same text, so they share one
    // cache entry and the provider is only hit once.
    expect(newsService.search).toHaveBeenCalledTimes(1);
  });

  it('uses country-aware retrieval for a Spain question', async () => {
    const articles = [
      makeArticle({
        id: 'spain-1',
        title: 'Spain headline',
      }),
    ];

    const newsService = {
      search: jest.fn(),
    };

    const countryNewsService = {
      getCountryNews: jest.fn().mockResolvedValue(makeCountryResponse('ESP', 'Spain', articles)),
    };

    const provider: AnalysisProvider = {
      id: 'mock-analysis',
      displayName: 'Mock',
      isMock: true,
      analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
    };

    const service = new AnalysisService(
      newsService as never,
      countryNewsService as never,
      provider,
      makeConfigService(),
    );

    const response = await service.analyzeNews('What is happening in Spain today?');

    expect(countryNewsService.getCountryNews).toHaveBeenCalledWith('ESP', undefined, 20, undefined);

    expect(countryNewsService.getCountryNews).toHaveBeenCalledTimes(1);

    expect(newsService.search).not.toHaveBeenCalled();

    expect(response.articles).toEqual(articles);
  });

  it('uses country-aware retrieval for a Rwanda question', async () => {
    const articles = [
      makeArticle({
        id: 'rwanda-1',
        title: 'Rwanda headline',
      }),
    ];

    const newsService = {
      search: jest.fn(),
    };

    const countryNewsService = {
      getCountryNews: jest.fn().mockResolvedValue(makeCountryResponse('RWA', 'Rwanda', articles)),
    };

    const provider: AnalysisProvider = {
      id: 'mock-analysis',
      displayName: 'Mock',
      isMock: true,
      analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
    };

    const service = new AnalysisService(
      newsService as never,
      countryNewsService as never,
      provider,
      makeConfigService(),
    );

    await service.analyzeNews('Latest news from Rwanda');

    expect(countryNewsService.getCountryNews).toHaveBeenCalledWith('RWA', undefined, 20, undefined);

    expect(newsService.search).not.toHaveBeenCalled();
  });

  it('resolves a supported country alias such as Britain', async () => {
    const articles = [
      makeArticle({
        id: 'britain-1',
        title: 'United Kingdom headline',
      }),
    ];

    const newsService = {
      search: jest.fn(),
    };

    const countryNewsService = {
      getCountryNews: jest
        .fn()
        .mockResolvedValue(makeCountryResponse('GBR', 'United Kingdom', articles)),
    };

    const provider: AnalysisProvider = {
      id: 'mock-analysis',
      displayName: 'Mock',
      isMock: true,
      analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
    };

    const service = new AnalysisService(
      newsService as never,
      countryNewsService as never,
      provider,
      makeConfigService(),
    );

    await service.analyzeNews('What is happening in Britain today?');

    expect(countryNewsService.getCountryNews).toHaveBeenCalledWith('GBR', undefined, 20, undefined);

    expect(newsService.search).not.toHaveBeenCalled();
  });

  it('resolves an embedded ISO alpha-3 code with no preposition, e.g. "is USA under pressure of war?"', async () => {
    const articles = [
      makeArticle({
        id: 'usa-1',
        title: 'United States headline',
      }),
    ];

    const newsService = {
      search: jest.fn(),
    };

    const countryNewsService = {
      getCountryNews: jest
        .fn()
        .mockResolvedValue(makeCountryResponse('USA', 'United States', articles)),
    };

    const provider: AnalysisProvider = {
      id: 'mock-analysis',
      displayName: 'Mock',
      isMock: true,
      analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
    };

    const service = new AnalysisService(
      newsService as never,
      countryNewsService as never,
      provider,
      makeConfigService(),
    );

    await service.analyzeNews('is USA under pressure of war?');

    expect(countryNewsService.getCountryNews).toHaveBeenCalledWith('USA', undefined, 20, undefined);

    expect(newsService.search).not.toHaveBeenCalled();
  });

  it('does not resolve a lowercase embedded code with no preposition', async () => {
    const articles = [makeArticle({ id: 'general-2' })];

    const newsService = {
      search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
    };

    const countryNewsService = {
      getCountryNews: jest.fn(),
    };

    const provider: AnalysisProvider = {
      id: 'mock-analysis',
      displayName: 'Mock',
      isMock: true,
      analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
    };

    const service = new AnalysisService(
      newsService as never,
      countryNewsService as never,
      provider,
      makeConfigService(),
    );

    await service.analyzeNews('the us released a report today');

    expect(countryNewsService.getCountryNews).not.toHaveBeenCalled();

    expect(newsService.search).toHaveBeenCalledWith('the us released a report today', 20, {
      type: 'generic',
    });
  });

  it('does not resolve an ambiguous bare country name with no preposition (e.g. "Chad")', async () => {
    const articles = [makeArticle({ id: 'general-3' })];

    const newsService = {
      search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
    };

    const countryNewsService = {
      getCountryNews: jest.fn(),
    };

    const provider: AnalysisProvider = {
      id: 'mock-analysis',
      displayName: 'Mock',
      isMock: true,
      analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
    };

    const service = new AnalysisService(
      newsService as never,
      countryNewsService as never,
      provider,
      makeConfigService(),
    );

    await service.analyzeNews('Chad missed the bus this morning');

    expect(countryNewsService.getCountryNews).not.toHaveBeenCalled();

    expect(newsService.search).toHaveBeenCalledWith('Chad missed the bus this morning', 20, {
      type: 'generic',
    });
  });

  it('resolves a curated city to its country, e.g. "What is happening in Kigali?"', async () => {
    const articles = [
      makeArticle({
        id: 'kigali-1',
        title: 'Rwanda headline',
      }),
    ];

    const newsService = {
      search: jest.fn(),
    };

    const countryNewsService = {
      getCountryNews: jest
        .fn()
        .mockResolvedValue(makeCountryResponse('RWA', 'Rwanda', articles, { city: 'kigali' })),
    };

    const provider: AnalysisProvider = {
      id: 'mock-analysis',
      displayName: 'Mock',
      isMock: true,
      analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
    };

    const service = new AnalysisService(
      newsService as never,
      countryNewsService as never,
      provider,
      makeConfigService(),
    );

    const response = await service.analyzeNews("What's happening in Kigali?");

    expect(countryNewsService.getCountryNews).toHaveBeenCalledWith('RWA', undefined, 20, 'kigali');

    expect(newsService.search).not.toHaveBeenCalled();

    // City intent is preserved through to the retrieval context so the
    // frontend can display "Kigali, Rwanda" rather than just "Rwanda".
    expect(response.retrievalContext.city).toBe('kigali');

    expect(response.retrievalContext.countryName).toBe('Rwanda');
  });

  it('resolves a curated city even with a typo\'d contraction, e.g. "what;s happening in kigali?"', async () => {
    const articles = [
      makeArticle({
        id: 'kigali-typo-1',
        title: 'Rwanda headline',
      }),
    ];

    const newsService = {
      search: jest.fn(),
    };

    const countryNewsService = {
      getCountryNews: jest
        .fn()
        .mockResolvedValue(makeCountryResponse('RWA', 'Rwanda', articles, { city: 'kigali' })),
    };

    const provider: AnalysisProvider = {
      id: 'mock-analysis',
      displayName: 'Mock',
      isMock: true,
      analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
    };

    const service = new AnalysisService(
      newsService as never,
      countryNewsService as never,
      provider,
      makeConfigService(),
    );

    const response = await service.analyzeNews('what;s happening in kigali?');

    // The typo'd punctuation is repaired by normalization before
    // country/city detection ever runs, so this resolves identically
    // to the correctly-punctuated "What's happening in Kigali?" query.
    expect(countryNewsService.getCountryNews).toHaveBeenCalledWith('RWA', undefined, 20, 'kigali');

    expect(newsService.search).not.toHaveBeenCalled();

    // The user's literal, unmodified input is still what's echoed
    // back for display — normalization never rewrites what they typed.
    expect(response.query).toBe('what;s happening in kigali?');

    expect(response.normalizedQuery).toBe("what's happening in kigali?");
  });

  it('does not resolve an uncurated city even with a preposition', async () => {
    const articles = [makeArticle({ id: 'general-4' })];

    const newsService = {
      search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
    };

    const countryNewsService = {
      getCountryNews: jest.fn(),
    };

    const provider: AnalysisProvider = {
      id: 'mock-analysis',
      displayName: 'Mock',
      isMock: true,
      analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
    };

    const service = new AnalysisService(
      newsService as never,
      countryNewsService as never,
      provider,
      makeConfigService(),
    );

    await service.analyzeNews("What's happening in Anytown?");

    expect(countryNewsService.getCountryNews).not.toHaveBeenCalled();

    expect(newsService.search).toHaveBeenCalledWith('Anytown', 20, { type: 'generic' });
  });

  describe('Milestone #28: fuzzy geographic typo resolution', () => {
    it('resolves a misspelled curated city, e.g. "What is happening in Kigalli?"', async () => {
      const articles = [
        makeArticle({
          id: 'kigalli-fuzzy-1',
          title: 'Rwanda headline',
        }),
      ];

      const newsService = {
        search: jest.fn(),
      };

      const countryNewsService = {
        getCountryNews: jest
          .fn()
          .mockResolvedValue(makeCountryResponse('RWA', 'Rwanda', articles, { city: 'kigali' })),
      };

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response = await service.analyzeNews("What's happening in Kigalli?");

      // Retrieval must use the CANONICAL spelling ("kigali"), never
      // the raw typo ("kigalli") — this is what makes retrieval
      // actually find anything.
      expect(countryNewsService.getCountryNews).toHaveBeenCalledWith(
        'RWA',
        undefined,
        20,
        'kigali',
      );

      expect(newsService.search).not.toHaveBeenCalled();

      // The user's original question is preserved verbatim — the
      // typo is never silently rewritten in what's echoed back.
      expect(response.query).toBe("What's happening in Kigalli?");

      expect(response.normalizedQuery).toBe("What's happening in Kigalli?");

      // Provenance: the retrieval context discloses that this came
      // from fuzzy resolution, and what it was resolved from/to.
      expect(response.retrievalContext.matchedFrom).toBe('kigalli');
      expect(response.retrievalContext.canonicalLocation).toBe('kigali');
      expect(response.retrievalContext.matchConfidence).toBeGreaterThanOrEqual(80);
      expect(response.retrievalContext.city).toBe('kigali');
      expect(response.retrievalContext.countryName).toBe('Rwanda');
    });

    it('resolves a misspelled bare country name with no preposition, e.g. "Rwnada"', async () => {
      const articles = [makeArticle({ id: 'rwanda-fuzzy-1' })];

      const newsService = {
        search: jest.fn(),
      };

      const countryNewsService = {
        getCountryNews: jest.fn().mockResolvedValue(makeCountryResponse('RWA', 'Rwanda', articles)),
      };

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response = await service.analyzeNews('Rwnada');

      expect(countryNewsService.getCountryNews).toHaveBeenCalledWith(
        'RWA',
        undefined,
        20,
        undefined,
      );

      expect(response.query).toBe('Rwnada');
      expect(response.retrievalContext.matchedFrom).toBe('rwnada');
      expect(response.retrievalContext.canonicalLocation).toBe('rwanda');
    });

    it('does not populate matchedFrom/canonicalLocation/matchConfidence for an exact match', async () => {
      const articles = [makeArticle({ id: 'exact-1' })];

      const newsService = { search: jest.fn() };

      const countryNewsService = {
        getCountryNews: jest.fn().mockResolvedValue(makeCountryResponse('RWA', 'Rwanda', articles)),
      };

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response = await service.analyzeNews('Rwanda');

      expect(response.retrievalContext.matchedFrom).toBeUndefined();
      expect(response.retrievalContext.canonicalLocation).toBeUndefined();
      expect(response.retrievalContext.matchConfidence).toBeUndefined();
    });

    it('exact matches remain preferred: "Chad" and "Jordan" never go through fuzzy resolution', async () => {
      for (const [query, iso3, name] of [
        ['Chad', 'TCD', 'Chad'],
        ['Jordan', 'JOR', 'Jordan'],
      ] as const) {
        const articles = [makeArticle({ id: `${iso3}-exact` })];

        const newsService = { search: jest.fn() };

        const countryNewsService = {
          getCountryNews: jest.fn().mockResolvedValue(makeCountryResponse(iso3, name, articles)),
        };

        const provider: AnalysisProvider = {
          id: 'mock-analysis',
          displayName: 'Mock',
          isMock: true,
          analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
        };

        const service = new AnalysisService(
          newsService as never,
          countryNewsService as never,
          provider,
          makeConfigService(),
        );

        const response = await service.analyzeNews(query);

        expect(countryNewsService.getCountryNews).toHaveBeenCalledWith(
          iso3,
          undefined,
          20,
          undefined,
        );

        // No fuzzy provenance — this resolved exactly, first try.
        expect(response.retrievalContext.matchedFrom).toBeUndefined();
        expect(response.retrievalContext.canonicalLocation).toBeUndefined();
      }
    });

    it('does not resolve an ambiguous fuzzy candidate ("ambia" — equidistant from Zambia and Gambia)', async () => {
      const articles = [makeArticle({ id: 'general-ambia' })];

      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
      };

      const countryNewsService = { getCountryNews: jest.fn() };

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      await service.analyzeNews("What's happening in ambia?");

      // Ambiguous fuzzy candidate fails closed: no country-aware
      // retrieval is attempted (countryNewsService.getCountryNews is
      // never called — country routing itself is completely
      // unaffected by Milestone #35), and the query falls back to
      // ordinary generic search. Milestone #35: the generic-search
      // term is now the derived phrase ("ambia"), not the raw
      // sentence — see derive-generic-news-query.util.ts.
      expect(countryNewsService.getCountryNews).not.toHaveBeenCalled();
      expect(newsService.search).toHaveBeenCalledWith('ambia', 20, {
        type: 'generic',
      });
    });

    it('does not resolve a near-miss of a protected short country name ("Chad")', async () => {
      const articles = [makeArticle({ id: 'general-chad-nearmiss' })];

      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
      };

      const countryNewsService = { getCountryNews: jest.fn() };

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      // "Chax" is a single-letter edit of "Chad", but "Chad" is only
      // 4 characters — below the fuzzy target minimum length — so this
      // must never resolve to Chad.
      await service.analyzeNews("What's happening in Chax?");

      // Milestone #35: country routing is unaffected (still never
      // called); the generic-search term is now the derived phrase
      // ("Chax"), not the raw sentence.
      expect(countryNewsService.getCountryNews).not.toHaveBeenCalled();
      expect(newsService.search).toHaveBeenCalledWith('Chax', 20, {
        type: 'generic',
      });
    });
  });

  it('uses generic NewsService search for a non-country question', async () => {
    const articles = [
      makeArticle({
        id: 'markets-1',
        title: 'Markets headline',
        category: 'business',
      }),
    ];

    const newsService = {
      search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
    };

    const countryNewsService = {
      getCountryNews: jest.fn(),
    };

    const provider: AnalysisProvider = {
      id: 'mock-analysis',
      displayName: 'Mock',
      isMock: true,
      analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
    };

    const service = new AnalysisService(
      newsService as never,
      countryNewsService as never,
      provider,
      makeConfigService(),
    );

    await service.analyzeNews('Tell me about markets today');

    // Milestone #46 (CI correction): the derived provider search term
    // is "markets today" — deriveGenericNewsQuery() correctly strips
    // the "Tell me about" prefix (added in an earlier M46 round). This
    // was a stale test expectation from before that pattern existed;
    // the ACTUAL, CORRECT M46 behavior is confirmed here, not reverted.
    expect(newsService.search).toHaveBeenCalledWith('markets today', 20, { type: 'generic' });

    expect(newsService.search).toHaveBeenCalledTimes(1);

    expect(countryNewsService.getCountryNews).not.toHaveBeenCalled();
  });

  it('does not mistake ordinary text for a country query', async () => {
    const articles = [
      makeArticle({
        id: 'general-1',
      }),
    ];

    const newsService = {
      search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
    };

    const countryNewsService = {
      getCountryNews: jest.fn(),
    };

    const provider: AnalysisProvider = {
      id: 'mock-analysis',
      displayName: 'Mock',
      isMock: true,
      analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
    };

    const service = new AnalysisService(
      newsService as never,
      countryNewsService as never,
      provider,
      makeConfigService(),
    );

    await service.analyzeNews('Tell me about technology and markets today');

    // Milestone #46 (CI correction): same stale-expectation fix as the
    // "markets today" case above — "Tell me about" is correctly
    // stripped, confirmed as the actual, correct M46 behavior.
    expect(newsService.search).toHaveBeenCalledWith('technology and markets today', 20, {
      type: 'generic',
    });

    expect(countryNewsService.getCountryNews).not.toHaveBeenCalled();
  });

  describe('retrievalContext', () => {
    it('preserves dataMode=live and provider info for generic live retrieval', async () => {
      const articles = [makeArticle({ id: 'live-1' })];

      const newsService = {
        search: jest.fn().mockResolvedValue(
          makeSearchResponse(articles, {
            dataMode: 'live',
            providers: ['newsapi'],
          }),
        ),
      };

      const countryNewsService = makeCountryNewsService();

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response = await service.analyzeNews('live query');

      expect(response.retrievalContext).toEqual({
        dataMode: 'live',
        providers: ['newsapi'],
        fallbackReason: undefined,
        newestArticlePublishedAt: undefined,
        countryCode: undefined,
        countryName: undefined,
        providerDisplayName: undefined,
        articlesRetrieved: 1,
      });
    });

    it('preserves dataMode=mock for generic mock retrieval', async () => {
      const articles = [makeArticle({ id: 'mock-1' })];

      const newsService = {
        search: jest.fn().mockResolvedValue(
          makeSearchResponse(articles, {
            dataMode: 'mock',
            providers: ['mock-wire'],
          }),
        ),
      };

      const countryNewsService = makeCountryNewsService();

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response = await service.analyzeNews('mock query');

      expect(response.retrievalContext.dataMode).toBe('mock');
    });

    it('preserves dataMode=cached and fallbackReason for generic cached retrieval', async () => {
      const articles = [makeArticle({ id: 'cached-1' })];

      const newsService = {
        search: jest.fn().mockResolvedValue(
          makeSearchResponse(articles, {
            dataMode: 'cached',
            providers: [],
            fallbackReason: 'provider-error',
          }),
        ),
      };

      const countryNewsService = makeCountryNewsService();

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response = await service.analyzeNews('cached query');

      expect(response.retrievalContext).toEqual(
        expect.objectContaining({
          dataMode: 'cached',
          providers: [],
          fallbackReason: 'provider-error',
        }),
      );
    });

    it('preserves dataMode=unavailable and fallbackReason for generic retrieval when no provider succeeded and no cache existed', async () => {
      const newsService = {
        search: jest.fn().mockResolvedValue(
          makeSearchResponse([], {
            dataMode: 'unavailable',
            providers: [],
            fallbackReason: 'provider-error',
          }),
        ),
      };

      const countryNewsService = makeCountryNewsService();

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn(),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response = await service.analyzeNews('unavailable query');

      expect(response.retrievalContext).toEqual(
        expect.objectContaining({
          dataMode: 'unavailable',
          providers: [],
          fallbackReason: 'provider-error',
          articlesRetrieved: 0,
        }),
      );

      expect(provider.analyzeNews).not.toHaveBeenCalled();
    });

    it('preserves country code/name, live dataMode, and provider info for country-aware live retrieval', async () => {
      const articles = [
        makeArticle({
          id: 'spain-live-1',
          title: 'Spain headline',
        }),
      ];

      const newsService = {
        search: jest.fn(),
      };

      const countryNewsService = {
        getCountryNews: jest.fn().mockResolvedValue(
          makeCountryResponse('ESP', 'Spain', articles, {
            dataMode: 'live',
            providers: ['gnews'],
            feedTier: 'live',
            providerDisplayName: 'GNews Free',
          }),
        ),
      };

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response = await service.analyzeNews('What is happening in Spain today?');

      expect(response.retrievalContext).toEqual({
        dataMode: 'live',
        providers: ['gnews'],
        fallbackReason: undefined,
        newestArticlePublishedAt: undefined,
        countryCode: 'ESP',
        countryName: 'Spain',
        providerDisplayName: 'GNews Free',
        articlesRetrieved: 1,
      });
    });

    it('preserves cached dataMode, fallbackReason, and newestArticlePublishedAt for country-aware cached retrieval', async () => {
      const newestTimestamp = '2026-08-08T20:58:00.000Z';

      const articles = [
        makeArticle({
          id: 'rwanda-cached-1',
          title: 'Rwanda headline',
          publishedAt: newestTimestamp,
        }),
      ];

      const newsService = {
        search: jest.fn(),
      };

      const countryNewsService = {
        getCountryNews: jest.fn().mockResolvedValue(
          makeCountryResponse('RWA', 'Rwanda', articles, {
            dataMode: 'cached',
            providers: [],
            fallbackReason: 'no-live-results',
            providerDisplayName: 'Stored reporting',
            newestArticlePublishedAt: newestTimestamp,
          }),
        ),
      };

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response = await service.analyzeNews('Latest news from Rwanda');

      expect(response.retrievalContext).toEqual({
        dataMode: 'cached',
        providers: [],
        fallbackReason: 'no-live-results',
        newestArticlePublishedAt: newestTimestamp,
        countryCode: 'RWA',
        countryName: 'Rwanda',
        providerDisplayName: 'Stored reporting',
        articlesRetrieved: 1,
      });
    });

    it('preserves city alongside country code/name for a curated-city query', async () => {
      const articles = [
        makeArticle({
          id: 'kigali-retrieval-1',
          title: 'Kigali headline',
        }),
      ];

      const newsService = {
        search: jest.fn(),
      };

      const countryNewsService = {
        getCountryNews: jest.fn().mockResolvedValue(
          makeCountryResponse('RWA', 'Rwanda', articles, {
            dataMode: 'live',
            providers: ['gnews'],
            feedTier: 'live',
            providerDisplayName: 'GNews Free',
            city: 'kigali',
          }),
        ),
      };

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response = await service.analyzeNews('What is happening in Kigali today?');

      expect(response.retrievalContext).toEqual({
        dataMode: 'live',
        providers: ['gnews'],
        fallbackReason: undefined,
        newestArticlePublishedAt: undefined,
        countryCode: 'RWA',
        countryName: 'Rwanda',
        providerDisplayName: 'GNews Free',
        articlesRetrieved: 1,
        city: 'kigali',
      });
    });

    it('preserves the same retrievalContext on a cached AnalysisService response', async () => {
      const articles = [makeArticle({ id: 'cache-hit-1' })];

      const newsService = {
        search: jest.fn().mockResolvedValue(
          makeSearchResponse(articles, {
            dataMode: 'live',
            providers: ['newsapi'],
          }),
        ),
      };

      const countryNewsService = makeCountryNewsService();

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const first = await service.analyzeNews('Cache Hit Query');

      const second = await service.analyzeNews('cache hit query');

      expect(newsService.search).toHaveBeenCalledTimes(1);

      expect(second.retrievalContext).toEqual(first.retrievalContext);

      expect(second.retrievalContext).toEqual(
        expect.objectContaining({
          dataMode: 'live',
          providers: ['newsapi'],
        }),
      );
    });
  });

  describe('sourceEntities (Milestone #29)', () => {
    it('exposes a resolved organization grounded against response.articles for a successful analysis', async () => {
      const articles = [
        makeArticle({
          id: 'un-1',
          title: 'UN Security Council meets as United Nations calls for ceasefire',
          summary: 'The UN and United Nations officials confirmed talks are ongoing.',
        }),
      ];

      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
      };

      const countryNewsService = { getCountryNews: jest.fn() };

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response = await service.analyzeNews('What is the UN saying about the ceasefire?');

      expect(response.sourceEntities.organizations).toHaveLength(1);
      const [org] = response.sourceEntities.organizations;
      expect(org.canonical).toBe('United Nations');
      expect(org.matchedFrom).toEqual(expect.arrayContaining(['UN', 'United Nations']));

      // Grounding invariant: every cited article ID must exist in
      // this same response's `articles` array.
      const responseArticleIds = new Set(response.articles.map((a) => a.id));
      for (const articleId of org.articleIds) {
        expect(responseArticleIds.has(articleId)).toBe(true);
      }
      expect(org.articleIds).toEqual(['un-1']);
    });

    it('does not merge unrelated organizations, and keeps AnalysisEntities and sourceEntities separate', async () => {
      const articles = [
        makeArticle({
          id: 'org-1',
          title: 'NATO and OPEC issue separate statements',
          summary: 'NATO addressed security while OPEC discussed oil output.',
        }),
      ];

      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
      };

      const countryNewsService = { getCountryNews: jest.fn() };

      // The AI's own AnalysisEntities is free-form and unrelated to
      // sourceEntities — asserting it here to prove the two are never
      // merged: an org the AI claims that isn't in the resolver's
      // curated set must not leak into sourceEntities.
      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue({
          ...validCandidateFor(articles),
          entities: {
            countries: [],
            locations: [],
            people: [],
            organizations: ['Some AI-Only Org The Resolver Does Not Know'],
            topics: [],
          },
        }),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response = await service.analyzeNews('NATO and OPEC statements');

      const canonicals = response.sourceEntities.organizations.map((o) => o.canonical);
      expect(canonicals).toEqual(expect.arrayContaining(['NATO', 'OPEC']));
      expect(canonicals).not.toContain('Some AI-Only Org The Resolver Does Not Know');
      expect(response.analysis?.entities.organizations).toContain(
        'Some AI-Only Org The Resolver Does Not Know',
      );
    });

    it('produces an empty sourceEntities result when there are no articles', async () => {
      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse([])),
      };

      const countryNewsService = { getCountryNews: jest.fn() };

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn(),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response = await service.analyzeNews('nothing relevant here');

      expect(response.analysis).toBeNull();
      expect(response.sourceEntities).toEqual({ organizations: [] });
    });

    it('still exposes grounded sourceEntities when the AI provider fails', async () => {
      const articles = [
        makeArticle({
          id: 'un-fail-1',
          title: 'United Nations convenes emergency session',
          summary: 'The UN gathered delegates from member states.',
        }),
      ];

      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
      };

      const countryNewsService = { getCountryNews: jest.fn() };

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockRejectedValue(new Error('provider exploded')),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response = await service.analyzeNews('UN emergency session');

      expect(response.analysis).toBeNull();
      expect(response.analysisError).toBeDefined();

      // The AI failed, but source-derived, deterministic evidence must
      // still be present and grounded — it never depended on the AI.
      expect(response.sourceEntities.organizations).toHaveLength(1);
      expect(response.sourceEntities.organizations[0].canonical).toBe('United Nations');
      const responseArticleIds = new Set(response.articles.map((a) => a.id));
      expect(responseArticleIds.has(response.sourceEntities.organizations[0].articleIds[0])).toBe(
        true,
      );
    });

    it('a duplicate article removed by clusterDuplicateArticles cannot contribute organization evidence', async () => {
      const sharedUrl = 'https://example.com/un-story';
      const publishedAt = new Date().toISOString();

      const articles = [
        makeArticle({
          id: 'un-original',
          url: sharedUrl,
          publishedAt,
          title: 'United Nations calls for ceasefire',
          summary: 'The UN urged all parties to de-escalate.',
        }),
        makeArticle({
          id: 'un-duplicate',
          url: sharedUrl, // identical URL -> treated as a duplicate and dropped
          publishedAt,
          title: 'United Nations calls for ceasefire (wire copy)',
          summary: 'Syndicated coverage of the same UN statement.',
        }),
      ];

      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
      };

      const countryNewsService = { getCountryNews: jest.fn() };

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles.slice(0, 1))),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response = await service.analyzeNews('UN ceasefire statement');

      // Only the representative article survives de-duplication.
      expect(response.articles.map((a) => a.id)).toEqual(['un-original']);

      const org = response.sourceEntities.organizations.find(
        (o) => o.canonical === 'United Nations',
      );
      expect(org).toBeDefined();
      expect(org?.articleIds).toEqual(['un-original']);
      expect(org?.articleIds).not.toContain('un-duplicate');
    });

    it('an article removed by the maxArticles cap cannot contribute organization evidence', async () => {
      const articles = [
        makeArticle({
          id: 'keep-1',
          title: 'NATO holds summit',
          summary: 'NATO leaders discussed the alliance.',
        }),
        makeArticle({
          id: 'drop-1',
          url: 'https://example.com/who-story',
          title: 'WHO issues health advisory',
          summary: 'The WHO warned of a new outbreak.',
        }),
      ];

      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
      };

      const countryNewsService = { getCountryNews: jest.fn() };

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles.slice(0, 1))),
      };

      // maxArticles: 1 forces the cap to drop the second (WHO) article
      // even though it was never a duplicate.
      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService({ maxArticles: 1 }),
      );

      const response = await service.analyzeNews('NATO summit and WHO advisory');

      expect(response.articles.map((a) => a.id)).toEqual(['keep-1']);

      const canonicals = response.sourceEntities.organizations.map((o) => o.canonical);
      expect(canonicals).toContain('NATO');
      expect(canonicals).not.toContain('World Health Organization');
    });

    it("a cache hit preserves the current caller's query/normalizedQuery while reusing sourceEntities (Milestone #27 behavior unaffected)", async () => {
      const articles = [
        makeArticle({
          id: 'cache-un-1',
          title: 'United Nations statement',
          summary: 'The UN issued a statement.',
        }),
      ];

      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
      };

      const countryNewsService = { getCountryNews: jest.fn() };

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const first = await service.analyzeNews('UN Cache Query');
      const second = await service.analyzeNews('un cache query');

      expect(newsService.search).toHaveBeenCalledTimes(1);

      expect(second.query).toBe('un cache query');
      expect(second.normalizedQuery).toBe('un cache query');
      expect(second.sourceEntities).toEqual(first.sourceEntities);
      expect(second.sourceEntities.organizations[0]?.canonical).toBe('United Nations');
    });

    it('does not affect Milestone #28 geographic fuzzy resolution', async () => {
      const articles = [makeArticle({ id: 'kigalli-still-works' })];

      const countryNewsService = {
        getCountryNews: jest
          .fn()
          .mockResolvedValue(makeCountryResponse('RWA', 'Rwanda', articles, { city: 'kigali' })),
      };

      const newsService = { search: jest.fn() };

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response = await service.analyzeNews("What's happening in Kigalli?");

      expect(countryNewsService.getCountryNews).toHaveBeenCalledWith(
        'RWA',
        undefined,
        20,
        'kigali',
      );
      expect(response.retrievalContext.matchedFrom).toBe('kigalli');
      expect(response.retrievalContext.canonicalLocation).toBe('kigali');
      expect(response.sourceEntities).toEqual({ organizations: [] });
    });
  });

  describe('evidence citations (Milestone #31)', () => {
    it('resolves a live provider evidenceId (S1) to the real article ID end-to-end', async () => {
      const articles = [makeArticle({ id: 'real-article-id', title: 'Story A' })];

      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
      };
      const countryNewsService = makeCountryNewsService();

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response = await service.analyzeNews('evidence resolution test');

      expect(response.analysis?.keyFacts).toHaveLength(1);
      expect(response.analysis?.keyFacts[0].sourceArticleIds).toEqual(['real-article-id']);
    });

    it('a duplicate article removed by clusterDuplicateArticles has no evidenceId, so citing its would-be slot resolves nothing', async () => {
      const sharedUrl = 'https://example.com/duplicate-story';
      const publishedAt = new Date().toISOString();

      const articles = [
        makeArticle({ id: 'kept-article', url: sharedUrl, publishedAt, title: 'Original report' }),
        makeArticle({
          id: 'removed-duplicate',
          url: sharedUrl, // identical URL -> deduplicated away before evidence IDs are assigned
          publishedAt,
          title: 'Original report (wire copy)',
        }),
      ];

      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
      };
      const countryNewsService = { getCountryNews: jest.fn() };

      // The provider (hypothetically hallucinating) cites S2, which would
      // have been the duplicate's slot had it survived deduplication.
      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue({
          ...validCandidateFor(articles),
          keyFacts: [{ claim: 'Cites the deduplicated slot', evidenceIds: ['S2'] }],
        }),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response = await service.analyzeNews('duplicate evidence test');

      expect(response.articles.map((a) => a.id)).toEqual(['kept-article']);
      // S2 does not exist in this request's (post-dedup) evidence set,
      // so the citation is dropped rather than trusted.
      expect(response.analysis?.keyFacts).toEqual([]);
    });

    it('an article removed by the maxArticles cap has no evidenceId, so citing its would-be slot resolves nothing', async () => {
      const articles = [
        makeArticle({ id: 'kept-article', title: 'Kept story' }),
        makeArticle({
          id: 'capped-article',
          url: 'https://example.com/capped',
          title: 'Capped story',
        }),
      ];

      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
      };
      const countryNewsService = { getCountryNews: jest.fn() };

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue({
          ...validCandidateFor(articles),
          keyFacts: [{ claim: 'Cites the capped slot', evidenceIds: ['S2'] }],
        }),
      };

      // maxArticles: 1 forces the cap to drop the second article before
      // evidence IDs are ever assigned.
      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService({ maxArticles: 1 }),
      );

      const response = await service.analyzeNews('capped evidence test');

      expect(response.articles.map((a) => a.id)).toEqual(['kept-article']);
      expect(response.analysis?.keyFacts).toEqual([]);
    });

    it('a cached response never carries a request-local evidenceId — only real article IDs', async () => {
      const articles = [makeArticle({ id: 'cache-evidence-article' })];

      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
      };
      const countryNewsService = { getCountryNews: jest.fn() };

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      await service.analyzeNews('cache evidence test');
      const cached = await service.analyzeNews('cache evidence test');

      expect(newsService.search).toHaveBeenCalledTimes(1);
      expect(cached.analysis?.keyFacts[0].sourceArticleIds).toEqual(['cache-evidence-article']);
      const serialized = JSON.stringify(cached);
      expect(serialized).not.toMatch(/"S1"/);
    });
  });

  describe('evidence basis & breadth (Milestone #32)', () => {
    it('threads config.maxArticleChars into validation so evidenceBasis excerpts are checked against exactly what the provider was shown', async () => {
      const longSummary = `${'padding '.repeat(200)}a unique tail phrase past the cutoff`;
      const articles = [
        makeArticle({ id: 'real-article-id', title: 'Story A', summary: longSummary }),
      ];

      const newsService = { search: jest.fn().mockResolvedValue(makeSearchResponse(articles)) };
      const countryNewsService = { getCountryNews: jest.fn() };

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue({
          ...validCandidateFor(articles),
          keyFacts: [
            {
              claim: articles[0].title,
              evidenceIds: ['S1'],
              evidenceBasis: { evidenceId: 'S1', excerpt: 'a unique tail phrase past the cutoff' },
            },
          ],
        }),
      };

      // A small maxArticleChars means the excerpt (which sits past the
      // cutoff) is NOT part of what the provider was actually shown.
      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService({ maxArticleChars: 30 }),
      );

      const response = await service.analyzeNews('evidence basis truncation test');

      expect(response.analysis?.keyFacts[0].sourceArticleIds).toEqual(['real-article-id']);
      expect(response.analysis?.keyFacts[0].evidenceBasis).toBeUndefined();
    });

    it('accepts a valid evidenceBasis end-to-end when the excerpt is within the configured truncation length', async () => {
      const articles = [
        makeArticle({
          id: 'real-article-id',
          title: 'Story A',
          summary: 'A short summary of the event.',
        }),
      ];

      const newsService = { search: jest.fn().mockResolvedValue(makeSearchResponse(articles)) };
      const countryNewsService = { getCountryNews: jest.fn() };

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue({
          ...validCandidateFor(articles),
          keyFacts: [
            {
              claim: articles[0].title,
              evidenceIds: ['S1'],
              evidenceBasis: { evidenceId: 'S1', excerpt: 'short summary of the event' },
            },
          ],
        }),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response = await service.analyzeNews('evidence basis success test');

      expect(response.analysis?.keyFacts[0].evidenceBasis).toEqual({
        articleId: 'real-article-id',
        excerpt: 'short summary of the event',
      });
      expect(response.analysis?.keyFacts[0].evidenceBreadth).toEqual({
        sourceCount: 1,
        singleSource: true,
      });
    });

    it('a cached response never carries a request-local evidenceId in evidenceBasis either — only real article IDs', async () => {
      const articles = [
        makeArticle({
          id: 'cache-evidence-article',
          title: 'Story A',
          summary: 'A short summary here.',
        }),
      ];

      const newsService = { search: jest.fn().mockResolvedValue(makeSearchResponse(articles)) };
      const countryNewsService = { getCountryNews: jest.fn() };

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue({
          ...validCandidateFor(articles),
          keyFacts: [
            {
              claim: articles[0].title,
              evidenceIds: ['S1'],
              evidenceBasis: { evidenceId: 'S1', excerpt: 'short summary here' },
            },
          ],
        }),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      await service.analyzeNews('cache evidence basis test');
      const cached = await service.analyzeNews('cache evidence basis test');

      expect(newsService.search).toHaveBeenCalledTimes(1);
      expect(cached.analysis?.keyFacts[0].evidenceBasis?.articleId).toBe('cache-evidence-article');
      const serialized = JSON.stringify(cached);
      expect(serialized).not.toMatch(/"S1"/);
    });

    it('M30 provenance is unaffected by evidence-basis validation success or failure', async () => {
      const articles = [makeArticle({ id: 'real-article-id', title: 'Story A', summary: 'x' })];
      const newsService = { search: jest.fn().mockResolvedValue(makeSearchResponse(articles)) };
      const countryNewsService = { getCountryNews: jest.fn() };

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue({
          ...validCandidateFor(articles),
          keyFacts: [
            {
              claim: articles[0].title,
              evidenceIds: ['S1'],
              evidenceBasis: { evidenceId: 'S1', excerpt: 'text not present anywhere' },
            },
          ],
        }),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response = await service.analyzeNews('provenance unaffected test');

      expect(response.provenance.status).toBe('success');
      expect(response.analysis?.keyFacts[0].evidenceBasis).toBeUndefined();
    });
  });

  describe('generic query normalization (Milestone #35)', () => {
    it('derives a concise search phrase for a natural-language non-country query', async () => {
      const articles = [makeArticle({ id: 'nato-1', title: 'NATO summit coverage' })];

      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
      };
      const countryNewsService = { getCountryNews: jest.fn() };

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      await service.analyzeNews("What's going on with OpenAI?");

      // Milestone #35: the provider search term is the derived phrase,
      // not the raw sentence — see derive-generic-news-query.util.ts.
      expect(newsService.search).toHaveBeenCalledWith('OpenAI', 20, {
        type: 'generic',
      });
      expect(countryNewsService.getCountryNews).not.toHaveBeenCalled();
    });

    it('does not alter what is sent to the AI provider or echoed back as the query/normalizedQuery — only the provider search term changes', async () => {
      const articles = [makeArticle({ id: 'nato-2' })];

      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
      };
      const countryNewsService = { getCountryNews: jest.fn() };

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response = await service.analyzeNews("What's happening with NATO?");

      expect(response.query).toBe("What's happening with NATO?");
      expect(response.normalizedQuery).toBe("What's happening with NATO?");
      expect(newsService.search).toHaveBeenCalledWith('NATO', 20, {
        type: 'generic',
      });
    });

    it('country routing remains completely unaffected: a resolvable country query never reaches the generic-search phrase derivation', async () => {
      const articles = [makeArticle({ id: 'spain-1' })];

      const newsService = { search: jest.fn() };
      const countryNewsService = makeCountryNewsService();
      countryNewsService.getCountryNews = jest
        .fn()
        .mockResolvedValue(makeCountryResponse('ESP', 'Spain', articles));

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      await service.analyzeNews('Spain');

      expect(countryNewsService.getCountryNews).toHaveBeenCalled();
      // The generic-search path (and therefore query derivation) is
      // never reached for a resolvable country query.
      expect(newsService.search).not.toHaveBeenCalled();
    });

    it('a query already resolving through a typo-tolerant geographic match still never reaches generic-search phrase derivation', async () => {
      const articles = [makeArticle({ id: 'kigali-typo-2' })];

      const newsService = { search: jest.fn() };
      const countryNewsService = makeCountryNewsService();
      countryNewsService.getCountryNews = jest
        .fn()
        .mockResolvedValue(makeCountryResponse('RWA', 'Rwanda', articles, { city: 'kigali' }));

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      await service.analyzeNews("What's happening in Kigalli?");

      expect(countryNewsService.getCountryNews).toHaveBeenCalled();
      expect(newsService.search).not.toHaveBeenCalled();
    });
  });

  describe('relational query decomposition (Milestone #37)', () => {
    it('a matched relational query makes exactly ONE NewsService.search call, with provider query = `${x} ${y}` and the relational relevance mode carrying the exact x/y', async () => {
      const articles = [
        makeArticle({
          id: 'iran-oil-1',
          title: 'Oil prices rise sharply as Iran conflict disrupts shipping',
        }),
      ];

      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
      };
      const countryNewsService = { getCountryNews: jest.fn() };

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      await service.analyzeNews('How is the Iran conflict affecting oil prices?');

      expect(newsService.search).toHaveBeenCalledTimes(1);
      expect(newsService.search).toHaveBeenCalledWith('Iran conflict oil prices', 20, {
        type: 'relational',
        x: 'Iran conflict',
        y: 'oil prices',
      });
      expect(countryNewsService.getCountryNews).not.toHaveBeenCalled();
    });

    it("the AI still receives the user's ORIGINAL question, not the decomposed x/y or provider query", async () => {
      const articles = [makeArticle({ id: 'iran-oil-2' })];

      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
      };
      const countryNewsService = { getCountryNews: jest.fn() };

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response = await service.analyzeNews('How is the Iran conflict affecting oil prices?');

      expect(response.query).toBe('How is the Iran conflict affecting oil prices?');
      expect(response.normalizedQuery).toBe('How is the Iran conflict affecting oil prices?');
    });

    it('an unmatched relational-looking query falls back safely to the existing M35/M36 generic path', async () => {
      const articles = [makeArticle({ id: 'general-relational-fallback' })];

      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
      };
      const countryNewsService = { getCountryNews: jest.fn() };

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      // Does not match any of the 4 closed relational patterns.
      await service.analyzeNews('Tell me everything about the situation');

      expect(newsService.search).toHaveBeenCalledTimes(1);
      expect(newsService.search).toHaveBeenCalledWith(
        'Tell me everything about the situation',
        20,
        { type: 'generic' },
      );
    });

    it('regression: "What\'s happening in cybersecurity?" is unaffected by the new relational branch', async () => {
      const articles = [makeArticle({ id: 'cyber-regression' })];

      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
      };
      const countryNewsService = { getCountryNews: jest.fn() };

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      await service.analyzeNews("What's happening in cybersecurity?");

      expect(newsService.search).toHaveBeenCalledWith('cybersecurity', 20, {
        type: 'generic',
      });
    });

    it('regression: "What\'s going on with OpenAI?" is unaffected by the new relational branch', async () => {
      const articles = [makeArticle({ id: 'openai-regression' })];

      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
      };
      const countryNewsService = { getCountryNews: jest.fn() };

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      await service.analyzeNews("What's going on with OpenAI?");

      expect(newsService.search).toHaveBeenCalledWith('OpenAI', 20, {
        type: 'generic',
      });
    });

    it('regression: "What\'s happening in the Middle East?" is unaffected by the new relational branch', async () => {
      const articles = [makeArticle({ id: 'middle-east-regression' })];

      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
      };
      const countryNewsService = { getCountryNews: jest.fn() };

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      await service.analyzeNews("What's happening in the Middle East?");

      expect(newsService.search).toHaveBeenCalledWith('Middle East', 20, {
        type: 'generic',
      });
    });

    it('regression: country query "Ukraine" is unaffected by the new relational branch', async () => {
      const articles = [makeArticle({ id: 'ukraine-regression' })];

      const newsService = { search: jest.fn() };
      const countryNewsService = makeCountryNewsService();
      countryNewsService.getCountryNews = jest
        .fn()
        .mockResolvedValue(makeCountryResponse('UKR', 'Ukraine', articles));

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      await service.analyzeNews('Ukraine');

      expect(countryNewsService.getCountryNews).toHaveBeenCalled();
      expect(newsService.search).not.toHaveBeenCalled();
    });

    it('regression: city/typo query "What\'s happening in Kigalli?" is unaffected by the new relational branch', async () => {
      const articles = [makeArticle({ id: 'kigali-regression' })];

      const newsService = { search: jest.fn() };
      const countryNewsService = makeCountryNewsService();
      countryNewsService.getCountryNews = jest
        .fn()
        .mockResolvedValue(makeCountryResponse('RWA', 'Rwanda', articles, { city: 'kigali' }));

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      await service.analyzeNews("What's happening in Kigalli?");

      expect(countryNewsService.getCountryNews).toHaveBeenCalled();
      expect(newsService.search).not.toHaveBeenCalled();
    });
  });

  describe('Milestone #41 production wiring: relationalContext reaches validateAnalysisResult', () => {
    it('A. relational query: the exact M37-derived x/y reaches the validated relationalComposition summary', async () => {
      const articles = [
        makeArticle({
          id: 'real-article-1',
          title: 'Oil prices rise sharply as Iran conflict disrupts shipping',
          summary:
            'Oil prices climbed as the Iran conflict continued to disrupt regional shipping lanes.',
        }),
      ];

      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
      };
      const countryNewsService = { getCountryNews: jest.fn() };

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue({
          ...validCandidateFor(articles),
          keyFacts: [
            {
              claim: 'Iran conflict is disrupting shipping and lifting oil prices',
              evidenceIds: ['S1'],
              relationshipAssessmentIds: ['R1'],
            },
          ],
          relationalEvidenceAssessments: [
            {
              assessmentId: 'R1',
              evidenceId: 'S1',
              excerpt:
                'Oil prices climbed as the Iran conflict continued to disrupt regional shipping lanes',
              direction: 'requested-direction',
            },
          ],
        }),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response = await service.analyzeNews('How is the Iran conflict affecting oil prices?');

      // Real production wiring: AnalysisService's own M37-derived x/y
      // ("Iran conflict" / "oil prices") is what reaches the validated
      // relationalComposition — not re-derived, not synthesized here.
      expect(response.analysis?.relationalComposition?.directionalEligibility).toBe('supported');
      expect(response.analysis?.relationalComposition?.summary).toContain('"Iran conflict"');
      expect(response.analysis?.relationalComposition?.summary).toContain('"oil prices"');
    });

    it('B. reversed relational query: the reversed authoritative pair is used, never silently reverted to the forward orientation', async () => {
      const articles = [
        makeArticle({
          id: 'real-article-2',
          title: 'Oil prices remain volatile amid Iran conflict uncertainty',
          summary:
            'Analysts say oil prices continue to influence how the Iran conflict is perceived in energy markets.',
        }),
      ];

      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
      };
      const countryNewsService = { getCountryNews: jest.fn() };

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue({
          ...validCandidateFor(articles),
          keyFacts: [
            {
              claim: 'Oil price volatility is shaping perceptions of the Iran conflict',
              evidenceIds: ['S1'],
              relationshipAssessmentIds: ['R1'],
            },
          ],
          relationalEvidenceAssessments: [
            {
              assessmentId: 'R1',
              evidenceId: 'S1',
              excerpt: 'oil prices continue to influence how the Iran conflict is perceived',
              direction: 'requested-direction',
            },
          ],
        }),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      // Reversed phrasing: x="oil prices", y="Iran conflict" (per
      // deriveRelationalSearchQueries's own "How is X affecting Y"
      // extraction), the opposite orientation from test A.
      const response = await service.analyzeNews('How is oil prices affecting Iran conflict?');

      expect(response.analysis?.relationalComposition?.summary).toContain('"oil prices"');
      expect(response.analysis?.relationalComposition?.summary).toContain('"Iran conflict"');
      // Specifically proves the ORDER reversed vs test A: the requested
      // direction here is oil prices -> Iran conflict, not the reverse.
      expect(response.analysis?.relationalComposition?.summary).toMatch(
        /from\s+"oil prices"\s+to\s+"Iran conflict"/,
      );
    });

    it('C. generic (non-relational) query: no relationalComposition is created', async () => {
      const articles = [makeArticle({ id: 'generic-article' })];

      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
      };
      const countryNewsService = { getCountryNews: jest.fn() };

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response = await service.analyzeNews("What's happening in cybersecurity?");

      expect(response.analysis?.relationalComposition).toBeUndefined();
    });

    it('D. country query: no relationalComposition is created', async () => {
      const articles = [makeArticle({ id: 'country-article' })];
      const newsService = { search: jest.fn() };
      const countryNewsService = makeCountryNewsService();
      countryNewsService.getCountryNews = jest
        .fn()
        .mockResolvedValue(makeCountryResponse('UKR', 'Ukraine', articles));

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response = await service.analyzeNews('Ukraine');

      expect(response.analysis?.relationalComposition).toBeUndefined();
    });

    it('E. a non-relational query cannot have relationalComposition manufactured by a provider that emits relational-shaped fields anyway', async () => {
      const articles = [
        makeArticle({ id: 'x-article', title: 'Test', summary: 'Test summary text here.' }),
      ];

      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
      };
      const countryNewsService = { getCountryNews: jest.fn() };

      // The provider misbehaves and returns relational-shaped output
      // even though AnalysisService's own routing never identified this
      // query as relational (relationalContext stays undefined at the
      // AnalysisService level for this query text).
      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue({
          ...validCandidateFor(articles),
          keyFacts: [{ claim: 'x', evidenceIds: ['S1'], relationshipAssessmentIds: ['R1'] }],
          relationalEvidenceAssessments: [
            {
              assessmentId: 'R1',
              evidenceId: 'S1',
              excerpt: 'Test summary text here',
              direction: 'requested-direction',
            },
          ],
        }),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      // Plain non-relational, non-country generic query text.
      const response = await service.analyzeNews('Tell me about markets today');

      // Only AnalysisService's own M37 routing may ever set
      // relationalContext — a provider cannot manufacture it merely by
      // emitting relational-shaped candidate fields. The M40 fail-closed
      // gate (relationalContextPresent) forces relationalEvidenceAssessments
      // empty, and M41's relationalComposition is never built at all.
      expect(response.analysis?.relationalEvidenceAssessments).toEqual([]);
      expect(response.analysis?.relationalComposition).toBeUndefined();
    });

    it('F. preserves the existing M40 assertion that provider.analyzeNews receives relationalContext for a matched relational query (unchanged, not weakened)', async () => {
      const articles = [makeArticle({ id: 'iran-oil-3' })];

      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
      };
      const countryNewsService = { getCountryNews: jest.fn() };

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      await service.analyzeNews('How is the Iran conflict affecting oil prices?');

      expect(provider.analyzeNews).toHaveBeenCalledWith(
        expect.objectContaining({
          relationalContext: { x: 'Iran conflict', y: 'oil prices' },
        }),
      );
    });
  });

  describe('Milestone #45 — backend in-flight request collapse', () => {
    function deferred<T>() {
      let resolve!: (value: T) => void;
      let reject!: (error: unknown) => void;
      const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    }

    it('C1/C2. two simultaneous identical uncached questions: provider called exactly ONCE, both callers resolve successfully with the same result', async () => {
      const articles = [makeArticle({ id: 'a1' })];
      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
      };
      const countryNewsService = { getCountryNews: jest.fn() };

      const pending = deferred<unknown>();
      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockReturnValue(pending.promise),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const call1 = service.analyzeNews('same question here');
      const call2 = service.analyzeNews('same question here');

      pending.resolve(validCandidateFor(articles));

      const [result1, result2] = await Promise.all([call1, call2]);

      expect(provider.analyzeNews).toHaveBeenCalledTimes(1);
      expect(result1.analysis).toEqual(result2.analysis);
    });

    it('CORRECTION: two concurrent normalized-equivalent but RAW-DIFFERENT queries share one provider execution, yet each caller receives its OWN query/normalizedQuery in the response envelope', async () => {
      const articles = [makeArticle({ id: 'a1' })];
      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
      };
      const countryNewsService = { getCountryNews: jest.fn() };

      const pending = deferred<unknown>();
      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockReturnValue(pending.promise),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const rawQueryA = 'How is Iran conflict affecting oil prices?';
      const rawQueryB = '  HOW IS IRAN CONFLICT AFFECTING OIL PRICES?  ';

      const callA = service.analyzeNews(rawQueryA);
      const callB = service.analyzeNews(rawQueryB);

      pending.resolve(validCandidateFor(articles));

      const [responseA, responseB] = await Promise.all([callA, callB]);

      // 1/8. provider invocation count === 1
      expect(provider.analyzeNews).toHaveBeenCalledTimes(1);
      // 2/8. retrieval is not duplicated beyond existing architecture
      // semantics — one shared operation means one retrieval, exactly
      // like the existing C1/C2 case.
      expect(newsService.search).toHaveBeenCalledTimes(1);
      // 3/8. Caller A's response.query is Caller A's own raw query.
      expect(responseA.query).toBe(rawQueryA);
      // 4/8. Caller B's response.query is Caller B's own raw query —
      // NEVER inherited from Caller A, even though they shared one
      // underlying operation.
      expect(responseB.query).toBe(rawQueryB);
      // 5/8. each response carries the CORRECT normalizedQuery for
      // ITS OWN caller — normalizeQuery() trims/collapses whitespace
      // but deliberately never lowercases (only the internal cacheKey
      // does, via .toLowerCase()), so Caller A's and Caller B's
      // normalizedQuery are legitimately DIFFERENT strings here
      // (differing in case) even though both correctly map to the same
      // cacheKey and therefore share one operation. Asserting equality
      // between A and B would be wrong; asserting each against its own
      // raw input is the actually-correct, caller-specific check.
      expect(responseA.normalizedQuery).toBe(rawQueryA);
      expect(responseB.normalizedQuery).toBe(rawQueryB.trim());
      // 6/8. the analysis result itself remains shared/equivalent.
      expect(responseA.analysis).toEqual(responseB.analysis);
      // 7/8. TrustState semantics are unchanged — both callers see the
      // exact same (shared, unrecalculated) trustState.
      expect(responseA.analysis?.trustState).toEqual(responseB.analysis?.trustState);
      // 8/8. no second AI/provider execution occurred (re-asserted
      // explicitly, distinct from #1, for clarity of intent).
      expect(provider.analyzeNews).toHaveBeenCalledTimes(1);

      // The in-flight joiner must NOT be mislabeled as served from the
      // completed TTL cache — it awaited a genuinely fresh, still-in-
      // progress generation, not a stored cache entry.
      expect(responseA.provenance.cached).toBe(false);
      expect(responseB.provenance.cached).toBe(false);
    });

    it('C3. equivalent normalized questions (casing/whitespace) deduplicate according to the existing cache normalization', async () => {
      const articles = [makeArticle({ id: 'a1' })];
      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
      };
      const countryNewsService = { getCountryNews: jest.fn() };

      const pending = deferred<unknown>();
      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockReturnValue(pending.promise),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const call1 = service.analyzeNews('  Same Question Here  ');
      const call2 = service.analyzeNews('same question here');

      pending.resolve(validCandidateFor(articles));
      await Promise.all([call1, call2]);

      expect(provider.analyzeNews).toHaveBeenCalledTimes(1);
    });

    it('C4. different questions do NOT deduplicate', async () => {
      const articles = [makeArticle({ id: 'a1' })];
      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
      };
      const countryNewsService = { getCountryNews: jest.fn() };

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      await Promise.all([
        service.analyzeNews('first distinct question'),
        service.analyzeNews('second distinct question'),
      ]);

      expect(provider.analyzeNews).toHaveBeenCalledTimes(2);
    });

    it('C5. after successful settlement the in-flight entry is cleared — a later independent request calls the provider again (respecting the completed cache, see C8)', async () => {
      const articles = [makeArticle({ id: 'a1' })];
      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
      };
      const countryNewsService = { getCountryNews: jest.fn() };

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
      };

      // cacheTtlSeconds: 0 so the completed cache never masks this
      // specifically-in-flight-lifecycle assertion.
      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService({ cacheTtlSeconds: 0 }),
      );

      await service.analyzeNews('settles then repeats');
      await service.analyzeNews('settles then repeats');

      expect(provider.analyzeNews).toHaveBeenCalledTimes(2);
    });

    it('C6/C7. after a FAILED shared operation the in-flight entry is cleared, and a later request can invoke the provider again', async () => {
      const articles = [makeArticle({ id: 'a1' })];
      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
      };
      const countryNewsService = { getCountryNews: jest.fn() };

      const pending = deferred<unknown>();
      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest
          .fn()
          .mockReturnValueOnce(pending.promise)
          .mockResolvedValueOnce(validCandidateFor(articles)),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService({ cacheTtlSeconds: 0 }),
      );

      const call1 = service.analyzeNews('fails then retried');
      const call2 = service.analyzeNews('fails then retried');

      pending.reject(new Error('simulated provider failure'));

      const [response1, response2] = await Promise.all([call1, call2]);

      // Both concurrent callers see the SAME truthful failure response
      // (never a mock fallback, never a thrown exception out of
      // analyzeNews — AnalysisService always resolves to a response
      // object with provenance describing the failure).
      expect(response1.analysis).toBeNull();
      expect(response2.analysis).toBeNull();
      expect(provider.analyzeNews).toHaveBeenCalledTimes(1);

      // C7: a later, independent request is not poisoned by the earlier
      // failure — it invokes the provider again normally.
      const response3 = await service.analyzeNews('fails then retried');
      expect(response3.analysis).not.toBeNull();
      expect(provider.analyzeNews).toHaveBeenCalledTimes(2);
    });

    it('C8. the existing completed-result cache still prevents provider invocation exactly as before', async () => {
      const articles = [makeArticle({ id: 'a1' })];
      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
      };
      const countryNewsService = { getCountryNews: jest.fn() };

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService({ cacheTtlSeconds: 300 }),
      );

      await service.analyzeNews('cached question');
      const second = await service.analyzeNews('cached question');

      expect(provider.analyzeNews).toHaveBeenCalledTimes(1);
      expect(second.provenance.cached).toBe(true);
    });

    it('C9. cache TTL behavior is unaffected by the in-flight dedup addition', async () => {
      const articles = [makeArticle({ id: 'a1' })];
      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
      };
      const countryNewsService = { getCountryNews: jest.fn() };

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService({ cacheTtlSeconds: 0 }),
      );

      await service.analyzeNews('zero ttl question');
      await service.analyzeNews('zero ttl question');

      // cacheTtlSeconds: 0 means each SEQUENTIAL (settled-between) call
      // is a fresh operation — unchanged from pre-M45 behavior.
      expect(provider.analyzeNews).toHaveBeenCalledTimes(2);
    });
  });

  describe('Milestone #46 — generic retrieval bounded fallback', () => {
    it('the exact real-runtime NATO failure query now correctly derives to "NATO" as the primary provider search term', async () => {
      const articles = [
        makeArticle({
          id: 'nato-1',
          title: 'NATO defense ministers meet to discuss Ukraine support package',
          summary: 'Officials gathered in Brussels to finalize a new round of military aid.',
        }),
      ];
      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
      };
      const countryNewsService = { getCountryNews: jest.fn() };
      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      await service.analyzeNews('What are the most important developments in NATO right now?');

      expect(newsService.search).toHaveBeenCalledWith('NATO', expect.any(Number), {
        type: 'generic',
      });
    });

    it('UN generic query derives correctly and performs exactly ONE primary provider search when it returns results', async () => {
      const articles = [
        makeArticle({
          id: 'un-1',
          title: 'UN Security Council to vote on new sanctions resolution',
          summary: 'The measure targets funding channels linked to ongoing regional conflict.',
        }),
      ];
      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
      };
      const countryNewsService = { getCountryNews: jest.fn() };
      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      await service.analyzeNews('What are the latest developments in the UN?');

      expect(newsService.search).toHaveBeenCalledWith('UN', expect.any(Number), {
        type: 'generic',
      });
      // successful primary retrieval performs exactly one provider search
      expect(newsService.search).toHaveBeenCalledTimes(1);
    });

    it('generic multi-word topical query still resolves to a concise search term', async () => {
      const articles = [
        makeArticle({ id: 'sc-1', title: 'Semiconductor exports face new restrictions' }),
      ];
      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
      };
      const countryNewsService = { getCountryNews: jest.fn() };
      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      await service.analyzeNews('Latest developments in semiconductor exports');

      expect(newsService.search).toHaveBeenCalledWith('semiconductor exports', expect.any(Number), {
        type: 'generic',
      });
    });

    it('fallback occurs ONLY after the primary search returns zero relevant articles — exactly one additional provider search, provider call count capped at 2', async () => {
      const fallbackArticles = [
        makeArticle({ id: 'fallback-1', title: 'Global tariffs reshape trade routes' }),
      ];
      const newsService = {
        search: jest
          .fn()
          .mockResolvedValueOnce(makeSearchResponse([])) // primary: zero results
          .mockResolvedValueOnce(makeSearchResponse(fallbackArticles)), // fallback: succeeds
      };
      const countryNewsService = { getCountryNews: jest.fn() };
      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(fallbackArticles)),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response = await service.analyzeNews(
        'What is the impact of new tariffs on global trade?',
      );

      // provider call count remains bounded: exactly 2 GNews searches
      // (primary + one fallback), zero additional OpenAI calls.
      expect(newsService.search).toHaveBeenCalledTimes(2);
      expect(provider.analyzeNews).toHaveBeenCalledTimes(1);
      expect(response.articles.length).toBeGreaterThan(0);
    });

    it('successful primary retrieval performs exactly ONE provider search — no fallback attempted when primary already returned articles', async () => {
      const articles = [makeArticle({ id: 'a1' })];
      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
      };
      const countryNewsService = { getCountryNews: jest.fn() };
      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      await service.analyzeNews('Tell me about oil prices');

      expect(newsService.search).toHaveBeenCalledTimes(1);
    });

    it('a nonsense query with zero results even after the bounded fallback still returns no fabricated evidence', async () => {
      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse([])), // both attempts return zero
      };
      const countryNewsService = { getCountryNews: jest.fn() };
      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn(),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response = await service.analyzeNews('asdkfj qpwoeiru zxcvbnm nonsense query');

      expect(response.analysis).toBeNull();
      expect(response.articles).toEqual([]);
      expect(provider.analyzeNews).not.toHaveBeenCalled();
      // at most 2 provider searches attempted, never more (fallback is
      // only skipped here because deriveFallbackNewsQuery has nothing
      // meaningful to strip from an already-short nonsense phrase — the
      // important invariant is the search count never exceeds 2).
      expect(newsService.search.mock.calls.length).toBeLessThanOrEqual(2);
    });

    it('the fallback query is DIFFERENT from the primary query (never re-runs an identical search)', async () => {
      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse([])),
      };
      const countryNewsService = { getCountryNews: jest.fn() };
      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn(),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      await service.analyzeNews('What is the impact of new tariffs on global trade?');

      const calls = (newsService.search as jest.Mock).mock.calls;
      if (calls.length === 2) {
        expect(calls[0][0]).not.toBe(calls[1][0]);
      }
    });
  });

  describe('Milestone #47 — language contract and Polish staged retrieval', () => {
    it('1. no requestedLanguage argument -> defaults to English (requestedLanguage=en, responseLanguage=en)', async () => {
      const articles = [makeArticle({ id: 'a1', title: 'NATO defense ministers meet' })];
      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
        topHeadlines: jest.fn(),
      };
      const countryNewsService = { getCountryNews: jest.fn() };
      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
      };
      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response = await service.analyzeNews(
        'What are the most important developments in NATO right now?',
      );

      expect(response.requestedLanguage).toBe('en');
      expect(response.responseLanguage).toBe('en');
      expect(newsService.topHeadlines).not.toHaveBeenCalled();
    });

    it('2. requestedLanguage="en" explicit behaves identically to the default', async () => {
      const articles = [makeArticle({ id: 'a1' })];
      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
        topHeadlines: jest.fn(),
      };
      const countryNewsService = { getCountryNews: jest.fn() };
      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
      };
      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response = await service.analyzeNews('Tell me about oil prices', 'en');

      expect(response.requestedLanguage).toBe('en');
      expect(response.responseLanguage).toBe('en');
    });

    it('3. Polish primary retrieval success: exactly ONE provider call (topHeadlines only), lang=pl, q=derived topic', async () => {
      const natoArticle = makeArticle({
        id: 'nato-pl-1',
        title: 'NATO ministrowie obrony spotykają się',
        summary: 'NATO ogłosiło nowe zobowiązania obronne.',
      });
      const newsService = {
        search: jest.fn(),
        topHeadlines: jest.fn().mockResolvedValue(makeSearchResponse([natoArticle])),
      };
      const countryNewsService = { getCountryNews: jest.fn() };
      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor([natoArticle])),
      };
      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response = await service.analyzeNews('Co dzieje się teraz w NATO?', 'pl');

      expect(newsService.search).not.toHaveBeenCalled();
      expect(newsService.topHeadlines).toHaveBeenCalledTimes(1);
      expect(newsService.topHeadlines).toHaveBeenCalledWith(
        expect.any(Number),
        expect.objectContaining({ lang: 'pl', q: 'NATO' }),
      );
      expect(response.requestedLanguage).toBe('pl');
      expect(response.responseLanguage).toBe('pl');
      expect(response.articles[0]?.id).toBe('nato-pl-1');
    });

    it('4. Polish primary zero relevant -> exactly ONE bounded English Search fallback (total 2 provider calls), never a third call', async () => {
      const irrelevantPlArticle = makeArticle({
        id: 'irrelevant-pl',
        title: 'Something completely unrelated',
        summary: 'Nothing about the topic at all here.',
      });
      const fallbackArticle = makeArticle({
        id: 'en-fallback-1',
        title: 'NATO defense ministers meet to discuss regional security',
      });
      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse([fallbackArticle])),
        topHeadlines: jest.fn().mockResolvedValue(makeSearchResponse([irrelevantPlArticle])),
      };
      const countryNewsService = { getCountryNews: jest.fn() };
      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor([fallbackArticle])),
      };
      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response = await service.analyzeNews('Co dzieje się teraz w NATO?', 'pl');

      expect(newsService.topHeadlines).toHaveBeenCalledTimes(1);
      expect(newsService.search).toHaveBeenCalledTimes(1);
      expect(newsService.search).toHaveBeenCalledWith('NATO', expect.any(Number), {
        type: 'generic',
      });
      expect(response.responseLanguage).toBe('pl');
      expect(response.articles[0]?.id).toBe('en-fallback-1');
    });

    it('5. Polish both stages zero relevant: exactly 2 provider calls total, NEVER 3, no OpenAI call, no fabricated evidence', async () => {
      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse([])),
        topHeadlines: jest.fn().mockResolvedValue(makeSearchResponse([])),
      };
      const countryNewsService = { getCountryNews: jest.fn() };
      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn(),
      };
      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response = await service.analyzeNews('Co dzieje się teraz w NATO?', 'pl');

      expect(newsService.topHeadlines).toHaveBeenCalledTimes(1);
      expect(newsService.search).toHaveBeenCalledTimes(1);
      expect(provider.analyzeNews).not.toHaveBeenCalled();
      expect(response.analysis).toBeNull();
      expect(response.responseLanguage).toBe('pl');
    });

    it('6. cache key includes language — identical query text for English vs. Polish never collides', async () => {
      const enArticle = makeArticle({ id: 'en-1', title: 'NATO defense ministers meet' });
      const plArticle = makeArticle({
        id: 'pl-1',
        title: 'NATO ministrowie obrony',
        summary: 'NATO ogłosiło nowe zobowiązania.',
      });
      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse([enArticle])),
        topHeadlines: jest.fn().mockResolvedValue(makeSearchResponse([plArticle])),
      };
      const countryNewsService = { getCountryNews: jest.fn() };
      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest
          .fn()
          .mockImplementation((input: { articles: NewsArticle[] }) =>
            validCandidateFor(input.articles),
          ),
      };
      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService({ cacheTtlSeconds: 300 }),
      );

      const respEn = await service.analyzeNews('NATO', 'en');
      const respPl = await service.analyzeNews('NATO', 'pl');

      expect(newsService.search).toHaveBeenCalledTimes(1);
      expect(newsService.topHeadlines).toHaveBeenCalledTimes(1);
      expect(respEn.articles[0]?.id).toBe('en-1');
      expect(respPl.articles[0]?.id).toBe('pl-1');
    });

    it('7. requestedLanguage does not affect English relational-pattern matching — a genuine English relational query still routes to the relational branch regardless of requestedLanguage', async () => {
      const articles = [
        makeArticle({ id: 'iran-1', title: 'Oil prices rise as Iran conflict disrupts shipping' }),
      ];
      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
        topHeadlines: jest.fn(),
      };
      const countryNewsService = { getCountryNews: jest.fn() };
      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
      };
      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      await service.analyzeNews('How is the Iran conflict affecting oil prices?', 'pl');

      expect(newsService.search).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        expect.objectContaining({ type: 'relational' }),
      );
    });

    it('8. Polish diacritics preserved through the full retrieval flow (q sent to topHeadlines matches the derived topic exactly)', async () => {
      const article = makeArticle({
        id: 'warsaw-1',
        title: 'Warszawa ogłasza nowy program inwestycyjny',
        summary: 'Warszawa planuje zwiększyć wydatki na infrastrukturę miejską.',
      });
      const newsService = {
        search: jest.fn(),
        topHeadlines: jest.fn().mockResolvedValue(makeSearchResponse([article])),
      };
      const countryNewsService = { getCountryNews: jest.fn() };
      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(validCandidateFor([article])),
      };
      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      await service.analyzeNews('Co dzieje się teraz w Warszawie?', 'pl');

      expect(newsService.topHeadlines).toHaveBeenCalledWith(
        expect.any(Number),
        expect.objectContaining({ q: 'Warszawa' }),
      );
    });

    it('9. (backend no-evidence response-language correction) zero-evidence analysisError honors requestedLanguage="en"', async () => {
      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse([])),
        topHeadlines: jest.fn(),
      };
      const countryNewsService = { getCountryNews: jest.fn() };
      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn(),
      };
      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response = await service.analyzeNews('What is happening in some obscure topic?', 'en');

      expect(response.analysisError).toBe('No related articles were found for this question.');
      expect(provider.analyzeNews).not.toHaveBeenCalled();
    });

    it('10. (backend no-evidence response-language correction) zero-evidence analysisError honors requestedLanguage="pl" — the exact real-browser-reported defect', async () => {
      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse([])),
        topHeadlines: jest.fn().mockResolvedValue(makeSearchResponse([])),
      };
      const countryNewsService = { getCountryNews: jest.fn() };
      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn(),
      };
      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response = await service.analyzeNews('Co się dzieje obecnie w Iranie?', 'pl');

      expect(response.analysisError).toBe('Nie znaleziono powiązanych artykułów dla tego pytania.');
      expect(response.analysisError).not.toContain('artykułówdla');
      expect(response.responseLanguage).toBe('pl');
      expect(provider.analyzeNews).not.toHaveBeenCalled();
    });

    it('11. an unimplemented language for the no-evidence message falls back to the English sentence, never an empty/undefined value', async () => {
      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse([])),
        topHeadlines: jest.fn(),
      };
      const countryNewsService = { getCountryNews: jest.fn() };
      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn(),
      };
      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response = await service.analyzeNews('Something obscure', 'sw');

      expect(response.analysisError).toBe('No related articles were found for this question.');
    });
  });

  /**
   * Milestone #51 Phase B — regression coverage for the story-context
   * retrieval-anchoring fix. Real-browser CTO acceptance testing found
   * that a Rwanda migration-story title, asked via "Ask GlobalNews AI
   * about this", fell through to unrelated generic retrieval (an
   * Italian swimming article) because detectLocation()'s free-text
   * parsing didn't recognize the headline as country-related. These
   * tests prove: (a) a resolvable storyContext.countryCode now takes
   * priority over free-text detection and anchors retrieval via the
   * SAME countryNewsService.getCountryNews() path detectLocation()
   * itself already uses — no parallel relevance system; (b) an absent
   * or unresolvable storyContext leaves ordinary generic Q&A
   * completely unaffected; (c) the DTO/service signature remains
   * fully backward compatible with every pre-#51 caller.
   */
  describe('storyContext retrieval anchoring (Milestone #51 Phase B)', () => {
    it('anchors retrieval to storyContext.countryCode via the existing countryNewsService path, even when the query text itself would not trigger free-text country detection', async () => {
      const rwandaArticles = [
        makeArticle({
          id: 'rw1',
          title: 'Rwanda revealed as EU\u2019s first migrant return hub, but what\u2019s in it for Kigali?',
        }),
      ];

      const newsService = {
        // If free-text detection were still driving retrieval, this
        // unrelated generic search result is what would wrongly be
        // used — asserting it is NEVER called proves the story anchor,
        // not detectLocation(), determined retrieval for this request.
        search: jest.fn().mockResolvedValue(
          makeSearchResponse([makeArticle({ id: 'unrelated', title: 'Swimming\u2013Italy\u2019s Curtis betters own 50m backstroke world record' })]),
        ),
      };

      const countryNewsService = {
        getCountryNews: jest.fn().mockResolvedValue(makeCountryResponse('RWA', 'Rwanda', rwandaArticles)),
      };

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(null),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response = await service.analyzeNews(
        'Rwanda revealed as EU\u2019s first migrant return hub, but what\u2019s in it for Kigali?',
        'en',
        { title: 'Rwanda revealed as EU\u2019s first migrant return hub, but what\u2019s in it for Kigali?', countryCode: 'RWA' },
      );

      expect(countryNewsService.getCountryNews).toHaveBeenCalledWith('RWA', undefined, expect.any(Number), undefined);
      expect(newsService.search).not.toHaveBeenCalled();
      expect(response.articles.map((a) => a.id)).toEqual(['rw1']);
      expect(response.articles.some((a) => a.title.includes('Swimming'))).toBe(false);
    });

    it('falls back to ordinary detectLocation() free-text behavior when storyContext is absent \u2014 generic Q&A is completely unaffected', async () => {
      const articles = [makeArticle({ id: 'generic1' })];
      const newsService = { search: jest.fn().mockResolvedValue(makeSearchResponse(articles)) };
      const countryNewsService = makeCountryNewsService();

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(null),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response = await service.analyzeNews('what happened in the markets today');

      expect(countryNewsService.getCountryNews).not.toHaveBeenCalled();
      expect(newsService.search).toHaveBeenCalled();
      expect(response.articles.map((a) => a.id)).toEqual(['generic1']);
    });

    it('falls back to detectLocation() when storyContext.countryCode does not resolve to a real country \u2014 never throws, never silently produces empty retrieval', async () => {
      const articles = [makeArticle({ id: 'fallback1' })];
      const newsService = { search: jest.fn().mockResolvedValue(makeSearchResponse(articles)) };
      const countryNewsService = makeCountryNewsService();

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(null),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response = await service.analyzeNews('some generic question', 'en', {
        title: 'some generic question',
        countryCode: 'NOT_A_REAL_COUNTRY_CODE',
      });

      expect(countryNewsService.getCountryNews).not.toHaveBeenCalled();
      expect(newsService.search).toHaveBeenCalled();
      expect(response.articles.map((a) => a.id)).toEqual(['fallback1']);
    });

    it('folds storyContext.countryCode into the cache/in-flight key so the same query text anchored to two different countries never collides', async () => {
      const newsService = { search: jest.fn().mockResolvedValue(makeSearchResponse([])) };
      const rwandaArticles = [makeArticle({ id: 'rw-x' })];
      const kenyaArticles = [makeArticle({ id: 'ke-x' })];
      const countryNewsService = {
        getCountryNews: jest.fn().mockImplementation((iso3: string) =>
          Promise.resolve(
            iso3 === 'RWA'
              ? makeCountryResponse('RWA', 'Rwanda', rwandaArticles)
              : makeCountryResponse('KEN', 'Kenya', kenyaArticles),
          ),
        ),
      };

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(null),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const [rwandaResult, kenyaResult] = await Promise.all([
        service.analyzeNews('same headline text', 'en', { title: 'same headline text', countryCode: 'RWA' }),
        service.analyzeNews('same headline text', 'en', { title: 'same headline text', countryCode: 'KEN' }),
      ]);

      expect(rwandaResult.articles.map((a) => a.id)).toEqual(['rw-x']);
      expect(kenyaResult.articles.map((a) => a.id)).toEqual(['ke-x']);
    });
  });

  /**
   * CTO final correction — the previous round only anchored retrieval
   * to the story's COUNTRY, which could not distinguish one Rwanda
   * story from another (e.g. migration vs. football vs. economy).
   * These tests prove the selected ARTICLE itself is now a genuine
   * evidence anchor: resolved server-side via
   * NewsService.findArticleById (backed by the existing
   * ArticlePersistenceService/Prisma `article` table — no new
   * persistence layer), guaranteed present in the evidence set, and
   * distinguished in cache/in-flight identity from a different story
   * in the same country.
   */
  describe('storyContext.articleId anchoring (CTO final correction)', () => {
    it('A/B: the selected article is present in the evidence set and survives maxArticles trimming even when other same-country articles would otherwise fill the pool', async () => {
      const anchorArticle = makeArticle({
        id: 'anchor-rwanda-migration',
        title: 'Rwanda revealed as EU\u2019s first migrant return hub, but what\u2019s in it for Kigali?',
      });

      // A full pool of OTHER Rwanda articles (football, economy, etc.)
      // that do NOT include the anchor — simulating exactly the
      // scenario the CTO described: country-level retrieval alone
      // would not guarantee the anchor survives.
      const otherRwandaArticles = Array.from({ length: 10 }, (_, i) =>
        makeArticle({ id: `other-rwanda-${i}`, title: `Rwanda football result ${i}` }),
      );

      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse([])),
        findArticleById: jest.fn().mockResolvedValue(anchorArticle),
      };

      const countryNewsService = {
        getCountryNews: jest.fn().mockResolvedValue(makeCountryResponse('RWA', 'Rwanda', otherRwandaArticles)),
      };

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(null),
      };

      // maxArticles smaller than the other-articles pool, so the
      // anchor would be trimmed away entirely if it weren't
      // explicitly prioritized to the front of the array.
      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService({ maxArticles: 3 }),
      );

      const response = await service.analyzeNews(
        'Rwanda revealed as EU\u2019s first migrant return hub, but what\u2019s in it for Kigali?',
        'en',
        {
          title: 'Rwanda revealed as EU\u2019s first migrant return hub, but what\u2019s in it for Kigali?',
          countryCode: 'RWA',
          articleId: 'anchor-rwanda-migration',
        },
      );

      expect(newsService.findArticleById).toHaveBeenCalledWith('anchor-rwanda-migration');
      expect(response.articles.some((a) => a.id === 'anchor-rwanda-migration')).toBe(true);
      // The anchor must be FIRST — the only guarantee that survives an
      // arbitrarily small maxArticles cap.
      expect(response.articles[0]?.id).toBe('anchor-rwanda-migration');
    });

    it('C/D: two different stories in the same country with the same query text never share one cache/in-flight identity', async () => {
      const storyAArticle = makeArticle({ id: 'story-a', title: 'Rwanda migrant hub story' });
      const storyBArticle = makeArticle({ id: 'story-b', title: 'Rwanda football story' });

      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse([])),
        findArticleById: jest.fn().mockImplementation((id: string) =>
          Promise.resolve(id === 'story-a' ? storyAArticle : storyBArticle),
        ),
      };

      const countryNewsService = {
        getCountryNews: jest.fn().mockResolvedValue(makeCountryResponse('RWA', 'Rwanda', [])),
      };

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(null),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      // Same country, same literal query text, different articleId —
      // must not collide, either as a completed-cache entry or as an
      // in-flight-collapsed operation (tested concurrently, mirroring
      // the existing RWA/KEN in-flight test above).
      const [resultA, resultB] = await Promise.all([
        service.analyzeNews('same rwanda question', 'en', {
          title: 'same rwanda question',
          countryCode: 'RWA',
          articleId: 'story-a',
        }),
        service.analyzeNews('same rwanda question', 'en', {
          title: 'same rwanda question',
          countryCode: 'RWA',
          articleId: 'story-b',
        }),
      ]);

      expect(resultA.articles.map((a) => a.id)).toContain('story-a');
      expect(resultA.articles.map((a) => a.id)).not.toContain('story-b');
      expect(resultB.articles.map((a) => a.id)).toContain('story-b');
      expect(resultB.articles.map((a) => a.id)).not.toContain('story-a');
    });

    it('E: an unresolvable articleId falls back safely \u2014 country-anchored retrieval still runs, nothing is fabricated', async () => {
      const rwandaArticles = [makeArticle({ id: 'rw-generic' })];

      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse([])),
        // Simulates a genuinely unresolvable id (deleted/never
        // persisted/database unavailable) — findById's own documented
        // contract returns null, never throws.
        findArticleById: jest.fn().mockResolvedValue(null),
      };

      const countryNewsService = {
        getCountryNews: jest.fn().mockResolvedValue(makeCountryResponse('RWA', 'Rwanda', rwandaArticles)),
      };

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(null),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response = await service.analyzeNews('some rwanda question', 'en', {
        title: 'some rwanda question',
        countryCode: 'RWA',
        articleId: 'does-not-exist-in-database',
      });

      expect(newsService.findArticleById).toHaveBeenCalledWith('does-not-exist-in-database');
      // Falls back to the country-anchored retrieval already computed
      // — never an empty/fabricated result merely because the
      // specific articleId didn't resolve.
      expect(response.articles.map((a) => a.id)).toEqual(['rw-generic']);
    });

    it('F: generic Q&A with no storyContext never calls findArticleById at all', async () => {
      const articles = [makeArticle({ id: 'generic-only' })];
      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
        findArticleById: jest.fn(),
      };
      const countryNewsService = makeCountryNewsService();

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(null),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      await service.analyzeNews('an ordinary generic question');

      expect(newsService.findArticleById).not.toHaveBeenCalled();
    });

    it('sparse evidence: the anchor article alone (zero corroborating country articles) is never padded with unrelated articles', async () => {
      const anchorArticle = makeArticle({
        id: 'anchor-alone',
        title: 'Rwanda revealed as EU\u2019s first migrant return hub, but what\u2019s in it for Kigali?',
      });

      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse([])),
        findArticleById: jest.fn().mockResolvedValue(anchorArticle),
      };

      // Country retrieval genuinely returns nothing else for this
      // story — the exact "sparse evidence" scenario the CTO
      // describes: the selected story may remain alone.
      const countryNewsService = {
        getCountryNews: jest.fn().mockResolvedValue(makeCountryResponse('RWA', 'Rwanda', [])),
      };

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest.fn().mockResolvedValue(null),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response = await service.analyzeNews(
        'Rwanda revealed as EU\u2019s first migrant return hub, but what\u2019s in it for Kigali?',
        'en',
        {
          title: 'Rwanda revealed as EU\u2019s first migrant return hub, but what\u2019s in it for Kigali?',
          countryCode: 'RWA',
          articleId: 'anchor-alone',
        },
      );

      // The anchor alone is a valid, non-empty evidence set — it must
      // NOT be treated as "no evidence found" (which would discard it
      // and report analysisError), and it must contain ONLY the real
      // anchor article, never a synthetic/unrelated addition.
      expect(response.articles).toHaveLength(1);
      expect(response.articles[0]?.id).toBe('anchor-alone');
      expect(response.analysisError).not.toMatch(/no related articles/i);
    });
  });
});
