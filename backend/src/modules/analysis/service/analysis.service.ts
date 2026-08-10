import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  normalizeQuery,
  resolveLocationContext,
  resolveCountryByAnyIdentifier,
  type AnalysisApiResponse,
  type AnalysisRetrievalContext,
  type CountryNewsResponse,
  type LocationContext,
  type NewsArticle,
  type NewsResponse,
} from '@globalnews-ai/shared';
import { NewsService } from '../../news/news.service';
import { CountryNewsService } from '../../news/country/country-news.service';
import type { AnalysisProvider } from '../interfaces';
import { ANALYSIS_PROVIDER } from '../providers/provider.tokens';
import { AnalysisConfigService } from '../config/analysis-config.service';
import { clusterDuplicateArticles } from '../duplicates/cluster-articles.util';
import {
  validateAnalysisResult,
  AnalysisValidationError,
} from '../validation/validate-analysis-result';

interface CacheEntry {
  value: AnalysisApiResponse;
  expiresAt: number;
}

/** Number of articles requested before deduping/bounding. */
const SEARCH_POOL_SIZE = 20;

/**
 * Maximum number of words considered after a country-context phrase.
 *
 * This is long enough for names/aliases such as:
 * - United States of America
 * - Democratic Republic of the Congo
 * - United Arab Emirates
 *
 * while remaining deliberately conservative.
 */
const MAX_COUNTRY_CANDIDATE_WORDS = 6;

/**
 * Words that commonly introduce an explicit geographic subject.
 *
 * We intentionally avoid scanning every word in arbitrary questions
 * for country names because names such as Georgia, Jordan, Chad, and
 * Turkey can also appear in non-country contexts.
 */
const COUNTRY_CONTEXT_PATTERN =
  /\b(?:in|from|about|across|inside|within)\s+(.+)$/i;

/**
 * Matches standalone ALL-CAPS 2-3 letter tokens (e.g. "USA", "UK",
 * "UAE") anywhere in a query, with no preceding preposition required.
 *
 * This is deliberately restricted to ISO-style codes, not country
 * *names*. Ordinary English prose essentially never spells a common
 * word in full caps mid-sentence, so an exact, case-sensitive match
 * against a real ISO alpha-2/alpha-3 code is a strong, low-ambiguity
 * signal on its own. Country names get no equivalent ungated
 * treatment: several real country names (Georgia, Turkey, Chad,
 * Jordan) are also common nouns/proper nouns in unrelated contexts,
 * so those stay behind the preposition-gated scan below.
 */
