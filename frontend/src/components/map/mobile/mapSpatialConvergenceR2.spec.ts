import { readFileSync } from 'fs';
import { join } from 'path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  MAP_ASK_FLOAT_W_PX,
  MAP_ASK_HUD_PX,
  MAP_ASK_RAIL_PX,
  mapAskLayoutFor,
  mapAskMaxHeight,
  mapAskPanelStyle,
} from '@/lib/ask/mapAskGeometry';
import { MIN_MAP_FRACTION, FULL_FRACTION, MobileBottomSheet } from './MobileBottomSheet';
import { LayersControl } from '@/components/map/shell/d1/LayersControl';
import { MapControlCluster } from '@/components/map/shell/d1/MapControlCluster';
import { FollowControl } from '@/components/map/shell/FollowControl';
import { LAYER_REGISTRY, railLayers } from '@/lib/map/layers/layerRegistry';
import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MAP / SPATIAL VISUAL CONVERGENCE R2 — THE CONVERGED PRESENTATION, ASSERTED
 * ════════════════════════════════════════════════════════════════════════════
 *
 *   phone sheet   read at PEEK: identity · reporting state · Follow · ONE primary;
 *                 selection does not raise it; Load is the only read
 *   phone data    the sheet shows what the explicit read returned
 *   Ask on /map   Spatial geometry; the map keeps its ≥26% floor
 *   desktop D1    globe · Layers · 3D as one row of controls; banner in the column
 */

const FRONTEND = join(__dirname, '../../../..');
const read = (path: string): string => readFileSync(join(FRONTEND, path), 'utf8');
const SHELL = read('src/components/map/mobile/MobileSpatialShell.tsx');
const DOCK = read('src/components/ask/AskAiDock.tsx');
const DESKTOP = read('src/components/map/shell/GlobalMapShell.tsx');

const bodyOf = (source: string, marker: string): string => {
  const at = source.indexOf(marker);
  expect(at).toBeGreaterThan(-1);
  return source.slice(at, source.indexOf('\n  );\n', at));
};

describe('ASK ON THE MAP — geometry (lib/ask/mapAskGeometry)', () => {
  it('phone below 861, the rail column to 1279, a floating panel from 1280', () => {
    expect([360, 390, 430, 768, 860].map(mapAskLayoutFor)).toEqual(Array(5).fill('compact'));
    expect([861, 1024, 1279].map(mapAskLayoutFor)).toEqual(['rail', 'rail', 'rail']);
    expect([1280, 1440, 1920].map(mapAskLayoutFor)).toEqual(['float', 'float', 'float']);
  });

  it('the phone composer cap is the Map sheet FULL fraction, so the map floor survives Ask', () => {
    expect(1 - FULL_FRACTION).toBeCloseTo(MIN_MAP_FRACTION, 10);
    for (const vv of [508, 620, 780, 800, 844, 932, 1024]) {
      for (const nav of [0, 57, 91]) {
        const workspace = vv - MAP_ASK_HUD_PX - nav;
        const cap = mapAskMaxHeight(vv, nav);
        expect((workspace - cap) / workspace).toBeGreaterThanOrEqual(MIN_MAP_FRACTION);
        expect(Number.isInteger(cap)).toBe(true);
      }
    }
  });

  it('the phone composer stands on the nav, or on the keyboard when one is open — never both', () => {
    expect(mapAskPanelStyle('compact', { visualViewportHeight: 844, navInset: 91, keyboardInset: 0 }))
      .toEqual({ bottom: 91, maxHeight: mapAskMaxHeight(844, 91) });
    expect(mapAskPanelStyle('compact', { visualViewportHeight: 508, navInset: 91, keyboardInset: 336 }))
      .toEqual({ bottom: 336, maxHeight: mapAskMaxHeight(508, 0) });
  });

  it('is never the generic 86dvh sheet on the map', () => {
    const style = mapAskPanelStyle('compact', { visualViewportHeight: 0, navInset: 0, keyboardInset: 0 });
    expect(String(style.maxHeight)).toBe(`calc(74dvh - ${MAP_ASK_HUD_PX}px)`);
  });

  it('desktop: the rail column, or a 440px panel that stops at the rail edge', () => {
    expect(mapAskPanelStyle('rail', { visualViewportHeight: 900, navInset: 0, keyboardInset: 0 }))
      .toMatchObject({ right: 0, width: MAP_ASK_RAIL_PX });
    const float = mapAskPanelStyle('float', { visualViewportHeight: 900, navInset: 0, keyboardInset: 0 });
    expect(float.width).toBe(MAP_ASK_FLOAT_W_PX);
    expect(Number(float.right)).toBeGreaterThanOrEqual(MAP_ASK_RAIL_PX);
  });
});

