import { analyzeNews } from './analysisApi';

/**
 * MY INTELLIGENCE R1 — the analysis client carries a multi-story selection
 * only when one is given. Every existing caller's request body is unchanged.
 */

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

function captureBody(): { fetchMock: jest.Mock; body: () => Record<string, unknown> } {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ analysis: null }),
  } as unknown as Response);
  global.fetch = fetchMock as unknown as typeof fetch;
  return { fetchMock, body: () => JSON.parse(fetchMock.mock.calls[0][1].body as string) };
}

const REF = 'a'.repeat(64);

describe('analyzeNews selection body', () => {
  it('an ordinary question sends no selection key at all', async () => {
    const { body } = captureBody();
    await analyzeNews('Ordinary question one', 'en');
    expect(body()).toEqual({ query: 'Ordinary question one', requestedLanguage: 'en' });
  });

  it('a selection is sent as { action, stories } alongside the question', async () => {
    const { body, fetchMock } = captureBody();
    await analyzeNews('Compare the selected stories', 'pl', undefined, undefined, {
      action: 'COMPARE',
      stories: [
        { articleRef: REF, url: 'https://wire.example/a' },
        { articleRef: 'b'.repeat(64), url: 'https://wire.example/b' },
      ],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(body()).toEqual({
      query: 'Compare the selected stories',
      requestedLanguage: 'pl',
      selection: {
        action: 'COMPARE',
        stories: [
          { articleRef: REF, url: 'https://wire.example/a' },
          { articleRef: 'b'.repeat(64), url: 'https://wire.example/b' },
        ],
      },
    });
  });

  it('the same question with and without a selection are different in-flight requests', async () => {
    const { fetchMock } = captureBody();
    await Promise.all([
      analyzeNews('Shared wording', 'en'),
      analyzeNews('Shared wording', 'en', undefined, undefined, {
        action: 'SUMMARIZE',
        stories: [{ articleRef: REF, url: 'https://wire.example/a' }],
      }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
