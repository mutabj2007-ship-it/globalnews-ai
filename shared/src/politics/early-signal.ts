/**
 * POLITICS EARLY-SIGNAL — VERSIONED READ CONTRACT (R66 Workstream A, T3).
 *
 * The typed contract between the OFFLINE Politics early-signal engine and Main's frontend. It describes
 * what a reader surface may render and — equally — what it must render when evidence is absent.
 *
 * Absence is typed. `null` means NOT ASSESSED / NOT ESTABLISHED, never zero and never "nothing happened".
 * There is deliberately no probability, likelihood, score, countdown or monitoring field anywhere.
 * `NEW_EVIDENCE` / `NO_MATERIAL_CHANGE` are the only change states (the WatchChangeState subset derivable
 * today); `DISPUTED` exists only as a human-reviewed, attributed annotation (CTO R22 decision 5).
 * Synthetic fixture data is stamped `SYNTHETIC_FIXTURE` and is never served to public readers.
 */

export const POLITICS_ES_CONTRACT_VERSION = 'politics-early-signal/v1' as const;

/* ── vocabularies ─────────────────────────────────────────────────────────── */

export const POLITICS_ES_ACQUISITION_MODES = ['ASK_ON_DEMAND', 'USER_SUPPLIED_URL', 'BACKGROUND_DISCOVERY', 'SYNTHETIC_FIXTURE'] as const;
export type PoliticsEsAcquisitionMode = (typeof POLITICS_ES_ACQUISITION_MODES)[number];

/** How far the last evaluation got. None of these is "no developments". */
export const POLITICS_ES_ACCESS_STATES = [
  'COMPLETED_MATCH',
  'COMPLETED_NO_MATCH',
  'PARTIAL',
  'PROVIDER_FAILED',
  'RIGHTS_WITHHELD',
  'SEARCH_NOT_RUN',
] as const;
export type PoliticsEsAccessState = (typeof POLITICS_ES_ACCESS_STATES)[number];

