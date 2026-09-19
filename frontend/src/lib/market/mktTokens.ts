/**
 * PART VII · MARKET — PRESENTATION TOKENS, READ OFF THE FROZEN BOARDS.
 *
 * A LESSON APPLIED BEFORE THE FIRST PIXEL. On Humanitarian I bound Economy's palette by
 * habit and shipped a charcoal surface where the design authority specified navy. So this
 * file was written only after measuring Part VII's four boards: 1,736 colour tokens, and —
 * unlike Part X, which is authored in OKLCH — Part VII is authored in HEX. Two different
 * board generations, and assuming they shared a palette would have been the same mistake
 * a second time.
 *
 * MARKET IS A COOL SLATE, NOT HUMANITARIAN'S NAVY. Measured blue-minus-red across the
 * substrate ladder is 5 to 15 here, against 7 to 10 for Part X, and the ladder sits
 * lighter. The two domains are meant to be told apart, and they are.
 *
 * Roles taken from the markup, not assigned by me:
 *   body { background: #0d0f12 }      the page substrate, read out of the board's own CSS
 *   #101317 / #14171c                 the frame panels (x56 / x123)
 *   #171b21                           raised (x122)
 *   #1f242b                           the 1px grid gutter and region rules
 *   #2b313a                           the dominant 1px border (x59)
 */

/*
 * THE SUBSTRATE — WHERE EACH LAYER COMES FROM, STATED RATHER THAN BLENDED.
 *
 * MEASURED, AND IT MATTERS: Part VII's four boards contain **zero** gradients, zero grid
 * declarations and zero `background-size` rules. They are flat fills. Part X's boards were
 * the same, and taking that flatness literally is what produced a near-black Humanitarian
 * page twice — a design board mocks the panels; it does not model the page canvas beneath
 * them, because in the product that canvas is not the domain's to draw.
 *
 * So this file is explicit about provenance:
 *
 *   PART VII owns the PANELS   — every fill and line below is a frozen board value
 *   GN-CD-300 owns the CANVAS  — base, radial field and technical grid, released, and
 *                                what `PageCanvas` gives every other route in this product
 *
 * PROVENANCE, AS RULED BY THE PRODUCT OWNER (VISUAL SUBSTRATE RULING).
 *
 *   `MKT_CANVAS.grid` is a GLOBALNEWSAI APPLICATION-LEVEL SUBSTRATE.
 *   It is NOT a Part VII domain design token.
 *
 * That is the settled provenance and it replaces the offer this comment used to carry to
 * drop the grid in the name of board flatness. The grid REMAINS. Part VII continues to own
 * its panel fills, lines, states and domain composition; the application owns the canvas
 * beneath them, and the canvas may show through those panels wherever the translucent
 * treatment below preserves legibility and hierarchy — which is measured, not assumed:
 * every text box on this route was sampled at its own glyph pixels against the backdrop
 * those glyphs actually touch (41 boxes, min 5.46:1, median 6.38:1, none below 4.5:1).
 *
 * The page is not to be flattened back into an opaque near-black sheet.
 */
export const MKT_CANVAS = {
  base: 'bg-cd-void',
  field: 'bg-cd-page',
  grid: 'bg-cd-grid-page bg-cd-grid-56',
} as const;

/*
 * PART VII'S FROZEN PANEL LADDER — the values, unchanged, but TRANSLUCENT.
 *
 * The fills are exactly what the boards draw. What changed is that they no longer paint
 * over the canvas: at these alphas the radial field and the technical grid read through
 * the chrome, which is the difference between a frame that sits in the product and one
 * that sits on top of it. Part VII's own adjacent fills are 1.03-1.06:1 apart, so an
 * opaque stack of them was always going to read as one flat sheet.
 */
export const MKT_SURFACE = {
  /** Nothing paints over the canvas. */
  substrate: 'transparent',
  /** #101317 — the frame panel. */
  panel: 'rgba(16, 19, 23, 0.72)',
  /** #14171c — the second panel step. */
  panel2: 'rgba(20, 23, 28, 0.78)',
  /** #171b21 — raised cards and drawer chrome. */
  raised: 'rgba(23, 27, 33, 0.86)',
  /** #1b2027 — an inset well. */
  chip: 'rgba(27, 32, 39, 0.70)',
  /** #1f242b — selected and hovered rows. */
  selected: 'rgba(31, 36, 43, 0.92)',
} as const;

