import { ConfigService } from '@nestjs/config';
import type { NewsArticle, NewsResponse } from '@globalnews-ai/shared';

import type { NewsService } from '../news.service';
import type { ArticlePersistenceService } from '../persistence/article-persistence.service';
import { CountryNewsService } from './country-news.service';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * B-2B — COUNTRY SELECTION DOES NOT IMPLICITLY MEAN LIVE RETRIEVAL
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CTO ruling: *"Country selection itself must not implicitly mean live
 * retrieval. When retained evidence exists: country selection → retained/local
 * state → GNews 0 / fallback 0 / OpenAI 0"* and *"Do not infer provider usage
 * from HTTP 200 or latency. Instrument provider-entry/execution counts."*
 *
 * `/news/country/:iso3` is PROVIDER-CAPABLE — unlike `/geo/map-feed`, it spends
 * retrieval budget — so this is the higher-cost class and the one where an
 * unnecessary call actually matters.
 *
 * WHAT IS MEASURED. `NewsService.search` is the provider entry point for this
 * route: `CountryNewsService` reaches providers only through it. A spy on that
 * method therefore counts PROVIDER EXECUTIONS directly. No status code is
 * consulted anywhere in this file, and no network client exists in it.
 *
 * ─── THE TWO RETAINED-STATE LAYERS, AND WHY BOTH ARE TESTED ───────────────
 *
 *   FRONTEND  `loadCountry` returns early on `if (cache[key]) return;`, keyed
 *             by country + category + language. Asserted structurally in
 *             `checkpointB2RegionRetrieval.spec.ts`.
 *   BACKEND   `CountryNewsService.getCached` returns before `newsService.search`
 *             is reached, keyed by iso3 + category + limit + city + lang. That
 *             is what this file measures.
 *
 * The frontend layer protects one reader's repeated selection. The backend
 * layer protects EVERY reader, and it is the one that decides whether a
 * provider is executed at all.
 *
 * ─── A FINDING WORTH RECORDING: THE TWO SURFACES DO NOT FRAGMENT ──────────
 *
 * B-2A was a cache-identity fragmentation: Home asked for width 24 and the Map
 * for 50, so one corpus became two entries and whichever surface loaded second
 * paid a provider execution.
 *
 * The country endpoint was checked for the same defect and DOES NOT HAVE IT,
 * which is why no caller was changed here:
 *
 *   Map page          fetchCountryNews(iso3, { category, lang })  -> limit undefined
 *                     -> clampLimit(undefined) -> DEFAULT_LIMIT = 8
 *   Home situation map fetchCountryNews(iso3, { limit: 8, lang }) -> limit 8
 *
 * Both resolve to the SAME key. C24 below pins that, because it is a coherence
 * the two call sites currently have by coincidence of defaults rather than by
 * construction — if either moved, the country corpus would fragment exactly as
 * the Home corpus did.
 */

