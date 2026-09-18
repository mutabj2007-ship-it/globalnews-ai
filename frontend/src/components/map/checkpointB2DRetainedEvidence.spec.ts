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
    it('a non-country selection falls out of the handler before ANY country work', () => {
      /*
        The ordering guarantee survives; only its last term changed. It used to
        read "lookup, null return, then and only then loadCountry". There is no
        loadCountry any more, so the term is the scope setter — which costs
        nothing, and that is the point.
      */
      const lookup = handler.indexOf('const country = COUNTRIES.find');
      const nullReturn = handler.indexOf('if (country === null) return;');
      const scope = handler.indexOf('selectCountryScope');

      expect(lookup).toBeGreaterThan(-1);
      expect(nullReturn).toBeGreaterThan(lookup);
      expect(scope).toBeGreaterThan(nullReturn);
    });

    it('the handler has no EVIDENCE, SITUATION or SOURCE retrieval branch at all', () => {
      /*
        Zero-backend is structural rather than guarded: there is nothing in the
        handler that could retrieve for these kinds even if it wanted to. That
        is now true of COUNTRY as well — the handler sets scope and stops.
      */
      expect(handler).not.toContain("kind === 'EVIDENCE'");
      expect(handler).not.toContain("kind === 'SITUATION'");
      expect(handler).not.toContain("kind === 'SOURCE'");
      expect(handler).not.toContain('loadCountry');
      expect(handler.split('selectCountryScope').length - 1).toBe(1);
    });

    it('selecting a row clears card filters and the item id — state only, no fetch', () => {
      const beforeBranches = handler.slice(0, handler.indexOf('if (selection === null)'));

      expect(beforeBranches).toContain('setCardFilters(EMPTY_CATEGORY_FILTERS);');
      expect(beforeBranches).toContain('setSelectedItemId(null);');
      expect(beforeBranches).not.toContain('fetch');
      expect(beforeBranches).not.toContain('loadCountry');
    });
  });

  describe('RETAINED STATE IS NOW THE ONLY STATE — NOTHING SHORT-CIRCUITS, BECAUSE NOTHING RUNS', () => {
    /*
      ══ SUPERSEDED, AND THE TITLE IS THE WHOLE CHANGE ══════════════════════

      This block proved that a retained corpus SHORT-CIRCUITED retrieval: the
      cache-key guard sat before the fetch, and the key carried every dimension
      that could change the corpus. Both assertions were correct.

      They described a fast path around a purchase. The CTO ruling removes the
      purchase, so there is no path to go around: the Map reads the retained
      store and never retrieves. "Preferred over live retrieval" has become
      "instead of live retrieval", which is what this suite was always reaching
      for.
    */
    it('the retained corpus seeds the cache at mount', () => {
      expect(mapClient).toContain('useState<CachedByCountry>(() => retainedCountryCorpora())');
    });

    it('and there is no retrieval left for it to short-circuit', () => {
      expect(mapClient).not.toContain('fetchCountryNews');
      expect(mapClient).not.toContain('const loadCountry = useCallback');
    });

    it('a country with NO retained corpus is simply empty — it does not go and buy one', () => {
      /*
        The honest cold state. Nothing in the client reacts to a cache miss by
        retrieving, because there is nothing to retrieve with.
      */
      expect(mapClient).not.toContain('if (cache[key]) return;');
      expect(mapClient).not.toMatch(/\bfetch\s*\(/);
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
      /*
        ══ SUPERSEDED — THERE IS NO PROVIDER FAILURE PATH LEFT TO GUARD ══════

        The reasoning above is still right and is why it is kept verbatim: a
        failed retrieval must never blank evidence the reader already had. It
        described the catch block inside the country fetch.

        The Map no longer performs that fetch, so it has no catch block, no
        error state to set and no way for a provider hiccup to touch the
        retained corpus at all. The protection is now structural rather than
        conditional — which is the strongest version of what this test wanted.

        The equivalent guard for the WORLD feed, which the Map does still read,
        is asserted immediately below and is unchanged.
      */
      expect(mapClient).not.toContain('fetchCountryNews');
      expect(mapClient).not.toContain('} catch (err) {');
      /* And nothing anywhere clears the retained corpus. */
      expect(mapClient).not.toContain('retainCountryCorpus(');
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
      /*
        ══ SUPERSEDED — THERE IS NO RETRIEVAL CALLBACK TO DEPEND ON ANYTHING ══

        The property was: `period` must not be a dependency of the retrieval
        callback, because rebuilding it on every period change could re-trigger
        retrieval — which would make 24h/7d/30d cost money.

        With the callback gone the property holds absolutely rather than by
        dependency hygiene: changing the period cannot re-trigger a retrieval
        that does not exist. The test above this one still proves the period
        control is a bare state setter, which is the half that remains
        observable.
      */
      expect(mapClient).not.toContain('const loadCountry = useCallback');
      expect(mapClient).not.toContain('t.genericFetchError');
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

        R5 moved the world corpus to the NON-EXECUTING route, leaving one call
        that could cost something — the country retrieval. The provider-boundary
        ruling removes that one too, so the count is now simply: ONE entry
        point, and it cannot execute a provider at any frequency.
      */
      expect(mapClient.split('fetchRetainedTopHeadlines(').length - 1).toBe(1);
      expect(mapClient.split('fetchTopHeadlines(').length - 1).toBe(0);
      expect(mapClient.split('fetchCountryNews(').length - 1).toBe(0);
      expect(mapClient).not.toContain('fetchSearchNews(');
    });
  });
});
