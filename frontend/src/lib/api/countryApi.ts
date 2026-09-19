import type { CountryNewsResponse, LanguageCode, NewsCategory } from '@globalnews-ai/shared';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WHERE THIS CLIENT SENDS ITS REQUEST — AND WHY THE BROWSER CASE IS DIFFERENT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * This read `process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'`, one
 * constant for every execution context. MEASURED against Alpha's own variable
 * set, that is a browser request to `http://localhost:4000/news/country/:iso3`:
 * `NEXT_PUBLIC_API_URL` is not set there, so Next inlines the fallback, and the
 * literal `localhost:4000` is present in the built map chunk.
 *
 * NOTHING CAUGHT IT BECAUSE NOTHING CALLED IT FROM A BROWSER ON THAT ROUTE.
 * `MAP-GNEWS-QUOTA-REGRESSION-1` removed the Map's import entirely, and the
 * homepage's own caller carries the same latent defect unexercised. The first
 * reader-facing country read on the modern shell is what makes it reachable, so
 * it is fixed here rather than worked around at the new call site.
 *
 * ── SAME-ORIGIN IN THE BROWSER, AND NO NEW VARIABLE TO MISCONFIGURE ───────
 *
 * `accountBase.ts` already made this exact decision for account traffic, in its
 * own words: routing through *"THIS origin's /api path … there is no
 * environment variable to misconfigure, no way for a deploy to point it at the
 * wrong host."* The `/news/:path*` rewrite that carries it already exists in
 * `next.config.mjs` and is what serves `/news/country/KEN` on Alpha today.
 *
 * SO THE PRECEDENCE IS UNCHANGED WHERE IT WAS EVER CORRECT:
 *
 *   NEXT_PUBLIC_API_URL set   -> that origin, exactly as before, everywhere
 *   browser, unset            -> same-origin '' , proxied by the rewrite
 *   server, unset             -> the localhost default, exactly as before
 *
 * An explicitly configured origin still wins, so no environment that works
 * today changes behaviour. What changes is the one case that could not work.
 *
 * `MAIN-COUNTRY-READER-RETRIEVAL-CONTRACT-R1` A-4 records that
 * `fetchCountryNews` *"needs no change"*, and that is true of its CAPABILITY —
 * exported, `no-store`, abortable, which is what Main measured. Base resolution
 * in a browser was never exercised, because no browser-side map caller existed
 * to exercise it. This changes where the request goes, not what it is.
 */
function countryApiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (typeof configured === 'string' && configured.length > 0) return configured;

  return typeof window === 'undefined' ? 'http://localhost:4000' : '';
}

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

/**
 * Milestone #49 (World Map EN/PL integration) — `lang` is new and
 * optional, additive to the existing `category`/`limit` options.
 * Omitted (every pre-existing caller): the request URL is unchanged
 * from before this milestone. When present, sent as `?lang=en`/`?lang=pl`
 * alongside the existing params — the backend DTO validates it against
 * the same narrow en/pl set already established for the homepage feed.
 */
export async function fetchCountryNews(
  countryCode: string,
  options: { category?: NewsCategory; limit?: number; lang?: LanguageCode } = {},
): Promise<CountryNewsResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const params = new URLSearchParams();
  if (options.category) params.set('category', options.category);
  if (options.limit) params.set('limit', String(options.limit));
  if (options.lang) params.set('lang', options.lang);
  const query = params.toString();

  let response: Response;
  try {
    response = await fetch(
      `${countryApiBase()}/news/country/${countryCode}${query ? `?${query}` : ''}`,
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
