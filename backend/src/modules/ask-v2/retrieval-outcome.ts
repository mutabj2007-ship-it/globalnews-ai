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
 *   NOT_PERMITTED       no provider was started: every lane was refused by Gate A because its use is
 *                       not cleared (R96 F7, E1 Q2 C1). Never "failed" (nothing broke), never "no
 *                       match" (nothing was searched). A refusal beside a real outage or budget cut
 *                       stays PROVIDER_FAILED; beside an answering lane it is PARTIAL / PARTIAL_NO_MATCH;
 *                       items found and withheld keep RIGHTS_WITHHELD (E1 R-7).
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
  | 'RIGHTS_WITHHELD'
  | 'NOT_PERMITTED';

/** R96 F6 (E1 Q1) — the lane / failure reason of a provider Gate A never started. */
export const RIGHTS_NOT_CLEARED_REASON = 'rights-not-cleared';

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
    /** BETA-ASK-005 — present only when a reader-stated period was applied to the evidence */
    readonly reportingWindow?: { readonly excludedOutsideWindow?: number; readonly exclusionsUnevaluated?: true } | null;
    readonly retrievalTrace?: {
      readonly candidatesSeen?: number;
      readonly candidatesAdmitted?: number;
      readonly lanesUnavailable?: readonly unknown[];
    };
  };
}

/**
 * RETRIEVAL R1 · D-28 — DID THE NEWS SEARCH FAIL TO COMPLETE?
 *
 * Alpha op 4f585f99 (2026-10-12): GNews rate-limited, GDELT DOC HTTP 429, a third lane answered
 * with nothing. The outcome above was correctly PARTIAL_NO_MATCH, but the Ask fallback asked only
 * whether EVERY provider failed, so the reader was told the search "found no verified current
 * findings". A search with a failed or unavailable lane did not complete, whatever the other lanes
 * returned: what current reporting says is not known, and absence is never claimed from it.
 *
 * True when every source failed (the P0-6 test, unchanged), or when any provider failure or any
 * unavailable lane is recorded for a reason other than not being configured (a lane that is merely
 * not configured is shown, never "incomplete coverage" — R2B). Reads only the facts the response
 * already carries: no call, no question text.
 */
export function retrievalIncomplete(response: RetrievalFacts | null | undefined): boolean {
  const ctx = response?.retrievalContext;
  if (!response || !ctx || ctx.retrievalAttempted === false) return false;
  if ((ctx.outcome ?? '').startsWith('PROVIDER_')) return true;
  const answered = (ctx.providers ?? []).length;
  const failures = ctx.providerFailures ?? [];
  if (
    answered === 0 &&
    (failures.length > 0 || ctx.fallbackReason === 'provider-error' || ctx.dataMode === 'unavailable')
  )
    return true;
  /* E1 R96 W-2 — the window set aside reports whose rights state could not be evaluated and nothing
     was admitted: what current reporting says is not established (UNMEASURED, never a pass) */
  if ((response.articles?.length ?? 0) === 0 && ctx.reportingWindow?.exclusionsUnevaluated === true) return true;
  const configured = (reason: unknown) => reason !== 'not-configured';
  return (
    failures.some((f) => configured((f as { kind?: unknown } | null)?.kind)) ||
    (ctx.retrievalTrace?.lanesUnavailable ?? []).some((l) =>
      configured((l as { reason?: unknown } | null)?.reason),
    )
  );
}

/**
 * R96 F7 — WAS EVERY LANE REFUSED FOR SOURCE-USE RIGHTS, AND NOTHING ELSE?
 * True only when at least one failure or unavailable lane is recorded, EVERY one of them is
 * 'rights-not-cleared', and no provider outside them answered. A genuine outage, a budget cut, the
 * 'news-providers' aggregate or an answering lane makes it false (E1 R-8: never every empty
 * retrieval). Reads only the facts the response already carries.
 */
