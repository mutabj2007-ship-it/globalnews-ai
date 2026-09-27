/**
 * ════════════════════════════════════════════════════════════════════════════
 * MAP / SPATIAL VISUAL CONVERGENCE R2 — WHERE ASK SITS ON THE MAP
 * ════════════════════════════════════════════════════════════════════════════
 *
 * MEASURED on the Product Owner's iPhone: opening Ask on /map raised the
 * generic 86dvh phone sheet, which left the map as a strip under the HUD —
 * the country the reader was asking about disappeared behind the question.
 *
 * On /map the global dock keeps every behaviour it has (same state, submit,
 * transport and zero-request open/focus/type) and takes the Spatial geometry
 * of the Map R1 authority, "Ask on the Map":
 *
 *   compact  < 861     a composer sheet above the bottom nav (or the keyboard),
 *                      sized to its content and capped so the map keeps the
 *                      Map sheet's own ≥26% floor under the 82px HUD
 *   rail     861–1279  the contextual rail column: Ask is intelligence, and
 *                      the rail is where intelligence lives
 *   float    ≥ 1280    a 440px panel beside the 372px rail, bottom-aligned
 *
 * Pure: no DOM, no React. The dock measures and passes numbers in.
 */

import type { CSSProperties } from 'react';

export type MapAskLayout = 'compact' | 'rail' | 'float';

/** The Spatial boundary (Part II), the same value the launcher anchor uses. */
export const MAP_ASK_COMPACT_BELOW_PX = 861;
export const MAP_ASK_FLOAT_FROM_PX = 1280;
/** Part IV §16.2 — the permanent compact HUD: 52px top bar + 30px Change Strip. */
export const MAP_ASK_HUD_PX = 82;
/** The Map sheet's FULL fraction: the largest share that leaves the ≥26% map floor. */
export const MAP_ASK_MAX_FRACTION = 0.74;
export const MAP_ASK_RAIL_PX = 372;
export const MAP_ASK_TOP_BAR_PX = 44;
export const MAP_ASK_FLOAT_W_PX = 440;
export const MAP_ASK_FLOAT_GAP_PX = 24;

export function mapAskLayoutFor(viewportWidth: number): MapAskLayout {
  if (viewportWidth < MAP_ASK_COMPACT_BELOW_PX) return 'compact';

  return viewportWidth < MAP_ASK_FLOAT_FROM_PX ? 'rail' : 'float';
}

export interface MapAskViewport {
  /** visualViewport.height; 0 until measured. */
  readonly visualViewportHeight: number;
  /** The Map bottom nav's rendered block while it is shown; 0 when hidden. */
  readonly navInset: number;
  /** Layout pixels the on-screen keyboard covers (browsers that do not resize); 0 when none. */
  readonly keyboardInset: number;
}

/**
 * The panel's position and cap. On a phone the composer sits on the keyboard
 * when one is open, otherwise on the nav, and never taller than 74% of what is
 * left under the HUD — so at least 26% of that stays map in every Ask state.
 */
export function mapAskPanelStyle(layout: MapAskLayout, viewport: MapAskViewport): CSSProperties {
  if (layout === 'rail') {
    return { top: MAP_ASK_TOP_BAR_PX, right: 0, bottom: 0, width: MAP_ASK_RAIL_PX };
  }

  if (layout === 'float') {
    return {
      right: MAP_ASK_RAIL_PX + MAP_ASK_FLOAT_GAP_PX,
      bottom: MAP_ASK_FLOAT_GAP_PX,
      width: MAP_ASK_FLOAT_W_PX,
      maxHeight: `calc(100dvh - ${MAP_ASK_TOP_BAR_PX + 2 * MAP_ASK_FLOAT_GAP_PX}px)`,
    };
  }

  const navInset = viewport.keyboardInset > 0 ? 0 : Math.max(0, viewport.navInset);

  return {
    bottom: viewport.keyboardInset > 0 ? viewport.keyboardInset : navInset,
    maxHeight:
      viewport.visualViewportHeight > 0
        ? mapAskMaxHeight(viewport.visualViewportHeight, navInset)
        : `calc(${MAP_ASK_MAX_FRACTION * 100}dvh - ${MAP_ASK_HUD_PX}px)`,
  };
}

/** floor(0.74 × (visible viewport − HUD − shown nav)) — rounded DOWN, so the map can only gain. */
export function mapAskMaxHeight(visualViewportHeight: number, navInset: number): number {
  return Math.max(0, Math.floor(MAP_ASK_MAX_FRACTION * (visualViewportHeight - MAP_ASK_HUD_PX - navInset)));
}
