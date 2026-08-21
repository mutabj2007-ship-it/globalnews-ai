import type { NewsArticle, ProviderHealthStatus } from '@globalnews-ai/shared';
import type { NewsProvider } from '../interfaces';
import {
  NewsProviderRegistrationError,
  collectRegisteredNewsProviders,
  selectActiveNewsProviders,
} from './news-provider-registry';

/**
 * E1 — the active-provider rule, tested as a pure function,
 * independent of NestJS DI. news.module.spec.ts proves the real
 * container wires this same function to the real provider instances.
 */

class StubProvider implements NewsProvider {
  constructor(
    readonly id: string,
    readonly isMock: boolean,
  ) {}

  readonly displayName = `Stub ${this.id}`;

  async search(): Promise<NewsArticle[]> {
    return [];
  }

  async topHeadlines(): Promise<NewsArticle[]> {
    return [];
  }

  async category(): Promise<NewsArticle[]> {
    return [];
  }

  async health(): Promise<ProviderHealthStatus> {
    return {
      providerId: this.id,
      displayName: this.displayName,
      status: 'ok',
      checkedAt: '2026-01-01T00:00:00.000Z',
    };
  }
}

const mockProvider = new StubProvider('mock-wire', true);

describe('selectActiveNewsProviders', () => {
  it('uses the single configured real provider, and NOT the mock provider (the pre-E1 behaviour, unchanged)', () => {
    const real = new StubProvider('gnews', false);

    const active = selectActiveNewsProviders({
      realCandidates: [{ provider: real, isConfigured: true }],
      mockProvider,
    });

    expect(active).toEqual([real]);
    expect(active).not.toContain(mockProvider);
  });

  it('uses MockNewsProvider only when ZERO real providers are configured', () => {
    const real = new StubProvider('gnews', false);

    const active = selectActiveNewsProviders({
      realCandidates: [{ provider: real, isConfigured: false }],
      mockProvider,
    });

    expect(active).toEqual([mockProvider]);
  });

  it('uses MockNewsProvider when the build registers no real providers at all', () => {
    expect(selectActiveNewsProviders({ realCandidates: [], mockProvider })).toEqual([mockProvider]);
  });

  it('accumulates MULTIPLE configured real providers, in registration order — the structural capability E1 exists to add', () => {
    const first = new StubProvider('gnews', false);
    const second = new StubProvider('second-real-wire', false);
    const third = new StubProvider('third-real-wire', false);

    const active = selectActiveNewsProviders({
      realCandidates: [
        { provider: first, isConfigured: true },
        { provider: second, isConfigured: true },
        { provider: third, isConfigured: true },
      ],
      mockProvider,
    });

    expect(active).toEqual([first, second, third]);
  });

  it('includes only the CONFIGURED real providers when several are registered but not all are configured', () => {
    const configured = new StubProvider('gnews', false);
    const unconfigured = new StubProvider('second-real-wire', false);

    const active = selectActiveNewsProviders({
      realCandidates: [
        { provider: configured, isConfigured: false },
        { provider: unconfigured, isConfigured: true },
      ],
      mockProvider,
    });

    expect(active).toEqual([unconfigured]);
  });

  it('NEVER mixes the mock provider with real providers, under any combination of configured flags', () => {
    const first = new StubProvider('gnews', false);
    const second = new StubProvider('second-real-wire', false);

    for (const firstConfigured of [true, false]) {
      for (const secondConfigured of [true, false]) {
        const active = selectActiveNewsProviders({
          realCandidates: [
            { provider: first, isConfigured: firstConfigured },
            { provider: second, isConfigured: secondConfigured },
          ],
          mockProvider,
        });

        const hasReal = active.some((provider) => !provider.isMock);
        const hasMock = active.some((provider) => provider.isMock);

        expect(hasReal && hasMock).toBe(false);
        expect(active.length).toBeGreaterThan(0);
      }
    }
  });

  it('refuses to admit a provider that reports isMock=true as a real candidate — fails closed rather than blending synthetic data into a real response', () => {
    const disguisedMock = new StubProvider('sneaky-mock', true);

    expect(() =>
      selectActiveNewsProviders({
        realCandidates: [{ provider: disguisedMock, isConfigured: true }],
        mockProvider,
      }),
    ).toThrow(NewsProviderRegistrationError);
  });

  it('refuses a real provider passed as the mock fallback', () => {
    expect(() =>
      selectActiveNewsProviders({
        realCandidates: [],
        mockProvider: new StubProvider('gnews', false),
      }),
    ).toThrow(NewsProviderRegistrationError);
  });
});

describe('collectRegisteredNewsProviders', () => {
  it('always contains every registered provider — mock included — regardless of what is configured', () => {
    const real = new StubProvider('gnews', false);

    const registered = collectRegisteredNewsProviders({
      realCandidates: [{ provider: real, isConfigured: false }],
      mockProvider,
    });

    expect(registered).toEqual([mockProvider, real]);
  });

  it('grows with every registered real provider, so an inactive provider stays visible to provider health', () => {
    const first = new StubProvider('gnews', false);
    const second = new StubProvider('second-real-wire', false);

    const registered = collectRegisteredNewsProviders({
      realCandidates: [
        { provider: first, isConfigured: true },
        { provider: second, isConfigured: false },
      ],
      mockProvider,
    });

    expect(registered).toEqual([mockProvider, first, second]);
  });
});
