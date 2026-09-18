import { readFileSync } from 'fs';
import { join } from 'path';

import {
  MAP_HUD_MARKER,
  eventOriginatesFromMapHud,
} from './mapHudOrigin';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * R3.2 — HUD ORIGIN ISOLATION
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The rule: **interacting with chrome is not selecting a geography.**
 *
 * These are unit assertions over a pure predicate, plus source assertions that
 * the predicate is actually wired where it matters. The behavioural proof is the
 * driven-browser click-through test, because source-reading is what passed while
 * production spent quota.
 */

/** A node stands in for an Element; only `getAttribute` is consulted. */
function node(attrs: Record<string, string> = {}, parent: unknown = null): unknown {
  return {
    getAttribute: (name: string) => (name in attrs ? attrs[name] : null),
    parentElement: parent,
  };
}

const hud = node({ [MAP_HUD_MARKER]: '' });
const button = node({ 'data-gn': 'breadcrumb-jump' });
const canvas = node({ 'data-gn': 'map-canvas' });

describe('R3.2 · a click that began on chrome is chrome, not geography', () => {
  it('rejects an event whose composed path contains the HUD marker', () => {
    const event = { composedPath: () => [button, hud, canvas] };

    expect(eventOriginatesFromMapHud(event)).toBe(true);
  });

  it('POSITIVE CONTROL — a genuine canvas click is NOT rejected', () => {
    /*
      FIRST IN INTENT, AND THE MORE IMPORTANT HALF. A guard that quietly
      disabled map selection would be a worse defect than the one it replaces:
      the reader would click a country and nothing would happen, with no error
      and nothing to report.
    */
    const event = { composedPath: () => [canvas] };

    expect(eventOriginatesFromMapHud(event)).toBe(false);
  });

  it('the marker is found at ANY depth, so nesting cannot defeat it', () => {
    const deep = { composedPath: () => [node(), node(), button, node(), hud] };

    expect(eventOriginatesFromMapHud(deep)).toBe(true);
  });

  it('unwraps a MapLibre synthetic event via originalEvent', () => {
    /*
      MapLibre hands its layer handlers a synthetic event. The DOM event — the
      one that knows where the interaction began — is underneath it.
    */
    const event = { originalEvent: { composedPath: () => [button, hud] } };

    expect(eventOriginatesFromMapHud(event)).toBe(true);
  });

  it('falls back to an ancestor walk when no composed path exists', () => {
    const child = node({ 'data-gn': 'rail-jump' }, hud);

    expect(eventOriginatesFromMapHud({ target: child })).toBe(true);
  });

  it('and the ancestor walk still clears a canvas-rooted event', () => {
    const child = node({ 'data-gn': 'map-canvas-surface' }, canvas);

    expect(eventOriginatesFromMapHud({ target: child })).toBe(false);
  });

  it('an unclassifiable event is NOT treated as HUD — it fails towards selection', () => {
    /*
      Deliberately conservative in one direction only. Treating the unknown as
      chrome would silently break map selection; treating it as a map click
      leaves today's behaviour, which is the recoverable choice.
    */
    for (const value of [null, undefined, 0, 'click', {}, { composedPath: () => [] }]) {
      expect(eventOriginatesFromMapHud(value)).toBe(false);
    }
  });
});

describe('R3.2 · no country, coordinate or viewport is named', () => {
  const source = readFileSync(join(__dirname, 'mapHudOrigin.ts'), 'utf-8');
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('the contract names no ISO-3', () => {
    /*
      Niger, Central African Republic and Algeria were one defect wearing three
      countries. A special case for any of them would fix a symptom and leave
      the class intact.
    */
    for (const iso3 of ['NER', 'CAF', 'DZA', 'TCD', 'RWA', 'KEN', 'POL']) {
      expect(code).not.toContain(iso3);
    }
  });

  it('and no coordinate, viewport or timer', () => {
    for (const forbidden of [
      'setTimeout',
      'setInterval',
      'Date.now',
      'lng',
      'lat',
      'clientX',
      'clientY',
      'innerWidth',
      'innerHeight',
      '1780',
      '1210',
    ]) {
      expect(code).not.toContain(forbidden);
    }
  });

  it('it is a MARKER contract, not a list of selectors', () => {
    expect(code).toContain('data-gn-hud');
    /* A second register of what counts as chrome is what drifts. */
    expect(code).not.toContain('breadcrumb-jump');
    expect(code).not.toContain('map-intelligence-rail');
  });
});

describe('R3.2 · the guard is wired into the ONLY country-selection path', () => {
  const canvasSource = readFileSync(
    join(__dirname, '..', '..', '..', 'components', 'map', 'shell', 'EvidenceMapCanvas.tsx'),
    'utf-8',
  );
  const code = canvasSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('the fill-layer click handler consults it', () => {
    expect(code).toContain('eventOriginatesFromMapHud(event)');
  });

  it('and it runs BEFORE the feature is read or the selection is made', () => {
    const handler = code.slice(code.indexOf("map.on('click', FILL_LAYER_ID"));
    const guard = handler.indexOf('if (eventOriginatesFromMapHud(event)) return;');
    const feature = handler.indexOf('event.features?.[0]');
    const select = handler.indexOf('selectRef.current?.(');

    expect(guard).toBeGreaterThan(-1);
    expect(feature).toBeGreaterThan(guard);
    expect(select).toBeGreaterThan(guard);
  });

  it('selectRef is still reachable from exactly one place', () => {
    /*
      The whole rule rests on there being ONE country-selection path. A second
      one would route around this guard entirely.
    */
    expect(code.split('selectRef.current?.(').length - 1).toBe(1);
  });
});

describe('R3.2 · every interactive HUD surface carries the marker', () => {
  const shell = join(__dirname, '..', '..', '..', 'components', 'map', 'shell');
  const read = (f: string): string => readFileSync(join(shell, f), 'utf-8');

  it.each([
    ['BreadcrumbZoomNavigator.tsx', 'top geography jump controls'],
    ['IntelligenceRightRail.tsx', 'side rail controls'],
    ['LayerToggleRail.tsx', 'layer controls'],
    ['MapCameraControls.tsx', 'zoom, Previous View, Reset controls'],
    ['MapHudTopBar.tsx', 'top bar'],
    ['ContextSummaryPanel.tsx', 'context summary and rail jumps'],
    ['SelectionCallout.tsx', 'popup/action chrome'],
    ['EvidenceLegend.tsx', 'legend'],
    ['PlaceSearch.tsx', 'place search'],
  ])('%s carries data-gn-hud (%s)', (file) => {
    expect(read(file)).toContain('data-gn-hud=""');
  });

  it('Ask AI and the selection card are covered BY DESCENT, not by their own marker', () => {
    /*
      Both render inside the right rail and the callout, which carry the marker.
      Marking them again would start the second register this contract avoids —
      the point of a marker is that descendants inherit it.
    */
    const shellSource = read('GlobalMapShell.tsx');

    expect(shellSource).toContain('IntelligenceRightRail');
    expect(shellSource).toContain('SelectionCallout');
  });
});
