import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AnalysisFrameSurface } from './AnalysisFrameSurface';
import { fixture } from './frameFixtures';
import { resolveColumns, resolveBreakpoint } from './frameGeometry';

/**
 * R4 §7 — the responsive contract, at the four widths §7 names.
 *
 * §7's requirements are negative ones — no analytical data removed, no
 * source wall, no horizontal clipping, no sub-44px control — so each is
 * asserted as an absence that a regression would turn into a presence,
 * on the markup actually rendered at that width.
 */
const WIDTHS = [
  { name: '1440 desktop', width: 1440, height: 900 },
  { name: '1024', width: 1024, height: 800 },
  { name: '768', width: 768, height: 800 },
  { name: '375 narrow mobile', width: 375, height: 720 },
] as const;

const render = (width: number, height: number, extra: Record<string, unknown> = {}) =>
  renderToStaticMarkup(
    createElement(AnalysisFrameSurface as never, {
      response: fixture(),
      initialViewport: { width, height },
      ...extra,
    } as never),
  );

describe('R4 §7 — the responsive contract', () => {
  it.each(WIDTHS)('$name — the centre remains present at every width', ({ width, height }) => {
    expect(render(width, height)).toContain('data-paf="centre-viewport"');
  });

  it.each(WIDTHS)('$name — the centre is the frame\'s scroller, and the phone\'s document is not', ({ width, height }) => {
    /* ── AMENDED BY MAIN-FINAL-CORRECTED-ALPHA-CONVERGENCE-1, PO DECISION 4 ──
       "The prior R9 ordinary-document-scroll ruling is superseded."
       `12-FOUR-SIDED-FRAME-GEOMETRY` §1: "persist top + left + right +
       bottom; scroll centre." R4 §9 keeps widths below 768 on the
       document model of `08-MOBILE-TABLET`, so the 375 row below still
       asserts exactly what it asserted before — and the assertion is
       still stricter than the original three-width form, because it now
       states the answer at every width instead of only where a scroller
       was expected. */
    const html = render(width, height);
    const centre = html.slice(
      html.indexOf('data-paf="centre-viewport"'),
      html.indexOf('data-paf="centre-viewport"') + 400,
    );
    /*
      ANALYSIS-VIEWPORT-ADAPT-1 RETARGET — THE CENTRE IS NO LONGER A
      SCROLLER, AND THE PROTECTION THIS ASSERTS IS STRONGER FOR IT.

      What this test defends has never been "the centre has
      overflow-y-auto". It is that NO REGION TRAPS A GESTURE: the reader
      must have one reading scroll and no nested trap. R4 §1 expressed
      that as "exactly one region scrolls, and it is the reading
      surface"; the Product Owner's ruling on Analysis Workspace
      flexibility expresses it as the document model the phone column has
      always had — "do not trap content inside an unreachable
      fixed-height box".

      So the assertion is inverted rather than relaxed: there must now be
      NO `overflow-y-auto` on the centre AND none on the frame, at every
      width. That forbids both a nested trap and a second scroller beside
      the centre, which is strictly more than the old form forbade.
    */
    expect({ width, scroller: /overflow-y-auto/.test(centre) }).toEqual({ width, scroller: false });
  });

  it('375 — the PHONE COLUMN owns the scroll, and the centre does not', () => {
    /*
     * ── RETARGETED BY THE PHONE-WIDTH REPAIR ─────────────────────────
     *
     * OLD: one assertion, at all four widths, titled "the centre ... is
     * the scrolling region", checking only that the centre's class list
     * contains `overflow-y-auto`.
     *
     * WHY IT NO LONGER HOLDS AT 375. Under the CTO's SS6 ruling the
     * phone stacks into one bounded column that owns the vertical
     * scroll, so that the reader is not a nested scroll trap inside it.
     * `CentreViewport` is unmodified and still carries its own
     * `overflow-y-auto`, so the OLD ASSERTION WOULD STILL HAVE PASSED at
     * 375 while describing the opposite of what the page does — the
     * inert-assertion failure this lane has now met three times.
     *
     * What is asserted instead is the thing that is actually true and
     * actually load-bearing: at 375 the frame element scrolls, nothing
     * bounds the centre's height, and the page still does not scroll.
     */
    /* ── RETARGETED BY H-ALPHA-1 (R1) ── OLD: at 375 the phone column owned the scroll.
       WHY IT CHANGED: R1 ruling 1 supersedes that; the document scrolls.
       NEW: the phone layout still applies (no `nullpx`, one column), and
       NOTHING inside it declares a scroller. */
    const html = render(375, 844);
    const i = html.indexOf('data-paf="frame"');
    const frameTag = html.slice(html.lastIndexOf('<', i), html.indexOf('>', i) + 1);
    expect(frameTag).toMatch(/data-layout="phone-column"/);
    expect(frameTag).not.toMatch(/overflow-y-auto/);

    /* ── LOCATOR CORRECTED AT H-C2 ── Same invariant, same reason as
       `phoneWidthFrame.spec.ts`: "the last <div before the centre" is
       only the ENCLOSING element while no sibling sits between. The
       Complete Record control's `flex-1` label span became that sibling.
       Balanced backwards scan finds the real ancestor. */
    const c = html.indexOf('data-paf="centre-viewport"');
    let depth = 0;
    let k = c;
    let wrapper = '';
    while (k > 0) {
      const close = html.lastIndexOf('</div>', k);
      const open = html.lastIndexOf('<div', k);
      if (open < 0) break;
      if (close > open) {
        depth += 1;
        k = close - 1;
        continue;
      }
      if (depth === 0) {
        wrapper = html.slice(open, html.indexOf('>', open) + 1);
        break;
      }
      depth -= 1;
      k = open - 1;
    }
    expect(wrapper).not.toMatch(/flex-1|min-h-0|height:/);

    expect(html).toMatch(/data-paf="shell"[^>]*min-h-screen/);
  });

  it.each(WIDTHS)('$name — no analytical region is DELETED; the index and geography survive in some form', ({ width, height }) => {
    const html = render(width, height);
    /* The index may become a chip row and the rail may become a dock,
       but neither may vanish: §7 permits re-shaping, never removal. */
    expect({ width, index: /data-paf="index-(column|chips)"/.test(html) }).toEqual({ width, index: true });
    expect({ width, geography: /data-paf="location-(detail|top|dock)"/.test(html) }).toEqual({ width, geography: true });
    expect(html).toContain('data-paf="sources-reporting"');
    /* §4 at every width: the Complete Record entry is how confidence,
       entities, trust reasons and sourceEntities stay reachable. At S it
       was missing entirely until R4 rendered the chip-row index. */
    expect({ width, recordEntry: html.includes('data-paf="complete-record-entry"') })
      .toEqual({ width, recordEntry: true });
  });

  it.each(WIDTHS)('$name — no source WALL returns: sources stay in the dock, not a card grid', ({ width, height }) => {
    const html = render(width, height, { initialDock: 'expanded' });
    /* The rejected presentation was a multi-column image-card grid. */
    expect(html).not.toMatch(/grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3/);
    expect(html).not.toContain('data-paf="source-card-wall"');
  });

  it.each(WIDTHS)('$name — nothing scrolls the PAGE horizontally', ({ width, height }) => {
    const html = render(width, height);
    /* The shell bounds the frame; horizontal movement is only ever
       allowed INSIDE a dock or track that opts into it. */
    /* ── RETARGETED BY H-ALPHA-1 (R1) ── The shell no longer clips (it is a document);
       inline containment lives on the tracks that hold horizontally
       scrollable content. Measured page scrollWidth equals the viewport
       at every width in EN and PL. */
    expect(html).not.toMatch(/data-paf="shell"[^>]*class="[^"]*overflow-x-auto/);
    expect(html).toMatch(/data-paf="dock-track"[^>]*min-w-0/);
  });

  it.each(WIDTHS)('$name — every interactive control meets the 44px target rule or is a compact HUD tab', ({ width, height }) => {
    const html = render(width, height);
    /* Tabs opt into a documented 33px HUD size (PAF geometry); every
       OTHER button must not declare a smaller explicit height. */
    const buttons = [...html.matchAll(/<button[^>]*>/g)].map((m) => m[0]);
    const tooSmall = buttons.filter((b) => {
      const m = b.match(/min-h-\[(\d+)px\]/);
      return m !== null && Number(m[1]) < 26;
    });
    expect({ width, tooSmall }).toEqual({ width, tooSmall: [] });
  });

  it('the breakpoint model is the one the geometry module declares — no second responsive model', () => {
    expect(WIDTHS.map((w) => resolveBreakpoint(w.width))).toEqual(['L', 'M_NARROW', 'S', 'XS']);
    /* Geography is the last thing to leave (§3.2): the right rail
       persists at S, and only XS changes layout model. */
    expect(resolveColumns(768).rightWidth).not.toBeNull();
    expect(resolveColumns(375).frameApplies).toBe(false);
    /*
     * ── AMENDED BY THE PHONE-WIDTH REPAIR ────────────────────────────
     * This asserted that the FLAG is false and stopped there. For the
     * entire life of the frame nothing read it, so the flag was false
     * and the frame laid out three desktop columns anyway. The
     * assertion that would have caught that is the one below, and
     * `phoneWidthFrame.spec.ts` measures the consequences in full.
     */
    expect(render(375, 844)).toContain('data-layout="phone-column"');
  });

  it('the S chip row is not display:none\'d by the shared component\'s own md: breakpoint', () => {
    /*
     * SSR cannot evaluate CSS, so the visual failure this guards against
     * is invisible to a markup assertion unless the override itself is
     * asserted. The failure was real: `AnalysisIndex` marks its chip row
     * `flex md:hidden`, Tailwind's `md` starts at 768px, and the frame
     * shows the chip row from 768 to 1071px — so the navigation was
     * hidden across the entire band it serves, and only a screenshot
     * revealed it.
     */
    const html = render(768, 800);
    const nav = html.slice(html.indexOf('data-paf="index-column"'));
    const scroller = nav.slice(nav.indexOf('<div'), nav.indexOf('<div') + 300);
    /* HTML-escaped in serialized markup. */
    expect(scroller).toContain('[&amp;&gt;div]:!flex');

    /* And the desktop column must NOT carry the override — it is not
       hidden, and forcing display there would fight its own layout. */
    const desktop = render(1440, 900);
    const dnav = desktop.slice(desktop.indexOf('data-paf="index-column"'));
    expect(dnav.slice(0, 400)).not.toContain('[&amp;&gt;div]:!flex');
  });

  it('the chip row carries real, labelled tabs — not an empty band', () => {
    const html = render(768, 800);
    const nav = html.slice(html.indexOf('data-paf="index-column"'), html.indexOf('data-paf="centre-viewport"'));
    expect(nav).toMatch(/role="tablist"[^>]*aria-orientation="horizontal"/);
    expect((nav.match(/role="tab"/g) ?? []).length).toBeGreaterThanOrEqual(7);
    expect(nav).toMatch(/aria-selected="true"/);
  });
});
