import { ALL_ISO3_CODES } from '@globalnews-ai/shared';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ADMIN ASK INTELLIGENCE OBSERVABILITY R1 — THE OBSERVATION CONTRACT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * WHAT READERS NEEDED, NOT WHAT THEY TYPED.
 *
 * Every field below is a value the Ask R2 router or its executor ALREADY produced while
 * routing and answering. Nothing here runs a classifier, and nothing here reads the
 * question: the CTO ruling frozen C is built on — "the question is already classified
 * before retrieval ... a seventh classifier would be the worst available answer" — applies
 * with exactly the same force to analytics. Adding one for a dashboard would be an eighth.
 *
 * THE THREE AXES THAT ARE PRESENCE-ONLY, AND WHY EACH ONE IS.
 *   topicPresent         `TopicAxis.readerTerms` is documented as "the reader's own words.
 *                        Never a resolved taxonomy member." Storing them would be storing
 *                        fragments of the question.
 *   statedPeriodPresent  `TimeAxis.statedPeriod` is "TEXT at the reader's own precision"
 *                        — the reader's phrase, not a parsed date.
 *   geography            the CODES are governed and are kept; the reader's matched span
 *                        (`matchedText`) is their words and is never read here at all.
 * A boolean cannot be re-read as a question. That is the whole reason it is a boolean.
 *
 * CODES, NEVER PROSE. Refusals, disclosures and clarification causes travel as frozen C's
 * own codes. `ClarificationCause.observed` and `.candidate` may carry a publisher name or
 * a reader-visible value, so they are NOT part of this contract — only `.code` is.
 */

/** The observation shape this build writes. A later shape gets a later version. */
/* /2 — CTO R4 closeout: the governed user-job codes (jobKind … jobArtifactProducedKind). */
export const ASK_OBSERVATION_SCHEMA = 'ask-observation/2' as const;

/*
  CTO R4 CLOSEOUT — THE GOVERNED USER JOB, AS CODES. Closed vocabularies, copied here on purpose
  (this module reaches no router or Ask file); askObservation.job.spec.ts proves they equal the
  router's and the artifact's own lists. A value outside them is DROPPED (stored as null) by the
  writer, so no free text can arrive in these columns even if a producer emits it.
*/
export const OBSERVED_JOB_KINDS: ReadonlySet<string> = new Set([
  'EXPLANATION',
  'DEEP_CONCEPTUAL_ANALYSIS',
  'ADVISORY',
  'DECISION_SUPPORT',
  'PLANNING',
  'TRANSFORMATION',
  'COMPARISON',
  'PLACE_BACKGROUND',
  'CURRENT_REPORTING',
  'OFFICIAL_CURRENT_REFERENCE',
  'CHANGE_ANALYSIS',
  'RELATIONSHIP_ANALYSIS',
  'COMPUTATION',
  'WRITING',
  'MIXED',
  /* no job could be read (an UNRESOLVED route the classifier never decided) */
  'UNRESOLVED',
]);
export const OBSERVED_JOB_SOURCES: ReadonlySet<string> = new Set([
  'DETERMINISTIC',
  'SEMANTIC',
  'FALLBACK',
  'UNRESOLVED',
]);
export const OBSERVED_JOB_DEPTHS: ReadonlySet<string> = new Set(['STANDARD', 'DEEP']);
export const OBSERVED_JOB_FRESHNESS: ReadonlySet<string> = new Set(['NONE', 'PARTIAL', 'CURRENT']);
export const OBSERVED_TRANSFORMATIONS: ReadonlySet<string> = new Set([
  'PLAN',
  'TABLE',
  'CHECKLIST',
  'SUMMARY',
  'SCENARIOS',
  'COMPARISON',
  'EXPLAIN_MORE',
  'FIRST_STEP',
  'BRIEFING',
  'ACTION_STEPS',
]);
export const OBSERVED_DISCOURSE_REFERENCES: ReadonlySet<string> = new Set(['NONE', 'PRIOR_WORK']);
export const OBSERVED_ARTIFACT_KINDS: ReadonlySet<string> = new Set([
  'CONCEPTUAL_FRAMEWORK',
  'DIAGNOSIS',
  'COMPARISON',
  'DECISION_CRITERIA',
  'RECOMMENDATION',
  'PLAN',
  'SUMMARY',
]);

