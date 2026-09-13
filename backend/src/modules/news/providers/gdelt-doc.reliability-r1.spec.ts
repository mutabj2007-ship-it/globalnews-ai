import { ConfigService } from '@nestjs/config';
import { GdeltDocProvider, GdeltDocProviderError } from './gdelt-doc.provider';

/**
 * G-GDELT-DOC-ALPHA-RELIABILITY-R1 — corrections A and B.
 *
 * Every test drives the REAL provider. Nothing here reaches the network: fetch
 * is replaced, and the point of several of these tests is to prove that it is
 * NOT CALLED AT ALL.
 */

const ENABLED = { get: (k: string) => (k === 'GDELT_DOC_ENABLED' ? 'true' : undefined) } as unknown as ConfigService;

/** An abort that behaves the way undici's does: rejects with error.name === 'AbortError'. */
function abortingFetch(): jest.Mock {
  return jest.fn((_url: string, init?: { signal?: AbortSignal }) =>
    new Promise((_resolve, reject) => {
      const signal = init?.signal;
      if (signal?.aborted) {
        const e = new Error('aborted'); e.name = 'AbortError'; reject(e); return;
      }
      signal?.addEventListener('abort', () => {
        const e = new Error('The operation was aborted'); e.name = 'AbortError'; reject(e);
      });
    }),
  );
}

function okFetch(articles: unknown[]): jest.Mock {
  return jest.fn(async () => ({
    ok: true, status: 200, json: async () => ({ articles }),
  })) as unknown as jest.Mock;
}


/**
 * Attach the rejection handler BEFORE any timer is advanced.
 *
 * With fake timers the abort fires inside `advanceTimersByTimeAsync`, so a
 * promise whose handler is attached afterwards has already rejected into an
 * unhandled-rejection warning. This settles that ordering once, here, rather
 * than in every test.
 */
function settle<T>(promise: Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: any }> {
  return promise.then(
    (value) => ({ ok: true as const, value }),
    (error) => ({ ok: false as const, error }),
  );
}

const ONE_ARTICLE = [{ url: 'https://example.test/a', title: 'A title', seendate: '20260913T101500Z', domain: 'example.test', language: 'English' }];

