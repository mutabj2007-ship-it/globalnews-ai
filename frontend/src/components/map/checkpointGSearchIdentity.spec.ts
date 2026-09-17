import { readFileSync } from 'fs';
import { join } from 'path';

import { DEPLOYMENT_JUMP_TARGETS } from '@/lib/map/navigation/breadcrumbs';
import { searchPlaces, type PlaceResult } from '@/lib/map/search/placeSearch';
import { mergePlaceResults } from '@/lib/map/search/navigatorPlaceSearch';
import type { NavigatorPlace } from '@/lib/api/geoNavigatorApi';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CHECKPOINT G — KIGALI / SEARCH GEOGRAPHY IDENTITY
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ─── THE MEASURED SYMPTOM ─────────────────────────────────────────────────
 *
 * Searching "Kigali" returned three rows:
 *
 *     Kigali  REGION                 <- the local jump table
 *     Kigali  CITY    Rwanda         <- G's navigator, the city node
 *     Kigali  REGION  Rwanda         <- G's navigator, the admin-1 node
 *
 * Rows 2 and 3 are CORRECT and must not be collapsed: they are two genuine
 * rungs of one place, and the context line is what tells them apart. Row 1 is
 * the defect, and it is three defects at once.
 *
 * ─── G-1 · A CITY RUNG PUBLISHED AS A REGION ──────────────────────────────
 *
 * `DEPLOYMENT_JUMP_TARGETS` carries `{ id: 'kigali', rung: 'CITY' }`, and the
 * jump-target loop excluded only the COUNTRY rung — so a CITY-rung target was
 * published as `kind: 'REGION'` under a minted `region:kigali` id. A city
 * announced as a region, with an id asserting a region identity no gazetteer
 * holds. The loop had already learned this lesson for COUNTRY targets
 * ("searching rwanda returned it twice"); the same rule simply never reached
 * the city rung.
 *
 * ─── G-2 · THE STAND-DOWN COMPARED THE WRONG VOCABULARY ───────────────────
 *
 * `mergePlaceResults` suppressed a local REGION row only when
 * `navigator.some(p => p.kind === 'region')` — G's SUPRANATIONAL rung. But
 * `KIND_OF` renders admin1 and admin2 as REGION too, so for a query where the
 * navigator returns a city and an admin-1 and no supranational region, the
 * predicate was false and the identity-less local row stood its ground.
 *
 * ─── G-3 · TWO ROUTES TO KIGALI, OPPOSITE BEHAVIOUR ───────────────────────
 *
 * The breadcrumb jump path states the rule as settled: *"Kigali sits INSIDE
 * Rwanda, so clearing a Rwanda selection to move to Kigali would destroy a
 * compatible, correct state."* The SEARCH path cleared unconditionally — so
 * committing the Kigali row blanked the right rail and discarded the evidence
 * state, for a navigation strictly inside what was already selected.
 *
 * ─── THE REQUIRED TRACE ───────────────────────────────────────────────────
 *
 *   identity      PlaceResult.id — `city:kigali` (jump) or G's geographyId
 *   type          PlaceResult.kind, the RENDERING vocabulary
 *   precision     NavigatorPlace.navigationPrecision — of the PLACE, never of
 *                 the evidence; the two are separate types on purpose
 *   parent        PlaceResult.countryIso3, from G's published hierarchy
 *   selected      COUNTRY for a country row; a contained row leaves the
 *                 selection standing; an incompatible one clears it
 *   camera        one focus-bounds, never two
 *   right rail    follows the selection, so it no longer blanks
 *   evidence      unchanged by a contained navigation
 */

const stripComments = (src: string): string =>
  src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

const shell = stripComments(
  readFileSync(join(__dirname, 'shell', 'GlobalMapShell.tsx'), 'utf-8'),
);
const hook = readFileSync(
  join(__dirname, '..', '..', 'lib', 'map', 'search', 'navigatorPlaceSearch.ts'),
  'utf-8',
);
const apiClient = readFileSync(
  join(__dirname, '..', '..', 'lib', 'api', 'geoNavigatorApi.ts'),
  'utf-8',
);

const REGION_NAMES = {
  world: 'World',
  africa: 'Africa',
  eastAfrica: 'East Africa',
  europe: 'Europe',
  rwanda: 'Rwanda',
  kenya: 'Kenya',
  poland: 'Poland',
  kigali: 'Kigali',
};

const local = (query: string): readonly PlaceResult[] =>
  searchPlaces({ query, totals: [], regionNames: REGION_NAMES });

const navigatorPlace = (over: Partial<NavigatorPlace>): NavigatorPlace =>
  ({
    geographyId: 'city:rwa:kigali',
    kind: 'city',
    navigationPrecision: 'CITY',
    name: 'Kigali',
    aliases: [],
    matchedOn: 'Kigali',
    matchKind: 'EXACT',
    hierarchy: [{ geographyId: 'country:RWA', kind: 'country', name: 'Rwanda', code: 'RWA' }],
    datasetAttribution: 'test',
    ...over,
  }) as NavigatorPlace;

