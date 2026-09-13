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
/**
 * R4 GDELT — the read operations a provider can genuinely answer.
 *
 * WHY THIS EXISTS. Every method on NewsProvider is mandatory, which was
 * fine while every provider was a general news API. GDELT DOC 2.0 has ONE
 * endpoint: document search. It has no top-headlines concept and no
 * category concept.
 *
 * Two ways of coping without this type, both rejected:
 *
 *   Sorting by date and calling it "top headlines". Recency is not
 *   editorial prominence, and presenting one as the other is exactly the
 *   fabrication this codebase keeps refusing to make.
 *
 *   Throwing from the unsupported methods. Promise.allSettled would then
 *   record the provider as FAILED on every homepage request, pushing
 *   `fallbackReason` toward 'provider-error', filling the warn log, and
 *   making a perfectly healthy provider look broken at the one thing it
 *   does well.
 *
 * So a provider declares what it can do, and NewsService does not ask it
 * anything else. A SKIPPED PROVIDER IS NOT A FAILED PROVIDER — it never
 * enters `failedProviderIds` and never influences `fallbackReason`. That
 * distinction is the reason this type is worth adding.
 */
export type NewsProviderCapability = 'search' | 'top-headlines' | 'category';

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

  /**
   * R4 GDELT — which of the three read operations this provider can
   * actually answer.
   *
   * ABSENT MEANS ALL THREE. That default is deliberate and is what makes
   * this change free: GNewsProvider and MockNewsProvider declare nothing,
   * and their behaviour — and every existing test of it — is byte-for-byte
   * unchanged.
   *
   * The methods stay MANDATORY on the interface even for a provider that
   * declares a narrower set. A provider must still be constructible and
   * type-complete; what changes is that NewsService will not CALL an
   * operation the provider has not claimed. A provider that declares
   * 'search' only should implement the other two as an explicit,
   * documented refusal rather than a plausible-looking approximation.
   */
  readonly capabilities?: readonly NewsProviderCapability[];

  /** Lightweight liveness/readiness check for this provider. */
  health(): Promise<ProviderHealthStatus>;
}

/**
 * R4 GDELT — does this provider answer this operation?
 *
 * One helper, used by NewsService, so the "absent means all" default is
 * decided in exactly one place and cannot drift between call sites.
 */
export function providerSupports(
  provider: NewsProvider,
  capability: NewsProviderCapability,
): boolean {
  return provider.capabilities === undefined || provider.capabilities.includes(capability);
}
