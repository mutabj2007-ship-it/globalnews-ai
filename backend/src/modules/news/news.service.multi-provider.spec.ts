import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import type { NewsArticle, ProviderHealthStatus } from '@globalnews-ai/shared';
import { NewsService } from './news.service';
import {
  ALL_NEWS_PROVIDERS,
  FALLBACK_NEWS_PROVIDERS,
  NEWS_PROVIDERS,
} from './providers/provider.tokens';
import { ArticlePersistenceService } from './persistence/article-persistence.service';
import { GNewsProvider } from './providers/gnews.provider';
import { MockNewsProvider } from './providers/mock-news.provider';
import type { NewsProvider } from './interfaces';

/**
 * E1 — multi-provider behaviour of the news read path: provenance
 * survival, cross-provider duplicate collapse, failure isolation, and
 * dataMode truth with more than one real provider in play.
 *
 * news.service.spec.ts (unchanged) keeps covering the single-provider
 * contract; this file covers only what E1 newly makes possible.
 */

const SHARED_HEADLINE = 'Global markets steady after coordinated central bank statement';

/**
 * Two headlines with no meaningful token overlap, so areLikelyDuplicateArticles()
 * genuinely separates them — used wherever a test needs two DISTINCT stories
 * rather than the same story seen twice.
 */
const DISTINCT_HEADLINE_A = 'Researchers map a previously unknown ocean current system';
const DISTINCT_HEADLINE_B = 'Committee schedules vote on cross-border data proposal';

function makeArticle(overrides: Partial<NewsArticle> & Pick<NewsArticle, 'id'>): NewsArticle {
  return {
    title: SHARED_HEADLINE,
    summary: 'Summary',
    url: `https://example.com/${overrides.id}`,
    sourceId: 'example',
    sourceName: 'Example Outlet',
    category: 'world',
    sourcesCount: 1,
    publishedAt: '2026-01-01T00:00:00.000Z',
    // R4 GDELT — this fixture models a GNEWS article, and GNewsProvider now
    // stamps every record it emits with a proven publisher basis. Rung 3
    // refuses to compare timestamps whose bases differ or are unproven, so
    // a fixture without this field would be testing the guard rather than
    // the window. The assertions are unchanged; only the fixture caught up
    // with what the provider actually produces.
    publishedAtBasis: 'publisher' as const,
    ...overrides,
  };
}

/** A real (non-mock) provider that returns exactly what it is given. */
class FakeRealProvider implements NewsProvider {
  readonly isMock = false;

  constructor(
    readonly id: string,
    private readonly articles: NewsArticle[],
  ) {}

  get displayName(): string {
    return `Fake ${this.id}`;
  }

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
      checkedAt: '2026-01-01T00:00:00.000Z',
    };
  }
}

/** A real provider whose every read rejects. */
class FailingRealProvider implements NewsProvider {
  readonly isMock = false;

  constructor(readonly id: string) {}

  get displayName(): string {
    return `Failing ${this.id}`;
  }

  private fail(): Promise<never> {
    return Promise.reject(new Error(`${this.id} is unreachable`));
  }

  search(): Promise<NewsArticle[]> {
    return this.fail();
  }

  topHeadlines(): Promise<NewsArticle[]> {
    return this.fail();
  }

  category(): Promise<NewsArticle[]> {
    return this.fail();
  }

  async health(): Promise<ProviderHealthStatus> {
    return {
      providerId: this.id,
      displayName: this.displayName,
      status: 'down',
      checkedAt: '2026-01-01T00:00:00.000Z',
    };
  }
}

interface Persistence {
  persistMany: jest.Mock;
  findRecent: jest.Mock;
  findById: jest.Mock;
}

function makePersistence(): Persistence {
  return {
    // R0.5 — persistMany now resolves with a ReadonlyMap<url, ISO fetchedAt>
    // rather than void. An EMPTY map is the honest "nothing recorded" answer
    // and leaves every response in this file byte-identical to before, which
    // is exactly what these tests want to keep asserting.
    persistMany: jest.fn().mockResolvedValue(new Map<string, string>()),
    findRecent: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue(null),
  };
}

