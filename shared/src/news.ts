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

/**
 * R4 GDELT — the two kinds of time a `publishedAt` can be.
 *
 * Deliberately a closed union of exactly two members, with no 'unknown'
 * value. "We do not know" is expressed by the FIELD BEING ABSENT, not by
 * a third member — a member named 'unknown' would be a value a producer
 * could set deliberately, and this distinction must only ever be made by
 * a provider that can actually prove which one it has.
 */
export type PublishedAtBasis = 'publisher' | 'observed';

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

  /** ISO-8601 timestamp. Read `publishedAtBasis` before describing it. */
  publishedAt: string;

  /**
   * R4 GDELT — WHAT KIND OF TIME `publishedAt` ACTUALLY IS.
   *
   * Until a second real provider existed, `publishedAt` had exactly one
   * meaning: the outlet's own assertion of when it published. GDELT DOC
   * 2.0 breaks that assumption. Its `seendate` is GDELT's OBSERVATION
   * time, and the live capture proved the gap is real rather than
   * theoretical:
   *
   *     Haberler record   seendate  20260826T074500Z   = 07:45 UTC
   *     publisher page              26.08.2026 09:50 Turkey local
   *                                                    ≈ 06:50 UTC
   *     GDELT observed the article ~55 minutes AFTER it was published.
   *
   * Fifty-five minutes is small enough to look like clock skew and large
   * enough to be a lie. So the basis travels WITH the timestamp instead
   * of being inferred from the provider by whoever happens to read it.
   *
   *   'publisher'  the outlet asserted this time. GNews.
   *   'observed'   an aggregator recorded seeing the article at this
   *                time. It is an UPPER BOUND on publication, never the
   *                publication time itself. GDELT DOC.
   *
   * ABSENT MEANS UNPROVEN, NOT 'publisher'. Every article written before
   * this field existed — and every row reloaded from the database, which
   * has no column for it — arrives with `publishedAtBasis` undefined.
   * Treating absence as 'publisher' would silently re-assert exactly the
   * claim this field exists to stop, so consumers that CARE about the
   * distinction must treat undefined as unknown and fail closed. Two
   * places already do:
   *
   *   - identity rung 3 refuses time-window corroboration unless BOTH
   *     records carry the SAME proven basis (article-identity.util.ts);
   *   - persistence refuses to store an 'observed' timestamp at all,
   *     because the Article table cannot describe it
   *     (article-persistence.service.ts).
   *
   * UI RULE, and it is part of the contract rather than a styling
   * preference: an 'observed' timestamp may be rendered as "Seen 3h ago"
   * and must NEVER be rendered as "Published 3h ago". The same applies to
   * log lines.
   */
  publishedAtBasis?: PublishedAtBasis;

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
   * R0 — the time GlobalNews AI FIRST persisted/observed this article,
   * ISO-8601, read from the immutable `Article.fetchedAt` database column.
   *
   * ────────────────────────────────────────────────────────────────────
   * THIS FIELD MEANS EXACTLY ONE THING, AND THE LIST OF THINGS IT DOES
   * NOT MEAN IS PART OF THE CONTRACT:
   *
   *   IT MEANS      when THIS SYSTEM first wrote this article down.
   *
   *   IT IS NOT     the article's publication time      -> use `publishedAt`
   *   IT IS NOT     when the underlying event began
   *   IT IS NOT     when a story or cluster was created
   *   IT IS NOT     when the provider first published it
   *   IT IS NOT     the most recent retrieval time
   *   IT IS NOT     a last-updated or change timestamp  -> that is the
   *                 database's own `updatedAt`, which is deliberately NOT
   *                 exposed here
   *
   * A consumer that needs "when did this happen in the world" must read
   * `publishedAt`. A consumer that needs "what is new to us since the
   * reader was last here" reads this field. Conflating the two would
   * present our own ingestion schedule as editorial recency, which is
   * exactly the class of claim this contract exists to prevent.
   * ────────────────────────────────────────────────────────────────────
   *
   * WHY IT IS TRUSTWORTHY. `Article.fetchedAt` is written exactly once, at
   * first insert, and never again. `ArticlePersistenceService.persistMany()`
   * upserts by `url`, and its `update:` payload does not contain `fetchedAt`
   * — verified at the SQL level, where the statement compiles to
   * `INSERT ... ON CONFLICT ("url") DO UPDATE SET "title" = $n, "updatedAt" =
   * $n`, with no `fetchedAt` among the updated columns. Re-observing the same
   * URL therefore cannot move it, and the value genuinely marks FIRST
   * observation rather than most recent.
   *
   * WHERE THE VALUE COMES FROM, precisely. The column is declared
   * `fetchedAt DateTime @default(now())` and the migration creates it as
   * `TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP` — but that database
   * default is a BACKSTOP that this write path does not reach. Prisma
   * materialises `now()` in the application process and binds it as an
   * explicit INSERT parameter, which was confirmed by reading the statements
   * PostgreSQL actually received. (An earlier revision of this comment
   * claimed the database stamps the value; that was reasoned from the DDL and
   * is corrected here after direct observation.)
   *
   * The practical consequence is small but real, and belongs in the contract
   * rather than in folklore: with more than one backend instance, first-seen
   * times carry whatever clock skew exists between instances. Nothing about
   * the meaning of the field changes — it is still written once and never
   * rewritten, and every consumer still reads it back from the stored column
   * rather than from any live clock.
   *
   * OPTIONAL, AND PRESENT-OR-ABSENT — NEVER APPROXIMATE. (R0.5 superseded
   * R0's original wording here, which said this field was absent on the live
   * path. That was true of R0 and is no longer true.)
   *
   * It is present on:
   *   - articles served from storage (`dataMode: "cached"`);
   *   - `NewsService.findArticleById`;
   *   - articles on a `dataMode: "live"` response that were successfully
   *     persisted during that same request — `persistMany()` returns the
   *     committed `fetchedAt` for each URL it wrote, and the live response is
   *     annotated from it.
   *
   * It is absent when this system has no committed first observation to
   * report — most importantly when persistence failed, which stays
   * deliberately non-fatal, so the reader still gets their news and simply
   * gets no first-seen marker with it.
   *
   * Absence means "we have not recorded a first observation for this
   * article". It is never backfilled, never defaulted to `publishedAt`,
   * never set to the current time to fill the gap, and never rendered as a
   * synthetic "unknown" value. A consumer must treat an article without this
   * field as ordinary and render it normally.
   *
   * A NOTE FOR ANYTHING BUILT ON TOP OF THIS. The field answers "when did WE
   * first see this", which is a statement about our own ingestion, not about
   * the world. On a cold or newly reset database — and equally on the day a
   * new provider is enabled, or a provider changes its URL format — every
   * article is genuinely first observed at once, and this field will
   * correctly say so for all of them. Any feature that turns this datum into
   * a claim about novelty owes the reader a check that the claim actually
   * discriminates. That judgement belongs to the consumer, not here.
   *
   * IDENTITY NOTE. Pair this with `url`, which is the database's unique
   * key and the key `persistMany` upserts on. Do NOT pair it with `id`:
   * that value is derived from a 32-bit rolling hash and is not a safe
   * canonical identity at scale.
   */
  firstSeenAt?: string;

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

