import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import type { AnalysisApiResponse, NewsArticle } from '@globalnews-ai/shared';
import { AnalysisFrameSurface } from './AnalysisFrameSurface';
import { fixture } from './frameFixtures';
import { resolveColumns } from './frameGeometry';
import { resolveSourceCardBand, resolveStrip } from './sourcesReportingGeometry';
import { getDictionary } from '@/lib/i18n/dictionaries';

/* ── RETARGETED BY H-ALPHA-1 (R1) ── OLD: fixed pixel grid rows `Npx minmax(0,1fr) Npx`, asserting that expanding the dock or changing the source count could only take from the centre. WHY IT CHANGED: R1 ruling 1 removes the fixed row template; the document sizes its own sections. NEW: the same protection, re-expressed — the row model is content-sized and the region ORDER and PRESENCE are unchanged, which is what 'the dock cannot consume the anchor' actually meant. */

/**
 * THE ANALYSIS WORKSPACE AT TRUE PHONE WIDTH.
 *
 * THE DEFECT. `resolveColumns()` has always reported `frameApplies:
 * false` below 768px with both track widths null. Nothing read the flag.
 * `AnalysisFrame` had two template branches for three states, so XS fell
 * into the desktop one and emitted the literal invalid declaration
 * `grid-template-columns: nullpx minmax(0,1fr) nullpx`. A browser
 * discards an invalid declaration but keeps the children's own
 * `grid-column` values, so it invented three implicit ~125px columns.
 * The reader was 125px wide and the title was clipped.
 *
 * WHY THE OLD SUITE MISSED IT, which is what this file is written
 * against. `r4Responsive.spec.ts` already rendered at 375. Its own header
 * says its assertions are "negative ones ... asserted as an absence", and
 * a 125px reading column satisfies every one of them: the centre is
 * present, the index is present, geography is present, the dock is
 * present, nothing overflows the page. Presence was never the question.
 *
 * So these assertions MEASURE. Widths, layout mode, scroll ownership and
 * the absence of the literal defect string — not whether an element
 * exists.
 */

const PHONES = [
  { name: '375x667 short phone', width: 375, height: 667 },
  { name: '375x844 phone', width: 375, height: 844 },
  { name: '414x896 large phone', width: 414, height: 896 },
  { name: '767 last XS width', width: 767, height: 800 },
] as const;

const DESKTOPS = [
  { name: '768 tablet (S)', width: 768, height: 800 },
  { name: '1024 (M_NARROW)', width: 1024, height: 800 },
  { name: '1440 (L)', width: 1440, height: 900 },
] as const;

const SOURCE = readFileSync(`${__dirname}/AnalysisFrame.tsx`, 'utf8');

/** Comments necessarily quote the defect they exist to explain. */
const code = (): string =>
  SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const withImages = (): AnalysisApiResponse => {
  const base = fixture({ countryName: 'Australia', countryCode: 'AUS', precision: 'country' });
  return {
    ...base,
    articles: base.articles.map(
      (a, i) => ({ ...a, imageUrl: `https://cdn.test/thumb-${i}.jpg` }) as NewsArticle,
    ),
  } as AnalysisApiResponse;
};

const render = (
  width: number,
  height: number,
  extra: Record<string, unknown> = {},
): string =>
  renderToStaticMarkup(
    createElement(AnalysisFrameSurface as never, {
      response: withImages(),
      initialViewport: { width, height },
      ...extra,
    } as never),
  );

/** The frame element's own opening tag. */
const frameTag = (html: string): string => {
  const i = html.indexOf('data-paf="frame"');
  return html.slice(html.lastIndexOf('<', i), html.indexOf('>', i) + 1);
};

/**
 * The open tag of the nearest ANCESTOR <div> of `marker` — found by
 * walking backwards and balancing `</div>` against `<div`, so sibling
 * markup between the ancestor and the marker cannot be mistaken for it.
 */
function enclosingDiv(html: string, marker: string): string {
  const at = html.indexOf(marker);
  let depth = 0;
  let i = at;
  while (i > 0) {
    const close = html.lastIndexOf('</div>', i);
    const open = html.lastIndexOf('<div', i);
    if (open < 0) break;
    if (close > open) {
      depth += 1;
      i = close - 1;
      continue;
    }
    if (depth === 0) return html.slice(open, html.indexOf('>', open) + 1);
    depth -= 1;
    i = open - 1;
  }
  return '';
}

