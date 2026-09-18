import type { LanguageCode, NewsResponse } from '@globalnews-ai/shared';
import { resolveApiBaseUrl } from './apiBase';
import { resolveForwardedClientHeaders } from './forwardedClient';

const REQUEST_TIMEOUT_MS = 10000;

export class NewsApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'NewsApiError';
  }
}

async function getJson<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  // B-1 - server-side only, and empty in every browser. Preserves the
  // visitor's client address across the SSR hop so the backend's rate limit
  // counts visitors rather than counting this container once for the whole
  // world. Never synthesises an address; forwards the edge proxy's own
  // X-Forwarded-For verbatim or nothing at all, and the backend decides
  // whether to believe it via TRUST_PROXY. See forwardedClient.ts.
  const forwardedHeaders = await resolveForwardedClientHeaders();

  let response: Response;
  try {
    // no-store: this is live news data, not something Next.js should
    // cache across requests.
    // R2 - resolved per request, not hoisted back to a module constant:
    // this client runs server-side, where the backend must be reached by
    // its container-internal address rather than the browser's public one.
    response = await fetch(`${resolveApiBaseUrl()}${path}`, {
      cache: 'no-store',
      signal: controller.signal,
      headers: forwardedHeaders,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new NewsApiError('The request took too long to respond. Please try again.');
    }
    throw new NewsApiError(
      error instanceof Error ? error.message : 'Failed to reach the GlobalNews AI backend',
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new NewsApiError(`Backend responded with ${response.status}`, response.status);
  }

  return response.json() as Promise<T>;
}

/**
 * Milestone #47 (homepage feed language correction) — `lang` is new
 * and optional. Omitted (every pre-existing caller): identical request
 * to before, fully backward compatible. When supplied, threads through
 * to GET /news/top-headlines?limit=...&lang=... — the backend's own
 * TopHeadlinesQueryDto validates it against the same closed
 * LanguageCode set the analysis DTO already uses; this function itself
 * does no validation, matching this file's existing "thin API client"
 * design.
 */
export function fetchTopHeadlines(limit = 12, lang?: LanguageCode): Promise<NewsResponse> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (lang) params.set('lang', lang);
  return getJson<NewsResponse>(`/news/top-headlines?${params.toString()}`);
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * R5 · THE NON-EXECUTING READ OF THE SAME CORPUS — WHAT THE MAP USES
 * ════════════════════════════════════════════════════════════════════════════
 *
 * **Product invariant: opening or navigating the Map must never execute GNews
 * merely to obtain the global corpus.**
 *
 * `GET /news/top-headlines/retained` reads the SAME `limit:language` corpus as
 * `fetchTopHeadlines` above, from the same backend cache, but through a route
 * that is structurally incapable of calling a provider. On a miss it answers
 * `dataMode: 'unavailable'` with no articles, and the map renders its honest
 * empty world rather than buying one.
 *
 * ── WHY THE PARAMETERS MUST MATCH `fetchTopHeadlines` EXACTLY ─────────────
 *
 * The backend key is `limit:language`. Home warms it through the executing
 * route; the map reads it through this one. If the two ever disagreed about
 * width or language — `24` vs `12`, `en` vs absent — the map would miss a warm
 * entry on every open and, because this route cannot retrieve, would show an
 * empty world **while Home showed a full one**, with nothing reporting the
 * disagreement. `ALPHA-TOPHEADLINES-KEY-DIVERGENCE-1` is that hazard, and it is
 * pinned by tests rather than by this comment.
 *
 * Deliberately a SEPARATE function rather than a flag on the one above: the map
 * must be UNABLE to reach the executing path, not merely instructed to avoid
 * it. R4 measured what call-site discipline is worth here — the map spent quota
 * on every mount for months without anyone intending it to.
 */
export function fetchRetainedTopHeadlines(limit = 12, lang?: LanguageCode): Promise<NewsResponse> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (lang) params.set('lang', lang);
  return getJson<NewsResponse>(`/news/top-headlines/retained?${params.toString()}`);
}

export function searchNews(query: string, limit = 8): Promise<NewsResponse> {
  const normalized = query.trim().replace(/\s+/g, ' ');
  const params = new URLSearchParams({ q: normalized, limit: String(limit) });
  return getJson<NewsResponse>(`/news/search?${params.toString()}`);
}

export function fetchByCategory(category: string, limit = 20): Promise<NewsResponse> {
  return getJson<NewsResponse>(`/news/category/${category}?limit=${limit}`);
}
