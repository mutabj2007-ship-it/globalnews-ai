/**
 * ECON-UI-1 — LOCAL NEUTRAL STRUCTURAL PLACEHOLDERS.
 *
 * DEP-2 is unresolved and the lane is explicit: do NOT create an Economy accent,
 * `ECONOMY_ACCENT_TBD` remains unallocated, and do NOT alter the global token registry
 * while Main is promoting LANG-UI-7 — `frontend/tailwind.config.ts` is inside H's frozen
 * change set, so writing tokens there would collide.
 *
 * So Economy uses local structural placeholders, achromatic by construction. There is no
 * hue anywhere in this file and no colour named for a meaning: selection and focus are
 * carried by a 1px light border plus a raised fill, and domain identity by typography,
 * label, border treatment and layout.
 *
 * When the shared token registry lands, each constant here maps to one shared semantic
 * token and this file is deleted. Layout is unaffected by the substitution — that is the
 * design's own guarantee about the achromatic placeholders.
 *
 * REPORTED AS DEFERRED INTEGRATION POINT ECON-DEP-2-1.
 */

/** Surface / elevation ladder. */
export const ECON_SURFACE = {
  ground: '#0c0e10',
  panel: '#101315',
  raised: '#14181b',
  selected: '#171b1e',
} as const;

/**
 * Line ladder. `emphasis`, `structure` and `accentLine` are NEUTRAL — none is a domain accent.
 *
 * ECONOMY-CONTRAST — WHY A NEW STEP EXISTS, AND WHY THE FILLS DID NOT MOVE.
 *
 * The measured defect was that adjacent regions are indistinguishable: panel/ground
 * **1.04:1**, raised/panel **1.04:1**, selected/raised **1.03:1**. My own earlier
 * exit criterion — ≥3:1 between adjacent FILLS — is arithmetically unreachable at
 * these luminances: even a drastic dark step reaches only 1.49:1, and clearing 3:1
 * would require mid-greys that destroy the accepted achromatic surface. That target
 * is withdrawn. On a dark substrate perceivable separation comes from the LINE, not
 * from the fill, so the four surface fills below are unchanged to the byte and the
 * delineation carries the contrast instead.
 *
 * `structure` is that one step. `#5f6a70` clears 3:1 against **every** surface fill
 * it can border — ground 3.48, panel 3.36, raised 3.22, selected 3.12 — so the
 * criterion holds wherever the boundary happens to sit, not only on panel.
 *
 * IT DOES NOT DISTURB THE HIERARCHY. Measured against panel the ladder stays
 * strictly increasing and every rung keeps its meaning:
 *
 *     hairline 1.18  <  border 1.43  <  emphasis 2.34  <  structure 3.36  <  accentLine 11.15
 *     within-panel      object at      object active      panel and          selection
 *     rules and cells   rest           or bound           plot-area edges
 *
 * So `structure` is used ONLY where one panel meets another and around the plot-area
 * wells. Row rules, cell gutters, chip outlines and the selected/active states keep
 * the token they always had: a louder object outline than the structure containing it
 * would be a redesign, and this lane is not one.
 *
 * NOTHING SEMANTIC MOVES. No subject bound, no observation source, no absent-not-zero
 * rule is expressed through a line colour, and none is touched here.
 */
export const ECON_LINE = {
  hairline: '#1e2327',
  border: '#2b3237',
  emphasis: '#4a5257',
  /** Panel and plot-area delineation. ≥3:1 against every surface fill. */
  structure: '#5f6a70',
  accentLine: '#c3c9cd',
} as const;

/** Ink ladder. Every tier clears 4.5:1 on its own ground. */
export const ECON_INK = {
  primary: '#e6e9eb',
  secondary: '#c3c9cd',
  tertiary: '#a4acb2',
  label: '#8d959b',
  reduced: '#7d858c',
  /** Inverted ink, used only on the promoted achromatic chip. */
  inverted: '#0c0e10',
} as const;

/** Chart emphasis ladder, oldest to newest. Not semantic colour — a value ramp. */
export const ECON_CHART = ['#2b3237', '#3a4248', '#4a5257', '#5d666c'] as const;

/*
 * D7-AR-ADOPTION — the two Economy families now read the accepted Arabic policy
 * variable, exactly as `arabicRunPolicy.ts` does for every Tailwind font
 * utility (`fam(v) => var(--ar-family, v)`).
 *
 * Economy declares its typography INLINE rather than through Tailwind, so the
 * policy plugin cannot reach it and an ancestor run could not fix it: an inline
 * family beats an inherited one. Wrapping the value here is the same formula in
 * the one place all 67 call sites already share.
 *
 * INERT OUTSIDE ARABIC BY CONSTRUCTION: with `--ar-family` unset the var()
 * falls through to the identical Latin stack it always had.
 */
export const ECON_SANS = "var(--ar-family, 'IBM Plex Sans', Helvetica, sans-serif)";
export const ECON_MONO = "var(--ar-family, 'IBM Plex Mono', monospace)";
