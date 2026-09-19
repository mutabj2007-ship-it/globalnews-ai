/**
 * PART X · HUMANITARIAN — PRESENTATION TOKENS.
 *
 * R20 COLOUR LEGALITY, WHICH THIS FILE ENCODES RATHER THAN DESCRIBES:
 *   mint   → Watch only            amber → approved shared change only
 *   sand   → a charging control    violet → the tier chip
 *   cyan   → evidence
 *   and NEED · DIRECTION · CONFIDENCE · PRECISION are ACHROMATIC, always.
 *   Zero critical red unless the shared severity contract returned CRITICAL — and
 *   `CRITICAL_RED` is deliberately NOT defined here, so it cannot be reached.
 *
 * THE DELINEATION STEP IS REUSED, NOT REINVENTED. R20 asks that no two adjacent
 * near-black layers sit within 0.02 lightness. That is unreachable between dark
 * fills — measured on Economy at 1.03–1.04:1 — so the accepted remedy, promoted at
 * C47, is a ≥3:1 BORDER. `#5f6a70` clears 3:1 against every surface below
 * (ground 3.48, panel 3.36, raised 3.22, selected 3.12), and the ladder stays
 * strictly increasing so a resting chip never outranks the panel containing it.
 */

/*
 * THE SUBSTRATE IS THE APPLICATION'S, NOT A BOARD COLOUR — AND THAT IS THE CORRECTION.
 *
 * TWO WRONG ANSWERS BEFORE THIS ONE, both mine. First I bound Economy's achromatic greys
 * and the page read charcoal. Then I bound Part X's own board values — genuinely navy,
 * genuinely frozen — and the page STILL read flat and black, because a design board's
 * flat fill is not the product's substrate. GlobalNewsAI does not paint a colour behind a
 * page; it composes THREE LAYERS, and Humanitarian was covering all of them.
 *
 * WHAT THE PRODUCT ACTUALLY DOES, read out of `components/layout/PageCanvas.tsx`, the
 * released foundation every home surface renders inside (authority GN-CD-300 §F.1/§F.2/§G):
 *
 *   bg-cd-void        #04060c                          the page base            §F.1
 *   bg-cd-page        two composite radial navy fields  the depth               §F.2
 *   bg-cd-grid-page   rgba(56,189,248,.045) 1px rules   the technical grid      §G
 *   bg-cd-grid-56     56px 56px                         its spacing             §G
 *
 * The radial field is what makes the product read as navy rather than black, and the
 * 56px cyan grid is the "blue-toned grid structure" that was missing. Both are applied
 * as CLASSES below, so the values stay the released tokens and cannot drift from a hex
 * I copied.
 *
 * PROVENANCE, AS RULED BY THE PRODUCT OWNER (VISUAL SUBSTRATE RULING).
 *
 *   `HUM_CANVAS.grid` is a GLOBALNEWSAI APPLICATION-LEVEL SUBSTRATE.
 *   It is NOT a Part X domain design token.
 *
 * The same wording governs Market's `MKT_CANVAS.grid`. Part X continues to own its panel
 * fills, lines, states and domain composition; the application owns the canvas beneath
 * them, and the canvas may show through those panels wherever the translucent treatment
 * below preserves legibility and hierarchy — measured, not assumed: every text box on
 * these routes was sampled at its own glyph pixels against the backdrop those glyphs
 * actually touch (66 boxes, min 4.77:1, median 6.83:1, none below 4.5:1).
 *
 * The page is not to be flattened back into an opaque near-black sheet.
 *
 * WHY NOT SIMPLY WRAP IN `PageCanvas`. It bounds content to 1500px with page padding,
 * which is right for a document page and wrong for this: R13 specifies a full-bleed
 * workspace of four permanent regions with a rail fixed at 336px and surplus width going
 * INTO zone C. So the three substrate LAYERS are reused exactly and the bounded wrapper
 * is not — same authority, applied to a workspace instead of a page.
 */

/** The released substrate layers, as classes. Order matters: base, field, grid. */
export const HUM_CANVAS = {
  base: 'bg-cd-void',
  field: 'bg-cd-page',
  grid: 'bg-cd-grid-page bg-cd-grid-56',
} as const;

