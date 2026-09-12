import type { ConfigService } from '@nestjs/config';
import { AnalysisConfigService } from '../analysis/config/analysis-config.service';
import { isUsableOpenAiApiKey } from '../analysis/providers/provider.tokens';
import {
  AdminSystemService,
  isOAuthConfigured,
  resolveAiProviderPosture,
} from './system/admin-system.service';
import type { PrismaService } from '../../database/prisma.service';
import type { NewsService } from '../news/news.service';

/**
 * MVP-G4 — the two configuration probes, and the ingestion aggregate.
 *
 * The hardest assertions here are the DRIFT GUARDS. G4-2 was authorized
 * as a self-contained implementation: the admin module reimplements two
 * rules that belong to the analysis module rather than importing or
 * exporting anything from it. Duplicated rules rot, so these tests
 * import the analysis module's own predicate and its own config service
 * and assert the copy still agrees with both. If the analysis lane ever
 * changes how a key or an execution mode is interpreted, this fails
 * here rather than lying on the admin screen.
 */

const buildService = (env: Record<string, string | undefined>): AdminSystemService => {
  const prisma = {
    $queryRaw: () => Promise.resolve([{ '?column?': 1 }]),
    article: {
      count: () => Promise.resolve(0),
      aggregate: () => Promise.resolve({ _max: { fetchedAt: null } }),
    },
  } as unknown as PrismaService;

  const news = { providersHealth: () => Promise.resolve([]) } as unknown as NewsService;
  const config = { get: (key: string) => env[key] } as unknown as ConfigService;

  return new AdminSystemService(prisma, news, config);
};

const componentOf = async (env: Record<string, string | undefined>, name: string) => {
  const result = await buildService(env).health();
  return result.components.find((component) => component.component === name);
};

const FULL_OAUTH = {
  OAUTH_CLIENT_ID: 'id',
  OAUTH_CLIENT_SECRET: 'secret',
  OAUTH_FLOW_SECRET: 'flow',
};

describe('G4-1 — AUTHENTICATION probe', () => {
  it('reads HEALTHY only when all three OAuth credentials are present', async () => {
    const probe = await componentOf({ ...FULL_OAUTH }, 'AUTHENTICATION');

    expect(probe?.status).toBe('HEALTHY');
    expect(probe?.detail).toBe('oauth-configured');
    expect(probe?.lastProbeAt).not.toBeNull();
  });

  it('reads FAILING when ANY one is absent — and reports the same key every time', async () => {
    const cases = [
      { ...FULL_OAUTH, OAUTH_CLIENT_ID: undefined },
      { ...FULL_OAUTH, OAUTH_CLIENT_SECRET: undefined },
      { ...FULL_OAUTH, OAUTH_FLOW_SECRET: undefined },
      { ...FULL_OAUTH, OAUTH_CLIENT_ID: '' },
      {},
    ];

    for (const env of cases) {
      const probe = await componentOf(env, 'AUTHENTICATION');
      expect(probe?.status).toBe('FAILING');
      // The SAME key regardless of which credential is missing. A key
      // per credential would tell a prober which secret to attack.
      expect(probe?.detail).toBe('oauth-not-configured');
    }
  });

  it('NEVER emits a credential value, prefix, length or fingerprint', async () => {
    const secrets = {
      OAUTH_CLIENT_ID: 'CLIENT-ID-VALUE-9931',
      OAUTH_CLIENT_SECRET: 'CLIENT-SECRET-VALUE-4417',
      OAUTH_FLOW_SECRET: 'FLOW-SECRET-VALUE-2286',
      OPENAI_API_KEY: 'sk-OPENAI-VALUE-7754',
    };

    const serialised = JSON.stringify(await buildService(secrets).health());

    Object.values(secrets).forEach((value) => {
      expect(serialised).not.toContain(value);
      // Not even a prefix long enough to be useful.
      expect(serialised).not.toContain(value.slice(0, 8));
    });
    expect(serialised).not.toContain('OAUTH_CLIENT_ID');
    expect(serialised).not.toContain('OPENAI_API_KEY');
    expect(serialised).not.toMatch(/length|chars|prefix|ends|sha|hash/i);
  });

  it('the predicate is all-or-nothing and cannot reveal which credential failed', () => {
    expect(isOAuthConfigured({ clientId: 'a', clientSecret: 'b', flowSecret: 'c' })).toBe(true);
    expect(isOAuthConfigured({ clientId: undefined, clientSecret: 'b', flowSecret: 'c' })).toBe(
      false,
    );
    expect(isOAuthConfigured({ clientId: 'a', clientSecret: '', flowSecret: 'c' })).toBe(false);
    expect(isOAuthConfigured({ clientId: 'a', clientSecret: 'b', flowSecret: undefined })).toBe(
      false,
    );
  });
});

