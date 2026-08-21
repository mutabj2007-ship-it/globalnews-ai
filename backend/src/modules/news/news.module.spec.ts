import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { NewsModule } from './news.module';
import { NewsService } from './news.service';
import { CountryNewsService } from './country/country-news.service';
import { GNewsProvider } from './providers/gnews.provider';
import { MockNewsProvider } from './providers/mock-news.provider';
import { ALL_NEWS_PROVIDERS, NEWS_PROVIDERS } from './providers/provider.tokens';
import { selectActiveNewsProviders } from './providers/news-provider-registry';
import { PrismaService } from '../../database/prisma.service';
import type { NewsProvider } from './interfaces';

/**
 * E1 — direct NewsModule provider-registration tests.
 *
 * These compile the REAL NewsModule through the REAL NestJS container
 * and read NEWS_PROVIDERS / ALL_NEWS_PROVIDERS back out, so the
 * registration contract is proven against the shipped module
 * definition rather than against a hand-built provider array.
 *
 * ConfigModule.forRoot() is deliberately called with isGlobal: false.
 * ConfigService resolves here ONLY because NewsModule's own @Module()
 * definition imports ConfigModule (E1's DI repair, mirroring
 * SignalsModule). If a future edit removes that import, this file
 * fails immediately — which is the point.
 *
 * PrismaService is replaced with an inert stub via a @Global() test
 * module: ArticlePersistenceService depends on it, the real
 * PrismaService opens a database connection in its constructor, and
 * nothing in provider REGISTRATION touches persistence. No database is
 * required to run these tests, and none is contacted.
 */

@Global()
@Module({
  providers: [{ provide: PrismaService, useValue: {} }],
  exports: [PrismaService],
})
class StubPrismaModule {}

const GNEWS_API_KEY = 'GNEWS_API_KEY';

async function buildTestingModule(gnewsApiKey: string | undefined) {
  if (gnewsApiKey === undefined) {
    delete process.env[GNEWS_API_KEY];
  } else {
    process.env[GNEWS_API_KEY] = gnewsApiKey;
  }

  return Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: false, ignoreEnvFile: true }),
      StubPrismaModule,
      NewsModule,
    ],
  }).compile();
}

