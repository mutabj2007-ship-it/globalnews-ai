import type { NewsArticle, NewsCategory, ProviderHealthStatus } from '@globalnews-ai/shared';

/**
 * Common options accepted by every read operation on a provider.
 * Kept intentionally small in Sprint 3 (no pagination cursors, no auth
 * context yet) so concrete providers stay simple to implement.
 */
export interface NewsSearchOptions {
  /** Maximum number of articles to return. Providers should clamp internally. */
  limit?: number;

  /**
   * Milestone #47 — 2-letter provider language code (e.g. "en", "fr",
   * "pl") to filter results by. Optional and provider-defined: passing
   * a code a given provider/endpoint doesn't support is the caller's
   * responsibility to avoid (see resolve-retrieval-language.util.ts,
   * which never emits an unsupported combination for the endpoint it
   * targets). Absent means "no language filter" (provider default).
   */
  lang?: string;

  /**
   * Milestone #47 — free-text keyword query, used ONLY by
   * topHeadlines(). search() already takes its query as its own
   * positional parameter; this exists so topHeadlines() can also
   * accept a keyword filter (GNews's real /top-headlines endpoint
   * supports this) without changing that method's existing signature
   * shape. Absent means an unfiltered top-headlines request, unchanged
   * from pre-Milestone-#47 behavior.
   */
  q?: string;
}

/**
 * The contract every news provider must implement.
 *
 * This is the seam that makes the news module provider-agnostic: the
 * NewsService and NewsController never reference a concrete provider
 * (Reuters, AP News, BBC, NewsAPI, GDELT, Google News, ...) by name.
 * They only ever depend on this interface, so a new provider can be
 * added by writing one class and registering it in NewsModule — nothing
 * else in the module needs to change.
 */
export interface NewsProvider {
  /** Stable machine-readable identifier, e.g. "reuters", "mock-wire". */
  readonly id: string;

  /** Human-readable name shown in provider health/status output. */
  readonly displayName: string;

  /**
   * Whether this provider returns synthetic/sample data rather than
   * live reporting. NewsService uses this to compute each response's
   * `dataMode` without knowing which concrete provider is active.
   */
  readonly isMock: boolean;

  /** Free-text search across the provider's catalog. */
  search(query: string, options?: NewsSearchOptions): Promise<NewsArticle[]>;

  /** The provider's current top/most important headlines. */
  topHeadlines(options?: NewsSearchOptions): Promise<NewsArticle[]>;

  /** Headlines filtered to a single category. */
  category(category: NewsCategory, options?: NewsSearchOptions): Promise<NewsArticle[]>;

  /** Lightweight liveness/readiness check for this provider. */
  health(): Promise<ProviderHealthStatus>;
}
