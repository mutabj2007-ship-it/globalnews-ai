import {
  GNewsProvider,
  GNewsProviderError,
  resolveProviderFailureKind,
  type ProviderFailureKind,
} from './gnews.provider';

/**
 * R4 REGRESSION 13 — the provider failure distinction, as a checked-in test.
 *
 * WHY THIS FILE EXISTS. The approved punctuation/provider-failure correction
 * introduced the four failure kinds and proved them with a one-off harness
 * rather than a committed spec. A harness proves a thing once; a spec keeps
 * proving it. The distinction is load-bearing — AnalysisService suppresses its
 * bounded fallback on every kind EXCEPT a genuine live zero-result — so a
 * silent regression here would quietly restore the exact behavior the real
 * host measured: a deterministic HTTP 400 read as an empty world, a second
 * identical malformed request sent, and a 429 earned for it.
 *
 * Each case below maps a real HTTP status onto the kind the correction
 * assigned it, with the reason that classification is the right one.
 */

function makeConfig(apiKey: string | undefined): { get: jest.Mock } {
  return { get: jest.fn().mockReturnValue(apiKey) };
}

function statusResponse(status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ articles: [] }),
  } as unknown as Response;
}

async function kindFromStatus(status: number): Promise<ProviderFailureKind> {
  global.fetch = jest.fn().mockResolvedValue(statusResponse(status));
  const provider = new GNewsProvider(makeConfig('test-key') as never);
  try {
    await provider.search('anything');
  } catch (error) {
    return resolveProviderFailureKind(error);
  }
  throw new Error(`expected status ${status} to throw`);
}

describe('GNews provider failure kinds — 400 / 429 / auth / outage stay distinguishable', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('400 is bad-request — our own malformed query; re-sending it earns the same refusal', async () => {
    await expect(kindFromStatus(400)).resolves.toBe('bad-request');
  });

  it('404 and 422 are also bad-request — any non-auth, non-rate-limit 4xx is our request being wrong', async () => {
    await expect(kindFromStatus(404)).resolves.toBe('bad-request');
    await expect(kindFromStatus(422)).resolves.toBe('bad-request');
  });

  it('401 is auth while 403 is quota - credential failure and exhausted allowance stay distinct', async () => {
    await expect(kindFromStatus(401)).resolves.toBe('auth');
    await expect(kindFromStatus(403)).resolves.toBe('quota');
  });

  it('429 is rate-limited — a second call is certain to fail and steals the next caller’s slot', async () => {
    await expect(kindFromStatus(429)).resolves.toBe('rate-limited');
  });

  it('5xx is unavailable — the provider’s own failure, not ours', async () => {
    await expect(kindFromStatus(500)).resolves.toBe('unavailable');
    await expect(kindFromStatus(503)).resolves.toBe('unavailable');
  });

  it('an auth failure never echoes anything key-shaped back', async () => {
    global.fetch = jest.fn().mockResolvedValue(statusResponse(401));
    const provider = new GNewsProvider(makeConfig('a-very-long-looking-secret-value') as never);
    await expect(provider.search('markets')).rejects.toThrow(/rejected the configured API key/i);
    await provider.search('markets').catch((error: unknown) => {
      expect(String((error as Error).message)).not.toMatch(/[A-Za-z0-9]{20,}/);
    });
  });
});

describe('resolveProviderFailureKind — the conservative default is the safe one', () => {
  it('classifies an unrecognised error as unavailable, never as a deterministic defect', () => {
    expect(resolveProviderFailureKind(new Error('something else entirely'))).toBe('unavailable');
    expect(resolveProviderFailureKind(undefined)).toBe('unavailable');
    expect(resolveProviderFailureKind('a string')).toBe('unavailable');
  });

  it('a GNewsProviderError constructed without a kind defaults to unavailable', () => {
    expect(resolveProviderFailureKind(new GNewsProviderError('boom'))).toBe('unavailable');
  });

  it('carries an explicitly classified kind through unchanged', () => {
    expect(
      resolveProviderFailureKind(new GNewsProviderError('boom', undefined, 'bad-request')),
    ).toBe('bad-request');
  });
});
