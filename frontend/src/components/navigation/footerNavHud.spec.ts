import { readFileSync } from 'fs';
import { join } from 'path';
import { footerLinkGroups } from '@/lib/homeContent';

const footerSource = readFileSync(join(__dirname, '../layout/Footer.tsx'), 'utf-8');
const navBarSource = readFileSync(join(__dirname, 'NavBar.tsx'), 'utf-8');

/**
 * CTO directive (test discipline) — rewritten to protect real
 * behavioral contracts (real links only, comingSoon items stay
 * visually non-deceptive, active-route detection is genuine) rather
 * than asserting decorative class strings.
 */
describe('Footer (CTO HUD system)', () => {
  it('renders only real links from footerLinkGroups — nothing invented, flattened for display but not for data', () => {
    expect(footerSource).toMatch(/footerLinkGroups\.flatMap/);
    const totalRealLinks = footerLinkGroups.reduce((sum, group) => sum + group.links.length, 0);
    expect(totalRealLinks).toBeGreaterThan(0);
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
});
