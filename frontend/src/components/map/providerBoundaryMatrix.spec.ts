import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  COUNTRY_RETRIEVAL_REASONS,
  FORBIDDEN_RETRIEVAL_TRIGGERS,
  countryParamFor,
  isCountryRetrievalReason,
} from '@/lib/map/retrieval/countryRetrievalAuthority';

/**
 * ══ THE ZERO-PROVIDER MATRIX — R2-A ═══════════════════════════════════════
 *
 * THE DEFECT, MEASURED LIVE. Selecting Kenya issued `GET /news/country/KEN`;
 * selecting Rwanda issued `/RWA`; the backend log showed GNews Search executing
 * for each. Nothing was broken — the old authority PERMITTED it, because
 * `MAP_COUNTRY_CLICK` and `EXPLICIT_COUNTRY_SELECTION` were retrieval reasons.
 *
 * A NOTE ON THAT SECOND NAME, because it is the trap this file exists to keep
 * shut: `EXPLICIT_COUNTRY_SELECTION` was not explicit RETRIEVAL. The word
 * "explicit" described the SELECTION — the reader really did choose that
 * country. But choosing a place on a map is NAVIGATION, and the ruling is that
 * navigation is provider-free. An identifier containing "explicit" earns
 * nothing.
 *
 * WHAT IS PROVEN HERE. The matrix the ruling asks for, as source-level
 * reachability rather than a mocked call count: for every passive scenario
 * there is no reachable code path that could execute a provider, because the
 * client that would do it is not imported and the function that called it does
 * not exist.
 *
 * WHY THAT IS STRONGER THAN A SPY. A spy proves one run did not call a thing. A
 * missing import proves no run can.
 */

const SRC = resolve(__dirname, '..', '..');

const raw = (...parts: string[]): string => readFileSync(join(SRC, ...parts), 'utf-8');

const code = (...parts: string[]): string =>
  raw(...parts)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const CLIENT = code('components', 'map', 'MapPageClient.tsx');
const SHELL = code('components', 'map', 'shell', 'GlobalMapShell.tsx');

/** Anything whose presence would mean a provider could run. */
const EXECUTING = [
  '/news/country',
  '/analysis/news',
  'fetchCountryNews',
  'fetchTopHeadlines(',
  'fetchNewsSearch',
  'GNews',
  'OpenAI',
  'EventRegistry',
  'GDELT',
] as const;

/* ══════════════════════════════════════════════════════════════════════════
   1 — THE PASSIVE SCENARIOS, ONE ASSERTION EACH
   ══════════════════════════════════════════════════════════════════════════ */

