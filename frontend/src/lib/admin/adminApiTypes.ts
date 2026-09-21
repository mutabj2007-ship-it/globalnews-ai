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
 * `ProviderHealthState` is NOT duplicated — it already lives in shared
 * and the frontend already depends on it. `ProviderHealthStatus` is no
 * longer used here: MVP-G4's admin projection is a narrower,
 * admin-local shape that carries no free-text `message` field at all.
 */
import type { ProviderHealthState } from '@globalnews-ai/shared';
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
  lastProbeAt: string | null;
  detail: AdminProbeDetail;
}

/** MVP-G4 (G4-5) — article-shaped only. There is no user field here. */
export interface AdminIngestionLiveness {
  articleCount: number;
  latestFetchedAt: string | null;
}

export interface AdminSystemHealthResponse {
  overall: AdminProbeStatus;
  probedComponentCount: number;
  totalComponentCount: number;
  components: AdminComponentProbe[];
  /** null when the database could not be read — never a rendered zero. */
  ingestion: AdminIngestionLiveness | null;
  generatedAt: string;
}

export type AdminProviderKind = 'REAL' | 'MOCK' | 'UNKNOWN';

/**
 * MVP-G4 (G4-3, G4-4) — one provider row as the admin surface receives
 * it. `enabled` and `providerKind` are always present; `message` does
 * not exist on this type, so no screen can render provider prose.
 */
