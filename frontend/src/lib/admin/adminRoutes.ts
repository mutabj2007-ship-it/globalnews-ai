/**
 * F1.b — the twenty canonical Admin routes, and the ONLY place an
 * `/admin/...` path string is written.
 *
 * Fifteen administrative capabilities, nine screens, twenty routes —
 * the approved Claude Design route map, transcribed. Every tab is a
 * real URL, so a filtered view is shareable; that is the design's own
 * navigation contract, not an embellishment.
 *
 * `adminRouteManifest.spec.ts` asserts every route here has a page file,
 * every page file is here, and that no other file hardcodes an `/admin`
 * path.
 */
export const ADMIN_ROUTES = {
  overview: '/admin',

  news: '/admin/news',
  newsSources: '/admin/news/sources',

  ai: '/admin/ai',
  aiProviders: '/admin/ai/providers',

  users: '/admin/users',
  usersSubscriptions: '/admin/users/subscriptions',

  analytics: '/admin/analytics',
  analyticsGeography: '/admin/analytics/geography',

  payments: '/admin/payments',
  paymentsVat: '/admin/payments/vat',
  paymentsCustomers: '/admin/payments/customers',
  paymentsInvoices: '/admin/payments/invoices',
  paymentsKsef: '/admin/payments/ksef',
  paymentsTraceability: '/admin/payments/traceability',

  support: '/admin/support',

  systemHealth: '/admin/system/health',
  systemLogs: '/admin/system/logs',

  audit: '/admin/audit',

  settings: '/admin/settings',
} as const;

export type AdminRouteKey = keyof typeof ADMIN_ROUTES;
export type AdminRoute = (typeof ADMIN_ROUTES)[AdminRouteKey];

export const ALL_ADMIN_ROUTES: readonly AdminRoute[] = Object.freeze(
  Object.values(ADMIN_ROUTES) as AdminRoute[],
);

/** The admin API base path, so no screen ever writes it inline. */
export const ADMIN_API = {
  me: '/admin/me',
  systemHealth: '/admin/system/health',
  newsProviders: '/admin/news/providers',

  // ADMIN-03. Still all GETs, and still nothing that changes state, so
  // the read-only meaning of this object is unchanged -- which is why
  // these belong here rather than in a third constant.
  analyticsUsage: '/admin/analytics/usage',
  analyticsCoverageGeography: '/admin/analytics/coverage-geography',
  alphaReview: '/admin/alpha-review',
  users: '/admin/users',
} as const;

/**
 * S3 — the admin support API, declared SEPARATELY from ADMIN_API.
 *
 * ADMIN_API is the read-only admin surface, and
 * `adminRouteManifest.spec.ts` asserts its key set exactly. This
 * milestone's four paths include the platform's first admin WRITES, and
 * folding them into that object would have blurred a distinction the
 * existing contract makes deliberately: everything in ADMIN_API is a
 * GET, and nothing in it changes state. Two constants keep that true,
 * and keep the read surface's assertion meaningful rather than merely
 * longer.
 *
 * The two ticket-scoped paths are FUNCTIONS, not strings, because they
 * carry a reference. Building them here rather than in a screen is what
 * keeps `adminRouteManifest.spec.ts`'s "no /admin path is hardcoded
 * outside adminRoutes.ts" rule true for the support surface too.
 *
 * A reference reaching these functions has already been validated
 * server-side on every request; it is encoded anyway, because a path
 * built by string concatenation should never depend on its input being
 * well-formed.
 */
export const ADMIN_SUPPORT_API = {
  /** GET — the queue. */
  tickets: '/admin/support/tickets',
  /** GET — one ticket, internal notes included. */
  ticket: (reference: string): string => `/admin/support/tickets/${encodeURIComponent(reference)}`,
  /** POST — a user-visible reply or an internal note. */
  messages: (reference: string): string =>
    `/admin/support/tickets/${encodeURIComponent(reference)}/messages`,
  /** POST — resolve, or reopen. */
  status: (reference: string): string =>
    `/admin/support/tickets/${encodeURIComponent(reference)}/status`,
} as const;

/**
 * The nine design screen codes. The topbar renders the code beside the
 * title so a reviewer and the code name the same screen.
 */
export const ADMIN_SCREEN_CODES = [
  'ADMIN-01',
  'ADMIN-02',
  'ADMIN-03',
  'ADMIN-04',
  'ADMIN-05',
  'ADMIN-06',
  'ADMIN-07',
  'ADMIN-08',
  'SETTINGS',
] as const;

export type AdminScreenCode = (typeof ADMIN_SCREEN_CODES)[number];
