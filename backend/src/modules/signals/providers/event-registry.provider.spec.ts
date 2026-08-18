import { EventRegistryProvider, EventRegistryProviderError } from './event-registry.provider';

/**
 * M64.4 — mirrors gdelt.provider.spec.ts's structure and coverage
 * philosophy, adapted for Event Registry's own honest-rejection
 * contract (query required, countryCode/eventType unsupported) and
 * its real API-key requirement (unlike GDELT).
 */

function makeConfig(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    EVENT_REGISTRY_ENABLED: 'true',
    EVENT_REGISTRY_API_KEY: 'test-key-12345',
    EVENT_REGISTRY_BASE_URL: 'https://eventregistry.org/api/v1/event/getEvents',
    EVENT_REGISTRY_REQUEST_TIMEOUT_MS: 8000,
    ...overrides,
  };
  return { get: (key: string) => values[key] };
}

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    uri: '3403979',
    eventDate: '2016-04-24',
    totalArticleCount: 100,
    sentiment: -0.2,
    ...overrides,
  };
}

function makeResponse(events: unknown[], status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ events: { totalResults: events.length, page: 1, count: events.length, pages: 1, results: events } }),
  };
}

describe('EventRegistryProvider — query required (M64.4 explicit design)', () => {
  it('rejects with a clear EventRegistryProviderError when query is missing, no network call', async () => {
    const provider = new EventRegistryProvider(makeConfig() as any);
    let fetchCalled = false;
    (global as any).fetch = async () => { fetchCalled = true; return makeResponse([]); };

    await expect(provider.discoverSignals({})).rejects.toThrow(EventRegistryProviderError);
    await expect(provider.discoverSignals()).rejects.toThrow(EventRegistryProviderError);
    expect(fetchCalled).toBe(false);
  });

  it('rejects a blank/whitespace-only query, no network call', async () => {
    const provider = new EventRegistryProvider(makeConfig() as any);
    let fetchCalled = false;
    (global as any).fetch = async () => { fetchCalled = true; return makeResponse([]); };

    await expect(provider.discoverSignals({ query: '   ' })).rejects.toThrow(EventRegistryProviderError);
    expect(fetchCalled).toBe(false);
  });

  it('a genuine non-blank query is accepted and mapped to a single-element keyword parameter, never the structured query object', async () => {
    let capturedUrl = '';
    (global as any).fetch = async (url: string) => { capturedUrl = url; return makeResponse([makeEvent()]); };
    const provider = new EventRegistryProvider(makeConfig() as any);
    await provider.discoverSignals({ query: 'Barack Obama' });
    // URLSearchParams correctly encodes a space as "+" (standard
    // application/x-www-form-urlencoded convention) — decodeURIComponent
    // does not convert "+" back to a space, so the correctly-encoded
    // form is checked directly rather than via decodeURIComponent.
    expect(capturedUrl).toContain('keyword=Barack+Obama');
    expect(capturedUrl).not.toContain('&query=');
  });
});

describe('EventRegistryProvider — countryCode and eventType unsupported (M64.4 explicit design)', () => {
  it('rejects countryCode before any network call', async () => {
    const provider = new EventRegistryProvider(makeConfig() as any);
    let fetchCalled = false;
    (global as any).fetch = async () => { fetchCalled = true; return makeResponse([]); };
    await expect(provider.discoverSignals({ query: 'test', countryCode: 'KE' })).rejects.toThrow(EventRegistryProviderError);
    expect(fetchCalled).toBe(false);
  });

  it('rejects eventType before any network call', async () => {
    const provider = new EventRegistryProvider(makeConfig() as any);
    let fetchCalled = false;
    (global as any).fetch = async () => { fetchCalled = true; return makeResponse([]); };
    await expect(provider.discoverSignals({ query: 'test', eventType: 'protest' })).rejects.toThrow(EventRegistryProviderError);
    expect(fetchCalled).toBe(false);
  });

  it('countryCode is checked before query, so it rejects even without a valid query present', async () => {
    const provider = new EventRegistryProvider(makeConfig() as any);
    await expect(provider.discoverSignals({ countryCode: 'US' })).rejects.toThrow(EventRegistryProviderError);
  });
});

