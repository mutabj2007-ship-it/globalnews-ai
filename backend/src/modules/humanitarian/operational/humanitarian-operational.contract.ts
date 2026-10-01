/**
 * ════════════════════════════════════════════════════════════════════════════
 * HUMANITARIAN OPERATIONAL STATUS — THE VOCABULARY
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The mission: give operators visibility into Humanitarian data health BEFORE a
 * source is allowed to fail silently.
 *
 * ── WHAT THE INSPECTION FOUND, BECAUSE IT SHAPES EVERY TYPE BELOW ───────────
 *
 * The brief names three sources. Measured against the tree at the accepted
 * baseline:
 *
 *   GDACS       NO CODE AT ALL. `grep -rli gdacs` over the repository returns
 *               zero files. No env var, no producer, no acquisition.
 *   ReliefWeb   NO CODE AT ALL. Its only occurrence is in a FRONTEND GUARD that
 *               forbids naming it. No `appname` variable exists for anything to
 *               read.
 *   Copernicus  A TRANSFORM producer exists. Acquisition does not: there is no
 *               `fetch`, no HTTP client and no env var anywhere in the
 *               humanitarian tree, and `assertActivationPermitted()` has return
 *               type `never`.
 *
 * And there is no humanitarian table in Prisma at all — persistence exists only
 * as UNAPPLIED SQL in schemas Prisma never sees. So there is no acquisition
 * attempt log, no error row, no counter, no cache and no language column.
 *
 * ── THE CONSEQUENCE: A ZERO IS A LIE HERE ───────────────────────────────────
 *
 * A dashboard with "records admitted: 0, records withheld: 0, errors: 0" would
 * read as *the sources ran and found nothing*. The truth is *nothing ever ran,
 * and for two of them nothing exists to run*. Those are opposite operational
 * situations and the first is the dangerous one — it is precisely the silent
 * failure this surface exists to prevent.
 *
 * So no quantity on this surface is a bare number. Every one is a
 * `MeasuredFact`: either a value that was actually measured, or
 * `NOT_INSTRUMENTED` naming the instrument that does not exist. A renderer
 * cannot accidentally print 0 for something nobody counted, because there is no
 * 0 to print.
 */

/* ══════════════════════════════════════════════════════════════════════════
 * 1 · A FACT THAT KNOWS WHETHER IT WAS MEASURED
 * ══════════════════════════════════════════════════════════════════════════ */

export type MeasuredFact<T> =
  | { readonly state: 'MEASURED'; readonly value: T }
  /**
   * No instrument exists. `because` names the missing instrument in operator
   * language — not "unknown", which reads as a transient gap in something that
   * otherwise works.
   */
  | { readonly state: 'NOT_INSTRUMENTED'; readonly because: string };

export const measured = <T>(value: T): MeasuredFact<T> => ({ state: 'MEASURED', value });
export const notInstrumented = <T>(because: string): MeasuredFact<T> => ({
  state: 'NOT_INSTRUMENTED',
  because,
});

/* ══════════════════════════════════════════════════════════════════════════
 * 2 · MODULE STATUS — THE SIX THE PRODUCT OWNER NAMED
 * ══════════════════════════════════════════════════════════════════════════ */

export const HUMANITARIAN_MODULE_STATUSES = [
  'NOT_ASSESSED',
  'PARTIAL',
  'RETAINED',
  'CURRENT',
  'SOURCE_UNAVAILABLE',
  'COVERAGE_GAP',
] as const;
export type HumanitarianModuleStatus = (typeof HUMANITARIAN_MODULE_STATUSES)[number];

/**
 * The statuses that assert data EXISTS. Reaching one requires admitted records;
 * no process-health signal may produce them.
 *
 * "Never display healthy merely because the HTTP process is healthy" is
 * enforced structurally: `deriveModuleStatus` takes no liveness input at all,
 * so there is no argument through which process health could reach this.
 */
export const POSITIVE_MODULE_STATUSES: readonly HumanitarianModuleStatus[] = Object.freeze([
  'PARTIAL',
  'RETAINED',
  'CURRENT',
]);

/** Phrases that must never appear in operator copy for an unassessed module. */
export const STATUS_MUST_NOT_IMPLY: readonly string[] = Object.freeze([
  'healthy',
  'ok',
  'normal',
  'stable',
  'no events',
  'all clear',
  'up to date',
]);

/* ══════════════════════════════════════════════════════════════════════════
 * 3 · SOURCES — AND WHAT "CONFIGURED" HONESTLY MEANS
 * ══════════════════════════════════════════════════════════════════════════ */

export const HUMANITARIAN_SOURCE_IDS = ['GDACS', 'RELIEFWEB', 'COPERNICUS_EMS'] as const;
export type HumanitarianSourceId = (typeof HUMANITARIAN_SOURCE_IDS)[number];

/**
 * Four distinguishable implementation states. The brief asks for "configured /
 * not configured", which is a two-state answer — and two states cannot separate
 * *no code exists* from *code exists and is switched off*. An operator told
 * "not configured" about GDACS would reasonably go looking for the
 * configuration. There is none to find.
 */
export const SOURCE_IMPLEMENTATION_STATES = [
  /** No producer, no configuration surface, nothing to configure. */
  'NOT_IMPLEMENTED',
  /** Transform/producer code exists; no acquisition path exists. */
  'TRANSFORM_ONLY_NO_ACQUISITION',
  /** Acquisition exists but is not configured in this deployment. */
  'IMPLEMENTED_NOT_CONFIGURED',
  /** Acquisition exists and is configured. */
  'CONFIGURED',
] as const;
export type SourceImplementationState = (typeof SOURCE_IMPLEMENTATION_STATES)[number];

