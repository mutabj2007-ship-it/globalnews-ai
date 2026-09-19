import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  COUNTRY_RETRIEVAL_REASONS,
  FORBIDDEN_RETRIEVAL_TRIGGERS,
  isCountryRetrievalReason,
} from '@/lib/map/retrieval/countryRetrievalAuthority';
import { hudProfile } from '@/lib/map/state/mapState';
import { GOVERNED_EAST_AFRICA_ID, governedRegionExtent } from '@/lib/map/navigation/breadcrumbs';
import { declaredProductRegion } from '@/lib/map/region/declaredProductRegions';
import { decodeSelection, encodeSelection } from '@/lib/map/state/mapUrl';

/**
 * ══ R2-B §§10, 11, 13, 14 — THE VALIDATION MATRIX ═════════════════════════
 *
 * One file for the four sections that ask "is everything else still true?"
 * rather than "fix this". Each has its own block and says what it is
 * protecting, because a regression file with no stated subject is one nobody
 * can maintain.
 *
 *   §10  the R1 and R2-A live passes still hold
 *   §11  the Beta marker and the time filter are unchanged
 *   §13  compact and mobile geometry, stated as arithmetic
 *   §14  the provider hard gate is exactly as R2-A left it
 *
 * ── WHY §14 IS RE-ASSERTED HERE AND NOT DELEGATED ─────────────────────────
 *
 * `providerBoundaryMatrix.spec.ts` already proves the boundary, and it still
 * runs. This block re-states the load-bearing half anyway, because R2-B
 * touched `MapPageClient`, `GlobalMapShell` and the retrieval authority's
 * neighbours, and "the other file covers it" is how a boundary quietly stops
 * being covered. Two independent assertions of one rule is the cheapest
 * insurance there is.
 */

const SRC = resolve(__dirname, '..', '..');

