import { SignalsService, SignalsUnavailableError } from './signals.service';
import type { GeoSignal, GeoSignalQueryOptions, ProviderHealthStatus } from '@globalnews-ai/shared';
import type { SignalProvider } from './interfaces';

/**
 * M64.3 — exercises SignalsService directly (no real Nest container
 * needed here, matching this codebase's existing pattern of testing
 * *Service classes as plain constructor-injected classes — see
 * gdelt.provider.spec.ts's own approach). Real DI compilation is
 * covered separately in signals.module.spec.ts.
 */

function makeSignal(overrides: Partial<GeoSignal> = {}): GeoSignal {
  return {
    id: 'signal-1',
    providerId: 'test-provider',
    observedAt: '2026-08-18T10:00:00.000Z',
    retrievedAt: '2026-08-18T10:05:00.000Z',
    ...overrides,
  };
}

function makeHealth(overrides: Partial<ProviderHealthStatus> = {}): ProviderHealthStatus {
  return {
    providerId: 'test-provider',
    displayName: 'Test Provider',
    status: 'ok',
    checkedAt: '2026-08-18T10:00:00.000Z',
    ...overrides,
  };
}

function makeProvider(
  id: string,
  behavior: {
    signals?: GeoSignal[];
    signalsError?: Error;
    health?: ProviderHealthStatus;
    healthError?: Error;
  } = {},
): SignalProvider {
  return {
    id,
    displayName: id,
    isMock: false,
    discoverSignals: async (_options?: GeoSignalQueryOptions) => {
      if (behavior.signalsError) throw behavior.signalsError;
      return behavior.signals ?? [];
    },
    health: async () => {
      if (behavior.healthError) throw behavior.healthError;
      return behavior.health ?? makeHealth({ providerId: id, displayName: id });
    },
  };
}

