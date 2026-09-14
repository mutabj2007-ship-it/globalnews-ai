import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AnalysisApiResponse, NewsArticle } from '@globalnews-ai/shared';
import { AnalysisFrameSurface } from './AnalysisFrameSurface';
import { SourcesReporting, imageTransform, IMAGE_SHIFT_MAX, IMAGE_TILT_MAX, IMAGE_ZOOM, CARD_SCALE, RESET_MS } from './SourcesReporting';
import { EvidenceGeographyExpanded, MAX_ZOOM, MIN_ZOOM, PAN_STEP, applyView, clampPan, clampZoom, REST_VIEW } from './EvidenceGeographyExpanded';
import {
  CARD_TOTAL_RANGE,
  DESKTOP_CARD_RANGE,
  DESKTOP_IMAGE_MIN,
  MIN_IMAGE_EDGE,
  MIN_IMAGE_RATIO,
  MOBILE_CARD_PCT_RANGE,
  MOBILE_IMAGE_MIN,
  PEEK_MAX,
  PEEK_MIN,
  GAP_DESKTOP as GAP_DESKTOP_VALUE,
  SNAP_MS,
  advanceOffset,
  cardHeightFor,
  cardWidthFor,
  imageHeightFor,
  imageRatioFor,
  resolveSourceCardBand,
  resolveStrip,
  sourcesMustCollapse,
  sourceSectionHeight,
  stripPosition,
} from './sourcesReportingGeometry';
import { buildAnalysisWorkspaceModel } from '../search/analysisDimensions';
import { buildEvidenceGeography } from './evidenceGeography';
import { fixture } from './frameFixtures';
import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * H-ALPHA-VISUAL-1 — R3 ACCEPTANCE.
 *
 * The CTO named eight criteria families for this package: SC (source
 * cards), IM (imagery), FB (fallback), CI (card interaction), RM (reduced
 * motion), TP (touch pointer), AE (accessibility), EG (evidence
 * geography). The R1/R2/R3 documents themselves are NOT in this lane's
 * possession — they are not in the repository, the project or
 * Claude_Output — so every assertion below is written against the
 * REQUIREMENTS RESTATED VERBATIM IN THE AUTHORIZATION, grouped under the
 * family each evidently governs. Any R3 criterion not restated there is
 * untested, and the CTO report says so rather than implying coverage.
 */

const SOURCES = buildAnalysisWorkspaceModel(fixture()).sourceSupport;
const src = (name: string): string => readFileSync(join(__dirname, name), 'utf8');
const codeOnly = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const SECTION = codeOnly(src('SourcesReporting.tsx'));
const EXPANDED = codeOnly(src('EvidenceGeographyExpanded.tsx'));

const render = (extra: Record<string, unknown> = {}): string =>
  renderToStaticMarkup(
    createElement(SourcesReporting as never, { sources: SOURCES, language: 'en', ...extra } as never),
  );

const withImages = (response: AnalysisApiResponse, count: number): AnalysisApiResponse =>
  ({
    ...response,
    articles: response.articles.map((a, i) =>
      i < count ? ({ ...a, imageUrl: `https://cdn.test/img-${i}.jpg` } as NewsArticle) : a,
    ),
  }) as AnalysisApiResponse;

/* ── SC — SOURCE CARDS, UNDER DESIGN-C2 LOCK 1 AND LOCK 2 ───── */
/*
 * SUPERSESSION, DECLARED RATHER THAN QUIETLY APPLIED.
 *
 * Two assertions in this block previously encoded R3 statements that
 * DESIGN-C2 replaces, and both are restated here in their new form:
 *
 *   "desktop bands do not peek"  →  LOCK 2 requires a PERMANENT desktop
 *                                   peek of 12-48px wherever more cards
 *                                   exist, and prohibits hiding it.
 *   "imagery is 180-220px tall
 *    at every band"              →  LOCK 1 derives the image from the card
 *                                   at 16:9 and floors it at 180 desktop /
 *                                   140 mobile. The 220 ceiling is kept as
 *                                   a desktop assertion, where it still
 *                                   holds.
 */
const LANE = { 1600: 1180, 1440: 1100, 1280: 980, 1024: 760, 900: 720, 768: 700 } as const;