describe('R1-A — a real timeout arms the existing cooldown', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; jest.useRealTimers(); jest.restoreAllMocks(); });

  it('opens the cooldown on an AbortError raised by the request deadline', async () => {
    jest.useFakeTimers();
    const provider = new GdeltDocProvider(ENABLED);
    global.fetch = abortingFetch() as unknown as typeof fetch;

    const inFlight = settle(provider.search('congo unrest'));
    await jest.advanceTimersByTimeAsync(8_000);

    const outcome = await inFlight;
    expect(outcome.ok).toBe(false);
    expect(outcome.ok === false && outcome.error.kind).toBe('timeout');

    // The circuit is armed, and health says so WITHOUT calling it throttling.
    const health = await provider.health();
    expect(health.status).toBe('degraded');
    expect(health.rateLimitState).not.toBe('throttled');
    expect(health.message).toContain('timed out');
    expect(health.message).toContain('did not report a rate limit');
  });

  it('keeps the failure kind as timeout — the taxonomy does not change', async () => {
    jest.useFakeTimers();
    const provider = new GdeltDocProvider(ENABLED);
    global.fetch = abortingFetch() as unknown as typeof fetch;

    const inFlight = settle(provider.search('congo unrest'));
    await jest.advanceTimersByTimeAsync(8_000);

    const outcome = await inFlight;
    expect(outcome.ok).toBe(false);
    if (outcome.ok === false) {
      expect(outcome.error).toBeInstanceOf(GdeltDocProviderError);
      expect(outcome.error.kind).toBe('timeout');
      expect((outcome.error as Error).message).toContain('timed out');
    }
  });

  it('fails the IMMEDIATELY NEXT request fast and WITHOUT touching the network', async () => {
    jest.useFakeTimers();
    const provider = new GdeltDocProvider(ENABLED);
    const fetchMock = abortingFetch();
    global.fetch = fetchMock as unknown as typeof fetch;

    const first = settle(provider.search('congo unrest'));
    await jest.advanceTimersByTimeAsync(8_000);
    expect((await first).ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // A DIFFERENT query key, so this is not in-flight collapse doing the work.
    // REV A — the refusal is truthful about WHY the circuit is open. It is a
    // timeout-origin circuit, so it is not dressed up as upstream throttling.
    const second = await settle(provider.search('kinshasa protest'));
    expect(second.ok === false && second.error.kind).toBe('timeout');
    expect(second.ok === false && (second.error as Error).message).toContain('cooldown');
    expect(second.ok === false && (second.error as Error).message).toContain(
      'did not report a rate limit',
    );

    // The decisive assertion: no second request was ever dispatched, and no
    // 5.5 s spacing wait was served either — the cooldown check precedes both.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('issues NO retry of its own for a timeout', async () => {
    jest.useFakeTimers();
    const provider = new GdeltDocProvider(ENABLED);
    const fetchMock = abortingFetch();
    global.fetch = fetchMock as unknown as typeof fetch;

    const inFlight = settle(provider.search('congo unrest'));
    await jest.advanceTimersByTimeAsync(60_000);
    const outcome = await inFlight;
    expect(outcome.ok === false && outcome.error.kind).toBe('timeout');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('may try again once the cooldown has expired', async () => {
    jest.useFakeTimers();
    const provider = new GdeltDocProvider(ENABLED);
    const fetchMock = abortingFetch();
    global.fetch = fetchMock as unknown as typeof fetch;

    const first = settle(provider.search('congo unrest'));
    await jest.advanceTimersByTimeAsync(8_000);
    expect((await first).ok).toBe(false);

    // Still inside the 60 s cooldown: refused without a request.
    await jest.advanceTimersByTimeAsync(59_000);
    const refused = await settle(provider.search('kinshasa protest'));
    expect(refused.ok === false && refused.error.kind).toBe('timeout');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Past it: the provider is willing again, and succeeds.
    await jest.advanceTimersByTimeAsync(2_000);
    global.fetch = okFetch(ONE_ARTICLE) as unknown as typeof fetch;
    const revived = settle(provider.search('goma'));
    await jest.advanceTimersByTimeAsync(6_000);
    const revivedOutcome = await revived;
    expect(revivedOutcome.ok).toBe(true);
    expect(revivedOutcome.ok === true && revivedOutcome.value).toHaveLength(1);
  });
});

describe('R1-B — health tells the truth about a provider that has never worked', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; jest.useRealTimers(); jest.restoreAllMocks(); });

  it('enabled with zero requests is healthy — absence of evidence is not degradation', async () => {
    const health = await new GdeltDocProvider(ENABLED).health();
    expect(health.status).toBe('ok');
    expect(health.enabled).toBe(true);
    expect(health.requestCount).toBe(0);
    expect(health.failureCount).toBe(0);
    expect(health.lastSuccessAt).toBeUndefined();
  });

  it('one success is healthy', async () => {
    const provider = new GdeltDocProvider(ENABLED);
    global.fetch = okFetch(ONE_ARTICLE) as unknown as typeof fetch;

    await expect(provider.search('goma')).resolves.toHaveLength(1);

    const health = await provider.health();
    expect(health.status).toBe('ok');
    expect(health.lastSuccessAt).toBeDefined();
  });

  it('repeated timeouts with zero successes report DEGRADED, not ok', async () => {
    jest.useFakeTimers();
    const provider = new GdeltDocProvider(ENABLED);
    global.fetch = abortingFetch() as unknown as typeof fetch;

    const first = settle(provider.search('congo unrest'));
    await jest.advanceTimersByTimeAsync(8_000);
    expect((await first).ok).toBe(false);

    // Step past the cooldown so `cooling` is false and only the
    // never-succeeded condition can be producing the verdict.
    await jest.advanceTimersByTimeAsync(61_000);

    const second = settle(provider.search('kinshasa protest'));
    await jest.advanceTimersByTimeAsync(8_000);
    expect((await second).ok).toBe(false);
    await jest.advanceTimersByTimeAsync(61_000);

    const health = await provider.health();
    expect(health.status).toBe('degraded');
    expect(health.enabled).toBe(true);
    expect(health.requestCount).toBe(2);
    expect(health.failureCount).toBe(2);
    expect(health.lastSuccessAt).toBeUndefined();
    expect(health.message).toContain('no request has ever succeeded');
  });

  it('stays degraded after the cooldown expires — the circuit clears, the fact does not', async () => {
    jest.useFakeTimers();
    const provider = new GdeltDocProvider(ENABLED);
    global.fetch = abortingFetch() as unknown as typeof fetch;

    const inFlight = settle(provider.search('congo unrest'));
    await jest.advanceTimersByTimeAsync(8_000);
    expect((await inFlight).ok).toBe(false);

    expect((await provider.health()).status).toBe('degraded'); // cooling
    await jest.advanceTimersByTimeAsync(61_000);
    expect((await provider.health()).status).toBe('degraded'); // never succeeded
  });

  it('an active cooldown is degraded even when a success is on record', async () => {
    jest.useFakeTimers();
    const provider = new GdeltDocProvider(ENABLED);
    global.fetch = okFetch(ONE_ARTICLE) as unknown as typeof fetch;
    const seeded = settle(provider.search('goma'));
    await jest.advanceTimersByTimeAsync(6_000);
    expect((await seeded).ok).toBe(true);
    expect((await provider.health()).status).toBe('ok');

    // 429 opens the circuit. Spacing must be stepped through first.
    global.fetch = jest.fn(async () => ({ ok: false, status: 429, json: async () => ({}) })) as unknown as typeof fetch;
    const throttled = settle(provider.search('bukavu'));
    await jest.advanceTimersByTimeAsync(6_000);
    const throttledOutcome = await throttled;
    expect(throttledOutcome.ok === false && throttledOutcome.error.kind).toBe('rate-limited');

    const health = await provider.health();
    expect(health.status).toBe('degraded');
    expect(health.rateLimitState).toBe('throttled');
    expect(health.lastSuccessAt).toBeDefined();
  });

  it('a disabled provider is still reported as switched off, not degraded', async () => {
    const off = { get: () => undefined } as unknown as ConfigService;
    const health = await new GdeltDocProvider(off).health();
    expect(health.status).toBe('down');
    expect(health.enabled).toBe(false);
  });
});