/*
 * PANELS COME FROM THE `sp-*` FAMILY, WHICH IS THE PRODUCT'S BLUE ONE.
 *
 * Measured blue-minus-red: `sp-panel` #0c151c is 16 and `sp-panel-2` #101b25 is 21,
 * against 9 for the board fills I had been using and 4-7 for Economy's greys. This is
 * the family the Spatial HUD already uses, copied in the Tailwind config from the design
 * prototype's own `:root` block.
 *
 * THEY ARE DELIBERATELY TRANSLUCENT. A solid panel would hide the grid and the radial
 * field, which is exactly how the page lost its foundation the first two times. At these
 * alphas the technical grid reads THROUGH the chrome, which is what makes the frame sit
 * in the product rather than on top of it.
 */
export const HUM_SURFACE = {
  /** Nothing paints over the canvas; regions are translucent above it. */
  ground: 'transparent',
  /** sp-rail #080f15 at 0.82 — the status header and rail band. */
  header: 'rgba(8, 15, 21, 0.82)',
  /** sp-panel #0c151c at 0.72 — the primary frame panel. */
  panel: 'rgba(12, 21, 28, 0.72)',
  /** sp-panel-2 #101b25 at 0.85 — raised cards and drawer chrome. */
  raised: 'rgba(16, 27, 37, 0.85)',
  /** sp-field #060d13 — an inset well; darker than its container, as a well should be. */
  chip: 'rgba(6, 13, 19, 0.75)',
  /** sp-item-hover #101a24 — selected and hovered rows. */
  selected: 'rgba(16, 26, 36, 0.92)',
} as const;

/*
 * LINES ARE BLUE-TONED AND TRANSLUCENT — `sp-line` and its two siblings, verbatim.
 *
 * A grey border on a navy field is the single thing that made the frame read as
 * "black/grey framing". These are the product's own rules: a light blue-grey at low
 * alpha, so an edge belongs to the surface it sits on instead of being drawn over it.
 *
 * `structure` is the one addition, and it is the same delineation step every dark
 * surface in this product needs — Part X's own fills sit 0.01-0.03 lightness apart and
 * cannot separate on their own. It is `sp-line` raised to full strength rather than a
 * new colour.
 */
export const HUM_LINE = {
  /** sp-line-3 — within-panel rules. */
  hairline: 'rgba(126, 166, 186, 0.07)',
  /** sp-line — an object at rest. */
  border: 'rgba(126, 166, 186, 0.22)',
  /** sp-line-2 — an object active or bound. */
  emphasis: 'rgba(126, 166, 186, 0.34)',
  /** Panel and drawer delineation, at the strength the separation actually needs. */
  structure: 'rgba(126, 166, 186, 0.52)',
} as const;

/** The `sp-ink` ramp — blue-toned, not neutral grey. */
export const HUM_INK = {
  primary: '#e4eef4',
  secondary: '#9db3c0',
  tertiary: '#7f96a6',
  /*
    `label` is not decoration — it is the 10.5px mono metadata on every chip, note and
    micro line, which is exactly what R20's 4.5:1 rule names. `#64798a` measured 3.21-4.11:1
    at glyph pixels across the three backdrops this frame actually produces. `#849aab`
    clears 4.97:1 on the worst of them and still sits below `tertiary`, so the ramp keeps
    its order.
  */
  label: '#849aab',
  inverted: '#04161a',
} as const;

/*
 * THE LICENSED HUES — THE PRODUCT'S OWN `sp-*` SEMANTIC SET.
 *
 * The Tailwind config states the rule these obey, in its own words: "A hue may only carry
 * its assigned meaning" and "VISIBILITY IS BOUGHT WITH LUMINANCE, NEVER WITH A SEMANTIC
 * COLOUR." R20's legality line says the same thing for Part X. Same rule, one set of
 * values, so Humanitarian's cyan is the product's cyan.
 */
export const HUM_LICENSED = {
  /** sp-cyan — evidence, interaction, and the active band. */
  cyan: '#3ad6e6',
  cyanBright: '#7ee9f4',
  cyanOn: '#04161a',
  /** sp-amber — attention, change and monitoring. */
  amber: '#f2a93c',
  amberOn: '#1a1102',
  /** Watch. Mint stays Part X's, because the sp-* set has no Watch hue of its own. */
  mint: '#5ed8a9',
  /** The metered-compute control. */
  sand: '#d9c48f',
  /** The tier chip. */
  violet: '#ab93ed',
} as const;

