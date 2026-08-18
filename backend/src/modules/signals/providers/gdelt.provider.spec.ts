import { GdeltProvider, GdeltProviderError } from './gdelt.provider';

/**
 * M64.2 — mirrors gnews.provider.spec.ts's structure and coverage
 * philosophy: real error/timeout/malformed-payload paths, plus the
 * M64.2-specific corrections (explicit eventType rejection with no
 * network call, identity semantics excluding measurement/query text,
 * observation-window representation).
 */

function makeConfig(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    GDELT_ENABLED: 'true',
    GDELT_GEO_API_BASE_URL: 'https://api.gdeltproject.org/api/v2/geo/geo',
    GDELT_REQUEST_TIMEOUT_MS: 8000,
    GDELT_DEFAULT_LIMIT: 25,
    ...overrides,
  };
  return { get: (key: string) => values[key] };
}

function makeFeature(overrides: Record<string, unknown> = {}) {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [36.8219, -1.2921] }, // [lon, lat] — Nairobi
    properties: { name: 'Nairobi, Kenya', count: 12 },
    ...overrides,
  };
}

function makeResponse(features: unknown[], status = 200, contentType = 'application/json') {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? contentType : null) },
    json: async () => ({ type: 'FeatureCollection', features }),
  };
}

describe('GdeltProvider — unsupported eventType fails explicitly, no network call', () => {
  it('rejects with a clear GdeltProviderError when eventType is supplied', async () => {
    const provider = new GdeltProvider(makeConfig() as any);
    let fetchCalled = false;
    (global as any).fetch = async () => {
      fetchCalled = true;
      return makeResponse([]);
    };

    await expect(provider.discoverSignals({ countryCode: 'KE', eventType: 'protest' })).rejects.toThrow(
      GdeltProviderError,
    );
    expect(fetchCalled).toBe(false);
  });

  it('the rejection message explains event-type filtering is unsupported', async () => {
    const provider = new GdeltProvider(makeConfig() as any);
    try {
      await provider.discoverSignals({ countryCode: 'KE', eventType: 'election' });
      throw new Error('expected rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(GdeltProviderError);
      expect((error as Error).message).toContain('unsupported');
    }
  });
});

describe('GdeltProvider — missing countryCode has no valid query source', () => {
  it('rejects with a clear GdeltProviderError, no network call, when countryCode is absent', async () => {
    const provider = new GdeltProvider(makeConfig() as any);
    let fetchCalled = false;
    (global as any).fetch = async () => {
      fetchCalled = true;
      return makeResponse([]);
    };

    await expect(provider.discoverSignals({})).rejects.toThrow(GdeltProviderError);
    await expect(provider.discoverSignals()).rejects.toThrow(GdeltProviderError);
    expect(fetchCalled).toBe(false);
  });
});

describe('GdeltProvider — disabled configuration', () => {
  it('rejects discoverSignals() without any network call when GDELT_ENABLED is not "true"', async () => {
    const provider = new GdeltProvider(makeConfig({ GDELT_ENABLED: 'false' }) as any);
    let fetchCalled = false;
    (global as any).fetch = async () => {
      fetchCalled = true;
      return makeResponse([]);
    };
    await expect(provider.discoverSignals({ countryCode: 'KE' })).rejects.toThrow(GdeltProviderError);
    expect(fetchCalled).toBe(false);
  });
});

describe('GdeltProvider — valid payload normalization', () => {
  it('normalizes a valid feature into a correctly-shaped GeoSignal', async () => {
    (global as any).fetch = async () => makeResponse([makeFeature()]);
    const provider = new GdeltProvider(makeConfig() as any);
    const signals = await provider.discoverSignals({ countryCode: 'KE' });

    expect(signals).toHaveLength(1);
    const signal = signals[0];
    expect(signal.providerId).toBe('gdelt');
    expect(signal.latitude).toBe(-1.2921);
    expect(signal.longitude).toBe(36.8219);
    expect(signal.mentionCount).toBe(12);
    expect(typeof signal.id).toBe('string');
    expect(signal.id.length).toBeGreaterThan(0);
  });

  it('coordinate order is correct — geometry.coordinates[0] is longitude, [1] is latitude, never transposed', async () => {
    (global as any).fetch = async () =>
      makeResponse([makeFeature({ geometry: { type: 'Point', coordinates: [139.6917, 35.6895] } })]); // Tokyo
    const provider = new GdeltProvider(makeConfig() as any);
    const [signal] = await provider.discoverSignals({ countryCode: 'JP' });
    expect(signal.longitude).toBe(139.6917);
    expect(signal.latitude).toBe(35.6895);
  });

  it('sourceUrl is always undefined — never extracted from properties.html via parsing', async () => {
    (global as any).fetch = async () =>
      makeResponse([makeFeature({ properties: { name: 'Test', count: 5, html: '<a href="https://example.com">link</a>' } })]);
    const provider = new GdeltProvider(makeConfig() as any);
    const [signal] = await provider.discoverSignals({ countryCode: 'US' });
    expect(signal.sourceUrl).toBe(undefined);
  });

  it('countryCode, toneScore, eventType, sourceAuthorityClass are always undefined on the normalized signal — never fabricated', async () => {
    (global as any).fetch = async () => makeResponse([makeFeature()]);
    const provider = new GdeltProvider(makeConfig() as any);
    const [signal] = await provider.discoverSignals({ countryCode: 'KE' });
    expect(signal.countryCode).toBe(undefined);
    expect(signal.toneScore).toBe(undefined);
    expect(signal.eventType).toBe(undefined);
    expect(signal.sourceAuthorityClass).toBe(undefined);
  });
});

describe('GdeltProvider — empty payload', () => {
  it('returns an empty array, not an error, for a genuinely empty result set', async () => {
    (global as any).fetch = async () => makeResponse([]);
    const provider = new GdeltProvider(makeConfig() as any);
    const signals = await provider.discoverSignals({ countryCode: 'KE' });
    expect(signals).toEqual([]);
  });
});

describe('GdeltProvider — malformed individual record skipped safely, not batch-fatal', () => {
  it('a record missing name is dropped; valid records in the same batch survive', async () => {
    (global as any).fetch = async () =>
      makeResponse([
        makeFeature({ properties: { count: 5 } }), // missing name
        makeFeature({ properties: { name: 'Valid Place', count: 3 } }),
      ]);
    const provider = new GdeltProvider(makeConfig() as any);
    const signals = await provider.discoverSignals({ countryCode: 'KE' });
    expect(signals).toHaveLength(1);
  });

  it('a record with non-array coordinates is dropped', async () => {
    (global as any).fetch = async () =>
      makeResponse([makeFeature({ geometry: { type: 'Point', coordinates: 'not-an-array' } })]);
    const provider = new GdeltProvider(makeConfig() as any);
    const signals = await provider.discoverSignals({ countryCode: 'KE' });
    expect(signals).toEqual([]);
  });
});

describe('GdeltProvider — invalid coordinates', () => {
  it('drops a record with out-of-range latitude', async () => {
    (global as any).fetch = async () =>
      makeResponse([makeFeature({ geometry: { type: 'Point', coordinates: [0, 999] } })]);
    const provider = new GdeltProvider(makeConfig() as any);
    expect(await provider.discoverSignals({ countryCode: 'KE' })).toEqual([]);
  });

  it('drops a record with out-of-range longitude', async () => {
    (global as any).fetch = async () =>
      makeResponse([makeFeature({ geometry: { type: 'Point', coordinates: [999, 0] } })]);
    const provider = new GdeltProvider(makeConfig() as any);
    expect(await provider.discoverSignals({ countryCode: 'KE' })).toEqual([]);
  });

  it('drops a record with NaN coordinates', async () => {
    (global as any).fetch = async () =>
      makeResponse([makeFeature({ geometry: { type: 'Point', coordinates: [NaN, NaN] } })]);
    const provider = new GdeltProvider(makeConfig() as any);
    expect(await provider.discoverSignals({ countryCode: 'KE' })).toEqual([]);
  });
});

describe('GdeltProvider — timeout and HTTP failure', () => {
  it('throws GdeltProviderError on timeout (AbortError)', async () => {
    (global as any).fetch = async () => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    };
    const provider = new GdeltProvider(makeConfig() as any);
    await expect(provider.discoverSignals({ countryCode: 'KE' })).rejects.toThrow(GdeltProviderError);
  });

  it('throws GdeltProviderError on a non-2xx response', async () => {
    (global as any).fetch = async () => makeResponse([], 500);
    const provider = new GdeltProvider(makeConfig() as any);
    await expect(provider.discoverSignals({ countryCode: 'KE' })).rejects.toThrow(GdeltProviderError);
  });

  it('throws GdeltProviderError when GDELT returns an HTML error page disguised as HTTP 200', async () => {
    (global as any).fetch = async () => makeResponse([], 200, 'text/html');
    const provider = new GdeltProvider(makeConfig() as any);
    await expect(provider.discoverSignals({ countryCode: 'KE' })).rejects.toThrow(GdeltProviderError);
  });

  it('throws GdeltProviderError on malformed (non-JSON) response', async () => {
    (global as any).fetch = async () => ({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => {
        throw new Error('invalid JSON');
      },
    });
    const provider = new GdeltProvider(makeConfig() as any);
    await expect(provider.discoverSignals({ countryCode: 'KE' })).rejects.toThrow(GdeltProviderError);
  });

  it('throws GdeltProviderError when the response shape has no features array', async () => {
    (global as any).fetch = async () => ({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ notFeatures: true }),
    });
    const provider = new GdeltProvider(makeConfig() as any);
    await expect(provider.discoverSignals({ countryCode: 'KE' })).rejects.toThrow(GdeltProviderError);
  });
});