describe('R1-REV-A — a cooling circuit says truthfully WHY it is open', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; jest.useRealTimers(); jest.restoreAllMocks(); });

  it('a 429-opened circuit is still rate-limited and still throttled', async () => {
    jest.useFakeTimers();
    const provider = new GdeltDocProvider(ENABLED);
    global.fetch = jest.fn(async () => ({ ok: false, status: 429, json: async () => ({}) })) as unknown as typeof fetch;

    const first = settle(provider.search('alpha query'));
    await jest.advanceTimersByTimeAsync(1_000);
    expect((await first).ok).toBe(false);

    const cooling = await settle(provider.search('bravo query'));
    expect(cooling.ok === false && cooling.error.kind).toBe('rate-limited');
    expect(cooling.ok === false && (cooling.error as Error).message).toContain('reported a rate limit');

    const health = await provider.health();
    expect(health.rateLimitState).toBe('throttled');
    expect(health.message).toContain('GDELT asked for slower requests');
  });

  it('a connection failure is NOT called rate limiting — it was never proven', async () => {
    jest.useFakeTimers();
    const provider = new GdeltDocProvider(ENABLED);
    global.fetch = jest.fn(async () => { throw new Error('ECONNRESET'); }) as unknown as typeof fetch;

    const first = settle(provider.search('alpha query'));
    await jest.advanceTimersByTimeAsync(1_000);
    const firstOutcome = await first;
    expect(firstOutcome.ok === false && firstOutcome.error.kind).toBe('unreachable');

    const cooling = await settle(provider.search('bravo query'));
    expect(cooling.ok === false && cooling.error.kind).toBe('unreachable');
    expect(cooling.ok === false && (cooling.error as Error).message).toContain('no rate limit was reported');

    const health = await provider.health();
    expect(health.rateLimitState).not.toBe('throttled');
    expect(health.message).not.toContain('GDELT asked for slower requests');
  });

  it('a timeout-opened circuit never claims a throttle, in the error OR in health', async () => {
    jest.useFakeTimers();
    const provider = new GdeltDocProvider(ENABLED);
    const fetchMock = jest.fn((_u: string, init?: { signal?: AbortSignal }) =>
      new Promise((_r, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const e = new Error('aborted'); e.name = 'AbortError'; reject(e);
        });
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const first = settle(provider.search('alpha query'));
    await jest.advanceTimersByTimeAsync(8_000);
    expect((await first).ok).toBe(false);

    const cooling = await settle(provider.search('bravo query'));
    expect(cooling.ok === false && cooling.error.kind).toBe('timeout');
    const message = cooling.ok === false ? (cooling.error as Error).message : '';
    expect(message).not.toContain('throttle');
    expect(message).not.toContain('asked for slower requests');

    // And no network call was made to discover any of that.
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const health = await provider.health();
    expect(health.rateLimitState).not.toBe('throttled');
    expect(health.message).not.toContain('GDELT asked for slower requests');
    expect(health.message).not.toContain('throttle or reset');
  });
});
