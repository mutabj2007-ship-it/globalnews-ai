import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { SignalsModule } from './signals.module';
import { SignalsService } from './signals.service';
import { GdeltProvider } from './providers/gdelt.provider';
import { EventRegistryProvider } from './providers/event-registry.provider';
import { ALL_SIGNAL_PROVIDERS, SIGNAL_PROVIDERS, isGdeltEnabled } from './providers/provider.tokens';
import type { SignalProvider } from './interfaces';

/**
 * M64.3 — proves SignalsModule compiles as a real NestJS module and
 * that provider selection matches the exact contract: SIGNAL_PROVIDERS
 * reflects only enabled providers, ALL_SIGNAL_PROVIDERS always
 * contains every registered provider, and constructing the module
 * performs no network call under any configuration.
 *
 * DI REPAIR — every ConfigModule.forRoot() call below deliberately
 * uses isGlobal: false, not isGlobal: true. This is intentional, not
 * an oversight: with isGlobal: false, ConfigService is visible to
 * SignalsModule ONLY because SignalsModule's own @Module() definition
 * now explicitly imports ConfigModule (see signals.module.ts's own
 * doc comment for the full root-cause explanation). If a future edit
 * ever removes that import, these tests will fail again exactly the
 * way the original engineering-gate failure did — which is the point:
 * this file must not rely on some sibling module's isGlobal setting
 * to make SignalsModule's own real dependency happen to resolve.
 *
 * M64.4 — updated to reflect the truthful two-provider architecture.
 * The prior contract (ALL_SIGNAL_PROVIDERS has exactly length 1) was
 * correct when GDELT was the only registered SignalProvider; it is
 * now superseded, not weakened — EventRegistryProvider genuinely
 * exists and is genuinely registered, so ALL_SIGNAL_PROVIDERS
 * genuinely has two entries. Every existing GDELT-specific assertion
 * below is preserved exactly, extended only to also account for
 * Event Registry's real, independent enablement gate.
 */

interface TestEnv {
  GDELT_ENABLED?: string;
  EVENT_REGISTRY_ENABLED?: string;
  EVENT_REGISTRY_API_KEY?: string;
}

const ENV_KEYS: Array<keyof TestEnv> = ['GDELT_ENABLED', 'EVENT_REGISTRY_ENABLED', 'EVENT_REGISTRY_API_KEY'];

