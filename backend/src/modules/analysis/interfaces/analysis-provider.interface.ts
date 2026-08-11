import type { NewsArticle } from '@globalnews-ai/shared';

/**
 * Milestone #40 (authoritative-context correction) — the exact,
 * deterministic X/Y pair AnalysisService already derived via
 * deriveRelationalSearchQueries() for the current request, when the
 * question matched Milestone #37's relational pattern set. This is the
 * single source of truth for relational direction semantics: neither
 * this interface, any provider, nor the prompt layer parses or
 * re-derives X/Y from the question text — they only ever receive and
 * forward this exact object. Absent for any non-relational request
 * (ordinary M35/M36 generic queries, country/city retrieval).
 */
export interface AnalysisRelationalContext {
  x: string;
  y: string;
}

export interface AnalysisProviderInput {
  query: string;
  /** Already deduped/clustered and bounded to a reasonable count. */
  articles: NewsArticle[];
  /**
   * Milestone #40 (authoritative-context correction) — present only
   * when this request's query matched Milestone #37's relational
   * pattern set. A provider MAY use this to attempt relational
   * evidence-direction classification (see build-analysis-prompt.util.ts);
   * it must never be treated as license to fabricate assessments when
   * absent — validateAnalysisResult() independently and unconditionally
   * enforces that relationalEvidenceAssessments stay empty whenever
   * this field is absent, regardless of what any provider emits.
   */
  relationalContext?: AnalysisRelationalContext;
}

/**
 * The contract every AI analysis provider must implement.
 *
 * Mirrors the NewsProvider pattern from the news module: AnalysisService
 * never references a concrete provider (OpenAI, or any future provider)
 * by name — it only depends on this interface via a DI token, so a new
 * provider can be added by writing one class and registering it in
 * AnalysisModule.
 *
 * A provider's output is NOT assumed to be valid. `analyzeNews` returns
 * `unknown` on purpose — AnalysisService is responsible for validating
 * whatever comes back (via validateAnalysisResult) before it is ever
 * trusted or returned to the frontend. This keeps "never trust model
 * output until validated" true regardless of which provider produced it.
 */
export interface AnalysisProvider {
  /** Stable machine-readable identifier, e.g. "openai", "mock-analysis". */
  readonly id: string;

  /** Human-readable name. */
  readonly displayName: string;

  /** Whether this provider returns synthetic/demo analysis rather than a real AI result. */
  readonly isMock: boolean;

  /** Produces a candidate analysis. Callers must validate the result before trusting it. */
  analyzeNews(input: AnalysisProviderInput): Promise<unknown>;
}
