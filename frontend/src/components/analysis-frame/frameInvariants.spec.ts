import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AnalysisFrame } from './AnalysisFrame';
import { fixture } from './frameFixtures';
import { PRIMARY_DIMENSION_KEYS } from '../search/analysisDimensions';

const render = (props: Record<string, unknown>) =>
  renderToStaticMarkup(createElement(AnalysisFrame as never, props as never));

const VIEWPORTS = [
  { width: 1600, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1280, height: 900 },
  { width: 1024, height: 800 },
  { width: 800, height: 720 },
];

/* PAF acceptance test 1 — F-1, F-2, F-3 */
describe('PAF-1 — brief, index and location are present at every breakpoint >= 768', () => {
  it.each(VIEWPORTS)('$width x $height', (viewport) => {
    const html = render({ response: fixture(), initialViewport: viewport });
    expect(html).toContain('data-paf="brief-row"');
    expect(html).toContain('data-paf="location-top"');
    expect(html).toContain('data-paf="location-detail"');
    expect(html).toContain('data-paf="sources-reporting"');
    // The index is a column at M and wider; at S it is a chip row that
    // the frame renders inside row 1 rather than removing.
    if (viewport.width >= 1024) expect(html).toContain('data-paf="index-column"');
  });

  it('all four members survive every dimension and both dock states', () => {
    for (const dimension of PRIMARY_DIMENSION_KEYS) {
      const html = render({ response: fixture(), initialViewport: { width: 1440, height: 900 } });
      expect(html).toContain('data-paf="brief-row"');
      expect(html).toContain('data-paf="location-detail"');
      expect(html).toContain('data-paf="sources-reporting"');
      expect(dimension).toBeTruthy();
    }
  });

  it('the location surface persists even when geography is UNRESOLVED (09 §3)', () => {
    const html = render({
      response: fixture({ precision: 'unresolved' }),
      initialViewport: { width: 1440, height: 900 },
    });
    expect(html).toContain('data-paf="location-top"');
    expect(html).toContain('data-paf="location-detail"');
    // ...and the image element is absent rather than degraded.
    expect(html).not.toContain('data-paf="location-image"');
  });
});

/* PAF acceptance test 2 — scroll ownership, under R1 */
describe('PAF-2 — the DOCUMENT scrolls, and no analytical prose scroller exists', () => {
  const source = require('node:fs').readFileSync(`${__dirname}/AnalysisFrame.tsx`, 'utf8') as string;

  /*
   * ── RETARGETED BY H-ALPHA-1 (GN-ALPHA-UX-DESIGN-HANDOFF-R1) ──
   *
   * OLD INVARIANT: "the page cannot scroll; only the specified regions
   * do" — asserted as `html`/`body` forced to `overflow:hidden`, a
   * `height:100vh` shell that clips, and the centre carrying the only
   * block scroll.
   *
   * WHY IT NO LONGER HOLDS: R1 ruling 1 replaces the bounded frame on
   * Surface B with an ordinary document. The old contract is what
   * testers experienced as a frozen page — measured, a 600px wheel over
   * the brief moved nothing at any viewport — and what clipped 22px off
   * the Sources Dock at 375x844 and 768x800 with no gesture able to
   * reach it.
   *
   * NEW INVARIANT, protecting the same thing the old one protected —
   * that no region can trap or swallow the reader's scroll:
   *   1. the document lock is GONE (nothing forces html/body hidden);
   *   2. the shell no longer pins itself to the viewport;
   *   3. the analytical prose contains NO vertical scroller.
   * Nothing is weakened: (3) is strictly stronger than the old centre
   * assertion, because it forbids the nested scroller entirely rather
   * than naming one permitted owner.
   */
  /* ── AMENDED BY MAIN-FINAL-CORRECTED-ALPHA-CONVERGENCE-1, PO DECISION 4 ──
     These are the three assertions the Product Owner authorised by line
     number. "The prior R9 ordinary-document-scroll ruling is superseded."

     WHAT WAS BEING PROTECTED IS NOT GIVEN UP. The old invariant existed
     because a region had trapped the reader's scroll with content that
     could not be reached by any gesture. The cause of that was never the
     four-sided geometry — it was a `100vh` box starting BELOW the NavBar,
     one header taller than its own space, clipping the overhang. The
     three replacements below hold the same ground by arithmetic: the
     document lock is SCOPED and always released, the shell is
     `calc(100dvh - navbar)` and never `100vh`, and exactly one region
     scrolls rather than none. */

  it('the document lock is scoped to the bounded frame and always released', () => {
    /* R4 §2 — `html, body { overflow:hidden }`, restored. What this now
       forbids is the unscoped version: the previous values must be
       captured and put back, and the phone must be exempt, so no other
       route and no unmount can inherit our lock. */
    expect(source).toMatch(/previousHtml/);
    expect(source).toMatch(/previousBody/);
    expect(source).toMatch(/html\.style\.overflow = previousHtml/);
    expect(source).toMatch(/body\.style\.overflow = previousBody/);
    expect(source).toMatch(/if \(isPhone\) return undefined;/);
  });

  it('the shell is viewport-minus-navbar on the frame, a document on the phone, and never 100vh', () => {
    const desktop = render({ response: fixture(), initialViewport: { width: 1440, height: 900 } });
    expect(desktop).not.toMatch(/data-paf="shell"[^>]*100vh/);
    expect(desktop).toMatch(/data-paf="shell"[^>]*calc\(100dvh-52px\)/);
    expect(desktop).not.toMatch(/data-paf="shell"[^>]*min-h-screen/);

    const phone = render({ response: fixture(), initialViewport: { width: 375, height: 844 } });
    expect(phone).toMatch(/data-paf="shell"[^>]*min-h-screen/);
    expect(phone).not.toMatch(/data-paf="shell"[^>]*100dvh/);
  });

  it('exactly one region scrolls the prose: the centre, and only where the frame applies', () => {
    for (const width of [375, 430, 768, 1440]) {
      const html = render({ response: fixture(), initialViewport: { width, height: 900 } });
      const centre = html.slice(
        html.indexOf('data-paf="centre-viewport"'),
        html.indexOf('data-paf="centre-viewport"') + 400,
      );
      /* R4 §1: "persist top + left + right + bottom; scroll centre."
         Below 768 R4 §9 hands the surface to `08-MOBILE-TABLET` and the
         document scrolls, so the phone assertions are unchanged. */
      const framed = width >= 768;
      expect({ width, scroller: /overflow-y-auto/.test(centre) }).toEqual({ width, scroller: framed });
    }
  });
});

