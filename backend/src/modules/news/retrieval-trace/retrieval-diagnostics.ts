import { GLOBAL_REACH_SOURCE_PACKS } from '../../global-reach/source-pack.registry';
import { FEED_SOURCES, resolveActiveFeedSources } from '../providers/feed-source-registry';
import {
  RETRIEVAL_DIAGNOSTICS_SCHEMA,
  type AttemptOutcome,
  type AttemptRecord,
  type RightsDecisionCounts,
  type RightsDecisionPoint,
  type SearchRecord,
  type TraceSnapshot,
} from './retrieval-trace';

/*
  RETRIEVAL R1 · T1 — the persisted diagnostic envelope and its cause classifier.

  PURE. Everything here is a function of (a sealed trace snapshot, the analysis' own retrieval
  context, the final evidence count). Nothing reads a provider, a database or the clock, so the
  same inputs always give the same envelope — which is what makes the fixtures deterministic.

  CAUSES, NOT A VERDICT. An empty or partial result usually has SEVERAL simultaneous causes
  (GNews answered zero, GDELT timed out, and the region has no enabled local source). Every
  applicable cause is listed; none is promoted to "the" reason, and no code here — or anything a
  reader is shown from it — may imply that an event did not occur.
*/

export type EmptyCause =
  | 'NOT_IN_ENABLED_COVERAGE'
  | 'NOT_RIGHTS_CLEARED'
  | 'PROVIDER_NOT_ASKED'
  | 'PROVIDER_EMPTY'
  | 'PROVIDER_FAILED_RATE_LIMIT'
  | 'PROVIDER_FAILED_TIMEOUT'
  | 'PROVIDER_FAILED_QUOTA'
  | 'PROVIDER_FAILED_AUTH'
  | 'PROVIDER_FAILED_NETWORK'
  | 'PROVIDER_FAILED_MALFORMED'
  | 'PROVIDER_FAILED_BAD_REQUEST'
  | 'PROVIDER_FAILED_UNAVAILABLE'
  | 'PROVIDER_FAILED_NOT_AWAITED'
  | 'PROVIDER_FAILED_UNKNOWN'
  | 'LANGUAGE_UNSUPPORTED_BY_PROVIDER'
  | 'OUTSIDE_WINDOW'
  | 'RELEVANCE_REJECTED'
  | 'GEO_CONTRADICTION'
  | 'RIGHTS_WITHHELD'
  | 'RETAINED_BUT_NOT_INDEXED'
  | 'INCOMPLETE_CHECK';

/** Emitted by T1. RETAINED_BUT_NOT_INDEXED is part of the vocabulary but needs an index audit (T3). */
export const T1_UNEMITTED_CAUSES: readonly EmptyCause[] = ['RETAINED_BUT_NOT_INDEXED'];

export interface CauseEntry {
  cause: EmptyCause;
  /** Bounded, content-free qualifiers: provider id, ISO3, language pair, counts. */
  detail: string | null;
}

