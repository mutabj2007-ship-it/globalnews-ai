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

export function searchNews(query: string, limit = 8): Promise<NewsResponse> {
  const normalized = query.trim().replace(/\s+/g, ' ');
  const params = new URLSearchParams({ q: normalized, limit: String(limit) });
  return getJson<NewsResponse>(`/news/search?${params.toString()}`);
}

export function fetchByCategory(category: string, limit = 20): Promise<NewsResponse> {
  return getJson<NewsResponse>(`/news/category/${category}?limit=${limit}`);
}