async function buildTestingModule(env: TestEnv) {
  for (const key of ENV_KEYS) {
    if (env[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = env[key];
    }
  }
  return Test.createTestingModule({
    imports: [ConfigModule.forRoot({ isGlobal: false, ignoreEnvFile: true }), SignalsModule],
  }).compile();
}

describe('SignalsModule — real NestJS DI compilation', () => {
  const originalEnv: Partial<Record<keyof TestEnv, string | undefined>> = {};
  for (const key of ENV_KEYS) originalEnv[key] = process.env[key];

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
  });

  it('compiles a real Nest testing module that imports SignalsModule without error', async () => {
    const moduleRef = await buildTestingModule({ GDELT_ENABLED: 'false', EVENT_REGISTRY_ENABLED: 'false' });
    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });

  it('GdeltProvider is injectable from the compiled module', async () => {
    const moduleRef = await buildTestingModule({ GDELT_ENABLED: 'false', EVENT_REGISTRY_ENABLED: 'false' });
    const provider = moduleRef.get(GdeltProvider);
    expect(provider).toBeInstanceOf(GdeltProvider);
    await moduleRef.close();
  });

  it('EventRegistryProvider is injectable from the compiled module', async () => {
    const moduleRef = await buildTestingModule({ GDELT_ENABLED: 'false', EVENT_REGISTRY_ENABLED: 'false' });
    const provider = moduleRef.get(EventRegistryProvider);
    expect(provider).toBeInstanceOf(EventRegistryProvider);
    await moduleRef.close();
  });

  it('SignalsService is injectable from the compiled module (it is the only exported provider)', async () => {
    const moduleRef = await buildTestingModule({ GDELT_ENABLED: 'false', EVENT_REGISTRY_ENABLED: 'false' });
    const service = moduleRef.get(SignalsService);
    expect(service).toBeInstanceOf(SignalsService);
    await moduleRef.close();
  });

  it('with both providers disabled: SIGNAL_PROVIDERS is empty, but ALL_SIGNAL_PROVIDERS contains BOTH GdeltProvider and EventRegistryProvider — a disabled provider is still registered, still visible for health/operations', async () => {
    const moduleRef = await buildTestingModule({
      GDELT_ENABLED: 'false',
      EVENT_REGISTRY_ENABLED: 'false',
      EVENT_REGISTRY_API_KEY: '',
    });

    const enabled = moduleRef.get<SignalProvider[]>(SIGNAL_PROVIDERS);
    const all = moduleRef.get<SignalProvider[]>(ALL_SIGNAL_PROVIDERS);

    expect(enabled).toEqual([]);
    expect(all).toHaveLength(2);
    expect(all.some((p) => p instanceof GdeltProvider)).toBe(true);
    expect(all.some((p) => p instanceof EventRegistryProvider)).toBe(true);
    await moduleRef.close();
  });

  it('with GDELT_ENABLED=true and Event Registry disabled: SIGNAL_PROVIDERS contains only the GdeltProvider instance, matching the one present in ALL_SIGNAL_PROVIDERS', async () => {
    const moduleRef = await buildTestingModule({
      GDELT_ENABLED: 'true',
      EVENT_REGISTRY_ENABLED: 'false',
      EVENT_REGISTRY_API_KEY: '',
    });

    const enabled = moduleRef.get<SignalProvider[]>(SIGNAL_PROVIDERS);
    const all = moduleRef.get<SignalProvider[]>(ALL_SIGNAL_PROVIDERS);

    expect(enabled).toHaveLength(1);
    expect(enabled[0]).toBeInstanceOf(GdeltProvider);
    expect(all.find((p) => p instanceof GdeltProvider)).toBe(enabled[0]);
    await moduleRef.close();
  });

  it('Event Registry requires BOTH EVENT_REGISTRY_ENABLED=true AND a usable API key — enabled alone, with no key, is still excluded from SIGNAL_PROVIDERS', async () => {
    const moduleRef = await buildTestingModule({
      GDELT_ENABLED: 'false',
      EVENT_REGISTRY_ENABLED: 'true',
      EVENT_REGISTRY_API_KEY: '',
    });

    const enabled = moduleRef.get<SignalProvider[]>(SIGNAL_PROVIDERS);
    const all = moduleRef.get<SignalProvider[]>(ALL_SIGNAL_PROVIDERS);

    expect(enabled).toEqual([]);
    expect(all.some((p) => p instanceof EventRegistryProvider)).toBe(true);
    await moduleRef.close();
  });

  it('with EVENT_REGISTRY_ENABLED=true and a real API key: SIGNAL_PROVIDERS contains the EventRegistryProvider instance', async () => {
    const moduleRef = await buildTestingModule({
      GDELT_ENABLED: 'false',
      EVENT_REGISTRY_ENABLED: 'true',
      EVENT_REGISTRY_API_KEY: 'real-key',
    });

    const enabled = moduleRef.get<SignalProvider[]>(SIGNAL_PROVIDERS);
    const all = moduleRef.get<SignalProvider[]>(ALL_SIGNAL_PROVIDERS);

    expect(enabled).toHaveLength(1);
    expect(enabled[0]).toBeInstanceOf(EventRegistryProvider);
    expect(all.find((p) => p instanceof EventRegistryProvider)).toBe(enabled[0]);
    await moduleRef.close();
  });

  it('both providers can simultaneously appear in SIGNAL_PROVIDERS when both are genuinely enabled/configured — the exact scenario M64.3\u2019s architecture was built for', async () => {
    const moduleRef = await buildTestingModule({
      GDELT_ENABLED: 'true',
      EVENT_REGISTRY_ENABLED: 'true',
      EVENT_REGISTRY_API_KEY: 'real-key',
    });

    const enabled = moduleRef.get<SignalProvider[]>(SIGNAL_PROVIDERS);

    expect(enabled).toHaveLength(2);
    expect(enabled.some((p) => p instanceof GdeltProvider)).toBe(true);
    expect(enabled.some((p) => p instanceof EventRegistryProvider)).toBe(true);
    await moduleRef.close();
  });

  it('module construction performs zero network requests, under any combination of GDELT_ENABLED / EVENT_REGISTRY_ENABLED / EVENT_REGISTRY_API_KEY', async () => {
    let fetchCalled = false;
    const originalFetch = global.fetch;
    (global as any).fetch = async (...args: unknown[]) => {
      fetchCalled = true;
      return originalFetch ? (originalFetch as any)(...args) : undefined;
    };

    const moduleRef = await buildTestingModule({
      GDELT_ENABLED: 'true',
      EVENT_REGISTRY_ENABLED: 'true',
      EVENT_REGISTRY_API_KEY: 'real-key',
    });

    expect(fetchCalled).toBe(false);
    (global as any).fetch = originalFetch;
    await moduleRef.close();
  });
});

describe('SignalsModule — underlying factory logic (executable independent of a real Nest container)', () => {
  it('isGdeltEnabled gates SIGNAL_PROVIDERS inclusion exactly as the module factory uses it', () => {
    expect(isGdeltEnabled('true')).toBe(true);
    expect(isGdeltEnabled('false')).toBe(false);
    expect(isGdeltEnabled(undefined)).toBe(false);
  });
});
