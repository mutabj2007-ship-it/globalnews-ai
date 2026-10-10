/**
 * REASON TO RETURN R1 · §5 — WHAT THE NEWS SEARCH DID, AS ONE CLOSED CODE (observation only).
 * EA C-4: this is the news-retrieval outcome; governed specialist evidence is reported separately
 * (AskObservation.contributorsUsed), so a news COMPLETED_NO_MATCH beside a USED contributor is valid.
 *
 * Read from the retrieval facts the analysis response ALREADY carries (`retrievalContext`,
 * its `retrievalTrace`, `providerFailures`, `outcome`) — no new call, no classifier, no question
 * text. Pure: the same response always gives the same code.
 *
 *   PROVIDER_FAILED     every attempted source failed or was cut: absence is NOT established
 *   PARTIAL             some sources answered, some did not, and reporting was admitted
 *   PARTIAL_NO_MATCH    some sources answered, some did not, and nothing was admitted
 *   RETAINED_ONLY       answered from retained (stored) reporting only
 *   MATCHED             the search completed and admitted reporting
 *   ALL_FILTERED        providers returned candidates and the relevance gate removed all of them
 *   COMPLETED_NO_MATCH  the search completed and returned nothing relevant
 *   RIGHTS_WITHHELD     the search returned items, and every one was withheld because its source's
 *                       reuse rights are not cleared (MASTER CTO P0 RIGHTS CONTAINMENT R1.1) — never
 *                       "nothing relevant", never "no reporting exists"
 *
 * Production FJ-1 (A4): 48 zero-item answers in 14 days could not be told apart. These codes are
 * what separates "the sources failed" from "our query or gate found nothing".
 */
export type RetrievalOutcomeCode =
  | 'PROVIDER_FAILED'
  | 'PARTIAL'
  | 'PARTIAL_NO_MATCH'
  | 'RETAINED_ONLY'
  | 'MATCHED'
  | 'ALL_FILTERED'
  | 'COMPLETED_NO_MATCH'
  | 'RIGHTS_WITHHELD';

export interface ObservedRetrieval {
  readonly retrievalOutcome: RetrievalOutcomeCode | null;
  readonly candidatesSeen: number | null;
  readonly candidatesAdmitted: number | null;
}

interface RetrievalFacts {
  readonly articles?: readonly unknown[];
  readonly retrievalContext?: {
    /** P0 NEWS R1 — false only when no provider was asked */
    readonly retrievalAttempted?: false;
    readonly dataMode?: string;
    readonly outcome?: string;
    readonly fallbackReason?: string;
    readonly providers?: readonly string[];
    readonly providerFailures?: readonly unknown[];
    readonly rightsExcluded?: { readonly count: number };
    readonly retrievalTrace?: {
      readonly candidatesSeen?: number;
      readonly candidatesAdmitted?: number;
      readonly lanesUnavailable?: readonly unknown[];
    };
  };
}

const count = (v: unknown): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null;

export function observedRetrievalOf(response: RetrievalFacts | null | undefined): ObservedRetrieval {
  const ctx = response?.retrievalContext;
  if (!response || !ctx) return { retrievalOutcome: null, candidatesSeen: null, candidatesAdmitted: null };
  /* P0 NEWS R1 — no provider was asked: not a provider failure, not a search outcome at all */
  if (ctx.retrievalAttempted === false) return { retrievalOutcome: null, candidatesSeen: null, candidatesAdmitted: null };
  const admitted = response.articles?.length ?? 0;
  const seen = count(ctx.retrievalTrace?.candidatesSeen);
  const observedCounts = {
    candidatesSeen: seen,
    candidatesAdmitted: count(ctx.retrievalTrace?.candidatesAdmitted) ?? admitted,
  };
  const answered = (ctx.providers ?? []).length;
  const failures = (ctx.providerFailures ?? []).length + (ctx.retrievalTrace?.lanesUnavailable ?? []).length;

  const allFailed =
    (ctx.outcome ?? '').startsWith('PROVIDER_') ||
    (answered === 0 &&
      ((ctx.providerFailures ?? []).length > 0 ||
        ctx.fallbackReason === 'provider-error' ||
        ctx.dataMode === 'unavailable'));
  if (allFailed && admitted === 0) return { retrievalOutcome: 'PROVIDER_FAILED', ...observedCounts };

  const partial = failures > 0 && answered > 0;
  if (admitted > 0) {
    if (partial) return { retrievalOutcome: 'PARTIAL', ...observedCounts };
    if (ctx.outcome === 'RETAINED_ONLY' || ctx.dataMode === 'cached') {
      return { retrievalOutcome: 'RETAINED_ONLY', ...observedCounts };
    }
    return { retrievalOutcome: 'MATCHED', ...observedCounts };
  }
  if ((ctx.rightsExcluded?.count ?? 0) > 0) return { retrievalOutcome: 'RIGHTS_WITHHELD', ...observedCounts };
  if (partial) return { retrievalOutcome: 'PARTIAL_NO_MATCH', ...observedCounts };
  if (seen !== null && seen > 0) return { retrievalOutcome: 'ALL_FILTERED', ...observedCounts };
  return { retrievalOutcome: 'COMPLETED_NO_MATCH', ...observedCounts };
}
