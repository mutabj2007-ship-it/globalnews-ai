import { Test, TestingModule } from '@nestjs/testing';
import type {
  NewsArticle,
  ProviderHealthStatus,
} from '@globalnews-ai/shared';
import { NewsService, type RelevanceMode } from './news.service';
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
    return [
      makeArticle({
        id: 'healthy-1',
      }),
    ];
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

/**
 * Milestone #36 — returns a fixed, caller-supplied set of articles
 * regardless of the query string, so tests can construct specific
 * relevant/irrelevant candidates for the generic relevance gate.
 */
class FakeQueryProvider implements NewsProvider {
  readonly id = 'fake-query';
  readonly displayName = 'Fake Query Provider';
  readonly isMock = false;

  constructor(private readonly articles: NewsArticle[]) {}

  async search(): Promise<NewsArticle[]> {
    return this.articles;
  }

  async topHeadlines(): Promise<NewsArticle[]> {
    return this.articles;
  }

  async category(): Promise<NewsArticle[]> {
    return this.articles;
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
    return [
      makeArticle({
        id: 'healthy-1',
      }),
    ];
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
    return [
      makeArticle({
        id: 'mock-1',
      }),
    ];
  }

  async topHeadlines(): Promise<NewsArticle[]> {
    return [
      makeArticle({
        id: 'mock-1',
      }),
    ];
  }

