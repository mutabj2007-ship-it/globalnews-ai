import { Test, TestingModule } from '@nestjs/testing';
import type { NewsArticle, ProviderHealthStatus } from '@globalnews-ai/shared';
import { NewsService } from './news.service';
import { ALL_NEWS_PROVIDERS, NEWS_PROVIDERS } from './providers/provider.tokens';
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

class FakeDuplicateProvider implements NewsProvider {
  readonly id = 'fake-duplicate';
  readonly displayName = 'Fake Duplicate Provider';
  readonly isMock = false;

  async search(): Promise<NewsArticle[]> {
    // Same id as FakeHealthyProvider's article to exercise dedupe logic.
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
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  async function buildService(
    providers: NewsProvider[],
    allProviders: NewsProvider[] = providers,
  ): Promise<NewsService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NewsService,
        { provide: NEWS_PROVIDERS, useValue: providers },
        { provide: ALL_NEWS_PROVIDERS, useValue: allProviders },
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

  it('persists the final articles returned by search', async () => {
    const service = await buildService([new FakeHealthyProvider()]);

    const response = await service.search('anything');

    expect(articlePersistence.persistMany).toHaveBeenCalledTimes(1);
    expect(articlePersistence.persistMany).toHaveBeenCalledWith(
      response.articles,
    );
  });

  it('persists only deduplicated articles', async () => {
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

    const ids = response.articles.map((article) => article.id);
    expect(ids).toEqual(['healthy-1']);
  });

  it('preserves provider editorial order for topHeadlines instead of resorting by recency', async () => {
    const service = await buildService([new FakeHealthyProvider()]);
    const response = await service.topHeadlines();

    // healthy-1 has an earlier publishedAt than healthy-2, but the
    // provider intentionally returns healthy-1 first as its top pick.
    expect(response.articles.map((article) => article.id)).toEqual([
      'healthy-1',
      'healthy-2',
    ]);
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

  it('reports dataMode "live" when a non-mock provider answers', async () => {
    const service = await buildService([new FakeHealthyProvider()]);
    const response = await service.search('anything');

    expect(response.dataMode).toBe('live');
  });

  it('reports dataMode "mock" when only the mock provider answers', async () => {
    const service = await buildService([new FakeMockProvider()]);
    const response = await service.search('anything');

    expect(response.dataMode).toBe('mock');
  });

  it("falls back to the configured provider's mode when nothing responds", async () => {
    const service = await buildService([new FakeFailingProvider()]);
    const response = await service.search('anything');

    // FakeFailingProvider is configured (isMock: false) even though it
    // always throws, so the response should still say "live".
    expect(response.articles).toEqual([]);
    expect(response.dataMode).toBe('live');
  });
});