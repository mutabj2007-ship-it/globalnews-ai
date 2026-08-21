import { primaryNavLinks } from '@/lib/navigation';

/**
 * M65 — header navigation model, ported from the approved Claude Design
 * prototype's own inline script (GlobalNews AI.dc.html, ~line 1661):
 *
 *   const navItems = [
 *     { label:'Home', to:'home' }, { label:'World Map', to:'map' }, { label:'World', q:'world' },
 *     { label:'Politics', q:'politics' }, { label:'Business', q:'economy' }, { label:'Technology', q:'technology' },
 *     { label:'Science', q:'science research' }, { label:'Health', q:'health' }, { label:'About', to:'saved' }
 *   ];
 *   open: () => n.to ? this.go(n.to) : this.search(n.q)
 *
 * This is deliberately ONE explicit ordered array — not primaryNavLinks
 * concatenated with a separate editorial list — so the exact nine-item
 * Claude Design sequence is guaranteed by construction, not by two
 * arrays happening to sit in the right relative order.
 *
 * Each entry's `kind` determines its real destination:
 *
 *   - 'route': a genuine existing Next.js route, looked up from
 *     primaryNavLinks (navigation.ts) — still the single source of
 *     truth for real routes, completely unchanged by this file, so
 *     footerNavHud.spec.ts's route-integrity contract (exactly 2 real
 *     entries) stays meaningful. A label with no matching entry throws
 *     at module load rather than silently rendering a dead link.
 *
 *   - 'search': the prototype's own `this.search(n.q)` behaviour,
 *     translated into the real, working /search route — a production
 *     translation of real design behaviour, per explicit CTO approval,
 *     never a fabricated destination. Query terms are preserved EXACTLY
 *     as the prototype defines them (note: 'Business' truthfully
 *     carries the prototype's own 'economy' term, not 'business' — not
 *     "corrected", ported as-is).
 *
 *     M53 CONTEXT, STATED PLAINLY: navigation.ts records that /world,
 *     /politics, /business, /technology, /science, /health and /about
 *     were removed because those ROUTES do not exist and would 404.
 *     That remains true and is not reversed here — none of these
 *     entries points at those routes. They point at /search, which does
 *     exist, with a real query. The M53 rule ("every rendered
 *     destination resolves to a real page") is satisfied, not weakened.
 *
 *   - 'unavailable': About. The prototype's own to:'saved' has no
 *     honest production equivalent (a saved-articles screen is not an
 *     About destination), so per explicit CTO decision it renders
 *     visibly in its exact design position and order, but as a
 *     genuinely non-routing, accessibly-labelled unavailable control.
 *     Never a fabricated href.
 *
 * LOCALIZATION: `labelKey` — not the English `label` — is what the
 * renderer uses to look up navBar.navItemLabels in the dictionary, so
 * every one of the nine visible labels localizes in both English and
 * Polish. `label` remains only as the design-provenance record of the
 * prototype's own wording and as a last-resort fallback.
 */

export type NavModelEntryKind = 'route' | 'search' | 'unavailable';

export interface NavModelEntry {
  /** The prototype's own English wording — provenance record and last-resort fallback only. */
  label: string;
  /** Dictionary key into navBar.navItemLabels — this is what actually renders. */
  labelKey: string;
  kind: NavModelEntryKind;
  /** Present only for 'route' and 'search' kinds — the real, working destination. */
  href?: string;
}

function realRouteHref(label: string): string {
  const link = primaryNavLinks.find((entry) => entry.label === label);
  if (!link) {
    throw new Error(`NAV_MODEL: expected a real primaryNavLinks entry for "${label}" but found none.`);
  }
  return link.href;
}

export const NAV_MODEL: NavModelEntry[] = [
  { label: 'Home', labelKey: 'home', kind: 'route', href: realRouteHref('Home') },
  { label: 'World Map', labelKey: 'worldMap', kind: 'route', href: realRouteHref('World Map') },
  { label: 'World', labelKey: 'world', kind: 'search', href: '/search?q=world' },
  { label: 'Politics', labelKey: 'politics', kind: 'search', href: '/search?q=politics' },
  { label: 'Business', labelKey: 'business', kind: 'search', href: '/search?q=economy' },
  { label: 'Technology', labelKey: 'technology', kind: 'search', href: '/search?q=technology' },
  { label: 'Science', labelKey: 'science', kind: 'search', href: '/search?q=science+research' },
  { label: 'Health', labelKey: 'health', kind: 'search', href: '/search?q=health' },
  { label: 'About', labelKey: 'about', kind: 'unavailable' },
];
