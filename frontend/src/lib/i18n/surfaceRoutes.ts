import { ADMIN_ROUTES } from '@/lib/admin/adminRoutes';
import type { SurfaceId } from '@/lib/i18n/surfaceLocale';

/**
 * T2 · WHICH SURFACE A REQUEST PATH RENDERS — read only by the root layout
 * (`documentLocale.server.ts`), so route pages that resolve their own surface by name never load
 * the route table. Path prefixes; the longest match wins; `/` is decided by the deployment mode.
 */
export const SURFACE_ROUTES: Readonly<Record<SurfaceId, readonly string[]>> = {
  /* COMPACT VISUAL PRODUCT R1 — `/visual` is the future Home, rendered under the same rule as `/`. */
  home: ['/visual'],
  askStandalone: ['/ask'],
  askRecent: ['/ask/recent'],
  saved: ['/saved'],
  accountSettings: ['/account'],
  search: ['/search'],
  map: ['/map'],
  conflict: ['/conflict'],
  energy: ['/energy'],
  market: ['/market'],
  humanitarian: ['/humanitarian'],
  economy: ['/economy-visual-preview'],
  politics: ['/politics-visual-preview'],
  election: ['/election-visual-preview'],
  security: ['/security-visual-preview'],
  delivery: ['/delivery-visual-preview'],
  imihigo: ['/imihigo'],
  myIntelligence: ['/my-intelligence'],
  support: ['/support'],
  history: ['/history'],
  privacy: ['/privacy'],
  terms: ['/terms'],
  cookies: ['/cookies'],
  sourcePolicy: ['/source-policy'],
  thirdPartyNotices: ['/third-party-notices'],
  workspace: ['/workspace'],
  admin: [ADMIN_ROUTES.overview],
  failure: [],
  default: [],
};

/**
 * The surface a request path renders. `/` is the standalone Ask root unless the deployment is in
 * platform mode (the same `standaloneAskRoot` predicate `app/page.tsx` uses).
 */
export function surfaceForPathname(pathname: string | null | undefined, standalone: boolean): SurfaceId {
  /* No path header (a request the middleware did not see) is an UNKNOWN surface, never `/`. */
  if (pathname === null || pathname === undefined || pathname === '') return 'default';
  const path = pathname.split('?')[0] || '/';
  if (path === '/') return standalone ? 'askStandalone' : 'home';
  let best: SurfaceId = 'default';
  let bestLength = 0;
  for (const [id, routes] of Object.entries(SURFACE_ROUTES) as Array<[SurfaceId, readonly string[]]>) {
    for (const route of routes) {
      const matches = path === route || path.startsWith(`${route}/`);
      if (matches && route.length > bestLength) {
        best = id;
        bestLength = route.length;
      }
    }
  }
  return best;
}

