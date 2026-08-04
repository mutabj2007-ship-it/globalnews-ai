import type { NewsArticle } from '@globalnews-ai/shared';

export interface AnalysisProviderInput {
  query: string;
  /** Already deduped/clustered and bounded to a reasonable count. */
  articles: NewsArticle[];
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
