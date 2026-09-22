import type { SpecialistDomainId } from '@/lib/specialist/specialistDomain';
import type { IndicatorStrip } from '@/lib/specialist/indicatorStrip';
import type { HudLine } from '@/lib/specialist/hudGrammar';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * KENYA ELECTIONS · THE PROVIDER-FREE PREVIEW — AND IT CONTAINS NO ELECTION
 * ════════════════════════════════════════════════════════════════════════════
 *
 * *"The ceiling in one sentence: a complete, reviewable national election
 * surface that contains no election."*
 *
 * Every value in this file is a PLACEHOLDER with no real-world referent. No
 * Kenyan subject, no real candidate, no real party, no real figure, no IEBC
 * number. The contract is stricter here than the ordinary preview convention
 * and states why:
 *
 *   *"A screenshot of a preview election surface carrying real Kenyan names and
 *   fixture numbers is an invented election result, and it will outlive the
 *   explanation attached to it."*
 *
 * ── LIFECYCLE, MIRRORED FROM `previewScope.ts` ────────────────────────────
 *
 * *"when /economy opens, this module is DELETED along with the preview."*
 * The same clause governs here: **this module is deleted when `/election`
 * opens. It is not inherited by it.**
 */

export const ELECTION_DOMAIN: SpecialistDomainId = 'ELECTION';

/**
 * The preview's own presentation scope. A preview-only label, exactly as the
 * Product Owner's ruling quoted in `previewScope.ts` requires:
 *
 *   *"Do not mutate or falsely bind the production subject merely to make the
 *   label appear. Use a preview-only presentation scope/label."*
 *
 * `ZZ` is the reserved user-assigned ISO code. It refers to no country, which
 * is the point.
 */
export const ELECTION_PREVIEW_SCOPE = {
  iso2: 'ZZ',
  label: 'No subject bound',
  presentationCeiling: 'COUNTRY',
} as const;

/* ═══ THE `/election` GATE, RECORDED IN CODE ════════════════════════════ */

/**
 * WHY `/election` IS NOT OPENED, WHERE THE NEXT PERSON WILL FIND IT.
 *
 * The blocker is **rights, not availability** — `geometryLicenceFor('KE')` is
 * `LICENCE_PENDING` rather than `NONE` precisely to record that. A surface that
 * visibly mourns the missing geometry would misreport a rights position as an
 * engineering failure, which is why §2 also forbids a "map unavailable"
 * placeholder.
 */
export const ELECTION_LIVE_ROUTE_GATE: readonly { readonly condition: string; readonly met: false }[] = [
  { condition: 'A registered live election source is authorized. The bounded offline capture is not live activation.', met: false },
  { condition: 'An admitted election record is approved for live route publication. Bounded retained evidence alone does not open the live route.', met: false },
  {
    condition:
      'IEBC boundary licensing is resolved. Today: LICENCE_PENDING — the blocker is rights, not availability.',
    met: false,
  },
  {
    condition:
      'PRODUCIBLE_ELECTORAL_UNIT_KINDS is non-empty. Today: [] — the whole electoral axis is unaddressable.',
    met: false,
  },
] as const;

/** Nobody may open the live route while any condition is unmet. There is no override. */
export function electionLiveRouteMayOpen(): boolean {
  return ELECTION_LIVE_ROUTE_GATE.every((gate) => gate.met);
}

/* ═══ THE FOUR REGIONS, AS DATA ═════════════════════════════════════════ */

/**
 * §3.1 · The HUD line.
 *
 * `SCOPE` carries `COUNTRY` as a **governed value**, exactly as any other scope
 * would be — not an error state, not a degradation notice, no apology.
 * **COUNTRY is the presentation ceiling, and the ceiling is the product.**
 *
 * Four slots are OMITTED, which is how `renderableSlots` collapses them. An
 * empty value collapses the slot; it is never padded. In particular a missing
 * turnout figure collapses and **never renders as `0`** — `0` is a legitimate
 * reported vote total, which is exactly why absence must be a different shape
 * and not a different number.
 *
 * `WATCH` is omitted for the reason §8 gives, not for want of a value: there is
 * no `WatchSubjectType` member and none is registered.
 */
