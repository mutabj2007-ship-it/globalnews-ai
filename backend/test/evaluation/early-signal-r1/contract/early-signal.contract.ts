/**
 * ER1 — REGIONAL EARLY-SIGNAL R1 · T1 CANDIDATE CONTRACT (Master CTO R17 limited GO).
 *
 * WHAT THIS FILE IS. A typed PROPOSAL for the evidence chain
 *   source publisher/endpoint → observation → claim → event/case → impact → evaluation → shadow candidate.
 * It is pure: no imports, no Nest decorators, no Prisma types, no I/O. It is NOT a migration, NOT wired
 * into AppModule, NOT exported from `@globalnews-ai/shared`, and it lives under `backend/test/` so the
 * production build (`tsconfig.build.json` excludes `test`) and the default jest run (`rootDir: src`) never
 * see it. Effect on existing code: zero.
 *
 * WHAT IT IS NOT. It does not extend the frozen `WatchChangeState` union (shared/src/watch.ts). It does
 * not create runtime switches. It does not admit any source: every rights value defaults to HOLD and
 * the only permission authority is E1's per-use matrix.
 *
 * Absence is typed. `null` means NOT ASSESSED / NOT ESTABLISHED — never zero, never "nothing happened".
 */

/* ════════════════════════════════════════════════════════════════════════════
 * 0 · Closed vocabularies
 * ════════════════════════════════════════════════════════════════════════════ */

export const CONTRACT_VERSION = 'er1-contract-r1' as const;

/** G §3 — the three discovery modes. A result carries its mode; metrics never pool modes. */
export const ACQUISITION_MODES = ['ASK_ON_DEMAND', 'USER_SUPPLIED_URL', 'BACKGROUND_DISCOVERY'] as const;
export type AcquisitionMode = (typeof ACQUISITION_MODES)[number];

/** E1's nine per-use columns (E1-REGIONAL-SOURCE-USE-MATRIX.csv). */
export const E1_USES = [
  'LINK_AND_SOURCE_NAME',
  'METADATA_HEADLINE',
  'EXCERPT',
  'AI_INPUT',
  'RETENTION',
  'TRANSLATION',
  'IMAGES',
  'ALERT_TEXT',
  'DOWNSTREAM_REPUBLICATION',
] as const;
export type E1Use = (typeof E1_USES)[number];

/** A per-use verdict. Only `CLEAR_FOR_EXACT_USE` permits; every other value withholds. */
export const USE_VERDICTS = ['CLEAR_FOR_EXACT_USE', 'HOLD', 'RESTRICTED', 'UNRESOLVED', 'NOT_APPLICABLE'] as const;
export type UseVerdict = (typeof USE_VERDICTS)[number];

/**
 * Access state — how far retrieval got (D-28, F-1, F-3, EA R-11). Orthogonal to claim state.
 * None of these may be rendered as "no developments".
 */
export const ACCESS_STATES = [
  'COMPLETED_MATCH',
  'COMPLETED_NO_MATCH',
  'PARTIAL',
  'PROVIDER_FAILED',
  'RIGHTS_WITHHELD',
  'SEARCH_NOT_RUN',
  'ACCESS_LIMITED',
] as const;
export type AccessState = (typeof ACCESS_STATES)[number];

/**
 * The two WatchChangeState members derivable today (shared/src/watch.ts:460). Re-declared as a
 * literal subset here — NOT imported, NOT extended. Anything else is `null` + an access state.
 */
export const DERIVABLE_CHANGE_STATES = ['NEW_EVIDENCE', 'NO_MATERIAL_CHANGE'] as const;
export type DerivableChangeState = (typeof DERIVABLE_CHANGE_STATES)[number];

/** Story-Alert reader state proposal (H D-2; CTO R17 §2D). NOT a WatchChangeState. */
export const ALERT_TRUTH_STATES = ['NOT_ASSESSED', 'NO_CHANGE_YET', 'CHANGED', 'NO_RETAINED_EVIDENCE'] as const;
export type AlertTruthState = (typeof ALERT_TRUTH_STATES)[number];

/** EA R-04 — casualty units are distinct and never summed. */
export const CASUALTY_UNITS = ['KILLED', 'WOUNDED', 'KILLED_OR_WOUNDED', 'MISSING', 'CASUALTIES', 'DISPLACED'] as const;
export type CasualtyUnit = (typeof CASUALTY_UNITS)[number];

