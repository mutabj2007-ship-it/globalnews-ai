import type { ProviderHealthStatus } from '@globalnews-ai/shared';

/**
 * F1.b — the Admin system-health contract.
 *
 * Lives in the admin module rather than in `@globalnews-ai/shared`
 * because F1.b is authorized to change no shared file. The frontend
 * mirrors these literals in `frontend/src/lib/admin/adminApiTypes.ts`,
 * and `adminApiContract.spec.ts` asserts the two stay identical, so the
 * duplication cannot drift silently. Move it into shared the next time
 * a shared change is authorized.
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
 */
export type AdminProbeDetail =
  | 'process-serving-requests'
  | 'database-reachable'
  | 'database-unreachable'
  | 'all-providers-ok'
  | 'some-providers-degraded'
  | 'some-providers-down'
  | 'no-probe-configured'
  | 'not-implemented';

export interface AdminComponentProbe {
  component: AdminHealthComponent;
  status: AdminProbeStatus;
  /** ISO-8601 of this probe, or null when no probe exists to have run. */
  lastProbeAt: string | null;
  detail: AdminProbeDetail;
}

export interface AdminSystemHealthResponse {
  /**
   * Worst PROBED component wins. NOT_IMPLEMENTED components are excluded
   * — a planned surface is not a fault. UNKNOWN outranks HEALTHY, so
   * while any component lacks a probe the overall status can never read
   * HEALTHY. That is the approved design's rule ("all systems
   * operational requires every component healthy and fresh"), and with
   * five of eight components unprobed today it means this endpoint
   * cannot currently return HEALTHY at all. That is correct, not a
   * defect.
   */
  overall: AdminProbeStatus;
  probedComponentCount: number;
  totalComponentCount: number;
  components: AdminComponentProbe[];
  generatedAt: string;
}

export interface AdminNewsProvidersResponse {
  /**
   * A faithful projection of the existing GET /news/providers/health
   * payload for EVERY registered provider. Optional observability
   * fields that no provider populates are OMITTED, never zero-filled —
   * the frontend renders an absent counter as UNKNOWN, and a zero would
   * be a fabricated measurement.
   */
  providers: ProviderHealthStatus[];
  generatedAt: string;
}
