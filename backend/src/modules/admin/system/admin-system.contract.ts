import type { ProviderHealthState } from '@globalnews-ai/shared';

/**
 * F1.b — the Admin system-health contract.
 *
 * Lives in the admin module rather than in `@globalnews-ai/shared`
 * because F1.b is authorized to change no shared file. The frontend
 * mirrors these literals in `frontend/src/lib/admin/adminApiTypes.ts`,
 * and `adminApiContract.spec.ts` asserts the two stay identical, so the
 * duplication cannot drift silently. Move it into shared the next time
 * a shared change is authorized.
 *
 * MVP-G4 extends this contract in three ways and removes one thing:
 *   + AUTHENTICATION and AI_PROVIDER gain real probes (G4-1, G4-2)
 *   + provider rows carry `enabled` and `providerKind` (G4-3)
 *   + the health response carries an ingestion-liveness aggregate (G4-5)
 *   - provider `message` prose is no longer projected at all (G4-4)
 */

/**
 * A component's condition, asserted ONLY from a probe result.
 *
 * UNKNOWN is not a failure and not a success — it means no probe exists
 * or none has run. NOT_IMPLEMENTED means the component is a planned
 * surface with nothing behind it yet. Neither may ever be presented as
 * HEALTHY.
 */
export type AdminProbeStatus = 'HEALTHY' | 'DEGRADED' | 'FAILING' | 'UNKNOWN' | 'NOT_IMPLEMENTED';

/** The eight components the approved design's ADMIN-07 covers. */
export const ADMIN_HEALTH_COMPONENTS = [
  'FRONTEND',
  'BACKEND',
  'DATABASE',
  'NEWS_PROVIDER',
  'AI_PROVIDER',
  'AUTHENTICATION',
  'BACKGROUND_SERVICES',
  'KSEF_INTEGRATION',
] as const;

export type AdminHealthComponent = (typeof ADMIN_HEALTH_COMPONENTS)[number];

/**
 * Machine-readable reason keys — never prose.
 *
 * The admin surface is localized in English and Polish, so a
 * human-readable sentence returned from the backend would be
 * untranslatable by construction. The frontend maps these keys to
 * dictionary strings.
 *
 * THE OAUTH KEYS ARE DELIBERATELY UNDIFFERENTIATED. `oauth-not-configured`
 * never says WHICH of the three credentials is absent, and there is no
 * key that could. Naming the missing one would tell an unauthenticated
 * prober — or a compromised low-privilege admin — exactly which secret
 * to target.
 */
export type AdminProbeDetail =
  | 'process-serving-requests'
  | 'database-reachable'
  | 'database-unreachable'
  | 'all-providers-ok'
  | 'some-providers-degraded'
  | 'some-providers-down'
  | 'oauth-configured'
  | 'oauth-not-configured'
  | 'ai-provider-configured'
  | 'ai-provider-mock-active'
  | 'ai-provider-not-configured'
  | 'no-probe-configured'
  | 'not-implemented';

export interface AdminComponentProbe {
  component: AdminHealthComponent;
  status: AdminProbeStatus;
  /** ISO-8601 of this probe, or null when no probe exists to have run. */
  lastProbeAt: string | null;
  detail: AdminProbeDetail;
}

/**
 * MVP-G4 (G4-5) — ingestion liveness.
 *
 * The smallest aggregate that answers "is this deployment's news
 * pipeline actually producing content, and when did it last do so".
 *
 * IT CONTAINS NO USER INFORMATION, AND CANNOT. Both values are computed
 * over the `Article` table alone — a count and one MAX(fetchedAt). No
 * user, session, search-history or geography table is read, no article
 * row is disclosed, and there is no field here that could carry one.
 */
export interface AdminIngestionLiveness {
  /** COUNT(*) over Article. A true zero is a measurement, not an absence. */
  articleCount: number;
  /** MAX(fetchedAt) over Article, or null when the table is empty. */
  latestFetchedAt: string | null;
}

export interface AdminSystemHealthResponse {
  /**
   * Worst PROBED component wins. NOT_IMPLEMENTED components are excluded
   * — a planned surface is not a fault. UNKNOWN outranks HEALTHY, so
   * while any component lacks a probe the overall status can never read
   * HEALTHY. That is the approved design's rule ("all systems
   * operational requires every component healthy and fresh").
   *
   * MVP-G4 takes the probed count from three to five. FRONTEND still has
   * no probe, so the banner still cannot read HEALTHY — deliberately.
   */
  overall: AdminProbeStatus;
  probedComponentCount: number;
  totalComponentCount: number;
  components: AdminComponentProbe[];
  /** null when the database could not be read — never a fabricated zero. */
  ingestion: AdminIngestionLiveness | null;
  generatedAt: string;
}

/**
 * MVP-G4 (G4-3) — how a registered provider relates to real traffic.
 *
 * REAL and MOCK are read from the provider's own `isMock` flag. UNKNOWN
 * exists so that a provider this service cannot identify is never
 * claimed to be real; it is fail-closed, and no code path produces it
 * today.
 */
export type AdminProviderKind = 'REAL' | 'MOCK' | 'UNKNOWN';

/**
 * MVP-G4 (G4-3, G4-4) — the admin projection of one provider's health.
 *
 * This is an ADMIN-LOCAL type rather than the shared
 * `ProviderHealthStatus`, for two reasons:
 *
 *   1. `message` IS ABSENT BY CONSTRUCTION. The shared type carries a
 *      free-text `message` that `NewsService.providersHealth()` fills
 *      from `error.message` on any provider whose health check throws.
 *      Forwarding it put uncontrolled provider prose into a bilingual
 *      admin surface — untranslatable, and an open channel for whatever
 *      a future provider happens to put in an error. There is no field
 *      here for it to land in.
 *   2. `enabled` and `providerKind` are ASSERTED, not optional. The
 *      shared type's `enabled` is optional and no provider populates it;
 *      here it is computed from the active provider set on every request.
 *
 * Every remaining optional field is a genuine counter and is OMITTED
 * when unpopulated, never zero-filled — the frontend renders an absent
 * counter as UNKNOWN, and a zero would be a measurement nobody took.
 */
export interface AdminProviderHealth {
  providerId: string;
  displayName: string;
  status: ProviderHealthState;
  checkedAt: string;

  /** True only when this provider is in the ACTIVE set serving reads. */
  enabled: boolean;
  /** Whether this provider is synthetic. */
  providerKind: AdminProviderKind;

  requestCount?: number;
  failureCount?: number;
  lastLatencyMs?: number;
  lastSuccessAt?: string;
  rateLimitState?: 'ok' | 'throttled' | 'unknown';
  recordsRetrieved?: number;
  recordsAccepted?: number;
  duplicatesRemoved?: number;
  geoResolutionSuccessRate?: number;
}

export interface AdminNewsProvidersResponse {
  /**
   * Every REGISTERED provider, each one marked with whether it is
   * actually serving reads. Reporting only the active set would hide a
   * configured-but-idle provider; reporting the registered set without
   * `enabled` — which is what this surface did before MVP-G4 — implied
   * that every row was serving traffic. Both are now visible at once.
   */
  providers: AdminProviderHealth[];
  generatedAt: string;
}
