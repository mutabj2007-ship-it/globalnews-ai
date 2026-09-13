/**
 * SPATIAL M2 — THE DESIGN PROTOTYPE'S OWN RENDER VALUES, EXTRACTED VERBATIM.
 *
 * CTO ruling, 2026-09-01: "DO NOT ESTIMATE THE COLORS. You already extracted
 * the actual Claude Design prototype stylesheet. Therefore do not approximate
 * watched geography as 'roughly amber/cyan at 75%'."
 *
 * Every value below is copied from the authoritative prototype
 * (`02 Interactive Prototype.html`, revision 1.2), from the two places that
 * actually paint the map:
 *
 *   ITS CANVAS DRAW LOOP  — country fill, stroke and line width per state, the
 *                           monitored-edge pass, borders, coast, graticule.
 *   ITS STYLESHEET        — `.mk`, `.mk .core`, `.mk .ring`, `.halo`, and the
 *                           `@keyframes pulse` block.
 *
 * NOTHING HERE IS DERIVED, ROUNDED OR HARMONISED. Where a value looked like a
 * near-duplicate of one already in `colourGrammar.ts` it was still copied
 * exactly — the amber country fill is .13 and the cyan is .12, and making them
 * equal because the difference is invisible would be the estimation the ruling
 * forbids.
 *
 * ── THE SINGLE MOST IMPORTANT LINE IN THE EXTRACTION ──────────────────────
 *
 * The prototype's watch branch is one statement:
 *
 *     if (S.layers.watch && e && e.watched) { stroke = stroke || 'rgba(242,169,60,.5)'; }
 *
 * A STROKE, AND ONLY IF NOTHING ELSE ALREADY STROKED IT. There is no watched
 * fill in the Design reference at all. The implementation this ruling reviewed
 * had `fill-opacity: 0.14` amber over every watched country, which is why it
 * "dominates the basemap" — it is not a heavier version of Design's treatment,
 * it is a layer Design does not have.
 *
 * ── AND WHAT THE ANIMATION ACTUALLY MEANS ─────────────────────────────────
 *
 * The ruling asks not to infer it. It does not have to be inferred; Part I §E
 * states it and the stylesheet confirms it:
 *
 *   "Four motions are permitted, each bound to a meaning: A 3.2 S EVIDENCE
 *    RIPPLE ON ACTIVE RECORDS; a one-shot cyan flash on newly loaded evidence;
 *    A SOFT AMBER EDGE GLOW ON MONITORED GEOGRAPHY; and camera flights on
 *    focus, search and reset. ... There is no radar sweep, no blinking, no idle
 *    animation."
 *
 * So, precisely:
 *
 *   THE PULSE IS EVIDENCE, NOT MONITORING. `.mk .ring` carries
 *   `animation: pulse 3.2s ease-out infinite` and belongs to the evidence
 *   marker. It marks an ACTIVE RECORD.
 *
 *   MONITORING IS A GLOW, AND IT IS STATIC. The watched pass is
 *   `shadowColor: rgba(242,169,60,.75); shadowBlur: 12` around a 1.1 px stroke.
 *   No keyframes, no timer, nothing that changes over time.
 *
 *   UNCERTAINTY DOES NOT PULSE. `.mk.unk .ring { display: none }` — an
 *   interpreted, contested or unresolved record has no ring at all, which is
 *   the same sentence Part I §G writes as "hollow, dashed, grey, NO PULSE".
 *
 * There is therefore no "live monitoring" animation to implement, and none is
 * invented here.
 */

/* ════════════════════════════════════════════════════════════════════════════
   1 · REFERENCE GEOGRAPHY — the prototype's `C` constant block
   ════════════════════════════════════════════════════════════════════════════ */

/**
 * DESIGN v1.5 — MAP CLARITY / LUMINANCE.
 *
 * The first build put ocean, land, borders and coastline inside about four
 * luminance steps at the bottom of the range. The values were individually
 * defensible and collectively unreadable: readers could see the intelligence
 * and not the world it sat in.
 *
 * The revision DEEPENS THE BACKGROUND ONE STEP to buy headroom and RAISES
 * everything above it, so the reference band widens rather than slides. The
 * coastline moves furthest — #243440 to #55707f — because the land/water edge
 * is the line that tells a reader where they are, and it was effectively
 * absent.
 *
 * CYAN AND AMBER ARE UNTOUCHED, on purpose. Widening the reference range makes
 * the evidence values read as MORE distinct, not less: the floor rises while
 * the gap between reference and evidence is preserved. Nothing here moves
 * toward a light theme — the brightest value below is a mid-slate coastline and
 * the background got darker.
 */