async function buildService(
  providers: NewsProvider[],
  persistence: Persistence = makePersistence(),
): Promise<NewsService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      NewsService,
      { provide: NEWS_PROVIDERS, useValue: providers },
      { provide: ALL_NEWS_PROVIDERS, useValue: providers },
      // R4 GDELT — no fallback-tier provider in this fixture, so the
      // tiered path collapses to the pre-R4 single-pass fan-out.
      { provide: FALLBACK_NEWS_PROVIDERS, useValue: [] },
      { provide: ArticlePersistenceService, useValue: persistence },
    ],
  }).compile();

  return module.get<NewsService>(NewsService);
}

describe('E1 — provider provenance survives normalization', () => {
  it('MockNewsProvider stamps its own real id on every article it emits, and never invents a providerRecordId', async () => {
    const provider = new MockNewsProvider();

    const articles = await provider.topHeadlines();

    expect(articles.length).toBeGreaterThan(0);
    for (const article of articles) {
      expect(article.providerId).toBe('mock-wire');
      expect(article.providerRecordId).toBeUndefined();
    }
  });

  it('GNewsProvider stamps its own real id during normalization, and never invents a providerRecordId', async () => {
    const config = { get: (key: string) => (key === 'GNEWS_API_KEY' ? 'real-key' : undefined) };
    const provider = new GNewsProvider(config as unknown as ConfigService);

    const originalFetch = global.fetch;
    (global as unknown as { fetch: unknown }).fetch = async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({
          totalArticles: 1,
          articles: [
            {
              title: SHARED_HEADLINE,
              description: 'Summary',
              url: 'https://example.com/story',
              publishedAt: '2026-01-01T00:00:00.000Z',
              source: { name: 'Example Outlet' },
              lang: 'en',
            },
          ],
        }),
      }) as unknown as Response;

    try {
      const articles = await provider.search('markets');

      expect(articles).toHaveLength(1);
      expect(articles[0].providerId).toBe('gnews');
      expect(articles[0].providerRecordId).toBeUndefined();
    } finally {
      (global as unknown as { fetch: unknown }).fetch = originalFetch;
    }
  });

  it('providerId survives NewsService’s merge/normalize path onto the response', async () => {
    const service = await buildService([
      new FakeRealProvider('provider-a', [
        makeArticle({ id: 'a-1', providerId: 'provider-a', title: DISTINCT_HEADLINE_A }),
      ]),
      new FakeRealProvider('provider-b', [
        makeArticle({ id: 'b-1', providerId: 'provider-b', title: DISTINCT_HEADLINE_B }),
      ]),
    ]);

    const response = await service.topHeadlines();

    expect(response.articles.map((article) => article.providerId).sort()).toEqual([
      'provider-a',
      'provider-b',
    ]);
  });
});