function everyLaneRefused(ctx: NonNullable<RetrievalFacts['retrievalContext']>): boolean {
  const allReasons = [
    ...(ctx.providerFailures ?? []).map((f) => ({
      lane: (f as { providerId?: unknown } | null)?.providerId,
      reason: (f as { kind?: unknown } | null)?.kind,
    })),
    ...(ctx.retrievalTrace?.lanesUnavailable ?? []).map((l) => ({
      lane: (l as { lane?: unknown } | null)?.lane,
      reason: (l as { reason?: unknown } | null)?.reason,
    })),
  ];
  /* CTO #95 6372269751 — a NOT CONFIGURED lane was not searched either: beside an all-lanes rights
     refusal it never turns NOT_PERMITTED into a provider failure or a "0 matching" search. */
  const reasons = allReasons.filter((r) => r.reason !== 'not-configured');
  if (reasons.length === 0 || reasons.some((r) => r.reason !== RIGHTS_NOT_CLEARED_REASON)) return false;
  const refused = new Set(reasons.map((r) => r.lane));
  /* Politics OBS-1 — a listed provider that is itself only not-configured was not searched either. */
  const notConfigured = new Set(
    allReasons
      .filter((r) => r.reason === 'not-configured' && !refused.has(r.lane))
      .map((r) => r.lane),
  );
  return (ctx.providers ?? []).every((id) => refused.has(id) || notConfigured.has(id));
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
  if (allFailed && admitted === 0) {
    /* R96 F7 — nothing was started because every lane was refused: not a failure. E1 R-7 — only
       when nothing was found and withheld (RIGHTS_WITHHELD keeps precedence; an all-failed search
       with a withheld item stays PROVIDER_FAILED, as before). */
    if ((ctx.rightsExcluded?.count ?? 0) === 0 && everyLaneRefused(ctx))
      return { retrievalOutcome: 'NOT_PERMITTED', ...observedCounts };
    return { retrievalOutcome: 'PROVIDER_FAILED', ...observedCounts };
  }

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
  /*
    E1 R96 W-2 — the window also set aside reports known only by id, whose rights state was never
    evaluated. No period-specific reason (and no absence claim) may be asserted: there is no typed
    outcome, which the research record states as "outcome unavailable", and retrievalIncomplete()
    gives the broader "not established" wording. Not RIGHTS_WITHHELD either: that is a rights fact
    nobody established.
  */
  if (ctx.reportingWindow?.exclusionsUnevaluated === true) return { retrievalOutcome: null, ...observedCounts };
  if (seen !== null && seen > 0) return { retrievalOutcome: 'ALL_FILTERED', ...observedCounts };
  /*
    BETA-ASK-005 / G R76-F1 (CTO R80, R96) — the search completed and the reader's period was applied,
    but every report it returned was set aside because no publisher-stated time fell inside that
    period (an unknown date never qualifies). That is "found, none qualified", never "found nothing".
    Classified from the window fact the response already carries; no count is added to the trace, so
    nothing new about an uncleared source reaches the reader. Rights-withheld, partial and failed
    searches are decided above and keep precedence.
  */
  if ((count(ctx.reportingWindow?.excludedOutsideWindow) ?? 0) > 0) {
    return { retrievalOutcome: 'ALL_FILTERED', ...observedCounts };
  }
  return { retrievalOutcome: 'COMPLETED_NO_MATCH', ...observedCounts };
}

/**
 * R96 F7 — was this search never started because every lane's use is not cleared? (The outcome
 * NOT_PERMITTED, as a predicate.) retrievalIncomplete() stays TRUE for it (E1 R-3): what current
 * reporting says is not known; only the wording differs ("not searched", never "unavailable").
 */
export function retrievalNotPermitted(response: RetrievalFacts | null | undefined): boolean {
  return observedRetrievalOf(response).retrievalOutcome === 'NOT_PERMITTED';
}

/**
 * MASTER CTO R4 · #87 F-1 — WAS THE EVIDENCE EMPTIED BY SOURCE-USE RIGHTS?
 *
 * E1 30-REVIEW-C F-1: a search whose reporting was ALL withheld because its source-use rights are
 * not established was told to the reader as "no findings". It is neither a completed no-match
 * (reporting was found) nor a provider failure (the sources answered). True when a search was
 * attempted, nothing was admitted, at least one item was withheld for rights, and the search
 * COMPLETED. A search that did not complete keeps D-28's "sources unavailable" (precedence: an
 * incomplete search is the broader unknown — what the unreached sources hold is not known — and its
 * wording already refuses to say that no reporting exists). Reads only facts already on the
 * response: no call, no question text.
 */
export function retrievalRightsWithheld(response: RetrievalFacts | null | undefined): boolean {
  const ctx = response?.retrievalContext;
  if (!response || !ctx || ctx.retrievalAttempted === false) return false;
  if ((response.articles?.length ?? 0) > 0) return false;
  if ((ctx.rightsExcluded?.count ?? 0) <= 0) return false;
  return !retrievalIncomplete(response);
}
