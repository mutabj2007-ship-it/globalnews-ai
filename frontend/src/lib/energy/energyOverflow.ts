import type { CSSProperties } from 'react';
import { ENERGY_LAYOUT } from '@/lib/energy/energyTokens';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * §F — GOVERNED METADATA OVERFLOW. THE GEOMETRY DOES NOT CHANGE.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Authority: `MAIN-ENERGY-PARTXI-E1-L-CLOSEOUT-R2/contracts/METADATA-OVERFLOW.md`,
 * from L's measurement of the frozen dense row.
 *
 * ── WHAT L MEASURED, AND WHY IT IS A ROW FAILURE RATHER THAN A CLIPPED WORD ─
 *
 * The frozen row is `height:60px; display:flex; align-items:center`. Four slots:
 *
 *   row.subject  236px  flex:none   overflow:hidden · text-overflow:ellipsis · white-space:nowrap
 *   row.scope    118px  flex:none   NONE
 *   row.state    190px  flex:none   NONE
 *   row.meta     190px  flex:none   NONE
 *
 * The ONE protected column is the proportional subject text. The three that
 * carry the machine-readable metadata — the ones a translator actually
 * lengthens — have none of the three declarations, so **they wrap**, and a
 * wrapped second line inside a fixed 60px row overflows the row box rather than
 * growing it. Because all three are `flex:none` the failure is unconditional:
 * 1280, 1512 and 1920 break identically.
 *
 * The 60px row is itself an accessibility commitment — *"dense grids keep 22px
 * band height and 60px row height so touch and low-vision reading both
 * survive."* **Protecting the row is protecting that.**
 *
 * ── WHAT THIS FILE DOES NOT DO ────────────────────────────────────────────
 *
 * It changes no width, no row height and no font size. 118 / 190 / 190 and 60px
 * stay exactly as the frozen file specifies. **Reducing the 10px floor to make
 * a translation fit is refused** — it is an accessibility rule, and L refused it
 * first.
 */

/** F-1 — the three declarations `row.subject` already had, extended to its siblings. */
export const ENERGY_METADATA_CLAMP: CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

/** The frozen column widths, unchanged, named so a guard can assert them. */
export const ENERGY_ROW_COLUMNS = {
  subject: 236,
  scope: 118,
  state: 190,
  meta: 190,
  height: ENERGY_LAYOUT.changeRowHeight,
} as const;

/**
 * F-4 — ELLIPSIS IS REFUSED WHERE A TRUNCATED PREFIX IS ITSELF A VALID LABEL.
 *
 * L's sharpest warning, made mechanical. `NIEDOSTĘPNE` is the natural Polish for
 * BOTH `UNAVAILABLE` (the violet entitlement state) and `NOT AVAILABLE` (the
 * tier that is never simulated). In English those are two different words; in
 * Polish they collapse. So `NIEDOSTĘPNE · LICENCJA` clipped at the column edge
 * reads as the bare tier label — the reader is shown **a different valid state,
 * not a shortened one**, which F-2 forbids.
 *
 * The negative control is what makes this a measurement rather than a blanket:
 * most labels do not collide, and a rule that flagged the whole vocabulary would
 * be measuring nothing.
 */
export function truncationCollides(label: string, vocabulary: readonly string[]): boolean {
  const others = vocabulary.filter((entry) => entry !== label);
  for (let cut = 1; cut < label.length; cut += 1) {
    const prefix = label.slice(0, cut).trimEnd();
    if (prefix.length === 0) continue;
    if (others.includes(prefix)) return true;
  }
  return false;
}

/**
 * The style for one metadata slot. A colliding label is NOT clamped — it is
 * allowed to overflow its box visibly rather than to truncate into a different
 * state's name, and L shortens it or Design gives it its own slot. That is the
 * contract's own disposition: *"It must be shortened by L to fit, or given its
 * own slot."* Rendering a wrong state is worse than rendering a wide one.
 */
export function metadataSlotStyle(label: string, vocabulary: readonly string[]): CSSProperties {
  return truncationCollides(label, vocabulary) ? { whiteSpace: 'nowrap' } : ENERGY_METADATA_CLAMP;
}

