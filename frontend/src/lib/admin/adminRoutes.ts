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