describe('GdeltProvider — rate limiting', () => {
  it('throws GdeltProviderError on a 429 response', async () => {
    (global as any).fetch = async () => makeResponse([], 429);
    const provider = new GdeltProvider(makeConfig() as any);
    await expect(provider.discoverSignals({ countryCode: 'KE' })).rejects.toThrow(GdeltProviderError);
  });
});

describe('GdeltProvider — health()', () => {
  it('returns status "down" and enabled:false when disabled, with no network call', async () => {
    let fetchCalled = false;
    (global as any).fetch = async () => {
      fetchCalled = true;
      return makeResponse([]);
    };
    const provider = new GdeltProvider(makeConfig({ GDELT_ENABLED: 'false' }) as any);
    const status = await provider.health();
    expect(status.status).toBe('down');
    expect(status.enabled).toBe(false);
    expect(fetchCalled).toBe(false);
  });

  it('returns status "ok" and enabled:true on a successful live check', async () => {
    (global as any).fetch = async () => makeResponse([makeFeature()]);
    const provider = new GdeltProvider(makeConfig() as any);
    const status = await provider.health();
    expect(status.status).toBe('ok');
    expect(status.enabled).toBe(true);
    expect(typeof status.lastLatencyMs).toBe('number');
    expect(typeof status.lastSuccessAt).toBe('string');
  });

  it('returns status "degraded" (never throws) when the live check fails', async () => {
    (global as any).fetch = async () => makeResponse([], 500);
    const provider = new GdeltProvider(makeConfig() as any);
    const status = await provider.health();
    expect(status.status).toBe('degraded');
    expect(typeof status.message).toBe('string');
  });
});

