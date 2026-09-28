import { Logger } from '@nestjs/common';
import { OpenAiAnalysisProvider } from './openai-analysis.provider';
import type { AnalysisConfigService } from '../config/analysis-config.service';
import type { AnalysisProviderInput } from '../interfaces/analysis-provider.interface';

function makeConfigService(
  overrides: {
    openAiApiKey?: string | undefined;
    timeoutMs?: number;
    retryAttempts?: number;
    retryBaseDelayMs?: number;
    maxCompletionTokens?: number;
  } = {},
): AnalysisConfigService {
  return {
    get: () => ({
      maxArticles: 8,
      maxArticleChars: 1200,
      timeoutMs: 5000,
      cacheTtlSeconds: 300,
      openAiApiKey: 'sk-test-key',
      openAiModel: 'gpt-4o-mini',
      executionMode: 'development' as const,
      retryAttempts: 2,
      retryBaseDelayMs: 5, // kept tiny so retry tests stay fast
      maxCompletionTokens: 2000,
      ...overrides,
    }),
  } as unknown as AnalysisConfigService;
}

function makeInput(): AnalysisProviderInput {
  return {
    query: 'test query',
    articles: [
      {
        id: 'a1',
        title: 'Title',
        summary: 'Summary',
        url: 'https://example.com/a1',
        sourceId: 'src',
        sourceName: 'Source',
        category: 'world',
        sourcesCount: 1,
        publishedAt: new Date().toISOString(),
      },
    ],
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function validCompletionBody(overrides: Partial<{ content: string; finish_reason: string }> = {}) {
  return {
    choices: [
      {
        message: { content: overrides.content ?? JSON.stringify({ headline: 'H' }) },
        finish_reason: overrides.finish_reason ?? 'stop',
      },
    ],
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
  };
}

/**
 * ASK R2 CONSOLIDATED INTEGRATION R1 · GATE E — the public Ask execution policy on the real
 * provider: a caller ceiling on model attempts (F 02 R-1, ASK_MODEL_MAX_ATTEMPTS = 1) and
 * the usage sink the compute meter settles on. The harness above is the provider spec’s own.
 */
describe('OpenAiAnalysisProvider — Ask execution policy', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('CONTROL: without a ceiling, a retryable failure is retried under the landed policy (3 calls)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(503, {}));
    const provider = new OpenAiAnalysisProvider(makeConfigService());
    await expect(provider.analyzeNews(makeInput())).rejects.toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('maxModelAttempts = 1: a retryable failure makes exactly ONE request', async () => {
    fetchMock.mockResolvedValue(jsonResponse(503, {}));
    const provider = new OpenAiAnalysisProvider(makeConfigService());
    await expect(
      provider.analyzeNews({ ...makeInput(), maxModelAttempts: 1 }),
    ).rejects.toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('a ceiling can only LOWER the count — 5 does not exceed the landed policy of 3', async () => {
    fetchMock.mockResolvedValue(jsonResponse(503, {}));
    const provider = new OpenAiAnalysisProvider(makeConfigService());
    await expect(
      provider.analyzeNews({ ...makeInput(), maxModelAttempts: 5 }),
    ).rejects.toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it.each([0, -1, 1.5, Number.NaN])(
    'a malformed ceiling (%p) is ignored, never read as "unlimited"',
    async (bad) => {
      fetchMock.mockResolvedValue(jsonResponse(503, {}));
      const provider = new OpenAiAnalysisProvider(makeConfigService());
      await expect(
        provider.analyzeNews({ ...makeInput(), maxModelAttempts: bad }),
      ).rejects.toBeDefined();
      expect(fetchMock).toHaveBeenCalledTimes(3);
    },
  );

  it('the usage sink receives token COUNTS once, on success', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, validCompletionBody()));
    const sink = jest.fn();
    const provider = new OpenAiAnalysisProvider(makeConfigService());
    await provider.analyzeNews({ ...makeInput(), maxModelAttempts: 1, usageSink: sink });
    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink).toHaveBeenCalledWith({ promptTokens: 100, completionTokens: 50 });
  });

  it('the usage sink is never called on failure', async () => {
    fetchMock.mockResolvedValue(jsonResponse(503, {}));
    const sink = jest.fn();
    const provider = new OpenAiAnalysisProvider(makeConfigService());
    await expect(
      provider.analyzeNews({ ...makeInput(), maxModelAttempts: 1, usageSink: sink }),
    ).rejects.toBeDefined();
    expect(sink).not.toHaveBeenCalled();
  });
});
