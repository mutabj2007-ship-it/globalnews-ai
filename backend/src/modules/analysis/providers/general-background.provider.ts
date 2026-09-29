import { Injectable, Logger } from '@nestjs/common';
import { logWithRequestId } from '../../../observability/log-with-request-id';
import { buildResponseLanguageInstruction } from '../prompt/build-analysis-prompt.util';
import { AnalysisConfigService } from '../config/analysis-config.service';
import { isUsableOpenAiApiKey } from './provider.tokens';
import {
  GeneralBackgroundProviderError,
  type GeneralBackgroundInput,
  type GeneralBackgroundOutput,
  type GeneralBackgroundProvider,
} from '../interfaces';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK GENERAL BACKGROUND EXECUTION R1 — THE GENERAL-BACKGROUND PROVIDER
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Answers a question frozen C has already planned as `REFERENCE_BACKGROUND_ONLY`
 * (stable, non-time-sensitive, no evidence class required) with plain-text model
 * background — never a citation, never a source, never a claim of current/live
 * verification. See `general-background-provider.interface.ts` for why this is
 * a seam of its own rather than a reuse of `AnalysisProvider`.
 *
 * SAFETY / FRESHNESS BOUNDARY: the system prompt below is the ONE place this
 * capability is told what it may answer. It instructs the model to refuse
 * (the `NO_BACKGROUND_ANSWER` sentinel) rather than guess at anything
 * current, live, or time-sensitive, and rather than answer irresponsibly.
 * This is a second, independent layer on top of frozen C's own gate (a
 * question requiring reporting/official/specialist evidence never reaches
 * this provider at all — `RoutingPlan.terminalState !== 'REFERENCE_BACKGROUND_ONLY'`
 * routes to the existing analysis/reporting path instead, unchanged).
 */

export const GENERAL_BACKGROUND_PROVIDER = Symbol('GENERAL_BACKGROUND_PROVIDER');

/** The model's own way of declining — never surfaced to the reader verbatim. */
export const NO_BACKGROUND_ANSWER_TOKEN = 'NO_BACKGROUND_ANSWER';

const SYSTEM_PROMPT =
  'You are the General Background capability of a news-analysis product called ' +
  'GlobalNewsAI, answering a question its router has already classified as stable ' +
  'and NOT time-sensitive — nothing has been searched or retrieved for this question.\n\n' +
  'Answer ONLY from your own general knowledge. Rules, with no exceptions:\n' +
  '1. Never claim, imply, or suggest that you searched for, retrieved, checked, or ' +
  'verified anything current or live. You have not. You are recalling general knowledge.\n' +
  '2. Never invent, name, or imply a source, publisher, article, URL, date of ' +
  'publication, or citation of any kind. Do not write phrases like "according to" or ' +
  '"as reported by".\n' +
  `3. If the question depends on current, live, or time-sensitive information — ` +
  "today's date, a current office-holder, a live price or rate, breaking or recent " +
  `news, anything that could have changed — respond with EXACTLY the single token ` +
  `${NO_BACKGROUND_ANSWER_TOKEN} and nothing else.\n` +
  `4. If you cannot answer accurately and responsibly for any other reason, respond ` +
  `with EXACTLY the single token ${NO_BACKGROUND_ANSWER_TOKEN} and nothing else.\n` +
  '5. Otherwise, write a clear, neutral, factual explanation, several sentences to a ' +
  'few short paragraphs. Plain prose only — no citation markers, no source list, no ' +
  'markdown links.';

/** Bounded — a background answer is a short explanation, not an analysis brief. Exported
 *  so the execution adapter's unit estimate never drifts from what is actually requested. */
export const GENERAL_BACKGROUND_MAX_COMPLETION_TOKENS = 700;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isServerErrorStatus(status: number): boolean {
  return status >= 500 && status < 600;
}

/** Deterministic, network-free — the active provider when no usable OpenAI key is configured. */
@Injectable()
export class MockGeneralBackgroundProvider implements GeneralBackgroundProvider {
  readonly id = 'mock';
  readonly displayName = 'Mock General Background';
  readonly isMock = true;

  async answerBackground(input: GeneralBackgroundInput): Promise<GeneralBackgroundOutput> {
    input.usageSink?.({ promptTokens: 0, completionTokens: 0 });
    return {
      text:
        `[Mock general background] This is a non-live, non-cited explanatory answer for: ` +
        `"${input.question}". No provider was called.`,
    };
  }
}

@Injectable()
export class OpenAiGeneralBackgroundProvider implements GeneralBackgroundProvider {
  readonly id = 'openai';
  readonly displayName = 'OpenAI';
  readonly isMock = false;

  private readonly logger = new Logger(OpenAiGeneralBackgroundProvider.name);

  constructor(private readonly analysisConfig: AnalysisConfigService) {}

