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
  /* ASK PUBLIC BETA OPERATIONS MINIMUM R1 — the twenty-first route, and the first added
     beyond the approved Claude Design route map. It is authorized by the CTO activation
     that names it ("Admin -> AI -> Ask Intelligence"), and it is numbered after the
     artifact's last entry rather than renumbering the artifact's own rows. */
  aiAskIntelligence: '/admin/ai/ask-intelligence',

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

  /* ADMIN OPERATIONS R1 — the incident surface. Numbered after the artifact's last
     entry, like Ask Intelligence before it, rather than renumbering the design's rows. */
  operations: '/admin/operations',
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

  /* R1 — a GET returning aggregates. Still nothing that changes state, so the read-only
     meaning of this object is unchanged. */
  askIntelligence: '/admin/ai/ask-intelligence',
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
/**
 * ADMIN OPERATIONS R1 — declared SEPARATELY from ADMIN_API, for the same reason
 * ADMIN_SUPPORT_API is: everything in ADMIN_API is a GET that changes nothing, and
 * `adminRouteManifest.spec.ts` asserts that key set exactly. This object contains the
 * platform's first admin write that changes RUNTIME BEHAVIOUR rather than a support
 * record, so folding it in would blur the distinction the read surface's assertion
 * exists to keep.
 *
 * The switch path is a FUNCTION because it carries a name, and building it here keeps
 * the "no /admin path is hardcoded outside adminRoutes.ts" rule true for this surface
 * too. The name is encoded: a path built by concatenation should never depend on its
 * input being well-formed, even when the server validates it again.
 */
export const ADMIN_OPERATIONS_API = {
  /** GET — environment identity, switch state and the change history. */
  state: '/admin/operations',
  /** POST — change one switch. Requires operations.control, CSRF and a reason. */
  setSwitch: (name: string): string => `/admin/operations/switches/${encodeURIComponent(name)}`,
} as const;

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
 * The design screen codes. The topbar renders the code beside the title so a
 * reviewer and the code name the same screen.
 *
 * ADMIN OPERATIONS R1 adds 'OPERATIONS' rather than 'ADMIN-09'. The numbered
 * codes are rows of the approved Claude Design artifact, and there is no ninth
 * row: inventing one would put a code in the topbar that no design document
 * defines. 'SETTINGS' set the precedent for a named code outside the sequence.
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
  'OPERATIONS',
] as const;

export type AdminScreenCode = (typeof ADMIN_SCREEN_CODES)[number];