describe('every passive Map scenario is provider-free', () => {
  /*
    Each row is a scenario from the ruling. They share one proof because they
    share one mechanism: none of them can reach a provider, since the Map holds
    no reference to one. Naming them individually is what makes a regression
    report which scenario a reviewer should reproduce.
  */
  const PASSIVE = [
    'Kenya selection',
    'Rwanda selection',
    'Poland selection',
    'COUNTRY selection WITH a retained corpus',
    'COUNTRY selection WITHOUT a retained corpus',
    'category change while a country is selected',
    '24h / 7d / 30d while a country is selected',
    'COUNTRY -> CITY',
    'CITY -> COUNTRY',
    'REGION -> COUNTRY',
    'refresh / hydration of a country URL',
    'World, pan, zoom',
  ] as const;

  for (const scenario of PASSIVE) {
    it(`${scenario} — 0 provider execution`, () => {
      for (const marker of EXECUTING) {
        expect({ scenario, marker, reachable: CLIENT.includes(marker) }).toEqual({
          scenario,
          marker,
          reachable: false,
        });
      }
    });
  }

  it('the Map imports no news client at all — the guarantee is structural', () => {
    expect(CLIENT).not.toContain('@/lib/api/countryApi');
    expect(CLIENT).not.toContain('const loadCountry = useCallback');
  });

  it('and the shell it renders names no executing endpoint either', () => {
    for (const marker of EXECUTING) {
      expect({ marker, reachable: SHELL.includes(marker) }).toEqual({ marker, reachable: false });
    }
  });

  it('the ONE surviving news read is the retained, non-executing route', () => {
    /*
      The Map calls the client; the ROUTE LITERAL lives in that client. Both
      halves are asserted so neither can drift: the Map reaches exactly one news
      function, and that function reaches the retained route.
    */
    expect(CLIENT.split('fetchRetainedTopHeadlines(').length - 1).toBe(1);
    expect(code('lib', 'api', 'newsApi.ts')).toContain('news/top-headlines/retained');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   2 — RETAINED EVIDENCE STILL WORKS, AND A COLD COUNTRY IS HONESTLY EMPTY
   ══════════════════════════════════════════════════════════════════════════ */

describe('retained evidence survives the boundary change', () => {
  it('the retained corpus seeds the cache at mount', () => {
    expect(CLIENT).toContain('useState<CachedByCountry>(() => retainedCountryCorpora())');
  });

  it('a selected country reads that cache, keyed by country + category + language', () => {
    expect(CLIENT).toContain('cache[cacheKey(selectedCountry.iso3, category, language)]');
  });

  it('a category change is a pure state write over what is already held', () => {
    const handler = CLIENT.slice(
      CLIENT.indexOf('function handleCategoryChange'),
      CLIENT.indexOf('const activeResponse'),
    );

    expect(handler).toContain('setCategory(value)');
    expect(handler).not.toContain('loadCountry');
    expect(handler).not.toMatch(/\bfetch\s*\(/);
  });

  it('a cold country goes and buys nothing — there is no miss handler', () => {
    /*
      The honest empty state. Nothing reacts to a cache miss by retrieving,
      because there is nothing to retrieve with.
    */
    expect(CLIENT).not.toContain('if (cache[key]) return;');
    expect(CLIENT).not.toMatch(/\bfetch\s*\(/);
  });

  it('geography and map-feed reads are untouched — they are not providers', () => {
    /*
      Explicitly permitted by the ruling, and asserted so a later provider sweep
      does not remove them by association. Again the Map holds the import and
      the client holds the route.
    */
    expect(CLIENT).toContain('@/lib/api/mapFeedApi');
    expect(code('lib', 'api', 'mapFeedApi.ts')).toContain('geo/map-feed');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   3 — THE EXPLICIT ANALYSIS HANDOFF STILL WORKS
   ══════════════════════════════════════════════════════════════════════════ */

describe('deliberate analysis is preserved, and the Map is not the one executing it', () => {
  it('Open Analysis still carries the selection off the Map', () => {
    const handler = CLIENT.slice(
      CLIENT.indexOf('const handleOpenAnalysis'),
      CLIENT.indexOf('const handleOpenAnalysis') + 1400,
    );

    expect(handler).toContain('router.push');
    expect(handler).toContain('/search?');
  });

  it('and it retrieves nothing on the way out', () => {
    const handler = CLIENT.slice(
      CLIENT.indexOf('const handleOpenAnalysis'),
      CLIENT.indexOf('const handleOpenAnalysis') + 1400,
    );

    expect(handler).not.toContain('fetchCountryNews');
    expect(handler).not.toMatch(/\bfetch\s*\(/);
  });

  it('the retained state the handoff depends on is still written before leaving', () => {
    /*
      MAP-ANALYSIS-RETURN: the Map saves what it was showing so coming back does
      not re-acquire it. Removing the country fetch must not have removed that.
    */
    expect(CLIENT).toContain('retainedMapState');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   4 — THE AUTHORITY ITSELF
   ══════════════════════════════════════════════════════════════════════════ */

describe('the retrieval authority names only explicit actions', () => {
  it('the approved reasons are pinned exactly', () => {
    expect([...COUNTRY_RETRIEVAL_REASONS].sort()).toEqual([
      'EXPLICIT_ANALYSIS_REQUEST',
      'EXPLICIT_RETRIEVAL_ACTION',
    ]);
  });

  it('every retired passive trigger is permanently forbidden BY NAME', () => {
    for (const retired of [
      'COUNTRY_SELECTION',
      'MAP_COUNTRY_CLICK',
      'EXPLICIT_COUNTRY_SELECTION',
      'CATEGORY_CHANGE_ON_SELECTED_COUNTRY',
      'SEARCH_COUNTRY_COMMIT',
      'CITY_SELECTION',
      'REGION_SELECTION',
      'CAMERA_MOTION',
      'MAP_CENTERING',
      'HYDRATION',
      'URL_RECONCILIATION',
      'BREADCRUMB_RECONSTRUCTION',
      'ZOOM',
      'PAN',
      'POSITIONAL_GEOGRAPHY',
    ]) {
      expect(FORBIDDEN_RETRIEVAL_TRIGGERS).toContain(retired);
      expect(isCountryRetrievalReason(retired)).toBe(false);
    }
  });

  it('the two sets are disjoint', () => {
    for (const reason of COUNTRY_RETRIEVAL_REASONS) {
      expect(FORBIDDEN_RETRIEVAL_TRIGGERS).not.toContain(reason);
    }
  });

  it('a name is not explicit merely because it contains the word', () => {
    /* The precise trap the ruling called out. */
    expect(isCountryRetrievalReason('EXPLICIT_COUNTRY_SELECTION')).toBe(false);
    expect(isCountryRetrievalReason('EXPLICIT')).toBe(false);
    expect(isCountryRetrievalReason('EXPLICIT_ANYTHING')).toBe(false);
  });

  it('the URL still names a country only when the selection IS that country', () => {
    expect(countryParamFor({ kind: 'COUNTRY', id: 'KEN' }, 'KEN')).toBe('KEN');
    expect(countryParamFor({ kind: 'CITY', id: 'city:RWA:kigali@0,0' }, 'RWA')).toBeNull();
    expect(countryParamFor({ kind: 'REGION', id: 'region:east-africa' }, 'RWA')).toBeNull();
    expect(countryParamFor(null, 'KEN')).toBeNull();
  });
});
