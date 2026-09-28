/**
 * ASK R2 CORE ROUTER — VOCABULARY AND PORTS
 *
 * Authority: MAIN-ASK-INTELLIGENCE-ENGINE-R2 (conceptual architecture approved) as
 * amended by CTO ASK R2 CORE ROUTER PROTOTYPE R1 — CONDITIONAL ACCEPTANCE (2026-09-28),
 * rulings 1-8. Where the two differ, the CTO ruling governs and the difference is named
 * in `docs/01-CONFLICTS.md` rather than absorbed silently.
 *
 * THE GOVERNING RULING (Main, preserved by CTO ruling 6):
 *
 *   "The question is already classified before retrieval. It is classified SIX times,
 *    by five modules ... A seventh classifier would be the worst available answer."
 *
 * Therefore NOTHING in this package classifies a question. The six landed classifiers
 * are consumed through `LandedClassifierReading` as DECLARED INPUT. This file defines
 * the port; it implements no classifier, and probes A-1/A-2/A-3 assert that.
 *
 * SYMBOL DISCIPLINE. Main's probe A-1 refuses fabricated identifiers. This package is
 * authored without a clone of the release line, so it reproduces no landed enum whose
 * members it has not seen measured. Unattested vocabularies are opaque branded strings
 * and the corpus marks any value it invents with the `ILLUSTRATIVE:` prefix.
 */

/* ------------------------------------------------------------------ *
 * 1 · THE SIX LANDED CLASSIFIERS — PORTS, NOT IMPLEMENTATIONS
 * ------------------------------------------------------------------ */

/**
 * `query-intent.util.ts` — 8 members, attested by H's measurement of
 * `classifyQueryIntent` at `30fd936`. Reproduced because measured, not inferred.
 */
export type QueryIntent =
  | 'ARTICLE_ANCHORED'
  | 'MULTI_ENTITY'
  | 'COMPARISON_RESEARCH'
  | 'CLARIFICATION_REQUIRED'
  | 'GEOGRAPHIC_REGIONAL'
  | 'EXPLANATION'
  | 'ENTITY_BACKGROUND'
  | 'CURRENT_EVENT';

export const QUERY_INTENTS: readonly QueryIntent[] = [
  'ARTICLE_ANCHORED',
  'MULTI_ENTITY',
  'COMPARISON_RESEARCH',
  'CLARIFICATION_REQUIRED',
  'GEOGRAPHIC_REGIONAL',
  'EXPLANATION',
  'ENTITY_BACKGROUND',
  'CURRENT_EVENT',
];

/**
 * `detect-analytical-domains.util.ts` — Main measures 8 `AnalyticalDomain` members.
 * Only `security` is attested in the register (L's measured EN/PL/FR/SW/AR row), so the
 * other seven are NOT invented here. Opaque branded string, the same discipline the
 * landed `RegisteredSpecialistDomainId` already uses.
 *
 * E1 area 7 is binding: this vocabulary is DELIBERATELY SEPARATE from
 * `NewsCategory` / `classifyCategory()` and must never import it. CTO ruling: topic and
 * analytical domain are separate axes.
 */
export type AnalyticalDomain = string & { readonly __analyticalDomain: unique symbol };

/** The only member this package claims is landed. */
export const ATTESTED_ANALYTICAL_DOMAINS: readonly string[] = ['security'];

export const ILLUSTRATIVE_PREFIX = 'ILLUSTRATIVE:';

export function isIllustrative(value: string): boolean {
  return value.startsWith(ILLUSTRATIVE_PREFIX);
}

/** `derive-source-attributed-query.util.ts` — structural only; REV C frame. */
export interface SourceAttributedReading {
  /** Did the publisher frame parse? An unparsed frame must NOT resume ordinary routing. */
  readonly parsed: boolean;
  /** Publisher the reader named, verbatim. Never resolved here. */
  readonly namedPublisher: string | null;
}

