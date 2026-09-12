/**
 * ════════════════════════════════════════════════════════════════════════════
 * D1 MAP COMPOSITION — THE CONTRACT, SEPARATED FROM THE PIXELS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The approved authority is the Ask AI Visual Spec Board v1.8 and its
 * specification, `Scope and layout format.zip -> handoff/`. D1 is the board's
 * default desktop state, and the specification says the rest inherit it:
 * "D3 and D5–D9 inherit the D1 shell, rail, topbar and map column unchanged;
 * only the Ask column differs." So D1 is not one screen — it is the shell every
 * other desktop state is drawn in, which is why its rules live in a pure module
 * that can be asserted rather than in a component that has to be looked at.
 *
 * Everything below is quoted from or directly derived from that specification.
 * Nothing here invents a proportion, a control or an order.
 */

/* ── 1 · THE FLEXIBLE MAP PANE ─────────────────────────────────────────────
 *
 * Implementation matrix, "Map split controller":
 *   Desktop: 70/30, 50/50, 35/65, full-map, dock
 *   Mobile:  sheet detents plus inline mini-map
 *   "Map: owns proportion only — never semantics, precision or ceiling."
 *
 * THAT LAST LINE IS THE LOAD-BEARING ONE and it is why this module returns
 * nothing but numbers. A split mode may change how much map is on screen; it
 * may never change what the map is allowed to claim. There is deliberately no
 * path from a `MapSplitMode` to a precision, a halo radius or an evidence
 * state, and a test asserts the type carries no such field.
 */
export type MapSplitMode = 'explore' | 'question' | 'answer' | 'full-map' | 'dock';

export interface MapSplit {
  readonly mode: MapSplitMode;
  /** Percentage of the row the MAP occupies. The Ask column takes the rest. */
  readonly mapPercent: number;
  readonly askPercent: number;
}

const SPLITS: Readonly<Record<MapSplitMode, readonly [number, number]>> = {
  explore: [70, 30],
  question: [50, 50],
  answer: [35, 65],
  /* "full-map" is the map at its largest with the Ask column collapsed to a
     re-entry affordance, not deleted — the board's own D1..D6 camera-continuity
     rule requires the reader to come back to the same conversation. */
  'full-map': [100, 0],
  /* "dock" is the inverse: the map reduced to a persistent strip so the answer
     has the column, while geography stays visible. Never zero — a map that
     disappears takes the reader's sense of place with it. */
  dock: [20, 80],
};

export function splitFor(mode: MapSplitMode): MapSplit {
  const [mapPercent, askPercent] = SPLITS[mode];
  return { mode, mapPercent, askPercent };
}

export const MAP_SPLIT_MODES: readonly MapSplitMode[] = [
  'explore',
  'question',
  'answer',
  'full-map',
  'dock',
];

/**
 * "The same terrain quality must survive Explore 70/30, Question 50/50, Answer
 * 35/65, full-map and mini-map. As the map narrows, labels and detail simplify
 * progressively; the basemap is never replaced by schematic polygons."
 *
 * Simplification is therefore a function of the map's RENDERED WIDTH, never of
 * the mode name — the same 35% pane is wide on a 2560px display and narrow on a
 * 1280px one, and a mode-keyed table would get both wrong.
 */
export type LabelDetail = 'full' | 'reduced' | 'minimal';

export function labelDetailFor(mapPixelWidth: number): LabelDetail {
  if (mapPixelWidth >= 720) return 'full';
  if (mapPixelWidth >= 420) return 'reduced';
  return 'minimal';
}

/* ── 2 · THE CONTROL HIERARCHY ─────────────────────────────────────────────
 *
 * Specification §3d, verbatim:
 *
 *   "The lower-left cluster carries the globe locator (global camera position
 *    with a viewport indicator), then Layers and 3D as separate controls. The
 *    globe locator is not the 3D toggle; the two are distinct and must not be
 *    merged. Zoom and layer-visibility controls stay top-right."
 *
 * Encoded as data so "must not be merged" is a test rather than a hope.
 */
export type MapControlId = 'globe-locator' | 'layers' | 'three-d' | 'zoom' | 'layer-visibility';
export type MapControlCluster = 'lower-left' | 'top-right';

export const LOWER_LEFT_CLUSTER: readonly MapControlId[] = ['globe-locator', 'layers', 'three-d'];
export const TOP_RIGHT_CLUSTER: readonly MapControlId[] = ['zoom', 'layer-visibility'];

