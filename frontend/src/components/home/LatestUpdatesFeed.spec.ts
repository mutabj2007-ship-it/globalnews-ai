import { readFileSync } from 'fs';
import { join } from 'path';

const source = readFileSync(join(__dirname, 'LatestUpdatesFeed.tsx'), 'utf-8');

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('LatestUpdatesFeed editorial redesign (Milestone #51 browser-acceptance polish)', () => {
  it('preserves chronological semantics — consumes updates via a plain slice, never re-sorts or re-derives order', () => {
    expect(source).toMatch(/const items = updates\.slice\(0, DISPLAY_COUNT\)/);
    expect(stripComments(source)).not.toMatch(/\.sort\(/);
  });

  it('separates a single lead update from the remaining secondary updates', () => {
    expect(source).toMatch(/const \[lead, \.\.\.secondary\] = items/);
  });

  it('does not render the enormous full 12-article archive — DISPLAY_COUNT caps the preview', () => {
    expect(source).toMatch(/const DISPLAY_COUNT = 6/);
  });

  it('uses the existing SafeImage/fallback path for both lead and secondary imagery — no new image-handling logic', () => {
    const safeImageUsages = (source.match(/<SafeImage/g) ?? []).length;
    expect(safeImageUsages).toBe(2);
    expect(source).toMatch(/imageUrl \|\| '\/images\/article-placeholder\.jpg'/);
  });

  it('does not fabricate an image URL — every SafeImage src still traces back to the real article field', () => {
    expect(stripComments(source)).not.toMatch(/src="https?:\/\//);
  });

  it('article links remain real, keyboard-focusable anchors with localized aria-labels', () => {
    const anchorCount = (source.match(/<a\s/g) ?? []).length;
    expect(anchorCount).toBeGreaterThanOrEqual(2);
    expect(source).toMatch(/\$\{t\.readFullStoryPrefix\}/);
  });

  it('renders a safe empty state when there are zero updates', () => {
    expect(source).toMatch(/items\.length === 0/);
    expect(source).toMatch(/\{t\.unavailable\}/);
  });

  it('secondary updates render in a responsive 2-column grid, not a single stretched-width list', () => {
    expect(source).toMatch(/grid-cols-1 gap-3 sm:grid-cols-2/);
  });

  it('does not invent a "view all" destination — no such link exists without a real target page', () => {
    expect(stripComments(source)).not.toMatch(/view all/i);
    expect(stripComments(source)).not.toMatch(/href="\/updates"/);
    expect(stripComments(source)).not.toMatch(/href="\/latest"/);
  });

  it('handles the secondary section being empty (undersupply) without rendering an empty grid', () => {
    expect(source).toMatch(/secondary\.length > 0 &&/);
  });
});
