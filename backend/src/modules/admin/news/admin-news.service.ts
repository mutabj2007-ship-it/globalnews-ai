import { Injectable } from '@nestjs/common';
import type { ProviderHealthStatus } from '@globalnews-ai/shared';
import { NewsService } from '../../news/news.service';
import type { AdminNewsProvidersResponse } from '../system/admin-system.contract';

/**
 * F1.b — the ADMIN-06 provider projection.
 *
 * A guarded, read-only view of the payload GET /news/providers/health
 * already returns, for EVERY registered provider (E1 keeps
 * ALL_NEWS_PROVIDERS separate from the active set, so a provider that
 * contributes no article still reports its health).
 *
 * THE ONE RULE THIS FILE EXISTS TO ENFORCE: never zero-fill.
 *
 * ProviderHealthStatus declares nine optional observability fields —
 * enabled, requestCount, failureCount, lastLatencyMs, lastSuccessAt,
 * rateLimitState, recordsRetrieved, recordsAccepted, duplicatesRemoved,
 * geoResolutionSuccessRate (M64.1). The interface's own comment records
 * that no provider populates any of them, and F0 verified that against
 * GNewsProvider.health() and MockNewsProvider. They arrive `undefined`.
 *
 * An absent counter is therefore OMITTED from the response so the
 * frontend renders UNKNOWN. Emitting 0 would be a fabricated
 * measurement — the precise thing the Admin contract forbids.
 */
@Injectable()
export class AdminNewsService {
  constructor(private readonly newsService: NewsService) {}

  async providers(): Promise<AdminNewsProvidersResponse> {
    const statuses = await this.newsService.providersHealth();

    return {
      providers: statuses.map(projectProviderHealth),
      generatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Rebuilds each status from its DEFINED keys only. Written as an
 * explicit key sweep rather than a spread so that a future provider
 * which starts reporting a real counter is passed through unchanged,
 * while an absent one can never become a zero on the way out.
 */
export function projectProviderHealth(status: ProviderHealthStatus): ProviderHealthStatus {
  const projected: Record<string, unknown> = {
    providerId: status.providerId,
    displayName: status.displayName,
    status: status.status,
    checkedAt: status.checkedAt,
  };

  const optionalKeys = [
    'message',
    'enabled',
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

  return projected as unknown as ProviderHealthStatus;
}
