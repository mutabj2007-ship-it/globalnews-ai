import { readFileSync } from 'fs';
import { join } from 'path';
import { footerLinkGroups } from '@/lib/homeContent';
import { primaryNavLinks } from '@/lib/navigation';
import { getDictionary } from '@/lib/i18n/dictionaries';

const footerSource = readFileSync(join(__dirname, '../layout/Footer.tsx'), 'utf-8');
const navBarSource = readFileSync(join(__dirname, 'NavBar.tsx'), 'utf-8');

/**
 * CTO directive (test discipline) — rewritten to protect real
 * behavioral contracts (real links only, comingSoon items stay
 * visually non-deceptive, active-route detection is genuine) rather
 * than asserting decorative class strings.
 */
describe('Footer (CTO HUD system)', () => {
  it('derives links entirely from the real footerLinkGroups source \u2014 never a hardcoded/fabricated destination list, regardless of how many (including zero) real entries currently exist', () => {
    expect(footerSource).toMatch(/footerLinkGroups\.flatMap/);
    // Milestone #53 correction: the previous version of this test
    // asserted footerLinkGroups.length > 0, which directly
    // contradicted the M53 fix (footerLinkGroups intentionally
    // emptied to [] once every prior entry was found to be a dead
    // route). The actual behavioral contract this test protects is
    // that Footer.tsx has no hardcoded fallback list of its own —
    // whatever real data footerLinkGroups holds (zero entries today,
    // real entries again once routes exist) is what renders, nothing
    // invented in either direction. An empty array is therefore a
    // fully valid state, not a test failure.
    const allLinks = footerLinkGroups.flatMap((group) => group.links);
    expect(Array.isArray(allLinks)).toBe(true);
    expect(allLinks.every((link) => typeof link.href === 'string' && link.href.length > 0)).toBe(true);
  });

  it('comingSoon links remain visually distinguished, not disguised as available', () => {
    expect(footerSource).toMatch(/link\.comingSoon &&/);
    expect(footerSource).toMatch(/\{t\.comingSoon\}/);
  });

  it('link labels remain localized, not hardcoded English', () => {
    expect(footerSource).toMatch(/t\.linkLabels\[link\.href\] \?\? link\.label/);
  });

  it('is a single compact row, not a multi-column stack — a real layout-density decision, not cosmetics', () => {
    expect(footerSource).not.toMatch(/grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4/);
  });
});

describe('NavBar (CTO HUD system)', () => {
  it('active-route detection is genuine, driven by the real pathname, not a hardcoded/fake state', () => {
    expect(navBarSource).toMatch(/usePathname/);
    expect(navBarSource).toMatch(/const isActive = pathname === link\.href/);
  });

  it('active state is communicated with a real aria-current attribute', () => {
    expect(navBarSource).toMatch(/aria-current=\{isActive \? 'page' : undefined\}/);
  });

  it('does not fabricate a notification/profile feature that has no real backing', () => {
    expect(navBarSource).not.toMatch(/notification/i);
  });

  it('renders nav links from the real primaryNavLinks source, not a hardcoded duplicate list', () => {
    expect(navBarSource).toMatch(/primaryNavLinks\.map/);
  });

  it('both the desktop and mobile-menu sections consume the SAME primaryNavLinks source \u2014 confirmed by exactly two real usages, not two independently-maintained lists', () => {
    const usages = (navBarSource.match(/primaryNavLinks\.map/g) ?? []).length;
    expect(usages).toBe(2);
  });
});

/**
 * Milestone #53 — MVP release-gate remediation regression coverage.
 * primaryNavLinks previously had 9 entries; only 2 ('/', '/map')
 * corresponded to real Next.js routes. The other 7 ('/world',
 * '/politics', '/business', '/technology', '/science', '/health',
 * '/about') would 404 on click. footerLinkGroups had the identical
 * problem (About/Careers/Contact/Privacy Policy/Terms of
 * Service/API — none real). Fixed by removing the dead entries
 * entirely, per explicit instruction not to fabricate placeholder
 * pages.
 *
 * This suite hardcodes the actual real route set as the source of
 * truth for "existing" rather than re-deriving it from the
 * filesystem, since a filesystem walk from a .spec.ts file would
 * itself be a form of testing infrastructure against infrastructure —
 * the CTO's own route inspection (both mine and the CTO's
 * independent verification) is the authoritative source here.
 */
