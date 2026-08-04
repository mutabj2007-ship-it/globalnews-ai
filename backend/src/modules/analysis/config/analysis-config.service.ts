import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AnalysisConfig {
  /** Maximum number of articles ever sent to an AI provider for one request. */
  maxArticles: number;
  /** Each article's title+summary is truncated to this many characters before being sent. */
  maxArticleChars: number;
  /** AI provider call timeout, in milliseconds. */
  timeoutMs: number;
  /** How long a successful analysis is cached in memory, in seconds. 0 disables caching. */
  cacheTtlSeconds: number;
  openAiApiKey: string | undefined;
  openAiModel: string;
}

const DEFAULTS = {
  maxArticles: 8,
  maxArticleChars: 1200,
  timeoutMs: 20000,
  cacheTtlSeconds: 300,
  openAiModel: 'gpt-4o-mini',
};

/**
 * Centralizes the cost/safety knobs required by Sprint 5.1: a bounded
 * number of articles, a bounded per-article length, a call timeout, and
 * an optional in-memory cache duration — so nothing here can send
 * unlimited content to a paid AI provider or re-analyze the same query
 * on every page render.
 */
@Injectable()
export class AnalysisConfigService {
  constructor(private readonly config: ConfigService) {}

  get(): AnalysisConfig {
    return {
      maxArticles: this.readInt('ANALYSIS_MAX_ARTICLES', DEFAULTS.maxArticles),
      maxArticleChars: this.readInt('ANALYSIS_MAX_ARTICLE_CHARS', DEFAULTS.maxArticleChars),
      timeoutMs: this.readInt('ANALYSIS_TIMEOUT_MS', DEFAULTS.timeoutMs),
      cacheTtlSeconds: this.readInt('ANALYSIS_CACHE_TTL_SECONDS', DEFAULTS.cacheTtlSeconds),
      openAiApiKey: this.config.get<string>('OPENAI_API_KEY'),
      openAiModel: this.config.get<string>('OPENAI_MODEL') || DEFAULTS.openAiModel,
    };
  }

  private readInt(key: string, fallback: number): number {
    const raw = this.config.get<string>(key);
    const parsed = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
