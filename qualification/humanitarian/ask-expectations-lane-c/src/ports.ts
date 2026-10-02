import type { ClassifiedClaim, SinkPayloads } from './disclosure.js';

/**
 * HUMANITARIAN CANONICAL ASK TOOL / ROUTER BINDING R1 — CONTRACT
 *
 * Lane: Claude C — core intel router and tool engine, the `ask-router/frozen-c` lane.
 * Class: CONTRACT AND CORPUS. No repository integration. No branch. No merge. No deploy.
 *
 * THE MISSION CONSTRAINT, restated because it is the thing easiest to violate by accident:
 *
 *   "DO NOT create a separate Humanitarian chatbot. DO NOT call OpenAI directly from the
 *    module."
 *
 * So nothing here executes, retrieves, or answers. This is a READ PORT plus a REGISTRATION
 * RULE. Canonical Ask V2 remains the only engine; the Humanitarian domain becomes one more
 * specialist tool it may consult, on the same terms as every other.
 *
 * WHAT IS CARRIED, NOT MEASURED. This session has no repository access, so every fact about
 * landed code below is carried from the register and attributed in `docs/02-LIMITS.md`.
 * Nothing was re-measured. In particular `ask-router/frozen-c` is reported in-tree by E1's
 * post-integration verification; I did not read it.
 */

/* ------------------------------------------------------------------ *
 * 1 · AVAILABILITY — the five accepted absence states, plus AVAILABLE
 * ------------------------------------------------------------------ */

/**
 * `MAIN-COUNTRY-INTELLIGENCE-CANONICAL-REUSE-AUDIT-R1` reuses five accepted absence states
 * "and the CTO ruling that they must not collapse into one word. `AVAILABLE` is the sixth
 * state and the only one that permits a value."
 *
 * CONFLICT REPORTED, NOT RESOLVED. Contract 4 asks for `NOT_ASSESSED`, which is NOT one of
 * the five. Minting it would be the collapse that ruling exists to prevent, in reverse — a
 * sixth absence word for a state the vocabulary already distinguishes. This contract
 * therefore uses `NOT_CONNECTED` for today's Humanitarian state and records the divergence
 * in `docs/01-CONFLICTS.md` as C-H2 rather than choosing silently.
 */
export type AvailabilityState =
  | 'AVAILABLE'
  | 'NOT_BUILT'
  | 'NOT_CONNECTED'
  | 'NO_DATA_FOR_GEOGRAPHY'
  | 'TIER_RESTRICTED'
  | 'TEMPORARILY_UNAVAILABLE';

export const AVAILABILITY_STATES: readonly AvailabilityState[] = [
  'AVAILABLE',
  'NOT_BUILT',
  'NOT_CONNECTED',
  'NO_DATA_FOR_GEOGRAPHY',
  'TIER_RESTRICTED',
  'TEMPORARILY_UNAVAILABLE',
];

/**
 * Binds the runtime array to the type union so the two cannot drift. Adding a word to
 * `AvailabilityState` without adding it here is a compile error — the drift class E1 found in
 * `AUTHENTICATED_API_FAMILIES`, prevented rather than probed for.
 */
const AVAILABILITY_EXHAUSTIVE: Record<AvailabilityState, true> = {
  AVAILABLE: true,
  NOT_BUILT: true,
  NOT_CONNECTED: true,
  NO_DATA_FOR_GEOGRAPHY: true,
  TIER_RESTRICTED: true,
  TEMPORARILY_UNAVAILABLE: true,
};

/** Probe AS-1 compares this against AVAILABILITY_STATES, so neither may drop a member. */
export const AVAILABILITY_FROM_UNION: readonly AvailabilityState[] = Object.keys(
  AVAILABILITY_EXHAUSTIVE,
) as AvailabilityState[];

/** Only this state permits a value to be carried. Asserted by probe A-1. */
export function permitsValue(state: AvailabilityState): boolean {
  return state === 'AVAILABLE';
}

/* ------------------------------------------------------------------ *
 * 1b · ASSESSMENT — a SECOND, ORTHOGONAL AXIS (Development III)
 * ------------------------------------------------------------------ */

