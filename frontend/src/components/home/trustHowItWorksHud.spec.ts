import { readFileSync } from 'fs';
import { join } from 'path';
import { trustItems } from '@/lib/homeContent';
import { processSteps } from '@/lib/homeContent';

const trustSource = readFileSync(join(__dirname, 'TrustSection.tsx'), 'utf-8');
const howItWorksSource = readFileSync(join(__dirname, 'HowItWorks.tsx'), 'utf-8');

/**
 * CTO directive (test discipline) — this file previously asserted
 * mostly decorative Tailwind class strings. Rewritten to protect
 * meaningful behavioral contracts instead: real content is preserved
 * and rendered, the section stays visually quieter than
 * Hero/Engine/Modules (a genuine hierarchy contract, not a color
 * check), and reduced-motion is genuinely respected. A handful of
 * structural assertions remain ONLY where they protect an actual
 * behavioral distinction (e.g. "one integrated panel, not five
 * separate boxes" — a real information-architecture choice, not
 * cosmetics).
 *
 * M66.6 — TWO of the four Trust assertions below were STALE
 * PRESENTATION LOCKS against the pre-Claude-Design HUD panel
 * (`border border-cyan-500/20`, and an arbitrary-value shadow guard).
 * GN-CD-180 replaces that panel with a 16px-radius bordered surface,
 * so both were CONVERTED to the released contract rather than
 * deleted: each still protects exactly the behaviour it was written
 * for — one integrated panel rather than five boxes, and Trust
 * staying the quietest section on the page — expressed against the
 * vocabulary that now ships. The other two Trust assertions and ALL
 * FOUR How It Works assertions are untouched; How It Works itself is
 * out of scope this milestone (CTO decision D-1 A,
 * M66.6-DEFERRED-001).
 */
describe('TrustSection (CTO HUD system — tertiary-tier behavior)', () => {
  it('renders every real trust item from the shared source data — no invented/hardcoded items', () => {
    expect(trustSource).toMatch(/trustItems\.map/);
    expect(trustSource).toMatch(/localized\?\.title \?\? item\.title/);
    expect(trustSource).toMatch(/localized\?\.description \?\? item\.description/);
    expect(trustItems.length).toBeGreaterThan(0);
  });

  it('is a single integrated panel, not a grid of five individually-bordered boxes — the CTO\u2019s explicit "compact integrated strip" requirement', () => {
    // CONVERTED, not weakened. The information-architecture choice this test
    // was written to protect is unchanged; only the panel's vocabulary moved.
    // GN-CD-180 authors ONE bounded desktop panel, and GN-CD-184-DA authors
    // its five cards as BORDERLESS columns separated by right hairlines — the
    // same "one connected strip, not five boxes" contract, now released.
    const outerPanels = (trustSource.match(/lg:rounded-cd-16 lg:border lg:border-cd-edge-section/g) ?? []).length;
    expect(outerPanels).toBe(1);
    expect(trustSource).toMatch(/lg:border-0 lg:border-r/);
    // The mobile viewport deliberately INVERTS this: no panel, five bordered
    // cards (GN-CD §D "Structural divergence"). Both readings must be present.
    expect(trustSource).toMatch(/border border-cd-edge-card/);
  });

  it('remains visually quieter than Hero/Engine/Modules — no glow/shadow intensity applied to individual items', () => {
    // CONVERTED. The old arbitrary-value guard still passes but no longer
    // means anything, because Trust now expresses shadows as tokens. The real
    // hierarchy contract — GN-CD-303: Trust is "deliberately quieter than
    // everything above it" — is asserted directly instead.
    const code = trustSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/shadow-\[0_0_\d+px/);
    // No resting glow on any card, and no outward shadow anywhere: the only
    // shadow in the family is the icon tile's INSET glow, desktop only.
    const shadows = code.match(/shadow-[\w-]+/g) ?? [];
    expect(shadows).toEqual(['shadow-cd-tile-glow']);
    // And nothing moves — GN-CD acceptance: "presence of any animation is a failure".
    expect(code).not.toMatch(/\banimate-|animation:|@keyframes/);
  });

  it('uses the same cyan HUD accent family as the rest of the revised page, not a disconnected color scheme', () => {
    expect(trustSource).toMatch(/cyan/);
  });
});

describe('HowItWorks (CTO HUD system — tertiary-tier behavior)', () => {
  it('renders all real process steps, in order, from the shared source data — no invented steps', () => {
    expect(howItWorksSource).toMatch(/processSteps\.map/);
    expect(howItWorksSource).toMatch(/t\.steps\[index\]/);
    expect(processSteps.length).toBeGreaterThan(0);
  });

  it('presents the steps as a connected sequence (a responsive absolute connector/rail spanning left-0 to right-0), not disconnected independent boxes', () => {
    // Milestone #53 regression repair — the exact top offset (top-5
    // vs the historical top-6) is a cosmetic value that has changed
    // more than once during HUD tuning rounds and carries no
    // behavioral meaning on its own. The real contract this test
    // protects is structural: an absolute-positioned, full-width
    // connector element exists, and it's responsively hidden below
    // the breakpoint where the steps stack vertically (where a
    // horizontal connector would look broken, not connected).
    expect(howItWorksSource).toMatch(/absolute left-0 right-0 top-\d+ hidden sm:block/);
  });

  it('all decorative animation in this section genuinely respects prefers-reduced-motion', () => {
    expect(howItWorksSource).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    const reducedMotionBlock = howItWorksSource.slice(
      howItWorksSource.indexOf('@media (prefers-reduced-motion'),
    );
    expect(reducedMotionBlock).toMatch(/animation: none !important/);
  });
});