/*
  RETRIEVAL R1 · T1.1 — E1's per-use view (E1-01 columns use_A … use_I). A use is shown as decided
  ONLY by a gate that actually executed on this operation. The code's AI_INPUT class is E1 use E
  (pass content to a generative model); no other use is decided anywhere in an analysis run, so the
  rest are NOT_ASSESSED — never inferred, and never "cleared". The METADATA class (used by the
  recent-reporting listing, outside the analysis run) spans several E1 uses and is not mapped here.
*/
export const E1_USES = Object.freeze(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'] as const);
export type E1Use = (typeof E1_USES)[number];
export type RightsUseState = 'NOT_ASSESSED' | { decidedAt: RightsDecisionPoint[] };

const E1_USE_OF_POINT: Readonly<Record<RightsDecisionPoint, E1Use>> = Object.freeze({
  'AI_INPUT@ANALYSIS_EVIDENCE': 'E',
  'AI_INPUT@STORED_READ': 'E',
});

function rightsUsesOf(
  decisions: Partial<Record<RightsDecisionPoint, RightsDecisionCounts>>,
): Record<E1Use, RightsUseState> {
  const uses = Object.fromEntries(E1_USES.map((use) => [use, 'NOT_ASSESSED'])) as Record<
    E1Use,
    RightsUseState
  >;
  for (const point of Object.keys(decisions) as RightsDecisionPoint[]) {
    const use = E1_USE_OF_POINT[point];
    if (use === undefined) continue;
    const state = uses[use];
    uses[use] = { decidedAt: state === 'NOT_ASSESSED' ? [point] : [...state.decidedAt, point] };
  }
  return uses;
}

export interface LocalCoverage {
  countryIso3: string;
  enabledLocalSources: number;
  heldLocalCandidates: number;
}

export interface AnalysisStageInput {
  /** retrievalContext.reportingWindow.excludedOutsideWindow, when a window applied. */
  windowExcludedOutsideWindow: number | null;
  anchorGate: { candidates: number; admitted: number } | null;
  rightsAiInputExcluded: number | null;
  rightsAiInputReasons: Record<string, number> | null;
  rightsAiInputPendingReview: number | null;
  /** The final evidence list the answer was built from (0 for an empty answer). */
  finalEvidence: number;
}

export interface RetrievalDiagnostics {
  schema: typeof RETRIEVAL_DIAGNOSTICS_SCHEMA;
  reuse: 'NONE' | 'ANALYSIS_CACHE' | 'IN_FLIGHT_JOIN';
  attempts: AttemptRecord[];
  attemptsTruncated: number;
  searches: SearchRecord[];
  searchesTruncated: number;
  retainedReads: Array<{ method: string; returned: number }>;
  retainedReadsTruncated: number;
  storedRightsDrops: Record<string, number>;
  /** T1.1 — the rights gates that EXECUTED on this operation, with their counts. */
  rightsDecisions: Partial<Record<RightsDecisionPoint, RightsDecisionCounts>>;
  /** T1.1 — E1's nine uses (E1-01 A–I): the points that decided a use, or NOT_ASSESSED. */
  rightsUses: Record<E1Use, RightsUseState>;
  analysisStages: {
    windowExcludedOutsideWindow: number | null;
    anchorGate: { candidates: number; admitted: number } | null;
    rightsAiInput: {
      excluded: number | null;
      reasons: Record<string, number> | null;
      pendingReview: number | null;
    };
    modelInput: number | null;
    cited: number | null;
    /** Rendering happens in the client; the server cannot observe it. */
    displayed: null;
  };
  totals: {
    attempts: number;
    rawFetched: number;
    admittedLive: number;
    retainedAdmitted: number;
    retainedReadReturned: number;
    finalEvidence: number;
  };
  coverage: LocalCoverage | null;
  evidenceEmpty: boolean;
  causes: CauseEntry[];
  /** Stages whose count cannot be observed on this operation — never reported as 0. */
  unobserved: string[];
  invariants: { ok: boolean; violations: string[] };
}

const FAILURE_CAUSE: Partial<Record<AttemptOutcome, EmptyCause>> = {
  RATE_LIMIT: 'PROVIDER_FAILED_RATE_LIMIT',
  TIMEOUT: 'PROVIDER_FAILED_TIMEOUT',
  QUOTA: 'PROVIDER_FAILED_QUOTA',
  AUTH: 'PROVIDER_FAILED_AUTH',
  NETWORK: 'PROVIDER_FAILED_NETWORK',
  MALFORMED: 'PROVIDER_FAILED_MALFORMED',
  BAD_REQUEST: 'PROVIDER_FAILED_BAD_REQUEST',
  UNAVAILABLE: 'PROVIDER_FAILED_UNAVAILABLE',
  NOT_AWAITED: 'PROVIDER_FAILED_NOT_AWAITED',
  UNKNOWN: 'PROVIDER_FAILED_UNKNOWN',
};

function addCause(causes: CauseEntry[], cause: EmptyCause, detail: string | null): void {
  if (causes.some((entry) => entry.cause === cause && entry.detail === detail)) return;
  causes.push({ cause, detail });
}

function sum(values: Array<number | null | undefined>): number {
  return values.reduce<number>(
    (total, value) => total + (typeof value === 'number' ? value : 0),
    0,
  );
}

export function buildRetrievalDiagnostics(
  snapshot: TraceSnapshot,
  stages: AnalysisStageInput,
  reuse: RetrievalDiagnostics['reuse'] = 'NONE',
): RetrievalDiagnostics {
  const { attempts, searches } = snapshot;
  const rawFetched = sum(searches.map((s) => s.stages?.rawFetched));
  const admittedLive = sum(searches.map((s) => s.stages?.admittedLive));
  const retainedAdmitted = sum(searches.map((s) => s.retained?.admitted));
  const retainedReadReturned = sum(snapshot.retainedReads.map((r) => r.returned));

  const causes: CauseEntry[] = [];
  const evidenceEmpty = stages.finalEvidence === 0;

  if (attempts.length === 0 && snapshot.retainedReads.length === 0 && searches.length === 0) {
    addCause(causes, 'PROVIDER_NOT_ASKED', 'no news retrieval ran for this operation');
  }

  let anySuccess = false;
  let anyFailure = false;
  for (const attempt of attempts) {
    if (attempt.outcome === 'SUCCESS') anySuccess = true;
    else if (attempt.outcome === 'ZERO_RAW') {
      anySuccess = true;
      addCause(causes, 'PROVIDER_EMPTY', attempt.providerId);
    } else if (attempt.outcome === 'BUDGET_SKIPPED') {
      anyFailure = true;
      addCause(causes, 'PROVIDER_NOT_ASKED', `${attempt.providerId}:budget`);
      continue; // never started, so no language was sent
    } else {
      anyFailure = true;
      addCause(
        causes,
        FAILURE_CAUSE[attempt.outcome] ?? 'PROVIDER_FAILED_UNKNOWN',
        attempt.providerId,
      );
    }
    if (attempt.requestedLang !== null && attempt.sentLang !== attempt.requestedLang) {
      addCause(
        causes,
        'LANGUAGE_UNSUPPORTED_BY_PROVIDER',
        `${attempt.providerId}:${attempt.requestedLang}->${attempt.sentLang ?? 'none'}`,
      );
    }
  }

  const searchWindowExcluded =
    sum(searches.map((s) => s.stages?.windowExcluded)) +
    sum(searches.map((s) => s.retained?.windowExcluded));
  if (searchWindowExcluded > 0 || (stages.windowExcludedOutsideWindow ?? 0) > 0) {
    addCause(
      causes,
      'OUTSIDE_WINDOW',
      String(Math.max(searchWindowExcluded, stages.windowExcludedOutsideWindow ?? 0)),
    );
  }

  const relevanceRejected =
    sum(searches.map((s) => s.stages?.relevanceRejected)) +
    sum(searches.map((s) => s.retained?.lexicalRejected)) +
    sum(searches.map((s) => s.retained?.relevanceRejected)) +
    (stages.anchorGate === null
      ? 0
      : Math.max(0, stages.anchorGate.candidates - stages.anchorGate.admitted));
  if (relevanceRejected > 0) addCause(causes, 'RELEVANCE_REJECTED', String(relevanceRejected));

  const geoRejected = sum(searches.map((s) => s.retained?.geoRejected));
  if (geoRejected > 0) addCause(causes, 'GEO_CONTRADICTION', String(geoRejected));

  const storedRightsDropped = sum(Object.values(snapshot.storedRightsDrops));
  const rightsExcluded = (stages.rightsAiInputExcluded ?? 0) + storedRightsDropped;
  if (rightsExcluded > 0) addCause(causes, 'RIGHTS_WITHHELD', String(rightsExcluded));

  if (anyFailure && (anySuccess || retainedAdmitted > 0 || retainedReadReturned > 0)) {
    addCause(causes, 'INCOMPLETE_CHECK', null);
  } else if (anyFailure && evidenceEmpty) {
    addCause(causes, 'INCOMPLETE_CHECK', null);
  }

  const unobserved: string[] = [
    'displayed (client-side rendering)',
    'stored rows excluded by the rights WHERE clause (enforce-by-absence; never returned to the service)',
    'rights decisions made outside the analysis run (e.g. the recent-reporting METADATA listing)',
  ];
  if (snapshot.modelInput === null) unobserved.push('modelInput (no model call on this operation)');
  if (snapshot.cited === null) unobserved.push('cited (no validated answer on this operation)');
  if (searches.some((s) => s.stages !== null && s.stages.persistRequested !== null)) {
    unobserved.push(
      'rows actually written by persistMany (DB upsert; only the request count is observed)',
    );
  }
  if (
    snapshot.attemptsTruncated + snapshot.searchesTruncated + snapshot.retainedReadsTruncated >
    0
  ) {
    unobserved.push('entries beyond the trace caps (see *Truncated)');
  }

  const violations: string[] = [];
  for (const search of searches) {
    const s = search.stages;
    if (s === null) continue;
    if (s.admittedLive > s.rawFetched)
      violations.push(`search#${search.ordinal}: admittedLive>rawFetched`);
    if (s.survivorsWithoutSuccessfulAttempt > 0) {
      violations.push(
        `search#${search.ordinal}: survivor without a successful originating attempt`,
      );
    }
    const searchAttemptsRaw = sum(
      attempts
        .filter(
          (a) =>
            a.searchOrdinal === search.ordinal &&
            (a.outcome === 'SUCCESS' || a.outcome === 'ZERO_RAW'),
        )
        .map((a) => a.rawFetchedCount),
    );
    if (snapshot.attemptsTruncated === 0 && searchAttemptsRaw !== s.rawFetched) {
      violations.push(
        `search#${search.ordinal}: stage rawFetched ${s.rawFetched} != attempts raw ${searchAttemptsRaw}`,
      );
    }
  }
  for (const attempt of attempts) {
    if (attempt.outcome === 'ZERO_RAW' && attempt.rawFetchedCount !== 0)
      violations.push(`attempt#${attempt.ordinal}: ZERO_RAW with raw ${attempt.rawFetchedCount}`);
    if (
      attempt.outcome === 'SUCCESS' &&
      !(typeof attempt.rawFetchedCount === 'number' && attempt.rawFetchedCount > 0)
    ) {
      violations.push(`attempt#${attempt.ordinal}: SUCCESS without raw results`);
    }
  }
  if (
    snapshot.modelInput !== null &&
    snapshot.modelInput > admittedLive + retainedAdmitted + retainedReadReturned
  ) {
    violations.push('modelInput exceeds every candidate the operation obtained');
  }

  return {
    schema: RETRIEVAL_DIAGNOSTICS_SCHEMA,
    reuse,
    attempts,
    attemptsTruncated: snapshot.attemptsTruncated,
    searches,
    searchesTruncated: snapshot.searchesTruncated,
    retainedReads: snapshot.retainedReads,
    retainedReadsTruncated: snapshot.retainedReadsTruncated,
    storedRightsDrops: snapshot.storedRightsDrops,
    rightsDecisions: snapshot.rightsDecisions,
    rightsUses: rightsUsesOf(snapshot.rightsDecisions),
    analysisStages: {
      windowExcludedOutsideWindow: stages.windowExcludedOutsideWindow,
      anchorGate: stages.anchorGate,
      rightsAiInput: {
        excluded: stages.rightsAiInputExcluded,
        reasons: stages.rightsAiInputReasons,
        pendingReview: stages.rightsAiInputPendingReview,
      },
      modelInput: snapshot.modelInput,
      cited: snapshot.cited,
      displayed: null,
    },
    totals: {
      attempts: attempts.length + snapshot.attemptsTruncated,
      rawFetched,
      admittedLive,
      retainedAdmitted,
      retainedReadReturned,
      finalEvidence: stages.finalEvidence,
    },
    coverage: null,
    evidenceEmpty,
    causes,
    unobserved,
    invariants: { ok: violations.length === 0, violations },
  };
}

/**
 * Local coverage for one governed country, from the registries only (no network, no flag write).
 * "Enabled" means a source that could actually be collected right now: an ACTIVE pack entry with
 * PERMITTED standing, or a publisher feed the live feed gate would select. Everything else that is
 * listed for the country is a HELD candidate — listed, not usable.
 */
export function localCoverageFor(
  countryIso3: string,
  env: Readonly<Record<string, string | undefined>> = process.env,
): LocalCoverage {
  const pack = GLOBAL_REACH_SOURCE_PACKS.find((p) => p.iso3 === countryIso3);
  const localPack = (pack?.entries ?? []).filter((entry) => entry.basis === 'LOCAL');
  const packEnabled = localPack.filter(
    (entry) => entry.activationStatus === 'ACTIVE' && entry.rights.standing === 'PERMITTED',
  ).length;

  const iso2 = pack?.iso2;
  const countryFeeds =
    iso2 === undefined ? [] : FEED_SOURCES.filter((feed) => feed.countryCode === iso2);
  const activeFeedIds =
    env.RSS_FEEDS_ENABLED === 'true'
      ? new Set(
          resolveActiveFeedSources(FEED_SOURCES, env.RSS_FEED_SOURCES).sources.map(
            (s) => s.sourceId,
          ),
        )
      : new Set<string>();
  const feedEnabled = countryFeeds.filter((feed) => activeFeedIds.has(feed.sourceId)).length;

  return {
    countryIso3,
    enabledLocalSources: packEnabled + feedEnabled,
    heldLocalCandidates: localPack.length - packEnabled + countryFeeds.length - feedEnabled,
  };
}

/** Adds the coverage annotation and, when it explains an empty result, its causes. */
export function withCoverage(
  diagnostics: RetrievalDiagnostics,
  coverage: LocalCoverage | null,
): RetrievalDiagnostics {
  if (coverage === null) return diagnostics;
  const causes = [...diagnostics.causes];
  if (coverage.enabledLocalSources === 0) {
    addCause(causes, 'NOT_IN_ENABLED_COVERAGE', coverage.countryIso3);
    if (coverage.heldLocalCandidates > 0) {
      addCause(
        causes,
        'NOT_RIGHTS_CLEARED',
        `${coverage.countryIso3}:${coverage.heldLocalCandidates} held`,
      );
    }
  }
  return { ...diagnostics, coverage, causes };
}

const EMPTY_SNAPSHOT: TraceSnapshot = {
  attempts: [],
  attemptsTruncated: 0,
  searches: [],
  searchesTruncated: 0,
  retainedReads: [],
  retainedReadsTruncated: 0,
  storedRightsDrops: {},
  rightsDecisions: {},
  modelInput: null,
  cited: null,
};

/** A route that never reaches news retrieval (background, computation, clarification, refusal). */
export function notAskedDiagnostics(route: string): RetrievalDiagnostics {
  const base = buildRetrievalDiagnostics(EMPTY_SNAPSHOT, {
    windowExcludedOutsideWindow: null,
    anchorGate: null,
    rightsAiInputExcluded: null,
    rightsAiInputReasons: null,
    rightsAiInputPendingReview: null,
    finalEvidence: 0,
  });
  return { ...base, causes: [{ cause: 'PROVIDER_NOT_ASKED', detail: `route:${route}` }] };
}

/*
  ── THE SIDE CHANNEL ──────────────────────────────────────────────────────
  The envelope rides on the analysis response as a NON-ENUMERABLE symbol, exactly like
  NewsService's provider-failure channel. So the public /analysis JSON, the analysis cache's
  equality, and every existing toEqual over a response are unchanged; only the Ask adapter,
  which persists the operation payload, reads it and stores it under one additive key.
*/
const RETRIEVAL_DIAGNOSTICS = Symbol('globalnews.retrievalDiagnostics');

export function attachRetrievalDiagnostics<T extends object>(
  response: T,
  diagnostics: RetrievalDiagnostics,
): T {
  try {
    Object.defineProperty(response, RETRIEVAL_DIAGNOSTICS, {
      value: diagnostics,
      enumerable: false,
      configurable: true,
    });
  } catch {
    /* telemetry only */
  }
  return response;
}

export function readRetrievalDiagnostics(response: unknown): RetrievalDiagnostics | undefined {
  if (response === null || typeof response !== 'object') return undefined;
  const carried = (response as Record<symbol, unknown>)[RETRIEVAL_DIAGNOSTICS];
  return carried !== null && typeof carried === 'object'
    ? (carried as RetrievalDiagnostics)
    : undefined;
}

/** Re-labels a diagnostic copied onto a cached or joined response; no attempt is ever re-run. */
export function withReuse(
  diagnostics: RetrievalDiagnostics,
  reuse: RetrievalDiagnostics['reuse'],
): RetrievalDiagnostics {
  return { ...diagnostics, reuse };
}

function countCitedIds(value: unknown, into: Set<string>, depth = 0): void {
  if (depth > 6 || value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) countCitedIds(item, into, depth + 1);
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (key === 'sourceArticleIds' && Array.isArray(child)) {
      for (const id of child) if (typeof id === 'string') into.add(id);
    } else {
      countCitedIds(child, into, depth + 1);
    }
  }
}