/**
 * R4 GDELT — WHY A PROVIDER CALL FAILED.
 *
 * Before this existed, the news layer carried failure as a message
 * string and nothing else, and one branch collapsed two genuinely
 * different conditions into one sentence:
 *
 *     if (response.status === 401 || response.status === 403) {
 *       throw new GNewsProviderError('GNews rejected the configured API key.');
 *     }
 *
 * When the Free plan reached 100/100 the live host received 403 and the
 * operator was told the API key had been rejected. The key was fine. The
 * day's allowance was spent and would reset on its own. An operator
 * acting on that sentence would rotate a working credential while the
 * real condition stayed invisible.
 *
 * These kinds exist so the difference is representable at all. They say
 * what happened; they do not say what to do about it.
 *
 *   'auth'          the credential is missing, invalid or revoked.
 *   'quota'         the plan's allowance is exhausted. Time-based; the
 *                   credential is valid.
 *   'rate-limited'  a short-window throttle. Retryable after a wait.
 *   'timeout'       the request exceeded the provider's own deadline.
 *   'unreachable'   the request never got an HTTP response at all.
 *   'malformed'     an HTTP 200 whose body could not be trusted.
 *   'unknown'       an HTTP failure with no established mapping. The
 *                   honest default — never a catch-all for a status we
 *                   have merely guessed at.
 *
 * HOW A STATUS CODE MAPS TO A KIND IS PROVIDER-SPECIFIC, AND THAT IS THE
 * POINT. 403 means quota exhaustion on THIS GNews plan because the live
 * host proved it there. It is not a general fact about HTTP 403, and no
 * other provider may copy that mapping without its own evidence — see
 * gnews.provider.ts, where the mapping is documented at the branch.
 */
export type ProviderFailureKind =
  | 'auth'
  | 'quota'
  | 'rate-limited'
  | 'timeout'
  | 'unreachable'
  | 'malformed'
  | 'unknown';

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