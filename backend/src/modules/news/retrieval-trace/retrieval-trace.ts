import { AsyncLocalStorage } from 'node:async_hooks';
import { createHmac } from 'node:crypto';

/*
  RETRIEVAL R1 · T1 — ONE LOSSLESS, PASSIVE TRACE PER ANALYSIS RUN.

  WHAT THIS IS. A per-operation ledger that NewsService and ArticlePersistenceService write
  into while they work, scoped by AsyncLocalStorage exactly like the retrieval budget
  (retrieval-budget.ts) — but in its OWN store, so the budget's semantics cannot move.

  WHAT IT MUST NEVER DO (CTO T1 contract):
  - change a decision. Every write below is a count of something that already happened;
    nothing here is read back by a provider, filter, gate, persistence or model path.
  - throw into the caller. Every public entry point swallows its own errors: telemetry must be
    unable to change what it is counting (the R5 lesson in news.service.ts).
  - record content. No question text, no sent query text (E1 has not approved storing it here;
    A4's sentQueries already carries the one approved representation), no title, URL, summary,
    user id or credential. A query is recorded only by its length and, when a governed server key
    is configured, a purpose-separated keyed HMAC fingerprint (T1.1: never an unkeyed hash).
  - grow without bound. Attempts, searches, reason codes and reads are capped; the cap is
    recorded rather than silently applied.

  OUTSIDE AN ANALYSIS RUN (Home, the public search endpoint, country pages) there is no
  collector and every hook is a no-op, so those paths are byte-for-byte unchanged.
*/

export const RETRIEVAL_DIAGNOSTICS_SCHEMA = 'retrieval-diagnostics/2' as const;

export const TRACE_LIMITS = Object.freeze({
  attempts: 40,
  searches: 20,
  reasonCodesPerSearch: 12,
  retainedReads: 20,
  countryTags: 8,
});

export type AttemptTier = 'PRIMARY' | 'FALLBACK' | 'RESCUE';

/** CTO T1 outcome taxonomy, plus the two budget states the pipeline already distinguishes. */
export type AttemptOutcome =
  | 'SUCCESS'
  | 'ZERO_RAW'
  | 'RATE_LIMIT'
  | 'TIMEOUT'
  | 'QUOTA'
  | 'AUTH'
  | 'NETWORK'
  | 'MALFORMED'
  | 'BAD_REQUEST'
  | 'UNAVAILABLE'
  | 'BUDGET_SKIPPED'
  | 'NOT_AWAITED'
  | 'UNKNOWN';

export interface AttemptRecord {
  ordinal: number;
  /** The search() this attempt served, or null for non-search capabilities (top-headlines). */
  searchOrdinal: number | null;
  providerId: string;
  capability: string;
  tier: AttemptTier;
  initiatedAt: string | null;
  durationMs: number | null;
  /** What the pipeline USED. A late completion never overwrites it (see lateOutcome). */
  outcome: AttemptOutcome;
  /** Provider result count BEFORE any window, attribution, dedup, cap or relevance gate. */
  rawFetchedCount: number | null;
  requestedLang: string | null;
  sentLang: string | null;
  /** Observed after the tier stopped awaiting this provider; diagnostic only, never evidence. */
  lateOutcome: AttemptOutcome | null;
  lateRawFetchedCount: number | null;
}

export interface RetainedRungStages {
  mode: 'TERM_PARITY' | 'SCORE' | 'NONE';
  considered: number;
  windowExcluded: number;
  lexicalRejected: number;
  geoRejected: number;
  geoVerdicts: Record<string, number>;
  relevanceRejected: number;
  requestedSourceExcluded: number;
  admitted: number;
}

export interface SearchStages {
  builds: number;
  rawFetched: number;
  requestedSourceExcluded: number;
  windowExcluded: number;
  perProviderDuplicatesCollapsed: number;
  crossProviderDuplicatesCollapsed: number;
  cappedOut: number;
  /** Persisted-country identity assigned by resolveArticleCountries to the survivors. */
  countryTags: Record<string, number>;
  countryUnresolved: number;
  relevanceMode: string;
  relevanceRejected: number;
  relevanceReasons: Record<string, number>;
  relevanceReasonsTruncated: number;
  requestedSourceConstraintExcluded: number;
  admittedLive: number;
  /** Count handed to persistMany (rows written are decided by the DB upsert, not observed). */
  persistRequested: number | null;
  survivorsWithoutSuccessfulAttempt: number;
}

