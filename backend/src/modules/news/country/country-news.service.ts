import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  resolveCountryByAnyIdentifier,
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
import { scoreCountryRelevance } from './country-relevance.util';

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

    const cacheKey = `${country.iso3}:${category ?? 'all'}:${resolvedLimit}`;
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
        country.name,
        fetchLimit,
      );
    } catch (error) {
      this.logger.warn(
        `Live country news provider failed for ${country.iso3}; attempting database fallback`,
        error instanceof Error ? error : undefined,
      );

      const storedArticles =
        await this.articlePersistence.findRecentByCountry({
          countryCode: country.iso3,
          category,
          limit: resolvedLimit,
          maxAgeMinutes:
            DATABASE_FALLBACK_MAX_AGE_MINUTES,
          relevantOnly: true,
        });

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
      }))
      .sort((left, right) => {
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
      const storedArticles =
        await this.articlePersistence.findRecentByCountry({
          countryCode: country.iso3,
          category,
          limit: resolvedLimit,
          maxAgeMinutes:
            DATABASE_FALLBACK_MAX_AGE_MINUTES,
          relevantOnly: true,
        });

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
          fallbackReason: 'no-live-results',
          newestArticlePublishedAt:
            this.getNewestArticlePublishedAt(
              storedArticles,
            ),
          category,
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
      category,
      generatedAt: new Date().toISOString(),
    };

    this.setCached(cacheKey, response);

    return response;
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