import type { ConfigService } from '@nestjs/config';
import { ADMIN_HEALTH_COMPONENTS, type AdminComponentProbe } from './system/admin-system.contract';
import { AdminSystemService, resolveOverallStatus } from './system/admin-system.service';
import { AdminNewsService, projectProviderHealth } from './news/admin-news.service';
import type { PrismaService } from '../../database/prisma.service';
import type { NewsProvider } from '../news/interfaces';
import type { NewsService } from '../news/news.service';

/**
 * F1.b — the two authorized read-only surfaces, proven against their
 * real service implementations.
 *
 * Every assertion here is about NOT inventing data: an unprobed
 * component must read UNKNOWN, an unpopulated counter must be absent
 * rather than zero, and the overall banner must never read HEALTHY
 * while any component is unprobed.
 */

const probe = (
  component: AdminComponentProbe['component'],
  status: AdminComponentProbe['status'],
): AdminComponentProbe => ({ component, status, lastProbeAt: null, detail: 'no-probe-configured' });

/**
 * MVP-G4 — the default environment is FULLY CONFIGURED, so a test that
 * cares about something else does not accidentally assert against a
 * broken deployment. Tests that care about configuration override it.
 */
const CONFIGURED_ENV: Record<string, string | undefined> = {
  OAUTH_CLIENT_ID: 'id',
  OAUTH_CLIENT_SECRET: 'secret',
  OAUTH_FLOW_SECRET: 'flow',
  OPENAI_API_KEY: 'key',
};

function buildSystemService(options: {
  databaseOk: boolean;
  providerStatuses?: Array<{ status: 'ok' | 'degraded' | 'down' }>;
  providersThrow?: boolean;
  env?: Record<string, string | undefined>;
  articleCount?: number;
  latestFetchedAt?: Date | null;
}): AdminSystemService {
  const prisma = {
    $queryRaw: () =>
      options.databaseOk ? Promise.resolve([{ '?column?': 1 }]) : Promise.reject(new Error('boom')),
    article: {
      count: () =>
        options.databaseOk
          ? Promise.resolve(options.articleCount ?? 0)
          : Promise.reject(new Error('boom')),
      aggregate: () =>
        options.databaseOk
          ? Promise.resolve({ _max: { fetchedAt: options.latestFetchedAt ?? null } })
          : Promise.reject(new Error('boom')),
    },
  } as unknown as PrismaService;

  const env = options.env ?? CONFIGURED_ENV;
  const config = { get: (key: string) => env[key] } as unknown as ConfigService;

  const news = {
    providersHealth: () =>
      options.providersThrow
        ? Promise.reject(new Error('boom'))
        : Promise.resolve(
            (options.providerStatuses ?? []).map((s, index) => ({
              providerId: `p${index}`,
              displayName: `P${index}`,
              status: s.status,
              checkedAt: '2026-08-21T00:00:00.000Z',
            })),
          ),
  } as unknown as NewsService;

  return new AdminSystemService(prisma, news, config);
}

