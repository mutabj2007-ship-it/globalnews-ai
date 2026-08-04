import type { NewsArticle, NewsCategory, ProviderHealthStatus } from '@globalnews-ai/shared';

/**
 * Common options accepted by every read operation on a provider.
 * Kept intentionally small in Sprint 3 (no pagination cursors, no auth
 * context yet) so concrete providers stay simple to implement.
 */
export interface NewsSearchOptions {
  /** Maximum number of articles to return. Providers should clamp internally. */
  limit?: number;
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
