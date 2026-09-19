import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  GRATICULE_GUARANTEED_ZOOM,
  GRATICULE_LAYER_ID,
  GRATICULE_RAIL_KEY,
  GRATICULE_REFERENCE_PANE_PX,
  GRATICULE_STEP_DEGREES,
  buildGraticule,
  graticuleDegreesAcross,
  graticuleGuaranteedAtZoom,
} from '@/lib/map/reference/graticule';
import { LayersControl } from '@/components/map/shell/d1/LayersControl';
import { defaultLayerState, railLayers } from '@/lib/map/layers/layerRegistry';
import { en } from '@/lib/i18n/dictionaries/en';
import { pl } from '@/lib/i18n/dictionaries/pl';

/**
 * ══ R2-B §8 — GRID: ROOT CAUSE AND A SUPPORTED-ZOOM CONTRACT ══════════════
 *
 * MAP-GRID-RENDERING
 *
 * THE REPORT was "GRID clicked; no change". THE FINDING is that nothing is
 * broken. The source exists, the layer exists, the visibility call runs, and
 * the toggle has worked since R1. The grid was drawing exactly where it is
 * specified to draw — and that is nowhere a reader looking at a country can
 * see it.
 *
 * THREE FACTS COMPOUND, ALL THREE DELIBERATE:
 *
 *   UNDER THE LAND. Stroked after the ocean fill and before the land base, per
 *   the prototype's draw order and the golden world frame. It reads across
 *   open water and is covered by land. A reader zoomed to Kenya, Rwanda or
 *   Poland is looking at a viewport that is almost entirely land.
 *
 *   THE CELL IS BIGGER THAN THE VIEW. At 10° a cell is about 1,100 km. Past
 *   the zoom §2 derives, a viewport fits inside one cell and contains no line
 *   at all — the layer visible, painting correctly, with nothing in frame.
 *
 *   7.5% ALPHA AT 0.6 px. Subtle by design; v1.5 raised it from 5% precisely
 *   so it would clear the noise floor.
 *
 * ── WHY NOTHING ABOUT THE GEOMETRY CHANGED ────────────────────────────────
 *
 * The draw order is C907 §4 and is measured against the golden frame; the 10°
 * step is d3's `geoGraticule10`, confirmed independently at 33 px per meridian
 * on the golden capture; the colour and width are design tokens. Moving the
 * grid above the land, tightening the step or raising the alpha would each
 * change governed geometry to fix a REPORTING problem, and would make the map
 * disagree with the reference it was measured against.
 *
 * So the contract is declared and the rail tells the reader when they are
 * outside it. §4 proves the geometry is untouched.
 */

const SRC = resolve(__dirname, '..', '..');

const CANVAS = readFileSync(
  resolve(SRC, 'components', 'map', 'shell', 'EvidenceMapCanvas.tsx'),
  'utf-8',
);

const LOCALES = [
  ['en', en],
  ['pl', pl],
] as const;

const labelsFor = (dict: typeof en) => ({
  title: dict.map.shell.layersTitle,
  layers: dict.map.spatial.layers.layers,
  outOfScale: dict.map.shell.layerOutOfScale,
  status: {
    LIVE: dict.map.shell.layerStatusLive,
    GATED: dict.map.shell.layerStatusGated,
    NOT_IMPLEMENTED: dict.map.shell.layerStatusNotImplemented,
    FAILED_MEASUREMENT: dict.map.shell.layerStatusUnmeasured,
  },
});

const rail = (dict: typeof en, on: boolean, zoom?: number): string =>
  renderToStaticMarkup(
    createElement(LayersControl, {
      state: { ...defaultLayerState(), [GRATICULE_RAIL_KEY]: on },
      labels: labelsFor(dict),
      onToggle: () => undefined,
      zoom,
    }),
  );

/* ══════════════════════════════════════════════════════════════════════════
   1 — THE CONTROL IS NOT DEAD, AND THIS IS WHAT PROVES IT
   ══════════════════════════════════════════════════════════════════════════ */