/** A code from its closed vocabulary, or null. */
export function governedCode(value: string | null, vocabulary: ReadonlySet<string>): string | null {
  return value !== null && vocabulary.has(value) ? value : null;
}

/**
 * THE ROUTE PATHS THE VOCABULARY DECLARES, AND THE ONE THAT HAS AN EMITTER.
 *
 * `LEGACY_ANALYSIS` is declared so the Admin surface can state the gap by name instead of
 * rendering a zero for a question nobody measured. R1 instruments the Ask R2 adapter and
 * NOTHING ELSE: the public analysis route is a different product surface, it is
 * unauthenticated, and adding a write to it would put a database insert on a public path
 * — which is the failure the telemetry module's global ceiling exists to prevent.
 *
 * `askObservation.privacy.spec.ts` asserts that no source file emits `LEGACY_ANALYSIS`, so
 * "not instrumented" is a measured statement about this codebase rather than a promise.
 */
export const ASK_ROUTE_PATHS = ['ASK_R2', 'LEGACY_ANALYSIS'] as const;
export type AskRoutePath = (typeof ASK_ROUTE_PATHS)[number];

/** The route paths an emitter exists for in this build. */
export const EMITTED_ASK_ROUTE_PATHS: readonly AskRoutePath[] = ['ASK_R2'];

/**
 * Attempts that never become an execution, counted rather than rowed.
 *
 * SIGNED_OUT_ATTEMPT  RequireAuthGuard refused the Ask before any operation existed.
 * ASK_SURFACE_ABSENT  AskV2EnabledGuard answered 404: the surface is switched off.
 *
 * Both are reachable without a credential, so each is a COUNTER keyed by (event, hour) and
 * never a row per attempt. Nothing a caller supplies enters the key.
 */
export const ASK_ACCESS_EVENTS = ['SIGNED_OUT_ATTEMPT', 'ASK_SURFACE_ABSENT'] as const;
export type AskAccessEvent = (typeof ASK_ACCESS_EVENTS)[number];

/** The counter bucket. One hour, so cardinality is (events x hours) and nothing else. */
export const ASK_ACCESS_BUCKET_MS = 60 * 60 * 1000;

export function accessBucketStart(now: Date): Date {
  return new Date(Math.floor(now.getTime() / ASK_ACCESS_BUCKET_MS) * ASK_ACCESS_BUCKET_MS);
}

/**
 * A deadline on the observation write, so a slow store can never hold an answer.
 *
 * DELIBERATELY ITS OWN CONSTANT rather than a read of `ComputeMeterService.config`. A
 * control's deadline governs whether an Ask may run; this one governs whether a
 * measurement is kept. Sharing the number would let a telemetry concern argue for changing
 * a control, and the two must never be able to move together. It matches the landed
 * control default today; that is a coincidence worth stating, not a dependency.
 */
export const ASK_OBSERVATION_STORE_DEADLINE_MS = 2_000;

/**
 * ASK PUBLIC BETA OPERATIONS R1 — THE RETENTION HORIZON, AND WHY IT IS 30 RATHER THAN 90.
 *
 * The platform's existing telemetry DECLARES 90 days and enforces nothing. This store goes
 * live on a public-facing path at Beta, so its bound had to be real, and a real bound
 * should be the shortest one that still answers the question the screen exists to answer.
 * Every panel reads a 24-hour or 7-day window; 30 days keeps roughly four weeks of history
 * for a trend nobody has asked for yet, and throws the rest away.
 *
 * SHORTER IS THE SAFE DIRECTION HERE. These rows carry no question and no account, so the
 * privacy cost of keeping them is low — but so is the product cost of dropping them, and a
 * bound nobody has to think about is worth more than a month of rows nobody reads.
 */
