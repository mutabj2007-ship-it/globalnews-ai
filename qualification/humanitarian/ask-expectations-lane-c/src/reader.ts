/**
 * HUMANITARIAN SPECIALIST READ ADAPTER — Contract 4 §A, §B, §E, §F
 *
 * One decision per line, total by construction. This is the frozen router's `classify.ts`
 * discipline carried forward: Main required "one derivation step per line" there so that a
 * missing case is a visible missing line rather than an implicit fallthrough, and the same
 * argument applies to an adapter whose job is to refuse correctly.
 *
 * THIS FILE CALLS NOTHING. No fetch, no provider, no model, no clock, no randomness, no
 * environment variable. Probe N-1 asserts that as a source-text property with a negative
 * control.
 */

import {
  everythingWithheld,
  partitionByDisclosure,
  projectToSinks,
  type DisclosurePartition,
} from './disclosure.js';
import {
  type AssessmentState,
  type AvailabilityState,
  type HumRefusalCode,
  type HumanitarianReadRequest,
  type HumanitarianReadResult,
  type HumanitarianRetainedReadPort,
  type HumanitarianToolBinding,
  type HumanitarianToolIdentity,
  type SourcedHumClaim,
  HUMANITARIAN_READER_REVISION,
  assessmentFor,
  permitsValue,
} from './ports.js';

/* ------------------------------------------------------------------ *
 * Identity
 * ------------------------------------------------------------------ */

export function buildIdentity(request: HumanitarianReadRequest): HumanitarianToolIdentity {
  return {
    domainId: 'HUMANITARIAN',
    countryIso3: request.countryIso3,
    observationKeys: [...new Set(request.observationKeys ?? [])].sort(),
    statedWindow: request.statedWindow ?? null,
    questionKind: request.questionKind,
    readerRevision: HUMANITARIAN_READER_REVISION,
  };
}

/** The empty sink set. A refusal hands every sink nothing — not a filtered something. */
const NO_SINKS = projectToSinks({
  releasable: [],
  withheldCountsByClass: {
    READER_SAFE: 0,
    INTERNAL_ONLY: 0,
    PROTECTED_LOCATION: 0,
    WITHHELD: 0,
  },
  withheldTotal: 0,
});

function refuse(
  identity: HumanitarianToolIdentity,
  state: AvailabilityState,
  refusal: HumRefusalCode,
  withheldTotal = 0,
): HumanitarianReadResult {
  // `assessmentFor` is the single mapping point, so no call site can pick a flattering word.
  return {
    state,
    assessment: assessmentFor(state),
    claims: [],
    sinks: NO_SINKS,
    withheldTotal,
    refusal,
    askTerminal: 'CAPABILITY_UNAVAILABLE',
    identity,
  };
}

/* ------------------------------------------------------------------ *
 * The scope ceiling
 * ------------------------------------------------------------------ */

/**
 * The coarsest-permitted-scope rule, carried from the accepted Humanitarian protected-location
 * rulings: there is no geometry path, precision is role-invariant, and no location may be
 * fabricated. COUNTRY and REGION are the only scopes this adapter will carry; anything finer
 * arriving from the port is refused rather than clamped, because clamping would silently
 * narrow a claim and ruling 2 forbids silent narrowing.
 */
const PRODUCIBLE_SCOPES: readonly string[] = ['COUNTRY', 'REGION'];

function scopeWithinCeiling(claim: SourcedHumClaim): boolean {
  return PRODUCIBLE_SCOPES.includes(claim.scope);
}

/* ------------------------------------------------------------------ *
 * The read
 * ------------------------------------------------------------------ */

