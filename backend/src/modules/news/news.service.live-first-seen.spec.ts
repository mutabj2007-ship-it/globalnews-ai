import { Test, type TestingModule } from '@nestjs/testing';
import type { NewsArticle, ProviderHealthStatus } from '@globalnews-ai/shared';
import { NewsService } from './news.service';
import {
  ALL_NEWS_PROVIDERS,
  FALLBACK_NEWS_PROVIDERS,
  NEWS_PROVIDERS,
} from './providers/provider.tokens';
import { ArticlePersistenceService } from './persistence/article-persistence.service';
import type { NewsProvider } from './interfaces';

/**
 * R0.5 — firstSeenAt on the LIVE read path.
 *
 * R0 exposed Article.fetchedAt as firstSeenAt and proved it on the persisted
 * read path. It could not reach the live path, because NewsService returned
 * the provider objects and persistMany() returned void — so a `dataMode:
 * "live"` response had no row to read. That blocked any truthful
 * "first seen <time>" treatment on a normal Today card.
 *
 * R0.5 closes that without adding a query: persistMany() already received
 * every upserted row back from Prisma and discarded it. It now returns the
 * committed fetchedAt per URL, and this file proves NewsService merges it
 * onto the live response correctly and — more importantly — proves the
 * things it must NEVER do:
 *
 *   - never invent a value when the database recorded none;
 *   - never substitute publishedAt, the current time, or a provider time;
 *   - never reorder, drop, add or otherwise disturb the feed;
 *   - never change what dataMode claims;
 *   - never disturb the language-constrained or cached fallback paths.
 *
 * Companion files: article-persistence.service.spec.ts proves the repository
 * side of the same contract; news.service.first-seen-at.spec.ts proves the
 * cached path and the absence rules.
 */

const LIVE_URL = 'https://example.com/live';
const SECOND_URL = 'https://example.com/live-2';

/** Deliberately far from publishedAt AND from "now", so neither can pass for it. */
const OBSERVED_AT = '2026-08-07T10:05:00.000Z';
const SECOND_OBSERVED_AT = '2026-08-06T09:15:00.000Z';
const PUBLISHED_AT = '2026-08-07T10:00:00.000Z';

function makeArticle(overrides: Partial<NewsArticle> = {}): NewsArticle {
  return {
    id: 'live-1',
    title: 'Live headline',
    summary: 'Live summary',
    url: LIVE_URL,
    sourceId: 'live-provider',
    sourceName: 'Live Provider',
    category: 'world',
    sourcesCount: 1,
    publishedAt: PUBLISHED_AT,
    ...overrides,
  };
}

class LiveProvider implements NewsProvider {
  readonly id: string = 'live-provider';
  readonly displayName = 'Live Provider';
  readonly isMock: boolean = false;

  constructor(private readonly articles: NewsArticle[] = [makeArticle()]) {}

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
      checkedAt: PUBLISHED_AT,
    };
  }
}

class EmptyLiveProvider extends LiveProvider {
  readonly id: string = 'empty-live-provider';

  async search(): Promise<NewsArticle[]> {
    return [];
  }

  async topHeadlines(): Promise<NewsArticle[]> {
    return [];
  }

  async category(): Promise<NewsArticle[]> {
    return [];
  }
}

interface Persistence {
  persistMany: jest.Mock;
  findRecent: jest.Mock;
  findById: jest.Mock;
}

function makePersistence(observed: Array<[string, string]> = []): Persistence {
  return {
    persistMany: jest.fn().mockResolvedValue(new Map<string, string>(observed)),
    findRecent: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue(null),
  };
}

