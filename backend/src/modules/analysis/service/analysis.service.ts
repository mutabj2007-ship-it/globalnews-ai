import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  resolveCountryByAnyIdentifier,
  type AnalysisApiResponse,
  type CountryMeta,
  type NewsArticle,
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
    query: string,
  ): Promise<AnalysisApiResponse> {
    const config = this.analysisConfig.get();
    const cacheKey = query.trim().toLowerCase();

    const cached = this.getCached(cacheKey);

    if (cached) {
      this.logger.debug(
        `Serving cached analysis for "${query}"`,
      );

      return cached;
    }

    const country = this.detectCountry(query);

    let articles: NewsArticle[];

    if (country) {
      this.logger.debug(
        `Detected country-aware analysis query for ${country.name} (${country.iso3})`,
      );

      const countryResponse =
        await this.countryNewsService.getCountryNews(
          country.iso3,
          undefined,
          SEARCH_POOL_SIZE,
        );

      articles = countryResponse.articles;
    } else {
      const searchResponse =
        await this.newsService.search(
          query,
          SEARCH_POOL_SIZE,
        );

      articles = searchResponse.articles;
    }

    if (articles.length === 0) {
      const empty: AnalysisApiResponse = {
        query,
        analysis: null,
        articles: [],
        analysisError:
          'No related articles were found for this question.',
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
          query,
          articles: deduped,
        });

      const analysis = validateAnalysisResult(
        candidate,
        {
          query,
          articles: deduped,
          analysisMode: this.provider.isMock
            ? 'mock-ai'
            : 'live-ai',
        },
      );

      response = {
        query,
        analysis,
        articles: deduped,
      };
    } catch (error) {
      this.logger.warn(
        `Analysis provider "${this.provider.id}" failed for query "${query}"`,
        error instanceof Error
          ? error
          : undefined,
      );

      response = {
        query,
        analysis: null,
        articles: deduped,
        analysisError:
          this.describeError(error),
      };
    }

    this.setCached(
      cacheKey,
      response,
      config.cacheTtlSeconds,
    );

    return response;
  }

  private detectCountry(
    query: string,
  ): CountryMeta | undefined {
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
      return direct;
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
     * and similarly handles aliases such as "DR Congo".
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

      const country =
        resolveCountryByAnyIdentifier(
          candidate,
        );

      if (country) {
        return country;
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