/** `event-anchor.ts` — `EventQuestionAspects`, structural only. */
export interface EventAnchorReading {
  readonly hasEventAnchor: boolean;
  readonly aspectCount: number;
}

/** `conversation-subject.ts` — `ConversationSubjectAnchor`, structural only. */
export interface ConversationSubjectReading {
  readonly hasPriorQuestion: boolean;
  /** Derived from the PRIOR question only, so a first-turn topic has no source (G B-1). */
  readonly focusFromPriorQuestion: readonly string[];
}

/** The six readings, as one declared input to the envelope producer. */
export interface LandedClassifierReading {
  readonly queryIntent: QueryIntent;
  readonly analyticalDomains: readonly string[];
  readonly sourceAttributed: SourceAttributedReading;
  readonly eventAnchor: EventAnchorReading;
  readonly conversationSubject: ConversationSubjectReading;
  /** `AnalysisCoverageContext.questionAsksAboutCoverage` */
  readonly questionAsksAboutCoverage: boolean;
}

/** The six reading names, so a probe can assert the port has exactly six and no seventh. */
export const LANDED_READING_KEYS: readonly string[] = [
  'queryIntent',
  'analyticalDomains',
  'sourceAttributed',
  'eventAnchor',
  'conversationSubject',
  'questionAsksAboutCoverage',
];

/* ------------------------------------------------------------------ *
 * 2 · LANGUAGE
 * ------------------------------------------------------------------ */

export type LanguageTag = string;

/**
 * CTO ruling 7: the derivation-state distinction is preserved, and an
 * unclassified/unsupported language must never silently become current news.
 */
export type LanguageClassification = 'CLASSIFIED' | 'UNCLASSIFIED' | 'UNSUPPORTED';

export interface LanguageAxis {
  readonly questionLanguage: LanguageTag | null;
  readonly classification: LanguageClassification;
  /** Normalization language, EN in v1 (MA §8 layer 2). Declared, never inferred. */
  readonly normalizationLanguage: 'EN';
  /** Display language. Reused unchanged; this router never sets it. */
  readonly responseLanguage: LanguageTag | null;
}

/* ------------------------------------------------------------------ *
 * 3 · IDENTITY — server-verified, never caller-supplied
 * ------------------------------------------------------------------ */

export type IdentityState = 'ANONYMOUS' | 'VERIFIED_ANALYSIS_USER';

export interface IdentityAxis {
  readonly state: IdentityState;
  /** Opaque, server-resolved. Main: identity is "never a caller-supplied value". */
  readonly subjectRef: string | null;
}

/* ------------------------------------------------------------------ *
 * 4 · GEOGRAPHY
 * ------------------------------------------------------------------ */

/**
 * PROVENANCE, NOT SHAPE. CTO correction 1:
 *
 *   "`ENTITY_GEOGRAPHY` is reserved for geography derived from a resolved entity where
 *    the reader did NOT explicitly type that geography."
 *
 * So a place the reader typed is `TYPED_GEOGRAPHY` even when an entity in the same
 * question also resolves to it. Probe `GP-1` asserts no corpus row labels a place named
 * in the question text as entity-derived, which is exactly the error correction 1 caught.
 */
export type GeographySource =
  | 'DECLARED_REGION'
  | 'TYPED_GEOGRAPHY'
  | 'ENTITY_GEOGRAPHY'
  | 'STORY_ANCHOR'
  | 'MAP_GEOGRAPHY_CONTEXT';

/**
 * The producible-precision ladder. `administrative-ladder.contract.ts` is accepted
 * authority and its ceilings govern; E1: do not widen at a call site.
 */
export type SpatialPrecision = 'GLOBAL' | 'REGION' | 'COUNTRY' | 'SUB_NATIONAL';

export const PRECISION_ORDER: readonly SpatialPrecision[] = [
  'GLOBAL',
  'REGION',
  'COUNTRY',
  'SUB_NATIONAL',
];