async function buildService(
  providers: NewsProvider[],
  persistence: Persistence,
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

describe('R0.5 — the live path carries the database first-seen value', () => {
  it('topHeadlines annotates a live article from the persisted observation', async () => {
    const persistence = makePersistence([[LIVE_URL, OBSERVED_AT]]);
    const service = await buildService([new LiveProvider()], persistence);

    const response = await service.topHeadlines();

    expect(response.dataMode).toBe('live');
    expect(response.articles[0].firstSeenAt).toBe(OBSERVED_AT);
  });

  it('search annotates a live article from the persisted observation', async () => {
    const persistence = makePersistence([[LIVE_URL, OBSERVED_AT]]);
    const service = await buildService([new LiveProvider()], persistence);

    const response = await service.search('anything');

    expect(response.dataMode).toBe('live');
    expect(response.articles[0].firstSeenAt).toBe(OBSERVED_AT);
  });

  it('byCategory annotates a live article from the persisted observation', async () => {
    const persistence = makePersistence([[LIVE_URL, OBSERVED_AT]]);
    const service = await buildService([new LiveProvider()], persistence);

    const response = await service.byCategory('world');

    expect(response.dataMode).toBe('live');
    expect(response.articles[0].firstSeenAt).toBe(OBSERVED_AT);
  });

  it('annotates each article from its OWN url, not from a shared value', async () => {
    const persistence = makePersistence([
      [LIVE_URL, OBSERVED_AT],
      [SECOND_URL, SECOND_OBSERVED_AT],
    ]);
    const service = await buildService(
      [
        new LiveProvider([
          makeArticle(),
          makeArticle({ id: 'live-2', url: SECOND_URL, title: 'Second headline' }),
        ]),
      ],
      persistence,
    );

    const response = await service.topHeadlines();

    expect(response.articles[0].firstSeenAt).toBe(OBSERVED_AT);
    expect(response.articles[1].firstSeenAt).toBe(SECOND_OBSERVED_AT);
  });

  it('leaves an article untouched when its url was not observed, while annotating the ones that were', async () => {
    // The partial case: one article recorded, one not. A merge keyed by index
    // rather than url would put the wrong value on the wrong card here.
    const persistence = makePersistence([[SECOND_URL, SECOND_OBSERVED_AT]]);
    const service = await buildService(
      [
        new LiveProvider([
          makeArticle(),
          makeArticle({ id: 'live-2', url: SECOND_URL, title: 'Second headline' }),
        ]),
      ],
      persistence,
    );

    const response = await service.topHeadlines();

    expect(response.articles[0].url).toBe(LIVE_URL);
    expect(response.articles[0].firstSeenAt).toBeUndefined();

    expect(response.articles[1].url).toBe(SECOND_URL);
    expect(response.articles[1].firstSeenAt).toBe(SECOND_OBSERVED_AT);
  });

  it('matches on url even when the article id does not correspond to any stored row', async () => {
    // Cross-provider reality: two providers carry one story, the stored row
    // keeps whichever id was inserted first, so the second provider's article
    // has an id matching no row. Keying on url is what makes this work.
    const persistence = makePersistence([[LIVE_URL, OBSERVED_AT]]);
    const service = await buildService(
      [new LiveProvider([makeArticle({ id: 'gdelt-999-not-in-database' })])],
      persistence,
    );

    const response = await service.topHeadlines();

    expect(response.articles[0].id).toBe('gdelt-999-not-in-database');
    expect(response.articles[0].firstSeenAt).toBe(OBSERVED_AT);
  });
});

describe('R0.5 — the merge never substitutes a value', () => {
  it('the merged value is NEVER publishedAt', async () => {
    const persistence = makePersistence([[LIVE_URL, OBSERVED_AT]]);
    const service = await buildService([new LiveProvider()], persistence);

    const article = (await service.topHeadlines()).articles[0];

    expect(article.publishedAt).toBe(PUBLISHED_AT);
    expect(article.firstSeenAt).toBe(OBSERVED_AT);
    expect(article.firstSeenAt).not.toBe(article.publishedAt);
  });

  it('the merged value is NEVER minted during the call, and is not generatedAt', async () => {
    const persistence = makePersistence([[LIVE_URL, OBSERVED_AT]]);
    const service = await buildService([new LiveProvider()], persistence);

    const before = Date.now();
    const response = await service.topHeadlines();
    const after = Date.now();

    const firstSeen = Date.parse(response.articles[0].firstSeenAt as string);

    // generatedAt IS a response-assembly time and must land in the window.
    const generatedAt = Date.parse(response.generatedAt);
    expect(generatedAt).toBeGreaterThanOrEqual(before);
    expect(generatedAt).toBeLessThanOrEqual(after);

    // firstSeenAt must not — it is historical, and comes from the database.
    expect(firstSeen).toBeLessThan(before);
    expect(response.articles[0].firstSeenAt).not.toBe(response.generatedAt);
  });

  it('a persistence failure (no observations) leaves the response successful and the field absent', async () => {
    const persistence = makePersistence([]);
    const service = await buildService([new LiveProvider()], persistence);

    const response = await service.topHeadlines();

    expect(response.dataMode).toBe('live');
    expect(response.articles).toHaveLength(1);
    expect(response.articles[0].title).toBe('Live headline');
    expect(response.articles[0].firstSeenAt).toBeUndefined();
    const [live] = response.articles;
    expect(Object.prototype.hasOwnProperty.call(live, 'firstSeenAt')).toBe(false);
  });

  it('an observation for an unrelated url is ignored rather than applied to whatever is present', async () => {
    const persistence = makePersistence([['https://example.com/some-other-story', OBSERVED_AT]]);
    const service = await buildService([new LiveProvider()], persistence);

    const response = await service.topHeadlines();

    expect(response.articles[0].firstSeenAt).toBeUndefined();
  });
});

describe('R0.5 — the merge disturbs nothing else', () => {
  it('preserves article count and order exactly', async () => {
    const articles = [
      makeArticle({ id: 'live-1', url: LIVE_URL, publishedAt: '2026-08-07T10:00:00.000Z' }),
      makeArticle({ id: 'live-2', url: SECOND_URL, publishedAt: '2026-08-07T09:00:00.000Z' }),
      makeArticle({
        id: 'live-3',
        url: 'https://example.com/live-3',
        publishedAt: '2026-08-07T08:00:00.000Z',
      }),
    ];

    const withoutObservations = makePersistence([]);
    const baseline = await buildService([new LiveProvider(articles)], withoutObservations);
    const before = await baseline.topHeadlines();

    const withObservations = makePersistence([[SECOND_URL, SECOND_OBSERVED_AT]]);
    const annotated = await buildService([new LiveProvider(articles)], withObservations);
    const after = await annotated.topHeadlines();

    expect(after.articles).toHaveLength(before.articles.length);
    expect(after.articles.map((entry) => entry.id)).toEqual(
      before.articles.map((entry) => entry.id),
    );
    expect(after.totalResults).toBe(before.totalResults);
  });

  it('preserves every provider-supplied field on an annotated article', async () => {
    const persistence = makePersistence([[LIVE_URL, OBSERVED_AT]]);
    const source = makeArticle({
      imageUrl: 'https://example.com/image.jpg',
      confidence: 87,
      sourcesCount: 4,
    });
    const service = await buildService([new LiveProvider([source])], persistence);

    const article = (await service.topHeadlines()).articles[0];

    // firstSeenAt is ADDED. Nothing is replaced.
    expect(article).toEqual({ ...source, firstSeenAt: OBSERVED_AT });
  });

  it('preserves the response envelope — R0.5 adds no response-level field', async () => {
    const persistence = makePersistence([[LIVE_URL, OBSERVED_AT]]);
    const service = await buildService([new LiveProvider()], persistence);

    const response = await service.topHeadlines();

    expect(Object.keys(response).sort()).toEqual(
      ['articles', 'dataMode', 'fallbackReason', 'generatedAt', 'providers', 'totalResults'].sort(),
    );
    expect(response.providers).toEqual(['live-provider']);
    expect(response.dataMode).toBe('live');
  });

  it('does not mutate the array handed to persistMany', async () => {
    const persistence = makePersistence([[LIVE_URL, OBSERVED_AT]]);
    const service = await buildService([new LiveProvider()], persistence);

    const response = await service.topHeadlines();

    const persisted = persistence.persistMany.mock.calls[0][0] as NewsArticle[];

    // The persisted objects are the pre-merge ones and stay that way; the
    // annotated response is a new array of new objects.
    expect(persisted[0].firstSeenAt).toBeUndefined();
    expect(response.articles[0].firstSeenAt).toBe(OBSERVED_AT);
    expect(response.articles[0]).not.toBe(persisted[0]);
  });
});

describe('R0.5 — untouched paths stay untouched', () => {
  it('a language-constrained request that returns nothing still skips the stored pool (Milestone #48)', async () => {
    const persistence = makePersistence([[LIVE_URL, OBSERVED_AT]]);
    const service = await buildService([new EmptyLiveProvider()], persistence);

    const response = await service.topHeadlines(10, { lang: 'pl' });

    // The #48 guard lives in the zero-results branch, which R0.5 never
    // touched: no cached read, and no persist to annotate from.
    expect(persistence.findRecent).not.toHaveBeenCalled();
    expect(persistence.persistMany).not.toHaveBeenCalled();
    expect(response.articles).toHaveLength(0);
  });

  it('a language-constrained request WITH live results is annotated normally', async () => {
    const persistence = makePersistence([[LIVE_URL, OBSERVED_AT]]);
    const service = await buildService([new LiveProvider()], persistence);

    const response = await service.topHeadlines(10, { lang: 'pl' });

    expect(response.dataMode).toBe('live');
    expect(response.articles[0].firstSeenAt).toBe(OBSERVED_AT);
    // Still no stored-pool read on a language-constrained path.
    expect(persistence.findRecent).not.toHaveBeenCalled();
  });

  it('the cached fallback still gets firstSeenAt from storage, not from the merge', async () => {
    const persistence = makePersistence([[LIVE_URL, OBSERVED_AT]]);
    persistence.findRecent.mockResolvedValue([
      makeArticle({
        id: 'stored-1',
        url: 'https://example.com/stored',
        firstSeenAt: SECOND_OBSERVED_AT,
      }),
    ]);

    const service = await buildService([new EmptyLiveProvider()], persistence);
    const response = await service.topHeadlines();

    expect(response.dataMode).toBe('cached');
    expect(persistence.persistMany).not.toHaveBeenCalled();
    expect(response.articles[0].firstSeenAt).toBe(SECOND_OBSERVED_AT);
  });

  it('country annotation and first-seen annotation compose without disturbing each other', async () => {
    const persistence = makePersistence([[LIVE_URL, OBSERVED_AT]]);
    const service = await buildService(
      [
        new LiveProvider([
          makeArticle({
            title: 'Poland announces new infrastructure programme',
            summary: 'Officials in Poland confirmed the plan on Tuesday.',
          }),
        ]),
      ],
      persistence,
    );

    const response = await service.topHeadlines();

    expect(response.articles).toHaveLength(1);
    expect(response.articles[0].firstSeenAt).toBe(OBSERVED_AT);
    expect(response.articles[0].countryCode).toBe('PL');
  });
});