describe('EventRegistryProvider — limit clamping', () => {
  it('uses the default limit (25) when none is requested', async () => {
    let capturedUrl = '';
    (global as any).fetch = async (url: string) => { capturedUrl = url; return makeResponse([]); };
    const provider = new EventRegistryProvider(makeConfig() as any);
    await provider.discoverSignals({ query: 'test' });
    expect(capturedUrl).toContain('eventsCount=25');
  });

  it('an explicit limit is honored up to the documented maximum', async () => {
    let capturedUrl = '';
    (global as any).fetch = async (url: string) => { capturedUrl = url; return makeResponse([]); };
    const provider = new EventRegistryProvider(makeConfig() as any);
    await provider.discoverSignals({ query: 'test', limit: 10 });
    expect(capturedUrl).toContain('eventsCount=10');
  });

  it('a requested limit above the documented Event Registry maximum (50) is clamped down, never passed through raw', async () => {
    let capturedUrl = '';
    (global as any).fetch = async (url: string) => { capturedUrl = url; return makeResponse([]); };
    const provider = new EventRegistryProvider(makeConfig() as any);
    await provider.discoverSignals({ query: 'test', limit: 999 });
    expect(capturedUrl).toContain('eventsCount=50');
    expect(capturedUrl).not.toContain('eventsCount=999');
  });
});

describe('EventRegistryProvider — EVENT_REGISTRY_DEFAULT_LIMIT honored (CTO correction, mirrors GdeltProvider\u2019s own fix)', () => {
  it('uses the configured default when no per-call limit is given', async () => {
    let capturedUrl = '';
    (global as any).fetch = async (url: string) => { capturedUrl = url; return makeResponse([]); };
    const provider = new EventRegistryProvider(makeConfig({ EVENT_REGISTRY_DEFAULT_LIMIT: 7 }) as any);
    await provider.discoverSignals({ query: 'test' });
    expect(capturedUrl).toContain('eventsCount=7');
  });

  it('the configured default is still capped at Event Registry\u2019s documented maximum (50)', async () => {
    let capturedUrl = '';
    (global as any).fetch = async (url: string) => { capturedUrl = url; return makeResponse([]); };
    const provider = new EventRegistryProvider(makeConfig({ EVENT_REGISTRY_DEFAULT_LIMIT: 999 }) as any);
    await provider.discoverSignals({ query: 'test' });
    expect(capturedUrl).toContain('eventsCount=50');
    expect(capturedUrl).not.toContain('eventsCount=999');
  });

  it('falls back to the hardcoded default (25) for blank, zero, negative, or non-numeric configured values', async () => {
    for (const badValue of ['', 0, -5, 'not-a-number', '  ']) {
      let capturedUrl = '';
      (global as any).fetch = async (url: string) => { capturedUrl = url; return makeResponse([]); };
      const provider = new EventRegistryProvider(makeConfig({ EVENT_REGISTRY_DEFAULT_LIMIT: badValue }) as any);
      await provider.discoverSignals({ query: 'test' });
      expect(capturedUrl).toContain('eventsCount=25');
    }
  });

  it('an explicit caller-supplied limit still overrides the configured default, and is itself still capped at 50', async () => {
    let capturedUrl = '';
    (global as any).fetch = async (url: string) => { capturedUrl = url; return makeResponse([]); };
    const provider = new EventRegistryProvider(makeConfig({ EVENT_REGISTRY_DEFAULT_LIMIT: 7 }) as any);
    await provider.discoverSignals({ query: 'test', limit: 40 });
    expect(capturedUrl).toContain('eventsCount=40');
  });

  it('an explicit caller-supplied limit above 50 is still clamped to 50 even when a smaller configured default exists', async () => {
    let capturedUrl = '';
    (global as any).fetch = async (url: string) => { capturedUrl = url; return makeResponse([]); };
    const provider = new EventRegistryProvider(makeConfig({ EVENT_REGISTRY_DEFAULT_LIMIT: 7 }) as any);
    await provider.discoverSignals({ query: 'test', limit: 200 });
    expect(capturedUrl).toContain('eventsCount=50');
  });
});