  async category(): Promise<NewsArticle[]> {
    return [
      makeArticle({
        id: 'mock-1',
      }),
    ];
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

    articlePersistence.persistMany.mockResolvedValue(
      undefined,
    );

    articlePersistence.findRecent.mockResolvedValue(
      [],
    );
  });

  async function buildService(
    providers: NewsProvider[],
    allProviders: NewsProvider[] = providers,
  ): Promise<NewsService> {
    const module: TestingModule =
      await Test.createTestingModule({
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
    const service = await buildService([
      new FakeMockProvider(),
    ]);

    const response = await service.search('anything');

    expect(response.dataMode).toBe('mock');

    expect(
      articlePersistence.persistMany,
    ).not.toHaveBeenCalled();
  });

  it('does not use database fallback while mock/demo mode has results', async () => {
    const service = await buildService([
      new FakeMockProvider(),
    ]);

    await service.search('anything');

    expect(
      articlePersistence.findRecent,
    ).not.toHaveBeenCalled();
  });

  it('persists the final live articles returned by search', async () => {
    const service = await buildService([
      new FakeHealthyProvider(),
    ]);

    const response = await service.search('anything');

    expect(
      articlePersistence.persistMany,
    ).toHaveBeenCalledTimes(1);

    expect(
      articlePersistence.persistMany,
    ).toHaveBeenCalledWith(
      response.articles,
    );
  });

  it('persists only deduplicated live articles', async () => {
    const service = await buildService([
      new FakeHealthyProvider(),
      new FakeDuplicateProvider(),
    ]);

    await service.search('anything');

    expect(
      articlePersistence.persistMany,
    ).toHaveBeenCalledTimes(1);

    const persistedArticles =
      articlePersistence.persistMany.mock.calls[0][0];

    expect(persistedArticles).toHaveLength(1);
    expect(persistedArticles[0].id).toBe(
      'healthy-1',
    );
  });

  it('aggregates results across all healthy providers', async () => {
    const service = await buildService([
      new FakeHealthyProvider(),
    ]);

    const response = await service.search('anything');

    expect(response.articles).toHaveLength(1);

    expect(response.providers).toEqual([
      'fake-healthy',
    ]);
  });

  it('excludes failing providers instead of throwing', async () => {
    const service = await buildService([
      new FakeHealthyProvider(),
      new FakeFailingProvider(),
    ]);

    const response = await service.search('anything');

    expect(response.articles).toHaveLength(1);

    expect(response.providers).toEqual([
      'fake-healthy',
    ]);
  });

  it('dedupes articles with the same id across providers', async () => {
    const service = await buildService([
      new FakeHealthyProvider(),
      new FakeDuplicateProvider(),
    ]);

    const response = await service.search('anything');

    expect(
      response.articles.map(
        (article) => article.id,
      ),
    ).toEqual([
      'healthy-1',
    ]);
  });

  it('preserves provider editorial order for topHeadlines', async () => {
    const service = await buildService([
      new FakeHealthyProvider(),
    ]);

    const response =
      await service.topHeadlines();

    expect(
      response.articles.map(
        (article) => article.id,
      ),
    ).toEqual([
      'healthy-1',
      'healthy-2',
    ]);
  });

  it('reports a down status for providers whose health check throws', async () => {
    const service = await buildService([
      new FakeHealthyProvider(),
      new FakeFailingProvider(),
    ]);

    const statuses =
      await service.providersHealth();

    const failing = statuses.find(
      (status) =>
        status.providerId === 'fake-failing',
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

    const searchResponse =
      await service.search('anything');

    expect(searchResponse.providers).toEqual([
      'fake-healthy',
    ]);

    const statuses =
      await service.providersHealth();

    expect(
      statuses
        .map(
          (status) =>
            status.providerId,
        )
        .sort(),
    ).toEqual([
      'fake-failing',
      'fake-healthy',
    ]);
  });

  it('reports dataMode live when a non-mock provider answers', async () => {
    const service = await buildService([
      new FakeHealthyProvider(),
    ]);

    const response = await service.search('anything');

    expect(response.dataMode).toBe('live');
    expect(response.fallbackReason).toBeUndefined();
  });

  it('reports dataMode mock when only the mock provider answers', async () => {
    const service = await buildService([
      new FakeMockProvider(),
    ]);

    const response = await service.search('anything');

    expect(response.dataMode).toBe('mock');
    expect(response.fallbackReason).toBeUndefined();
  });

  it('uses cached database articles with provider-error provenance when a real provider fails', async () => {
    const cachedArticle = makeArticle({
      id: 'cached-1',
      title:
        'Previously retrieved real reporting',
    });

    articlePersistence.findRecent.mockResolvedValueOnce([
      cachedArticle,
    ]);

    const service = await buildService([
      new FakeFailingProvider(),
    ]);

    const response =
      await service.search('Ceuta', 5);

    expect(
      articlePersistence.findRecent,
    ).toHaveBeenCalledWith({
      query: 'Ceuta',
      limit: 5,
      maxAgeMinutes: 1440,
    });

    expect(response.articles).toEqual([
      cachedArticle,
    ]);

    expect(response.totalResults).toBe(1);
    expect(response.providers).toEqual([]);
    expect(response.dataMode).toBe('cached');

    expect(response.fallbackReason).toBe(
      'provider-error',
    );

    expect(response.query).toBe('Ceuta');
  });

  it('uses cached database articles with no-live-results provenance when a real provider returns no results', async () => {
    const cachedArticle = makeArticle({
      id: 'cached-empty-provider',
    });

    articlePersistence.findRecent.mockResolvedValueOnce([
      cachedArticle,
    ]);

    const service = await buildService([
      new FakeEmptyProvider(),
    ]);

    const response =
      await service.search('Ceuta');

    expect(
      articlePersistence.findRecent,
    ).toHaveBeenCalledWith({
      query: 'Ceuta',
      limit: undefined,
      maxAgeMinutes: 1440,
    });

    expect(response.articles).toEqual([
      cachedArticle,
    ]);

    expect(response.totalResults).toBe(1);
    expect(response.providers).toEqual([]);
    expect(response.dataMode).toBe('cached');

    expect(response.fallbackReason).toBe(
      'no-live-results',
    );

    expect(response.query).toBe('Ceuta');
  });

  it('reports dataMode unavailable (not live) when every real provider fails and database fallback is empty', async () => {
    articlePersistence.findRecent.mockResolvedValueOnce(
      [],
    );

    const service = await buildService([
      new FakeFailingProvider(),
    ]);

    const response =
      await service.search('anything');

    expect(response.articles).toEqual([]);
    expect(response.providers).toEqual([]);
    expect(response.dataMode).toBe(
      'unavailable',
    );

    expect(response.fallbackReason).toBe(
      'provider-error',
    );
  });

  it('reports dataMode unavailable for topHeadlines when every real provider fails and database fallback is empty', async () => {
    articlePersistence.findRecent.mockResolvedValueOnce(
      [],
    );

    const service = await buildService([
      new FakeFailingProvider(),
    ]);

    const response =
      await service.topHeadlines();

    expect(response.articles).toEqual([]);
    expect(response.providers).toEqual([]);
    expect(response.dataMode).toBe(
      'unavailable',
    );

    expect(response.fallbackReason).toBe(
      'provider-error',
    );
  });

  it('reports dataMode unavailable for byCategory when every real provider fails and database fallback is empty', async () => {
    articlePersistence.findRecent.mockResolvedValueOnce(
      [],
    );

    const service = await buildService([
      new FakeFailingProvider(),
    ]);

    const response =
      await service.byCategory(
        'technology',
      );

    expect(response.articles).toEqual([]);
    expect(response.providers).toEqual([]);
    expect(response.dataMode).toBe(
      'unavailable',
    );

    expect(response.fallbackReason).toBe(
      'provider-error',
    );
  });

  it('does NOT report unavailable when a real provider succeeds with zero articles (distinct from total provider failure)', async () => {
    articlePersistence.findRecent.mockResolvedValueOnce(
      [],
    );

    const service = await buildService([
      new FakeEmptyProvider(),
    ]);

    const response =
      await service.search('anything');

    expect(response.articles).toEqual([]);
    expect(response.providers).toEqual([
      'fake-empty',
    ]);
    expect(response.dataMode).toBe('live');

    expect(
      response.fallbackReason,
    ).toBeUndefined();
  });

  it('does not use database fallback when only mock provider is configured', async () => {
    class EmptyMockProvider
      implements NewsProvider
    {
      readonly id = 'empty-mock';
      readonly displayName =
        'Empty Mock Provider';
      readonly isMock = true;

      async search(): Promise<NewsArticle[]> {
        return [];
      }

      async topHeadlines(): Promise<
        NewsArticle[]
      > {
        return [];
      }

      async category(): Promise<
        NewsArticle[]
      > {
        return [];
      }

      async health(): Promise<ProviderHealthStatus> {
        return {
          providerId: this.id,
          displayName: this.displayName,
          status: 'ok',
          checkedAt:
            new Date().toISOString(),
        };
      }
    }

    articlePersistence.findRecent.mockResolvedValueOnce([
      makeArticle({
        id: 'should-not-be-used',
      }),
    ]);

    const service = await buildService([
      new EmptyMockProvider(),
    ]);

    const response =
      await service.search('anything');

    expect(response.dataMode).toBe('mock');
    expect(response.articles).toEqual([]);

    expect(
      response.fallbackReason,
    ).toBeUndefined();

    expect(
      articlePersistence.findRecent,
    ).not.toHaveBeenCalled();
  });

  it('uses cached articles for top headlines with provider-error provenance when live provider fails', async () => {
    const cachedArticle = makeArticle({
      id: 'cached-headline',
    });

    articlePersistence.findRecent.mockResolvedValueOnce([
      cachedArticle,
    ]);

    const service = await buildService([
      new FakeFailingProvider(),
    ]);

    const response =
      await service.topHeadlines(3);

    expect(
      articlePersistence.findRecent,
    ).toHaveBeenCalledWith({
      limit: 3,
      maxAgeMinutes: 1440,
    });

    expect(response.dataMode).toBe('cached');

    expect(response.fallbackReason).toBe(
      'provider-error',
    );

    expect(response.articles).toEqual([
      cachedArticle,
    ]);
  });

  it('uses category-scoped cached articles with provider-error provenance when category provider fails', async () => {
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

    const response =
      await service.byCategory(
        'technology',
        4,
      );

    expect(
      articlePersistence.findRecent,
    ).toHaveBeenCalledWith({
      category: 'technology',
      limit: 4,
      maxAgeMinutes: 1440,
    });

    expect(response.dataMode).toBe('cached');

    expect(response.fallbackReason).toBe(
      'provider-error',
    );

    expect(response.category).toBe(
      'technology',
    );

    expect(response.articles).toEqual([
      cachedArticle,
    ]);
  });

  describe('generic relevance gate (Milestone #36)', () => {
    const relevantArticle = makeArticle({
      id: 'relevant-1',
      title: 'Sens. Schiff and Klobuchar unveil new cybersecurity bill',
      summary: 'The bipartisan cybersecurity bill aims to protect infrastructure.',
      publishedAt: '2024-01-02T00:00:00.000Z',
    });

    const irrelevantArticle = makeArticle({
      id: 'irrelevant-1',
      title: 'Dark Energy May Explain the Expansion of the Universe',
      summary: 'Scientists discuss cosmology and the nature of the cosmos.',
      publishedAt: '2024-01-03T00:00:00.000Z',
    });

    it("filters live generic results when relevanceMode is 'generic', keeping only relevant articles", async () => {
      const service = await buildService([
        new FakeQueryProvider([irrelevantArticle, relevantArticle]),
      ]);

      const response = await service.search('cybersecurity', 20, { type: 'generic' });

      expect(response.articles.map((a) => a.id)).toEqual(['relevant-1']);
      expect(response.totalResults).toBe(1);
    });

    it("does NOT filter when relevanceMode is omitted (default 'none') — preserves pre-M36 behavior for every existing caller", async () => {
      const service = await buildService([
        new FakeQueryProvider([irrelevantArticle, relevantArticle]),
      ]);

      const response = await service.search('cybersecurity', 20);

      expect(response.articles.map((a) => a.id).sort()).toEqual(
        ['irrelevant-1', 'relevant-1'].sort(),
      );
    });

    it("does NOT filter when relevanceMode is explicitly 'none'", async () => {
      const service = await buildService([
        new FakeQueryProvider([irrelevantArticle, relevantArticle]),
      ]);

      const response = await service.search('cybersecurity', 20, { type: 'none' });

      expect(response.articles).toHaveLength(2);
    });

    it('does not persist a relevance-rejected article as accepted generic evidence', async () => {
      const service = await buildService([
        new FakeQueryProvider([irrelevantArticle, relevantArticle]),
      ]);

      await service.search('cybersecurity', 20, { type: 'generic' });

      expect(articlePersistence.persistMany).toHaveBeenCalledWith([
        relevantArticle,
      ]);
    });

    it('accepted results retain the existing recency ordering', async () => {
      const older = makeArticle({
        id: 'cyber-older',
        title: 'Cybersecurity report released',
        summary: 'Details of the cybersecurity report.',
        publishedAt: '2024-01-01T00:00:00.000Z',
      });
      const newer = makeArticle({
        id: 'cyber-newer',
        title: 'New cybersecurity guidance issued',
        summary: 'Updated cybersecurity guidance for agencies.',
        publishedAt: '2024-01-05T00:00:00.000Z',
      });

      const service = await buildService([
        new FakeQueryProvider([older, newer]),
      ]);

      const response = await service.search('cybersecurity', 20, { type: 'generic' });

      expect(response.articles.map((a) => a.id)).toEqual([
        'cyber-newer',
        'cyber-older',
      ]);
    });

    it('when every live candidate is rejected, falls through to the existing honest zero-results/degraded behavior (no fabricated replacement)', async () => {
      const service = await buildService([
        new FakeQueryProvider([irrelevantArticle]),
      ]);

      const response = await service.search('cybersecurity', 20, { type: 'generic' });

      expect(response.articles).toEqual([]);
      expect(articlePersistence.persistMany).not.toHaveBeenCalled();
    });

    it('applies the SAME gate to the stored/persisted database fallback, so live and stored generic results share one trust rule', async () => {
      articlePersistence.findRecent.mockResolvedValue([
        irrelevantArticle,
        relevantArticle,
      ]);

      const service = await buildService([
        new FakeEmptyProvider(),
      ]);

      const response = await service.search('cybersecurity', 20, { type: 'generic' });

      expect(response.articles.map((a) => a.id)).toEqual(['relevant-1']);
      expect(response.dataMode).toBe('cached');
    });

    it('a stored fallback whose only candidates are all rejected falls through to the honest empty response, not a fabricated one', async () => {
      articlePersistence.findRecent.mockResolvedValue([irrelevantArticle]);

      const service = await buildService([
        new FakeEmptyProvider(),
      ]);

      const response = await service.search('cybersecurity', 20, { type: 'generic' });

      expect(response.articles).toEqual([]);
    });

    it('does not filter topHeadlines results (gate is search()-only, per approved scope)', async () => {
      const service = await buildService([
        new FakeQueryProvider([irrelevantArticle]),
      ]);

      const response = await service.topHeadlines(10);

      expect(response.articles.map((a) => a.id)).toEqual(['irrelevant-1']);
    });

    it('does not filter byCategory results (gate is search()-only, per approved scope)', async () => {
      const service = await buildService([
        new FakeQueryProvider([irrelevantArticle]),
      ]);

      const response = await service.byCategory('science', 10);

      expect(response.articles.map((a) => a.id)).toEqual(['irrelevant-1']);
    });
  });

  describe("relational relevance mode (Milestone #37)", () => {
    const jointArticle = makeArticle({
      id: 'joint-1',
      title: 'Oil prices rise sharply as Iran conflict disrupts shipping',
      summary: 'Markets reacted as tensions escalated.',
      publishedAt: '2024-02-02T00:00:00.000Z',
    });

    const xOnlyArticle = makeArticle({
      id: 'x-only-1',
      title: 'Iran conflict enters another week',
      summary: 'The situation remains tense.',
      publishedAt: '2024-02-03T00:00:00.000Z',
    });

    const yOnlyArticle = makeArticle({
      id: 'y-only-1',
      title: 'Oil prices rise after inventory report',
      summary: 'Analysts weigh in on the market move.',
      publishedAt: '2024-02-01T00:00:00.000Z',
    });

    it("filters live relational results, keeping only articles where BOTH x and y are present", async () => {
      const service = await buildService([
        new FakeQueryProvider([jointArticle, xOnlyArticle, yOnlyArticle]),
      ]);

      const response = await service.search('Iran conflict oil prices', 20, {
        type: 'relational',
        x: 'Iran conflict',
        y: 'oil prices',
      });

      expect(response.articles.map((a) => a.id)).toEqual(['joint-1']);
    });

    it("does not persist an x-only or y-only article as accepted relational evidence", async () => {
      const service = await buildService([
        new FakeQueryProvider([jointArticle, xOnlyArticle, yOnlyArticle]),
      ]);

      await service.search('Iran conflict oil prices', 20, {
        type: 'relational',
        x: 'Iran conflict',
        y: 'oil prices',
      });

      expect(articlePersistence.persistMany).toHaveBeenCalledWith([jointArticle]);
    });

    it("applies the SAME relational gate to the stored/persisted database fallback, so live and stored relational results share one trust rule", async () => {
      articlePersistence.findRecent.mockResolvedValue([
        jointArticle,
        xOnlyArticle,
        yOnlyArticle,
      ]);

      const service = await buildService([new FakeEmptyProvider()]);

      const response = await service.search('Iran conflict oil prices', 20, {
        type: 'relational',
        x: 'Iran conflict',
        y: 'oil prices',
      });

      expect(response.articles.map((a) => a.id)).toEqual(['joint-1']);
      expect(response.dataMode).toBe('cached');
    });

    it("a relational query must not retrieve unvalidated cached articles simply because the live provider failed", async () => {
      // Only x-only/y-only candidates are available in the stored
      // fallback — neither individually satisfies the relational gate,
      // so a query must never bypass validation just because live
      // retrieval failed.
      articlePersistence.findRecent.mockResolvedValue([
        xOnlyArticle,
        yOnlyArticle,
      ]);

      const service = await buildService([new FakeEmptyProvider()]);

      const response = await service.search('Iran conflict oil prices', 20, {
        type: 'relational',
        x: 'Iran conflict',
        y: 'oil prices',
      });

      expect(response.articles).toEqual([]);
    });

    it("when every relational candidate is rejected, falls through to the existing honest zero-results/degraded behavior", async () => {
      const service = await buildService([
        new FakeQueryProvider([xOnlyArticle, yOnlyArticle]),
      ]);

      const response = await service.search('Iran conflict oil prices', 20, {
        type: 'relational',
        x: 'Iran conflict',
        y: 'oil prices',
      });

      expect(response.articles).toEqual([]);
      expect(articlePersistence.persistMany).not.toHaveBeenCalled();
    });

    it("ordinary M36 generic mode is unaffected by the existence of relational mode", async () => {
      const service = await buildService([
        new FakeQueryProvider([jointArticle]),
      ]);

      // jointArticle's title contains "Iran conflict" and "oil prices"
      // but NOT the single word "cybersecurity" at all — proves generic
      // mode still uses scoreGenericRelevance, not scoreRelationalRelevance.
      const response = await service.search('cybersecurity', 20, {
        type: 'generic',
      });

      expect(response.articles).toEqual([]);
    });

    it("relevance modes cannot both be active — the type system makes 'generic' and 'relational' mutually exclusive by construction", () => {
      // This is a compile-time guarantee, not a runtime one: a
      // RelevanceMode value can only ever be one of 'none' | 'generic' |
      // 'relational' — there is no way to construct a value satisfying
      // more than one variant at once. Demonstrating this here as a
      // type-level assertion; TypeScript itself rejects any attempt to
      // pass e.g. { type: 'generic', x: '...', y: '...' } since 'x'/'y'
      // are not valid properties of the 'generic' variant.
      const mode: RelevanceMode = { type: 'relational', x: 'a', y: 'b' };
      expect(mode.type).toBe('relational');
    });

    it("does not filter topHeadlines or byCategory results (relational gate is search()-only)", async () => {
      const service = await buildService([
        new FakeQueryProvider([xOnlyArticle]),
      ]);

      const topResponse = await service.topHeadlines(10);
      expect(topResponse.articles.map((a) => a.id)).toEqual(['x-only-1']);

      const categoryResponse = await service.byCategory('world', 10);
      expect(categoryResponse.articles.map((a) => a.id)).toEqual(['x-only-1']);
    });
  });
});