describe('ADMIN-07 — system health fan-in', () => {
  it('reports all eight design components, in the design order', async () => {
    const result = await buildSystemService({
      databaseOk: true,
      providerStatuses: [{ status: 'ok' }],
    }).health();

    expect(result.components.map((c) => c.component)).toEqual([...ADMIN_HEALTH_COMPONENTS]);
    expect(result.totalComponentCount).toBe(8);
  });

  it('the three components with no probe are UNKNOWN or NOT_IMPLEMENTED — never HEALTHY', async () => {
    const result = await buildSystemService({
      databaseOk: true,
      providerStatuses: [{ status: 'ok' }],
    }).health();
    const byName = Object.fromEntries(result.components.map((c) => [c.component, c]));

    expect(byName.FRONTEND.status).toBe('UNKNOWN');
    expect(byName.BACKGROUND_SERVICES.status).toBe('NOT_IMPLEMENTED');
    expect(byName.KSEF_INTEGRATION.status).toBe('NOT_IMPLEMENTED');

    ['FRONTEND', 'BACKGROUND_SERVICES', 'KSEF_INTEGRATION'].forEach((name) => {
      expect(byName[name].lastProbeAt).toBeNull();
    });
  });

  it('only the five genuinely probed components carry a probe timestamp', async () => {
    const result = await buildSystemService({
      databaseOk: true,
      providerStatuses: [{ status: 'ok' }],
    }).health();

    expect(result.probedComponentCount).toBe(5);
    expect(result.components.filter((c) => c.lastProbeAt !== null).map((c) => c.component)).toEqual(
      ['BACKEND', 'DATABASE', 'NEWS_PROVIDER', 'AI_PROVIDER', 'AUTHENTICATION'],
    );
  });

  it('a reachable database reads HEALTHY and an unreachable one reads FAILING — with no error detail leaked', async () => {
    const ok = await buildSystemService({
      databaseOk: true,
      providerStatuses: [{ status: 'ok' }],
    }).health();
    const bad = await buildSystemService({
      databaseOk: false,
      providerStatuses: [{ status: 'ok' }],
    }).health();

    expect(ok.components.find((c) => c.component === 'DATABASE')?.status).toBe('HEALTHY');

    const failing = bad.components.find((c) => c.component === 'DATABASE');
    expect(failing?.status).toBe('FAILING');
    expect(failing?.detail).toBe('database-unreachable');
    expect(JSON.stringify(bad)).not.toContain('boom');
  });

  it('provider health maps worst-of-N: any down -> FAILING, any degraded -> DEGRADED, else HEALTHY', async () => {
    const down = await buildSystemService({
      databaseOk: true,
      providerStatuses: [{ status: 'ok' }, { status: 'down' }],
    }).health();
    const degraded = await buildSystemService({
      databaseOk: true,
      providerStatuses: [{ status: 'ok' }, { status: 'degraded' }],
    }).health();
    const healthy = await buildSystemService({
      databaseOk: true,
      providerStatuses: [{ status: 'ok' }, { status: 'ok' }],
    }).health();

    expect(down.components.find((c) => c.component === 'NEWS_PROVIDER')?.status).toBe('FAILING');
    expect(degraded.components.find((c) => c.component === 'NEWS_PROVIDER')?.status).toBe(
      'DEGRADED',
    );
    expect(healthy.components.find((c) => c.component === 'NEWS_PROVIDER')?.status).toBe('HEALTHY');
  });

  it('a provider probe that throws, or reports nothing, reads UNKNOWN — never assumed healthy', async () => {
    const threw = await buildSystemService({ databaseOk: true, providersThrow: true }).health();
    const empty = await buildSystemService({ databaseOk: true, providerStatuses: [] }).health();

    expect(threw.components.find((c) => c.component === 'NEWS_PROVIDER')?.status).toBe('UNKNOWN');
    expect(empty.components.find((c) => c.component === 'NEWS_PROVIDER')?.status).toBe('UNKNOWN');
  });

  describe('overall status', () => {
    it('CANNOT read HEALTHY while any component is unprobed — the design rule, executed', async () => {
      const best = await buildSystemService({
        databaseOk: true,
        providerStatuses: [{ status: 'ok' }],
      }).health();
      expect(best.overall).toBe('UNKNOWN');
      expect(best.overall).not.toBe('HEALTHY');
    });

    it('worst probed component wins', () => {
      expect(
        resolveOverallStatus([probe('BACKEND', 'HEALTHY'), probe('DATABASE', 'FAILING')]),
      ).toBe('FAILING');
      expect(
        resolveOverallStatus([probe('BACKEND', 'HEALTHY'), probe('DATABASE', 'DEGRADED')]),
      ).toBe('DEGRADED');
      expect(
        resolveOverallStatus([probe('BACKEND', 'HEALTHY'), probe('DATABASE', 'UNKNOWN')]),
      ).toBe('UNKNOWN');
      expect(
        resolveOverallStatus([probe('BACKEND', 'HEALTHY'), probe('DATABASE', 'HEALTHY')]),
      ).toBe('HEALTHY');
    });

    it('UNKNOWN outranks HEALTHY — an unprobed platform is not a healthy platform', () => {
      expect(
        resolveOverallStatus([probe('BACKEND', 'HEALTHY'), probe('FRONTEND', 'UNKNOWN')]),
      ).toBe('UNKNOWN');
    });

    it('NOT_IMPLEMENTED never drags the banner down — a planned surface is not a fault', () => {
      expect(
        resolveOverallStatus([
          probe('BACKEND', 'HEALTHY'),
          probe('KSEF_INTEGRATION', 'NOT_IMPLEMENTED'),
        ]),
      ).toBe('HEALTHY');
      expect(resolveOverallStatus([probe('KSEF_INTEGRATION', 'NOT_IMPLEMENTED')])).toBe('UNKNOWN');
    });
  });

  it('every detail value is a machine key, never prose — the admin surface is localized', async () => {
    const result = await buildSystemService({
      databaseOk: true,
      providerStatuses: [{ status: 'ok' }],
    }).health();

    result.components.forEach((component) => {
      expect(component.detail).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(component.detail).not.toMatch(/\s/);
    });
  });
});

