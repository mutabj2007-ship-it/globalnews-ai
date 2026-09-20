import { Injectable, Logger } from '@nestjs/common';
import { logWithRequestId } from '../../../observability/log-with-request-id';
import { ConfigService } from '@nestjs/config';
import type {
  NewsArticle,
  NewsCategory,
  ProviderFailureKind as UpstreamProviderFailureKind,
  ProviderHealthStatus,
} from '@globalnews-ai/shared';
import type { NewsProvider, NewsSearchOptions } from '../interfaces';
import { classifyCategory } from '../classification/classify-category.util';

const GNEWS_BASE_URL = 'https://gnews.io/api/v4';
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const REQUEST_TIMEOUT_MS = 8000;

/**
 * A live 429/403 is a provider-side stop signal for this process.
 *
 * Alpha regional fan-out previously sent the same exhausted/rate-limited
 * provider several more requests in the same millisecond. Sixty seconds is a
 * conservative circuit window: it does not guess the provider's daily reset,
 * but it is long enough that one user request and the next immediate retry do
 * not keep spending calls into a condition we already observed.
 */
const GNEWS_COOLDOWN_MS = 60_000;
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
 * RC-1 / RC-H1 finding H-2 — the ONE definition of "this provider actually
 * told us when the article was published".
 *
 * Exported so a test can bind to the rule itself rather than only to its
 * effect, and so any future provider can reuse the same predicate instead of
 * inventing a second, subtly different one.
 *
 * A value is usable only if it is a non-empty string that Date.parse accepts.
 * That rejects, in order of how they actually arrive from a real feed:
 *   undefined / null            the field is simply absent
 *   ''  or '   '                present but empty, which asserts nothing
 *   'not a date', 'yesterday'   present but unparseable
 *   '2026-13-45T99:99:99Z'      well-shaped but not a real instant
 *
 * IT DOES NOT REPAIR, NORMALISE OR GUESS. There is no "try a few formats"
 * branch and there must never be one: a timestamp we had to reconstruct is a
 * timestamp we invented, which is the exact defect this predicate exists to
 * close. The only two outcomes are "the outlet asserted this instant" and
 * "drop the record".
 */
export function isUsablePublicationTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return false;
  }

  return Number.isFinite(Date.parse(value));
}

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

/**
 * MAIN + E convergence — the provider's upstream truth is richer than the
 * original Analysis retry decision. Keep both without conflating them.
 *
 * `UpstreamProviderFailureKind` is the accepted E/shared taxonomy and remains
 * authoritative for what actually happened at a provider: quota is quota,
 * timeout is timeout, malformed is malformed. `bad-request` and `unavailable`
 * are backend-only Analysis decision labels retained for Main compatibility;
 * they are never written into the shared provider-health/data contract.
 */
export type ProviderFailureKind = UpstreamProviderFailureKind | 'bad-request' | 'unavailable';

type AnalysisOnlyFailureKind = 'bad-request' | 'unavailable';

const PROVIDER_FAILURE_KINDS = new Set<ProviderFailureKind>([
  'auth',
  'quota',
  'rate-limited',
  'timeout',
  'unreachable',
  'malformed',
  'unknown',
  'bad-request',
  'unavailable',
]);

function isProviderFailureKind(value: unknown): value is ProviderFailureKind {
  return typeof value === 'string' && PROVIDER_FAILURE_KINDS.has(value as ProviderFailureKind);
}

/**
 * Raised for any GNews-specific failure.
 *
 * The public `kind` property deliberately stays inside E's shared upstream
 * taxonomy. That preserves 401=auth, 403=quota, 429=rate-limited and the
 * timeout/unreachable/malformed distinctions used by health/Admin. Main's two
 * legacy Analysis-only labels can still be supplied by focused tests, but are
 * stored separately so they cannot overwrite the upstream fact.
 */
export class GNewsProviderError extends Error {
  public readonly kind: UpstreamProviderFailureKind;
  public readonly analysisKind?: AnalysisOnlyFailureKind;

  constructor(
    message: string,
    public readonly cause?: unknown,
    kind: ProviderFailureKind = 'unknown',
  ) {
    super(message);
    this.name = 'GNewsProviderError';

    if (kind === 'bad-request' || kind === 'unavailable') {
      this.kind = 'unknown';
      this.analysisKind = kind;
    } else {
      this.kind = kind;
    }
  }
}