export interface GeographyCandidate {
  readonly source: GeographySource;
  readonly value: string;
  readonly precision: SpatialPrecision;
}

export interface GeographyAxis {
  readonly candidates: readonly GeographyCandidate[];
  readonly producibleCeiling: SpatialPrecision;
}

/* ------------------------------------------------------------------ *
 * 5 · TOPIC AND ANALYTICAL DOMAIN — SEPARATE AXES (CTO)
 * ------------------------------------------------------------------ */

export type DerivationState =
  | 'DERIVED'
  | 'NOT_DERIVED_LANGUAGE'
  | 'NOT_DERIVED_UNREADABLE'
  | 'DERIVED_EMPTY';

export interface TopicAxis {
  /** The reader's own words. Never a resolved taxonomy member. */
  readonly readerTerms: readonly string[];
  readonly derivedIn: LanguageTag | null;
  readonly derivation: DerivationState;
}

export interface DomainAxis {
  readonly domains: readonly string[];
  readonly derivedIn: LanguageTag | null;
  readonly derivation: DerivationState;
}

/* ------------------------------------------------------------------ *
 * 6 · TIME
 * ------------------------------------------------------------------ */

export type TemporalRequirement =
  | 'NONE'
  | 'RECENT'
  | 'AS_OF_NOW'
  | 'EXPLICIT_WINDOW'
  | 'HISTORICAL';

export interface TimeAxis {
  /**
   * Main finding 4: TEXT at the reader's own precision. The storage type must never be
   * more precise than the fact, so this is the reader's phrase and NOT a parsed date.
   */
  readonly statedPeriod: string | null;
  readonly requirement: TemporalRequirement;
  readonly derivedIn: LanguageTag | null;
  readonly derivation: DerivationState;
}

/* ------------------------------------------------------------------ *
 * 7 · SELECTION, FOLLOW-UP, PERSONAL, ATTACHMENTS, COMPUTATION
 * ------------------------------------------------------------------ */

export type MultiStoryAction =
  | 'COMPARE'
  | 'SUMMARIZE'
  | 'ASK_SELECTED'
  | 'EXPLAIN_DISAGREEMENTS'
  | 'WHAT_CHANGED'
  | 'CREATE_BRIEFING';

export const MAX_SELECTED_STORIES = 8;

export interface SelectionAxis {
  readonly action: MultiStoryAction | null;
  /** `articleRef = sha256(normalizeArticleUrl(url))`. No title/summary/body ever. */
  readonly articleRefs: readonly string[];
}

export interface FollowUpAxis {
  readonly hasConversationContext: boolean;
}

export type PersonalScope = 'SAVED_STORIES' | 'INTERESTS' | 'FEED';

export interface PersonalAxis {
  readonly requested: boolean;
  readonly scope: PersonalScope | null;
}

export interface AttachmentAxis {
  /** Always 0. No substrate exists anywhere in the product. CTO: files remain SECURITY HOLD. */
  readonly count: number;
}

export interface ComputationAxis {
  /** The router may RECOGNISE the need. It may never fabricate an executor. */
  readonly requested: boolean;
}

/**
 * CTO correction 2 — ROUTER-D3 CLOSED. Specialist requiredness is CONTEXTUAL:
 *
 *   explicitly requested specialist        -> unbound/missing is CAPABILITY_UNAVAILABLE
 *   materially required for the claim      -> never silently substitute ordinary reporting
 *   supplementary                          -> reporting may execute, and the answer MUST
 *                                             disclose that specialist intelligence was
 *                                             not used or was unavailable
 *
 * "The planner must express whether each specialist leg is REQUIRED or SUPPLEMENTARY
 *  rather than applying one global rule."
 *
 * NO LANDED PRODUCER EXISTS for either field below. Both are declared inputs, exactly as
 * `topicTerms` and `statedPeriod` are, and `corpus/baseline-facts.ts` records that.
 */