export const ASK_OBSERVATION_RETENTION_DAYS = 30;

/** At most one sweep per process per interval. Opportunistic, never a scheduler. */
export const ASK_OBSERVATION_RETENTION_SWEEP_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Rows removed per sweep. Bounded so the work is the same whether retention is one day or
 * one year behind: an unbounded delete on the path that answers readers is the failure this
 * number exists to prevent.
 */
export const ASK_OBSERVATION_RETENTION_BATCH = 5_000;

/**
 * The GOVERNED geography vocabulary an observation may carry.
 *
 * `GeographyCandidate.value` is produced by canonical resolvers and is an ISO3 code — plus
 * the resolver's own `CONTESTED` marker. This set is the writer's filter rather than its
 * documentation: a value outside it is DROPPED and counted, so a future producer that
 * emitted a reader's words into that field could not leak them through this table. The
 * privacy spec proves the drop with a positive control.
 */
export const GOVERNED_GEOGRAPHY_CODES: ReadonlySet<string> = new Set<string>([
  ...ALL_ISO3_CODES,
  'CONTESTED',
]);

export interface SanitizedGeography {
  readonly codes: readonly string[];
  readonly dropped: number;
}

/** Keeps governed codes, in first-seen order, and counts everything it refused. */
export function sanitizeGeographyCodes(values: readonly string[]): SanitizedGeography {
  const codes: string[] = [];
  let dropped = 0;
  for (const value of values) {
    if (typeof value === 'string' && GOVERNED_GEOGRAPHY_CODES.has(value)) {
      if (!codes.includes(value)) codes.push(value);
    } else {
      dropped += 1;
    }
  }
  return { codes, dropped };
}

/**
 * ONE ASK, AT MOST ONE OBSERVATION.
 *
 * `operationId` is the Ask V2 compute operation, and the column is UNIQUE, so the
 * guarantee is the database's rather than the writer's. It is also the reason a retry
 * cannot inflate a count: `AskV2Service` commits the durable RUNNING claim BEFORE the
 * external call, so an operation reaches the adapter once.
 */
export interface AskObservationInput {
  readonly operationId: string;
  readonly routePath: AskRoutePath;
  readonly adapterVersion: string;

  readonly questionClass: string;
  readonly queryIntent: string;
  readonly terminalState: string;
  readonly answerState: string;
  readonly answerBasis: string;
  readonly clarificationRequired: boolean;
  readonly capabilityUnavailable: boolean;
  readonly refusalCodes: readonly string[];
  readonly disclosureCodes: readonly string[];
  readonly clarificationCodes: readonly string[];

  readonly requestLanguage: string;
  readonly questionLanguage: string | null;
  readonly languageClassification: string;
  readonly normalizationStatus: string;

  readonly geographyCodes: readonly string[];
  readonly geographySources: readonly string[];
  readonly geographyPrecision: string;
  readonly scopedBy: string;

  readonly domains: readonly string[];
  readonly topicPresent: boolean;
  readonly temporalRequirement: string;
  readonly statedPeriodPresent: boolean;

  readonly evidenceRolesRequested: readonly string[];
  readonly evidenceRolesObtained: readonly string[];
  readonly evidenceRolesMissing: readonly string[];
  readonly reportingItemCount: number | null;
  /*
    INTELLIGENCE BINDING R1 — how Ask used governed contributors. Governed contributor IDS
    (e.g. CONFLICT, ECONOMY_CPI) and one count — never content, never a question, never an
    account. Considered = selected for this route; used = returned governed observations;
    degraded = relevant but NOT_ASSESSED / failed / refused. The count is governed observations
    used (geography context excluded). Null count = execution never reached the reads.
  */
  readonly contributorsConsidered: readonly string[];
  readonly contributorsUsed: readonly string[];
  readonly contributorsDegraded: readonly string[];
  readonly contributorItemCount: number | null;

