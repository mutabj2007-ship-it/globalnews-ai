/**
 * PART X · HUMANITARIAN — THE INDEPENDENT AXES.
 *
 * R08 is the rule this file exists to make structural:
 *
 *   "Independent axes. Each has one encoding and one owner.
 *    NO COMPOSITE CRISIS SCORE EXISTS."
 *
 * SEVEN TYPES, AND DELIBERATELY NO EIGHTH THAT COMBINES THEM. A composite is not
 * prevented by a comment; it is prevented by there being no type to put one in and
 * no function that could return one. `humContract.spec.ts` asserts that no exported
 * function anywhere in this domain takes two axis values and returns a number, a
 * rank, or a member of a third enum — which is the falsifiable form of the rule.
 *
 * CHANGE STATE IS CONSUMED, NEVER RESTATED. `WatchChangeState` is canonical and its
 * own comment says "DO NOT EXTEND THIS UNION". Humanitarian adds nothing to it —
 * CHECKED is a Timeline qualification layered OVER `NO_MATERIAL_CHANGE`, and the
 * guard asserts the string never reaches a change-state comparison.
 */
import type { WatchChangeState } from '@globalnews-ai/shared';

/** Consumed as-is from the canonical shared vocabulary. Seven values, closed. */
export type HumChangeState = WatchChangeState;

/**
 * THE MEASURED CEILING. Canonical `WATCH_CHANGE_STATES_DERIVABLE_TODAY` contains
 * exactly two of the seven; the other five each need a capability that does not
 * exist (run history, a magnitude threshold, prior runs, disagreement detection,
 * duration). Humanitarian therefore has a seventh degraded condition the design did
 * not anticipate — see `humDegraded.ts` `changeStateNotDerivable`.
 */
export const HUM_CHANGE_STATES_PRODUCIBLE_TODAY: readonly HumChangeState[] = [
  'NEW_EVIDENCE',
  'NO_MATERIAL_CHANGE',
];

/** Epistemic. About the CLAIM, never about the assessment. R08. */
export type ClaimStanding = 'STANDING_CLAIM' | 'UNVERIFIED_CLAIM' | 'SUPERSEDED';

/** Achromatic word plus a neutral mark. Never green, never red. R08. */
export type ChangeDirection =
  | 'DETERIORATION'
  | 'IMPROVEMENT'
  | 'RESTORATION'
  | 'MIXED'
  | 'UNCHANGED'
  | 'NO_DIRECTION_SET';

/** Per sector, per area, per method. Never summed, never averaged across sectors. R08. */
export type NeedLevel =
  | 'NO_ASSESSED_NEED'
  | 'STRESSED'
  | 'SEVERE'
  | 'CRITICAL'
  | 'NOT_ASSESSED';

/** Per assessment and per facet. Never conflated with evidence strength. R08. */
export type Confidence = 'LOW' | 'MODERATE' | 'HIGH' | 'NOT_APPLICABLE';

/**
 * Own labelled row, own revision date, own cause reference.
 * "Access can be open while need is critical." R08.
 */
export type AccessCondition =
  | 'OPEN'
  | 'CONSTRAINED'
  | 'SEVERELY_CONSTRAINED'
  | 'DENIED'
  | 'NOT_ASSESSED';

/** Persistent header fact, repeated on every degraded visualisation. R08. */
export type CoverageHealth =
  | 'BASELINE_VALIDATED'
  | 'DELAYED'
  | 'STALE'
  | 'COVERAGE_GAP';

/**
 * GEOGRAPHIC PRECISION — DISPLAY ALIASES ONLY, AND THE MAPPING IS NOT OURS.
 *
 * R09: "Humanitarian labels are display aliases pending Main mapping, never a
 * replacement precision enum."
 *
 * MEASURED, AND IT DOES NOT DIVIDE EVENLY. Part X lists EIGHT aliases; the canonical
 * ladder has SEVEN levels, and `ADMIN3` has no counterpart at all. Of the eight, only
 * four map to a level with a producer today — SETTLEMENT, ADMIN1, COUNTRY, UNPLACED.
 * SITE (EXACT), ADMIN2 (DISTRICT) and REGIONAL (REGION) have NO PRODUCER, and ADMIN3
 * has no canonical level to map to.
 *
 * So `humPrecisionCanonical()` FAILS CLOSED. Picking a nearest level would be
 * manufacturing precision, which is the one thing R09 forbids in both directions.
 */
export type HumPrecisionAlias =
  | 'SITE'
  | 'SETTLEMENT'
  | 'ADMIN3'
  | 'ADMIN2'
  | 'ADMIN1'
  | 'COUNTRY'
  | 'REGIONAL'
  | 'UNPLACED';

/** The canonical spatial levels, named here only to map onto — never redeclared as ours. */
export type CanonicalPrecision =
  | 'EXACT'
  | 'CITY'
  | 'DISTRICT'
  | 'PROVINCE'
  | 'COUNTRY'
  | 'REGION'
  | 'UNKNOWN';

export interface PrecisionMapping {
  readonly alias: HumPrecisionAlias;
  /** NULL where no canonical level corresponds. Not a nearest guess. */
  readonly canonical: CanonicalPrecision | null;
  /** Whether the pipeline can emit that level today. Measured, not assumed. */
  readonly producible: boolean;
  /** Why, in the cases where it cannot. */
  readonly note: string | null;
}

export const HUM_PRECISION_MAPPING: readonly PrecisionMapping[] = [
  { alias: 'SITE', canonical: 'EXACT', producible: false, note: 'EXACT has no producer in this pipeline.' },
  { alias: 'SETTLEMENT', canonical: 'CITY', producible: true, note: null },
  { alias: 'ADMIN3', canonical: null, producible: false, note: 'No canonical level corresponds. Main mapping required.' },
  { alias: 'ADMIN2', canonical: 'DISTRICT', producible: false, note: 'No admin-2 dataset is loaded; a district is attached to its city, not resolved as a level.' },
  { alias: 'ADMIN1', canonical: 'PROVINCE', producible: true, note: null },
  { alias: 'COUNTRY', canonical: 'COUNTRY', producible: true, note: null },
  { alias: 'REGIONAL', canonical: 'REGION', producible: false, note: 'REGION has no producer in this pipeline.' },
  { alias: 'UNPLACED', canonical: 'UNKNOWN', producible: true, note: null },
];

/** Fails closed. Never returns a nearest level. */
export function humPrecisionCanonical(alias: HumPrecisionAlias): CanonicalPrecision | null {
  return HUM_PRECISION_MAPPING.find((m) => m.alias === alias)?.canonical ?? null;
}

export function humPrecisionIsProducible(alias: HumPrecisionAlias): boolean {
  return HUM_PRECISION_MAPPING.find((m) => m.alias === alias)?.producible === true;
}

/**
 * The one thing this domain will never have. Exported as a constant so a guard can
 * assert its presence, and so a reader looking for a score finds this instead.
 */
export const HUMANITARIAN_DECLARES_NO_COMPOSITE_SCORE = true;

/**
 * CHECKED is a Timeline qualification of NO_MATERIAL_CHANGE, not a change state.
 * Measured: the literal 'CHECKED' occurs ZERO times in all of shared/src.
 */
export const CHECKED_IS_A_TIMELINE_QUALIFICATION = 'CHECKED' as const;