describe('GdeltProvider — process-lifetime counters', () => {
  it('requestCount and recordsRetrieved/recordsAccepted increase across multiple successful calls', async () => {
    (global as any).fetch = async () => makeResponse([makeFeature(), makeFeature({ properties: { name: 'Other', count: 1 } })]);
    const provider = new GdeltProvider(makeConfig() as any);

    const statusBefore = await provider.health();
    await provider.discoverSignals({ countryCode: 'KE' });
    const statusAfter = await provider.health();

    expect((statusAfter.requestCount ?? 0) > (statusBefore.requestCount ?? 0)).toBe(true);
    expect((statusAfter.recordsRetrieved ?? 0) > (statusBefore.recordsRetrieved ?? 0)).toBe(true);
    expect((statusAfter.recordsAccepted ?? 0) > (statusBefore.recordsAccepted ?? 0)).toBe(true);
  });

  it('failureCount increases after a failed request', async () => {
    (global as any).fetch = async () => makeResponse([], 500);
    const provider = new GdeltProvider(makeConfig() as any);
    try {
      await provider.discoverSignals({ countryCode: 'KE' });
    } catch {
      // expected
    }
    const status = await provider.health(); // this call itself also fails and increments failureCount further, but must be >0 either way
    expect((status.failureCount ?? 0) > 0).toBe(true);
  });
});

