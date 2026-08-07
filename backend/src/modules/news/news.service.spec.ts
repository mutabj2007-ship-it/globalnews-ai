import { Test, TestingModule } from '@nestjs/testing';
import type { NewsArticle, ProviderHealthStatus } from '@globalnews-ai/shared';
import { NewsService } from './news.service';
import {
  ALL_NEWS_PROVIDERS,
  NEWS_PROVIDERS,
} from './providers/provider.tokens';
import type { NewsProvider } from './interfaces';
import { ArticlePersistenceService } from './persistence/article-persistence.service';

function makeArticle(
  overrides: Partial<NewsArticle> = {},
): NewsArticle {
  return {
    id: 'article-1',
    title: 'Test headline',
    summary: 'Test summary',
    url: 'https://example.com/test',
    sourceId: 'test-provider',
    sourceName: 'Test Provider',
    category: 'world',
    sourcesCount: 1,
    publishedAt: new Date().toISOString(),
    ...overrides,
  };
}

class FakeHealthyProvider implements NewsProvider {
  readonly id = 'fake-healthy';
  readonly displayName = 'Fake Healthy Provider';
  readonly isMock = false;

  async search(): Promise<NewsArticle[]> {
    return [
      makeArticle({
        id: 'healthy-1',
        publishedAt: '2024-01-01T00:00:00.000Z',
      }),
    ];
  }

  async topHeadlines(): Promise<NewsArticle[]> {
    return [
      makeArticle({
        id: 'healthy-1',
        publishedAt: '2024-01-01T00:00:00.000Z',
      }),
      makeArticle({
        id: 'healthy-2',
        publishedAt: '2024-01-02T00:00:00.000Z',
      }),
    ];
  }

  async category(): Promise<NewsArticle[]> {
    return [makeArticle({ id: 'healthy-1' })];
  }

  async health(): Promise<ProviderHealthStatus> {
    return {
      providerId: this.id,
      displayName: this.displayName,
      status: 'ok',
      checkedAt: new Date().toISOString(),
    };
  }
}

class FakeFailingProvider implements NewsProvider {
  readonly id = 'fake-failing';
  readonly displayName = 'Fake Failing Provider';
  readonly isMock = false;

  async search(): Promise<NewsArticle[]> {
    throw new Error('Simulated provider outage');
  }

  async topHeadlines(): Promise<NewsArticle[]> {
    throw new Error('Simulated provider outage');
  }

  async category(): Promise<NewsArticle[]> {
    throw new Error('Simulated provider outage');
  }

  async health(): Promise<ProviderHealthStatus> {
    throw new Error('Simulated health check failure');
  }
}

class FakeEmptyProvider implements NewsProvider {
  readonly id = 'fake-empty';
  readonly displayName = 'Fake Empty Provider';
  readonly isMock = false;

  async search(): Promise<NewsArticle[]> {
    return [];
  }

  async topHeadlines(): Promise<NewsArticle[]> {
    return [];
  }

  async category(): Promise<NewsArticle[]> {
    return [];
  }

  async health(): Promise<ProviderHealthStatus> {
    return {
      providerId: this.id,
      displayName: this.displayName,
      status: 'ok',
      checkedAt: new Date().toISOString(),
    };
  }
}

class FakeDuplicateProvider implements NewsProvider {
  readonly id = 'fake-duplicate';
  readonly displayName = 'Fake Duplicate Provider';
  readonly isMock = false;

  async search(): Promise<NewsArticle[]> {
    return [makeArticle({ id: 'healthy-1' })];
  }

  async topHeadlines(): Promise<NewsArticle[]> {
    return [];
  }

  async category(): Promise<NewsArticle[]> {
    return [];
  }

  async health(): Promise<ProviderHealthStatus> {
    return {
      providerId: this.id,
      displayName: this.displayName,
      status: 'ok',
      checkedAt: new Date().toISOString(),
    };
  }
}

class FakeMockProvider implements NewsProvider {
  readonly id = 'fake-mock';
  readonly displayName = 'Fake Mock Provider';
  readonly isMock = true;

  async search(): Promise<NewsArticle[]> {
    return [makeArticle({ id: 'mock-1' })];
  }

  async topHeadlines(): Promise<NewsArticle[]> {
    return [makeArticle({ id: 'mock-1' })];
  }

  async category(): Promise<NewsArticle[]> {
    return [makeArticle({ id: 'mock-1' })];
  }

