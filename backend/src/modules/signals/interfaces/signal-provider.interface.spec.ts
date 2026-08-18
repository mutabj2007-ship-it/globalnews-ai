import type { GeoSignal, GeoSignalQueryOptions, ProviderHealthStatus } from '@globalnews-ai/shared';
import type { SignalProvider } from './signal-provider.interface';

/**
 * M64.1 — type-level and structural coverage for the SignalProvider
 * contract. No real implementation exists yet; this file proves the
 * interface itself is usable and shaped correctly via a minimal
 * in-test mock, the same pattern this codebase already uses for
 * AnalysisProvider/NewsProvider seam tests.
 */

class MinimalMockSignalProvider implements SignalProvider {
  readonly id = 'mock-signal-provider';
  readonly displayName = 'Mock Signal Provider';
  readonly isMock = true;

  private signals: GeoSignal[] = [];

  async discoverSignals(options?: GeoSignalQueryOptions): Promise<GeoSignal[]> {
    if (!options) return this.signals;
    return this.signals.filter((signal) => {
      if (options.countryCode && signal.countryCode !== options.countryCode) return false;
      if (options.eventType && signal.eventType !== options.eventType) return false;
      return true;
    });
  }

  async health(): Promise<ProviderHealthStatus> {
    return {
      providerId: this.id,
      displayName: this.displayName,
      status: 'ok',
      checkedAt: new Date().toISOString(),
    };
  }

  __setSignalsForTest(signals: GeoSignal[]): void {
    this.signals = signals;
  }
}

function buildSignal(overrides: Partial<GeoSignal> = {}): GeoSignal {
  return {
    id: 'signal-1',
    providerId: 'mock-signal-provider',
    observedAt: '2026-08-18T10:00:00.000Z',
    retrievedAt: '2026-08-18T10:05:00.000Z',
    ...overrides,
  };
}

describe('SignalProvider — interface satisfiability', () => {
  it('a minimal implementation satisfies the interface with only the required fields populated', () => {
    const provider: SignalProvider = new MinimalMockSignalProvider();
    expect(provider.id).toBe('mock-signal-provider');
    expect(provider.displayName).toBe('Mock Signal Provider');
    expect(provider.isMock).toBe(true);
  });

  it('discoverSignals() resolves to GeoSignal[], never NewsArticle[] — no title/url/sourceName fields are required or present on the returned shape', async () => {
    const provider = new MinimalMockSignalProvider();
    provider.__setSignalsForTest([buildSignal()]);
    const result = await provider.discoverSignals();
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].id).toBe('signal-1');
    expect((result[0] as unknown as { title?: string }).title).toBe(undefined);
  });

  it('health() resolves to a real ProviderHealthStatus, matching the same contract NewsProvider/AnalysisProvider already use', async () => {
    const provider = new MinimalMockSignalProvider();
    const status = await provider.health();
    expect(status.providerId).toBe('mock-signal-provider');
    expect(status.status).toBe('ok');
    expect(typeof status.checkedAt).toBe('string');
  });
});

describe('GeoSignal — required vs optional fields', () => {
  it('requires only id, providerId, observedAt, retrievedAt — everything else is optional', () => {
    const minimal = buildSignal();
    expect(minimal.id).toBe('signal-1');
    expect(minimal.providerId).toBe('mock-signal-provider');
    expect(minimal.observedAt).toBe('2026-08-18T10:00:00.000Z');
    expect(minimal.retrievedAt).toBe('2026-08-18T10:05:00.000Z');
    expect(minimal.countryCode).toBe(undefined);
    expect(minimal.latitude).toBe(undefined);
    expect(minimal.longitude).toBe(undefined);
    expect(minimal.toneScore).toBe(undefined);
    expect(minimal.sourceUrl).toBe(undefined);
    expect(minimal.eventType).toBe(undefined);
    expect(minimal.sourceAuthorityClass).toBe(undefined);
    expect(minimal.raw).toBe(undefined);
  });

  it('accepts a fully-populated example with every optional field set', () => {
    const full = buildSignal({
      eventType: 'protest',
      countryCode: 'KE',
      latitude: -1.286389,
      longitude: 36.817223,
      toneScore: -3.2,
      sourceUrl: 'https://example.com/report',
      sourceAuthorityClass: 'GOVERNMENT',
      raw: { gdeltEventId: '123456' },
    });
    expect(full.countryCode).toBe('KE');
    expect(full.sourceAuthorityClass).toBe('GOVERNMENT');
    expect(full.raw).toEqual({ gdeltEventId: '123456' });
  });
});

describe('GeoSignalQueryOptions — filtering shape used by discoverSignals()', () => {
  it('countryCode filtering excludes non-matching signals', async () => {
    const provider = new MinimalMockSignalProvider();
    provider.__setSignalsForTest([
      buildSignal({ id: 'a', countryCode: 'KE' }),
      buildSignal({ id: 'b', countryCode: 'RW' }),
    ]);
    const result = await provider.discoverSignals({ countryCode: 'KE' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  it('eventType filtering excludes non-matching signals', async () => {
    const provider = new MinimalMockSignalProvider();
    provider.__setSignalsForTest([
      buildSignal({ id: 'a', eventType: 'election' }),
      buildSignal({ id: 'b', eventType: 'protest' }),
    ]);
    const result = await provider.discoverSignals({ eventType: 'protest' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('b');
  });

  it('no options returns every signal, unfiltered', async () => {
    const provider = new MinimalMockSignalProvider();
    provider.__setSignalsForTest([buildSignal({ id: 'a' }), buildSignal({ id: 'b' })]);
    const result = await provider.discoverSignals();
    expect(result).toHaveLength(2);
  });
});