describe('ASK ON THE MAP — the dock keeps every contract', () => {
  it('only /map takes the Spatial geometry, and /ask still unmounts the dock', () => {
    expect(DOCK).toContain("const MAP_ROUTE = '/map';");
    expect(DOCK).toContain('mapSurface={pathname === MAP_ROUTE}');
    expect(DOCK).toContain('if (pathname === ASK_CANONICAL_ROUTE) return null;');
  });

  it('the generic dock classes are unchanged for every other route', () => {
    expect(DOCK).toContain("'inset-x-0 bottom-0 h-[86dvh] max-h-[86dvh] rounded-t-2xl'");
    expect(DOCK).toContain("className={onMap ? mapPanelClass : [");
  });

  it('there is still exactly ONE transport site, and it is the submit handler', () => {
    expect(DOCK.match(/analyzeNews\(asked/g)).toHaveLength(1);
    expect(DOCK.match(/onSubmit=\{submit\}/g)).toHaveLength(2);
  });

  it('opening measures the page and nothing else: the map effects contain no request', () => {
    const effects = DOCK.slice(DOCK.indexOf('MAP R2 — which Spatial Ask geometry'), DOCK.indexOf('/* Escape closes'));
    expect(effects).not.toMatch(/fetch\(|analyzeNews|accountFetch/);
  });

  it('the map composer keeps the textarea id, the context read and the disabled-until-text Send', () => {
    const mapComposer = DOCK.slice(DOCK.indexOf('MAP R2 — THE SPATIAL COMPOSER'), DOCK.indexOf(') : (\n          <div data-ask="composer"'));
    expect(mapComposer).toContain('id="ask-ai-question"');
    expect(mapComposer).toContain('data-ask="context-affordance"');
    expect(mapComposer).toContain("showStoryLabel\n                      ? t.contextChipAnchored");
    expect(mapComposer).toContain("disabled={question.trim().length === 0 || phase.kind === 'loading'}");
    /* 16px so iOS does not zoom the page when the composer takes focus. */
    expect(mapComposer).toContain('text-[16px]');
  });

  it('the floating launcher yields ONLY on the phone map, where the map chip is the entry', () => {
    const launcher = DOCK.slice(DOCK.indexOf('data-ask="launcher"'), DOCK.indexOf('</button>', DOCK.indexOf('data-ask="launcher"')));
    expect(launcher).toContain("...(mapLayout === 'compact' ? { display: 'none' } : {}),");
    /* the /my-intelligence gate is untouched */
    expect(DOCK).toContain('{showLauncher && (');
  });
});

describe('THE PHONE COUNTRY SHEET', () => {
  it('a map tap or a country search result selects without raising the sheet', () => {
    const tap = bodyOf(SHELL, 'const onSelectFromMap = useCallback(');
    expect(tap).toContain('onSelectCountry?.(feature);');
    expect(tap).not.toContain('setStop');
    const search = SHELL.slice(SHELL.indexOf("if (result.kind === 'COUNTRY'"), SHELL.indexOf('const committed = result.region;'));
    expect(search).not.toContain("setStop('HALF')");
  });

  it('Load is the ONLY read, reached from a press — never from selection', () => {
    expect(SHELL.match(/countryRead\?\.onLoad\(\)/g)).toHaveLength(1);
    expect(bodyOf(SHELL, 'const onLoadCountry = useCallback(')).toContain('countryRead?.onLoad();');
    expect(SHELL.match(/onClick=\{onLoadCountry\}/g)).toHaveLength(2);
    expect(SHELL).not.toMatch(/useEffect\([^)]*onLoad/);
  });

  it('the phone reads the explicit read once it settles, and the retained corpus before', () => {
    expect(SHELL).toContain("countryRead.state === 'READY' || countryRead.state === 'READY_NO_COVERAGE'");
    expect(SHELL).toContain('const loadedItems = readSettled ? (countryRead?.items ?? []) : null;');
    expect(SHELL).toContain('loadedItems !== null && loadedItems.length > 0 ? loadedItems : (selectionDetail?.items ?? [])');
  });

  it('secondary actions are one compact row, and only once there is something to navigate', () => {
    const nav = SHELL.slice(SHELL.indexOf('data-gn="mobile-sheet-nav"'), SHELL.indexOf('</nav>'));
    expect(nav).toContain('data-gn="mobile-action-analysis"');
    expect(nav).toContain('data-gn="mobile-action-sources"');
    expect(SHELL).toContain('{(readSettled || items.length > 0) && (');
  });

  it('Sources opens the sources on the phone (the desktop rail scroll target does not exist here)', () => {
    const open = bodyOf(SHELL, 'const openSources = useCallback(');
    expect(open).toContain("setStop('FULL')");
    expect(open).not.toContain('onOpenSources');
  });

  it('clear is a quiet 44px glyph, not a slab', () => {
    const clear = SHELL.slice(SHELL.indexOf('data-gn="mobile-clear-selection"'), SHELL.indexOf('</button>', SHELL.indexOf('data-gn="mobile-clear-selection"')));
    expect(clear).toContain('aria-label={mobile.clearSelection}');
    expect(clear).toContain('minWidth: MIN_TOUCH_PX');
    expect(clear).not.toContain('w-full');
  });

  it('Ask about {country} opens the dock and spends nothing', () => {
    const chip = SHELL.slice(SHELL.indexOf('data-gn="mobile-ask-about"'), SHELL.indexOf('</button>', SHELL.indexOf('data-gn="mobile-ask-about"')));
    expect(chip).toContain('onClick={() => openGlobalAsk()}');
    expect(SHELL).not.toMatch(/analyzeNews|analysisApi/);
    /* It rides the zoom pair's row and never shares its column. */
    expect(chip).toContain('bottom: workspace.zoomBottomPx');
    expect(chip).toContain("right: stop === 'FULL' ? 10 : 10 + MIN_TOUCH_PX + 8");
  });

  it('Watch stays dormant: nothing on the sheet offers it while the runtime is inactive', () => {
    expect(SHELL.match(/WATCH_RUNTIME_ACTIVE &&/g)?.length).toBe(2);
  });
});

describe('THE SHEET HANDLE straddles the edge and keeps its 44px target', () => {
  const html = renderToStaticMarkup(
    createElement(MobileBottomSheet, {
      stop: 'PEEK',
      onStopChange: () => undefined,
      workspaceHeight: 700,
      overlapHandle: true,
      labels: { sheetLabel: 'Sheet', handleLabel: 'Resize', stops: { PEEK: 'Peek', HALF: 'Half', FULL: 'Full' } },
      children: createElement('p', null, 'content'),
    }),
  );

  it('the grip is 44px tall and does not take a full-width row', () => {
    const at = html.indexOf('data-gn="mobile-sheet-handle"');
    const tag = html.slice(html.lastIndexOf('<button', at), html.indexOf('>', at));
    expect(tag).toMatch(/h-\[44px\]/);
    expect(tag).toMatch(/w-\[112px\]/);
    expect(tag).not.toMatch(/w-full/);
  });

  it('content starts under the grip rather than below a 44px band', () => {
    expect(html).toMatch(/data-gn="mobile-sheet-content"[^>]*pt-\[18px\]/);
  });
});

describe('DESKTOP D1 — Layers is a control, not a standing panel', () => {
  const LABELS = {
    title: 'Layers',
    layers: Object.fromEntries(LAYER_REGISTRY.map((l) => [l.id, l.id.toUpperCase()])),
    outOfScale: 'NOT AT THIS SCALE',
    status: { LIVE: 'LIVE', GATED: 'GATED', NOT_IMPLEMENTED: 'NOT IMPLEMENTED', FAILED_MEASUREMENT: 'UNMEASURED' },
  };

  it('collapsible, it is one 44px control and no rows until opened', () => {
    const html = renderToStaticMarkup(createElement(LayersControl, { state: {}, labels: LABELS, collapsible: true }));
    expect(html).toContain('data-gn="layers-toggle"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toMatch(/h-11/);
    expect(html).not.toContain('data-gn-layer=');
  });

  it('non-collapsible is the accepted panel, every rail layer present', () => {
    const html = renderToStaticMarkup(createElement(LayersControl, { state: {}, labels: LABELS }));
    for (const layer of railLayers()) expect(html).toContain(`data-gn-layer="${layer.id}"`);
    expect(html).not.toContain('data-gn="layers-toggle"');
  });

  it('the cluster can lay its controls in a row, keeping the contract order', () => {
    const html = renderToStaticMarkup(
      createElement(MapControlCluster, {
        label: 'Map controls',
        direction: 'row',
        globeLocator: createElement('span'),
        layers: createElement('span'),
        threeD: createElement('span'),
      }),
    );
    expect(html).toMatch(/flex-row items-end/);
    expect([...html.matchAll(/data-gn-slot="([a-z-]+)"/g)].map((m) => m[1])).toEqual(['globe-locator', 'layers', 'three-d']);
  });

  it('the shell uses the row, the collapsible Layers, and puts the precision banner in the same column', () => {
    expect(DESKTOP).toContain('direction="row"');
    expect(DESKTOP).toMatch(/<LayersControl\s+collapsible/);
    const stack = DESKTOP.slice(DESKTOP.indexOf('data-gn="map-lower-left-stack"'), DESKTOP.indexOf('<MapControlCluster'));
    expect(stack).toContain('data-gn="map-precision-island"');
    expect(stack).toContain('<PrecisionBanner');
    /* the standalone banner island remains for NON-interactive surfaces only */
    expect(DESKTOP).toContain('{!hud.interactive && (\n          <div\n            data-gn-hud-reserve');
  });
});

describe('FOLLOW, compact — Follow is never Watch', () => {
  const labels = getDictionary('en').map.spatial.card.follow;

  it('the resting label drops the geography; the accessible name still names it', () => {
    const html = renderToStaticMarkup(
      createElement(FollowControl, {
        compact: true, geographyId: 'IRQ', geographyLabel: 'Iraq', isWatched: true, labels, onToggle: () => undefined,
      }),
    );
    expect(html).toContain(`${labels.watching}</span>`);
    expect(html).not.toContain(`${labels.watching} Iraq`);
    expect(html).toContain(`aria-label="${labels.stopWatching} Iraq"`);
    expect(html).not.toMatch(/watch(ing)? this|Watching/);
    expect(html).toMatch(/w-auto/);
  });

  it('the full-width form is unchanged', () => {
    const html = renderToStaticMarkup(
      createElement(FollowControl, {
        geographyId: 'IRQ', geographyLabel: 'Iraq', isWatched: true, labels, onToggle: () => undefined,
      }),
    );
    expect(html).toContain(`${labels.watching} Iraq`);
    expect(html).toMatch(/w-full/);
  });
});

describe('EN / PL — the new strings exist in both languages', () => {
  it('every new key is present and non-empty in both dictionaries', () => {
    for (const language of ['en', 'pl'] as const) {
      const d = getDictionary(language);
      expect(d.askAi.geographyBasis.length).toBeGreaterThan(0);
      expect(d.askAi.mapComputeNotice.length).toBeGreaterThan(0);
      expect(d.map.spatial.mobile.askAbout).toContain('{country}');
      expect(d.map.spatial.mobile.stagingNote.length).toBeGreaterThan(0);
    }
    expect(getDictionary('pl').map.spatial.mobile.askAbout).toBe('Zapytaj o kraj: {country}');
  });
});
