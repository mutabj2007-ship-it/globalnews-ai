import { ADMIN_ROUTES, type AdminRoute, type AdminScreenCode } from './adminRoutes';
import type { AdminCapability } from './adminCapabilities';

/**
 * F1.b — the sidebar manifest, in the approved design's own entry shape:
 *   { num, id, label, route, screen, capability, state }
 *
 * Pure: no React, no fetch, no DOM. `adminNavManifest.spec.ts` executes
 * it rather than pattern-matching it.
 *
 * TWO FIDELITY NOTES, both deliberate and both CTO-approved.
 *
 * 1. THE ARTIFACT'S SIDEBAR HAS FIFTEEN ITEMS; THIS HAS FOURTEEN.
 *    The artifact's item 01 is "Information architecture", which its own
 *    route map assigns to `/admin (shell)` — it is the shell, not a
 *    destination. Per CTO decision, ADMIN-01 remains the shell/
 *    documentation contract and no 21st route was invented for it, so it
 *    is not a nav entry. Every other item keeps the artifact's own
 *    number (02..15) so a reviewer reading the design and a developer
 *    reading this file are looking at the same rows.
 *
 *    Note also that the artifact's fifteen SIDEBAR items and its fifteen
 *    IA-table CAPABILITIES are two different fifteens: the sidebar has
 *    "Information architecture" and folds Logs into "System health &
 *    logs", while the IA table lists Logs separately and has no IA row.
 *    ADMIN_CAPABILITY_MAP below is the IA table, verbatim; NAV_MANIFEST
 *    is the sidebar. Both are asserted.
 *
 * 2. NO ITEM CARRIES state 'not_implemented' TODAY.
 *    The design reserves that state for a planned section, which renders
 *    a chip and is NOT navigable. Several F1.b screens have no backend
 *    yet — but the CTO's brief is the complete, navigable IA, and making
 *    Payments or Audit unreachable would hide the architecture rather
 *    than state it honestly. So the honesty lives INSIDE each screen,
 *    where the design's own rule puts it ("a planned surface renders NOT
 *    IMPLEMENTED and holds its layout slot"), and every nav item is
 *    reachable. The mechanism is implemented and tested so a genuinely
 *    unbuilt future section can use it.
 *
 * CAPABILITY GATING. `capability` is what a role must hold for the item
 * to RENDER AT ALL. An absent capability omits the item entirely — never
 * disabled, never teased. Per CTO decision, read access to Users,
 * Subscriptions and Settings uses `analytics.view`; future mutations on
 * those screens will require their own capabilities.
 */
export type AdminNavState = 'available' | 'not_implemented';

export interface AdminNavItem {
  /** The artifact's own sidebar number, and the glyph shown in the icon rail. */
  num: string;
  id: string;
  /** Dictionary key under `admin.nav.items` — never English prose. */
  labelKey: string;
  /** The artifact's English wording: provenance record and last-resort fallback. */
  label: string;
  route: AdminRoute;
  screen: AdminScreenCode;
  capability: AdminCapability;
  state: AdminNavState;
}

export interface AdminNavGroup {
  /** Dictionary key under `admin.nav.groups`. */
  labelKey: string;
  /** The artifact's English group heading. */
  label: string;
  items: readonly AdminNavItem[];
}

const item = (
  num: string,
  id: string,
  label: string,
  route: AdminRoute,
  screen: AdminScreenCode,
  capability: AdminCapability,
): AdminNavItem => ({
  num,
  id,
  labelKey: id,
  label,
  route,
  screen,
  capability,
  state: 'available',
});

export const NAV_MANIFEST: readonly AdminNavGroup[] = Object.freeze([
  {
    labelKey: 'platform',
    label: 'PLATFORM',
    items: Object.freeze([
      item('02', 'overview', 'Overview', ADMIN_ROUTES.overview, 'ADMIN-02', 'analytics.view'),
    ]),
  },
  {
    labelKey: 'content',
    label: 'CONTENT',
    items: Object.freeze([
      item('03', 'news', 'News management', ADMIN_ROUTES.news, 'ADMIN-06', 'news.manage'),
      item('04', 'sources', 'Global sources', ADMIN_ROUTES.newsSources, 'ADMIN-06', 'news.manage'),
    ]),
  },
  {
    labelKey: 'intelligence',
    label: 'INTELLIGENCE',
    items: Object.freeze([
      item('05', 'ai', 'AI intelligence', ADMIN_ROUTES.ai, 'ADMIN-06', 'analytics.view'),
      item(
        '06',
        'aiProviders',
        'AI providers',
        ADMIN_ROUTES.aiProviders,
        'ADMIN-06',
        'provider.configure',
      ),
    ]),
  },
  {
    labelKey: 'audience',
    label: 'AUDIENCE',
    items: Object.freeze([
      item('07', 'users', 'Users & access', ADMIN_ROUTES.users, 'ADMIN-03', 'analytics.view'),
      item(
        '08',
        'subscriptions',
        'Users & subscriptions',
        ADMIN_ROUTES.usersSubscriptions,
        'ADMIN-03',
        'analytics.view',
      ),
      item('09', 'analytics', 'Analytics', ADMIN_ROUTES.analytics, 'ADMIN-03', 'analytics.view'),
      item(
        '10',
        'geography',
        'Geography / reach',
        ADMIN_ROUTES.analyticsGeography,
        'ADMIN-03',
        'analytics.view',
      ),
    ]),
  },
  {
    labelKey: 'finance',
    label: 'FINANCE',
    items: Object.freeze([
      item(
        '11',
        'payments',
        'Payments & taxes',
        ADMIN_ROUTES.payments,
        'ADMIN-04',
        'analytics.view',
      ),
    ]),
  },
  {
    labelKey: 'support',
    label: 'SUPPORT',
    items: Object.freeze([
      item(
        '12',
        'support',
        'Feedback & support',
        ADMIN_ROUTES.support,
        'ADMIN-05',
        'support.handle',
      ),
    ]),
  },
  {
    labelKey: 'operations',
    label: 'OPERATIONS',
    items: Object.freeze([
      item(
        '13',
        'systemHealth',
        'System health & logs',
        ADMIN_ROUTES.systemHealth,
        'ADMIN-07',
        'analytics.view',
      ),
      item('14', 'audit', 'Audit logs', ADMIN_ROUTES.audit, 'ADMIN-08', 'analytics.view'),
      item('15', 'settings', 'Settings', ADMIN_ROUTES.settings, 'SETTINGS', 'analytics.view'),
    ]),
  },
]);

