import { Injectable, Logger } from '@nestjs/common';
import { logWithRequestId } from '../../../observability/log-with-request-id';
import { ConfigService } from '@nestjs/config';
import type { NewsArticle, NewsCategory, ProviderHealthStatus } from '@globalnews-ai/shared';
import type { NewsProvider, NewsSearchOptions } from '../interfaces';
import { classifyCategory } from '../classification/classify-category.util';

const GNEWS_BASE_URL = 'https://gnews.io/api/v4';
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const REQUEST_TIMEOUT_MS = 8000;
/**
 * Query-limit correction — GNews's own documented search `q` parameter
 * maximum. This is an UNCONDITIONAL, last-resort defensive backstop —
 * see search()'s own use of clampQueryLength() below — not the
 * primary retrieval strategy. Upstream derivation (AnalysisService's
 * use of deriveGenericNewsQuery()/deriveFallbackNewsQuery()) is
 * expected to already produce a short, topically-focused phrase in
 * ordinary operation; this exists so a sufficiently long or complex
 * user question can never violate GNews's own limit regardless of
 * what upstream code does now or is changed to do later.
 */
const GNEWS_MAX_QUERY_LENGTH = 200;

/**
 * GlobalNews AI categories don't map 1:1 onto GNews's category set.
 * "politics" has no direct GNews equivalent, so it's mapped to GNews's
 * "nation" category, which is the closest practical fit.
 */
const CATEGORY_MAP: Record<NewsCategory, string> = {
  world: 'world',
  politics: 'nation',
  business: 'business',
  technology: 'technology',
  science: 'science',
  health: 'health',
  sports: 'sports',
  entertainment: 'entertainment',
};

interface GNewsApiArticle {
  title?: string;
  description?: string;
  url?: string;
  image?: string;
  publishedAt?: string;
  source?: { name?: string; url?: string };
  /** Milestone #47 — GNews's own reported language of this article, e.g. "en", "pl", "de". */
  lang?: string;
}

interface GNewsApiResponse {
  totalArticles?: number;
  articles?: GNewsApiArticle[];
}

/** Raised for any GNews-specific failure (auth, timeout, rate limit, malformed payload). */
export class GNewsProviderError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'GNewsProviderError';
  }
}

/**
 * Real news provider backed by the GNews API (https://gnews.io).
 *
 * This is the first non-mock implementation of NewsProvider. It never
 * exposes GNews's raw response shape or its API key — every article is
 * normalized into the shared NewsArticle type before it leaves this
 * class, and the key is read once per call from ConfigService and never
 * logged or returned.
 *
 * If GNEWS_API_KEY isn't configured, every read method throws a clear
 * GNewsProviderError. NewsModule only activates this provider for reads
 * when the key is present (see news.module.ts), so in practice this is
 * a defensive fallback rather than the primary code path — but health()
 * always reports a clear "not configured" status regardless, so this
 * provider's status is visible even while inactive.
 */
@Injectable()
export class GNewsProvider implements NewsProvider {
  readonly id = 'gnews';
  readonly displayName = 'GNews';
  readonly isMock = false;

