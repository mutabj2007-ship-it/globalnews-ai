import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
  NewsArticle,
  NewsCategory,
  NewsResponse,
  ProviderHealthStatus,
} from '@globalnews-ai/shared';
import type { NewsProvider } from './interfaces';
import { ALL_NEWS_PROVIDERS, NEWS_PROVIDERS } from './providers/provider.tokens';

/**
 * NewsService is the only piece of the news module that talks to
 * providers, and it only ever does so through the NewsProvider
 * interface. It has no knowledge of Reuters, AP News, BBC, NewsAPI,
 * GDELT, GNews, Google News, or the mock provider — just arrays of
 * NewsProvider implementations injected via tokens.
 *
 * A single slow or failing provider never breaks a request: each
 * provider call is isolated with Promise.allSettled, and failures are
 * logged and excluded from the response rather than thrown.
 */
@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);

  constructor(
    /** Providers currently active for reads (search/topHeadlines/category). */
    @Inject(NEWS_PROVIDERS) private readonly providers: NewsProvider[],
    /** Every registered provider, active or not — used only for health reporting. */
    @Inject(ALL_NEWS_PROVIDERS) private readonly allProviders: NewsProvider[],
  ) {}

  async search(query: string, limit?: number): Promise<NewsResponse> {
    const results = await this.callAllProviders((provider) =>
      provider.search(query, { limit }),
    );
    return this.buildResponse(results, limit, { query }, { sortByRecency: true });
  }

  async topHeadlines(limit?: number): Promise<NewsResponse> {
    const results = await this.callAllProviders((provider) => provider.topHeadlines({ limit }));
    // Preserve each provider's own editorial ranking rather than forcing
    // a recency sort — that's what makes it "top headlines" and not
    // just "latest headlines".
    return this.buildResponse(results, limit, {}, { sortByRecency: false });
  }

  async byCategory(category: NewsCategory, limit?: number): Promise<NewsResponse> {
    const results = await this.callAllProviders((provider) =>
      provider.category(category, { limit }),
    );
    return this.buildResponse(results, limit, { category }, { sortByRecency: true });
  }

  async providersHealth(): Promise<ProviderHealthStatus[]> {
    return Promise.all(
      this.allProviders.map(async (provider) => {
        try {
          return await provider.health();
        } catch (error) {
          this.logger.warn(`Health check failed for provider "${provider.id}"`, error as Error);
          return {
            providerId: provider.id,
            displayName: provider.displayName,
            status: 'down' as const,
            message: error instanceof Error ? error.message : 'Unknown error',
            checkedAt: new Date().toISOString(),
          };
        }
      }),
    );
  }

  /**
   * Calls every registered provider with the given operation, isolating
   * failures per-provider so one bad provider never fails the request.
   */
  private async callAllProviders(
    operation: (provider: NewsProvider) => Promise<NewsArticle[]>,
  ): Promise<Array<{ providerId: string; articles: NewsArticle[] }>> {
    const settled = await Promise.allSettled(
      this.providers.map(async (provider) => ({
        providerId: provider.id,
        articles: await operation(provider),
      })),
    );

    const fulfilled: Array<{ providerId: string; articles: NewsArticle[] }> = [];

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

  /** Merges, dedupes, optionally sorts, and packages provider results into a NewsResponse. */
  private buildResponse(
    results: Array<{ providerId: string; articles: NewsArticle[] }>,
    limit: number | undefined,
    extra: Partial<Pick<NewsResponse, 'query' | 'category'>> = {},
    { sortByRecency }: { sortByRecency: boolean } = { sortByRecency: true },
  ): NewsResponse {
    const seen = new Set<string>();
    const merged: NewsArticle[] = [];

    for (const { articles } of results) {
      for (const article of articles) {
        if (seen.has(article.id)) continue;
        seen.add(article.id);
        merged.push(article);
      }
    }

    if (sortByRecency) {
      merged.sort(
        (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
      );
    }

    const capped = limit ? merged.slice(0, limit) : merged;

    return {
      articles: capped,
      totalResults: capped.length,
      providers: results.map((result) => result.providerId),
      dataMode: this.resolveDataMode(results.map((result) => result.providerId)),
      generatedAt: new Date().toISOString(),
      ...extra,
    };
  }

  /**
   * "live" if any provider that actually answered this request is a
   * real (non-mock) provider; "mock" otherwise. If no provider
   * answered at all (e.g. GNews errored out), this falls back to
   * whichever provider is currently configured as active, so the
   * label still reflects the system's real mode rather than
   * defaulting to a misleading guess.
   */
  private resolveDataMode(successfulProviderIds: string[]): NewsResponse['dataMode'] {
    const successfulProviders = this.providers.filter((provider) =>
      successfulProviderIds.includes(provider.id),
    );

    if (successfulProviders.length > 0) {
      return successfulProviders.some((provider) => !provider.isMock) ? 'live' : 'mock';
    }

    return this.providers.every((provider) => provider.isMock) ? 'mock' : 'live';
  }
}
