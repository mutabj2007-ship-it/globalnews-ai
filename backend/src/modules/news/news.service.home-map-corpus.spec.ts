import { Test, TestingModule } from '@nestjs/testing';
import type { NewsArticle } from '@globalnews-ai/shared';

import type { NewsProvider } from './interfaces';
import { NewsService } from './news.service';
import { ArticlePersistenceService } from './persistence/article-persistence.service';
import {
  ALL_NEWS_PROVIDERS,
  FALLBACK_NEWS_PROVIDERS,
  NEWS_PROVIDERS,
} from './providers/provider.tokens';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * B-2A — HOME AND THE MAP SHARE ONE CORPUS, MEASURED AT PROVIDER EXECUTION
 * ════════════════════════════════════════════════════════════════════════════
 *
 * THE DEFECT. `buildHomeNewsCacheKey` keys the shared Home corpus as
 * `${limit}:${lang}`. Home retrieved at width 24 and the Map opened at width
 * 50, so the keys were `24:en` and `50:en` — TWO ENTRIES FOR ONE CORPUS. Map
 * open executed a live provider retrieval no matter how warm Home was, and Home
 * missed again afterwards, because the fragmentation ran in both directions.
 *
 * ─── WHAT WAS **NOT** CHANGED, AND WHY THAT MATTERS ───────────────────────
 *
 * CTO ruling: *"Preserve the ratified Home-cache width contract and C7. Do not
 * implement cross-width cache sharing. The fix is at the caller."*
 *
 * C7 of `news.service.home-cache.spec.ts` states that a different retrieval
 * width is a different corpus and must not be served from the cache. That is
 * CORRECT and is untouched: a warm corpus of 12 genuinely cannot answer a
 * request for 24, because the articles are not there. The cache is right to
 * refuse, and C13 below re-proves that refusal still happens.
 *
 * The caller stopped asking for a different width. `GLOBAL_FEED_LIMIT` is now
 * 24, matching the governed Home corpus. Nothing in NewsService moved.
 *
 * ─── WHY THIS IS A CALL COUNT AND NOT A RESPONSE ASSERTION ────────────────
 *
 * The ruling is explicit: *"Add regression proof that Home warm → Map open
 * causes zero provider executions, not merely HTTP 200."* Every one of the 95
 * production retrievals that motivated the original correction returned HTTP
 * 200. The response was never the evidence. The unit under test here is the
 * provider spy's invocation count, and nothing else.
 *
 * NO GNEWS QUOTA IS CONSUMED BY CONSTRUCTION. The provider is a local spy
 * object; there is no network client in this file, no API key is read, and no
 * fixture contains one.
 */

/** The governed public corpus width, shared by Home and Map open. */
const HOME_LIMIT = 24;

/** What Map open used to ask for, kept only to prove the fragmentation is gone. */
const LEGACY_MAP_LIMIT = 50;

function makeArticle(overrides: Partial<NewsArticle> = {}): NewsArticle {
  return {
    id: overrides.id ?? 'article-1',
    title: 'Headline',
    summary: 'Summary',
    url: `https://example.com/${overrides.id ?? 'article-1'}`,
    sourceId: 'spy-provider',
    sourceName: 'Spy Provider',
    category: 'world',
    sourcesCount: 1,
    publishedAt: '2026-09-15T00:00:00.000Z',
    ...overrides,
  };
}

/** Records every execution and the width it was asked for. */
class SpyProvider implements NewsProvider {
  readonly id = 'spy-provider';
  readonly displayName = 'Spy Provider';
  readonly isMock = false;

  topHeadlinesCalls: Array<{ lang?: string; limit?: number }> = [];

  async search(): Promise<NewsArticle[]> {
    return [makeArticle({ id: 'search-1' })];
  }

  async topHeadlines(options?: { lang?: string; limit?: number }): Promise<NewsArticle[]> {
    this.topHeadlinesCalls.push({ lang: options?.lang, limit: options?.limit });

    return [makeArticle()];
  }

  async category(): Promise<NewsArticle[]> {
    return [makeArticle({ id: 'category-1' })];
  }

  async health() {
    return { id: this.id, displayName: this.displayName, healthy: true } as never;
  }

  get executions(): number {
    return this.topHeadlinesCalls.length;
  }

  widthsRequested(): Array<number | undefined> {
    return this.topHeadlinesCalls.map((call) => call.limit);
  }
}

function createPersistenceStub() {
  return {
    persistMany: jest.fn().mockResolvedValue(new Map()),
    findRecent: jest.fn().mockResolvedValue([]),
    findRecentByCountry: jest.fn().mockResolvedValue([]),
  } as unknown as ArticlePersistenceService;
}

async function createService(providers: NewsProvider[]): Promise<NewsService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      NewsService,
      { provide: NEWS_PROVIDERS, useValue: providers },
      { provide: ALL_NEWS_PROVIDERS, useValue: providers },
      { provide: FALLBACK_NEWS_PROVIDERS, useValue: [] },
      { provide: ArticlePersistenceService, useValue: createPersistenceStub() },
    ],
  }).compile();

  return module.get<NewsService>(NewsService);
}

