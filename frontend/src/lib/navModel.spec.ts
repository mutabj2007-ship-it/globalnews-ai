import { NAV_MODEL } from './navModel';
import { primaryNavLinks } from './navigation';
import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * M65 — the approved Claude Design's nine-item header sequence, restored
 * with CTO-approved restrictions: real destinations only, no fabricated
 * routes, no fake About, and every visible label localized.
 *
 * These guards exist specifically because this milestone reinstates
 * navigation entries M53 deleted. M53's actual rule — every rendered
 * destination must resolve to a real page — is asserted here, not
 * weakened.
 */
describe('NAV_MODEL — the approved nine-item header sequence', () => {
  it('is exactly the nine approved entries, in the design’s own order', () => {
    expect(NAV_MODEL.map((entry) => entry.label)).toEqual([
      'Home',
      'World Map',
      'World',
      'Politics',
      'Business',
      'Technology',
      'Science',
      'Health',
      'About',
    ]);
  });

  it('the two route entries resolve through the UNCHANGED primaryNavLinks — still the single source of truth for real routes', () => {
    expect(primaryNavLinks).toHaveLength(2);
    const routes = NAV_MODEL.filter((entry) => entry.kind === 'route');
    expect(routes).toHaveLength(2);
    for (const entry of routes) {
      expect(primaryNavLinks.some((link) => link.href === entry.href)).toBe(true);
    }
  });

  it('NO entry points at one of the dead category routes M53 removed — those 404 and are never linked', () => {
    const deadRoutes = ['/world', '/politics', '/business', '/technology', '/science', '/health', '/about'];
    for (const entry of NAV_MODEL) {
      expect(deadRoutes).not.toContain(entry.href);
    }
  });

  it('the six editorial entries route to the REAL /search route, carrying the prototype’s own exact query terms', () => {
    const byLabel = Object.fromEntries(NAV_MODEL.map((entry) => [entry.label, entry.href]));
    expect(byLabel.World).toBe('/search?q=world');
    expect(byLabel.Politics).toBe('/search?q=politics');
    // Ported as-is: the approved design's own term for Business is
    // "economy". Not "corrected" to 'business'.
    expect(byLabel.Business).toBe('/search?q=economy');
    expect(byLabel.Technology).toBe('/search?q=technology');
    expect(byLabel.Science).toBe('/search?q=science+research');
    expect(byLabel.Health).toBe('/search?q=health');
  });

  it('every search entry carries a non-empty query — a bare /search from the nav would be a dead-end, which is the defect this milestone removes', () => {
    for (const entry of NAV_MODEL.filter((e) => e.kind === 'search')) {
      expect(entry.href).toMatch(/^\/search\?q=.+/);
    }
  });

  it('About carries no href of any kind — a genuinely unavailable control, never a fabricated destination', () => {
    const about = NAV_MODEL.find((entry) => entry.label === 'About');
    expect(about?.kind).toBe('unavailable');
    expect(about?.href).toBeUndefined();
  });

  it('every visible label is localizable in BOTH production languages — no hardcoded English in the header', () => {
    const en = getDictionary('en').navBar.navItemLabels;
    const pl = getDictionary('pl').navBar.navItemLabels;
    for (const entry of NAV_MODEL) {
      expect(en[entry.labelKey]).toBeDefined();
      expect(en[entry.labelKey].length).toBeGreaterThan(0);
      expect(pl[entry.labelKey]).toBeDefined();
      expect(pl[entry.labelKey].length).toBeGreaterThan(0);
    }
  });

  it('the unavailable state itself is localized, so a Polish user is told About is unavailable in Polish', () => {
    const en = getDictionary('en').navBar.editorialUnavailableLabel;
    const pl = getDictionary('pl').navBar.editorialUnavailableLabel;
    expect(en.length).toBeGreaterThan(0);
    expect(pl.length).toBeGreaterThan(0);
    expect(pl).not.toBe(en);
  });

  it('labelKeys are unique — two entries can never collide onto one dictionary label', () => {
    const keys = NAV_MODEL.map((entry) => entry.labelKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
