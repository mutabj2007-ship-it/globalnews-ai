import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
  NewsArticle,
  NewsCategory,
  NewsResponse,
  ProviderHealthStatus,
} from '@globalnews-ai/shared';
import type { NewsProvider } from './interfaces';
import { ALL_NEWS_PROVIDERS, NEWS_PROVIDERS } from './providers/provider.tokens';
import { ArticlePersistenceService } from './persistence/article-persistence.service';

/**
 * NewsService is the provider-agnostic orchestration layer for news.
 *
 * Provider failures are isolated so that one unavailable provider does
 * not break an entire request.
 *
 * Final deduplicated/capped articles are persisted after the response
 * has been assembled.
 */
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

  async search(query: string, limit?: number): Promise<NewsResponse> {
    const results = await this.callAllProviders((provider) =>
      provider.search(query, { limit }),
    );

    const response = this.buildResponse(
      results,
      limit,
      { query },
      { sortByRecency: true },
    );

    await this.articlePersistence.persistMany(response.articles);

    return response;
  }

  async topHeadlines(limit?: number): Promise<NewsResponse> {
    const results = await this.callAllProviders((provider) =>
      provider.topHeadlines({ limit }),
    );

    const response = this.buildResponse(
      results,
      limit,
      {},
      { sortByRecency: false },
    );

    await this.articlePersistence.persistMany(response.articles);

    return response;
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

    await this.articlePersistence.persistMany(response.articles);

    return response;
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
              error instanceof Error ? error.message : 'Unknown error',
            checkedAt: new Date().toISOString(),
          };
        }
      }),
    );
  }

  private async callAllProviders(
    operation: (provider: NewsProvider) => Promise<NewsArticle[]>,
  ): Promise<Array<{ providerId: string; articles: NewsArticle[] }>> {
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
    results: Array<{ providerId: string; articles: NewsArticle[] }>,
    limit: number | undefined,
    extra: Partial<Pick<NewsResponse, 'query' | 'category'>> = {},
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

    const capped = limit ? merged.slice(0, limit) : merged;

    return {
      articles: capped,
      totalResults: capped.length,
      providers: results.map((result) => result.providerId),
      dataMode: this.resolveDataMode(
        results.map((result) => result.providerId),
      ),
      generatedAt: new Date().toISOString(),
      ...extra,
    };
  }

  private resolveDataMode(
    successfulProviderIds: string[],
  ): NewsResponse['dataMode'] {
    const successfulProviders = this.providers.filter((provider) =>
      successfulProviderIds.includes(provider.id),
    );

    if (successfulProviders.length > 0) {
      return successfulProviders.some((provider) => !provider.isMock)
        ? 'live'
        : 'mock';
    }

    return this.providers.every((provider) => provider.isMock)
      ? 'mock'
      : 'live';
  }
}