import { Test } from '@nestjs/testing';
import type { NewsArticle } from '@globalnews-ai/shared';
import { NewsService } from './news.service';
import type { NewsProvider, NewsProviderCapability } from './interfaces';
import {
  ALL_NEWS_PROVIDERS,
  FALLBACK_NEWS_PROVIDERS,
  NEWS_PROVIDERS,
} from './providers/provider.tokens';
import { ArticlePersistenceService } from './persistence/article-persistence.service';

/**
 * R4 GDELT — TIERED RETRIEVAL, AT THE SERVICE LEVEL.
 *
 * Before R4, NewsService called every active provider on every request.
 * With a second provider that would have meant issuing a GDELT request
 * alongside every healthy GNews response — cost and latency spent on a
 * second opinion nobody asked for, against an endpoint that asks for one
 * request every five seconds.
 *
 * The most important test in this file is D. B, C, E and F prove the
 * fallback FIRES; D proves it stays silent, and that is the guarantee the
 * whole tier exists to provide.
 */

function article(overrides: Partial<NewsArticle> & Pick<NewsArticle, 'id'>): NewsArticle {
  return {
    title: `Story ${overrides.id}`,
    summary: 'Summary',
    url: `https://primary.example/${overrides.id}`,
    sourceId: 'primary',
    sourceName: 'Primary Wire',
    category: 'world',
    sourcesCount: 1,
    publishedAt: '2026-08-26T09:00:00.000Z',
    publishedAtBasis: 'publisher' as const,
    ...overrides,
  };
}

interface StubOptions {
  readonly id: string;
  readonly articles?: NewsArticle[];
  readonly failWith?: Error;
  readonly capabilities?: readonly NewsProviderCapability[];
}

function stubProvider(options: StubOptions): NewsProvider & { calls: number } {
  const provider = {
    id: options.id,
    displayName: options.id,
    isMock: false,
    calls: 0,
    ...(options.capabilities === undefined ? {} : { capabilities: options.capabilities }),
    async search(): Promise<NewsArticle[]> {
      provider.calls += 1;
      if (options.failWith) throw options.failWith;
      return options.articles ?? [];
    },
    async topHeadlines(): Promise<NewsArticle[]> {
      provider.calls += 1;
      if (options.failWith) throw options.failWith;
      return options.articles ?? [];
    },
    async category(): Promise<NewsArticle[]> {
      provider.calls += 1;
      if (options.failWith) throw options.failWith;
      return options.articles ?? [];
    },
    async health() {
      return {
        providerId: options.id,
        displayName: options.id,
        status: 'ok' as const,
        checkedAt: '2026-08-26T09:00:00.000Z',
      };
    },
  };

  return provider as NewsProvider & { calls: number };
}

async function buildService(
  primaries: NewsProvider[],
  fallbacks: NewsProvider[],
): Promise<{
  service: NewsService;
  persistence: { persistMany: jest.Mock; findRecent: jest.Mock };
}> {
  const persistence = {
    persistMany: jest.fn().mockResolvedValue(new Map()),
    findRecent: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue(null),
  };

  const active = [...primaries, ...fallbacks];

  const moduleRef = await Test.createTestingModule({
    providers: [
      NewsService,
      { provide: NEWS_PROVIDERS, useValue: active },
      { provide: ALL_NEWS_PROVIDERS, useValue: active },
      { provide: FALLBACK_NEWS_PROVIDERS, useValue: fallbacks },
      { provide: ArticlePersistenceService, useValue: persistence },
    ],
  }).compile();

  return { service: moduleRef.get(NewsService), persistence };
}

describe('R4 GDELT — D: a healthy primary means the fallback is never called', () => {
  it('does not touch the fallback when the primary returns articles', async () => {
    const primary = stubProvider({ id: 'gnews', articles: [article({ id: 'p1' })] });
    const fallback = stubProvider({
      id: 'gdelt-doc',
      capabilities: ['search'],
      articles: [article({ id: 'f1', url: 'https://fallback.example/f1' })],
    });

    const { service } = await buildService([primary], [fallback]);

    const response = await service.search('anything');

    expect(primary.calls).toBe(1);
    expect(fallback.calls).toBe(0);
    expect(response.articles.map((a) => a.id)).toEqual(['p1']);
    expect(response.providers).toEqual(['gnews']);
  });

  it('holds even when the primary returns a SINGLE article — "some evidence" is enough', async () => {
    const primary = stubProvider({ id: 'gnews', articles: [article({ id: 'only' })] });
    const fallback = stubProvider({ id: 'gdelt-doc', capabilities: ['search'] });

    const { service } = await buildService([primary], [fallback]);

    await service.search('anything');

    expect(fallback.calls).toBe(0);
  });
});

