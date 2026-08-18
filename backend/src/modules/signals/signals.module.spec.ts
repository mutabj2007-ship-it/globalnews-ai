import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { SignalsModule } from './signals.module';
import { SignalsService } from './signals.service';
import { GdeltProvider } from './providers/gdelt.provider';
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
 */

async function buildTestingModule(gdeltEnabled: string) {
  process.env.GDELT_ENABLED = gdeltEnabled;
  return Test.createTestingModule({
    imports: [ConfigModule.forRoot({ isGlobal: false, ignoreEnvFile: true }), SignalsModule],
  }).compile();
}

describe('SignalsModule — real NestJS DI compilation', () => {
  const originalEnv = process.env.GDELT_ENABLED;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.GDELT_ENABLED;
    } else {
      process.env.GDELT_ENABLED = originalEnv;
    }
  });

  it('compiles a real Nest testing module that imports SignalsModule without error', async () => {
    const moduleRef = await buildTestingModule('false');
    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });

  it('GdeltProvider is injectable from the compiled module', async () => {
    const moduleRef = await buildTestingModule('false');
    const provider = moduleRef.get(GdeltProvider);
    expect(provider).toBeInstanceOf(GdeltProvider);
    await moduleRef.close();
  });

  it('SignalsService is injectable from the compiled module (it is the only exported provider)', async () => {
    const moduleRef = await buildTestingModule('false');
    const service = moduleRef.get(SignalsService);
    expect(service).toBeInstanceOf(SignalsService);
    await moduleRef.close();
  });

  it('with GDELT_ENABLED=false: SIGNAL_PROVIDERS is empty, ALL_SIGNAL_PROVIDERS contains GdeltProvider', async () => {
    const moduleRef = await buildTestingModule('false');

    const enabled = moduleRef.get<SignalProvider[]>(SIGNAL_PROVIDERS);
    const all = moduleRef.get<SignalProvider[]>(ALL_SIGNAL_PROVIDERS);

    expect(enabled).toEqual([]);
    expect(all).toHaveLength(1);
    expect(all[0]).toBeInstanceOf(GdeltProvider);
    await moduleRef.close();
  });

  it('with GDELT_ENABLED=true: SIGNAL_PROVIDERS contains the same GdeltProvider instance as ALL_SIGNAL_PROVIDERS', async () => {
    const moduleRef = await buildTestingModule('true');

    const enabled = moduleRef.get<SignalProvider[]>(SIGNAL_PROVIDERS);
    const all = moduleRef.get<SignalProvider[]>(ALL_SIGNAL_PROVIDERS);

    expect(enabled).toHaveLength(1);
    expect(enabled[0]).toBe(all[0]);
    await moduleRef.close();
  });

  it('module construction performs zero network requests, under any GDELT_ENABLED value', async () => {
    let fetchCalled = false;
    const originalFetch = global.fetch;
    (global as any).fetch = async (...args: unknown[]) => {
      fetchCalled = true;
      return originalFetch ? (originalFetch as any)(...args) : undefined;
    };

    const moduleRef = await buildTestingModule('true');

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
