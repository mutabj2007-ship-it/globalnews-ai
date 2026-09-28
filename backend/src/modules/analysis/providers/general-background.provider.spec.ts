import type { AnalysisConfigService } from '../config/analysis-config.service';
import { GeneralBackgroundProviderError } from '../interfaces';
import {
  MockGeneralBackgroundProvider,
  NO_BACKGROUND_ANSWER_TOKEN,
  OpenAiGeneralBackgroundProvider,
  resolveActiveGeneralBackgroundProvider,
} from './general-background.provider';

/**
 * A+H QUALIFICATION R1 — the General Background provider itself, with `fetch` mocked AT THE
 * WIRE so every model call is counted. The adapter spec proves the controls around it; this
 * proves the provider keeps its own promises: one attempt when the governed ceiling says
 * one, a decline is `null` (never invented text), a real timeout is a typed
 * `provider-timeout`, and no key means no network call.
 */
const config = (over: Record<string, unknown> = {}) =>
  ({
    get: () => ({
      openAiApiKey: 'sk-test',
      openAiModel: 'gpt-test',
      timeoutMs: 50,
      retryAttempts: 2,
      retryBaseDelayMs: 1,
      ...over,
    }),
  }) as unknown as AnalysisConfigService;

const ok = (content: string) =>
  ({
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ message: { content } }],
      usage: { prompt_tokens: 120, completion_tokens: 40 },
    }),
  }) as unknown as Response;

let fetchMock: jest.Mock;
beforeEach(() => {
  fetchMock = jest.fn();
  (globalThis as { fetch: unknown }).fetch = fetchMock;
});

describe('OpenAiGeneralBackgroundProvider — model call discipline', () => {
  it('answers with ONE call and reports usage', async () => {
    fetchMock.mockResolvedValueOnce(ok('NATO is a defensive alliance founded in 1949.'));
    const usage = jest.fn();
    const out = await new OpenAiGeneralBackgroundProvider(config()).answerBackground({
      question: 'What is NATO?',
      responseLanguage: 'en',
      maxModelAttempts: 1,
      usageSink: usage,
    });
    expect(out.text).toBe('NATO is a defensive alliance founded in 1949.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(usage).toHaveBeenCalledWith({ promptTokens: 120, completionTokens: 40 });
    /* Nothing retrieved rides along: the request is the system prompt and the question —
       no articles, no evidence, no extra messages or fields. */
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(Object.keys(body).sort()).toEqual([
      'max_completion_tokens',
      'messages',
      'model',
      'temperature',
    ]);
    expect(body.messages.map((m: { role: string }) => m.role)).toEqual(['system', 'user']);
    expect(body.messages[1].content).toBe('What is NATO?');
    expect(body.messages[0].content).toMatch(/Never invent, name, or imply a source/);
  });

  it.each([NO_BACKGROUND_ANSWER_TOKEN, `  ${NO_BACKGROUND_ANSWER_TOKEN}\n`, '', '   '])(
    'a decline (%j) is null — never invented content',
    async (content) => {
      fetchMock.mockResolvedValueOnce(ok(content));
      const out = await new OpenAiGeneralBackgroundProvider(config()).answerBackground({
        question: 'What will the stock market do tomorrow?',
        responseLanguage: 'en',
        maxModelAttempts: 1,
      });
      expect(out.text).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it('the governed ceiling (maxModelAttempts = 1) wins over the retry policy: a retryable 500 is ONE call, then fail', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    await expect(
      new OpenAiGeneralBackgroundProvider(config({ retryAttempts: 3 })).answerBackground({
        question: 'What is NATO?',
        responseLanguage: 'en',
        maxModelAttempts: 1,
      }),
    ).rejects.toBeInstanceOf(GeneralBackgroundProviderError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('a real attempt timeout is a typed provider-timeout after ONE call', async () => {
    fetchMock.mockImplementation(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => {
            const e = new Error('aborted');
            e.name = 'AbortError';
            reject(e);
          });
        }),
    );
    const error = await new OpenAiGeneralBackgroundProvider(config({ timeoutMs: 20 }))
      .answerBackground({ question: 'What is NATO?', responseLanguage: 'en', maxModelAttempts: 1 })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GeneralBackgroundProviderError);
    expect((error as GeneralBackgroundProviderError).failureReason).toBe('provider-timeout');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('an already-expired caller deadline makes NO call', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      new OpenAiGeneralBackgroundProvider(config()).answerBackground({
        question: 'What is NATO?',
        responseLanguage: 'en',
        maxModelAttempts: 1,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ failureReason: 'provider-timeout' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('no usable key: refused before any network call', async () => {
    await expect(
      new OpenAiGeneralBackgroundProvider(config({ openAiApiKey: '  ' })).answerBackground({
        question: 'What is NATO?',
        responseLanguage: 'en',
        maxModelAttempts: 1,
      }),
    ).rejects.toMatchObject({ failureReason: 'provider-not-configured' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('provider selection', () => {
  it('live only with a usable key; the mock is network-free', async () => {
    const mock = new MockGeneralBackgroundProvider();
    const live = new OpenAiGeneralBackgroundProvider(config());
    expect(resolveActiveGeneralBackgroundProvider('sk-live', mock, live)).toBe(live);
    expect(resolveActiveGeneralBackgroundProvider('', mock, live)).toBe(mock);
    expect(resolveActiveGeneralBackgroundProvider(undefined, mock, live)).toBe(mock);
    await mock.answerBackground({ question: 'q', responseLanguage: 'en' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
