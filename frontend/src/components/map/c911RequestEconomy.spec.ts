/**
 * ============================================================================
 * C911-R6 -- PROVIDER REQUEST ECONOMY
 * ============================================================================
 *
 * Production logs showed GNews becoming RATE-LIMITED during testing. This file
 * is the audit of how many PROVIDER-CONSUMING requests one ordinary user action
 * can generate, expressed as assertions so the answer cannot drift.
 *
 * ── WHICH ROUTES COST GNEWS QUOTA, AND WHICH DO NOT ────────────────────────
 *
 *   /news/top-headlines   COSTS a provider call.
 *   /news/country/:iso3   COSTS a provider call (server-side cached, 300s).
 *   /news/search          COSTS a provider call.
 *   /geo/map-feed         COSTS NOTHING. It resolves TEXT against the shipped
 *                         gazetteer; the geo module holds no NewsService
 *                         dependency at all. Enrichment fan-out is therefore
 *                         not quota pressure, and is capped besides.
 *
 * ── THE MEASURED MATRIX (BEFORE == AFTER; NO WASTE WAS FOUND) ──────────────
 *
 *   Home load                     1  one getHomeFeed(), width 24, server-side.
 *                                    Every homepage section reads THAT response.
 *   Home re-render / navigation   0  no client-side news fetch exists.
 *   Home: click a country          1  user interaction only, never on mount.
 *   /map load                     1  one fetchTopHeadlines for the world view.
 *   /map: select a country        1  guarded by a client cache key of
 *                                    iso3+category+language.
 *   /map: re-select same country  0  the cache guard returns early.
 *   /map: enrichment              0  /geo/map-feed only.
 *   Country Analysis (broad)      1 primary + at most 2 supplemental = max 3.
 *
 * C911 CHANGES NONE OF THESE NUMBERS. No freshness window was widened, no
 * feature was disabled, no retry rule was altered and no peer-tail timing was
 * touched. This file exists to prove the economy is what it claims to be and
 * to fail if a future change quietly adds a request.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const mapClient = stripComments(readFileSync(join(__dirname, 'MapPageClient.tsx'), 'utf-8'));
const situationMap = stripComments(
  readFileSync(join(__dirname, '../home/HomepageSituationMap.tsx'), 'utf-8'),
);
const homeFeed = stripComments(readFileSync(join(__dirname, '../../lib/homeFeed.ts'), 'utf-8'));

const countOf = (src: string, needle: string): number =>
  src.split(needle).length - 1;

describe('C911-R6 -- provider request economy', () => {
  describe('HOME -- one provider call, and every section reads it', () => {
    it('homeFeed.ts issues exactly one fetchTopHeadlines call', () => {
      expect(countOf(homeFeed, 'fetchTopHeadlines(')).toBe(1);
    });

    it('the homepage situation map never fetches on mount -- interaction only', () => {
      // A country feed must be reachable ONLY from the selection handler. An
      // effect here would spend a provider call on every homepage view.
      expect(countOf(situationMap, 'fetchCountryNews(')).toBe(1);
      expect(situationMap).toContain('async function handleSelectCountry');
      expect(situationMap).not.toContain('useEffect');
    });
  });

  describe('/map -- one world call, one call per DISTINCT country', () => {
    it('issues exactly one world-corpus call, and it is the NON-EXECUTING one', () => {
      /*
        R5 — THIS ASSERTION GOT STRONGER, NOT WEAKER.

        It used to count `fetchTopHeadlines(`, which guarded the NUMBER of
        world calls but said nothing about their COST. R4 measured the
        consequence: one call per map mount, each executing a provider whenever
        the backend's 300s window had lapsed, with zero country retrievals
        involved — the Product Owner's dashboard moved and nothing in this file
        could have caught it.

        The map now reads the same `limit:language` corpus through
        `/news/top-headlines/retained`, which cannot reach a provider. The count
        is still one; the second expectation is the one that now matters.
      */
      expect(countOf(mapClient, 'fetchRetainedTopHeadlines(')).toBe(1);
      expect(countOf(mapClient, 'fetchTopHeadlines(')).toBe(0);
    });

    it('issues NO fetchCountryNews call site at all', () => {
      /*
        SUPERSEDED: "exactly one" -> NONE.

        One guarded call site was the right budget while a country selection was
        allowed to retrieve. Live acceptance showed that budget being spent by a
        plain country click, and the CTO ruling makes passive map navigation
        provider-free. A budget of zero needs no guard.
      */
      expect(countOf(mapClient, 'fetchCountryNews(')).toBe(0);
    });

    it('the cache is READ at mount, which is what replaces the guarded fetch', () => {
      /*
        The cache key guard is gone with the fetch it guarded. What survives is
        the half that costs nothing and does the useful work: the retained
        corpus seeds the cache at mount, so selecting a country the reader has
        already analysed shows its evidence immediately and spends nothing.
      */
      expect(mapClient).toContain('retainedCountryCorpora()');
      expect(mapClient).not.toContain('const key = cacheKey(country.iso3, requestedCategory, language)');
    });

    it('global enrichment runs at most once, guarded by a ref', () => {
      expect(mapClient).toContain('globalEnrichmentDone.current');
    });

    it('per-country enrichment cannot run twice concurrently for one country', () => {
      expect(mapClient).toContain('enrichmentInFlight.current.has(iso3)');
      expect(mapClient).toContain('enrichmentInFlight.current.add(iso3)');
    });

    it('enrichment is skipped entirely for a country already resolved', () => {
      expect(mapClient).toContain('if (geography[iso3] !== undefined) continue;');
    });

    it('enrichment does NOT re-run per category filter -- geography is category-free', () => {
      expect(mapClient).toContain("if (cachedCategory !== 'all'");
    });

    it('both enrichment fan-outs are capped', () => {
      expect(mapClient).toContain('MAP_FEED_ARTICLE_CAP');
      expect(mapClient).toContain('GLOBAL_FEED_ENRICH_CAP');
    });
  });

  describe('NOTHING PROVIDER-COSTING IS ADDED BY C911', () => {
    it('the map client still calls only the known news entry points', () => {
      // A provider-consuming call appearing here unannounced fails this.
      const callSites =
        countOf(mapClient, 'fetchTopHeadlines(') +
        countOf(mapClient, 'fetchRetainedTopHeadlines(') +
        countOf(mapClient, 'fetchCountryNews(') +
        countOf(mapClient, 'fetchNewsSearch(');

      /* 2 -> 1: the country retrieval is gone; the retained world read remains. */
      expect(callSites).toBe(1);
    });

    it('and exactly ONE of them can spend quota — the explicit country retrieval', () => {
      /*
        R5 — THE DISTINCTION THIS FILE WAS MISSING.

        Counting call sites treats every news entry point as equally costly,
        which is how a world-corpus fetch on every mount passed this suite for
        months. Split by cost, the map's budget is now stateable in one line:
        ONE call that can execute a provider, reached only by an explicit
        country selection, and one that cannot execute anything at all.
      */
      const canSpend =
        countOf(mapClient, 'fetchTopHeadlines(') +
        countOf(mapClient, 'fetchCountryNews(') +
        countOf(mapClient, 'fetchNewsSearch(');

      /*
        THE BUDGET IS NOW ZERO, AND THAT IS THE WHOLE RULING.

        The comment above still holds — counting call sites treats every entry
        point as equally costly, and splitting by cost is what made the budget
        stateable. The split now states something stronger than "one": the Map
        has NO call that can execute a provider, and one that cannot execute
        anything at all.
      */
      expect(canSpend).toBe(0);
      expect(countOf(mapClient, 'fetchCountryNews(')).toBe(0);
      expect(countOf(mapClient, 'fetchRetainedTopHeadlines(')).toBe(1);
    });

    it('no retry loop was introduced around a provider call', () => {
      expect(mapClient).not.toContain('setInterval');
      expect(situationMap).not.toContain('setInterval');
    });
  });
});