/**
 * `CONTRACT 2 §E` (Claude A's lane) requires that Humanitarian answers distinguish
 * `CURRENT_PROVIDER_OBSERVATION · RETAINED_REPORTING · NOT_ASSESSED · SOURCE_UNAVAILABLE`,
 * and the programme instructions state that **"NOT_ASSESSED must never silently become
 * 'nothing happened'"**.
 *
 * THIS RESOLVES C-H2, AND THE RESOLUTION IS THAT THERE ARE TWO AXES, NOT ONE WORD.
 * The earlier revision of this package refused to carry `NOT_ASSESSED` because it is not one
 * of the five accepted ABSENCE states and the standing ruling forbids collapsing those. That
 * reasoning was correct about availability and wrong about the question being asked:
 *
 *   AvailabilityState — can the capability be read at all?  (platform/binding axis)
 *   AssessmentState   — did an admitted source assess this? (humanitarian evidence axis)
 *
 * Conflating them is what would have produced the collapse. Carrying both keeps
 * "we cannot reach the humanitarian store" distinct from "no admitted source has assessed
 * impact here", which are different facts a reader must never see merged.
 *
 * VOCABULARY DEPENDENCY, NOT INVENTION. These four values are Contract 2 §E's, consumed as a
 * documented fixture because Claude A's lane owns them. If A lands a different spelling, this
 * union is the single place to change. Recorded in HANDOFF.md.
 */
export type AssessmentState =
  | 'CURRENT_PROVIDER_OBSERVATION'
  | 'RETAINED_REPORTING'
  | 'NOT_ASSESSED'
  | 'SOURCE_UNAVAILABLE';

const ASSESSMENT_EXHAUSTIVE: Record<AssessmentState, true> = {
  CURRENT_PROVIDER_OBSERVATION: true,
  RETAINED_REPORTING: true,
  NOT_ASSESSED: true,
  SOURCE_UNAVAILABLE: true,
};

export const ASSESSMENT_STATES: readonly AssessmentState[] = Object.keys(
  ASSESSMENT_EXHAUSTIVE,
) as AssessmentState[];

/**
 * **`CURRENT_PROVIDER_OBSERVATION` IS UNREACHABLE FROM THIS ADAPTER, BY CONSTRUCTION, AND THAT
 * IS A FINDING THE PROGRAMME NEEDS.**
 *
 * Contract 4 §F separates acquisition from Ask execution: Ask reads RETAINED data and must not
 * cause a provider fetch. An answer assembled from retained rows is therefore
 * `RETAINED_REPORTING` — **never** a current provider observation, however fresh the rows are.
 * Labelling an Ask answer as a current provider observation would claim a live reading that
 * no Ask turn performed. Probe AX-3 asserts this adapter can never emit it.
 */
export const ASSESSMENT_UNREACHABLE_HERE: readonly AssessmentState[] = [
  'CURRENT_PROVIDER_OBSERVATION',
];

/**
 * The availability → assessment mapping, as data so it can be reviewed in one place.
 *
 * `NOT_CONNECTED` and `TEMPORARILY_UNAVAILABLE` both mean the humanitarian evidence could not
 * be consulted, so both are `SOURCE_UNAVAILABLE` — NOT `NOT_ASSESSED`. That distinction is the
 * whole point: an unreachable store must never report that nothing was assessed, because that
 * is the sentence a reader hears as "nothing happened".
 */
export function assessmentFor(state: AvailabilityState): AssessmentState {
  if (state === 'AVAILABLE') return 'RETAINED_REPORTING';
  if (state === 'NO_DATA_FOR_GEOGRAPHY') return 'NOT_ASSESSED';
  return 'SOURCE_UNAVAILABLE';
}

/* ------------------------------------------------------------------ *
 * 2 · REFUSAL CODES — codes only; the frontend owns every word
 * ------------------------------------------------------------------ */