/** Activation is a separate axis from implementation, and from configuration. */
export const SOURCE_ACTIVATION_STATES = ['NOT_CLEARED', 'CLEARED_NOT_RUNNING', 'RUNNING'] as const;
export type SourceActivationState = (typeof SOURCE_ACTIVATION_STATES)[number];

/**
 * Credential presence — BOOLEAN ONLY, by type.
 *
 * There is no `string` anywhere in this shape, so a secret cannot be carried by
 * it even by mistake. `variableName` is the NAME of the variable, never its
 * value, and a test asserts the serialised payload contains no value from the
 * process environment.
 */
export interface CredentialPresence {
  readonly variableName: string;
  readonly present: boolean;
}

export interface HumanitarianSourceStatus {
  readonly sourceId: HumanitarianSourceId;
  readonly implementation: SourceImplementationState;
  readonly activation: SourceActivationState;
  /** Why this source is in that state, in one operator-readable sentence. */
  readonly basis: string;

  readonly lastSuccessfulAcquisition: MeasuredFact<string | null>;
  readonly lastAttemptedAcquisition: MeasuredFact<string | null>;
  readonly lastRetainedRecordAt: MeasuredFact<string | null>;
  readonly recordsAdmitted: MeasuredFact<number>;
  readonly recordsWithheld: MeasuredFact<number>;
  /** AGGREGATE counts per reason. Never per record, per place or per activation. */
  readonly withholdReasons: MeasuredFact<ReadonlyArray<{ code: string; count: number }>>;
  readonly sourceErrors: MeasuredFact<ReadonlyArray<{ code: string; count: number }>>;
  readonly coverage: MeasuredFact<HumanitarianModuleStatus>;
  readonly languageCounts: MeasuredFact<ReadonlyArray<{ language: string; count: number }>>;
  readonly cacheAgeSeconds: MeasuredFact<number>;
  readonly credentials: readonly CredentialPresence[];
}

/* ══════════════════════════════════════════════════════════════════════════
 * 4 · DISCLOSURE LIMITS — TWO, BOTH INHERITED, NEITHER MINE TO WAIVE
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * LIMIT 1 — ARTICLE 53 (Copernicus).
 *
 * `COPERNICUS_RIGHTS` records, verbatim: *"Article 53 of Regulation (EU)
 * 2021/696 restricts some activations. Never publish an activation inventory,
 * and never publish 'no activation here' — the gaps would be the sensitive
 * ones."*
 *
 * This bites on the brief's "coverage status". A per-place or per-activation
 * coverage breakdown IS an activation inventory, and a per-place "nothing here"
 * is the second forbidden thing explicitly. So coverage is reported at MODULE
 * granularity only, and this surface carries no place, region or activation
 * dimension at all — not merely empty today, but absent from the types.
 */
export const COVERAGE_GRANULARITY = 'MODULE_ONLY' as const;

/**
 * LIMIT 2 — THE NON-INJECTIVE READER PROJECTION.
 *
 * `shared/src/observation/absence.ts` keeps `EVIDENCE_WITHHELD`,
 * `SOURCE_NOT_CONNECTED` and `SOURCE_TEMPORARILY_UNAVAILABLE` as
 * `INTERNAL_ONLY_ABSENCE_STATES` — "members that must NEVER reach a reader as
 * themselves" — because "a lossless projection would let a reader invert it and
 * recover the withhold".
 *
 * An OPERATOR surface legitimately needs those internals; that is what
 * operational visibility is. The condition is that it stays an operator
 * surface: behind the admin guard chain, and never reachable from a public
 * read. Withhold reasons are therefore AGGREGATE COUNTS PER CODE — never a
 * per-record list, which would let the same inversion happen one row at a time.
 */
export const WITHHOLD_REPORTING = 'AGGREGATE_COUNTS_ONLY' as const;

/* ══════════════════════════════════════════════════════════════════════════
 * 5 · OPERATIONAL ALERT CONDITIONS
 * ══════════════════════════════════════════════════════════════════════════ */

export const HUMANITARIAN_ALERT_IDS = [
  'FEED_STALE',
  'REPEATED_SOURCE_FAILURE',
  'ALL_SOURCES_UNAVAILABLE',
  'PARSER_REJECTION_SPIKE',
  'PROTECTED_GEOMETRY_REFUSAL_SPIKE',
  'DATA_VOLUME_UNEXPECTEDLY_ZERO',
] as const;
export type HumanitarianAlertId = (typeof HUMANITARIAN_ALERT_IDS)[number];

/**
 * A condition, and whether it could fire TODAY.
 *
 * `canFireToday: false` with `requires` naming the missing instrument is the
 * honest state for all six right now. Declaring a condition that silently never
 * evaluates is how a monitoring surface comes to be trusted for something it
 * never checked — the operator sees six green conditions and concludes six
 * things were tested.
 */
export interface HumanitarianAlertCondition {
  readonly id: HumanitarianAlertId;
  readonly describes: string;
  readonly canFireToday: boolean;
  /** The instrument that must exist first. Empty only when `canFireToday`. */
  readonly requires: string;
}

/** OPERATIONAL ONLY. No user notification is emitted by anything here. */
export const ALERTS_ARE_OPERATOR_ONLY = true as const;
export const USER_NOTIFICATIONS_EMITTED = false as const;

export interface HumanitarianOperationalStatus {
  readonly moduleStatus: HumanitarianModuleStatus;
  readonly moduleStatusBasis: string;
  readonly coverageGranularity: typeof COVERAGE_GRANULARITY;
  readonly withholdReporting: typeof WITHHOLD_REPORTING;
  readonly sources: readonly HumanitarianSourceStatus[];
  readonly alerts: readonly HumanitarianAlertCondition[];
  readonly generatedAt: string;
}
