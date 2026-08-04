import { Injectable, Logger } from '@nestjs/common';
import type { AnalysisProvider, AnalysisProviderInput } from '../interfaces';
import { AnalysisConfigService } from '../config/analysis-config.service';
import { buildAnalysisMessages, buildAnalysisJsonSchema } from '../prompt/build-analysis-prompt.util';

const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';

/** Raised for any OpenAI-specific failure (auth, timeout, rate limit, malformed payload). */
export class OpenAiAnalysisError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'OpenAiAnalysisError';
  }
}

interface OpenAiChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
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
 */
@Injectable()
export class OpenAiAnalysisProvider implements AnalysisProvider {
  readonly id = 'openai';
  readonly displayName = 'OpenAI';
  readonly isMock = false;

  private readonly logger = new Logger(OpenAiAnalysisProvider.name);

  constructor(private readonly analysisConfig: AnalysisConfigService) {}

  async analyzeNews({ query, articles }: AnalysisProviderInput): Promise<unknown> {
    const config = this.analysisConfig.get();
    if (!config.openAiApiKey) {
      throw new OpenAiAnalysisError('OPENAI_API_KEY is not configured.');
    }

    const { system, user } = buildAnalysisMessages(query, articles, config.maxArticleChars);

    const controller = new AbortController();
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
            json_schema: buildAnalysisJsonSchema(),
          },
          temperature: 0.2,
        }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new OpenAiAnalysisError('OpenAI request timed out.', error);
      }
      throw new OpenAiAnalysisError('Failed to reach OpenAI.', error);
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 401 || response.status === 403) {
      throw new OpenAiAnalysisError('OpenAI rejected the configured API key.');
    }
    if (response.status === 429) {
      throw new OpenAiAnalysisError('OpenAI rate limit exceeded. Try again shortly.');
    }
    if (!response.ok) {
      throw new OpenAiAnalysisError(`OpenAI responded with status ${response.status}.`);
    }

    let payload: OpenAiChatCompletionResponse;
    try {
      payload = (await response.json()) as OpenAiChatCompletionResponse;
    } catch (error) {
      throw new OpenAiAnalysisError('OpenAI returned a malformed (non-JSON) response.', error);
    }

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new OpenAiAnalysisError('OpenAI response did not include a message.');
    }

    try {
      return JSON.parse(content);
    } catch (error) {
      this.logger.warn('OpenAI returned non-JSON content in a structured-output call');
      throw new OpenAiAnalysisError('OpenAI returned an invalid analysis payload.', error);
    }
  }
}
