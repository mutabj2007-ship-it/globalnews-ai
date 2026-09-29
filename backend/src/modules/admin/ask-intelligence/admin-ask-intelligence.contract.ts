/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK PUBLIC BETA OPERATIONS MINIMUM R1 — THE READ CONTRACT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * FOUR GROUPS AND AN ALERT LIST. NOT AN ADMIN PRODUCT.
 *   health       can readers Ask, and is it answering?
 *   evidence     which capabilities readers needed and did not get
 *   operations   what is switched on, what is refusing, and why
 *   improvement  the aggregate top of what to fix next
 *   alerts       the operator-warning mechanism Public Beta cannot ship without
 * Everything the Ask router already derives is RECORDED; only what an operator needs to
 * run the Beta is RENDERED. Language, domain and geography are in the telemetry and reach
 * the screen only where they identify what to fix.
 *
 * THIS IS NOT A RAW-PROMPT SURVEILLANCE SCREEN, AND THE CONTRACT IS WHERE THAT STOPS BEING
 * A PROMISE. There is no field here for a question, a prompt, a search query, an account,
 * an address, a model prompt, an article body or a provider response — not a nullable one,
 * not an optional one, not a truncated one. A screen cannot render what the contract
 * cannot carry, and `adminAskIntelligence.privacy.spec.ts` asserts the absence over these
 * interfaces rather than over the service that fills them.
 *
 * ADMIN-LOCAL, FOR THE REASON `admin-analytics.contract.ts` STATES: this lane changes no
 * file under `shared/**`. The frontend mirrors these literals in
 * `frontend/src/lib/admin/adminApiTypes.ts` and
 * `frontend/src/lib/admin/adminAskIntelligenceContract.spec.ts` reads both files and fails
 * on drift, so the duplication cannot rot silently.
 *
 * THE FOUR RULES INHERITED FROM `admin-analytics.contract.ts`, UNCHANGED:
 *   - machine keys, never prose. The surface is EN and PL, so a sentence returned from the
 *     backend is untranslatable by construction.
 *   - a genuine counter is OMITTED when unpopulated, never zero-filled.
 *   - a section is null when it could NOT BE READ. Null is a failure, never an absence and
 *     never a zero.
 *   - a sample count travels with every aggregate over a nullable column.
 *
 * AND ONE THIS SURFACE ADDS, BECAUSE ITS DATA IS SHAPED DIFFERENTLY.
 *   - EXACT COUNTS AND SAMPLED COUNTS ARE NEVER MIXED SILENTLY. Scalar dimensions
 *     (answer state, failure code) are grouped by the database over the whole window and
 *     are exact. The list-valued dimensions (evidence roles, domains, geography codes,
 *     refusal codes) cannot be counted by a relational GROUP BY, so they are tallied from a
 *     BOUNDED, most-recent sample — and that sample's size, limit and truncation travel in
 *     the response as `arraySample`, so a screen can say "of the last N" instead of
 *     implying "of all".
 */

/** A counted dimension. `key` is always a machine value, never prose. */
export interface AdminAskCount {
  key: string;
  count: number;
}

/**
 * An aggregate over a NULLABLE column, carrying the number of rows that actually had a
 * value. The aggregate fields are omitted entirely when `sampleCount` is 0: a mean over
 * zero rows is not zero, it does not exist.
 */
export interface AdminAskSample {
  sampleCount: number;
  averageMs?: number;
  minMs?: number;
  maxMs?: number;
  medianMs?: number;
  p95Ms?: number;
}