describe('G4-2 — AI_PROVIDER probe', () => {
  it('a usable key reads HEALTHY — the real provider is what would answer', async () => {
    const probe = await componentOf({ OPENAI_API_KEY: 'sk-live' }, 'AI_PROVIDER');

    expect(probe?.status).toBe('HEALTHY');
    expect(probe?.detail).toBe('ai-provider-configured');
  });

  it('no key in development reads DEGRADED, never HEALTHY — mock analysis is not health', async () => {
    const probe = await componentOf({ NODE_ENV: 'development' }, 'AI_PROVIDER');

    expect(probe?.status).toBe('DEGRADED');
    expect(probe?.detail).toBe('ai-provider-mock-active');
    expect(probe?.status).not.toBe('HEALTHY');
  });

  it('no key in production reads FAILING', async () => {
    expect((await componentOf({ NODE_ENV: 'production' }, 'AI_PROVIDER'))?.status).toBe('FAILING');
    expect((await componentOf({ AI_EXECUTION_MODE: 'production' }, 'AI_PROVIDER'))?.detail).toBe(
      'ai-provider-not-configured',
    );
  });

  it('makes no outbound call — the probe is pure configuration', () => {
    const fetchSpy = jest.spyOn(global, 'fetch' as never);

    return buildService({ OPENAI_API_KEY: 'sk-live' })
      .health()
      .then(() => {
        expect(fetchSpy).not.toHaveBeenCalled();
        fetchSpy.mockRestore();
      });
  });

  describe('drift guards against the analysis module', () => {
    it('agrees with isUsableOpenAiApiKey about what counts as a usable key', () => {
      ([undefined, '', '   ', 'sk-live', ' sk-live '] as Array<string | undefined>).forEach(
        (value) => {
          const adminSaysConfigured =
            resolveAiProviderPosture({
              openAiApiKey: value,
              nodeEnv: undefined,
              aiExecutionMode: undefined,
            }).detail === 'ai-provider-configured';

          expect({ value, adminSaysConfigured }).toEqual({
            value,
            adminSaysConfigured: isUsableOpenAiApiKey(value),
          });
        },
      );
    });

    it('agrees with AnalysisConfigService about when production mode is in force', () => {
      const cases = [
        { NODE_ENV: 'production', AI_EXECUTION_MODE: undefined },
        { NODE_ENV: 'production', AI_EXECUTION_MODE: 'development' },
        { NODE_ENV: 'development', AI_EXECUTION_MODE: 'production' },
        { NODE_ENV: 'development', AI_EXECUTION_MODE: undefined },
        { NODE_ENV: undefined, AI_EXECUTION_MODE: undefined },
      ];

      cases.forEach((env) => {
        const analysisMode = new AnalysisConfigService({
          get: (key: string) => (env as Record<string, string | undefined>)[key],
        } as unknown as ConfigService).get().executionMode;

        const adminSaysProduction =
          resolveAiProviderPosture({
            openAiApiKey: undefined,
            nodeEnv: env.NODE_ENV,
            aiExecutionMode: env.AI_EXECUTION_MODE,
          }).detail === 'ai-provider-not-configured';

        expect({ env, adminSaysProduction }).toEqual({
          env,
          adminSaysProduction: analysisMode === 'production',
        });
      });
    });
  });
});

describe('G4-5 — ingestion liveness', () => {
  it('reports the article count and the newest fetchedAt', async () => {
    const prisma = {
      $queryRaw: () => Promise.resolve([{ '?column?': 1 }]),
      article: {
        count: () => Promise.resolve(1731),
        aggregate: () =>
          Promise.resolve({ _max: { fetchedAt: new Date('2026-08-22T04:05:06.000Z') } }),
      },
    } as unknown as PrismaService;
    const news = { providersHealth: () => Promise.resolve([]) } as unknown as NewsService;
    const config = { get: () => undefined } as unknown as ConfigService;

    const result = await new AdminSystemService(prisma, news, config).health();

    expect(result.ingestion).toEqual({
      articleCount: 1731,
      latestFetchedAt: '2026-08-22T04:05:06.000Z',
    });
  });

  it('an empty table is a TRUE zero with a null timestamp — a measurement, not an absence', async () => {
    const result = await buildService({}).health();

    expect(result.ingestion).toEqual({ articleCount: 0, latestFetchedAt: null });
  });

  it('an unreadable database yields null, never a zero — the two are not the same fact', async () => {
    const prisma = {
      $queryRaw: () => Promise.reject(new Error('boom')),
      article: {
        count: () => Promise.reject(new Error('boom')),
        aggregate: () => Promise.reject(new Error('boom')),
      },
    } as unknown as PrismaService;
    const news = { providersHealth: () => Promise.resolve([]) } as unknown as NewsService;
    const config = { get: () => undefined } as unknown as ConfigService;

    const result = await new AdminSystemService(prisma, news, config).health();

    expect(result.ingestion).toBeNull();
    expect(JSON.stringify(result)).not.toContain('boom');
  });

  it('CONTAINS NO USER INFORMATION — the aggregate has exactly two article-shaped fields', async () => {
    const result = await buildService({}).health();

    expect(Object.keys(result.ingestion ?? {}).sort()).toEqual(['articleCount', 'latestFetchedAt']);

    const serialised = JSON.stringify(result.ingestion);
    ['user', 'email', 'session', 'search', 'quer', 'country', 'geo', 'ip', 'location'].forEach(
      (needle) => {
        expect(serialised.toLowerCase()).not.toContain(needle);
      },
    );
  });

  it('reads ONLY the Article table — no user, session, history or country model is touched', async () => {
    const touched: string[] = [];
    const model = (name: string) =>
      new Proxy(
        {},
        {
          get: () => {
            touched.push(name);
            return () => Promise.resolve(name === 'article' ? 0 : []);
          },
        },
      );

    const prisma = {
      $queryRaw: () => Promise.resolve([{ '?column?': 1 }]),
      article: {
        count: () => {
          touched.push('article');
          return Promise.resolve(0);
        },
        aggregate: () => {
          touched.push('article');
          return Promise.resolve({ _max: { fetchedAt: null } });
        },
      },
      user: model('user'),
      session: model('session'),
      searchHistoryEntry: model('searchHistoryEntry'),
      articleCountry: model('articleCountry'),
    } as unknown as PrismaService;

    const news = { providersHealth: () => Promise.resolve([]) } as unknown as NewsService;
    const config = { get: () => undefined } as unknown as ConfigService;

    await new AdminSystemService(prisma, news, config).health();

    expect([...new Set(touched)]).toEqual(['article']);
  });
});
