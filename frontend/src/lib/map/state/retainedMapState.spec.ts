import type { CountryNewsResponse, NewsResponse } from '@globalnews-ai/shared';

import {
  RETAINED_MAP_STATE_TTL_MS,
  globalFeedKey,
  resetRetainedMapState,
  retainCountryCorpus,
  retainCountryGeography,
  retainGlobalFeed,
  retainGlobalGeography,
  retainedCountryCorpora,
  retainedCountryGeographies,
  retainedGlobalFeed,
  retainedGlobalGeography,
  type ResolvedArticleGeography,
} from './retainedMapState';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CHECKPOINT C — RETAINED MAP STATE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * THE DEFECT. `/map` and `/search` are separate routes, so opening Analysis
 * unmounts the map and Back remounts it. Every corpus lived in component state
 * and was destroyed on the way out, so returning to a view the reader already
 * had cost `/news/top-headlines`, `/news/country/POL`, `/geo/map-feed`, a GNews
 * attempt, an RSS fallback and a GDELT timeout — about 8.4 seconds.
 *
 * TIME IS INJECTED, NEVER SLEPT. Every function takes `now`, so expiry is
 * exercised by passing a later instant. A test that slept for 300 seconds would
 * be flaky, and a flaky freshness gate gets disabled within a month.
 */

const article = (id: string) => ({
  id,
  title: `Headline ${id}`,
  summary: 'Summary',
  url: `https://example.com/${id}`,
  sourceId: 'src',
  sourceName: 'Source',
  category: 'world' as const,
  sourcesCount: 1,
  publishedAt: '2026-09-15T00:00:00.000Z',
});

const feed = (ids: string[]): NewsResponse =>
  ({
    articles: ids.map(article),
    totalResults: ids.length,
    providers: ['gnews'],
    dataMode: 'live',
    generatedAt: '2026-09-15T00:00:00.000Z',
  }) as NewsResponse;

const countryFeed = (ids: string[]): CountryNewsResponse =>
  ({
    articles: ids.map(article),
    totalResults: ids.length,
    providers: ['gnews'],
    dataMode: 'live',
    generatedAt: '2026-09-15T00:00:00.000Z',
    country: { iso2: 'PL', iso3: 'POL', name: 'Poland' },
  }) as unknown as CountryNewsResponse;

const geography = (recordId: string): ResolvedArticleGeography =>
  ({
    recordId,
    feed: { precision: 'CITY', renderable: true, contested: false, candidates: [], reason: 't' },
    observedAt: '2026-09-15T00:00:00.000Z',
    headline: 'Headline',
    sourceCount: 1,
    category: 'world',
    countryIso3: 'POL',
  }) as unknown as ResolvedArticleGeography;

const T0 = 1_000_000;
const WITHIN_TTL = T0 + RETAINED_MAP_STATE_TTL_MS - 1;
const AFTER_TTL = T0 + RETAINED_MAP_STATE_TTL_MS + 1;

beforeEach(() => {
  /*
    Module scope is process-wide. A leaked corpus would make a "restored without
    retrieving" assertion pass for the wrong reason, which is the worst possible
    failure for this store.
  */
  resetRetainedMapState();
});