export type HumRefusalCode =
  /** The specialist registry does not carry HUMANITARIAN. */
  | 'SPECIALIST_NOT_REGISTERED'
  /** Registered, but no callable governed retained read. `registered != bound`. */
  | 'SPECIALIST_NOT_BOUND'
  /** The store exists and is bound, but holds nothing for this geography. */
  | 'NO_DATA_FOR_GEOGRAPHY'
  /** The read could not be served this time. Distinct from having no data. */
  | 'TEMPORARILY_UNAVAILABLE'
  /** A read was requested at a precision the platform must not produce. */
  | 'PRECISION_ABOVE_PRODUCIBLE_CEILING'
  /**
   * RETIRED in R2 and kept in the union deliberately. C-H1 closed when Main landed the
   * observationKey identity, so this is no longer reachable — probe OK-3 asserts no code path
   * emits it. It is retained rather than deleted so a reviewer of the R1 package can see the
   * code was retired rather than renamed, and so a reintroduced key-format check would have to
   * add a NEW code instead of quietly reusing this one.
   */
  | 'OBSERVATION_KEY_CONSTRUCT_ABSENT'
  /** Acquisition was implied by an Ask. Refused: acquisition and Ask execution are separate. */
  | 'ACQUISITION_NOT_PERMITTED_FROM_ASK'
  /**
   * The retained read port returned something its own contract forbids — an unsourced claim,
   * most importantly. Fails closed and loudly. This is the ONE code minted beyond the
   * contract's vocabulary, and the reasoning is recorded as C-H5: a port is an integration
   * seam, a TypeScript type does not bind it at runtime, and the alternatives were to drop
   * the offending member silently (forbidden by ruling 2's no-silent-narrowing) or to serve
   * an unsourced humanitarian claim (forbidden outright).
   */
  | 'READ_CONTRACT_VIOLATION';

/* ------------------------------------------------------------------ *
 * 3 · THE READ REQUEST — stable identifiers only
 * ------------------------------------------------------------------ */

/**
 * Contract 4 asks for "stable identifiers such as observation/event key, country ISO3,
 * bounded time window if the contract already supports it."
 *
 * TWO OF THE THREE ARE AVAILABLE TODAY AND ONE IS NOT:
 *
 *  - `countryIso3` — AVAILABLE. `ResolvedArticleGeography.countryIso3` is, in its own file's
 *    words, "the join-key expectation", and the identity table is a closed set of 196.
 *  - `window` — AVAILABLE as the READER'S TEXT, never as a parsed instant. Same ruling as
 *    `SnapshotRetrieval.referencePeriod` and `time.statedPeriod`: the storage type must never
 *    be more precise than the fact.
 *  - `observationKey` — **NOT AVAILABLE.** Main measured that none of `DomainObservation`,
 *    `CanonicalOccurrence`, `facetKey` or `assertSingleOccurrenceAcrossDomains` is landed in
 *    `shared/src`, that "the join key exists; the rows do not", and ruled that
 *    "neither surface should invent its own." So this contract accepts the field, refuses to
 *    mint a format for it, and returns `OBSERVATION_KEY_CONSTRUCT_ABSENT` if one is supplied.
 *    Reported as C-H1.
 */
export interface HumanitarianReadRequest {
  readonly countryIso3: string;
  /**
   * **Main's observationKey identity, consumed OPAQUELY.**
   *
   * C-H1 is closed: Main's identity is the authority now. This adapter therefore never parses,
   * splits, pattern-matches, normalises, lowercases or validates the shape of a key — it
   * compares and orders them by exact bytes and nothing else. Opacity is what lets lane C use
   * an identity whose FORMAT belongs to another lane without re-inventing it, and it means
   * whatever spelling Main landed works here unchanged. Probe OK-2 asserts no parsing construct
   * is applied to a key anywhere in `src/`.
   */
  readonly observationKeys?: readonly string[];
  /** The reader's own phrase for the window. Never parsed, never normalised. */
  readonly statedWindow?: string;
  /**
   * The question kind, supplied by the router envelope. NOT derived here — Main:
   * "There is no mapping from a user's words to a QuestionKind ... Intent classification is
   * a separate contract." This lane adds no classifier (frozen-c ruling 6).
   */
  readonly questionKind: string;
}

/* ------------------------------------------------------------------ *
 * 4 · THE READ RESULT — claims by reference, never fabricated values
 * ------------------------------------------------------------------ */

/**
 * A source reference. The claim cites retained evidence; it never carries the evidence.
 */
export interface HumSourceRef {
  readonly articleRef: string;
  readonly countryIso3: string;
}

