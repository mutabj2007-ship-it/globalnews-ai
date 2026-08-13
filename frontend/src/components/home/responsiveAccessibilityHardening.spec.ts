import { readFileSync } from 'fs';
import { join } from 'path';

const bandSource = readFileSync(join(__dirname, 'IntelligenceModulesDesktop.tsx'), 'utf-8');
const mobileGridSource = readFileSync(join(__dirname, 'IntelligenceModulesMobile.tsx'), 'utf-8');
const heroSource = readFileSync(join(__dirname, 'Hero.tsx'), 'utf-8');
const mapSource = readFileSync(join(__dirname, 'HomepageSituationMap.tsx'), 'utf-8');
const bottomNavSource = readFileSync(join(__dirname, '../navigation/MobileBottomNav.tsx'), 'utf-8');

/**
 * CTO HUD Frontend Revision, finishing pass — these tests protect the
 * structural responsive/accessibility CONTRACTS this round addressed.
 * They deliberately avoid brittle pixel/class-count assertions —
 * checking presence of the responsive breakpoint strategy and
 * accessibility affordances, not exact decorative styling.
 */
describe('Responsive hardening — Intelligence Modules (CTO HUD finishing pass)', () => {
  it('desktop band uses a graduated column count (3 -> 5 -> 9) rather than a fixed 9-column grid at every desktop width', () => {
    expect(bandSource).toMatch(/grid-cols-3/);
    expect(bandSource).toMatch(/md:grid-cols-5/);
    expect(bandSource).toMatch(/2xl:grid-cols-9/);
    expect(bandSource).not.toMatch(/(?<!2)xl:grid-cols-9/);
  });

  it('mobile uses a genuinely different, 2-column composition — not the desktop band', () => {
    expect(mobileGridSource).toMatch(/grid-cols-2/);
    expect(mobileGridSource).not.toMatch(/grid-cols-9/);
  });

  it('the desktop band and mobile grid are mutually exclusive via breakpoint gating, no double-render', () => {
    expect(bandSource).toMatch(/lg:block/);
    expect(mobileGridSource).toMatch(/lg:hidden/);
  });
});

describe('Responsive hardening — Hero (CTO HUD finishing pass)', () => {
  it('the world visual is desktop-only — mobile gets the simpler stacked layout, not a crowded screen', () => {
    expect(heroSource).toMatch(/lg:block/);
  });

  it('the live-feed panel is gated to a wider breakpoint than the visual itself, so it never crowds a merely-desktop-but-not-huge screen', () => {
    expect(heroSource).toMatch(/xl:flex/);
  });

  it('the Hero grid stacks to a single column below lg — no horizontal overflow risk on mobile', () => {
    expect(heroSource).toMatch(/grid-cols-1/);
  });

  it('a shared cyan atmosphere spans both Hero columns (CTO continuation, priority 2 — spatial integration)', () => {
    expect(heroSource).toMatch(/radial-gradient\(ellipse_70%_60%_at_75%_45%,rgba\(34,211,238,0\.10\)/);
  });
});

describe('Accessibility — Global Situation Map (CTO HUD finishing pass)', () => {
  it('the map region has an accessible label for screen readers', () => {
    expect(mapSource).toMatch(/role="application"/);
    expect(mapSource).toMatch(/aria-label=\{t\.heading\}/);
  });

  it('the loading state uses a live region so screen reader users are notified', () => {
    expect(mapSource).toMatch(/role="status" aria-live="polite"/);
  });

  it('the category legend is text-labeled, not color-only', () => {
    expect(mapSource).toMatch(/categoryLabels\[category\]/);
  });
});

describe('Accessibility — mobile bottom navigation (CTO HUD finishing pass)', () => {
  it('respects the safe-area inset so content is never obscured on notched devices', () => {
    expect(bottomNavSource).toMatch(/env\(safe-area-inset-bottom\)/);
  });

  it('every destination has a real text label, not icon-only', () => {
    expect(bottomNavSource).toMatch(/\{t\[key\]\}/);
  });

  it('uses only real, existing destinations — no fabricated routes', () => {
    const codeOnly = bottomNavSource.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(codeOnly).not.toMatch(/href:\s*'\/profile'/);
    expect(codeOnly).not.toMatch(/href:\s*'\/trending'/);
  });
});