export interface SpecialistRequestAxis {
  /** Domains the reader asked for AS AN ASSESSMENT, not merely as a subject. */
  readonly explicitDomains: readonly string[];
  /** Domains whose assessment the requested claim cannot be made without. */
  readonly materiallyRequiredDomains: readonly string[];
}

export type SpecialistRequiredness = 'REQUIRED' | 'SUPPLEMENTARY';

export interface OfficialArtifactAxis {
  readonly requested: boolean;
  readonly readerTerms: readonly string[];
}

/**
 * A fact whose truth depends on the time of asking — an office, a post, a status.
 * CTO ruling 3 governs it and it is NOT the same as an official statistic.
 */
export interface CurrentStatusAxis {
  readonly requested: boolean;
  readonly readerTerms: readonly string[];
}

/* ------------------------------------------------------------------ *
 * 8 · THE QUESTION ENVELOPE — server-derived, never on the wire
 * ------------------------------------------------------------------ */

export interface AskQuestionEnvelope {
  /** The reader's words, verbatim. Never rewritten, never normalised. */
  readonly rawQuestion: string;

  readonly identity: IdentityAxis;
  readonly language: LanguageAxis;
  readonly geography: GeographyAxis;
  readonly topic: TopicAxis;
  readonly domains: DomainAxis;
  readonly time: TimeAxis;
  readonly selection: SelectionAxis;
  readonly followUp: FollowUpAxis;
  readonly personal: PersonalAxis;
  readonly attachments: AttachmentAxis;
  readonly computation: ComputationAxis;
  readonly official: OfficialArtifactAxis;
  readonly currentStatus: CurrentStatusAxis;
  readonly specialistRequest: SpecialistRequestAxis;

  readonly classifiers: LandedClassifierReading;

  /** CTO: "`/search?q=` or `/ask?q=` does not constitute permission to spend compute." */
  readonly computeConsent: 'ABSENT' | 'GRANTED';
}

/* ------------------------------------------------------------------ *
 * 9 · THE TEN CLASSES — a projection, never a route
 * ------------------------------------------------------------------ */

export type AskQuestionClass =
  | 'REFERENCE'
  | 'HISTORICAL'
  | 'CURRENT_STATUS_VERIFICATION'
  | 'CURRENT_REPORTING'
  | 'OFFICIAL_DOCUMENT'
  | 'SPECIALIST_DOMAIN'
  | 'PERSONAL_INTELLIGENCE'
  | 'UPLOADED_DOCUMENT'
  | 'COMPUTATION'
  | 'CLARIFICATION_REQUIRED';

export const ASK_QUESTION_CLASSES: readonly AskQuestionClass[] = [
  'REFERENCE',
  'HISTORICAL',
  'CURRENT_STATUS_VERIFICATION',
  'CURRENT_REPORTING',
  'OFFICIAL_DOCUMENT',
  'SPECIALIST_DOMAIN',
  'PERSONAL_INTELLIGENCE',
  'UPLOADED_DOCUMENT',
  'COMPUTATION',
  'CLARIFICATION_REQUIRED',
];

/* ------------------------------------------------------------------ *
 * 10 · EVIDENCE CLASSES AND CAPABILITY STATES
 * ------------------------------------------------------------------ */

export type EvidenceClass =
  | 'NEWS_REPORTING'
  | 'OFFICIAL_ARTIFACT'
  | 'SPECIALIST_CLAIM'
  | 'PERSONAL_LIBRARY'
  | 'UPLOADED_DOCUMENT'
  | 'MODEL_PRIOR'
  | 'COMPUTATION';

export const EVIDENCE_CLASSES: readonly EvidenceClass[] = [
  'NEWS_REPORTING',
  'OFFICIAL_ARTIFACT',
  'SPECIALIST_CLAIM',
  'PERSONAL_LIBRARY',
  'UPLOADED_DOCUMENT',
  'MODEL_PRIOR',
  'COMPUTATION',
];

