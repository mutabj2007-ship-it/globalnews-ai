import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ProviderHealthStatus } from '@globalnews-ai/shared';
import { PrismaService } from '../../../database/prisma.service';
import { NewsService } from '../../news/news.service';
import {
  ADMIN_HEALTH_COMPONENTS,
  type AdminComponentProbe,
  type AdminIngestionLiveness,
  type AdminProbeStatus,
  type AdminSystemHealthResponse,
} from './admin-system.contract';

/**
 * F1.b + MVP-G4 — the ADMIN-07 probe fan-in.
 *
 * Reads only what the platform ALREADY knows. It introduces no new
 * measurement, no metric store and no schema:
 *
 *   BACKEND        the process answered this request — the same fact
 *                  GET /health asserts, and nothing more
 *   DATABASE       `SELECT 1`, the identical check GET /health/ready runs
 *   NEWS PROVIDER  the existing NewsService.providersHealth() result
 *
 * MVP-G4 adds two more, and neither one makes a network call:
 *
 *   AUTHENTICATION the presence of the three OAuth credentials
 *                  AuthService itself checks before it will start a
 *                  sign-in (G4-1)
 *   AI_PROVIDER    which analysis provider the process would select,
 *                  from configuration alone (G4-2)
 *
 * A LIVE PROBE OF EITHER IS DELIBERATELY NOT IMPLEMENTED. Calling
 * OpenAI to check OpenAI would bill the account on every admin page
 * load, and attempting a Google token exchange would need a real user's
 * consent. Configuration state is what can be known for free, so
 * configuration state is what this reports — and it says so.
 *
 * FRONTEND still has no probe and still reports UNKNOWN, so the overall
 * banner still cannot read HEALTHY. BACKGROUND_SERVICES and
 * KSEF_INTEGRATION remain NOT_IMPLEMENTED.
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
    private readonly config: ConfigService,
  ) {}

  async health(options: { skipProviderProbes?: boolean } = {}): Promise<AdminSystemHealthResponse> {
    const now = (): string => new Date().toISOString();

    const database = await this.probeDatabase(now);
    // Admin GETs must not enter the legacy health fan-out (GNews may acquire).
    // No passive snapshot is available here; unknown is truthful.
    const newsProvider: AdminComponentProbe = options.skipProviderProbes
      ? {
          component: 'NEWS_PROVIDER',
          status: 'UNKNOWN',
          lastProbeAt: null,
          detail: 'no-probe-configured',
        }
      : await this.probeNewsProviders(now);
    const authentication = this.probeAuthentication(now);
    const aiProvider = this.probeAiProvider(now);
    const ingestion = await this.readIngestionLiveness();

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
      aiProvider,
      authentication,
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
      ingestion,
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

  /**
   * G4-1 — AUTHENTICATION, from configuration presence alone.
   *
   * This mirrors AuthService's OWN precondition exactly: it refuses to
   * start a sign-in when any of OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET or
   * OAUTH_FLOW_SECRET is absent or empty, and this probe reports the
   * same condition. Mirroring the falsy check rather than inventing a
   * stricter one is deliberate — a probe that disagreed with the code
   * that actually gates sign-in would be worse than no probe.
   *
   * WHAT IT NEVER REPORTS: a value, a prefix, a length, a fingerprint,
   * or which of the three is missing. The response carries one boolean
   * fact, expressed as a machine key.
   */
  private probeAuthentication(now: () => string): AdminComponentProbe {
    const configured = isOAuthConfigured({
      clientId: this.config.get<string>('OAUTH_CLIENT_ID'),
      clientSecret: this.config.get<string>('OAUTH_CLIENT_SECRET'),
      flowSecret: this.config.get<string>('OAUTH_FLOW_SECRET'),
    });

    return {
      component: 'AUTHENTICATION',
      status: configured ? 'HEALTHY' : 'FAILING',
      lastProbeAt: now(),
      detail: configured ? 'oauth-configured' : 'oauth-not-configured',
    };
  }

  /**
   * G4-2 — AI_PROVIDER, from configuration alone and self-contained.
   *
   * `resolveAiProviderPosture` below reimplements two rules that live in
   * the analysis module, deliberately and without importing or
   * modifying anything there. `adminOperationalProbes.spec.ts` imports
   * the analysis module's own predicate and its own config service and
   * asserts this copy agrees with both, so the duplication cannot drift
   * silently.
   *
   * No request is made to any AI provider. A live probe would bill the
   * account on every admin page load.
   */
  private probeAiProvider(now: () => string): AdminComponentProbe {
    const posture = resolveAiProviderPosture({
      openAiApiKey: this.config.get<string>('OPENAI_API_KEY'),
      nodeEnv: this.config.get<string>('NODE_ENV'),
      aiExecutionMode: this.config.get<string>('AI_EXECUTION_MODE'),
    });

    return {
      component: 'AI_PROVIDER',
      status: posture.status,
      lastProbeAt: now(),
      detail: posture.detail,
    };
  }

  /**
   * G4-5 — ingestion liveness. Two numbers over ONE table.
   *
   * `Article` only: a COUNT and a MAX(fetchedAt). No user, session,
   * search-history or country table is touched, and no article row is
   * returned — `_max` yields a single timestamp, not a record.
   *
   * A database failure returns null rather than zero. Zero articles is a
   * measurement; an unreadable database is not, and reporting one as the
   * other is the exact failure this surface exists to prevent.
   */
  private async readIngestionLiveness(): Promise<AdminIngestionLiveness | null> {
    try {
      const [articleCount, newest] = await Promise.all([
        this.prisma.article.count(),
        this.prisma.article.aggregate({ _max: { fetchedAt: true } }),
      ]);

      const latest = newest._max.fetchedAt;

      return {
        articleCount,
        latestFetchedAt: latest ? latest.toISOString() : null,
      };
    } catch {
      // Deliberately silent, exactly as probeDatabase is: the DATABASE
      // component already reports the failure, and an error string here
      // would be the leak that component avoids.
      return null;
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

/**
 * G4-1 — the OAuth readiness predicate, pure and testable.
 *
 * Falsy rather than trim-based ON PURPOSE: AuthService gates sign-in on
 * `!clientId || !clientSecret || !flowSecret`, so this reports the same
 * condition it does. It takes all three together and returns one
 * boolean; there is deliberately no variant that reveals which one is
 * absent.
 */
export function isOAuthConfigured(credentials: {
  clientId: string | undefined;
  clientSecret: string | undefined;
  flowSecret: string | undefined;
}): boolean {
  return Boolean(credentials.clientId && credentials.clientSecret && credentials.flowSecret);
}

export interface AiProviderPosture {
  status: AdminProbeStatus;
  detail: 'ai-provider-configured' | 'ai-provider-mock-active' | 'ai-provider-not-configured';
}

/**
 * G4-2 — which analysis provider this configuration selects, and
 * whether that is an acceptable posture.
 *
 * Reimplements, without importing them, two rules that live in the
 * analysis module:
 *
 *   1. A usable OPENAI_API_KEY selects the real provider, whatever the
 *      execution mode (`resolveActiveAnalysisProvider`).
 *   2. NODE_ENV=production forces production execution mode regardless
 *      of AI_EXECUTION_MODE (`AnalysisConfigService.readExecutionMode`).
 *
 * The three outcomes:
 *   HEALTHY  a usable key — the real provider is what would answer
 *   DEGRADED no key, development mode — mock analysis is what would
 *            answer. NOT healthy: synthetic analysis is a development
 *            posture, and calling it healthy is the misreading this
 *            probe exists to prevent
 *   FAILING  no key, production mode — the process would refuse to
 *            boot, so seeing this at runtime means configuration
 *            changed underneath a running instance
 */
export function resolveAiProviderPosture(config: {
  openAiApiKey: string | undefined;
  nodeEnv: string | undefined;
  aiExecutionMode: string | undefined;
}): AiProviderPosture {
  const keyUsable =
    typeof config.openAiApiKey === 'string' && config.openAiApiKey.trim().length > 0;

  if (keyUsable) {
    return { status: 'HEALTHY', detail: 'ai-provider-configured' };
  }

  const productionMode =
    config.nodeEnv?.trim().toLowerCase() === 'production' ||
    config.aiExecutionMode?.trim().toLowerCase() === 'production';

  return productionMode
    ? { status: 'FAILING', detail: 'ai-provider-not-configured' }
    : { status: 'DEGRADED', detail: 'ai-provider-mock-active' };
}
