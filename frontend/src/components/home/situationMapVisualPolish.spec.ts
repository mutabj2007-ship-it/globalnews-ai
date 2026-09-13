import { readFileSync } from 'fs';
import { join } from 'path';

const source = readFileSync(join(__dirname, 'HomepageSituationMap.tsx'), 'utf-8');

describe('Global Situation Map visual polish (CTO continuation — priority 1)', () => {
  it('the scan/grid overlay is pointer-events-none — decoration never blocks real map pan/zoom/click', () => {
    expect(source).toMatch(/pointer-events-none absolute inset-0 opacity-\[0\.15\]/);
  });

  it('has an inner glow for depth, and HUD corner brackets for framing', () => {
    expect(source).toMatch(/shadow-\[inset_0_0_60px/);
    expect(source).toMatch(/border-l border-t/);
    expect(source).toMatch(/border-r border-b/);
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
