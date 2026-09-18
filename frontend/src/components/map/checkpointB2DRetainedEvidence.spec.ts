import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CHECKPOINT B-2D — RETAINED EVIDENCE IS PREFERRED, AND SURVIVES FAILURE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CTO ruling: *"Use the already-proven right-rail evidence-row zero-backend path
 * as the reference behaviour. Prefer retained evidence whenever sufficient state
 * already exists. Do not allow provider failure to invalidate already-retained
 * evidence."*
 *
 * ─── THE REFERENCE PATH, AND WHY IT IS ZERO-BACKEND ───────────────────────
 *
 * Selecting an evidence row goes through the same `handleSpatialSelection` as
 * every other selection. The REGION branch returns early; below it the handler
 * resolves `selection.id` against COUNTRIES, and an EVIDENCE / SITUATION /
 * SOURCE id is not an ISO-3, so the lookup yields null and the handler returns
 * before `loadCountry`. The zero-backend property is therefore STRUCTURAL —
 * there is no branch for a non-country selection that could retrieve.
 *
 * ─── WHAT THIS FILE ADDS ──────────────────────────────────────────────────
 *
 * The backend execution counts are already proven in
 * `country-news.retained-state.spec.ts` (B-2B) and
 * `news.service.home-map-corpus.spec.ts` (B-2A). What is NOT provable from the
 * service layer is which UI actions reach it at all. That is asserted here, on
 * the real source, following the convention `c911RequestEconomy.spec.ts` and
 * `dockerComposeWiring.spec.ts` already establish for wiring guarantees that
 * cannot be exercised without a browser.
 */

const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const raw = readFileSync(join(__dirname, 'MapPageClient.tsx'), 'utf-8');
const mapClient = stripComments(raw);

const handler = mapClient.slice(
  mapClient.indexOf('function handleSpatialSelection'),
  mapClient.indexOf('function handleCategoryChange'),
);

const loadCountry = mapClient.slice(
  mapClient.indexOf('const loadCountry = useCallback'),
  mapClient.indexOf('const loadCountry = useCallback') + 1800,
);

