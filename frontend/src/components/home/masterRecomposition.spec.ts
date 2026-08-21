import { readFileSync } from 'fs';
import { join } from 'path';

const pageSource = readFileSync(join(__dirname, '../../app/page.tsx'), 'utf-8');
const navBarSource = readFileSync(join(__dirname, '../navigation/NavBar.tsx'), 'utf-8');
const bottomNavSource = readFileSync(join(__dirname, '../navigation/MobileBottomNav.tsx'), 'utf-8');

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('Final homepage recomposition (Master Frontend Recomposition; M60 Phase 2 — LatestNowRail removed as a duplicate presentation of feed.latestUpdates)', () => {
  it('renders sections in the approved order', () => {
    const order = [
      '<Hero',
      '<GlobalDevelopments',
      // M65.1 — one Intelligence Engine section for every breakpoint,
      // replacing the two retired per-breakpoint renderers. Position in
      // the order is unchanged.
      // M66.8c — HomepageSituationMap sat between GlobalDevelopments and the
      // Engine and is retired from this render path. Global Developments now
      // transitions directly into the Intelligence Engine, which is the
      // released Claude Design adjacency. The component file is retained.
      '<IntelligenceEngineSection',
      '<HowItWorks',
      '<TrustSection',
    ];
    let lastIndex = -1;
    for (const marker of order) {
      const index = pageSource.indexOf(marker);
      expect(index).toBeGreaterThan(lastIndex);
      lastIndex = index;
    }
  });

  it('makes exactly one getHomeFeed call — the single-request architecture is preserved', () => {
    const matches = stripComments(pageSource).match(/getHomeFeed\(/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('page.tsx contains no direct fetch() call', () => {
    expect(pageSource).not.toMatch(/\bfetch\(/);
  });

  it('the retired NewsroomSection/CategoryCards/WorldMapGateway are no longer wired into the homepage', () => {
    expect(pageSource).not.toMatch(/<NewsroomSection/);
    expect(pageSource).not.toMatch(/<CategoryCards/);
    expect(pageSource).not.toMatch(/<WorldMapGateway/);
    expect(pageSource).not.toMatch(/<LatestUpdatesFeed/);
  });

  it('renders MobileBottomNav, fixed and lg:hidden', () => {
    expect(pageSource).toMatch(/<MobileBottomNav/);
    expect(bottomNavSource).toMatch(/fixed inset-x-0 bottom-0/);
    expect(bottomNavSource).toMatch(/lg:hidden/);
  });

  it('main content has bottom padding on mobile so the fixed bottom nav never covers content', () => {
    expect(pageSource).toMatch(/pb-16 lg:pb-0/);
  });

  /**
   * M66.2 — the breakpoint literal was updated; the contract was strengthened.
   *
   * This test's real subject is that NavBar itself provides the compact mobile
   * header and no second, competing header component was introduced. That is
   * still true. What changed is WHERE the handover happens: CTO decision D1
   * moved it from `lg` (1024px) to the additive `cd-header` breakpoint
   * (1400px), because the released nine-item desktop header needs ~1313px in
   * English and ~1388px in Polish and simply could not fit at 1024px.
   *
   * Asserting both sides of the handover is stronger than the single
   * `lg:hidden` this replaced: if the two rows ever drift onto different
   * breakpoints, the chrome would either double up or vanish entirely in the
   * gap, and this now fails.
   */
  it('NavBar provides the compact mobile header, and desktop/mobile chrome hand over at one breakpoint', () => {
    expect(navBarSource).toMatch(/cd-header:hidden/);
    expect(navBarSource).toMatch(/cd-header:flex/);
    expect(pageSource).not.toMatch(/<MobileHeader/);
  });

  it('mobile bottom nav uses only real, existing destinations — no fabricated /profile or /intelligence route', () => {
    const codeOnly = stripComments(bottomNavSource);
    expect(codeOnly).not.toMatch(/href:\s*'\/profile'/);
    expect(codeOnly).not.toMatch(/href:\s*'\/intelligence'/);
    expect(codeOnly).toMatch(/href:\s*'#intelligence-modules'/);
  });

  it('mobile bottom nav does not include a fabricated Trending destination', () => {
    expect(stripComments(bottomNavSource).toLowerCase()).not.toMatch(/trending/);
  });
});
