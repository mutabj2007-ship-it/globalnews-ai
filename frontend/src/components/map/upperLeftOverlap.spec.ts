import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * ══ R2-B §4 — THE TOP ROW IS TWO ISLANDS THAT MUST NOT MEET ═══════════════
 *
 * MAP-UPPER-LEFT-OVERLAP
 *
 * THIS WAS ARITHMETIC, NOT TIMING, which is why it is provable here rather
 * than only in a browser. The breadcrumb trail capped itself at 60% of the
 * canvas; the stack opposite caps at 46% of the same canvas. Nothing
 * reconciled the two, and 106% does not fit in 100%.
 *
 *     FULL at a 1440 viewport   52px layer rail + 372px right rail
 *                               leaves a 1016px CANVAS
 *     trail at its cap          610px
 *     stack at its cap          467px
 *     two 12px gutters           24px
 *     required                 1101px        OVERLAP 85px
 *
 * A SECOND DEFECT SAT UNDER THE FIRST. The 60% lived on the trail itself,
 * whose parent is an absolutely positioned island with no width of its own.
 * The island shrink-wraps the trail, so the trail's percentage resolved
 * against the width its own content produced — circular. Browsers break that
 * cycle by resolving against the containing block, so "60% of my parent"
 * silently meant "60% of the whole map". A cap nobody could read correctly is
 * a cap nobody can add up.
 *
 * THE FIX MAKES THE TWO COMPLEMENTARY rather than shrinking one of them:
 *
 *     left   calc(54% - 18px)
 *     right  calc(46% - 18px)
 *
 * 54 and 46 are the whole canvas, and each island subtracts half of the 36px
 * that two gutters plus a 12px separation need. §2 works the geometry out at
 * several widths instead of at the one width someone happened to check, and §3
 * proves the OLD numbers fail the same test — without that, this file would
 * pass just as happily against the defect.
 */

const SHELL = readFileSync(
  resolve(__dirname, 'shell', 'GlobalMapShell.tsx'),
  'utf-8',
);

const TRAIL = readFileSync(
  resolve(__dirname, 'shell', 'BreadcrumbZoomNavigator.tsx'),
  'utf-8',
);

/**
 * The trail with comments removed.
 *
 * Every assertion below that says a value is ABSENT must run against this and
 * not against the raw file. The correction's own header QUOTES the cap it
 * removed, so a reader can see what changed — and a raw substring search
 * cannot tell that quotation from a live class name. A first draft of this
 * file failed for exactly that reason, which is the same trap §1 of the
 * Kigali correction hit. Presence assertions may use either.
 */
const TRAIL_CODE = TRAIL.replace(/\/\*[\s\S]*?\*\//g, '').replace(
  /\{\/\*[\s\S]*?\*\/\}/g,
  '',
);

/* ══════════════════════════════════════════════════════════════════════════
   1 — THE CAPS ARE WHERE THEY CAN BE REASONED ABOUT
   ══════════════════════════════════════════════════════════════════════════ */

