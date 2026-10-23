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
  /* ── SUPERSEDED BY E1 U-1 · PUBLISHER IMAGE RIGHTS CONTAINMENT ──────────
     The assertion below USED TO REQUIRE the publisher's photograph to render.
     E1 identified publisher images rendered with no recorded image-display
     clearance, and the CTO independently confirmed this render path, so the
     requirement is withdrawn — not because it became inconvenient, but
     because the behaviour it pinned is the defect.

     THE ORIGINAL IS KEPT ABOVE EACH REPLACEMENT, commented, with its
     authority, so a reader can see exactly what was traded and for what. The
     replacement is the INVERSE where an inverse exists: it is stronger than
     deleting, because deleting would leave nothing stopping the photograph
     from coming back. Every neighbouring assertion in this file is untouched.
     ──────────────────────────────────────────────────────────────────────── */
    /* WAS: expect(source).toMatch(/imageUrl \|\| '\/images\/article-placeholder\.jpg'/);
       The fallback is THE SAME first-party artwork and the SafeImage path is
       unchanged — the test's own subject. What changed is that reaching the
       publisher's photograph is now a governed decision rather than a truthy
       check, so the `||` is gone and the governed call stands in its place. */
    expect(source).toMatch(
      /publisherImageSrcOrFallback\((?:lead|item)\.imageUrl, (?:lead|item)\.sourceId, '\/images\/article-placeholder\.jpg'\)/,
    );
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