describe('R4 GDELT — B and C: the fallback answers when the primary cannot', () => {
  it('B — a primary that is unreachable hands over to the fallback', async () => {
    const primary = stubProvider({ id: 'gnews', failWith: new Error('Failed to reach GNews.') });
    const fallback = stubProvider({
      id: 'gdelt-doc',
      capabilities: ['search'],
      articles: [article({ id: 'f1', url: 'https://fallback.example/f1' })],
    });

    const { service } = await buildService([primary], [fallback]);

    const response = await service.search('anything');

    expect(fallback.calls).toBe(1);
    expect(response.articles.map((a) => a.id)).toEqual(['f1']);
  });

  it('C — a quota-exhausted primary hands over, and the failure is STILL reported', async () => {
    const quotaError = Object.assign(new Error('allowance exhausted'), { kind: 'quota' });

    const primary = stubProvider({ id: 'gnews', failWith: quotaError });
    const fallback = stubProvider({
      id: 'gdelt-doc',
      capabilities: ['search'],
      articles: [article({ id: 'f1', url: 'https://fallback.example/f1' })],
    });

    const { service } = await buildService([primary], [fallback]);

    const response = await service.search('anything');

    expect(fallback.calls).toBe(1);
    expect(response.articles).toHaveLength(1);
    // The fallback rescuing the response must not erase the fact that the
    // primary broke: `providers` lists only who actually contributed.
    expect(response.providers).toEqual(['gdelt-doc']);
  });

  it('an EMPTY primary result also hands over — a healthy zero is still no evidence', async () => {
    const primary = stubProvider({ id: 'gnews', articles: [] });
    const fallback = stubProvider({
      id: 'gdelt-doc',
      capabilities: ['search'],
      articles: [article({ id: 'f1', url: 'https://fallback.example/f1' })],
    });

    const { service } = await buildService([primary], [fallback]);

    await service.search('anything');

    expect(fallback.calls).toBe(1);
  });

  it('both providers failing leaves the response unavailable rather than throwing', async () => {
    const primary = stubProvider({ id: 'gnews', failWith: new Error('down') });
    const fallback = stubProvider({
      id: 'gdelt-doc',
      capabilities: ['search'],
      failWith: new Error('also down'),
    });

    const { service } = await buildService([primary], [fallback]);

    const response = await service.search('anything');

    expect(response.articles).toEqual([]);
    expect(response.dataMode).toBe('unavailable');
    expect(response.fallbackReason).toBe('provider-error');
  });
});

describe('R4 GDELT — capability skipping: a skipped provider is NOT a failed provider', () => {
  it('a search-only provider is never asked for top headlines', async () => {
    const primary = stubProvider({ id: 'gnews', articles: [] });
    const fallback = stubProvider({ id: 'gdelt-doc', capabilities: ['search'] });

    const { service } = await buildService([primary], [fallback]);

    const response = await service.topHeadlines();

    expect(fallback.calls).toBe(0);
    // THE POINT: not called, and therefore not blamed. A skipped provider
    // must not be treated as one that broke.
    expect(response.fallbackReason).not.toBe('provider-error');
  });

  it('a skipped provider does not turn a clean empty result into a provider error', async () => {
    /*
     * The counter-case that gives the assertion above its teeth. Here the
     * PRIMARY genuinely fails, so the response IS unavailable and IS
     * blamed on a provider error — proving this response shape is
     * reachable, and therefore that its absence in the previous test is a
     * real signal rather than a state that never occurs.
     */
    const primary = stubProvider({ id: 'gnews', failWith: new Error('down') });
    const fallback = stubProvider({ id: 'gdelt-doc', capabilities: ['search'] });

    const { service } = await buildService([primary], [fallback]);

    const response = await service.topHeadlines();

    expect(fallback.calls).toBe(0);
    expect(response.fallbackReason).toBe('provider-error');
  });

  it('a search-only provider is never asked for a category', async () => {
    const primary = stubProvider({ id: 'gnews', articles: [] });
    const fallback = stubProvider({ id: 'gdelt-doc', capabilities: ['search'] });

    const { service } = await buildService([primary], [fallback]);

    await service.byCategory('world');

    expect(fallback.calls).toBe(0);
  });

  it('a provider that declares nothing keeps answering everything, exactly as before', async () => {
    const primary = stubProvider({ id: 'gnews', articles: [article({ id: 'p1' })] });

    const { service } = await buildService([primary], []);

    await service.topHeadlines();
    await service.byCategory('world');

    expect(primary.calls).toBe(2);
  });
});