export const DESIGN_REFERENCE = {
  ocean: '#040a10',
  land: '#1e2b36',
  /** Coastline. Distinct from `border` in the reference, and kept distinct. */
  landEdge: '#55707f',
  /** Admin-0 boundaries, internal and international. */
  border: '#3d5563',
  water: '#0d2530',
  waterEdge: '#164a5c',
  river: '#154251',
  /* v1.5: 5% to 7.5% — the graticule was below the noise floor of the old land. */
  graticule: 'rgba(126,166,186,.075)',
} as const;

/**
 * The hover treatment for inactive reference geography, which v1.5 states as a
 * pair rather than as a single fill: a country under the pointer is lifted by
 * BOTH a wash and a brighter outline, because at these luminances a fill change
 * alone is below the threshold that reads as a response.
 */
export const DESIGN_REFERENCE_HOVER = {
  fill: 'rgba(150,190,208,.13)',
  stroke: 'rgba(186,220,233,.8)',
} as const;

/**
 * Reference line widths, which the prototype ramps with zoom rather than
 * fixing.
 *
 * `Math.min(cap, base + k * perZoom)` where `k` is its d3 zoom scale. The
 * MapLibre equivalent is an interpolation over the same range, and the ramp is
 * kept because a fixed hairline reads as a different map at Z2 and Z9.
 */
export const DESIGN_REFERENCE_WIDTH = {
  coast: { base: 0.7, perZoom: 0.02, cap: 1.4 },
  border: { base: 0.55, perZoom: 0.015, cap: 1.2 },
  graticule: { base: 0.6, perZoom: 0, cap: 0.6 },
} as const;

/* ════════════════════════════════════════════════════════════════════════════
   1b · REFERENCE LABELS — the prototype's own `.lbl` rules
   ════════════════════════════════════════════════════════════════════════════ */

/**
 * C907 §5 — THE LABEL BAND, MOVED OUT OF THE COMPONENT AND ONTO THE AUTHORITY.
 *
 * WHAT WAS WRONG. `EvidenceMapCanvas` carried its label colours as hex
 * literals in JSX, so they never saw the v1.5 luminance revision that this
 * module's geography block did receive. Measured against v1.5's own token
 * table, every one of them was the value v1.5 REPLACED:
 *
 *     ROLE                 v1.5 WAS                 v1.5 IS       C906 drew
 *     major / country      #A8BCC8                  #CFE0EA       #a8bcc8
 *     continent            rgba(139,161,174,.55)    rgba(167,192,206,.62)
 *                                                                 rgba(139,161,174,.55)
 *     water                #4B7F92                  #5F97AB       #4b7f92
 *     secondary / city     #94A8B4                  #A8BDC9       #93a7b4
 *     river                #3F6A7C                  #4D7D90       (water ink)
 *     capital              #C3D3DC                  #DCEAF1       not implemented
 *     shadow               two soft glows           3 px drop + 8 px halo
 *                                                                 two soft glows
 *
 * Three exact matches to the WAS column is not coincidence: the revision was
 * applied to the tokens and not to the labels, because the labels did not read
 * the tokens. That is the whole answer to "why do supposedly correct tokens
 * produce a visually wrong map", and it is why these values live here now.
 *
 * ── PROVENANCE ──────────────────────────────────────────────────────────────
 *
 * Every value below is quoted from the prototype stylesheet's own `.lbl`
 * rules — the same stylesheet §2 and §3 of this file were extracted from —
 * and each agrees with the v1.5 change log's IS column independently:
 *
 *     .lbl           text-shadow:0 1px 3px #030709,0 0 8px #030709,
 *                                0 0 16px rgba(3,7,9,.9)
 *     .lbl.country   font-size:11px    color:#cfe0ea  letter-spacing:.16em
 *     .lbl.continent font-size:13.5px  color:rgba(167,192,206,.62)  .42em
 *     .lbl.water     font-size:9.5px   color:#5f97ab  italic  .2em
 *     .lbl.city      font-size:9.5px   color:#a8bdc9  .08em
 *     .lbl.capital   color:#dceaf1
 *     .lbl.ev        font-size:9.5px   color:var(--cyan)  .14em
 *     .lbl.river     font-size:8.5px   color:#4d7d90  italic  .18em
 *
 * THE SHADOW IS THE THREE-PART RULE, NOT A SUMMARY OF IT. v1.5 describes it
 * as "a 3 px drop plus an 8 px halo"; the stylesheet carries a third, wider
 * `0 0 16px` pass at reduced alpha. Both are copied, because the description
 * is a description and the rule is the rule.
 *
 * A LAKE HAS NO RULE OF ITS OWN in the prototype, and none is invented here:
 * C906's accepted decision — water ink for every water label, one step
 * smaller — is preserved, now at the v1.5 water value.
 */