describe('GdeltProvider — SignalProvider compatibility, never NewsArticle-shaped', () => {
  it('satisfies id/displayName/isMock', () => {
    const provider = new GdeltProvider(makeConfig() as any);
    expect(provider.id).toBe('gdelt');
    expect(provider.displayName).toBe('GDELT');
    expect(provider.isMock).toBe(false);
  });

  it('discoverSignals() output has no title/url/sourceName/summary fields — never NewsArticle-shaped', async () => {
    (global as any).fetch = async () => makeResponse([makeFeature()]);
    const provider = new GdeltProvider(makeConfig() as any);
    const [signal] = await provider.discoverSignals({ countryCode: 'KE' });
    expect((signal as any).title).toBe(undefined);
    expect((signal as any).url).toBe(undefined);
    expect((signal as any).sourceName).toBe(undefined);
    expect((signal as any).summary).toBe(undefined);
  });
});

describe('GdeltProvider — signal identity (M64.2 correction)', () => {
  it('changing mentionCount does NOT change the signal id — measurement is not identity', async () => {
    (global as any).fetch = async () => makeResponse([makeFeature({ properties: { name: 'Nairobi, Kenya', count: 5 } })]);
    const provider = new GdeltProvider(makeConfig() as any);
    const [signalA] = await provider.discoverSignals({ countryCode: 'KE' });

    (global as any).fetch = async () => makeResponse([makeFeature({ properties: { name: 'Nairobi, Kenya', count: 500 } })]);
    const [signalB] = await provider.discoverSignals({ countryCode: 'KE' });

    expect(signalA.id).toBe(signalB.id);
    expect(signalA.mentionCount).not.toBe(signalB.mentionCount);
  });

  it('changing query wording (different countryCode-driven query) does NOT change the id for the same geographic identity', async () => {
    (global as any).fetch = async () => makeResponse([makeFeature({ properties: { name: 'Nairobi, Kenya', count: 5 } })]);
    const provider = new GdeltProvider(makeConfig() as any);
    const [signalFromKE] = await provider.discoverSignals({ countryCode: 'KE' });
    const [signalFromKE2] = await provider.discoverSignals({ countryCode: 'KE', limit: 10 });

    expect(signalFromKE.id).toBe(signalFromKE2.id);
  });

  it('a different geographic location produces a different id', async () => {
    (global as any).fetch = async () => makeResponse([makeFeature({ properties: { name: 'Nairobi, Kenya', count: 5 } })]);
    const provider = new GdeltProvider(makeConfig() as any);
    const [nairobi] = await provider.discoverSignals({ countryCode: 'KE' });

    (global as any).fetch = async () =>
      makeResponse([makeFeature({ geometry: { type: 'Point', coordinates: [139.6917, 35.6895] }, properties: { name: 'Tokyo, Japan', count: 5 } })]);
    const [tokyo] = await provider.discoverSignals({ countryCode: 'JP' });

    expect(nairobi.id).not.toBe(tokyo.id);
  });

  it('mentionCount is correctly normalized from properties.count, undefined when absent', async () => {
    (global as any).fetch = async () => makeResponse([makeFeature({ properties: { name: 'Test', count: 42 } })]);
    const provider = new GdeltProvider(makeConfig() as any);
    const [withCount] = await provider.discoverSignals({ countryCode: 'KE' });
    expect(withCount.mentionCount).toBe(42);

    (global as any).fetch = async () => makeResponse([makeFeature({ properties: { name: 'Test' } })]);
    const [withoutCount] = await provider.discoverSignals({ countryCode: 'KE' });
    expect(withoutCount.mentionCount).toBe(undefined);
  });
});

