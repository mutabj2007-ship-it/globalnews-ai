import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AnalysisApiResponse } from '@globalnews-ai/shared';
import { NewsService } from '../../news/news.service';
import type { AnalysisProvider } from '../interfaces';
import { ANALYSIS_PROVIDER } from '../providers/provider.tokens';
import { AnalysisConfigService } from '../config/analysis-config.service';
import { clusterDuplicateArticles } from '../duplicates/cluster-articles.util';
import { validateAnalysisResult, AnalysisValidationError } from '../validation/validate-analysis-result';

interface CacheEntry {
  value: AnalysisApiResponse;
  expiresAt: number;
}

/** Number of articles requested from NewsService before deduping/bounding. */
const SEARCH_POOL_SIZE = 20;

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  /**
   * Simple in-memory cache (query -> response), per Sprint 5.1's cost
   * controls: don't re-analyze the same query on every render. No
   * database — this is intentionally process-local and lost on
   * restart, which is fine for a development-stage cache.
   */
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly newsService: NewsService,
    @Inject(ANALYSIS_PROVIDER) private readonly provider: AnalysisProvider,
    private readonly analysisConfig: AnalysisConfigService,
  ) {}

  async analyzeNews(query: string): Promise<AnalysisApiResponse> {
    const config = this.analysisConfig.get();
    const cacheKey = query.trim().toLowerCase();

    const cached = this.getCached(cacheKey);
    if (cached) {
      this.logger.debug(`Serving cached analysis for "${query}"`);
      return cached;
    }

    const searchResponse = await this.newsService.search(query, SEARCH_POOL_SIZE);

    if (searchResponse.articles.length === 0) {
      const empty: AnalysisApiResponse = {
        query,
        analysis: null,
        articles: [],
        analysisError: 'No related articles were found for this question.',
      };
      // Empty results are still cached briefly to avoid hammering the
      // news provider with the exact same fruitless query repeatedly.
      this.setCached(cacheKey, empty, config.cacheTtlSeconds);
      return empty;
    }

    const deduped = clusterDuplicateArticles(searchResponse.articles).slice(0, config.maxArticles);

    let response: AnalysisApiResponse;
    try {
      const candidate = await this.provider.analyzeNews({ query, articles: deduped });
      const analysis = validateAnalysisResult(candidate, {
        query,
        articles: deduped,
        analysisMode: this.provider.isMock ? 'mock-ai' : 'live-ai',
      });
      response = { query, analysis, articles: deduped };
    } catch (error) {
      this.logger.warn(
        `Analysis provider "${this.provider.id}" failed for query "${query}"`,
        error as Error,
      );
      response = {
        query,
        analysis: null,
        articles: deduped,
        analysisError: this.describeError(error),
      };
    }

    this.setCached(cacheKey, response, config.cacheTtlSeconds);
    return response;
  }

  private describeError(error: unknown): string {
    if (error instanceof AnalysisValidationError) {
      return 'The AI analysis response was invalid and could not be shown. The underlying articles are still available below.';
    }
    if (error instanceof Error) {
      return `AI analysis is temporarily unavailable (${error.message}). The underlying articles are still available below.`;
    }
    return 'AI analysis is temporarily unavailable. The underlying articles are still available below.';
  }

  private getCached(key: string): AnalysisApiResponse | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }

  private setCached(key: string, value: AnalysisApiResponse, ttlSeconds: number): void {
    if (ttlSeconds <= 0) return;
    this.cache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }
}
