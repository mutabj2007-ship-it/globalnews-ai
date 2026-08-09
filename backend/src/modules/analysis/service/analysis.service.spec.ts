import type {
  CountryNewsResponse,
  NewsArticle,
  NewsResponse,
} from '@globalnews-ai/shared';
import { AnalysisService } from './analysis.service';
import type { AnalysisProvider } from '../interfaces';
import { AnalysisConfigService } from '../config/analysis-config.service';

function makeArticle(
  overrides: Partial<NewsArticle> = {},
): NewsArticle {
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
  overrides: Partial<
    ReturnType<AnalysisConfigService['get']>
  > = {},
): AnalysisConfigService {
  const config = {
    maxArticles: 8,
    maxArticleChars: 1200,
    timeoutMs: 20000,
    cacheTtlSeconds: 300,
    openAiApiKey: undefined,
    openAiModel: 'gpt-4o-mini',
    ...overrides,
  };

  return {
    get: () => config,
  } as unknown as AnalysisConfigService;
}

function validCandidateFor(
  articles: NewsArticle[],
) {
  return {
    headline: 'Headline',
    summary: 'Summary',
    keyFacts: [
      {
        claim: articles[0].title,
        sourceArticleIds: [
          articles[0].id,
        ],
      },
    ],
    agreements: [],
    differences: [],
    unknowns: [],
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
      getCountryNews:
        jest.fn().mockResolvedValue(
          makeCountryResponse(
            'ESP',
            'Spain',
            [],
          ),
        ),
    };
  }

  it('returns a clear analysisError and empty articles when no news results are found', async () => {
    const newsService = {
      search: jest
        .fn()
        .mockResolvedValue(
          makeSearchResponse([]),
        ),
    };

    const countryNewsService =
      makeCountryNewsService();

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

    const response =
      await service.analyzeNews(
        'nonexistent query',
      );

    expect(response.articles).toEqual([]);
    expect(response.analysis).toBeNull();

    expect(
      response.analysisError,
    ).toMatch(/no related articles/i);

    expect(
      provider.analyzeNews,
    ).not.toHaveBeenCalled();

    // retrievalContext must still be present when retrieval
    // succeeded but returned zero articles.
    expect(
      response.retrievalContext,
    ).toEqual(
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
      search: jest
        .fn()
        .mockResolvedValue(
          makeSearchResponse(articles),
        ),
    };

    const countryNewsService =
      makeCountryNewsService();

    const provider: AnalysisProvider = {
      id: 'openai',
      displayName: 'OpenAI',
      isMock: false,
      analyzeNews: jest
        .fn()
        .mockRejectedValue(
          new Error(
            'OpenAI rate limit exceeded.',
          ),
        ),
    };

    const service = new AnalysisService(
      newsService as never,
      countryNewsService as never,
      provider,
      makeConfigService(),
    );

    const response =
      await service.analyzeNews(
        'test query',
      );

    expect(response.analysis).toBeNull();
    expect(response.articles).toHaveLength(
      1,
    );

    expect(
      response.analysisError,
    ).toMatch(/temporarily unavailable/i);

    // retrievalContext must still be present when the AI provider
    // fails after articles were successfully retrieved.
    expect(
      response.retrievalContext,
    ).toEqual(
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
      search: jest
        .fn()
        .mockResolvedValue(
          makeSearchResponse(articles),
        ),
    };

    const countryNewsService =
      makeCountryNewsService();

    const provider: AnalysisProvider = {
      id: 'mock-analysis',
      displayName: 'Mock',
      isMock: true,
      analyzeNews: jest
        .fn()
        .mockResolvedValue(
          validCandidateFor(articles),
        ),
    };

    const service = new AnalysisService(
      newsService as never,
      countryNewsService as never,
      provider,
      makeConfigService(),
    );

    const response =
      await service.analyzeNews(
        'test query',
      );

    expect(
      response.analysis,
    ).not.toBeNull();

    expect(
      response.analysis?.analysisMode,
    ).toBe('mock-ai');

    expect(
      response.analysisError,
    ).toBeUndefined();
  });

  it('caches a successful response and does not call the news service again for the same query', async () => {
    const articles = [
      makeArticle({
        id: 'a1',
      }),
    ];

    const newsService = {
      search: jest
        .fn()
        .mockResolvedValue(
          makeSearchResponse(articles),
        ),
    };

    const countryNewsService =
      makeCountryNewsService();

    const provider: AnalysisProvider = {
      id: 'mock-analysis',
      displayName: 'Mock',
      isMock: true,
      analyzeNews: jest
        .fn()
        .mockResolvedValue(
          validCandidateFor(articles),
        ),
    };

    const service = new AnalysisService(
      newsService as never,
      countryNewsService as never,
      provider,
      makeConfigService(),
    );

    await service.analyzeNews(
      'Same Query',
    );

    await service.analyzeNews(
      'same query',
    );

    expect(
      newsService.search,
    ).toHaveBeenCalledTimes(1);
  });

  it('does not cache when cacheTtlSeconds is 0', async () => {
    const articles = [
      makeArticle({
        id: 'a1',
      }),
    ];

    const newsService = {
      search: jest
        .fn()
        .mockResolvedValue(
          makeSearchResponse(articles),
        ),
    };

    const countryNewsService =
      makeCountryNewsService();

    const provider: AnalysisProvider = {
      id: 'mock-analysis',
      displayName: 'Mock',
      isMock: true,
      analyzeNews: jest
        .fn()
        .mockResolvedValue(
          validCandidateFor(articles),
        ),
    };

    const service = new AnalysisService(
      newsService as never,
      countryNewsService as never,
      provider,
      makeConfigService({
        cacheTtlSeconds: 0,
      }),
    );

    await service.analyzeNews(
      'test query',
    );

    await service.analyzeNews(
      'test query',
    );

    expect(
      newsService.search,
    ).toHaveBeenCalledTimes(2);
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
      getCountryNews:
        jest.fn().mockResolvedValue(
          makeCountryResponse(
            'ESP',
            'Spain',
            articles,
          ),
        ),
    };

    const provider: AnalysisProvider = {
      id: 'mock-analysis',
      displayName: 'Mock',
      isMock: true,
      analyzeNews: jest
        .fn()
        .mockResolvedValue(
          validCandidateFor(articles),
        ),
    };

    const service = new AnalysisService(
      newsService as never,
      countryNewsService as never,
      provider,
      makeConfigService(),
    );

    const response =
      await service.analyzeNews(
        'What is happening in Spain today?',
      );

    expect(
      countryNewsService.getCountryNews,
    ).toHaveBeenCalledWith(
      'ESP',
      undefined,
      20,
    );

    expect(
      countryNewsService.getCountryNews,
    ).toHaveBeenCalledTimes(1);

    expect(
      newsService.search,
    ).not.toHaveBeenCalled();

    expect(
      response.articles,
    ).toEqual(articles);
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
      getCountryNews:
        jest.fn().mockResolvedValue(
          makeCountryResponse(
            'RWA',
            'Rwanda',
            articles,
          ),
        ),
    };

    const provider: AnalysisProvider = {
      id: 'mock-analysis',
      displayName: 'Mock',
      isMock: true,
      analyzeNews: jest
        .fn()
        .mockResolvedValue(
          validCandidateFor(articles),
        ),
    };

    const service = new AnalysisService(
      newsService as never,
      countryNewsService as never,
      provider,
      makeConfigService(),
    );

    await service.analyzeNews(
      'Latest news from Rwanda',
    );

    expect(
      countryNewsService.getCountryNews,
    ).toHaveBeenCalledWith(
      'RWA',
      undefined,
      20,
    );

    expect(
      newsService.search,
    ).not.toHaveBeenCalled();
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
      getCountryNews:
        jest.fn().mockResolvedValue(
          makeCountryResponse(
            'GBR',
            'United Kingdom',
            articles,
          ),
        ),
    };

    const provider: AnalysisProvider = {
      id: 'mock-analysis',
      displayName: 'Mock',
      isMock: true,
      analyzeNews: jest
        .fn()
        .mockResolvedValue(
          validCandidateFor(articles),
        ),
    };

    const service = new AnalysisService(
      newsService as never,
      countryNewsService as never,
      provider,
      makeConfigService(),
    );

    await service.analyzeNews(
      'What is happening in Britain today?',
    );

    expect(
      countryNewsService.getCountryNews,
    ).toHaveBeenCalledWith(
      'GBR',
      undefined,
      20,
    );

    expect(
      newsService.search,
    ).not.toHaveBeenCalled();
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
      getCountryNews:
        jest.fn().mockResolvedValue(
          makeCountryResponse(
            'USA',
            'United States',
            articles,
          ),
        ),
    };

    const provider: AnalysisProvider = {
      id: 'mock-analysis',
      displayName: 'Mock',
      isMock: true,
      analyzeNews: jest
        .fn()
        .mockResolvedValue(
          validCandidateFor(articles),
        ),
    };

    const service = new AnalysisService(
      newsService as never,
      countryNewsService as never,
      provider,
      makeConfigService(),
    );

    await service.analyzeNews(
      'is USA under pressure of war?',
    );

    expect(
      countryNewsService.getCountryNews,
    ).toHaveBeenCalledWith(
      'USA',
      undefined,
      20,
    );

    expect(
      newsService.search,
    ).not.toHaveBeenCalled();
  });

  it('does not resolve a lowercase embedded code with no preposition', async () => {
    const articles = [
      makeArticle({ id: 'general-2' }),
    ];

    const newsService = {
      search: jest
        .fn()
        .mockResolvedValue(
          makeSearchResponse(articles),
        ),
    };

    const countryNewsService = {
      getCountryNews: jest.fn(),
    };

    const provider: AnalysisProvider = {
      id: 'mock-analysis',
      displayName: 'Mock',
      isMock: true,
      analyzeNews: jest
        .fn()
        .mockResolvedValue(
          validCandidateFor(articles),
        ),
    };

    const service = new AnalysisService(
      newsService as never,
      countryNewsService as never,
      provider,
      makeConfigService(),
    );

    await service.analyzeNews(
      'the us released a report today',
    );

    expect(
      countryNewsService.getCountryNews,
    ).not.toHaveBeenCalled();

    expect(
      newsService.search,
    ).toHaveBeenCalledWith(
      'the us released a report today',
      20,
    );
  });

  it('does not resolve an ambiguous bare country name with no preposition (e.g. "Chad")', async () => {
    const articles = [
      makeArticle({ id: 'general-3' }),
    ];

    const newsService = {
      search: jest
        .fn()
        .mockResolvedValue(
          makeSearchResponse(articles),
        ),
    };

    const countryNewsService = {
      getCountryNews: jest.fn(),
    };

    const provider: AnalysisProvider = {
      id: 'mock-analysis',
      displayName: 'Mock',
      isMock: true,
      analyzeNews: jest
        .fn()
        .mockResolvedValue(
          validCandidateFor(articles),
        ),
    };

    const service = new AnalysisService(
      newsService as never,
      countryNewsService as never,
      provider,
      makeConfigService(),
    );

    await service.analyzeNews(
      'Chad missed the bus this morning',
    );

    expect(
      countryNewsService.getCountryNews,
    ).not.toHaveBeenCalled();

    expect(
      newsService.search,
    ).toHaveBeenCalledWith(
      'Chad missed the bus this morning',
      20,
    );
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
      getCountryNews:
        jest.fn().mockResolvedValue(
          makeCountryResponse(
            'RWA',
            'Rwanda',
            articles,
          ),
        ),
    };

    const provider: AnalysisProvider = {
      id: 'mock-analysis',
      displayName: 'Mock',
      isMock: true,
      analyzeNews: jest
        .fn()
        .mockResolvedValue(
          validCandidateFor(articles),
        ),
    };

    const service = new AnalysisService(
      newsService as never,
      countryNewsService as never,
      provider,
      makeConfigService(),
    );

    await service.analyzeNews(
      "What's happening in Kigali?",
    );

    expect(
      countryNewsService.getCountryNews,
    ).toHaveBeenCalledWith(
      'RWA',
      undefined,
      20,
    );

    expect(
      newsService.search,
    ).not.toHaveBeenCalled();
  });

  it('does not resolve an uncurated city even with a preposition', async () => {
    const articles = [
      makeArticle({ id: 'general-4' }),
    ];

    const newsService = {
      search: jest
        .fn()
        .mockResolvedValue(
          makeSearchResponse(articles),
        ),
    };

    const countryNewsService = {
      getCountryNews: jest.fn(),
    };

    const provider: AnalysisProvider = {
      id: 'mock-analysis',
      displayName: 'Mock',
      isMock: true,
      analyzeNews: jest
        .fn()
        .mockResolvedValue(
          validCandidateFor(articles),
        ),
    };

    const service = new AnalysisService(
      newsService as never,
      countryNewsService as never,
      provider,
      makeConfigService(),
    );

    await service.analyzeNews(
      "What's happening in Anytown?",
    );

    expect(
      countryNewsService.getCountryNews,
    ).not.toHaveBeenCalled();

    expect(
      newsService.search,
    ).toHaveBeenCalledWith(
      "What's happening in Anytown?",
      20,
    );
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
      search: jest
        .fn()
        .mockResolvedValue(
          makeSearchResponse(articles),
        ),
    };

    const countryNewsService = {
      getCountryNews: jest.fn(),
    };

    const provider: AnalysisProvider = {
      id: 'mock-analysis',
      displayName: 'Mock',
      isMock: true,
      analyzeNews: jest
        .fn()
        .mockResolvedValue(
          validCandidateFor(articles),
        ),
    };

    const service = new AnalysisService(
      newsService as never,
      countryNewsService as never,
      provider,
      makeConfigService(),
    );

    await service.analyzeNews(
      'Tell me about markets today',
    );

    expect(
      newsService.search,
    ).toHaveBeenCalledWith(
      'Tell me about markets today',
      20,
    );

    expect(
      newsService.search,
    ).toHaveBeenCalledTimes(1);

    expect(
      countryNewsService.getCountryNews,
    ).not.toHaveBeenCalled();
  });

  it('does not mistake ordinary text for a country query', async () => {
    const articles = [
      makeArticle({
        id: 'general-1',
      }),
    ];

    const newsService = {
      search: jest
        .fn()
        .mockResolvedValue(
          makeSearchResponse(articles),
        ),
    };

    const countryNewsService = {
      getCountryNews: jest.fn(),
    };

    const provider: AnalysisProvider = {
      id: 'mock-analysis',
      displayName: 'Mock',
      isMock: true,
      analyzeNews: jest
        .fn()
        .mockResolvedValue(
          validCandidateFor(articles),
        ),
    };

    const service = new AnalysisService(
      newsService as never,
      countryNewsService as never,
      provider,
      makeConfigService(),
    );

    await service.analyzeNews(
      'Tell me about technology and markets today',
    );

    expect(
      newsService.search,
    ).toHaveBeenCalledWith(
      'Tell me about technology and markets today',
      20,
    );

    expect(
      countryNewsService.getCountryNews,
    ).not.toHaveBeenCalled();
  });

  describe('retrievalContext', () => {
    it('preserves dataMode=live and provider info for generic live retrieval', async () => {
      const articles = [
        makeArticle({ id: 'live-1' }),
      ];

      const newsService = {
        search: jest
          .fn()
          .mockResolvedValue(
            makeSearchResponse(articles, {
              dataMode: 'live',
              providers: ['newsapi'],
            }),
          ),
      };

      const countryNewsService =
        makeCountryNewsService();

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest
          .fn()
          .mockResolvedValue(
            validCandidateFor(articles),
          ),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response =
        await service.analyzeNews(
          'live query',
        );

      expect(
        response.retrievalContext,
      ).toEqual({
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
      const articles = [
        makeArticle({ id: 'mock-1' }),
      ];

      const newsService = {
        search: jest
          .fn()
          .mockResolvedValue(
            makeSearchResponse(articles, {
              dataMode: 'mock',
              providers: ['mock-wire'],
            }),
          ),
      };

      const countryNewsService =
        makeCountryNewsService();

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest
          .fn()
          .mockResolvedValue(
            validCandidateFor(articles),
          ),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response =
        await service.analyzeNews(
          'mock query',
        );

      expect(
        response.retrievalContext.dataMode,
      ).toBe('mock');
    });

    it('preserves dataMode=cached and fallbackReason for generic cached retrieval', async () => {
      const articles = [
        makeArticle({ id: 'cached-1' }),
      ];

      const newsService = {
        search: jest
          .fn()
          .mockResolvedValue(
            makeSearchResponse(articles, {
              dataMode: 'cached',
              providers: [],
              fallbackReason:
                'provider-error',
            }),
          ),
      };

      const countryNewsService =
        makeCountryNewsService();

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest
          .fn()
          .mockResolvedValue(
            validCandidateFor(articles),
          ),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response =
        await service.analyzeNews(
          'cached query',
        );

      expect(
        response.retrievalContext,
      ).toEqual(
        expect.objectContaining({
          dataMode: 'cached',
          providers: [],
          fallbackReason: 'provider-error',
        }),
      );
    });

    it('preserves dataMode=unavailable and fallbackReason for generic retrieval when no provider succeeded and no cache existed', async () => {
      const newsService = {
        search: jest
          .fn()
          .mockResolvedValue(
            makeSearchResponse([], {
              dataMode: 'unavailable',
              providers: [],
              fallbackReason:
                'provider-error',
            }),
          ),
      };

      const countryNewsService =
        makeCountryNewsService();

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

      const response =
        await service.analyzeNews(
          'unavailable query',
        );

      expect(
        response.retrievalContext,
      ).toEqual(
        expect.objectContaining({
          dataMode: 'unavailable',
          providers: [],
          fallbackReason: 'provider-error',
          articlesRetrieved: 0,
        }),
      );

      expect(
        provider.analyzeNews,
      ).not.toHaveBeenCalled();
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
        getCountryNews: jest
          .fn()
          .mockResolvedValue(
            makeCountryResponse(
              'ESP',
              'Spain',
              articles,
              {
                dataMode: 'live',
                providers: ['gnews'],
                feedTier: 'live',
                providerDisplayName:
                  'GNews Free',
              },
            ),
          ),
      };

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest
          .fn()
          .mockResolvedValue(
            validCandidateFor(articles),
          ),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response =
        await service.analyzeNews(
          'What is happening in Spain today?',
        );

      expect(
        response.retrievalContext,
      ).toEqual({
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
      const newestTimestamp =
        '2026-08-08T20:58:00.000Z';

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
        getCountryNews: jest
          .fn()
          .mockResolvedValue(
            makeCountryResponse(
              'RWA',
              'Rwanda',
              articles,
              {
                dataMode: 'cached',
                providers: [],
                fallbackReason:
                  'no-live-results',
                providerDisplayName:
                  'Stored reporting',
                newestArticlePublishedAt:
                  newestTimestamp,
              },
            ),
          ),
      };

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest
          .fn()
          .mockResolvedValue(
            validCandidateFor(articles),
          ),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const response =
        await service.analyzeNews(
          'Latest news from Rwanda',
        );

      expect(
        response.retrievalContext,
      ).toEqual({
        dataMode: 'cached',
        providers: [],
        fallbackReason: 'no-live-results',
        newestArticlePublishedAt:
          newestTimestamp,
        countryCode: 'RWA',
        countryName: 'Rwanda',
        providerDisplayName:
          'Stored reporting',
        articlesRetrieved: 1,
      });
    });

    it('preserves the same retrievalContext on a cached AnalysisService response', async () => {
      const articles = [
        makeArticle({ id: 'cache-hit-1' }),
      ];

      const newsService = {
        search: jest
          .fn()
          .mockResolvedValue(
            makeSearchResponse(articles, {
              dataMode: 'live',
              providers: ['newsapi'],
            }),
          ),
      };

      const countryNewsService =
        makeCountryNewsService();

      const provider: AnalysisProvider = {
        id: 'mock-analysis',
        displayName: 'Mock',
        isMock: true,
        analyzeNews: jest
          .fn()
          .mockResolvedValue(
            validCandidateFor(articles),
          ),
      };

      const service = new AnalysisService(
        newsService as never,
        countryNewsService as never,
        provider,
        makeConfigService(),
      );

      const first =
        await service.analyzeNews(
          'Cache Hit Query',
        );

      const second =
        await service.analyzeNews(
          'cache hit query',
        );

      expect(
        newsService.search,
      ).toHaveBeenCalledTimes(1);

      expect(
        second.retrievalContext,
      ).toEqual(
        first.retrievalContext,
      );

      expect(
        second.retrievalContext,
      ).toEqual(
        expect.objectContaining({
          dataMode: 'live',
          providers: ['newsapi'],
        }),
      );
    });
  });
});