/**
 * F-3 — THE CAUSE ELEMENT DOES NOT SHRINK.
 *
 * *"No CSS rule can guarantee that while the state is one string."* Ellipsis
 * clips the tail, and the tail is where `CAUSE OPEN` lives — so the very rule
 * that protects the row would delete the half that carries the meaning, and
 * silently convert *"restored, cause unresolved"* into *"restored"*.
 *
 * Under the two-axis model it is not one string. The service token absorbs the
 * pressure and the cause token is rendered whole, because the fact lives in its
 * own box rather than because a developer remembered to be careful.
 */
/**
 * R3 — THIS IS NOW THE F-3 GEOMETRY, NOT THE RENDERED STYLE.
 *
 * `serviceAxisStyle` below is what the component renders with, because R3 makes
 * the ellipsis conditional on F-4′ rather than unconditional. This constant is
 * kept as the PERMITTED form the function returns when F-4′ passes — it is
 * spread by that function, so the two cannot drift, and the R2 contract it
 * states (the service absorbs the pressure, the cause does not) is still
 * assertable on its own.
 */
export const ENERGY_STATE_SERVICE_STYLE: CSSProperties = {
  flex: '1 1 auto',
  minWidth: 0,
  ...ENERGY_METADATA_CLAMP,
};

export const ENERGY_STATE_CAUSE_STYLE: CSSProperties = {
  /* Never shrinks, never truncates. This declaration is the guarantee. */
  flex: 'none',
};

/* ═══════════════════════════════════════════════════════════════════════════
 * R3 · F-4′ — ELLIPSIS ONLY WHERE THE VISIBLE PREFIX IS UNIQUE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Authority: `L-ENERGY-PARTXI-PL-FIT-R2` §4, offered to Main as a widening of
 * F-4 and ordered into the product by the R3 activation:
 *
 *   *"A text label may ellipsize only when its visible prefix uniquely
 *   distinguishes it from every governed sibling label."*
 *
 * ── WHY F-4 IS NOT ENOUGH ─────────────────────────────────────────────────
 *
 * `truncationCollides` above catches the case where a truncated prefix IS
 * itself a label — `NIEDOSTĘPNE · LICENCJA` clipping through to `NIEDOSTĘPNE`.
 * It cannot catch the case L measured, because there the shared prefix is not a
 * label at all:
 *
 *   ODNOTOWANO ZAKŁÓCENIE
 *   ODNOTOWANO WPŁYW NA DOSTAWY      shared prefix `ODNOTOWANO ` — 11 characters
 *
 * Clipped at the column edge both render `ODNOT…`, and the reader cannot tell
 * which state they are looking at. No member of the vocabulary was shown
 * wrongly; the READER was, which is the fact F-4 was written to prevent.
 *
 * So F-4′ asks a different question: **given the width this element can
 * actually fall to, does what remains still name one state?**
 */

/** The `row.state` advance model: 10px monospace with `.1em` tracking. */
export const ENERGY_STATE_PX_PER_CHAR = 7.0;

/** The gap between the service and cause elements, from the frozen row. */
export const ENERGY_STATE_AXIS_GAP_PX = 6;

/**
 * The longest prefix two members of a vocabulary share, in characters.
 *
 * Case- and space-sensitive on purpose: these are governed display labels, and
 * folding them would be measuring something the reader never sees.
 */
export function longestSharedPrefix(vocabulary: readonly string[]): number {
  let longest = 0;
  for (let a = 0; a < vocabulary.length; a += 1) {
    for (let b = a + 1; b < vocabulary.length; b += 1) {
      const left = vocabulary[a] ?? '';
      const right = vocabulary[b] ?? '';
      let shared = 0;
      while (shared < left.length && shared < right.length && left[shared] === right[shared]) {
        shared += 1;
      }
      if (shared > longest) longest = shared;
    }
  }
  return longest;
}

/**
 * How many visible characters a vocabulary needs before every member is
 * distinguishable from every other. One more than the longest shared prefix —
 * and 1 for a vocabulary that shares nothing, because a reader still needs to
 * see something.
 */
export function minimumUnambiguousPrefix(vocabulary: readonly string[]): number {
  return Math.max(1, longestSharedPrefix(vocabulary) + 1);
}

/**
 * The worst case available to the ellipsizing element: the column, less the
 * WIDEST non-shrinking sibling, less the gap. It is the widest sibling and not
 * the current one because `flex:none` means any row may carry it.
 */