describe('SignalsService — zero enabled providers', () => {
  it('throws SignalsUnavailableError, never returns an empty array as if it were a successful zero-result query', async () => {
    const service = new SignalsService([], []);
    await expect(service.discoverSignals()).rejects.toThrow(SignalsUnavailableError);
  });

  it('the error message names the honest reason: no providers enabled', async () => {
    const service = new SignalsService([], []);
    try {
      await service.discoverSignals();
      throw new Error('expected rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(SignalsUnavailableError);
      expect((error as Error).message).toContain('No signal providers are currently enabled');
    }
  });
});

describe('SignalsService — single provider success', () => {
  it('returns the provider\u2019s signals unchanged when exactly one enabled provider succeeds', async () => {
    const gdelt = makeProvider('gdelt', { signals: [makeSignal({ id: 'a' }), makeSignal({ id: 'b' })] });
    const service = new SignalsService([gdelt], [gdelt]);
    const signals = await service.discoverSignals();
    expect(signals).toHaveLength(2);
    expect(signals.map((s) => s.id).sort()).toEqual(['a', 'b']);
  });
});

describe('SignalsService — provider failure', () => {
  it('a single enabled provider failing throws SignalsUnavailableError (all enabled providers failed)', async () => {
    const gdelt = makeProvider('gdelt', { signalsError: new Error('GDELT unreachable') });
    const service = new SignalsService([gdelt], [gdelt]);
    await expect(service.discoverSignals()).rejects.toThrow(SignalsUnavailableError);
  });

  it('SignalsUnavailableError carries the failed provider id for diagnosis', async () => {
    const gdelt = makeProvider('gdelt', { signalsError: new Error('boom') });
    const service = new SignalsService([gdelt], [gdelt]);
    try {
      await service.discoverSignals();
      throw new Error('expected rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(SignalsUnavailableError);
      expect((error as SignalsUnavailableError).failedProviderIds).toEqual(['gdelt']);
    }
  });
});

describe('SignalsService — future multi-provider partial success', () => {
  it('one provider failing does NOT discard another provider\u2019s successful results', async () => {
    const working = makeProvider('working-provider', { signals: [makeSignal({ id: 'ok-1' })] });
    const broken = makeProvider('broken-provider', { signalsError: new Error('down') });
    const service = new SignalsService([working, broken], [working, broken]);

    const signals = await service.discoverSignals();
    expect(signals).toHaveLength(1);
    expect(signals[0].id).toBe('ok-1');
  });

  it('both providers succeeding merges their results together', async () => {
    const providerA = makeProvider('provider-a', { signals: [makeSignal({ id: 'a1' })] });
    const providerB = makeProvider('provider-b', { signals: [makeSignal({ id: 'b1' })] });
    const service = new SignalsService([providerA, providerB], [providerA, providerB]);

    const signals = await service.discoverSignals();
    expect(signals.map((s) => s.id).sort()).toEqual(['a1', 'b1']);
  });
});

describe('SignalsService — stable-ID deduplication', () => {
  it('a signal id appearing twice within one provider\u2019s own batch is kept once', async () => {
    const gdelt = makeProvider('gdelt', {
      signals: [makeSignal({ id: 'dup' }), makeSignal({ id: 'dup' }), makeSignal({ id: 'unique' })],
    });
    const service = new SignalsService([gdelt], [gdelt]);
    const signals = await service.discoverSignals();
    expect(signals).toHaveLength(2);
    expect(signals.map((s) => s.id).sort()).toEqual(['dup', 'unique']);
  });

  it('the same signal id from two different providers is merged into one result, first occurrence kept', async () => {
    const providerA = makeProvider('provider-a', { signals: [makeSignal({ id: 'shared', providerId: 'provider-a' })] });
    const providerB = makeProvider('provider-b', { signals: [makeSignal({ id: 'shared', providerId: 'provider-b' })] });
    const service = new SignalsService([providerA, providerB], [providerA, providerB]);

    const signals = await service.discoverSignals();
    expect(signals).toHaveLength(1);
    expect(signals[0].providerId).toBe('provider-a');
  });
});

describe('SignalsService — health aggregation over ALL_SIGNAL_PROVIDERS', () => {
  it('includes every registered provider, even one that is currently disabled (absent from the enabled list)', async () => {
    const gdelt = makeProvider('gdelt', { health: makeHealth({ providerId: 'gdelt', displayName: 'GDELT', status: 'down' }) });
    // gdelt is registered (present in allProviders) but NOT enabled
    // (absent from providers) — exactly the GDELT_ENABLED=false case.
    const service = new SignalsService([], [gdelt]);

    const health = await service.providersHealth();
    expect(health).toHaveLength(1);
    expect(health[0].providerId).toBe('gdelt');
  });

  it('preserves each provider\u2019s own real health status, not a generic aggregate', async () => {
    const ok = makeProvider('ok-provider', { health: makeHealth({ providerId: 'ok-provider', status: 'ok' }) });
    const degraded = makeProvider('degraded-provider', { health: makeHealth({ providerId: 'degraded-provider', status: 'degraded' }) });
    const service = new SignalsService([ok, degraded], [ok, degraded]);

    const health = await service.providersHealth();
    const byId = Object.fromEntries(health.map((h) => [h.providerId, h.status]));
    expect(byId['ok-provider']).toBe('ok');
    expect(byId['degraded-provider']).toBe('degraded');
  });

  it('a provider whose health() call itself throws is reported as "down", not propagated as an exception', async () => {
    const broken = makeProvider('broken', { healthError: new Error('health check exploded') });
    const service = new SignalsService([], [broken]);

    const health = await service.providersHealth();
    expect(health).toHaveLength(1);
    expect(health[0].status).toBe('down');
    expect(health[0].providerId).toBe('broken');
  });

  it('health aggregation never requires any provider to be in the enabled SIGNAL_PROVIDERS list', async () => {
    const gdelt = makeProvider('gdelt');
    const service = new SignalsService([], [gdelt]); // zero enabled, one registered
    const health = await service.providersHealth();
    expect(health).toHaveLength(1);
  });
});
