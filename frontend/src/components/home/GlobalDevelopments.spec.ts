import { readFileSync } from 'fs';
import { join } from 'path';

const source = readFileSync(join(__dirname, 'GlobalDevelopments.tsx'), 'utf-8');

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/**
 * M60 Phase 2 — updated for the controlled-carousel recomposition
 * (Correction 2). The prior "one large lead card + vertical list of
 * 4 secondary items" layout is replaced by a single uniform sequence
 * of up to 6 cards (`[lead, ...secondary]`) rendered through one
 * shared card function — several of the OLD assertions below
 * (SafeImage appearing twice, a separate `secondaryItems` variable,
 * `lead.sourcesCount` specifically) described that old two-shape
 * layout and are updated here to describe the new one-shape layout
 * instead. The underlying Phase B data allocation itself
 * (lead=featured, secondary=inFocus) is untouched — confirmed by the
 * unchanged prop types and the continued absence of any `.sort(` call.
 */
describe('GlobalDevelopments (M60 Phase 2 — controlled carousel)', () => {
  it('reuses Phase B semantic allocation (featured -> lead, inFocus -> secondary) — no second allocation truth', () => {
    expect(source).toMatch(/lead: NewsArticle \| null/);
    expect(source).toMatch(/secondary: NewsArticle\[\]/);
    expect(stripComments(source)).not.toMatch(/\.sort\(/);
  });

  it('caps the carousel at lead + 5 secondary (6 cards total)', () => {
    expect(source).toMatch(/const SECONDARY_COUNT = 5/);
    expect(source).toMatch(/\[lead, \.\.\.secondary\]\.slice\(0, SECONDARY_COUNT \+ 1\)/);
  });

  it('uses truthful section labels — never "Trending"/"Most read"/"Popular" as rendered copy (this file\u2019s own comments may reference the reference-image label; only rendered text/dictionary keys matter here)', () => {
    expect(stripComments(source).toLowerCase()).not.toMatch(/trending|most read|popular/);
  });

  it('renders exactly one DataModeLabel — provider status stated once, not per card', () => {
    const usages = (source.match(/<DataModeLabel/g) ?? []).length;
    expect(usages).toBe(1);
  });

  it('every card renders through the ONE shared card function — a single SafeImage usage site, not a duplicated lead-vs-secondary markup pair', () => {
    const safeImageUsages = (source.match(/<SafeImage/g) ?? []).length;
    expect(safeImageUsages).toBe(1);
    expect(source).toMatch(/imageUrl \|\| '\/images\/article-placeholder\.jpg'/);
  });

  it('renders a safe unavailable state when there is no lead story', () => {
    expect(source).toMatch(/!lead \?/);
    expect(source).toMatch(/\{t\.unavailable\}/);
  });

  it('article links carry a localized aria-label from the shared card function, not hardcoded English', () => {
    const prefixUsages = (source.match(/\$\{t\.readFullStoryPrefix\}/g) ?? []).length;
    expect(prefixUsages).toBe(1);
  });

  it('only shows a source count when it is genuinely more than one, for any card (lead or secondary) — no fabricated single-source count claim', () => {
    expect(source).toMatch(/item\.sourcesCount > 1 &&/);
  });

  describe('carousel behavior (Correction 2)', () => {
    it('is a client component — the auto-advance timer and manual controls both require it', () => {
      expect(source.trimStart().startsWith("'use client'")).toBe(true);
    });

    it('advances approximately one card at a time on an interval, not perpetual pixel scrolling', () => {
      expect(source).toMatch(/AUTO_ADVANCE_INTERVAL_MS/);
      expect(source).toMatch(/scrollByOneCard/);
      expect(stripComments(source)).not.toMatch(/requestAnimationFrame/);
    });

    it('pauses on hover, focus, and pointer interaction', () => {
      expect(source).toMatch(/onMouseEnter=\{\(\) => setIsPaused\(true\)\}/);
      expect(source).toMatch(/onMouseLeave=\{\(\) => setIsPaused\(false\)\}/);
      expect(source).toMatch(/onFocus=\{\(\) => setIsPaused\(true\)\}/);
      expect(source).toMatch(/onPointerDown=\{\(\) => setIsPaused\(true\)\}/);
    });

    it('registers no auto-advance timer at all when the user prefers reduced motion — not a timer that silently no-ops', () => {
      expect(source).toMatch(/if \(prefersReducedMotion \|\| items\.length <= 1 \|\| isPaused\) return;/);
      expect(source).toMatch(/matchMedia\('\(prefers-reduced-motion: reduce\)'\)/);
    });

    it('provides manual previous/next controls', () => {
      expect(source).toMatch(/scrollByOneCard\(-1\)/);
      expect(source).toMatch(/scrollByOneCard\(1\)/);
    });

    it('uses native CSS scroll-snap for touch swipe, not a custom touch-event handler', () => {
      expect(source).toMatch(/snap-x snap-mandatory/);
      expect(stripComments(source)).not.toMatch(/onTouchStart|onTouchMove|onTouchEnd/);
    });

    it('introduces no new fetch — the carousel renders only the already-provided lead/secondary props', () => {
      expect(stripComments(source)).not.toMatch(/fetch\(/);
    });
  });
});