export function worstCaseServicePx(
  causeVocabulary: readonly string[],
  columnPx: number = ENERGY_ROW_COLUMNS.state,
  pxPerChar: number = ENERGY_STATE_PX_PER_CHAR,
): number {
  const widest = causeVocabulary.reduce((max, label) => Math.max(max, label.length * pxPerChar), 0);
  return columnPx - widest - ENERGY_STATE_AXIS_GAP_PX;
}

/**
 * F-4′ · THE DECISION, MECHANICAL.
 *
 * `true` only when the minimum unambiguous prefix still fits the worst case.
 * A vocabulary that fails this is NOT given `text-overflow: ellipsis` — it
 * overflows its box visibly instead, exactly as a F-4 collision does, because
 * **a visibly wide label is a legible defect and an ambiguous one is not.**
 */
export function ellipsisPermitted(
  vocabulary: readonly string[],
  availablePx: number,
  pxPerChar: number = ENERGY_STATE_PX_PER_CHAR,
): boolean {
  return minimumUnambiguousPrefix(vocabulary) * pxPerChar <= availablePx;
}

/**
 * The service element's style, decided rather than declared.
 *
 * R2 exported `ENERGY_STATE_SERVICE_STYLE` as a constant, which states F-3 (the
 * cause never shrinks) but asserts F-4′ nowhere. This function is the same
 * geometry with the ellipsis made conditional on the measurement.
 */
export function serviceAxisStyle(
  serviceVocabulary: readonly string[],
  causeVocabulary: readonly string[],
): CSSProperties {
  return ellipsisPermitted(serviceVocabulary, worstCaseServicePx(causeVocabulary))
    ? { ...ENERGY_STATE_SERVICE_STYLE }
    : { flex: '1 1 auto', minWidth: 0, whiteSpace: 'nowrap' };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * R3 · `row.meta` — TWO ELEMENTS, ONE LINE, A PROTECTED NUMERAL
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Authority: `L-ENERGY-PARTXI-PL-FIT-R2/02-META-PRESENTATION.md`, ruling
 * `ENERGY META OVERFLOW = RESOLVED`.
 *
 * ── NUM-1 · A NUMERAL MAY NEVER BE ELLIPSIZED ─────────────────────────────
 *
 * *"A clipped word is a shortened value a reader can recognise as shortened. A
 * clipped numeral is a different valid numeral."* `22 przejrzane` clipped to
 * `2…` reads as two; `1000` clipped to `10…` reads as ten. Nothing in the
 * rendering says a digit is missing.
 *
 * This is F-4 in numeric form and it is unconditional: **every prefix of a
 * numeral is a valid numeral**, so a numeric element fails F-4 for every
 * vocabulary and can never be made ellipsis-safe by choosing better words.
 *
 * ── WHY THE PRIORITY IS LOGICAL AND NEVER LEFT/RIGHT ──────────────────────
 *
 * `text-overflow: ellipsis` clips the LOGICAL end, which flips under
 * `dir="rtl"`. A left/right spelling is correct today and silently inverts the
 * protection in an RTL locale — which would put the ellipsis on the numeral,
 * the one thing NUM-1 forbids. So the rule is stated as *the first segment
 * shrinks, the last segment is `flex:none`*, and the styles below use no
 * physical direction at all.
 */

/** The recency element. Shrinks and may ellipsize — its prefix is unambiguous. */
export const ENERGY_META_RECENCY_STYLE: CSSProperties = {
  flex: '1 1 auto',
  minWidth: 0,
  ...ENERGY_METADATA_CLAMP,
};

/**
 * The evidence element: the count and its noun, as ONE element.
 *
 * `flex:none` and — deliberately — no `textOverflow`. The noun can only clip by
 * clipping the whole element, which `flex:none` prevents, so the numeral is
 * protected by the same mechanism that protects the cause axis under F-3.
 */
export const ENERGY_META_COUNT_STYLE: CSSProperties = {
  flex: 'none',
  whiteSpace: 'nowrap',
};

/**
 * A governed statement meta — no recency, no count, nothing to segment.
 * Does not shrink and does not ellipsize: `0 qualifying sources` carries a
 * numeral, and `no available record` loses its meaning at any cut.
 */
export const ENERGY_META_STATEMENT_STYLE: CSSProperties = {
  flex: 'none',
  whiteSpace: 'nowrap',
};

/** The row that holds them. One line, never wrapped — the 60px row is fixed. */
export const ENERGY_META_ROW_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  maxWidth: `${ENERGY_ROW_COLUMNS.meta}px`,
  minWidth: 0,
  flexWrap: 'nowrap',
};

