/**
 * DESIGN v1.6 — THE THREE-BAND RULE FOR INTERACTIVE CHROME.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE FINDING THIS EXISTS TO FIX
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Revision 1.5 lifted the reference geography and left every control on the
 * PASSIVE TEXT RAMP. A working mode chip and a disabled one were both rendered
 * at #5D7280 — the same value — so the entire top interaction layer read as
 * decoration. In the Product Owner's frame: a passive map label can afford to
 * be quiet, a working control cannot.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EVERY ACTIONABLE ELEMENT RESOLVES TO EXACTLY ONE BAND
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   ACTIVE     the one thing in effect. Cyan text on a cyan wash.
 *   AVAILABLE  a working control the reader has not chosen. THE POINT OF THE
 *              AMENDMENT: it must be READABLE at normal viewing distance, not
 *              merely present.
 *   UNBUILT    a mode whose model does not exist yet. The ONLY legitimate use
 *              of the old faint treatment, because here faintness IS the
 *              message rather than an accident of the ramp.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * VISIBILITY IS BOUGHT WITH LUMINANCE, NEVER WITH A SEMANTIC COLOUR
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The cheap way to make a control visible is to paint it cyan or amber. That
 * would destroy the grammar: cyan means verified evidence and the active state,
 * amber means attention, change and monitoring. A control that borrowed either
 * would be claiming a meaning it does not have, on a surface whose whole
 * argument is that colour carries meaning. So AVAILABLE is a BRIGHTER SLATE —
 * #B4C8D4 rising to #E4EEF4 — and nothing else.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS ONE MODULE AND NOT A CLASS STRING PER COMPONENT
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The defect was a DRIFT: eight controls independently reached for the passive
 * ink token and were individually reasonable. Re-spelling the same three bands
 * in eight files would reproduce exactly that. These constants are the bands;
 * a component picks one and adds only its own geometry.
 */

/** Shared by all three: nothing here decides size, spacing or shape. */
const TRANSITION = 'transition-[color,background-color,border-color] duration-[140ms]';

/**
 * The one thing in effect.
 *
 * v1.6 raised the active border from .35 to .5 and keeps the .16 fill, so the
 * active chip is bounded rather than merely tinted — at the old border weight
 * it read as a wash with no edge once the surrounding chips became visible.
 */
export const BAND_ACTIVE =
  `${TRANSITION} border-sp-cyan/50 bg-sp-cyan/[0.16] text-sp-cyan ` +
  'shadow-[inset_0_0_0_1px_rgba(58,214,230,.1)]';

/**
 * A working control the reader has not chosen.
 *
 * The hairline chip is deliberate and is half the fix: #B4C8D4 alone on a bare
 * background still reads as a label. A visible border is what makes it read as
 * a THING TO PRESS, which is the difference between legible and actionable.
 */
export const BAND_AVAILABLE =
  `${TRANSITION} border-[rgba(126,166,186,.14)] bg-[rgba(126,166,186,.045)] text-sp-ui-idle ` +
  'hover:border-[rgba(126,166,186,.3)] hover:bg-[rgba(126,166,186,.11)] hover:text-sp-ui-hover ' +
  'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-sp-cyan';

/**
 * A mode whose model does not exist yet — SITUATIONS, CHANGE.
 *
 * NO FILL, AND THAT IS THE MESSAGE. An unbuilt control must not look like a
 * control that is merely unselected, or a reader will keep pressing it. It
 * carries an amber β marker, which is the one place amber is not about
 * evidence: it marks the product's own state, not the world's.
 */
export const BAND_UNBUILT =
  `${TRANSITION} cursor-default border-[rgba(126,166,186,.1)] text-sp-ui-off`;

/** The β marker beside an UNBUILT control. */
export const BAND_UNBUILT_MARKER = 'text-[rgba(242,169,60,.75)]';

export type ControlBand = 'ACTIVE' | 'AVAILABLE' | 'UNBUILT';

/**
 * The band for a control, chosen once so a component cannot spell the
 * precedence differently from its neighbour.
 *
 * ACTIVE WINS OVER UNBUILT, and the order matters: a mode that is pinned on
 * while its own model is incomplete is still the thing currently in effect, and
 * rendering it as unbuilt would tell the reader the view they are looking at
 * does not exist.
 */
export function bandFor(state: { active: boolean; built: boolean }): ControlBand {
  if (state.active) return 'ACTIVE';

  return state.built ? 'AVAILABLE' : 'UNBUILT';
}

export const BAND_CLASS: Readonly<Record<ControlBand, string>> = {
  ACTIVE: BAND_ACTIVE,
  AVAILABLE: BAND_AVAILABLE,
  UNBUILT: BAND_UNBUILT,
};
