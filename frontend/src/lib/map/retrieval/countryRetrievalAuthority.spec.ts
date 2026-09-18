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
  it('POSITIVE CONTROL — the three real reasons are admissible', () => {
    for (const reason of COUNTRY_RETRIEVAL_REASONS) {
      expect(isCountryRetrievalReason(reason)).toBe(true);
    }

    expect(COUNTRY_RETRIEVAL_REASONS).toHaveLength(3);
  });

  it('EVERY forbidden trigger is inadmissible', () => {
    /*
      The ruling's list, asserted rather than assumed. Region selection, camera
      motion, map centering, hydration, URL reconciliation, breadcrumb
      reconstruction, zoom, pan and positional geography.
    */
    for (const trigger of FORBIDDEN_RETRIEVAL_TRIGGERS) {
      expect(isCountryRetrievalReason(trigger)).toBe(false);
    }

    expect(FORBIDDEN_RETRIEVAL_TRIGGERS).toHaveLength(9);
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

describe('R2 · loadCountry is the single gate, and it consumes the reason', () => {
  it('there is still exactly ONE fetchCountryNews call site', () => {
    expect(CLIENT_CODE.split('fetchCountryNews(').length - 1).toBe(1);
  });

  it('loadCountry takes a reason and REFUSES without one', () => {
    /*
      Consumed, not decorative: if a future edit drops the guard, this fails
      even though the signature still looks right.
    */
    expect(CLIENT_CODE).toContain('reason: CountryRetrievalReason');
    expect(CLIENT_CODE).toContain('if (!isCountryRetrievalReason(reason)) return;');
  });

  it('R3.1 — the refusal precedes EVERY STATE MUTATION, not just the fetch', () => {
    /*
      THE ORDERING R3 PROVED INSUFFICIENT.

      R2 placed this guard after `setSelectedCountry`, so an unauthorised
      caller was stopped from retrieving but still moved the right rail and
      highlighted a country the reader never chose. Blocking the spend while
      letting the wrong country appear is a quieter version of the same defect.

      The guard must therefore come before the FIRST mutation in the function,
      not merely before the network call.
    */
    const body = CLIENT_CODE.slice(CLIENT_CODE.indexOf('const loadCountry = useCallback'));
    const guard = body.indexOf('if (!isCountryRetrievalReason(reason)) return;');
    const setCountry = body.indexOf('setSelectedCountry(country);');
    const setErr = body.indexOf('setError(null);');
    const fetchAt = body.indexOf('await fetchCountryNews(');

    expect(guard).toBeGreaterThan(0);
    expect(setCountry).toBeGreaterThan(guard);
    expect(setErr).toBeGreaterThan(guard);
    expect(fetchAt).toBeGreaterThan(guard);
  });

  it('and there is exactly ONE guard, so it cannot be half-moved', () => {
    const body = CLIENT_CODE.slice(CLIENT_CODE.indexOf('const loadCountry = useCallback'));
    const occurrences = body.split('if (!isCountryRetrievalReason(reason)) return;').length - 1;

    expect(occurrences).toBe(1);
  });

  it('every call site names a reason — none calls with two arguments', () => {
    const calls = [...CLIENT_CODE.matchAll(/loadCountry\(([^)]*)\)/g)].map((m) => m[1]);

    expect(calls.length).toBeGreaterThan(0);

    for (const args of calls) {
      /* signature declaration aside, each invocation must pass three arguments */
      if (args.includes(':')) continue;
      expect(args.split(',').length).toBe(3);
    }
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
