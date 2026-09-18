import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { en } from '@/lib/i18n/dictionaries/en';
import { pl } from '@/lib/i18n/dictionaries/pl';
import {
  DEPLOYMENT_JUMP_TARGETS,
  GOVERNED_EAST_AFRICA_ID,
  assertGovernedJumpRegions,
  governedRegionExtent,
} from '@/lib/map/navigation/breadcrumbs';
import {
  DECLARED_PRODUCT_REGIONS,
  declaredProductRegion,
} from '@/lib/map/region/declaredProductRegions';
import { declaredRegionSelection } from '@/lib/map/region/regionSelection';
import { citySelectionFrom, selectionForPlaceResult } from '@/lib/map/geography/semanticGeography';
import {
  COUNTRY_RETRIEVAL_REASONS,
  FORBIDDEN_RETRIEVAL_TRIGGERS,
  countryParamFor,
} from '@/lib/map/retrieval/countryRetrievalAuthority';
import { decodeSelection, encodeSelection } from '@/lib/map/state/mapUrl';
import { EVIDENCE_CEILING_KIND, isNavigationSelection } from '@/lib/map/state/mapState';
import type { PlaceResult } from '@/lib/map/search/placeSearch';
import { CityIdentityCard } from '@/components/map/shell/CityIdentityCard';
import { RegionIdentityCard } from '@/components/map/shell/RegionIdentityCard';

/**
 * ══ PHASE A — SEMANTIC GEOGRAPHY, END TO END ══════════════════════════════
 *
 * THE ARCHITECTURAL INVARIANT THE WHOLE CONTRACT RESTS ON:
 *
 *     CAMERA STATE  ≠  SEMANTIC GEOGRAPHY STATE  ≠  EVIDENCE CEILING
 *
 * The live inspection found all three collapsed into the first. East Africa,
 * Kigali CITY and Kigali REGION each moved the viewport and established no
 * scope, so the URL carried `cam=` alone and the rail read World.
 *
 * These assertions are grouped by the thing they protect rather than by the
 * file they touch, because the failure was never in one file — it was that a
 * selection was never produced at all.
 */

const SRC = resolve(__dirname, '..', '..');

