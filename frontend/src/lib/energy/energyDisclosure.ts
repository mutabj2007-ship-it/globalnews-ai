/**
 * ════════════════════════════════════════════════════════════════════════════
 * RIGHTS × EXPOSURE — TWO INDEPENDENT DISCLOSURE AXES, AND THE E1 HOLDS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * PROPOSED for `shared/src/energy/disclosure.ts`.
 * Nothing lands without authorization. No provider. No activation. No deployment.
 *
 * AUTHORITY
 *   MAIN-ENERGY-PARTXI-E1-L-CLOSEOUT-R2 §B and §C, on the Product Owner's instruction and
 *   E1's ruling E03-1: *"TWO BITS, NOT ONE. BUILD IT NOW."*
 *
 * ── THE FAILURE THIS PREVENTS, IN ONE SENTENCE ────────────────────────────
 *
 * Part XI renders ONE reader state — violet `UNAVAILABLE · LICENSED` — for what are really
 * two independent predicates: *we have no right to it* and *we should not expose it*. Today
 * both are false in the same direction, so one chip is indistinguishable from two. **The day
 * rights flips, a single boolean flips and the series renders, and nobody will have decided
 * anything.** A licence is a rights event; it must not move a security gate.
 *
 * E1 named the cost of retrofitting: *"it costs nothing today and is very expensive to
 * retrofit after a licence exists and a stakeholder is waiting."* `RIGHTS-SECURITY-MATRIX.md`
 * already states the principle — *"no cell may be inferred from another"* — as a
 * documentation rule. **This file makes it a type.**
 *
 * ── THE NON-OBVIOUS PART: WHICH AXIS WINS WHEN BOTH ARE CLOSED ────────────
 *
 * Exposure dominates, and the reason is an oracle, not an aesthetic.
 *
 * If a doubly-blocked series rendered violet (`rights`), then on the day a licence is signed
 * the chip would change from violet to achromatic `COVERAGE GAP`. **That change is itself the
 * disclosure**: it announces to anyone watching that a security gate exists on this series
 * and has just become the binding one. E1's D-1 forbids exactly this — *a security
 * withholding must not be distinguishable from an ordinary absence* — and D-2 forbids routing
 * a security withhold to violet, because violet tells a reader that PAYING would reveal it,
 * which is both false and informative.
 *
 * So `EXPOSURE_REFUSED` renders `COVERAGE GAP` **whatever rights say**, and the licence
 * changes nothing a reader can see. That is the property, and `energy-disclosure.spec.ts`
 * asserts it by comparing the two reader states rather than by asserting a label.
 */

/** Axis 1 — G's lane. Whether we may lawfully use and display the series. */
export const RIGHTS_DISPOSITIONS = ['RIGHTS_UNKNOWN', 'RIGHTS_BLOCKED', 'RIGHTS_ALLOWED'] as const;
export type RightsDisposition = (typeof RIGHTS_DISPOSITIONS)[number];

/** Axis 2 — E1's lane. Whether we should expose it, at this precision, at all. */
export const EXPOSURE_DISPOSITIONS = [
  'EXPOSURE_NOT_ASSESSED',
  'EXPOSURE_REFUSED',
  'EXPOSURE_ALLOWED',
] as const;
export type ExposureDisposition = (typeof EXPOSURE_DISPOSITIONS)[number];

/**
 * Both floors claim the least. Neither is a default: a record must carry both explicitly.
 * *"The fallback must always represent the most ignorant state, never the most reassuring"* —
 * the landed `shared/src/security/absence.ts`, reused.
 */
export const RIGHTS_FLOOR: RightsDisposition = 'RIGHTS_UNKNOWN';
export const EXPOSURE_FLOOR: ExposureDisposition = 'EXPOSURE_NOT_ASSESSED';

/** Both fields required. There is no constructor that takes one. */
export interface SeriesDisclosure {
  readonly rights: RightsDisposition;
  readonly exposure: ExposureDisposition;
}

/**
 * The reader-facing absence state, per Part XI's four-state pattern.
 * `UNAVAILABLE_LICENSED` is the violet entitlement chip and means entitlement AND NOTHING ELSE.
 */
export type ReaderAvailability =
  | 'AVAILABLE'
  | 'COVERAGE_GAP'
  | 'UNAVAILABLE_LICENSED';

/**
 * The ONLY way availability is computed. It takes the whole record, positionally required.
 *
 * There is deliberately no `isAvailable(rights)` and no optional second parameter: a caller
 * cannot compute availability from rights alone, because no function exists that would let
 * it. A rule that lives in a parameter list cannot be forgotten by a caller who has not read
 * the comment.
 */