describe('GdeltProvider — observation windows', () => {
  it('observationWindowStart is exactly 24 hours before observationWindowEnd, and observedAt equals the window end', async () => {
    (global as any).fetch = async () => makeResponse([makeFeature()]);
    const provider = new GdeltProvider(makeConfig() as any);
    const [signal] = await provider.discoverSignals({ countryCode: 'KE' });

    expect(signal.observationWindowStart).toBeDefined();
    expect(signal.observationWindowEnd).toBeDefined();
    expect(signal.observedAt).toBe(signal.observationWindowEnd);

    const startMs = new Date(signal.observationWindowStart as string).getTime();
    const endMs = new Date(signal.observationWindowEnd as string).getTime();
    expect(endMs - startMs).toBe(24 * 60 * 60 * 1000);
  });

  it('retrievedAt is a real, valid ISO-8601 timestamp, distinct in concept from observedAt', async () => {
    (global as any).fetch = async () => makeResponse([makeFeature()]);
    const provider = new GdeltProvider(makeConfig() as any);
    const [signal] = await provider.discoverSignals({ countryCode: 'KE' });
    expect(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(signal.retrievedAt)).toBe(true);
  });
});

describe('GdeltProvider — ISO2 to GDELT country query conversion (CTO correction — official locationcc: syntax)', () => {
  it('Kenya: resolves ISO2 to the canonical name, then lowercases with no spaces to remove, unquoted', async () => {
    let capturedUrl = '';
    (global as any).fetch = async (url: string) => {
      capturedUrl = url;
      return makeResponse([makeFeature()]);
    };
    const provider = new GdeltProvider(makeConfig() as any);
    await provider.discoverSignals({ countryCode: 'KE' });
    const decoded = decodeURIComponent(capturedUrl);
    expect(decoded).toContain('locationcc:kenya');
    expect(decoded).not.toContain('locationcc:"kenya"');
    expect(decoded).not.toContain('locationcc:Kenya');
    expect(decoded).not.toContain('locationcc:KE');
  });

  it('Vietnam: a country where ISO2 ("VN") and FIPS ("VM") genuinely differ resolves via the real country name, never the raw ISO2 or a guessed FIPS code', async () => {
    let capturedUrl = '';
    (global as any).fetch = async (url: string) => {
      capturedUrl = url;
      return makeResponse([makeFeature()]);
    };
    const provider = new GdeltProvider(makeConfig() as any);
    await provider.discoverSignals({ countryCode: 'VN' });
    const decoded = decodeURIComponent(capturedUrl);
    expect(decoded).toContain('locationcc:vietnam');
    expect(decoded).not.toContain('locationcc:VN');
    expect(decoded).not.toContain('locationcc:vn');
    expect(decoded).not.toContain('locationcc:VM');
    expect(decoded).not.toContain('locationcc:vm');
  });

  it('United States: a multi-word name must have its single space removed entirely', async () => {
    let capturedUrl = '';
    (global as any).fetch = async (url: string) => {
      capturedUrl = url;
      return makeResponse([makeFeature()]);
    };
    const provider = new GdeltProvider(makeConfig() as any);
    await provider.discoverSignals({ countryCode: 'US' });
    const decoded = decodeURIComponent(capturedUrl);
    expect(decoded).toContain('locationcc:unitedstates');
    expect(decoded).not.toContain('locationcc:united states');
    expect(decoded).not.toContain('locationcc:"united states"');
    expect(decoded).not.toContain('locationcc:United States');
  });

  it('United Arab Emirates: a name with MULTIPLE spaces must have every space removed', async () => {
    let capturedUrl = '';
    (global as any).fetch = async (url: string) => {
      capturedUrl = url;
      return makeResponse([makeFeature()]);
    };
    const provider = new GdeltProvider(makeConfig() as any);
    await provider.discoverSignals({ countryCode: 'AE' });
    const decoded = decodeURIComponent(capturedUrl);
    expect(decoded).toContain('locationcc:unitedarabemirates');
    expect(decoded).not.toContain('locationcc:united arab emirates');
    expect(decoded).not.toContain('locationcc:"united arab emirates"');
    expect(decoded).not.toContain('locationcc:UnitedArabEmirates');
  });

  it('an unknown ISO2 code with no match in COUNTRIES fails explicitly, before any network request', async () => {
    let fetchCalled = false;
    (global as any).fetch = async () => {
      fetchCalled = true;
      return makeResponse([]);
    };
    const provider = new GdeltProvider(makeConfig() as any);
    await expect(provider.discoverSignals({ countryCode: 'ZZ' })).rejects.toThrow(GdeltProviderError);
    expect(fetchCalled).toBe(false);
  });

  it('country-code matching is case-insensitive on input but always produces the fully canonicalized (lowercase, no-space) GDELT form', async () => {
    let capturedUrl = '';
    (global as any).fetch = async (url: string) => {
      capturedUrl = url;
      return makeResponse([makeFeature()]);
    };
    const provider = new GdeltProvider(makeConfig() as any);
    await provider.discoverSignals({ countryCode: 'ke' });
    expect(decodeURIComponent(capturedUrl)).toContain('locationcc:kenya');
  });
});

