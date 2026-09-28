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
 * of the Map R1 authority, "Ask on the Map".
 *
 * ── SUPERSEDED FOR PHONES BY D25 (ASK R2 CONSOLIDATED INTEGRATION R1 · GATE G) ──
 *
 * D25 `11_FULLSCREEN_MOBILE_AUTHORITY` (PO correction, accepted) rules the opposite of
 * the R2 composer sheet: "PHONE MAP MAY BE PARTIAL. PHONE ASK MAY NOT." — "Not permitted:
 * HALF Ask, 74% Ask, Map-under-answer, answer sheet over the Map, composer in a bottom
 * detent. The 148 / 52% / 74% geometry belongs to the Map country workspace only." The Map
 * is not lost: Ask opens OVER it without navigating, so closing restores the selected
 * country, camera, zoom, mode/layers and sheet detent exactly (D25 "Map → Ask → Map").
 * D26 (approved) sets the 1024 landscape pane to 460 px. So:
 *
 *   compact  < 861     FULL SCREEN; the composer rests on the keyboard when one is open
 *   rail     861–1279  a dedicated 460 px pane: top 44, right 0, full remaining height
 *   float    ≥ 1280    a 440px panel beside the 372px rail, bottom-aligned (unchanged)
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
/**
 * The Map sheet's FULL fraction. It governs the Map COUNTRY WORKSPACE only; since D25 it is
 * no longer an Ask geometry (kept exported because the Map sheet still uses the figure).
 */
export const MAP_ASK_MAX_FRACTION = 0.74;
/** The Map's own right rail at ≥1280 (the float panel stops at its edge). */
export const MAP_ASK_RAIL_PX = 372;
/** D26 (approved, D25 12) — the 1024 landscape Ask pane. */
export const MAP_ASK_PANE_PX = 460;
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
 * The panel's position. On a phone Ask is FULL SCREEN from the top edge; the bottom nav is
 * hidden while Ask is active (D25 11), so it is not an inset, and with a keyboard open the
 * composer rests on the keyboard (the header stays, the reader shrinks).
 */
export function mapAskPanelStyle(layout: MapAskLayout, viewport: MapAskViewport): CSSProperties {
  if (layout === 'rail') {
    return { top: MAP_ASK_TOP_BAR_PX, right: 0, bottom: 0, width: MAP_ASK_PANE_PX };
  }

  if (layout === 'float') {
    return {
      right: MAP_ASK_RAIL_PX + MAP_ASK_FLOAT_GAP_PX,
      bottom: MAP_ASK_FLOAT_GAP_PX,
      width: MAP_ASK_FLOAT_W_PX,
      maxHeight: `calc(100dvh - ${MAP_ASK_TOP_BAR_PX + 2 * MAP_ASK_FLOAT_GAP_PX}px)`,
    };
  }

  return {
    top: 0,
    left: 0,
    right: 0,
    bottom: viewport.keyboardInset > 0 ? viewport.keyboardInset : 0,
    borderRadius: 0,
  };
}

/**
 * floor(0.74 × (visible viewport − HUD − shown nav)) — the Map COUNTRY SHEET's cap. Not an
 * Ask geometry since D25; retained for the Map workspace, which still owns the fraction.
 */
export function mapAskMaxHeight(visualViewportHeight: number, navInset: number): number {
  return Math.max(
    0,
    Math.floor(MAP_ASK_MAX_FRACTION * (visualViewportHeight - MAP_ASK_HUD_PX - navInset)),
  );
}
