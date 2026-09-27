import { readFileSync } from 'fs';
import { join } from 'path';
import { createElement } from 'react';
import { act, create } from 'react-test-renderer';
import {
  KEYBOARD_SHRINK_PX,
  NAV_BLOCK_FALLBACK_PX,
  WORKSPACE_FIT_TOP_PX,
  WORKSPACE_TOP_BAR_PX,
  ZOOM_GAP_PX,
  availableWorkspace,
  computeMapWorkspace,
  isBottomNavVisible,
  isKeyboardOpen,
  raisesKeyboard,
  sheetHeightAt,
} from '@/lib/map/spatial/mapWorkspace';
import {
  MIN_MAP_FRACTION,
  MobileBottomSheet,
  SHEET_STOPS,
  SPATIAL_DETENTS,
  mapFractionAt,
  type SheetStop,
} from './MobileBottomSheet';
import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MAP MOBILE INTERACTION R1 — THE FROZEN RULINGS, ASSERTED
 * ════════════════════════════════════════════════════════════════════════════
 *
 *   A = visualViewportHeight − 52 − visible bottom-nav block
 *   PEEK 148 where space permits · HALF floor(0.52A) · FULL floor(0.74A)
 *   nav: PEEK visible · HALF visible · FULL hidden · keyboard hidden
 *   FULL leaves ≥ 26% of A as unobstructed, pannable map
 */

const FRONTEND = join(__dirname, '../../../..');
const read = (path: string): string => readFileSync(join(FRONTEND, path), 'utf8');
const SHELL = read('src/components/map/mobile/MobileSpatialShell.tsx');
const SHEET = read('src/components/map/mobile/MobileBottomSheet.tsx');

/* Real phone frames: layout height and the nav block (57px cell + safe area). */
const PHONES = [
  { name: '360x640', height: 640, nav: 57 },
  { name: '360x800', height: 800, nav: 57 },
  { name: '390x844', height: 844, nav: 57 + 34 },
  { name: '430x932', height: 932, nav: 57 + 34 },
  { name: '390x620 (R2 reference)', height: 620, nav: 57 },
];

const layoutAt = (stop: SheetStop, height: number, nav: number, keyboardOpen = false, occlusion = 0) =>
  computeMapWorkspace(
    stop,
    { visualViewportHeight: height, bottomOcclusionPx: occlusion, navBlockPx: nav, keyboardOpen },
    SPATIAL_DETENTS,
  );

describe('§3 phone nav state: PEEK visible · HALF visible · FULL hidden · keyboard hidden', () => {
  it.each([
    ['PEEK', false, true],
    ['HALF', false, true],
    ['FULL', false, false],
    ['PEEK', true, false],
    ['HALF', true, false],
    ['FULL', true, false],
  ] as const)('%s with keyboard=%s → nav visible %s', (stop, keyboard, visible) => {
    expect(isBottomNavVisible(stop, keyboard)).toBe(visible);
    expect(layoutAt(stop, 844, 91, keyboard).navVisible).toBe(visible);
  });

  it('FULL → PEEK and FULL → HALF restore the nav symmetrically, with identical geometry', () => {
    for (const back of ['PEEK', 'HALF'] as const) {
      const before = layoutAt(back, 844, 91);
      const full = layoutAt('FULL', 844, 91);
      const after = layoutAt(back, 844, 91);
      expect(full.navVisible).toBe(false);
      expect(after).toEqual(before);
      expect(after.navVisible).toBe(true);
    }
  });

  it('the shell drives the nav from the workspace model, not from its own rule', () => {
    expect(SHELL).toContain('hidden={!workspace.navVisible}');
    expect(SHELL).toContain('<MobileBottomNav');
    expect(SHELL).toContain('ref={navHostRef}');
  });
});

