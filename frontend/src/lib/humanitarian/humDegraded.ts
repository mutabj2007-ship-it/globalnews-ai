/**
 * PART X · HUMANITARIAN — THE DEGRADED STATES, AS CONSTRUCTORS.
 *
 * THE REASON THIS FILE EXISTS. The source programme is not DATA READY, so the
 * degraded states are not a fallback branch — they are the Beta default, and Part X
 * says so in its own implementation records: H-04 "this frame is itself the degraded
 * geographic state and is the Beta default"; H-06 "this is the degraded state".
 *
 * A degraded state expressed as `if (!x) return null` is how a coverage gap silently
 * becomes a calm blank. So every constructor below returns a value the frame
 * RENDERS. None returns null, none returns 0, none returns an empty string.
 *
 * THE SENTENCE THIS FILE IS BUILT AROUND, from the activation and from R09:
 *
 *     "Do NOT translate 'no lawful usable evidence' into 'no humanitarian need'."
 *
 * `NOT ASSESSED` and `COVERAGE GAP` are findings. They are never an absence of need,
 * never a zero, never an empty ramp step, and never a blank that reads as calm.
 */
import { humPrecisionIsProducible } from './humAxes';
import type {
  AccessCondition, ChangeDirection, ClaimStanding, Confidence,
  CoverageHealth, HumChangeState, HumPrecisionAlias, NeedLevel,
} from './humAxes';

/**
 * Why a value is not shown, ON ONE RECORD. NEVER a value, and NEVER a protection state.
 *
 * `PROTECTED_LOCATION_AGGREGATED` WAS A MEMBER OF THIS UNION AND IS NOT ANY MORE.
 *
 * It was authored as an ordinary coverage reason, given a rendered string, and emitted
 * by `Absence` as `data-hum-absence-reason` — a machine token beside the sentence. Two
 * call sites passed a DYNAMIC reason, so the moment a classifier produced one record
 * carrying it, `querySelectorAll('[data-hum-absence-reason="PROTECTED_LOCATION_AGGREGATED"]')`
 * would have returned exactly the protected set, and by elimination the unprotected one.
 * That is a set-differencing instrument at machine scale, and protection state is itself
 * a disclosure — E1's accepted policy says so in those words.
 *
 * REMOVING IT IS NOT A RENAME. A softened name would hide the marker from a reviewer and
 * leave it in the DOM. There is now no member to pass, no authored string to render and
 * no token to select on, at any call site, on either viewport. The class-level posture —
 * which the policy permits and the frame already states — is a SEPARATE type below, is
 * never keyed by a record, and never reaches a data attribute.
 */
export type AbsenceReason =
  | 'NO_VALIDATED_BASELINE'
  | 'NO_LOCAL_EVIDENCE_IN_PERIOD'
  | 'RIGHTS_UNAVAILABLE'
  | 'RIGHTS_RESTRICTED'
  | 'AWAITING_SHARED_CONTRACT'
  | 'NOT_PRODUCIBLE_AT_THIS_PRECISION'
  | 'STATE_NOT_DERIVABLE';

/**
 * The closed set, as a value rather than only as a type. The type stops a member being
 * ADDED; this stops one being SMUGGLED — a cast, a widened string from a future producer,
 * a JSON payload. `Absence` derives its DOM token from this lookup, and a value outside it
 * resolves to `ORDINARY_AGGREGATION_REASON` rather than to `undefined`, so the attribute is
 * always emitted and omission cannot be used as a signal.
 */
export const PER_RECORD_ABSENCE_REASONS: readonly AbsenceReason[] = [
  'NO_VALIDATED_BASELINE',
  'NO_LOCAL_EVIDENCE_IN_PERIOD',
  'RIGHTS_UNAVAILABLE',
  'RIGHTS_RESTRICTED',
  'AWAITING_SHARED_CONTRACT',
  'NOT_PRODUCIBLE_AT_THIS_PRECISION',
  'STATE_NOT_DERIVABLE',
];