/** EA R-02 — place roles. Only EVENT_PLACE may key a regional case. */
export const PLACE_ROLES = [
  'EVENT_PLACE',
  'ANNOUNCEMENT_PLACE',
  'PUBLISHER_LOCATION',
  'ACTOR_AFFILIATION',
  'QUOTED',
  'OFFICE',
  'CLIENT_REQUESTED',
] as const;
export type PlaceRole = (typeof PLACE_ROLES)[number];

/** How a place was established. OBSERVED requires primary-source proof; a screenshot never is. */
export const PLACE_BASES = ['OBSERVED_PRIMARY', 'ATTRIBUTED_BY_PUBLISHER', 'NOT_ESTABLISHED'] as const;
export type PlaceBasis = (typeof PLACE_BASES)[number];

/** CTO R17 §2C — unknown chain is NOT ESTABLISHED, never independent. */
export const CHAIN_BASES = [
  'ORIGIN_SELF',
  'DECLARED_WIRE_CREDIT',
  'DECLARED_SYNDICATION',
  'TEXT_SIMILARITY_CLUSTER',
  'HUMAN_LINKED',
  'NOT_ESTABLISHED',
] as const;
export type ChainBasis = (typeof CHAIN_BASES)[number];

export const CLAIM_RELATIONS = ['SUPPORTS', 'UPDATES', 'REPEATS', 'RETRACTS', 'DISPUTES', 'POSSIBLY_RELATED'] as const;
export type ClaimRelationKind = (typeof CLAIM_RELATIONS)[number];

export const SPEAKER_ROLES = [
  'OFFICIAL_BODY',
  'PARTY_TO_CONFLICT',
  'JOURNALIST',
  'ANONYMOUS_SOURCES',
  'ANALYST',
  'SOCIAL_ACCOUNT',
  'INTERESTED_PUBLISHER',
] as const;
export type SpeakerRole = (typeof SPEAKER_ROLES)[number];

/** EA §4 — impact evidence classes. There is deliberately no score. */
export const IMPACT_EVIDENCE_CLASSES = [
  'OBSERVED_EFFECT',
  'SUPPORTS_PLAUSIBLE_MECHANISM',
  'SUGGESTS_RISK_ONLY',
  'INSUFFICIENT',
] as const;
export type ImpactEvidenceClass = (typeof IMPACT_EVIDENCE_CLASSES)[number];

/** Coverage-mapping deficits (CTO R17 §2A). Reported, never silently resolved. */
export const COVERAGE_DEFICITS = [
  'EXPLICIT_ALIAS_COLLAPSED',
  'ALIAS_EVIDENCE_LOST',
  'SHARED_HOST_MULTI_COUNTRY',
  'DIRECTORY_LISTING_NOT_OWN_CHANNEL',
] as const;
export type CoverageDeficit = (typeof COVERAGE_DEFICITS)[number];

/** Time-stamp basis. `UNPROVEN` mirrors Article.publishedAtBasis's unknown-value rule. */
export type ClockBasis = 'publisher' | 'observed' | 'UNPROVEN';

/* ════════════════════════════════════════════════════════════════════════════
 * A · Source identity: ONE publisher, MANY endpoints, MANY country coverage roles
 * ════════════════════════════════════════════════════════════════════════════ */

/** One editorial/institutional identity. A shared host is one publisher, never two sources. */
export interface SourcePublisherV1 {
  readonly publisherId: string; // e.g. 'pub:un-ocha'
  readonly displayName: string;
  readonly hosts: readonly string[]; // every host it publishes from (legacy + current)
  readonly ownershipGroupId: string | null; // null = NOT_MEASURED (F ES-M4)
  readonly institutional: boolean;
  /** Runtime ids that point at this publisher (canonical packs / FEED_SOURCES / G register). */
  readonly registryIds: readonly string[];
}

/** One reachable endpoint of a publisher, with the technical evidence actually recorded. */
export interface SourceEndpointV1 {
  readonly endpointId: string;
  readonly publisherId: string;
  readonly host: string;
  readonly kind: 'FEED' | 'LANDING_PAGE' | 'DIRECTORY_LISTING' | 'API';
  readonly url: string;
  readonly technicalStatus: string; // verbatim pack status, e.g. VERIFIED_FEED_ENDPOINT
  readonly checkedAt: string | null; // pack evidence time; null = NOT_CHECKED
  readonly evidenceRef: { readonly manifestPath: string; readonly manifestSha256: string; readonly registryId: string };
}