export type CapabilityState =
  | 'BOUND'
  | 'IDENTITY_GATED'
  /** A registry entry exists; no callable seam does. CTO ruling 4: registered != bound. */
  | 'REGISTERED_UNBOUND'
  | 'NO_CAPABILITY'
  | 'SECURITY_HOLD'
  | 'NOT_IMPLEMENTED';

/** Refusal CODES only. The frontend owns every word a reader sees (MA §11). */
export type RefusalCode =
  | 'NO_CAPABILITY'
  | 'IDENTITY_REQUIRED'
  | 'SPECIALIST_NOT_REGISTERED'
  | 'SPECIALIST_NOT_BOUND'
  | 'SECURITY_HOLD_UPLOAD'
  | 'NO_EXECUTOR_COMPUTATION'
  | 'LANGUAGE_UNCLASSIFIED'
  | 'LANGUAGE_UNSUPPORTED'
  | 'CONSTRAINT_UNTRANSPORTABLE'
  | 'CONSTRAINT_ABOVE_PRODUCIBLE_CEILING'
  /** CTO ruling 2 rung 2: a broader scope is offered and never applied automatically. */
  | 'BROADENING_OFFERED'
  | 'MODEL_PRIOR_FORBIDDEN'
  /** CTO ruling 3: reference/model background alone cannot verify a current office/status. */
  | 'MODEL_PRIOR_CANNOT_VERIFY'
  /** CTO ruling 3: the stronger CURRENTLY_VERIFIED outcome is not reachable today. */
  | 'OFFICIAL_VERIFICATION_UNAVAILABLE'
  | 'COMPUTE_CONSENT_ABSENT'
  | 'SELECTION_EXCEEDS_MAX'
  | 'SELECTION_BELOW_MINIMUM'
  | 'SOURCE_FRAME_UNPARSED'
  | 'CLARIFICATION_REQUIRED';

/**
 * A DISCLOSURE is an obligation on the answer, distinct from a refusal. CTO correction 2:
 * a supplementary specialist that is unavailable does not refuse the question, but
 * "the answer must disclose that specialist intelligence was not used/unavailable."
 *
 * Codes only. The frontend owns every word (MA §11, Claude Design HOLD).
 */
export type DisclosureCode =
  /** A supplementary specialist assessment was not used or was unavailable. */
  | 'SPECIALIST_INTELLIGENCE_NOT_USED'
  /** The answer rests on model prior, which is background and is never citable evidence. */
  | 'REFERENCE_BACKGROUND_NOT_CITABLE'
  /** Verified from reporting rather than official evidence; an as-of time is required. */
  | 'PARTIAL_VERIFICATION_AS_OF_TIME'
  /** A constraint the reader stated was not applied, and a broader scope is offered. */
  | 'CONSTRAINT_NOT_APPLIED';

/* ------------------------------------------------------------------ *
 * 11 · RETRIEVAL PRECEDENCE — declared as data
 * ------------------------------------------------------------------ */

/**
 * CTO RULING 1 — GEOGRAPHY PRECEDENCE, RECONCILED.
 *
 * The accepted ordering, in the CTO's own words:
 *
 *   explicit requested region/place -> typed geography -> entity geography
 *   -> story context -> Map country
 *
 * plus two clauses that change behaviour:
 *   "Current typed user scope must outrank inherited story context."
 *   "Entity geography is derived context and only becomes effective scope when the
 *    planner actually requires it."
 *
 * WHAT CHANGED FROM MAIN'S TABLE. Main ranked `ARTICLE_ANCHOR` at 2, above every
 * geography rung; the reconciled table moves story context BELOW typed and entity
 * geography, which is what the landed chain already did
 * (`typedScopeOverridesStory = true`, measured by G at `analysis.service.ts:1149-1159`).
 * `ENTITY_GEOGRAPHY` is added as a rung — the omission this package reported as C-R1.
 *
 * The three non-geography rungs keep Main's relative order and stay above geography;
 * the CTO's ruling governs the geography block and did not disturb them.
 *
 * Rank 9 is the unconditional default, which is what guarantees a plan always exists.
 */
