import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  resolveCountryByAnyIdentifier,
  type CountryNewsResponse,
  type NewsCategory,
  type NewsDataMode,
  type NewsFeedTier,
} from '@globalnews-ai/shared';
import { NewsService } from '../news.service';
import { scoreArticleConfidence } from '../analysis/article-confidence.util';
import { deduplicateArticles } from './deduplicate-articles.util';
import { scoreCountryRelevance } from './country-relevance.util';

interface CacheEntry {
  value: CountryNewsResponse;
  expiresAt: number;
}

const DEFAULT_LIMIT = 8;
const DEFAULT_CACHE_TTL_SECONDS = 300;

@Injectable()
export class CountryNewsService {
  private readonly logger = new Logger(CountryNewsService.name);
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly newsService: NewsService,
    private readonly config: ConfigService,
  ) {}

  async getCountryNews(
    countryIdentifier: string,
    category?: NewsCategory,
    limit?: number,
  ): Promise<CountryNewsResponse> {
    const resolvedLimit = this.clampLimit(limit);
    const country = resolveCountryByAnyIdentifier(countryIdentifier);

    if (!country) {
      this.logger.debug(`Could not resolve country identifier "${countryIdentifier}"`);

      throw new BadRequestException(`Unknown country identifier: "${countryIdentifier}"`);
    }

    const cacheKey = `${country.iso3}:${category ?? 'all'}:${resolvedLimit}`;
    const cached = this.getCached(cacheKey);

    if (cached) {
      this.logger.debug(`Serving cached country news for ${country.iso3}`);
      return cached;
    }

    const fetchLimit = Math.max(resolvedLimit * 2, 20);

    const searchResponse = await this.newsService.search(country.name, fetchLimit);

    // Score every result for country relevance and freshness-adjusted
    // confidence. Relevance is a *ranking/confidence signal*, not a hard
    // inclusion gate: a targeted per-country search can legitimately return
    // articles that discuss the country without repeating its exact
    // name/ISO code, and dropping those outright would silently empty out
    // otherwise-correct results.
    const scoredArticles = searchResponse.articles
      .map((article) => ({
        article,
        relevance: scoreCountryRelevance(article, country),
      }))
      .sort((left, right) => {
        const scoreDifference = right.relevance.score - left.relevance.score;

        if (scoreDifference !== 0) {
          return scoreDifference;
        }

        const rightPublishedAt = Date.parse(right.article.publishedAt);
        const leftPublishedAt = Date.parse(left.article.publishedAt);

        return rightPublishedAt - leftPublishedAt;
      })
      .map(({ article, relevance }) => ({
        ...article,
        confidence: scoreArticleConfidence(article, relevance.score).confidence,
      }));

    // Filter by the requested category first, then deduplicate only within
    // that already-scoped set. Deduplicating across the full, unfiltered
    // result set first would let articles from *other* categories in the
    // same provider response affect which article survives for this
    // category — letting two category-specific requests bleed into each
    // other despite each having its own cache key.
    const categoryFilteredArticles = category
      ? scoredArticles.filter((article) => article.category === category)
      : scoredArticles;

    const articles = deduplicateArticles(categoryFilteredArticles);

    const bounded = articles.slice(0, resolvedLimit);

    const { feedTier, providerDisplayName } = this.describeFeed(
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

  private describeFeed(
    providerIds: string[],
    dataMode: NewsDataMode,
  ): { feedTier: NewsFeedTier; providerDisplayName: string } {
    if (dataMode === 'mock') {
      return {
        feedTier: 'delayed',
        providerDisplayName: 'Mock',
      };
    }

    const activeProviderId = providerIds[0];

    if (activeProviderId === 'gnews') {
      const configuredTier = this.config.get<string>('GNEWS_FEED_TIER');

      const feedTier: NewsFeedTier = configuredTier === 'live' ? 'live' : 'delayed';

      const providerDisplayName =
        this.config.get<string>('GNEWS_PROVIDER_DISPLAY_NAME') || 'GNews Free';

      return {
        feedTier,
        providerDisplayName,
      };
    }

    return {
      feedTier: 'live',
      providerDisplayName: activeProviderId ? this.titleCase(activeProviderId) : 'Live provider',
    };
  }

  private titleCase(value: string): string {
    return value
      .split(/[\s-]+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private clampLimit(requested: number | undefined): number {
    if (!requested || requested < 1) return DEFAULT_LIMIT;
    return Math.min(requested, 30);
  }

  private getCacheTtlSeconds(): number {
    const raw = this.config.get<string>('COUNTRY_NEWS_CACHE_TTL_SECONDS');
    const parsed = raw ? parseInt(raw, 10) : NaN;

    return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_CACHE_TTL_SECONDS;
  }

  private getCached(key: string): CountryNewsResponse | null {
    const entry = this.cache.get(key);

    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  private setCached(key: string, value: CountryNewsResponse): void {
    const ttlSeconds = this.getCacheTtlSeconds();

    if (ttlSeconds <= 0) return;

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }
}