describe('§4 workspace-based sheet geometry', () => {
  it('the top bar the ruling subtracts is the shell’s own 52px bar', () => {
    expect(WORKSPACE_TOP_BAR_PX).toBe(52);
    expect(SHELL).toContain(`export const TOP_BAR_PX = ${WORKSPACE_TOP_BAR_PX};`);
    expect(WORKSPACE_FIT_TOP_PX).toBe(52 + 30);
  });

  it.each(PHONES)('$name: A, PEEK, HALF and FULL follow the ruled formulas', ({ height, nav }) => {
    const peek = layoutAt('PEEK', height, nav);
    const half = layoutAt('HALF', height, nav);
    const full = layoutAt('FULL', height, nav);

    const aWithNav = height - 52 - nav;
    const aWithoutNav = height - 52;

    expect(peek.workspacePx).toBe(aWithNav);
    expect(half.workspacePx).toBe(aWithNav);
    /* FULL hides the nav FIRST, then recomputes A. */
    expect(full.workspacePx).toBe(aWithoutNav);

    expect(peek.sheetHeightPx).toBe(148);
    expect(half.sheetHeightPx).toBe(Math.floor(0.52 * aWithNav));
    expect(full.sheetHeightPx).toBe(Math.floor(0.74 * aWithoutNav));

    /* The sheet stands on the nav while it is shown and on the edge when it is not. */
    expect(peek.sheetBottomPx).toBe(nav);
    expect(half.sheetBottomPx).toBe(nav);
    expect(full.sheetBottomPx).toBe(0);
  });

  it.each(PHONES)('$name: at FULL at least 26% of the unobstructed workspace stays map', ({ height, nav }) => {
    const full = layoutAt('FULL', height, nav);
    expect(full.mapFraction).toBeGreaterThanOrEqual(MIN_MAP_FRACTION);
    expect(full.mapVisiblePx / full.workspacePx).toBeGreaterThanOrEqual(0.26);
  });

  it('the floor holds for EVERY integer viewport height from 480 to 1400, with and without a safe area', () => {
    for (let height = 480; height <= 1400; height += 1) {
      for (const nav of [57, 91]) {
        for (const stop of SHEET_STOPS) {
          expect(layoutAt(stop, height, nav).mapFraction).toBeGreaterThanOrEqual(MIN_MAP_FRACTION);
        }
      }
    }
  });

  it('PEEK is 148px where space permits and never exceeds FULL on a tiny workspace', () => {
    expect(sheetHeightAt('PEEK', 700, SPATIAL_DETENTS)).toBe(148);
    expect(sheetHeightAt('PEEK', 150, SPATIAL_DETENTS)).toBe(Math.floor(0.74 * 150));
  });

  it('the keyboard hides the nav, and A is taken from the visible viewport', () => {
    /* A 390x844 layout with a 336px keyboard: the visual viewport is 508 tall. */
    const open = layoutAt('HALF', 508, 91, true, 336);
    expect(open.navVisible).toBe(false);
    expect(open.workspacePx).toBe(508 - 52);
    expect(open.sheetHeightPx).toBe(Math.floor(0.52 * (508 - 52)));
    /* The sheet rises with the visible viewport rather than hiding under the keyboard. */
    expect(open.sheetBottomPx).toBe(336);
  });

  it('A is never negative and an unmeasured viewport renders the PEEK constant', () => {
    expect(availableWorkspace(60, 91)).toBe(0);
    const unmeasured = layoutAt('HALF', 0, 91);
    expect(unmeasured.workspacePx).toBe(0);
    expect(unmeasured.sheetHeightPx).toBe(148);
  });

  it('keyboard detection: an editable focus, or a visual viewport shrunk by the keyboard', () => {
    expect(raisesKeyboard({ tagName: 'INPUT', type: 'search' })).toBe(true);
    expect(raisesKeyboard({ tagName: 'TEXTAREA' })).toBe(true);
    expect(raisesKeyboard({ tagName: 'DIV', isContentEditable: true })).toBe(true);
    expect(raisesKeyboard({ tagName: 'INPUT', type: 'checkbox' })).toBe(false);
    expect(raisesKeyboard({ tagName: 'BUTTON' })).toBe(false);
    expect(raisesKeyboard(null)).toBe(false);
    expect(isKeyboardOpen(false, 844, 844)).toBe(false);
    expect(isKeyboardOpen(false, 844, 844 - KEYBOARD_SHRINK_PX)).toBe(true);
    expect(isKeyboardOpen(true, 844, 844)).toBe(true);
  });

  it('the nav block falls back to its measured-cell height until the real nav is measured', () => {
    expect(NAV_BLOCK_FALLBACK_PX).toBe(57);
  });
});