export interface SearchRecord {
  ordinal: number;
  capability: 'search';
  /** Keyed HMAC (see queryFingerprint). ABSENT when no governed key is configured. */
  queryFingerprint?: string;
  queryLength: number;
  requestedLang: string | null;
  sentLangGnews: string | null;
  window: { from: string; to: string } | null;
  limit: number | null;
  relevanceMode: string;
  requestedSource: boolean;
  allowFallback: boolean;
  postRelevanceRescue: boolean;
  stages: SearchStages | null;
  retained: RetainedRungStages | null;
  returnedFrom: 'LIVE' | 'RETAINED' | 'EMPTY' | 'NO_REAL_PROVIDER' | null;
  returned: number | null;
}

/*
  RETRIEVAL R1 · T1.1 — RIGHTS DECISIONS, PER USE, ONLY WHERE ONE ACTUALLY EXECUTED.
  A point is present only when its gate ran on this operation; nothing here is ever "cleared"
  (allowedPendingReview is the 'record' path: used while under review, not cleared).
*/
export const RIGHTS_DECISION_POINTS = Object.freeze([
  'AI_INPUT@ANALYSIS_EVIDENCE',
  'AI_INPUT@STORED_READ',
] as const);
export type RightsDecisionPoint = (typeof RIGHTS_DECISION_POINTS)[number];

export interface RightsDecisionCounts {
  evaluated: number;
  /** null where the gate cannot separate it (a stored read only knows admitted / excluded). */
  allowedCleared: number | null;
  allowedPendingReview: number | null;
  excluded: number;
}

export interface RetainedReadRecord {
  method: string;
  returned: number;
}

export interface TraceSnapshot {
  attempts: AttemptRecord[];
  attemptsTruncated: number;
  searches: SearchRecord[];
  searchesTruncated: number;
  retainedReads: RetainedReadRecord[];
  retainedReadsTruncated: number;
  storedRightsDrops: Record<string, number>;
  rightsDecisions: Partial<Record<RightsDecisionPoint, RightsDecisionCounts>>;
  modelInput: number | null;
  cited: number | null;
}

/*
  RETRIEVAL R1 · T1.1 (E1-08 C-1, CTO R2 Decision 2) — THE QUERY FINGERPRINT IS KEYED OR ABSENT.
  An unkeyed hash of a news query is confirmable by guessing, so it is never stored. The key is a
  dedicated, governed server secret (RETRIEVAL_TRACE_FINGERPRINT_KEY, at least 32 bytes); it is
  never derived from an unrelated secret, never hard-coded and never generated per process. Without
  it the fingerprint is OMITTED: there is no fallback hash. The key is purpose-separated before use,
  so the same secret can never yield a value comparable with another feature's HMAC.
*/
export const QUERY_FINGERPRINT_KEY_ENV = 'RETRIEVAL_TRACE_FINGERPRINT_KEY';
const QUERY_FINGERPRINT_PURPOSE = 'globalnews/retrieval-trace/query-fingerprint/v1';
const QUERY_FINGERPRINT_MIN_KEY_BYTES = 32;

export function queryFingerprint(
  query: string,
  env: Readonly<Record<string, string | undefined>> = process.env,
): string | undefined {
  const secret = env[QUERY_FINGERPRINT_KEY_ENV];
  if (typeof secret !== 'string') return undefined;
  const key = Buffer.from(secret, 'utf8');
  if (key.length < QUERY_FINGERPRINT_MIN_KEY_BYTES) return undefined;
  const purposeKey = createHmac('sha256', key).update(QUERY_FINGERPRINT_PURPOSE).digest();
  return createHmac('sha256', purposeKey).update(query, 'utf8').digest('hex').slice(0, 16);
}

/*
  RETRIEVAL R1 · T1.1 (E1-08 C-2) — A CLOSED REASON VOCABULARY. The rejection reasons the current
  scorers emit (generic, relational, relationalEvent, institutional; the others return none), as
  written in their source. Anything else is counted as `<mode>.unrecognised`, so a scorer change
  can never carry a question fragment into the trace: it fails closed and the count is kept.
*/
export const RELEVANCE_MODES = Object.freeze([
  'none',
  'generic',
  'relational',
  'institutional',
  'compoundPlan',
  'eventFrame',
  'relationalEvent',
] as const);

