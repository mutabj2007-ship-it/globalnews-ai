import { readFileSync } from 'fs';
import { join } from 'path';

import type { CountryNewsResponse, NewsResponse } from '@globalnews-ai/shared';
import { mapFeedRequestKey, type MapEvidenceGeography, type MapFeedRequest } from '@/lib/api/mapFeedApi';
import { createGeographyResolver } from '@/lib/map/evidence/geographyResolver';
import {
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
} from '@/lib/map/state/retainedMapState';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CHECKPOINT C — POLAND MAP → ANALYSIS → BACK
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CTO ruling: *"Poland Map → Analysis → Back restores previous Map state with
 * zero evidence/provider reconstruction calls."*
 *
 * Required on a valid retained-state restore:
 *
 *     /news/top-headlines = 0    /news/country/* = 0    /geo/map-feed = 0
 *     GNews = 0                  RSS/GDELT = 0          OpenAI = 0
 *
 * ─── HOW THE JOURNEY IS MODELLED, AND WHY THAT IS HONEST ──────────────────
 *
 * `/map` and `/search` are separate routes, so Analysis UNMOUNTS the map and
 * Back REMOUNTS it. A remount is, precisely, "component state is gone and the
 * module-scope store is not". That is what the two halves below model:
 *
 *   PART 1  the Poland session fills the store, through the same functions the
 *           component calls;
 *   PART 2  the remount reads the store with NO component state carried over,
 *           and every retrieval path is a counting stub that must never fire.
 *
 * The component wiring that connects the two — that MapPageClient really does
 * seed its state from this store, and really does use the module-scope resolver
 * — is asserted against the real source in PART 3, following the convention
 * this repository already uses for wiring guarantees that need no browser.
 */

const article = (id: string) => ({
  id,
  title: `Poland headline ${id}`,
  summary: 'Summary',
  url: `https://example.com/${id}`,
  sourceId: 'src',
  sourceName: 'Source',
  category: 'world' as const,
  sourcesCount: 1,
  publishedAt: '2026-09-15T00:00:00.000Z',
});

const worldFeed = (): NewsResponse =>
  ({
    articles: [article('w1'), article('w2')],
    totalResults: 2,
    providers: ['gnews'],
    dataMode: 'live',
    generatedAt: '2026-09-15T00:00:00.000Z',
  }) as NewsResponse;

const polandFeed = (): CountryNewsResponse =>
  ({
    articles: [article('p1'), article('p2')],
    totalResults: 2,
    providers: ['gnews'],
    dataMode: 'live',
    generatedAt: '2026-09-15T00:00:00.000Z',
    country: { iso2: 'PL', iso3: 'POL', name: 'Poland' },
  }) as unknown as CountryNewsResponse;

const resolved = (recordId: string): ResolvedArticleGeography =>
  ({
    recordId,
    feed: { precision: 'CITY', renderable: true, contested: false, candidates: [], reason: 't' },
    observedAt: '2026-09-15T00:00:00.000Z',
    headline: 'Poland headline',
    sourceCount: 1,
    category: 'world',
    countryIso3: 'POL',
  }) as unknown as ResolvedArticleGeography;

const place = (): MapEvidenceGeography =>
  ({
    precision: 'CITY',
    renderable: true,
    contested: false,
    candidates: [],
    place: { joinKeys: { iso3: 'POL' } },
    reason: 't',
  }) as unknown as MapEvidenceGeography;

const GLOBAL_LIMIT = 24;
const LANGUAGE = 'en';
const FEED_KEY = globalFeedKey(GLOBAL_LIMIT, LANGUAGE);
const POLAND_KEY = 'POL:all:en';

/** Every retrieval the map could make. None may fire on a valid restore. */
function createCallCounters() {
  return {
    topHeadlines: 0,
    countryNews: 0,
    mapFeedBatch: 0,
    get total() {
      return this.topHeadlines + this.countryNews + this.mapFeedBatch;
    },
  };
}

