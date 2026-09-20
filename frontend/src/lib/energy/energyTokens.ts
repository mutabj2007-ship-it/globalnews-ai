/**
 * ════════════════════════════════════════════════════════════════════════════
 * PART XI ENERGY — FROZEN TOKEN PLACEHOLDERS, CARRIED UNCHANGED
 * ════════════════════════════════════════════════════════════════════════════
 *
 * AUTHORITY
 *   `GlobalNewsAI Part XI - Energy Intelligence v1.0 Review.zip`
 *   sha256 fa61230008e73dd22e1f70a6c6c1229fd26339e3a36d65cfa94d904314106b28
 *   per-file digests pinned in MAIN-ENERGY-PARTXI-RECONCILIATION-R1/authority.
 *   DESIGN FROZEN · CTO ACCEPTED.
 *
 * ── WHY RAW VALUES AND NOT THE EXISTING TAILWIND TOKENS ───────────────────
 *
 * M02 is OPEN and Main ruled it explicitly:
 *
 *   "no canonical token registry exists to supply … until it exists H
 *    implements Part XI's contract-derived placeholders UNCHANGED and does
 *    not re-derive them."
 *
 * The existing surface family is a DIFFERENT palette — `void` is `#080b12`,
 * Part XI's substrate floor is `#05090F`. Mapping one onto the other would be
 * re-deriving exactly what M02 forbids, and would silently change a frozen
 * design. So the frozen values live here, in ONE module, unchanged, and this
 * file is the single seam the canonical registry will later be mapped onto.
 *
 * ── THE COLOUR CONTRACT IS SEMANTIC, NOT DECORATIVE ───────────────────────
 *
 * Carried verbatim from the package README §5 and enforced by `energyFrame`:
 *
 *   CYAN        evidence, selection, selected spatial state
 *   MINT        active Watch — AND NOTHING ELSE
 *   AMBER       material change, attention, unresolved developing condition
 *   RED         reserved; ABSENT BY DEFAULT; only on validated CRITICAL
 *               consequence under inherited severity authority
 *   VIOLET      entitlement / capability boundary — AND NOTHING ELSE
 *   SAND        deliberate metered compute — AND NOTHING ELSE
 *   ACHROMATIC  confidence, data tier, general status, market direction, and
 *               ALL quiet/absent states except the licensed boundary
 *
 * A green "normal operations" is unrepresentable: there is no such token, and
 * `energyFrame.spec.ts` asserts that no green outside MINT enters this file.
 */

/** Substrate family — one family, four surfaces (design QA: "token consistency"). */
export const ENERGY_SURFACE = {
  /** The ground beneath every region. */
  void: '#05090F',
  /** Lens body. */
  raised: '#080E17',
  /** Shell chrome: context bar, rail, right region, sheet. */
  chrome: '#0A121C',
  /** Substrate slot ground, behind the map and the Sankey. */
  substrate: '#070D16',
} as const;

/** Inks. The metadata floor is 10px at `#8195AA` or lighter — see ENERGY_TYPE. */
export const ENERGY_INK = {
  primary: '#E8F0F8',
  secondary: '#A9BCCF',
  body: '#C7D6E4',
  meta: '#8195AA',
  quiet: '#8DA2B8',
  dim: '#7D92A8',
  rule: '#3C5268',
} as const;

/** Semantic hues. Each one means exactly one thing; see the header. */
export const ENERGY_SEMANTIC = {
  cyan: '#3FD0E8',
  mint: '#5BE3A8',
  amber: '#E8A33D',
  red: '#E2503C',
  violet: '#9B7BE8',
  sand: '#D8C08A',
  achromatic: '#8DA2B8',
} as const;

/** Line treatments that pair with each hue, carried from the frozen runtime. */
export const ENERGY_LINE = {
  cyan: 'rgba(63,208,232,.4)',
  mint: 'rgba(91,227,168,.4)',
  amber: 'rgba(232,163,61,.45)',
  red: 'rgba(226,80,60,.45)',
  violet: 'rgba(155,123,232,.45)',
  achromatic: 'rgba(141,162,184,.32)',
  sand: 'rgba(216,192,138,.45)',
  /** The one border treatment (design QA: "one border treatment"). */
  hairline: 'rgba(120,160,200,.14)',
  hairlineSoft: 'rgba(120,160,200,.1)',
  hairlineFaint: 'rgba(120,160,200,.08)',
  panel: 'rgba(120,160,200,.2)',
  chip: 'rgba(141,162,184,.28)',
} as const;

/**
 * Typography. ONE pairing pending the canonical registry, and the metadata
 * floor is a hard 10px across every frozen runtime surface — design QA marks
 * it PASS on that condition, so it is not a suggestion.
 */
export const ENERGY_TYPE = {
  sans: "'IBM Plex Sans', system-ui, sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, monospace",
  /** The floor. Nothing in Part XI renders text below this size. */
  metadataFloorPx: 10,
  lensHeadlinePx: 26,
} as const;

