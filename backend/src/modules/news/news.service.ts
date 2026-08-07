import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
  NewsArticle,
  NewsCategory,
  NewsResponse,
  ProviderHealthStatus,
} from '@globalnews-ai/shared';
import type { NewsProvider } from './interfaces';
import {
  ALL_NEWS_PROVIDERS,
  NEWS_PROVIDERS,
} from './providers/provider.tokens';
import { ArticlePersistenceService } from './persistence/article-persistence.service';

const DATABASE_FALLBACK_MAX_AGE_MINUTES = 1440;

@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);

  constructor(
    @Inject(NEWS_PROVIDERS)
    private readonly providers: NewsProvider[],

    @Inject(ALL_NEWS_PROVIDERS)
    private readonly allProviders: NewsProvider[],

    private readonly articlePersistence: ArticlePersistenceService,
  ) {}

  async search(
    query: string,
    limit?: number,
  ): Promise<NewsResponse> {
    const results = await this.callAllProviders((provider) =>
      provider.search(query, { limit }),
    );

    const response = this.buildResponse(
      results,
      limit,
      { query },
      { sortByRecency: true },
    );

    if (response.articles.length > 0) {
      if (response.dataMode === 'live') {
        await this.articlePersistence.persistMany(response.articles);
      }

      return response;
    }

    if (!this.hasRealProviderConfigured()) {
      return response;
    }

    const cachedArticles = await this.articlePersistence.findRecent({
      query,
      limit,
      maxAgeMinutes: DATABASE_FALLBACK_MAX_AGE_MINUTES,
    });

    if (cachedArticles.length === 0) {
      return response;
    }

    return this.buildCachedResponse(
      cachedArticles,
      limit,
      { query },
    );
  }

  async topHeadlines(
    limit?: number,
  ): Promise<NewsResponse> {
    const results = await this.callAllProviders((provider) =>
      provider.topHeadlines({ limit }),
    );

    const response = this.buildResponse(
      results,
      limit,
      {},
      { sortByRecency: false },
    );

    if (response.articles.length > 0) {
      if (response.dataMode === 'live') {
        await this.articlePersistence.persistMany(response.articles);
      }

      return response;
    }

    if (!this.hasRealProviderConfigured()) {
      return response;
    }

    const cachedArticles = await this.articlePersistence.findRecent({
      limit,
      maxAgeMinutes: DATABASE_FALLBACK_MAX_AGE_MINUTES,
    });

    if (cachedArticles.length === 0) {
      return response;
    }

    return this.buildCachedResponse(
      cachedArticles,
      limit,
    );
  }

  async byCategory(
    category: NewsCategory,
    limit?: number,
  ): Promise<NewsResponse> {
    const results = await this.callAllProviders((provider) =>
      provider.category(category, { limit }),
    );

    const response = this.buildResponse(
      results,
      limit,
      { category },
      { sortByRecency: true },
    );

    if (response.articles.length > 0) {
      if (response.dataMode === 'live') {
        await this.articlePersistence.persistMany(response.articles);
      }

      return response;
    }

    if (!this.hasRealProviderConfigured()) {
      return response;
    }

    const cachedArticles = await this.articlePersistence.findRecent({
      category,
      limit,
      maxAgeMinutes: DATABASE_FALLBACK_MAX_AGE_MINUTES,
    });

    if (cachedArticles.length === 0) {
      return response;
    }

    return this.buildCachedResponse(
      cachedArticles,
      limit,
      { category },
    );
  }

  async providersHealth(): Promise<ProviderHealthStatus[]> {
    return Promise.all(
      this.allProviders.map(async (provider) => {
        try {
          return await provider.health();
        } catch (error) {
          this.logger.warn(
            `Health check failed for provider "${provider.id}"`,
            error as Error,
          );

          return {
            providerId: provider.id,
            displayName: provider.displayName,
            status: 'down' as const,
            message:
              error instanceof Error
                ? error.message
                : 'Unknown error',
            checkedAt: new Date().toISOString(),
          };
        }
      }),
    );
  }

  private async callAllProviders(
    operation: (provider: NewsProvider) => Promise<NewsArticle[]>,
  ): Promise<
    Array<{
      providerId: string;
      articles: NewsArticle[];
    }>
  > {
    const settled = await Promise.allSettled(
      this.providers.map(async (provider) => ({
        providerId: provider.id,
        articles: await operation(provider),
      })),
    );

    const fulfilled: Array<{
      providerId: string;
      articles: NewsArticle[];
    }> = [];

    settled.forEach((result, index) => {
      const provider = this.providers[index];

      if (result.status === 'fulfilled') {
        fulfilled.push(result.value);
      } else {
        this.logger.warn(
          `Provider "${provider.id}" failed to respond`,
          result.reason as Error,
        );
      }
    });

    return fulfilled;
  }

  private buildResponse(
    results: Array<{
      providerId: string;
      articles: NewsArticle[];
    }>,
    limit: number | undefined,
    extra: Partial<
      Pick<NewsResponse, 'query' | 'category'>
    > = {},
    { sortByRecency }: { sortByRecency: boolean } = {
      sortByRecency: true,
    },
  ): NewsResponse {
    const seen = new Set<string>();
    const merged: NewsArticle[] = [];

    for (const { articles } of results) {
      for (const article of articles) {
        if (seen.has(article.id)) {
          continue;
        }

        seen.add(article.id);
        merged.push(article);
      }
    }

    if (sortByRecency) {
      merged.sort(
        (a, b) =>
          new Date(b.publishedAt).getTime() -
          new Date(a.publishedAt).getTime(),
      );
    }

    const capped = limit
      ? merged.slice(0, limit)
      : merged;

    return {
      articles: capped,
      totalResults: capped.length,
      providers: results.map(
        (result) => result.providerId,
      ),
      dataMode: this.resolveDataMode(
        results.map((result) => result.providerId),
      ),
      generatedAt: new Date().toISOString(),
      ...extra,
    };
  }

  private buildCachedResponse(
    articles: NewsArticle[],
    limit: number | undefined,
    extra: Partial<
      Pick<NewsResponse, 'query' | 'category'>
    > = {},
  ): NewsResponse {
    const capped = limit
      ? articles.slice(0, limit)
      : articles;

    return {
      articles: capped,
      totalResults: capped.length,
      providers: [],
      dataMode: 'cached',
      generatedAt: new Date().toISOString(),
      ...extra,
    };
  }

  private hasRealProviderConfigured(): boolean {
    return this.providers.some(
      (provider) => !provider.isMock,
    );
  }

  private resolveDataMode(
    successfulProviderIds: string[],
  ): NewsResponse['dataMode'] {
    const successfulProviders = this.providers.filter(
      (provider) =>
        successfulProviderIds.includes(provider.id),
    );

    if (successfulProviders.length > 0) {
      return successfulProviders.some(
        (provider) => !provider.isMock,
      )
        ? 'live'
        : 'mock';
    }

    return this.providers.every(
      (provider) => provider.isMock,
    )
      ? 'mock'
      : 'live';
  }
}