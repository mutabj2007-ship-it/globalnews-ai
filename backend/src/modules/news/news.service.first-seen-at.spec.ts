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
 * R0 — firstSeenAt through the READ PATH, at the NewsService boundary.
 *
 * article-persistence.service.spec.ts proves the mappers read
 * Article.fetchedAt correctly. This file proves the distinction that
 * actually matters to an API consumer:
 *
 *   PROVIDER RESULT   — built in memory from a provider response. Never
 *                       persisted at the moment the response is assembled,
 *                       so it has no database row and no firstSeenAt.
 *   PERSISTED RESULT  — read back from storage, so it carries the
 *                       immutable first-observation timestamp.
 *
 * R0.5 SUPERSESSION. When this file was written, NewsService returned the
 * provider objects untouched and persistMany() returned void, so a `live`
 * response genuinely could not carry firstSeenAt. R0.5 changed that: the
 * awaited persistMany() now hands back the committed fetchedAt per URL and
 * the live response is annotated from it.
 *
 * The four tests in the "PROVIDER results" describe below were rewritten
 * rather than deleted, because they would otherwise have kept PASSING while
 * asserting something no longer true — their local persistence mock resolves
 * with no observations, which short-circuits the merge. A test that passes
 * for the wrong reason is worse than one that fails, because nobody reads it.
 * What survives from them, and is still worth pinning, is the honest half:
 * absence is never filled in, and the persist still happens after the
 * response is built.
 *
 * The live MERGE itself is proved in news.service.live-first-seen.spec.ts.
 */

const FIRST_SEEN = '2026-08-07T10:05:00.000Z';

function makeArticle(overrides: Partial<NewsArticle> = {}): NewsArticle {
  return {
    id: 'article-1',
    title: 'Stored headline',
    summary: 'Stored summary',
    url: 'https://example.com/stored',
    sourceId: 'stored-provider',
    sourceName: 'Stored Provider',
    category: 'world',
    sourcesCount: 1,
    publishedAt: '2026-08-07T10:00:00.000Z',
    ...overrides,
  };
}

/** A real provider result: in memory, never persisted, so no firstSeenAt. */
class ProviderOnlyProvider implements NewsProvider {
  readonly id: string = 'provider-only';
  readonly displayName = 'Provider Only';
  // Widened from the literal `false` so a subclass can flip it — same reason
  // `id` is widened above: TypeScript narrows a class field initialiser to a
  // literal type, which would make any override unassignable.
  readonly isMock: boolean = false;

  async search(): Promise<NewsArticle[]> {
    return [makeArticle({ id: 'live-1', url: 'https://example.com/live' })];
  }

  async topHeadlines(): Promise<NewsArticle[]> {
    return [makeArticle({ id: 'live-1', url: 'https://example.com/live' })];
  }

  async category(): Promise<NewsArticle[]> {
    return [makeArticle({ id: 'live-1', url: 'https://example.com/live' })];
  }

  async health(): Promise<ProviderHealthStatus> {
    return {
      providerId: this.id,
      displayName: this.displayName,
      status: 'ok',
      checkedAt: '2026-08-07T10:00:00.000Z',
    };
  }
}

