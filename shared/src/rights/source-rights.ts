/**
 * ════════════════════════════════════════════════════════════════════════════
 * SOURCE RIGHTS BINDING — ECON-RIGHTS-BINDING-1
 * ════════════════════════════════════════════════════════════════════════════
 *
 * MAIN-ECONOMY-CANONICAL-CLOSEOUT-R1. PROPOSED for `shared/src/rights/source-rights.ts`.
 * Nothing lands without authorization. No source activation. No provider call.
 *
 * ── THE DEFECT, MEASURED ──────────────────────────────────────────────────
 *
 * `E4B_SOURCE_ACTIVATED_WITH_RIGHTS` is documented as *"enabled, an ingestion method,
 * and a recorded E-5 grade with an instrument"*. What the function actually evaluates is
 *
 *     activatedSourceIds ∩ registeredSourceIds ≥ 1
 *
 * — two arrays of strings. **There is no rights input to the condition at all.** The
 * name asserts a check the code does not perform, so a caller that writes an id into
 * `activatedSourceIds` satisfies it, and `enabled = true` is the only thing standing
 * behind that id.
 *
 * `OfficialSourceEntry` has no rights field of any kind. `EUROSTAT_RIGHTS` exists inside
 * the Economy producer, is `{ grade, instrumentRef, payloadRetentionPermitted }`, and is
 * bound to NOTHING — not to a registry id, not to `RIGHTS_RECORDS`, not to the route
 * condition that claims to check it.
 *
 * R-A, in its sharpest form: a guard not shown to bind is not evidence. **Here the guard
 * was never written. Only its name was.**
 *
 * ── WHAT IS REUSED, AND WHAT IS NOT DUPLICATED ────────────────────────────
 *
 * `RightsClass` and the `RightsRecord` SHAPE are promoted from
 * `backend/src/modules/market-ingest/market-acquisition-declarations.ts`, unchanged.
 * Its own SI-17 header states the rule this contract exists to make mechanical:
 *
 *   "A source cannot be activated on a rights position the code cannot see."
 *   "SI-17.4 makes a state without an instrument not a state."
 *   "Absence of a rights record is a refusal, not a permission."
 *
 * The RECORDS are NOT promoted. That module says why, and it is the ownership matrix:
 * *"provider-specific acquisition semantics, which Main's ownership matrix assigns to
 * G."* **Shared owns the contract; the domain lane owns the data.** This file therefore
 * creates NO second rights registry — it creates the binding that was missing between
 * the registry entry and whichever rights table already holds its record.
 */

/* ═══════════════════════════════════════════════════════════════════════════
 * 1 · THE VOCABULARY — PROMOTED VERBATIM, NOT RE-DERIVED
 * ═══════════════════════════════════════════════════════════════════════════ */

export const RIGHTS_CLASSES = ['E-1', 'E-2a', 'E-2b', 'E-3', 'E-4', 'E-5'] as const;
export type RightsClass = (typeof RIGHTS_CLASSES)[number];

/**
 * THE GRADES THAT PERMIT ACTIVATION — A DECLARED SET, DELIBERATELY NOT A LADDER.
 *
 * Every accepted record in the tree carries `E-5`, described as commercial reuse
 * permitted. The semantics of `E-1` … `E-4` are **not measured by this lane**, and
 * ranking them would mint an ordering nobody established — the same mistake as deriving
 * a source class from a subject class. Membership is checked; no order is implied.
 *
 * Widening this set is a rights-lane act with a cited instrument, not a configuration
 * change and not an inference from the fact that a fetch succeeded.
 */
export const GRADES_PERMITTING_ACTIVATION: readonly RightsClass[] = ['E-5'];

