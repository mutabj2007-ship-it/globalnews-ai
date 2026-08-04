import type { NewsResponse } from '@globalnews-ai/shared';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
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

  let response: Response;
  try {
    // no-store: this is live news data, not something Next.js should
    // cache across requests.
    response = await fetch(`${API_BASE_URL}${path}`, {
      cache: 'no-store',
      signal: controller.signal,
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

export function fetchTopHeadlines(limit = 12): Promise<NewsResponse> {
  return getJson<NewsResponse>(`/news/top-headlines?limit=${limit}`);
}

export function searchNews(query: string, limit = 8): Promise<NewsResponse> {
  const normalized = query.trim().replace(/\s+/g, ' ');
  const params = new URLSearchParams({ q: normalized, limit: String(limit) });
  return getJson<NewsResponse>(`/news/search?${params.toString()}`);
}

export function fetchByCategory(category: string, limit = 20): Promise<NewsResponse> {
  return getJson<NewsResponse>(`/news/category/${category}?limit=${limit}`);
}