const ALL_CAPS_CODE_TOKEN_PATTERN = /\b[A-Z]{2,3}\b/g;

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(
    AnalysisService.name,
  );

  /**
   * Simple in-memory cache (query -> response), per Sprint 5.1's cost
   * controls: don't re-analyze the same query on every render. No
   * database — this is intentionally process-local and lost on
   * restart, which is fine for a development-stage cache.
   */
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly newsService: NewsService,
    private readonly countryNewsService: CountryNewsService,

    @Inject(ANALYSIS_PROVIDER)
    private readonly provider: AnalysisProvider,

    private readonly analysisConfig: AnalysisConfigService,
  ) {}

  async analyzeNews(
    rawQuery: string,
  ): Promise<AnalysisApiResponse> {
    const config = this.analysisConfig.get();

    /**
     * originalQuery is preserved verbatim for display (AnalysisApiResponse.query)
     * — never silently rewritten. normalizedQuery drives caching,
     * country/city detection, the non-country retrieval fallback, and
     * the text handed to the AI provider. See query-normalization.ts
     * for exactly what normalization does (and deliberately does not
     * do — no fuzzy/spelling correction, ever).
     */
    const { originalQuery, normalizedQuery } =
      normalizeQuery(rawQuery);

    const cacheKey = normalizedQuery.toLowerCase();

    const cached = this.getCached(cacheKey);

    if (cached) {
      this.logger.debug(
        `Serving cached analysis for "${originalQuery}"`,
      );

      /**
       * The cached response's `query`/`normalizedQuery` reflect
       * whichever request first populated this cache entry.
       * Retrieval/AI results are safely shared across
       * normalized-equivalent requests (that's the point of keying
       * the cache on normalizedQuery), but the response envelope must
       * always reflect *this* request's own raw and normalized query
       * — never a previous caller's. Overriding these two fields here
       * is a plain object spread; it does not touch `analysis`,
       * `articles`, or `retrievalContext`, so no retrieval or AI work
       * is repeated. The nested `analysis.query` (set at generation
       * time from the normalized query used for analysis) is
       * intentionally left as-is.
       */
      return {
        ...cached,
        query: originalQuery,
        normalizedQuery,
      };
    }

    const location = this.detectLocation(normalizedQuery);

    let articles: NewsArticle[];
    let retrievalContext: AnalysisRetrievalContext;

    if (location) {
      const { country, city } = location;

      this.logger.debug(
        city
          ? `Detected city-aware analysis query for ${city} (${country.name}, ${country.iso3})`
          : `Detected country-aware analysis query for ${country.name} (${country.iso3})`,
      );

      const countryResponse =
        await this.countryNewsService.getCountryNews(
          country.iso3,
          undefined,
          SEARCH_POOL_SIZE,
          city,
        );

      articles = countryResponse.articles;
      retrievalContext = this.toRetrievalContext(
        countryResponse,
      );
    } else {
      const searchResponse =
        await this.newsService.search(
          normalizedQuery,
          SEARCH_POOL_SIZE,
        );

      articles = searchResponse.articles;
      retrievalContext = this.toRetrievalContext(
        searchResponse,
      );
    }

    if (articles.length === 0) {
      const empty: AnalysisApiResponse = {
        query: originalQuery,
        normalizedQuery,
        analysis: null,
        articles: [],
        analysisError:
          'No related articles were found for this question.',
        retrievalContext,
      };

      // Empty results are still cached briefly to avoid hammering the
      // news provider with the exact same fruitless query repeatedly.
      this.setCached(
        cacheKey,
        empty,
        config.cacheTtlSeconds,
      );

      return empty;
    }

    const deduped = clusterDuplicateArticles(
      articles,
    ).slice(0, config.maxArticles);

    let response: AnalysisApiResponse;

    try {
      const candidate =
        await this.provider.analyzeNews({
          query: normalizedQuery,
          articles: deduped,
        });

      const analysis = validateAnalysisResult(
        candidate,
        {
          query: normalizedQuery,
          articles: deduped,
          analysisMode: this.provider.isMock
            ? 'mock-ai'
            : 'live-ai',
        },
      );

      response = {
        query: originalQuery,
        normalizedQuery,
        analysis,
        articles: deduped,
        retrievalContext,
      };
    } catch (error) {
      this.logger.warn(
        `Analysis provider "${this.provider.id}" failed for query "${originalQuery}"`,
        error instanceof Error
          ? error
          : undefined,
      );

      response = {
        query: originalQuery,
        normalizedQuery,
        analysis: null,
        articles: deduped,
        analysisError:
          this.describeError(error),
        retrievalContext,
      };
    }

    this.setCached(
      cacheKey,
      response,
      config.cacheTtlSeconds,
    );

    return response;
  }

  /**
   * Builds the retrieval provenance object from whichever response
   * envelope was used (generic NewsResponse or country-aware
   * CountryNewsResponse). Only fields that actually exist on the
   * source envelope are populated — nothing is inferred or invented
   * for retrieval paths that don't reliably expose it (e.g. generic
   * NewsResponse has no newestArticlePublishedAt).
   */
  private toRetrievalContext(
    source: NewsResponse | CountryNewsResponse,
  ): AnalysisRetrievalContext {
    const isCountryResponse =
      'countryCode' in source;

    return {
      dataMode: source.dataMode,
      providers: source.providers,
      fallbackReason: source.fallbackReason,
      newestArticlePublishedAt:
        isCountryResponse
          ? source.newestArticlePublishedAt
          : undefined,
      countryCode: isCountryResponse
        ? source.countryCode
        : undefined,
      countryName: isCountryResponse
        ? source.countryName
        : undefined,
      providerDisplayName:
        isCountryResponse
          ? source.providerDisplayName
          : undefined,
      articlesRetrieved:
        source.articles.length,
      city: isCountryResponse
        ? source.city
        : undefined,
    };
  }

  /**
   * Resolves a country, and — when the match came from a curated city
   * rather than the country name itself — the matched city, from a
   * free-text query.
   *
   * This preserves the exact matching order the previous
   * country-only detectCountry() used: a direct
   * name/code/alias match, then an ungated ISO-style code scan, then
   * a preposition-gated word-shrinking scan. City resolution is only
   * ever attempted at the same single point it always was (the
   * word-shrinking scan, via resolveLocationContext), so no existing
   * country-only match changes.
   */
  private detectLocation(
    query: string,
  ): LocationContext | undefined {
    const normalized = query
      .trim()
      .replace(/[?!.,;:]+$/g, '');

    if (!normalized) {
      return undefined;
    }

    /**
     * Allow a query that is itself simply a country name/code/alias.
     *
     * Examples:
     * - Spain
     * - ESP
     * - Britain
     * - DR Congo
     */
    const direct =
      resolveCountryByAnyIdentifier(
        normalized,
      );

    if (direct) {
      return { country: direct };
    }

    /**
     * Allow a natural-language query that embeds an explicit ISO-style
     * code with no preposition, e.g. "is USA under pressure of war?".
     * See ALL_CAPS_CODE_TOKEN_PATTERN for why this is safe to leave
     * ungated while country names are not.
     */
    const codeMatches = normalized.match(
      ALL_CAPS_CODE_TOKEN_PATTERN,
    );

    if (codeMatches) {
      for (const code of codeMatches) {
        const country =
          resolveCountryByAnyIdentifier(code);

        if (country) {
          return { country };
        }
      }
    }

    /**
     * For natural-language questions, require explicit geographic
     * context such as "in Spain" or "from Rwanda".
     */
    const contextMatch =
      normalized.match(
        COUNTRY_CONTEXT_PATTERN,
      );

    if (!contextMatch) {
      return undefined;
    }

    const candidateText =
      contextMatch[1].trim();

    if (!candidateText) {
      return undefined;
    }

    const words =
      candidateText.split(/\s+/);

    const maxWords = Math.min(
      words.length,
      MAX_COUNTRY_CANDIDATE_WORDS,
    );

    /**
     * Try the longest candidate first.
     *
     * Example:
     * "in the United States today"
     *
     * progressively checks:
     * "the United States today"
     * "the United States"
     * ...
     *
     * and similarly handles aliases such as "DR Congo", and curated
     * cities such as "Kigali" (see resolveLocationContext).
     */
    for (
      let length = maxWords;
      length >= 1;
      length -= 1
    ) {
      const candidate = words
        .slice(0, length)
        .join(' ')
        .replace(/^(?:the)\s+/i, '')
        .trim();

      const location =
        resolveLocationContext(candidate);

      if (location) {
        return location;
      }
    }

    return undefined;
  }

  private describeError(
    error: unknown,
  ): string {
    if (
      error instanceof
      AnalysisValidationError
    ) {
      return 'The AI analysis response was invalid and could not be shown. The underlying articles are still available below.';
    }

    if (error instanceof Error) {
      return `AI analysis is temporarily unavailable (${error.message}). The underlying articles are still available below.`;
    }

    return 'AI analysis is temporarily unavailable. The underlying articles are still available below.';
  }

  private getCached(
    key: string,
  ): AnalysisApiResponse | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  private setCached(
    key: string,
    value: AnalysisApiResponse,
    ttlSeconds: number,
  ): void {
    if (ttlSeconds <= 0) {
      return;
    }

    this.cache.set(key, {
      value,
      expiresAt:
        Date.now() +
        ttlSeconds * 1000,
    });
  }
}