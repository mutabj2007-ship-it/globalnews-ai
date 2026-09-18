import { Inject, Injectable, Optional } from '@nestjs/common';
import type { ProviderHealthStatus } from '@globalnews-ai/shared';
import type { NewsProvider } from '../../news/interfaces';
import { ALL_NEWS_PROVIDERS, NEWS_PROVIDERS } from '../../news/providers/provider.tokens';
import { NewsService } from '../../news/news.service';
import { ProviderExecutionRegistry } from '../../news/telemetry/provider-execution.registry';
import type {
  AdminNewsProvidersResponse,
  AdminProviderHealth,
  AdminProviderKind,
} from '../system/admin-system.contract';

/**
 * F1.b + MVP-G4 — the ADMIN-06 provider projection.
 *
 * WHAT MVP-G4 CHANGED, AND WHY IT WAS A CORRECTNESS FIX RATHER THAN A
 * FEATURE.
 *
 * `NewsService.providersHealth()` iterates ALL_NEWS_PROVIDERS — the
 * REGISTERED set, which always contains the synthetic mock wire —
 * while real traffic is served by NEWS_PROVIDERS, the ACTIVE set. The
 * admin table therefore listed the mock provider beside the real one
 * with nothing marking which was serving reads, and an operator reading
 * "mock-wire: ok" had no way to tell whether that meant the deployment
 * was healthy or that it was serving synthetic news.
 *
 * Both token sets are injected here so the answer comes from the same
 * DI factories that select the providers, rather than from a guess:
 *
 *   NEWS_PROVIDERS      -> `enabled`      (is this provider serving reads)
 *   ALL_NEWS_PROVIDERS  -> `providerKind` (is this provider synthetic)
 *
 * NEITHER TOKEN IS CALLED. The provider objects are read for `id` and
 * `isMock` only; no search, no health check, no network request happens
 * in this service.
 */
@Injectable()
export class AdminNewsService {
  constructor(
    private readonly newsService: NewsService,
    @Inject(NEWS_PROVIDERS)
    private readonly activeProviders: NewsProvider[],
    @Inject(ALL_NEWS_PROVIDERS)
    private readonly registeredProviders: NewsProvider[],
    /**
     * R5 — THE READER THE REGISTRY NEVER HAD.
     *
     * R2 shipped `ProviderExecutionRegistry` and nothing outside its own spec
     * ever called `snapshot()` or `totalExecutions()`, so R4 had to answer a
     * quota question with a spy. This is the one place it is read, and it sits
     * behind the admin guard for the reason the registry's own header gives:
     * execution counts let a caller watch quota drain in real time.
     *
     * `@Optional()`, AND LAST. Nest resolves it from NewsModule, which exports
     * it; a suite that constructs this service directly with three arguments,
     * or assembles a test module without the registry, keeps working and
     * simply reports empty counters.
     *
     * Both halves of that are lessons paid for: adding a REQUIRED constructor
     * parameter to a service tests construct by hand turned 13 suites red in
     * R2, and a bare `@Inject()` on a property turned 19 suites red in R5.
     * Telemetry may not break assembly.
     */
    @Optional()
    private readonly executions?: ProviderExecutionRegistry,
  ) {}

  async providers(): Promise<AdminNewsProvidersResponse> {
    const statuses = await this.newsService.providersHealth();

    const activeIds = new Set(this.activeProviders.map((provider) => provider.id));
    const kinds = new Map<string, AdminProviderKind>(
      this.registeredProviders.map((provider) => [
        provider.id,
        provider.isMock ? 'MOCK' : ('REAL' as AdminProviderKind),
      ]),
    );

    /*
      Read, never reset. This route reports what the process has spent; a read
      that cleared the counters would make two operators looking at the same
      deployment see different numbers and neither of them the truth.
    */
    const buckets = this.executions?.snapshot() ?? [];

    return {
      providers: statuses.map((status) =>
        projectProviderHealth(status, {
          enabled: activeIds.has(status.providerId),
          providerKind: kinds.get(status.providerId) ?? 'UNKNOWN',
        }),
      ),
      execution: {
        buckets: buckets.map((bucket) => ({
          provider: bucket.provider,
          endpointClass: bucket.endpointClass,
          cacheHits: bucket.cacheHits,
          cacheMisses: bucket.cacheMisses,
          executions: bucket.executions,
        })),
        totalExecutions: this.executions?.totalExecutions() ?? 0,
      },
      generatedAt: new Date().toISOString(),
    };
  }
}

/**
 * The projection itself.
 *
 * TWO RULES, BOTH LOAD-BEARING.
 *
 * 1. `message` IS NOT COPIED, AND THERE IS NO KEY FOR IT.
 *    `NewsService.providersHealth()` fills the shared type's `message`
 *    from `error.message` for any provider whose health check throws,
 *    and this surface used to forward that sentence straight into a
 *    bilingual admin table: untranslatable by construction, and an
 *    uncontrolled channel for whatever text a future provider puts in
 *    an error. `status` already carries the operational meaning, so the
 *    prose is dropped rather than sanitised — a filter can be wrong,
 *    an absent field cannot.
 *
 * 2. AN UNPOPULATED COUNTER STAYS ABSENT.
 *    Optional fields are copied only when genuinely present, never
 *    zero-filled. The frontend renders an absent counter as UNKNOWN; a
 *    zero would be a measurement nobody took.
 *
 * `enabled` and `providerKind` are supplied by the caller from the DI
 * token sets, so this function cannot invent them either.
 */
export function projectProviderHealth(
  status: ProviderHealthStatus,
  membership: { enabled: boolean; providerKind: AdminProviderKind },
): AdminProviderHealth {
  const projected: Record<string, unknown> = {
    providerId: status.providerId,
    displayName: status.displayName,
    status: status.status,
    checkedAt: status.checkedAt,
    enabled: membership.enabled,
    providerKind: membership.providerKind,
  };

  const optionalKeys = [
    'requestCount',
    'failureCount',
    'lastLatencyMs',
    'lastSuccessAt',
    'rateLimitState',
    'recordsRetrieved',
    'recordsAccepted',
    'duplicatesRemoved',
    'geoResolutionSuccessRate',
  ] as const;

  for (const key of optionalKeys) {
    const value = (status as unknown as Record<string, unknown>)[key];
    if (value !== undefined && value !== null) {
      projected[key] = value;
    }
  }

  return projected as unknown as AdminProviderHealth;
}