export function electionPreviewHud(modeLabel: string, scopeLabel: string): HudLine {
  return {
    MODE: { value: modeLabel, amber: null },
    /* STATE, PRIMARY_MEASURE, CHANGE, CONFIDENCE: no bound subject, so no value. */
    SCOPE: { value: scopeLabel, amber: null },
    /* WATCH: R-WATCH-1 — empty, therefore collapsed. */
  };
}

/** The slots this preview deliberately leaves empty, named so a guard can assert each one. */
export const ELECTION_COLLAPSED_SLOTS = [
  'STATE',
  'PRIMARY_MEASURE',
  'CHANGE',
  'CONFIDENCE',
  'WATCH',
] as const;

/**
 * §3 region 2 — the indicator strip, with **no indicators**.
 *
 * `indicatorMaxFor('ELECTION')` is 5 today via the accepted
 * `INDICATOR_MAX_BY_DOMAIN[d] ?? INDICATOR_SOFT_MAX` fallback. **No ELECTION
 * exception is registered** — registering one would convert an accepted default
 * into a bespoke entry for no measured reason.
 */
export const ELECTION_PREVIEW_STRIP: IndicatorStrip = {
  domain: ELECTION_DOMAIN,
  indicators: [],
};

/* ═══ RC-1..RC-6 · THE UNRANKED SUBJECT LIST ═══════════════════════════ */

/**
 * ── REGION 3 IS NOT AN ATTENTION QUEUE, AND R3 SAYS WHY ──────────────────
 *
 * R1 modelled region 3 as an `AttentionQueue`, because both R2 contracts
 * assigned it one. `MAIN-…-PLAN-B-R3` withdraws that:
 *
 *   *"`AttentionQueue` is a RANKED structure — `attentionRank` is its defining
 *   field, `queueWasOrderedUpstream` tests for one, and the shipped panel
 *   renders the UNAVAILABLE STATE without one. Neither vertical may ever have
 *   that rank."*
 *
 * **A structure whose defining field is a rank is the wrong home for a list
 * that may not have one.** So region 3 carries an explicitly unranked list,
 * defined by what it refuses.
 *
 * ── WHY THIS TYPE IS LOCAL AND NOT PROMOTED ──────────────────────────────
 *
 * `R-RC-1`: **the CONTRACT is shared; the RENDERER is not, and does not need to
 * be.** `R-RC-4` defers a shared carrier to its own round, because two verticals
 * is where it becomes measurable rather than anticipated — and promoting one now
 * onto two preview surfaces that bind no data *"would be the shape this
 * programme keeps retracting."*
 *
 * The duplication risk that creates is real and is answered by measurement
 * rather than by trust: **a guard asserts this union is identical to Delivery's
 * copy**, so the two cannot drift without a test failing.
 */
export const ORDER_REASONS = ['AUTHORITY_PUBLISHED', 'LEXICAL', 'UPSTREAM_ASSESSED'] as const;
export type OrderReason = (typeof ORDER_REASONS)[number];

/**
 * `RC-2` · the three, less the one neither vertical may ever use.
 *
 * `UPSTREAM_ASSESSED` is in the vocabulary because the contract has three
 * members. It is **subtracted from the type this surface may write**, so it is
 * not merely forbidden — it is unassignable. Enforcement by absence: the wrong
 * value is not refused at review, it does not typecheck.
 */
export type VerticalOrderReason = Exclude<OrderReason, 'UPSTREAM_ASSESSED'>;

/**
 * One row. **`RC-3`: there is no rank field, no ordinal and no index.**
 * Absent, not null and not zero — a field that could hold a rank is a field a
 * caller eventually fills.
 */
export interface UnrankedSubjectRow {
  readonly id: string;
  readonly label: string;
  /** A free-text state word. Never a score, never a position. */
  readonly stateLabel?: string;
}

/**
 * The list. **`orderReason` is REQUIRED**, which is the whole mechanism:
 * *"a list cannot exist without saying where its sequence came from."*
 *
 * `RC-1` · the rows are consumed in the order they arrive. Nothing in this lane
 * applies a comparator, and a guard sweeps for one.
 */
