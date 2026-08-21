/**
 * F1.b — the client mirror of the Admin API contract.
 *
 * These literals duplicate
 * `backend/src/modules/admin/system/admin-system.contract.ts` because
 * F1.b is authorized to change no file under `shared/**`, which is where
 * a shared contract would normally live. The duplication is deliberate,
 * disclosed, and guarded: `adminApiContract.spec.ts` reads the backend
 * file and fails if the two ever diverge. Move both into
 * `@globalnews-ai/shared` the next time a shared change is authorized.
 *
 * `ProviderHealthStatus` is NOT duplicated — it already lives in shared
 * and the frontend already depends on it.
 */
import type { ProviderHealthStatus } from '@globalnews-ai/shared';
import type { AdminCapability, AdminRoleName } from './adminCapabilities';

export interface AdminMeResponse {
  adminId: string;
  role: AdminRoleName;
  capabilities: AdminCapability[];
}

export type AdminProbeStatus = 'HEALTHY' | 'DEGRADED' | 'FAILING' | 'UNKNOWN' | 'NOT_IMPLEMENTED';

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
  lastProbeAt: string | null;
  detail: AdminProbeDetail;
}

export interface AdminSystemHealthResponse {
  overall: AdminProbeStatus;
  probedComponentCount: number;
  totalComponentCount: number;
  components: AdminComponentProbe[];
  generatedAt: string;
}

export interface AdminNewsProvidersResponse {
  providers: ProviderHealthStatus[];
  generatedAt: string;
}