/**
 * Reuses the accepted `SPECIALIST` body primitive from H's handoff contract —
 * `{ domainId, questionKind, assessment: SourcedClaim[], registryState }`. A claim carries
 * its sources or it is not a claim.
 *
 * PROTECTED-LOCATION RULES BIND THIS TYPE. The accepted Humanitarian rulings are:
 * E1 CG-1 removed the per-record protected member; a protected aggregation must be
 * BYTE-IDENTICAL to an ordinary one; precision is role-invariant; there is no geometry path;
 * and no severity, count or location may be fabricated. So this type carries no coordinate,
 * no geometry, no per-record protection marker and no role.
 */
export interface SourcedHumClaim {
  readonly claim: string;
  readonly sources: readonly HumSourceRef[];
  /** The coarsest scope the platform may state. Never finer than the producible ceiling. */
  readonly scope: 'COUNTRY' | 'REGION';
  /** Reader's own words for the as-of period. Never a parsed instant. */
  readonly asOfStated: string | null;
}

/**
 * What the retained read PORT returns. Distinct from `HumanitarianReadResult` on purpose: the
 * port hands over CLASSIFIED evidence, and only the adapter may turn that into anything a sink
 * can see. Because the two types differ, a port output cannot be handed to a caller by accident —
 * the compiler refuses it.
 */
export interface RetainedReadOutput {
  readonly state: AvailabilityState;
  readonly assessment: AssessmentState;
  /** Every admitted claim WITH its disclosure class. May contain non-reader-safe members. */
  readonly classified: readonly ClassifiedClaim[];
  readonly refusal: HumRefusalCode | null;
}

export interface HumanitarianReadResult {
  readonly state: AvailabilityState;
  /**
   * The evidence axis, always present. Never omitted and never defaulted, so a consumer cannot
   * silently read absence as reassurance.
   */
  readonly assessment: AssessmentState;
  /**
   * READER-SAFE claims only. Non-empty only when state is AVAILABLE. Anything the disclosure
   * guard withheld is absent here and absent from `sinks`.
   */
  readonly claims: readonly SourcedHumClaim[];
  /** The five sink payloads, each built from the releasable partition only. */
  readonly sinks: SinkPayloads;
  /**
   * AUDIT ONLY — a count, never identifiers or text, and never reader-facing. Probe DG-4
   * asserts it reaches no sink.
   */
  readonly withheldTotal: number;
  /** The frozen Ask terminal when Humanitarian is unavailable. */
  readonly askTerminal: 'CAPABILITY_UNAVAILABLE' | null;
  readonly refusal: HumRefusalCode | null;
  /** Identity material for the platform to hash. This module computes no hash. */
  readonly identity: HumanitarianToolIdentity;
}

/* ------------------------------------------------------------------ *
 * 5 · THE GOVERNED RETAINED READ PORT
 * ------------------------------------------------------------------ */

/**
 * The port Ask consults. Two facts are deliberately separate, because the register shows
 * this is exactly where the product has gone wrong before:
 *
 *   `registered` — the specialist registry carries the domain.
 *   `governed`   — a REAL governed retained store is bound and readable.
 *
 * F measured Support handing Conflict questions to a rail with 0 non-spec referrers;
 * E1 ruled for Humanitarian that "an empty authority is not equivalent to a real governed
 * store ... an empty dark set protects nothing while looking exactly like one that protects
 * everything." So a stub that answers is not a bound store, and this port must say which it
 * is rather than letting an empty answer stand in for a governed one.
 *
 * NO NETWORK CAPABILITY. The port reads retained data. It performs no acquisition, holds no
 * provider, and probe N-1 asserts `src/` contains no fetch, http or provider symbol —
 * the same discipline as F's V-7 ("parsers have no network capability").
 */
export interface HumanitarianRetainedReadPort {
  /** True only for a real governed bound store. A stub must report false. */
  readonly governed: boolean;
  read(request: HumanitarianReadRequest): RetainedReadOutput;
}

/* ------------------------------------------------------------------ *
 * 6 · IDENTITY — participates in the platform's existing identity chain
 * ------------------------------------------------------------------ */