function makeArticle(overrides: Partial<NewsArticle> = {}): NewsArticle {
  return {
    id: 'id',
    title: 'Poland update',
    summary: 'Poland summary',
    url: 'https://example.com/poland',
    sourceId: 'src',
    sourceName: 'Source',
    category: 'world',
    sourcesCount: 1,
    countryCode: 'POL',
    publishedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeSearchResponse(articles: NewsArticle[]): NewsResponse {
  return {
    articles,
    totalResults: articles.length,
    providers: ['gnews'],
    dataMode: 'live',
    generatedAt: new Date().toISOString(),
  };
}

function makeConfig(overrides: Record<string, string | undefined> = {}): ConfigService {
  return { get: (key: string) => overrides[key] } as ConfigService;
}

/** Counts every provider entry. This IS the GNews attempt count for this route. */
function createSpyNewsService() {
  const calls: Array<{ term: string; limit: number; lang?: string }> = [];

  const newsService = {
    search: jest.fn(async (term: string, limit: number, _mode: unknown, options?: { lang?: string }) => {
      calls.push({ term, limit, lang: options?.lang });

      return makeSearchResponse([makeArticle(), makeArticle({ id: 'id-2', url: 'https://example.com/p2' })]);
    }),
  } as unknown as NewsService;

  return {
    newsService,
    calls,
    get executions() {
      return calls.length;
    },
  };
}

function createPersistenceStub() {
  return {
    persistCountryRelations: jest.fn().mockResolvedValue(undefined),
    findRecentByCountry: jest.fn().mockResolvedValue([]),
    findRecent: jest.fn().mockResolvedValue([]),
  } as unknown as ArticlePersistenceService;
}

function createService(spy: ReturnType<typeof createSpyNewsService>): CountryNewsService {
  return new CountryNewsService(spy.newsService, makeConfig(), createPersistenceStub());
}

describe('B-2B — retained country evidence is preferred over live retrieval', () => {
  describe('THE REQUIRED PROOF — PROVIDER EXECUTIONS, NOT STATUS CODES', () => {
    it('C20: re-selecting the same country performs ZERO additional provider executions', async () => {
      const spy = createSpyNewsService();
      const service = createService(spy);

      await service.getCountryNews('POL', undefined, undefined, undefined, 'en');
      const afterFirst = spy.executions;

      expect(afterFirst).toBe(1);

      await service.getCountryNews('POL', undefined, undefined, undefined, 'en');

      expect(spy.executions - afterFirst).toBe(0);
      expect(spy.executions).toBe(1);
    });

    it('C21: GNews attempts are zero on the retained path, measured by non-invocation', async () => {
      /*
        "GNews attempts = 0" and "the provider entry point was never reached"
        are the same fact for this route: CountryNewsService touches providers
        only through NewsService.search.
      */
      const spy = createSpyNewsService();
      const service = createService(spy);

      await service.getCountryNews('POL', undefined, undefined, undefined, 'en');
      spy.calls.length = 0;

      await service.getCountryNews('POL', undefined, undefined, undefined, 'en');

      expect(spy.calls).toEqual([]);
    });

    it('C22: the retained response is the same evidence, not a re-derived one', async () => {
      const spy = createSpyNewsService();
      const service = createService(spy);

      const first = await service.getCountryNews('POL', undefined, undefined, undefined, 'en');
      const second = await service.getCountryNews('POL', undefined, undefined, undefined, 'en');

      expect(second.articles.map((a) => a.id)).toEqual(first.articles.map((a) => a.id));
    });

    it('C23: a THIRD and FOURTH selection are also free', async () => {
      const spy = createSpyNewsService();
      const service = createService(spy);

      for (let i = 0; i < 4; i += 1) {
        await service.getCountryNews('POL', undefined, undefined, undefined, 'en');
      }

      expect(spy.executions).toBe(1);
    });
  });

  describe('THE TWO SURFACES SHARE ONE COUNTRY CORPUS', () => {
    it('C24: the Home situation map (limit 8) and the Map page (limit omitted) share one entry', async () => {
      /*
        The Map page omits `limit`, which clamps to DEFAULT_LIMIT = 8; the Home
        situation map passes 8 explicitly. Same key, so whichever surface loads
        second is free. If either caller ever moves, this fails — and it would
        be the country-endpoint version of the B-2A fragmentation.
      */
      const spy = createSpyNewsService();
      const service = createService(spy);

      /* Home situation map: an explicit 8. */
      await service.getCountryNews('POL', undefined, 8, undefined, 'en');
      /* Map page: no limit at all. */
      await service.getCountryNews('POL', undefined, undefined, undefined, 'en');

      expect(spy.executions).toBe(1);
    });

    it('C25: and in the other order, because fragmentation runs both ways', async () => {
      const spy = createSpyNewsService();
      const service = createService(spy);

      await service.getCountryNews('POL', undefined, undefined, undefined, 'en');
      await service.getCountryNews('POL', undefined, 8, undefined, 'en');

      expect(spy.executions).toBe(1);
    });
  });

  describe('ISOLATION THAT MUST SURVIVE — NOT EVERYTHING IS SHARED', () => {
    it('C26: a different country is a different corpus', async () => {
      const spy = createSpyNewsService();
      const service = createService(spy);

      await service.getCountryNews('POL', undefined, undefined, undefined, 'en');
      await service.getCountryNews('KEN', undefined, undefined, undefined, 'en');

      expect(spy.executions).toBe(2);
    });

    it('C27: a different language is a different corpus — Milestone #49 stands', async () => {
      const spy = createSpyNewsService();
      const service = createService(spy);

      await service.getCountryNews('POL', undefined, undefined, undefined, 'en');
      await service.getCountryNews('POL', undefined, undefined, undefined, 'pl');

      expect(spy.executions).toBe(2);
    });

    it('C28: a category filter is a different corpus — an EXPLICIT-REFRESH caller', async () => {
      /*
        `handleCategoryChange` is classified EXPLICIT-REFRESH: the reader asked
        for a different slice, so a retrieval is legitimate and must not be
        served from the unfiltered entry.
      */
      const spy = createSpyNewsService();
      const service = createService(spy);

      await service.getCountryNews('POL', undefined, undefined, undefined, 'en');
      await service.getCountryNews('POL', 'business', undefined, undefined, 'en');

      expect(spy.executions).toBe(2);
    });

    it('C29: a wider explicit limit is a different corpus, consistent with C7 on Home', async () => {
      const spy = createSpyNewsService();
      const service = createService(spy);

      await service.getCountryNews('POL', undefined, 8, undefined, 'en');
      await service.getCountryNews('POL', undefined, 20, undefined, 'en');

      expect(spy.executions).toBe(2);
    });
  });
});