/** Two radii, one spacing rhythm — design QA "token consistency". */
export const ENERGY_RADIUS = { chip: '2px', panel: '3px', card: '4px' } as const;

/**
 * Geometry the state board proves live, and the thresholds it reflows at.
 * These are measurements of the frozen design, not choices made here.
 */
export const ENERGY_LAYOUT = {
  /** Below this the shell recomposes to the compact sheet architecture. */
  compactMaxWidth: 700,
  /** Below this the top bar reflows to short labels. */
  reflowWidth: 1180,
  /** Below this the Sand and tier chips abbreviate. */
  abbreviateWidth: 980,
  /** Below this MAP width the layers panel collapses to a chip. */
  layersChipMapWidth: 900,
  contextBarHeight: 54,
  compactBarHeight: 50,
  railWidth: 172,
  rightRegionWidth: 372,
  rightRegionWidthWithSubject: 380,
  /** H04 — 60px rows, 28 columns, 22px band height. */
  changeRowHeight: 60,
  changeBandHeight: 22,
  changeColumnsWide: 28,
  changeColumnsNarrow: 14,
  /** H05 — three sheet stages. */
  sheetPeekPx: 128,
  sheetHalfPct: '46%',
  sheetFull: 'calc(100% - 96px)',
  tabBarHeight: 58,
  /** Every actionable row and control; Watch/Ask/evidence are 46. */
  touchTargetMin: 44,
  touchTargetControl: 46,
} as const;

/** R13 motion, in milliseconds. Every one of these is defeated by reduced motion. */
export const ENERGY_MOTION = {
  flowDashCycleMsMin: 6000,
  flowDashCycleMsMax: 9000,
  ribbonReseatMs: 400,
  watchTransitionMs: 240,
  lensEntryMs: 240,
  sheetStageMs: 220,
} as const;

/**
 * ════════════════════════════════════════════════════════════════════════════
 * §E — THE ARABIC-SCRIPT OVERRIDE. A TOKEN, NOT A REDESIGN.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Authority: `MAIN-ENERGY-PARTXI-E1-L-CLOSEOUT-R2/contracts/RTL-TYPOGRAPHY.md`,
 * on an explicit CTO ruling, scoped to one script.
 *
 * ── THE COLLISION L MEASURED ──────────────────────────────────────────────
 *
 *   Part XI, frozen        metadata floor 10px, letter-spacing .06em–.2em
 *                          (95 letter-spacing declarations in the frozen file)
 *   Accepted AR policy     11px floor, tracking NEUTRALISED at the run boundary
 *
 * Neither authority is wrong. Part XI's floor is correct for a Latin metadata
 * system; the Arabic policy neutralises tracking rather than reducing it
 * **because Arabic letterforms join** — space between every character
 * disconnects a cursive script. They collide only where an Arabic string enters
 * a Part XI mono metadata slot.
 *
 * ── WHY A TOKEN AND NOT A COMPONENT BRANCH ────────────────────────────────
 *
 * *"A component that branched on locale would have to be re-branched by every
 * surface that reuses it, and the branch would be forgotten exactly once."* A
 * token is read by whatever renders, and the override is declared in one place
 * a reviewer can find. No composition, no geometry and no frozen Latin
 * treatment changes: **EN, PL and every other Latin-script locale render
 * exactly as the frozen file specifies. Not one pixel moves for them.**
 *
 * ── THE COST, MEASURED, AND IT IS NOT ZERO ────────────────────────────────
 *
 * Main's first draft claimed the override costs no horizontal room. Its own
 * control M-7 failed:
 *
 *                     Latin 10px+.1em   Arabic 11px+tracking 0
 *   row.scope 118px       16 chars            17 chars     NO LOSS
 *   row.state 190px       27 chars            28 chars     NO LOSS
 *   row.meta  190px       31 chars            28 chars     LOSS of 3
 *
 * The two TRACKED slots gain a character — the tracking removed pays for the
 * point of size added. `row.meta` carries no tracking, so it has none to give
 * back and loses three, on the column L already measured overflowing in Polish.
 * That is why `energyOverflow.ts` is mandatory rather than defensive.
 *
 * ── WHAT IS NOT CLAIMED ───────────────────────────────────────────────────
 *
 * **Arabic fit is UNMEASURED.** The arithmetic above is a Latin monospace
 * advance model; Arabic joins, and character count is not a width model for it.
 * AR remains future locale work, this override activates nothing, and AR
 * activation must re-run the fit measurement and have L read the result.
 */
export const ENERGY_SCRIPT_TOKEN_CSS = `
:root {
  --ene-meta-fs: ${ENERGY_TYPE.metadataFloorPx}px;
  --ene-meta-ls: .12em;
}
:root:lang(ar), [lang|="ar"] {
  --ene-meta-fs: 11px;
  --ene-meta-ls: 0;
}
`;

/** The Arabic floor, named so a guard asserts against it rather than a literal. */
export const ENERGY_ARABIC_METADATA_FLOOR_PX = 11;
