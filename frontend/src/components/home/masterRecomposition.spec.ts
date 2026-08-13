import { readFileSync } from 'fs';
import { join } from 'path';

const pageSource = readFileSync(join(__dirname, '../../app/page.tsx'), 'utf-8');
const navBarSource = readFileSync(join(__dirname, '../navigation/NavBar.tsx'), 'utf-8');
const bottomNavSource = readFileSync(join(__dirname, '../navigation/MobileBottomNav.tsx'), 'utf-8');

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('Final homepage recomposition (Master Frontend Recomposition)', () => {
  it('renders sections in the approved order', () => {
    const order = [
      '<LatestNowRail',
      '<Hero',
      '<GlobalDevelopments',
      '<HomepageSituationMap',
      '<IntelligenceModulesDesktop',
      '<IntelligenceModulesMobile',
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

  it('NavBar already provides a compact mobile header — no duplicate/competing mobile header was introduced', () => {
    expect(navBarSource).toMatch(/lg:hidden/);
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