describe('EventRegistryProvider — API key required when enabled', () => {
  it('rejects with a clear error, no network call, when the API key is missing', async () => {
    const provider = new EventRegistryProvider(makeConfig({ EVENT_REGISTRY_API_KEY: undefined }) as any);
    let fetchCalled = false;
    (global as any).fetch = async () => { fetchCalled = true; return makeResponse([]); };
    await expect(provider.discoverSignals({ query: 'test' })).rejects.toThrow(EventRegistryProviderError);
    expect(fetchCalled).toBe(false);
  });

  it('rejects with a clear error, no network call, when the API key is whitespace-only', async () => {
    const provider = new EventRegistryProvider(makeConfig({ EVENT_REGISTRY_API_KEY: '   ' }) as any);
    let fetchCalled = false;
    (global as any).fetch = async () => { fetchCalled = true; return makeResponse([]); };
    await expect(provider.discoverSignals({ query: 'test' })).rejects.toThrow(EventRegistryProviderError);
    expect(fetchCalled).toBe(false);
  });

  it('a real, non-blank key is accepted and sent as the apiKey query parameter', async () => {
    let capturedUrl = '';
    (global as any).fetch = async (url: string) => { capturedUrl = url; return makeResponse([]); };
    const provider = new EventRegistryProvider(makeConfig({ EVENT_REGISTRY_API_KEY: 'real-key-999' }) as any);
    await provider.discoverSignals({ query: 'test' });
    expect(capturedUrl).toContain('apiKey=real-key-999');
  });
});

describe('EventRegistryProvider — disabled provider makes no network call', () => {
  it('discoverSignals() rejects immediately when EVENT_REGISTRY_ENABLED is not "true", no fetch', async () => {
    const provider = new EventRegistryProvider(makeConfig({ EVENT_REGISTRY_ENABLED: 'false' }) as any);
    let fetchCalled = false;
    (global as any).fetch = async () => { fetchCalled = true; return makeResponse([]); };
    await expect(provider.discoverSignals({ query: 'test' })).rejects.toThrow(EventRegistryProviderError);
    expect(fetchCalled).toBe(false);
  });

  it('health() reports "down" and enabled:false when disabled, no fetch', async () => {
    const provider = new EventRegistryProvider(makeConfig({ EVENT_REGISTRY_ENABLED: 'false' }) as any);
    let fetchCalled = false;
    (global as any).fetch = async () => { fetchCalled = true; return makeResponse([]); };
    const status = await provider.health();
    expect(status.status).toBe('down');
    expect(status.enabled).toBe(false);
    expect(fetchCalled).toBe(false);
  });
});

describe('EventRegistryProvider — valid normalization', () => {
  it('normalizes a valid event into a correctly-shaped GeoSignal', async () => {
    (global as any).fetch = async () => makeResponse([makeEvent()]);
    const provider = new EventRegistryProvider(makeConfig() as any);
    const signals = await provider.discoverSignals({ query: 'Obama' });

    expect(signals).toHaveLength(1);
    const signal = signals[0];
    expect(signal.id).toBe('3403979');
    expect(signal.providerId).toBe('event-registry');
    expect(signal.mentionCount).toBe(100);
    expect(signal.toneScore).toBe(-0.2);
  });

  it('geography (countryCode/latitude/longitude) and eventType/sourceUrl are always undefined — never fabricated', async () => {
    (global as any).fetch = async () => makeResponse([makeEvent()]);
    const provider = new EventRegistryProvider(makeConfig() as any);
    const [signal] = await provider.discoverSignals({ query: 'Obama' });
    expect(signal.countryCode).toBe(undefined);
    expect(signal.latitude).toBe(undefined);
    expect(signal.longitude).toBe(undefined);
    expect(signal.eventType).toBe(undefined);
    expect(signal.sourceUrl).toBe(undefined);
    expect(signal.sourceAuthorityClass).toBe(undefined);
  });
});

describe('EventRegistryProvider — event date normalization (M64.4 explicit requirement)', () => {
  it('observedAt is the provider eventDate with T00:00:00.000Z appended as a normalization convention', async () => {
    (global as any).fetch = async () => makeResponse([makeEvent({ eventDate: '2016-04-24' })]);
    const provider = new EventRegistryProvider(makeConfig() as any);
    const [signal] = await provider.discoverSignals({ query: 'test' });
    expect(signal.observedAt).toBe('2016-04-24T00:00:00.000Z');
  });

  it('the original, un-normalized provider date is preserved unchanged in raw.event.eventDate', async () => {
    (global as any).fetch = async () => makeResponse([makeEvent({ eventDate: '2016-04-24' })]);
    const provider = new EventRegistryProvider(makeConfig() as any);
    const [signal] = await provider.discoverSignals({ query: 'test' });
    expect((signal.raw as any).event.eventDate).toBe('2016-04-24');
  });

  it('observationWindowStart/End remain undefined — Event Registry supplies no window, unlike GDELT', async () => {
    (global as any).fetch = async () => makeResponse([makeEvent()]);
    const provider = new EventRegistryProvider(makeConfig() as any);
    const [signal] = await provider.discoverSignals({ query: 'test' });
    expect(signal.observationWindowStart).toBe(undefined);
    expect(signal.observationWindowEnd).toBe(undefined);
  });
});

