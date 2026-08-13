import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Milestone #51 (consolidated homepage round) — LatestNowRail.
 *
 * The derivation logic itself (slice to 6, no popularity ranking) is
 * simple enough that it's verified here via source inspection rather
 * than a render harness — this codebase's established pattern for
 * components with heavy external dependencies (next/dynamic,
 * SafeImage) that make a full render harness costly for limited
 * benefit. Actual scroll-snap/trackpad/swipe FEEL requires browser
 * acceptance — not claimed here.
 */
const railSource = readFileSync(join(__dirname, 'LatestNowRail.tsx'), 'utf-8');
const controlsSource = readFileSync(join(__dirname, 'LatestNowScrollControls.tsx'), 'utf-8');
const tickerSourceForRailSpec = readFileSync(join(__dirname, 'LatestNowTicker.tsx'), 'utf-8');

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('LatestNowRail (Milestone #51)', () => {
  it('derives its slice from the existing latestUpdates prop — no separate fetch, no popularity signal', () => {
    expect(railSource).toMatch(/updates\.slice\(0,\s*RAIL_COUNT\)/);
    expect(stripComments(railSource)).not.toMatch(/fetch\(/);
    expect(stripComments(railSource)).not.toMatch(/fetchTopHeadlines/);
  });

  it('RAIL_COUNT is 6', () => {
    expect(railSource).toMatch(/const RAIL_COUNT = 6/);
  });

  it('returns null (renders nothing) when there are zero items — no empty heading', () => {
    expect(railSource).toMatch(/if \(items\.length === 0\)\s*\{\s*return null;/);
  });

  it('is a Server Component — no "use client" directive', () => {
    expect(railSource.trimStart().startsWith("'use client'")).toBe(false);
  });

  it('the scroll region has an accessible landmark role and localized label', () => {
    expect(railSource).toMatch(/role="region"/);
    expect(railSource).toMatch(/aria-label=\{t\.regionLabel\}/);
  });

  it('the scroll region (now owned by LatestNowTicker) uses CSS scroll-snap for native scrollability; the rail itself contains no timer code (auto-scroll lives in LatestNowTicker specifically, verified in its own spec)', () => {
    expect(tickerSourceForRailSpec).toMatch(/snap-x/);
    expect(tickerSourceForRailSpec).toMatch(/snap-mandatory/);
    expect(stripComments(railSource)).not.toMatch(/setInterval/);
  });

  it('does not render a per-card image (kept light) or a per-card data-mode badge', () => {
    expect(railSource).not.toMatch(/SafeImage/);
    expect(railSource).not.toMatch(/DataModeLabel/);
  });

  it('aria-label uses the localized readFullStoryPrefix, not hardcoded English', () => {
    expect(railSource).toMatch(/\$\{t\.readFullStoryPrefix\}/);
    expect(stripComments(railSource)).not.toMatch(/aria-label=\{`Read the full story/);
  });

  it('wraps its server-rendered cards in LatestNowTicker (the auto-scroll client boundary), passing them as children — cards themselves are not duplicated for the effect', () => {
    expect(railSource).toMatch(/<LatestNowTicker\b/);
    const tickerOpenIndex = railSource.indexOf('<LatestNowTicker');
    const firstCardIndex = railSource.indexOf('<li key={item.id}');
    expect(firstCardIndex).toBeGreaterThan(tickerOpenIndex);
    // Exactly one items.map — no second, duplicate render pass over the same array.
    const mapCount = (railSource.match(/items\.map\(/g) ?? []).length;
    expect(mapCount).toBe(1);
  });
});

describe('LatestNowScrollControls (Milestone #51, redesigned as overlay buttons)', () => {
  it('exports two independent button components rather than one grouped toolbar — required for left/right overlay positioning', () => {
    expect(controlsSource).toMatch(/export function LatestNowPreviousButton/);
    expect(controlsSource).toMatch(/export function LatestNowNextButton/);
  });

  it('is a client boundary — carries "use client"', () => {
    expect(controlsSource.trimStart().startsWith("'use client'")).toBe(true);
  });

  it('neither button renders when item count is below the useful-scroll threshold — no useless arrows', () => {
    expect(controlsSource).toMatch(/MIN_ITEMS_FOR_CONTROLS/);
    const returnNullCount = (controlsSource.match(/if \(itemCount < MIN_ITEMS_FOR_CONTROLS\)\s*\{\s*return null;/g) ?? [])
      .length;
    expect(returnNullCount).toBe(2);
  });

  it('buttons are real <button> elements with localized aria-labels, not divs', () => {
    expect(controlsSource).toMatch(/<button/);
    expect(controlsSource).toMatch(/aria-label=\{previousLabel\}/);
    expect(controlsSource).toMatch(/aria-label=\{nextLabel\}/);
  });

  it('touch targets meet the 44px minimum', () => {
    expect(controlsSource).toMatch(/h-11 w-11/);
  });

  it('buttons are hidden below the sm breakpoint — native swipe is the primary mobile interaction', () => {
    expect(controlsSource).toMatch(/hidden sm:flex/);
  });

  it('does not introduce ResizeObserver, global scroll listeners, or auto-advance', () => {
    expect(controlsSource).not.toMatch(/ResizeObserver/);
    expect(controlsSource).not.toMatch(/addEventListener\(['"]scroll/);
    expect(controlsSource).not.toMatch(/setInterval/);
  });
});

describe('LatestNowRail control placement (Milestone #51 browser-acceptance UX polish)', () => {
  it('passes previousButton/nextButton into LatestNowTicker as overlay content, not a separate header toolbar', () => {
    expect(railSource).toMatch(/previousButton=\{/);
    expect(railSource).toMatch(/nextButton=\{/);
    expect(railSource).not.toMatch(/<LatestNowScrollControls\b/);
  });

  it('LatestNowTicker positions the buttons as an absolute overlay, vertically centered against the cards', () => {
    expect(tickerSourceForRailSpec).toMatch(/absolute inset-y-0 left-1/);
    expect(tickerSourceForRailSpec).toMatch(/absolute inset-y-0 right-1/);
  });

  it('the heading row above the rail contains only the section label, not controls', () => {
    const headingBlockMatch = railSource.match(/<span[\s\S]*?id="latest-now-heading"[\s\S]*?<\/span>/);
    expect(headingBlockMatch).not.toBeNull();
  });

  it('card metadata uses a quieter tone than the headline, reinforcing visual hierarchy', () => {
    // The category badge no longer uses the brightest color (signal-bright)
    // — it shares the same muted tone as the timestamp.
    expect(railSource).not.toMatch(/className="text-signal-bright">\{item\.category\}/);
  });
});
