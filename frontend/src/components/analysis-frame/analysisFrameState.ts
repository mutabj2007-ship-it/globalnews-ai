import { resolveEvidenceState, type AnalysisApiResponse } from '@globalnews-ai/shared';

/**
 * R4 — WHICH TRUTH THE FRAME IS TELLING.
 *
 * The persistent frame must hold every functional state (authorization §5)
 * without falling back to another page, and each state must say the thing
 * that is actually true. Before R4 the frame collapsed every
 * `analysis === null` response into one sentence — "ANALYSIS UNAVAILABLE ·
 * RETRIEVAL SUCCEEDED · the retrieved reporting below is unaffected" —
 * which is correct for exactly one of the four ways a response can arrive
 * without an analysis, and false for the other three. A zero-article
 * response rendered it while claiming retrieval had succeeded and pointing
 * at reporting that was not there.
 *
 * The backend already distinguishes these; nothing new is requested of it.
 * `provenance.status` separates 'not-attempted' (nothing to analyse) from
 * 'failed' (articles existed, the model did not answer), and
 * `retrievalContext.dataMode` separates a provider that answered from one
 * that could not be reached. This module only reads what is already there.
 */
export type FrameEvidenceState =
  /** A question was asked and answered with evidence. */
  | 'populated'
  /** No question yet — /search opened bare. Not a failure. */
  | 'no-question'
  /** The provider could not be reached at all. */
  | 'provider-unavailable'
  /** The provider answered, nothing matched. No AI call was attempted. */
  | 'no-evidence'
  /** Articles were retrieved; the analysis itself did not arrive. */
  | 'analysis-failed'
  /**
   * H-C2 MICRO-CLOSURE — RETRIEVAL DID NOT RUN, BECAUSE THE QUESTION DID
   * NOT SAY WHAT TO SEARCH FOR.
   *
   * G's C2-2 classifier declines to guess the members of an under-specified
   * comparison rather than inventing them, and routes that case through the
   * SAME zero-evidence retrieval context the provider-safety edge uses. Read
   * through `dataMode` alone the two are identical, so the reader was told
   * "no related articles were found" about a question nothing had been
   * searched for — a false statement about retrieval, standing in for a
   * true one about the question.
   *
   * `retrievalOutcome` is the field that separates them, and it is READ
   * DEFENSIVELY below: absent, this state never occurs and every existing
   * consumer behaves exactly as before.
   */
  | 'clarification-required';

/**
 * MAIN-C2 STAGE 2, REPRODUCED VERBATIM — see the CTO report's collision
 * notes. Main authored this type, `classifyAnalysisFailure` and the
 * `analysisFailureKind` field; they are carried here unchanged so this
 * package compiles and can be tested on its own. If Main's patch lands
 * first these are already present and identical — take either, not both.
 *
 * UNAVAILABLE means we never obtained a usable answer FROM the provider:
 * it was not configured, it rejected our credentials, it timed out, it could
 * not be reached, or it throttled us. Note that 'provider-rate-limited' is the
 * UPSTREAM provider throttling this backend — it is not, and must never be
 * confused with, this product's own 429 from AnalysisRateLimitGuard, which
 * never reaches this module at all because it throws before any response
 * exists.
 *
 * UNUSABLE means the provider did answer and the answer did not survive:
 * malformed output, or output rejected by validateAnalysisResult.
 *
 * A reason absent, or one added to the contract later and not yet classified
 * here, resolves to 'ai-response-unusable' — the weaker, less specific claim.
 * Guessing "the provider was down" about an unknown cause would be asserting a
 * fact about a third party we do not have.
 */
export type AnalysisFailureKind = 'ai-provider-unavailable' | 'ai-response-unusable';

function classifyAnalysisFailure(reason: string | undefined): AnalysisFailureKind {
  switch (reason) {
    case 'provider-not-configured':
    case 'provider-auth':
    case 'provider-timeout':
    case 'provider-unavailable':
    case 'provider-rate-limited':
      return 'ai-provider-unavailable';
    default:
      return 'ai-response-unusable';
  }
}

/**
 * G's C2-2 codes, as the frontend reads them. Declared locally and matched
 * STRUCTURALLY rather than imported, because the fields are additive and
 * optional on `AnalysisRetrievalContext` and this package must compile
 * against the contract as it stands today. When G's shared change lands the
 * import can replace this; until then nothing is asked of shared, and an
 * absent field means precisely what it meant before the field existed.
 */
type RetrievalContextWithOutcome = {
  readonly retrievalOutcome?: string;
  readonly clarificationReason?: string;
};

/** Why a question needs narrowing. G's codes, never a sentence. */
export type FrameClarificationReason =
  | 'COMPARISON_MEMBERS_UNDETERMINED'
  | 'TOO_MANY_ENTITIES';

