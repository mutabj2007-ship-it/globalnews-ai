import { readFileSync } from 'fs';
import { join } from 'path';

import {
  COUNTRY_RETRIEVAL_REASONS,
  FORBIDDEN_RETRIEVAL_TRIGGERS,
  countryParamFor,
  isCountryRetrievalReason,
} from './countryRetrievalAuthority';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * R2 — THE COUNTRY RETRIEVAL AUTHORITY
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `MAP-GNEWS-QUOTA-REGRESSION-1` / `MAP-EAST-AFRICA-REGION-COLLAPSE-1`.
 *
 * These are unit and source assertions. They are NOT the primary guard — the
 * primary guard is the driven-browser suite, because source-reading is exactly
 * what passed while the deployed application spent quota. These exist to pin
 * the contract's shape; the browser suite proves the behaviour.
 */

const CLIENT = readFileSync(
  join(__dirname, '..', '..', '..', 'components', 'map', 'MapPageClient.tsx'),
  'utf-8',
);

const CLIENT_CODE = CLIENT.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('R2 · only a deliberate country action may authorize retrieval', () => {
  it('POSITIVE CONTROL — the explicit-action reasons are admissible', () => {
    for (const reason of COUNTRY_RETRIEVAL_REASONS) {
      expect(isCountryRetrievalReason(reason)).toBe(true);
    }

    expect(COUNTRY_RETRIEVAL_REASONS).toHaveLength(2);
  });

  it('EVERY forbidden trigger is inadmissible', () => {
    /*
      The ruling's list, asserted rather than assumed. Region selection, CITY
      selection, camera motion, map centering, hydration, URL reconciliation,
      breadcrumb reconstruction, zoom, pan and positional geography.

      CITY_SELECTION arrived with the CITY selection kind: §11 of the map
      convergence ruling makes "zero executing-provider calls for CITY
      selection" a release gate, and the evidence ceiling stays at COUNTRY, so
      retrieving Rwanda because a reader looked at Kigali would spend a call on
      a country they never chose.

      The count moves 9 -> 10 with it, and it stays pinned for the reason it
      always was: a trigger must not be able to leave this list quietly.
      Growing it is a deliberate act; shrinking it fails here.
    */
    for (const trigger of FORBIDDEN_RETRIEVAL_TRIGGERS) {
      expect(isCountryRetrievalReason(trigger)).toBe(false);
    }

    expect(FORBIDDEN_RETRIEVAL_TRIGGERS).toContain('CITY_SELECTION');
    /*
      9 -> 10 with CITY_SELECTION, then 10 -> 15 when the country-selection
      ruling retired MAP_COUNTRY_CLICK, EXPLICIT_COUNTRY_SELECTION and
      CATEGORY_CHANGE_ON_SELECTED_COUNTRY and added COUNTRY_SELECTION and
      SEARCH_COUNTRY_COMMIT beside them. The retired reasons are kept here BY
      NAME so re-adding one fails a test rather than passing review.
    */
    for (const retired of [
      'COUNTRY_SELECTION',
      'MAP_COUNTRY_CLICK',
      'EXPLICIT_COUNTRY_SELECTION',
      'CATEGORY_CHANGE_ON_SELECTED_COUNTRY',
      'SEARCH_COUNTRY_COMMIT',
    ]) {
      expect(FORBIDDEN_RETRIEVAL_TRIGGERS).toContain(retired);
    }

    expect(FORBIDDEN_RETRIEVAL_TRIGGERS).toHaveLength(15);
  });

  it('and the two sets cannot overlap', () => {
    for (const reason of COUNTRY_RETRIEVAL_REASONS) {
      expect(FORBIDDEN_RETRIEVAL_TRIGGERS).not.toContain(reason);
    }
  });

  it('nothing else is admissible, including plausible near-misses', () => {
    for (const value of [
      '',
      'true',
      'EXPLICIT',
      'explicit_country_selection',
      'COUNTRY',
      'SELECTION',
      undefined,
      null,
      true,
      1,
      {},
    ]) {
      expect(isCountryRetrievalReason(value)).toBe(false);
    }
  });
});

describe('THE GATE IS GONE, BECAUSE THE DOOR IS GONE', () => {
  /*
    ══ SUPERSEDED, AND BY SOMETHING STRICTLY STRONGER ══════════════════════

    This block used to prove that loadCountry was the SINGLE gate: exactly
    one fetchCountryNews call site, one guard, the guard before every mutation,
    every caller naming a reason. Those assertions were correct and they held.

    Live acceptance then showed the thing they were protecting was the wrong
    thing. Selecting Kenya issued GET /news/country/KEN and the backend
    executed GNews — PERMITTED by the gate, because MAP_COUNTRY_CLICK was a
    legitimate reason. The CTO ruling moves the boundary: navigation and
    selection are provider-free, and retrieval happens only behind an explicit
    reader action.

    So the Map no longer has a gate, because it no longer has a door. The
    function is deleted, the client is not imported, and the assertions below
    are the stronger form of the old ones: not "one guarded call site" but NONE.
  */

  it('the Map has NO country-retrieval call site at all', () => {
    expect(CLIENT_CODE.split('fetchCountryNews(').length - 1).toBe(0);
  });

  it('and cannot acquire one by accident — the client is not even imported', () => {
    expect(CLIENT_CODE).not.toContain('@/lib/api/countryApi');
    expect(CLIENT_CODE).not.toContain('fetchCountryNews');
  });

  it('the retrieval function itself is gone, not merely unreferenced', () => {
    /*
      Left dormant behind a stricter reason it would be the obvious thing for a
      future handler to reach for. Deleted, it cannot be.
    */
    expect(CLIENT_CODE).not.toContain('const loadCountry = useCallback');
  });

  it('selection now sets scope only, and says so at the call sites', () => {
    expect(CLIENT_CODE).toContain('selectCountryScope');
    expect(CLIENT_CODE).toContain('setSelectedCountry(country)');
  });

  it('the Map names no executing news endpoint', () => {
    expect(CLIENT_CODE).not.toContain('/news/country');
  });

  it('retained evidence still seeds the cache, so selection still SHOWS what is held', () => {
    expect(CLIENT_CODE).toContain('retainedCountryCorpora()');
  });
});