/**
 * Identity over the closed set. This table is a lookup, not the public accessor: a miss
 * yields `undefined` HERE, and `perRecordAbsenceToken` below converts that miss into
 * `ORDINARY_AGGREGATION_REASON`. No `undefined` ever leaves this module.
 */
const ABSENCE_TOKEN: Readonly<Record<AbsenceReason, AbsenceReason>> = {
  NO_VALIDATED_BASELINE: 'NO_VALIDATED_BASELINE',
  NO_LOCAL_EVIDENCE_IN_PERIOD: 'NO_LOCAL_EVIDENCE_IN_PERIOD',
  RIGHTS_UNAVAILABLE: 'RIGHTS_UNAVAILABLE',
  RIGHTS_RESTRICTED: 'RIGHTS_RESTRICTED',
  AWAITING_SHARED_CONTRACT: 'AWAITING_SHARED_CONTRACT',
  NOT_PRODUCIBLE_AT_THIS_PRECISION: 'NOT_PRODUCIBLE_AT_THIS_PRECISION',
  STATE_NOT_DERIVABLE: 'STATE_NOT_DERIVABLE',
};

/**
 * ORDINARY AGGREGATION — the rendering a protection-bearing value is folded into.
 *
 * Checkpoint 3 mapped anything outside the closed set to `undefined`, so React omitted the
 * attribute. That closed the token channel and OPENED A WORSE ONE: a record with no
 * `data-hum-absence-reason` and a different body is DISTINGUISHABLE from every ordinary
 * record. The absence of a marker is a marker. F names it — the rendering must be
 * "byte-identical to ordinary aggregation, same chrome, same body, same DOM attribute
 * value" — and E1 names the same class as the omission channel in CG-6.
 *
 * So the fallback is not a blank; it is the ordinary aggregation reason this surface
 * already renders for a non-protection cause, with its already-authored string. A
 * protected record and a record aggregated because ADMIN2 has no producer emit the same
 * bytes, which is the only shape in which protection state is not itself a disclosure.
 *
 * ONE POINT OF THIS IS AWAITING F'S RULING AND IS FLAGGED RATHER THAN QUIETLY CHOSEN.
 * F's chrome table assigns `PROTECTED_LOCATION_AGGREGATED` to the `Not shown` class, and
 * F also requires byte-identity with ordinary aggregation, whose reason
 * (`NOT_PRODUCIBLE_AT_THIS_PRECISION`) sits in the `Not established` class. Both cannot
 * hold: if protection rendered `Not shown` while ordinary aggregation rendered
 * `Not established`, the chrome value would be the oracle. The safety requirement is
 * implemented and the taxonomy statement is the one deferred, because F's own stated
 * reason for the assignment is the safety property. Changing the target is one line.
 */
export const ORDINARY_AGGREGATION_REASON: AbsenceReason = 'NOT_PRODUCIBLE_AT_THIS_PRECISION';

/**
 * The ONLY way a per-record absence token reaches the DOM. Any value outside the closed
 * set — a cast, a widened producer string, a protection-bearing one — resolves to the
 * ordinary aggregation reason, so the channel cannot carry protection state and cannot
 * signal it by omission either.
 */
export function perRecordAbsenceToken(reason: string): AbsenceReason {
  const known = ABSENCE_TOKEN[reason as AbsenceReason];
  return known === undefined ? ORDINARY_AGGREGATION_REASON : known;
}

/**
 * WHAT THE CHROME ABOVE A REASON IS ALLOWED TO SAY.
 *
 * The absence block printed the constant micro-label "Not assessed" above EVERY reason —
 * including both rights reasons and `STATE_NOT_DERIVABLE`. Rights blocked is not "not
 * assessed": an assessment may exist, may be perfectly good, and may not lawfully be
 * shown. The screen was stating a trap in its chrome and refusing it in the body two
 * lines below, in the same block.
 *
 * So the chrome is DERIVED from the reason and there is no constant to be wrong. Which
 * label each reason takes is a claim about WHOSE limitation it is:
 *
 *   NOT_ASSESSED     nobody has assessed it            — a fact about the evidence
 *   NOT_ESTABLISHED  it could not be established       — a fact about the method or about us
 *   NOT_SHOWN        it may exist and may not be shown — a fact about rights
 *
 * THREE members, and the type below is the list. Checkpoint 3 carried four classes of its
 * own — NOT_ASSESSED, NOT_SHOWN, NOT_AVAILABLE, NOT_DERIVABLE — and F's ratified partition
 * merged the last two into NOT_ESTABLISHED. This comment named the superseded four until
 * E1 C-1; it now names the three the type actually has, and nothing else.
 */
