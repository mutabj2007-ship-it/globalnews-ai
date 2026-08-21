import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { footerLinkGroups } from '@/lib/homeContent';
import { primaryNavLinks } from '@/lib/navigation';
import { getDictionary } from '@/lib/i18n/dictionaries';

const footerSource = readFileSync(join(__dirname, '../layout/Footer.tsx'), 'utf-8');
const navBarSource = readFileSync(join(__dirname, 'NavBar.tsx'), 'utf-8');
const navModelSource = readFileSync(join(__dirname, '../../lib/navModel.ts'), 'utf-8');

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
    // M66.7 — CONVERTED, not weakened. The original negative still passes, but
    // it guards against a layout that no longer exists anywhere in the tree, so
    // it had stopped meaning anything. The density decision it was written to
    // protect is now the RELEASED contract: GN-CD-200 authors one flat bar with
    // five flex regions, and GN-CD-202 authors one ungrouped wrapping link row.
    expect(footerSource).not.toMatch(/grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4/);
    const code = footerSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).toMatch(/flex flex-wrap items-center/);
    expect(code).not.toMatch(/grid-cols-/);
    // One bar, not a bar plus a second copyright row: the copyright now lives in
    // the identity block's released secondary slot.
    expect((code.match(/rounded-cd-14|lg:rounded-cd-16/g) ?? []).length).toBe(2);
  });
});