export interface AdminAskTokenTotals {
  sampleCount: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

/**
 * The bound on every list-valued tally in this response.
 *
 * WITHOUT THIS THE SCREEN WOULD BE LYING BY OMISSION. A tally over the most recent rows is
 * a different measurement from a tally over the window, and at low volume the two coincide
 * — which is exactly when nobody notices the difference has been built in.
 */
export interface AdminAskArraySample {
  sampleCount: number;
  limit: number;
  truncated: boolean;
}

/**
 * HEALTH — CAN READERS ASK, AND IS IT ANSWERING?
 *
 * THE THREE NUMBERS THAT ARE NOT THE SAME NUMBER, NAMED APART SO NOBODY ADDS THEM UP:
 *   attempts*     Ask operations quoted. A reader who asked. Deep and report work stops at
 *                 a quote and may never be accepted, so this is always >= executions.
 *   executions*   Ask executions observed. One per execution attempt, refusals included.
 *   completions*  executions that returned an answer — an execution with no failure code.
 * `storedResultReused*` completed from a stored result WITHOUT reaching the executor, so
 * those have no observation by construction and are counted from the operation record.
 */
export interface AdminAskHealth {
  attemptsLast24h: number;
  attemptsLast7d: number;
  executionsLast24h: number;
  executionsLast7d: number;
  completionsLast24h: number;
  failuresLast24h: number;
  storedResultReusedLast7d: number;
  modelInvocationsLast24h: number;
  providerCallsLast24h: number;
  /** Executions that reached a terminal answer with NO model invocation at all. */
  zeroModelLast24h: number;
  latency: AdminAskSample;
  tokens: AdminAskTokenTotals;
  byAnswerState: AdminAskCount[];
  declaredAnswerStates: string[];
  clarificationRequiredLast7d: number;
  capabilityUnavailableLast7d: number;
}

/** One evidence role: what plans asked for, what execution got, what stayed unavailable. */
export interface AdminAskEvidenceRole {
  role: string;
  requested: number;
  obtained: number;
  unavailable: number;
}

/**
 * CAPABILITY / EVIDENCE GAPS — THE PANEL THAT TELLS PRODUCT WHERE TO INVEST.
 *
 * A role with a high `requested` and a zero `obtained` is a capability readers keep needing
 * and the platform keeps not having. `reservedInactiveRoles` names the roles that CANNOT be
 * satisfied in this build at all, so a zero there reads as a hold rather than as demand
 * that was met, and `executorSuppliedRoles` names the only role this executor can supply —
 * everything else refuses rather than substituting ordinary reporting for it.
 */
export interface AdminAskEvidence {
  roles: AdminAskEvidenceRole[];
  declaredRoles: string[];
  reservedInactiveRoles: string[];
  executorSuppliedRoles: string[];
  reportingItems: AdminAskSample;
}

/**
 * One breaker row, as the shared store holds it.
 *
 * `state` is the stored value verbatim. A provider with no row has never been recorded and
 * is absent here rather than shown CLOSED — an unrecorded breaker is not a healthy one.
 */
export interface AdminAskBreakerRow {
  provider: string;
  state: string;
  openUntil: string | null;
  cooldownS: number;
  trialsInFlight: number;
  updatedAt: string;
}

/**
 * One operational switch, resolved through the SAME service the Ask path consults.
 *
 * `effective` is the two-key answer: the deployment variable is the literal 'true' AND the
 * audited row enables it. `readable` is false when the store could not be read, and an
 * unreadable switch is NOT a switch that is off — it is a switch whose state is unknown,
 * which the screen must say.
 *
 * `setBy` IS DELIBERATELY ABSENT. It names a person. The audit surface is where an actor
 * belongs; an Ask operations payload is not, and leaving the field out of the contract is
 * what keeps that true of every future screen as well.
 */
export interface AdminAskSwitchRow {
  name: string;
  deploymentValueIsLiteralTrue: boolean;
  rowPresent: boolean;
  rowEnabled: boolean | null;
  effective: boolean;
  readable: boolean;
  setAt: string | null;
}

/**
 * OPERATIONS — WHAT IS SWITCHED ON, WHAT IS REFUSING, AND WHY.
 *
 * `legacyRollback` IS THE ROLLBACK QUESTION, ANSWERED HONESTLY. The route-path vocabulary
 * declares the legacy Ask path so the screen can name it; R1 instruments the Ask R2 adapter
 * and nothing else, so `legacyInstrumented` is false and the panel must say "not
 * instrumented" rather than render a zero that would read as "no rollback happened".
 */
export interface AdminAskOperations {
  switches: AdminAskSwitchRow[];
  breakers: AdminAskBreakerRow[];
  budgetRejections: AdminAskCount[];
  circuitRejections: AdminAskCount[];
  switchRejections: AdminAskCount[];
  providerErrors: AdminAskCount[];
  failureCodes: AdminAskCount[];
  byBreakerOutcome: AdminAskCount[];
  signedOutAttempts: AdminAskCount[];
  declaredAccessEvents: string[];
  accessBucketHours: number;
  byRoutePath: AdminAskCount[];
  declaredRoutePaths: string[];
  instrumentedRoutePaths: string[];
  legacyInstrumented: boolean;
}

/**
 * THE IMPROVEMENT QUEUE — AGGREGATES ONLY, BY CONSTRUCTION.
 *
 * Every row is a COUNT against a machine key, and the denominator it should be read against
 * travels beside it. There is no example question, no sample utterance and no row that
 * could be traced to a person: the concept is "REFERENCE, 38% of capability-unavailable
 * attempts", never a question somebody typed attributed to whoever typed it.
 *
 * `poorOutcomeStates` names which answer states this panel treats as poor, so the
 * definition is inspectable rather than implied by the number.
 */
export interface AdminAskImprovement {
  observationsInWindow: number;
  capabilityUnavailableTotal: number;
  unavailableByQuestionClass: AdminAskCount[];
  missingEvidenceRoles: AdminAskCount[];
  failureReasons: AdminAskCount[];
  affectedQuestionClasses: AdminAskCount[];
  affectedDomains: AdminAskCount[];
  affectedCountries: AdminAskCount[];
  poorOutcomeStates: string[];
  refusalCodes: AdminAskCount[];
  countryLimit: number;
}

/**
 * `INSUFFICIENT_SAMPLE` IS NOT `UNKNOWN`, AND NEITHER IS `OK`.
 *
 * Product Owner ruling (ASK PUBLIC BETA OPERATIONS R1): a rate whose denominator is below
 * the minimum sample must never be rendered as OK merely because too little has happened.
 * It is also not `UNKNOWN`: the figure WAS measurable, there is simply not enough of it yet,
 * which is a normal early-Beta state rather than a possible outage. Two different facts, two
 * different words, so an operator can tell a quiet hour from a blind one.
 */
export type AdminAskAlertSeverity =
  'OK' | 'WARNING' | 'CRITICAL' | 'INSUFFICIENT_SAMPLE' | 'UNKNOWN';

/**
 * ONE OPERATOR ALERT.
 *
 * EVERY THRESHOLD IS DERIVED FROM A LANDED KNOB OR A LANDED BUDGET, NEVER FROM AN INVENTED
 * CURRENCY. `ceiling` is the measured denominator the threshold came from — the hourly unit
 * ceiling, the request-size ceiling, the analysis time budget, the breaker's own minimum
 * sample count — so an operator can see WHY a line is amber rather than being asked to
 * trust it. The two rate thresholds that have no landed anchor are marked
 * `thresholdSource: 'PRODUCT_OWNER_RULED'`, which is how this surface records a number the
 * Product Owner has DECIDED — as distinct from `compute-controls.config.ts`'s marker for a
 * knob still awaiting one.
 *
 * `observed` is null when the figure could not be measured, and the severity is then
 * UNKNOWN — never OK. An alert that cannot be evaluated is not an alert that passed.
 */
export interface AdminAskAlert {
  id: string;
  severity: AdminAskAlertSeverity;
  observed: number | null;
  warnAt: number;
  criticalAt: number;
  /**
   * What `observed` IS: 'RATIO', 'MS' or 'COUNT'.
   *
   * EVERY SATURATION ALERT IS A RATIO, INCLUDING THE CALL-VOLUME ONES. They compare a
   * measured count to a derived ceiling, so the number they carry is a fraction between 0
   * and 1 — labelling one of them `CALLS_PER_HOUR` made a screen round 0.44 to `0` and
   * report a three-quarters-full hour as empty. What the CEILING counts is a separate fact
   * and has its own field.
   */
  unit: string;
  /** The landed number the thresholds were derived from, where there is one. */
  ceiling: number | null;
  /** What `ceiling` counts: 'UNITS_PER_HOUR', 'UNITS_PER_DAY', 'CALLS_PER_HOUR' or 'MS'. */
  ceilingUnit: string;
  thresholdSource: string;
  /** MINUTES, not hours: the ruled rate windows are 15 minutes and do not divide into one. */
  windowMinutes: number;
  /** Rows the figure rests on, so a ratio over three attempts is not read as a rate. */
  sampleCount: number;
  minimumSampleCount: number;
}

/**
 * THE OPERATOR-WARNING MECHANISM. Public Beta may not ship without one.
 *
 * `procedureDocument` is a repository path, not prose: the response procedure is written
 * once, in the runbook, and the screen points at it rather than paraphrasing it in two
 * languages.
 */
export interface AdminAskAlerts {
  alerts: AdminAskAlert[];
  worstSeverity: AdminAskAlertSeverity;
  procedureKey: string;
  procedureDocument: string;
}

export interface AdminAskWindows {
  shortHours: number;
  longHours: number;
}

/**
 * Retention, and unlike the platform's existing telemetry disclosure this one is ENFORCED.
 * `enforcedBy` names the mechanism so an operator can tell a swept store from a declared
 * rule: the existing analytics surface ships `enforced: false` precisely because nothing
 * applies its 90-day rule.
 */
export interface AdminAskRetention {
  declaredDays: number;
  enforced: boolean;
  enforcedBy: string;
}

/**
 * THE STRUCTURAL FACTS THE SCREEN MUST BE ABLE TO STATE.
 *
 * Every one is a property of the build, not of the window, and each is typed as a literal
 * where it can never be otherwise in R1. A future change that made one of them true would
 * have to change this type, which is the review gate.
 */
export interface AdminAskDisclosures {
  /** No question text is stored by this telemetry. There is no column for one. */
  rawQuestionStored: false;
  /** A restricted Question Review mode is proposed in the runbook, and is NOT implemented. */
  questionReviewImplemented: false;
  /** No governed price source exists, so no monetary figure is produced anywhere. */
  monetaryCostAvailable: false;
  /** Deriving one needs a user-agent, which no telemetry here reads. */
  deviceClassAvailable: false;
  /** R1 is read-only: this surface exposes no action, and the module has no write path. */
  readOnly: true;
  /** True only if some emitter records the legacy route path. In R1 nothing does. */
  legacyRoutePathInstrumented: boolean;
  /** Ask operations that stop at a quote and are never executed have no observation. */
  quotedWithoutExecutionObserved: false;
}

/**
 * GET /admin/ai/ask-intelligence — capability analytics.view.
 *
 * AGGREGATES ONLY. There is no row, no identifier and no free text in this response, and
 * the service that builds it selects no column that could carry one.
 *
 * Each section is null when ITS read FAILED. The frontend renders a null section as an
 * error with a retry, never as "no source" and never as a zero.
 */
export interface AdminAskIntelligenceResponse {
  health: AdminAskHealth | null;
  evidence: AdminAskEvidence | null;
  operations: AdminAskOperations | null;
  improvement: AdminAskImprovement | null;
  alerts: AdminAskAlerts | null;
  arraySample: AdminAskArraySample;
  windows: AdminAskWindows;
  retention: AdminAskRetention;
  disclosures: AdminAskDisclosures;
  generatedAt: string;
}

/* ── CONSTANTS ───────────────────────────────────────────────────────────── */

export const ADMIN_ASK_SHORT_WINDOW_HOURS = 24;
export const ADMIN_ASK_LONG_WINDOW_HOURS = 24 * 7;

/** The cap on every list-valued tally, and on the country list. */
export const ADMIN_ASK_ARRAY_SAMPLE_LIMIT = 5_000;
export const ADMIN_ASK_COUNTRY_LIMIT = 25;

/** The runbook that says what to do when a line turns amber. */
export const ADMIN_ASK_PROCEDURE_KEY = 'ASK_BETA_OPERATOR_RUNBOOK_R1';
export const ADMIN_ASK_PROCEDURE_DOCUMENT = 'docs/ask-public-beta-operations-r1-runbook.md';

/**
 * The answer states this surface treats as a poor outcome for the Improvement Queue.
 *
 * CLARIFICATION_REQUIRED IS NOT ONE OF THEM, AND THAT IS A JUDGEMENT WORTH STATING. Frozen
 * C calls clarification "a successful terminal costing no provider/model execution": asking
 * the reader what they meant is the system working, not failing. Counting it as a defect
 * would push Product toward answering questions nobody asked, which is the exact behaviour
 * the router was built to refuse. It is reported on its own, in Health.
 */
export const ADMIN_ASK_POOR_OUTCOME_STATES: readonly string[] = [
  'INSUFFICIENT',
  'CAPABILITY_UNAVAILABLE',
];

/* ── ALERT THRESHOLDS ────────────────────────────────────────────────────── */

/**
 * The alert identifiers, in the order an operator should read them: what is broken, then
 * what is saturating, then what is degrading.
 */
export const ADMIN_ASK_ALERT_IDS = [
  'PROVIDER_BREAKER_OPEN',
  'BUDGET_SATURATION_HOUR',
  'BUDGET_SATURATION_DAY',
  'BUDGET_REJECTION_RATE',
  'MODEL_CALL_VOLUME_HOUR',
  'PROVIDER_CALL_VOLUME_HOUR',
  'TOKEN_VOLUME_HOUR',
  'FAILURE_RATE',
  'LATENCY_P95',
] as const;
export type AdminAskAlertId = (typeof ADMIN_ASK_ALERT_IDS)[number];

/** Saturation of a landed unit ceiling. A ratio of a measured meter to a landed knob. */
export const ADMIN_ASK_SATURATION_WARN = 0.7;
export const ADMIN_ASK_SATURATION_CRITICAL = 0.9;

/**
 * THE TWO RULED RATES — Product Owner ruling, ASK PUBLIC BETA OPERATIONS R1.
 *
 * These were shipped marked `PO_PENDING`, which is how this codebase records a number the
 * Product Owner has not decided. They are now DECIDED, and the placeholders are gone rather
 * than merely overwritten: `thresholdSource` reads `PRODUCT_OWNER_RULED`.
 *
 * INTERNAL PUBLIC BETA OPERATIONAL THRESHOLDS. Not a user-facing SLA, not a commitment to
 * anybody, and not a pricing rule — there is no monetary figure anywhere in this surface.
 *
 * THE TWO DENOMINATORS ARE DIFFERENT, AND THE RULING NAMES THEM DIFFERENTLY.
 *   BUDGET_REJECTION_RATE  minimum sample "20 Ask attempts"          -> attempts quoted
 *   FAILURE_RATE           minimum sample "20 executed Ask attempts" -> executions observed
 * An attempt that stops at a quote can never be budget-rejected, so measuring the refusal
 * rate against attempts is the stricter reading: it counts the refusals against everyone who
 * asked, not only against those who got as far as the executor. Implemented as worded.
 */
export const ADMIN_ASK_RATE_WINDOW_MINUTES = 15;
export const ADMIN_ASK_RATE_MINIMUM_SAMPLE = 20;

export const ADMIN_ASK_REJECTION_RATE_WARN = 0.05;
export const ADMIN_ASK_REJECTION_RATE_CRITICAL = 0.15;
export const ADMIN_ASK_FAILURE_RATE_WARN = 0.05;
export const ADMIN_ASK_FAILURE_RATE_CRITICAL = 0.1;

/** Fractions of the landed analysis time budget at which latency is worth looking at. */
export const ADMIN_ASK_LATENCY_WARN_FRACTION = 0.6;
export const ADMIN_ASK_LATENCY_CRITICAL_FRACTION = 0.9;

export const ADMIN_ASK_THRESHOLD_SOURCES = {
  breakerState: 'LANDED_BREAKER_STATE',
  globalUnitsPerHour: 'LANDED_ASK_GLOBAL_UNITS_PER_HOUR',
  globalUnitsPerDay: 'LANDED_ASK_GLOBAL_UNITS_PER_DAY',
  requestCeiling: 'LANDED_ASK_GLOBAL_UNITS_PER_HOUR_OVER_ASK_UNITS_PER_REQUEST_MAX',
  analysisBudget: 'LANDED_ANALYSIS_TOTAL_BUDGET_MS',
  /* Decided by the Product Owner for Public Beta R1. Not derived, and no longer pending. */
  ownerRuled: 'PRODUCT_OWNER_RULED',
} as const;
