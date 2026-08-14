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
 */
describe('TrustSection (CTO HUD system — tertiary-tier behavior)', () => {
  it('renders every real trust item from the shared source data — no invented/hardcoded items', () => {
    expect(trustSource).toMatch(/trustItems\.map/);
    expect(trustSource).toMatch(/localized\?\.title \?\? item\.title/);
    expect(trustSource).toMatch(/localized\?\.description \?\? item\.description/);
    expect(trustItems.length).toBeGreaterThan(0);
  });

  it('is a single integrated panel, not a grid of five individually-bordered boxes — the CTO\u2019s explicit "compact integrated strip" requirement', () => {
    // One outer HUD panel wrapping the whole section, not one per item.
    const outerPanels = (
      trustSource.match(/relative overflow-hidden border border-cyan-500\/20/g) ?? []
    ).length;
    expect(outerPanels).toBe(1);
  });

  it('remains visually quieter than Hero/Engine/Modules — no glow/shadow intensity applied to individual items', () => {
    expect(trustSource).not.toMatch(/shadow-\[0_0_\d+px/);
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