/**
 * MAIN's Analysis-facing failure classifier, reconciled with E's richer
 * provider taxonomy.
 *
 * - Never downgrades an E kind such as `quota`, `timeout`, `unreachable` or
 *   `malformed`.
 * - Recovers Main's deterministic `bad-request` decision for an otherwise
 *   unmapped GNews 4xx by reading the controlled status message.
 * - Converts a genuinely unclassified failure to `unavailable`, which keeps
 *   Main's conservative no-assumption behavior.
 * - Preserves a machine-readable kind on non-GNews providers (for example a
 *   GDELT quota/rate-limit error) rather than flattening it merely because the
 *   error class is different.
 */
export function resolveProviderFailureKind(error: unknown): ProviderFailureKind {
  if (error instanceof GNewsProviderError) {
    if (error.analysisKind) {
      return error.analysisKind;
    }

    if (error.kind !== 'unknown') {
      return error.kind;
    }

    const statusMatch = /status\s+(\d{3})/i.exec(error.message);
    const status = statusMatch ? Number(statusMatch[1]) : undefined;

    if (status !== undefined && status >= 400 && status < 500) {
      return 'bad-request';
    }

    return 'unavailable';
  }

  if (error && typeof error === 'object') {
    const externalKind = (error as { kind?: unknown }).kind;
    if (isProviderFailureKind(externalKind)) {
      return externalKind;
    }
  }

  return 'unavailable';
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

  /**
   * One complete GNews request at a time. The region layer may ask several
   * country questions concurrently; the provider boundary is the one place
   * that knows they all consume the same upstream rate limit.
   */
  private executionChain: Promise<void> = Promise.resolve();
  private cooldownUntil = 0;
  private cooldownKind: 'quota' | 'rate-limited' | undefined;

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

      /*
       * R4 GDELT — REPORT THE THROTTLE WITHOUT INVENTING A HEALTH STATE.
       *
       * `ProviderHealthState` stays 'ok' | 'degraded' | 'down'; no member
       * is added here. What changes is that a quota or rate-limit failure
       * now also sets `rateLimitState: 'throttled'`, which already exists
       * on ProviderHealthStatus and is already carried through
       * AdminNewsService.projectProviderHealth() untouched.
       *
       * So Admin gains a true signal with NO admin contract change and NO
       * frontend change — and, critically, it no longer reads a sentence
       * telling it the API key was rejected when the key is fine.
       *
       * Anything that is not a throttle leaves `rateLimitState` ABSENT
       * rather than setting 'ok'. A failed health check has not shown the
       * provider to be un-throttled; it has shown nothing about throttling
       * at all, and 'ok' would be a measurement nobody took.
       */
      const kind = error instanceof GNewsProviderError ? error.kind : 'unknown';
      const throttled = kind === 'quota' || kind === 'rate-limited';

      return {
        providerId: this.id,
        displayName: this.displayName,
        status: 'degraded',
        message: this.describeError(error),
        checkedAt: new Date().toISOString(),
        ...(throttled ? { rateLimitState: 'throttled' as const } : {}),
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
    return this.runSerialized(async () => {
      if (Date.now() < this.cooldownUntil) {
        throw this.cooldownRefusal();
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      let response: Response;
      try {
        response = await fetch(url, { signal: controller.signal });
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new GNewsProviderError('GNews request timed out.', error, 'timeout');
        }
        throw new GNewsProviderError('Failed to reach GNews.', error, 'unreachable');
      } finally {
        clearTimeout(timeout);
      }

      /*
       * R4 GDELT — 401 AND 403 ARE NOT THE SAME CONDITION, AND CONFLATING
       * THEM MISLED AN OPERATOR DURING A LIVE OUTAGE.
       *
       * 403 is observed as exhausted allowance on the deployed GNews plan;
       * 429 is a shorter rate-limit condition. Both now open a short local
       * circuit so one observed upstream stop signal cannot become a burst.
       */
      if (response.status === 401) {
        throw new GNewsProviderError(
          'GNews rejected the configured API key.',
          undefined,
          'auth',
        );
      }
      if (response.status === 403) {
        this.openCooldown('quota');
        throw new GNewsProviderError(
          'GNews returned 403. On this plan that indicates the request allowance is exhausted; ' +
            'the API key itself is not implicated.',
          undefined,
          'quota',
        );
      }
      if (response.status === 429) {
        this.openCooldown('rate-limited');
        throw new GNewsProviderError(
          'GNews rate limit exceeded. Try again shortly.',
          undefined,
          'rate-limited',
        );
      }
      if (!response.ok) {
        throw new GNewsProviderError(
          `GNews responded with status ${response.status}.`,
          undefined,
          'unknown',
        );
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch (error) {
        throw new GNewsProviderError(
          'GNews returned a malformed (non-JSON) response.',
          error,
          'malformed',
        );
      }

      if (
        !payload ||
        typeof payload !== 'object' ||
        !Array.isArray((payload as GNewsApiResponse).articles)
      ) {
        throw new GNewsProviderError('GNews response did not match the expected shape.');
      }

      return payload as GNewsApiResponse;
    });
  }

  /**
   * Serialises the whole request. The queue releases in finally, so a failure
   * cannot wedge future callers; a caller queued behind a 429/403 observes the
   * newly-opened circuit before it opens another socket.
   */
  private async runSerialized<T>(operation: () => Promise<T>): Promise<T> {
    let release: (() => void) | undefined;
    const previous = this.executionChain;

    this.executionChain = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;

    try {
      return await operation();
    } finally {
      release?.();
    }
  }

  private openCooldown(kind: 'quota' | 'rate-limited'): void {
    this.cooldownUntil = Date.now() + GNEWS_COOLDOWN_MS;
    this.cooldownKind = kind;
  }

  private cooldownRefusal(): GNewsProviderError {
    return this.cooldownKind === 'quota'
      ? new GNewsProviderError(
          'GNews request allowance is exhausted; this provider is in cooldown.',
          undefined,
          'quota',
        )
      : new GNewsProviderError(
          'GNews is in cooldown after a rate-limit response.',
          undefined,
          'rate-limited',
        );
  }

  /**
   * RC-1 / RC-H1 finding H-2 — a provider article WITHOUT a usable publication
   * timestamp is DROPPED HERE, before it can enter the canonical pipeline.
   *
   * The defect this closes: `publishedAt` used to fall back to
   * `new Date().toISOString()`, so an article the provider dated not at all
   * entered the product stamped with the moment we happened to fetch it. Every
   * downstream consumer then treated that fabrication as fact — it sorted as
   * the newest story on the page, it scored a full freshness bonus in
   * article-confidence, and it was persisted into Article.publishedAt as
   * though the outlet had asserted it. An undated article looked like breaking
   * news purely because we looked at it.
   *
   * WHY DROP RATHER THAN WIDEN THE CONTRACT. `NewsArticle.publishedAt` stays a
   * required `string` across the product — widening it to optional would push
   * an absence check into every consumer, and any one of them forgetting would
   * reintroduce a fabricated date somewhere less visible than here. Refusing
   * the record at the provider boundary means the invariant is enforced once,
   * at the only place an untrusted timestamp enters.
   *
   * Dropping is honest and proportionate: the article is not shown, not
   * counted, not persisted, and nothing about it is invented. It is the same
   * treatment a record with no title or no url already receives one line
   * above, for the same reason.
   */
  private normalize(payload: GNewsApiResponse, categoryHint?: NewsCategory): NewsArticle[] {
    const raws = payload.articles ?? [];

    const usable = raws.filter(
      (raw): raw is GNewsApiArticle & { title: string; url: string; publishedAt: string } =>
        Boolean(raw?.title && raw?.url) && isUsablePublicationTimestamp(raw?.publishedAt),
    );

    const dropped = raws.filter((raw) => Boolean(raw?.title && raw?.url)).length - usable.length;
    if (dropped > 0) {
      // A count only. No title, no url, no provider payload — this is an
      // operational signal, not a content log.
      this.logger.warn(
        `Dropped ${dropped} GNews article(s) with a missing or invalid publication timestamp. ` +
          'No publication time was fabricated.',
      );
    }

    return usable.map((raw) => this.toNewsArticle(raw, categoryHint));
  }

  private toNewsArticle(
    raw: GNewsApiArticle & { title: string; url: string; publishedAt: string },
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
      // RC-1 / RC-H1 H-2 — the provider's own value, verbatim. There is no
      // fallback here and there must never be one again: normalize() above
      // has already dropped every record that lacked a parseable timestamp,
      // so this field can only ever carry something the outlet asserted.
      publishedAt: raw.publishedAt,
      // R4 GDELT — GNews reports the OUTLET'S OWN publication time, so
      // every article this provider emits is 'publisher' basis. Stated
      // explicitly rather than left absent: absence means UNPROVEN, and
      // GNews's basis is proven, so leaving it off would needlessly cost
      // identity rung 3 its window for the provider that serves almost
      // all live traffic.
      publishedAtBasis: 'publisher' as const,
      // E1 — provider provenance. The real provider id, verbatim, on
      // every article this class emits, so a merged multi-provider
      // response can always say which provider produced each record.
      //
      // providerRecordId is deliberately NOT set: GNews's article
      // payload carries no identifier of its own distinct from `url`,
      // and `url` is already what buildStableId() derives `id` from.
      // Inventing a second id from the same field would be a
      // fabricated provenance claim, so the field stays absent —
      // honest absence, per NewsArticle.providerRecordId's contract.
      providerId: this.id,
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
