import { Logger } from '@nestjs/common';
import { OpenAiAnalysisProvider, OpenAiAnalysisError } from './openai-analysis.provider';
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

describe('OpenAiAnalysisProvider', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('throws provider-not-configured (not retryable) when OPENAI_API_KEY is unusable, without calling fetch', async () => {
    const provider = new OpenAiAnalysisProvider(makeConfigService({ openAiApiKey: '   ' }));

    await expect(provider.analyzeNews(makeInput())).rejects.toMatchObject({
      failureReason: 'provider-not-configured',
      retryable: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('classifies a 401 as provider-auth and does not retry', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, {}));
    const provider = new OpenAiAnalysisProvider(makeConfigService());

    await expect(provider.analyzeNews(makeInput())).rejects.toMatchObject({
      failureReason: 'provider-auth',
      retryable: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('classifies a 403 as provider-auth and does not retry', async () => {
    fetchMock.mockResolvedValue(jsonResponse(403, {}));
    const provider = new OpenAiAnalysisProvider(makeConfigService());

    await expect(provider.analyzeNews(makeInput())).rejects.toMatchObject({
      failureReason: 'provider-auth',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a 429 and succeeds if a later attempt returns 200', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(429, {}))
      .mockResolvedValueOnce(jsonResponse(200, validCompletionBody()));
    const provider = new OpenAiAnalysisProvider(makeConfigService({ retryAttempts: 2 }));

    const result = await provider.analyzeNews(makeInput());

    expect(result).toEqual({ headline: 'H' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('classifies as provider-rate-limited after exhausting all retries on repeated 429s', async () => {
    fetchMock.mockResolvedValue(jsonResponse(429, {}));
    const provider = new OpenAiAnalysisProvider(makeConfigService({ retryAttempts: 2 }));

    await expect(provider.analyzeNews(makeInput())).rejects.toMatchObject({
      failureReason: 'provider-rate-limited',
      retryable: true,
    });
    // initial attempt + 2 retries = 3 total calls
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('retries a 5xx and succeeds if a later attempt returns 200', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(503, {}))
      .mockResolvedValueOnce(jsonResponse(200, validCompletionBody()));
    const provider = new OpenAiAnalysisProvider(makeConfigService({ retryAttempts: 2 }));

    const result = await provider.analyzeNews(makeInput());

    expect(result).toEqual({ headline: 'H' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('classifies a persistent 500 as provider-unavailable after exhausting retries', async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, {}));
    const provider = new OpenAiAnalysisProvider(makeConfigService({ retryAttempts: 1 }));

    await expect(provider.analyzeNews(makeInput())).rejects.toMatchObject({
      failureReason: 'provider-unavailable',
      retryable: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries a transient network error and succeeds if a later attempt succeeds', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('getaddrinfo ENOTFOUND api.openai.com'))
      .mockResolvedValueOnce(jsonResponse(200, validCompletionBody()));
    const provider = new OpenAiAnalysisProvider(makeConfigService({ retryAttempts: 2 }));

    const result = await provider.analyzeNews(makeInput());

    expect(result).toEqual({ headline: 'H' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry a 400 (non-transient client error)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, {}));
    const provider = new OpenAiAnalysisProvider(makeConfigService({ retryAttempts: 2 }));

    await expect(provider.analyzeNews(makeInput())).rejects.toMatchObject({
      failureReason: 'provider-unavailable',
      retryable: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('classifies an aborted (timed-out) request as provider-timeout and does not retry', async () => {
    // Simulate real fetch's behavior on an aborted AbortSignal: the
    // returned promise never resolves on its own and instead rejects
    // with an AbortError once the signal fires.
    fetchMock.mockImplementation(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => {
            const abortError = new Error('The operation was aborted.');
            abortError.name = 'AbortError';
            reject(abortError);
          });
        }),
    );
    const provider = new OpenAiAnalysisProvider(
      makeConfigService({ timeoutMs: 20, retryAttempts: 2 }),
    );

    await expect(provider.analyzeNews(makeInput())).rejects.toMatchObject({
      failureReason: 'provider-timeout',
      retryable: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('classifies a non-JSON HTTP body as malformed-output', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockRejectedValue(new Error('Unexpected token')),
    } as unknown as Response);
    const provider = new OpenAiAnalysisProvider(makeConfigService());

    await expect(provider.analyzeNews(makeInput())).rejects.toMatchObject({
      failureReason: 'malformed-output',
      retryable: false,
    });
  });

  it('classifies a response with no message content as malformed-output', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { choices: [{ message: {} }] }));
    const provider = new OpenAiAnalysisProvider(makeConfigService());

    await expect(provider.analyzeNews(makeInput())).rejects.toMatchObject({
      failureReason: 'malformed-output',
    });
  });

  it('classifies non-JSON message content as malformed-output', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, validCompletionBody({ content: 'not valid json' })),
    );
    const provider = new OpenAiAnalysisProvider(makeConfigService());

    await expect(provider.analyzeNews(makeInput())).rejects.toMatchObject({
      failureReason: 'malformed-output',
    });
  });

  it('classifies a truncated (finish_reason: "length") response as malformed-output and does not retry', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, validCompletionBody({ finish_reason: 'length' })),
    );
    const provider = new OpenAiAnalysisProvider(makeConfigService({ retryAttempts: 2 }));

    await expect(provider.analyzeNews(makeInput())).rejects.toMatchObject({
      failureReason: 'malformed-output',
      retryable: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns the parsed content on success and logs (never returns) token usage', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log');
    fetchMock.mockResolvedValue(jsonResponse(200, validCompletionBody()));
    const provider = new OpenAiAnalysisProvider(makeConfigService());

    const result = await provider.analyzeNews(makeInput());

    expect(result).toEqual({ headline: 'H' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('promptTokens=100'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('totalTokens=150'));
  });

  it('never includes the API key in a thrown error message', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, {}));
    const provider = new OpenAiAnalysisProvider(
      makeConfigService({ openAiApiKey: 'sk-super-secret-marker' }),
    );

    try {
      await provider.analyzeNews(makeInput());
      throw new Error('expected analyzeNews to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(OpenAiAnalysisError);
      expect((error as Error).message).not.toContain('sk-super-secret-marker');
    }
  });

  describe('Milestone #45 — completion token bound', () => {
    function requestBody(): Record<string, unknown> {
      const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
      return JSON.parse(init.body);
    }

    it('B1. the outgoing request contains the configured completion limit under max_completion_tokens (NOT the deprecated max_tokens)', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, validCompletionBody()));
      const provider = new OpenAiAnalysisProvider(makeConfigService({ maxCompletionTokens: 777 }));

      await provider.analyzeNews(makeInput());

      const body = requestBody();
      expect(body.max_completion_tokens).toBe(777);
      expect(body).not.toHaveProperty('max_tokens');
    });

    it('a different configured value is reflected exactly (proves it is read from config, not hard-coded)', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, validCompletionBody()));
      const provider = new OpenAiAnalysisProvider(makeConfigService({ maxCompletionTokens: 42 }));

      await provider.analyzeNews(makeInput());

      expect(requestBody().max_completion_tokens).toBe(42);
    });

    it('B2. the configured model is unchanged by this milestone', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, validCompletionBody()));
      const provider = new OpenAiAnalysisProvider(makeConfigService());

      await provider.analyzeNews(makeInput());

      expect(requestBody().model).toBe('gpt-4o-mini');
    });

    it('B3. the structured response_format (json_schema) is unchanged by this milestone', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, validCompletionBody()));
      const provider = new OpenAiAnalysisProvider(makeConfigService());

      await provider.analyzeNews(makeInput());

      const body = requestBody();
      expect((body.response_format as { type: string }).type).toBe('json_schema');
      expect(body.response_format).toHaveProperty('json_schema');
    });

    it('B4. temperature is unchanged by this milestone', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, validCompletionBody()));
      const provider = new OpenAiAnalysisProvider(makeConfigService());

      await provider.analyzeNews(makeInput());

      expect(requestBody().temperature).toBe(0.2);
    });

    it('B5. the API key appears only in the Authorization header, never in the request body or the returned result', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, validCompletionBody()));
      const provider = new OpenAiAnalysisProvider(
        makeConfigService({ openAiApiKey: 'sk-marker-b5' }),
      );

      const result = await provider.analyzeNews(makeInput());

      const [, init] = fetchMock.mock.calls[0] as [
        string,
        { headers: Record<string, string>; body: string },
      ];
      expect(init.headers.Authorization).toBe('Bearer sk-marker-b5');
      expect(init.body).not.toContain('sk-marker-b5');
      expect(JSON.stringify(result)).not.toContain('sk-marker-b5');
    });
  });
});
