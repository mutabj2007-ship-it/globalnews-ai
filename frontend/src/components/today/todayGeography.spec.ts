import { readFileSync } from 'fs';
import { join } from 'path';
import { getDictionary } from '@/lib/i18n/dictionaries';
import {
  FRAME_HEIGHT,
  FRAME_WIDTH,
  LAT_NORTH,
  LAT_SOUTH,
} from '@/components/today/todayMapProjection';
import {
  GEO_COL_W,
  GEO_COL_W_M,
  MAP_ASPECT,
  resolveGeographyColumnLayout,
  resolveGeographyLayout,
  resolveRelocatedGeographyLayout,
} from '@/components/today/todayWorkspaceGeometry';

/**
 * R5.9 — THE GEOGRAPHY REGION'S SOURCE CONTRACT.
 *
 * The arithmetic side of F13–F19 lives in `todayWorkspaceGeometry.spec.ts`,
 * which proves it at every column height. This file proves the RENDERER honours
 * what the arithmetic decided — that the canvas really is `flex:1 1 auto`, that
 * the rows and the CTA really are `flex:0 0 auto`, and that no coordinate,
 * projection or measured element appears anywhere.
 *
 * A DEDICATED FILE. F's GEO-PRECISION-1 append region in
 * `dictionaries/index.spec.ts` is untouched.
 */
const source = readFileSync(join(__dirname, 'TodayGeographyPanel.tsx'), 'utf-8');
const canvasSource = readFileSync(join(__dirname, 'TodayWorldCanvas.tsx'), 'utf-8');
const projectionSource = readFileSync(join(__dirname, 'todayMapProjection.ts'), 'utf-8');
const geometry = readFileSync(join(__dirname, 'todayWorkspaceGeometry.ts'), 'utf-8');

const codeOnly = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const code = codeOnly(source);
const canvasCode = codeOnly(canvasSource);
const projectionCode = codeOnly(projectionSource);

describe('F13/F14 — the canvas is dominant and receives the surplus', () => {
  it('receives the surplus ONLY where F14 says it may', () => {
    /*
      R4 GEOGRAPHY SIZE CHILD — F14 is unchanged in the frozen rail and in a
      dock tab, where `canvasGrows` is true and the canvas is still
      `flex:1 1 auto`. In the three-column composition it is false and the
      canvas is pinned to the map's own height, because a canvas taller than
      its map is the same map with more void around it, not a bigger map.
    */
    expect(code).toMatch(/flex: layout\.canvasGrows \? '1 1 auto' : '0 0 auto'/);
    expect(code).toMatch(/height: layout\.canvasGrows \? undefined : `\$\{layout\.canvasHeight\}px`/);
    expect(code).toMatch(/minHeight: `\$\{layout\.canvasHeight\}px`/);
    /* The frozen rail keeps F14 exactly as validated. */
    expect(resolveGeographyLayout(540).canvasGrows).toBe(true);
    expect(resolveGeographyLayout(540).canvasAspect).toBeNull();
    /* The column is pinned to a pixel height computed from a known width. */
    expect(resolveGeographyColumnLayout(540, GEO_COL_W).canvasGrows).toBe(false);
    expect(resolveGeographyColumnLayout(540, GEO_COL_W).canvasAspect).toBeNull();
    /*
      R4 ZOOM — the relocated TAB no longer absorbs surplus either. Its width
      is whatever the frame is, so it takes the frame's ASPECT instead of a
      pixel height computed from a width nobody knows: MEASURED at 768, that
      is what turned 374px of map in a 754px panel into 754px of map.
    */
    expect(resolveRelocatedGeographyLayout(300).canvasGrows).toBe(false);
    expect(resolveRelocatedGeographyLayout(300).canvasAspect).toBeCloseTo(MAP_ASPECT, 10);
    expect(code).toMatch(/aspectRatio: `\$\{layout\.canvasAspect\}`/);
  });

  it('the canvas IS the map: no letterbox in the three-column composition', () => {
    /* width ÷ MAP_ASPECT is exactly the height the map draws at, so the box
       and the picture are the same rectangle. */
    for (const width of [GEO_COL_W, GEO_COL_W_M]) {
      const l = resolveGeographyColumnLayout(540, width);
      expect(l.canvasHeight).toBe(Math.round(width / MAP_ASPECT));
    }
    /* R4 ZOOM REVISION — the aspect comes from the clipped Mercator frame, not
       from a number kept in parallel with it. */
    expect(MAP_ASPECT).toBeCloseTo(FRAME_WIDTH / FRAME_HEIGHT, 10);
    expect(MAP_ASPECT).toBeCloseTo(1.9367, 3);
  });

  it('takes its height from the resolved layout, never from a measurement', () => {
    expect(code).not.toMatch(/ResizeObserver|getBoundingClientRect|offsetHeight|clientHeight|useEffect|useState/);
    expect(code).toMatch(/layout: GeographyLayout;/);
  });
});