describe('R2 · HYDRATION DOES NOT RETRIEVE — the quota leak itself', () => {
  it('the mount effect no longer calls loadCountry', () => {
    /*
      THE DEFECT, IN ONE ASSERTION.

      The mount effect read `?country=` and called loadCountry unconditionally,
      so every load, reload, restore and shared link spent provider quota for
      whatever ISO-3 was in the address bar, with no user in the loop. That is
      what turned one wrong camera-derived frame into a permanent, repeating
      cost.
    */
    const mount = CLIENT_CODE.slice(
      CLIENT_CODE.indexOf("const params = new URLSearchParams(window.location.search)"),
      CLIENT_CODE.indexOf('setRestored(true);'),
    );

    expect(mount.length).toBeGreaterThan(0);
    expect(mount).not.toContain('loadCountry');
  });

  it('but it still restores the selection, so a shared link is not broken', () => {
    const mount = CLIENT_CODE.slice(
      CLIENT_CODE.indexOf("const params = new URLSearchParams(window.location.search)"),
      CLIENT_CODE.indexOf('setRestored(true);'),
    );

    expect(mount).toContain('setSelectedCountry(country)');
    expect(mount).toContain('setSpatialSelection');
  });

  it('and the retained corpus still seeds the cache at mount — free reuse', () => {
    /*
      What replaces the retrieval is NOT nothing. A country whose corpus is
      still inside the 300s TTL renders immediately and costs no request.
    */
    expect(CLIENT_CODE).toContain('useState<CachedByCountry>(() => retainedCountryCorpora())');
  });
});

describe('R2 · the URL may only name a semantically selected country', () => {
  it('country= is written through the semantic gate, not from selectedCountry alone', () => {
    expect(CLIENT_CODE).toContain('countryParamFor(spatialSelection');
    expect(CLIENT_CODE).not.toMatch(/params\.set\('country', selectedCountry\.iso3\)/);
  });

  it('a REGION selection yields no country parameter', () => {
    /*
      MAP-EAST-AFRICA-REGION-COLLAPSE-1. This is what stopped
      `?country=CAN&sel=region:eastern-africa` — the panel describing one place
      and the rail another — and, with hydration no longer retrieving, what
      stops the collapse being re-spent on the next load.
    */
    expect(countryParamFor({ kind: 'REGION', id: 'region:eastern-africa' }, 'CAF')).toBeNull();
    expect(countryParamFor({ kind: 'REGION', id: 'region:eastern-africa' }, 'RWA')).toBeNull();
  });

  it('a stale country that disagrees with the selection is dropped', () => {
    expect(countryParamFor({ kind: 'COUNTRY', id: 'RWA' }, 'CAF')).toBeNull();
  });

  it('no selection yields no country parameter', () => {
    expect(countryParamFor(null, 'CAF')).toBeNull();
  });

  it('POSITIVE CONTROL — an agreeing country IS written', () => {
    expect(countryParamFor({ kind: 'COUNTRY', id: 'RWA' }, 'RWA')).toBe('RWA');
  });
});

describe('R2 · no country is special-cased, and East Africa is untouched', () => {
  it('the authority names no ISO-3 at all', () => {
    const authority = readFileSync(join(__dirname, 'countryRetrievalAuthority.ts'), 'utf-8');
    const code = authority.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

    for (const iso3 of ['CAF', 'TCD', 'SWZ', 'COD', 'RWA', 'KEN', 'POL']) {
      expect(code).not.toContain(iso3);
    }
  });

  it('East Africa membership is read from the governed list, not redefined here', () => {
    /*
      CODE, NOT PROSE. My first version banned the string outright and failed on
      this file's own comment, which cites `?country=CAN&sel=region:eastern-africa`
      as the defect being closed. Explaining a region is not redefining one —
      the rule is that no MEMBERSHIP may be declared here.
    */
    const authority = readFileSync(join(__dirname, 'countryRetrievalAuthority.ts'), 'utf-8');
    const code = authority.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

    expect(code).not.toContain('eastern-africa');
    expect(code).not.toContain('DECLARED_PRODUCT_REGIONS');

    /* Positive control: the stripper did not simply empty the file. */
    expect(code).toContain('COUNTRY_RETRIEVAL_REASONS');
  });
});