  readonly computeClass: string;
  readonly providerId: string | null;
  readonly providerCallCount: number;
  readonly modelInvocationCount: number;
  readonly aiExecuted: boolean;
  readonly breakerOutcome: string | null;
  readonly promptTokens: number | null;
  readonly completionTokens: number | null;
  readonly latencyMs: number | null;

  readonly failureCode: string | null;
  readonly identityState: string;

  readonly askR2Enabled: boolean | null;
  readonly askPublicComputeEnabled: boolean | null;

  /* CTO R4 closeout — the governed user job (codes; null = no job reading for this Ask) */
  readonly jobKind: string | null;
  readonly jobSource: string | null;
  readonly jobDepth: string | null;
  readonly jobFreshness: string | null;
  readonly jobClassifierUsed: boolean | null;
  readonly jobTransformation: string | null;
  readonly jobDiscourseReference: string | null;
  readonly jobArtifactUsedKind: string | null;
  readonly jobArtifactProducedKind: string | null;
}

/**
 * The mutable form the executor fills as it goes, so that ONE emit point covers every exit
 * — the early zero-AI terminals, the control refusals that throw, and the answered path.
 *
 * It starts at the safest reading of an Ask that got nowhere: nothing routed, nothing
 * spent, nothing obtained. Every field is then overwritten by a measurement or left as the
 * declared absence it began as.
 */
export type AskObservationDraft = {
  -readonly [K in keyof Omit<AskObservationInput, 'operationId'>]: AskObservationInput[K];
};

export function newAskObservationDraft(
  adapterVersion: string,
  requestLanguage: string,
): AskObservationDraft {
  return {
    routePath: 'ASK_R2',
    adapterVersion,
    questionClass: 'UNROUTED',
    queryIntent: 'UNROUTED',
    terminalState: 'UNROUTED',
    answerState: 'UNROUTED',
    answerBasis: 'NOT_ROUTED',
    clarificationRequired: false,
    capabilityUnavailable: false,
    refusalCodes: [],
    disclosureCodes: [],
    clarificationCodes: [],
    requestLanguage,
    questionLanguage: null,
    languageClassification: 'UNROUTED',
    normalizationStatus: 'UNROUTED',
    geographyCodes: [],
    geographySources: [],
    geographyPrecision: 'UNROUTED',
    scopedBy: 'UNROUTED',
    domains: [],
    topicPresent: false,
    temporalRequirement: 'UNROUTED',
    statedPeriodPresent: false,
    evidenceRolesRequested: [],
    evidenceRolesObtained: [],
    evidenceRolesMissing: [],
    reportingItemCount: null,
    contributorsConsidered: [],
    contributorsUsed: [],
    contributorsDegraded: [],
    contributorItemCount: null,
    computeClass: 'UNKNOWN',
    providerId: null,
    providerCallCount: 0,
    modelInvocationCount: 0,
    aiExecuted: false,
    breakerOutcome: null,
    promptTokens: null,
    completionTokens: null,
    latencyMs: null,
    failureCode: null,
    identityState: 'ANONYMOUS',
    askR2Enabled: null,
    askPublicComputeEnabled: null,
    jobKind: null,
    jobSource: null,
    jobDepth: null,
    jobFreshness: null,
    jobClassifierUsed: null,
    jobTransformation: null,
    jobDiscourseReference: null,
    jobArtifactUsedKind: null,
    jobArtifactProducedKind: null,
  };
}

/**
 * The sentinel a draft carries until the router has actually answered for that axis.
 *
 * It is a VALUE, not a null, because a null in a grouped count is indistinguishable from a
 * column nobody wrote. `UNROUTED` appears on the Admin surface as itself, and an operator
 * seeing it is being told the truth: this Ask was refused before it was routed.
 */
export const ASK_OBSERVATION_UNROUTED = 'UNROUTED' as const;