export function readHumanitarian(
  port: HumanitarianRetainedReadPort,
  request: HumanitarianReadRequest,
): HumanitarianReadResult {
  const identity = buildIdentity(request);

  // R2: observation keys are ACCEPTED, opaquely. Main's identity is the authority; this adapter
  // never inspects a key's internals, so no check belongs here at all.

  // `registered != bound`, frozen-router ruling 4. A stub that answers is not a governed store;
  // E1: "an empty authority is not equivalent to a real governed store."
  if (!port.governed) {
    return refuse(identity, 'NOT_CONNECTED', 'SPECIALIST_NOT_BOUND');
  }

  const served = port.read(request);

  // Everything below validates the PORT'S answer. A port is an integration seam, and a type
  // does not bind a seam at runtime — these checks are what make the refusals structural
  // rather than advisory.

  if (!permitsValue(served.state)) {
    // Non-AVAILABLE must carry nothing. This is where a fabricated severity or count would
    // otherwise leak through on a refusal path.
    return refuse(identity, served.state, served.refusal ?? refusalForState(served.state));
  }

  if (served.classified.length === 0) {
    // AVAILABLE with nothing admitted is contradictory. The true statement is that the store is
    // bound and holds nothing for this geography, so that is what is reported.
    return refuse(identity, 'NO_DATA_FOR_GEOGRAPHY', 'NO_DATA_FOR_GEOGRAPHY');
  }

  // THE DISCLOSURE GUARD RUNS BEFORE ANY OTHER VALIDATION OF CONTENT, so that a withheld claim
  // cannot fail a later check and have its text appear in a diagnostic. Everything after this
  // line sees `partition.releasable` and never `served.classified`.
  const partition: DisclosurePartition = partitionByDisclosure(served.classified);

  if (everythingWithheld(partition)) {
    // Present but not disclosable. There is no truthful member of the five accepted absence
    // states for this, so it fails closed onto NO_DATA_FOR_GEOGRAPHY and the real reason lives
    // only on the audit count. This preserves E1's byte-identity rule — a protected-only
    // situation is indistinguishable from an empty one — at the cost of reader-facing precision.
    // That trade is deliberate and needs E1 ratification: DISCLOSURE-GUARD.md §4.
    return refuse(identity, 'NO_DATA_FOR_GEOGRAPHY', 'NO_DATA_FOR_GEOGRAPHY', partition.withheldTotal);
  }

  if (partition.releasable.some((c) => c.sources.length === 0)) {
    // A claim carries its sources or it is not a claim. The whole read fails rather than
    // dropping the unsourced member, because dropping it would quietly change the answer.
    return refuse(identity, 'TEMPORARILY_UNAVAILABLE', 'READ_CONTRACT_VIOLATION', partition.withheldTotal);
  }

  if (!partition.releasable.every(scopeWithinCeiling)) {
    return refuse(
      identity,
      'TEMPORARILY_UNAVAILABLE',
      'PRECISION_ABOVE_PRODUCIBLE_CEILING',
      partition.withheldTotal,
    );
  }

  // Identity is rebuilt here, never taken from the port: the port must not be able to influence
  // the identity under which its own answer is cached.
  // RETAINED_REPORTING, never CURRENT_PROVIDER_OBSERVATION: this adapter performs no provider
  // read, so it may not label its answer as one. See ASSESSMENT_UNREACHABLE_HERE.
  const assessment: AssessmentState = assessmentFor('AVAILABLE');
  return {
    state: 'AVAILABLE',
    assessment,
    claims: partition.releasable,
    sinks: projectToSinks(partition),
    withheldTotal: partition.withheldTotal,
    refusal: null,
    askTerminal: null,
    identity,
  };
}

function refusalForState(state: AvailabilityState): HumRefusalCode {
  if (state === 'NO_DATA_FOR_GEOGRAPHY') return 'NO_DATA_FOR_GEOGRAPHY';
  if (state === 'TEMPORARILY_UNAVAILABLE') return 'TEMPORARILY_UNAVAILABLE';
  if (state === 'NOT_BUILT') return 'SPECIALIST_NOT_REGISTERED';
  if (state === 'TIER_RESTRICTED') return 'SPECIALIST_NOT_BOUND';
  return 'SPECIALIST_NOT_BOUND';
}

/* ------------------------------------------------------------------ *
 * Registration — Contract 4 §B
 * ------------------------------------------------------------------ */

/**
 * "Humanitarian becomes a registered specialist tool ONLY when its reader has real governed
 * retained data."
 *
 * Read as: registration follows the BINDING, and per-geography emptiness is a read-time fact.
 * Registering per country would make the registry vary by question, which no landed registry
 * does, and would leak which countries hold humanitarian rows.
 */
export function resolveBinding(port: HumanitarianRetainedReadPort): HumanitarianToolBinding {
  if (!port.governed) {
    return {
      domainId: 'HUMANITARIAN',
      registered: false,
      bound: false,
      availability: 'NOT_CONNECTED',
      refusal: 'SPECIALIST_NOT_BOUND',
      executionPlannable: false,
    };
  }
  return {
    domainId: 'HUMANITARIAN',
    registered: true,
    bound: true,
    availability: 'AVAILABLE',
    refusal: null,
    executionPlannable: true,
  };
}

/** Whether Ask may plan a specialist execution for THIS read. Per-request, not per-binding. */
export function plannableForRead(result: HumanitarianReadResult): boolean {
  return result.state === 'AVAILABLE' && result.claims.length > 0;
}
