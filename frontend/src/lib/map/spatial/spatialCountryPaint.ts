import type { LegendKey } from './precisionModel';
import {
  DESIGN_COUNTRY_STATE,
  DESIGN_REFERENCE,
  DESIGN_REFERENCE_WIDTH,
  DESIGN_WATCH_GLOW,
  rgbaParts,
} from './designRenderTokens';

/**
 * SPATIAL M2 — THE COUNTRY PAINT, BUILT FROM DESIGN'S EXTRACTED VALUES.
 *
 * CTO ruling, 2026-09-01: the watched treatment "is still too strong ... Do not
 * use a heavy opaque fill that dominates the basemap", and "Claude Design's
 * actual tokens are the authority. Do not approximate them."
 *
 * ── WHY THIS EXISTS RATHER THAN AN EDIT TO `coveragePaint` ────────────────
 *
 * `coveragePaint` is the ACCEPTED legacy World Map paint: a coverage wash keyed
 * to story counts, with a 0.05 resting opacity for countries with nothing. It
 * is correct for that surface and it is still what the flag-off rollback path
 * renders — editing it would change the surface this milestone is not allowed
 * to touch, in order to fix the one it is.
 *
 * So the Spatial shell gets its own paint, built from `designRenderTokens.ts`,
 * and the legacy map keeps `coveragePaint` byte-for-byte. Two surfaces, two
 * paints, one file each.
 *
 * ── AND WHY THE STATES ARE SEPARATE LAYERS RATHER THAN ONE EXPRESSION ─────
 *
 * The prototype draws each country once and decides fill and stroke together in
 * a cascade — evidence, then no-evidence, then watch, then hover, then
 * selected. A canvas can do that because it paints in a loop. MapLibre paints
 * in layers, so the cascade is expressed as z-order: each state is its own
 * filtered layer, stacked in the prototype's own order, and the last one to
 * draw wins exactly as the last assignment wins there.
 *
 * The one branch that is NOT z-order is watch, because the prototype's watch
 * branch is `stroke = stroke || amber` — it DEFERS to an evidence stroke rather
 * than overriding it. That is expressed as a filter: the watch line excludes
 * countries that already carry an evidence stroke. Monitoring never overwrites
 * what the evidence says.
 */

/** The tone a country's evidence carries, in the prototype's own vocabulary. */
export type CountryTone = 'verified' | 'attention' | 'unknown' | 'none';

/** `LegendKey` -> the prototype's tone. One mapping, stated once. */
export function toneForLegendKey(key: LegendKey): CountryTone {
  switch (key) {
    case 'verified':
      return 'verified';
    case 'attention':
      return 'attention';
    case 'interpreted':
      return 'unknown';
    default:
      return 'none';
  }
}

const STATE_FOR_TONE = {
  verified: DESIGN_COUNTRY_STATE.evidenceVerified,
  attention: DESIGN_COUNTRY_STATE.evidenceAttention,
  unknown: DESIGN_COUNTRY_STATE.evidenceUnknown,
  none: DESIGN_COUNTRY_STATE.noEvidence,
} as const;

export interface TonePaint {
  readonly fillColour: string;
  readonly fillOpacity: number;
  readonly strokeColour: string;
  readonly strokeOpacity: number;
  readonly lineWidth: number;
}

/**
 * The paint for one tone, with the rgba strings split into the colour and
 * opacity MapLibre wants as separate properties.
 *
 * PARSED, NOT RETYPED. `rgbaParts` reads the extracted string, so there is no
 * second hand-written 0.12 anywhere that could drift from the first.
 */
export function paintForTone(tone: CountryTone): TonePaint {
  const state = STATE_FOR_TONE[tone];
  const fill = rgbaParts(state.fill ?? 'rgba(0,0,0,0)');
  const stroke = rgbaParts(state.stroke ?? 'rgba(0,0,0,0)');

  return {
    fillColour: fill.colour,
    fillOpacity: fill.opacity,
    strokeColour: stroke.colour,
    strokeOpacity: stroke.opacity,
    lineWidth: state.lineWidth,
  };
}

/**
 * A MapLibre `match` over ISO numeric ids, so one fill layer can carry all four
 * tones without four layers and four filters.
 *
 * The default arm is FULLY TRANSPARENT rather than a faint wash: Design draws
 * land as `--land` and puts the intelligence layer on top, so a country with no
 * evidence and no state contributes nothing to this layer at all.
 */
export function toneMatchExpression(
  numericIdsByTone: Readonly<Record<CountryTone, readonly string[]>>,
  property: 'fillColour' | 'fillOpacity' | 'strokeColour' | 'strokeOpacity',
  fallback: string | number,
): unknown {
  const arms: unknown[] = [];

  for (const tone of ['none', 'unknown', 'attention', 'verified'] as const) {
    const ids = numericIdsByTone[tone];

    if (ids.length === 0) continue;

    arms.push([...ids], paintForTone(tone)[property]);
  }

  if (arms.length === 0) return fallback;

  return ['match', ['get', 'numericId'], ...arms, fallback];
}

