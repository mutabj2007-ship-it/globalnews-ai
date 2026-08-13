import { readFileSync } from 'fs';
import { join } from 'path';

const source = readFileSync(join(__dirname, 'GlobalDevelopments.tsx'), 'utf-8');

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('GlobalDevelopments (Master Frontend Recomposition, Checkpoint 2)', () => {
  it('reuses Phase B semantic allocation (featured -> lead, inFocus -> secondary) — no second allocation truth', () => {
    expect(source).toMatch(/lead: NewsArticle \| null/);
    expect(source).toMatch(/secondary: NewsArticle\[\]/);
    expect(stripComments(source)).not.toMatch(/\.sort\(/);
  });

  it('caps secondary stories at 4, matching the approved 1-lead+4-secondary layout', () => {
    expect(source).toMatch(/const SECONDARY_COUNT = 4/);
    expect(source).toMatch(/secondary\.slice\(0, SECONDARY_COUNT\)/);
  });

  it('uses truthful section labels — never Trending/Most read/Popular', () => {
    expect(stripComments(source).toLowerCase()).not.toMatch(/trending|most read|popular/);
  });

  it('renders exactly one DataModeLabel — provider status stated once, not per card', () => {
    const usages = (source.match(/<DataModeLabel/g) ?? []).length;
    expect(usages).toBe(1);
  });

  it('lead and secondary stories both use SafeImage with the shared placeholder fallback — no fabricated imagery', () => {
    const safeImageUsages = (source.match(/<SafeImage/g) ?? []).length;
    expect(safeImageUsages).toBe(2);
    expect(source).toMatch(/imageUrl \|\| '\/images\/article-placeholder\.jpg'/);
  });

  it('renders a safe unavailable state when there is no lead story', () => {
    expect(source).toMatch(/!lead \?/);
    expect(source).toMatch(/\{t\.unavailable\}/);
  });

  it('article links carry localized aria-labels, not hardcoded English', () => {
    const prefixUsages = (source.match(/\$\{t\.readFullStoryPrefix\}/g) ?? []).length;
    expect(prefixUsages).toBe(2);
  });

  it('handles secondary being empty (undersupply) without rendering an empty list', () => {
    expect(source).toMatch(/secondaryItems\.length > 0 &&/);
  });

  it('only shows a source count when it is genuinely more than one — no fabricated single-source count claim', () => {
    expect(source).toMatch(/lead\.sourcesCount > 1 &&/);
  });
});