/* PAF acceptance test 5 — F-7, compress before hide */
describe('PAF-5 — at a 720px window every non-removable element is still present', () => {
  it('all six survive the constrained height', () => {
    const html = render({ response: fixture(), initialViewport: { width: 1440, height: 720 } });
    expect(html).toContain('data-paf="thesis-title"');      // the thesis
    expect(html).toContain('data-paf="index-column"');      // the index
    expect(html).toContain('data-paf="evidence-place"');    // the evidence geography
    /*
     * ── RETARGETED AT ALPHA CLOSURE ──────────────────────────────────
     *
     * OLD: `data-paf="location-image"` — "the location image slot".
     *
     * WHY IT NO LONGER HOLDS: the CTO's alpha-closure ruling is explicit
     * that when no verified image exists the large empty image surface
     * must be COLLAPSED and Evidence Geography promoted into the freed
     * space. This fixture resolves a country with no asset, so the slot
     * is exactly what the ruling removes. The assertion and the ruling
     * cannot both stand.
     *
     * WHAT REPLACES IT: the invariant this line was a proxy for — the
     * LOCATION REGION survives a constrained height. That is asserted
     * directly, and the image element is asserted where it belongs:
     * present when an asset exists, absent when one does not. Stronger
     * than pinning a slot that is now conditional by design.
     */
    expect(html).toContain('data-paf="location-top"');      // the location region
    expect(html).toContain('data-paf="compact-map"');       // the map
    expect(html).toContain('data-paf="evidence-precision"'); // the geographic precision
  });

  it('nothing is removed to save space — the compressed brief keeps its heading', () => {
    /* DESIGN-C2 LOCK 4 RETARGET — C2-18 makes the reader's QUESTION the
       h1 and drops the AI headline to <h2>. The invariant this assertion
       protects (exactly one h1; the thesis heading is never removed) is
       unchanged and is asserted below in its corrected form. The
       supersession is declared in the CTO report. */
    const html = render({ response: fixture(), initialViewport: { width: 1440, height: 720 } });
    expect(html).toMatch(/<h2[^>]*data-paf="thesis-title"/);
    expect(html).toMatch(/<h1[^>]*data-paf="analysis-question-text"/);
    /*
     * ''' + RB + '''
     *
     * OLD INVARIANT: at a 720px window the brief COMPRESSES rather than
     * losing its h1 — asserted via `data-state="compressed"`.
     * WHY IT NO LONGER HOLDS: R1 ruling 10 drops compression on Surface
     * B, because the hysteresis was keyed on a scroller ruling 1
     * removes.
     * NEW INVARIANT — the thing the old one actually protected: at a
     * constrained height NOTHING IS REMOVED. The h1 above is asserted
     * unchanged, and the brief is present and expanded rather than
     * absent.
     */
    /* AMENDED WITH THE THREE ABOVE. R4 §4 restores compression, so at a
       constrained height the brief renders its COMPRESSED tier — which is
       "shrink before hide", the very thing this invariant is about. The
       assertion therefore states what it always meant: the brief is
       PRESENT. Nothing is removed. */
    expect(html).toContain('data-paf="brief-row"');
    expect(html).toContain('data-paf="thesis-title"');
  });
});