export type PrecedenceRank =
  | 'SELECTION'
  | 'SOURCE_INTENT'
  | 'FOLLOW_UP_RELATION'
  | 'DECLARED_REGION'
  | 'TYPED_GEOGRAPHY'
  | 'ENTITY_GEOGRAPHY'
  | 'ARTICLE_ANCHOR'
  | 'MAP_GEOGRAPHY_CONTEXT'
  | 'CLASSIFIED_SHAPE';

export const DECLARED_PRECEDENCE: readonly PrecedenceRank[] = [
  'SELECTION',
  'SOURCE_INTENT',
  'FOLLOW_UP_RELATION',
  'DECLARED_REGION',
  'TYPED_GEOGRAPHY',
  'ENTITY_GEOGRAPHY',
  'ARTICLE_ANCHOR',
  'MAP_GEOGRAPHY_CONTEXT',
  'CLASSIFIED_SHAPE',
];

/** The rungs the CTO's geography ordering fixes, in that order. */
export const GEOGRAPHY_PRECEDENCE: readonly PrecedenceRank[] = [
  'DECLARED_REGION',
  'TYPED_GEOGRAPHY',
  'ENTITY_GEOGRAPHY',
  'ARTICLE_ANCHOR',
  'MAP_GEOGRAPHY_CONTEXT',
];

/**
 * The LANDED lattice, as G measured it verbatim at `analysis.service.ts:1149-1159`:
 *   P1 requested region -> P2 typed geography -> P3 entity geography
 *   -> P4 story context -> P5 map country
 *
 * Kept beside the declared table so divergence stays measurable. After ruling 1 the
 * geography block AGREES; what remains is additive rungs and one divergence the CTO
 * introduced deliberately (see `DivergenceKind`).
 */
export const LANDED_SCOPE_LATTICE: readonly PrecedenceRank[] = [
  'DECLARED_REGION',
  'TYPED_GEOGRAPHY',
  'ENTITY_GEOGRAPHY',
  'ARTICLE_ANCHOR',
  'MAP_GEOGRAPHY_CONTEXT',
  'CLASSIFIED_SHAPE',
];

export type DivergenceKind =
  /** The two tables pick the same rung. */
  | 'NONE'
  /** The declared table has a rung the landed chain does not. Additive, not contradictory. */
  | 'ADDITIVE'
  /** A CTO ruling deliberately produces a different answer from the landed chain. */
  | 'RULED'
  /** The two disagree and no ruling accounts for it. Must be zero. */
  | 'CONTRADICTORY';

/* ------------------------------------------------------------------ *
 * 12 · VERIFICATION — CTO ruling 3
 * ------------------------------------------------------------------ */

/**
 * FINAL SEMANTIC CORRECTION (CTO):
 *
 *   "Reserve INSUFFICIENT_EVIDENCE exclusively for a post-execution evidence outcome where
 *    an available evidence path was attempted and the kept scope could not support the
 *    requested claim. Planning-time inability must instead resolve to CAPABILITY_UNAVAILABLE,
 *    CLARIFICATION_REQUIRED or BROADENING_OFFERED as appropriate. Do not call a missing
 *    computation/file/specialist executor 'insufficient evidence.'"
 *
 * So INSUFFICIENT_EVIDENCE exists ONLY here, as an outcome an executor returns. It is not a
 * TerminalState and not a RefusalCode, and probe SC-2 asserts that.
 */
