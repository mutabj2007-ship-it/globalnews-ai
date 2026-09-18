import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { en } from '@/lib/i18n/dictionaries/en';
import { pl } from '@/lib/i18n/dictionaries/pl';
import {
  LAYER_REGISTRY,
  defaultLayerState,
  railLayers,
} from '@/lib/map/layers/layerRegistry';
import { LayersControl } from '@/components/map/shell/d1/LayersControl';

/**
 * ══ PHASE B — THE TWO DEAD CONTROLS, AND THE ONE CAUSE BEHIND THEM ════════
 *
 * MAP-COUNTRY-EVIDENCE-LAYER-TOGGLE-1 · MAP-GRID-CONTROL-1
 *
 * MEASURED LIVE, and both reported as separate defects:
 *
 *     DOWODY KRAJOWE   clicked repeatedly; checkbox remained OFF; no visual
 *                      state change; no layer; no URL/state change.
 *     SIATKA WSPÓŁRZĘDNYCH / GRID   clicked; no change.
 *
 * THEY ARE ONE DEFECT WITH TWO SYMPTOMS, plus a second defect that made the
 * first invisible:
 *
 *   1  `LayersControl.onToggle` is OPTIONAL and the shell never passed it, so
 *      `onClick={live && onToggle ? … : undefined}` was `undefined` for every
 *      row. The panel rendered enabled-looking buttons carrying `aria-pressed`
 *      and wired to nothing.
 *
 *   2  the state indicator rendered `{on ? '' : ''}` — two empty strings — so
 *      ON and OFF produced byte-identical markup. Even with the click wired,
 *      nothing would have looked different.
 *
 * NEITHER IS A MISSING BACKEND CAPABILITY, which is why neither is classified
 * IMPLEMENTATION BLOCKED — DEPENDENCY. `graticule` is generated client-side
 * with no dataset and no request; `countryEvidence` is backed by
 * `/geo/map-feed`. Both are `runtime: 'LIVE'` in the registry and both are
 * consumed by the canvas.
 */

const SRC = resolve(__dirname, '..', '..');