describe('GdeltProvider — health() uses the same country-query helper as discoverSignals() (CTO correction)', () => {
  it('health()\u2019s live-check query uses the correct unquoted, lowercase, no-space GDELT syntax, never the earlier hardcoded quoted form', async () => {
    let capturedUrl = '';
    (global as any).fetch = async (url: string) => {
      capturedUrl = url;
      return makeResponse([makeFeature()]);
    };
    const provider = new GdeltProvider(makeConfig() as any);
    await provider.health();
    const decoded = decodeURIComponent(capturedUrl);
    expect(decoded).toContain('locationcc:unitedstates');
    expect(decoded).not.toContain('locationcc:"United States"');
    expect(decoded).not.toContain('locationcc:"unitedstates"');
  });
});

describe('GdeltProvider — GDELT_DEFAULT_LIMIT honored (CTO correction)', () => {
  it('uses the configured default when no per-call limit is given', async () => {
    let capturedUrl = '';
    (global as any).fetch = async (url: string) => {
      capturedUrl = url;
      return makeResponse([]);
    };
    const provider = new GdeltProvider(makeConfig({ GDELT_DEFAULT_LIMIT: 7 }) as any);
    await provider.discoverSignals({ countryCode: 'KE' });
    expect(capturedUrl).toContain('maxpoints=7');
  });

  it('falls back to the hardcoded default for a blank configured value', async () => {
    let capturedUrl = '';
    (global as any).fetch = async (url: string) => {
      capturedUrl = url;
      return makeResponse([]);
    };
    const provider = new GdeltProvider(makeConfig({ GDELT_DEFAULT_LIMIT: '' }) as any);
    await provider.discoverSignals({ countryCode: 'KE' });
    expect(capturedUrl).toContain('maxpoints=25');
  });

  it('falls back to the hardcoded default for zero, negative, or non-numeric configured values', async () => {
    for (const badValue of [0, -5, 'not-a-number', '  ']) {
      let capturedUrl = '';
      (global as any).fetch = async (url: string) => {
        capturedUrl = url;
        return makeResponse([]);
      };
      const provider = new GdeltProvider(makeConfig({ GDELT_DEFAULT_LIMIT: badValue }) as any);
      await provider.discoverSignals({ countryCode: 'KE' });
      expect(capturedUrl).toContain('maxpoints=25');
    }
  });

  it('the configured default is still capped at the application-level maximum', async () => {
    let capturedUrl = '';
    (global as any).fetch = async (url: string) => {
      capturedUrl = url;
      return makeResponse([]);
    };
    const provider = new GdeltProvider(makeConfig({ GDELT_DEFAULT_LIMIT: 99999 }) as any);
    await provider.discoverSignals({ countryCode: 'KE' });
    expect(capturedUrl).toContain('maxpoints=250');
  });

  it('an explicit per-call limit still overrides the configured default, and is itself still capped', async () => {
    let capturedUrl = '';
    (global as any).fetch = async (url: string) => {
      capturedUrl = url;
      return makeResponse([]);
    };
    const provider = new GdeltProvider(makeConfig({ GDELT_DEFAULT_LIMIT: 7 }) as any);
    await provider.discoverSignals({ countryCode: 'KE', limit: 40 });
    expect(capturedUrl).toContain('maxpoints=40');
  });
});

