import type { GeoSignal, GeoSignalQueryOptions, ProviderHealthStatus } from '@globalnews-ai/shared';

/**
 * M64.1 — the GDELT-shaped provider seam, deliberately separate from
 * NewsProvider (see news-provider.interface.ts).
 *
 * A SignalProvider returns GeoSignal[], never NewsArticle[]. This is
 * a design/process invariant, not a compiler-enforced guarantee — see
 * GeoSignal's own doc comment (shared/src/signals.ts) for the full,
 * honest statement of what is and isn't structurally prevented.
 *
 * No implementation exists yet in M64.1 — this is the contract only,
 * mirroring exactly how AnalysisProvider and NewsProvider already
 * establish their own seams before any concrete provider is required
 * to exist.
 */
export interface SignalProvider {
  /** Stable machine-readable identifier, e.g. "gdelt". */
  readonly id: string;

  /** Human-readable name shown in provider health/status output. */
  readonly displayName: string;

  /** Whether this provider returns synthetic/sample signals rather than live data. */
  readonly isMock: boolean;

  /** Discovers geographic/event/trend signals matching the given options. */
  discoverSignals(options?: GeoSignalQueryOptions): Promise<GeoSignal[]>;

  /** Lightweight liveness/readiness check for this provider. */
  health(): Promise<ProviderHealthStatus>;
}