export const DESIGN_LABEL = {
  country: { colour: '#cfe0ea', size: 11, tracking: 0.16 },
  /** Distinct from `country` in the reference, and kept distinct. */
  capital: { colour: '#dceaf1', size: 11, tracking: 0.16 },
  continent: { colour: 'rgba(167,192,206,.62)', size: 13.5, tracking: 0.42 },
  water: { colour: '#5f97ab', size: 9.5, tracking: 0.2 },
  /* C906's lake treatment, unchanged in rule, corrected in value. */
  lake: { colour: '#5f97ab', size: 9, tracking: 0.18 },
  river: { colour: '#4d7d90', size: 8.5, tracking: 0.18 },
  city: { colour: '#a8bdc9', size: 9.5, tracking: 0.08 },
  evidence: { colour: '#3ad6e6', size: 9.5, tracking: 0.14 },
  /**
   * `0 1px 3px` is the drop, `0 0 8px` the halo, `0 0 16px` the wider falloff.
   * Replaces C906's `0 0 6px #05090d, 0 0 12px #05090d`, which is the
   * pre-revision "two soft glows" v1.5 names and tightens.
   */
  shadow: '0 1px 3px #030709, 0 0 8px #030709, 0 0 16px rgba(3,7,9,.9)',
} as const;

/* ════════════════════════════════════════════════════════════════════════════
   2 · COUNTRY STATES — the prototype's per-country draw branch
   ════════════════════════════════════════════════════════════════════════════ */

export interface CountryStatePaint {
  readonly fill: string | null;
  readonly stroke: string | null;
  readonly lineWidth: number;
}

export const DESIGN_COUNTRY_STATE = {
  /** Evidence, cyan tone. `fill = rgba(58,214,230,.12)`, `stroke = ...,.5`. */
  evidenceVerified: {
    fill: 'rgba(58,214,230,.12)',
    stroke: 'rgba(58,214,230,.5)',
    lineWidth: 1,
  },
  /** Evidence, amber tone. NOTE .13 and .55 — NOT the cyan values. */
  evidenceAttention: {
    fill: 'rgba(242,169,60,.13)',
    stroke: 'rgba(242,169,60,.55)',
    lineWidth: 1,
  },
  /** Evidence, unknown tone. */
  evidenceUnknown: {
    fill: 'rgba(74,91,103,.14)',
    stroke: 'rgba(74,91,103,.6)',
    lineWidth: 1,
  },
  /** `precision === 'NONE'` in EVIDENCE mode — looked at, nothing retained. */
  noEvidence: {
    fill: 'rgba(74,91,103,.07)',
    stroke: 'rgba(74,91,103,.35)',
    lineWidth: 1,
  },
  /**
   * WATCHED. A STROKE ONLY, AND NO FILL.
   *
   * The prototype's `stroke = stroke || 'rgba(242,169,60,.5)'` also means it
   * DEFERS: a watched country that already carries an evidence stroke keeps the
   * evidence stroke. Monitoring never overrides what the evidence says.
   */
  watched: {
    fill: null,
    stroke: 'rgba(242,169,60,.5)',
    lineWidth: 1,
  },
  /** Hover. SLATE, not cyan — reference ink, so hover cannot read as evidence. */
  hover: {
    fill: 'rgba(126,166,186,.07)',
    stroke: 'rgba(160,200,215,.7)',
    lineWidth: 1,
  },
  /** Selected, cyan tone. */
  selected: {
    fill: 'rgba(58,214,230,.18)',
    stroke: '#8ef0fa',
    lineWidth: 1.6,
  },
  /** Selected, amber tone. */
  selectedAttention: {
    fill: 'rgba(242,169,60,.2)',
    stroke: '#8ef0fa',
    lineWidth: 1.6,
  },
} as const satisfies Readonly<Record<string, CountryStatePaint>>;

/**
 * THE MONITORED EDGE ILLUMINATION — a SECOND pass in the prototype, after every
 * country state has been drawn.
 *
 *     ctx.shadowColor = 'rgba(242,169,60,.75)';
 *     ctx.shadowBlur  = 12;
 *     ctx.strokeStyle = 'rgba(242,169,60,.55)';
 *     ctx.lineWidth   = 1.1;
 *
 * Part I §E's "soft amber edge glow on monitored geography". STATIC.
 */