export type VerificationOutcome =
  /** Official current evidence answered it. */
  | 'CURRENTLY_VERIFIED'
  /** Official unavailable; at least two independent fresh reporting sources agreed. */
  | 'CURRENT_REPORTING_PARTIAL_VERIFICATION'
  /** Neither. The honest end of the ladder. */
  | 'INSUFFICIENT_EVIDENCE';

/**
 * A planner cannot know whether two independent fresh sources will agree — that is an
 * execution-time fact. So the plan carries the CONTRACT the executor must satisfy and
 * the set of outcomes that are admissible, and the executor returns which one occurred.
 */
export interface VerificationContract {
  readonly mode: 'CURRENT_STATUS';
  /** The state of official evidence at plan time, so the reader is never told it was tried. */
  readonly officialEvidence: CapabilityState;
  /** CTO ruling 3: "at least two independent fresh reporting sources agree". */
  readonly minIndependentFreshSources: number;
  /** CTO ruling 3: the partial-verification answer carries an as-of time. */
  readonly asOfTimeRequired: true;
  /** CTO ruling 3: "reference/model background alone cannot verify a current office/status." */
  readonly modelPriorMayVerify: false;
  /** Excludes CURRENTLY_VERIFIED whenever official evidence is not bound. */
  readonly admissibleOutcomes: readonly VerificationOutcome[];
}

/* ------------------------------------------------------------------ *
 * 13 · THE PLAN
 * ------------------------------------------------------------------ */

export interface EvidenceRequest {
  readonly evidenceClass: EvidenceClass;
  /** Why the plan needs it. An axis name or the reader's words; never model output. */
  readonly because: string;
  readonly required: boolean;
}

/**
 * CTO ruling 4: "No specialist execution plan may be emitted until a callable executor
 * seam is proven." So an unbound class never appears in `evidenceRequests` at all — it
 * appears here, as a declared absence with a code.
 */
export interface WithheldEvidence {
  readonly evidenceClass: EvidenceClass;
  readonly state: CapabilityState;
  readonly refusal: RefusalCode;
  /** For specialists, the analytical domain whose assessment is withheld. */
  readonly forDomain: string | null;
}

/**
 * One per analytical domain the question raises. Requiredness is per leg, never global.
 */
export interface SpecialistLeg {
  readonly domain: string;
  readonly requiredness: SpecialistRequiredness;
  /**
   * DECLARED when the requiredness axis supplied this domain; DEFAULTED when it did not and
   * SUPPLEMENTARY was assumed.
   *
   * This exists because the axis has NO LANDED PRODUCER (BF-18). Without the field, an
   * integration that never supplies it would silently take the permissive branch for every
   * leg — which is exactly the substitution correction 2 forbids. One field, no new state.
   */
  readonly requirednessSource: 'DECLARED' | 'DEFAULTED';
  readonly registered: boolean;
  /** A callable executor seam. Registered does not imply bound (CTO ruling 4). */
  readonly bound: boolean;
  readonly refusal: RefusalCode | null;
  /** True when the answer must say this assessment was not used. */
  readonly mustDisclose: boolean;
}

export type ConstraintAxis =
  | 'GEOGRAPHY'
  | 'TOPIC'
  | 'DOMAIN'
  | 'TIME'
  | 'SELECTION'
  | 'SOURCE_FRAME';

/**
 * CTO ruling 2: an untransportable constraint is never silently dropped. The ladder is
 * clarify -> offer explicit broadening -> insufficient evidence / capability unavailable,
 * and there is NO AUTOMATIC NARROWING.
 */
export interface PlannedConstraint {
  readonly axis: ConstraintAxis;
  /** The reader's constraint, unmodified. A plan never rewrites this. */
  readonly value: string;
  readonly carried: boolean;
  readonly refusal: RefusalCode | null;
  /** True when the reader has an action that satisfies the constraint as stated. */
  readonly readerResolvable: boolean;
  /**
   * The broader scope OFFERED to the reader, never applied. `null` means no broader
   * scope would leave a meaningful question, which is ruling 2's third rung.
   */
  readonly broadenedTo: string | null;
}