describe('B-2D — retained evidence is preferred over live retrieval', () => {
  describe('THE REFERENCE PATH — AN EVIDENCE ROW REACHES NO BACKEND', () => {
    it('a non-country selection falls out of the handler before loadCountry', () => {
      /*
        The order is the guarantee: the country lookup, then the null return,
        then and only then loadCountry.
      */
      const lookup = handler.indexOf('const country = COUNTRIES.find');
      const nullReturn = handler.indexOf('if (country === null) return;');
      const retrieval = handler.indexOf('loadCountry');

      expect(lookup).toBeGreaterThan(-1);
      expect(nullReturn).toBeGreaterThan(lookup);
      expect(retrieval).toBeGreaterThan(nullReturn);
    });

    it('the handler has no EVIDENCE, SITUATION or SOURCE retrieval branch at all', () => {
      /*
        Zero-backend is structural rather than guarded: there is nothing in the
        handler that could retrieve for these kinds even if it wanted to.
      */
      expect(handler).not.toContain("kind === 'EVIDENCE'");
      expect(handler).not.toContain("kind === 'SITUATION'");
      expect(handler).not.toContain("kind === 'SOURCE'");
      expect(handler.split('loadCountry').length - 1).toBe(1);
    });

    it('selecting a row clears card filters and the item id — state only, no fetch', () => {
      const beforeBranches = handler.slice(0, handler.indexOf('if (selection === null)'));

      expect(beforeBranches).toContain('setCardFilters(EMPTY_CATEGORY_FILTERS);');
      expect(beforeBranches).toContain('setSelectedItemId(null);');
      expect(beforeBranches).not.toContain('fetch');
      expect(beforeBranches).not.toContain('loadCountry');
    });
  });

  describe('SUFFICIENT RETAINED STATE SHORT-CIRCUITS RETRIEVAL', () => {
    it('loadCountry returns before any fetch when the corpus is retained', () => {
      const guardIndex = loadCountry.indexOf('if (cache[key]) return;');
      const fetchIndex = loadCountry.indexOf('await fetchCountryNews(');

      expect(guardIndex).toBeGreaterThan(-1);
      expect(fetchIndex).toBeGreaterThan(guardIndex);
    });

    it('the retained key carries every dimension that changes the corpus', () => {
      expect(loadCountry).toContain('cacheKey(country.iso3, requestedCategory, language)');
    });
  });

  describe('PROVIDER FAILURE MUST NOT INVALIDATE RETAINED EVIDENCE', () => {
    it('the failure path sets an error and never clears the retained corpus', () => {
      /*
        The ruling is explicit. A failed retrieval that also emptied the cache
        would turn one provider hiccup into the loss of evidence the reader
        already had — the same class of defect as caching an empty response,
        which NewsService.rememberHomeNews refuses for the same reason.
      */
      /* Bounded to the catch block itself — a greedy slice reaches unrelated code. */
      const failure = loadCountry.slice(
        loadCountry.indexOf('} catch (err) {'),
        loadCountry.indexOf('} finally {'),
      );

      expect(failure).toContain('setError(');
      expect(failure).not.toContain('setCache');
      expect(failure).not.toContain('setGeography');
      expect(failure).not.toContain('setGlobalFeed');
    });

    it('a failed global feed leaves the map as it was rather than blanking it', () => {
      const globalFetch = mapClient.slice(
        mapClient.indexOf('void fetchRetainedTopHeadlines(GLOBAL_FEED_LIMIT, language)'),
      );
      const catchBlock = globalFetch.slice(0, globalFetch.indexOf('return () => {'));

      expect(catchBlock).toContain('.catch(');
      expect(catchBlock).not.toContain('setCache');
      expect(catchBlock).not.toContain('setGeography(');
    });

    it('a soft-failed geography resolution is never memoised as an answer', () => {
      /*
        B-1 property, re-asserted here because it is the same principle: a
        transient failure must not become permanent retained state.
      */
      const resolver = stripComments(
        readFileSync(
          join(__dirname, '..', '..', 'lib', 'map', 'evidence', 'geographyResolver.ts'),
          'utf-8',
        ),
      );

      expect(resolver).toContain('if (value !== null) memo.set(key, value);');
    });
  });

  describe('PROTECTED ZERO-COST BEHAVIOURS STILL COST NOTHING', () => {
    it('NOW / 24h / 7d / 30d is a bare state setter — no retrieval', () => {
      /*
        The ruling: "Do not turn time-window controls into refresh buttons."
        `onPeriodChange={setPeriod}` is the whole handler; `period` then feeds
        local filtering only.
      */
      expect(mapClient).toContain('onPeriodChange={setPeriod}');
      expect(mapClient).not.toMatch(/onPeriodChange=\{[^}]*loadCountry/);
      expect(mapClient).not.toMatch(/onPeriodChange=\{[^}]*fetch/);
    });

    it('period is not a dependency of any retrieval callback', () => {
      /*
        If `period` entered loadCountry's dependency list, changing the window
        would rebuild the callback and could re-trigger retrieval effects.
      */
      const deps = loadCountry.slice(loadCountry.lastIndexOf('[cache, language'));

      expect(deps).toContain('[cache, language, t.genericFetchError]');
      expect(deps).not.toContain('period');
    });

    it('Open Sources is a DOM scroll — it touches no network and no state', () => {
      const openSources = mapClient.slice(
        mapClient.indexOf('const handleOpenSources = useCallback'),
        mapClient.indexOf('const selectionDetail = useMemo'),
      );

      expect(openSources).toContain('scrollIntoView');
      expect(openSources).not.toContain('fetch');
      expect(openSources).not.toContain('loadCountry');
      expect(openSources).not.toContain('setCache');
    });

    it('the map surface calls exactly the known news entry points, and no more', () => {
      /*
        A provider-consuming call appearing here unannounced fails this, which
        is the same guard c911RequestEconomy already applies.

        R5 — the world corpus moved to the NON-EXECUTING route, so these counts
        now also state which of the two can cost anything: the country
        retrieval can, and it is reached only by an explicit country action.
        The world call cannot, at any frequency.
      */
      expect(mapClient.split('fetchRetainedTopHeadlines(').length - 1).toBe(1);
      expect(mapClient.split('fetchTopHeadlines(').length - 1).toBe(0);
      expect(mapClient.split('fetchCountryNews(').length - 1).toBe(1);
      expect(mapClient).not.toContain('fetchSearchNews(');
    });
  });
});