export const ALL_NAV_ITEMS: readonly AdminNavItem[] = Object.freeze(
  NAV_MANIFEST.flatMap((group) => [...group.items]),
);

/**
 * The artifact's IA table, verbatim — fifteen administrative
 * capabilities, each with one canonical screen and one canonical route.
 * Kept as the design record and asserted by the route spec, so a route
 * rename cannot silently drift from the approved map.
 */
export const ADMIN_CAPABILITY_MAP: ReadonlyArray<{
  num: string;
  capability: string;
  screen: AdminScreenCode;
  route: AdminRoute;
}> = Object.freeze([
  { num: '01', capability: 'Overview', screen: 'ADMIN-02', route: ADMIN_ROUTES.overview },
  { num: '02', capability: 'News management', screen: 'ADMIN-06', route: ADMIN_ROUTES.news },
  { num: '03', capability: 'Global sources', screen: 'ADMIN-06', route: ADMIN_ROUTES.newsSources },
  { num: '04', capability: 'AI intelligence', screen: 'ADMIN-06', route: ADMIN_ROUTES.ai },
  {
    num: '05',
    capability: 'Geography / global reach',
    screen: 'ADMIN-03',
    route: ADMIN_ROUTES.analyticsGeography,
  },
  { num: '06', capability: 'Users & access', screen: 'ADMIN-03', route: ADMIN_ROUTES.users },
  { num: '07', capability: 'Analytics', screen: 'ADMIN-03', route: ADMIN_ROUTES.analytics },
  {
    num: '08',
    capability: 'Users & subscriptions',
    screen: 'ADMIN-03',
    route: ADMIN_ROUTES.usersSubscriptions,
  },
  { num: '09', capability: 'Payments & taxes', screen: 'ADMIN-04', route: ADMIN_ROUTES.payments },
  { num: '10', capability: 'Feedback & support', screen: 'ADMIN-05', route: ADMIN_ROUTES.support },
  { num: '11', capability: 'System health', screen: 'ADMIN-07', route: ADMIN_ROUTES.systemHealth },
  { num: '12', capability: 'AI providers', screen: 'ADMIN-06', route: ADMIN_ROUTES.aiProviders },
  { num: '13', capability: 'Logs', screen: 'ADMIN-07', route: ADMIN_ROUTES.systemLogs },
  { num: '14', capability: 'Audit logs', screen: 'ADMIN-08', route: ADMIN_ROUTES.audit },
  { num: '15', capability: 'Settings', screen: 'SETTINGS', route: ADMIN_ROUTES.settings },
]);

/**
 * Filters the manifest by the capability list the SERVER returned.
 *
 * Fail-closed: an undefined or empty grant produces an empty nav, never
 * a full one. An item whose capability is absent is dropped entirely —
 * it is never returned in a disabled form, because this function has no
 * way to express one.
 */
export function visibleNavGroups(granted: readonly string[] | undefined): AdminNavGroup[] {
  if (!granted || granted.length === 0) return [];

  return NAV_MANIFEST.map((group) => ({
    ...group,
    items: group.items.filter((navItem) => granted.includes(navItem.capability)),
  })).filter((group) => group.items.length > 0);
}

/** Route -> nav item, for the topbar's screen code and title. */
export function navItemForPath(pathname: string): AdminNavItem | undefined {
  const matches = ALL_NAV_ITEMS.filter(
    (navItem) => pathname === navItem.route || pathname.startsWith(`${navItem.route}/`),
  );

  // Longest route wins, so /admin/news/sources resolves to Global
  // sources rather than News management, and /admin never swallows a
  // deeper path.
  return matches.sort((a, b) => b.route.length - a.route.length)[0];
}
