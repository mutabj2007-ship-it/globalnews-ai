/**
 * ════════════════════════════════════════════════════════════════════════════
 * CHECKPOINT D — WHETHER ARRIVING AT /search SPENDS MODEL COMPUTE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CTO ruling: *"Determine whether /search automatically executes
 * POST /analysis/news on arrival, or presents an intermediate explicit user
 * action before AI execution. Instrument it by request counts, not inference."*
 *
 * ─── ASK/SEARCH ENGINEERING R1 — IT NO LONGER AUTO-EXECUTES ──────────────
 *
 * It used to: `SearchPageClient` called `analyzeNews` on mount whenever the URL
 * carried a non-empty `q`. Every map, topic, history, story and shared-link
 * arrival therefore spent an execution the moment the route resolved.
 *
 * The governing contract is that a URL parameter is not proof of compute
 * consent. Arrival now executes only when the explicit compute action that
 * navigated here left a matching one-shot grant (see analysisComputeConsent.ts),
 * or when the reader presses Run on the staged question. Otherwise the route
 * renders the question staged, at zero requests.
 *
 * ─── WHY THIS DECISION IS A FUNCTION AND NOT AN `if` INSIDE THE EFFECT ────
 *
 * The single most expensive behaviour on the surface — does opening this page
 * cost model compute? — must be assertable by counting, not by reading the
 * component. So the decision is named, exported and pure, and the effect asks
 * it rather than restating it.
 */

/**
 * What the analysis effect should do on this render.
 *
 * The idle reasons are kept apart because they are not the same state and the
 * UI treats them differently: a pending language is a transient wait, an absent
 * question renders the research workspace, and an unconsented question renders
 * the staged question with an explicit Run control.
 */
export type AnalysisAutoRunDecision =
  /** Execute POST /analysis/news now. This is where model compute is spent. */
  | 'run'
  /** No question asked. Renders the workspace; M65 made this not an error. */
  | 'idle-no-query'
  /**
   * Milestone #47 — the language has not resolved yet. Waiting avoids firing in
   * English and immediately re-firing in the reader's actual language, which
   * would be TWO executions for one arrival.
   */
  | 'idle-language-pending'
  /**
   * ASK/SEARCH R1 — a question is present but no explicit compute action has
   * been accepted for it. The question is staged; nothing is requested.
   */
  | 'idle-awaiting-consent';

export function analysisAutoRunDecision(
  query: string,
  hasResolvedLanguage: boolean,
  hasComputeConsent: boolean,
): AnalysisAutoRunDecision {
  if (!hasResolvedLanguage) return 'idle-language-pending';
  if (!query.trim()) return 'idle-no-query';
  if (!hasComputeConsent) return 'idle-awaiting-consent';

  return 'run';
}

/** Convenience for call sites that only care whether compute is about to be spent. */
export function willExecuteAnalysis(
  query: string,
  hasResolvedLanguage: boolean,
  hasComputeConsent: boolean,
): boolean {
  return analysisAutoRunDecision(query, hasResolvedLanguage, hasComputeConsent) === 'run';
}
