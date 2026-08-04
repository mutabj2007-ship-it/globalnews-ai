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
}

/**
 * Whether a response was served by a real, live provider or by
 * MockNewsProvider. The frontend uses this to label results honestly —
 * "live" and "mock" must never both be implied for the same response.
 */
export type NewsDataMode = 'live' | 'mock';

/** Standard envelope returned by every news-fetching endpoint. */
export interface NewsResponse {
  articles: NewsArticle[];
  totalResults: number;
  /** IDs of providers that successfully contributed results. */
  providers: string[];
  /** Whether this response came from a live provider or mock data. */
  dataMode: NewsDataMode;
  /** ISO-8601 timestamp of when this response was assembled. */
  generatedAt: string;
  query?: string;
  category?: NewsCategory;
}

export type ProviderHealthState = 'ok' | 'degraded' | 'down';

export interface ProviderHealthStatus {
  providerId: string;
  displayName: string;
  status: ProviderHealthState;
  message?: string;
  checkedAt: string;
}

/** Whether the active provider serving a country's coverage is a free/delayed feed or a live one. */
export type NewsFeedTier = 'delayed' | 'live';

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
  category?: NewsCategory;
  generatedAt: string;
}
