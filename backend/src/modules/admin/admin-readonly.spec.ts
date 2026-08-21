import { ADMIN_HEALTH_COMPONENTS, type AdminComponentProbe } from './system/admin-system.contract';
import { AdminSystemService, resolveOverallStatus } from './system/admin-system.service';
import { AdminNewsService, projectProviderHealth } from './news/admin-news.service';
import type { PrismaService } from '../../database/prisma.service';
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

function buildSystemService(options: {
  databaseOk: boolean;
  providerStatuses?: Array<{ status: 'ok' | 'degraded' | 'down' }>;
  providersThrow?: boolean;
}): AdminSystemService {
  const prisma = {
    $queryRaw: () =>
      options.databaseOk ? Promise.resolve([{ '?column?': 1 }]) : Promise.reject(new Error('boom')),
  } as unknown as PrismaService;

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

  return new AdminSystemService(prisma, news);
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

  it('the five components with no probe are UNKNOWN or NOT_IMPLEMENTED — never HEALTHY', async () => {
    const result = await buildSystemService({
      databaseOk: true,
      providerStatuses: [{ status: 'ok' }],
    }).health();
    const byName = Object.fromEntries(result.components.map((c) => [c.component, c]));

    expect(byName.FRONTEND.status).toBe('UNKNOWN');
    expect(byName.AI_PROVIDER.status).toBe('UNKNOWN');
    expect(byName.AUTHENTICATION.status).toBe('UNKNOWN');
    expect(byName.BACKGROUND_SERVICES.status).toBe('NOT_IMPLEMENTED');
    expect(byName.KSEF_INTEGRATION.status).toBe('NOT_IMPLEMENTED');

    [
      'FRONTEND',
      'AI_PROVIDER',
      'AUTHENTICATION',
      'BACKGROUND_SERVICES',
      'KSEF_INTEGRATION',
    ].forEach((name) => {
      expect(byName[name].lastProbeAt).toBeNull();
    });
  });

  it('only the three genuinely probed components carry a probe timestamp', async () => {
    const result = await buildSystemService({
      databaseOk: true,
      providerStatuses: [{ status: 'ok' }],
    }).health();

    expect(result.probedComponentCount).toBe(3);
    expect(result.components.filter((c) => c.lastProbeAt !== null).map((c) => c.component)).toEqual(
      ['BACKEND', 'DATABASE', 'NEWS_PROVIDER'],
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

describe('ADMIN-06 — provider projection', () => {
  const base = {
    providerId: 'gnews',
    displayName: 'GNews',
    status: 'ok' as const,
    checkedAt: '2026-08-21T00:00:00.000Z',
  };

  it('NEVER zero-fills an unpopulated counter — absent stays absent, so the UI can render UNKNOWN', () => {
    const projected = projectProviderHealth({ ...base });

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
      'enabled',
      'message',
    ].forEach((key) => {
      expect(Object.prototype.hasOwnProperty.call(projected, key)).toBe(false);
    });

    // Only the four genuinely-reported fields survive. Asserting the
    // exact key set is stronger than string-matching a serialised zero,
    // and cannot be fooled by a ':0' inside an ISO timestamp.
    expect(Object.keys(projected).sort()).toEqual([
      'checkedAt',
      'displayName',
      'providerId',
      'status',
    ]);
    expect(Object.values(projected)).not.toContain(0);
  });

  it('passes a genuinely reported counter through unchanged, including a real zero', () => {
    const projected = projectProviderHealth({
      ...base,
      requestCount: 0,
      failureCount: 12,
      message: 'rate limited',
    });

    expect(projected.requestCount).toBe(0);
    expect(projected.failureCount).toBe(12);
    expect(projected.message).toBe('rate limited');
  });

  it('always carries the four fields every provider really reports', () => {
    const projected = projectProviderHealth({ ...base });

    expect(projected.providerId).toBe('gnews');
    expect(projected.displayName).toBe('GNews');
    expect(projected.status).toBe('ok');
    expect(projected.checkedAt).toBe('2026-08-21T00:00:00.000Z');
  });

  it('projects every registered provider, not only the active ones', async () => {
    const news = {
      providersHealth: () =>
        Promise.resolve([
          { ...base },
          {
            providerId: 'mock-wire',
            displayName: 'Mock wire',
            status: 'ok' as const,
            checkedAt: base.checkedAt,
          },
        ]),
    } as unknown as NewsService;

    const result = await new AdminNewsService(news).providers();

    expect(result.providers).toHaveLength(2);
    expect(result.providers.map((p) => p.providerId)).toEqual(['gnews', 'mock-wire']);
    expect(typeof result.generatedAt).toBe('string');
  });
});
