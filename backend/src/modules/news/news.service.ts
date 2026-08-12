import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
  NewsArticle,
  NewsCategory,
  NewsFallbackReason,
  NewsResponse,
  ProviderHealthStatus,
} from '@globalnews-ai/shared';
import type { NewsProvider } from './interfaces';
import {
  ALL_NEWS_PROVIDERS,
  NEWS_PROVIDERS,
} from './providers/provider.tokens';
import { ArticlePersistenceService } from './persistence/article-persistence.service';
import { scoreGenericRelevance, scoreRelationalRelevance } from './relevance/generic-relevance.util';

const DATABASE_FALLBACK_MAX_AGE_MINUTES = 1440;

/**
 * Milestone #36/#37 — discriminated union, so a search() caller can
 * never request both generic and relational relevance filtering at
 * once. This is a TYPE-LEVEL guarantee, not a documented convention: it
 * is structurally impossible to construct a RelevanceMode value that is
 * simultaneously 'generic' and 'relational', and every branch below
 * exhaustively switches on `mode.type`, so there is no runtime path
 * where two filtering strategies could apply to the same call.
 *
 * - 'none' (the default when the parameter is omitted): no filtering —
 *   CountryNewsService's country/city retrieval and the public
 *   GET /news/search endpoint both call search() this way, so their
 *   behavior is completely unaffected by M36 or M37.
 * - 'generic': Milestone #36's evidence-admission gate
 *   (scoreGenericRelevance), used by AnalysisService's ordinary
 *   (non-relational) generic-search branch.
 * - 'relational': Milestone #37's joint-topical-relevance gate
 *   (scoreRelationalRelevance), used by AnalysisService's relational
 *   branch. Establishes ONLY "the article discusses X and Y" — never
 *   causality. See scoreRelationalRelevance's own doc comment.
 */
export type RelevanceMode =
  | { type: 'none' }
  | { type: 'generic' }
  | { type: 'relational'; x: string; y: string };

/**
 * The subset of RelevanceMode that actually triggers filtering —
 * excludes 'none'. Both scoreByMode() and applyRelevanceMode() are
 * typed to accept only this narrower type, not the full RelevanceMode
 * union: this makes it a compile-time guarantee (not just a runtime
 * convention) that neither is ever reachable with mode.type === 'none'
 * — the type checker itself would reject such a call. Both actual call
 * sites in search() already only invoke these methods from inside a
 * `relevanceMode.type === 'none' ? ... : ...` ternary's else-branch,
 * where TypeScript's own discriminated-union narrowing already proves
 * `relevanceMode` excludes 'none' at that point, so this type is always
 * satisfiable by the real call sites without any cast.
 */
type ActiveRelevanceMode = Exclude<RelevanceMode, { type: 'none' }>;

const NO_RELEVANCE_FILTERING: RelevanceMode = { type: 'none' };

interface ProviderCallResult {
  results: Array<{
    providerId: string;
    articles: NewsArticle[];
  }>;
  failedProviderIds: string[];
}

