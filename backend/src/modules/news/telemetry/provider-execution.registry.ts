import { Injectable } from '@nestjs/common';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PROVIDER EXECUTION TELEMETRY — COUNT WHAT IS SPENT, STOP INFERRING IT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `MAP-GNEWS-QUOTA-REGRESSION-1` had to be diagnosed by reading `durationMs`
 * out of an HTTP log and guessing that 0–1 ms meant a cache hit and 487 ms
 * meant a provider round trip. **That guess was right, and it should never have
 * been necessary.**
 *
 * A quota question deserves a counter, not a stopwatch.
 *
 * ── THE FOUR STAGES THIS SEPARATES ───────────────────────────────────────
 *
 *   frontend request → backend request → cache miss → PROVIDER EXECUTION
 *
 * Only the last one costs quota. Every earlier stage is free, and conflating
 * them is exactly how "the endpoint was called" got mistaken for "the provider
 * ran" in the first place.
 *
 * ── WHY THIS IS NOT ON THE PUBLIC HEALTH ROUTE ───────────────────────────
 *
 * `GET /news/providers/health` is anonymous. Execution counts per provider are
 * an operational signal about spend and capacity: they let an unauthenticated
 * caller watch quota drain in real time, confirm which provider is live, and
 * time requests against a limit. The ruling says to prefer admin-safe
 * instrumentation, and this registry is therefore read only through the
 * existing ADMIN-06 projection, behind the admin guard that already protects
 * it.
 *
 * ── WHAT IS DELIBERATELY NOT RECORDED ────────────────────────────────────
 *
 * No query text, no country code, no article, no API key, no URL. A counter
 * that accumulated the places a reader looked at would be a behavioural log
 * wearing a metrics costume. This holds four scalars per bucket and nothing
 * that could identify a person or a search.
 *
 * In-memory and per-instance, matching the caches it measures. It is an
 * operational counter, not an accounting ledger, and it resets when the
 * process does — which is honest, because the caches reset then too.
 */

/** The class of work a request belongs to, never the specific subject. */
export type ProviderEndpointClass =
  | 'country-news'
  | 'top-headlines'
  | 'search'
  | 'category';

export interface ProviderExecutionCounters {
  readonly provider: string;
  readonly endpointClass: ProviderEndpointClass;
  /** Backend requests that were served without reaching any provider. */
  readonly cacheHits: number;
  /** Backend requests that fell through the cache. */
  readonly cacheMisses: number;
  /** **The quota-bearing number.** Provider invocations actually issued. */
  readonly executions: number;
}

function bucketKey(provider: string, endpointClass: ProviderEndpointClass): string {
  return `${provider}::${endpointClass}`;
}

@Injectable()
export class ProviderExecutionRegistry {
  private readonly buckets = new Map<string, ProviderExecutionCounters>();

  private mutate(
    provider: string,
    endpointClass: ProviderEndpointClass,
    change: Partial<Pick<ProviderExecutionCounters, 'cacheHits' | 'cacheMisses' | 'executions'>>,
  ): void {
    const key = bucketKey(provider, endpointClass);
    const current = this.buckets.get(key) ?? {
      provider,
      endpointClass,
      cacheHits: 0,
      cacheMisses: 0,
      executions: 0,
    };

    this.buckets.set(key, {
      ...current,
      cacheHits: current.cacheHits + (change.cacheHits ?? 0),
      cacheMisses: current.cacheMisses + (change.cacheMisses ?? 0),
      executions: current.executions + (change.executions ?? 0),
    });
  }

  /** A request served from cache. No provider ran; no quota was spent. */
  recordCacheHit(endpointClass: ProviderEndpointClass): void {
    this.mutate('cache', endpointClass, { cacheHits: 1 });
  }

  /** A request that fell through the cache. A provider MAY now run. */
  recordCacheMiss(endpointClass: ProviderEndpointClass): void {
    this.mutate('cache', endpointClass, { cacheMisses: 1 });
  }

  /**
   * A provider was actually invoked. **This is the quota-bearing event**, and
   * it is recorded at the invocation itself rather than inferred from an
   * outcome — a call that fails, times out or is rate-limited has still been
   * spent, and the SWZ measurement (GNews rate-limited, two fallbacks, a GDELT
   * cooldown) is the reason that distinction matters.
   */
  recordExecution(provider: string, endpointClass: ProviderEndpointClass): void {
    this.mutate(provider, endpointClass, { executions: 1 });
  }

  snapshot(): readonly ProviderExecutionCounters[] {
    return [...this.buckets.values()].sort((a, b) =>
      a.provider === b.provider
        ? a.endpointClass.localeCompare(b.endpointClass)
        : a.provider.localeCompare(b.provider),
    );
  }

  /** Total invocations across every provider — the headline quota figure. */
  totalExecutions(): number {
    return this.snapshot().reduce((sum, bucket) => sum + bucket.executions, 0);
  }

  /** Test-support only, so one suite cannot inherit another's counts. */
  reset(): void {
    this.buckets.clear();
  }
}
