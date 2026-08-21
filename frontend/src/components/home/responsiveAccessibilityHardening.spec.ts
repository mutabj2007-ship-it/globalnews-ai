import { readFileSync } from 'fs';
import { join } from 'path';
// M66.3 — released Hero values now live in the token layer; assert them there
// rather than pattern-matching an arbitrary class string.
import tailwindConfig from '../../../tailwind.config';

/**
 * `theme` on a Tailwind `Config` is optional and loosely typed, so released
 * values are read through the same narrowed view M66.2's headerSourcePort.spec
 * established rather than by indexing an optional chain.
 */
type ThemeExtend = Record<string, Record<string, unknown>>;
const themeExtend = (tailwindConfig.theme?.extend ?? {}) as unknown as ThemeExtend;

const bandSource = readFileSync(join(__dirname, 'IntelligenceModulesDesktop.tsx'), 'utf-8');
const interactiveSource = readFileSync(
  join(__dirname, 'IntelligenceEngineInteractive.tsx'),
  'utf-8',
);
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
describe('Responsive hardening — Intelligence Modules (M60 Phase 2: true radial geometry supersedes the earlier flat 3/5/9 band AND the subsequent left-stack/hub/right-stack correction)', () => {
  it('desktop connectors are computed via vector arithmetic on fixed hub/module constants — no left/right column slice-and-grid layout, no orthogonal elbow path', () => {
    expect(interactiveSource).toMatch(/function hubEdgePointToward/);
    expect(interactiveSource).not.toMatch(/grid-cols-3/);
    expect(interactiveSource).not.toMatch(/2xl:grid-cols-9/);
    expect(interactiveSource).not.toMatch(/grid-cols-\[1fr_auto_1fr\]/);
  });

  it('the 9th module remains represented, positioned via the shared fixed-slot system', () => {
    expect(interactiveSource).toMatch(/INTELLIGENCE_MODULES\[8\]/);
    expect(interactiveSource).toMatch(/BOTTOM_SLOT/);
  });

  it('the hub retains its concentric-ring/pulse identity and still respects prefers-reduced-motion', () => {
    expect(interactiveSource).toMatch(/gna-hub-ring-a/);
    expect(interactiveSource).toMatch(/gna-hub-ring-b/);
    expect(interactiveSource).toMatch(/prefers-reduced-motion: reduce/);
  });

  it('connector geometry uses fixed constants and pure arithmetic, not runtime DOM measurement', () => {
    const codeOnly = interactiveSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/requestAnimationFrame/);
    expect(codeOnly).not.toMatch(/ResizeObserver/);
    expect(codeOnly).not.toMatch(/getBoundingClientRect/);
  });

  it('mobile uses its own compressed, asymmetric slot topology — not the desktop layout, not a rigid 2-column grid', () => {
    expect(mobileGridSource).toMatch(/SLOT_OFFSETS/);
    expect(mobileGridSource).not.toMatch(/grid-cols-2/);
  });

  it('the desktop radial engine and mobile engine are mutually exclusive via breakpoint gating, no double-render', () => {
    expect(bandSource).toMatch(/lg:block/);
    expect(mobileGridSource).toMatch(/lg:hidden/);
  });
});

describe('Responsive hardening — Hero (CTO HUD finishing pass)', () => {
  it('the desktop world visual is gated to the composition that has room for it — M66.3 moved that gate from lg to cd-hero (CTO decision L-1A) and the mobile bleed takes over below it', () => {
    expect(heroSource).toMatch(/cd-hero:block/);
    expect(heroSource).toMatch(/cd-hero:hidden/);
    // The real contract: the desktop map field must never render inside the
    // mobile card composition, and vice versa.
    expect(heroSource).not.toMatch(/hidden lg:block/);
  });

  it('the live-feed panel is its own real grid column and activates at exactly the same breakpoint as the three-column grid — never a wider or narrower gate', () => {
    expect(heroSource).toMatch(/className="hidden cd-hero:flex"/);
    expect(heroSource).toMatch(/cd-hero:grid-cols-\[minmax\(0,470px\)_minmax\(0,1fr\)_312px\]/);
    expect(heroSource).not.toMatch(/xl:flex/);
    expect(heroSource).not.toMatch(/lg:flex/);
  });

  it('the Hero grid stacks to a single column below lg — no horizontal overflow risk on mobile', () => {
    expect(heroSource).toMatch(/grid-cols-1/);
  });

  it('a shared atmosphere spans the whole Hero surface — M66.3 replaced M65\u2019s approximated radial with GN-CD-040\u2019s exact one, released as a token, and gave mobile its own authored card field', () => {
    const backgroundImage = themeExtend.backgroundImage as unknown as Record<string, string>;
    expect(backgroundImage['cd-hero']).toBe(
      'radial-gradient(1200px 620px at 58% 40%, rgba(11,52,100,.5), rgba(4,7,14,.97) 72%)',
    );
    expect(backgroundImage['cd-hero-m']).toBe(
      'radial-gradient(320px 260px at 92% 6%, rgba(13,58,112,.75), rgba(6,10,20,.96) 72%)',
    );
    expect(heroSource).toMatch(/cd-hero:bg-cd-hero\b/);
    expect(heroSource).toMatch(/bg-cd-hero-m\b/);
    // The `#04060c` base beneath the radial, exactly as PageCanvas composes it.
    expect(heroSource).toMatch(/bg-cd-void/);
    // Radius and border survive unchanged in value; only their carrier is now a token.
    expect(heroSource).toMatch(/rounded-cd-16 border border-cd-edge-section/);
    expect(heroSource).toMatch(/cd-hero:rounded-cd-18 cd-hero:border-cd-edge-card/);
    const colors = (themeExtend.colors.cd as Record<string, unknown>) as Record<string, string>;
    expect(colors['edge-card']).toBe('rgba(56,189,248,0.14)');
    expect(colors['edge-section']).toBe('rgba(56,189,248,0.16)');
    const borderRadius = themeExtend.borderRadius as unknown as Record<string, string>;
    expect(borderRadius['cd-18']).toBe('18px');
    expect(borderRadius['cd-16']).toBe('16px');
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