export type AbsenceChrome = 'NOT_ASSESSED' | 'NOT_ESTABLISHED' | 'NOT_SHOWN';

/**
 * F-HUM-MARKET-VISUAL-TRUTH-CORRECTION-1 §1, applied exactly. Three values, total
 * coverage, NO DEFAULT — a reason added to the union with no class assigned is a
 * compile-time gap rather than a silent fall-through to `Not assessed`, which is what the
 * constant was. Checkpoint 3 used four classes of its own; F's ratified partition
 * replaces them.
 */
export const ABSENCE_CHROME: Readonly<Record<AbsenceReason, AbsenceChrome>> = {
  NO_VALIDATED_BASELINE: 'NOT_ASSESSED',
  NO_LOCAL_EVIDENCE_IN_PERIOD: 'NOT_ASSESSED',
  STATE_NOT_DERIVABLE: 'NOT_ESTABLISHED',
  NOT_PRODUCIBLE_AT_THIS_PRECISION: 'NOT_ESTABLISHED',
  AWAITING_SHARED_CONTRACT: 'NOT_ESTABLISHED',
  RIGHTS_UNAVAILABLE: 'NOT_SHOWN',
  RIGHTS_RESTRICTED: 'NOT_SHOWN',
};

/**
 * A figure slot. It carries EITHER an observation or a reason — never a number that
 * stands in for a missing one. There is no `value: number` with a default, and there
 * is no `?? 0` anywhere in this domain; a guard forbids the operator outright.
 */
export type FigureSlot =
  | { readonly kind: 'OBSERVED'; readonly display: string; readonly method: string; readonly period: string; readonly precision: HumPrecisionAlias; readonly sources: string }
  | { readonly kind: 'ABSENT'; readonly reason: AbsenceReason };

export const absentFigure = (reason: AbsenceReason): FigureSlot => ({ kind: 'ABSENT', reason });

/* ─── 1 · EVIDENCE UNAVAILABLE ─────────────────────────────────────────────── */

export interface EvidenceState {
  readonly available: false;
  readonly standing: ClaimStanding | null;
  readonly reason: AbsenceReason;
  /** A standing unverified claim is RECORDED and shown. It is never converted. */
  readonly standingClaimOnRecord: boolean;
}

export const evidenceUnavailable = (
  reason: AbsenceReason,
  standingClaimOnRecord = false,
): EvidenceState => ({
  available: false,
  standing: standingClaimOnRecord ? 'UNVERIFIED_CLAIM' : null,
  reason,
  standingClaimOnRecord,
});

/* ─── 2 · RIGHTS UNAVAILABLE / RESTRICTED ──────────────────────────────────── */

/**
 * Rights are a SEPARATE axis from evidence. A source may exist and be unusable.
 * Collapsing the two would let "we may not show it" read as "there is nothing".
 */
export interface RightsState {
  readonly usable: false;
  readonly reason: 'RIGHTS_UNAVAILABLE' | 'RIGHTS_RESTRICTED';
  /** Stated so the reader knows a decision is pending, not that nothing exists. */
  readonly ownerNamed: string;
}

export const rightsUnavailable = (ownerNamed: string): RightsState =>
  ({ usable: false, reason: 'RIGHTS_UNAVAILABLE', ownerNamed });

export const rightsRestricted = (ownerNamed: string): RightsState =>
  ({ usable: false, reason: 'RIGHTS_RESTRICTED', ownerNamed });

/* ─── 3 · INCOMPLETE SECTOR EVIDENCE ───────────────────────────────────────── */