describe('EventRegistryProvider — malformed individual events skipped safely', () => {
  it('an event missing uri is dropped; valid events in the same batch survive', async () => {
    (global as any).fetch = async () =>
      makeResponse([makeEvent({ uri: undefined }), makeEvent({ uri: 'valid-1' })]);
    const provider = new EventRegistryProvider(makeConfig() as any);
    const signals = await provider.discoverSignals({ query: 'test' });
    expect(signals).toHaveLength(1);
    expect(signals[0].id).toBe('valid-1');
  });

  it('an event missing eventDate is dropped rather than fabricating observedAt', async () => {
    (global as any).fetch = async () =>
      makeResponse([makeEvent({ eventDate: undefined }), makeEvent({ uri: 'valid-2', eventDate: '2020-01-01' })]);
    const provider = new EventRegistryProvider(makeConfig() as any);
    const signals = await provider.discoverSignals({ query: 'test' });
    expect(signals).toHaveLength(1);
    expect(signals[0].id).toBe('valid-2');
  });

  it('mentionCount and toneScore are correctly omitted (undefined) rather than defaulted when absent from an otherwise-valid event', async () => {
    (global as any).fetch = async () => makeResponse([makeEvent({ totalArticleCount: undefined, sentiment: undefined })]);
    const provider = new EventRegistryProvider(makeConfig() as any);
    const [signal] = await provider.discoverSignals({ query: 'test' });
    expect(signal.mentionCount).toBe(undefined);
    expect(signal.toneScore).toBe(undefined);
  });
});

