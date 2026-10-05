/**
 * ════════════════════════════════════════════════════════════════════════════
 * COMPACT VISUAL PRODUCT R1 — CAPABILITY-DRIVEN NAVIGATION DECLARATION (H0/28, ruling 6)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Design R1 TARGET IA: Home · My Watches · Briefings · Explore (+ Updates, More).
 * CURRENT REAL ROUTES are what is declared here. A destination with no real route or capability
 * renders NOTHING — no disabled item, no "coming soon", no stub route:
 *
 *   My Watches   TARGET IA — no /watches route. The real capability (the Alerts centre) is a
 *                panel, reached from the Updates bell when alerts.inApp is on.
 *   Updates      the Alerts bell (a panel, gated by alerts.inApp), never a route.
 *   Briefings    the real /saved/briefing route, labelled "Saved Ask briefings" (H0 ruling 1).
 *   Explore      a SECTION (#explore-intelligence, the registry-backed modules), not /explore.
 *   More         TARGET IA — no sheet exists.
 *
 * World Map and Ask are real destinations the product already has and stay reachable.
 * `/visual` is the preview of the future Home, so its Home item points at itself; when it is
 * promoted to `/`, only `VISUAL_HOME_HREF` changes.
 */
export const VISUAL_HOME_HREF = '/visual';

export type VisualNavKey = 'home' | 'worldMap' | 'ask' | 'savedAskBriefings' | 'explore';

export interface VisualNavItem {
  readonly key: VisualNavKey;
  readonly href: string;
  /** The capability required, or null when the destination is a real route with no gate. */
  readonly capability: null;
}

export const VISUAL_TOP_NAV: readonly VisualNavItem[] = [
  { key: 'home', href: VISUAL_HOME_HREF, capability: null },
  { key: 'worldMap', href: '/map', capability: null },
  { key: 'ask', href: '/ask', capability: null },
  { key: 'savedAskBriefings', href: '/saved/briefing', capability: null },
  { key: 'explore', href: '#explore-intelligence', capability: null },
];

/** The phone bar keeps the four real Home R1 destinations; only Home points at the preview. */
export const VISUAL_PHONE_NAV: readonly { readonly key: 'home' | 'worldMap' | 'ask' | 'intelligence'; readonly href: string }[] = [
  { key: 'home', href: VISUAL_HOME_HREF },
  { key: 'worldMap', href: '/map' },
  { key: 'ask', href: '/ask' },
  { key: 'intelligence', href: '#explore-intelligence' },
];

/** Design TARGET IA items that are deliberately NOT drawn, with the reason — asserted by spec. */
export const VISUAL_NAV_NOT_ACTIVE = {
  myWatches: 'TARGET IA — BACKEND/ROUTE NOT YET ACTIVE (no /watches route; Alerts centre is a panel)',
  more: 'TARGET IA — no sheet component exists',
} as const;