describe('SC — Lock 1 proportions and the R3 band counts', () => {
  it.each([
    ['>=1440', 1600, 3],
    ['>=1440', 1440, 3],
    ['1024-1439', 1280, 2],
    ['1024-1439', 1024, 2],
    ['768-1023', 900, 2],
    ['768-1023', 768, 2],
    ['<768', 430, 1],
    ['<768', 375, 1],
  ])('%s (%ipx) shows AT LEAST %i fully visible card(s)', (_band, viewport, visible) => {
    /*
      C1 — THE BAND COUNT IS A FLOOR, NOT A CAP. This assertion used `toBe`,
      which is what encoded the cap. The band values themselves are unchanged
      and are still asserted exactly; what changed is that a lane with room
      for more is no longer required to show fewer.
    */
    expect(resolveSourceCardBand(viewport).visible).toBe(visible);
    if (viewport >= 768) {
      const lane = LANE[viewport as keyof typeof LANE];
      expect(resolveStrip(lane, viewport, 12).visible).toBeGreaterThanOrEqual(visible);
    }
  });

  it('C1 — a WIDE lane shows MORE than the band floor, and the cap cannot return', () => {
    /*
      The measured defect, as a test. At a 1440 viewport the real lane is the
      full 1440px, not the 1100px the table above uses, and six sources were
      shown three at a time with 374px of dead lane. Each row below would have
      failed before C1.
    */
    for (const [viewport, lane, atLeast] of [
      [1440, 1440, 4],
      [1600, 1600, 4],
      [1920, 1920, 5],
      [1280, 1280, 3],
    ] as const) {
      const strip = resolveStrip(lane - 16, viewport, 12);
      expect({ viewport, visible: strip.visible }).toEqual({
        viewport,
        visible: expect.any(Number),
      });
      expect(strip.visible).toBeGreaterThanOrEqual(atLeast);
      expect(strip.visible).toBeGreaterThan(resolveSourceCardBand(viewport).visible - 1);
      /* and the lane it leaves unused is bounded by one stride, not by the
         viewport — the property the cap destroyed */
      const used = Math.min(lane - 16, strip.viewportWidth) + 16;
      expect(lane - used).toBeLessThan(strip.stride);
    }
  });

  it('C1 — everything the floor was protecting is untouched', () => {
    const strip = resolveStrip(1424, 1440, 12);
    expect(strip.cardWidth).toBe(320);
    expect(strip.gap).toBe(GAP_DESKTOP_VALUE);
    expect(strip.stride).toBe(334);
    expect(strip.peek).toBeGreaterThanOrEqual(PEEK_MIN);
    expect(strip.peek).toBeLessThanOrEqual(PEEK_MAX);
    /* a lane too narrow for the band floor still drops a column and says so */
    expect(resolveStrip(600, 1440, 12).droppedColumn).toBe(true);
    expect(resolveStrip(1424, 1440, 12).droppedColumn).toBe(false);
  });

  it('C2-1 — the image is never below 58% of the card, at every probe viewport', () => {
    for (const vw of [390, 768, 1280, 1440]) {
      const ratio = imageRatioFor(cardWidthFor(vw));
      expect({ vw, ok: ratio >= MIN_IMAGE_RATIO }).toEqual({ vw, ok: true });
    }
  });

  it('C2-2 — every card in a strip is the SAME height, so variance is 0 and not 2', () => {
    for (const vw of [768, 1280, 1440]) {
      /* One locked width per band means one locked height per band. A
         card with no image keeps the same footprint, so nothing in the
         strip can differ by even a pixel. */
      expect(cardHeightFor(cardWidthFor(vw))).toBe(cardHeightFor(cardWidthFor(vw)));
      expect(cardHeightFor(cardWidthFor(vw))).toBeGreaterThanOrEqual(CARD_TOTAL_RANGE[0]);
      expect(cardHeightFor(cardWidthFor(vw))).toBeLessThanOrEqual(CARD_TOTAL_RANGE[1]);
    }
  });

  it('C2-3 — the mobile card is 82-90% of the viewport', () => {
    for (const vw of [320, 360, 375, 390, 430]) {
      const pct = cardWidthFor(vw) / vw;
      expect({ vw, ok: pct >= MOBILE_CARD_PCT_RANGE[0] && pct <= MOBILE_CARD_PCT_RANGE[1] }).toEqual({
        vw,
        ok: true,
      });
    }
  });

  it('LOCK 1 — the desktop card sits inside the locked 320-360 width window', () => {
    const w = cardWidthFor(1440);
    expect(w).toBeGreaterThanOrEqual(DESKTOP_CARD_RANGE[0]);
    expect(w).toBeLessThanOrEqual(DESKTOP_CARD_RANGE[1]);
  });

  it('LOCK 1 — the image region is the full card width at 16:9', () => {
    for (const vw of [320, 390, 768, 1440]) {
      const w = cardWidthFor(vw);
      expect(imageHeightFor(w)).toBe(Math.round((w * 9) / 16));
    }
  });

  it('LOCK 1 — image floors: 180 desktop, 140 mobile, and no edge under 96 anywhere', () => {
    expect(imageHeightFor(cardWidthFor(1440))).toBeGreaterThanOrEqual(DESKTOP_IMAGE_MIN);
    expect(imageHeightFor(cardWidthFor(1440))).toBeLessThanOrEqual(220);
    for (const vw of [320, 360, 375, 390, 430]) {
      expect({ vw, h: imageHeightFor(cardWidthFor(vw)) >= MOBILE_IMAGE_MIN }).toEqual({ vw, h: true });
      expect(imageHeightFor(cardWidthFor(vw))).toBeGreaterThanOrEqual(MIN_IMAGE_EDGE);
      expect(cardWidthFor(vw)).toBeGreaterThanOrEqual(MIN_IMAGE_EDGE);
    }
  });

  it('LOCK 1 — the text block is 16px padded and carries EXACTLY three lines', () => {
    expect(SECTION).toMatch(/padding: `\$\{TEXT_PADDING\}px`/);
    /* One paragraph, one title link, one support line. A fourth child of
       the text block would push the image below 0.58. */
    const block = SECTION.slice(SECTION.indexOf('data-paf="source-card-text"'));
    const body = block.slice(0, block.indexOf('</div>'));
    expect((body.match(/<p\b/g) ?? []).length).toBe(2);
    expect((body.match(/<a\b/g) ?? []).length).toBe(1);
  });

  it('LOCK 1 — the title clamps to two lines with a real ellipsis', () => {
    expect(render()).toMatch(/data-paf="source-headline"[^>]*class="[^"]*line-clamp-2/);
  });

  it('the card is 10px radius, per Lock 1', () => {
    expect(render()).toMatch(/border-radius:10px/);
  });
});