describe('EventRegistryProvider — timeout, HTTP failure, auth failure, rate limit, malformed payload', () => {
  it('throws on timeout (AbortError)', async () => {
    (global as any).fetch = async () => { const e = new Error('aborted'); e.name = 'AbortError'; throw e; };
    const provider = new EventRegistryProvider(makeConfig() as any);
    await expect(provider.discoverSignals({ query: 'test' })).rejects.toThrow(EventRegistryProviderError);
  });

  it('distinguishes a 401 authentication failure with its own specific message', async () => {
    (global as any).fetch = async () => makeResponse([], 401);
    const provider = new EventRegistryProvider(makeConfig() as any);
    try {
      await provider.discoverSignals({ query: 'test' });
      throw new Error('expected rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(EventRegistryProviderError);
      expect((error as Error).message).toContain('rejected the configured API key');
    }
  });

  it('distinguishes a 403 authentication failure the same way as 401', async () => {
    (global as any).fetch = async () => makeResponse([], 403);
    const provider = new EventRegistryProvider(makeConfig() as any);
    try {
      await provider.discoverSignals({ query: 'test' });
      throw new Error('expected rejection');
    } catch (error) {
      expect((error as Error).message).toContain('rejected the configured API key');
    }
  });

  it('throws on a 429 rate-limit response, distinct from a generic auth/server failure', async () => {
    (global as any).fetch = async () => makeResponse([], 429);
    const provider = new EventRegistryProvider(makeConfig() as any);
    try {
      await provider.discoverSignals({ query: 'test' });
      throw new Error('expected rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(EventRegistryProviderError);
      expect((error as EventRegistryProviderError).isRateLimit).toBe(true);
    }
  });

  it('throws on a generic 500 server failure', async () => {
    (global as any).fetch = async () => makeResponse([], 500);
    const provider = new EventRegistryProvider(makeConfig() as any);
    await expect(provider.discoverSignals({ query: 'test' })).rejects.toThrow(EventRegistryProviderError);
  });

  it('throws on malformed (non-JSON) response', async () => {
    (global as any).fetch = async () => ({ ok: true, status: 200, json: async () => { throw new Error('bad json'); } });
    const provider = new EventRegistryProvider(makeConfig() as any);
    await expect(provider.discoverSignals({ query: 'test' })).rejects.toThrow(EventRegistryProviderError);
  });

  it('throws when the response has no events envelope at all', async () => {
    (global as any).fetch = async () => ({ ok: true, status: 200, json: async () => ({ notEvents: true }) });
    const provider = new EventRegistryProvider(makeConfig() as any);
    await expect(provider.discoverSignals({ query: 'test' })).rejects.toThrow(EventRegistryProviderError);
  });
});

describe('EventRegistryProvider — stable identity regardless of query/mentionCount changes', () => {
  it('the same event.uri produces the same GeoSignal.id across different queries', async () => {
    (global as any).fetch = async () => makeResponse([makeEvent({ uri: 'stable-uri' })]);
    const provider = new EventRegistryProvider(makeConfig() as any);
    const [a] = await provider.discoverSignals({ query: 'query one' });
    const [b] = await provider.discoverSignals({ query: 'a completely different query' });
    expect(a.id).toBe(b.id);
    expect(a.id).toBe('stable-uri');
  });

  it('the same event.uri produces the same id even when totalArticleCount changes between fetches', async () => {
    (global as any).fetch = async () => makeResponse([makeEvent({ uri: 'stable-uri-2', totalArticleCount: 5 })]);
    const provider = new EventRegistryProvider(makeConfig() as any);
    const [a] = await provider.discoverSignals({ query: 'test' });

    (global as any).fetch = async () => makeResponse([makeEvent({ uri: 'stable-uri-2', totalArticleCount: 500 })]);
    const [b] = await provider.discoverSignals({ query: 'test' });

    expect(a.id).toBe(b.id);
    expect(a.mentionCount).not.toBe(b.mentionCount);
  });
});

describe('EventRegistryProvider — health states and counters', () => {
  it('returns "ok" and enabled:true on a successful live check', async () => {
    (global as any).fetch = async () => makeResponse([makeEvent()]);
    const provider = new EventRegistryProvider(makeConfig() as any);
    const status = await provider.health();
    expect(status.status).toBe('ok');
    expect(status.enabled).toBe(true);
    expect(typeof status.lastLatencyMs).toBe('number');
  });

  it('returns "degraded" (never throws) when the live check fails', async () => {
    (global as any).fetch = async () => makeResponse([], 500);
    const provider = new EventRegistryProvider(makeConfig() as any);
    const status = await provider.health();
    expect(status.status).toBe('degraded');
  });

  it('reports rateLimitState "throttled" after a 429', async () => {
    (global as any).fetch = async () => makeResponse([], 429);
    const provider = new EventRegistryProvider(makeConfig() as any);
    const status = await provider.health();
    expect(status.rateLimitState).toBe('throttled');
  });

  it('requestCount/recordsRetrieved/recordsAccepted increase across successful calls', async () => {
    (global as any).fetch = async () => makeResponse([makeEvent(), makeEvent({ uri: 'other' })]);
    const provider = new EventRegistryProvider(makeConfig() as any);
    const before = await provider.health();
    await provider.discoverSignals({ query: 'test' });
    const after = await provider.health();
    expect((after.requestCount ?? 0) > (before.requestCount ?? 0)).toBe(true);
    expect((after.recordsRetrieved ?? 0) > (before.recordsRetrieved ?? 0)).toBe(true);
    expect((after.recordsAccepted ?? 0) > (before.recordsAccepted ?? 0)).toBe(true);
  });
});

describe('EventRegistryProvider — SignalProvider compatibility, never NewsArticle-shaped', () => {
  it('satisfies id/displayName/isMock', () => {
    const provider = new EventRegistryProvider(makeConfig() as any);
    expect(provider.id).toBe('event-registry');
    expect(provider.displayName).toBe('Event Registry');
    expect(provider.isMock).toBe(false);
  });

  it('discoverSignals() output has no title/url/sourceName/summary fields', async () => {
    (global as any).fetch = async () => makeResponse([makeEvent()]);
    const provider = new EventRegistryProvider(makeConfig() as any);
    const [signal] = await provider.discoverSignals({ query: 'test' });
    expect((signal as any).title).toBe(undefined);
    expect((signal as any).url).toBe(undefined);
    expect((signal as any).sourceName).toBe(undefined);
  });
});