export interface AdminProviderHealth {
  providerId: string;
  displayName: string;
  status: ProviderHealthState;
  checkedAt: string;
  enabled: boolean;
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

export interface AdminArticleInventory {
  articleCount: number;
  latestFetchedAt: string | null;
  bySource: Array<{
    sourceId: string;
    sourceName: string;
    articleCount: number;
    latestFetchedAt: string | null;
  }>;
  byCountry: Array<{ countryCode: string; articleCount: number }>;
}

export interface AdminNewsProvidersResponse {
  providers: AdminProviderHealth[];
  sources: Array<{
    sourceId: string;
    displayName: string;
    countryCode: string;
    sourceType: 'NEWS_PROVIDER' | 'OFFICIAL_SOURCE';
    language?: string;
    enabled: boolean;
  }>;
  inventory: AdminArticleInventory | null;
  execution?: {
    buckets: Array<{
      provider: string;
      endpointClass: string;
      cacheHits: number;
      cacheMisses: number;
      executions: number;
    }>;
    totalExecutions: number;
  };
  generatedAt: string;
}

/**
 * S3 — the admin support shapes, RE-EXPORTED from `@globalnews-ai/shared`
 * rather than duplicated.
 *
 * The health literals above are mirrored by hand because F1.b was
 * authorized to change no file under `shared/**`. S3 was authorized to
 * change `shared/src/support.ts`, so the support contract has one
 * declaration and no mirror to drift — the better arrangement, and the
 * one `adminApiTypes.ts`'s own header recommends for the health types
 * the next time a shared change is authorized.
 *
 * They pass through this file so an admin screen keeps importing its
 * types from `adminApiTypes`, the way every other admin screen already
 * does, instead of a second import path appearing in the components
 * layer.
 *
 * NOTE WHAT IS NOT RE-EXPORTED: `SupportMessageView`,
 * `SupportTicketSummary` and `SupportTicketDetail` — the USER-facing
 * shapes — are absent on purpose. Nothing in the admin surface should be
 * able to reach for a user shape by accident, and nothing in the user
 * surface should reach for an admin one.
 */
/**
 * ADMIN-03 — the mirror of
 * `backend/src/modules/admin/analytics/admin-analytics.contract.ts`.
 *
 * Same arrangement and same reason as the health literals above: this
 * lane is authorized to change no file under `shared/**`, so the shapes
 * are duplicated by hand and `adminApiContract.spec.ts` reads the
 * backend file and fails if the two diverge.
 *
 * READ THE BACKEND CONTRACT FOR WHY EACH FIELD IS SHAPED THIS WAY. The
 * short version, because it governs how these types may be rendered:
 *
 *   - a null SECTION means the read FAILED. It is not "no data" and it
 *     is not zero. A screen renders it as an error with a retry.
 *   - an omitted aggregate means NOBODY MEASURED IT. `averageMs` absent
 *     is not `averageMs: 0`.
 *   - `observedReturning*` IS NOT ACTIVE USERS and must never be
 *     rendered under that label. It counts accounts whose recorded
 *     return visit falls in the window; anonymous readers and
 *     signed-in readers who never touch the return surface are both
 *     invisible to it. "Active users" has no source of truth here.
 *   - there is NO audience-geography type, deliberately.
 */
export interface AdminAnalyticsCount {
  key: string;
  count: number;
}

export interface AdminAnalyticsProviderCount {
  provider: string;
  model: string | null;
  count: number;
}

export interface AdminAnalyticsSample {
  sampleCount: number;
  averageMs?: number;
  minMs?: number;
  maxMs?: number;
}

export interface AdminAnalyticsTokenTotals {
  sampleCount: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface AdminAccountAggregates {
  total: number;
  createdLast24h: number;
  createdLast7d: number;
  observedReturningLast24h: number;
  observedReturningLast7d: number;
  neverObservedReturning: number;
}

export interface AdminAnalysisAggregates {
  runsLast24h: number;
  runsLast7d: number;
  byStatus: AdminAnalyticsCount[];
  byFailureReason: AdminAnalyticsCount[];
  byProvider: AdminAnalyticsProviderCount[];
  cacheHits: number;
  cacheMisses: number;
  latency: AdminAnalyticsSample;
  tokens: AdminAnalyticsTokenTotals;
}

export interface AdminProductEventAggregates {
  recorded: AdminAnalyticsCount[];
  instrumentedEventNames: string[];
  uninstrumentedEventNames: string[];
}

export interface AdminRetentionDisclosure {
  declaredDays: number;
  enforced: boolean;
}

export interface AdminAnalyticsWindows {
  shortHours: number;
  longHours: number;
}

export interface AdminAnalyticsUsageResponse {
  accounts: AdminAccountAggregates | null;
  analysis: AdminAnalysisAggregates | null;
  events: AdminProductEventAggregates | null;
  retention: AdminRetentionDisclosure;
  windows: AdminAnalyticsWindows;
  generatedAt: string;
}

export interface AdminCoverageCountry {
  countryCode: string;
  countryName: string;
  relevantArticleCount: number;
  totalArticleCount: number;
}

export interface AdminFollowedCountry {
  countryCode: string;
  followerAccountCount: number;
}

export interface AdminCoverageGeographyResponse {
  countries: AdminCoverageCountry[] | null;
  distinctCountriesWithRelevantCoverage: number | null;
  followedCountries: AdminFollowedCountry[] | null;
  countryLimit: number;
  generatedAt: string;
}

/**
 * One account. THE ABSENT FIELDS ARE THE CONTRACT: there is no address,
 * no masked or partial address, no domain, no search-history text, no
 * OAuth identity value, no session hash -- and no displayName. None of
 * them is filtered out on the way to the screen; none is ever fetched.
 */
export interface AdminAccountRecord {
  id: string;
  createdAt: string;
  lastSeenAt: string | null;
  adminRole: AdminRoleName | null;
}

export interface AdminUsersResponse {
  accounts: AdminAccountRecord[] | null;
  totalCount: number | null;
  byAdminRole: AdminAnalyticsCount[] | null;
  page: number;
  pageSize: number;
  generatedAt: string;
}

export type {
  AdminSupportMessageView,
  AdminSupportQueueResponse,
  AdminSupportStatusAction,
  AdminSupportTicketDetail,
  AdminSupportTicketSummary,
  SupportCategory,
  SupportMessageVisibility,
  SupportTicketStatus,
} from '@globalnews-ai/shared';

export { ADMIN_SUPPORT_STATUS_ACTIONS, SUPPORT_TICKET_STATUSES } from '@globalnews-ai/shared';
