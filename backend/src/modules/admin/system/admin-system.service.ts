import { Injectable } from '@nestjs/common';
import type { ProviderHealthStatus } from '@globalnews-ai/shared';
import { PrismaService } from '../../../database/prisma.service';
import { NewsService } from '../../news/news.service';
import {
  ADMIN_HEALTH_COMPONENTS,
  type AdminComponentProbe,
  type AdminProbeStatus,
  type AdminSystemHealthResponse,
} from './admin-system.contract';

/**
 * F1.b — the ADMIN-07 probe fan-in.
 *
 * Reads only what the platform ALREADY knows. It introduces no new
 * measurement, no metric store and no schema:
 *
 *   BACKEND        the process answered this request — the same fact
 *                  GET /health asserts, and nothing more
 *   DATABASE       `SELECT 1`, the identical check GET /health/ready runs
 *   NEWS PROVIDER  the existing NewsService.providersHealth() result
 *
 * The other five components have no probe anywhere in this repository,
 * and this service says so rather than inventing one. FRONTEND,
 * AI_PROVIDER and AUTHENTICATION report UNKNOWN; BACKGROUND_SERVICES
 * and KSEF_INTEGRATION report NOT_IMPLEMENTED.
 *
 * WHY THE DATABASE CHECK IS DUPLICATED RATHER THAN SHARED.
 * HealthController.ready() throws ServiceUnavailableException on
 * failure, because a readiness probe must fail the request. This
 * surface must do the opposite: report the failure as data so the other
 * seven cards still render. The single `SELECT 1` is therefore repeated
 * here deliberately; HealthController is not modified, and neither its
 * status codes nor its body change.
 */
@Injectable()
export class AdminSystemService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly newsService: NewsService,
  ) {}

  async health(): Promise<AdminSystemHealthResponse> {
    const now = (): string => new Date().toISOString();

    const database = await this.probeDatabase(now);
    const newsProvider = await this.probeNewsProviders(now);

    const components: AdminComponentProbe[] = [
      {
        component: 'FRONTEND',
        status: 'UNKNOWN',
        lastProbeAt: null,
        detail: 'no-probe-configured',
      },
      {
        component: 'BACKEND',
        status: 'HEALTHY',
        lastProbeAt: now(),
        detail: 'process-serving-requests',
      },
      database,
      newsProvider,
      {
        component: 'AI_PROVIDER',
        status: 'UNKNOWN',
        lastProbeAt: null,
        detail: 'no-probe-configured',
      },
      {
        component: 'AUTHENTICATION',
        status: 'UNKNOWN',
        lastProbeAt: null,
        detail: 'no-probe-configured',
      },
      {
        component: 'BACKGROUND_SERVICES',
        status: 'NOT_IMPLEMENTED',
        lastProbeAt: null,
        detail: 'not-implemented',
      },
      {
        component: 'KSEF_INTEGRATION',
        status: 'NOT_IMPLEMENTED',
        lastProbeAt: null,
        detail: 'not-implemented',
      },
    ];

    return {
      overall: resolveOverallStatus(components),
      probedComponentCount: components.filter((c) => c.lastProbeAt !== null).length,
      totalComponentCount: ADMIN_HEALTH_COMPONENTS.length,
      components,
      generatedAt: now(),
    };
  }

  private async probeDatabase(now: () => string): Promise<AdminComponentProbe> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        component: 'DATABASE',
        status: 'HEALTHY',
        lastProbeAt: now(),
        detail: 'database-reachable',
      };
    } catch {
      // The caught error is deliberately never surfaced — no message,
      // no stack, no connection detail — matching HealthController's
      // own discipline. Only the fact of unreachability is reported.
      return {
        component: 'DATABASE',
        status: 'FAILING',
        lastProbeAt: now(),
        detail: 'database-unreachable',
      };
    }
  }

  private async probeNewsProviders(now: () => string): Promise<AdminComponentProbe> {
    let statuses: ProviderHealthStatus[];

    try {
      statuses = await this.newsService.providersHealth();
    } catch {
      return {
        component: 'NEWS_PROVIDER',
        status: 'UNKNOWN',
        lastProbeAt: null,
        detail: 'no-probe-configured',
      };
    }

    if (statuses.length === 0) {
      return {
        component: 'NEWS_PROVIDER',
        status: 'UNKNOWN',
        lastProbeAt: null,
        detail: 'no-probe-configured',
      };
    }

    if (statuses.some((s) => s.status === 'down')) {
      return {
        component: 'NEWS_PROVIDER',
        status: 'FAILING',
        lastProbeAt: now(),
        detail: 'some-providers-down',
      };
    }

    if (statuses.some((s) => s.status === 'degraded')) {
      return {
        component: 'NEWS_PROVIDER',
        status: 'DEGRADED',
        lastProbeAt: now(),
        detail: 'some-providers-degraded',
      };
    }

    return {
      component: 'NEWS_PROVIDER',
      status: 'HEALTHY',
      lastProbeAt: now(),
      detail: 'all-providers-ok',
    };
  }
}

/**
 * Severity order, worst first. UNKNOWN deliberately outranks HEALTHY:
 * a platform with an unprobed component is not known to be healthy, and
 * saying otherwise is the exact failure this surface exists to prevent.
 * NOT_IMPLEMENTED is excluded — a planned surface is not a fault.
 */
const SEVERITY: readonly AdminProbeStatus[] = ['FAILING', 'DEGRADED', 'UNKNOWN', 'HEALTHY'];

export function resolveOverallStatus(components: readonly AdminComponentProbe[]): AdminProbeStatus {
  const considered = components.filter((c) => c.status !== 'NOT_IMPLEMENTED');

  if (considered.length === 0) return 'UNKNOWN';

  for (const status of SEVERITY) {
    if (considered.some((c) => c.status === status)) return status;
  }

  return 'UNKNOWN';
}
