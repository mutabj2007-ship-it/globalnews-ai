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

/**
 * CTO R115 / Politics R115 live control (G-1) — EVERY reporting lane was refused for source-use rights
 * BEFORE any network call, none answered, nothing was admitted. The backend still records this as a
 * provider error with dataMode 'unavailable' (bc13149 README §5 residual), so without this rule the
 * reader is told "live reporting is temporarily unavailable — try again", which is false: waiting
 * cannot lift a rights restriction. Mirrors askSearchActivity's refusedOnly (and the backend's
 * everyLaneRefused): every recorded reason is 'rights-not-cleared' and every listed provider is one of
 * the refused lanes. Any genuine outage reason makes it false (R-8).
 */
export function rightsRefusedOnly(context: AnalysisRetrievalContext, articleCount?: number): boolean {
  const count = articleCount ?? context.articlesRetrieved ?? 0;
  if (count > 0) return false;
  const reasons = [
    ...(context.retrievalTrace?.lanesUnavailable ?? []).map((u) => ({ lane: u.lane as string | undefined, reason: u.reason as string | undefined })),
    ...(context.providerFailures ?? []).map((f) => ({ lane: f.providerId as string | undefined, reason: (f as { kind?: string }).kind })),
  ];
  /* CTO #95 6372269751 — a lane that is merely NOT CONFIGURED was not searched either: it must never
     turn an all-lanes rights refusal into "0 matching reports". At least one rights refusal is still
     required, and any genuine outage reason still makes this false. */
  const refusals = reasons.filter((r) => r.reason !== 'not-configured');
  if (refusals.length === 0 || refusals.some((r) => r.reason !== 'rights-not-cleared')) return false;
  const refused = new Set(refusals.map((r) => r.lane));
  if ((context.retrievalTrace?.lanesSucceeded ?? []).length > 0) return false;
  /* Politics OBS-1 — a listed provider that is itself only not-configured was not searched either. */
  const notConfigured = new Set(
    reasons.filter((r) => r.reason === 'not-configured' && !refused.has(r.lane)).map((r) => r.lane),
  );
  return (context.providers ?? []).every((p) => refused.has(p) || notConfigured.has(p));
}

/**
 * E1 ADDENDUM-18 C-1 / C-2 (CTO #95 c6375734941) — THE ONE DECISION FOR RETRIEVAL FIGURES.
 *
 * `articlesRetrieved` and `sourceDiversity.retrievedArticleCount` are counted AFTER the rights gate
 * (analysis.service `articles = allowed`), so in three states a printed "0 retrieved reports" is
 * false — it reads as "no reporting exists" when nothing was searched, or when reports WERE found
 * and then withheld:
 *
 *   not attempted     no provider was asked (`retrievalAttempted: false`)
 *   rights refused    every lane was refused for source-use rights before any network call
 *   rights withheld   reports came back, every one was withheld for rights, none was admitted
 *
 * In those states every reader-facing renderer states NO figure (each already has its own copy for
 * the state). A search that ran and found nothing, a partial outage and a genuine outage keep their
 * true figures: 0 is a real result there.
 */
export function retrievalFiguresWithheld(
  context: AnalysisRetrievalContext | null | undefined,
  articleCount?: number,
): boolean {
  if (context == null) return false;
  if (context.retrievalAttempted === false) return true;
  const count = articleCount ?? context.articlesRetrieved ?? 0;
  if (count === 0 && (context.rightsExcluded?.count ?? 0) > 0) return true;
  return rightsRefusedOnly(context, articleCount);
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
