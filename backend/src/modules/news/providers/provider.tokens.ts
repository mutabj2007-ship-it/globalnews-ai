/**
 * Injection token for the array of active NewsProvider implementations
 * used to serve reads (search, topHeadlines, category).
 *
 * NewsService depends on this token, not on any concrete provider class.
 * Adding a new provider (Reuters, AP News, BBC, NewsAPI, GDELT, Google
 * News, ...) means: implement NewsProvider, then add one line to the
 * factory in news.module.ts. Nothing in NewsService or NewsController
 * changes.
 */
export const NEWS_PROVIDERS = Symbol('NEWS_PROVIDERS');

/**
 * Injection token for *every* registered NewsProvider, regardless of
 * whether it's currently active for reads.
 *
 * This exists so /news/providers/health can report the status of a
 * configured-but-inactive provider (e.g. GNews when running in mock
 * mode) without that provider ever contributing articles to a response.
 * Keeping this separate from NEWS_PROVIDERS is what guarantees mock and
 * real article data are never silently blended together.
 */
export const ALL_NEWS_PROVIDERS = Symbol('ALL_NEWS_PROVIDERS');

/**
 * Milestone #33 — the single shared definition of "is GNEWS_API_KEY
 * actually usable", so provider selection (below, via news.module.ts's
 * NEWS_PROVIDERS factory) and NewsStartupValidator's fail-closed
 * production guard can never disagree with one another. Mirrors
 * isUsableOpenAiApiKey in analysis/providers/provider.tokens.ts exactly:
 * deliberately NOT a plain truthiness check, since a whitespace-only
 * value (e.g. " ") is truthy in JavaScript but is not a usable key.
 *
 * Before Milestone #33, provider selection used a plain
 * `Boolean(config.get('GNEWS_API_KEY'))` check, which would have
 * treated a whitespace-only key as "configured" and selected
 * GNewsProvider instead of MockNewsProvider — this helper fixes that
 * inconsistency as well as backing the new startup guard.
 */
export function isUsableGNewsApiKey(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}
