/**
 * ════════════════════════════════════════════════════════════════════════════
 * MAP MOBILE INTERACTION R1 — ONE AVAILABLE-WORKSPACE MODEL
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The frozen ruling retires raw-full-viewport arithmetic. Every phone geometry
 * site — the sheet height, `mapFractionAt`, the camera fit inset and the zoom
 * anchor — is derived from ONE number, the available Map workspace:
 *
 *     A = visualViewportHeight − 82px permanent top HUD − visible bottom-nav block
 *
 * where 82 = the 52px Map top bar + the 30px Change Strip (the shell's
 * PERMANENT_HUD_PX, passed in rather than restated here), and the bottom-nav
 * block is its REAL rendered height, safe-area padding included, counted only
 * while the nav is visible.
 *
 * R1 FINAL CORRECTION — the Change Strip is permanent chrome. The ≥26% floor
 * is the UNOBSTRUCTED interactive map below all permanent chrome and above
 * the sheet, so the strip is excluded from A exactly like the top bar.
 *
 *   PEEK = 148px where space permits
 *   HALF = floor(0.52 × A)
 *   FULL = floor(0.74 × A), with the nav hidden FIRST and A recomputed
 *
 * CLOSED — CTO / Product Owner, Map / Spatial Visual Convergence R2 final:
 * these are the authoritative MAP detents, with the ≈26% map floor. The
 * Spatial v1.7 / R5.1 figures (54px / 50% / 90%) are not used for the Map;
 * the Conflict sheet keeps its own separately governed geometry.
 *
 * The nav is visible at PEEK and HALF and hidden at FULL and whenever the
 * keyboard is open. Because visibility is derived from the detent in the same
 * computation that derives A, a FULL transition settles in the ruled order —
 * nav leaves layout → A recomputes → sheet and camera geometry settle — with
 * no intermediate frame computed from the old nav-visible geometry.
 *
 * The translucent top HUD (top bar + Change Strip) and the bottom nav are NOT
 * counted as map: A excludes them even though the map can be seen through them.
 *
 * Pure, with no DOM access and no component imports, so every rule here is
 * asserted directly and nothing can drift between the sites that consume it.
 */

import type { SheetStop } from '@/components/map/mobile/MobileBottomSheet';

/** The zoom pair's gap above the sheet. */
export const ZOOM_GAP_PX = 16;
/**
 * The nav height used only until the rendered nav has been measured: its 56px
 * cell plus the 1px top border. Safe-area padding is added by measurement.
 */
export const NAV_BLOCK_FALLBACK_PX = 57;
/** A visual viewport this much shorter than the layout viewport is a keyboard. */
export const KEYBOARD_SHRINK_PX = 120;

export interface WorkspaceDetents {
  readonly peek: number;
  readonly half: number;
  readonly full: number;
}

export interface WorkspaceInputs {
  /** The real visible viewport: visualViewport.height, or innerHeight as the fallback. */
  readonly visualViewportHeight: number;
  /**
   * The permanent top HUD: MobileSpatialShell's PERMANENT_HUD_PX (top bar +
   * Change Strip). The one authority, supplied by the shell that owns it.
   */
  readonly permanentHudPx: number;
  /**
   * Pixels of the layout viewport below the visual viewport (the on-screen
   * keyboard on browsers that do not resize the layout). 0 when none.
   */
  readonly bottomOcclusionPx: number;
  /** The nav block's rendered height, safe area included; the last measurement while visible. */
  readonly navBlockPx: number;
  readonly keyboardOpen: boolean;
}

export interface MapWorkspaceLayout {
  readonly stop: SheetStop;
  readonly navVisible: boolean;
  /** A. 0 until the viewport has been measured. */
  readonly workspacePx: number;
  readonly sheetHeightPx: number;
  /** The sheet's bottom edge above the layout-viewport bottom. */
  readonly sheetBottomPx: number;
  /** Unobstructed map left inside A. */
  readonly mapVisiblePx: number;
  readonly mapFraction: number;
  /** The zoom pair's bottom edge above the layout-viewport bottom. */
  readonly zoomBottomPx: number;
  /** What the camera fit must keep clear, measured from the canvas edges. */
  readonly fitInset: { readonly top: number; readonly bottom: number };
}