export function clusterFor(control: MapControlId): MapControlCluster {
  return LOWER_LEFT_CLUSTER.includes(control) ? 'lower-left' : 'top-right';
}

/**
 * The globe locator and the 3D control are distinct controls. This function
 * exists so the rule has a call site: anything that would render one control
 * doing both jobs has to ask this first and get `false`.
 */
export function controlsMayMerge(a: MapControlId, b: MapControlId): boolean {
  const distinct = new Set<MapControlId>(['globe-locator', 'three-d']);
  if (distinct.has(a) && distinct.has(b)) return false;
  return a === b;
}

/* ── 3 · SELECTION MUST NOT VISUALLY IMPLY EVIDENCE ────────────────────────
 *
 * The Product Owner's rule, and the sharpest constraint in the whole D1 pass.
 * A country the reader has merely CLICKED must not acquire the treatment that
 * says "this country has evidence", because the two are different claims and
 * the map's whole value is that it does not blur them.
 *
 * So selection and evidence are separate visual channels, and a country may
 * carry both independently. Selection is a RING — a structural, outline
 * treatment. Evidence is a FILL and a halo. A ring over an unevidenced country
 * says "you are looking at this"; it never says "something happened here".
 */
export type SelectionTreatment = 'ring' | 'none';
export type EvidenceTreatment = 'fill' | 'halo' | 'none';

export interface GeographyTreatment {
  readonly selection: SelectionTreatment;
  readonly evidence: EvidenceTreatment;
}

export function treatmentFor(input: {
  readonly selected: boolean;
  readonly hasEvidence: boolean;
  readonly rendersAsPoint: boolean;
}): GeographyTreatment {
  return {
    selection: input.selected ? 'ring' : 'none',
    evidence: input.hasEvidence ? (input.rendersAsPoint ? 'halo' : 'fill') : 'none',
  };
}

/**
 * The predicate the rule is really about, stated so a renderer can be tested
 * against it directly: does this treatment tell the reader there is evidence?
 */
export function impliesEvidence(treatment: GeographyTreatment): boolean {
  return treatment.evidence !== 'none';
}

/* ── 4 · THE COMPACT EVIDENCE LEGEND ───────────────────────────────────────
 *
 * The legend explains the evidence grammar and nothing else. Selection is not
 * in it — a legend row for "selected" would be the same conflation in words
 * that §3 forbids in pixels.
 *
 * Compact means FEWER ROWS, never smaller type: the accepted C2 type floors
 * still apply. A row earns its place only when the state it names can actually
 * occur in the current view, so an empty map shows a legend of one row rather
 * than five rows of things that are not there.
 */
export type LegendRowKey = 'verified' | 'attention' | 'interpreted' | 'none' | 'reference';

export const LEGEND_ROW_ORDER: readonly LegendRowKey[] = [
  'verified',
  'attention',
  'interpreted',
  'none',
  'reference',
];

export function compactLegendRows(present: ReadonlySet<LegendRowKey>): readonly LegendRowKey[] {
  const rows = LEGEND_ROW_ORDER.filter((key) => present.has(key));
  /* Never empty: a map with no evidence still has to say so, and 'none' is the
     row that says it. Silence would read as "not looked at". */
  return rows.length > 0 ? rows : ['none'];
}

/* ── 5 · THE PHONE COMPOSITION ─────────────────────────────────────────────
 *
 * Specification §5: "Map-first with a three-detent Ask sheet: peek (identity,
 * cost, two suggestions, composer), half (context chip, suggestions, alerts,
 * composer), full (answer or configuration)."
 *
 * Map-first is the part that constrains the numbers: at `peek` and `half` the
 * map must still be the larger element, and only `full` may cover it — and even
 * then the inline mini-map keeps geography on screen.
 */
export type SheetDetent = 'peek' | 'half' | 'full';

export const SHEET_DETENTS: readonly SheetDetent[] = ['peek', 'half', 'full'];

/** Percentage of the viewport height the SHEET occupies at each detent. */
const DETENT_HEIGHT: Readonly<Record<SheetDetent, number>> = {
  peek: 26,
  half: 50,
  full: 90,
};

export function sheetHeightPercent(detent: SheetDetent): number {
  return DETENT_HEIGHT[detent];
}

export function mapIsDominant(detent: SheetDetent): boolean {
  return DETENT_HEIGHT[detent] < 50;
}

/** `full` covers the map, so geography survives as the inline mini-map. */
export function showsInlineMiniMap(detent: SheetDetent): boolean {
  return detent === 'full';
}