const code = (...parts: string[]): string =>
  readFileSync(join(SRC, ...parts), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const SHELL = code('components', 'map', 'shell', 'GlobalMapShell.tsx');
const CANVAS = code('components', 'map', 'shell', 'EvidenceMapCanvas.tsx');

const labelsFor = (dict: typeof en) => ({
  title: dict.map.shell.layersTitle,
  layers: dict.map.spatial.layers.layers,
  status: {
    LIVE: dict.map.shell.layerStatusLive,
    GATED: dict.map.shell.layerStatusGated,
    NOT_IMPLEMENTED: dict.map.shell.layerStatusNotImplemented,
    FAILED_MEASUREMENT: dict.map.shell.layerStatusUnmeasured,
  },
});

describe('the capability is real, so the control must not be faked away', () => {
  it('graticule is LIVE, client-generated, and needs no network', () => {
    const layer = LAYER_REGISTRY.find((l) => l.id === 'graticule');

    expect(layer?.runtime).toBe('LIVE');
    expect(layer?.available).toBe(true);
    expect(layer?.runtimeEvidence).toMatch(/no dataset and no network request/i);
  });

  it('countryEvidence is LIVE and backed by a served route', () => {
    const layer = LAYER_REGISTRY.find((l) => l.id === 'countryEvidence');

    expect(layer?.runtime).toBe('LIVE');
    expect(layer?.available).toBe(true);
    expect(layer?.runtimeEvidence).toMatch(/geo\/map-feed/);
  });

  it('both are actually consumed by the canvas, not merely declared', () => {
    expect(CANVAS).toContain('apply(GRATICULE_LAYER_ID, layers.graticule !== false)');
    expect(CANVAS).toContain('apply(FILL_LAYER_ID, layers.countryEvidence !== false)');
    expect(CANVAS).toContain('apply(EVIDENCE_LINE_LAYER_ID, layers.countryEvidence !== false)');
  });

  it('and the graticule layer is genuinely added, so `apply` can find it', () => {
    /*
      `apply` returns silently when `map.getLayer(id) === undefined`, which is
      how a toggle can be perfectly wired and still do nothing. The add is
      pinned so that failure mode cannot return unnoticed.
    */
    expect(CANVAS).toContain('map.addSource(GRATICULE_SOURCE_ID');
    expect(CANVAS).toContain('id: GRATICULE_LAYER_ID');
  });
});

describe('ONE canonical layer state — the panel writes to the rail’s state', () => {
  it('the shell passes the SAME callback to both controls', () => {
    const railAt = SHELL.indexOf('<LayerToggleRail');
    const panelAt = SHELL.indexOf('<LayersControl');

    expect(railAt).toBeGreaterThan(-1);
    expect(panelAt).toBeGreaterThan(-1);

    const rail = SHELL.slice(railAt, SHELL.indexOf('/>', railAt));
    const panel = SHELL.slice(panelAt, SHELL.indexOf('/>', panelAt));

    expect(rail).toContain('onToggle={onToggleLayer}');
    expect(panel).toContain('onToggle={onToggleLayer}');
    expect(panel).toContain('state={layers}');
  });

  it('there is exactly one layer-state holder — no duplicate independent toggle', () => {
    expect(SHELL.match(/useState<Record<string, boolean>>/g)).toHaveLength(1);
    expect(SHELL).toContain('defaultLayerState()');
    expect(SHELL.match(/setLayers\(/g)).toHaveLength(1);
  });

  it('POSITIVE CONTROL — an omitted onToggle really does produce a dead button', () => {
    /*
      The defect, reproduced. Without a handler the component emits no onClick
      at all, which is what made the panel look interactive and do nothing.
    */
    const dead = renderToStaticMarkup(
      createElement(LayersControl, {
        state: defaultLayerState(),
        labels: labelsFor(en),
      }),
    );

    /*
      SCOPED TO THE LIVE ROW. A first draft asserted `disabled=""` was absent
      from the whole panel and failed correctly: the UNBUILT rows are supposed
      to carry it. The point is narrower and sharper — a LIVE row looks fully
      interactive whether or not a handler was passed, which is exactly why the
      omission survived review and had to be found in a live browser.
    */
    const graticuleButton = dead.slice(
      dead.indexOf('data-gn-layer="graticule"'),
      dead.indexOf('</button>', dead.indexOf('data-gn-layer="graticule"')),
    );

    expect(graticuleButton).toContain('data-gn-layer-toggleable="true"');
    expect(graticuleButton).toContain('aria-pressed');
    expect(graticuleButton).not.toContain('disabled');
    expect(graticuleButton).not.toContain('cursor-not-allowed');
  });
});

describe('the state indicator distinguishes ON from OFF', () => {
  for (const [locale, dict] of [
    ['en', en],
    ['pl', pl],
  ] as const) {
    it(`${locale} — a layer that is ON renders differently from one that is OFF`, () => {
      const base = defaultLayerState();

      const on = renderToStaticMarkup(
        createElement(LayersControl, {
          state: { ...base, graticule: true, countryEvidence: true },
          labels: labelsFor(dict),
          onToggle: () => undefined,
        }),
      );
      const off = renderToStaticMarkup(
        createElement(LayersControl, {
          state: { ...base, graticule: false, countryEvidence: false },
          labels: labelsFor(dict),
          onToggle: () => undefined,
        }),
      );

      /*
        THE ASSERTION THAT WOULD HAVE CAUGHT THE ORIGINAL DEFECT. Before this
        correction these two renders were byte-identical apart from
        `aria-pressed`, because the indicator was `{on ? '' : ''}`.
      */
      expect(on).not.toBe(off);
      expect(on).toContain('data-gn-layer-state="on"');
      expect(off).toContain('data-gn-layer-state="off"');
      expect(on).toContain('bg-current');
    });
  }

  it('an unbuilt layer is marked unavailable rather than simply off', () => {
    const html = renderToStaticMarkup(
      createElement(LayersControl, {
        state: defaultLayerState(),
        labels: labelsFor(en),
        onToggle: () => undefined,
      }),
    );

    const unbuilt = railLayers().filter((l) => l.runtime !== 'LIVE');

    expect(unbuilt.length).toBeGreaterThan(0);
    expect(html).toContain('data-gn-layer-state="unavailable"');
    // And it stays genuinely disabled — the capability is not faked.
    expect(html).toContain('disabled=""');
  });
});

describe('an unbuilt capability is still refused — nothing was faked', () => {
  it('only LIVE layers are clickable in the panel', () => {
    const control = code('components', 'map', 'shell', 'd1', 'LayersControl.tsx');

    expect(control).toContain('const live = layer.runtime === \'LIVE\'');
    expect(control).toContain('disabled={!live}');
    expect(control).toContain('onClick={live && onToggle ?');
  });

  it('a GATED layer keeps its status badge and its stated reason', () => {
    const gated = LAYER_REGISTRY.filter((l) => l.runtime === 'GATED');

    expect(gated.length).toBeGreaterThan(0);
    for (const layer of gated) {
      expect(layer.available).toBe(false);
      expect(layer.runtimeEvidence).toMatch(/GATE:/);
    }
  });
});
