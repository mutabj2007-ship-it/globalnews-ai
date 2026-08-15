import { readFileSync } from 'fs';
import { join } from 'path';

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
  it('the world visual is desktop-only — mobile gets the simpler stacked layout, not a crowded screen', () => {
    expect(heroSource).toMatch(/lg:block/);
  });

  it('the live-feed panel is its own real grid column (M60 Phase 2), so it activates at the same lg breakpoint the three-column grid itself does, rather than a wider gate reserved for squeezing an overlay into extra space', () => {
    expect(heroSource).toMatch(/lg:flex/);
    expect(heroSource).not.toMatch(/xl:flex/);
  });

  it('the Hero grid stacks to a single column below lg — no horizontal overflow risk on mobile', () => {
    expect(heroSource).toMatch(/grid-cols-1/);
  });

  it('a shared cyan atmosphere spans both Hero columns (CTO continuation, priority 2 — spatial integration)', () => {
    expect(heroSource).toMatch(
      /radial-gradient\(ellipse_70%_60%_at_75%_45%,rgba\(34,211,238,0\.10\)/,
    );
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