/** A country coverage ROLE of a publisher. Many links → still ONE independence unit. */
export interface CountryCoverageLinkV1 {
  readonly publisherId: string;
  readonly iso3: string;
  readonly role: 'NEWS' | 'OFFICIAL_NOTICE' | 'STATISTICS' | 'CENTRAL_BANK' | 'HUMANITARIAN' | 'DIRECTORY_LISTING';
  readonly endpointIds: readonly string[];
  readonly deficits: readonly CoverageDeficit[];
  /** Rights are per source per use, from E1 only. A coverage link never carries a grant. */
  readonly rightsMatrixRowId: string | null; // null = not yet scored by E1 (HOLD)
}

/* ════════════════════════════════════════════════════════════════════════════
 * B · Observation (append-only)
 * ════════════════════════════════════════════════════════════════════════════ */

export interface SourceObservationV1 {
  readonly observationId: string;
  readonly articleRef: string | null; // sha256(normalizeArticleUrl(url)) where an article exists
  readonly publisherId: string;
  readonly endpointId: string | null;
  readonly deliveredByProviderId: string | null; // null ⇒ E1 C-06 UNKNOWN_PROVENANCE (HOLD)
  readonly acquisitionMode: AcquisitionMode;
  readonly reportingChain: { readonly chainId: string | null; readonly basis: ChainBasis };
  readonly originalLanguage: { readonly tag: string | null; readonly basis: 'PUBLISHER_DECLARED' | 'DETECTED' | 'NOT_ESTABLISHED' };
  /** EA R-01 — clocks never coalesce, and none back-fills another. Event time is NOT here. */
  readonly clocks: {
    readonly publisherAssertedAt: string | null;
    readonly publisherAssertedBasis: ClockBasis;
    readonly providerObservedAt: string | null;
    readonly firstProductObservedAt: string | null; // null = UNKNOWN (EA R-10), not "never"
    readonly collectedAt: string;
  };
  readonly places: readonly { readonly iso3: string; readonly role: PlaceRole; readonly basis: PlaceBasis }[];
  readonly rights: { readonly matrixRowId: string | null; readonly matrixVersion: string | null; readonly perUse: Readonly<Record<E1Use, UseVerdict>> };
  readonly mutation: {
    readonly kind: 'NONE' | 'EDITED' | 'CORRECTED' | 'RETRACTED' | 'DELETED';
    readonly observedAt: string | null;
    readonly supersedesObservationId: string | null;
  };
  /** A screenshot or repost image is never an origin (E1 A-4). */
  readonly artefactKind: 'PUBLISHED_ITEM' | 'OFFICIAL_RECORD' | 'SOCIAL_POST_ORIGINAL' | 'SCREENSHOT' | 'REPOST';
}

/* ════════════════════════════════════════════════════════════════════════════
 * C · Claim (attributed; never verified by us)
 * ════════════════════════════════════════════════════════════════════════════ */

export interface ClaimQuantityV1 {
  readonly value: number;
  readonly unit: CasualtyUnit;
  readonly qualifier: 'EXACT' | 'AT_LEAST' | 'ABOUT' | 'UP_TO';
}

export interface AttributedClaimV1 {
  readonly claimId: string;
  readonly eventId: string | null;
  readonly predicate: string; // closed code list owned by EA/E1, e.g. CASUALTIES_REPORTED
  readonly quantity: ClaimQuantityV1 | null;
  readonly place: { readonly iso3: string | null; readonly locality: string | null; readonly role: PlaceRole; readonly basis: PlaceBasis } | null;
  readonly eventTime: { readonly from: string | null; readonly to: string | null; readonly basis: 'AS_REPORTED' | 'NOT_ESTABLISHED' };
  readonly attribution: {
    readonly observationIds: readonly string[];
    readonly speakerRole: SpeakerRole;
    readonly interestedParty: boolean;
  };
  /** Only ATTRIBUTED is stored. CORROBORATED is derived (≥2 independent chains) and never stored as truth. */
  readonly statementStatus: 'ATTRIBUTED';
  readonly revision: { readonly ordinal: number; readonly supersedesClaimId: string | null; readonly reason: 'CORRECTION' | 'RETRACTION' | 'UPDATE' | null };
  readonly extractedBy: 'HUMAN_ANALYST' | 'RULE' | 'MODEL';
}