describe('G-1 — a CITY-rung jump target is a city, not a region', () => {
  it('the table really does declare Kigali at the CITY rung', () => {
    expect(DEPLOYMENT_JUMP_TARGETS.find((t) => t.id === 'kigali')?.rung).toBe('CITY');
  });

  it('so the row it produces is typed CITY', () => {
    const kigali = local('kigali').find((r) => r.label === 'Kigali');

    expect(kigali?.kind).toBe('CITY');
  });

  it('and its id no longer asserts a region identity', () => {
    /* `region:kigali` claimed a region that no gazetteer holds. */
    const kigali = local('kigali').find((r) => r.label === 'Kigali');

    expect(kigali?.id).toBe('city:kigali');
    expect(kigali?.id).not.toContain('region:');
  });

  it('a supranational target is still a REGION, with its id unchanged', () => {
    /* The correction is narrow: only the city rung was mistyped. */
    const eastAfrica = local('east africa').find((r) => r.label === 'East Africa');

    expect(eastAfrica?.kind).toBe('REGION');
    expect(eastAfrica?.id).toBe('region:eastAfrica');
  });

  it('and a jump row still carries NO region identity, whatever its kind', () => {
    /*
      The load-bearing invariant: a label over a hard-coded box must never
      acquire an identity, because the shell branches on identity.
    */
    for (const row of [...local('kigali'), ...local('east africa')]) {
      if (row.id.startsWith('city:') || row.id.startsWith('region:')) {
        expect(row.region).toBeUndefined();
      }
    }
  });

  it('COUNTRY-rung targets are still skipped entirely', () => {
    /* Rwanda comes from the country table, with its evidence annotation. */
    expect(local('rwanda').filter((r) => r.label === 'Rwanda' && r.kind === 'REGION')).toHaveLength(
      0,
    );
  });
});

describe('G-2 — the local row stands down for the kind a reader actually sees', () => {
  const city = navigatorPlace({});
  const admin1 = navigatorPlace({
    geographyId: 'admin1:rwa:kigali-city',
    kind: 'admin1',
    navigationPrecision: 'PROVINCE',
  });

  it('an admin-1 rendered as REGION suppresses the local REGION row', () => {
    /*
      The exact case that failed: no supranational region in the response, so
      the old predicate was false and both rows rendered.
    */
    const merged = mergePlaceResults(
      [{ id: 'region:kigali', kind: 'REGION', label: 'Kigali', annotation: { kind: 'REFERENCE' } }],
      [admin1],
      [],
    );

    expect(merged.filter((r) => r.id === 'region:kigali')).toHaveLength(0);
    expect(merged.map((r) => r.id)).toContain('admin1:rwa:kigali-city');
  });

  it('a navigator city suppresses the local CITY row', () => {
    const merged = mergePlaceResults(
      [{ id: 'city:kigali', kind: 'CITY', label: 'Kigali', annotation: { kind: 'REFERENCE' } }],
      [city],
      [],
    );

    expect(merged.filter((r) => r.id === 'city:kigali')).toHaveLength(0);
  });

  it('so "Kigali" yields exactly the two real rungs, not three rows', () => {
    /* The symptom, gone. */
    const merged = mergePlaceResults(local('kigali'), [city, admin1], []);

    expect(merged.filter((r) => r.label === 'Kigali')).toHaveLength(2);
    expect(merged.map((r) => r.kind).sort()).toEqual(['CITY', 'REGION']);
  });

  it('and the two rungs are NOT collapsed — they are told apart by context', () => {
    /*
      CTO: the rungs are genuine and must not be merged. What was missing was
      the sentence that distinguishes them.
    */
    const merged = mergePlaceResults([], [city, admin1], []);

    expect(merged).toHaveLength(2);
    for (const row of merged) expect(row.context).toBe('Rwanda');
    expect(new Set(merged.map((r) => r.id)).size).toBe(2);
  });

  it('when the navigator answers with nothing, every local row survives', () => {
    /*
      H-GEO-2: the jump table is the offline fallback and must not be deleted.
      Suppression is conditional on a better row EXISTING.
    */
    const rows = local('kigali');

    expect(mergePlaceResults(rows, [], []).map((r) => r.id)).toEqual(rows.map((r) => r.id));
  });

  it('a local COUNTRY row is never suppressed by kind', () => {
    /* Only it carries the evidence annotation for the current mode and period. */
    const countryRow: PlaceResult = {
      id: 'RWA',
      kind: 'COUNTRY',
      label: 'Rwanda',
      countryIso3: 'RWA',
      annotation: { kind: 'EVIDENCE', reportCount: 4, geographyCount: 1 },
    };
    const navCountry = navigatorPlace({
      geographyId: 'country:UGA',
      kind: 'country',
      name: 'Uganda',
      hierarchy: [],
    });

    expect(mergePlaceResults([countryRow], [navCountry], []).map((r) => r.id)).toContain('RWA');
  });
});