/** E1's nine per-use columns. Only CLEAR_FOR_EXACT_USE permits. */
export const POLITICS_ES_USES = [
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
export type PoliticsEsUse = (typeof POLITICS_ES_USES)[number];
export type PoliticsEsUseVerdict = 'CLEAR_FOR_EXACT_USE' | 'HOLD' | 'RESTRICTED' | 'UNRESOLVED' | 'NOT_APPLICABLE';

export const POLITICS_ES_WITHHOLD_REASONS = [
  'RIGHTS_NOT_CLEARED',
  'UNKNOWN_PROVENANCE',
  'DERIVATIVE_ARTEFACT_REFUSED',
] as const;
export type PoliticsEsWithholdReason = (typeof POLITICS_ES_WITHHOLD_REASONS)[number];

export type PoliticsEsChainBasis =
  | 'ORIGIN_SELF'
  | 'DECLARED_WIRE_CREDIT'
  | 'DECLARED_SYNDICATION'
  | 'TEXT_SIMILARITY_CLUSTER'
  | 'HUMAN_LINKED'
  | 'NOT_ESTABLISHED';

export type PoliticsEsPlaceRole =
  | 'EVENT_PLACE'
  | 'ANNOUNCEMENT_PLACE'
  | 'PUBLISHER_LOCATION'
  | 'ACTOR_AFFILIATION'
  | 'QUOTED'
  | 'OFFICE'
  | 'CLIENT_REQUESTED';
export type PoliticsEsPlaceBasis = 'OBSERVED_PRIMARY' | 'ATTRIBUTED_BY_PUBLISHER' | 'NOT_ESTABLISHED';
export type PoliticsEsPrecision = 'COUNTRY' | 'ADMIN1' | 'LOCALITY' | 'FACILITY' | 'NOT_ESTABLISHED';
export type PoliticsEsRegion = 'EAST_AFRICA' | 'EU27' | 'MIDDLE_EAST' | 'OUTSIDE_DECLARED_SCOPE' | 'NOT_ESTABLISHED';

/** Independent regional review status. EU27 / ME16 have no bound reviewer (R66). */
export type PoliticsEsRegionalReview = 'EA_VALIDATOR_REVIEW_PENDING' | 'REVIEWER_UNBOUND' | 'NOT_APPLICABLE';

export const POLITICS_ES_QUANTITY_UNITS = [
  'KILLED',
  'WOUNDED',
  'INJURED',
  'KILLED_OR_WOUNDED',
  'DEATHS',
  'MISSING',
  'CASUALTIES',
  'DISPLACED',
  'CASES',
] as const;
export type PoliticsEsQuantityUnit = (typeof POLITICS_ES_QUANTITY_UNITS)[number];

/** Closed predicate list. A predicate outside it yields impact INSUFFICIENT, never a guess. */
export const POLITICS_ES_PREDICATES = [
  'CASUALTIES_REPORTED',
  'ARMED_CLASH_REPORTED',
  'FACILITY_CLOSED',
  'ROUTE_DISRUPTED',
  'COALITION_ANNOUNCED',
  'OUTBREAK_DECLARED',
  'OUTBREAK_ENDED',
  'CONNECTIVITY_DISRUPTED',
  'CURFEW_DECLARED',
  'POLICY_RATE_DECISION',
  'PRICE_REVIEW_UNCHANGED',
  'PROTEST_HELD',
  'LEGISLATIVE_STAGE',
] as const;
export type PoliticsEsPredicate = (typeof POLITICS_ES_PREDICATES)[number];

export type PoliticsEsSpeakerRole =
  | 'OFFICIAL_BODY'
  | 'PARTY_TO_CONFLICT'
  | 'JOURNALIST'
  | 'ANONYMOUS_SOURCES'
  | 'ANALYST'
  | 'SOCIAL_ACCOUNT';

/** R66 impact domains. */
export const POLITICS_ES_IMPACT_DOMAINS = ['PEOPLE', 'TRANSPORT', 'TRADE', 'JOBS', 'HUMANITARIAN_ACCESS', 'SERVICES'] as const;
export type PoliticsEsImpactDomain = (typeof POLITICS_ES_IMPACT_DOMAINS)[number];

export type PoliticsEsEvidenceClass = 'OBSERVED_EFFECT' | 'SUGGESTS_RISK_ONLY' | 'NO_CHANGE_NOTICE' | 'INSUFFICIENT';
export type PoliticsEsHorizon = 'OBSERVED_NOW' | 'UNSPECIFIED';

/* ── engine input (synthetic fixtures or rights-cleared retained observations) ─ */

export interface PoliticsEsObservationInput {
  readonly observationId: string;
  readonly dataOrigin: 'SYNTHETIC_FIXTURE' | 'RETAINED';
  readonly publisherId: string;
  readonly host: string;
  readonly deliveredByProviderId: string | null;
  readonly acquisitionMode: PoliticsEsAcquisitionMode;
  readonly artefactKind: 'PUBLISHED_ITEM' | 'OFFICIAL_RECORD' | 'SOCIAL_POST_ORIGINAL' | 'SCREENSHOT' | 'REPOST';
  readonly chain: {
    readonly declaredWireOrigin: string | null;
    readonly declaredSyndicationOf: string | null;
    readonly similarityClusterId: string | null;
    readonly humanLinkedChainId: string | null;
    readonly originSelf: boolean;
  };
  readonly originalLanguage: { readonly tag: string | null; readonly basis: 'PUBLISHER_DECLARED' | 'DETECTED' | 'NOT_ESTABLISHED' };
  /** Clocks never coalesce; none back-fills another. Event time belongs to the claim. */
  readonly clocks: {
    readonly publishedAt: string | null;
    readonly publishedAtBasis: 'publisher' | 'observed' | 'UNPROVEN';
    readonly providerObservedAt: string | null;
    readonly firstSeenAt: string | null;
    readonly collectedAt: string;
  };
  readonly places: readonly {
    readonly iso3: string | null;
    readonly locality: string | null;
    readonly precision: PoliticsEsPrecision;
    readonly role: PoliticsEsPlaceRole;
    readonly basis: PoliticsEsPlaceBasis;
    /** A bare "Congo" decides nothing (EA R-03). */
    readonly bareCongo?: boolean;
  }[];
  readonly rights: Readonly<Partial<Record<PoliticsEsUse, PoliticsEsUseVerdict>>>;
  readonly claim: {
    readonly claimKey: string;
    readonly predicate: string;
    readonly incidentKey: string | null;
    readonly eventTime: { readonly from: string | null; readonly to: string | null; readonly basis: 'AS_REPORTED' | 'NOT_ESTABLISHED' };
    readonly quantity: { readonly value: number; readonly unit: PoliticsEsQuantityUnit; readonly qualifier: 'EXACT' | 'AT_LEAST' | 'ABOUT' | 'UP_TO' } | null;
    readonly speakerRole: PoliticsEsSpeakerRole;
    readonly interestedParty: boolean;
  };
  readonly mutation: {
    readonly kind: 'NONE' | 'UPDATE' | 'CORRECTED' | 'RETRACTED';
    readonly supersedesObservationId: string | null;
    readonly observedAt: string | null;
  };
}

export interface PoliticsEsEvaluationInput {
  readonly attemptedAt: string;
  readonly access: PoliticsEsAccessState;
  /** The last evaluation that actually COMPLETED before this one; null = never. */
  readonly previousCompletedAt: string | null;
  readonly perSource: readonly { readonly publisherId: string; readonly reason: 'checked' | 'not-configured' | 'rate-limited' | 'rights-withheld' | 'failed' | 'not-attempted' }[];
  /** Chains known per development at the previous completed evaluation; null = no baseline. */
  readonly baseline: Readonly<Record<string, readonly string[]>> | null;
}

/** A dispute exists only as a recorded human review of two attributed claims. */
export interface PoliticsEsHumanDispute {
  readonly claimKeyA: string;
  readonly claimKeyB: string;
  readonly reviewer: string;
  readonly reviewedAt: string;
  readonly derivedBy: 'HUMAN_REVIEW' | 'RULE';
}

/* ── read model (what the frontend renders) ──────────────────────────────── */

export interface PoliticsEsClaimView {
  readonly claimKey: string;
  readonly predicate: string;
  readonly quantity: PoliticsEsObservationInput['claim']['quantity'];
  readonly attribution: { readonly publisherId: string; readonly speakerRole: PoliticsEsSpeakerRole; readonly interestedParty: boolean };
  readonly chainId: string | null;
  readonly status: 'CURRENT' | 'SUPERSEDED_BY_UPDATE' | 'CORRECTED' | 'RETRACTED';
  readonly supersededBy: string | null;
}

export interface PoliticsEsImpactHypothesis {
  readonly domain: PoliticsEsImpactDomain;
  readonly mechanismCode: string;
  readonly rationaleCode: string;
  readonly horizon: PoliticsEsHorizon;
  readonly competingHypothesisCodes: readonly string[];
  readonly disconfirmerCodes: readonly string[];
  readonly nextCheck: {
    readonly conditionCode: string;
    /** Earliest re-evaluation that would be meaningful. Not a schedule: nothing runs at this time. */
    readonly notBefore: string | null;
    readonly basis: 'RULE_INTERVAL_FROM_LAST_EVALUATION' | 'NOT_EVALUATED';
    readonly scheduled: false;
  };
}

export interface PoliticsEsDevelopmentView {
  readonly developmentKey: string;
  readonly region: PoliticsEsRegion;
  readonly regionalReview: PoliticsEsRegionalReview;
  readonly country: { readonly iso3: string | null; readonly precision: PoliticsEsPrecision; readonly basis: PoliticsEsPlaceBasis };
  readonly statementStatus: 'ATTRIBUTED' | 'CORROBORATED';
  readonly sourceChainCount: number;
  readonly sourceChains: readonly string[];
  readonly unestablishedChainItems: number;
  readonly change: 'NEW_EVIDENCE' | 'NO_MATERIAL_CHANGE' | null;
  readonly corrected: boolean;
  readonly retracted: boolean;
  readonly disputed: { readonly claimKeys: readonly [string, string]; readonly derivedBy: 'HUMAN_REVIEW'; readonly reviewedAt: string }[];
  readonly requiresHumanReview: boolean;
  readonly claims: readonly PoliticsEsClaimView[];
  readonly timeline: {
    readonly earliestPublishedAt: string | null;
    readonly earliestFirstSeenAt: string | null;
    readonly eventTime: { readonly from: string | null; readonly to: string | null; readonly basis: 'AS_REPORTED' | 'NOT_ESTABLISHED' };
  };
  readonly impact: { readonly evidenceClass: PoliticsEsEvidenceClass; readonly hypotheses: readonly PoliticsEsImpactHypothesis[] };
}

export interface PoliticsEsReadModelV1 {
  readonly contractVersion: typeof POLITICS_ES_CONTRACT_VERSION;
  readonly dataOrigin: 'SYNTHETIC_FIXTURE' | 'RETAINED_RIGHTS_CLEARED' | 'NONE';
  readonly producedBy: 'POLITICS_OFFLINE_ENGINE';
  readonly evaluation: {
    /** The last time an evaluation actually COMPLETED. null = never. */
    readonly lastEvaluatedAt: string | null;
    readonly lastAttempt: { readonly at: string; readonly access: PoliticsEsAccessState };
    readonly perSource: PoliticsEsEvaluationInput['perSource'];
  };
  readonly withheld: { readonly count: number; readonly reasons: Readonly<Partial<Record<PoliticsEsWithholdReason, number>>> };
  /** Non-null whenever developments is empty: the reader is told WHY there is nothing to show. */
  readonly absence: { readonly state: PoliticsEsAccessState | 'COMPLETED_NO_MATCH'; readonly wordingCode: string } | null;
  readonly developments: readonly PoliticsEsDevelopmentView[];
}

/** Keys that must never appear anywhere in a read model. */
export const POLITICS_ES_FORBIDDEN_KEYS = [
  'probability',
  'likelihood',
  'score',
  'riskScore',
  'confidencePercent',
  'forecast',
  'severityScore',
  'total',
  'countdown',
  'monitoring',
] as const;