describe('ADMIN-06 — provider projection (MVP-G4)', () => {
  const base = {
    providerId: 'gnews',
    displayName: 'GNews',
    status: 'ok' as const,
    checkedAt: '2026-08-21T00:00:00.000Z',
  };

  const serving = { enabled: true, providerKind: 'REAL' as const };

  it('NEVER zero-fills an unpopulated counter — absent stays absent, so the UI can render UNKNOWN', () => {
    const projected = projectProviderHealth({ ...base }, serving);

    [
      'requestCount',
      'failureCount',
      'lastLatencyMs',
      'lastSuccessAt',
      'rateLimitState',
      'recordsRetrieved',
      'recordsAccepted',
      'duplicatesRemoved',
      'geoResolutionSuccessRate',
    ].forEach((key) => {
      expect(Object.prototype.hasOwnProperty.call(projected, key)).toBe(false);
    });

    // Asserting the exact key set is stronger than string-matching a
    // serialised zero, and cannot be fooled by a ':0' inside an ISO
    // timestamp.
    expect(Object.keys(projected).sort()).toEqual([
      'checkedAt',
      'displayName',
      'enabled',
      'providerId',
      'providerKind',
      'status',
    ]);
  });

  /**
   * ── R4 GDELT — TEST M: GDELT DOC APPEARS TRUTHFULLY, WITH NO ADMIN
   *    CONTRACT CHANGE AT ALL ─────────────────────────────────────────
   *
   * The projection already refused to zero-fill and already dropped
   * provider prose, so a third provider needed nothing added here. These
   * tests assert that claim rather than trusting it, using the exact
   * shapes GdeltDocProvider.health() really returns.
   */
  describe('R4 GDELT — the third provider projects truthfully', () => {
    const gdeltBase = {
      providerId: 'gdelt-doc',
      displayName: 'GDELT DOC',
      checkedAt: '2026-08-26T09:00:00.000Z',
    };

    it('a switched-off GDELT is REAL, not enabled, and down', () => {
      const projected = projectProviderHealth(
        {
          ...gdeltBase,
          status: 'down',
          message: 'GDELT_DOC_ENABLED is not set to "true". This provider is switched off.',
        },
        { enabled: false, providerKind: 'REAL' },
      );

      expect(projected.providerId).toBe('gdelt-doc');
      expect(projected.displayName).toBe('GDELT DOC');
      expect(projected.providerKind).toBe('REAL');
      expect(projected.enabled).toBe(false);
      expect(projected.status).toBe('down');
    });

    it('a throttled GDELT carries rateLimitState, and its prose never reaches the table', () => {
      const projected = projectProviderHealth(
        {
          ...gdeltBase,
          status: 'degraded',
          message: 'GDELT asked for slower requests; this provider is in cooldown.',
          rateLimitState: 'throttled',
          requestCount: 4,
          failureCount: 1,
        },
        { enabled: true, providerKind: 'REAL' },
      );

      expect(projected.rateLimitState).toBe('throttled');
      expect(projected.requestCount).toBe(4);
      // Untranslatable provider prose is dropped, not sanitised.
      expect(Object.prototype.hasOwnProperty.call(projected, 'message')).toBe(false);
    });

    it('GDELT counters it has never measured stay ABSENT rather than becoming 0', () => {
      const projected = projectProviderHealth(
        {
          ...gdeltBase,
          status: 'ok',
          requestCount: 0,
          failureCount: 0,
          rateLimitState: 'unknown',
        },
        { enabled: true, providerKind: 'REAL' },
      );

      // Genuinely measured zeros survive...
      expect(projected.requestCount).toBe(0);
      // ...while never-measured fields are simply not there, so the UI
      // renders UNKNOWN instead of a number nobody took.
      expect(Object.prototype.hasOwnProperty.call(projected, 'lastLatencyMs')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(projected, 'lastSuccessAt')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(projected, 'recordsRetrieved')).toBe(false);
    });

    it('N — the mock wire is still projected as MOCK beside the two real providers', () => {
      const rows = [
        projectProviderHealth(
          {
            providerId: 'gnews',
            displayName: 'GNews',
            status: 'ok',
            checkedAt: gdeltBase.checkedAt,
          },
          { enabled: true, providerKind: 'REAL' },
        ),
        projectProviderHealth(
          { ...gdeltBase, status: 'down' },
          { enabled: false, providerKind: 'REAL' },
        ),
        projectProviderHealth(
          {
            providerId: 'mock-wire',
            displayName: 'GlobalNews Mock Wire',
            status: 'ok',
            checkedAt: gdeltBase.checkedAt,
          },
          { enabled: false, providerKind: 'MOCK' },
        ),
      ];

      expect(rows.map((row) => row.providerId)).toEqual(['gnews', 'gdelt-doc', 'mock-wire']);
      expect(rows.map((row) => row.providerKind)).toEqual(['REAL', 'REAL', 'MOCK']);
      // Exactly one provider is serving reads, and it is not the mock.
      expect(rows.filter((row) => row.enabled).map((row) => row.providerId)).toEqual(['gnews']);
    });
  });

  it('passes a genuinely reported counter through unchanged, including a real zero', () => {
    const projected = projectProviderHealth(
      { ...base, requestCount: 0, failureCount: 12 },
      serving,
    );

    expect(projected.requestCount).toBe(0);
    expect(projected.failureCount).toBe(12);
  });

  it('always carries the four fields every provider really reports', () => {
    const projected = projectProviderHealth({ ...base }, serving);

    expect(projected.providerId).toBe('gnews');
    expect(projected.displayName).toBe('GNews');
    expect(projected.status).toBe('ok');
    expect(projected.checkedAt).toBe('2026-08-21T00:00:00.000Z');
  });

  describe('G4-4 — uncontrolled provider prose never reaches the admin surface', () => {
    it('drops `message` entirely, even when the provider supplies one', () => {
      const projected = projectProviderHealth(
        { ...base, status: 'degraded' as const, message: 'GNews rejected the configured API key.' },
        serving,
      );

      expect(Object.prototype.hasOwnProperty.call(projected, 'message')).toBe(false);
      expect(JSON.stringify(projected)).not.toContain('rejected');
    });

    it('drops it even when the message is what a thrown provider error put there', () => {
      // This is the real hazard: NewsService.providersHealth() fills
      // `message` from error.message for ANY provider whose health()
      // throws. A future provider could put a URL, a query string or a
      // credential in there, and the old projection forwarded it.
      const projected = projectProviderHealth(
        {
          ...base,
          status: 'down' as const,
          message: 'connect ECONNREFUSED https://example.test/v1?token=SUPER-SECRET-VALUE',
        },
        serving,
      );

      const serialised = JSON.stringify(projected);
      expect(serialised).not.toContain('SUPER-SECRET-VALUE');
      expect(serialised).not.toContain('token=');
      expect(serialised).not.toContain('ECONNREFUSED');
    });

    it('keeps the structured status that carried the operational meaning', () => {
      expect(
        projectProviderHealth({ ...base, status: 'down' as const, message: 'anything' }, serving)
          .status,
      ).toBe('down');
    });
  });

  describe('G4-3 — active, registered and synthetic are all distinguishable', () => {
    const provider = (id: string, isMock: boolean): NewsProvider =>
      ({ id, displayName: id, isMock }) as unknown as NewsProvider;

    const gnews = provider('gnews', false);
    const mock = provider('mock-wire', true);

    const healthOf = (ids: string[]): NewsService =>
      ({
        providersHealth: () =>
          Promise.resolve(
            ids.map((id) => ({
              providerId: id,
              displayName: id,
              status: 'ok' as const,
              checkedAt: base.checkedAt,
            })),
          ),
      }) as unknown as NewsService;

    it('still projects every REGISTERED provider, not only the active ones', async () => {
      const result = await new AdminNewsService(
        healthOf(['gnews', 'mock-wire']),
        [gnews],
        [gnews, mock],
      ).providers();

      expect(result.providers).toHaveLength(2);
      expect(result.providers.map((p) => p.providerId)).toEqual(['gnews', 'mock-wire']);
      expect(typeof result.generatedAt).toBe('string');
    });

    it('marks only the ACTIVE provider as enabled — a registered-but-idle provider reads false', async () => {
      const result = await new AdminNewsService(
        healthOf(['gnews', 'mock-wire']),
        [gnews],
        [gnews, mock],
      ).providers();

      expect(result.providers.map((p) => [p.providerId, p.enabled])).toEqual([
        ['gnews', true],
        ['mock-wire', false],
      ]);
    });

    it('identifies the synthetic provider as MOCK and the real one as REAL', async () => {
      const result = await new AdminNewsService(
        healthOf(['gnews', 'mock-wire']),
        [gnews],
        [gnews, mock],
      ).providers();

      expect(result.providers.map((p) => [p.providerId, p.providerKind])).toEqual([
        ['gnews', 'REAL'],
        ['mock-wire', 'MOCK'],
      ]);
    });

    it('a mock-only deployment shows the mock as ACTIVE — the case an operator most needs to see', async () => {
      const result = await new AdminNewsService(
        healthOf(['mock-wire']),
        [mock],
        [mock],
      ).providers();

      expect(result.providers).toEqual([
        expect.objectContaining({ providerId: 'mock-wire', enabled: true, providerKind: 'MOCK' }),
      ]);
    });

    it('a provider it cannot identify is UNKNOWN, never claimed REAL — fail closed', async () => {
      const result = await new AdminNewsService(healthOf(['ghost']), [], []).providers();

      expect(result.providers[0].providerKind).toBe('UNKNOWN');
      expect(result.providers[0].enabled).toBe(false);
    });
  });
});
