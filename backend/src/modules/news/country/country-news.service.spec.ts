import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NewsArticle, NewsResponse } from '@globalnews-ai/shared';
import { CountryNewsService } from './country-news.service';

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
  dataMode: 'live' | 'unavailable' | 'cached' | 'mock' = 'mock',
): NewsResponse {
  return {
    articles,
    totalResults: articles.length,
    providers: dataMode === 'live' ? ['gnews'] : dataMode === 'mock' ? ['mock-wire'] : [],
    dataMode,
    generatedAt: new Date().toISOString(),
  };
}

function makeConfig(overrides: Record<string, string | undefined> = {}): ConfigService {
  return {
    get: (key: string) => overrides[key],
  } as ConfigService;
}

describe('CountryNewsService', () => {
  const articlePersistence = {
    persistCountryRelations: jest.fn(),
    findRecentByCountry: jest.fn(),
    findRecent: jest.fn(),
  };

  beforeEach(() => {
    articlePersistence.persistCountryRelations.mockReset();
    articlePersistence.findRecentByCountry.mockReset();
    articlePersistence.findRecent.mockReset();

    articlePersistence.persistCountryRelations.mockResolvedValue(undefined);

    articlePersistence.findRecentByCountry.mockResolvedValue([]);

    articlePersistence.findRecent.mockResolvedValue([]);
  });

  function buildService(
    newsService: { search: jest.Mock },
    config: ConfigService = makeConfig(),
  ): CountryNewsService {
    return new CountryNewsService(newsService as never, config, articlePersistence as never);
  }

  it('resolves a known ISO3 country code and searches by its name', async () => {
    const newsService = {
      search: jest.fn().mockResolvedValue(makeSearchResponse([makeArticle({ id: 'a1' })])),
    };

    const service = buildService(newsService);

    const response = await service.getCountryNews('ESP');

    expect(response.countryCode).toBe('ESP');
    expect(response.countryName).toBe('Spain');

    expect(newsService.search).toHaveBeenCalledWith('Spain', expect.any(Number), undefined, undefined);
  });

  it('is case-insensitive for the country code', async () => {
    const newsService = {
      search: jest.fn().mockResolvedValue(makeSearchResponse([])),
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

    await expect(service.getCountryNews('ZZZ')).rejects.toThrow(BadRequestException);

    expect(newsService.search).not.toHaveBeenCalled();

    expect(articlePersistence.persistCountryRelations).not.toHaveBeenCalled();

    expect(articlePersistence.findRecentByCountry).not.toHaveBeenCalled();
  });

  it('returns an empty article list without error when there are no results', async () => {
    const newsService = {
      search: jest.fn().mockResolvedValue(makeSearchResponse([])),
    };

    const service = buildService(newsService);

    const response = await service.getCountryNews('ESP');

    expect(response.articles).toEqual([]);
    expect(response.totalResults).toBe(0);
    expect(response.fallbackReason).toBeUndefined();
    expect(response.newestArticlePublishedAt).toBeUndefined();

    expect(articlePersistence.findRecentByCountry).toHaveBeenCalledTimes(1);
  });

  it('propagates live dataMode unchanged', async () => {
    const newsService = {
      search: jest.fn().mockResolvedValue(makeSearchResponse([makeArticle({ id: 'a1' })], 'live')),
    };

    const service = buildService(newsService);

    const response = await service.getCountryNews('ESP');

    expect(response.dataMode).toBe('live');
    expect(response.fallbackReason).toBeUndefined();
    expect(response.newestArticlePublishedAt).toBeUndefined();
  });

  it('propagates cached dataMode unchanged', async () => {
    const newsService = {
      search: jest
        .fn()
        .mockResolvedValue(makeSearchResponse([makeArticle({ id: 'a1' })], 'cached')),
    };

    const service = buildService(newsService);

    const response = await service.getCountryNews('ESP');

    expect(response.dataMode).toBe('cached');
    expect(response.fallbackReason).toBeUndefined();
    expect(response.newestArticlePublishedAt).toBeUndefined();
  });
  it('propagates unavailable dataMode with delayed feedTier and provider-error reason when every live provider fails and no stored country reporting exists', async () => {
    const newsService = {
      search: jest.fn().mockResolvedValue({
        ...makeSearchResponse([], 'unavailable'),
        fallbackReason: 'provider-error',
      }),
    };

    const service = buildService(newsService);

    const response = await service.getCountryNews('ESP');

    expect(response.articles).toEqual([]);
    expect(response.dataMode).toBe('unavailable');
    expect(response.feedTier).toBe('delayed');
    expect(response.providerDisplayName).toBe('Unavailable');
    expect(response.fallbackReason).toBe('provider-error');

    expect(articlePersistence.findRecentByCountry).toHaveBeenCalledTimes(1);
  });

  it('does NOT report unavailable when the underlying provider succeeded with zero articles', async () => {
    const newsService = {
      search: jest.fn().mockResolvedValue(makeSearchResponse([], 'live')),
    };

    const service = buildService(newsService);

    const response = await service.getCountryNews('ESP');

    expect(response.articles).toEqual([]);
    expect(response.dataMode).toBe('live');
    expect(response.fallbackReason).toBeUndefined();
  });

  it('preserves fallback provenance returned by NewsService', async () => {
    const cachedArticle = makeArticle({
      id: 'cached-provider-error',
      title: 'Stored Spain reporting from NewsService',
      publishedAt: '2026-08-08T09:15:00.000Z',
    });

    const newsService = {
      search: jest.fn().mockResolvedValue({
        ...makeSearchResponse([cachedArticle], 'cached'),
        fallbackReason: 'provider-error',
      }),
    };

    const service = buildService(newsService);

    const response = await service.getCountryNews('ESP');

    expect(newsService.search).toHaveBeenCalledTimes(1);

    expect(response.dataMode).toBe('cached');
    expect(response.fallbackReason).toBe('provider-error');

    expect(response.newestArticlePublishedAt).toBe('2026-08-08T09:15:00.000Z');

    expect(response.articles).toHaveLength(1);
    expect(response.articles[0].id).toBe('cached-provider-error');

    expect(articlePersistence.findRecentByCountry).not.toHaveBeenCalled();

    expect(articlePersistence.persistCountryRelations).not.toHaveBeenCalled();
  });
  it('filters results by category without re-querying the provider twice', async () => {
    const articles = [
      makeArticle({
        id: 'a1',
        category: 'business',
        title: 'Spain announces new business regulations',
        summary: 'The Spanish government confirmed the plan.',
      }),
      makeArticle({
        id: 'a2',
        category: 'technology',
        title: 'Spain unveils technology investment fund',
        summary: 'The Spanish government confirmed the fund details.',
      }),
    ];

    const newsService = {
      search: jest.fn().mockResolvedValue(makeSearchResponse(articles)),
    };

    const service = buildService(newsService);

    const response = await service.getCountryNews('ESP', 'business');

    expect(newsService.search).toHaveBeenCalledTimes(1);
    expect(response.articles).toHaveLength(1);
    expect(response.articles[0].category).toBe('business');
  });

  it('caches a response and does not call the news service again for the same request', async () => {
    const newsService = {
      search: jest.fn().mockResolvedValue(makeSearchResponse([makeArticle({ id: 'a1' })])),
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
            title: 'Spain announces new business regulations',
            summary: 'The Spanish government confirmed the plan.',
          }),
          makeArticle({
            id: 'a2',
            category: 'technology',
            title: 'Spain unveils technology investment fund',
            summary: 'The Spanish government confirmed the fund details.',
          }),
        ]),
      ),
    };

    const service = buildService(newsService);

    const business = await service.getCountryNews('ESP', 'business');

    const technology = await service.getCountryNews('ESP', 'technology');

    expect(business.articles[0].category).toBe('business');

    expect(technology.articles[0].category).toBe('technology');
  });

  it('does not cache when COUNTRY_NEWS_CACHE_TTL_SECONDS is 0', async () => {
    const newsService = {
      search: jest.fn().mockResolvedValue(makeSearchResponse([makeArticle({ id: 'a1' })])),
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

  it('rethrows the provider error when database fallback has no stored articles', async () => {
    const providerError = new Error('GNews rate limit exceeded.');

    const newsService = {
      search: jest.fn().mockRejectedValue(providerError),
    };

    const service = buildService(newsService);

    await expect(service.getCountryNews('ESP')).rejects.toBe(providerError);

    expect(articlePersistence.findRecentByCountry).toHaveBeenCalledTimes(1);

    expect(articlePersistence.findRecentByCountry).toHaveBeenCalledWith({
      countryCode: 'ESP',
      category: undefined,
      limit: 8,
      maxAgeMinutes: 1440,
      relevantOnly: true,
    });

    expect(articlePersistence.persistCountryRelations).not.toHaveBeenCalled();
  });

  it('returns stored country articles when the provider throws an error', async () => {
    const olderStoredArticle = makeArticle({
      id: 'stored-provider-failure-1',
      title: 'Older stored Spain reporting',
      summary: 'Previously fetched reporting remains available during a provider outage.',
      sourceId: 'stored-provider',
      sourceName: 'Stored Provider',
      category: 'world',
      confidence: 91,
      publishedAt: '2026-08-08T07:00:00.000Z',
    });

    const newerStoredArticle = makeArticle({
      id: 'stored-provider-failure-2',
      title: 'Newer stored Spain reporting',
      sourceId: 'stored-provider',
      sourceName: 'Stored Provider',
      category: 'world',
      confidence: 89,
      publishedAt: '2026-08-08T09:30:00.000Z',
    });

    const newsService = {
      search: jest.fn().mockRejectedValue(new Error('GNews service unavailable.')),
    };

    articlePersistence.findRecentByCountry.mockResolvedValueOnce([
      olderStoredArticle,
      newerStoredArticle,
    ]);

    const service = buildService(newsService);

    const response = await service.getCountryNews('ESP', undefined, 5);

    expect(newsService.search).toHaveBeenCalledTimes(1);

    expect(articlePersistence.findRecentByCountry).toHaveBeenCalledTimes(1);

    expect(articlePersistence.findRecentByCountry).toHaveBeenCalledWith({
      countryCode: 'ESP',
      category: undefined,
      limit: 5,
      maxAgeMinutes: 1440,
      relevantOnly: true,
    });

    expect(response.countryCode).toBe('ESP');
    expect(response.countryName).toBe('Spain');

    expect(response.articles).toEqual([olderStoredArticle, newerStoredArticle]);

    expect(response.totalResults).toBe(2);
    expect(response.providers).toEqual([]);
    expect(response.dataMode).toBe('cached');
    expect(response.feedTier).toBe('delayed');
    expect(response.providerDisplayName).toBe('Stored reporting');

    expect(response.fallbackReason).toBe('provider-error');

    expect(response.newestArticlePublishedAt).toBe('2026-08-08T09:30:00.000Z');

    expect(articlePersistence.persistCountryRelations).not.toHaveBeenCalled();
  });

  it('persists article-country relations for live results', async () => {
    const article = makeArticle({
      id: 'spain-live-1',
      title: 'Spain government announces new policy',
      summary: 'Spain parliament and government officials announced a national policy.',
    });

    const newsService = {
      search: jest.fn().mockResolvedValue(makeSearchResponse([article], 'live')),
    };

    const service = buildService(newsService);

    await service.getCountryNews('ESP');

    expect(articlePersistence.persistCountryRelations).toHaveBeenCalledTimes(1);

    expect(articlePersistence.persistCountryRelations).toHaveBeenCalledWith([
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
      summary: 'Spain parliament and government officials discussed the election.',
    });

    const newsService = {
      search: jest.fn().mockResolvedValue(makeSearchResponse([article], 'live')),
    };

    const service = buildService(newsService);

    await service.getCountryNews('ESP');

    const relations = articlePersistence.persistCountryRelations.mock.calls[0][0];

    expect(relations).toHaveLength(1);

    expect(relations[0]).toEqual(
      expect.objectContaining({
        articleId: 'spain-score-1',
        countryCode: 'ESP',
        countryName: 'Spain',
      }),
    );

    expect(relations[0].relevanceScore).toBeGreaterThan(0);

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

    const response = await service.getCountryNews('ESP');

    expect(response.dataMode).toBe('mock');
    expect(response.fallbackReason).toBeUndefined();
    expect(response.newestArticlePublishedAt).toBeUndefined();

    expect(articlePersistence.persistCountryRelations).not.toHaveBeenCalled();
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

    const response = await service.getCountryNews('ESP');

    expect(response.dataMode).toBe('cached');
    expect(response.fallbackReason).toBeUndefined();
    expect(response.newestArticlePublishedAt).toBeUndefined();

    expect(articlePersistence.persistCountryRelations).not.toHaveBeenCalled();
  });

  it('returns stored country articles when the provider returns no articles', async () => {
    const olderStoredArticle = makeArticle({
      id: 'stored-spain-1',
      title: 'Older stored Spain headline',
      summary: 'Previously fetched reporting about Spain.',
      sourceId: 'stored-provider',
      sourceName: 'Stored Provider',
      category: 'world',
      confidence: 88,
      publishedAt: '2026-08-08T06:15:00.000Z',
    });

    const newerStoredArticle = makeArticle({
      id: 'stored-spain-2',
      title: 'Newer stored Spain headline',
      sourceId: 'stored-provider',
      sourceName: 'Stored Provider',
      category: 'world',
      confidence: 90,
      publishedAt: '2026-08-08T10:00:00.000Z',
    });

    const newsService = {
      search: jest.fn().mockResolvedValue(makeSearchResponse([], 'live')),
    };

    articlePersistence.findRecentByCountry.mockResolvedValueOnce([
      olderStoredArticle,
      newerStoredArticle,
    ]);

    const service = buildService(newsService);

    const response = await service.getCountryNews('ESP', undefined, 5);

    expect(articlePersistence.findRecentByCountry).toHaveBeenCalledTimes(1);

    expect(articlePersistence.findRecentByCountry).toHaveBeenCalledWith({
      countryCode: 'ESP',
      category: undefined,
      limit: 5,
      maxAgeMinutes: 1440,
      relevantOnly: true,
    });

    expect(response.articles).toEqual([olderStoredArticle, newerStoredArticle]);

    expect(response.totalResults).toBe(2);
    expect(response.dataMode).toBe('cached');
    expect(response.providers).toEqual([]);
    expect(response.feedTier).toBe('delayed');
    expect(response.providerDisplayName).toBe('Stored reporting');

    expect(response.fallbackReason).toBe('no-live-results');

    expect(response.newestArticlePublishedAt).toBe('2026-08-08T10:00:00.000Z');
  });

  it('uses the requested category when reading stored country articles', async () => {
    const storedArticle = makeArticle({
      id: 'stored-tech-1',
      title: 'Stored Spain technology headline',
      category: 'technology',
      publishedAt: '2026-08-08T08:45:00.000Z',
    });

    const newsService = {
      search: jest.fn().mockResolvedValue(makeSearchResponse([], 'live')),
    };

    articlePersistence.findRecentByCountry.mockResolvedValueOnce([storedArticle]);

    const service = buildService(newsService);

    const response = await service.getCountryNews('ESP', 'technology', 5);

    expect(articlePersistence.findRecentByCountry).toHaveBeenCalledWith(
      expect.objectContaining({
        countryCode: 'ESP',
        category: 'technology',
        limit: 5,
      }),
    );

    expect(response.dataMode).toBe('cached');
    expect(response.category).toBe('technology');

    expect(response.fallbackReason).toBe('no-live-results');

    expect(response.newestArticlePublishedAt).toBe('2026-08-08T08:45:00.000Z');

    expect(response.articles).toEqual([storedArticle]);
  });

  describe('city-aware retrieval (Milestone 27)', () => {
    it('combines the city with the country name in the live search term', async () => {
      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse([])),
      };

      const service = buildService(newsService);

      await service.getCountryNews('RWA', undefined, 20, 'kigali');

      expect(newsService.search).toHaveBeenCalledWith('kigali Rwanda', expect.any(Number), undefined, undefined);
    });

    it('does not include a city in the search term when none was provided', async () => {
      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse([])),
      };

      const service = buildService(newsService);

      await service.getCountryNews('RWA');

      expect(newsService.search).toHaveBeenCalledWith('Rwanda', expect.any(Number), undefined, undefined);
    });

    it('does not cache a city query together with a plain country query for the same country', async () => {
      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse([makeArticle({ id: 'a1' })])),
      };

      const service = buildService(
        newsService,
        makeConfig({
          COUNTRY_NEWS_CACHE_TTL_SECONDS: '300',
        }),
      );

      await service.getCountryNews('RWA', undefined, 20, 'kigali');

      await service.getCountryNews('RWA');

      expect(newsService.search).toHaveBeenCalledTimes(2);
    });

    it('surfaces city in the response envelope when provided, and omits it otherwise', async () => {
      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse([makeArticle({ id: 'a1' })])),
      };

      const service = buildService(newsService);

      const cityResponse = await service.getCountryNews('RWA', undefined, 20, 'kigali');

      expect(cityResponse.city).toBe('kigali');

      const countryOnlyResponse = await service.getCountryNews('RWA');

      expect(countryOnlyResponse.city).toBeUndefined();
    });

    it('ranks a city-mentioning article above a higher-scored non-city article', async () => {
      // This article scores higher on plain country-relevance (title +
      // summary both reference Rwanda and several context terms), but
      // never mentions Kigali.
      const highScoreCountryWide = makeArticle({
        id: 'country-wide-high-score',
        title: 'Rwanda government and parliament announce new economy policy',
        summary:
          'Rwanda officials, the president, and the military discussed the economy, war, and peace efforts nationally.',
      });

      // This article scores lower on plain country-relevance (title
      // only, no context terms) but does mention Kigali specifically.
      const lowScoreCityMatch = makeArticle({
        id: 'city-match-low-score',
        title: 'Kigali hosts regional summit',
        summary: 'Delegates gathered in Rwanda this week.',
      });

      const newsService = {
        search: jest
          .fn()
          .mockResolvedValue(makeSearchResponse([highScoreCountryWide, lowScoreCityMatch], 'live')),
      };

      const service = buildService(newsService);

      const response = await service.getCountryNews('RWA', undefined, 20, 'kigali');

      expect(response.articles.map((a) => a.id)).toEqual([
        'city-match-low-score',
        'country-wide-high-score',
      ]);
    });

    it('backfills remaining slots with country-wide articles when too few mention the city', async () => {
      const cityArticle = makeArticle({
        id: 'kigali-only',
        title: 'Kigali transit project breaks ground',
        summary: 'The project is based in Rwanda.',
      });

      const countryWideArticle = makeArticle({
        id: 'rwanda-only',
        title: 'Rwanda economy grows this quarter',
        summary: 'Officials cite steady government policy.',
      });

      const newsService = {
        search: jest
          .fn()
          .mockResolvedValue(makeSearchResponse([countryWideArticle, cityArticle], 'live')),
      };

      const service = buildService(newsService);

      const response = await service.getCountryNews('RWA', undefined, 20, 'kigali');

      // Both articles are returned (city article first), even though
      // only one mentions the city — country-wide coverage still
      // fills the remaining slots rather than being dropped.
      expect(response.articles).toHaveLength(2);
      expect(response.articles[0].id).toBe('kigali-only');
      expect(response.articles[1].id).toBe('rwanda-only');
    });

    it('uses findRecent to surface city-specific stored articles ahead of country-wide stored articles when the live provider fails', async () => {
      const providerError = new Error('GNews service unavailable.');

      const newsService = {
        search: jest.fn().mockRejectedValue(providerError),
      };

      const cityStoredArticle = makeArticle({
        id: 'stored-kigali-1',
        title: 'Kigali city council approves new budget',
        summary: 'The Rwanda capital city council voted today.',
        publishedAt: '2026-08-08T09:00:00.000Z',
      });

      const countryStoredArticle = makeArticle({
        id: 'stored-rwanda-1',
        title: 'Rwanda government reshuffles cabinet',
        summary: 'The president announced new appointments.',
        publishedAt: '2026-08-08T07:00:00.000Z',
      });

      articlePersistence.findRecent.mockResolvedValueOnce([cityStoredArticle]);

      articlePersistence.findRecentByCountry.mockResolvedValueOnce([countryStoredArticle]);

      const service = buildService(newsService);

      const response = await service.getCountryNews('RWA', undefined, 20, 'kigali');

      expect(articlePersistence.findRecent).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'kigali',
          category: undefined,
          maxAgeMinutes: 1440,
        }),
      );

      expect(response.dataMode).toBe('cached');
      expect(response.city).toBe('kigali');
      expect(response.articles.map((a) => a.id)).toEqual(['stored-kigali-1', 'stored-rwanda-1']);
    });

    it('excludes a stored city-name match that is not actually about the country', async () => {
      const providerError = new Error('GNews service unavailable.');

      const newsService = {
        search: jest.fn().mockRejectedValue(providerError),
      };

      // Mentions "Kigali" (matches the free-text findRecent query) but
      // has nothing to do with Rwanda or any country context — e.g. a
      // business named after the city in an unrelated market.
      const unrelatedCityNameMatch = makeArticle({
        id: 'unrelated-kigali-cafe',
        title: 'Kigali Coffee Co. opens new location',
        summary: 'The cafe chain expanded to a third city.',
        publishedAt: '2026-08-08T09:00:00.000Z',
      });

      const countryStoredArticle = makeArticle({
        id: 'stored-rwanda-2',
        title: 'Rwanda parliament debates new budget',
        summary: 'Lawmakers discussed the national economy.',
        publishedAt: '2026-08-08T07:00:00.000Z',
      });

      articlePersistence.findRecent.mockResolvedValueOnce([unrelatedCityNameMatch]);

      articlePersistence.findRecentByCountry.mockResolvedValueOnce([countryStoredArticle]);

      const service = buildService(newsService);

      const response = await service.getCountryNews('RWA', undefined, 20, 'kigali');

      const ids = response.articles.map((a) => a.id);
      expect(ids).not.toContain('unrelated-kigali-cafe');
      expect(ids).toContain('stored-rwanda-2');
    });

    it('uses findRecent to surface city-specific stored articles when live results are empty', async () => {
      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse([], 'live')),
      };

      const cityStoredArticle = makeArticle({
        id: 'stored-kigali-empty-live',
        title: 'Kigali marks anniversary with Rwanda ceremony',
        summary: 'The capital city held a national event.',
        publishedAt: '2026-08-08T09:00:00.000Z',
      });

      articlePersistence.findRecent.mockResolvedValueOnce([cityStoredArticle]);

      const service = buildService(newsService);

      const response = await service.getCountryNews('RWA', undefined, 20, 'kigali');

      expect(response.dataMode).toBe('cached');
      expect(response.articles.map((a) => a.id)).toEqual(['stored-kigali-empty-live']);
    });

    it('does not call findRecent when no city was provided', async () => {
      const newsService = {
        search: jest.fn().mockRejectedValue(new Error('GNews service unavailable.')),
      };

      articlePersistence.findRecentByCountry.mockResolvedValueOnce([
        makeArticle({ id: 'stored-country-only' }),
      ]);

      const service = buildService(newsService);

      await service.getCountryNews('RWA');

      expect(articlePersistence.findRecent).not.toHaveBeenCalled();
    });
  });

  describe('Milestone #49 — World Map EN/PL integration', () => {
    it('forwards lang to NewsService.search() as the 4th options argument', async () => {
      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse([makeArticle({ id: 'a1' })], 'live')),
      };

      const service = buildService(newsService);

      await service.getCountryNews('RWA', undefined, 8, undefined, 'pl');

      expect(newsService.search).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        undefined,
        { lang: 'pl' },
      );
    });

    it('no lang argument at all remains fully backward compatible — NewsService.search() receives undefined options', async () => {
      const newsService = {
        search: jest.fn().mockResolvedValue(makeSearchResponse([makeArticle({ id: 'a1' })], 'live')),
      };

      const service = buildService(newsService);

      await service.getCountryNews('RWA', undefined, 8);

      expect(newsService.search).toHaveBeenCalledWith(expect.any(String), expect.any(Number), undefined, undefined);
    });

    it('the client-visible cache is language-aware: en and pl requests for the same country never collide', async () => {
      let callCount = 0;
      const newsService = {
        search: jest.fn().mockImplementation((_query, _limit, _relevanceMode, options) => {
          callCount += 1;
          const lang = options?.lang;
          return Promise.resolve(
            makeSearchResponse(
              [
                makeArticle({
                  id: `article-${callCount}`,
                  sourceLanguage: lang,
                  title: 'Rwanda announces new policy',
                  summary: 'The Rwandan government confirmed the plan.',
                }),
              ],
              'live',
            ),
          );
        }),
      };

      const service = buildService(newsService);

      const responseEn = await service.getCountryNews('RWA', undefined, 8, undefined, 'en');
      const responsePl = await service.getCountryNews('RWA', undefined, 8, undefined, 'pl');

      expect(newsService.search).toHaveBeenCalledTimes(2);
      expect(responseEn.articles[0].id).not.toBe(responsePl.articles[0].id);
    });

    it('a second request with the SAME language for the same country still hits the cache (caching itself is not broken by the language-aware key)', async () => {
      const newsService = {
        search: jest.fn().mockResolvedValue(
          makeSearchResponse(
            [
              makeArticle({
                id: 'a1',
                sourceLanguage: 'pl',
                title: 'Rwanda announces new policy',
                summary: 'The Rwandan government confirmed the plan.',
              }),
            ],
            'live',
          ),
        ),
      };

      const service = buildService(newsService);

      await service.getCountryNews('RWA', undefined, 8, undefined, 'pl');
      await service.getCountryNews('RWA', undefined, 8, undefined, 'pl');

      expect(newsService.search).toHaveBeenCalledTimes(1);
    });

    describe('Phase C — country map language containment', () => {
      // Milestone #50 Phase B note: after relevance enforcement was
      // added, these fixtures were updated so their titles/summaries
      // genuinely mention "Poland" (or an ISO code) — otherwise they'd
      // now also be removed by the new relevance filter, which would
      // confound what THIS describe block is specifically testing
      // (language containment, not relevance). This surfaced a real,
      // separate interaction worth flagging: scoreCountryRelevance()
      // only matches the ENGLISH canonical country name/ISO codes, so
      // a genuinely relevant Polish-language article that never
      // includes an English mention of "Poland" would score 0 and be
      // discarded by the M50 relevance filter even though it's
      // legitimately about Poland — not fixed here (out of this
      // round's explicit scope), reported to the CTO for a scope
      // decision.
      it('lang=pl + provider failure + cached English/unlabeled rows: cached rows are NOT returned', async () => {
        const newsService = {
          search: jest.fn().mockRejectedValue(new Error('provider down')),
        };

        articlePersistence.findRecentByCountry.mockResolvedValueOnce([
          makeArticle({ id: 'stored-en', sourceLanguage: undefined }),
        ]);

        const service = buildService(newsService);

        const response = await service.getCountryNews('POL', undefined, 8, undefined, 'pl');

        expect(response.articles).toEqual([]);
        expect(response.dataMode).toBe('unavailable');
        expect(articlePersistence.findRecentByCountry).not.toHaveBeenCalled();
      });

      it('lang=en + provider failure + unlabeled cached rows: language-unverified rows are NOT returned', async () => {
        const newsService = {
          search: jest.fn().mockRejectedValue(new Error('provider down')),
        };

        articlePersistence.findRecentByCountry.mockResolvedValueOnce([makeArticle({ id: 'stored-unlabeled' })]);

        const service = buildService(newsService);

        const response = await service.getCountryNews('POL', undefined, 8, undefined, 'en');

        expect(response.articles).toEqual([]);
        expect(articlePersistence.findRecentByCountry).not.toHaveBeenCalled();
      });

      it('no lang + provider failure: existing cached fallback behavior remains unchanged', async () => {
        const newsService = {
          search: jest.fn().mockRejectedValue(new Error('provider down')),
        };

        articlePersistence.findRecentByCountry.mockResolvedValueOnce([makeArticle({ id: 'stored-1' })]);

        const service = buildService(newsService);

        const response = await service.getCountryNews('POL');

        expect(response.articles).toHaveLength(1);
        expect(response.dataMode).toBe('cached');
      });

      it('lang=pl + successful live mixed-language result: only confirmed Polish articles survive', async () => {
        const newsService = {
          search: jest.fn().mockResolvedValue(
            makeSearchResponse(
              [
                makeArticle({
                  id: 'en-1',
                  sourceLanguage: 'en',
                  url: 'https://x.com/en1',
                  title: 'Poland announces new policy',
                  summary: 'The government confirmed the plan.',
                }),
                makeArticle({
                  id: 'pl-1',
                  sourceLanguage: 'pl',
                  url: 'https://x.com/pl1',
                  title: 'Poland ogłasza nową politykę',
                  summary: 'Rząd potwierdził plan tego tygodnia.',
                }),
                makeArticle({
                  id: 'unlabeled-1',
                  sourceLanguage: undefined,
                  url: 'https://x.com/u1',
                  title: 'Poland unveils reform',
                  summary: 'Officials in Poland confirmed the details.',
                }),
              ],
              'live',
            ),
          ),
        };

        const service = buildService(newsService);

        const response = await service.getCountryNews('POL', undefined, 8, undefined, 'pl');

        expect(response.articles).toHaveLength(1);
        expect(response.articles[0].id).toBe('pl-1');
      });

      it('lang=en + successful live mixed-language result: only confirmed English articles survive', async () => {
        const newsService = {
          search: jest.fn().mockResolvedValue(
            makeSearchResponse(
              [
                makeArticle({
                  id: 'en-1',
                  sourceLanguage: 'en',
                  url: 'https://x.com/en1',
                  title: 'Poland announces new policy',
                  summary: 'The government confirmed the plan.',
                }),
                makeArticle({
                  id: 'pl-1',
                  sourceLanguage: 'pl',
                  url: 'https://x.com/pl1',
                  title: 'Polska ogłasza nową politykę',
                  summary: 'Rząd Polski potwierdził plan.',
                }),
                makeArticle({
                  id: 'fr-1',
                  sourceLanguage: 'fr',
                  url: 'https://x.com/fr1',
                  title: 'La Pologne annonce une nouvelle politique',
                  summary: 'Le gouvernement polonais a confirmé le plan.',
                }),
              ],
              'live',
            ),
          ),
        };

        const service = buildService(newsService);

        const response = await service.getCountryNews('POL', undefined, 8, undefined, 'en');

        expect(response.articles).toHaveLength(1);
        expect(response.articles[0].id).toBe('en-1');
      });

      it('a fully matching live result is preserved in full', async () => {
        const newsService = {
          search: jest.fn().mockResolvedValue(
            makeSearchResponse(
              [
                makeArticle({
                  id: 'pl-1',
                  sourceLanguage: 'pl',
                  url: 'https://x.com/pl1',
                  title: 'Poland pierwsza wiadomość',
                  summary: 'The Polish government confirmed the first plan.',
                }),
                makeArticle({
                  id: 'pl-2',
                  sourceLanguage: 'pl',
                  url: 'https://x.com/pl2',
                  title: 'Poland druga wiadomość',
                  summary: 'The Polish government confirmed the second plan.',
                }),
              ],
              'live',
            ),
          ),
        };

        const service = buildService(newsService);

        const response = await service.getCountryNews('POL', undefined, 8, undefined, 'pl');

        expect(response.articles).toHaveLength(2);
        expect(response.dataMode).toBe('live');
      });

      it('a language-constrained result filtered to zero produces a safe unavailable response rather than cross-language cached fallback', async () => {
        const newsService = {
          search: jest.fn().mockResolvedValue(
            makeSearchResponse([makeArticle({ id: 'en-1', sourceLanguage: 'en' })], 'live'),
          ),
        };

        articlePersistence.findRecentByCountry.mockResolvedValueOnce([makeArticle({ id: 'stored-cross-lang' })]);

        const service = buildService(newsService);

        const response = await service.getCountryNews('POL', undefined, 8, undefined, 'pl');

        expect(response.articles).toEqual([]);
        expect(response.dataMode).toBe('unavailable');
        expect(articlePersistence.findRecentByCountry).not.toHaveBeenCalled();
      });
    });
  });

  describe('Milestone #50 Phase B — country relevance enforcement', () => {
    it('1. a strong country-name match survives', async () => {
      const newsService = {
        search: jest.fn().mockResolvedValue(
          makeSearchResponse(
            [
              makeArticle({
                id: 'strong-1',
                title: 'Poland announces new energy policy',
                summary: 'The Polish government confirmed the plan.',
                url: 'https://x.com/strong1',
              }),
            ],
            'live',
          ),
        ),
      };

      const service = buildService(newsService);

      const response = await service.getCountryNews('POL');

      expect(response.articles.some((a) => a.id === 'strong-1')).toBe(true);
    });

    it('2. a zero-relevance article is removed, and 3. an unrelated-country article is removed, and 4. low supply returns fewer stories rather than padding', async () => {
      const newsService = {
        search: jest.fn().mockResolvedValue(
          makeSearchResponse(
            [
              makeArticle({
                id: 'strong-1',
                title: 'Poland announces new energy policy',
                summary: 'The Polish government confirmed the plan.',
                url: 'https://x.com/strong1',
              }),
              makeArticle({
                id: 'zero-relevance',
                title: 'Canada Confirms Participation Amid FIFA Governance Turmoil',
                summary: 'Canada presses ahead with tournament plans.',
                url: 'https://x.com/zero1',
              }),
              makeArticle({
                id: 'unrelated-country',
                title: 'ITC Infotech Strengthens Partnership With British American Tobacco',
                summary: 'The companies announced a deal.',
                url: 'https://x.com/zero2',
              }),
            ],
            'live',
          ),
        ),
      };

      const service = buildService(newsService);

      const response = await service.getCountryNews('POL', undefined, 8);

      expect(response.articles).toHaveLength(1);
      expect(response.articles[0].id).toBe('strong-1');
      expect(response.articles.some((a) => a.id === 'zero-relevance')).toBe(false);
      expect(response.articles.some((a) => a.id === 'unrelated-country')).toBe(false);
    });

    it('5. a city-only legitimate match survives via matchesCity even though scoreCountryRelevance alone would score it 0', async () => {
      const newsService = {
        search: jest.fn().mockResolvedValue(
          makeSearchResponse(
            [
              makeArticle({
                id: 'warsaw-1',
                title: 'Warsaw hosts international summit',
                summary: 'Officials gathered for two days of talks.',
                url: 'https://x.com/warsaw1',
              }),
            ],
            'live',
          ),
        ),
      };

      const service = buildService(newsService);

      const response = await service.getCountryNews('POL', undefined, 8, 'warsaw');

      expect(response.articles.some((a) => a.id === 'warsaw-1')).toBe(true);
    });

    it('6. category filtering still works after relevance enforcement', async () => {
      const newsService = {
        search: jest.fn().mockResolvedValue(
          makeSearchResponse(
            [
              makeArticle({
                id: 'poland-world',
                title: 'Poland announces new policy',
                summary: 'The government confirmed the plan.',
                category: 'world',
                url: 'https://x.com/pw',
              }),
              makeArticle({
                id: 'poland-business',
                title: 'Poland economy grows strongly',
                summary: 'The government confirmed strong growth figures.',
                category: 'business',
                url: 'https://x.com/pb',
              }),
            ],
            'live',
          ),
        ),
      };

      const service = buildService(newsService);

      const response = await service.getCountryNews('POL', 'business', 8);

      expect(response.articles).toHaveLength(1);
      expect(response.articles[0].id).toBe('poland-business');
    });

    it('7. deduplication still works after relevance filtering', async () => {
      const newsService = {
        search: jest.fn().mockResolvedValue(
          makeSearchResponse(
            [
              makeArticle({
                id: 'dup-1',
                title: 'Poland announces new energy policy today',
                summary: 'The Polish government confirmed the plan.',
                url: 'https://x.com/dup1',
              }),
              makeArticle({
                id: 'dup-2',
                title: 'Poland announces new energy policy today',
                summary: 'The Polish government confirmed the plan.',
                url: 'https://x.com/dup2',
              }),
            ],
            'live',
          ),
        ),
      };

      const service = buildService(newsService);

      const response = await service.getCountryNews('POL');

      expect(response.articles).toHaveLength(1);
    });

    it('8. language containment is unaffected by relevance enforcement — only the correct-language, relevant article survives', async () => {
      const newsService = {
        search: jest.fn().mockResolvedValue(
          makeSearchResponse(
            [
              makeArticle({
                id: 'pl-relevant',
                title: 'Poland announces new policy',
                summary: 'The government confirmed the plan.',
                sourceLanguage: 'pl',
                url: 'https://x.com/plr',
              }),
              makeArticle({
                id: 'en-relevant',
                title: 'Poland announces new policy',
                summary: 'The government confirmed the plan.',
                sourceLanguage: 'en',
                url: 'https://x.com/enr',
              }),
            ],
            'live',
          ),
        ),
      };

      const service = buildService(newsService);

      const response = await service.getCountryNews('POL', undefined, 8, undefined, 'pl');

      expect(response.articles).toHaveLength(1);
      expect(response.articles[0].id).toBe('pl-relevant');
    });

    it('9. no-lang backward compatibility is unaffected by relevance enforcement', async () => {
      const newsService = {
        search: jest.fn().mockResolvedValue(
          makeSearchResponse(
            [
              makeArticle({
                id: 'relevant-1',
                title: 'Poland announces new policy',
                summary: 'The government confirmed the plan.',
                url: 'https://x.com/rel1',
              }),
            ],
            'live',
          ),
        ),
      };

      const service = buildService(newsService);

      const response = await service.getCountryNews('POL');

      expect(response.articles).toHaveLength(1);
    });

    it('10. cached fallback relevantOnly:true semantics remain completely unchanged', async () => {
      const newsService = {
        search: jest.fn().mockRejectedValue(new Error('provider down')),
      };

      articlePersistence.findRecentByCountry.mockResolvedValueOnce([makeArticle({ id: 'stored-1' })]);

      const service = buildService(newsService);

      await service.getCountryNews('POL');

      expect(articlePersistence.findRecentByCountry).toHaveBeenCalledWith(
        expect.objectContaining({ relevantOnly: true }),
      );
    });

    it('persistCountryRelations still receives EVERY scored entry (relevant and irrelevant alike), with the correct isRelevant flag, unchanged by the new display filter', async () => {
      const newsService = {
        search: jest.fn().mockResolvedValue(
          makeSearchResponse(
            [
              makeArticle({
                id: 'strong-1',
                title: 'Poland announces new energy policy',
                summary: 'The Polish government confirmed the plan.',
                url: 'https://x.com/persist1',
              }),
              makeArticle({
                id: 'zero-relevance',
                title: 'Canada Confirms Participation Amid FIFA Governance Turmoil',
                summary: 'Canada presses ahead with tournament plans.',
                url: 'https://x.com/persist2',
              }),
            ],
            'live',
          ),
        ),
      };

      const service = buildService(newsService);

      await service.getCountryNews('POL');

      expect(articlePersistence.persistCountryRelations).toHaveBeenCalledWith([
        expect.objectContaining({ articleId: 'strong-1', isRelevant: true }),
        expect.objectContaining({ articleId: 'zero-relevance', isRelevant: false }),
      ]);
    });
  });
});
