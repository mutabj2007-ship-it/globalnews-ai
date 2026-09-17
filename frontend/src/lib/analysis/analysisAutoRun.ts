/**
 * ════════════════════════════════════════════════════════════════════════════
 * CHECKPOINT D — WHETHER ARRIVING AT /search SPENDS MODEL COMPUTE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CTO ruling: *"Determine whether /search automatically executes
 * POST /analysis/news on arrival, or presents an intermediate explicit user
 * action before AI execution. Instrument it by request counts, not inference."*
 *
 * IT AUTO-EXECUTES. `SearchPageClient`'s analysis effect calls `analyzeNews`
 * on mount whenever the URL carries a non-empty `q`, with no user action in
 * between. Arriving from the map's retained-article control — which pushes
 * `/search?q={article.title}&articleId=…&countryCode=…` — therefore spends an
 * OpenAI execution the moment the route resolves.
 *
 * ─── WHY THIS DECISION IS A FUNCTION AND NOT AN `if` INSIDE THE EFFECT ────
 *
 * It was an `if` inside the effect, which made the single most expensive
 * behaviour on the surface — does opening this page cost model compute? —
 * assertable only by reading the component, never by counting. The ruling asks
 * for counts, so the decision is named, exported and pure, and the effect asks
 * it rather than restating it.
 *
 * NOTHING ABOUT THE BEHAVIOUR CHANGES. The same two conditions, in the same
 * order, produce the same outcomes. This is the existing contract made
 * countable, not a new one.
 */

/**
 * What the analysis effect should do on this render.
 *
 * The two idle reasons are kept apart because they are not the same state and
 * the UI already treats them differently: a pending language is a transient
 * wait that will resolve into a run, while an absent question is a settled
 * answer that renders the research workspace.
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
  | 'idle-language-pending';

export function analysisAutoRunDecision(
  query: string,
  hasResolvedLanguage: boolean,
): AnalysisAutoRunDecision {
  if (!hasResolvedLanguage) return 'idle-language-pending';
  if (!query.trim()) return 'idle-no-query';

  return 'run';
}

/** Convenience for call sites that only care whether compute is about to be spent. */
export function willExecuteAnalysis(query: string, hasResolvedLanguage: boolean): boolean {
  return analysisAutoRunDecision(query, hasResolvedLanguage) === 'run';
}
