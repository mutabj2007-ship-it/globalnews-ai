import type { AnalysisApiResponse } from '@globalnews-ai/shared';

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
 */
export function analyzeNews(query: string): Promise<AnalysisApiResponse> {
  const key = query.trim();

  const existing = inFlightAnalysisRequests.get(key);
  if (existing) {
    return existing;
  }

  const request = performAnalyzeNews(query).finally(() => {
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

async function performAnalyzeNews(query: string): Promise<AnalysisApiResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/analysis/news`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
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
