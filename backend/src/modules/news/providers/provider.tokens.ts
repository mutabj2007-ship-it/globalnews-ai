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
 * R4 GDELT — the FALLBACK subset of the active set.
 *
 * NewsService needs to know which of the providers it already holds are
 * fallback-tier, and it must learn that from the same DI factory that
 * selected them rather than by inspecting the provider objects (which
 * carry no tier of their own — tier is a REGISTRATION fact, not a
 * property of the provider).
 *
 * This token is a SUBSET of NEWS_PROVIDERS, never a disjoint set: a
 * provider listed here is also in NEWS_PROVIDERS, so health reporting,
 * cross-provider dedup ranks and the mock-exclusion guarantee all keep
 * working from the one active list they already used.
 *
 * With no fallback provider configured this is an empty array, and
 * NewsService's behaviour is byte-for-byte what it was before tiering.
 */
export const FALLBACK_NEWS_PROVIDERS = Symbol('FALLBACK_NEWS_PROVIDERS');

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

/**
 * R4 GDELT — is the GDELT DOC provider switched on for this deployment?
 *
 * GDELT DOC 2.0 requires NO API KEY, so there is no key to check for
 * usability; activation is a plain toggle. Mirrors isGdeltEnabled() in
 * signals/providers/provider.tokens.ts exactly, including its
 * fail-closed strictness: only the exact string "true" (trimmed,
 * case-insensitive) enables it. Undefined, empty, whitespace, "1",
 * "yes" and anything else mean DISABLED.
 *
 * DEFAULT OFF IS DELIBERATE. Landing this code changes no deployment's
 * behaviour until someone sets GDELT_DOC_ENABLED=true, so the provider
 * can be reviewed, merged and acceptance-tested without altering live
 * retrieval on the way.
 */
export function isGdeltDocEnabled(value: string | undefined): boolean {
  if (typeof value !== 'string') return false;
  return value.trim().toLowerCase() === 'true';
}