@Injectable()
export class NewsService {
  private readonly logger = new Logger(
    NewsService.name,
  );

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
    relevanceMode: RelevanceMode = NO_RELEVANCE_FILTERING,
  ): Promise<NewsResponse> {
    // Milestone #36/#37: opt-in only, via the discriminated
    // RelevanceMode union above. CountryNewsService's country/city
    // retrieval and the public GET /news/search endpoint both call this
    // same method with the default 'none' mode, so their behavior is
    // completely unchanged by either milestone.
    const providerCall =
      await this.callAllProviders(
        (provider) =>
          provider.search(query, {
            limit,
          }),
      );

    const rawResponse = this.buildResponse(
      providerCall.results,
      providerCall.failedProviderIds,
      limit,
      { query },
      {
        sortByRecency: true,
      },
    );

    // Milestone #36/#37: filtering happens here — before the
    // persistence check just below — so a relevance-rejected article is
    // never persisted as accepted generic OR relational evidence (per
    // the approved design's "provider candidates -> relevance filtering
    // -> accepted result handling/persistence" ordering, which applies
    // identically to both modes).
    const response =
      relevanceMode.type === 'none'
        ? rawResponse
        : this.applyRelevanceMode(rawResponse, query, relevanceMode);

    if (response.articles.length > 0) {
      if (response.dataMode === 'live') {
        await this.articlePersistence.persistMany(
          response.articles,
        );
      }

      return response;
    }

    if (!this.hasRealProviderConfigured()) {
      return response;
    }

    const cachedArticles =
      await this.articlePersistence.findRecent({
        query,
        limit,
        maxAgeMinutes:
          DATABASE_FALLBACK_MAX_AGE_MINUTES,
      });

    // Milestone #36/#37: the SAME gate (whichever mode is active)
    // applies to stored/persisted fallback results — live and stored
    // generic/relational results must not have inconsistent trust
    // rules.
    const relevantCachedArticles =
      relevanceMode.type === 'none'
        ? cachedArticles
        : cachedArticles.filter((article) =>
            this.scoreByMode(article, query, relevanceMode).isRelevant,
          );

    if (relevantCachedArticles.length === 0) {
      return response;
    }

    return this.buildCachedResponse(
      relevantCachedArticles,
      limit,
      {
        query,
      },
      this.resolveFallbackReason(
        providerCall.failedProviderIds,
      ),
    );
  }

  /**
   * Milestone #47 — `options` is new (previously topHeadlines() took
   * only `limit`). Backward compatible: every existing caller that
   * passes no second argument, or omits `lang`/`q`, gets exactly the
   * same provider call as before. Does NOT itself apply relevance
   * filtering (unlike search()) — AnalysisService's Milestone #47
   * Polish branch applies scoreGenericRelevance() directly to this
   * method's results, reusing the same unmodified relevance function
   * search() uses internally, without retrofitting this method's own
   * DB-fallback/persistence logic (below, unchanged) with the
   * relevanceMode plumbing search() has.
   */
  async topHeadlines(
    limit?: number,
    options?: { lang?: string; q?: string },
  ): Promise<NewsResponse> {
    const providerCall =
      await this.callAllProviders(
        (provider) =>
          provider.topHeadlines({
            limit,
            lang: options?.lang,
            q: options?.q,
          }),
      );

    const response = this.buildResponse(
      providerCall.results,
      providerCall.failedProviderIds,
      limit,
      {},
      {
        sortByRecency: false,
      },
    );

    if (response.articles.length > 0) {
      if (response.dataMode === 'live') {
        await this.articlePersistence.persistMany(
          response.articles,
        );
      }

      return response;
    }

    if (!this.hasRealProviderConfigured()) {
      return response;
    }

    const cachedArticles =
      await this.articlePersistence.findRecent({
        limit,
        maxAgeMinutes:
          DATABASE_FALLBACK_MAX_AGE_MINUTES,
      });

    if (cachedArticles.length === 0) {
      return response;
    }

    return this.buildCachedResponse(
      cachedArticles,
      limit,
      {},
      this.resolveFallbackReason(
        providerCall.failedProviderIds,
      ),
    );
  }

  async byCategory(
    category: NewsCategory,
    limit?: number,
  ): Promise<NewsResponse> {
    const providerCall =
      await this.callAllProviders(
        (provider) =>
          provider.category(category, {
            limit,
          }),
      );

    const response = this.buildResponse(
      providerCall.results,
      providerCall.failedProviderIds,
      limit,
      {
        category,
      },
      {
        sortByRecency: true,
      },
    );

    if (response.articles.length > 0) {
      if (response.dataMode === 'live') {
        await this.articlePersistence.persistMany(
          response.articles,
        );
      }

      return response;
    }

    if (!this.hasRealProviderConfigured()) {
      return response;
    }

    const cachedArticles =
      await this.articlePersistence.findRecent({
        category,
        limit,
        maxAgeMinutes:
          DATABASE_FALLBACK_MAX_AGE_MINUTES,
      });

    if (cachedArticles.length === 0) {
      return response;
    }

    return this.buildCachedResponse(
      cachedArticles,
      limit,
      {
        category,
      },
      this.resolveFallbackReason(
        providerCall.failedProviderIds,
      ),
    );
  }

  async providersHealth(): Promise<
    ProviderHealthStatus[]
  > {
    return Promise.all(
      this.allProviders.map(
        async (provider) => {
          try {
            return await provider.health();
          } catch (error) {
            this.logger.warn(
              `Health check failed for provider "${provider.id}"`,
              error instanceof Error
                ? error
                : undefined,
            );

            return {
              providerId: provider.id,
              displayName:
                provider.displayName,
              status: 'down' as const,
              message:
                error instanceof Error
                  ? error.message
                  : 'Unknown error',
              checkedAt:
                new Date().toISOString(),
            };
          }
        },
      ),
    );
  }

  private async callAllProviders(
    operation: (
      provider: NewsProvider,
    ) => Promise<NewsArticle[]>,
  ): Promise<ProviderCallResult> {
    const settled =
      await Promise.allSettled(
        this.providers.map(
          async (provider) => ({
            providerId: provider.id,
            articles:
              await operation(provider),
          }),
        ),
      );

    const results: ProviderCallResult['results'] =
      [];

    const failedProviderIds: string[] = [];

    settled.forEach((result, index) => {
      const provider =
        this.providers[index];

      if (result.status === 'fulfilled') {
        results.push(result.value);
        return;
      }

      failedProviderIds.push(
        provider.id,
      );

      this.logger.warn(
        `Provider "${provider.id}" failed to respond`,
        result.reason instanceof Error
          ? result.reason
          : undefined,
      );
    });

    return {
      results,
      failedProviderIds,
    };
  }

  private buildResponse(
    results: Array<{
      providerId: string;
      articles: NewsArticle[];
    }>,
    failedProviderIds: string[],
    limit: number | undefined,
    extra: Partial<
      Pick<
        NewsResponse,
        'query' | 'category'
      >
    > = {},
    {
      sortByRecency,
    }: {
      sortByRecency: boolean;
    } = {
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
          new Date(
            b.publishedAt,
          ).getTime() -
          new Date(
            a.publishedAt,
          ).getTime(),
      );
    }

    const capped = limit
      ? merged.slice(0, limit)
      : merged;

    const successfulProviderIds = results.map(
      (result) => result.providerId,
    );

    const dataMode = this.resolveDataMode(
      successfulProviderIds,
    );

    return {
      articles: capped,
      totalResults: capped.length,
      providers: successfulProviderIds,
      dataMode,
      fallbackReason:
        dataMode === 'unavailable'
          ? this.resolveFallbackReason(
              failedProviderIds,
            )
          : undefined,
      generatedAt:
        new Date().toISOString(),
      ...extra,
    };
  }

  /**
   * Milestone #36/#37 — dispatches to the correct scorer based on the
   * active RelevanceMode. Never called with mode.type === 'none' (both
   * call sites above check that first) — kept as a private helper
   * rather than inlined so the two filtering points (live response,
   * cached-articles array) can never drift apart in which scorer they
   * use for a given mode.
   */
  private scoreByMode(
    article: NewsArticle,
    query: string,
    relevanceMode: ActiveRelevanceMode,
  ): { isRelevant: boolean } {
    if (relevanceMode.type === 'generic') {
      return scoreGenericRelevance(article, query);
    }

    return scoreRelationalRelevance(article, relevanceMode.x, relevanceMode.y);
  }

  /**
   * Milestone #36/#37 — filters a NewsResponse's articles via
   * scoreByMode(), recomputing totalResults to match. Only ever called
   * from search() when relevanceMode.type !== 'none'. Every other field
   * (dataMode, providers, fallbackReason, generatedAt, query/category)
   * is preserved unchanged — dataMode continues to describe what the
   * RETRIEVAL did (e.g. "live" because a real provider responded),
   * independent of how many of its results survive relevance filtering.
   */
  private applyRelevanceMode(
    response: NewsResponse,
    query: string,
    relevanceMode: ActiveRelevanceMode,
  ): NewsResponse {
    const filtered = response.articles.filter(
      (article) => this.scoreByMode(article, query, relevanceMode).isRelevant,
    );

    return {
      ...response,
      articles: filtered,
      totalResults: filtered.length,
    };
  }

  private buildCachedResponse(
    articles: NewsArticle[],
    limit: number | undefined,
    extra: Partial<
      Pick<
        NewsResponse,
        'query' | 'category'
      >
    > = {},
    fallbackReason?: NewsFallbackReason,
  ): NewsResponse {
    const capped = limit
      ? articles.slice(0, limit)
      : articles;

    return {
      articles: capped,
      totalResults: capped.length,
      providers: [],
      dataMode: 'cached',
      fallbackReason,
      generatedAt:
        new Date().toISOString(),
      ...extra,
    };
  }

  private resolveFallbackReason(
    failedProviderIds: string[],
  ): NewsFallbackReason {
    const failedRealProvider =
      this.providers.some(
        (provider) =>
          !provider.isMock &&
          failedProviderIds.includes(
            provider.id,
          ),
      );

    return failedRealProvider
      ? 'provider-error'
      : 'no-live-results';
  }

  private hasRealProviderConfigured(): boolean {
    return this.providers.some(
      (provider) =>
        !provider.isMock,
    );
  }

  /**
   * Determines dataMode from what actually happened on this call, not
   * from which providers are merely configured.
   *
   * A provider that resolved (even with zero articles) counts as
   * "successful" here — callAllProviders only excludes providers whose
   * promise rejected. That's what lets a real provider's legitimate
   * zero-result answer ("live", 0 articles) stay distinguishable from
   * every real provider failing outright ("unavailable", 0 articles):
   * the former has a non-empty `providers` list, the latter doesn't.
   */
  private resolveDataMode(
    successfulProviderIds: string[],
  ): NewsResponse['dataMode'] {
    const successfulProviders =
      this.providers.filter(
        (provider) =>
          successfulProviderIds.includes(
            provider.id,
          ),
      );

    if (
      successfulProviders.length > 0
    ) {
      return successfulProviders.some(
        (provider) =>
          !provider.isMock,
      )
        ? 'live'
        : 'mock';
    }

    if (
      this.providers.length > 0 &&
      this.providers.every(
        (provider) => provider.isMock,
      )
    ) {
      return 'mock';
    }

    // Nobody succeeded, and a real provider was in play (or none is
    // configured at all). Never claim "live" when nothing actually
    // came back — see resolveFallbackReason for why.
    return 'unavailable';
  }
}