/*
 * LINES — PART VII'S OWN VALUES, EXPRESSED AS TRANSLUCENT SLATE.
 *
 * The boards draw #1f242b, #272c34, #2b313a and #4d5461. Rendered opaque over a navy
 * canvas those read as grey framing, which was the Humanitarian finding. As alpha over
 * the same slate hue they belong to the surface instead of being drawn across it.
 *
 * `structure` is the one added step, for the reason it is added everywhere in this
 * product: Part VII's strongest drawn border reaches 2.36:1 against the frame, and panel
 * separation on a dark substrate has to come from the line because it cannot come from
 * the fill.
 */
export const MKT_LINE = {
  hairline: 'rgba(139, 148, 161, 0.10)',
  border: 'rgba(139, 148, 161, 0.22)',
  strong: 'rgba(139, 148, 161, 0.30)',
  emphasis: 'rgba(139, 148, 161, 0.44)',
  structure: 'rgba(139, 148, 161, 0.58)',
} as const;

/** Part VII's ink ramp, verbatim. */
export const MKT_INK = {
  primary: '#e7eaee',
  secondary: '#a3abb6',
  tertiary: '#949daa',
  label: '#8b94a1',
  inverted: '#0d0f12',
} as const;

/**
 * Part VII's licensed accents, verbatim from the boards. Each marks one thing.
 * There is no red, and none is reachable: Market declares no severity and no score.
 */
export const MKT_LICENSED = {
  cyan: '#6fc2dc',
  mint: '#6fd8ab',
  amber: '#e3b04b', amberFill: 'rgba(227, 176, 75, 0.10)', amberLine: 'rgba(227, 176, 75, 0.42)',
  sand: '#d9c48f', sandFill: 'rgba(217, 196, 143, 0.09)', sandLine: 'rgba(217, 196, 143, 0.38)',
} as const;

/*
 * THE ACTIVE BAND — the three-band rule the Tailwind config already states, in Part VII's
 * cyan. Its recorded reason is the same failure the Product Owner found on Humanitarian:
 * controls left on the passive ramp make a working control and a disabled one render at
 * the same value. So AVAILABLE is `#a3abb6`, not the label grey — brighter than the
 * passive ramp — and ACTIVE is cyan on a cyan wash with a cyan edge.
 */
export const MKT_NAV = {
  /* The wash is composited OVER the panel, not over the switch strip's gutter: a wash
     alone put the active label on rgb(86,105,119) at 3.82:1. Layered, it sits on
     rgb(25,37,47) at 10.45:1 with the same cyan tint. */
  activeWash: 'linear-gradient(rgba(111, 194, 220, 0.10), rgba(111, 194, 220, 0.10)), rgba(16, 19, 23, 0.72)',
  activeEdge: '#6fc2dc',
  activeInk: '#a6dcec',
  /* A real fill. `transparent` let the switch strip's own gutter colour flood the whole
     tab: measured at glyph pixels, an inactive label sat on rgb(84,96,111) at 2.76:1.
     With the panel restored the gutter is 1px again and the same label clears 7.9:1. */
  inactiveFill: 'rgba(16, 19, 23, 0.72)',
  inactiveInk: '#a3abb6',
} as const;

/** Section headings use the product's marker treatment, in Part VII's cyan. */
export const MKT_HEADING = {
  markerPx: 6,
  primaryInk: '#a6dcec',
  secondaryInk: '#a3abb6',
  /* 5.34:1 on the panel over the field — clears R20's 4.5:1 for mono metadata. Verified
     at glyph pixels, not from the token. */
  noteInk: '#8b94a1',
} as const;

export const MKT_SANS = "var(--ar-family, 'IBM Plex Sans', Helvetica, sans-serif)";
export const MKT_MONO = "var(--ar-family, 'IBM Plex Mono', monospace)";

export const MKT_TYPE = {
  monoMeta: 'max(var(--ar-fs-min, 0px), 10.5px)',
  body: 'max(var(--ar-fs-min, 0px), 12.5px)',
  bodyLarge: 'max(var(--ar-fs-min, 0px), 14px)',
  statement: 'max(var(--ar-fs-min, 0px), 20px)',
  title: 'max(var(--ar-fs-min, 0px), 19px)',
} as const;

export const mktTracking = (em: number): string => `calc(${em}em * var(--ar-ls-mul, 1))`;

export const MKT_HIT_TARGET_PX = 44;