/**
 * Contract 4 §E: the Humanitarian context/tool identity must participate in `requestHash`,
 * `planRevision`, `fingerprint` and the durable plan, with no cross-country or
 * cross-observation reuse.
 *
 * THIS MODULE COMPUTES NO HASH. It emits deterministic identity MATERIAL and the platform
 * hashes it, because minting a second hash would be a second identity space. Probe I-3
 * asserts no hash primitive appears in `src/`.
 */
export interface HumanitarianToolIdentity {
  readonly domainId: 'HUMANITARIAN';
  readonly countryIso3: string;
  /** Sorted and deduplicated, so member order cannot change identity. */
  readonly observationKeys: readonly string[];
  readonly statedWindow: string | null;
  readonly questionKind: string;
  /**
   * The reader contract revision. Feeds `planRevision`: a reader change must invalidate a
   * durable plan rather than silently serving a plan built against the old reader. The
   * landed `ASK_PLAN_REVISION_MISMATCH` refusal is what consumes it.
   */
  readonly readerRevision: string;
}

/** The current reader contract revision. Bump on any change to the read shape. */
export const HUMANITARIAN_READER_REVISION = 'hum-reader-r1';

/**
 * The U+001F unit separator is load-bearing and is NOT a choice made here. Main's transport
 * record ruling: "The U+001F separator is load-bearing (it exists so `('country:RWA','x')`
 * and `('country:RW','Ax')` cannot collide); any new dimension goes through the same
 * separated encoding, never concatenation."
 */
export const UNIT_SEPARATOR = '\u001F';

/**
 * `identity.observationKeys` is ALREADY sorted and deduplicated by `buildIdentity`, the only
 * sanctioned constructor. It is deliberately NOT re-normalised here: defect D-1 was that
 * normalising in both places made each mask a defect in the other, so mutation MU-8 survived
 * and probe I-5 was decoration. One normalisation point, named. Probe I-9 pins it.
 */
export function identityMaterial(identity: HumanitarianToolIdentity): string {
  const keys = identity.observationKeys.join(',');
  return [
    `domain:${identity.domainId}`,
    `country:${identity.countryIso3}`,
    `observations:${keys}`,
    `window:${identity.statedWindow ?? ''}`,
    `kind:${identity.questionKind}`,
    `reader:${identity.readerRevision}`,
  ].join(UNIT_SEPARATOR);
}

/* ------------------------------------------------------------------ *
 * 7 · TOOL REGISTRATION
 * ------------------------------------------------------------------ */

/**
 * Contract 4 §B: "Humanitarian becomes a registered specialist tool ONLY when its reader has
 * real governed retained data. If no data: return NOT_ASSESSED / capability unavailable
 * truthfully."
 *
 * The contract is self-answering for today's state. E1's Humanitarian activation review
 * records that activation "remains blocked until the real database binding is implemented
 * and re-tested", that the producer is not committed, and that `gx14-authority-store.sql`
 * has not been applied. So today the honest answer is NOT registered as a bound tool, and
 * Ask reports capability unavailable.
 */
export interface HumanitarianToolBinding {
  readonly domainId: 'HUMANITARIAN';
  /** Does the specialist registry carry the domain? */
  readonly registered: boolean;
  /** Is a real governed retained read bound and readable? Registered does not imply bound. */
  readonly bound: boolean;
  readonly availability: AvailabilityState;
  readonly refusal: HumRefusalCode | null;
  /**
   * True only when Ask may plan a Humanitarian specialist execution. Mirrors the frozen
   * router's ruling 4: no specialist execution plan is emitted until a callable seam is
   * proven.
   */
  readonly executionPlannable: boolean;
}

/* ------------------------------------------------------------------ *
 * 8 · PROVIDER BUDGET — acquisition is a different lane from Ask
 * ------------------------------------------------------------------ */

/**
 * Contract 4 §F: Ask reads retained data first and must not cause an uncontrolled new
 * humanitarian provider fetch per Ask. Acquisition and Ask execution are separate.
 *
 * Expressed structurally rather than as advice: the read port has no network capability at
 * all (§5), and a request that would require acquisition is REFUSED with
 * `ACQUISITION_NOT_PERMITTED_FROM_ASK` rather than queued, deferred or silently fulfilled.
 */
export interface ReadBudgetDecision {
  readonly retainedFirst: true;
  readonly providerFetchPermitted: false;
  readonly refusal: HumRefusalCode | null;
}