export interface ClaimRelationV1 {
  readonly fromClaimId: string;
  readonly toClaimId: string;
  readonly kind: ClaimRelationKind;
  /** DISPUTES may only come from HUMAN_REVIEW until an Analysis-lane detector exists (E1 P-4). */
  readonly derivedBy: 'RULE' | 'HUMAN_REVIEW';
}

/* ════════════════════════════════════════════════════════════════════════════
 * D · Event / case (binds to Situation; Event ≠ Story ≠ Article)
 * ════════════════════════════════════════════════════════════════════════════ */

export interface EventCaseV1 {
  readonly eventId: string;
  readonly situationId: string | null;
  readonly benchmarkRegion: 'EAST_AFRICA' | 'EU27' | 'MIDDLE_EAST';
  readonly place: { readonly iso3: string | null; readonly locality: string | null; readonly basis: PlaceBasis };
  readonly occurred: { readonly from: string | null; readonly to: string | null; readonly basis: 'AS_REPORTED' | 'NOT_ESTABLISHED' };
  readonly claimIds: readonly string[]; // severity is the claims themselves; no derived score
  readonly storyIds: readonly string[];
}

/* ════════════════════════════════════════════════════════════════════════════
 * E · Impact (two objects, kept apart; no probability field exists — EA R-08, E1 §7)
 * ════════════════════════════════════════════════════════════════════════════ */

export interface ImpactStatementV1 {
  readonly code: string;
  readonly value: string;
  readonly asStatedBy: { readonly publisherId: string; readonly observationId: string };
  readonly assessedAt: string;
}

export interface ImpactAssessmentV1 {
  readonly eventId: string;
  readonly evidenceClass: ImpactEvidenceClass;
  readonly mechanism: string | null;
  readonly exposed: readonly string[];
  readonly horizon: 'OBSERVED_NOW' | 'NEAR_TERM_STATED_BY_SOURCE' | 'UNSPECIFIED';
  readonly supportingClaimIds: readonly string[];
  readonly alternatives: readonly string[];
  readonly wouldConfirm: readonly string[];
  readonly wouldWeaken: readonly string[];
  readonly assessedBy: 'HUMAN_ANALYST';
}

/* ════════════════════════════════════════════════════════════════════════════
 * F · Evaluation ledger (the record H-1 lacks) and Story-Alert truth projection
 * ════════════════════════════════════════════════════════════════════════════ */

export interface EvaluationV1 {
  readonly evaluationId: string;
  readonly idempotencyKey: string;
  readonly subject: { readonly kind: 'EVENT_CASE' | 'STORY_ALERT' | 'WATCH_SUBSCRIPTION'; readonly id: string };
  readonly baselineEvaluationId: string | null;
  readonly evaluatedAt: string;
  readonly access: AccessState;
  readonly perSource: readonly { readonly publisherId: string; readonly reason: 'checked' | 'not-configured' | 'rate-limited' | 'rights-withheld' | 'failed' | 'not-attempted' }[];
  /** Only a derivable state, and only when access is a completed one. Otherwise null. */
  readonly change: DerivableChangeState | null;
}

/** Proposed additive Story-Alert read fields (H D-1/D-2). Not a schema change. */
export interface StoryAlertTruthV1 {
  readonly lastEvaluatedAt: string | null; // null = never evaluated
  readonly state: AlertTruthState;
}

/* ════════════════════════════════════════════════════════════════════════════
 * G · Shadow candidate (operator only; never reader-visible)
 * ════════════════════════════════════════════════════════════════════════════ */

export interface ShadowCandidateV1 {
  readonly candidateId: string;
  readonly eventId: string;
  readonly evaluationId: string;
  readonly tier: 'ATTRIBUTED' | 'CORROBORATED';
  readonly independentChainIds: readonly string[];
  readonly highImpactClass: 'CASUALTY' | 'IMMINENT_HARM' | 'NONE';
  readonly requiresHumanReview: boolean;
  readonly rightsHeld: boolean;
  readonly visibility: 'OPERATOR_ONLY';
}

/** Keys that must never appear anywhere in an ER1 object (E1 S-7, EA R-08). */
export const FORBIDDEN_KEYS = ['probability', 'likelihood', 'riskScore', 'confidencePercent', 'forecast', 'severityScore'] as const;
