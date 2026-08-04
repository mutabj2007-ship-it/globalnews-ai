import { BadRequestException } from '@nestjs/common';
import type { NewsArticle, NewsResponse } from '@globalnews-ai/shared';
import { CountryNewsService } from './country-news.service';

function makeArticle(overrides: Partial<NewsArticle>): NewsArticle {
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

function makeSearchResponse(articles: NewsArticle[], dataMode: 'live' | 'mock' = 'mock'): NewsResponse {
  return {
    articles,
    totalResults: articles.length,
    providers: dataMode === 'mock' ? ['mock-wire'] : ['gnews'],
    dataMode,
    generatedAt: new Date().toISOString(),
  };
}

function makeConfig(overrides: Record<string, string | undefined> = {}) {
  return { get: (key: string) => overrides[key] } as any;
}

describe('CountryNewsService', () => {
  it('resolves a known ISO3 country code and searches by its name', async () => {
    const newsService = { search: jest.fn().mockResolvedValue(makeSearchResponse([makeArticle({ id: 'a1' })])) };
    const service = new CountryNewsService(newsService as never, makeConfig());

    const response = await service.getCountryNews('ESP');

    expect(response.countryCode).toBe('ESP');
    expect(response.countryName).toBe('Spain');
    expect(newsService.search).toHaveBeenCalledWith('Spain', expect.any(Number));
  });

  it('is case-insensitive for the country code', async () => {
    const newsService = { search: jest.fn().mockResolvedValue(makeSearchResponse([])) };
    const service = new CountryNewsService(newsService as never, makeConfig());

    const response = await service.getCountryNews('esp');
    expect(response.countryName).toBe('Spain');
  });

  it('throws BadRequestException for an unknown country code', async () => {
    const newsService = { search: jest.fn() };
    const service = new CountryNewsService(newsService as never, makeConfig());

    await expect(service.getCountryNews('ZZZ')).rejects.toThrow(BadRequestException);
    expect(newsService.search).not.toHaveBeenCalled();
  });

  it('returns an empty article list without error when there are no results', async () => {
    const newsService = { search: jest.fn().mockResolvedValue(makeSearchResponse([])) };
    const service = new CountryNewsService(newsService as never, makeConfig());

    const response = await service.getCountryNews('ESP');
    expect(response.articles).toEqual([]);
    expect(response.totalResults).toBe(0);
  });

  it('propagates the underlying dataMode (live vs mock) unchanged', async () => {
    const newsService = { search: jest.fn().mockResolvedValue(makeSearchResponse([makeArticle({ id: 'a1' })], 'live')) };
    const service = new CountryNewsService(newsService as never, makeConfig());

    const response = await service.getCountryNews('ESP');
    expect(response.dataMode).toBe('live');
  });

  it('filters results by category without re-querying the provider twice', async () => {
    const articles = [
      makeArticle({ id: 'a1', category: 'business' }),
      makeArticle({ id: 'a2', category: 'technology' }),
    ];
    const newsService = { search: jest.fn().mockResolvedValue(makeSearchResponse(articles)) };
    const service = new CountryNewsService(newsService as never, makeConfig());

    const response = await service.getCountryNews('ESP', 'business');

    expect(newsService.search).toHaveBeenCalledTimes(1);
    expect(response.articles).toHaveLength(1);
    expect(response.articles[0].category).toBe('business');
  });

  it('caches a response and does not call the news service again for the same request', async () => {
    const newsService = { search: jest.fn().mockResolvedValue(makeSearchResponse([makeArticle({ id: 'a1' })])) };
    const service = new CountryNewsService(
      newsService as never,
      makeConfig({ COUNTRY_NEWS_CACHE_TTL_SECONDS: '300' }),
    );

    await service.getCountryNews('ESP');
    await service.getCountryNews('ESP');

    expect(newsService.search).toHaveBeenCalledTimes(1);
  });

  it('does not cache identical requests differing only by category together', async () => {
    const newsService = {
      search: jest.fn().mockResolvedValue(
        makeSearchResponse([
          makeArticle({ id: 'a1', category: 'business' }),
          makeArticle({ id: 'a2', category: 'technology' }),
        ]),
      ),
    };
    const service = new CountryNewsService(newsService as never, makeConfig());

    const business = await service.getCountryNews('ESP', 'business');
    const technology = await service.getCountryNews('ESP', 'technology');

    expect(business.articles[0].category).toBe('business');
    expect(technology.articles[0].category).toBe('technology');
  });

  it('does not cache when COUNTRY_NEWS_CACHE_TTL_SECONDS is 0', async () => {
    const newsService = { search: jest.fn().mockResolvedValue(makeSearchResponse([makeArticle({ id: 'a1' })])) };
    const service = new CountryNewsService(
      newsService as never,
      makeConfig({ COUNTRY_NEWS_CACHE_TTL_SECONDS: '0' }),
    );

    await service.getCountryNews('ESP');
    await service.getCountryNews('ESP');

    expect(newsService.search).toHaveBeenCalledTimes(2);
  });

  it('propagates provider failure errors rather than swallowing them silently', async () => {
    const newsService = { search: jest.fn().mockRejectedValue(new Error('GNews rate limit exceeded.')) };
    const service = new CountryNewsService(newsService as never, makeConfig());

    await expect(service.getCountryNews('ESP')).rejects.toThrow('GNews rate limit exceeded.');
  });
});