export const KNOWN_REJECTION_REASONS = Object.freeze([
  'empty or invalid search phrase',
  'title match',
  'summary match',
  'summary repeated',
  'category alignment',
  'insufficient corroboration for a single-word query (requires >= 2 independent signals)',
  'no whole-phrase match for a multiword query',
  'no governed term-parity match',
  'empty or invalid X/Y concept',
  'X absent',
  'Y absent',
  'X present in title or summary',
  'Y present in title or summary',
  'both concepts present in the article, but never co-located in the title or a single summary sentence (scattered/disconnected mentions)',
  'headline names neither entity nor the event',
  'the entities and the event never meet in one sentence',
  'headline names neither the institution nor the subject',
  'institution and subject never meet in one sentence',
]);

const REJECTED_WITHOUT_REASON = 'rejected_without_reason';
const UNRECOGNISED = 'unrecognised';

function reasonSlug(reason: string): string {
  const head = reason.split(/[:(]/, 1)[0] ?? '';
  return head
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

const KNOWN_REASON_SLUGS: ReadonlySet<string> = new Set([
  ...KNOWN_REJECTION_REASONS.map(reasonSlug),
  REJECTED_WITHOUT_REASON,
]);

/**
 * Turns a deterministic scorer reason string into a code from the CLOSED vocabulary above. Only the
 * text BEFORE the first ':' or '(' is considered — scorer reasons append the matched terms after
 * those marks, and matched terms are fragments of the reader's question — and it must then be a
 * known reason, or the code is `<mode>.unrecognised` (T1.1: fail closed).
 */
export function reasonCode(mode: string, reason: string): string {
  const safeMode = (RELEVANCE_MODES as readonly string[]).includes(mode) ? mode : 'other';
  const slug = typeof reason === 'string' ? reasonSlug(reason) : '';
  return `${safeMode}.${KNOWN_REASON_SLUGS.has(slug) ? slug : UNRECOGNISED}`;
}

/** Every code reasonCode() can return: the closed key set of a relevanceReasons map. */
export const KNOWN_REASON_CODES: ReadonlySet<string> = new Set(
  [...RELEVANCE_MODES, 'other'].flatMap((mode) => [
    ...[...KNOWN_REASON_SLUGS].map((slug) => `${mode}.${slug}`),
    `${mode}.${UNRECOGNISED}`,
  ]),
);

export function rejectedWithoutReasonCode(mode: string): string {
  return reasonCode(mode, REJECTED_WITHOUT_REASON);
}

/*
  RETRIEVAL R1 · T1.1 — bounded identifiers. A provider id comes from code, but the trace does not
  rely on that: anything outside the shape of a real id is recorded as 'unrecognised'.
*/
const PROVIDER_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,31}$/;

export function boundedProviderId(id: unknown): string {
  return typeof id === 'string' && PROVIDER_ID_PATTERN.test(id) ? id : UNRECOGNISED;
}

const FAILURE_KIND_TO_OUTCOME: Record<string, AttemptOutcome> = {
  'rate-limited': 'RATE_LIMIT',
  quota: 'QUOTA',
  timeout: 'TIMEOUT',
  auth: 'AUTH',
  unreachable: 'NETWORK',
  malformed: 'MALFORMED',
  'bad-request': 'BAD_REQUEST',
  unavailable: 'UNAVAILABLE',
  unknown: 'UNKNOWN',
};

export function outcomeForFailureKind(kind: string): AttemptOutcome {
  return FAILURE_KIND_TO_OUTCOME[kind] ?? 'UNKNOWN';
}

export class RetrievalTraceCollector {
  private readonly attempts: AttemptRecord[] = [];
  private attemptsTruncated = 0;
  private nextAttempt = 1;
  private readonly searches: SearchRecord[] = [];
  private searchesTruncated = 0;
  private nextSearch = 1;
  private readonly retainedReads: RetainedReadRecord[] = [];
  private retainedReadsTruncated = 0;
  private readonly storedRightsDrops: Record<string, number> = {};
  private readonly rightsDecisions: Partial<Record<RightsDecisionPoint, RightsDecisionCounts>> = {};
  private modelInput: number | null = null;
  private cited: number | null = null;
  private sealed = false;

  beginSearch(
    init: Omit<
      SearchRecord,
      'ordinal' | 'stages' | 'retained' | 'returnedFrom' | 'returned' | 'postRelevanceRescue'
    >,
  ): SearchRecord | undefined {
    if (this.sealed) return undefined;
    const ordinal = this.nextSearch++;
    const record: SearchRecord = {
      ...init,
      ordinal,
      postRelevanceRescue: false,
      stages: null,
      retained: null,
      returnedFrom: null,
      returned: null,
    };
    if (this.searches.length >= TRACE_LIMITS.searches) {
      this.searchesTruncated += 1;
      return record; // still usable by the caller; simply not retained in the snapshot
    }
    this.searches.push(record);
    return record;
  }

  beginAttempt(
    init: Omit<
      AttemptRecord,
      | 'ordinal'
      | 'outcome'
      | 'rawFetchedCount'
      | 'durationMs'
      | 'lateOutcome'
      | 'lateRawFetchedCount'
    >,
  ): AttemptRecord | undefined {
    if (this.sealed) return undefined;
    const record: AttemptRecord = {
      ...init,
      providerId: boundedProviderId(init.providerId),
      ordinal: this.nextAttempt++,
      durationMs: null,
      outcome: 'NOT_AWAITED',
      rawFetchedCount: null,
      lateOutcome: null,
      lateRawFetchedCount: null,
    };
    if (this.attempts.length >= TRACE_LIMITS.attempts) {
      this.attemptsTruncated += 1;
      return record;
    }
    this.attempts.push(record);
    return record;
  }

  noteRetainedRead(method: string, returned: number): void {
    if (this.sealed) return;
    if (this.retainedReads.length >= TRACE_LIMITS.retainedReads) {
      this.retainedReadsTruncated += 1;
      return;
    }
    this.retainedReads.push({ method, returned });
  }

  noteStoredRightsDrops(dropped: Record<string, number>): void {
    if (this.sealed) return;
    for (const [reason, count] of Object.entries(dropped)) {
      this.storedRightsDrops[reason] = (this.storedRightsDrops[reason] ?? 0) + count;
    }
  }

  /** One executed rights gate (T1.1): accumulated per decision point, counts only. */
  noteRightsDecision(point: RightsDecisionPoint, counts: RightsDecisionCounts): void {
    if (this.sealed) return;
    const prior = this.rightsDecisions[point];
    const add = (a: number | null | undefined, b: number | null): number | null =>
      prior === undefined ? b : a === null || a === undefined || b === null ? null : a + b;
    this.rightsDecisions[point] = {
      evaluated: (prior?.evaluated ?? 0) + counts.evaluated,
      allowedCleared: add(prior?.allowedCleared, counts.allowedCleared),
      allowedPendingReview: add(prior?.allowedPendingReview, counts.allowedPendingReview),
      excluded: (prior?.excluded ?? 0) + counts.excluded,
    };
  }

  noteModelInput(count: number): void {
    if (this.sealed) return;
    this.modelInput = (this.modelInput ?? 0) + count;
  }

  noteCited(count: number): void {
    if (this.sealed) return;
    this.cited = (this.cited ?? 0) + count;
  }

  /** Freezes the ledger: late provider completions after this point change nothing. */
  seal(): TraceSnapshot {
    this.sealed = true;
    return {
      attempts: this.attempts.map((a) => ({ ...a })),
      attemptsTruncated: this.attemptsTruncated,
      searches: this.searches.map((s) => ({
        ...s,
        stages: s.stages === null ? null : { ...s.stages },
        retained: s.retained === null ? null : { ...s.retained },
      })),
      searchesTruncated: this.searchesTruncated,
      retainedReads: this.retainedReads.map((r) => ({ ...r })),
      retainedReadsTruncated: this.retainedReadsTruncated,
      storedRightsDrops: { ...this.storedRightsDrops },
      rightsDecisions: Object.fromEntries(
        Object.entries(this.rightsDecisions).map(([point, counts]) => [point, { ...counts }]),
      ),
      modelInput: this.modelInput,
      cited: this.cited,
    };
  }

  isSealed(): boolean {
    return this.sealed;
  }
}

const storage = new AsyncLocalStorage<RetrievalTraceCollector>();

export function withRetrievalTrace<T>(
  collector: RetrievalTraceCollector,
  work: () => Promise<T>,
): Promise<T> {
  return storage.run(collector, work);
}

export function currentRetrievalTrace(): RetrievalTraceCollector | undefined {
  try {
    const collector = storage.getStore();
    return collector === undefined || collector.isSealed() ? undefined : collector;
  } catch {
    return undefined;
  }
}

/** Runs a trace write and swallows any error: a counter must never break what it counts. */
export function traceSafely(write: () => void): void {
  try {
    write();
  } catch {
    /* telemetry only */
  }
}