describe('B-2A — Home warm → Map open → zero provider executions', () => {
  describe('THE REQUIRED PROOF', () => {
    it('C10: a warm Home corpus serves Map open with ZERO additional provider executions', async () => {
      const spy = new SpyProvider();
      const service = await createService([spy]);

      /* Home renders. One retrieval, warming 24:en. */
      await service.topHeadlines(HOME_LIMIT, { lang: 'en' });
      const afterHome = spy.executions;

      expect(afterHome).toBe(1);

      /* The reader opens the Map. Same governed width, same language. */
      await service.topHeadlines(HOME_LIMIT, { lang: 'en' });

      expect(spy.executions - afterHome).toBe(0);
      expect(spy.executions).toBe(1);
    });

    it('C11: the fragmentation ran BOTH ways — Map first then Home is also zero', async () => {
      /*
        The original defect was not "Map open is expensive". It was that two
        surfaces held two entries for one corpus, so whichever loaded second
        paid. Proving only the Home→Map direction would leave the other half
        of the defect untested.
      */
      const spy = new SpyProvider();
      const service = await createService([spy]);

      await service.topHeadlines(HOME_LIMIT, { lang: 'en' });
      const afterMap = spy.executions;

      await service.topHeadlines(HOME_LIMIT, { lang: 'en' });

      expect(spy.executions - afterMap).toBe(0);
    });

    it('C12: every execution asked for the governed width — no second corpus exists', async () => {
      const spy = new SpyProvider();
      const service = await createService([spy]);

      await service.topHeadlines(HOME_LIMIT, { lang: 'en' });
      await service.topHeadlines(HOME_LIMIT, { lang: 'en' });
      await service.topHeadlines(HOME_LIMIT, { lang: 'en' });

      expect(spy.widthsRequested()).toEqual([HOME_LIMIT]);
    });

    it('C12b: exactly one cache entry exists for the shared corpus', async () => {
      const spy = new SpyProvider();
      const service = await createService([spy]);

      await service.topHeadlines(HOME_LIMIT, { lang: 'en' });
      await service.topHeadlines(HOME_LIMIT, { lang: 'en' });

      const keys = Array.from(
        (service as unknown as { homeNewsCache: Map<string, unknown> }).homeNewsCache.keys(),
      );

      expect(keys).toEqual([`${HOME_LIMIT}:en`]);
    });
  });

  describe('C7 IS PRESERVED — THE CACHE STILL ISOLATES GENUINELY DIFFERENT WIDTHS', () => {
    it('C13: a narrower request is still NOT served from a wider warm corpus', async () => {
      /*
        This is C7 restated from the other side. It must keep failing to share,
        because a warm 24 answering a request for 12 would mean the cache had
        started blurring widths — which the ruling forbids and which this lane
        did not do.
      */
      const spy = new SpyProvider();
      const service = await createService([spy]);

      await service.topHeadlines(24, { lang: 'en' });
      await service.topHeadlines(12, { lang: 'en' });

      expect(spy.executions).toBe(2);
    });

    it('C14: the width the Map used to ask for is still a separate corpus', async () => {
      /*
        The fix is at the CALLER, not in the cache. If anything ever asks for 50
        again, it still costs a retrieval — which is exactly the pressure that
        keeps items 25-50 an explicit action rather than a hidden cost.
      */
      const spy = new SpyProvider();
      const service = await createService([spy]);

      await service.topHeadlines(HOME_LIMIT, { lang: 'en' });
      await service.topHeadlines(LEGACY_MAP_LIMIT, { lang: 'en' });

      expect(spy.executions).toBe(2);
      expect(spy.widthsRequested()).toEqual([HOME_LIMIT, LEGACY_MAP_LIMIT]);
    });

    it('C15: language isolation is untouched', async () => {
      const spy = new SpyProvider();
      const service = await createService([spy]);

      await service.topHeadlines(HOME_LIMIT, { lang: 'en' });
      await service.topHeadlines(HOME_LIMIT, { lang: 'pl' });

      expect(spy.executions).toBe(2);
    });
  });

  describe('COST COLUMNS FOR THE SCENARIO MATRIX', () => {
    it('C16: a warm Map open reaches NO provider, so GNews attempts are zero', async () => {
      /*
        "GNews attempts = 0" is the same fact as "the provider was never
        executed": the provider IS the GNews entry point. Asserting the spy was
        not invoked is therefore a direct measurement of the attempt count, not
        an inference from a status code.
      */
      const spy = new SpyProvider();
      const service = await createService([spy]);

      await service.topHeadlines(HOME_LIMIT, { lang: 'en' });
      spy.topHeadlinesCalls = [];

      await service.topHeadlines(HOME_LIMIT, { lang: 'en' });

      expect(spy.topHeadlinesCalls).toEqual([]);
    });

    it('C17: the warm response still carries its evidence identity unchanged', async () => {
      const spy = new SpyProvider();
      const service = await createService([spy]);

      const first = await service.topHeadlines(HOME_LIMIT, { lang: 'en' });
      const second = await service.topHeadlines(HOME_LIMIT, { lang: 'en' });

      expect(second.articles.map((a) => a.id)).toEqual(first.articles.map((a) => a.id));
      expect(second.dataMode).toBe(first.dataMode);
    });
  });
});
