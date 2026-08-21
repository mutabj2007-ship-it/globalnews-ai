/**
 * Shared news domain types.
 *
 * These types are the contract between the backend's provider-agnostic
 * news module and the frontend's rendering layer. Both workspaces import
 * from here so the shape of an "article" only needs to change in one
 * place as real providers are added in later sprints.
 */

import type { OfficialSourceClass } from './officialSources';

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

  /**
   * Milestone #47 — the provider-reported language of this article's
   * content, e.g. "en", "pl", "de", "fr" — verbatim, trimmed, and
   * lowercased from the upstream provider's own `lang` field. Deliberately
   * a plain string, NOT LanguageCode: retrieved evidence can be in any
   * language the news provider supports, a far larger set than
   * GlobalNews AI's own closed UI-language list, and coercing an
   * unrecognized value into a false LanguageCode member would be
   * dishonest. Undefined when the provider didn't report a language for
   * this article — never fabricated or inferred. TrustState does not
   * consume this field.
   */
  sourceLanguage?: string;

  confidence?: number;

  /**
   * M64.1 — which SourceProvider produced this record (e.g. 'gnews',
   * 'official-source:iebc-kenya'). Optional: every existing article
   * (GNews-sourced, already in the database or freshly fetched today)
   * has no value here, and that is a correct, honest absence — never
   * backfilled or inferred from sourceId/sourceName.
   */
  providerId?: string;

  /** M64.1 — the provider's own record identifier, if it has one distinct from `id`. */
  providerRecordId?: string;

  /**
   * M66.14B — the article's canonical country, when one was resolved from the
   * article's OWN TEXT by scoreCountryRelevance(). COUNTRY PRECISION ONLY:
   * there is deliberately no latitude, longitude, city or region here, because
   * nothing in this system knows those things about an article, and a field
   * that exists is a field somebody eventually fills in with a guess.
   *
   * ABSENT means genuinely unresolved — no country scored relevant against the
   * article's text. It is never inferred from sourceName, never defaulted to a
   * query country, never back-filled. A consumer must read absence as "we do
   * not know", never as "nowhere", and must render the article normally.
   *
   * ISO 3166-1 alpha-2, matching CountryMeta.iso2.
   */
  countryCode?: string;

  /** M66.14B — canonical English name for countryCode. Present exactly when countryCode is. */
  countryName?: string;

  /**
   * M64.1 — how precisely this record's geography is known. Absent
   * means "not assessed" — never defaults to a guessed precision.
   */
  geographicPrecision?: 'country' | 'region' | 'city' | 'coordinate' | 'unknown';

  /**
   * M64.1 — where this record sits relative to primary reporting.
   * Absent means "not assessed", not a claim that the source itself
   * is of unknown quality.
   */
  evidencePrecision?: 'primary' | 'secondary' | 'aggregated' | 'unknown';

  /**
   * M64.1 — set only when this record's provider is itself an
   * Official Source Registry entry (see officialSources.ts). Absent
   * for ordinary news-provider articles (GNews, etc.) — never
   * populated by inference from sourceName.
   */
  sourceAuthorityClass?: OfficialSourceClass;
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

  /**
   * M64.1 — observability additions. All optional and backward-
   * compatible: every existing ProviderHealthStatus literal in this
   * codebase (e.g. GNewsProvider.health()'s real return objects)
   * satisfies this extended interface completely unchanged, since
   * none of these fields are populated yet by any existing provider.
   *
   * requestCount, failureCount, recordsRetrieved, recordsAccepted,
   * and duplicatesRemoved are PROCESS-LIFETIME counters when a
   * provider eventually populates them — cumulative since process
   * start, not per-request or per-health-check values. This is a
   * documentation commitment for future implementers, not something
   * enforced by the type itself.
   */

  /** Whether this provider is currently enabled for reads (distinct from health/reachability). */
  enabled?: boolean;

  /** Process-lifetime cumulative count. */
  requestCount?: number;

  /** Process-lifetime cumulative count. */
  failureCount?: number;

  /** Milliseconds. The single most recent request's latency — not an average, not cumulative. Absent if this provider has never completed a timed request. */
  lastLatencyMs?: number;

  /** ISO-8601. Absent if this provider has never succeeded. */
  lastSuccessAt?: string;

  rateLimitState?: 'ok' | 'throttled' | 'unknown';

  /** Process-lifetime cumulative count. */
  recordsRetrieved?: number;

  /** Process-lifetime cumulative count. */
  recordsAccepted?: number;

  /** Process-lifetime cumulative count. */
  duplicatesRemoved?: number;

  /** 0-1. Fraction of this provider's records for which geographic resolution succeeded. */
  geoResolutionSuccessRate?: number;
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

  /**
   * Present only when this retrieval was driven by a curated city
   * match (see LocationContext / resolveLocationContext in
   * countries.ts), not merely by the country itself. Lowercase
   * canonical form, e.g. "kigali". Absent for a plain country-level
   * query such as "Rwanda" or "RWA".
   */
  city?: string;
}