describe('E1 — cross-provider deduplication', () => {
  it('collapses the same story returned by two real providers under provider-namespaced ids', async () => {
    const service = await buildService([
      new FakeRealProvider('provider-a', [makeArticle({ id: 'a-1', providerId: 'provider-a' })]),
      new FakeRealProvider('provider-b', [makeArticle({ id: 'b-1', providerId: 'provider-b' })]),
    ]);

    const response = await service.topHeadlines();

    expect(response.articles).toHaveLength(1);
    expect(response.totalResults).toBe(1);
  });

  it('keeps the deterministic winner — the better-corroborated record — whichever provider is registered first', async () => {
    const lowCorroboration = makeArticle({
      id: 'a-1',
      providerId: 'provider-a',
      sourcesCount: 2,
    });
    const highCorroboration = makeArticle({
      id: 'b-1',
      providerId: 'provider-b',
      sourcesCount: 30,
    });

    const aFirst = await buildService([
      new FakeRealProvider('provider-a', [lowCorroboration]),
      new FakeRealProvider('provider-b', [highCorroboration]),
    ]);
    const bFirst = await buildService([
      new FakeRealProvider('provider-b', [highCorroboration]),
      new FakeRealProvider('provider-a', [lowCorroboration]),
    ]);

    expect((await aFirst.topHeadlines()).articles.map((a) => a.id)).toEqual(['b-1']);
    expect((await bFirst.topHeadlines()).articles.map((a) => a.id)).toEqual(['b-1']);
  });

  it('does NOT collapse genuinely different stories from different providers', async () => {
    const service = await buildService([
      new FakeRealProvider('provider-a', [
        makeArticle({ id: 'a-1', providerId: 'provider-a', title: SHARED_HEADLINE }),
      ]),
      new FakeRealProvider('provider-b', [
        makeArticle({
          id: 'b-1',
          providerId: 'provider-b',
          title: DISTINCT_HEADLINE_A,
        }),
      ]),
    ]);

    const response = await service.topHeadlines();

    expect(response.articles).toHaveLength(2);
  });

  /**
   * R4 — REPLACES “leaves a SINGLE provider’s own results untouched —
   * pre-E1 behaviour is preserved exactly”.
   *
   * THAT ASSERTION WAS TRUE, AND THE BEHAVIOUR IT PROTECTED TURNED OUT TO
   * BE THE DEFECT. E1 drew a deliberate scope line: the cross-provider
   * pass runs only when more than one provider contributed, so a single
   * provider’s own results were left exactly as they arrived. Since
   * `news.module.ts` declares exactly ONE real news provider candidate,
   * that line covered every shipped request — and the homepage rendered
   * one story on two adjacent Global Developments cards, same headline,
   * same image, because the two records carried two ids.
   *
   * The old fixture is kept verbatim on purpose: same headline, same host,
   * same publication instant, two urls. Two records of one article, which
   * is what the old assertion said must both survive and the new one says
   * must not. This is a contract change, recorded as one rather than
   * slipped in as a bumped expectation.
   */
  it('collapses a SINGLE provider’s own duplicate records — the R4 correction', async () => {
    const service = await buildService([
      new FakeRealProvider('provider-a', [
        makeArticle({ id: 'a-1', providerId: 'provider-a', title: SHARED_HEADLINE }),
        makeArticle({ id: 'a-2', providerId: 'provider-a', title: SHARED_HEADLINE }),
      ]),
    ]);

    const response = await service.topHeadlines();

    expect(response.articles.map((article) => article.id)).toEqual(['a-1']);
  });

  it('still keeps a single provider’s genuinely different stories', async () => {
    const service = await buildService([
      new FakeRealProvider('provider-a', [
        makeArticle({ id: 'a-1', providerId: 'provider-a', title: DISTINCT_HEADLINE_A }),
        makeArticle({ id: 'a-2', providerId: 'provider-a', title: DISTINCT_HEADLINE_B }),
      ]),
    ]);

    const response = await service.topHeadlines();

    expect(response.articles.map((article) => article.id)).toEqual(['a-1', 'a-2']);
  });

  /**
   * THE REGRESSION GUARD FOR THE R4 CORRECTION ITSELF.
   *
   * The first R4 draft collapsed duplicates over the MERGED set, which
   * kept the first occurrence and therefore silently pre-empted the
   * deterministic winner rule above — the survivor became a function of
   * provider registration order. This test pins the fix: the same-provider
   * pass is scoped PER PROVIDER, before the merge, so the cross-provider
   * winner rule still receives every provider’s candidate and still picks
   * the better-corroborated record whichever way round the providers are
   * registered.
   */
  it('the same-provider pass does not pre-empt the cross-provider winner rule', async () => {
    const lowFromA = makeArticle({ id: 'a-1', providerId: 'provider-a', sourcesCount: 2 });
    const lowDuplicateFromA = makeArticle({
      id: 'a-1-tracking',
      providerId: 'provider-a',
      url: 'https://example.com/a-1?utm_source=rss',
      sourcesCount: 2,
    });
    const highFromB = makeArticle({ id: 'b-1', providerId: 'provider-b', sourcesCount: 30 });

    const aFirst = await buildService([
      new FakeRealProvider('provider-a', [lowFromA, lowDuplicateFromA]),
      new FakeRealProvider('provider-b', [highFromB]),
    ]);
    const bFirst = await buildService([
      new FakeRealProvider('provider-b', [highFromB]),
      new FakeRealProvider('provider-a', [lowFromA, lowDuplicateFromA]),
    ]);

    // provider-a's own tracking-parameter duplicate is gone, AND the
    // better-corroborated record still wins, in either registration order.
    expect((await aFirst.topHeadlines()).articles.map((a) => a.id)).toEqual(['b-1']);
    expect((await bFirst.topHeadlines()).articles.map((a) => a.id)).toEqual(['b-1']);
  });

  it('still collapses exact-id repeats, as it always did', async () => {
    const repeated = makeArticle({ id: 'a-1', providerId: 'provider-a' });

    const service = await buildService([new FakeRealProvider('provider-a', [repeated, repeated])]);

    const response = await service.topHeadlines();

    expect(response.articles).toHaveLength(1);
  });
});

