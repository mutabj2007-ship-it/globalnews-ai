import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  NewsArticle,
  NewsResponse,
} from '@globalnews-ai/shared';
import { CountryNewsService } from './country-news.service';

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
  dataMode: 'live' | 'cached' | 'mock' = 'mock',
): NewsResponse {
  return {
    articles,
    totalResults: articles.length,
    providers:
      dataMode === 'live'
        ? ['gnews']
        : dataMode === 'mock'
          ? ['mock-wire']
          : [],
    dataMode,
    generatedAt: new Date().toISOString(),
  };
}

function makeConfig(
  overrides: Record<string, string | undefined> = {},
): ConfigService {
  return {
    get: (key: string) => overrides[key],
  } as ConfigService;
}

describe('CountryNewsService', () => {
  const articlePersistence = {
    persistCountryRelations: jest.fn(),
    findRecentByCountry: jest.fn(),
  };

  beforeEach(() => {
    articlePersistence.persistCountryRelations.mockReset();
    articlePersistence.findRecentByCountry.mockReset();

    articlePersistence.persistCountryRelations.mockResolvedValue(
      undefined,
    );

    articlePersistence.findRecentByCountry.mockResolvedValue(
      [],
    );
  });

  function buildService(
    newsService: { search: jest.Mock },
    config: ConfigService = makeConfig(),
  ): CountryNewsService {
    return new CountryNewsService(
      newsService as never,
      config,
      articlePersistence as never,
    );
  }

  it('resolves a known ISO3 country code and searches by its name', async () => {
    const newsService = {
      search: jest.fn().mockResolvedValue(
        makeSearchResponse([
          makeArticle({ id: 'a1' }),
        ]),
      ),
    };

    const service = buildService(newsService);

    const response = await service.getCountryNews('ESP');

    expect(response.countryCode).toBe('ESP');
    expect(response.countryName).toBe('Spain');

    expect(newsService.search).toHaveBeenCalledWith(
      'Spain',
      expect.any(Number),
    );
  });

  it('is case-insensitive for the country code', async () => {
    const newsService = {
      search: jest
        .fn()
        .mockResolvedValue(makeSearchResponse([])),
    };

    const service = buildService(newsService);

    const response = await service.getCountryNews('esp');

    expect(response.countryName).toBe('Spain');
  });

  it('throws BadRequestException for an unknown country code', async () => {
    const newsService = {
      search: jest.fn(),
    };

    const service = buildService(newsService);

    await expect(
      service.getCountryNews('ZZZ'),
    ).rejects.toThrow(BadRequestException);

    expect(newsService.search).not.toHaveBeenCalled();

    expect(
      articlePersistence.persistCountryRelations,
    ).not.toHaveBeenCalled();

    expect(
      articlePersistence.findRecentByCountry,
    ).not.toHaveBeenCalled();
  });

  it('returns an empty article list without error when there are no results', async () => {
    const newsService = {
      search: jest
        .fn()
        .mockResolvedValue(makeSearchResponse([])),
    };

    const service = buildService(newsService);

    const response = await service.getCountryNews('ESP');

    expect(response.articles).toEqual([]);
    expect(response.totalResults).toBe(0);

    expect(
      articlePersistence.findRecentByCountry,
    ).toHaveBeenCalledTimes(1);
  });

  it('propagates live dataMode unchanged', async () => {
    const newsService = {
      search: jest.fn().mockResolvedValue(
        makeSearchResponse(
          [makeArticle({ id: 'a1' })],
          'live',
        ),
      ),
    };

    const service = buildService(newsService);

    const response = await service.getCountryNews('ESP');

    expect(response.dataMode).toBe('live');
  });

  it('propagates cached dataMode unchanged', async () => {
    const newsService = {
      search: jest.fn().mockResolvedValue(
        makeSearchResponse(
          [makeArticle({ id: 'a1' })],
          'cached',
        ),
      ),
    };

    const service = buildService(newsService);

    const response = await service.getCountryNews('ESP');

    expect(response.dataMode).toBe('cached');
  });

  it('filters results by category without re-querying the provider twice', async () => {
    const articles = [
      makeArticle({
        id: 'a1',
        category: 'business',
      }),
      makeArticle({
        id: 'a2',
        category: 'technology',
      }),
    ];

    const newsService = {
      search: jest.fn().mockResolvedValue(
        makeSearchResponse(articles),
      ),
    };

    const service = buildService(newsService);

    const response = await service.getCountryNews(
      'ESP',
      'business',
    );

    expect(newsService.search).toHaveBeenCalledTimes(1);
    expect(response.articles).toHaveLength(1);
    expect(response.articles[0].category).toBe(
      'business',
    );
  });

  it('caches a response and does not call the news service again for the same request', async () => {
    const newsService = {
      search: jest.fn().mockResolvedValue(
        makeSearchResponse([
          makeArticle({ id: 'a1' }),
        ]),
      ),
    };

    const service = buildService(
      newsService,
      makeConfig({
        COUNTRY_NEWS_CACHE_TTL_SECONDS: '300',
      }),
    );

    await service.getCountryNews('ESP');
    await service.getCountryNews('ESP');

    expect(newsService.search).toHaveBeenCalledTimes(1);
  });

  it('does not cache identical requests differing only by category together', async () => {
    const newsService = {
      search: jest.fn().mockResolvedValue(
        makeSearchResponse([
          makeArticle({
            id: 'a1',
            category: 'business',
          }),
          makeArticle({
            id: 'a2',
            category: 'technology',
          }),
        ]),
      ),
    };

    const service = buildService(newsService);

    const business = await service.getCountryNews(
      'ESP',
      'business',
    );

    const technology = await service.getCountryNews(
      'ESP',
      'technology',
    );

    expect(business.articles[0].category).toBe(
      'business',
    );

    expect(technology.articles[0].category).toBe(
      'technology',
    );
  });

  it('does not cache when COUNTRY_NEWS_CACHE_TTL_SECONDS is 0', async () => {
    const newsService = {
      search: jest.fn().mockResolvedValue(
        makeSearchResponse([
          makeArticle({ id: 'a1' }),
        ]),
      ),
    };

    const service = buildService(
      newsService,
      makeConfig({
        COUNTRY_NEWS_CACHE_TTL_SECONDS: '0',
      }),
    );

    await service.getCountryNews('ESP');
    await service.getCountryNews('ESP');

    expect(newsService.search).toHaveBeenCalledTimes(2);
  });

  it('propagates provider failure errors rather than swallowing them silently', async () => {
    const newsService = {
      search: jest.fn().mockRejectedValue(
        new Error('GNews rate limit exceeded.'),
      ),
    };

    const service = buildService(newsService);

    await expect(
      service.getCountryNews('ESP'),
    ).rejects.toThrow(
      'GNews rate limit exceeded.',
    );

    expect(
      articlePersistence.persistCountryRelations,
    ).not.toHaveBeenCalled();

    expect(
      articlePersistence.findRecentByCountry,
    ).not.toHaveBeenCalled();
  });

  it('persists article-country relations for live results', async () => {
    const article = makeArticle({
      id: 'spain-live-1',
      title: 'Spain government announces new policy',
      summary:
        'Spain parliament and government officials announced a national policy.',
    });

    const newsService = {
      search: jest.fn().mockResolvedValue(
        makeSearchResponse(
          [article],
          'live',
        ),
      ),
    };

    const service = buildService(newsService);

    await service.getCountryNews('ESP');

    expect(
      articlePersistence.persistCountryRelations,
    ).toHaveBeenCalledTimes(1);

    expect(
      articlePersistence.persistCountryRelations,
    ).toHaveBeenCalledWith([
      expect.objectContaining({
        articleId: 'spain-live-1',
        countryCode: 'ESP',
        countryName: 'Spain',
        relevanceScore: expect.any(Number),
        isRelevant: expect.any(Boolean),
      }),
    ]);
  });

  it('persists the calculated relevance score for live results', async () => {
    const article = makeArticle({
      id: 'spain-score-1',
      title: 'Spain government election update',
      summary:
        'Spain parliament and government officials discussed the election.',
    });

    const newsService = {
      search: jest.fn().mockResolvedValue(
        makeSearchResponse(
          [article],
          'live',
        ),
      ),
    };

    const service = buildService(newsService);

    await service.getCountryNews('ESP');

    const relations =
      articlePersistence.persistCountryRelations.mock
        .calls[0][0];

    expect(relations).toHaveLength(1);

    expect(relations[0]).toEqual(
      expect.objectContaining({
        articleId: 'spain-score-1',
        countryCode: 'ESP',
        countryName: 'Spain',
      }),
    );

    expect(
      relations[0].relevanceScore,
    ).toBeGreaterThan(0);

    expect(relations[0].isRelevant).toBe(true);
  });

  it('does not persist article-country relations for mock results', async () => {
    const newsService = {
      search: jest.fn().mockResolvedValue(
        makeSearchResponse(
          [
            makeArticle({
              id: 'mock-1',
              title: 'Spain test headline',
            }),
          ],
          'mock',
        ),
      ),
    };

    const service = buildService(newsService);

    const response = await service.getCountryNews(
      'ESP',
    );

    expect(response.dataMode).toBe('mock');

    expect(
      articlePersistence.persistCountryRelations,
    ).not.toHaveBeenCalled();
  });

  it('does not persist article-country relations for cached results', async () => {
    const newsService = {
      search: jest.fn().mockResolvedValue(
        makeSearchResponse(
          [
            makeArticle({
              id: 'cached-1',
              title: 'Spain cached headline',
            }),
          ],
          'cached',
        ),
      ),
    };

    const service = buildService(newsService);

    const response = await service.getCountryNews(
      'ESP',
    );

    expect(response.dataMode).toBe('cached');

    expect(
      articlePersistence.persistCountryRelations,
    ).not.toHaveBeenCalled();
  });

  it('returns stored country articles when the provider returns no articles', async () => {
    const storedArticle = makeArticle({
      id: 'stored-spain-1',
      title: 'Stored Spain headline',
      summary:
        'Previously fetched reporting about Spain.',
      sourceId: 'stored-provider',
      sourceName: 'Stored Provider',
      category: 'world',
      confidence: 88,
    });

    const newsService = {
      search: jest.fn().mockResolvedValue(
        makeSearchResponse([], 'live'),
      ),
    };

    articlePersistence.findRecentByCountry
      .mockResolvedValueOnce([
        storedArticle,
      ]);

    const service = buildService(newsService);

    const response = await service.getCountryNews(
      'ESP',
      undefined,
      5,
    );

    expect(
      articlePersistence.findRecentByCountry,
    ).toHaveBeenCalledTimes(1);

    expect(
      articlePersistence.findRecentByCountry,
    ).toHaveBeenCalledWith({
      countryCode: 'ESP',
      category: undefined,
      limit: 5,
      maxAgeMinutes: 1440,
      relevantOnly: true,
    });

    expect(response.articles).toEqual([
      storedArticle,
    ]);

    expect(response.totalResults).toBe(1);
    expect(response.dataMode).toBe('cached');
    expect(response.providers).toEqual([]);
    expect(response.feedTier).toBe('delayed');
    expect(response.providerDisplayName).toBe(
      'Stored reporting',
    );
  });

  it('uses the requested category when reading stored country articles', async () => {
    const storedArticle = makeArticle({
      id: 'stored-tech-1',
      title: 'Stored Spain technology headline',
      category: 'technology',
    });

    const newsService = {
      search: jest.fn().mockResolvedValue(
        makeSearchResponse([], 'live'),
      ),
    };

    articlePersistence.findRecentByCountry
      .mockResolvedValueOnce([
        storedArticle,
      ]);

    const service = buildService(newsService);

    const response = await service.getCountryNews(
      'ESP',
      'technology',
      5,
    );

    expect(
      articlePersistence.findRecentByCountry,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        countryCode: 'ESP',
        category: 'technology',
        limit: 5,
      }),
    );

    expect(response.dataMode).toBe('cached');
    expect(response.category).toBe('technology');
    expect(response.articles).toEqual([
      storedArticle,
    ]);
  });
});