/* ════════════════════════════════════════════════════════════════════════════
   REFERENCE GEOGRAPHY
   ════════════════════════════════════════════════════════════════════════════

   The prototype ramps its reference line widths with the zoom scale:

       coast:  Math.min(1.4, .7  + k * .02)
       border: Math.min(1.2, .55 + k * .015)

   `k` is a d3 zoom SCALE, not a MapLibre zoom LEVEL, so the two cannot share a
   number. What is preserved is the shape of the ramp and, exactly, its two
   endpoints: the width at the world view and the cap it reaches. A hairline
   that never thickens reads as a different map at Z9, and a fixed 1.2 px border
   at Z1 turns the world into a wireframe.
*/
export function referenceLineWidth(kind: 'coast' | 'border'): unknown {
  const ramp = DESIGN_REFERENCE_WIDTH[kind];

  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    1,
    ramp.base,
    /* The zoom at which the prototype's own ramp reaches its cap. */
    9,
    ramp.cap,
  ];
}

export const REFERENCE_COLOURS = {
  land: DESIGN_REFERENCE.land,
  border: DESIGN_REFERENCE.border,
  coast: DESIGN_REFERENCE.landEdge,
  ocean: DESIGN_REFERENCE.ocean,
} as const;

/* ════════════════════════════════════════════════════════════════════════════
   THE MONITORED EDGE
   ════════════════════════════════════════════════════════════════════════════ */

/**
 * `ctx.shadowBlur = 12` HAS NO MAPLIBRE EQUIVALENT, and this is how it is
 * reproduced rather than approximated away.
 *
 * A canvas shadow is a blurred copy of the shape drawn beneath it. MapLibre's
 * `line-blur` is the same operation on a line layer, so the glow is a SECOND,
 * WIDER, BLURRED amber line under the crisp one — which is what the prototype's
 * shadow actually renders. The blur radius is the prototype's own 12, and the
 * glow line's colour and opacity are its own `shadowColor`.
 *
 * DECLARED AS A DEVIATION IN THE HANDOFF, because it is an equivalent and not
 * an identity: a Gaussian shadow and a blurred stroke are not the same maths.
 * The visible result is a soft amber edge at the same colour, opacity and
 * radius, and the crisp 1.1 px stroke on top is exact.
 */
export const WATCH_EDGE = {
  glowColour: rgbaParts(DESIGN_WATCH_GLOW.shadowColor).colour,
  glowOpacity: rgbaParts(DESIGN_WATCH_GLOW.shadowColor).opacity,
  glowBlur: DESIGN_WATCH_GLOW.shadowBlur,
  /* The blurred copy is drawn wider so the blur has something to spread. */
  glowWidth: DESIGN_WATCH_GLOW.lineWidth * 2,
  strokeColour: rgbaParts(DESIGN_WATCH_GLOW.stroke).colour,
  strokeOpacity: rgbaParts(DESIGN_WATCH_GLOW.stroke).opacity,
  strokeWidth: DESIGN_WATCH_GLOW.lineWidth,
} as const;

/* ════════════════════════════════════════════════════════════════════════════
   HOVER AND SELECTION
   ════════════════════════════════════════════════════════════════════════════ */

export const HOVER_PAINT = {
  fillColour: rgbaParts(DESIGN_COUNTRY_STATE.hover.fill).colour,
  fillOpacity: rgbaParts(DESIGN_COUNTRY_STATE.hover.fill).opacity,
  strokeColour: rgbaParts(DESIGN_COUNTRY_STATE.hover.stroke).colour,
  strokeOpacity: rgbaParts(DESIGN_COUNTRY_STATE.hover.stroke).opacity,
  lineWidth: DESIGN_COUNTRY_STATE.hover.lineWidth,
} as const;

export const SELECTED_PAINT = {
  fillColour: rgbaParts(DESIGN_COUNTRY_STATE.selected.fill).colour,
  fillOpacity: rgbaParts(DESIGN_COUNTRY_STATE.selected.fill).opacity,
  attentionFillColour: rgbaParts(DESIGN_COUNTRY_STATE.selectedAttention.fill).colour,
  attentionFillOpacity: rgbaParts(DESIGN_COUNTRY_STATE.selectedAttention.fill).opacity,
  /* `#8ef0fa` — a literal hex in the prototype, at full opacity. */
  strokeColour: DESIGN_COUNTRY_STATE.selected.stroke,
  /*
    1.6 px. "Do not harden the polygon edge merely to make selection obvious" —
    the previous implementation drew a 2 px full-opacity cyan ring, which is the
    "thick luminous contour" the ruling names.
  */
  lineWidth: DESIGN_COUNTRY_STATE.selected.lineWidth,
} as const;