describe('NewsModule — real NestJS DI compilation and provider registration', () => {
  const originalApiKey = process.env[GNEWS_API_KEY];

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env[GNEWS_API_KEY];
    } else {
      process.env[GNEWS_API_KEY] = originalApiKey;
    }
  });

  it('compiles standalone — NewsModule declares its own ConfigService dependency', async () => {
    const moduleRef = await buildTestingModule('real-key');
    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });

  it('exports NewsService and CountryNewsService from the compiled module', async () => {
    const moduleRef = await buildTestingModule('real-key');

    expect(moduleRef.get(NewsService)).toBeInstanceOf(NewsService);
    expect(moduleRef.get(CountryNewsService)).toBeInstanceOf(CountryNewsService);

    await moduleRef.close();
  });

  it('ONE REAL PROVIDER WORKS: with a usable GNEWS_API_KEY, NEWS_PROVIDERS is exactly the GNewsProvider instance', async () => {
    const moduleRef = await buildTestingModule('real-key');

    const active = moduleRef.get<NewsProvider[]>(NEWS_PROVIDERS);

    expect(active).toHaveLength(1);
    expect(active[0]).toBeInstanceOf(GNewsProvider);
    expect(active[0]).toBe(moduleRef.get(GNewsProvider));

    await moduleRef.close();
  });

  it('MOCK ONLY WHEN NO REAL PROVIDER EXISTS: with no GNEWS_API_KEY, NEWS_PROVIDERS is exactly the MockNewsProvider instance', async () => {
    const moduleRef = await buildTestingModule(undefined);

    const active = moduleRef.get<NewsProvider[]>(NEWS_PROVIDERS);

    expect(active).toHaveLength(1);
    expect(active[0]).toBeInstanceOf(MockNewsProvider);
    expect(active[0]).toBe(moduleRef.get(MockNewsProvider));

    await moduleRef.close();
  });

  it('treats a whitespace-only GNEWS_API_KEY as unconfigured, exactly as NewsStartupValidator does', async () => {
    const moduleRef = await buildTestingModule('   ');

    const active = moduleRef.get<NewsProvider[]>(NEWS_PROVIDERS);

    expect(active).toHaveLength(1);
    expect(active[0]).toBeInstanceOf(MockNewsProvider);

    await moduleRef.close();
  });

  it('MOCK IS NEVER MIXED WITH REAL: the active set never contains both, at any GNEWS_API_KEY value', async () => {
    for (const apiKey of ['real-key', '', '   ', undefined]) {
      const moduleRef = await buildTestingModule(apiKey);

      const active = moduleRef.get<NewsProvider[]>(NEWS_PROVIDERS);

      const hasReal = active.some((provider) => !provider.isMock);
      const hasMock = active.some((provider) => provider.isMock);

      expect(hasReal && hasMock).toBe(false);
      expect(active.length).toBeGreaterThan(0);

      await moduleRef.close();
    }
  });

  it('ALL_NEWS_PROVIDERS always contains BOTH registered providers, so an inactive provider stays visible to GET /news/providers/health', async () => {
    for (const apiKey of ['real-key', undefined]) {
      const moduleRef = await buildTestingModule(apiKey);

      const registered = moduleRef.get<NewsProvider[]>(ALL_NEWS_PROVIDERS);

      expect(registered).toHaveLength(2);
      expect(registered.some((provider) => provider instanceof MockNewsProvider)).toBe(true);
      expect(registered.some((provider) => provider instanceof GNewsProvider)).toBe(true);

      await moduleRef.close();
    }
  });

  it('the active provider instances are the SAME singletons ALL_NEWS_PROVIDERS reports — health and reads never describe different objects', async () => {
    const moduleRef = await buildTestingModule('real-key');

    const active = moduleRef.get<NewsProvider[]>(NEWS_PROVIDERS);
    const registered = moduleRef.get<NewsProvider[]>(ALL_NEWS_PROVIDERS);

    for (const provider of active) {
      expect(registered).toContain(provider);
    }

    await moduleRef.close();
  });

  it('MULTIPLE REAL PROVIDERS COEXIST STRUCTURALLY: the module’s own selection function accumulates a second real provider alongside the real GNewsProvider instance', async () => {
    const moduleRef = await buildTestingModule('real-key');

    const gnewsProvider = moduleRef.get(GNewsProvider);
    const mockNewsProvider = moduleRef.get(MockNewsProvider);

    // E1 adds NO new external provider. This asserts the SEAM: the
    // exact function news.module.ts's NEWS_PROVIDERS factory calls,
    // given the real GNewsProvider singleton plus one additional real
    // candidate, returns both — which the pre-E1 ternary was
    // structurally incapable of doing.
    const secondRealProvider: NewsProvider = {
      ...gnewsProvider,
      id: 'second-real-wire',
      displayName: 'Second Real Wire',
      isMock: false,
      search: () => Promise.resolve([]),
      topHeadlines: () => Promise.resolve([]),
      category: () => Promise.resolve([]),
      health: () =>
        Promise.resolve({
          providerId: 'second-real-wire',
          displayName: 'Second Real Wire',
          status: 'ok' as const,
          checkedAt: '2026-01-01T00:00:00.000Z',
        }),
    };

    const active = selectActiveNewsProviders({
      realCandidates: [
        { provider: gnewsProvider, isConfigured: true },
        { provider: secondRealProvider, isConfigured: true },
      ],
      mockProvider: mockNewsProvider,
    });

    expect(active).toEqual([gnewsProvider, secondRealProvider]);
    expect(active).not.toContain(mockNewsProvider);

    await moduleRef.close();
  });

  it('constructing the module performs zero network requests, at any GNEWS_API_KEY value', async () => {
    let fetchCalled = false;
    const originalFetch = global.fetch;
    (global as unknown as { fetch: unknown }).fetch = async (...args: unknown[]) => {
      fetchCalled = true;
      return (originalFetch as (...a: unknown[]) => unknown)(...args);
    };

    try {
      for (const apiKey of ['real-key', undefined]) {
        const moduleRef = await buildTestingModule(apiKey);
        expect(fetchCalled).toBe(false);
        await moduleRef.close();
      }
    } finally {
      (global as unknown as { fetch: unknown }).fetch = originalFetch;
    }
  });
});