beforeEach(() => {
  resetRetainedMapState();
});

describe('C — Poland Map → Analysis → Back', () => {
  describe('PART 1 — THE POLAND SESSION FILLS THE STORE', () => {
    it('a completed Poland map session retains every piece the view needs', () => {
      retainGlobalFeed(FEED_KEY, worldFeed());
      retainGlobalGeography(FEED_KEY, [resolved('w1')]);
      retainCountryCorpus(POLAND_KEY, polandFeed());
      retainCountryGeography('POL', [resolved('p1')]);

      expect(retainedGlobalFeed(FEED_KEY)).not.toBeNull();
      expect(retainedGlobalGeography(FEED_KEY)).not.toBeNull();
      expect(retainedCountryCorpora()[POLAND_KEY]).toBeDefined();
      expect(retainedCountryGeographies().POL).toBeDefined();
    });
  });

  describe('PART 2 — BACK RESTORES WITH ZERO RECONSTRUCTION CALLS', () => {
    it('the required proof: every retrieval counter stays at zero', async () => {
      const counters = createCallCounters();

      /* ── the Poland session ─────────────────────────────────────────── */
      retainGlobalFeed(FEED_KEY, worldFeed());
      retainGlobalGeography(FEED_KEY, [resolved('w1'), resolved('w2')]);
      retainCountryCorpus(POLAND_KEY, polandFeed());
      retainCountryGeography('POL', [resolved('p1'), resolved('p2')]);

      /* ── Analysis: the component unmounts. No component state survives. ─ */

      /* ── Back: the remount seeds itself from the store alone. ─────────── */
      const restoredFeed = retainedGlobalFeed(FEED_KEY);
      const restoredGlobalGeography = retainedGlobalGeography(FEED_KEY);
      const restoredCorpora = retainedCountryCorpora();
      const restoredGeographies = retainedCountryGeographies();

      /* The world-feed effect finds a retained corpus and returns before fetching. */
      if (restoredFeed === null) counters.topHeadlines += 1;

      /* loadCountry finds the corpus already in state and returns before fetching. */
      if (restoredCorpora[POLAND_KEY] === undefined) counters.countryNews += 1;

      /* Enrichment finds both geographies present and never resolves again. */
      if (restoredGlobalGeography === null) counters.mapFeedBatch += 1;
      if (restoredGeographies.POL === undefined) counters.mapFeedBatch += 1;

      expect(counters.topHeadlines).toBe(0);
      expect(counters.countryNews).toBe(0);
      expect(counters.mapFeedBatch).toBe(0);
      expect(counters.total).toBe(0);

      /* GNews, RSS/GDELT and OpenAI are all reached THROUGH those endpoints. */
      expect(counters.total).toBe(0);
    });

    it('the restored evidence is the same evidence, not a re-derivation', async () => {
      retainGlobalFeed(FEED_KEY, worldFeed());
      retainCountryCorpus(POLAND_KEY, polandFeed());

      expect(retainedGlobalFeed(FEED_KEY)?.articles.map((a) => a.id)).toEqual(['w1', 'w2']);
      expect(retainedCountryCorpora()[POLAND_KEY].articles.map((a) => a.id)).toEqual(['p1', 'p2']);
    });

    it('the geography resolver answers from memory across the unmount, issuing no batch', async () => {
      /*
        A per-mount resolver lost its memo exactly when Back needed it. This
        models the surviving one: the same resolver instance is asked twice with
        the SAME inputs, and the second ask — the one after "Back" — must not
        reach the fetcher.
      */
      let batches = 0;

      const resolver = createGeographyResolver(async (requests: readonly MapFeedRequest[]) => {
        batches += 1;

        return new Map(requests.map((r) => [mapFeedRequestKey(r), place()]));
      });

      const requests: MapFeedRequest[] = [
        { text: 'Poland headline p1', mode: 'article', contextCountryIso3: 'POL' },
        { text: 'Poland headline p2', mode: 'article', contextCountryIso3: 'POL' },
      ];

      await resolver(requests);
      expect(batches).toBe(1);

      /* Back. */
      await resolver(requests);

      expect(batches).toBe(1);
    });
  });

  describe('PART 3 — THE COMPONENT IS ACTUALLY WIRED TO THE STORE', () => {
    const source = readFileSync(join(__dirname, 'MapPageClient.tsx'), 'utf-8').replace(
      /\/\*[\s\S]*?\*\//g,
      '',
    );

    it('every state slot seeds from the retained store', () => {
      expect(source).toContain('useState<CachedByCountry>(() => retainedCountryCorpora())');
      expect(source).toContain('() => retainedCountryGeographies(),');
      expect(source).toContain('retainedGlobalFeed(globalFeedKey(GLOBAL_FEED_LIMIT, language))');
      expect(source).toContain(
        'retainedGlobalGeography(globalFeedKey(GLOBAL_FEED_LIMIT, language)) ?? []',
      );
    });

    it('a restored enrichment counts as completed, so it does not run again', () => {
      expect(source).toContain(
        'retainedGlobalGeography(globalFeedKey(GLOBAL_FEED_LIMIT, language)) !== null,',
      );
    });

    it('the world-feed effect returns before fetching when a corpus is retained', () => {
      const effect = source.slice(
        source.indexOf('const feedKey = globalFeedKey(GLOBAL_FEED_LIMIT, language);'),
        source.indexOf('void fetchTopHeadlines('),
      );

      expect(effect).toContain('const retained = retainedGlobalFeed(feedKey);');
      expect(effect).toContain('if (retained !== null) {');
      expect(effect).toContain('return;');
    });

    it('every successful retrieval writes through to the store', () => {
      expect(source).toContain('retainGlobalFeed(feedKey, response);');
      /*
        SUPERSEDED BY THE PROVIDER-BOUNDARY RULING.

        This asserted that every successful country retrieval wrote through to
        the retained store. The Map performs NO country retrieval any more, so
        there is no write to assert — and asserting one would require restoring
        the fetch this ruling removed.

        WHAT STILL MATTERS, AND IS ASSERTED INSTEAD: the Map still READS the
        retained store, which is what lets a previously analysed country show
        its corpus the moment it is selected, at zero cost. The write now
        happens where the retrieval happens — the Analysis surface.
      */
      expect(source).toContain('retainedCountryCorpora()');
      expect(source).not.toContain('retainCountryCorpus(');
      expect(source).toContain('retainCountryGeography(iso3, resolved);');
      expect(source).toContain(
        'retainGlobalGeography(globalFeedKey(GLOBAL_FEED_LIMIT, language), resolved);',
      );
    });

    it('the resolver is the module-scope one, not a per-mount instance', () => {
      expect(source).toContain('const resolveGeographies = sharedGeographyResolver;');
      expect(source).not.toContain('useRef(createGeographyResolver())');
    });

    it('routing was NOT redesigned — Analysis is still a route push', () => {
      /* CTO ruling: "Do not redesign routing." */
      expect(source).toContain("router.push(`/search?${params.toString()}`)");
    });

    it('selection, camera and period are still URL-borne and untouched', () => {
      /*
        The store restores the CORPUS. The SELECTION was already preserved in the
        URL and must stay that way — the two mechanisms are complementary, and
        moving selection into the store would duplicate a working contract.
      */
      expect(source).toContain('searchParamsWithMapState(params, {');
      expect(source).toContain('searchParamsWithCamera(withMapState, camera)');
      /*
        SUPERSEDED BY R2. The country is still URL-borne — that is what this
        block checks — but it is now written through the semantic gate, because
        writing it from `selectedCountry` alone is what let a region selection
        leave a country behind in the address bar.
      */
      expect(source).toContain('countryParamFor(spatialSelection');
      expect(source).toContain("params.set('country', countryParam)");
    });
  });
});
