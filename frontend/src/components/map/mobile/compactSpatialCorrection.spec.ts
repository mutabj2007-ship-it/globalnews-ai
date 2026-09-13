/**
 * H-C907 — THE COMPACT SPATIAL CORRECTION, ASSERTED.
 *
 * Three defects were measured by the Product Owner on the Railway Alpha
 * deployment of `release/alpha-c907-r2-lint1`, at 375x844:
 *
 *   A  a selected country updated identity, counts and story cards while the
 *      map stayed at the world camera;
 *   B  the global footer entered the compact viewport, the map disappeared and
 *      the fixed Ask AI affordance collided with the footer;
 *   C  the compact HUD budget and sheet contract had to be re-verified once the
 *      viewport was actually owned.
 *
 * WHAT THIS FILE CAN AND CANNOT PROVE. It reads the shipped source and executes
 * the pure camera resolver. It proves that exactly ONE camera policy exists and
 * that both shells consume it, that the route owns the compact viewport and
 * yields it back at 861 px, and that the accepted compact constants are
 * unchanged. It proves NOTHING about pixels: that the camera actually moves, and
 * that `window.scrollY` stays 0 under a drag, is a browser measurement and is
 * recorded in the rehearsal evidence, not claimed here.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { selectionCameraFor } from '@/lib/map/coveragePaint';
import {
  pendingFitAfterSelectionChange,
  selectionFitRequestFor,
  type PendingFit,
} from '@/lib/map/camera/useSelectionCamera';
import { fitPaddingFor, MIN_FIT_BOX_PX } from '@/lib/map/camera/fitPadding';
import { SELECTION_FIT_PADDING } from '@/lib/map/coveragePaint';
import { WORLD_CAMERA } from '@/lib/map/camera/cameraState';
import {
  PEEK_HEIGHT_PX,
  HALF_FRACTION,
  FULL_FRACTION,
  MIN_MAP_FRACTION,
  MIN_TOUCH_PX,
} from './MobileBottomSheet';

const FRONTEND_ROOT = join(__dirname, '..', '..', '..', '..');

/** Comments only — string literals are KEPT, for the reason the route-wiring guard gives. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

function codeOf(relativePath: string): string {
  return stripComments(readFileSync(join(FRONTEND_ROOT, relativePath), 'utf8'));
}

const MOBILE = codeOf('src/components/map/mobile/MobileSpatialShell.tsx');
const DESKTOP = codeOf('src/components/map/shell/GlobalMapShell.tsx');
const HOOK = codeOf('src/lib/map/camera/useSelectionCamera.ts');
const ROUTE = codeOf('src/app/map/page.tsx');

/* ── DEFECT A — ONE CAMERA POLICY, CONSUMED TWICE ─────────────────────── */
describe('DEFECT A — the phone frames the country it selected, using the desktop policy', () => {
  it('both shells import the ONE hook', () => {
    expect(MOBILE).toContain("from '@/lib/map/camera/useSelectionCamera'");
    expect(DESKTOP).toContain("from '@/lib/map/camera/useSelectionCamera'");
    expect(MOBILE).toMatch(/useSelectionCamera\(\{/);
    expect(DESKTOP).toMatch(/useSelectionCamera\(\{/);
  });

  it('NEITHER shell keeps a second camera policy of its own', () => {
    /*
      The defect class this guards is not "mobile has no framing" — it is
      "mobile grows its own". A shell resolving `selectionCameraFor` itself has
      started a second policy, whatever it does with the answer.
    */
    expect(MOBILE).not.toContain('selectionCameraFor');
    expect(DESKTOP).not.toContain('selectionCameraFor');
    expect(HOOK).toContain('selectionCameraFor');
  });

  it('neither shell owns `pendingBounds` state beside the hook', () => {
    expect(MOBILE).not.toContain('setPendingBounds');
    expect(DESKTOP).not.toContain('setPendingBounds');
  });

  it('the mobile shell passes the explicit-camera-restore flag into the policy', () => {
    const call = MOBILE.slice(MOBILE.indexOf('useSelectionCamera({'));

    expect(call.slice(0, 200)).toContain('selectedIso3');
    expect(call.slice(0, 200)).toContain('initialCameraRestored');
    expect(call.slice(0, 200)).toContain('commitCamera');
  });

  it('the policy is ORIGIN-BLIND: it watches the prop, not a call site', () => {
    /* The effect's only dependency is the selection, so search, map tap, URL
       restore and any parent update all reach it. */
    expect(HOOK).toMatch(/\}, \[selectedIso3\]\);/);
  });

  it('DESELECTION STILL MOVES NOTHING, and explicit `cam=` still wins at mount', () => {
    /* Deselection asserted as BEHAVIOUR — a cleared selection resolves to no
       request, so nothing is ever committed for it. The mount seeding stays a
       source assertion because a ref initialiser has no observable output
       without a renderer, and this suite has none. */
    expect(selectionFitRequestFor(null)).toEqual({ kind: 'none' });
    expect(pendingFitAfterSelectionChange(null, selectionFitRequestFor(null))).toBeNull();
    expect(HOOK).toMatch(/initialCameraRestored \? \(selectedIso3 \?\? null\) : null/);
  });

  it('the mobile canvas is bound to the hook, not to a local resolver', () => {
    expect(MOBILE).toContain('fitBounds={pendingBounds}');
    expect(MOBILE).toContain('onBoundsResolved={onBoundsResolved}');
  });

  /*
    THE FIVE COUNTRIES THE AUTHORIZATION NAMES, plus the two size extremes.
    A resolvable target is the precondition for framing; whether the frame
    LOOKS right at 375 px is measured in the browser.
  */
  it.each([
    ['AFG', 'Afghanistan'],
    ['ZWE', 'Zimbabwe'],
    ['NER', 'Niger'],
    ['LUX', 'a small country'],
    ['RUS', 'a very large country'],
  ])('%s (%s) resolves to a camera target that is not the world camera', (iso3) => {
    const target = selectionCameraFor(iso3);

    expect(target).not.toBeNull();

    if (target === null) return;

    if (target.kind === 'camera') {
      expect(target.camera.center).not.toEqual(WORLD_CAMERA.center);

      return;
    }

    const [west, south, east, north] = target.bounds;

    expect(east).toBeGreaterThan(west);
    expect(north).toBeGreaterThan(south);
  });

  it('an unknown country still moves nothing', () => {
    expect(selectionCameraFor('ZZZ')).toBeNull();
    expect(selectionCameraFor(null)).toBeNull();
  });
});

/* ── R2 · THE OWNERSHIP RACE, TESTED AS BEHAVIOUR ─────────────────────── */
describe('R2 — a deselection cancels an obsolete country fit and NOTHING else', () => {
  /*
    THE TRANSITION THIS EXISTS FOR, in the order the phone actually runs it:

      1  a country is selected and its fit is pending
      2  the reader commits a REGION from search
      3  the parent CLEARS the country, so `selectedIso3` goes ISO3 -> null
      4  the region path asks to focus the region's extent

    R1 cleared the pending fit on (3) and cancelled (4). These are executable
    assertions on the rule itself, not a source-string check.
  */
  const COUNTRY_FIT: PendingFit = { bounds: [60, 29, 75, 39], origin: 'selection' };
  const REGION_FOCUS: PendingFit = { bounds: [21, -12, 52, 18], origin: 'focus' };

  it('THE RACE: a region focus SURVIVES the deselection that accompanies it', () => {
    expect(pendingFitAfterSelectionChange(REGION_FOCUS, { kind: 'none' })).toBe(REGION_FOCUS);
  });

  it('and a non-country bounded search result survives the same way', () => {
    const searchFocus: PendingFit = { bounds: [-10, 35, 5, 44], origin: 'focus' };

    expect(pendingFitAfterSelectionChange(searchFocus, { kind: 'none' })).toBe(searchFocus);
  });

  it('an OBSOLETE country fit is still cancelled by a deselection', () => {
    expect(pendingFitAfterSelectionChange(COUNTRY_FIT, { kind: 'none' })).toBeNull();
  });

  it('a new country BOUNDS fit supersedes whatever was pending', () => {
    const next = { kind: 'bounds', bounds: [2, 49, 7, 51] } as const;

    expect(pendingFitAfterSelectionChange(REGION_FOCUS, next)).toEqual({
      bounds: next.bounds,
      origin: 'selection',
    });
    expect(pendingFitAfterSelectionChange(COUNTRY_FIT, next)).toEqual({
      bounds: next.bounds,
      origin: 'selection',
    });
    expect(pendingFitAfterSelectionChange(null, next)).toEqual({
      bounds: next.bounds,
      origin: 'selection',
    });
  });

  it('a country CAMERA commit supersedes everything, focus included', () => {
    /* Otherwise the surviving focus resolves a moment later and overrides the
       country the reader just chose. */
    expect(pendingFitAfterSelectionChange(REGION_FOCUS, { kind: 'camera' })).toBeNull();
    expect(pendingFitAfterSelectionChange(COUNTRY_FIT, { kind: 'camera' })).toBeNull();
    expect(pendingFitAfterSelectionChange(null, { kind: 'camera' })).toBeNull();
  });

  it('nothing pending plus nothing requested is still nothing', () => {
    expect(pendingFitAfterSelectionChange(null, { kind: 'none' })).toBeNull();
  });

  it('DESKTOP IS UNCHANGED: with no focus-origin fit the rule is R1 exactly', () => {
    /* The desktop shell dispatches `focus-bounds` to the reducer and never
       creates a focus-origin pending fit, so every desktop input lands on the
       same answers R1 gave. */
    for (const request of [{ kind: 'none' } as const, { kind: 'camera' } as const]) {
      expect(pendingFitAfterSelectionChange(COUNTRY_FIT, request)).toBeNull();
      expect(pendingFitAfterSelectionChange(null, request)).toBeNull();
    }
  });

  it('the request resolver maps selections to the closed set, and only it calls the resolver', () => {
    expect(selectionFitRequestFor(null)).toEqual({ kind: 'none' });
    expect(selectionFitRequestFor(undefined)).toEqual({ kind: 'none' });
    expect(selectionFitRequestFor('ZZZ')).toEqual({ kind: 'none' });
    expect(selectionFitRequestFor('RUS')).toEqual({ kind: 'camera' });

    const afg = selectionFitRequestFor('AFG');

    expect(afg.kind).toBe('bounds');
  });

  it('the hook carries the origin, and the shells do not', () => {
    expect(HOOK).toContain("origin: 'focus'");
    expect(HOOK).toContain("origin: 'selection'");
    expect(MOBILE).not.toContain("origin:");
    expect(DESKTOP).not.toContain("origin:");
  });
});

/* ── R2 · FITTING AGAINST THE VISIBLE MAP ─────────────────────────────── */
describe('R2 — the fit is padded for the region the sheet covers', () => {
  const PANE_375 = { w: 375, h: 844 };

  it('DESKTOP IS UNTOUCHED: no inset returns the scalar the resolver always passed', () => {
    expect(fitPaddingFor(SELECTION_FIT_PADDING, null, PANE_375)).toBe(SELECTION_FIT_PADDING);
    expect(fitPaddingFor(SELECTION_FIT_PADDING, undefined, PANE_375)).toBe(SELECTION_FIT_PADDING);
  });

  it('the occluded edges are added to the accepted base padding', () => {
    const half = Math.floor(844 * 0.52);
    const padding = fitPaddingFor(SELECTION_FIT_PADDING, { top: 82, bottom: half }, PANE_375);

    expect(typeof padding).not.toBe('number');

    if (typeof padding === 'number') return;

    expect(padding.left).toBe(SELECTION_FIT_PADDING);
    expect(padding.right).toBe(SELECTION_FIT_PADDING);
    expect(padding.top).toBe(SELECTION_FIT_PADDING + 82);
    expect(padding.bottom).toBe(SELECTION_FIT_PADDING + half);
  });

  it('THE FIT ALWAYS STAYS RESOLVABLE — padding never eats the container', () => {
    /*
      `cameraForBounds` returns undefined when padding exceeds the box, and
      `resolveFit` then commits NOTHING. A clamped frame is worse; no frame is
      indistinguishable from a bug.
    */
    for (const pane of [{ w: 375, h: 844 }, { w: 414, h: 896 }, { w: 320, h: 568 }]) {
      for (const fraction of [0.52, 0.74, 0.9]) {
        const padding = fitPaddingFor(
          SELECTION_FIT_PADDING,
          { top: 82, bottom: Math.floor(pane.h * fraction) },
          pane,
        );

        if (typeof padding === 'number') continue;

        expect(pane.h - padding.top - padding.bottom).toBeGreaterThanOrEqual(MIN_FIT_BOX_PX - 1);
        expect(pane.w - padding.left - padding.right).toBeGreaterThanOrEqual(MIN_FIT_BOX_PX - 1);
      }
    }
  });

  it('the mobile shell supplies the inset as a CALLBACK, so it is read at fit time', () => {
    expect(MOBILE).toContain('fitInset={fitInset}');
    expect(MOBILE).toContain('PERMANENT_HUD_PX');
  });

  it('the desktop shell supplies NO inset at all', () => {
    expect(DESKTOP).not.toContain('fitInset');
  });
});

/* ── DEFECT B — THE COMPACT WORKSPACE OWNS THE VIEWPORT ───────────────── */
describe('DEFECT B — the outer document cannot scroll behind the compact shell', () => {
  it('the accepted NavBar conditional is untouched', () => {
    /* The route-wiring guard asserts this too. It is repeated here because this
       change edits the same return, and a guard that only fails elsewhere is a
       guard that gets discovered late. */
    expect(ROUTE).toContain('spatial ? null : <NavBar');
  });

  it('on the shell variant `main` IS the compact viewport, not a minimum', () => {
    expect(ROUTE).toContain('h-[100dvh]');
    expect(ROUTE).toContain('overflow-hidden');
    expect(ROUTE).toContain('overscroll-none');
  });

  it('and hands the viewport back at 861 px, so desktop Spatial is unchanged', () => {
    expect(ROUTE).toContain('spatial:h-auto');
    expect(ROUTE).toContain('spatial:min-h-screen');
    expect(ROUTE).toContain('spatial:overflow-visible');
    expect(ROUTE).toContain('spatial:overscroll-auto');
  });

  it('the footer does not render into the compact Spatial workspace', () => {
    expect(ROUTE).toMatch(/className="hidden spatial:block"/);
  });

  it('THE ROLLBACK IS UNTOUCHED: the legacy branch keeps the released pair', () => {
    expect(ROUTE).toContain("'min-h-screen bg-void'");
    expect(ROUTE).toMatch(/<Footer language=\{language\} \/>/);
  });

  it('the Footer component itself is not edited by this correction', () => {
    const footer = readFileSync(join(FRONTEND_ROOT, 'src/components/layout/Footer.tsx'), 'utf8');

    /* Nothing in the fix belongs inside the component: the defect is where it
       is MOUNTED on one route at one width. */
    expect(footer).not.toContain('spatial:');
    expect(footer).not.toContain('100dvh');
  });

  it('the mobile shell still owns exactly one compact viewport of its own', () => {
    expect(MOBILE).toContain('h-[100dvh]');
  });
});

/* ── DEFECT C — THE ACCEPTED COMPACT CONTRACT, UNCHANGED ──────────────── */
describe('DEFECT C — the compact budget is the accepted one, not a new design', () => {
  it('the sheet detents are PEEK 148 / HALF 52% / FULL 74%', () => {
    expect(PEEK_HEIGHT_PX).toBe(148);
    expect(HALF_FRACTION).toBe(0.52);
    expect(FULL_FRACTION).toBe(0.74);
  });

  it('the map keeps at least 26% at every detent', () => {
    expect(MIN_MAP_FRACTION).toBe(0.26);

    for (const height of [844, 896, 667, 740]) {
      const full = Math.floor(height * FULL_FRACTION);

      expect((height - full) / height).toBeGreaterThanOrEqual(MIN_MAP_FRACTION);
    }
  });

  it('the permanent HUD cap is 82px and is a SUM, not a comment', () => {
    /*
      READ OUT OF SOURCE, NOT IMPORTED. Importing `MobileSpatialShell` pulls
      `maplibre-gl/dist/maplibre-gl.css` into a node-environment Jest run,
      which is why no other guard imports it either. The declarations are
      asserted verbatim and then added here, so a third permanent row still
      cannot be introduced without this failing.
    */
    expect(MOBILE).toContain('export const TOP_BAR_PX = 52;');
    expect(MOBILE).toContain('export const CHANGE_STRIP_PX = 30;');
    expect(MOBILE).toContain('export const PERMANENT_HUD_PX = TOP_BAR_PX + CHANGE_STRIP_PX;');
    expect(52 + 30).toBe(82);
  });

  it('the touch target floor is 44px', () => {
    expect(MIN_TOUCH_PX).toBe(44);
  });
});
