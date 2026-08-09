/**
 * Shared news domain types.
 *
 * These types are the contract between the backend's provider-agnostic
 * news module and the frontend's rendering layer. Both workspaces import
 * from here so the shape of an "article" only needs to change in one
 * place as real providers are added in later sprints.
 */

export type NewsCategory =
  | 'world'
  | 'politics'
  | 'business'
  | 'technology'
  | 'science'
  | 'health'
  | 'sports'
  | 'entertainment';

export const NEWS_CATEGORIES: NewsCategory[] = [
  'world',
  'politics',
  'business',
  'technology',
  'science',
  'health',
  'sports',
  'entertainment',
];

/** Optional editorial tag layered on top of a category (e.g. "breaking"). */
export type NewsTag = 'breaking' | 'trending';

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  url: string;
  imageUrl?: string;
  sourceId: string;
  sourceName: string;
  category: NewsCategory;
  tag?: NewsTag;

  /** Number of distinct outlets reporting on this story, per the provider. */
  sourcesCount: number;

  /** ISO-8601 timestamp. */
  publishedAt: string;

  confidence?: number;
}

/**
 * Describes where the news in a response came from:
 *
 * - "live": a real news provider was queried and successfully answered —
 *   this covers both a normal result set AND a real provider that ran
 *   cleanly but legitimately found zero matching articles. Both are
 *   "live" because a real provider genuinely contributed an answer;
 *   `articles.length === 0` is what tells the difference, not `dataMode`.
 * - "unavailable": live retrieval was attempted, but no configured real
 *   provider succeeded (all failed/errored), and no usable stored
 *   reporting existed to fall back to either. There is no evidence to
 *   show — this must never be presented as "live" or "cached".
 * - "cached": previously fetched real reporting served from PostgreSQL,
 *   used because live retrieval failed or came back empty.
 * - "mock": sample/demo content returned by MockNewsProvider.
 *
 * Cached real reporting must never be presented as live or mock content,
 * and "unavailable" must never be presented as if any reporting exists.
 */
export type NewsDataMode =
  | 'live'
  | 'unavailable'
  | 'cached'
  | 'mock';

/**
 * Explains why stored reporting was used instead of the current provider
 * response, OR why nothing could be shown at all.
 *
 * - "no-live-results": provider request completed but produced
 *   no usable current articles.
 *
 * - "provider-error": one or more configured real providers failed.
 *   Used both when previously stored reporting was used instead
 *   (dataMode "cached") and when no stored reporting existed either
 *   (dataMode "unavailable").
 *
 * Present when dataMode is "cached" or "unavailable" — never when
 * dataMode is "live" (a successful zero-result "live" response has
 * nothing to explain away) or "mock".
 */
export type NewsFallbackReason =
  | 'no-live-results'
  | 'provider-error';

/** Standard envelope returned by every news-fetching endpoint. */
export interface NewsResponse {
  articles: NewsArticle[];
  totalResults: number;

  /** IDs of providers that successfully contributed results. */
  providers: string[];

  /** Whether this response came from live, cached, or mock data. */
  dataMode: NewsDataMode;

  /**
   * Present when dataMode is "cached" (stored reporting was returned as
   * a fallback) or "unavailable" (nothing could be returned at all).
   *
   * This preserves whether fallback happened because the provider
   * failed or because it returned no usable live articles.
   */
  fallbackReason?: NewsFallbackReason;

  /** ISO-8601 timestamp of when this response was assembled. */
  generatedAt: string;

  query?: string;
  category?: NewsCategory;
}

export type ProviderHealthState =
  | 'ok'
  | 'degraded'
  | 'down';

export interface ProviderHealthStatus {
  providerId: string;
  displayName: string;
  status: ProviderHealthState;
  message?: string;
  checkedAt: string;
}

/**
 * Whether the active provider serving a country's coverage
 * is a delayed/free feed or a live one.
 */
export type NewsFeedTier =
  | 'delayed'
  | 'live';

/**
 * Backward-compatible country-news name for the shared
 * fallback provenance type.
 */
export type CountryNewsFallbackReason =
  NewsFallbackReason;

/** Response envelope for GET /news/country/:countryCode. */
export interface CountryNewsResponse {
  countryCode: string;
  countryName: string;
  articles: NewsArticle[];
  totalResults: number;
  providers: string[];
  dataMode: NewsDataMode;
  feedTier: NewsFeedTier;
  providerDisplayName: string;

  /**
   * Present when dataMode is "cached" (PostgreSQL country reporting is
   * being used as a fallback for the current provider request) or
   * "unavailable" (no live provider succeeded and no stored country
   * reporting existed either).
   */
  fallbackReason?: NewsFallbackReason;

  /**
   * ISO-8601 publication timestamp of the newest article
   * in stored country reporting.
   *
   * This describes article freshness, not database fetch age.
   */
  newestArticlePublishedAt?: string;

  category?: NewsCategory;
  generatedAt: string;
}