describe('1 — the literal defect, pinned so it can never come back', () => {
  it.each(PHONES)('$name — the markup contains no "nullpx" anywhere', ({ width, height }) => {
    expect({ width, nullpx: render(width, height).includes('nullpx') })
      .toEqual({ width, nullpx: false });
  });

  it.each(PHONES)('$name — no "null" reaches ANY inline style', ({ width, height }) => {
    const styles = [...render(width, height).matchAll(/style="([^"]*)"/g)].map((m) => m[1]);
    expect({ width, offenders: styles.filter((s) => s.includes('null')) })
      .toEqual({ width, offenders: [] });
  });

  it.each(DESKTOPS)('$name — still no "nullpx", which was never the defect there', ({ width, height }) => {
    expect(render(width, height).includes('nullpx')).toBe(false);
  });
});

describe('2 — frameApplies is OBEYED, not merely computed', () => {
  it.each(PHONES)('$name — resolveColumns says the frame does not apply', ({ width }) => {
    expect(resolveColumns(width).frameApplies).toBe(false);
  });

  it.each(PHONES)('$name — and the frame renders the phone column, not a grid', ({ width, height }) => {
    const tag = frameTag(render(width, height));
    expect({ width, layout: /data-layout="phone-column"/.test(tag) })
      .toEqual({ width, layout: true });
    expect(tag).toContain('data-frame-applies="false"');
    /* No grid template of any kind is declared. */
    expect(tag).not.toMatch(/grid-template-columns/);
    expect(tag).not.toMatch(/grid-template-rows/);
  });

  it.each(DESKTOPS)('$name — the grid is untouched above the breakpoint', ({ width, height }) => {
    const tag = frameTag(render(width, height));
    expect({ width, layout: /data-layout="grid"/.test(tag) }).toEqual({ width, layout: true });
    expect(tag).toContain('data-frame-applies="true"');
    expect(tag).toMatch(/grid-template-columns:[^;"]+/);
  });

  it('the breakpoint is exactly 768 — 767 is a phone, 768 is not', () => {
    expect(/data-layout="phone-column"/.test(render(767, 800))).toBe(true);
    expect(/data-layout="phone-column"/.test(render(768, 800))).toBe(false);
  });
});

describe('3 — no implicit three-column recovery: the children stop asking for columns', () => {
  it.each(PHONES)('$name — no child declares grid-column or grid-row', ({ width, height }) => {
    const styles = [...render(width, height).matchAll(/style="([^"]*)"/g)].map((m) => m[1]);
    const placed = styles.filter((s) => /grid-column|grid-row/.test(s));
    expect({ width, placed }).toEqual({ width, placed: [] });
  });

  it.each(DESKTOPS)('$name — the children still declare their tracks', ({ width, height }) => {
    const styles = [...render(width, height).matchAll(/style="([^"]*)"/g)].map((m) => m[1]);
    expect(styles.filter((s) => /grid-column/.test(s)).length).toBeGreaterThan(2);
  });
});

describe('4 — the title wraps instead of truncating', () => {
  it.each(PHONES)('$name — the brief renders its FULL tier, whatever the height', ({ width, height }) => {
    const html = render(width, height);
    expect({ width, height, state: /data-paf="brief-row" data-state="expanded"/.test(html) })
      .toEqual({ width, height, state: true });
  });

  it.each(PHONES)('$name — the thesis title carries no truncating class', ({ width, height }) => {
    const html = render(width, height);
    const i = html.indexOf('data-paf="thesis-title"');
    const tag = html.slice(html.lastIndexOf('<', i), html.indexOf('>', i) + 1);
    expect({ width, truncate: /\btruncate\b/.test(tag) }).toEqual({ width, truncate: false });
  });

  it('375x844 would have been COMPRESSED under the old rule — the height cause is real', () => {
    /* frameHeightFor(844) = 796 < COMPRESSED_FRAME_HEIGHT (852). Every
       ordinary phone met the compression condition, which is why the
       title truncated. The phone branch is what overrides it. */
    expect(844 - 48).toBeLessThan(852);
/* ── AMENDED BY MAIN-FINAL-CORRECTED-ALPHA-CONVERGENCE-1, PO DECISION 4 ──
   "The prior R9 ordinary-document-scroll ruling is superseded." The
   four-sided frame of `12-FOUR-SIDED-FRAME-GEOMETRY` is restored on
   `calc(100dvh - navbar)`. The PHONE column is untouched: R4 §9 hands
   widths below 768 to `08-MOBILE-TABLET`, so every phone assertion in
   this file still asserts exactly what it asserted before. */
    /* R4 §4 restores compression, and the DESKTOP is where the height
       cause is real: 844 less the 52px NavBar less the 48px command bar
       is a 744px frame, below the 852px threshold, so 1440x844 opens
       COMPRESSED exactly as §3.3 says it should.

       The phone line below is the one that matters to this describe
       block and it is UNCHANGED — the headline still wraps rather than
       truncating at 375, because the phone is exempt from compression by
       `columns.frameApplies`, not by compression having been deleted. */
    expect(render(1440, 844)).not.toContain('data-paf="brief-row" data-state="expanded"');
    expect(render(375, 844)).toContain('data-state="expanded"');
  });

  it('BriefRow itself was not modified — only which tier the frame asks for', () => {
    const brief = readFileSync(`${__dirname}/BriefRow.tsx`, 'utf8');
    expect(brief).toMatch(/min-w-\[32ch\] shrink truncate/);
    expect(code()).toMatch(/compressed=\{isPhone \? false : compressed\}/);
  });
});

describe('5 — the mobile index and the Complete Record stay reachable', () => {
  it.each(PHONES)('$name — the mobile chip row renders, not the desktop column', ({ width, height }) => {
    const html = render(width, height);
    expect(html).toContain('data-paf="index-column"');
    /*
     * Asserted on ARIA rather than on a Tailwind class string. The
     * mobile variant is a horizontal tablist and the desktop one is
     * vertical - a real semantic difference a screen reader can observe,
     * and one that cannot be satisfied by the desktop column drifting
     * into the phone branch.
     */
    expect({ width, orientation: html.includes('aria-orientation="horizontal"') })
      .toEqual({ width, orientation: true });
    expect({ width, vertical: html.includes('aria-orientation="vertical"') })
      .toEqual({ width, vertical: false });
  });

  it.each(PHONES)('$name — exactly ONE index is rendered, never both variants', ({ width, height }) => {
    const html = render(width, height);
    expect((html.match(/data-paf="index-column"/g) ?? []).length).toBe(1);
  });

  it.each(PHONES)('$name — Complete Record is reachable', ({ width, height }) => {
    expect(render(width, height)).toContain('data-paf="complete-record-entry"');
  });

  it('IndexColumn itself was not modified', () => {
    const idx = readFileSync(`${__dirname}/IndexColumn.tsx`, 'utf8');
    expect(idx).toMatch(/variant\?: 'desktop' \| 'mobile'/);
    expect(idx).toMatch(/\[&>div\]:!flex/);
  });
});

describe('6 — Evidence Geography leaves the rail and keeps every semantic', () => {
  it.each(PHONES)('$name — the geography track carries no side-rail border', ({ width, height }) => {
    const html = render(width, height);
    const i = html.indexOf('data-paf="location-detail-track"');
    const tag = html.slice(html.lastIndexOf('<', i), html.indexOf('>', i) + 1);
    expect({ width, sideRail: /border-l/.test(tag) }).toEqual({ width, sideRail: false });
  });

  it.each(PHONES)('$name — it is NOT a flex column, so its content cannot collapse', ({ width, height }) => {
    /*
     * This is the regression this assertion exists for, and only a
     * screenshot found it the first time. `LocationDetail`'s own root is
     * `min-h-0 flex-1 overflow-auto`. Inside an auto-height FLEX column
     * that resolves to `flex: 1 1 0%`, so the section collapsed to an
     * 81px sliver with the map gone — while every width measurement
     * still said "full width, present".
     */
    const html = render(width, height);
    const i = html.indexOf('data-paf="location-detail-track"');
    const tag = html.slice(html.lastIndexOf('<', i), html.indexOf('>', i) + 1);
    expect({ width, flexColumn: /\bflex-col\b/.test(tag) }).toEqual({ width, flexColumn: false });
  });

  it.each(PHONES)('$name — geography renders after the reader and before the dock', ({ width, height }) => {
    const html = render(width, height);
    const brief = html.indexOf('data-paf="brief-row"');
    const index = html.indexOf('data-paf="index-column"');
    const centre = html.indexOf('data-paf="centre-viewport"');
    const geo = html.indexOf('data-paf="location-detail-track"');
    const dock = html.indexOf('data-paf="sources-reporting"');
    expect({ width, order: brief < index && index < centre && centre < geo && geo < dock })
      .toEqual({ width, order: true });
  });

  it.each(PHONES)('$name — precision semantics are unchanged', ({ width, height }) => {
    const html = render(width, height);
    const t = getDictionary('en').analysisFrame;
    expect(html).toContain('data-paf="evidence-place"');
    /* Country precision is still stated as country precision. */
    expect(html).toContain(t.mapCountryLevel);
    /* RULING 1 still holds: no report-count basis anywhere. */
    expect(html).not.toMatch(/\b\d+\s+OF\s+\d+\b/i);
  });

  it('an UNRESOLVED geography is still labelled honestly on a phone', () => {
    const html = renderToStaticMarkup(
      createElement(AnalysisFrameSurface as never, {
        response: fixture({ precision: 'unresolved' }),
        initialViewport: { width: 375, height: 844 },
      } as never),
    );
    expect(html).toContain('data-paf="location-detail-track"');
    expect(html).toMatch(/data-paf="evidence-place"/);
  });
});

describe('7 — the Sources Dock is a pinned footer and keeps its imagery', () => {
  it.each(PHONES)('$name — exactly one dock, outside the scrolling column', ({ width, height }) => {
    const html = render(width, height);
    expect((html.match(/data-paf="dock-track"/g) ?? []).length).toBe(1);
    expect((html.match(/data-paf="sources-reporting"/g) ?? []).length).toBe(1);
    /* The scroller closes before the dock opens. */
    const scroller = html.indexOf('data-paf="frame"');
    const geo = html.indexOf('data-paf="location-detail-track"');
    const dockTrack = html.indexOf('data-paf="dock-track"');
    expect({ width, after: scroller < geo && geo < dockTrack })
      .toEqual({ width, after: true });
  });

  it.each(PHONES)('$name — the dock is a section of the document, not a pinned track', ({ width, height }) => {
    /* ── RETARGETED BY H-ALPHA-1 (R1) ── OLD: the dock track carries the pixel height
       `frameGeometry` hands it. WHY IT CHANGED: R1 ruling 1 removes the
       fixed row model; ruling 11 keeps the dock horizontal but it is now
       an ordinary last section. NEW: the invariant that mattered — the
       dock is present, full width, compact by default, and its inline
       axis is contained so its rail cannot widen the page. */
    /* ── RETARGETED AGAIN AT H-ALPHA-VISUAL-1 ITEM A ── The invariant is
       untouched: the sources region is present, full width, unpinned, and
       its inline axis is contained so it cannot widen the page. What
       changed is only which element fills the region — `dock-compact`
       (a 236x74 card rail) became `sources-reporting-track` (the image-led
       track). Asserting the OLD marker would now assert that the rejected
       presentation is still on the reading path. */
    const html = render(width, height);
    const i = html.indexOf('data-paf="dock-track"');
    const tag = html.slice(html.lastIndexOf('<', i), html.indexOf('>', i) + 1);
    expect(tag).not.toMatch(/height:\d+px/);
    expect(tag).toMatch(/min-w-0/);
    expect(html).toContain('data-paf="sources-reporting-track"');
    /* The rejected miniature tier must not survive anywhere on this path. */
    expect(html).not.toContain('data-paf="dock-compact"');
  });

  it.each(PHONES)('$name — the integrated thumbnails still render, one per source', ({ width, height }) => {
    /* ── RETARGETED AGAIN AT H-ALPHA-VISUAL-1 ITEM A ── The invariant is
       the imagery contract, and it is unchanged and now stronger: one
       image slot per source, the real URL reaches the reader, the striped
       fallback exists, the error handler is wired, and no stock
       photograph is substituted. The slot is no longer a 48px thumbnail
       — R3 forbids a miniature tier — so it is counted on the image FRAME
       that replaced it. */
    const html = render(width, height);
    const frames = html.match(/data-paf="source-image-frame"/g) ?? [];
    expect({ width, frames: frames.length }).toEqual({ width, frames: 5 });
    expect(html).toContain('https://cdn.test/thumb-0.jpg');
    expect(html).toMatch(/repeating-linear-gradient/);
    /* Comments stripped: the source names the stock photograph in prose
       precisely to record that it is NOT used, and matching that prose
       instead of the code is a trap this lane has paid for before. */
    const section = readFileSync(`${__dirname}/SourcesReporting.tsx`, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
    expect(section).toMatch(/onError=\{hideFailedArticleImage\}/);
    expect(section).not.toContain('/images/article-placeholder.jpg');
  });

  it.each(PHONES)('$name — exactly one card is fully visible, with the next peeking', ({ width, height }) => {
    /* ── RETARGETED AT H-ALPHA-VISUAL-1 ITEM A ── OLD: "the dock is
       compact by default", which was the miniature tier R3 rejects. NEW:
       the phone band's own R3 promise, asserted on the geometry that
       produces it rather than on a class string. */
    const html = render(width, height);
    expect(html).toContain('data-paf="sources-reporting-track"');
    const band = resolveSourceCardBand(width);
    /* DESIGN-C2 LOCK 1/2 — the peek is no longer a band constant; it is
       solved from the lane so it lands inside Lock 2's 12-48px window. */
    const strip = resolveStrip(width - 16, width, 12);
    expect({ width, visible: band.visible, peek: strip.peek >= 12 && strip.peek <= 48 }).toEqual({
      width,
      visible: 1,
      peek: true,
    });
  });
});

describe('8 — one reading scroll, and no nested trap', () => {
  it.each(PHONES)('$name — the DOCUMENT is the scroller, not the column', ({ width, height }) => {
    /* ── RETARGETED BY H-ALPHA-1 (R1) ── OLD: the phone column owned the vertical scroll —
       my own SS6 option-A repair. WHY IT CHANGED: R1 ruling 1 supersedes
       that half; the page scrolls. NEW: the column declares no scroller
       of its own, which is the stronger statement. */
    const tag = frameTag(render(width, height));
    expect({ width, scrolls: /overflow-y-auto/.test(tag) }).toEqual({ width, scrolls: false });
  });

  it.each(PHONES)('$name — nothing constrains the reader, so it cannot trap a gesture', ({ width, height }) => {
    /*
     * `CentreViewport` keeps its own `overflow-y-auto` — it is not
     * modified — but on a phone nothing gives it a bounded height, so it
     * grows to its content and has nothing to scroll. The wrapper is the
     * proof: it must not impose `flex-1`, `min-h-0` or a height.
     */
    /* ── LOCATOR CORRECTED AT H-C2 ── The invariant is unchanged: the
       element that ENCLOSES the centre viewport must not impose a bounded
       height. The old locator took "the last <div before the centre",
       which is only the enclosing element when nothing else sits between
       — and once the Complete Record control grew a `flex-1` label span,
       that sibling became the match and the test reported a bound that
       does not exist. It now finds the nearest UNCLOSED <div, which is
       the enclosing element by definition. */
    const html = render(width, height);
    expect({ width, bounded: /flex-1|min-h-0|height:/.test(enclosingDiv(html, 'data-paf="centre-viewport"')) })
      .toEqual({ width, bounded: false });
  });

  it.each(DESKTOPS)('$name — desktop is the bounded frame, and the CENTRE is its scroller', ({ width, height }) => {
    /* ── AMENDED BY MAIN-FINAL-CORRECTED-ALPHA-CONVERGENCE-1, PO DECISION 4 ──
   "The prior R9 ordinary-document-scroll ruling is superseded." The
   four-sided frame of `12-FOUR-SIDED-FRAME-GEOMETRY` is restored on
   `calc(100dvh - navbar)`. The PHONE column is untouched: R4 §9 hands
   widths below 768 to `08-MOBILE-TABLET`, so every phone assertion in
   this file still asserts exactly what it asserted before. */
    /* The protection is unchanged in substance: no region may trap a
       gesture. Under the document model that was expressed as "nothing
       scrolls but the page"; under R4 §1 it is expressed as "exactly one
       region scrolls, and it is the reading surface". The second is the
       stronger statement, because it also forbids a SECOND scroller
       appearing beside the centre. */
    const html = render(width, height);
    const i = html.indexOf('data-paf="centre-viewport"');
    const tag = html.slice(html.lastIndexOf('<', i), html.indexOf('>', i) + 1);
    expect({ width, scrolls: /overflow-y-auto/.test(tag) }).toEqual({ width, scrolls: true });
    expect(frameTag(html)).not.toMatch(/overflow-y-auto/);
  });

  it('the phone is a document; the desktop is viewport-minus-navbar and never 100vh', () => {
    /* ── AMENDED BY MAIN-FINAL-CORRECTED-ALPHA-CONVERGENCE-1, PO DECISION 4 ──
   "The prior R9 ordinary-document-scroll ruling is superseded." The
   four-sided frame of `12-FOUR-SIDED-FRAME-GEOMETRY` is restored on
   `calc(100dvh - navbar)`. The PHONE column is untouched: R4 §9 hands
   widths below 768 to `08-MOBILE-TABLET`, so every phone assertion in
   this file still asserts exactly what it asserted before. */
    /* WHAT THIS STILL FORBIDS, AND IT IS THE IMPORTANT HALF: the shell is
       never `height:100vh`. That — not the four-sided geometry — is what
       made the box one header taller than its space and clipped 22px off
       the dock with no gesture able to reach it. The replacement is
       asserted positively, so an accidental return to `100vh` fails here
       exactly as it would have before. */
    for (const { width, height } of [...PHONES, ...DESKTOPS]) {
      const html = render(width, height);
      expect({ width, pinned: /data-paf="shell"[^>]*100vh/.test(html) })
        .toEqual({ width, pinned: false });
      const isPhone = width < 768;
      expect({ width, doc: /data-paf="shell"[^>]*min-h-screen/.test(html) })
        .toEqual({ width, doc: isPhone });
      expect({ width, framed: /data-paf="shell"[^>]*calc\(100dvh-52px\)/.test(html) })
        .toEqual({ width, framed: !isPhone });
    }
  });
});

describe('9 — EN and PL both render every phone region', () => {
  it.each(['en', 'pl'] as const)('%s — all five regions present at 375', (language) => {
    const html = render(375, 844, { language });
    for (const marker of [
      'data-paf="brief-row"',
      'data-paf="index-column"',
      'data-paf="centre-viewport"',
      'data-paf="location-detail-track"',
      'data-paf="sources-reporting"',
      'data-paf="complete-record-entry"',
    ]) {
      expect({ language, marker, present: html.includes(marker) })
        .toEqual({ language, marker, present: true });
    }
  });

  it('the two languages differ on a phone — no untranslated fallthrough', () => {
    expect(render(375, 844, { language: 'en' })).not.toBe(render(375, 844, { language: 'pl' }));
  });

  it('Seen / Zauważono survives in the phone dock', () => {
    const observed = () => {
      const base = withImages();
      return {
        ...base,
        articles: base.articles.map((a) => ({ ...a, publishedAtBasis: 'observed' }) as NewsArticle),
      } as AnalysisApiResponse;
    };
    const at = (language: 'en' | 'pl') =>
      renderToStaticMarkup(
        createElement(AnalysisFrameSurface as never, {
          response: observed(), language, initialViewport: { width: 375, height: 844 },
        } as never),
      );
    expect(/\bSEEN\b/i.test(at('en'))).toBe(true);
    expect(/ZAUWA/i.test(at('pl'))).toBe(true);
  });
});

describe('10 — the layouts that already passed are byte-identical', () => {
  it.each(DESKTOPS)('$name — the grid template is exactly what it was', ({ width, height }) => {
    const expected: Record<number, string> = {
      768: 'grid-template-columns:minmax(0,1fr) 268px',
      1024: 'grid-template-columns:212px minmax(0,1fr) 252px',
      1440: 'grid-template-columns:260px minmax(0,1fr) 296px',
    };
    expect(frameTag(render(width, height))).toContain(expected[width]);
  });

  it.each(DESKTOPS)('$name — the row model is R4 §2: pixel · 1fr · pixel', ({ width, height }) => {
    /* ── AMENDED BY MAIN-FINAL-CORRECTED-ALPHA-CONVERGENCE-1, PO DECISION 4 ──
   "The prior R9 ordinary-document-scroll ruling is superseded." The
   four-sided frame of `12-FOUR-SIDED-FRAME-GEOMETRY` is restored on
   `calc(100dvh - navbar)`. The PHONE column is untouched: R4 §9 hands
   widths below 768 to `08-MOBILE-TABLET`, so every phone assertion in
   this file still asserts exactly what it asserted before. */
    /* The COLUMN template above is genuinely untouched and still asserted
       byte-for-byte. Only the ROW model moves, and it moves back to the
       one `12-FOUR-SIDED-FRAME-GEOMETRY` §2 specifies: rows 1 and 3 are
       explicit pixel tracks and row 2 is `minmax(0,1fr)`, which is what
       makes "expanding the dock reduces the centre" fall out of the
       layout instead of being computed. */
    expect(frameTag(render(width, height)))
      .toMatch(/grid-template-rows:\d+px minmax\(0,1fr\) \d+px/);
  });

  it('frameGeometry.ts was not modified', () => {
    const g = readFileSync(`${__dirname}/frameGeometry.ts`, 'utf8');
    expect(g).toMatch(/DOCK_COMPACT_NORMAL = 168/);
    expect(g).toMatch(/DOCK_COMPACT_COMPRESSED = 128/);
    expect(g).toMatch(/COMPRESSED_FRAME_HEIGHT = 852/);
    expect(g).toMatch(/frameApplies: false/);
  });
});

describe('11 — no page-level overflow in either axis', () => {
  it.each([...PHONES, ...DESKTOPS])('$name — nothing widens the page', ({ width, height }) => {
    /* ── RETARGETED BY H-ALPHA-1 (R1) ── OLD: the shell clipped everything. NEW: the shell
       must NOT clip (it is a document), so inline containment moves to
       the two tracks that hold horizontally scrollable content — the
       dock rail and the index chip row. Measured in Chromium: page
       scrollWidth equals the viewport at 375, 430, 768 and 1440, in EN
       and PL. */
    const html = render(width, height);
    expect(html).not.toMatch(/data-paf="shell"[^>]*overflow-x-auto/);
    expect(html).toMatch(/data-paf="dock-track"[^>]*min-w-0/);
    /* The chip-row clip only renders where the chip row does — at XS and
       at S. Above that the index is a fixed column and cannot widen
       anything, so the assertion is scoped to where the risk exists. */
    if (width < 1024) expect(html).toMatch(/overflow-x-clip/);
  });

  it.each(PHONES)('$name — the phone column contains the inline axis without creating a scroller', ({ width, height }) => {
    /* ── RETARGETED BY H-ALPHA-1 (R1) ── `overflow-x-hidden` computes the OTHER axis to
       `auto`, which would manufacture the nested vertical scroller
       ruling 1 forbids. `min-w-0` contains the inline axis and leaves the
       block axis alone. */
    const tag = frameTag(render(width, height));
    expect(tag).toMatch(/min-w-0/);
    expect(tag).not.toMatch(/overflow-x-hidden/);
  });
});

describe('12 — MUTATION CONTROL: reverting the XS branch must fail this suite', () => {
  it('the branch is keyed on the geometry flag, not on a magic number', () => {
    expect(code()).toMatch(/const isPhone = !columns\.frameApplies;/);
    expect(code()).not.toMatch(/viewport\.width < 768/);
  });

  it('the template is only built for the grid layout', () => {
    expect(code()).toMatch(/isPhone[\s\S]{0,200}gridTemplateColumns/);
  });

  it('the guard is not vacuous — the desktop path still produces a real template', () => {
    /* Without this, every phone assertion could be satisfied by a frame
       that had simply stopped laying anything out at all. */
    expect(frameTag(render(1440, 900))).toMatch(/grid-template-columns:260px/);
    expect(frameTag(render(375, 844))).not.toMatch(/grid-template-columns/);
  });
});
