import type { CountryNewsResponse, NewsCategory } from '@globalnews-ai/shared';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const REQUEST_TIMEOUT_MS = 10000;

export class CountryNewsApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'CountryNewsApiError';
  }
}

export async function fetchCountryNews(
  countryCode: string,
  options: { category?: NewsCategory; limit?: number } = {},
): Promise<CountryNewsResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const params = new URLSearchParams();
  if (options.category) params.set('category', options.category);
  if (options.limit) params.set('limit', String(options.limit));
  const query = params.toString();

  let response: Response;
  try {
    response = await fetch(
      `${API_BASE_URL}/news/country/${countryCode}${query ? `?${query}` : ''}`,
      { cache: 'no-store', signal: controller.signal },
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new CountryNewsApiError('The request took too long to respond. Please try again.');
    }
    throw new CountryNewsApiError(
      error instanceof Error ? error.message : 'Failed to reach the GlobalNews AI backend',
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new CountryNewsApiError(`Backend responded with ${response.status}`, response.status);
  }

  return response.json() as Promise<CountryNewsResponse>;
}
