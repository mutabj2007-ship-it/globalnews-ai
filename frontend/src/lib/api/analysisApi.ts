import type { AnalysisApiResponse, LanguageCode, StoryContext } from '@globalnews-ai/shared';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
// Longer than the news API timeout: the backend's own AI call timeout
// (ANALYSIS_TIMEOUT_MS, default 20s) needs room to complete before the
// client gives up, plus network overhead.
const REQUEST_TIMEOUT_MS = 30000;

export class AnalysisApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'AnalysisApiError';
  }
}

/**
 * In-flight request deduplication.
 *
 * NOT persistent caching: an entry exists only while its request is
 * actually pending, and is removed the instant it settles (success OR
 * failure) — see the `.finally()` below. A later call for the same
 * query after the first has settled always issues a brand-new fetch.
 *
 * This exists specifically because React Strict Mode's development-
 * only effect double-invocation was producing two real POST requests
 * for one user search — an in-flight AbortController approach was
 * tried and failed real-browser acceptance (both requests still
 * reached the backend before either could be aborted in time), so this
 * takes a different approach: reuse the same pending Promise for a
 * second, near-simultaneous call, so only ONE fetch is ever actually
 * issued for two callers requesting the same query at the same time.
 *
 * Keyed by `query.trim()` — the smallest safe key. The backend's own
 * normalizeQuery() (see shared/src/query-normalization.ts) does more
 * (smart-quote/whitespace normalization) than a plain trim, but
 * introducing that same logic here would be a second, independently-
 * evolving normalization algorithm on the frontend — exactly what this
 * hotfix must avoid. `.trim()` alone is already what this file's own
 * caller (SearchPageClient) uses for its own empty-query check, so it
 * introduces no new semantics, just reuses the same minimal notion of
 * "the same query" already implicit in this codebase. The actual HTTP
 * request body is NEVER altered by this — it always sends exactly the
 * raw `query` string the first (deduplication-winning) caller passed,
 * completely unchanged from pre-hotfix behavior.
 */
const inFlightAnalysisRequests = new Map<string, Promise<AnalysisApiResponse>>();

/**
 * Calls the GlobalNews AI backend's analysis endpoint. This is the only
 * place the frontend talks to for AI analysis — it never calls OpenAI
 * (or any AI provider) directly, so no AI key ever needs to exist in
 * frontend code or environment variables.
 *
 * If a request for the same (trimmed) query is already in flight, this
 * returns that exact same pending Promise instead of issuing a second
 * fetch — see inFlightAnalysisRequests above. Every other aspect of
 * this function's behavior (AnalysisApiError shapes, HTTP 429 handling,
 * timeout behavior) is byte-for-byte unchanged from before this hotfix.
 *
 * Milestone #47 — `requestedLanguage` defaults to 'en', so every
 * existing caller that never passes it keeps its exact prior behavior.
 * Now part of the in-flight dedup key too: the same query text
 * requested in two different languages must never share one in-flight
 * request or resolve to the wrong language's response.
 */
export function analyzeNews(
  query: string,
  requestedLanguage: LanguageCode = 'en',
  /**
   * Milestone #51 Phase B — optional, bounded story context (e.g.
   * from a World Map country-feed article's "Ask GlobalNews AI about
   * this" action). Every pre-#51 caller omits this and is completely
   * unaffected. Folded into the in-flight dedup key (via
   * countryCode only — the smallest safe key segment, mirroring the
   * backend's own cache-key strategy) so the same query text
   * anchored to two different stories/countries can never
   * accidentally share one pending request.
   */
  storyContext?: StoryContext,
): Promise<AnalysisApiResponse> {
  /**
   * Milestone #51 Phase B (CTO final correction): prefers
   * storyContext.articleId (the stable, server-resolvable story
   * identity) over countryCode alone, mirroring the backend's own
   * cache-key priority exactly — two different stories in the same
   * country must never share one in-flight request merely because
   * they share a country. Falls back to countryCode when articleId is
   * absent (this session's earlier, still-valid country-only
   * anchoring case); empty suffix when storyContext is absent
   * entirely, unchanged from before this correction.
   */
  const storyAnchorKeySegment = storyContext?.articleId
    ? `:story:${storyContext.articleId}`
    : storyContext?.countryCode
      ? `:story:${storyContext.countryCode.toLowerCase()}`
      : '';
  const key = `${requestedLanguage}:${query.trim()}${storyAnchorKeySegment}`;

  const existing = inFlightAnalysisRequests.get(key);
  if (existing) {
    return existing;
  }

  const request = performAnalyzeNews(query, requestedLanguage, storyContext).finally(() => {
    // Only delete this key's entry if it still points at THIS promise.
    // Guards against a theoretical race where an older, already-
    // resolved request's cleanup could otherwise delete a NEWER
    // in-flight request for the same key (e.g. if this .finally were
    // ever delayed past the point a fresh request for the same query
    // was already stored) — with this check, a stale cleanup is a
    // harmless no-op instead of deleting live state.
    if (inFlightAnalysisRequests.get(key) === request) {
      inFlightAnalysisRequests.delete(key);
    }
  });

  inFlightAnalysisRequests.set(key, request);
  return request;
}

async function performAnalyzeNews(
  query: string,
  requestedLanguage: LanguageCode,
  storyContext?: StoryContext,
): Promise<AnalysisApiResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/analysis/news`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(storyContext ? { query, requestedLanguage, storyContext } : { query, requestedLanguage }),
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AnalysisApiError('The analysis is taking longer than expected. Please try again.');
    }
    throw new AnalysisApiError(
      error instanceof Error ? error.message : 'Failed to reach the GlobalNews AI backend',
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new AnalysisApiError(`Backend responded with ${response.status}`, response.status);
  }

  return response.json() as Promise<AnalysisApiResponse>;
}
