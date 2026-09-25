import { readFileSync } from 'fs';
import { join } from 'path';

const source = readFileSync(join(__dirname, 'HomepageSituationMap.tsx'), 'utf-8');

describe('Global Situation Map visual polish (CTO continuation — priority 1)', () => {
  it('the scan/grid overlay is pointer-events-none, and the rail card has none at all', () => {
    /*
      The property this test exists for is `pointer-events-none`: decoration
      must never take a pointer away from the real map. That is unchanged.

      WHAT CHANGED, AND WHY THE ASSERTION MOVED WITH IT. This test used to
      require `opacity-[0.07]` — the rail's own dimmed copy of the scan grid.
      DESKTOP PREMIUM VISUAL PASS Section 5 asks for a map card that is
      "luminous and premium", and measurement showed the rail could not be
      both: at the camera a 340x153 card needs (z-0.58) the shared style draws
      the world very thin, and the grid, the inner cyan glow and the vignette
      then took most of the remaining light. The rail card read as an empty
      box.

      So the rail now renders NONE of the three, and the full-width section
      keeps all three exactly as before. The test asserts that split rather
      than a literal opacity, so neither variant can drift: the section must
      still carry the overlay at 0.15, and the rail must still be built by an
      `isRail ? null :` guard rather than by deleting the treatment outright.
    */
    expect(source).toMatch(/pointer-events-none absolute inset-0/);
    expect(source).toMatch(/opacity-\[0\.15\]/);
    /* The rail no longer carries its own dimmed copy. */
    expect(source).not.toMatch(/opacity-\[0\.07\]/);
    /* And it is guarded, not removed: the section still gets it. */
    expect(source).toMatch(/\{isRail \? null : \(/);
  });

  it('has an inner glow for depth, and HUD corner brackets for framing', () => {
    expect(source).toMatch(/shadow-\[inset_0_0_60px/);
    /* R2 §8 — the brackets are section-only now; the rail card omits them
       deliberately. They must still exist for the section that keeps them. */
    expect(source).toMatch(/border-l border-t/);
    expect(source).toMatch(/border-r border-b/);
    expect(source).toMatch(/isRail\s*\n?\s*\?\s*null/);
  });

  it('the map container border/glow is stronger than the earlier muted treatment, and intensifies further on country selection', () => {
    expect(source).toMatch(/border-cyan-500\/30/);
    expect(source).toMatch(/shadow-\[0_0_50px_-10px_rgba\(34,211,238,0\.3\)\]/);
    expect(source).toMatch(/border-cyan-400\/60/);
    expect(source).toMatch(/shadow-\[0_0_70px_-8px_rgba\(34,211,238,0\.45\)\]/);
  });

  it('selection-reactive illumination is a safe container-level response driven by React state, not a modification to WorldMap.tsx\u2019s shared MapLibre paint internals', () => {
    expect(source).toMatch(/selectedIso3\s*\n?\s*\?\s*'border-cyan-400\/60/);
    expect(source).toMatch(/transition-all duration-500/);
  });

  it('the empty (no-selection) state is HUD-styled rather than a plain unstyled sentence', () => {
    expect(source).toMatch(/t\.eyebrow/);
  });

  it('the real WorldMap component is still rendered, unmodified — no shared MapLibre internals were touched', () => {
    expect(source).toMatch(/<WorldMap\s/);
    expect(source).toMatch(/countryStoryCounts=\{countryStoryCounts\}/);
  });
});
