import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ANALYSIS_MAX_SERVER_BUDGET_MS,
  ANALYSIS_PROVIDER_ATTEMPT_BUDGET_MS,
  ANALYSIS_TOTAL_BUDGET_MS,
  resolveServerBudgetMs,
} from '@globalnews-ai/shared';

/** Milestone #30 — explicit deploy-mode flag for AI execution. */
export type AnalysisExecutionMode = 'production' | 'development';

export interface AnalysisConfig {
  /** Maximum number of articles ever sent to an AI provider for one request. */
  maxArticles: number;

  /** Each article's title + summary is truncated to this many characters. */
  maxArticleChars: number;

  /**
   * AI provider call timeout, in milliseconds.
   * Applies per attempt; see retryAttempts.
   */
  timeoutMs: number;

  /**
   * How long a successful analysis is cached in memory, in seconds.
   * 0 disables caching.
   */
  cacheTtlSeconds: number;

  openAiApiKey: string | undefined;
  openAiModel: string;

  /**
   * Milestone #30 — AI execution mode.
   *
   * NODE_ENV=production always forces production mode so a production
   * deployment cannot silently fall back to mock analysis because
   * AI_EXECUTION_MODE was omitted or misconfigured.
   *
   * Outside production, AI_EXECUTION_MODE=production explicitly enables
   * production mode; otherwise development mode is used.
   */
  executionMode: AnalysisExecutionMode;

  /**
   * Milestone #45 — hard upper bound on OpenAI completion length, in
   * tokens. Sent as `max_completion_tokens` on every OpenAI request —
   * NOT the deprecated `max_tokens` field (OpenAI deprecated `max_tokens`
   * in favor of `max_completion_tokens` across all Chat Completions
   * models, including this repository's configured gpt-4o-mini; `max_tokens`
   * additionally does not work at all on newer reasoning models). Exists
   * so a pathological/verbose model response cannot consume unbounded
   * completion tokens — the structured JSON response_format already
   * bounds the *shape* of the output, this bounds its *length*.
   * Read from ANALYSIS_MAX_COMPLETION_TOKENS.
   */
  maxCompletionTokens: number;

  /**
   * Milestone #30 — number of retry attempts for a transient OpenAI
   * failure (429 / 5xx / network error), NOT counting the first attempt.
   *
   * 0 disables retries entirely.
   * Read from ANALYSIS_RETRY_ATTEMPTS.
   */
  retryAttempts: number;

  /**
   * Milestone #30 — base delay in milliseconds for exponential
   * retry backoff.
   *
   * Read from ANALYSIS_RETRY_BASE_DELAY_MS.
   */
  retryBaseDelayMs: number;
  /**
   * THE TOTAL SYNCHRONOUS BUDGET for one POST /analysis/news, from the shared
   * authority. Before this existed there was no deadline spanning retrieval +
   * generation + validation — only a per-attempt one — so no client timeout
   * could be defended. See shared/src/analysis-budget.ts.
   *
   * REV B — ALWAYS CLAMPED, NEVER THE RAW ENVIRONMENT VALUE. This field is
   * guaranteed to be a positive number no greater than
   * ANALYSIS_MAX_SERVER_BUDGET_MS, whatever ANALYSIS_TOTAL_BUDGET_MS was set
   * to. The frontend's abort deadline is compiled in and cannot be renegotiated
   * from a dashboard, so neither can this.
   */
  totalBudgetMs: number;
}

const DEFAULTS = {
  maxArticles: 8,
  maxArticleChars: 1200,
  /*
    DERIVED, NOT RESTATED. The one authority is
    shared/src/analysis-budget.ts; this default is the per-attempt term of it,
    so the client deadline and this value cannot drift apart silently. An
    operator may still override with ANALYSIS_TIMEOUT_MS, and the total budget
    below is what keeps that override honest.
  */
  timeoutMs: ANALYSIS_PROVIDER_ATTEMPT_BUDGET_MS,
  cacheTtlSeconds: 300,
  openAiModel: 'gpt-4o-mini',
  retryAttempts: 2,
  retryBaseDelayMs: 300,
  /**
   * Milestone #45 — conservative but not unnecessarily small: the
   * structured NewsAnalysisResult schema can have several textual
   * sections (keyFacts, agreements, differences, timeline,
   * uncertainties, relationalEvidenceAssessments, entities) each with
   * genuine prose plus JSON structural overhead — 2000 tokens is
   * generous enough for a complete, thorough response at this
   * schema's realistic size without being unbounded. This is a
   * reasoned MVP default, not a repository-mandated value — open to
   * revision if real usage shows it's too tight or too loose.
   */
  maxCompletionTokens: 2000,
  /*
    The shared authority's own total, unmodified. ANALYSIS_MAX_SERVER_BUDGET_MS
    is imported alongside it so this file names the ceiling its override is
    measured against, rather than leaving that relationship implicit in another
    module.
  */
  totalBudgetMs: Math.min(ANALYSIS_TOTAL_BUDGET_MS, ANALYSIS_MAX_SERVER_BUDGET_MS),
};