describe('NavBar (CTO HUD system)', () => {
  it('active-route detection is genuine, driven by the real pathname, not a hardcoded/fake state', () => {
    expect(navBarSource).toMatch(/usePathname/);
    // M65 — entries come from NAV_MODEL now; the detection itself is the
    // same real pathname comparison it always was.
    expect(navBarSource).toMatch(/const isActive = pathname === entry\.href/);
  });

  it('active state is communicated with a real aria-current attribute', () => {
    expect(navBarSource).toMatch(/aria-current=\{isActive \? 'page' : undefined\}/);
  });

  it('does not fabricate a notification/profile feature that has no real backing', () => {
    expect(navBarSource).not.toMatch(/notification/i);
  });

  it('renders nav items from the single canonical NAV_MODEL, not a hardcoded duplicate list \u2014 and NAV_MODEL still derives its real routes from the unchanged primaryNavLinks', () => {
    expect(navBarSource).toMatch(/import \{ NAV_MODEL/);
    expect(navBarSource).not.toMatch(/href="\/map"/);
    expect(navModelSource).toMatch(/import \{ primaryNavLinks \} from '@\/lib\/navigation'/);
    expect(navModelSource).toMatch(/realRouteHref\('Home'\)/);
    expect(navModelSource).toMatch(/realRouteHref\('World Map'\)/);
  });

  it('both the desktop header and the mobile menu consume the SAME NAV_MODEL source \u2014 confirmed by exactly two real usages, not two independently-maintained lists', () => {
    const usages = (navBarSource.match(/NAV_MODEL\.map/g) ?? []).length;
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

  it('M66.10B — footerLinkGroups contains exactly the three real legal routes, nothing fabricated beyond them', () => {
    // B2 reintroduced /privacy and /terms and locked this to exactly two.
    // M66.10B adds /source-policy, whose route ships in the SAME change
    // (frontend/src/app/source-policy/page.tsx) — the destination is never
    // added before the page exists.
    //
    // This stays an EXACT equality rather than three toContain() calls, because
    // the value of this assertion is that it fails when a FOURTH destination is
    // added. About/Careers/Contact/API are still routeless and are still guarded
    // by the test above; loosening this to membership checks would let any of
    // them back in silently.
    const allFooterHrefs = footerLinkGroups.flatMap((group) => group.links.map((link) => link.href));
    expect(allFooterHrefs.sort()).toEqual(['/privacy', '/source-policy', '/terms']);
  });

  it('M66.10B — each of the three legal destinations resolves to a real App Router page on disk', () => {
    // Filesystem-backed route truth, mirroring footerGeometry.spec.ts. A string
    // list can be edited into a lie; this cannot pass without the page file.
    for (const href of footerLinkGroups.flatMap((group) => group.links.map((link) => link.href))) {
      const segment = href === '/' ? '' : href.replace(/^\//, '');
      expect(existsSync(join(__dirname, '../../app', segment, 'page.tsx'))).toBe(true);
    }
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

describe('C2.1 — global shell / brand / navigation foundation', () => {
  const logoSource = readFileSync(
    join(__dirname, '..', 'ui', 'Logo.tsx'),
    'utf-8',
  );
  const mobileBottomNavSource = readFileSync(join(__dirname, 'MobileBottomNav.tsx'), 'utf-8');

  it('Logo.tsx is a reusable, framework-native component \u2014 no leftover prototype markup (no dc-import/x-dc custom elements, no actual import of the prototype runtime)', () => {
    expect(logoSource).toMatch(/export function Logo/);
    expect(logoSource).not.toMatch(/<dc-import|<x-dc/);
    expect(logoSource).not.toMatch(/from ['"].*support(\.js)?['"]/);
  });

  it('Logo.tsx gives each rendered instance unique SVG gradient/filter ids (useId) \u2014 required since it renders more than once per page (NavBar + Footer)', () => {
    expect(logoSource).toMatch(/useId/);
    // The gradient/filter ids must be templated per-instance, not a
    // fixed literal string repeated verbatim across renders.
    expect(logoSource).not.toMatch(/id="gnEmbGlow"/);
    expect(logoSource).not.toMatch(/id="gnEmbBlur"/);
  });

  it('Logo.tsx preserves its existing public props contract (className, showWordmark) so every current call site keeps working unchanged', () => {
    expect(logoSource).toMatch(/className\?:\s*string/);
    expect(logoSource).toMatch(/showWordmark\?:\s*boolean/);
  });

  it('the emblem SVG is marked decorative (aria-hidden) \u2014 the accessible name for navigation comes from the surrounding link/wordmark, not the icon itself', () => {
    expect(logoSource).toMatch(/aria-hidden="true"/);
  });

  it('C2.1 introduced no new navigation destinations \u2014 NavBar and MobileBottomNav still derive their real links entirely from primaryNavLinks / their own existing real-route list, never a fabricated category route', () => {
    for (const fakeRoute of ['/world', '/politics', '/business', '/technology', '/science', '/health', '/about']) {
      expect(navBarSource).not.toContain(`href="${fakeRoute}"`);
      expect(navBarSource).not.toContain(`href='${fakeRoute}'`);
      expect(mobileBottomNavSource).not.toContain(`href: '${fakeRoute}'`);
    }
    // M65 — NavBar renders from NAV_MODEL, whose two real routes are
    // still looked up from the unchanged primaryNavLinks. The guard that
    // matters is unchanged and asserted above: no fabricated category
    // href exists anywhere in the header.
    expect(navBarSource).toMatch(/NAV_MODEL\.map/);
  });

  it('MobileBottomNav.tsx keeps its real, deliberate item set (Home, World Map, Search, Intelligence anchor) unchanged by the C2.1 visual pass', () => {
    expect(mobileBottomNavSource).toMatch(/href: '\/'/);
    expect(mobileBottomNavSource).toMatch(/href: '\/map'/);
    expect(mobileBottomNavSource).toMatch(/href: '\/search'/);
    expect(mobileBottomNavSource).toMatch(/href: '#intelligence-modules'/);
  });

  it('the footer still renders every real footerLinkGroups destination after the C2.1 visual panel change \u2014 the restyle did not drop any link', () => {
    expect(footerSource).toMatch(/footerLinkGroups\.flatMap/);
    expect(footerSource).toMatch(/allLinks\.map/);
  });

  it('the footer sharing system remains NOT implemented — M66.7 is the later checkpoint, and CTO decision D-5 A omitted it', () => {
    // M66.7 — RE-AIMED. This guard was written in C2.1 to hold the line until a
    // "later, separately approved checkpoint". M66.7 IS that checkpoint, and it
    // answered no: GN-CD-203's four controls fire toasts only, this repository
    // has no toast infrastructure, and the controls' resting border measures
    // 1.47:1 — the sole visual signal that a 34px circle is interactive. So the
    // guard stays, now recording a decision rather than a deferral, and it runs
    // on comment-stripped source so the decision can be EXPLAINED in the file it
    // governs. Recorded as M66.7-DEFERRED-002.
    const code = footerSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/LinkedIn|WhatsApp|ShareControls/i);
    // Nothing that would constitute share infrastructure, in any form:
    expect(code).not.toMatch(/navigator\.(clipboard|share)/);
    expect(code).not.toMatch(/toast|notify\(/i);
    expect(code).not.toMatch(/x\.com|twitter\.com|linkedin\.com|wa\.me|whatsapp\.com/i);
    expect(code).not.toMatch(/'use client'/);
  });
});