describe('G-3 — a contained navigation keeps the selection, and the rail with it', () => {
  it('the search path tests containment before clearing', () => {
    expect(shell).toContain('const containedInSelection =');
    expect(shell).toContain("selection?.kind === 'COUNTRY' &&");
    expect(shell).toContain('result.countryIso3 === selection.id;');
  });

  it('and clears ONLY an incompatible selection', () => {
    expect(shell).toContain(
      'if (selection !== null && selection !== undefined && !containedInSelection) {',
    );
  });

  it('containment is read from the published parent, never parsed from an id', () => {
    /* countryIso3 comes from G's hierarchy via navigatorCountryIso3. */
    expect(shell).not.toMatch(/countryIso3\s*=\s*[^;]*\.split\(/);
    expect(shell).not.toContain("geographyId.split(':')");
  });

  it('still exactly one camera commit per action', () => {
    /*
      The documented regression this guards: a selection change plus a
      focus-bounds produced two history entries, and Previous View landed on a
      frame nobody saw.
    */
    const branch = shell.slice(shell.indexOf('const containedInSelection ='));
    const segment = branch.slice(0, branch.indexOf('}, ['));

    expect(segment.match(/dispatch\(\{ kind: 'focus-bounds'/g) ?? []).toHaveLength(1);
  });

  it('a COUNTRY result still selects and lets the fit effect frame it', () => {
    /* Unchanged — it must not acquire a focus-bounds of its own. */
    expect(shell).toContain("if (result.kind === 'COUNTRY' && result.countryIso3) {");
    expect(shell).toContain("onSelectionChange?.({ kind: 'COUNTRY', id: result.countryIso3 });");
  });

  it('and a real region still takes the RSC-1 transition', () => {
    expect(shell).toContain("onSelectionChange?.({ kind: 'REGION', id: committed.geographyId });");
    expect(shell).toContain('adoptRegion(committed);');
  });

  it('no city selection kind was invented', () => {
    /*
      A city is not a selectable evidence geography, and the evidence ceiling is
      COUNTRY. Inventing one would put a precision on screen the producer cannot
      supply.
    */
    expect(shell).not.toContain("kind: 'CITY', id:");
  });
});

describe('G — the request economy, and the providers it must never touch', () => {
  describe('ONE REQUEST PER SETTLED QUERY', () => {
    it('keystrokes are debounced before anything is spent', () => {
      expect(hook).toContain('const DEBOUNCE_MS = 180;');
      expect(hook).toContain('window.setTimeout(');
    });

    it('a superseded request is aborted, not merely ignored', () => {
      /* Otherwise a fast typist holds several sockets open at once. */
      expect(hook).toContain('const controller = new AbortController();');
      expect(hook).toContain('controller.abort();');
    });

    it('and a late response for an old query cannot overwrite a newer one', () => {
      /*
        Two guards, because they fail differently: abort stops the request,
        the ticket stops an already-resolved stale response.
      */
      expect(hook).toContain('const ticket = (sequence.current += 1);');
      expect(hook).toContain('if (ticket !== sequence.current) return;');
    });

    it('the timer is cleared on cleanup, so a re-render cannot leave one running', () => {
      expect(hook).toContain('window.clearTimeout(timer);');
    });

    it('a query under two characters spends nothing at all', () => {
      expect(hook).toContain('if (!deep || trimmed.length < 2) {');
    });

    it('and the deep search is opt-in rather than inherited', () => {
      expect(hook).toContain('deep = true');
      expect(hook).toContain('readonly deep?: boolean;');
    });
  });

  describe('PROVIDER-SAFE: GNEWS 0, NEWS RETRIEVAL 0, OPENAI 0', () => {
    it('the search client calls exactly one route, and it is the gazetteer', () => {
      expect(apiClient).toContain('/geo/search');
      expect(apiClient).not.toContain('/news');
      expect(apiClient).not.toContain('/analysis');
    });

    it('nothing in the search path names a news or analysis client', () => {
      for (const source of [hook, apiClient]) {
        expect(source).not.toContain('fetchTopHeadlines');
        expect(source).not.toContain('fetchCountryNews');
        expect(source).not.toContain('analyzeNews');
        expect(source).not.toContain('gnews');
      }
    });

    it('and the local engine issues no request whatsoever', () => {
      const localEngine = readFileSync(
        join(__dirname, '..', '..', 'lib', 'map', 'search', 'placeSearch.ts'),
        'utf-8',
      );

      expect(localEngine).not.toMatch(/\bfetch\(/);
      expect(localEngine).not.toContain('await ');
    });

    it('the gazetteer request times out well inside the map feed budget', () => {
      /* A stale suggestion list is worse than none. */
      expect(apiClient).toContain('const REQUEST_TIMEOUT_MS = 4000;');
    });

    it('and a failed lookup invents nothing to fill the list', () => {
      expect(apiClient).toMatch(/no local fallback list, no fuzzy\s+\*? ?second pass/);
    });
  });
});