/**
 * R4 GDELT — TEST H HAS MOVED, AND WHY.
 *
 * A version of test H lived here and was WRONG. It claimed to prove that
 * "when both providers DO contribute, the URL rung collapses them to one"
 * while building the service with a single provider, so both articles came
 * from ONE provider and were collapsed by the per-provider pass. The
 * cross-provider seam — which only runs when more than one provider
 * contributed — was never entered.
 *
 * Rewriting it properly found a real defect in that seam. Both the
 * corrected regression and the fix live in
 * `news.service.cross-provider.spec.ts`, at the level where the question
 * actually exists. What stays here is the TIER behaviour, which is a
 * different property and is still proved above.
 *
 * Rung 3's basis guard also stays here, because it is a property of the
 * per-provider ladder rather than of the cross-provider seam.
 */
describe('R4 GDELT — T: mixed timestamp bases can never corroborate on time', () => {
  it('a publisher timestamp and an observed timestamp never merge on the window', async () => {
    /*
     * Same exact headline, same host, timestamps 10 minutes apart — every
     * condition rung 3 needs EXCEPT a shared basis. Different paths, so the
     * URL rung cannot collapse them either and rung 3 is genuinely the only
     * thing that could.
     */
    const primary = stubProvider({
      id: 'gnews',
      articles: [
        article({
          id: 'pub-1',
          title: 'Identical headline across two bases',
          url: 'https://outlet.example/publisher-copy',
          imageUrl: 'https://cdn.outlet.example/shared.jpg',
          publishedAt: '2026-08-26T09:00:00.000Z',
          publishedAtBasis: 'publisher',
        }),
        article({
          id: 'obs-1',
          title: 'Identical headline across two bases',
          url: 'https://outlet.example/observed-copy',
          imageUrl: 'https://cdn.outlet.example/shared.jpg',
          publishedAt: '2026-08-26T09:10:00.000Z',
          publishedAtBasis: 'observed',
        }),
      ],
    });

    const { service } = await buildService([primary], []);

    const response = await service.search('identical headline');

    expect(response.articles.map((a) => a.id).sort()).toEqual(['obs-1', 'pub-1']);
  });

  it('two records that DO share a proven basis still collapse, so the guard did not disable rung 3', async () => {
    const primary = stubProvider({
      id: 'gnews',
      articles: [
        article({
          id: 'pub-1',
          title: 'Identical headline, one basis',
          url: 'https://outlet.example/copy-a',
          imageUrl: 'https://cdn.outlet.example/shared.jpg',
          publishedAt: '2026-08-26T09:00:00.000Z',
          publishedAtBasis: 'publisher',
        }),
        article({
          id: 'pub-2',
          title: 'Identical headline, one basis',
          url: 'https://outlet.example/copy-b',
          imageUrl: 'https://cdn.outlet.example/shared.jpg',
          publishedAt: '2026-08-26T09:10:00.000Z',
          publishedAtBasis: 'publisher',
        }),
      ],
    });

    const { service } = await buildService([primary], []);

    const response = await service.search('identical headline');

    expect(response.articles).toHaveLength(1);
  });
});

describe('R4 GDELT — an observed timestamp reaches the reader AND the store', () => {
  it('both bases are served, and both are handed to persistence', async () => {
    /*
     * Before the CTO approved the basis column, persistence REFUSED
     * observed-basis articles because the table could not describe them.
     * With the column in place the refusal is gone: both are persisted, and
     * the basis travels with each one. The round-trip proof lives in
     * `persistence/article-persistence.service.spec.ts` (AA-AD) and
     * `persistence/published-at-basis.util.spec.ts` (AE); what this test
     * owns is that NewsService hands the whole set over rather than
     * filtering it on the way.
     */
    const primary = stubProvider({
      id: 'gnews',
      articles: [
        article({ id: 'pub-1', publishedAtBasis: 'publisher' }),
        article({
          id: 'obs-1',
          url: 'https://outlet.example/observed',
          publishedAtBasis: 'observed',
        }),
      ],
    });

    const { service, persistence } = await buildService([primary], []);

    const response = await service.search('anything');

    expect(response.articles).toHaveLength(2);
    expect(response.articles.map((a) => a.publishedAtBasis).sort()).toEqual([
      'observed',
      'publisher',
    ]);

    const persisted = persistence.persistMany.mock.calls[0][0] as NewsArticle[];
    expect(persisted.map((a) => a.id).sort()).toEqual(['obs-1', 'pub-1']);
  });
});

describe('R4 GDELT — N: the mock wire is untouched', () => {
  it('a mock-only deployment has no fallback tier and behaves exactly as before', async () => {
    const mock = {
      ...stubProvider({ id: 'mock-wire', articles: [article({ id: 'm1' })] }),
      isMock: true,
    } as unknown as NewsProvider & { calls: number };

    const { service, persistence } = await buildService([mock], []);

    const response = await service.search('anything');

    expect(response.dataMode).toBe('mock');
    // Mock articles are never persisted as real evidence — unchanged rule.
    expect(persistence.persistMany).not.toHaveBeenCalled();
  });
});