describe('§5 one coherent workspace model at every geometry site', () => {
  it('mapFractionAt reads A through the workspace model', () => {
    for (const a of [300, 500, 741]) {
      for (const stop of SHEET_STOPS) {
        expect(mapFractionAt(stop, a)).toBe((a - sheetHeightAt(stop, a, SPATIAL_DETENTS)) / a);
      }
    }
  });

  it('the camera fit inset is exactly what the sheet and nav cover', () => {
    for (const stop of SHEET_STOPS) {
      const layout = layoutAt(stop, 844, 91);
      expect(layout.fitInset).toEqual({ top: 82, bottom: layout.sheetBottomPx + layout.sheetHeightPx });
      expect(layout.zoomBottomPx).toBe(layout.sheetBottomPx + layout.sheetHeightPx + ZOOM_GAP_PX);
    }
  });

  it('raw-viewport arithmetic is retired from the shell: no innerHeight, no dvh zoom anchor', () => {
    expect(SHELL).not.toContain('window.innerHeight');
    expect(SHELL).not.toMatch(/calc\([^)]*dvh[^)]*\+ 16px\)/);
    expect(SHELL).not.toContain('HALF_FRACTION * 100');
    expect(SHELL).toContain('style={{ bottom: workspace.zoomBottomPx }}');
    expect(SHELL).toContain('workspaceHeight={workspace.workspacePx}');
    expect(SHELL).toContain('bottomOffset={workspace.sheetBottomPx}');
    expect(SHELL).toContain('current.fitInset.bottom');
  });

  it('the Conflict surface, which supplies no workspace, keeps its accepted sheet behaviour', () => {
    expect(SHEET).toContain('workspaceMode ? sheetHeightAt(candidate, reference, geometry) : heightFor(candidate, reference, geometry)');
  });

  it('in workspace mode the rendered sheet takes its height from A and stands on the nav', () => {
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        createElement(
          MobileBottomSheet,
          {
            stop: 'HALF',
            onStopChange: () => undefined,
            workspaceHeight: 701,
            bottomOffset: 91,
            labels: { sheetLabel: 's', handleLabel: 'h', stops: { PEEK: 'p', HALF: 'h', FULL: 'f' } },
            children: 'content',
          },
        ),
      );
    });
    const section = renderer.root.findByProps({ 'data-gn': 'mobile-sheet' });
    expect(section.props.style).toEqual({ height: `${Math.floor(0.52 * 701)}px`, bottom: '91px' });
    act(() => renderer.unmount());
  });
});

describe('§2 canonical empty state, EN/PL', () => {
  const en = getDictionary('en');
  const pl = getDictionary('pl');
  const find = (tree: unknown, key: string): string[] => {
    const found: string[] = [];
    const walk = (node: unknown): void => {
      if (node === null || typeof node !== 'object') return;
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (k === key && typeof v === 'string') found.push(v);
        else walk(v);
      }
    };
    walk(tree);
    return found;
  };

  it('EN: "This country is selected. Nothing has been retrieved yet."', () => {
    expect(find(en.map, 'notLoaded')).toEqual(['This country is selected. Nothing has been retrieved yet.']);
  });

  it('PL: "Wybrano ten kraj. Niczego jeszcze nie pobrano." — the old variant is gone', () => {
    expect(find(pl.map, 'notLoaded')).toEqual(['Wybrano ten kraj. Niczego jeszcze nie pobrano.']);
    expect(JSON.stringify(pl)).not.toContain('Kraj jest wybrany');
  });

  it('the Polish load verb stays "Pobierz" and the map never says "Wczytaj"', () => {
    expect(find(pl.map, 'load')[0]).toMatch(/^Pobierz/);
    expect(JSON.stringify(pl.map)).not.toContain('Wczytaj');
  });
});