/*
 * THE ACTIVE BAND — THE CONFIG'S OWN THREE-BAND RULE, NOT A TREATMENT I INVENTED.
 *
 * `tailwind.config.ts` already states it for interactive chrome, and the amendment it
 * records is exactly the finding here: v1.5 "left the controls on the PASSIVE text ramp,
 * which meant a working control and a disabled one were rendered at the same value and
 * the whole interaction layer read as decoration."
 *
 *     ACTIVE     sp-cyan on a cyan wash — the one thing in effect
 *     AVAILABLE  sp-ui-idle, brightening to sp-ui-hover on hover
 *     UNBUILT    sp-ui-off, no fill
 *
 * So the selected tab gets a CYAN WASH, a cyan top edge and cyan text; an available tab
 * gets `sp-ui-idle` #b4c8d4, which is far brighter than the label grey it had before —
 * the earlier version failed because inactive tabs were as quiet as disabled ones.
 */
export const HUM_NAV = {
  /*
    TWO LAYERS, NOT ONE. A wash alone left the switch strip's own gutter colour showing
    through the ACTIVE tab as well — measured, the active label sat on rgb(68,110,126) at
    3.93:1. Compositing the cyan over the panel fill puts it on rgb(18,45,57) at 10.17:1
    while keeping exactly the same cyan tint.
  */
  activeWash: 'linear-gradient(rgba(58, 214, 230, 0.10), rgba(58, 214, 230, 0.10)), rgba(12, 21, 28, 0.72)',
  activeEdge: '#3ad6e6',
  activeInk: '#7ee9f4',
  /*
    A REAL FILL, NOT `transparent`. The switch strip paints `HUM_LINE.structure` and relies
    on a 1px gap to draw the rules between tabs — so a transparent tab let that line colour
    flood the WHOLE tab. Measured at glyph pixels, an inactive label was sitting on
    rgb(70,98,117) at 3.72:1. With the panel fill restored the gutter is 1px again and the
    same label measures over 10:1.
  */
  inactiveFill: 'rgba(12, 21, 28, 0.72)',
  /** sp-ui-idle — AVAILABLE, not passive. */
  inactiveInk: '#b4c8d4',
  hoverInk: '#e4eef4',
} as const;

/**
 * SECTION HEADINGS — the product's own eyebrow, not bold white text.
 *
 * The homepage marks a section with a small cyan dot and a cyan mono eyebrow
 * (`IntelligenceModulesDesktop`: a `bg-cyan-400` dot beside `text-cyan-400` mono). That
 * is the released treatment for "this is a region", and it is what gives a heading
 * presence without shouting. Reused here rather than inventing a fourth heading style.
 */
export const HUM_HEADING = {
  markerPx: 6,
  primaryInk: '#7ee9f4',
  secondaryInk: '#9db3c0',
  /*
    R20: "Secondary and mono metadata at or above 4.5:1 against its own surface." Notes are
    10.5px mono metadata, so they are exactly what that rule covers. `#64798a` measured
    3.21:1 at glyph pixels against the panel over the radial field — a real failure, and one
    a token-only check would have missed because the backdrop is a gradient, not a flat fill.
    `#8ba3b4` measures 5.53:1 there and stays a step below `secondaryInk`, so the ladder is
    unchanged: the notes got legible, not louder than the heading they qualify.
  */
  noteInk: '#8ba3b4',
} as const;

export const HUM_SANS = "var(--ar-family, 'IBM Plex Sans', Helvetica, sans-serif)";
export const HUM_MONO = "var(--ar-family, 'IBM Plex Mono', monospace)";

/** R14 type floor, as the values components actually use. */
export const HUM_TYPE = {
  monoMeta: 'max(var(--ar-fs-min, 0px), 10.5px)',
  body: 'max(var(--ar-fs-min, 0px), 12.5px)',
  bodyLarge: 'max(var(--ar-fs-min, 0px), 14px)',
  statement: 'max(var(--ar-fs-min, 0px), 20px)',
  title: 'max(var(--ar-fs-min, 0px), 19px)',
} as const;

/** Arabic run policy is the accepted shared one. Humanitarian authors none of its own. */
export const humTracking = (em: number): string => `calc(${em}em * var(--ar-ls-mul, 1))`;
