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
): NewsResponse {
  return {
    articles,
    totalResults: articles.length,
    providers: ['mock-wire'],
    dataMode: 'mock',
    generatedAt: new Date().toISOString(),
  };
}

function makeCountryResponse(
  countryCode: string,
  countryName: string,
  articles: NewsArticle[],
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
});