export const HUM_SECTORS = ['WATER', 'SHELTER', 'FOOD', 'HEALTH', 'SANITATION', 'PROTECTION'] as const;
export type HumSector = (typeof HUM_SECTORS)[number];

export interface SectorNeedRow {
  readonly sector: HumSector;
  readonly level: NeedLevel;
  readonly basis: string | null;
  readonly absence: AbsenceReason | null;
}

/**
 * NOT ASSESSED in its own treatment, per sector, with its reason. Every sector is
 * listed — a sector omitted from the list reads as one that does not matter.
 */
export const sectorsNotAssessed = (reason: AbsenceReason): readonly SectorNeedRow[] =>
  HUM_SECTORS.map((sector) => ({ sector, level: 'NOT_ASSESSED' as NeedLevel, basis: null, absence: reason }));

/** How many sectors carry a level that is not NOT_ASSESSED. Counting, never scoring. */
export function sectorsWithEvidence(rows: readonly SectorNeedRow[]): number {
  return rows.filter((r) => r.level !== 'NOT_ASSESSED').length;
}

/* ─── 4 · UNCERTAIN STANDING ───────────────────────────────────────────────── */

export interface StandingState {
  readonly standing: ClaimStanding;
  /** Superseded text is STATED AS UNAVAILABLE where retention is unresolved — never reconstructed. */
  readonly supersededTextRetained: boolean;
  readonly note: AbsenceReason | null;
}

export const standingUncertain = (): StandingState =>
  ({ standing: 'UNVERIFIED_CLAIM', supersededTextRetained: false, note: 'AWAITING_SHARED_CONTRACT' });

export const standingSuperseded = (): StandingState =>
  ({ standing: 'SUPERSEDED', supersededTextRetained: false, note: 'AWAITING_SHARED_CONTRACT' });

/* ─── 5 · ACCESS CONSTRAINT ────────────────────────────────────────────────── */

/**
 * A GEOGRAPHY IDENTIFIER, WITH THE RUNG IT WAS STATED AT.
 *
 * `area` used to be a bare `string`. Nothing clamped it, nothing formatted it, and the
 * renderer never consulted `view.precision` — so a name arriving from any future producer
 * reached the DOM verbatim at whatever resolution it happened to carry. A synthetic area
 * string carrying a coordinate pair was demonstrated reaching the DOM unaltered.
 *
 * The shipped specimen showed the shape of the defect without being one: the SELECTED
 * view declared `precisionFloor('ADMIN1')` — PROVINCE — and then named three ADMIN2
 * territories, while this domain's own mapping records ADMIN2 as `producible: false`.
 * A name is a placement. Naming three districts under a province-level declaration is
 * manufacturing precision by caption.
 *
 * So an area now carries its own rung and the renderer refuses anything finer than the
 * frame declares. The refusal is a STATED reason, never a blank.
 */
export interface AreaIdentifier {
  readonly name: string;
  readonly precision: HumPrecisionAlias;
}

export const area = (name: string, precision: HumPrecisionAlias): AreaIdentifier =>
  ({ name, precision });

/**
 * Coarse to fine. Ordered here rather than inferred from the mapping table's row order,
 * because a table is a list and a clamp needs an ordering.
 */
const PRECISION_RANK: Readonly<Record<HumPrecisionAlias, number>> = {
  UNPLACED: 0, REGIONAL: 1, COUNTRY: 2, ADMIN1: 3, ADMIN2: 4, ADMIN3: 5, SETTLEMENT: 6, SITE: 7,
};

/**
 * What a reader is shown for one area. NAMED only when the area's own rung is no finer
 * than the frame's declared rung AND that rung has a producer; otherwise the name is
 * withheld and the ceiling is stated. Refuses in the direction of less precision, always.
 */
export type AreaRender =
  | { readonly kind: 'NAMED'; readonly name: string; readonly precision: HumPrecisionAlias }
  | { readonly kind: 'CLAMPED'; readonly declared: HumPrecisionAlias; readonly reason: AbsenceReason };