describe('Dead primary-navigation and footer-link remediation (Milestone #53)', () => {
  const REAL_MVP_ROUTES = ['/', '/map'];

  it('every primaryNavLinks entry resolves to a route confirmed to actually exist \u2014 no dead destination remains', () => {
    for (const link of primaryNavLinks) {
      expect(REAL_MVP_ROUTES).toContain(link.href);
    }
  });

  it('primaryNavLinks contains exactly Home and World Map \u2014 the two routes confirmed real, nothing more, nothing fabricated', () => {
    expect(primaryNavLinks).toHaveLength(2);
    expect(primaryNavLinks.map((link) => link.href).sort()).toEqual(['/', '/map']);
  });

  it('footerLinkGroups no longer contains any of the still-dead destinations (/about, /careers, /contact, /api)', () => {
    const allFooterHrefs = footerLinkGroups.flatMap((group) => group.links.map((link) => link.href));
    // B2 correction: /privacy and /terms are now real routes
    // (frontend/src/app/privacy/page.tsx, frontend/src/app/terms/page.tsx)
    // and are intentionally reintroduced below — they are removed
    // from this "still dead" list, not from the assertion's intent.
    // About/Careers/Contact/API remain excluded, matching the
    // approved B2 scope (do not restore those).
    const stillDeadHrefs = ['/about', '/careers', '/contact', '/api'];
    for (const deadHref of stillDeadHrefs) {
      expect(allFooterHrefs).not.toContain(deadHref);
    }
  });

  it('B2 — footerLinkGroups contains exactly the two real legal routes reintroduced this milestone, nothing fabricated beyond them', () => {
    const allFooterHrefs = footerLinkGroups.flatMap((group) => group.links.map((link) => link.href));
    expect(allFooterHrefs.sort()).toEqual(['/privacy', '/terms']);
  });

  it('Footer.tsx still renders links with no leftover group-title visual artifact (no group-title markup exists to orphan) — unchanged by the B2 data addition', () => {
    expect(footerSource).toMatch(/footerLinkGroups\.flatMap/);
    expect(footerSource).not.toMatch(/group\.title/);
  });

  it('English and Polish navigation dictionaries remain structurally aligned with the corrected primaryNavLinks \u2014 every real href still has a linkLabels entry in both languages, and no stale entry for a removed route remains required', () => {
    const enLinkLabels = getDictionary('en').navBar.linkLabels;
    const plLinkLabels = getDictionary('pl').navBar.linkLabels;

    for (const link of primaryNavLinks) {
      // A dictionary entry is optional (NavBar falls back to link.label
      // when absent — see NavBar.tsx's `t.linkLabels[link.href] ?? link.label`),
      // so this only asserts that IF a translation exists for a route
      // that still exists, it exists in both languages consistently —
      // never a lopsided EN-only or PL-only entry for a live route.
      const hasEn = link.href in enLinkLabels;
      const hasPl = link.href in plLinkLabels;
      expect(hasEn).toBe(hasPl);
    }
  });
});

describe('B2 — Public Legal Surfaces footer wiring', () => {
  it('every real footerLinkGroups href has a real, non-fallback label in both English and Polish footer.linkLabels', () => {
    const enLinkLabels = getDictionary('en').footer.linkLabels;
    const plLinkLabels = getDictionary('pl').footer.linkLabels;
    const allFooterHrefs = footerLinkGroups.flatMap((group) => group.links.map((link) => link.href));

    for (const href of allFooterHrefs) {
      expect(href in enLinkLabels).toBe(true);
      expect(href in plLinkLabels).toBe(true);
    }
  });

  it('the English and Polish labels for /privacy and /terms are genuinely different strings, not an untranslated English fallback', () => {
    const enLinkLabels = getDictionary('en').footer.linkLabels;
    const plLinkLabels = getDictionary('pl').footer.linkLabels;

    expect(plLinkLabels['/privacy']).not.toBe(enLinkLabels['/privacy']);
    expect(plLinkLabels['/terms']).not.toBe(enLinkLabels['/terms']);
  });

  it('previously-dead links (/about, /careers, /contact, /api) remain absent even after the B2 footer data change', () => {
    const allFooterHrefs = footerLinkGroups.flatMap((group) => group.links.map((link) => link.href));
    for (const stillDeadHref of ['/about', '/careers', '/contact', '/api']) {
      expect(allFooterHrefs).not.toContain(stillDeadHref);
    }
  });
});
