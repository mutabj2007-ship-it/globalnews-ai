import {
  ADMIN1_COVERAGE,
  REFERENCE_BASE_PATH,
  REFERENCE_LAYERS,
  REFERENCE_SOURCES,
  type ReferenceLayerSpec,
} from './referenceGeography';
import { LAYER_REGISTRY } from '@/lib/map/layers/layerRegistry';

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * CONTEXTUAL REFERENCE GEOGRAPHY — PO RULING D-2
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The ruling's three prohibitions are the reason this file exists:
 *
 *     "It must never be counted as evidence. It must never increase evidence
 *      precision. It must never create reporting where none exists."
 *
 * and its one architectural constraint:
 *
 *     "Do not introduce a commercial/vendor basemap dependency."
 *
 * Those are properties of the DECLARATION, so they can be asserted here rather
 * than inferred from a screenshot of the rendered map.
 */

describe('1 · every byte is same-origin — no vendor, no tile server, no token', () => {
  it('no source is an absolute URL', () => {
    /*
     * The single assertion that keeps ruling D-2's provider-neutrality true.
     * A protocol-relative `//host/...` counts as absolute too, which is why
     * the check is "starts with the reference path" rather than "does not
     * start with http".
     */
    for (const url of Object.values(REFERENCE_SOURCES)) {
      expect(url.startsWith(`${REFERENCE_BASE_PATH}/`)).toBe(true);
      expect(url).not.toMatch(/^[a-z]+:/i);
      expect(url).not.toMatch(/^\/\//);
    }
  });

  it('no layer carries an API key, token or style-server parameter', () => {
    const declaration = JSON.stringify({ REFERENCE_SOURCES, REFERENCE_LAYERS });

    for (const forbidden of ['token', 'apikey', 'api_key', 'access_token', 'style.json', 'tiles']) {
      expect(declaration.toLowerCase()).not.toContain(forbidden);
    }
  });
});

describe('2 · reference geography is SUBORDINATE, and structurally cannot be evidence', () => {
  it('every layer is a fill or a line — never a circle, never a symbol', () => {
    /*
     * The evidence layers are circles (halo, mark) and the captions are
     * HTML labels. Restricting reference geography to areas and lines means
     * a reference feature cannot be mistaken for an evidence mark even by
     * accident of styling.
     */
    for (const layer of REFERENCE_LAYERS) {
      expect(['fill', 'line']).toContain(layer.type);
    }
  });

  it('no layer declares an evidence, precision or provenance property', () => {
    const declaration = JSON.stringify(REFERENCE_LAYERS).toLowerCase();

    for (const forbidden of ['evidence', 'precision', 'provenance', 'report', 'situation']) {
      expect(declaration).not.toContain(forbidden);
    }
  });

  it('every layer answers to a rail key that the layer registry already declares', () => {
    /*
     * A reference layer the reader cannot switch off would be a layer outside
     * the rail's contract. Binding each one to an EXISTING registry id also
     * stops D-2 quietly inventing a new toggle vocabulary.
     */
    const registryIds = new Set(LAYER_REGISTRY.map((layer) => layer.id));

    for (const layer of REFERENCE_LAYERS) {
      expect(registryIds.has(layer.rail)).toBe(true);
    }
  });

  it('every rail key it uses belongs to the REFERENCE class, never EVIDENCE', () => {
    const classOf = new Map(LAYER_REGISTRY.map((layer) => [layer.id, layer.class]));

    for (const layer of REFERENCE_LAYERS) {
      expect(classOf.get(layer.rail)).toBe('REFERENCE');
    }
  });
});

describe('3 · draw order — water on the land, lines above the water', () => {
  const indexOf = (id: string): number => REFERENCE_LAYERS.findIndex((layer) => layer.id === id);

  it('lake fill is first, so nothing else is drawn under water', () => {
    expect(indexOf('gn-ref-lakes-fill')).toBe(0);
  });

  it('the lake outline sits directly on its own fill', () => {
    expect(indexOf('gn-ref-lakes-line')).toBe(indexOf('gn-ref-lakes-fill') + 1);
  });

  it('sub-national boundaries are drawn above hydrography', () => {
    expect(indexOf('gn-ref-admin1')).toBeGreaterThan(indexOf('gn-ref-lakes-line'));
  });

  it('the array has no duplicate layer ids', () => {
    const ids = REFERENCE_LAYERS.map((layer) => layer.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('3b · NO EDGE IS DRAWN TWICE — the C904 registration seam, closed', () => {
  /*
   * PO C904 review: "the 110m land fill + 50m shoreline mismatch is NOT
   * approved... No visible registration seam should be knowingly shipped."
   *
   * The seam came from drawing one edge from two datasets. These assertions
   * are what stop it being reintroduced: the coastline and the international
   * boundary belong to the spatial surface's own country polygons, and this
   * module must never publish a second rendering of either.
   */
  it('publishes no coastline layer or source', () => {
    expect(REFERENCE_LAYERS.some((layer) => /coast/i.test(layer.id))).toBe(false);
    expect(Object.keys(REFERENCE_SOURCES).some((id) => /coast/i.test(id))).toBe(false);
  });

  it('publishes no admin-0 boundary layer or source', () => {
    expect(REFERENCE_LAYERS.some((layer) => /admin0/i.test(layer.id))).toBe(false);
    expect(Object.keys(REFERENCE_SOURCES).some((id) => /admin0/i.test(id))).toBe(false);
  });

  it('every remaining layer draws something the country polygons do not contain', () => {
    /*
     * Inland water, rivers and sub-national lines. A country boundary file has
     * none of these, so none of them can duplicate an edge the base geometry
     * already draws.
     */
    const sources = new Set(REFERENCE_LAYERS.map((layer) => layer.source));
    expect([...sources].sort()).toEqual(['admin1Lines', 'lakes', 'rivers']);
  });
});

describe('4 · zoom floors match the registry ranges the design already declared', () => {
  const withMinzoom = REFERENCE_LAYERS.filter(
    (layer): layer is ReferenceLayerSpec & { minzoom: number } => layer.minzoom !== undefined,
  );

  it('no layer is drawn below the zoom its registry entry allows', () => {
    for (const layer of withMinzoom) {
      const range = LAYER_REGISTRY.find((entry) => entry.id === layer.rail)?.zoomRange;

      expect(range).toBeDefined();
      if (range === undefined) continue;

      expect(layer.minzoom).toBeGreaterThanOrEqual(range[0]);
    }
  });

  it('rivers and sub-national lines are not drawn at the world view', () => {
    /*
     * At Z1 a 1:50m river network is a grey smear over the ocean. The world
     * view exists to orient, and detail that cannot be read at a scale costs
     * legibility without buying anything.
     */
    expect(REFERENCE_LAYERS.find((layer) => layer.id === 'gn-ref-rivers')?.minzoom).toBeGreaterThanOrEqual(4);
    expect(REFERENCE_LAYERS.find((layer) => layer.id === 'gn-ref-admin1')?.minzoom).toBeGreaterThanOrEqual(6);
  });
});

describe('5 · NISR REMAINS THE RWANDA ADMINISTRATIVE AUTHORITY', () => {
  it('the bundled sub-national baseline contains no Rwandan feature', () => {
    /*
     * Ruling D-2: "The Rwanda NISR geometry remains the Rwanda administrative
     * authority." Measured upstream: `ne_50m_admin_1_states_provinces_lines`
     * publishes 581 features across nine federal states — BRA AUS USA CAN RUS
     * IDN CHN IND ZAF — and none for Rwanda or any of its neighbours.
     *
     * So there is no competing administrative source to draw beside NISR at
     * this scale, and the build script's exclusion filter is a guard for a
     * future baseline rather than a filter doing work today. Both facts are
     * pinned here so a later, wider baseline cannot quietly introduce one.
     */
    expect(ADMIN1_COVERAGE.rwandaFeatures).toBe(0);
    expect(ADMIN1_COVERAGE.eastAfricaFeatures).toBe(0);
    expect(ADMIN1_COVERAGE.administrativeAuthorityForRwanda).toBe('NISR');
  });
});
