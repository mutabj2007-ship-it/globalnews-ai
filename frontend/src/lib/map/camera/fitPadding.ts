/**
 * H-C907 R2 · FITTING AGAINST THE VISIBLE MAP, NOT THE WHOLE CANVAS.
 *
 * ── THE DEFECT THE CTO REVIEW EXPOSED ─────────────────────────────────────
 *
 * R1 made the phone frame a selected country, and the URL proved a camera was
 * committed. The RENDERED assertion the review asked for then showed the rest
 * of the truth: on compact Spatial the map is full-bleed (`absolute inset-0`)
 * and the bottom sheet is drawn OVER it, so `cameraForBounds` centred each
 * country in the FULL canvas — underneath the sheet.
 *
 *   AFG 375x844   projected box top 333, height 178  ->  bottom 511
 *                 visible map pane ends at 406 (the sheet's top edge)
 *                 only 18% of the country's height was actually visible
 *   LUX 375x844   box top 398  ->  2% visible. Effectively hidden.
 *
 * The camera was right about the WORLD and wrong about the SCREEN. That is why
 * the packaged screenshots read as "world-scale with the country at the edge".
 *
 * ── THE CORRECTION ────────────────────────────────────────────────────────
 *
 * MapLibre already takes per-side padding. The accepted `SELECTION_FIT_PADDING`
 * is kept as the base on every side and the OCCLUDED region is added to the
 * sides that are occluded. Nothing about the fit policy changes — it is the
 * same resolver, the same ceiling, the same single commit — it is simply told
 * where the map can actually be seen.
 *
 * DESKTOP IS UNTOUCHED BY CONSTRUCTION: with no inset this returns the scalar
 * `base`, which is the exact argument `resolveFit` passed before.
 *
 * ── WHY THE CLAMP IS NOT OPTIONAL ─────────────────────────────────────────
 *
 * At FULL the sheet is 74% of the viewport and the HUD is 82px. Base padding
 * plus those insets exceeds the container, `cameraForBounds` returns
 * `undefined`, `resolveFit` returns false and NOTHING IS COMMITTED — the
 * country would silently not be framed at all. So the insets are clamped to
 * leave a usable box. A clamped fit is a worse frame; an unclamped one is no
 * frame, and the reader cannot tell the second from a bug.
 */

export interface FitInset {
  readonly top?: number;
  readonly bottom?: number;
  readonly left?: number;
  readonly right?: number;
}

export interface FitPaddingPx {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
}

/** The smallest box the fit is allowed to be squeezed into, per axis. */
export const MIN_FIT_BOX_PX = 96;

function clampAxis(
  base: number,
  near: number,
  far: number,
  extent: number,
): { readonly near: number; readonly far: number } {
  const total = base * 2 + near + far;
  const allowed = Math.max(0, extent - MIN_FIT_BOX_PX);

  if (total <= allowed) return { near: base + near, far: base + far };

  /*
    Shed the INSETS proportionally and keep the accepted base padding intact
    where it fits. The base is the released framing margin; the insets are this
    surface's occlusion, and occlusion is what must yield when there is not
    enough room for both.
  */
  const insetRoom = Math.max(0, allowed - base * 2);
  const insetTotal = near + far;
  const scale = insetTotal === 0 ? 0 : Math.min(1, insetRoom / insetTotal);
  const basePart = Math.min(base, Math.max(0, allowed) / 2);

  return { near: basePart + near * scale, far: basePart + far * scale };
}

/**
 * Resolve the padding to hand MapLibre.
 *
 * @param base    the accepted `SELECTION_FIT_PADDING`
 * @param inset   the occluded region, or null on a surface with none
 * @param pane    the container's measured box
 */
export function fitPaddingFor(
  base: number,
  inset: FitInset | null | undefined,
  pane: { readonly w: number; readonly h: number },
): number | FitPaddingPx {
  if (inset === null || inset === undefined) return base;

  const vertical = clampAxis(base, inset.top ?? 0, inset.bottom ?? 0, pane.h);
  const horizontal = clampAxis(base, inset.left ?? 0, inset.right ?? 0, pane.w);

  return {
    top: Math.round(vertical.near),
    bottom: Math.round(vertical.far),
    left: Math.round(horizontal.near),
    right: Math.round(horizontal.far),
  };
}