/**
 * COORDINATE-SHAPED NAMES — E1 C-2, and why this rule exists at the NAME and not the rung.
 *
 * Until this checkpoint the only thing standing between a smuggled coordinate and the DOM
 * was the RUNG. The shipped assertion exercised `SITE` against an `ADMIN1` declaration,
 * which clamps for two reasons — finer than declared, and non-producible — and NEITHER of
 * them is the coordinate. Replace the coordinate with a clean name and that assertion
 * passed identically, while `renderableArea(area('North Kivu','ADMIN1'), admin1)` proved
 * the complement: at an ALLOWED rung a free-form name was rendered verbatim, with no
 * name-level rule of any kind. E1 named it the M4 trap: an assertion whose title claims
 * more than its fixture proves.
 *
 * So the rule is now at the name. A name that carries a coordinate is refused at EVERY
 * rung, including the allowed ones, and the paired control in the suite renders a clean
 * name at the SAME rung to prove the refusal discriminates on the name rather than on the
 * clamp that would have fired anyway.
 *
 * THE REFUSAL REUSES THE ORDINARY AGGREGATION REASON, DELIBERATELY. A distinct reason —
 * `NAME_CARRIED_COORDINATE`, say — would make the refusal itself the marker: a reader
 * differencing rows would learn which name had been sanitised, which is the same oracle
 * class E1 closed in CG-1 and CG-6. A row refused for its name is byte-identical to a row
 * aggregated because its rung has no producer.
 *
 * The patterns are shapes, not a gazetteer. A decimal pair, a signed decimal pair, a
 * degree/minute/second form, and a hemisphere-qualified form. Anything a reader would
 * recognise as a position, a page-wide selector can recognise too.
 */