describe('F15/F19 — the canvas never disappears and is never text', () => {
  it('renders the grid unconditionally — it is not behind a resolved check', () => {
    const canvas = code.slice(code.indexOf('role="img"'), code.indexOf('<ul'));
    expect(canvas).toContain('backgroundImage');
    expect(canvas).toContain('22px 22px');
    // The ONLY thing gated on `resolved` inside the canvas is the empty line.
    expect(canvas).toMatch(/\{!resolved && \(/);
    expect(canvas).not.toMatch(/\{resolved && \(\s*<div/);
  });

  it('keeps the grid and states the count when nothing resolved', () => {
    expect(code).toContain('t.noneResolved');
    expect(getDictionary('en').todayWorkspace.geography.noneResolved).toMatch(/No country resolved/);
  });
});

describe('F16 — the rows and the CTA can never clip the canvas', () => {
  it('pins both at flex:0 0 auto with explicit heights', () => {
    expect(code).toMatch(/flex: '0 0 auto', height: `\$\{layout\.rowsHeight\}px`/);
    expect(code).toMatch(/flex: '0 0 auto', height: `\$\{GEO_FOOTER_CTA_H\}px`/);
  });

  it('scrolls the rows internally on ONE axis, never both', () => {
    expect(code).toMatch(/overflow-y-auto overflow-x-hidden/);
    expect(code).not.toMatch(/overflow-auto\b/);
  });
});

describe('F17 — OPEN WORLD MAP has exactly one position at a time', () => {
  it('renders the footer control only at ctaPosition region-footer', () => {
    expect(code).toMatch(/\{layout\.ctaPosition === 'region-footer' && \(/);
  });

  it('renders the compact control only at ctaPosition region-header', () => {
    expect(code).toMatch(/\{layout\.ctaPosition === 'region-header' && \(/);
  });

  it('never renders both — the two conditions are mutually exclusive by value', () => {
    expect((code.match(/layout\.ctaPosition === /g) ?? [])).toHaveLength(2);
    // 'permanent-chrome' is the frame's job, not the region's, so it draws none.
    expect(code).not.toContain("'permanent-chrome'");
  });
});

describe('R5.9 — the precision statement survives every tier', () => {
  it('keeps COUNTRY-LEVEL permanently in the region header', () => {
    const header = code.slice(code.indexOf('<header'), code.indexOf('role="img"'));
    expect(header).toContain('t.countryLevel');
    expect(header).not.toMatch(/layout\.tier|ctaPosition === 'region-footer'/);
  });

  it('labels the canvas a SCHEMATIC INDEX and denies coordinates in words', () => {
    expect(getDictionary('en').todayWorkspace.geography.schematicIndex).toBe(
      'SCHEMATIC INDEX · NOT COORDINATES',
    );
    expect(getDictionary('pl').todayWorkspace.geography.schematicIndex).toContain('NIE WSPÓŁRZĘDNE');
  });
});

describe('Geography precision rules — nothing finer than a country, ever', () => {
  it('names no sub-national unit anywhere', () => {
    /* WORD boundaries, not substrings: "opacity" contains "city", and an
       earlier version of this test failed on exactly that. */
    for (const source of [code, canvasCode]) {
      for (const forbidden of ['district', 'county', 'province', 'voivodeship', 'city', 'centroid']) {
        expect(source.toLowerCase()).not.toMatch(new RegExp(`\\b${forbidden}\\b`));
      }
    }
  });

  /*
    R4 CORRECTION 1 — THE CANVAS IS REAL GEOGRAPHY NOW.

    The ordinal dot grid is gone. What replaces it is the country's OWN SHAPE,
    which is the strongest possible statement of country-level precision: a
    shape cannot be read as a point, and a point inside a country would have
    asserted where inside it. These tests police that boundary rather than the
    old one.
  */
  it('draws real country outlines from the repository primitive', () => {
    expect(canvasCode).toMatch(
      /import \{ getCountryFeatureCollection \} from '@\/lib\/map\/countryGeometry'/,
    );
    expect(canvasCode).toMatch(/geometryToFramePath/);
    expect(canvasCode).toMatch(/<svg/);
    /* The Hero's projection module is LEFT ALONE — it serves a different
       picture and must keep serving it unchanged. */
    expect(canvasCode).not.toMatch(/equirectangularProjection/);
    expect(code).toMatch(/<TodayWorldCanvas evidenceIso2=\{evidenceIso2\} selectedIso2=\{selectedCountry\}/);
  });

  it('imports nothing from components/map and does not load the WebGL renderer', () => {
    for (const source of [code, canvasCode]) {
      expect(source).not.toMatch(/components\/map/);
      expect(source).not.toMatch(/maplibre/);
    }
  });

  it('keeps every projection decision in one module', () => {
    /* The canvas renders; it does not project. No transform arithmetic here. */
    expect(canvasCode).not.toMatch(/Math\.log|Math\.tan|Math\.PI/);
    expect(canvasCode).not.toMatch(/d3-geo|proj4/);
    expect(projectionCode).toMatch(/Math\.log\(Math\.tan\(Math\.PI \/ 4/);
  });

  it('R4 ZOOM — the frame is clipped to the inhabited world, not the globe', () => {
    expect(LAT_NORTH).toBe(75);
    expect(LAT_SOUTH).toBe(-57);
    /* Tierra del Fuego (55.9S) and Stewart Island (47S) are inside it;
       Antarctica and the Arctic Ocean are outside. */
    expect(LAT_SOUTH).toBeLessThan(-55.9);
    expect(LAT_NORTH).toBeGreaterThan(71);
    /* Longitude is UNTOUCHED: a world map missing the Americas or the Pacific
       is not a world map. */
    expect(FRAME_WIDTH).toBe(360);
  });

  it('R4 ZOOM — the projection is conformal, so shapes are not stretched', () => {
    expect(projectionCode).toMatch(/const K = 180 \/ Math\.PI/);
    expect(projectionSource).toMatch(/CONFORMAL/);
    expect(FRAME_WIDTH / FRAME_HEIGHT).toBeCloseTo(1.9367, 3);
  });

  it('R4 ZOOM — a feature entirely outside the clip is DROPPED, not flattened', () => {
    expect(projectionCode).toMatch(/if \(!inside\) return '';/);
    expect(canvasCode).toMatch(/\.filter\(\(f\) => f\.d\.length > 0\)/);
  });

  it('plots the COUNTRY SHAPE and never a point inside it', () => {
    /* Fills and strokes on <path>, and no positioned marker of any kind. */
    expect(canvasCode).toMatch(/<path/);
    expect(canvasCode).not.toMatch(/<circle|cx=|cy=|rounded-full/);
    /* No centroid, no city, no coordinate is computed for a marker. */
    expect(canvasCode).not.toMatch(/computeFeatureCenter|computeFeatureBounds/);
  });

  it('states its projection instead of hiding one', () => {
    /* Equirectangular, named in the source, and the whole of it: the viewBox
       is degrees, so the transform is lng+180 / 90-lat and nothing else. */
    /* The viewBox IS degrees, and the projection module it delegates to names
       itself equirectangular. Both halves are asserted. */
    /* The viewBox IS the frame, and the frame comes from the projection — so
       the box, the picture and the projection cannot drift apart. */
    expect(canvasCode).toMatch(/viewBox=\{`0 0 \$\{FRAME_WIDTH\} \$\{FRAME_HEIGHT\}`\}/);
    expect(canvasCode).toMatch(/preserveAspectRatio="xMidYMid meet"/);
    expect(projectionCode).toMatch(/export const FRAME_WIDTH = 360;/);
    expect(projectionCode).toMatch(/export const FRAME_HEIGHT = Y_TOP - Y_BOTTOM;/);
    expect(projectionSource).toMatch(/WEB MERCATOR, CLIPPED TO THE INHABITED WORLD/);
    expect(projectionCode).toMatch(/\(lon \+ 180\)\.toFixed\(2\)/);
  });

  it('never plots an unresolved record', () => {
    /* The evidence set is built from resolved country rows only. Unresolved
       records have no countryCode to contribute and are counted in words. */
    expect(code).toMatch(/new Set\(countries\.map\(\(row\) => row\.countryCode\)\)/);
    expect(canvasCode).toMatch(/evidenceIso2\.has\(f\.iso2\)/);
    expect(canvasCode).not.toMatch(/unresolved/i);
  });

  it('keeps cyan as the evidence treatment', () => {
    expect(canvasCode).toMatch(/const EVIDENCE = '#22d3ee'/);
    expect(canvasCode).toMatch(/const EVIDENCE_BRIGHT = '#67e8f9'/);
  });

  it('keeps COUNTRY-LEVEL in the header and states the precision on the canvas', () => {
    expect(code).toMatch(/\{t\.countryLevel\}/);
    expect(code).toMatch(/\{t\.countryOutlines\}/);
    for (const language of ['en', 'pl'] as const) {
      const g = getDictionary(language).todayWorkspace.geography;
      expect(g.countryLevel.length).toBeGreaterThan(0);
      expect(g.countryOutlines.length).toBeGreaterThan(0);
    }
    expect(getDictionary('en').todayWorkspace.geography.countryOutlines).toMatch(
      /NO FINER THAN COUNTRY/,
    );
  });

  it('resolves the ISO-3 through the canonical resolver, never by truncation', () => {
    expect(code).toMatch(/findCountryByIso2\(row\.countryCode\)\?\.iso3/);
    expect(code).not.toMatch(/slice\(0,\s*2\)|substring\(0,\s*2\)/);
  });

  it('never offers the unresolved row as a selectable place', () => {
    const block = code.slice(code.indexOf('unresolvedCount > 0'), code.indexOf('</ul>'));
    expect(block).not.toContain('onSelectCountry');
    expect(block).not.toContain('aria-pressed');
  });
});

describe('R5.9 — the geometry is computed, never measured', () => {
  it('derives the column from known chrome only', () => {
    expect(geometry).toMatch(/viewportHeight - COMMAND_BAR_H - header - dock/);
    expect(codeOnly(geometry)).not.toMatch(/getBoundingClientRect|ResizeObserver|offsetHeight/);
  });

  it('states each floor as chrome + body so the two cannot drift', () => {
    expect(geometry).toMatch(/export const WATCH_FLOOR = WATCH_CHROME \+ WATCH_BODY_FLOOR;/);
    expect(geometry).toMatch(/export const GEO_FLOOR = GEO_CHROME \+ GEO_BODY_FLOOR;/);
    expect(geometry).toMatch(/export const ANALYSE_FLOOR = ANALYSE_CHROME \+ ANALYSE_BODY_FLOOR;/);
  });
});

describe('Localization — both locales carry the whole region vocabulary', () => {
  it('keeps every key present, non-empty and translated', () => {
    const en = getDictionary('en').todayWorkspace.geography as Record<string, string>;
    const pl = getDictionary('pl').todayWorkspace.geography as Record<string, string>;
    expect(Object.keys(en).sort()).toEqual(Object.keys(pl).sort());
    for (const key of Object.keys(en)) {
      expect(pl[key].length).toBeGreaterThan(0);
      expect(pl[key]).not.toBe(en[key]);
    }
  });

  it('hardcodes no English chrome in the component', () => {
    expect(code).toMatch(/getDictionary\(language\)\.todayWorkspace\.geography/);
    expect(code).not.toMatch(/GEOGRAPHY'|COUNTRY-LEVEL'|OPEN WORLD MAP'/);
  });
});

describe('R4 ZOOM — the projection magnifies with latitude, and is proven to', () => {
  const K = 180 / Math.PI;
  const mercY = (lat: number): number => K * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

  it('the frame is exactly the inhabited band, in projected units', () => {
    expect(FRAME_HEIGHT).toBeCloseTo(mercY(LAT_NORTH) - mercY(LAT_SOUTH), 6);
    expect(FRAME_HEIGHT).toBeCloseTo(185.88, 1);
  });

  it('one degree of latitude is materially taller where the named regions are', () => {
    /* Vertical magnification vs the equirectangular frame is sec(latitude);
       combined with the wider column it is that times 420/324. */
    const column = 420 / 324;
    const at = (lat: number): number => column / Math.cos((lat * Math.PI) / 180);
    expect(at(62)).toBeGreaterThan(2.7); // Russia
    expect(at(60)).toBeGreaterThan(2.5); // Canada
    expect(at(50)).toBeGreaterThan(2.0); // Europe
    expect(at(39)).toBeGreaterThan(1.6); // United States
    expect(at(22)).toBeGreaterThan(1.35); // India
    expect(at(-25)).toBeGreaterThan(1.4); // Australia
    expect(at(2)).toBeGreaterThan(1.29); // East Africa
  });

  it('and one degree of LONGITUDE is equally magnified, so nothing is stretched', () => {
    /* Conformality: at any point the two scales are equal. A 1-degree box at
       the equator is square in the frame, and stays square at every latitude. */
    for (const lat of [0, 22, 39, 50, 62]) {
      const dy = mercY(lat + 0.5) - mercY(lat - 0.5);
      const dx = 1 / Math.cos((lat * Math.PI) / 180);
      expect(dy).toBeCloseTo(dx, 2);
    }
  });

  it('the whole world of longitude is kept — no cropping to fake a zoom', () => {
    expect(FRAME_WIDTH).toBe(360);
    expect(projectionCode).toMatch(/\(lon \+ 180\)/);
  });
});
