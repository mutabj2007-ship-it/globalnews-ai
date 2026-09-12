import { readFileSync } from 'fs';
import { join } from 'path';

const source = readFileSync(join(__dirname, 'WorldMapAnimatedVisual.tsx'), 'utf-8');

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('WorldMapAnimatedVisual (Milestone #51 browser-acceptance polish)', () => {
  it('is a Server Component — no "use client", no React hooks, no client JS at all', () => {
    expect(source.trimStart().startsWith("'use client'")).toBe(false);
    expect(source).not.toMatch(/useState|useEffect|useRef/);
  });

  it('never imports maplibre-gl', () => {
    expect(stripComments(source)).not.toMatch(/from ['"]maplibre-gl['"]/);
  });

  it('never imports from components/map/ or next/dynamic', () => {
    expect(stripComments(source)).not.toMatch(/from ['"]@\/components\/map\//);
    expect(stripComments(source)).not.toMatch(/next\/dynamic/);
  });

  it('uses pure SVG/CSS animation — no Canvas, WebGL, or animation library', () => {
    expect(source).toMatch(/<svg/);
    expect(stripComments(source)).not.toMatch(/<canvas/i);
    expect(stripComments(source)).not.toMatch(/WebGL/);
    expect(stripComments(source)).not.toMatch(/from ['"](framer-motion|gsap|three)['"]/);
  });

  it('animations use only transform/opacity-friendly CSS keyframes (GPU-friendly)', () => {
    expect(source).toMatch(/@keyframes/);
    expect(source).toMatch(/transform:/);
    expect(source).toMatch(/opacity:/);
  });

  it('respects prefers-reduced-motion by disabling animation entirely, not just slowing it', () => {
    expect(source).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(source).toMatch(/animation: none/);
  });

  it('the entire visual is aria-hidden — purely decorative, never competing with real accessible content', () => {
    expect(source).toMatch(/aria-hidden="true"/);
  });

  it('does not place markers implying specific real-world news events — no article/country data is threaded through this component at all', () => {
    expect(source).not.toMatch(/NewsArticle/);
    expect(source).not.toMatch(/CountryMeta/);
    expect(source).not.toMatch(/\bcountry\.(iso2|iso3|name)\b/);
  });

  it('takes no props — confirms it cannot receive real article/country data even accidentally', () => {
    expect(source).toMatch(/export function WorldMapAnimatedVisual\(\): JSX\.Element/);
  });
});