/**
 * E1 R96 W-4 — the UNRESTRICTED number of retrieved reports the reader's window set aside (any
 * rights state, including id-only exclusions). A real retrieval fact E1 needs, kept server-side:
 * it rides on the reportingWindow object under a symbol key, which JSON never serialises, so the
 * reader only ever sees the rights-restricted `excludedOutsideWindow` (W-1). Two names, never one
 * field redefined in place.
 */
export const EXCLUDED_OUTSIDE_WINDOW_RETRIEVED = Symbol('globalnews.excludedOutsideWindowRetrieved');

export function excludedOutsideWindowRetrievedOf(window: unknown): number | null {
  if (window === null || typeof window !== 'object') return null;
  const v = (window as Record<symbol, unknown>)[EXCLUDED_OUTSIDE_WINDOW_RETRIEVED];
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null;
}

interface AnalysisResponseLike {
  analysis?: unknown;
  articles?: readonly unknown[];
  retrievalContext?: {
    reportingWindow?: { excludedOutsideWindow?: number };
    questionAnchorGate?: { candidates?: number; admitted?: number };
    rightsExcluded?: { count?: number; reasons?: Readonly<Record<string, number | undefined>> };
    rightsPending?: { count?: number };
  };
}

/** Builds the envelope for one completed analysis run from its sealed ledger and its own response. */
export function finalizeAnalysisDiagnostics(
  snapshot: TraceSnapshot,
  response: AnalysisResponseLike,
): RetrievalDiagnostics {
  const context = response.retrievalContext ?? {};
  const cited = new Set<string>();
  if (response.analysis !== null && response.analysis !== undefined)
    countCitedIds(response.analysis, cited);
  const reasons = context.rightsExcluded?.reasons;
  return buildRetrievalDiagnostics(
    {
      ...snapshot,
      cited:
        response.analysis === null || response.analysis === undefined ? snapshot.cited : cited.size,
    },
    {
      /* E1 R96 W-4 — the internal, unrestricted count (never the rights-restricted reader field) */
      windowExcludedOutsideWindow: excludedOutsideWindowRetrievedOf(context.reportingWindow),
      anchorGate:
        context.questionAnchorGate === undefined
          ? null
          : {
              candidates: context.questionAnchorGate.candidates ?? 0,
              admitted: context.questionAnchorGate.admitted ?? 0,
            },
      rightsAiInputExcluded: context.rightsExcluded?.count ?? null,
      rightsAiInputReasons:
        reasons === undefined
          ? null
          : Object.fromEntries(
              Object.entries(reasons).filter(
                (entry): entry is [string, number] => typeof entry[1] === 'number',
              ),
            ),
      rightsAiInputPendingReview: context.rightsPending?.count ?? null,
      finalEvidence: Array.isArray(response.articles) ? response.articles.length : 0,
    },
  );
}