const code = (...parts: string[]): string =>
  readFileSync(join(SRC, ...parts), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const SHELL = code('components', 'map', 'shell', 'GlobalMapShell.tsx');

/** Verbatim from the live Alpha navigator, `/geo/search?q=Kigali`. */
const KIGALI_CITY_ID = 'city:RWA:kigali@-1.94995,30.05885';
const KIGALI_ADMIN1_ID = 'admin1:RW-01';

const navigatorRow = (over: Partial<PlaceResult>): PlaceResult => ({
  id: 'x',
  kind: 'CITY',
  label: 'Kigali',
  annotation: { kind: 'REFERENCE' },
  // A navigator row carries a context line built from G's hierarchy; a local
  // jump-target row carries neither this nor a country.
  context: 'Rwanda',
  ...over,
});

/* ══════════════════════════════════════════════════════════════════════════
   1 — CITY ≠ REGION, AND NEITHER COLLAPSES INTO A COUNTRY
   ══════════════════════════════════════════════════════════════════════════ */

describe('CITY and REGION are two scopes, and stay two', () => {
  it('the same place name commits to two different selections', () => {
    const city = selectionForPlaceResult(navigatorRow({ kind: 'CITY', id: KIGALI_CITY_ID }));
    const region = selectionForPlaceResult(navigatorRow({ kind: 'REGION', id: KIGALI_ADMIN1_ID }));

    expect(city).toEqual({ kind: 'CITY', id: KIGALI_CITY_ID });
    expect(region).toEqual({ kind: 'REGION', id: KIGALI_ADMIN1_ID });
    expect(city).not.toEqual(region);
  });

  it('neither becomes Rwanda — the scope may not silently collapse to a country', () => {
    for (const row of [
      navigatorRow({ kind: 'CITY', id: KIGALI_CITY_ID, countryIso3: 'RWA' }),
      navigatorRow({ kind: 'REGION', id: KIGALI_ADMIN1_ID, countryIso3: 'RWA' }),
    ]) {
      expect(selectionForPlaceResult(row)?.kind).not.toBe('COUNTRY');
    }
  });

  it('and the distinction survives the URL in both directions', () => {
    for (const selection of [
      { kind: 'CITY', id: KIGALI_CITY_ID } as const,
      { kind: 'REGION', id: KIGALI_ADMIN1_ID } as const,
    ]) {
      expect(decodeSelection(encodeSelection(selection))).toEqual(selection);
    }
  });

  it('a LOCAL jump-target row still commits nothing — the alias trap stays shut', () => {
    /*
      A row over a hard-coded box carries no gazetteer identity: no context
      line, no country, no region. Minting one from its label key is exactly
      what RSC-1 forbids, so it falls through to the camera-only path.
    */
    const local: PlaceResult = {
      id: 'city:kigali',
      kind: 'CITY',
      label: 'Kigali',
      bounds: [29.98, -2.05, 30.2, -1.87],
      annotation: { kind: 'REFERENCE' },
    };

    expect(selectionForPlaceResult(local)).toBeUndefined();
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   2 — THE RAIL IDENTIFIES WHAT WAS SELECTED
   ══════════════════════════════════════════════════════════════════════════ */

describe('the right rail identifies the selected geography, per kind', () => {
  it('the shell branches on CITY before falling through to the evidence card', () => {
    expect(SHELL).toContain("selection.kind === 'CITY' ?");
    expect(SHELL).toContain('<CityIdentityCard');
    expect(SHELL).toContain("selection.kind === 'REGION' ?");
    expect(SHELL).toContain('<RegionIdentityCard');
  });

  for (const [locale, dict] of [
    ['en', en],
    ['pl', pl],
  ] as const) {
    it(`${locale} — a CITY selection names the city AND the evidence country`, () => {
      const html = renderToStaticMarkup(
        createElement(CityIdentityCard, {
          city: {
            geographyId: KIGALI_CITY_ID,
            name: 'Kigali',
            countryIso3: 'RWA',
            extent: null,
            provenance: 'GeoNames',
          },
          geographyId: KIGALI_CITY_ID,
          countryName: 'Rwanda',
          /* Composed exactly as the shell composes it — see GlobalMapShell. */
          labels: {
            ...dict.map.spatial.city,
            evidenceCeilingKindLabel: dict.map.spatial.search.kinds.COUNTRY,
          },
        }),
      );

      // The scope the reader chose...
      expect(html).toContain('Kigali');
      expect(html).toContain(dict.map.spatial.city.heading);
      // ...and the ceiling, named rather than implied.
      expect(html).toContain('Rwanda');
      expect(html).toContain(dict.map.spatial.city.evidenceCeilingHeading);
      expect(html).toContain(dict.map.spatial.city.evidenceCeilingBody);
    });

    it(`${locale} — East Africa is identified as the governed region, with its membership`, () => {
      const region = declaredRegionSelection(
        GOVERNED_EAST_AFRICA_ID,
        governedRegionExtent(GOVERNED_EAST_AFRICA_ID),
      );

      expect(region).not.toBeNull();

      const html = renderToStaticMarkup(
        createElement(RegionIdentityCard, {
          region,
          geographyId: GOVERNED_EAST_AFRICA_ID,
          labels: dict.map.spatial.region,
        }),
      );

      expect(html).toContain('East Africa');
      // GOVERNED, not "membership is disputed" and not "no definition encoded".
      expect(html).toContain(dict.map.spatial.region.types.GOVERNED);
      expect(html).not.toContain(dict.map.spatial.region.types.OPERATIONAL);
      expect(html).not.toContain(dict.map.spatial.region.types.UNDEFINED);
      // And it does NOT say the camera was held, because the jump does move it.
      expect(html).not.toContain(dict.map.spatial.region.cameraHeld);
    });
  }

  it('a city with no published country says so rather than inventing one', () => {
    const html = renderToStaticMarkup(
      createElement(CityIdentityCard, {
        city: {
          geographyId: 'city:XXX:nowhere@0,0',
          name: 'Nowhere',
          countryIso3: null,
          extent: null,
          provenance: '',
        },
        geographyId: 'city:XXX:nowhere@0,0',
        labels: {
          ...en.map.spatial.city,
          evidenceCeilingKindLabel: en.map.spatial.search.kinds.COUNTRY,
        },
      }),
    );

    expect(html).toContain(en.map.spatial.city.noCountryBody);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   3 — REFRESH RESTORES THE SCOPE
   ══════════════════════════════════════════════════════════════════════════ */

describe('a reload restores the semantic scope, not just a viewport', () => {
  it('East Africa restores from the URL and resolves WITHOUT the gazetteer', () => {
    /*
      MEASURED: /geo/place?id=region:east-africa -> {"found":false,"node":null}.
      A product-governed region is not in G, so restoration must not depend on
      it. `declaredRegionSelection` is synchronous and local.
    */
    const restored = decodeSelection(
      encodeSelection({ kind: 'REGION', id: GOVERNED_EAST_AFRICA_ID }),
    );

    expect(restored).toEqual({ kind: 'REGION', id: GOVERNED_EAST_AFRICA_ID });

    const resolved = declaredRegionSelection(restored!.id, governedRegionExtent(restored!.id));

    expect(resolved?.name).toBe('East Africa');
    expect(resolved?.regionType).toBe('GOVERNED');
    expect(resolved?.memberCount).toBe(11);
  });

  it('the resolver is consulted before the network, so no request is spent', () => {
    const hook = code('lib', 'map', 'region', 'useResolvedRegion.ts');
    const localAt = hook.indexOf('declaredRegionSelection(');
    const networkAt = hook.indexOf('lookupNavigatorPlace(');

    expect(localAt).toBeGreaterThan(-1);
    expect(networkAt).toBeGreaterThan(-1);
    expect(localAt).toBeLessThan(networkAt);
  });

  it('a CITY restores by LOOKUP, never by parsing the id', () => {
    const hook = code('lib', 'map', 'geography', 'useResolvedCity.ts');

    expect(hook).toContain('lookupNavigatorPlace(selectedCityId)');
    // The id visibly contains an ISO-3 and a coordinate pair. Reading them out
    // would remove the request and silently break the day G reshapes the id.
    expect(hook).not.toMatch(/\.split\(['"`]:/);
    expect(hook).not.toContain('substring');
    expect(hook).not.toMatch(/slice\(\s*\d/);
  });

  it('city identity comes from G’s hierarchy, not from the id string', () => {
    const city = citySelectionFrom({
      geographyId: KIGALI_CITY_ID,
      kind: 'city',
      navigationPrecision: 'CITY',
      name: 'Kigali',
      aliases: [],
      matchedOn: 'kigali',
      matchKind: 'EXACT',
      hierarchy: [{ geographyId: 'country:RWA', kind: 'country', name: 'Rwanda', code: 'RWA' }],
      center: [30.05885, -1.94995],
      datasetAttribution: 'all-the-cities',
      admittedBy: 'gazetteer',
      memberCount: null,
    } as never);

    expect(city?.name).toBe('Kigali');
    expect(city?.countryIso3).toBe('RWA');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   4 — THE GOVERNED MEMBERSHIP IS EXACTLY THE APPROVED ONE
   ══════════════════════════════════════════════════════════════════════════ */

describe('East Africa reuses the governed identity and changes no membership', () => {
  const APPROVED = ['BDI', 'COD', 'DJI', 'ERI', 'ETH', 'KEN', 'RWA', 'SOM', 'SSD', 'TZA', 'UGA'];

  it('the membership is the approved list, exactly', () => {
    expect(declaredProductRegion(GOVERNED_EAST_AFRICA_ID)?.members).toEqual(APPROVED);
  });

  it('Sudan and Zambia were not silently added', () => {
    const members = declaredProductRegion(GOVERNED_EAST_AFRICA_ID)?.members ?? [];

    expect(members).not.toContain('SDN');
    expect(members).not.toContain('ZMB');
  });

  it('no duplicate East Africa definition was created', () => {
    /*
      EXACTLY ONE `region:east-africa`, and the EAC IS NOT A DUPLICATE OF IT.

      `region:east-african-community` is a different region that was already
      declared: a treaty body, `BACKEND_PUBLISHED`, with `members: null` because
      "EAC MEMBERSHIP IS READ FROM THE SHARED REGISTRY, NEVER RESTATED HERE".
      The governed coverage region is PRODUCT_GOVERNED with its own explicit
      list, and its provenance says it is "deliberately NOT the East African
      Community". A first draft of this assertion matched both on a loose regex
      and read as a duplicate; the two are pinned apart here instead.
    */
    const exact = DECLARED_PRODUCT_REGIONS.filter((r) => r.id === GOVERNED_EAST_AFRICA_ID);

    expect(exact).toHaveLength(1);
    expect(exact[0]?.membershipSource).toBe('PRODUCT_GOVERNED');

    const eac = declaredProductRegion('region:east-african-community');

    expect(eac?.membershipSource).toBe('BACKEND_PUBLISHED');
    expect(eac?.members).toBeNull();
    expect(eac?.id).not.toBe(GOVERNED_EAST_AFRICA_ID);
  });

  it('the jump target keeps its exact bounds — the identity did not re-frame it', () => {
    const target = DEPLOYMENT_JUMP_TARGETS.find((t) => t.id === 'eastAfrica');

    expect(target?.bounds).toEqual([28.8, -11.8, 42, 5.5]);
    expect(target?.regionId).toBe(GOVERNED_EAST_AFRICA_ID);
  });

  it('every jump-target region id is one the product actually governs', () => {
    expect(assertGovernedJumpRegions()).toEqual([]);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   5 — §11 THE PROVIDER-EXECUTION HARD GATE
   ══════════════════════════════════════════════════════════════════════════ */

describe('§11 — a navigation selection executes no provider', () => {
  it('CITY selection is a FORBIDDEN retrieval trigger, named in the register', () => {
    expect(FORBIDDEN_RETRIEVAL_TRIGGERS).toContain('CITY_SELECTION');
    expect(FORBIDDEN_RETRIEVAL_TRIGGERS).toContain('REGION_SELECTION');
  });

  it('the allowed reasons and the forbidden triggers do not overlap', () => {
    for (const reason of COUNTRY_RETRIEVAL_REASONS) {
      expect(FORBIDDEN_RETRIEVAL_TRIGGERS).not.toContain(reason);
    }
  });

  it('only a COUNTRY selection may put a country in the URL', () => {
    /*
      The second half of the same rule: a CITY or REGION scope must not leave a
      `country=` beside it, because that parameter is what a cold load would
      retrieve from.
    */
    expect(countryParamFor({ kind: 'CITY', id: KIGALI_CITY_ID }, 'RWA')).toBeNull();
    expect(countryParamFor({ kind: 'REGION', id: GOVERNED_EAST_AFRICA_ID }, 'RWA')).toBeNull();
    expect(countryParamFor({ kind: 'COUNTRY', id: 'RWA' }, 'RWA')).toBe('RWA');
  });

  it('the shell dispatches no retrieval on the city or region commit paths', () => {
    const commit = SHELL.slice(
      SHELL.indexOf('const onSelectSearchResult'),
      SHELL.indexOf('const onKeyDown'),
    );

    expect(commit.length).toBeGreaterThan(200);
    expect(commit).not.toMatch(/fetch\s*\(/);
    expect(commit).not.toContain('/news/');
    expect(commit).not.toContain('loadCountry');
  });

  it('no executing news endpoint is named anywhere in the map shell', () => {
    for (const forbidden of ['/news/top-headlines"', "news/top-headlines'", '/news/country/']) {
      expect(SHELL).not.toContain(forbidden);
    }
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   6 — THE THREE AXES REMAIN THREE
   ══════════════════════════════════════════════════════════════════════════ */

describe('semantic scope ≠ evidence ceiling ≠ camera', () => {
  it('the evidence ceiling is stated once and is still COUNTRY', () => {
    expect(EVIDENCE_CEILING_KIND).toBe('COUNTRY');
  });

  it('CITY and REGION are navigation selections; EVIDENCE is not', () => {
    expect(isNavigationSelection('CITY')).toBe(true);
    expect(isNavigationSelection('REGION')).toBe(true);
    expect(isNavigationSelection('COUNTRY')).toBe(true);
    expect(isNavigationSelection('EVIDENCE')).toBe(false);
  });

  it('the camera is written by its own parameter, never by the selection', () => {
    // `sel=` and `cam=` are independent: a selection encodes no coordinates.
    expect(encodeSelection({ kind: 'REGION', id: GOVERNED_EAST_AFRICA_ID })).not.toMatch(/\d+\.\d+/);
    expect(encodeSelection({ kind: 'COUNTRY', id: 'RWA' })).toBe('country:RWA');
  });

  it('panning and zooming are forbidden retrieval triggers, so camera is not scope', () => {
    for (const trigger of ['CAMERA_MOTION', 'ZOOM', 'PAN', 'MAP_CENTERING']) {
      expect(FORBIDDEN_RETRIEVAL_TRIGGERS).toContain(trigger);
    }
  });
});
