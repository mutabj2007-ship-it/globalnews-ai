import { readFileSync } from 'fs';
import { join } from 'path';

const source = readFileSync(join(__dirname, 'HeroWorldVisual.tsx'), 'utf-8');

describe('HeroWorldVisual visual enrichment (CTO Visual Acceptance correction)', () => {
  it('is still a Server Component using the real geometry/projection foundation — unchanged technical approach', () => {
    expect(source.trimStart().startsWith("'use client'")).toBe(false);
    expect(source).toMatch(/getCountryFeatureCollection/);
    expect(source).toMatch(/geometryToPathD/);
  });

  it('uses category-colored ambient nodes, not one flat cyan color', () => {
    const colors = ['#22d3ee', '#34d399', '#fbbf24', '#a78bfa', '#f472b6', '#60a5fa', '#fb923c'];
    for (const color of colors) {
      expect(source).toContain(color);
    }
  });

  it('every node has a soft halo (a larger, low-opacity circle behind the core dot)', () => {
    expect(source).toMatch(/r=\{node\.size \* 4\}/);
    expect(source).toMatch(/opacity="0\.12"/);
  });

  it('has one larger focus node with concentric targeting rings, distinct from the ambient nodes', () => {
    expect(source).toMatch(/FOCUS_NODE/);
    expect(source).toMatch(/gna-hero-focus-ring/);
  });

  it('includes restrained curved connector arcs between node pairs', () => {
    expect(source).toMatch(/ARC_PAIRS/);
    expect(source).toMatch(/function arcPath/);
  });

  it('includes a radar-sweep decorative element in addition to the linear scan', () => {
    expect(source).toMatch(/gna-hero-radar-sweep/);
    expect(source).toMatch(/gna-hero-scan-line/);
  });

  it('every animated class is disabled under prefers-reduced-motion', () => {
    expect(source).toMatch(/prefers-reduced-motion: reduce/);
    const reducedMotionBlock = source.slice(source.indexOf('@media (prefers-reduced-motion'));
    expect(reducedMotionBlock).toMatch(/gna-hero-scan-line/);
    expect(reducedMotionBlock).toMatch(/gna-hero-node/);
    expect(reducedMotionBlock).toMatch(/gna-hero-focus-ring/);
    expect(reducedMotionBlock).toMatch(/gna-hero-radar-sweep/);
    expect(reducedMotionBlock).toMatch(/gna-hero-arc/);
  });

  it('node positions remain fixed/arbitrary — no article or country data is threaded through this component', () => {
    expect(source).not.toMatch(/NewsArticle/);
    expect(source).not.toMatch(/\bcountry\.(iso2|iso3|name)\b/);
  });

  it('takes no props — cannot receive real data even accidentally, preserving the decorative/ambient distinction from the real Situation Map', () => {
    expect(source).toMatch(/export function HeroWorldVisual\(\): JSX\.Element/);
  });
});
