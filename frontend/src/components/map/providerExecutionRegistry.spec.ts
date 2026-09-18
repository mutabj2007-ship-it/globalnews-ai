import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { LAYER_REGISTRY } from '@/lib/map/layers/layerRegistry';
import {
  COUNTRY_RETRIEVAL_REASONS,
  FORBIDDEN_RETRIEVAL_TRIGGERS,
} from '@/lib/map/retrieval/countryRetrievalAuthority';

/**
 * ══ §11 — THE PROVIDER-EXECUTION REGISTRY ═════════════════════════════════
 *
 * THE RELEASE GATE, restated as the thing this file measures: ordinary Map
 * interaction must never execute an external news provider.
 *
 *     zero GNews execution
 *     zero /news/country/*
 *     zero /analysis/news
 *     zero OpenAI
 *     zero external news-provider execution
 *
 * The CTO's Country Evidence note is the sharp case. `/geo/map-feed` IS allowed
 * — it is the existing map-feed data path and carries no provider — but
 * toggling the Country Evidence layer must not reach anything else. And GRID
 * must remain entirely client-side.
 *
 * WHAT MAKES THIS PROVABLE RATHER THAN ASSERTED. A layer toggle is a pure
 * state write: `onToggle(layerId, next)` -> `setLayers` -> `apply(layerId, on)`
 * -> `setLayoutProperty(..., 'visibility', …)`. There is no fetch on that path
 * at all, and the files that path touches are enumerated below and read.
 */

const SRC = resolve(__dirname, '..', '..');

const code = (...parts: string[]): string =>
  readFileSync(join(SRC, ...parts), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

/** Every file on the layer-toggle path, from the control to the canvas. */
const TOGGLE_PATH = [
  ['components', 'map', 'shell', 'LayerToggleRail.tsx'],
  ['components', 'map', 'shell', 'd1', 'LayersControl.tsx'],
  ['components', 'map', 'shell', 'd1', 'MapControlCluster.tsx'],
  ['lib', 'map', 'layers', 'layerRegistry.ts'],
  ['lib', 'map', 'reference', 'graticule.ts'],
] as const;

/** Anything that would mean a provider ran. */
const PROVIDER_MARKERS = [
  '/news/country',
  '/news/top-headlines',
  '/analysis/news',
  'GNews',
  'gnews',
  'OpenAI',
  'openai',
  'EventRegistry',
  'GDELT',
] as const;

describe('the layer-toggle path executes no provider', () => {
  for (const parts of TOGGLE_PATH) {
    const name = parts[parts.length - 1];

    it(`${name} names no provider and issues no fetch`, () => {
      const source = code(...parts);

      for (const marker of PROVIDER_MARKERS) {
        expect({ file: name, marker, present: source.includes(marker) }).toEqual({
          file: name,
          marker,
          present: false,
        });
      }

      expect(source).not.toMatch(/\bfetch\s*\(/);
      expect(source).not.toMatch(/XMLHttpRequest|EventSource|sendBeacon/);
    });
  }

  it('GRID is entirely client-side — generated, with no dataset and no request', () => {
    const graticule = code('lib', 'map', 'reference', 'graticule.ts');
    const layer = LAYER_REGISTRY.find((l) => l.id === 'graticule');

    expect(layer?.runtimeEvidence).toMatch(/no dataset and no network request/i);
    expect(graticule).not.toMatch(/\bfetch\s*\(/);
    // It is computed from constants, not loaded.
    expect(graticule).toContain('export function buildGraticule');
  });

  it('Country Evidence reaches ONLY the permitted map-feed path', () => {
    const layer = LAYER_REGISTRY.find((l) => l.id === 'countryEvidence');

    /*
      The permitted path, named explicitly by the CTO note. It is a geography
      feed, not a provider: no GNews, no analysis, no OpenAI.
    */
    expect(layer?.runtimeEvidence).toMatch(/geo\/map-feed/);
    expect(layer?.runtimeEvidence).not.toMatch(/news|gnews|openai/i);
  });

  it('toggling a layer is a pure state write, with no retrieval on the path', () => {
    const rail = code('components', 'map', 'shell', 'LayerToggleRail.tsx');
    const panel = code('components', 'map', 'shell', 'd1', 'LayersControl.tsx');
    const canvas = code('components', 'map', 'shell', 'EvidenceMapCanvas.tsx');

    // Control -> callback.
    expect(rail).toContain('onToggle(layer.id, !on)');
    expect(panel).toContain('onToggle(layer.id, !on)');

    // Canvas -> visibility only. No source rebuild, no data reload.
    expect(canvas).toContain("map.setLayoutProperty(layerId, 'visibility'");
  });
});

describe('the retrieval authority still admits only deliberate country acts', () => {
  it('the allowed reasons are EXPLICIT ACTIONS ONLY', () => {
    /*
      SUPERSEDED. The three old reasons were all PASSIVE: clicking a country,
      committing a country from search, and moving a category filter. Live
      acceptance showed each of them executing GNews from an act the reader
      understood as navigation.

      A NOTE ON THE NAME, because it misled once already: the retired
      `EXPLICIT_COUNTRY_SELECTION` was not explicit RETRIEVAL. It contained the
      word "explicit" because the SELECTION was deliberate — the reader really
      did choose that country — but choosing a place on a map is navigation, and
      navigation is now provider-free. Only an action whose purpose IS retrieval
      qualifies.
    */
    expect([...COUNTRY_RETRIEVAL_REASONS].sort()).toEqual([
      'EXPLICIT_ANALYSIS_REQUEST',
      'EXPLICIT_RETRIEVAL_ACTION',
    ]);
  });

  it('every retired PASSIVE trigger is permanently forbidden by name', () => {
    /*
      Kept by name rather than deleted: a reason that merely disappears is a
      reason someone re-adds, and this defect class has already returned twice.
    */
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
      expect(COUNTRY_RETRIEVAL_REASONS as readonly string[]).not.toContain(retired);
    }
  });

  it('a layer toggle is not among them, and neither is any navigation selection', () => {
    for (const notAReason of ['LAYER_TOGGLE', 'GRID_TOGGLE', 'COUNTRY_EVIDENCE_TOGGLE']) {
      expect(COUNTRY_RETRIEVAL_REASONS as readonly string[]).not.toContain(notAReason);
    }

    expect(FORBIDDEN_RETRIEVAL_TRIGGERS).toContain('CITY_SELECTION');
    expect(FORBIDDEN_RETRIEVAL_TRIGGERS).toContain('REGION_SELECTION');
    expect(FORBIDDEN_RETRIEVAL_TRIGGERS).toContain('CAMERA_MOTION');
  });

  it('the map shell names no executing news endpoint at all', () => {
    const shell = code('components', 'map', 'shell', 'GlobalMapShell.tsx');

    for (const marker of PROVIDER_MARKERS) {
      expect({ marker, present: shell.includes(marker) }).toEqual({ marker, present: false });
    }
  });

  it('the map route acquires its corpus through the RETAINED path only', () => {
    /*
      R5's boundary, re-asserted here so the provider registry is one file
      rather than a cross-reference: mount reads the retained route and never
      the executing one.
    */
    const client = code('components', 'map', 'MapPageClient.tsx');

    expect(client).toContain('fetchRetainedTopHeadlines');
    expect(client).not.toContain('fetchTopHeadlines(');
  });
});