/**
 * F-2′ · THE PREFIX RULE, RESTATED PER ELEMENT.
 *
 * F-2 requires the visible text to be a prefix of the accessible name, and was
 * written for a single string. With two elements the row's visible text stops
 * being a prefix of anything the moment the first element clips, so a
 * conforming implementation and a non-conforming one become
 * indistinguishable. L's refinement:
 *
 *   each element's visible text is a prefix of THAT ELEMENT's own full value,
 *   and the container's accessible name is the ordered join of the elements'
 *   full values, separated as rendered.
 *
 * `metaAccessibleName` is that join, and it is the ONLY place the `·` is
 * written into a string — because there it is not being rendered, it is being
 * announced.
 */
export const ENERGY_META_SEPARATOR = '·';

/** The shape `formatMetaRecency` needs. Data only: a function cannot cross the RSC boundary. */
export interface EnergyMetaTemplates {
  readonly metaRecency: string;
  readonly metaRecencyHourUnit: string;
  readonly metaRecencyDayUnit: string | null;
  readonly metaCounted: Readonly<Record<'EVIDENCE' | 'REVIEWED', string>>;
}

/**
 * The recency element's text.
 *
 * The DAY form belongs to the locale, never to the data. EN keeps the design's
 * own `checked 1d`; Polish renders `sprawdzono 24 h`, because L's delivered
 * template is hours at every magnitude and measures H=168 directly. A locale
 * with no day unit simply never takes the first branch.
 */
export function formatMetaRecency(hours: number, templates: EnergyMetaTemplates): string {
  const dayUnit = templates.metaRecencyDayUnit;
  const value =
    dayUnit !== null && hours >= 24 && hours % 24 === 0
      ? `${hours / 24}${dayUnit}`
      : `${hours}${templates.metaRecencyHourUnit}`;
  return templates.metaRecency.replace('{value}', value);
}

/** The evidence element's text: the count and its noun, inseparable. */
export function formatMetaCount(
  count: number,
  counted: 'EVIDENCE' | 'REVIEWED',
  templates: EnergyMetaTemplates,
): string {
  return `${count} ${templates.metaCounted[counted]}`;
}

/**
 * The recency element, split at the template's own placeholder.
 *
 * The VALUE (`6 h`, `1d`) is a machine-readable run — a digit sequence plus a
 * symbol-form unit — and the words around it are human prose. They are returned
 * separately so the component can isolate exactly the run that needs isolating,
 * rather than slicing a formatted string back apart and guessing where the
 * boundary was.
 */
export function splitMetaRecency(
  hours: number,
  templates: EnergyMetaTemplates,
): { readonly prefix: string; readonly value: string; readonly suffix: string } {
  const dayUnit = templates.metaRecencyDayUnit;
  const value =
    dayUnit !== null && hours >= 24 && hours % 24 === 0
      ? `${hours / 24}${dayUnit}`
      : `${hours}${templates.metaRecencyHourUnit}`;
  const at = templates.metaRecency.indexOf('{value}');
  if (at === -1) {
    throw new Error('energyOverflow: metaRecency template is missing its {value} placeholder.');
  }
  return {
    prefix: templates.metaRecency.slice(0, at),
    value,
    suffix: templates.metaRecency.slice(at + '{value}'.length),
  };
}

/** The structural shape `metaAccessibleName` reads. Kept local so the module stays leaf-ward. */
type MetaValue =
  | { readonly kind: 'EVIDENCED'; readonly checkedHours: number; readonly count: number; readonly counted: 'EVIDENCE' | 'REVIEWED' }
  | { readonly kind: 'STATEMENT'; readonly statement: string };

/**
 * F-2′ · the container's accessible name: the ordered join of the elements'
 * FULL values, separated as rendered. This is the only place the separator is
 * written into a string, because here it is announced rather than drawn.
 */
export function metaAccessibleName(meta: MetaValue, templates: EnergyMetaTemplates): string {
  if (meta.kind === 'STATEMENT') return meta.statement;
  return `${formatMetaRecency(meta.checkedHours, templates)} ${ENERGY_META_SEPARATOR} ${formatMetaCount(
    meta.count,
    meta.counted,
    templates,
  )}`;
}