export interface UnrankedSubjectList {
  readonly headerLabel: string;
  readonly orderReason: VerticalOrderReason;
  readonly rows: readonly UnrankedSubjectRow[];
}

/**
 * The preview's contestant rows.
 *
 * **`orderReason` is `LEXICAL`, and the reason it is that value:** no authority
 * sequence is bound — the preview binds no contestants at all — so there is no
 * `AUTHORITY_PUBLISHED` order to carry, and `UPSTREAM_ASSESSED` is unavailable
 * to this vertical by construction. The placeholder labels are in lexical order
 * by label, which is what the field declares.
 *
 * **Non-attributable placeholders.** No name resembles a real candidate, no
 * label resembles a real party, and no row carries a figure of any kind.
 */
export const ELECTION_SUBJECT_LIST: UnrankedSubjectList = {
  headerLabel: 'CONTESTANTS',
  orderReason: 'LEXICAL',
  rows: [
    { id: 'placeholder-contestant-1', label: 'Placeholder contestant A', stateLabel: 'PREVIEW' },
    { id: 'placeholder-contestant-2', label: 'Placeholder contestant B', stateLabel: 'PREVIEW' },
    { id: 'placeholder-contestant-3', label: 'Placeholder contestant C', stateLabel: 'PREVIEW' },
  ],
};

/* ═══ §5.3 · THE THREE DISJOINT TREATMENTS ══════════════════════════════ */

/**
 * *"Three treatments, mutually disjoint: loading · absence · a reported value of
 * zero."*
 *
 * The disjointness is DECLARED AS DATA so it can be proven rather than
 * asserted, and it is proven on **three independent axes at once** — ink,
 * border and whether a numeral is present. A pair that differed on only one
 * axis would still let a reader who has learned one treatment read the other as
 * a weak version of it, which is precisely the failure §5.3 and Imihigo's I-3
 * both name.
 *
 * The hex values are the `sp-*` family's own, quoted here so the comparison a
 * reviewer runs is a named-colour comparison and not a class-name comparison.
 */
export interface ValueTreatment {
  readonly inkClass: string;
  readonly inkHex: string;
  readonly border: 'DASHED' | 'SOLID' | 'NONE';
  readonly carriesNumeral: boolean;
  readonly glyph: string | null;
  readonly busy: boolean;
}

export const ELECTION_TREATMENTS: Readonly<Record<'LOADING' | 'ABSENCE' | 'VALUE', ValueTreatment>> = {
  /** A check that could not run yet is UNMEASURED, never a statement about the count. */
  LOADING: {
    inkClass: 'text-sp-ink-3',
    inkHex: '#64798a',
    border: 'DASHED',
    carriesNumeral: false,
    glyph: '⋯',
    busy: true,
  },
  /** No value element at all — the M08 absence projection, carrying its assertion. */
  ABSENCE: {
    inkClass: 'text-sp-ink-2',
    inkHex: '#9db3c0',
    border: 'NONE',
    carriesNumeral: false,
    glyph: '—',
    busy: false,
  },
  /** A reported figure, including a reported zero, at full reading strength. */
  VALUE: {
    inkClass: 'text-sp-ink',
    inkHex: '#e4eef4',
    border: 'SOLID',
    carriesNumeral: true,
    glyph: null,
    busy: false,
  },
};

/**
 * Pairwise disjointness, computed rather than claimed.
 *
 * Returns the axes on which two treatments differ. A guard asserts all three
 * axes differ for all three pairs — **the evidence that they are disjoint**,
 * which §14 requires and which an assertion would not supply.
 */
export function treatmentsDifferOn(a: ValueTreatment, b: ValueTreatment): readonly string[] {
  const axes: string[] = [];
  if (a.inkHex !== b.inkHex) axes.push('ink');
  if (a.border !== b.border) axes.push('border');
  if (a.carriesNumeral !== b.carriesNumeral || a.glyph !== b.glyph) axes.push('numeral');
  return axes;
}