const COORDINATE_SHAPES: readonly RegExp[] = [
  /* 0.0000, 0.0000 · -1.68, 29.23 · 12.5;-3.4 — a decimal pair with a separator */
  /-?\d{1,3}\.\d+\s*[,;]\s*-?\d{1,3}\.\d+/,
  /* 1 40 12 N, 29 13 48 E — degree/minute/second, with or without symbols */
  /\d{1,3}\s*[\u00B0d]\s*\d{1,2}\s*['\u2032]\s*[\d.]*\s*["\u2033]?\s*[NSEW]/i,
  /* 1.68S 29.23E · 1.68 S, 29.23 E — hemisphere-qualified decimals */
  /-?\d{1,3}(?:\.\d+)?\s*[\u00B0]?\s*[NS]\s*[,;\s]+\s*-?\d{1,3}(?:\.\d+)?\s*[\u00B0]?\s*[EW]/i,
  /* an explicit lat/long caption, however it is spelled */
  /\b(?:lat|latitude|lon|lng|long|longitude)\b\s*[:=]/i,
];

/**
 * True when a name carries something shaped like a position. Exported so the suite can
 * assert the property over the whole corpus rather than over the one fixture that happens
 * to be written down — E1 R-3b.
 */
export function nameCarriesCoordinate(name: string): boolean {
  return COORDINATE_SHAPES.some((re) => re.test(name));
}

export function renderableArea(a: AreaIdentifier, declared: PrecisionState): AreaRender {
  const finerThanDeclared = PRECISION_RANK[a.precision] > PRECISION_RANK[declared.alias];
  const producible = humPrecisionIsProducible(a.precision);
  if (finerThanDeclared || !producible || !declared.producible) {
    return { kind: 'CLAMPED', declared: declared.alias, reason: ORDINARY_AGGREGATION_REASON };
  }
  /*
    THE NAME RULE. Reached only when the rung would have allowed the name through, so a
    refusal here is caused by the name and by nothing else. That is the whole point of
    placing it after the rung checks rather than before them.
  */
  if (nameCarriesCoordinate(a.name)) {
    return { kind: 'CLAMPED', declared: declared.alias, reason: ORDINARY_AGGREGATION_REASON };
  }
  return { kind: 'NAMED', name: a.name, precision: a.precision };
}

export interface AccessRow {
  readonly area: AreaIdentifier;
  readonly condition: AccessCondition;
  /** Own revision date, own cause reference — R08. Cause is REFERENCED, never adjudicated. */
  readonly revised: string | null;
  readonly causeReferencedTo: 'CONFLICT' | 'SECURITY' | null;
  readonly absence: AbsenceReason | null;
}

/** "Not assessed is not open." — Part X, H-04, verbatim. */
export const accessNotAssessed = (a: AreaIdentifier, reason: AbsenceReason): AccessRow =>
  ({ area: a, condition: 'NOT_ASSESSED', revised: null, causeReferencedTo: null, absence: reason });

/**
 * The rung a frame cannot reach, stated as a row of its own rather than by omitting the
 * areas that live there. An omitted rung reads as a rung with nothing in it.
 */
export const accessNotProducibleAtPrecision = (alias: HumPrecisionAlias): AccessRow =>
  ({ area: area('—', alias), condition: 'NOT_ASSESSED', revised: null,
     causeReferencedTo: null, absence: 'NOT_PRODUCIBLE_AT_THIS_PRECISION' });

/* ─── 6 · DEGRADED COVERAGE ────────────────────────────────────────────────── */

export interface CoverageState {
  readonly health: CoverageHealth;
  /**
   * TRUE when no coverage authority is wired and the state is asserted from absence
   * rather than consumed. Part X's own degraded fallback for H-06 requires the header
   * to say so: "GAP ASSERTED FROM ABSENCE OF EVIDENCE".
   */
  readonly assertedFromAbsence: boolean;
  readonly lastLocalEvidence: string | null;
}

export const coverageGapAssertedFromAbsence = (): CoverageState =>
  ({ health: 'COVERAGE_GAP', assertedFromAbsence: true, lastLocalEvidence: null });

/* ─── 7 · PRECISION FLOOR ──────────────────────────────────────────────────── */

/**
 * The Beta default is COUNTRY or ADMIN1 (province), because those are the only two
 * placed levels with a producer. A finer chip is never shown, and a finer geometry is
 * never drawn: "a finer renderer never licenses a finer placement".
 */
export interface PrecisionState {
  readonly alias: HumPrecisionAlias;
  readonly producible: boolean;
  readonly ceilingReason: AbsenceReason | null;
}

export const precisionFloor = (alias: 'COUNTRY' | 'ADMIN1'): PrecisionState =>
  ({ alias, producible: true, ceilingReason: null });

export const precisionNotProducible = (alias: HumPrecisionAlias): PrecisionState =>
  ({ alias, producible: false, ceilingReason: 'NOT_PRODUCIBLE_AT_THIS_PRECISION' });

/* ─── 8 · UNAVAILABLE FUTURE / COMPOSITE STATE ─────────────────────────────── */

/**
 * Composite scope is FUTURE by MEASURED LITERAL, not by assumption: canonical
 * `COMPOSITE_SCOPE_AVAILABILITY` reads 'UNAVAILABLE_PENDING_UPSTREAM'.
 * Shown DISABLED with the dependency named — never hidden, never silently enabled.
 */
export interface FutureState {
  readonly available: false;
  readonly dependency: string;
  readonly degradedPath: string;
}

export const compositeScopeUnavailable = (): FutureState => ({
  available: false,
  dependency: 'Shared Watch composite semantics — COMPOSITE_SCOPE_AVAILABILITY is UNAVAILABLE_PENDING_UPSTREAM.',
  degradedPath: 'An explicit country set that never averages coverage. No member state generalised.',
});

/* ─── 9 · THE SEVENTH CONDITION THE DESIGN DID NOT ANTICIPATE ──────────────── */

/**
 * Five of the seven change states have no producer today. That is NOT the same as
 * NO MATERIAL CHANGE — one means "we looked and nothing changed", the other means
 * "we cannot tell". The canonical mapping already models it: `WatchChangeState | null`,
 * where null is documented as "the mapping refusing to assert a change state it
 * cannot support". This renders that null instead of hiding it.
 */
export interface ChangeStateSlot {
  readonly kind: 'DERIVED' | 'NOT_DERIVABLE';
  readonly state: HumChangeState | null;
  readonly direction: ChangeDirection;
  readonly confidence: Confidence;
  readonly reason: AbsenceReason | null;
}

export const changeStateNotDerivable = (): ChangeStateSlot => ({
  kind: 'NOT_DERIVABLE',
  state: null,
  direction: 'NO_DIRECTION_SET',
  confidence: 'NOT_APPLICABLE',
  reason: 'STATE_NOT_DERIVABLE',
});

export const changeStateDerived = (
  state: HumChangeState,
  direction: ChangeDirection,
  confidence: Confidence,
): ChangeStateSlot => ({ kind: 'DERIVED', state, direction, confidence, reason: null });

/* ─── 9b · "CHECKED" IS A CLAIM ABOUT US, AND IT HAS TO BE EARNED ──────────── */

/**
 * THE DEFECT THIS TYPE EXISTS TO MAKE UNREACHABLE.
 *
 * The QUIET frame was titled "Checked — no material change" — as a hardcoded string, in
 * the model and in the frame catalogue — while its own change slot was
 * `changeStateNotDerivable()`, and while the SAME SCREEN printed, four lines below,
 * "State not derivable — this is not 'no material change'". The screen contradicted
 * itself and the wrong half was the loud one.
 *
 * "Checked" asserts that a check happened. Nothing was checked: five of the seven change
 * states have no producer, this domain's own ceiling says so, and NO_MATERIAL_CHANGE was
 * never derived. A reader who sees "checked" reasonably concludes someone looked.
 *
 * The fix is not a better sentence. A sentence can be edited back. The QUIET frame now
 * has NOWHERE TO PUT a hardcoded title: `FrameTitle` gives it only `FROM_CHANGE_STATE`,
 * and the claim is computed from the slot every render. "Checked" is reachable only when
 * a change state was actually DERIVED and that state is NO_MATERIAL_CHANGE — which today
 * it is not, and which no edit to a string can fake.
 */
export type QuietClaim = 'CHECKED_NO_MATERIAL_CHANGE' | 'NOT_DERIVABLE';

export function quietClaimFor(change: ChangeStateSlot): QuietClaim {
  return change.kind === 'DERIVED' && change.state === 'NO_MATERIAL_CHANGE'
    ? 'CHECKED_NO_MATERIAL_CHANGE'
    : 'NOT_DERIVABLE';
}

/**
 * A frame's headline. STATED prose is ordinary description that asserts nothing about
 * whether anyone looked; FROM_CHANGE_STATE carries no text at all and is resolved from
 * the slot at render time. A frame whose headline IS a claim about a check may only use
 * the second, so the claim cannot be authored.
 */
export type FrameTitle =
  | { readonly kind: 'STATED'; readonly text: string }
  | { readonly kind: 'FROM_CHANGE_STATE' };

export const statedTitle = (text: string): FrameTitle => ({ kind: 'STATED', text });
export const titleFromChangeState = (): FrameTitle => ({ kind: 'FROM_CHANGE_STATE' });

/* ─── 10 · SENSITIVE LOCATION — THE SAFE DEGRADED STATE ────────────────────── */

/**
 * E1's accepted policy is a SHARED contract Main owns, and it does not exist yet.
 * The frontend does not implement a classifier or a clamp — it renders the SAFE
 * degraded state and marks the dependency.
 *
 * WHAT THIS CARRIES: that protection is on, and that a dependency is outstanding.
 * WHAT IT NEVER CARRIES: a coordinate, a radius, a protected class, a site name, a
 * count of protected sites, or any field a reader could use to narrow a location.
 * There is no reveal control, no entitlement, no role variant and no admin bypass —
 * and `humContract.spec.ts` asserts the VOCABULARY for one does not exist.
 */
export interface SensitiveLocationState {
  readonly protectionOn: true;
  readonly classifierContractAvailable: false;
  readonly dependency: string;
}

export const sensitiveLocationProtected = (): SensitiveLocationState => ({
  protectionOn: true,
  classifierContractAvailable: false,
  dependency: 'Shared sensitive-location classifier and precision clamp — Main + E1. Not implemented here.',
});
