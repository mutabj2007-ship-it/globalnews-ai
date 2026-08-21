import { readFileSync } from 'fs';
import { join } from 'path';

const source = readFileSync(join(__dirname, 'HeroIntelligenceField.tsx'), 'utf-8');
const heroSource = readFileSync(join(__dirname, 'Hero.tsx'), 'utf-8');

/**
 * M65 — the Hero decorative intelligence field, ported from the approved
 * Claude Design. The guards here are the ones the recovered archive
 * needed and did not have.
 */
describe('HeroIntelligenceField — unique DOM ids', () => {
  it('derives its SVG filter id and animation class names per instance via useId — it renders twice per page', () => {
    expect(source).toMatch(/useId/);
    expect(source).toMatch(/const uid = useId\(\)/);
    expect(source).toMatch(/gnaHifGlow-\$\{safeUid\}/);
  });

  it('ships NO fixed literal id — a second instance must never resolve url(#...) to the first instance filter', () => {
    expect(source).not.toMatch(/id="gna-hif-glow"/);
    expect(source).not.toMatch(/url\(#gna-hif-glow\)/);
    expect(source).toMatch(/filter=\{`url\(#\$\{glowId\}\)`\}/);
  });

  it('sanitises the useId value before using it in a CSS class selector', () => {
    expect(source).toMatch(/uid\.replace\(\/\[\^a-zA-Z0-9_-\]\/g, ''\)/);
  });

  it('is rendered exactly twice by Hero — the desktop field and the mobile corner bleed, the second in its M66.3 compact recomposition', () => {
    // M66.14B — matched regardless of props: the desktop instance now receives
    // a focus target. The CONTRACT is the instance count and the compact
    // recomposition, neither of which changed.
    const usages = (heroSource.match(/<HeroIntelligenceField[^>]*\/>/g) ?? []).length;
    expect(usages).toBe(2);
    expect(heroSource).toMatch(/<HeroIntelligenceField focus=\{fieldFocus\} \/>/);
    expect(heroSource).toMatch(/<HeroIntelligenceField compact \/>/);
  });
});

describe('HeroIntelligenceField — decorative only, with real geometry and no network', () => {
  /*
    M66.14B — the title's promise is kept; only 'fake' changes meaning.

    The original forbade a focus prop because any focus would have been
    invented — CTO decision L-8. The field now accepts a REAL target, already
    resolved by the caller from a canonical country relation. What must remain
    true, and is asserted below, is that the field still decides nothing: no
    lookup, no state, no handler, no article knowledge, no scope, no category
    filter. It receives a point and a colour and draws them.
  */
  it('takes a resolved focus target and nothing else — it still exposes no interaction and decides nothing', () => {
    expect(source).toMatch(/export function HeroIntelligenceField\(\{[\s\S]{0,120}?compact = false,[\s\S]{0,60}?focus = null,[\s\S]{0,40}?\}: HeroIntelligenceFieldProps = \{\}\): JSX\.Element/);
    expect(source).not.toMatch(/onClick|onKeyDown|onMouseEnter|useState/);
    /*
      The two guards below run on EXECUTABLE source. The doc comments in this
      component legitimately name the things it does not do — 'a channel triple
      from CATEGORY_CHANNEL' describes what the caller supplies — and a guard
      that a file's own documentation can trip is a guard that gets deleted.
      Same convention as the propsBlock check below.
    */
    const executableSource = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    // It resolves nothing itself — the caller hands it a projected place.
    expect(executableSource).not.toMatch(/countryFocusPoint|computeFeatureCenter|CATEGORY_CHANNEL|categoryChannel/);
    // And it knows nothing about articles.
    expect(executableSource).not.toMatch(/articleId|NewsArticle|headline/);
    // M66.3 — `compact` is the ONLY prop, and it carries no data. No focus id,
    // no scope, no category filter (CTO decision L-8).
    // Comments legitimately name the elements this component does NOT carry
    // while documenting their absence, so the guard runs on executable source.
    const executable = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const propsBlock = executable.slice(
      executable.indexOf('interface HeroIntelligenceFieldProps'),
      executable.indexOf('const VIEWPORT'),
    );
    // `focus` is now an authorized, resolved target. Everything L-8 refused —
    // scope, category filtering, named signals — is still forbidden.
    expect(propsBlock).not.toMatch(/scope|cat\b|signal/i);
    /*
      The focus prop carries ONLY a resolved point and a colour channel. Checked
      on the HeroFieldFocus declaration itself, which sits above the props
      interface — a name, label, id or tooltip here would be the named,
      described signal node CTO decision L-8 refused, and this field is
      aria-hidden so nothing in it may carry an accessible name.
    */
    const focusBlock = executable.slice(
      executable.indexOf('export interface HeroFieldFocus'),
      executable.indexOf('interface HeroIntelligenceFieldProps'),
    );
    expect(focusBlock).toMatch(/lon: number;/);
    expect(focusBlock).toMatch(/lat: number;/);
    expect(focusBlock).toMatch(/channel: string;/);
    expect(focusBlock).not.toMatch(/name|label|id:|tooltip/i);
  });

  it('is hidden from assistive technology at its root', () => {
    expect(source).toMatch(/aria-hidden="true"/);
  });

  it('uses the SAME real local country geometry every other geographic surface uses — and introduces no fetch', () => {
    expect(source).toMatch(/getCountryFeatureCollection/);
    expect(source).not.toMatch(/fetch\(/);
    // The approved design's own map fetches TopoJSON from a CDN at
    // runtime; this port deliberately does not. (The SVG xmlns URI is
    // markup, not a request.)
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/cdn|unpkg|jsdelivr|d3-geo/i);
  });

  it('carries no place names or category claims — the design’s named-city demonstration data is deliberately not ported', () => {
    const executableSource = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

    for (const cityName of ['Washington', 'Moscow', 'Cairo', 'Beijing', 'London', 'Tokyo']) {
      expect(executableSource).not.toContain(cityName);
    }
  });

  it('respects reduced motion, using the codebase’s existing media-query convention', () => {
    expect(source).toMatch(/prefers-reduced-motion: reduce/);
  });

  it('exposes no focusable, labelled or tooltipped map element — GN-CD-052’s role/tabindex/aria-label node contract is deliberately NOT ported (CTO decision L-8)', () => {
    const executableSource = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(executableSource).not.toMatch(/tabIndex|tabindex/);
    expect(executableSource).not.toMatch(/role=/);
    expect(executableSource).not.toMatch(/aria-label/);
    expect(executableSource).not.toMatch(/<title|<desc/);
  });

  it('encodes no evidence scope — GN-CD-048’s SCOPE_R table and GN-CD-051’s RELATED map are absent, so no ring radius can imply a precision the data does not support', () => {
    const executableSource = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(executableSource).not.toMatch(/SCOPE_R|RELATED\b/);
    expect(executableSource).not.toMatch(/'city'|'country'|'region'/);
    expect(source).toMatch(/const DECORATIVE_RING_BASE = 14/);
  });
});

/* ─────────────────────── M66.3 — projection correction ─────────────────────── */

describe('HeroIntelligenceField — GN-CD-043 projection fit', () => {
  it('applies ONE uniform scale, computed from the released fitExtent insets, rather than scaling longitude and latitude independently', () => {
    // The M65 defect: the x half-extent mapped to 440 viewBox units while the y
    // half-extent mapped to 272.8, a ratio of 1.1925, so every landmass
    // rendered ~19% too tall for its width. d3.geoNaturalEarth1().fitExtent()
    // applies a single scale and cannot produce that.
    expect(source).toMatch(/export function fitScale\(width: number, height: number\): number/);
    expect(source).toMatch(/const FIT_X = 0\.96/);
    expect(source).toMatch(/const FIT_Y = 0\.86/);
    expect(source).toMatch(/VIEWPORT\.width \/ 2 \+ x \* SCALE/);
    expect(source).toMatch(/VIEWPORT\.height \/ 2 - y \* SCALE/);
  });

  it('derives the sphere half-extents from the polynomial instead of hardcoding them', () => {
    expect(source).toMatch(/export const SPHERE_HALF_X = naturalEarth1Radians\(Math\.PI, 0\)\[0\]/);
    expect(source).toMatch(/export const SPHERE_HALF_Y = naturalEarth1Radians\(0, Math\.PI \/ 2\)\[1\]/);
    expect(source).not.toMatch(/const maxY = 1\.4224/);
    expect(source).not.toMatch(/const margin = 0\.06/);
  });

  it('draws the REAL projected sphere boundary rather than an ellipse — Natural Earth 1 has a flat pole line no ellipse can express', () => {
    expect(source).toMatch(/export function sphereBoundaryPathD\(\): string/);
    // The doc comment legitimately names the primitive it replaced.
    const executableSource = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(executableSource).not.toMatch(/<ellipse/);
  });

  it('recomposes the graticule for the compact viewport (GN-CD-046: 40 x 30 degrees, not a dimmed 10 x 10)', () => {
    expect(source).toMatch(/graticulePaths\(40, 30, 60\) : graticulePaths\(10, 10, 80\)/);
    expect(source).toMatch(/rgba\(56,189,248,0\.07\)' : 'rgba\(56,189,248,0\.085\)/);
  });

  it('keeps GN-CD-047’s exact country fill, stroke and width', () => {
    expect(source).toMatch(/fill="rgba\(13,48,88,0\.62\)" stroke="rgba\(56,189,248,0\.42\)" strokeWidth="0\.55"/);
  });

  it('reduces the decorative lattice and mark count when compact, per the design’s own responsive rule', () => {
    expect(source).toMatch(/DECORATIVE_LINKS\.slice\(0, 3\)/);
    expect(source).toMatch(/index % 2 === 0/);
  });
});