/** PEEK and HALF show the nav; FULL and an open keyboard hide it. */
export function isBottomNavVisible(stop: SheetStop, keyboardOpen: boolean): boolean {
  return !keyboardOpen && stop !== 'FULL';
}

/** A, never negative: the visible viewport less ALL permanent chrome. */
export function availableWorkspace(
  visualViewportHeight: number,
  permanentHudPx: number,
  visibleNavBlockPx: number,
): number {
  return Math.max(0, Math.floor(visualViewportHeight - permanentHudPx - visibleNavBlockPx));
}

/**
 * The sheet at a stop, inside A — always rounded DOWN, so the map can only
 * gain room (the accepted Math.floor rule). PEEK is its fixed height where
 * space permits and never more than FULL, so the floor holds on any screen.
 * Before A exists the sheet is its PEEK constant: a number, not a guess.
 */
export function sheetHeightAt(stop: SheetStop, workspacePx: number, detents: WorkspaceDetents): number {
  if (workspacePx <= 0) return detents.peek;

  const full = Math.floor(workspacePx * detents.full);
  if (stop === 'FULL') return full;
  if (stop === 'HALF') return Math.floor(workspacePx * detents.half);

  return Math.min(detents.peek, full);
}

/** The share of A left as unobstructed map at a stop. */
export function workspaceMapFraction(stop: SheetStop, workspacePx: number, detents: WorkspaceDetents): number {
  if (workspacePx <= 0) return 1;

  return (workspacePx - sheetHeightAt(stop, workspacePx, detents)) / workspacePx;
}

/** Every phone geometry value, from one A. */
export function computeMapWorkspace(
  stop: SheetStop,
  inputs: WorkspaceInputs,
  detents: WorkspaceDetents,
): MapWorkspaceLayout {
  const navVisible = isBottomNavVisible(stop, inputs.keyboardOpen);
  const visibleNav = navVisible ? Math.max(0, inputs.navBlockPx) : 0;
  const workspacePx =
    inputs.visualViewportHeight > 0
      ? availableWorkspace(inputs.visualViewportHeight, inputs.permanentHudPx, visibleNav)
      : 0;
  const sheetHeightPx = sheetHeightAt(stop, workspacePx, detents);
  const sheetBottomPx = Math.max(0, inputs.bottomOcclusionPx) + visibleNav;
  const mapVisiblePx = Math.max(0, workspacePx - sheetHeightPx);

  return {
    stop,
    navVisible,
    workspacePx,
    sheetHeightPx,
    sheetBottomPx,
    mapVisiblePx,
    mapFraction: workspacePx > 0 ? mapVisiblePx / workspacePx : 1,
    zoomBottomPx: sheetBottomPx + sheetHeightPx + ZOOM_GAP_PX,
    fitInset: { top: inputs.permanentHudPx, bottom: sheetBottomPx + sheetHeightPx },
  };
}

/** Is this focused element one that raises the on-screen keyboard? */
export function raisesKeyboard(element: { tagName?: string; type?: string; isContentEditable?: boolean } | null): boolean {
  if (element === null || element === undefined) return false;
  if (element.isContentEditable === true) return true;

  const tag = (element.tagName ?? '').toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag !== 'INPUT') return false;

  const type = (element.type ?? 'text').toLowerCase();

  return !['button', 'submit', 'reset', 'checkbox', 'radio', 'range', 'color', 'file', 'image', 'hidden'].includes(type);
}

/** The keyboard is open when an editable field has focus or the visual viewport visibly shrank. */
export function isKeyboardOpen(editableFocused: boolean, layoutViewportHeight: number, visualViewportHeight: number): boolean {
  return editableFocused || layoutViewportHeight - visualViewportHeight >= KEYBOARD_SHRINK_PX;
}