/** The SI-17 record shape, promoted unchanged. Keyed for a registry, not for a provider. */
export interface SourceRightsRecord {
  /** The key this record is filed under inside its own authority. */
  readonly rightsRecordKey: string;
  readonly rightsClass: RightsClass;
  /** SI-17.4 — the citable text or URL the class rests on. Empty is not a record. */
  readonly instrument: string;
  /** SI-17.5 — conditions that constrain THE PRODUCT, not the fetch. */
  readonly productConditions: readonly string[];
  readonly publisherRetainsHistory: boolean;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2 · THE BINDING — THE ONE THING THAT WAS MISSING
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A REFERENCE, not a copy. Copying the grade and instrument onto the registry entry
 * would create the second table this contract exists to avoid, and the day the rights
 * lane revised a record the registry would still be asserting the old one.
 */
export interface OfficialSourceRightsBinding {
  /** WHICH rights authority holds the record — e.g. 'ECONOMY_ACQUISITION_RIGHTS'. */
  readonly rightsAuthorityId: string;
  /** The key that resolves the record inside that authority — e.g. 'EUROSTAT'. */
  readonly rightsRecordKey: string;
}

/**
 * THE DELTA TO `OfficialSourceEntry`:
 *
 *     readonly rights: OfficialSourceRightsBinding | null;
 *
 * REQUIRED, and nullable. Required so an entry cannot be written without deciding;
 * nullable so "this source has no rights binding" is REPRESENTABLE and can therefore be
 * REFUSED. An optional field would let the absence be an oversight; a required nullable
 * one makes it a statement.
 */

/* ═══════════════════════════════════════════════════════════════════════════
 * 3 · FOUR AXES, AND NONE OF THEM IMPLIES ANOTHER — CF §C
 * ═══════════════════════════════════════════════════════════════════════════ */

export const SOURCE_LIFECYCLE_AXES = [
  /** E-4a. The entry exists in the official-source registry. */
  'REGISTERED',
  /** The entry names a rights authority and a record key. */
  'RIGHTS_BOUND',
  /** That record resolves, carries a grade, and carries a non-empty instrument. */
  'RIGHTS_EVALUATED',
  /** The operator turned it on and named how it is ingested. */
  'ACTIVATED',
] as const;
export type SourceLifecycleAxis = (typeof SOURCE_LIFECYCLE_AXES)[number];

export const RIGHTS_REFUSAL_CODES = [
  'RIGHTS-NOT-REGISTERED',
  'RIGHTS-NO-BINDING',
  'RIGHTS-RECORD-UNRESOLVED',
  'RIGHTS-NO-INSTRUMENT',
  'RIGHTS-GRADE-NOT-PERMITTING',
  'RIGHTS-NOT-ENABLED',
  'RIGHTS-NO-INGESTION-METHOD',
] as const;
export type RightsRefusalCode = (typeof RIGHTS_REFUSAL_CODES)[number];

export type SourceIngestionMethod = 'api' | 'rss' | 'manual' | 'none';

/**
 * WHAT THE EVALUATOR SEES — AND WHAT IT DELIBERATELY CANNOT SEE.
 *
 * There is no `httpStatus`, no `response`, no `lastFetchSucceeded`, no `reachable` and
 * no clock. **"Do not infer rights from successful HTTP access" is enforced by the
 * signature**: the evaluator is not given access to the fact of access, so there is no
 * branch it could take on it and none that could be added without widening this type in
 * public.
 */
export interface SourceActivationEvidence {
  readonly sourceId: string;
  /** The registry resolved this id. E-4a's whole content. */
  readonly registered: boolean;
  /** The entry's binding, or `null` where it names none. */
  readonly binding: OfficialSourceRightsBinding | null;
  /** The record the binding resolved to, or `null` where the authority holds none. */
  readonly resolvedRecord: SourceRightsRecord | null;
  readonly enabled: boolean;
  readonly ingestionMethod: SourceIngestionMethod;
}

export interface SourceRightsVerdict {
  readonly sourceId: string;
  /** Every axis that holds. An axis absent from this list did not hold. */
  readonly axesSatisfied: readonly SourceLifecycleAxis[];
  /** Every refusal, in evaluation order. EMPTY means and only means fully activated. */
  readonly refusals: readonly RightsRefusalCode[];
  readonly activatedWithRights: boolean;
}

/**
 * ALL FOUR AXES ARE EVALUATED, AND EVERY REFUSAL IS COLLECTED.
 *
 * Deliberately NOT short-circuiting. An operator who fixes one blocker and re-runs
 * should learn about the second one now, not on the next attempt — and a verdict that
 * names only the first failure teaches that the others do not exist.
 */
export function evaluateSourceRights(e: SourceActivationEvidence): SourceRightsVerdict {
  const axes: SourceLifecycleAxis[] = [];
  const refusals: RightsRefusalCode[] = [];

  /* AXIS 1 — REGISTERED. */
  if (e.registered) axes.push('REGISTERED');
  else refusals.push('RIGHTS-NOT-REGISTERED');

  /* AXIS 2 — RIGHTS_BOUND. Registration does not imply a binding. */
  const bound =
    e.binding !== null &&
    e.binding.rightsAuthorityId.trim().length > 0 &&
    e.binding.rightsRecordKey.trim().length > 0;
  if (bound) axes.push('RIGHTS_BOUND');
  else refusals.push('RIGHTS-NO-BINDING');

  /* AXIS 3 — RIGHTS_EVALUATED. A binding that resolves to nothing is not a rights state. */
  let evaluated = false;
  if (e.resolvedRecord === null) {
    refusals.push('RIGHTS-RECORD-UNRESOLVED');
  } else {
    let ok = true;
    if (e.resolvedRecord.instrument.trim().length === 0) {
      refusals.push('RIGHTS-NO-INSTRUMENT');
      ok = false;
    }
    if (GRADES_PERMITTING_ACTIVATION.indexOf(e.resolvedRecord.rightsClass) === -1) {
      refusals.push('RIGHTS-GRADE-NOT-PERMITTING');
      ok = false;
    }
    /*
      THE BINDING MUST POINT AT THE RECORD IT RESOLVED. A record resolved under a
      different key is a record about a different source, and nothing else in the chain
      would notice.
    */
    if (bound && e.binding !== null && e.resolvedRecord.rightsRecordKey !== e.binding.rightsRecordKey) {
      refusals.push('RIGHTS-RECORD-UNRESOLVED');
      ok = false;
    }
    evaluated = ok;
  }
  if (evaluated) axes.push('RIGHTS_EVALUATED');

  /* AXIS 4 — ACTIVATED. `enabled = true` is ONE of four, and on its own it is nothing. */
  let activated = true;
  if (!e.enabled) {
    refusals.push('RIGHTS-NOT-ENABLED');
    activated = false;
  }
  if (e.ingestionMethod === 'none') {
    refusals.push('RIGHTS-NO-INGESTION-METHOD');
    activated = false;
  }
  if (activated) axes.push('ACTIVATED');

  return {
    sourceId: e.sourceId,
    axesSatisfied: axes,
    refusals,
    /*
      E4B holds only when ALL FOUR hold. Derived from the axis list rather than restated
      as a second boolean expression — a second expression would drift from the first the
      day an axis was added, and both would look correct in isolation.
    */
    activatedWithRights: SOURCE_LIFECYCLE_AXES.every((a) => axes.indexOf(a) !== -1),
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4 · THE ROUTE-ELIGIBILITY DELTA — THE LYING FIELD IS REMOVED, NOT AUGMENTED
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `EconomyRouteEvidence.activatedSourceIds: readonly string[]` is DELETED.
 *
 * Adding a rights field beside it would leave the id list reachable, and a caller that
 * kept populating it would keep satisfying a condition it had never evidenced. Deleting
 * it means the old call site DOES NOT COMPILE, which is the only form of this fix that
 * cannot be skipped:
 *
 *   A rule that lives in a parameter list cannot be forgotten by a caller who has not
 *   read the comment.
 *
 * In its place:
 *
 *     readonly activatedSources: readonly SourceActivationEvidence[];
 *
 * and `E4B_SOURCE_ACTIVATED_WITH_RIGHTS` becomes:
 *
 *     const registered = new Set(evidence.registeredSourceIds);
 *     const proven = evidence.activatedSources.filter(
 *       (s) => registered.has(s.sourceId) && evaluateSourceRights(s).activatedWithRights,
 *     );
 *     if (proven.length < 1) blockers.push('E4B_SOURCE_ACTIVATED_WITH_RIGHTS');
 *
 * The SUBSET relation against `registeredSourceIds` is PRESERVED unchanged — its own
 * comment gives the reason and it is still the right one: *"an activated id that is not
 * registered is not a stronger state — it is an id nothing can resolve to a host, which
 * is how a figure ends up attributed to an institution the registry has never heard of."*
 */