const code = (...parts: string[]): string =>
  readFileSync(join(SRC, ...parts), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const CLIENT = code('components', 'map', 'MapPageClient.tsx');
const SHELL = code('components', 'map', 'shell', 'GlobalMapShell.tsx');
const MOBILE = code('components', 'map', 'mobile', 'MobileSpatialShell.tsx');
const TOP_BAR = code('components', 'map', 'shell', 'MapHudTopBar.tsx');
const MODES = code('components', 'map', 'shell', 'ModeSwitcher.tsx');

/* ══════════════════════════════════════════════════════════════════════════
   §14 — THE PROVIDER HARD GATE, EXACTLY AS R2-A LEFT IT
   ══════════════════════════════════════════════════════════════════════════ */

describe('§14 — passive Map navigation is still provider-free', () => {
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

  it('the Map client still names no executing endpoint', () => {
    for (const marker of EXECUTING) {
      expect({ marker, reachable: CLIENT.includes(marker) }).toEqual({ marker, reachable: false });
    }
  });

  it('and neither does the shell R2-B spent the most time in', () => {
    /*
      The pointed one. R2-B edited `GlobalMapShell` for §2, §4, §5, §6 and §8;
      if any of that had reached for a provider this is where it would show.
    */
    for (const marker of EXECUTING) {
      expect({ marker, reachable: SHELL.includes(marker) }).toEqual({ marker, reachable: false });
    }
  });

  it('the news client is still not imported, so the guarantee is structural', () => {
    expect(CLIENT).not.toContain('@/lib/api/countryApi');
    expect(CLIENT).not.toContain('const loadCountry = useCallback');
  });

  it('the approved reasons are still exactly the two explicit actions', () => {
    expect([...COUNTRY_RETRIEVAL_REASONS].sort()).toEqual([
      'EXPLICIT_ANALYSIS_REQUEST',
      'EXPLICIT_RETRIEVAL_ACTION',
    ]);
  });

  it('every retired passive trigger is still forbidden BY NAME', () => {
    for (const retired of [
      'COUNTRY_SELECTION',
      'MAP_COUNTRY_CLICK',
      'EXPLICIT_COUNTRY_SELECTION',
      'CATEGORY_CHANGE_ON_SELECTED_COUNTRY',
      'SEARCH_COUNTRY_COMMIT',
      'CITY_SELECTION',
      'REGION_SELECTION',
    ]) {
      expect(FORBIDDEN_RETRIEVAL_TRIGGERS).toContain(retired);
      expect(isCountryRetrievalReason(retired)).toBe(false);
    }
  });

  it('and a name is still not explicit merely because it contains the word', () => {
    expect(isCountryRetrievalReason('EXPLICIT_COUNTRY_SELECTION')).toBe(false);
  });

  it('THE NEW SURFACES RETRIEVE NOTHING EITHER', () => {
    /*
      R2-B added a compact anchor, a subnational region path, a display-name
      bridge and a notices page. None of them may open a retrieval door that
      R2-A closed.
    */
    for (const file of [
      ['components', 'map', 'shell', 'SelectionCallout.tsx'],
      ['lib', 'map', 'geography', 'displayName.ts'],
      ['lib', 'map', 'region', 'regionSelection.ts'],
      ['app', 'third-party-notices', 'page.tsx'],
    ]) {
      const source = code(...file);

      expect({ file: file.join('/'), fetches: /\bfetch\s*\(/.test(source) }).toEqual({
        file: file.join('/'),
        fetches: false,
      });
    }
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   §10 — THE R1 LIVE PASSES
   ══════════════════════════════════════════════════════════════════════════ */

describe('§10 — what live acceptance already passed still holds', () => {
  it('East Africa is still the governed region, with its exact membership', () => {
    const declared = declaredProductRegion(GOVERNED_EAST_AFRICA_ID);

    expect(GOVERNED_EAST_AFRICA_ID).toBe('region:east-africa');
    expect([...(declared?.members ?? [])].sort()).toEqual([
      'BDI',
      'COD',
      'DJI',
      'ERI',
      'ETH',
      'KEN',
      'RWA',
      'SOM',
      'SSD',
      'TZA',
      'UGA',
    ]);
  });

  it('and it still has a jump extent, so the camera still moves for it', () => {
    expect(governedRegionExtent(GOVERNED_EAST_AFRICA_ID)).not.toBeNull();
  });

  it('CITY and REGION are still distinguishable selections that survive a refresh', () => {
    /*
      The R1 defect was that neither produced a selection at all. Both still
      round-trip, and neither folds into the other.
    */
    const city = { kind: 'CITY', id: 'city:RWA:kigali@30.06,-1.95' } as const;
    const region = { kind: 'REGION', id: 'admin1:RW-01' } as const;

    expect(decodeSelection(encodeSelection(city))).toEqual(city);
    expect(decodeSelection(encodeSelection(region))).toEqual(region);
    expect(encodeSelection(city)).not.toBe(encodeSelection(region));
  });

  it('the evidence ceiling is still COUNTRY for both of them', () => {
    /*
      The CTO's R1 ruling: CITY is selectable, and "it does not supersede the
      evidence ceiling". R2-B added a subnational REGION on the same terms.
    */
    const state = code('lib', 'map', 'state', 'mapState.ts');

    expect(state).toContain("EVIDENCE_CEILING_KIND = 'COUNTRY'");
  });

  it('the lower-left HUD is still one column, not a stack of fixed anchors', () => {
    expect(SHELL).toContain('data-gn="map-lower-left-stack"');
    expect(SHELL).toContain('flex-col-reverse');
    expect(SHELL).not.toContain('bottom-[128px]');
    expect(SHELL).not.toContain('bottom-[104px]');
  });

  it('the layer rail still receives its toggle handler — the R1 dead control', () => {
    expect(SHELL).toContain('onToggle={onToggleLayer}');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   §11 — BETA STATUS AND THE TIME FILTER
   ══════════════════════════════════════════════════════════════════════════ */

describe('§11 — the Beta marker and the period control are untouched', () => {
  it('beta modes still carry their marker', () => {
    expect(MODES).toContain('beta');
  });

  it('the period chips still render, and still on the densities that declare them', () => {
    expect(TOP_BAR).toContain('showPeriodChips');
    expect(SHELL).toContain('showPeriodChips={hud.periodChips}');
  });

  it('FULL and MODAL declare period chips; the picture densities do not', () => {
    expect(hudProfile('FULL').periodChips).toBe(true);
    expect(hudProfile('MODAL').periodChips).toBe(true);
    expect(hudProfile('MINI').periodChips).toBe(false);
    expect(hudProfile('EMBED').periodChips).toBe(false);
  });

  it('changing the period still changes state and retrieves nothing', () => {
    /*
      The R2-A property, restated for the control §11 asks about. A category or
      period change used to be able to spend quota; with selection no longer
      retrieving it would have become the FIRST purchase.
    */
    expect(SHELL).toContain('onPeriodChange');
    expect(CLIENT).not.toMatch(/\bfetch\s*\(/);
  });

  it('and the period still never moves the camera', () => {
    /*
      Part I §C — "the user's position in the world is theirs, not the mode's."
      Asserted structurally: the switcher has no camera wire at all.
    */
    expect(MODES).not.toContain('camera');
    expect(MODES).not.toContain('focus-bounds');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   §13 — COMPACT AND MOBILE
   ══════════════════════════════════════════════════════════════════════════ */

describe('§13 — compact and mobile geometry', () => {
  /** The §4 worst case, reused so both sections cannot drift apart. */
  const gap = (canvas: number): number => {
    const GUTTER = 12;
    const leftEndsAt = GUTTER + (canvas * 54) / 100 - 18;
    const rightStartsAt = canvas - GUTTER - ((canvas * 46) / 100 - 18);

    return rightStartsAt - leftEndsAt;
  };

  for (const [name, canvas] of [
    ['1024 compact, FULL', 1024 - 52 - 372],
    ['900 compact', 900],
    ['768 tablet', 768],
    ['560 narrow', 560],
    ['390 phone', 390],
  ] as const) {
    it(`${name} — the upper-left island still clears the upper-right stack`, () => {
      expect(gap(canvas)).toBeCloseTo(12, 6);
    });
  }

  it('the lower-left column is bounded and scrolls rather than overflowing', () => {
    /*
      The compact failure mode for a single column is that it grows past the
      viewport. It is capped against the canvas and scrolls inside that cap.
    */
    expect(SHELL).toContain('max-h-[calc(100%-96px)]');
    expect(SHELL).toContain('overflow-y-auto');
  });

  it('the mobile shell renders no map callout, so there is one action surface', () => {
    /*
      §5's compact clause — "do not render two simultaneous full action
      surfaces" — is met by construction rather than by a branch.
    */
    expect(MOBILE).not.toContain('SelectionCallout');
  });

  it('the compact anchor is narrow enough to leave the map readable on a phone', () => {
    /*
      212px inside a 390px phone canvas leaves 178px of map beside it. At the
      old 268 it left 122, and the card was four times as tall.
    */
    const callout = code('components', 'map', 'shell', 'SelectionCallout.tsx');

    expect(callout).toContain('CALLOUT_WIDTH = 212');
    expect(callout).toContain('CALLOUT_MAX_HEIGHT = 84');
  });

  it('every touch target added or changed by R2-B keeps its 44px minimum', () => {
    /*
      The region and city cards' clear buttons, which R2-B re-rendered. 44px
      is the product's existing floor and a card that shrank below it on a
      phone would be a regression this package introduced.
    */
    expect(code('components', 'map', 'shell', 'RegionIdentityCard.tsx')).toContain(
      'min-h-[44px]',
    );
  });
});
