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
 * Calls the GlobalNews AI backend's analysis endpoint. This is the only
 * place the frontend talks to for AI analysis — it never calls OpenAI
 * (or any AI provider) directly, so no AI key ever needs to exist in
 * frontend code or environment variables.
 */
export async function analyzeNews(query: string): Promise<AnalysisApiResponse> {
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