  async health(): Promise<ProviderHealthStatus> {
    return {
      providerId: this.id,
      displayName: this.displayName,
      status: 'ok',
      checkedAt: new Date().toISOString(),
    };
  }
}

describe('NewsService', () => {
  const articlePersistence = {
    persistMany: jest.fn().mockResolvedValue(undefined),
    findRecent: jest.fn().mockResolvedValue([]),
  };

beforeEach(() => {
  articlePersistence.persistMany.mockReset();
  articlePersistence.findRecent.mockReset();

  articlePersistence.persistMany.mockResolvedValue(undefined);
  articlePersistence.findRecent.mockResolvedValue([]);
});

  async function buildService(
    providers: NewsProvider[],
    allProviders: NewsProvider[] = providers,
  ): Promise<NewsService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NewsService,
        {
          provide: NEWS_PROVIDERS,
          useValue: providers,
        },
        {
          provide: ALL_NEWS_PROVIDERS,
          useValue: allProviders,
        },
        {
          provide: ArticlePersistenceService,
          useValue: articlePersistence,
        },
      ],
    }).compile();

    return module.get<NewsService>(NewsService);
  }

  it('does not persist mock news as real evidence', async () => {
    const service = await buildService([new FakeMockProvider()]);

    const response = await service.search('anything');

    expect(response.dataMode).toBe('mock');
    expect(articlePersistence.persistMany).not.toHaveBeenCalled();
  });

  it('does not use database fallback while mock/demo mode has results', async () => {
    const service = await buildService([new FakeMockProvider()]);

    await service.search('anything');

    expect(articlePersistence.findRecent).not.toHaveBeenCalled();
  });

  it('persists the final live articles returned by search', async () => {
    const service = await buildService([new FakeHealthyProvider()]);

    const response = await service.search('anything');

    expect(articlePersistence.persistMany).toHaveBeenCalledTimes(1);
    expect(articlePersistence.persistMany).toHaveBeenCalledWith(
      response.articles,
    );
  });

  it('persists only deduplicated live articles', async () => {
    const service = await buildService([
      new FakeHealthyProvider(),
      new FakeDuplicateProvider(),
    ]);

    await service.search('anything');

    expect(articlePersistence.persistMany).toHaveBeenCalledTimes(1);

    const persistedArticles =
      articlePersistence.persistMany.mock.calls[0][0];

    expect(persistedArticles).toHaveLength(1);
    expect(persistedArticles[0].id).toBe('healthy-1');
  });

  it('aggregates results across all healthy providers', async () => {
    const service = await buildService([new FakeHealthyProvider()]);

    const response = await service.search('anything');

    expect(response.articles).toHaveLength(1);
    expect(response.providers).toEqual(['fake-healthy']);
  });

  it('excludes failing providers instead of throwing', async () => {
    const service = await buildService([
      new FakeHealthyProvider(),
      new FakeFailingProvider(),
    ]);

    const response = await service.search('anything');

    expect(response.articles).toHaveLength(1);
    expect(response.providers).toEqual(['fake-healthy']);
  });

  it('dedupes articles with the same id across providers', async () => {
    const service = await buildService([
      new FakeHealthyProvider(),
      new FakeDuplicateProvider(),
    ]);

    const response = await service.search('anything');

    expect(
      response.articles.map((article) => article.id),
    ).toEqual(['healthy-1']);
  });

  it('preserves provider editorial order for topHeadlines', async () => {
    const service = await buildService([new FakeHealthyProvider()]);

    const response = await service.topHeadlines();

    expect(
      response.articles.map((article) => article.id),
    ).toEqual(['healthy-1', 'healthy-2']);
  });

  it('reports a down status for providers whose health check throws', async () => {
    const service = await buildService([
      new FakeHealthyProvider(),
      new FakeFailingProvider(),
    ]);

    const statuses = await service.providersHealth();

    const failing = statuses.find(
      (status) => status.providerId === 'fake-failing',
    );

    expect(failing?.status).toBe('down');
  });

  it('reports health for an inactive provider without letting it contribute articles', async () => {
    const active = new FakeHealthyProvider();
    const inactive = new FakeFailingProvider();

    const service = await buildService(
      [active],
      [active, inactive],
    );

    const searchResponse = await service.search('anything');

    expect(searchResponse.providers).toEqual(['fake-healthy']);

    const statuses = await service.providersHealth();

    expect(
      statuses.map((status) => status.providerId).sort(),
    ).toEqual(['fake-failing', 'fake-healthy']);
  });

  it('reports dataMode live when a non-mock provider answers', async () => {
    const service = await buildService([new FakeHealthyProvider()]);

    const response = await service.search('anything');

    expect(response.dataMode).toBe('live');
  });

  it('reports dataMode mock when only the mock provider answers', async () => {
    const service = await buildService([new FakeMockProvider()]);

    const response = await service.search('anything');

    expect(response.dataMode).toBe('mock');
  });

  it('uses cached database articles when a real provider fails', async () => {
    const cachedArticle = makeArticle({
      id: 'cached-1',
      title: 'Previously retrieved real reporting',
    });

    articlePersistence.findRecent.mockResolvedValueOnce([
      cachedArticle,
    ]);

    const service = await buildService([
      new FakeFailingProvider(),
    ]);

    const response = await service.search('Ceuta', 5);

    expect(articlePersistence.findRecent).toHaveBeenCalledWith({
      query: 'Ceuta',
      limit: 5,
      maxAgeMinutes: 1440,
    });

    expect(response.articles).toEqual([cachedArticle]);
    expect(response.totalResults).toBe(1);
    expect(response.providers).toEqual([]);
    expect(response.dataMode).toBe('cached');
    expect(response.query).toBe('Ceuta');
  });

  it('uses cached database articles when a real provider returns no results', async () => {
    const cachedArticle = makeArticle({
      id: 'cached-empty-provider',
    });

    articlePersistence.findRecent.mockResolvedValueOnce([
      cachedArticle,
    ]);

    const service = await buildService([
      new FakeEmptyProvider(),
    ]);

    const response = await service.search('Ceuta');

    expect(response.dataMode).toBe('cached');
    expect(response.articles).toEqual([cachedArticle]);
  });

  it('does not pretend there is cached data when database fallback is empty', async () => {
    articlePersistence.findRecent.mockResolvedValueOnce([]);

    const service = await buildService([
      new FakeFailingProvider(),
    ]);

    const response = await service.search('anything');

    expect(response.articles).toEqual([]);
    expect(response.dataMode).toBe('live');
  });

  it('does not use database fallback when only mock provider is configured', async () => {
    class EmptyMockProvider implements NewsProvider {
      readonly id = 'empty-mock';
      readonly displayName = 'Empty Mock Provider';
      readonly isMock = true;

      async search(): Promise<NewsArticle[]> {
        return [];
      }

      async topHeadlines(): Promise<NewsArticle[]> {
        return [];
      }

      async category(): Promise<NewsArticle[]> {
        return [];
      }

      async health(): Promise<ProviderHealthStatus> {
        return {
          providerId: this.id,
          displayName: this.displayName,
          status: 'ok',
          checkedAt: new Date().toISOString(),
        };
      }
    }

    articlePersistence.findRecent.mockResolvedValueOnce([
      makeArticle({ id: 'should-not-be-used' }),
    ]);

    const service = await buildService([
      new EmptyMockProvider(),
    ]);

    const response = await service.search('anything');

    expect(response.dataMode).toBe('mock');
    expect(response.articles).toEqual([]);
    expect(articlePersistence.findRecent).not.toHaveBeenCalled();
  });

  it('uses cached articles for top headlines when live provider fails', async () => {
    const cachedArticle = makeArticle({
      id: 'cached-headline',
    });

    articlePersistence.findRecent.mockResolvedValueOnce([
      cachedArticle,
    ]);

    const service = await buildService([
      new FakeFailingProvider(),
    ]);

    const response = await service.topHeadlines(3);

    expect(articlePersistence.findRecent).toHaveBeenCalledWith({
      limit: 3,
      maxAgeMinutes: 1440,
    });

    expect(response.dataMode).toBe('cached');
    expect(response.articles).toEqual([cachedArticle]);
  });

  it('uses category-scoped cached articles when category provider fails', async () => {
    const cachedArticle = makeArticle({
      id: 'cached-tech',
      category: 'technology',
    });

    articlePersistence.findRecent.mockResolvedValueOnce([
      cachedArticle,
    ]);

    const service = await buildService([
      new FakeFailingProvider(),
    ]);

    const response = await service.byCategory(
      'technology',
      4,
    );

    expect(articlePersistence.findRecent).toHaveBeenCalledWith({
      category: 'technology',
      limit: 4,
      maxAgeMinutes: 1440,
    });

    expect(response.dataMode).toBe('cached');
    expect(response.category).toBe('technology');
    expect(response.articles).toEqual([cachedArticle]);
  });
});