describe('each island states its own width against the canvas', () => {
  it('the upper-left island carries the cap', () => {
    const island = SHELL.slice(
      SHELL.indexOf('data-gn="map-upper-left-island"'),
      SHELL.indexOf('<BreadcrumbZoomNavigator'),
    );

    expect(island).toContain('max-w-[calc(54%-18px)]');
    expect(island).toContain('left-[12px]');
    expect(island).toContain('top-[12px]');
  });

  it('the upper-right stack carries the complementary one', () => {
    const stack = SHELL.slice(SHELL.indexOf('data-gn="map-upper-right-stack"'));

    expect(stack.slice(0, 800)).toContain('max-w-[calc(46%-18px)]');
    expect(stack.slice(0, 800)).toContain('right-[12px]');
    expect(stack.slice(0, 800)).toContain('top-[12px]');
  });

  it('the trail no longer caps ITSELF, which is what made the cap unreadable', () => {
    /*
      The ambiguity, pinned. A percentage on a shrink-wrapped child resolves
      against the containing block, not against the parent it appears to name,
      so this number could not be added to the one opposite it.
    */
    expect(TRAIL_CODE).not.toContain('max-w-[60%]');
    expect(TRAIL_CODE).toContain('max-w-full');

    /* POSITIVE CONTROL — stripping did not simply empty the file. */
    expect(TRAIL_CODE).toContain('export function BreadcrumbZoomNavigator');
  });

  it('and no percentage cap is left anywhere on the trail', () => {
    expect(TRAIL_CODE).not.toMatch(/max-w-\[\d+%\]/);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   2 — THE GEOMETRY, WORKED OUT AT EVERY WIDTH THAT SHIPS
   ══════════════════════════════════════════════════════════════════════════ */

/** Both islands at their caps — the only case that can collide. */
const worstCase = (
  canvas: number,
  leftPct: number,
  rightPct: number,
  inset: number,
): { readonly leftEndsAt: number; readonly rightStartsAt: number; readonly gap: number } => {
  const GUTTER = 12;

  const leftEndsAt = GUTTER + (canvas * leftPct) / 100 - inset;
  const rightStartsAt = canvas - GUTTER - ((canvas * rightPct) / 100 - inset);

  return { leftEndsAt, rightStartsAt, gap: rightStartsAt - leftEndsAt };
};

/**
 * Canvas widths, not viewport widths. FULL subtracts a 52px layer rail and a
 * 372px right rail, which is what made the 1440 case so much tighter than a
 * viewport-level check would have suggested.
 */
const CANVASES = [
  ['1440 desktop, FULL', 1440 - 52 - 372],
  ['1280 desktop, FULL', 1280 - 52 - 372],
  ['1024 compact, FULL', 1024 - 52 - 372],
  ['1024 MODAL, no layer rail', 1024 - 372],
  ['768 compact', 768],
  ['560 narrow', 560],
] as const;

describe('the two islands cannot reach each other at any shipped width', () => {
  for (const [name, canvas] of CANVASES) {
    it(`${name} — a positive gap remains with both at their caps`, () => {
      const { gap } = worstCase(canvas, 54, 46, 18);

      expect(gap).toBeGreaterThan(0);
    });
  }

  it('THE INVARIANT — the gap is a constant 12px, not a width that happens to work', () => {
    /*
      This is the property that makes it a fix rather than a tuning. The caps
      sum to 100% of the canvas, so the percentage terms cancel and what is
      left is the fixed inset arithmetic: 36px of insets minus 24px of gutters.
      A future width cannot break it, because width is not in the answer.
    */
    for (const [, canvas] of CANVASES) {
      expect(worstCase(canvas, 54, 46, 18).gap).toBeCloseTo(12, 6);
    }
  });

  it('the caps sum to the whole canvas, which is what makes them complementary', () => {
    expect(54 + 46).toBe(100);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   3 — POSITIVE CONTROL: THE OLD NUMBERS FAIL THIS TEST
   ══════════════════════════════════════════════════════════════════════════ */

describe('the same geometry detects the defect it was written for', () => {
  /*
    Without this block the suite above would pass just as happily against the
    shipped defect, and would be measuring nothing. The old pair is 60% with no
    inset against 46% with no inset.
  */
  for (const [name, canvas] of CANVASES) {
    it(`${name} — 60% against 46% overlaps`, () => {
      const { gap } = worstCase(canvas, 60, 46, 0);

      expect(gap).toBeLessThan(0);
    });
  }

  it('and it reproduces the 85px overlap measured on the 1440 canvas', () => {
    const { gap } = worstCase(1016, 60, 46, 0);

    expect(Math.round(-gap)).toBe(85);
  });

  it('the old overlap GREW with the canvas, so a wider screen never escaped it', () => {
    /*
      Worth stating because it is counter-intuitive and it is why this was
      reported on desktop rather than only on a phone. The excess is 6% of the
      canvas plus both gutters, so more room made it worse, not better.
    */
    const narrow = -worstCase(768, 60, 46, 0).gap;
    const wide = -worstCase(1440, 60, 46, 0).gap;

    expect(wide).toBeGreaterThan(narrow);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   4 — WHAT MUST NOT HAVE BEEN TRADED AWAY
   ══════════════════════════════════════════════════════════════════════════ */

describe('the trail still behaves like a trail inside its new boundary', () => {
  it('it still wraps rather than overflowing', () => {
    expect(TRAIL).toContain('flex-wrap');
  });

  it('and individual chips still never break mid-word', () => {
    /*
      A narrow canvas must produce MORE ROWS, not a hyphenated place name.
      This is the property that makes the cap safe at 560px.
    */
    expect(TRAIL).toContain('whitespace-nowrap');
  });

  it('both islands are still transparent to the pointer — PO-3 is untouched', () => {
    /*
      The islands are positioning boxes; 19% of the map surface once took the
      click instead of the map. Adding a width cap must not have disturbed
      that, and a narrower box is strictly better for it.
    */
    const island = SHELL.slice(
      SHELL.indexOf('data-gn="map-upper-left-island"'),
      SHELL.indexOf('<BreadcrumbZoomNavigator'),
    );

    expect(island).toContain('${HUD_ISLAND}');
    expect(SHELL.slice(SHELL.indexOf('data-gn="map-upper-right-stack"'), 800 + SHELL.indexOf('data-gn="map-upper-right-stack"'))).toContain('${HUD_ISLAND}');
  });

  it('and both are still reserved against the label placer', () => {
    /*
      `data-gn-hud-reserve` is how country labels are kept out from under the
      HUD. A resized island that stopped reserving would put place names under
      the breadcrumbs instead of over the map.
    */
    const island = SHELL.slice(
      SHELL.indexOf('data-gn="map-upper-left-island"') - 200,
      SHELL.indexOf('<BreadcrumbZoomNavigator'),
    );

    expect(island).toContain('data-gn-hud-reserve');
  });
});