/**
 * Centralizes the cost and safety controls for analysis:
 *
 * - bounded article count;
 * - bounded per-article content;
 * - provider timeout;
 * - cache duration;
 * - production/development execution mode;
 * - retry count;
 * - exponential retry delay.
 *
 * Milestone #30 also makes production AI fail-closed through the
 * executionMode consumed by AnalysisStartupValidator.
 */
@Injectable()
export class AnalysisConfigService {
  constructor(private readonly config: ConfigService) {}

  get(): AnalysisConfig {
    return {
      maxArticles: this.readPositiveInt('ANALYSIS_MAX_ARTICLES', DEFAULTS.maxArticles),

      maxArticleChars: this.readPositiveInt('ANALYSIS_MAX_ARTICLE_CHARS', DEFAULTS.maxArticleChars),

      timeoutMs: this.readPositiveInt('ANALYSIS_TIMEOUT_MS', DEFAULTS.timeoutMs),

      /*
        REV B — READ, THEN CLAMPED. `readPositiveInt` already rejects garbage and
        non-positive values, but it has no opinion about how LARGE a value may
        be, and largeness is the direction that breaks the client contract.
        `resolveServerBudgetMs` is the shared authority's own ceiling function,
        so the rule lives beside the constant that defines it rather than being
        restated here. An operator may still lower this freely.
      */
      totalBudgetMs: resolveServerBudgetMs(
        this.readPositiveInt('ANALYSIS_TOTAL_BUDGET_MS', DEFAULTS.totalBudgetMs),
      ),

      cacheTtlSeconds: this.readPositiveInt('ANALYSIS_CACHE_TTL_SECONDS', DEFAULTS.cacheTtlSeconds),

      openAiApiKey: this.config.get<string>('OPENAI_API_KEY'),

      openAiModel: this.config.get<string>('OPENAI_MODEL') || DEFAULTS.openAiModel,

      maxCompletionTokens: this.readPositiveInt(
        'ANALYSIS_MAX_COMPLETION_TOKENS',
        DEFAULTS.maxCompletionTokens,
      ),

      executionMode: this.readExecutionMode(),

      retryAttempts: this.readNonNegativeInt('ANALYSIS_RETRY_ATTEMPTS', DEFAULTS.retryAttempts),

      retryBaseDelayMs: this.readNonNegativeInt(
        'ANALYSIS_RETRY_BASE_DELAY_MS',
        DEFAULTS.retryBaseDelayMs,
      ),
    };
  }

  private readExecutionMode(): AnalysisExecutionMode {
    const nodeEnv = this.config.get<string>('NODE_ENV')?.trim().toLowerCase();

    /*
     * Production deployment always wins.
     * This prevents accidental mock-AI fallback if AI_EXECUTION_MODE
     * is missing or incorrectly set on a production server.
     */
    if (nodeEnv === 'production') {
      return 'production';
    }

    const raw = this.config.get<string>('AI_EXECUTION_MODE')?.trim().toLowerCase();

    return raw === 'production' ? 'production' : 'development';
  }

  private readPositiveInt(key: string, fallback: number): number {
    const raw = this.config.get<string>(key);
    const parsed = raw ? parseInt(raw, 10) : NaN;

    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  /**
   * Like readPositiveInt, but 0 is a valid, meaningful value.
   * Example: ANALYSIS_RETRY_ATTEMPTS=0 disables retries.
   */
  private readNonNegativeInt(key: string, fallback: number): number {
    const raw = this.config.get<string>(key);
    const parsed = raw ? parseInt(raw, 10) : NaN;

    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  }
}
