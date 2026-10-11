import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';

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
    user id or credential. A query is recorded as a short one-way fingerprint plus its length.
  - grow without bound. Attempts, searches, reason codes and reads are capped; the cap is
    recorded rather than silently applied.

  OUTSIDE AN ANALYSIS RUN (Home, the public search endpoint, country pages) there is no
  collector and every hook is a no-op, so those paths are byte-for-byte unchanged.
*/

export const RETRIEVAL_DIAGNOSTICS_SCHEMA = 'retrieval-diagnostics/1' as const;

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
  queryFingerprint: string;
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
  modelInput: number | null;
  cited: number | null;
}

export function queryFingerprint(query: string): string {
  return createHash('sha256').update(query, 'utf8').digest('hex').slice(0, 16);
}

/**
 * Turns a deterministic scorer reason string into a bounded code. Only the text BEFORE the first
 * ':' or '(' is kept — scorer reasons append the matched terms after those marks, and matched
 * terms are fragments of the reader's question.
 */
export function reasonCode(mode: string, reason: string): string {
  const head = reason.split(/[:(]/, 1)[0] ?? '';
  const slug = head
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return `${mode}.${slug || 'unspecified'}`;
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
