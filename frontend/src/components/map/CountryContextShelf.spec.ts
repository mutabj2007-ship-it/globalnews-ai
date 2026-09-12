import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Milestone #50 Phase F — structural/source-inspection tests for the
 * right-column redesign, mirroring the established pattern from
 * MapPageClient.layout.spec.ts. Actual browser sticky behavior is NOT
 * and cannot be verified by Jest/jsdom — these tests protect the
 * structural contract the design depends on. Manual browser
 * acceptance remains the authoritative gate for whether the shelf
 * genuinely stays visible while scrolling.
 */

const panelSource = readFileSync(join(__dirname, 'CountryPanel.tsx'), 'utf-8');
const shelfSource = readFileSync(join(__dirname, 'CountryContextShelf.tsx'), 'utf-8');

/**
 * Strips `//` and `/* *​/` comments before running negative assertions
 * (e.g. "no overflow-y-auto anywhere") — several of this file's own
 * explanatory doc comments intentionally mention the exact strings
 * being asserted against (explaining what was deliberately AVOIDED),
 * which would otherwise produce false-positive failures against the
 * raw source text. This only affects the NEGATIVE checks below; the
 * POSITIVE checks intentionally still scan the full source, since a
 * real class/import must appear in actual code, not just a comment.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function extractClassNames(src: string): string[] {
  return [...src.matchAll(/className="([^"]*)"/g)].map((m) => m[1]);
}

describe('Right-column sticky context shelf structure (Milestone #50 Phase F)', () => {
  it('1. the context shelf wrapper carries lg:sticky, scoped to desktop only', () => {
    const classNames = extractClassNames(panelSource);
    const stickyClass = classNames.find((v) => v.includes('sticky'));
    expect(stickyClass).toBeDefined();
    expect(stickyClass).toMatch(/lg:sticky\b/);
    expect(stickyClass).not.toMatch(/(?<!lg:)\bsticky\b(?!-)/);
  });

  it('2. the shelf wrapper has an lg:top offset aligned with the sticky map', () => {
    expect(panelSource).toMatch(/lg:sticky lg:top-20/);
  });

  it('3. the shelf sits at a lower z-index than the map wrapper (z-30 vs the map`s z-40), avoiding unnecessary escalation', () => {
    expect(panelSource).toMatch(/lg:z-30/);
  });

  it('4. CountryPanel does NOT wrap articles in an internally-scrollable container — no overflow-y-auto anywhere', () => {
    expect(stripComments(panelSource)).not.toMatch(/overflow-y-auto/);
  });

  it('5. CountryPanel does NOT force a fixed/full height on its root — h-full is absent, confirming normal document-flow scrolling', () => {
    expect(stripComments(panelSource)).not.toMatch(/\bh-full\b/);
  });

  it('6. article stream is structurally separate from the sticky shelf — CountryArticleCard usage occurs OUTSIDE the sticky wrapper block', () => {
    const stickyBlockStart = panelSource.indexOf('lg:sticky lg:top-20');
    const articleCardUsage = panelSource.indexOf('<CountryArticleCard');
    const stickyBlockEnd = panelSource.indexOf('</div>', stickyBlockStart);
    expect(stickyBlockStart).toBeGreaterThan(-1);
    expect(articleCardUsage).toBeGreaterThan(-1);
    // The article card must not be nested within the immediate sticky div.
    expect(articleCardUsage).toBeGreaterThan(stickyBlockEnd);
  });

  it('7. category controls (CategoryFilterBar) are rendered inside the shelf, not duplicated elsewhere', () => {
    expect(shelfSource).toMatch(/<CategoryFilterBar/);
    expect(panelSource).not.toMatch(/<CategoryFilterBar/);
  });

  it('8. the shelf has an opaque background (bg-surface) so scrolling cards do not visually bleed through', () => {
    const classNames = extractClassNames(shelfSource);
    expect(classNames.some((v) => v.includes('bg-surface'))).toBe(true);
  });

  it('9. no fixed positioning is used anywhere in the shelf or panel (per explicit "avoid fixed positioning" requirement)', () => {
    expect(stripComments(panelSource)).not.toMatch(/\bfixed\b/);
    expect(stripComments(shelfSource)).not.toMatch(/\bfixed\b/);
  });
});

describe('Compact coverage metrics render from existing data (Milestone #50 Phase F)', () => {
  it('CoverageMetrics is used inside the shelf, and the long algorithm functions are imported, not reimplemented', () => {
    expect(shelfSource).toMatch(/<CoverageMetrics/);
    expect(shelfSource).toMatch(/calculateCoverageQuality/);
  });
});

describe('Article card hover/accessibility contract (Milestone #50 Phase F)', () => {
  const cardSource = readFileSync(join(__dirname, 'CountryArticleCard.tsx'), 'utf-8');

  it('hover transitions respect prefers-reduced-motion via motion-reduce:/motion-safe: variants', () => {
    expect(cardSource).toMatch(/motion-reduce:/);
  });

  it('focus-visible styling exists, so keyboard users get equivalent affordance to mouse hover', () => {
    expect(cardSource).toMatch(/focus-visible:/);
  });

  it('no fabricated engagement/trending/popularity label is present in actual rendered content — only category, source, and age are shown', () => {
    const rendered = stripComments(cardSource);
    expect(rendered).not.toMatch(/trending/i);
    expect(rendered).not.toMatch(/popular/i);
    expect(rendered).not.toMatch(/engagement/i);
  });
});

describe('Left sticky-map structure remains unchanged (Milestone #50 Phase E, re-verified)', () => {
  const mapPageSource = readFileSync(join(__dirname, 'MapPageClient.tsx'), 'utf-8');

  it('the map column still uses the outer-cell/inner-sticky pattern, untouched by this round', () => {
    expect(mapPageSource).toMatch(/lg:sticky lg:top-20 lg:z-40/);
  });

  it('the outer grid still has no items-start (the M50 v2 regression must not return)', () => {
    const classNames = extractClassNames(mapPageSource);
    const gridClass = classNames.find((v) => v.includes('grid-cols-1') && v.includes('lg:grid-cols-3'));
    expect(gridClass).toBeDefined();
    expect(gridClass).not.toMatch(/items-start/);
  });
});

describe('Mobile stacking contract preserved (Milestone #50 Phase F)', () => {
  it('no sticky class in CountryPanel/CountryContextShelf is applied without the lg: breakpoint prefix', () => {
    for (const src of [panelSource, shelfSource]) {
      expect(stripComments(src)).not.toMatch(/(?<!lg:)\bsticky\b(?!-)/);
    }
  });
});
