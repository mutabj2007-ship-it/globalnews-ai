import {
  resolveEvidenceState,
  type AnalysisEvidenceState,
  type AnalysisRetrievalContext,
} from '@globalnews-ai/shared';

/**
 * PR #40 R2 F3 — THE ONE DISPLAY AUTHORITY FOR EVIDENCE STATE.
 *
 * Every UI consumer that labels evidence (the frame/dock `EvidenceFreshnessNotice`
 * and the Complete Record `RetrievalContextStatus`) resolves through these two
 * functions, so they cannot disagree.
 *
 *   - A stamped `evidenceState` wins whenever present.
 *   - A legacy payload without one is derived with the SHARED
 *     `resolveEvidenceState`, using the article count the caller has (the
 *     rendered response's articles), else the context's own
 *     `articlesRetrieved`.
 *   - With neither a stamp nor any count there is nothing to derive from, and
 *     the payload is displayed exactly as it arrived (no invented state).
 */
export function displayEvidenceState(
  context: AnalysisRetrievalContext,
  articleCount?: number,
): AnalysisEvidenceState | undefined {
  if (context.evidenceState !== undefined) return context.evidenceState;
  const count = articleCount ?? context.articlesRetrieved;
  if (count === undefined) return undefined;
  return resolveEvidenceState(context, count);
}

/**
 * The retrieval context as it must be LABELLED, made consistent with the
 * resolved state. The contract fields keep their meaning; only a pairing the
 * state contradicts is corrected:
 *
 *   live                  'live' (demo 'mock' stays demo).
 *   retained              stored reporting ('cached'); never "Live reporting".
 *   degraded-fallback     provider failure: stored reporting if any evidence
 *                         survived, otherwise "live data unavailable"; never live.
 *   no-relevant-evidence  a live search that answered stays 'live'; otherwise
 *                         "nothing usable, no stored reporting".
 */
export function displayRetrievalContext(
  context: AnalysisRetrievalContext,
  articleCount?: number,
): AnalysisRetrievalContext {
  const state = displayEvidenceState(context, articleCount);
  if (state === undefined || context.dataMode === 'mock') return context;
  const count = articleCount ?? context.articlesRetrieved ?? 0;

  switch (state) {
    case 'live':
      return { ...context, dataMode: 'live', fallbackReason: undefined };
    case 'retained':
      return {
        ...context,
        dataMode: 'cached',
        fallbackReason: context.fallbackReason === 'provider-error' ? undefined : context.fallbackReason,
      };
    case 'degraded-fallback':
      return { ...context, dataMode: count > 0 ? 'cached' : 'unavailable', fallbackReason: 'provider-error' };
    case 'no-relevant-evidence':
      return context.dataMode === 'live'
        ? { ...context, fallbackReason: undefined }
        : { ...context, dataMode: 'unavailable', fallbackReason: 'no-live-results' };
  }
}

/*
  ASK NO-EVIDENCE PRESENTATION R1 — A PARTIAL OUTAGE IS NOT "LIVE DATA UNAVAILABLE".

  'degraded-fallback' folds every provider failure together. With nothing admitted, two different
  facts hide under it (live Alpha op 51794ad5: GNews and the publisher feeds answered with zero
  matching reports while GDELT was refused):

    partial  at least one lane answered — the search ran and found nothing matching; the refused
             lane is disclosed by name (the lanes list, "not a complete search")
    total    no lane answered — live reporting really was unavailable

  Lanes are read from the server's own trace when present (lanesSucceeded), else from the
  provider list minus the named failures. Without either, nothing can be shown to have answered,
  and the stricter reading (total) stands.
*/
export function someLaneAnswered(context: AnalysisRetrievalContext): boolean {
  const succeeded = context.retrievalTrace?.lanesSucceeded;
  if (succeeded !== undefined) return succeeded.length > 0;
  const failures = context.providerFailures;
  if (failures === undefined || failures.length === 0) return false;
  const failed = new Set(failures.map((f) => f.providerId));
  return (context.providers ?? []).some((p) => !failed.has(p));
}

/** True only when NO live lane answered and nothing usable was served: a real outage. */
export function reportingWhollyUnavailable(
  context: AnalysisRetrievalContext,
  articleCount?: number,
): boolean {
  const count = articleCount ?? context.articlesRetrieved ?? 0;
  return (
    displayEvidenceState(context, articleCount) === 'degraded-fallback' &&
    count === 0 &&
    !someLaneAnswered(context)
  );
}

/** Nothing admitted, a lane refused, and another lane answered with no matching reports. */
export function partialOutageWithNoMatches(
  context: AnalysisRetrievalContext,
  articleCount?: number,
): boolean {
  const count = articleCount ?? context.articlesRetrieved ?? 0;
  return (
    displayEvidenceState(context, articleCount) === 'degraded-fallback' &&
    count === 0 &&
    someLaneAnswered(context)
  );
}
