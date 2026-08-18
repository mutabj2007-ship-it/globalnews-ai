import { Inject, Injectable, Logger } from '@nestjs/common';
import { logWithRequestId } from '../../observability/log-with-request-id';
import type { GeoSignal, GeoSignalQueryOptions, ProviderHealthStatus } from '@globalnews-ai/shared';
import type { SignalProvider } from './interfaces';
import { ALL_SIGNAL_PROVIDERS, SIGNAL_PROVIDERS } from './providers/provider.tokens';

interface SignalProviderCallResult {
  results: Array<{
    providerId: string;
    signals: GeoSignal[];
  }>;
  failedProviderIds: string[];
}

/**
 * M64.3 — raised when discoverSignals() cannot honestly return real
 * results: either no provider is currently enabled, or every enabled
 * provider failed. Never silently returned as an empty array in
 * either case — an empty array would read as "queried successfully,
 * found nothing," which is a different, false claim from "could not
 * query at all." Mirrors this codebase's existing honesty conventions
 * (e.g. NewsResponse.dataMode's own "unavailable" vs. a genuine
 * zero-result "live" response — see shared/src/news.ts).
 */
export class SignalsUnavailableError extends Error {
  constructor(
    message: string,
    public readonly failedProviderIds: string[] = [],
  ) {
    super(message);
    this.name = 'SignalsUnavailableError';
  }
}

/**
 * M64.3 — Signals Runtime Orchestration Foundation.
 *
 * Mirrors NewsService's own callAllProviders()/providersHealth()
 * pattern exactly, adapted for GeoSignal instead of NewsArticle:
 *
 *   SIGNAL_PROVIDERS (enabled providers)
 *     -> Promise.allSettled(provider.discoverSignals(options))
 *     -> successful GeoSignal[] batches (one provider's failure never
 *        discards another provider's successful results)
 *     -> flatten + merge
 *     -> stable-id dedupe (a signal appearing from two providers, or
 *        appearing twice within one provider's own batch, is kept once)
 *     -> final GeoSignal[]
 *
 * Health aggregation (providersHealth()) operates over
 * ALL_SIGNAL_PROVIDERS — every registered provider, including a
 * currently-disabled one — exactly mirroring NewsService's own
 * providersHealth()/ALL_NEWS_PROVIDERS relationship, so a disabled
 * provider's health/status remains visible for operations even
 * though it contributes nothing to discoverSignals().
 *
 * No controller consumes this service in M64.3 — it exists, is
 * injectable, and is exported from SignalsModule, but nothing routes
 * a public request to it yet.
 */
@Injectable()
export class SignalsService {
  private readonly logger = new Logger(SignalsService.name);

  constructor(
    @Inject(SIGNAL_PROVIDERS)
    private readonly providers: SignalProvider[],

    @Inject(ALL_SIGNAL_PROVIDERS)
    private readonly allProviders: SignalProvider[],
  ) {}

  /**
   * Discovers signals across every currently-enabled provider.
   *
   * Honest failure contract:
   *   - zero enabled providers -> SignalsUnavailableError (never an
   *     empty array masquerading as "queried, found nothing").
   *   - one or more enabled providers, all of which fail -> also
   *     SignalsUnavailableError, carrying which provider ids failed.
   *   - at least one enabled provider succeeds -> that provider's
   *     (deduped, merged) results are returned, even if a sibling
   *     provider in the same call failed. A partial failure is never
   *     treated as a total failure when real results exist.
   */
  async discoverSignals(options?: GeoSignalQueryOptions): Promise<GeoSignal[]> {
    if (this.providers.length === 0) {
      throw new SignalsUnavailableError('No signal providers are currently enabled.');
    }

    const providerCall = await this.callAllProviders(options);

    if (providerCall.results.length === 0) {
      throw new SignalsUnavailableError(
        `All enabled signal providers failed: ${providerCall.failedProviderIds.join(', ')}`,
        providerCall.failedProviderIds,
      );
    }

    const merged = providerCall.results.flatMap((result) => result.signals);
    return this.deduplicateById(merged);
  }

  /**
   * Health for every REGISTERED provider, enabled or not — mirrors
   * NewsService.providersHealth()'s exact shape and failure handling
   * (a provider whose own health() call throws is reported as 'down'
   * rather than propagating the exception, so one broken provider's
   * health check never breaks the whole aggregate response).
   */
  async providersHealth(): Promise<ProviderHealthStatus[]> {
    return Promise.all(
      this.allProviders.map(async (provider) => {
        try {
          return await provider.health();
        } catch (error) {
          logWithRequestId(
            this.logger,
            'warn',
            `Health check failed for signal provider "${provider.id}"`,
            error instanceof Error ? error : undefined,
          );

          return {
            providerId: provider.id,
            displayName: provider.displayName,
            status: 'down' as const,
            message: error instanceof Error ? error.message : 'Unknown error',
            checkedAt: new Date().toISOString(),
          };
        }
      }),
    );
  }

  private async callAllProviders(options?: GeoSignalQueryOptions): Promise<SignalProviderCallResult> {
    const settled = await Promise.allSettled(
      this.providers.map(async (provider) => ({
        providerId: provider.id,
        signals: await provider.discoverSignals(options),
      })),
    );

    const results: SignalProviderCallResult['results'] = [];
    const failedProviderIds: string[] = [];

    settled.forEach((result, index) => {
      const provider = this.providers[index];

      if (result.status === 'fulfilled') {
        results.push(result.value);
        return;
      }

      failedProviderIds.push(provider.id);

      logWithRequestId(
        this.logger,
        'warn',
        `Signal provider "${provider.id}" failed to respond`,
        result.reason instanceof Error ? result.reason : undefined,
      );
    });

    return { results, failedProviderIds };
  }

  /**
   * Stable-id dedupe across (and within) provider batches — a signal
   * with the same id appearing more than once (from the same provider
   * re-reporting it, or, in a future multi-provider scenario, two
   * different providers converging on the same underlying geographic
   * observation) is kept once, preserving the first occurrence.
   */
  private deduplicateById(signals: GeoSignal[]): GeoSignal[] {
    const seen = new Set<string>();
    const deduped: GeoSignal[] = [];

    for (const signal of signals) {
      if (seen.has(signal.id)) continue;
      seen.add(signal.id);
      deduped.push(signal);
    }

    return deduped;
  }
}