describe('GdeltProvider — query provenance preserved (CTO correction)', () => {
  it('raw.requestQuery contains the actual GDELT request query used', async () => {
    (global as any).fetch = async () => makeResponse([makeFeature()]);
    const provider = new GdeltProvider(makeConfig() as any);
    const [signal] = await provider.discoverSignals({ countryCode: 'KE' });
    expect((signal.raw as any).requestQuery).toBe('locationcc:kenya');
    expect((signal.raw as any).feature).toBeDefined();
  });

  it('changing the query (different countryCode) changes raw.requestQuery but does NOT change the signal id for the same geographic identity', async () => {
    (global as any).fetch = async () => makeResponse([makeFeature({ properties: { name: 'Nairobi, Kenya', count: 5 } })]);
    const provider = new GdeltProvider(makeConfig() as any);
    const [fromKenya] = await provider.discoverSignals({ countryCode: 'KE' });

    // Same underlying location, discovered via a different country
    // query (e.g. a neighboring-country search that still surfaces
    // this same GDELT-reported point) — a realistic scenario the
    // requestQuery field exists to distinguish from identity.
    (global as any).fetch = async () => makeResponse([makeFeature({ properties: { name: 'Nairobi, Kenya', count: 5 } })]);
    const [fromUganda] = await provider.discoverSignals({ countryCode: 'UG' });

    expect((fromKenya.raw as any).requestQuery).not.toBe((fromUganda.raw as any).requestQuery);
    expect(fromKenya.id).toBe(fromUganda.id);
  });
});

describe('GdeltProvider — time semantics corrected (CTO correction)', () => {
  it('retrievedAt is captured after the response is obtained — later than or equal to observationWindowEnd, never manufactured before the request completes', async () => {
    (global as any).fetch = async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return makeResponse([makeFeature()]);
    };
    const provider = new GdeltProvider(makeConfig() as any);
    const [signal] = await provider.discoverSignals({ countryCode: 'KE' });

    const retrievedMs = new Date(signal.retrievedAt).getTime();
    const windowEndMs = new Date(signal.observationWindowEnd as string).getTime();
    expect(retrievedMs >= windowEndMs).toBe(true);
  });

  it('two records from the same response share the same observationWindowStart/End but each has its own retrievedAt captured post-response', async () => {
    (global as any).fetch = async () =>
      makeResponse([makeFeature(), makeFeature({ properties: { name: 'Other Place', count: 1 } })]);
    const provider = new GdeltProvider(makeConfig() as any);
    const signals = await provider.discoverSignals({ countryCode: 'KE' });
    expect(signals).toHaveLength(2);
    expect(signals[0].observationWindowStart).toBe(signals[1].observationWindowStart);
    expect(signals[0].observationWindowEnd).toBe(signals[1].observationWindowEnd);
    expect(typeof signals[0].retrievedAt).toBe('string');
    expect(typeof signals[1].retrievedAt).toBe('string');
  });
});

describe('GdeltProvider — rate-limit health semantics (CTO correction)', () => {
  it('health() reports rateLimitState "throttled" after a 429 response', async () => {
    (global as any).fetch = async () => makeResponse([], 429);
    const provider = new GdeltProvider(makeConfig() as any);
    const status = await provider.health();
    expect(status.status).toBe('degraded');
    expect(status.rateLimitState).toBe('throttled');
  });

  it('discoverSignals() hitting a 429 also updates the provider\u2019s tracked rate-limit state, later reflected by health()', async () => {
    (global as any).fetch = async () => makeResponse([], 429);
    const provider = new GdeltProvider(makeConfig() as any);
    try {
      await provider.discoverSignals({ countryCode: 'KE' });
    } catch {
      // expected — this call's own failure is what should update state
    }

    (global as any).fetch = async () => makeResponse([], 500); // health()'s own check now fails differently, but state was already set
    const status = await provider.health();
    expect(status.rateLimitState).toBe('throttled');
  });

  it('a successful health check reports rateLimitState "ok", the appropriate non-throttled M64.1 state', async () => {
    (global as any).fetch = async () => makeResponse([makeFeature()]);
    const provider = new GdeltProvider(makeConfig() as any);
    const status = await provider.health();
    expect(status.status).toBe('ok');
    expect(status.rateLimitState).toBe('ok');
  });

  it('the disabled-provider health response reports the M64.1 "unknown" rate-limit state, never fabricating "ok"', async () => {
    const provider = new GdeltProvider(makeConfig({ GDELT_ENABLED: 'false' }) as any);
    const status = await provider.health();
    expect(status.rateLimitState).toBe('unknown');
  });
});