describe('E1 — failure isolation across real providers', () => {
  it('one real provider failing does NOT erase another real provider’s successful results', async () => {
    const service = await buildService([
      new FailingRealProvider('provider-down'),
      new FakeRealProvider('provider-up', [
        makeArticle({ id: 'up-1', providerId: 'provider-up', title: DISTINCT_HEADLINE_A }),
      ]),
    ]);

    const response = await service.topHeadlines();

    expect(response.articles.map((article) => article.id)).toEqual(['up-1']);
    expect(response.providers).toEqual(['provider-up']);
    expect(response.dataMode).toBe('live');
    expect(response.fallbackReason).toBeUndefined();
  });

  it('reports only the providers that actually contributed, never the ones merely configured', async () => {
    const service = await buildService([
      new FakeRealProvider('provider-a', [
        makeArticle({ id: 'a-1', providerId: 'provider-a', title: DISTINCT_HEADLINE_A }),
      ]),
      new FailingRealProvider('provider-b'),
      new FakeRealProvider('provider-c', [
        makeArticle({ id: 'c-1', providerId: 'provider-c', title: DISTINCT_HEADLINE_B }),
      ]),
    ]);

    const response = await service.search('markets');

    expect(response.providers).toEqual(['provider-a', 'provider-c']);
  });
});

describe('E1 — dataMode truth with multiple real providers', () => {
  it('two real providers both answering is "live"', async () => {
    const service = await buildService([
      new FakeRealProvider('provider-a', [
        makeArticle({ id: 'a-1', providerId: 'provider-a', title: DISTINCT_HEADLINE_A }),
      ]),
      new FakeRealProvider('provider-b', [
        makeArticle({ id: 'b-1', providerId: 'provider-b', title: DISTINCT_HEADLINE_B }),
      ]),
    ]);

    expect((await service.topHeadlines()).dataMode).toBe('live');
  });

  it('every real provider failing, with no stored reporting, is "unavailable" with fallbackReason "provider-error" — never "live"', async () => {
    const service = await buildService([
      new FailingRealProvider('provider-a'),
      new FailingRealProvider('provider-b'),
    ]);

    const response = await service.topHeadlines();

    expect(response.dataMode).toBe('unavailable');
    expect(response.fallbackReason).toBe('provider-error');
    expect(response.articles).toEqual([]);
  });

  it('a real provider answering with zero articles is still "live", not "unavailable"', async () => {
    const service = await buildService([
      new FakeRealProvider('provider-a', []),
      new FakeRealProvider('provider-b', []),
    ]);

    const response = await service.topHeadlines();

    expect(response.dataMode).toBe('live');
    expect(response.articles).toEqual([]);
  });

  it('the mock provider alone is "mock", and its articles are never persisted as real evidence', async () => {
    const persistence = makePersistence();
    const service = await buildService([new MockNewsProvider()], persistence);

    const response = await service.topHeadlines();

    expect(response.dataMode).toBe('mock');
    expect(response.articles.length).toBeGreaterThan(0);
    expect(persistence.persistMany).not.toHaveBeenCalled();
  });

  it('a live multi-provider response IS persisted, exactly once, with the merged article set', async () => {
    const persistence = makePersistence();
    const service = await buildService(
      [
        new FakeRealProvider('provider-a', [
          makeArticle({ id: 'a-1', providerId: 'provider-a', title: DISTINCT_HEADLINE_A }),
        ]),
        new FakeRealProvider('provider-b', [
          makeArticle({ id: 'b-1', providerId: 'provider-b', title: DISTINCT_HEADLINE_B }),
        ]),
      ],
      persistence,
    );

    const response = await service.topHeadlines();

    expect(persistence.persistMany).toHaveBeenCalledTimes(1);
    expect(persistence.persistMany).toHaveBeenCalledWith(response.articles);
  });

  it('falls back to stored reporting as "cached" when every real provider fails and stored reporting exists', async () => {
    const persistence = makePersistence();
    persistence.findRecent.mockResolvedValue([
      makeArticle({ id: 'stored-1', title: DISTINCT_HEADLINE_A }),
    ]);

    const service = await buildService(
      [new FailingRealProvider('provider-a'), new FailingRealProvider('provider-b')],
      persistence,
    );

    const response = await service.topHeadlines();

    expect(response.dataMode).toBe('cached');
    expect(response.fallbackReason).toBe('provider-error');
    expect(response.providers).toEqual([]);
  });
});