describe('SC/LOCK 2 — desktop source navigation', () => {
  const strip = (vw = 1440, count = 12) => resolveStrip(LANE[vw as keyof typeof LANE] ?? 1100, vw, count);

  it('C2-5 — the controls are in the markup at rest, not behind hover', () => {
    const html = render({ initialViewportWidth: 1440 });
    expect(render({ initialViewportWidth: 390 })).not.toContain('data-paf="sources-nav"');
    expect(html).toContain('data-paf="sources-prev"');
    expect(html).toContain('data-paf="sources-next"');
    expect(SECTION).not.toMatch(/group-hover:[^\s"]*opacity/);
    expect(SECTION).not.toMatch(/hover:opacity-100/);
  });

  it('C2-6 — one activation advances EXACTLY one card width plus one gap', () => {
    const s = strip();
    expect(advanceOffset(0, s.stride, 1, 12, s.visible)).toBe(s.stride);
    expect(advanceOffset(s.stride, s.stride, 1, 12, s.visible)).toBe(s.stride * 2);
    expect(advanceOffset(s.stride * 2, s.stride, -1, 12, s.visible)).toBe(s.stride);
    /* and it always settles on a card edge — never mid-card */
    for (let i = 0; i < 12; i += 1) {
      expect(advanceOffset(i * s.stride + 3, s.stride, 1, 12, s.visible) % s.stride).toBe(0);
    }
  });

  it('C2-7 — the position readout is present and derived from the scroll offset', () => {
    const s = strip();
    expect(render({ initialViewportWidth: 1440 })).toContain('data-paf="sources-position"');
    expect(stripPosition(0, s.stride, 3, 12)).toMatchObject({ first: 1, last: 3, total: 12 });
    expect(stripPosition(s.stride * 2, s.stride, 3, 12)).toMatchObject({ first: 3, last: 5 });
    /* a native trackpad scroll it did not cause is read the same way */
    expect(stripPosition(s.stride * 4 + 7, s.stride, 3, 12)).toMatchObject({ first: 5, last: 7 });
  });

  it('C2-8 — boundary controls are DISABLED and still rendered, never removed', () => {
    const s = strip();
    expect(stripPosition(0, s.stride, 3, 12).atStart).toBe(true);
    expect(stripPosition(s.stride * 9, s.stride, 3, 12).atEnd).toBe(true);
    const html = render({ initialViewportWidth: 1440 });
    expect(html).toMatch(/data-paf="sources-prev"[^>]*disabled/);
    expect(html).toContain('data-paf="sources-next"');
    expect(SECTION).not.toMatch(/position\.atStart \? null/);
  });

  it('C2-9 — arrow keys operate the strip when focus is inside it', () => {
    expect(SECTION).toMatch(/onKeyDown=\{onKeyDown\}/);
    expect(SECTION).toMatch(/ArrowRight/);
    expect(SECTION).toMatch(/ArrowLeft/);
    expect(render()).toMatch(/data-paf="sources-reporting-track"[^>]*tabindex="0"/i);
  });

  it('C2-10 — under reduced motion the advance is instant, and the ramp is capped at 240ms', () => {
    expect(SNAP_MS).toBeLessThanOrEqual(240);
    expect(SECTION).toMatch(/animateScrollTo\(el, target, reduced\)/);
    expect(SECTION).toMatch(/if \(instant[^)]*\) \{\n\s*el\.scrollLeft = target;/);
    expect(render()).toMatch(/scroll-behavior:auto !important/);
  });

  it('LOCK 2 — a permanent peek of 12-48px wherever more cards exist', () => {
    for (const vw of [768, 900, 1024, 1280, 1440, 1600]) {
      const s = resolveStrip(LANE[vw as keyof typeof LANE], vw, 12);
      expect({ vw, ok: s.peek >= PEEK_MIN && s.peek <= PEEK_MAX }).toEqual({ vw, ok: true });
    }
    for (const vw of [320, 360, 375, 390, 430]) {
      const s = resolveStrip(vw - 16, vw, 12);
      expect({ vw, ok: s.peek >= PEEK_MIN && s.peek <= PEEK_MAX }).toEqual({ vw, ok: true });
    }
  });

  it('LOCK 2 — no peek is owed when nothing follows', () => {
    expect(resolveStrip(1100, 1440, 3).peek).toBe(0);
    expect(resolveStrip(1100, 1440, 2).peek).toBe(0);
  });

  it('LOCK 2 — native scroll is retained; the controls are an addition', () => {
    expect(render()).toMatch(/data-paf="sources-reporting-track"[^>]*overflow-x-auto/);
    expect(SECTION).not.toMatch(/preventDefault\(\)[^}]*wheel/);
  });

  it('the remainder is reached horizontally, and the page is never widened', () => {
    const html = render();
    expect(html).toMatch(/data-paf="sources-reporting-track"[^>]*overflow-x-auto/);
    expect(html).toMatch(/snap-x/);
  });

  it('insufficient vertical space collapses to a labelled control AND a count', () => {
    const h = cardHeightFor(cardWidthFor(1440));
    expect(sourcesMustCollapse(120, h)).toBe(true);
    expect(sourcesMustCollapse(sourceSectionHeight(h) + 1, h)).toBe(false);
    const html = render({ collapsed: true });
    expect(html).toContain('data-paf="sources-reporting-collapsed"');
    expect(html).toContain(`${getDictionary('en').analysisFrame.sourcesReporting.replace('&', '&amp;')} · ${SOURCES.length}`);
    /* collapsed is a control and a count — never a shrunken card */
    expect(html).not.toContain('data-paf="source-card-v2"');
  });

  it('every card carries headline, publisher, timing and a way to the source', () => {
    const html = render();
    expect(html).toContain('data-paf="source-headline"');
    expect(html).toContain('data-paf="source-open"');
    expect(html).toContain('data-paf="source-support"');
    expect(html).toMatch(/\bAGO\b/i);
  });

  it('the rejected miniature dock is not on the reading path', () => {
    const frame = renderToStaticMarkup(
      createElement(AnalysisFrameSurface as never, {
        response: fixture(),
        initialViewport: { width: 1440, height: 900 },
      } as never),
    );
    expect(frame).toContain('data-paf="sources-reporting"');
    expect(frame).not.toContain('data-paf="dock-compact"');
    expect(frame).not.toContain('data-paf="compact-source-card"');
  });
});

/* ── IM / FB — IMAGERY AND FALLBACK ───────────────────────────────── */
describe('IM & FB — only the article\'s own image, and an honest full-footprint fallback', () => {
  const frame = (imageCount: number): string =>
    renderToStaticMarkup(
      createElement(AnalysisFrameSurface as never, {
        response: withImages(fixture(), imageCount),
        initialViewport: { width: 1440, height: 900 },
      } as never),
    );

  it('the ONLY src ever emitted is the retained article\'s own imageUrl', () => {
    const html = frame(5);
    const srcs = [...html.matchAll(/<img[^>]*src="([^"]*)"/g)].map((m) => m[1]);
    expect(srcs.length).toBe(5);
    for (const s of srcs) expect(s).toMatch(/^https:\/\/cdn\.test\/img-\d\.jpg$/);
  });

  it('no substitution path exists in the source at all', () => {
    expect(SECTION).not.toContain('/images/article-placeholder.jpg');
    expect(SECTION).not.toMatch(/imageUrl\s*\|\|/);
    expect(SECTION).not.toMatch(/placehold|unsplash|picsum|dummyimage/i);
  });

  it('a source with no image keeps the FULL image footprint', () => {
    const html = frame(0);
    const frames = html.match(/data-paf="source-image-frame"/g) ?? [];
    expect(frames.length).toBe(5);
    expect(html).toMatch(/data-has-image="false"/);
    expect(html).not.toMatch(/<img[^>]*object-cover/);
    /* the footprint is the band variable, identical to the present case */
    expect(html).toMatch(/height:var\(--sr-img\)/);
  });

  it('exactly one treatment per record — never both, never neither', () => {
    const html = frame(3);
    expect((html.match(/data-has-image="true"/g) ?? []).length).toBe(3);
    expect((html.match(/data-has-image="false"/g) ?? []).length).toBe(2);
    expect((html.match(/data-paf="source-image-frame"/g) ?? []).length).toBe(5);
  });

  it('the stripes are on the WRAPPER, so the failed path is free', () => {
    const html = frame(5);
    const framesHtml = html.split('data-paf="source-image-frame"').slice(1);
    for (const f of framesHtml) expect(f.slice(0, 400)).toMatch(/repeating-linear-gradient/);
    expect(SECTION).toMatch(/onError=\{hideFailedArticleImage\}/);
  });
});

/* ── CI — CARD INTERACTION ────────────────────────────────────────── */
describe('CI — cursor-relative depth, inside every R3 ceiling', () => {
  it('the declared ceilings are the R3 ceilings', () => {
    expect(IMAGE_SHIFT_MAX).toBeLessThanOrEqual(6);
    expect(IMAGE_ZOOM).toBeLessThanOrEqual(1.02);
    expect(IMAGE_TILT_MAX).toBeLessThanOrEqual(1.5);
    expect(CARD_SCALE).toBeLessThanOrEqual(1.01);
    expect(RESET_MS).toBeLessThanOrEqual(120);
  });

  it('no pointer position can exceed a ceiling, however far outside the card', () => {
    for (const [nx, ny] of [[0, 0], [1, 1], [-1, -1], [9, -9], [-9, 9], [0.5, -0.25]]) {
      const t = imageTransform(nx as number, ny as number);
      const [dx, dy] = [...t.matchAll(/translate3d\((-?[\d.]+)px, (-?[\d.]+)px/g)][0]!.slice(1).map(Number);
      const [rx] = [...t.matchAll(/rotateX\((-?[\d.]+)deg\)/g)][0]!.slice(1).map(Number);
      const [ry] = [...t.matchAll(/rotateY\((-?[\d.]+)deg\)/g)][0]!.slice(1).map(Number);
      const [sc] = [...t.matchAll(/scale\(([\d.]+)\)/g)][0]!.slice(1).map(Number);
      expect(Math.abs(dx!)).toBeLessThanOrEqual(IMAGE_SHIFT_MAX);
      expect(Math.abs(dy!)).toBeLessThanOrEqual(IMAGE_SHIFT_MAX);
      expect(Math.abs(rx!)).toBeLessThanOrEqual(IMAGE_TILT_MAX);
      expect(Math.abs(ry!)).toBeLessThanOrEqual(IMAGE_TILT_MAX);
      expect(sc!).toBeLessThanOrEqual(IMAGE_ZOOM);
    }
  });

  it('TEXT RECTS CANNOT MOVE: every transform is on the image, never the card box', () => {
    /* This is the absolute R3 rule, and it is why CARD_SCALE is 1 — a
       1.01 card scale is permitted by the ceiling but moves every glyph
       inside the card, which the absolute rule forbids. */
    expect(CARD_SCALE).toBe(1);
    expect(SECTION).toMatch(/ref=\{imageRef\}/);
    expect(SECTION).toMatch(/node\.style\.transform = imageTransform/);
    /* the only element whose transform is written is the image layer */
    expect((SECTION.match(/style\.transform/g) ?? []).length).toBe(2); // set + reset
    expect(SECTION).toMatch(/data-paf="source-card-text"/);
  });

  it('geometry never animates — no transition targets a layout property', () => {
    expect(SECTION).toMatch(/transitionProperty: 'transform'/);
    expect(SECTION).not.toMatch(/transition[^;\n]*(width|height|margin|padding|top|left|flex-basis)/i);
  });

  it('the card resets to identity, within the R3 budget', () => {
    expect(SECTION).toMatch(/onPointerLeave=\{reset\}/);
    expect(SECTION).toMatch(/onPointerCancel=\{reset\}/);
    expect(SECTION).toMatch(/transitionDuration: `\$\{RESET_MS\}ms`/);
  });

  it('keyboard focus gets NO cursor transform', () => {
    /* the transform is written only from a pointer handler */
    expect(SECTION).not.toMatch(/onFocus[^\n]*transform/);
    expect(SECTION).toMatch(/onPointerMove=\{onPointerMove\}/);
  });
});

/* ── TP — TOUCH / POINTER ─────────────────────────────────────────── */
describe('TP — a coarse pointer never enters the motion path', () => {
  it('motion is gated on a capability query, not a viewport width', () => {
    expect(SECTION).toMatch(/\(hover: hover\) and \(pointer: fine\)/);
    expect(SECTION).toMatch(/supportsFinePointer\(\) && !prefersReducedMotion\(\)/);
  });

  it('the handler ignores anything that is not a mouse', () => {
    expect(SECTION).toMatch(/event\.pointerType !== 'mouse'/);
  });

  it('pressed feedback is ground and border, never a transform', () => {
    expect(SECTION).not.toMatch(/active:scale|active:rotate|active:translate/);
    expect(SECTION).toMatch(/hover:border-/);
  });

  it('nothing can obstruct scrolling — no preventDefault in the pointer path', () => {
    const handler = SECTION.slice(SECTION.indexOf('const onPointerMove'), SECTION.indexOf('const reset'));
    expect(handler).not.toContain('preventDefault');
    expect(handler).not.toContain('touch-action');
  });

  it('all card content is present without hover — nothing is revealed by it', () => {
    const html = render();
    expect(html).toContain('data-paf="source-headline"');
    expect(html).toContain('data-paf="source-open"');
    expect(html).not.toMatch(/hidden[^>]*group-hover:block/);
  });
});

/* ── RM — REDUCED MOTION ──────────────────────────────────────────── */
describe('RM — reduced motion suppresses transforms and keeps the affordance', () => {
  it('the JS listener is not attached under reduced motion', () => {
    /* globals.css zeroes transition-duration, but that does NOT stop a
       handler writing `transform` directly — it only stops it animating,
       which is worse. So the gate is in JS as well. */
    expect(SECTION).toMatch(/matchMedia\('\(prefers-reduced-motion: reduce\)'\)/);
    expect(SECTION).toMatch(/if \(!motion \|\| event\.pointerType !== 'mouse'\) return;/);
  });

  it('and the CSS suppresses any transform that somehow survives', () => {
    const html = render();
    expect(html).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(html).toMatch(/transform:none !important/);
  });

  it('the actionable affordance is static markup, so it survives suppression', () => {
    const html = render();
    expect(html).toContain('data-paf="source-open"');
    expect(html).toMatch(/min-h-\[44px\]/);
  });
});

/* ── AE — ACCESSIBILITY ───────────────────────────────────────────── */
describe('AE — targets, labels and semantics', () => {
  it('every interactive target is at least 44px', () => {
    const html = render();
    const anchors = html.match(/<a[\s][^>]*>/g) ?? [];
    expect(anchors.length).toBeGreaterThan(0);
    for (const a of anchors) expect(a).toMatch(/min-h-\[44px\]/);
  });

  it('the section is a labelled landmark', () => {
    expect(render()).toMatch(/<section[^>]*aria-label="SOURCES &amp; REPORTING"/);
  });

  it('the decorative image is hidden from assistive technology', () => {
    const html = renderToStaticMarkup(
      createElement(SourcesReporting as never, {
        sources: buildAnalysisWorkspaceModel(withImages(fixture(), 5)).sourceSupport,
        language: 'en',
      } as never),
    );
    for (const f of html.split('data-paf="source-image-frame"').slice(1)) {
      expect(f.slice(0, 200)).toContain('aria-hidden="true"');
    }
    for (const tag of html.match(/<img[^>]*>/g) ?? []) expect(tag).toMatch(/alt=""/);
  });

  it('an external source link states that it leaves the page', () => {
    expect(render()).toMatch(/rel="noopener noreferrer"/);
    expect(render()).toMatch(/target="_blank"/);
  });

  it('both languages render their own copy', () => {
    const pl = render({ language: 'pl' });
    expect(pl).toContain(getDictionary('pl').analysisFrame.openSource);
    expect(pl).not.toContain(getDictionary('en').analysisFrame.openSource);
  });
});

/* ── EG — EVIDENCE GEOGRAPHY ──────────────────────────────────────── */
describe('EG — expansion is bounded, keyboard-operable and truthful', () => {
  const model = buildEvidenceGeography(fixture());
  const overlay = (): string =>
    renderToStaticMarkup(
      createElement(EvidenceGeographyExpanded as never, {
        model,
        precisionLabel: 'COUNTRY-LEVEL',
        onClose: () => undefined,
        language: 'en',
      } as never),
    );

  it('zoom is capped at 2.5x and floored at 1x', () => {
    expect(MAX_ZOOM).toBe(2.5);
    expect(clampZoom(4)).toBe(2.5);
    expect(clampZoom(0.1)).toBe(MIN_ZOOM);
  });

  it('pan is bounded, and at rest there is nothing to pan', () => {
    /* Math.abs normalises -0, which is a real JS value and not a defect. */
    expect(Math.abs(clampPan(999, MIN_ZOOM, 100))).toBe(0);
    expect(Math.abs(clampPan(-999, MIN_ZOOM, 100))).toBe(0);
    expect(clampPan(999, MAX_ZOOM, 100)).toBe(75);
    expect(clampPan(-999, MAX_ZOOM, 100)).toBe(-75);
  });

  it('applyView can never leave the bounded envelope', () => {
    let v = REST_VIEW;
    for (let i = 0; i < 40; i += 1) v = applyView(v, PAN_STEP, PAN_STEP, 1, 100);
    expect(v.zoom).toBeLessThanOrEqual(MAX_ZOOM);
    expect(Math.abs(v.x)).toBeLessThanOrEqual(((MAX_ZOOM - 1) * 100) / 2);
    expect(Math.abs(v.y)).toBeLessThanOrEqual(((MAX_ZOOM - 1) * 100) / 2);
  });

  it('expand, zoom, pan, reset and close are all present', () => {
    const html = overlay();
    for (const marker of ['geo-close', 'geo-zoom-in', 'geo-zoom-out', 'geo-zoom-reset']) {
      expect({ marker, present: html.includes(`data-paf="${marker}"`) }).toEqual({ marker, present: true });
    }
    expect(EXPANDED).toMatch(/key === 'ArrowLeft'/);
    expect(EXPANDED).toMatch(/key === 'Escape'/);
    expect(EXPANDED).toMatch(/key === '0'/);
  });

  it('it is a modal dialog with managed focus', () => {
    const html = overlay();
    expect(html).toMatch(/role="dialog"/);
    expect(html).toMatch(/aria-modal="true"/);
    expect(EXPANDED).toMatch(/closeRef\.current\?\.focus\(\)/);
    expect(EXPANDED).toMatch(/restoreRef\.current/);
  });

  it('the precision statement is visible in the expanded view', () => {
    const html = overlay();
    expect(html).toContain('data-paf="geo-expanded-precision"');
    expect(html).toContain('COUNTRY-LEVEL');
    expect(html).toContain('data-paf="not-a-coordinate"');
    expect(html).toContain('data-paf="geo-no-subnational"');
  });

  it('NOTHING SUBNATIONAL CAN BE DRAWN — no marker, no coordinate, no locality', () => {
    const html = overlay();
    /*
      RETARGETED AT H-C2 RUNTIME CORRECTION C3, AND DECLARED.

      This banned `<text>` outright, as a proxy for "no locality label". That
      proxy was correct while the map had no labels at all; the CTO has now
      authorized ADMIN-0 REFERENCE labels, so the ban is stated against what
      it was always protecting instead of against the element:

        - no marker of any kind, at any zoom            (<circle) — unchanged
        - every <text> is a REFERENCE label, named as one
        - no <text> carries evidence grammar: no cyan, no precision word,
          no citation count

      A country name beside an uncoloured outline asserts nothing about the
      analysis. The same word inside a cyan region would, and that is what
      stays prohibited.
    */
    expect(html).not.toMatch(/<circle/);
    const texts = html.match(/<text[\s>][^>]*>[^<]*<\/text>/g) ?? [];
    for (const node of texts) {
      expect(node).toContain('data-paf="geo-reference-label"');
      expect(node).not.toMatch(/#67e8f9|#22d3ee|34,211,238/);
      expect(node).not.toMatch(/COUNTRY-LEVEL|CITY|PRECISION|REPORTS/i);
    }
    /* `notACoordinate` is the TRUTHFULNESS STATEMENT and must stay, so the
       ban targets coordinate DATA rather than the word. */
    expect(EXPANDED).not.toMatch(/\b(lat|lng|lon|latitude|longitude)\b/i);
    expect(EXPANDED).not.toMatch(/projectPoint|anchorX|anchorY/);
    expect(EXPANDED).toContain('notACoordinate');
    expect(EXPANDED).not.toMatch(/countries-50m|countries-10m|admin[-_]?1/i);
    /* only the two shapes the country dataset can produce */
    expect(html).toMatch(/data-paf="evidence-country"/);
  });

  it('the expand control is withheld when nothing resolved', () => {
    /*
      RETARGETED BY ANALYSIS-SPATIAL-MAP-CONVERGENCE-1, AND THE INVARIANT
      IS UNCHANGED — only the spelling moved.

      This pinned the literal `{evidence.empty ? null : (`. The shell path
      adds a second branch after that guard (a LINK to /map instead of the
      in-place overlay), so the text now reads
      `{evidence.empty ? null : spatial ? (`. What the test exists to
      protect is that NO expand affordance can render when nothing
      resolved — an expand control on an empty map implies there is
      something to look at, which is the misreading this lane prevents.

      So it is asserted as an ORDERING over every control rather than as
      one string: the empty guard must come first, and every `geo-expand`
      must sit after it. That covers both branches, and would still catch
      a third.
    */
    const detail = codeOnly(src('LocationDetail.tsx'));
    const guard = detail.indexOf('evidence.empty ? null :');
    expect(guard).toBeGreaterThan(-1);

    const controls = [...detail.matchAll(/data-paf="geo-expand"/g)].map((m) => m.index ?? -1);
    expect(controls.length).toBeGreaterThan(0);
    for (const at of controls) expect(at).toBeGreaterThan(guard);
  });
});
