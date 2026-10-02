/**
 * ════════════════════════════════════════════════════════════════════════════
 * PRODUCTION PLATFORM ROUTE SEPARATION R2I — THE STANDALONE ROUTE GATE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Pure route policy used by `src/middleware.ts`. The deployment MODE is not decided here: it
 * is `standaloneAskRoot()` (lib/ask/standaloneRoot.ts), the same predicate the root page and
 * layout use, so `/` and the route gate can never disagree about which product is served.
 *
 *   GNA_PUBLIC_ROOT=platform   → every route passes (Alpha: the full platform)
 *   anything else / unset      → STANDALONE: an ALLOWLIST, fail closed (Production)
 *
 * STANDALONE IS AN ALLOWLIST, NOT A BLOCKLIST. A platform page added later is unavailable in
 * Standalone by default; exposing a new page publicly means adding it here, in review.
 *
 * Infrastructure is never gated: Next internals, static files and every frontend→backend proxy
 * family (next.config.mjs rewrites) pass through — the middleware matcher excludes most of them
 * before this function runs, and `isInfrastructurePath` is the defence in depth.
 */
import { ADMIN_ROUTES } from '@/lib/admin/adminRoutes';

/** The Admin root, from the ONE Admin route manifest (never a second hardcoded copy). */
const ADMIN_ROOT: string = ADMIN_ROUTES.overview;

/** Exact application pages the Standalone product serves. */
const STANDALONE_PAGES: ReadonlySet<string> = new Set([
  '/',
  '/ask',
  '/saved',
  '/history',
  '/account/settings',
  '/support',
  '/privacy',
  /* TRUST R1 §12 — the Cookies & similar technologies notice, public before sign-in. */
  '/cookies',
  '/terms',
  '/source-policy',
  '/third-party-notices',
  ADMIN_ROOT,
]);

/**
 * Prefixes whose WHOLE subtree is served in Standalone. `/admin/*` stays reachable for
 * operational inspection; its own auth/admin guards still decide access (unchanged here).
 */
const STANDALONE_SUBTREES: readonly string[] = ['/ask/', `${ADMIN_ROOT}/`];

/**
 * Frontend→backend proxy families (next.config.mjs rewrites) and Next/static internals. These
 * carry data and assets, not platform pages, and Standalone features rely on the proxies.
 */
const INFRASTRUCTURE_PREFIXES: readonly string[] = [
  '/api/',
  '/_next/',
  '/news/',
  '/geo/',
  '/economy/',
  '/market-data/',
  '/conflict-data/',
];

/** Root-level files served by the app or from /public (crawler, PWA and icon resources). */
const INFRASTRUCTURE_FILES: ReadonlySet<string> = new Set([
  '/api',
  '/robots.txt',
  '/sitemap.xml',
  '/icon.svg',
  '/apple-icon.png',
  '/favicon.ico',
  '/manifest.webmanifest',
  '/sw.js',
  '/sw-tombstone.js',
  '/offline.html',
]);

/** `/saved/` → `/saved`; `/` stays `/`. Decisions are made on the path only — never the query. */
function normalisePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.replace(/\/+$/, '') || '/';
  return pathname;
}

export function isInfrastructurePath(pathname: string): boolean {
  if (INFRASTRUCTURE_FILES.has(pathname)) return true;
  if (INFRASTRUCTURE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;
  /* A file request (`/icons/a.png`, `/og/x.jpg`, `/reference/y.webp`): the last segment carries
     an extension. App Router pages here never do, so a page cannot hide behind this. */
  const last = pathname.slice(pathname.lastIndexOf('/') + 1);
  return /^[^.]+\.[A-Za-z0-9]{1,12}$/.test(last);
}

export function isStandalonePath(pathname: string): boolean {
  const path = normalisePath(pathname);
  if (STANDALONE_PAGES.has(path)) return true;
  return STANDALONE_SUBTREES.some((prefix) => path.startsWith(prefix));
}

export type RouteGateDecision = 'PASS' | 'REDIRECT_ROOT';

/**
 * The whole policy. `standalone` is `standaloneAskRoot()` — the server deployment mode — and
 * `pathname` is the request path (no host, no query, no cookies, no client state).
 */
export function routeGateDecision(standalone: boolean, pathname: string): RouteGateDecision {
  if (!standalone) return 'PASS';
  if (isInfrastructurePath(pathname)) return 'PASS';
  return isStandalonePath(pathname) ? 'PASS' : 'REDIRECT_ROOT';
}

/** For the report and the specs: the exact Standalone allowlist. */
export const STANDALONE_ALLOWLIST = {
  pages: [...STANDALONE_PAGES],
  subtrees: [...STANDALONE_SUBTREES],
  infrastructurePrefixes: [...INFRASTRUCTURE_PREFIXES],
  infrastructureFiles: [...INFRASTRUCTURE_FILES],
} as const;