function readClarification(
  response: AnalysisApiResponse,
): { required: boolean; reason: FrameClarificationReason | null } {
  const ctx = response.retrievalContext as unknown as RetrievalContextWithOutcome;
  if (ctx.retrievalOutcome !== 'CLARIFICATION_REQUIRED') {
    return { required: false, reason: null };
  }
  const reason = ctx.clarificationReason;
  return {
    required: true,
    reason:
      reason === 'COMPARISON_MEMBERS_UNDETERMINED' || reason === 'TOO_MANY_ENTITIES'
        ? reason
        : null,
  };
}

export interface FrameEvidence {
  readonly state: FrameEvidenceState;
  readonly articleCount: number;
  /** True only where reporting survives for the reader to fall back on. */
  readonly evidenceSurvives: boolean;
  /**
   * Non-null ONLY when `state` is 'analysis-failed'. Null everywhere else,
   * including states where no AI call was ever attempted — a failure kind for
   * a call that never happened would be a fabricated cause.
   */
  readonly analysisFailureKind: AnalysisFailureKind | null;
  /**
   * Non-null ONLY when `state` is 'clarification-required' AND the backend
   * supplied a code. A clarification with no stated reason is still a
   * clarification; it just gets the general question rather than a specific
   * one, which is better than inventing which specificity is missing.
   */
  readonly clarificationReason: FrameClarificationReason | null;
}

const NO_KINDS = { analysisFailureKind: null, clarificationReason: null } as const;

export function resolveFrameEvidence(
  response: AnalysisApiResponse | null,
  hasQuestion: boolean,
): FrameEvidence {
  if (!hasQuestion || response === null) {
    return { state: 'no-question', articleCount: 0, evidenceSurvives: false, ...NO_KINDS };
  }

  const articleCount = response.articles.length;

  if (response.analysis !== null) {
    return { state: 'populated', articleCount, evidenceSurvives: articleCount > 0, ...NO_KINDS };
  }

  // No analysis. WHY it is absent decides what the frame may say.
  if (articleCount > 0) {
    // Reporting survives an AI failure — the one case the old sentence
    // described correctly, and the only one where it may be shown.
    return {
      state: 'analysis-failed',
      articleCount,
      evidenceSurvives: true,
      analysisFailureKind: classifyAnalysisFailure(response.provenance?.failureReason),
      clarificationReason: null,
    };
  }

  /*
   * ── H-C2 MICRO-CLOSURE — THE CLARIFICATION CASE, BEFORE dataMode ────
   *
   * ORDER IS THE WHOLE POINT. G routes a clarification through
   * NON_RETRIEVABLE_QUERY_CONTEXT — `dataMode: 'unavailable'`,
   * `fallbackReason: 'no-live-results'` — which the branch below resolves to
   * 'no-evidence'. Testing `retrievalOutcome` first is what stops a question
   * that was never searched for from being reported as a search that found
   * nothing.
   */
  const clarification = readClarification(response);
  if (clarification.required) {
    return {
      state: 'clarification-required',
      articleCount: 0,
      evidenceSurvives: false,
      analysisFailureKind: null,
      clarificationReason: clarification.reason,
    };
  }

  /*
   * ── H-ALPHA-1: THE REASON MUST BE THE TRUE ONE ──────────────────────
   *
   * `dataMode` alone cannot separate the last two facts. The backend
   * already draws the line and puts it on the response:
   *
   *     shared/src/analysis.ts:678   fallbackReason?: NewsFallbackReason
   *     shared/src/news.ts:309       'no-live-results' | 'provider-error'
   *
   * and `RetrievalContextStatus.tsx:110-116` has distinguished the two
   * since it was written. This module did not, so a response whose real
   * reason was `no-live-results` — the provider ANSWERED and had nothing
   * — still resolved to `provider-unavailable` and was shown to the
   * reader as a provider that could not be reached. That is a false
   * statement about a third party, and the CTO's ruling 4 is to stop
   * making it.
   *
   * READ ONLY. No new field is requested, no richer provider semantics
   * are invented, and `dataMode` keeps its existing meaning: it is
   * consulted first, and `fallbackReason` only refines the answer where
   * the contract actually supplies one.
   */
  /*
   * ASK/SEARCH R1 CLOSURE — FAILURE IS NOT ABSENCE, DECIDED BY ONE FACT.
   *
   * The backend stamps `evidenceState`; an older payload without it is derived
   * with the SAME shared `resolveEvidenceState`. A degraded fallback (provider
   * timeout, rate limit, error) with nothing to show is 'provider-unavailable';
   * only a genuine 'no-relevant-evidence' may say that nothing matched.
   */
  const evidenceState =
    response.retrievalContext.evidenceState ?? resolveEvidenceState(response.retrievalContext, 0);
  if (evidenceState === 'degraded-fallback') {
    return { state: 'provider-unavailable', articleCount: 0, evidenceSurvives: false, ...NO_KINDS };
  }

  return { state: 'no-evidence', articleCount: 0, evidenceSurvives: false, ...NO_KINDS };
}