export function readerAvailability(disclosure: SeriesDisclosure): ReaderAvailability {
  // Exposure dominates. See the docblock: the alternative is an oracle.
  if (disclosure.exposure !== 'EXPOSURE_ALLOWED') return 'COVERAGE_GAP';
  if (disclosure.rights !== 'RIGHTS_ALLOWED') return 'UNAVAILABLE_LICENSED';
  return 'AVAILABLE';
}

/**
 * Whether granting rights alone would change what a reader sees. It must never, unless
 * exposure was already allowed.
 *
 * Exported so the property is testable directly rather than inferred from a label, and so a
 * future refactor that breaks it breaks a named function.
 */
export function rightsGrantIsReaderVisible(disclosure: SeriesDisclosure): boolean {
  const before = readerAvailability(disclosure);
  const after = readerAvailability({ ...disclosure, rights: 'RIGHTS_ALLOWED' });
  return before !== after;
}

/* ══════════════════════════════════════════════════════════════════════════
   §C — THE E1 HOLDS, ENCODED
   ══════════════════════════════════════════════════════════════════════════ */

export const ENERGY_HELD_CAPABILITIES = [
  'MONITOR_NEXT',
  'COMPOSITE_REGIONAL_WATCH',
  'UNIT_LEVEL_OUTAGE_DETAIL',
  'FACILITY_IDENTITY_PRODUCER',
] as const;
export type EnergyHeldCapability = (typeof ENERGY_HELD_CAPABILITIES)[number];

export type CapabilityStatus = 'HOLD' | 'CLEARED';

/**
 * Every held capability, with the ruling that holds it. Carried as data so a guard asserts
 * against a name, and so lifting a hold is a visible edit to an authority table rather than
 * a deleted condition in a branch.
 */
export const ENERGY_CAPABILITY_STATUS: Readonly<
  Record<EnergyHeldCapability, { readonly status: CapabilityStatus; readonly ruling: string }>
> = {
  MONITOR_NEXT: { status: 'HOLD', ruling: 'E04 — a ranked list of what to watch is a ranked list of what is under-observed' },
  COMPOSITE_REGIONAL_WATCH: { status: 'HOLD', ruling: 'E02-5 — a reader-assembled set is a platform-maintained infrastructure watchlist' },
  UNIT_LEVEL_OUTAGE_DETAIL: { status: 'HOLD', ruling: 'E1-ENERGY-1 — availability is not geometry; the assembly is the breach' },
  FACILITY_IDENTITY_PRODUCER: { status: 'HOLD', ruling: 'E1-ENERGY-2 — a facility-dimensioned series is an observation programme' },
};

/** Licensed and sensitive series are held by default; a licence does not lift it (E03). */
export const LICENSED_SENSITIVE_SERIES_DEFAULT: ExposureDisposition = 'EXPOSURE_NOT_ASSESSED';

/**
 * E01 — geometry may be displayable where register-derived. Operational state is a SEPARATE
 * axis and is separately governed.
 *
 * E01-3 and EN1-4 are the same condition seen from two sides, and E1 wrote both so that
 * neither ruling could be read alone. This function is where they meet: **the refusal is of
 * the COUPLING, not of either part.** Public coordinates are not permission to expose
 * operational condition.
 */
export interface GeometryPresentation {
  readonly registerDerived: boolean;
  readonly precision: 'CORRIDOR' | 'ROUTE' | 'ASSET' | 'REGION';
}

export type CouplingDecision =
  | { readonly kind: 'GEOMETRY_ONLY' }
  | { readonly kind: 'REFUSED'; readonly reason: 'ENE_GEOMETRY_NOT_REGISTER_DERIVED' }
  | { readonly kind: 'REFUSED'; readonly reason: 'ENE_GEOMETRY_AVAILABILITY_COUPLING' };

/**
 * Takes both facts because the decision is about both. A signature that took only the
 * geometry could not express the rule, which is precisely how this gets lost.
 */
export function decideAssetPresentation(
  geometry: GeometryPresentation,
  carriesOperationalAvailability: boolean,
): CouplingDecision {
  if (geometry.precision === 'ASSET' && !geometry.registerDerived) {
    return { kind: 'REFUSED', reason: 'ENE_GEOMETRY_NOT_REGISTER_DERIVED' };
  }
  if (geometry.precision === 'ASSET' && carriesOperationalAvailability) {
    return { kind: 'REFUSED', reason: 'ENE_GEOMETRY_AVAILABILITY_COUPLING' };
  }
  return { kind: 'GEOMETRY_ONLY' };
}