  async answerBackground({
    question,
    responseLanguage,
    maxModelAttempts,
    signal,
    usageSink,
  }: GeneralBackgroundInput): Promise<GeneralBackgroundOutput> {
    const config = this.analysisConfig.get();

    if (!isUsableOpenAiApiKey(config.openAiApiKey)) {
      throw new GeneralBackgroundProviderError(
        'OPENAI_API_KEY is not configured.',
        'provider-not-configured',
        false,
      );
    }

    const system = SYSTEM_PROMPT + buildResponseLanguageInstruction(responseLanguage);
    const policyAttempts = config.retryAttempts + 1;
    const maxAttempts =
      maxModelAttempts !== undefined && Number.isInteger(maxModelAttempts) && maxModelAttempts >= 1
        ? Math.min(policyAttempts, maxModelAttempts)
        : policyAttempts;

    let lastError: GeneralBackgroundProviderError | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      if (signal?.aborted) {
        throw new GeneralBackgroundProviderError(
          'General background call was cancelled because the response deadline expired.',
          'provider-timeout',
          false,
        );
      }
      try {
        const { content, usage } = await this.attemptOnce(system, question, config, signal);
        if (
          usageSink !== undefined &&
          typeof usage?.prompt_tokens === 'number' &&
          typeof usage?.completion_tokens === 'number'
        ) {
          usageSink({
            promptTokens: usage.prompt_tokens,
            completionTokens: usage.completion_tokens,
          });
        }
        const trimmed = content.trim();
        return { text: trimmed === NO_BACKGROUND_ANSWER_TOKEN || trimmed === '' ? null : trimmed };
      } catch (error) {
        const wrapped =
          error instanceof GeneralBackgroundProviderError
            ? error
            : new GeneralBackgroundProviderError(
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
            `General background call failed (attempt ${attempt}/${maxAttempts}, reason: ` +
              `${wrapped.failureReason}, retryable: ${wrapped.retryable}): ${wrapped.message}`,
          );
          throw wrapped;
        }
        const backoffMs = config.retryBaseDelayMs * 2 ** (attempt - 1);
        await delay(backoffMs);
      }
    }
    throw (
      lastError ??
      new GeneralBackgroundProviderError(
        'General background call failed for an unknown reason.',
        'provider-unavailable',
        false,
      )
    );
  }

  private async attemptOnce(
    system: string,
    question: string,
    config: ReturnType<AnalysisConfigService['get']>,
    callerSignal?: AbortSignal,
  ): Promise<{
    content: string;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  }> {
    const controller = new AbortController();
    let callerAborted = callerSignal?.aborted === true;
    const abortFromCaller = (): void => {
      callerAborted = true;
      controller.abort();
    };
    if (callerAborted) controller.abort();
    else callerSignal?.addEventListener('abort', abortFromCaller, { once: true });

    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

    let response: Response;
    try {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.openAiApiKey}`,
        },
        body: JSON.stringify({
          model: config.openAiModel,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: question },
          ],
          temperature: 0.2,
          max_completion_tokens: GENERAL_BACKGROUND_MAX_COMPLETION_TOKENS,
        }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new GeneralBackgroundProviderError(
          callerAborted
            ? 'General background call cancelled because the response deadline expired.'
            : 'General background call timed out.',
          'provider-timeout',
          false,
          error,
        );
      }
      throw new GeneralBackgroundProviderError(
        'Failed to reach OpenAI.',
        'provider-unavailable',
        true,
        error,
      );
    } finally {
      clearTimeout(timeout);
      callerSignal?.removeEventListener('abort', abortFromCaller);
    }

    if (response.status === 401 || response.status === 403) {
      throw new GeneralBackgroundProviderError(
        'OpenAI rejected the configured API key.',
        'provider-auth',
        false,
      );
    }
    if (response.status === 429) {
      throw new GeneralBackgroundProviderError(
        'OpenAI rate limit exceeded.',
        'provider-rate-limited',
        true,
      );
    }
    if (isServerErrorStatus(response.status)) {
      throw new GeneralBackgroundProviderError(
        `OpenAI responded with status ${response.status}.`,
        'provider-unavailable',
        true,
      );
    }
    if (!response.ok) {
      throw new GeneralBackgroundProviderError(
        `OpenAI responded with status ${response.status}.`,
        'provider-unavailable',
        false,
      );
    }

    let payload: {
      choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    try {
      payload = await response.json();
    } catch (error) {
      throw new GeneralBackgroundProviderError(
        'OpenAI returned a malformed (non-JSON) response.',
        'malformed-output',
        false,
        error,
      );
    }
    const choice = payload.choices?.[0];
    if (choice?.finish_reason === 'length') {
      throw new GeneralBackgroundProviderError(
        'OpenAI response was truncated because it hit the model output length limit.',
        'malformed-output',
        false,
      );
    }
    const content = choice?.message?.content;
    if (content === undefined || content === null) {
      throw new GeneralBackgroundProviderError(
        'OpenAI response did not include a message.',
        'malformed-output',
        false,
      );
    }
    return { content, usage: payload.usage };
  }
}

/** Same boot-time deterministic selection pattern as `resolveActiveAnalysisProvider`. */
export function resolveActiveGeneralBackgroundProvider(
  openAiApiKey: string | undefined,
  mockProvider: GeneralBackgroundProvider,
  openAiProvider: GeneralBackgroundProvider,
): GeneralBackgroundProvider {
  return isUsableOpenAiApiKey(openAiApiKey) ? openAiProvider : mockProvider;
}