  private readonly logger = new Logger(GNewsProvider.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Milestone #47 — `lang` now comes from `options?.lang`, defaulting
   * to 'en' when absent so every existing caller that never passes it
   * keeps its exact prior behavior. Never call this with an
   * unsupported Search-endpoint language (pl/sw/rw are NOT supported
   * by GNews's real /search endpoint, verified from current official
   * documentation) — resolve-retrieval-language.util.ts is responsible
   * for never emitting one; this method does not itself validate the
   * value, matching this file's existing "provider is a thin mapping
   * layer" design.
   */
  async search(query: string, options?: NewsSearchOptions): Promise<NewsArticle[]> {
    const apiKey = this.requireApiKey();
    const url = this.buildUrl('/search', apiKey, {
      q: this.clampQueryLength(query),
      lang: options?.lang ?? 'en',
      max: String(this.clampLimit(options?.limit)),
    });
    const payload = await this.request(url);
    return this.normalize(payload);
  }

  /**
   * Milestone #47 — extended to accept an optional `q` (GNews's real
   * /top-headlines endpoint supports keyword filtering, confirmed from
   * current official documentation — this was not previously exposed
   * by this repository's wrapper) and `lang` (no forced default here,
   * unlike search() — GNews's own documented default for an omitted
   * `lang` on this endpoint is "no language filter", a meaningfully
   * different, valid state from forcing English).
   *
   * Milestone #48 (Phase C — runtime language containment) — GNews's
   * own server-side `lang` filtering on this "trending" endpoint is
   * NOT strictly reliable: real browser acceptance showed articles in
   * 5+ unrelated languages returned for both `lang=en` and `lang=pl`
   * requests, even though `lang` was correctly sent on every request
   * (verified — this was never a request-construction bug). This
   * method previously trusted GNews's filtering completely and mapped
   * every returned article verbatim, regardless of that article's OWN
   * reported language.
   *
   * Now, when a `lang` was requested, every returned article is
   * validated against its OWN `sourceLanguage` (already extracted from
   * GNews's per-article `lang` field, unchanged) before being
   * returned — an article whose own language doesn't match the
   * request, OR whose language GNews didn't report at all, is
   * discarded rather than silently shown. This is a strict,
   * conservative policy: fewer articles (or none) is preferred over
   * uncontrolled multilingual content, per explicit instruction.
   * search()/category() are NOT filtered this way in this correction —
   * scoped narrowly to the homepage's actual call path; search()'s
   * Polish-Q&A English-fallback semantics have their own intentional
   * cross-language design that a blanket filter could break, and
   * extending containment there needs its own separate consideration
   * (noted as deferred, not silently done).
   */
  async topHeadlines(options?: NewsSearchOptions): Promise<NewsArticle[]> {
    const apiKey = this.requireApiKey();
    const url = this.buildUrl('/top-headlines', apiKey, {
      lang: options?.lang,
      q: options?.q,
      max: String(this.clampLimit(options?.limit)),
    });
    const payload = await this.request(url);
    const articles = this.normalize(payload);
    return options?.lang ? this.filterByRequestedLanguage(articles, options.lang) : articles;
  }

  /**
   * Milestone #48 (Phase C) — strict containment: keeps only articles
   * whose own `sourceLanguage` (GNews's per-article `lang`, already
   * trimmed/lowercased by mapSourceLanguage()) exactly matches the
   * requested language. An article with no reported language at all
   * (`sourceLanguage === undefined`) is discarded too — there is no
   * way to confirm it matches the request, and the conservative policy
   * is to exclude anything unconfirmed rather than guess. Comparison
   * is done on a matching trim/lowercase of `requestedLang` so a
   * caller-supplied value with different casing still matches
   * correctly.
   */
  private filterByRequestedLanguage(articles: NewsArticle[], requestedLang: string): NewsArticle[] {
    const normalizedRequested = requestedLang.trim().toLowerCase();
    return articles.filter((article) => article.sourceLanguage === normalizedRequested);
  }

  /**
   * Milestone #47: explicitly passes `lang: options?.lang ?? 'en'` to
   * preserve this method's exact pre-Milestone-#47 default behavior —
   * category() is not part of the M47 Polish/language retrieval flow,
   * so its observable behavior must remain completely unchanged now
   * that buildUrl() no longer injects a blanket 'en' default itself
   * (see buildUrl's own updated doc comment).
   */
  async category(category: NewsCategory, options?: NewsSearchOptions): Promise<NewsArticle[]> {
    const apiKey = this.requireApiKey();
    const gnewsCategory = CATEGORY_MAP[category] ?? 'general';
    const url = this.buildUrl('/top-headlines', apiKey, {
      category: gnewsCategory,
      lang: options?.lang ?? 'en',
      max: String(this.clampLimit(options?.limit)),
    });
    const payload = await this.request(url);
    return this.normalize(payload, category);
  }

  async health(): Promise<ProviderHealthStatus> {
    const apiKey = this.config.get<string>('GNEWS_API_KEY');

    if (!apiKey) {
      return {
        providerId: this.id,
        displayName: this.displayName,
        status: 'down',
        message: 'GNEWS_API_KEY is not configured. The backend is running in mock mode.',
        checkedAt: new Date().toISOString(),
      };
    }

    try {
      // Cheapest live check available: a 1-result top-headlines call.
      const url = this.buildUrl('/top-headlines', apiKey, { max: '1' });
      await this.request(url);
      return {
        providerId: this.id,
        displayName: this.displayName,
        status: 'ok',
        message: 'GNews responded successfully.',
        checkedAt: new Date().toISOString(),
      };
    } catch (error) {
      logWithRequestId(this.logger, 'warn', 'GNews health check failed', error as Error);
      return {
        providerId: this.id,
        displayName: this.displayName,
        status: 'degraded',
        message: this.describeError(error),
        checkedAt: new Date().toISOString(),
      };
    }
  }

  private requireApiKey(): string {
    const apiKey = this.config.get<string>('GNEWS_API_KEY');
    if (!apiKey) {
      throw new GNewsProviderError('GNEWS_API_KEY is not configured.');
    }
    return apiKey;
  }

  /**
   * Milestone #47 — no longer injects a blanket `lang=en` default
   * itself; each call site now explicitly decides its own `lang`
   * value (or omits it entirely for topHeadlines(), which has a
   * meaningfully different "no language filter" default per GNews's
   * own documentation) via the `params` object. `params` values may
   * now be `undefined` (never included in the URL) as well as falsy
   * strings (also excluded, unchanged from before).
   */
  private buildUrl(
    path: string,
    apiKey: string,
    params: Record<string, string | undefined>,
  ): string {
    const url = new URL(GNEWS_BASE_URL + path);
    url.searchParams.set('token', apiKey);
    for (const [key, value] of Object.entries(params)) {
      if (value) url.searchParams.set(key, value);
    }
    return url.toString();
  }

  private async request(url: string): Promise<GNewsApiResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, { signal: controller.signal });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new GNewsProviderError('GNews request timed out.', error);
      }
      throw new GNewsProviderError('Failed to reach GNews.', error);
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 401 || response.status === 403) {
      // Never echo the key or GNews's raw body back — it may contain it.
      throw new GNewsProviderError('GNews rejected the configured API key.');
    }
    if (response.status === 429) {
      throw new GNewsProviderError('GNews rate limit exceeded. Try again shortly.');
    }
    if (!response.ok) {
      throw new GNewsProviderError(`GNews responded with status ${response.status}.`);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      throw new GNewsProviderError('GNews returned a malformed (non-JSON) response.', error);
    }

    if (
      !payload ||
      typeof payload !== 'object' ||
      !Array.isArray((payload as GNewsApiResponse).articles)
    ) {
      throw new GNewsProviderError('GNews response did not match the expected shape.');
    }

    return payload as GNewsApiResponse;
  }

  /** Converts GNews's response shape into the shared NewsArticle contract. */
  private normalize(payload: GNewsApiResponse, categoryHint?: NewsCategory): NewsArticle[] {
    return (payload.articles ?? [])
      .filter((raw): raw is GNewsApiArticle & { title: string; url: string } =>
        Boolean(raw?.title && raw?.url),
      )
      .map((raw) => this.toNewsArticle(raw, categoryHint));
  }

  private toNewsArticle(
    raw: GNewsApiArticle & { title: string; url: string },
    categoryHint?: NewsCategory,
  ): NewsArticle {
    return {
      id: this.buildStableId(raw.url),
      title: raw.title,
      summary: raw.description ?? '',
      url: raw.url,
      imageUrl: raw.image || undefined,
      sourceId: this.slugify(raw.source?.name ?? 'gnews'),
      sourceName: raw.source?.name ?? 'Unknown source',
      // GNews's /search and /top-headlines responses don't include a
      // per-article category, so we classify from the article's own
      // text instead of defaulting everything to "world". When we
      // explicitly requested a category (via /category/:category),
      // that request is trusted as the hint.
      category: classifyCategory({ title: raw.title, summary: raw.description }, categoryHint),
      sourcesCount: 1,
      publishedAt: raw.publishedAt ?? new Date().toISOString(),
      // Milestone #47 — verbatim (trimmed, lowercased) mapping of
      // GNews's own reported `lang` field. Never fabricated: absent or
      // empty upstream value maps to undefined, never a guessed or
      // defaulted code.
      sourceLanguage: this.mapSourceLanguage(raw.lang),
    };
  }

  /**
   * Milestone #47 — trim + lowercase only; never validates against any
   * closed set (sourceLanguage is deliberately a plain string, not
   * LanguageCode — see NewsArticle.sourceLanguage's own doc comment).
   * Returns undefined for an absent or whitespace-only value, never a
   * fabricated default.
   */
  private mapSourceLanguage(rawLang: string | undefined): string | undefined {
    const trimmed = rawLang?.trim().toLowerCase();
    return trimmed && trimmed.length > 0 ? trimmed : undefined;
  }

  /** Deterministic id derived from the article URL, so re-fetching the same story dedupes cleanly. */
  private buildStableId(url: string): string {
    let hash = 0;
    for (let i = 0; i < url.length; i += 1) {
      hash = (hash * 31 + url.charCodeAt(i)) | 0;
    }
    return `gnews-${Math.abs(hash)}`;
  }

  private slugify(value: string): string {
    return (
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'gnews'
    );
  }

  private clampLimit(requested: number | undefined): number {
    if (!requested || requested < 1) return DEFAULT_LIMIT;
    return Math.min(requested, MAX_LIMIT);
  }

  /**
   * Query-limit correction — GNewsProvider.search()'s unconditional,
   * last-resort length backstop (see GNEWS_MAX_QUERY_LENGTH's own doc
   * comment above). Truncates by Unicode CODE POINT, not raw UTF-16
   * .slice(), specifically so a character outside the Basic
   * Multilingual Plane (some emoji, certain extended scripts) is never
   * split mid-surrogate-pair, which would otherwise produce a
   * malformed string containing an unpaired surrogate. Array.from()
   * iterates a string by code point (JavaScript's string iteration
   * protocol already correctly groups surrogate pairs into single
   * steps), so this is safe without any new dependency. A query
   * already at or under the limit is returned completely unchanged.
   */
  private clampQueryLength(query: string): string {
    const codePoints = Array.from(query);
    if (codePoints.length <= GNEWS_MAX_QUERY_LENGTH) return query;
    return codePoints.slice(0, GNEWS_MAX_QUERY_LENGTH).join('');
  }

  private describeError(error: unknown): string {
    if (error instanceof GNewsProviderError) return error.message;
    if (error instanceof Error) return error.message;
    return 'Unknown error contacting GNews.';
  }
}
