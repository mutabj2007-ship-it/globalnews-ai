import { Injectable, Logger } from '@nestjs/common';
import { logWithRequestId } from '../../../observability/log-with-request-id';
import type { AnalysisFailureReason } from '@globalnews-ai/shared';
import type { AnalysisProvider, AnalysisProviderInput } from '../interfaces';
import type { AnalysisDevelopmentBreadth } from '../interfaces/analysis-provider.interface';
import { AnalysisConfigService, type AnalysisConfig } from '../config/analysis-config.service';
import { isUsableOpenAiApiKey } from './provider.tokens';
import { normalizeBriefFields } from './normalize-brief-fields.util';
import {
  buildAnalysisMessages,
  buildAnalysisJsonSchema,
} from '../prompt/build-analysis-prompt.util';

const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * Raised for any OpenAI-specific failure (auth, timeout, rate limit,
 * network, malformed payload). Carries a typed, machine-readable
 * `failureReason` (Milestone #30) so AnalysisService can build truthful
 * AnalysisProvenance without re-parsing this error's message, and
 * `retryable` so the retry loop below has a single source of truth for
 * whether a given failure is worth retrying. Never carries the raw
 * OPENAI_API_KEY value — only `cause` (kept internal, never surfaced to
 * the frontend contract) may reference the underlying fetch/parse error.
 */
export class OpenAiAnalysisError extends Error {
  constructor(
    message: string,
    public readonly failureReason: AnalysisFailureReason,
    public readonly retryable: boolean,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'OpenAiAnalysisError';
  }
}

interface OpenAiChatCompletionResponse {
  choices?: Array<{
    message?: { content?: string };
    /** e.g. "stop", "length", "content_filter". We only special-case "length" (truncated output). */
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

interface AttemptResult {
  content: unknown;
  usage?: OpenAiChatCompletionResponse['usage'];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isServerErrorStatus(status: number): boolean {
  return status >= 500 && status < 600;
}

/**
 * Real AI analysis provider backed by OpenAI's Chat Completions API,
 * using structured JSON output so the model's response shape matches
 * the analysis schema as closely as possible before AnalysisService's
 * validator gets the final say.
 *
 * Uses a plain server-side `fetch` call rather than the `openai` SDK,
 * matching the pattern already established by GNewsProvider — no new
 * runtime dependency, same timeout/error-handling shape. All
 * OpenAI-specific logic (endpoint, payload shape, auth header) lives
 * entirely in this class; the API key is read once from config and is
 * never logged or included in any thrown error message.
 *
 * Milestone #30: adds bounded retry-with-backoff for transient failures
 * (429 / 5xx / network errors) — never for auth failures or a
 * not-configured key — and logs (never returns to the caller) latency,
 * model, and token usage for later observability, without changing this
 * class's public return type.
 */
@Injectable()
export class OpenAiAnalysisProvider implements AnalysisProvider {
  readonly id = 'openai';
  readonly displayName = 'OpenAI';
  readonly isMock = false;

  private readonly logger = new Logger(OpenAiAnalysisProvider.name);

  constructor(private readonly analysisConfig: AnalysisConfigService) {}

  async analyzeNews({
    query,
    articles,
    relationalContext,
    comparisonCoverage,
    responseLanguage,
    repairDirective,
    developmentBreadth,
    evidenceState,
    newestEvidence,
    signal,
  }: AnalysisProviderInput): Promise<unknown> {
    const config = this.analysisConfig.get();

    if (!isUsableOpenAiApiKey(config.openAiApiKey)) {
      throw new OpenAiAnalysisError(
        'OPENAI_API_KEY is not configured.',
        'provider-not-configured',
        false,
      );
    }

    // Milestone #40 (authoritative-context correction): relationalContext,
    // when present, is forwarded unchanged — this provider never derives
    // or reinterprets X/Y itself, only renders whatever AnalysisService
    // supplied (which is itself exactly what deriveRelationalSearchQueries()
    // produced — see analysis.service.ts).
    const { system, user } = buildAnalysisMessages(
      query,
      articles,
      config.maxArticleChars,
      relationalContext,
      responseLanguage,
      repairDirective,
      // EXECUTIVE-BRIEF-STRUCTURAL-COMPLIANCE-RECOVERY-1 — forwarded
      // unchanged, exactly as relationalContext and repairDirective are:
      // this provider never measures or reinterprets breadth itself.
      developmentBreadth,
      comparisonCoverage,
      evidenceState,
      newestEvidence,
    );
    const maxAttempts = comparisonCoverage?.length ? 1 : config.retryAttempts + 1;
    const startedAt = Date.now();

    let lastError: OpenAiAnalysisError | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      if (signal?.aborted) {
        throw new OpenAiAnalysisError(
          'OpenAI analysis was cancelled because the response deadline expired.',
          'provider-timeout',
          false,
        );
      }

      try {
        const result = await this.attemptOnce(
          system,
          user,
          config,
          developmentBreadth,
          signal,
        );
        const latencyMs = Date.now() - startedAt;

        // Milestone #30 §J: capture latency/model/token-usage for later
        // observability via safe structured logging only — never in the
        // response contract (see AnalysisProvider's return-type comment)
        // and never including the API key or any raw provider payload.
        logWithRequestId(
          this.logger,
          'log',
          `OpenAI analysis succeeded: model=${config.openAiModel} attempt=${attempt}/${maxAttempts} ` +
            `latencyMs=${latencyMs} promptTokens=${result.usage?.prompt_tokens ?? 'n/a'} ` +
            `completionTokens=${result.usage?.completion_tokens ?? 'n/a'} totalTokens=${result.usage?.total_tokens ?? 'n/a'}`,
        );

        return result.content;
      } catch (error) {
        const wrapped =
          error instanceof OpenAiAnalysisError
            ? error
            : new OpenAiAnalysisError(
                'Failed to reach OpenAI.',
                'provider-unavailable',
                true,
                error,
              );

        lastError = wrapped;

        const isLastAttempt = attempt === maxAttempts;
        if (isLastAttempt || !wrapped.retryable) {
          logWithRequestId(
            this.logger,
            'warn',
            `OpenAI analysis failed (attempt ${attempt}/${maxAttempts}, reason: ${wrapped.failureReason}, ` +
              `retryable: ${wrapped.retryable}): ${wrapped.message}`,
          );
          throw wrapped;
        }

        const backoffMs = config.retryBaseDelayMs * 2 ** (attempt - 1);
        logWithRequestId(
          this.logger,
          'warn',
          `OpenAI analysis failed (attempt ${attempt}/${maxAttempts}, reason: ${wrapped.failureReason}) — retrying in ${backoffMs}ms.`,
        );
        await delay(backoffMs);
      }
    }

    // Unreachable in practice (the loop above always either returns or
    // throws), but keeps this function's control flow provably total.
    throw (
      lastError ??
      new OpenAiAnalysisError(
        'OpenAI call failed for an unknown reason.',
        'provider-unavailable',
        false,
      )
    );
  }

  /** A single HTTP attempt against OpenAI. Throws a fully-classified OpenAiAnalysisError on any failure. */
  private async attemptOnce(
    system: string,
    user: string,
    config: AnalysisConfig,
    // C910 - the SAME measured breadth that shaped the prose section and that
    // assessBriefCompliance will judge the answer against. It selects the brief's
    // schema shape; it is never re-derived here.
    developmentBreadth?: AnalysisDevelopmentBreadth,
    callerSignal?: AbortSignal,
  ): Promise<AttemptResult> {
    const controller = new AbortController();
    let callerAborted = callerSignal?.aborted === true;
    const abortFromCaller = (): void => {
      callerAborted = true;
      controller.abort();
    };

    if (callerAborted) {
      controller.abort();
    } else {
      callerSignal?.addEventListener('abort', abortFromCaller, { once: true });
    }

    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

    let response: Response;
    try {
      response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.openAiApiKey}`,
        },
        body: JSON.stringify({
          model: config.openAiModel,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: buildAnalysisJsonSchema(developmentBreadth),
          },
          temperature: 0.2,
          // Milestone #45 — `max_completion_tokens`, NOT the deprecated
          // `max_tokens` (OpenAI deprecated `max_tokens` in favor of
          // `max_completion_tokens` across all Chat Completions models,
          // including gpt-4o-mini). Bounds worst-case completion length;
          // never affects the API key, which remains Authorization-header
          // only.
          max_completion_tokens: config.maxCompletionTokens,
        }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Deliberately NOT retryable. A caller-abort means the product can no
        // longer deliver this answer; an internal abort means the provider used
        // its full attempt budget. Neither case may spend another attempt.
        throw new OpenAiAnalysisError(
          callerAborted
            ? 'OpenAI request cancelled because the analysis response deadline expired.'
            : 'OpenAI request timed out.',
          'provider-timeout',
          false,
          error,
        );
      }
      // A network-level failure (DNS, connection reset, etc.) before any
      // HTTP response was received — this is the "transient network
      // failure" case that IS retryable.
      throw new OpenAiAnalysisError('Failed to reach OpenAI.', 'provider-unavailable', true, error);
    } finally {
      clearTimeout(timeout);
      callerSignal?.removeEventListener('abort', abortFromCaller);
    }

    if (response.status === 401 || response.status === 403) {
      throw new OpenAiAnalysisError(
        'OpenAI rejected the configured API key.',
        'provider-auth',
        false,
      );
    }
    if (response.status === 429) {
      throw new OpenAiAnalysisError('OpenAI rate limit exceeded.', 'provider-rate-limited', true);
    }
    if (isServerErrorStatus(response.status)) {
      throw new OpenAiAnalysisError(
        `OpenAI responded with status ${response.status}.`,
        'provider-unavailable',
        true,
      );
    }
    if (!response.ok) {
      // Any other 4xx (e.g. 400 bad request) reflects a request we
      // built incorrectly, not a transient condition — retrying it
      // would just fail again the same way.
      throw new OpenAiAnalysisError(
        `OpenAI responded with status ${response.status}.`,
        'provider-unavailable',
        false,
      );
    }

    let payload: OpenAiChatCompletionResponse;
    try {
      payload = (await response.json()) as OpenAiChatCompletionResponse;
    } catch (error) {
      throw new OpenAiAnalysisError(
        'OpenAI returned a malformed (non-JSON) response.',
        'malformed-output',
        false,
        error,
      );
    }

    const choice = payload.choices?.[0];

    // Milestone #30 §E.8: distinguish a truncated response (the model
    // hit its output-length limit) from an ordinary malformed payload —
    // both are classified as malformed-output (no more specific
    // AnalysisFailureReason fits), but the message is actionable on its
    // own rather than surfacing as a generic JSON-parse failure below.
    if (choice?.finish_reason === 'length') {
      throw new OpenAiAnalysisError(
        'OpenAI response was truncated because it hit the model output length limit.',
        'malformed-output',
        false,
      );
    }

    const content = choice?.message?.content;
    if (!content) {
      throw new OpenAiAnalysisError(
        'OpenAI response did not include a message.',
        'malformed-output',
        false,
      );
    }

    try {
      /*
        C910 - join the two required brief fields back into the single `summary`
        string before the payload leaves this provider. A no-op on every response
        that does not carry both, so the narrow path is untouched.
      */
      return { content: normalizeBriefFields(JSON.parse(content)), usage: payload.usage };
    } catch (error) {
      this.logger.warn('OpenAI returned non-JSON content in a structured-output call');
      throw new OpenAiAnalysisError(
        'OpenAI returned an invalid analysis payload.',
        'malformed-output',
        false,
        error,
      );
    }
  }
}