export const DESIGN_WATCH_GLOW = {
  shadowColor: 'rgba(242,169,60,.75)',
  shadowBlur: 12,
  stroke: 'rgba(242,169,60,.55)',
  lineWidth: 1.1,
} as const;

/* ════════════════════════════════════════════════════════════════════════════
   3 · EVIDENCE MARKERS — the prototype's `.mk` rules
   ════════════════════════════════════════════════════════════════════════════ */

export const DESIGN_MARKER = {
  /** `.mk .core { width:9px; height:9px }` — a 4.5 px radius. */
  coreDiameter: 9,
  coreCyan: '#3ad6e6',
  coreAmber: '#f2a93c',
  /** `box-shadow: 0 0 12px rgba(58,214,230,.8)`. */
  glowCyan: { blur: 12, colour: 'rgba(58,214,230,.8)' },
  /** `.mk.amber .core { box-shadow: 0 0 12px rgba(242,169,60,.7) }`. NOT .8. */
  glowAmber: { blur: 12, colour: 'rgba(242,169,60,.7)' },
  /**
   * `.mk.unk .core` — no background, `1px dashed var(--muted)`, NO SHADOW, and
   * 11 px rather than 9. Uncertainty is bigger and emptier, not dimmer.
   */
  unknownDiameter: 11,
  unknownStroke: '#4a5b67',
  /** `.mk.sel .core { outline: 1px solid #fff; outline-offset: 3px }`. */
  selectedOutline: { colour: '#ffffff', width: 1, offset: 3 },
} as const;

/**
 * THE 3.2 s EVIDENCE RIPPLE.
 *
 *   .mk .ring { border: 1px solid rgba(58,214,230,.5); width: 26px; height: 26px;
 *               animation: pulse 3.2s ease-out infinite }
 *   .mk.amber .ring { border-color: rgba(242,169,60,.45) }
 *   .mk.unk   .ring { display: none }
 *   @keyframes pulse { 0%   { transform: scale(.5);  opacity: .9 }
 *                      70%  { opacity: 0 }
 *                      100% { transform: scale(1.9); opacity: 0 } }
 */
export const DESIGN_RIPPLE = {
  diameter: 26,
  strokeCyan: 'rgba(58,214,230,.5)',
  strokeAmber: 'rgba(242,169,60,.45)',
  strokeWidth: 1,
  durationMs: 3200,
  easing: 'ease-out',
  iteration: 'infinite',
  from: { scale: 0.5, opacity: 0.9 },
  fadeAt: 0.7,
  to: { scale: 1.9, opacity: 0 },
  /** `.mk.unk .ring { display: none }` — interpreted and contested never pulse. */
  suppressedFor: ['interpreted', 'none'] as const,
} as const;

/**
 * THE PRECISION HALO — `.halo`.
 *
 *   border: 1px dashed rgba(58,214,230,.35);
 *   background: radial-gradient(circle, rgba(58,214,230,.07), transparent 70%)
 *   .halo.amber { border-color: rgba(242,169,60,.3);
 *                 background: radial-gradient(circle, rgba(242,169,60,.06), ...) }
 */
export const DESIGN_HALO = {
  strokeCyan: 'rgba(58,214,230,.35)',
  strokeAmber: 'rgba(242,169,60,.3)',
  strokeWidth: 1,
  dashed: true,
  fillOpacityCyan: 0.07,
  fillOpacityAmber: 0.06,
  /** The gradient's transparent stop. A soft edge, not a disc. */
  gradientStop: 0.7,
} as const;

/**
 * The numeric opacities the two above express as `rgba(...)` strings, for the
 * MapLibre paint properties that take a colour and an opacity separately.
 *
 * PARSED FROM THE STRINGS ABOVE RATHER THAN RETYPED, so the two can never
 * disagree — a second hand-written 0.12 is a second place for a value to drift.
 */
export function rgbaParts(value: string): { readonly colour: string; readonly opacity: number } {
  const match = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\.?\d*\.?\d+)\s*\)$/.exec(value);

  if (match === null) return { colour: value, opacity: 1 };

  const [, r, g, b, a] = match;
  const hex = (n: string): string => Number(n).toString(16).padStart(2, '0');

  return { colour: `#${hex(r)}${hex(g)}${hex(b)}`, opacity: Number(a) };
}