describe('every part of the GRID path exists and is wired', () => {
  it('the geometry is built, and it really is a 10° grid', () => {
    const grid = buildGraticule();
    const lines = grid.features[0].geometry.coordinates;

    /* 36 meridians at 10° from -180 (excluding +180), 17 parallels -80..80. */
    expect(lines).toHaveLength(36 + 17);
    expect(GRATICULE_STEP_DEGREES).toBe(10);
  });

  it('the layer is added to the map', () => {
    expect(CANVAS).toContain('id: GRATICULE_LAYER_ID');
    expect(CANVAS).toContain('map.addSource(GRATICULE_SOURCE_ID');
  });

  it('and the rail control governs its visibility', () => {
    expect(CANVAS).toContain("apply(GRATICULE_LAYER_ID, layers.graticule !== false)");
    expect(GRATICULE_RAIL_KEY).toBe('graticule');
    expect(GRATICULE_LAYER_ID).toBe('gn-graticule-line');
  });

  it('the layer is still declared LIVE, and honestly so', () => {
    const graticule = railLayers().find((layer) => layer.id === GRATICULE_RAIL_KEY);

    expect(graticule?.runtime).toBe('LIVE');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   2 — THE SUPPORTED-ZOOM CONTRACT, DERIVED RATHER THAN RESTATED
   ══════════════════════════════════════════════════════════════════════════ */

describe('the zoom past which no line is guaranteed', () => {
  it('the threshold follows from the projection, not from a preference', () => {
    /*
      Re-derived here instead of repeating the constant. A spec that only
      echoes a number back checks nothing: if someone edits the constant, this
      recomputes the answer and disagrees with them.
    */
    const limit = Math.log2((360 * GRATICULE_REFERENCE_PANE_PX) / (512 * GRATICULE_STEP_DEGREES));

    expect(GRATICULE_GUARANTEED_ZOOM).toBe(Math.floor(limit));
    expect(GRATICULE_GUARANTEED_ZOOM).toBe(6);
  });

  it('a line is guaranteed at and below the threshold', () => {
    expect(graticuleGuaranteedAtZoom(0)).toBe(true);
    expect(graticuleGuaranteedAtZoom(3)).toBe(true);
    expect(graticuleGuaranteedAtZoom(GRATICULE_GUARANTEED_ZOOM)).toBe(true);
  });

  it('and not above it — which is the reported symptom, quantified', () => {
    /*
      Rwanda fills the frame at roughly z7-8. At z8 a 1000px pane spans about
      2.7° and a 10° cell cannot fit a line into it. The control was working
      perfectly and the map had nothing to show.
    */
    expect(graticuleGuaranteedAtZoom(7)).toBe(false);
    expect(graticuleGuaranteedAtZoom(8)).toBe(false);
    expect(graticuleDegreesAcross(8, 1000)).toBeLessThan(GRATICULE_STEP_DEGREES);
  });

  it('a wider pane holds the guarantee slightly longer, as the arithmetic says', () => {
    /* Not a special case — the pane width is a term, so it is exercised. */
    expect(graticuleGuaranteedAtZoom(6, 2400)).toBe(true);
    expect(graticuleGuaranteedAtZoom(6, 300)).toBe(false);
  });

  it('IT IS A GUARANTEE, NOT A CUT-OFF — nothing is disabled or hidden by zoom', () => {
    /*
      The distinction matters. Above the threshold a reader near a meridian
      still sees it, so the layer must keep drawing. Any zoom gate in the
      canvas would be a behaviour change dressed as a contract.
    */
    expect(CANVAS).not.toContain('minzoom: GRATICULE');
    expect(CANVAS).not.toContain('maxzoom: GRATICULE');
    expect(CANVAS).not.toContain('GRATICULE_GUARANTEED_ZOOM');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   3 — THE RAIL SAYS SO, INSTEAD OF LEAVING THE READER CLICKING
   ══════════════════════════════════════════════════════════════════════════ */

describe('a working control stops reading as a dead one', () => {
  for (const [locale, dict] of LOCALES) {
    it(`${locale} — ON and above the threshold raises the note`, () => {
      const html = rail(dict, true, 8);

      expect(html).toContain('data-gn-layer-scale="out-of-scale"');
      expect(html).toContain(dict.map.shell.layerOutOfScale);
    });

    it(`${locale} — ON and within the threshold does not`, () => {
      const html = rail(dict, true, 2);

      expect(html).not.toContain('data-gn-layer-scale="out-of-scale"');
    });

    it(`${locale} — OFF never raises it, at any zoom`, () => {
      /*
        A reader who has not turned the layer on is not owed an explanation of
        where it would have appeared.
      */
      expect(rail(dict, false, 8)).not.toContain('data-gn-layer-scale="out-of-scale"');
    });

    it(`${locale} — the reason is in the accessible name too, not only the chip`, () => {
      /*
        The same rule the disabled rows already follow: an explanation only a
        mouse can reach is no explanation for the readers most likely to be
        told "nothing happened".
      */
      expect(rail(dict, true, 8)).toContain(`— ${dict.map.shell.layerOutOfScale}"`);
    });

    it(`${locale} — and the control stays fully operable while the note shows`, () => {
      /*
        THE POINT OF THE NOTE. It explains; it does not withdraw. A row that
        disabled itself here would have turned a reporting problem into a real
        dead control.
      */
      const html = rail(dict, true, 8);
      const row = html.slice(
        html.indexOf(`data-gn-layer="${GRATICULE_RAIL_KEY}"`),
        html.indexOf('</button>', html.indexOf(`data-gn-layer="${GRATICULE_RAIL_KEY}"`)),
      );

      expect(row).toContain('data-gn-layer-toggleable="true"');
      expect(row).toContain('aria-pressed="true"');
      expect(row).not.toContain('disabled');
    });
  }

  it('no zoom means no note — an unknown camera is not a guessed one', () => {
    expect(rail(en, true, undefined)).not.toContain('data-gn-layer-scale');
  });

  it('only the graticule carries a scale contract', () => {
    /*
      Keyed off the graticule module's own rail key, so the module that owns
      the contract is the one that says which layer has it. No other row may
      acquire the note without a contract of its own.
    */
    expect(rail(en, true, 8).split('out-of-scale').length - 1).toBe(2);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   4 — THE GOVERNED GEOMETRY IS UNTOUCHED
   ══════════════════════════════════════════════════════════════════════════ */

describe('nothing about what is drawn changed', () => {
  it('the grid is still beneath the land, which is why it reads over ocean only', () => {
    /*
      C907 §4 and the golden frame. This ordering IS the first root cause, and
      it is deliberately preserved: moving the grid above the land would put a
      grid over the continents, which the reference does not do.
    */
    expect(CANVAS.indexOf('id: GRATICULE_LAYER_ID')).toBeLessThan(
      CANVAS.indexOf('id: LAND_LAYER_ID'),
    );
  });

  it('the step is still d3’s 10°', () => {
    expect(GRATICULE_STEP_DEGREES).toBe(10);
  });

  it('the paint tokens are unchanged', () => {
    const tokens = readFileSync(
      resolve(SRC, 'lib', 'map', 'spatial', 'designRenderTokens.ts'),
      'utf-8',
    );

    expect(tokens).toContain("graticule: 'rgba(126,166,186,.075)'");
    expect(tokens).toContain('graticule: { base: 0.6, perZoom: 0, cap: 0.6 }');
  });
});