/**
 * CTO design ruling on clarification: "one UI state is sufficient for multiple clarification
 * causes. Router must provide reason/candidate data so copy can differ truthfully."
 *
 * So the router carries the CAUSE and the reader-actionable numbers, and the frontend writes
 * the words. No copy here — MA §11, Claude Design HOLD.
 */
export interface ClarificationCause {
  readonly code: RefusalCode;
  readonly axis: ConstraintAxis | null;
  /** What was observed — a count, a language tag, a publisher. Never a sentence. */
  readonly observed: string | null;
  /** What the reader can move to — a limit, a supported language. Never a sentence. */
  readonly candidate: string | null;
}

export type TerminalState =
  /** A plan exists and every required evidence class is bound. */
  | 'EXECUTABLE'
  /** Model prior may answer as non-citable background only. */
  | 'REFERENCE_BACKGROUND_ONLY'
  /** Ruling 2 rung 1, and the landed clarification verdict. A valid terminal state. */
  | 'CLARIFICATION_REQUIRED'
  /** Ruling 2 rung 2. An explicit broader scope is offered; nothing is applied. */
  | 'BROADENING_OFFERED'
  /**
   * Ruling 2 rung 3. FINAL SEMANTIC CORRECTION: this is where planning-time inability
   * lands, including a constraint axis that has no channel at all. It is NOT
   * "insufficient evidence" — nothing was attempted.
   */
  | 'CAPABILITY_UNAVAILABLE'
  /** A personal question with no verified identity. Never answered from news instead. */
  | 'IDENTITY_REQUIRED'
  /** Compute would be spent and no consent exists. */
  | 'AWAITING_COMPUTE_CONSENT';

export const TERMINAL_STATES: readonly TerminalState[] = [
  'EXECUTABLE',
  'REFERENCE_BACKGROUND_ONLY',
  'CLARIFICATION_REQUIRED',
  'BROADENING_OFFERED',
  'CAPABILITY_UNAVAILABLE',
  'IDENTITY_REQUIRED',
  'AWAITING_COMPUTE_CONSENT',
];

export interface RoutingPlan {
  /** Projection only. Nothing in this plan was decided by reading it. */
  readonly questionClass: AskQuestionClass;

  readonly scopedBy: PrecedenceRank;
  readonly scopedByLanded: PrecedenceRank;
  readonly precedenceDivergence: boolean;
  readonly divergenceKind: DivergenceKind;
  /** True when a required evidence class made geography an effective scope (ruling 1). */
  readonly geographyRequired: boolean;

  /** Only classes with a callable seam ever appear here (ruling 4). */
  readonly evidenceRequests: readonly EvidenceRequest[];
  /** One entry per analytical domain, each with its own requiredness (correction 2). */
  readonly specialistLegs: readonly SpecialistLeg[];
  /**
   * True when a REQUIRED specialist leg is unmet. Ordinary reporting is then removed from
   * the plan rather than merely deprioritised, so "do not silently substitute" is
   * structural instead of advisory.
   */
  readonly reportingSubstitutionForbidden: boolean;
  /** Declared absences, with a code each. Absence is stated, never implied. */
  readonly withheldEvidence: readonly WithheldEvidence[];
  readonly constraints: readonly PlannedConstraint[];

  readonly verification: VerificationContract | null;

  readonly terminalState: TerminalState;
  readonly refusals: readonly RefusalCode[];
  /** Reason and candidate data for the single clarification UI state. Empty when not clarifying. */
  readonly clarification: readonly ClarificationCause[];
  /** Obligations on the answer, sorted. Distinct from refusals. */
  readonly disclosures: readonly DisclosureCode[];

  readonly modelPriorPermitted: boolean;
  /** Reference background is never citable and never counted as a source. */
  readonly modelPriorCitable: false;
}