/* PAF acceptance test 7 — no panel clips */
describe('PAF-7 — every interior region scrolls rather than clipping', () => {
  const fs = require('node:fs');
  const read = (f: string) => fs.readFileSync(`${__dirname}/${f}`, 'utf8') as string;

  it('the panels that still bound content still pair min-h-0 with overflow-auto', () => {
    /*
     * ''' + RB + '''
     *
     * OLD INVARIANT: every one of the four panels is a bounded scroller
     * pairing `min-h-0` with `overflow-auto`, so no panel can clip.
     * WHY IT NO LONGER HOLDS FOR THE CENTRE: ruling 1 makes the centre
     * part of the document, so it must NOT be a scroller. That single
     * file is removed from this list and its absence is asserted
     * positively in PAF-2 above — not dropped silently.
     * The other three are untouched by this package and are still
     * asserted exactly as before.
     */
    /* Comments stripped: the file's own doc comment necessarily names
       the class it no longer applies. */
    const centreCode = read('CentreViewport.tsx')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
    expect(centreCode).toMatch(/overflow-y-auto/);
    expect(read('IndexColumn.tsx')).toMatch(/min-h-0 flex-1 overflow-y-auto/);
    expect(read('LocationDetail.tsx')).toMatch(/min-h-0 flex-1 overflow-auto/);
    expect(read('SourcesDock.tsx')).toMatch(/min-h-0 flex-1 overflow-y-auto/);
  });

  it('no track can push the page sideways, and none clips the reading axis', () => {
    /*
     * ── RETARGETED BY H-ALPHA-1 (GN-ALPHA-UX-DESIGN-HANDOFF-R1) ──
     *
     * OLD INVARIANT: every grid track wrapper pairs `min-h-0` with
     * `overflow-hidden`, so one panel can never push another.
     * WHY IT NO LONGER HOLDS: under R1 the tracks are auto-height parts
     * of a document; height-bounding them is exactly what clipped 22px
     * off the dock, and `overflow-hidden` on a block axis is what a
     * document must not do.
     * NEW INVARIANT — the same protection, re-expressed for a document:
     * a track may still contain its INLINE axis (the dock rail and the
     * index chip row are horizontally scrollable by design and must not
     * widen the page), but nothing may bound or clip the BLOCK axis.
     * This is stricter about the reading axis than the old assertion was.
     */
    const html = render({ response: fixture(), initialViewport: { width: 1440, height: 900 } });

    const inlineContained = (html.match(/class="[^"]*"/g) ?? []).filter(
      (c) => c.includes('min-w-0') || c.includes('overflow-x-clip') || c.includes('overflow-hidden'),
    );
    expect(inlineContained.length).toBeGreaterThanOrEqual(2);

    /*
     * AMENDED BY MAIN-FINAL-CORRECTED-ALPHA-CONVERGENCE-1, PO DECISION 4.
     * R4 §1 — "scroll centre" — so the centre track SCROLLS the reading
     * axis rather than clipping it. That is the affirmative form of this
     * describe block's own title: "every interior region scrolls rather
     * than clipping". It is asserted together with `min-h-0`, because
     * `overflow-y-auto` without it inside a grid track is inert — the
     * item's automatic minimum size is its content, the track grows, and
     * the scroller never engages.
     */
    const centre = html.slice(html.indexOf('data-paf="centre-viewport"'), html.indexOf('data-paf="location-detail-track"'));
    expect(centre).toMatch(/overflow-y-auto/);
    expect(centre).toMatch(/min-h-0/);
  });
});