describe('C — retained map state', () => {
  describe('A VALID RETAINED CORPUS RESTORES LOCALLY', () => {
    it('the world corpus is returned inside the freshness window', () => {
      const key = globalFeedKey(24, 'en');

      retainGlobalFeed(key, feed(['a', 'b']), T0);

      expect(retainedGlobalFeed(key, WITHIN_TTL)?.articles.map((a) => a.id)).toEqual(['a', 'b']);
    });

    it('country corpora come back as a snapshot the component can seed state from', () => {
      retainCountryCorpus('POL:all:en', countryFeed(['p1']), T0);
      retainCountryCorpus('KEN:all:en', countryFeed(['k1']), T0);

      const snapshot = retainedCountryCorpora(WITHIN_TTL);

      expect(Object.keys(snapshot).sort()).toEqual(['KEN:all:en', 'POL:all:en']);
      expect(snapshot['POL:all:en'].articles[0].id).toBe('p1');
    });

    it('resolved geographies come back too, so enrichment does not re-run', () => {
      retainCountryGeography('POL', [geography('r1')], T0);
      retainGlobalGeography(globalFeedKey(24, 'en'), [geography('g1')], T0);

      expect(retainedCountryGeographies(WITHIN_TTL).POL).toHaveLength(1);
      expect(retainedGlobalGeography(globalFeedKey(24, 'en'), WITHIN_TTL)).toHaveLength(1);
    });

    it('an EMPTY resolved-geography list is retained — it is a real answer', () => {
      /*
        Empty means "enrichment ran and resolved nothing finer than country
        level", which is different from "not asked yet" and is what stops the
        effect asking again. Treating it as absent would restore the re-run.
      */
      retainGlobalGeography(globalFeedKey(24, 'en'), [], T0);

      expect(retainedGlobalGeography(globalFeedKey(24, 'en'), WITHIN_TTL)).toEqual([]);
      expect(retainedGlobalGeography(globalFeedKey(24, 'en'), WITHIN_TTL)).not.toBeNull();
    });
  });

  describe('AN EXPIRED CORPUS MAY RETRIEVE NORMALLY', () => {
    it('the world corpus is gone after the TTL', () => {
      const key = globalFeedKey(24, 'en');

      retainGlobalFeed(key, feed(['a']), T0);

      expect(retainedGlobalFeed(key, AFTER_TTL)).toBeNull();
    });

    it('expired country corpora drop out of the snapshot', () => {
      retainCountryCorpus('POL:all:en', countryFeed(['p1']), T0);

      expect(retainedCountryCorpora(AFTER_TTL)).toEqual({});
    });

    it('the TTL never exceeds the backend freshness window it mirrors', () => {
      /*
        DEFAULT_HOME_NEWS_CACHE_TTL_SECONDS = 300 and
        DEFAULT_CACHE_TTL_SECONDS = 300. A client store outliving the server's
        window would show evidence the backend would no longer serve.
      */
      expect(RETAINED_MAP_STATE_TTL_MS).toBeLessThanOrEqual(300 * 1000);
    });

    it('an expired entry is deleted on read rather than lingering', () => {
      const key = globalFeedKey(24, 'en');

      retainGlobalFeed(key, feed(['a']), T0);
      retainedGlobalFeed(key, AFTER_TTL);

      /* Even asked again at T0, it is gone: the read evicted it. */
      expect(retainedGlobalFeed(key, T0)).toBeNull();
    });
  });

  describe('A FAILED RETRIEVAL DOES NOT ERASE RETAINED EVIDENCE', () => {
    it('a null response leaves a good world corpus standing', () => {
      const key = globalFeedKey(24, 'en');

      retainGlobalFeed(key, feed(['good']), T0);
      retainGlobalFeed(key, null, T0);

      expect(retainedGlobalFeed(key, WITHIN_TTL)?.articles.map((a) => a.id)).toEqual(['good']);
    });

    it('a null response leaves a good country corpus standing', () => {
      retainCountryCorpus('POL:all:en', countryFeed(['good']), T0);
      retainCountryCorpus('POL:all:en', null, T0);

      expect(retainedCountryCorpora(WITHIN_TTL)['POL:all:en'].articles[0].id).toBe('good');
    });
  });

  describe('AN EMPTY RESPONSE CANNOT REPLACE VALID RETAINED EVIDENCE', () => {
    it('an empty world corpus is refused', () => {
      const key = globalFeedKey(24, 'en');

      retainGlobalFeed(key, feed(['good']), T0);
      retainGlobalFeed(key, feed([]), T0);

      expect(retainedGlobalFeed(key, WITHIN_TTL)?.articles.map((a) => a.id)).toEqual(['good']);
    });

    it('an empty country corpus is refused', () => {
      retainCountryCorpus('POL:all:en', countryFeed(['good']), T0);
      retainCountryCorpus('POL:all:en', countryFeed([]), T0);

      expect(retainedCountryCorpora(WITHIN_TTL)['POL:all:en'].articles[0].id).toBe('good');
    });

    it('an empty corpus is not stored even when nothing was retained before', () => {
      /*
        Refused at the one place a write can happen, so a failure never becomes
        a cached success — the same rule NewsService.rememberHomeNews applies.
      */
      retainGlobalFeed(globalFeedKey(24, 'en'), feed([]), T0);

      expect(retainedGlobalFeed(globalFeedKey(24, 'en'), T0)).toBeNull();
    });
  });

  describe('COUNTRY ISOLATION IS PRESERVED', () => {
    it('one country does not answer for another', () => {
      retainCountryCorpus('POL:all:en', countryFeed(['p1']), T0);

      expect(retainedCountryCorpora(WITHIN_TTL)['KEN:all:en']).toBeUndefined();
    });

    it('category and language remain part of the corpus identity', () => {
      retainCountryCorpus('POL:all:en', countryFeed(['unfiltered']), T0);

      const snapshot = retainedCountryCorpora(WITHIN_TTL);

      expect(snapshot['POL:business:en']).toBeUndefined();
      expect(snapshot['POL:all:pl']).toBeUndefined();
    });

    it('the world corpus is keyed by width and language, matching the backend identity', () => {
      retainGlobalFeed(globalFeedKey(24, 'en'), feed(['en24']), T0);

      expect(retainedGlobalFeed(globalFeedKey(24, 'pl'), WITHIN_TTL)).toBeNull();
      expect(retainedGlobalFeed(globalFeedKey(50, 'en'), WITHIN_TTL)).toBeNull();
    });

    it('geographies are isolated per country too', () => {
      retainCountryGeography('POL', [geography('r1')], T0);

      expect(retainedCountryGeographies(WITHIN_TTL).KEN).toBeUndefined();
    });
  });
});
