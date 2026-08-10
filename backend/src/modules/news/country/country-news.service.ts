import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  resolveCountryByAnyIdentifier,
  type CountryMeta,
  type CountryNewsResponse,
  type NewsArticle,
  type NewsCategory,
  type NewsDataMode,
  type NewsFeedTier,
} from '@globalnews-ai/shared';
import { NewsService } from '../news.service';
import { scoreArticleConfidence } from '../analysis/article-confidence.util';
import { ArticlePersistenceService } from '../persistence/article-persistence.service';
import { deduplicateArticles } from './deduplicate-articles.util';
import { articleMentionsCity, scoreCountryRelevance } from './country-relevance.util';

interface CacheEntry {
  value: CountryNewsResponse;
  expiresAt: number;
}

const DEFAULT_LIMIT = 8;
const DEFAULT_CACHE_TTL_SECONDS = 300;
const DATABASE_FALLBACK_MAX_AGE_MINUTES = 1440;

@Injectable()
export class CountryNewsService {
  private readonly logger = new Logger(CountryNewsService.name);
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly newsService: NewsService,
    private readonly config: ConfigService,
    private readonly articlePersistence: ArticlePersistenceService,
  ) {}

  async getCountryNews(
    countryIdentifier: string,
    category?: NewsCategory,
    limit?: number,
    city?: string,
  ): Promise<CountryNewsResponse> {
    const resolvedLimit = this.clampLimit(limit);
    const country = resolveCountryByAnyIdentifier(countryIdentifier);

    if (!country) {
      this.logger.debug(
        `Could not resolve country identifier "${countryIdentifier}"`,
      );

      throw new BadRequestException(
        `Unknown country identifier: "${countryIdentifier}"`,
      );
    }

    const cacheKey = `${country.iso3}:${category ?? 'all'}:${resolvedLimit}:${city ?? 'all'}`;
    const cached = this.getCached(cacheKey);

    if (cached) {
      this.logger.debug(
        `Serving cached country news for ${country.iso3}`,
      );

      return cached;
    }

    const fetchLimit = Math.max(resolvedLimit * 2, 20);

    let searchResponse;

    try {
      searchResponse = await this.newsService.search(
        this.buildSearchTerm(country, city),
        fetchLimit,
      );
    } catch (error) {
      this.logger.warn(
        `Live country news provider failed for ${country.iso3}; attempting database fallback`,
        error instanceof Error ? error : undefined,
      );

      const storedArticles = await this.getStoredArticles(
        country,
        category,
        resolvedLimit,
        city,
      );

      if (storedArticles.length > 0) {
        const response: CountryNewsResponse = {
          countryCode: country.iso3,
          countryName: country.name,
          articles: storedArticles,
          totalResults: storedArticles.length,
          providers: [],
          dataMode: 'cached',
          feedTier: 'delayed',
          providerDisplayName: 'Stored reporting',
          fallbackReason: 'provider-error',
          newestArticlePublishedAt:
            this.getNewestArticlePublishedAt(
              storedArticles,
            ),
          category,
          ...(city ? { city } : {}),
          generatedAt: new Date().toISOString(),
        };

        this.setCached(cacheKey, response);

        return response;
      }

      throw error;
    }

    const scoredEntries = searchResponse.articles
      .map((article) => ({
        article,
        relevance: scoreCountryRelevance(article, country),
        matchesCity: city
          ? articleMentionsCity(article, city)
          : false,
      }))
      .sort((left, right) => {
        if (left.matchesCity !== right.matchesCity) {
          return left.matchesCity ? -1 : 1;
        }

        const scoreDifference =
          right.relevance.score - left.relevance.score;

        if (scoreDifference !== 0) {
          return scoreDifference;
        }

        const rightPublishedAt = Date.parse(
          right.article.publishedAt,
        );

        const leftPublishedAt = Date.parse(
          left.article.publishedAt,
        );

        return rightPublishedAt - leftPublishedAt;
      });

    if (searchResponse.dataMode === 'live') {
      await this.articlePersistence.persistCountryRelations(
        scoredEntries.map(({ article, relevance }) => ({
          articleId: article.id,
          countryCode: country.iso3,
          countryName: country.name,
          relevanceScore: relevance.score,
          isRelevant: relevance.isRelevant,
        })),
      );
    }

    const scoredArticles = scoredEntries.map(
      ({ article, relevance }) => ({
        ...article,
        confidence: scoreArticleConfidence(
          article,
          relevance.score,
        ).confidence,
      }),
    );

    const categoryFilteredArticles = category
      ? scoredArticles.filter(
          (article) => article.category === category,
        )
      : scoredArticles;

    const articles = deduplicateArticles(
      categoryFilteredArticles,
    );

    const bounded = articles.slice(0, resolvedLimit);

    if (bounded.length === 0) {
      const storedArticles = await this.getStoredArticles(
        country,
        category,
        resolvedLimit,
        city,
      );

      if (storedArticles.length > 0) {
        const response: CountryNewsResponse = {
          countryCode: country.iso3,
          countryName: country.name,
          articles: storedArticles,
          totalResults: storedArticles.length,
          providers: [],
          dataMode: 'cached',
          feedTier: 'delayed',
          providerDisplayName: 'Stored reporting',
          fallbackReason:
            searchResponse.fallbackReason ??
            'no-live-results',
          newestArticlePublishedAt:
            this.getNewestArticlePublishedAt(
              storedArticles,
            ),
          category,
          ...(city ? { city } : {}),
          generatedAt: new Date().toISOString(),
        };

        this.setCached(cacheKey, response);

        return response;
      }
    }

    const { feedTier, providerDisplayName } =
      this.describeFeed(
        searchResponse.providers,
        searchResponse.dataMode,
      );

    const response: CountryNewsResponse = {
      countryCode: country.iso3,
      countryName: country.name,
      articles: bounded,
      totalResults: bounded.length,
      providers: searchResponse.providers,
      dataMode: searchResponse.dataMode,
      feedTier,
      providerDisplayName,
      ...(searchResponse.dataMode === 'cached' ||
      searchResponse.dataMode === 'unavailable'
  ? {
      fallbackReason:
        searchResponse.fallbackReason,
      newestArticlePublishedAt:
        searchResponse.fallbackReason
          ? this.getNewestArticlePublishedAt(
              bounded,
            )
          : undefined,
    }
  : {}),
      category,
      ...(city ? { city } : {}),
      generatedAt: new Date().toISOString(),
    };

    this.setCached(cacheKey, response);

    return response;
  }

  /**
   * Builds the term sent to the underlying news provider. When a
   * curated city is present, the city is combined with the country
   * name (e.g. "kigali Rwanda") rather than replacing it — this keeps
   * the request grounded in the country while giving the provider a
   * chance to surface city-specific stories. MockNewsProvider matches
   * on an OR of tokens, so this is guaranteed not to over-filter in
   * mock/dev/test mode; live provider (GNews) semantics for a
   * multi-word query are outside this codebase's control and worth a
   * one-time manual check in staging, but nothing here depends on a
   * particular interpretation — the city-first sort below re-ranks
   * whatever comes back regardless.
   */
  private buildSearchTerm(
    country: CountryMeta,
    city: string | undefined,
  ): string {
    return city ? `${city} ${country.name}` : country.name;
  }

  /**
   * Reads stored/cached articles for a country, preferring
   * city-specific stored reporting when a city is present, with the
   * normal country-wide stored reporting as fallback fill.
   *
   * This does not require any database schema change: the
   * articleCountry table (queried via findRecentByCountry) has no
   * per-city column, so city-specific stored articles are instead
   * found via the generic, country-agnostic full-text search already
   * exposed by findRecent (title/summary/sourceName contains `city`).
   * Because that lookup isn't scoped to a country, each hit is
   * re-checked with a freshly-computed scoreCountryRelevance(...).
   * isRelevant before being trusted, to reject unrelated same-name
   * matches (e.g. a business named after the city, in an unrelated
   * country). City-matching results are placed first so the
   * order-preserving deduplicateArticles keeps them over any
   * duplicate found in the country-wide pool.
   *
   * Known, deliberate limitation: a stored article that genuinely is
   * about the city but never mentions the country by name (e.g. a
   * purely locally-datelined story) can fail that relevance re-check
   * and be excluded from this stored-fallback pool specifically. This
   * does not affect the live retrieval path above, which never
   * filters by isRelevant — only the rarer cached/database-fallback
   * path is affected.
   */
  private async getStoredArticles(
    country: CountryMeta,
    category: NewsCategory | undefined,
    limit: number,
    city: string | undefined,
  ): Promise<NewsArticle[]> {
    const countryStored =
      await this.articlePersistence.findRecentByCountry({
        countryCode: country.iso3,
        category,
        limit,
        maxAgeMinutes: DATABASE_FALLBACK_MAX_AGE_MINUTES,
        relevantOnly: true,
      });

    if (!city) {
      return countryStored;
    }

    const cityStoredCandidates =
      await this.articlePersistence.findRecent({
        query: city,
        category,
        limit,
        maxAgeMinutes: DATABASE_FALLBACK_MAX_AGE_MINUTES,
      });

    const cityStored = cityStoredCandidates.filter(
      (article) =>
        scoreCountryRelevance(article, country).isRelevant,
    );

    return deduplicateArticles([
      ...cityStored,
      ...countryStored,
    ]).slice(0, limit);
  }

  private getNewestArticlePublishedAt(
    articles: NewsArticle[],
  ): string | undefined {
    let newestTimestamp = Number.NEGATIVE_INFINITY;

    for (const article of articles) {
      const timestamp = Date.parse(
        article.publishedAt,
      );

      if (
        Number.isFinite(timestamp) &&
        timestamp > newestTimestamp
      ) {
        newestTimestamp = timestamp;
      }
    }

    if (!Number.isFinite(newestTimestamp)) {
      return undefined;
    }

    return new Date(
      newestTimestamp,
    ).toISOString();
  }

  private describeFeed(
    providerIds: string[],
    dataMode: NewsDataMode,
  ): {
    feedTier: NewsFeedTier;
    providerDisplayName: string;
  } {
    if (dataMode === 'mock') {
      return {
        feedTier: 'delayed',
        providerDisplayName: 'Mock',
      };
    }

    if (dataMode === 'cached') {
      return {
        feedTier: 'delayed',
        providerDisplayName: 'Stored reporting',
      };
    }

    if (dataMode === 'unavailable') {
      return {
        feedTier: 'delayed',
        providerDisplayName: 'Unavailable',
      };
    }

    const activeProviderId = providerIds[0];

    if (activeProviderId === 'gnews') {
      const configuredTier =
        this.config.get<string>('GNEWS_FEED_TIER');

      const feedTier: NewsFeedTier =
        configuredTier === 'live'
          ? 'live'
          : 'delayed';

      const providerDisplayName =
        this.config.get<string>(
          'GNEWS_PROVIDER_DISPLAY_NAME',
        ) || 'GNews Free';

      return {
        feedTier,
        providerDisplayName,
      };
    }

    return {
      feedTier: 'live',
      providerDisplayName: activeProviderId
        ? this.titleCase(activeProviderId)
        : 'Live provider',
    };
  }

  private titleCase(value: string): string {
    return value
      .split(/[\s-]+/)
      .filter(Boolean)
      .map(
        (word) =>
          word.charAt(0).toUpperCase() +
          word.slice(1).toLowerCase(),
      )
      .join(' ');
  }

  private clampLimit(
    requested: number | undefined,
  ): number {
    if (!requested || requested < 1) {
      return DEFAULT_LIMIT;
    }

    return Math.min(requested, 30);
  }

  private getCacheTtlSeconds(): number {
    const raw = this.config.get<string>(
      'COUNTRY_NEWS_CACHE_TTL_SECONDS',
    );

    const parsed = raw
      ? parseInt(raw, 10)
      : NaN;

    return Number.isFinite(parsed) && parsed >= 0
      ? parsed
      : DEFAULT_CACHE_TTL_SECONDS;
  }

  private getCached(
    key: string,
  ): CountryNewsResponse | null {
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
    value: CountryNewsResponse,
  ): void {
    const ttlSeconds =
      this.getCacheTtlSeconds();

    if (ttlSeconds <= 0) {
      return;
    }

    this.cache.set(key, {
      value,
      expiresAt:
        Date.now() + ttlSeconds * 1000,
    });
  }
}