/** A real provider that answers with nothing, forcing the cached path. */
class EmptyRealProvider extends ProviderOnlyProvider {
  readonly id: string = 'empty-real';

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

/** A mock/demo provider: never persisted as real evidence, so never observed. */
class MockOnlyProvider extends ProviderOnlyProvider {
  readonly id: string = 'mock-only';
  readonly isMock = true;
}

interface Persistence {
  persistMany: jest.Mock;
  findRecent: jest.Mock;
  findById: jest.Mock;
}

function makePersistence(): Persistence {
  return {
    // R0.5 — persistMany resolves with a ReadonlyMap<url, ISO fetchedAt>.
    // An EMPTY map is the honest "nothing was recorded" answer and is what
    // every test in this file wants: it is the shape produced when
    // persistence fails or writes nothing.
    persistMany: jest.fn().mockResolvedValue(new Map<string, string>()),
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

describe('R0 — PERSISTED read path carries firstSeenAt', () => {
  it('a cached topHeadlines response carries firstSeenAt from storage', async () => {
    const persistence = makePersistence();
    persistence.findRecent.mockResolvedValue([makeArticle({ firstSeenAt: FIRST_SEEN })]);

    const service = await buildService([new EmptyRealProvider()], persistence);
    const response = await service.topHeadlines();

    expect(response.dataMode).toBe('cached');
    expect(response.articles[0].firstSeenAt).toBe(FIRST_SEEN);
  });

  it('a cached search response carries firstSeenAt from storage', async () => {
    const persistence = makePersistence();
    persistence.findRecent.mockResolvedValue([makeArticle({ firstSeenAt: FIRST_SEEN })]);

    const service = await buildService([new EmptyRealProvider()], persistence);
    const response = await service.search('anything');

    expect(response.dataMode).toBe('cached');
    expect(response.articles[0].firstSeenAt).toBe(FIRST_SEEN);
  });

  it('a cached byCategory response carries firstSeenAt from storage', async () => {
    const persistence = makePersistence();
    persistence.findRecent.mockResolvedValue([makeArticle({ firstSeenAt: FIRST_SEEN })]);

    const service = await buildService([new EmptyRealProvider()], persistence);
    const response = await service.byCategory('world');

    expect(response.dataMode).toBe('cached');
    expect(response.articles[0].firstSeenAt).toBe(FIRST_SEEN);
  });

  it('findArticleById passes firstSeenAt straight through', async () => {
    const persistence = makePersistence();
    persistence.findById.mockResolvedValue(makeArticle({ firstSeenAt: FIRST_SEEN }));

    const service = await buildService([new EmptyRealProvider()], persistence);

    expect((await service.findArticleById('article-1'))?.firstSeenAt).toBe(FIRST_SEEN);
  });

  it('survives country annotation, which rebuilds the article object by spread', async () => {
    const persistence = makePersistence();
    persistence.findRecent.mockResolvedValue([
      makeArticle({
        firstSeenAt: FIRST_SEEN,
        title: 'Rwanda announces new infrastructure programme',
        summary: 'Officials in Rwanda confirmed the plan.',
      }),
    ]);

    const service = await buildService([new EmptyRealProvider()], persistence);
    const response = await service.topHeadlines();

    expect(response.articles[0].firstSeenAt).toBe(FIRST_SEEN);
  });
});

describe('R0.5 — a live response reports ONLY what the database actually recorded', () => {
  // Every test here uses a persistence mock that records NOTHING — the shape
  // produced when the database is unreachable, when the batch wrote nothing,
  // or when a URL simply is not in the returned map. That is deliberately the
  // hard case: it is where a wrong implementation would be tempted to invent
  // a value.
  //
  // R0.5 SUPERSESSION: before R0.5 this describe asserted that a live
  // response can never carry firstSeenAt at all. That claim is now false —
  // see news.service.live-first-seen.spec.ts for the populated case. What
  // remains true, and is what these tests now pin, is that NOTHING is ever
  // substituted when there is no recorded observation.

  it('omits firstSeenAt when the persist recorded no observation for that url', async () => {
    const persistence = makePersistence();
    const service = await buildService([new ProviderOnlyProvider()], persistence);

    const response = await service.topHeadlines();

    expect(response.dataMode).toBe('live');
    expect(response.articles[0].firstSeenAt).toBeUndefined();
    // The article is still delivered in full. An unrecorded observation costs
    // the reader a badge, never their news.
    expect(response.articles[0].title).toBe('Stored headline');
    expect(response.totalResults).toBe(1);
  });

  it('absence is NEVER filled in with publishedAt', async () => {
    const persistence = makePersistence();
    const service = await buildService([new ProviderOnlyProvider()], persistence);

    const article = (await service.topHeadlines()).articles[0];

    expect(article.publishedAt).toBe('2026-08-07T10:00:00.000Z');
    expect(article.firstSeenAt).toBeUndefined();
  });

  it('absence is NEVER filled in with the current time', async () => {
    const persistence = makePersistence();
    const service = await buildService([new ProviderOnlyProvider()], persistence);

    const before = Date.now();
    const article = (await service.topHeadlines()).articles[0];

    expect(article.firstSeenAt).toBeUndefined();
    // Nothing in the response should hold a timestamp minted during this call
    // other than generatedAt, which is explicitly a response-assembly time.
    const response = await service.topHeadlines();
    const assembledAt = new Date(response.generatedAt).getTime();
    expect(assembledAt).toBeGreaterThanOrEqual(before);
    expect(response.articles[0].firstSeenAt).toBeUndefined();
  });

  it('absence is NEVER filled in with a synthetic "unknown" marker', async () => {
    const persistence = makePersistence();
    const service = await buildService([new ProviderOnlyProvider()], persistence);

    const article = (await service.topHeadlines()).articles[0];

    // Not present at all — not an empty string, not null, not a placeholder.
    expect(article.firstSeenAt).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(article, 'firstSeenAt')).toBe(false);
  });

  it('a persistence FAILURE leaves the response successful and the field absent', async () => {
    const persistence = makePersistence();
    // What ArticlePersistenceService answers when the transaction rejects: it
    // swallows the error and reports no observations.
    persistence.persistMany.mockResolvedValue(new Map<string, string>());

    const service = await buildService([new ProviderOnlyProvider()], persistence);
    const response = await service.topHeadlines();

    expect(response.dataMode).toBe('live');
    expect(response.articles).toHaveLength(1);
    expect(response.articles[0].firstSeenAt).toBeUndefined();
  });

  it('persistence still happens AFTER the response is built, and is still given the pre-merge articles — pinned so the ordering is not changed unknowingly', async () => {
    const persistence = makePersistence();
    const service = await buildService([new ProviderOnlyProvider()], persistence);

    const response = await service.topHeadlines();

    expect(persistence.persistMany).toHaveBeenCalledTimes(1);

    // R0.5 did not move the persist. What is handed to it is still the
    // response's own article array, built by buildResponse() before any
    // annotation — the merge reads the result, it does not feed it.
    const persisted = persistence.persistMany.mock.calls[0][0];
    expect(persisted).toHaveLength(1);
    expect(persisted[0].url).toBe('https://example.com/live');
    expect(persisted[0].firstSeenAt).toBeUndefined();

    // And with no observations returned, the response array is unchanged.
    expect(response.articles).toEqual(persisted);
  });

  it('a mock provider never persists, and therefore never reports a first observation', async () => {
    const persistence = makePersistence();
    const service = await buildService([new MockOnlyProvider()], persistence);

    const response = await service.topHeadlines();

    expect(response.dataMode).toBe('mock');
    expect(persistence.persistMany).not.toHaveBeenCalled();
    expect(response.articles[0].firstSeenAt).toBeUndefined();
  });
});

describe('R0 — backward compatibility', () => {
  it('an article with no firstSeenAt is still a valid NewsArticle and flows through untouched', async () => {
    const persistence = makePersistence();
    persistence.findRecent.mockResolvedValue([makeArticle()]);

    const service = await buildService([new EmptyRealProvider()], persistence);
    const response = await service.topHeadlines();

    expect(response.articles).toHaveLength(1);
    expect(response.articles[0].firstSeenAt).toBeUndefined();
    expect(response.articles[0].title).toBe('Stored headline');
  });

  it('every pre-R0 field is unchanged on a cached response', async () => {
    const persistence = makePersistence();
    persistence.findRecent.mockResolvedValue([makeArticle({ firstSeenAt: FIRST_SEEN })]);

    const service = await buildService([new EmptyRealProvider()], persistence);
    const article = (await service.topHeadlines()).articles[0];

    expect(article.id).toBe('article-1');
    expect(article.url).toBe('https://example.com/stored');
    expect(article.publishedAt).toBe('2026-08-07T10:00:00.000Z');
    expect(article.sourcesCount).toBe(1);
  });

  it('the response envelope gained no new field — R0 is article-level only', async () => {
    const persistence = makePersistence();
    persistence.findRecent.mockResolvedValue([makeArticle({ firstSeenAt: FIRST_SEEN })]);

    const service = await buildService([new EmptyRealProvider()], persistence);
    const response = await service.topHeadlines();

    expect(Object.keys(response).sort()).toEqual(
      ['articles', 'dataMode', 'fallbackReason', 'generatedAt', 'providers', 'totalResults'].sort(),
    );
  });
});

describe('R0 — identity pairing', () => {
  it('url is present alongside firstSeenAt on every persisted article, so Return logic never needs the hash-derived id', async () => {
    const persistence = makePersistence();
    persistence.findRecent.mockResolvedValue([
      makeArticle({ firstSeenAt: FIRST_SEEN }),
      makeArticle({ id: 'article-2', url: 'https://example.com/second', firstSeenAt: FIRST_SEEN }),
    ]);

    const service = await buildService([new EmptyRealProvider()], persistence);
    const response = await service.topHeadlines();

    for (const article of response.articles) {
      expect(typeof article.url).toBe('string');
      expect(article.url.length).toBeGreaterThan(0);
      expect(article.firstSeenAt).toBe(FIRST_SEEN);
    }
  });
});
