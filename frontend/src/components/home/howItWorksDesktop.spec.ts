import { readFileSync } from 'fs';
import { join } from 'path';
import { processSteps } from '@/lib/homeContent';
import { getDictionary } from '@/lib/i18n/dictionaries';
import tailwindConfig from '../../../tailwind.config';

const source = readFileSync(join(__dirname, 'HowItWorks.tsx'), 'utf-8');
const trustSource = readFileSync(join(__dirname, 'TrustSection.tsx'), 'utf-8');
/* Read for comparison only — neither is modified by this milestone. */
const canvasSource = readFileSync(join(__dirname, '../layout/PageCanvas.tsx'), 'utf-8');
const pageSource = readFileSync(join(__dirname, '../../app/page.tsx'), 'utf-8');

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}
const code = stripComments(source);
const trustCode = stripComments(trustSource);

interface ThemeExtend {
  colors?: { cd?: Record<string, unknown> };
  fontSize?: Record<string, unknown>;
  backgroundImage?: Record<string, string>;
  boxShadow?: Record<string, string>;
  spacing?: Record<string, string>;
  maxWidth?: Record<string, string>;
  screens?: Record<string, string>;
}
const themeExtend = (tailwindConfig.theme?.extend ?? {}) as unknown as ThemeExtend;
const cd = (themeExtend.colors?.cd ?? {}) as Record<string, string>;
const fonts = (themeExtend.fontSize ?? {}) as Record<string, [string, Record<string, string>]>;
const images = (themeExtend.backgroundImage ?? {}) as Record<string, string>;
const shadows = (themeExtend.boxShadow ?? {}) as Record<string, string>;
const spacing = (themeExtend.spacing ?? {}) as Record<string, string>;
const maxWidth = (themeExtend.maxWidth ?? {}) as Record<string, string>;
const screens = (themeExtend.screens ?? {}) as Record<string, string>;

/**
 * M66.8d — HOW IT WORKS DESKTOP REFINEMENT. GN-CD-HIW-001 → GN-CD-HIW-006.
 *
 * The band is authored for DESKTOP ONLY. The released responsive contract,
 * statement B, sends mobile and tablet back to Claude Design, and CTO decision
 * D-4 requires the pre-M66.8d presentation to remain in place below the
 * threshold. So this component carries two independently authored
 * compositions, and roughly a third of what follows exists to prove that the
 * new one cannot leak into the old one's viewports — or the reverse.
 *
 * Two divergences from [DESIGN-EXACT] are asserted here by name rather than
 * hidden: the step-number colour (D-a, a measured SC 1.4.3 failure) and the
 * activation threshold (D-b, because the design's own basis was removed by
 * M66.1 decision D4).
 */

/**
 * GN-CD-HIW-002 geometry, computed from the released declarations rather than
 * pattern-matched. Page padding 26, band padding 26, two 38px gaps.
 */
const PAGE_PAD = 26;
const BAND_PAD = 26;
const COL_GAP = 38;
const BODY_MAX = 400;
/** `right:-44px; width:52px` puts the segment's left edge 8px inside its column. */
const SEGMENT_INSET = 44 - 52;

function columnWidth(viewport: number): number {
  const content = Math.min(viewport, Number.parseFloat(maxWidth['cd-page'])) - 2 * PAGE_PAD;
  return (content - 2 * BAND_PAD - 2 * COL_GAP) / 3;
}
function bodyBoxWidth(viewport: number): number {
  return Math.min(BODY_MAX, columnWidth(viewport));
}
/** Clearance from the body box's right edge to the segment's left edge. */
function bodyClearance(viewport: number): number {
  return columnWidth(viewport) + SEGMENT_INSET - bodyBoxWidth(viewport);
}

const GATE = 'cd-header';
const GATE_PX = Number.parseFloat(screens[GATE]);

/**
 * Slice boundaries, taken from the two compositions' own container class
 * strings so a guard can never be aimed at the wrong half of the file.
 */
const BAND_START = code.indexOf('relative hidden overflow-hidden');
const BAND = code.slice(BAND_START);
const LEGACY = code.slice(0, BAND_START);
const OVERLAY_START = code.indexOf('pointer-events-none absolute left-0 right-0 top-cd-20');
const OVERLAY = code.slice(OVERLAY_START, code.indexOf('relative grid grid-cols-3'));

/**
 * Space Grotesk average advance, em. An ESTIMATE, labelled as one — the house
 * convention since M66.3. Mono advances are exact; sans and display are not.
 */
const GROTESK_ADVANCE = 0.52;
function titleWidth(text: string): number {
  return text.length * 15.5 * GROTESK_ADVANCE;
}

describe('M66.8d — the released band (GN-CD-HIW-002)', () => {
  it('has NO panel border, and four 16x16 corner brackets instead', () => {
    // GN-CD-HIW-005: "Does How It Works have a panel border? No. Corner
    // brackets only." The legacy composition's own border is removed at the
    // gate by `cd-header:border-0 cd-header:bg-transparent` on the <section>.
    expect(code).toMatch(/cd-header:border-0/);
    expect(code).toMatch(/cd-header:bg-transparent/);
    const brackets = BAND.match(/h-\[16px\] w-\[16px\]/g) ?? [];
    expect(brackets).toHaveLength(4);
    expect(BAND).toMatch(/absolute left-0 top-0 h-\[16px\] w-\[16px\] border-l border-t border-cd-edge-hiw-55/);
    expect(BAND).toMatch(/absolute right-0 top-0 h-\[16px\] w-\[16px\] border-r border-t border-cd-edge-hiw-55/);
    expect(BAND).toMatch(/absolute bottom-0 left-0 h-\[16px\] w-\[16px\] border-b border-l border-cd-edge-hiw-25/);
    expect(BAND).toMatch(/absolute bottom-0 right-0 h-\[16px\] w-\[16px\] border-b border-r border-cd-edge-hiw-25/);
  });

  it('the top bracket pair is brighter than the bottom pair — both alphas are required', () => {
    // "The band opens strongly and closes quietly."
    expect(cd['edge-hiw-55']).toBe('rgba(34,211,238,0.55)');
    expect(cd['edge-hiw-25']).toBe('rgba(34,211,238,0.25)');
    const top = Number(/,(0?\.\d+)\)/.exec(cd['edge-hiw-55'])?.[1]);
    const bottom = Number(/,(0?\.\d+)\)/.exec(cd['edge-hiw-25'])?.[1]);
    expect(top).toBeGreaterThan(bottom);
  });

  it('carries the released padding, radius, overflow — and NO min-height', () => {
    expect(code).toMatch(/pt-cd-20/);
    expect(code).toMatch(/pr-cd-26/);
    expect(code).toMatch(/pl-cd-26/);
    expect(code).toMatch(/pb-cd-24/);
    expect(code).toMatch(/rounded-cd-16/);
    expect(code).toMatch(/overflow-hidden/);
    expect(spacing['cd-20']).toBe('20px');
    expect(spacing['cd-26']).toBe('26px');
    expect(spacing['cd-24']).toBe('24px');
    // Height is content-derived. A min-height would defeat the whole point of
    // the refinement, which is a 52% vertical reduction.
    expect(BAND).not.toMatch(/min-h-/);
    expect(BAND).not.toMatch(/\bh-\[(?!16px|40px)/);
  });

  it('the background is the released radial plus the 132px rule field, with NO flat fill', () => {
    expect(code).toMatch(/bg-cd-hiw\b/);
    expect(code).toMatch(/bg-cd-field-hiw/);
    expect(images['cd-hiw']).toBe(
      'radial-gradient(900px 300px at 20% 0%, rgba(11,50,96,.34), transparent 72%)',
    );
    expect(images['cd-field-hiw']).toBe(
      'repeating-linear-gradient(90deg, rgba(56,189,248,.04) 0 1px, transparent 1px 132px)',
    );
    // 132px is a genuinely new interval: Trending is 88px, Trust 110px.
    expect(images['cd-rules-trending']).toContain('88px');
    expect(images['cd-field-trust']).toContain('110px');
    // No opaque fill, so the page canvas's 56px grid stays visible through it.
    expect(BAND).not.toMatch(/bg-cd-void|bg-cd-trust\b|bg-surface/);
    expect(canvasSource).toMatch(/bg-cd-grid-page bg-cd-grid-56/);
  });

  it('the heading row shares ONE baseline — the largest space saving, and it must not re-stack', () => {
    expect(code).toMatch(/flex items-baseline gap-cd-18/);
    expect(spacing['cd-18']).toBe('18px');
    // The mono label never shrinks.
    const row = code.slice(code.indexOf('flex items-baseline'));
    expect(row).toMatch(/shrink-0 font-cd-mono uppercase text-cd-mono-section text-cd-ink-label/);
    // And the steps sit 20px below it.
    expect(code).toMatch(/mt-cd-20/);
  });

  it('the title is exactly 23px / 600 / 1.2 / -.01em', () => {
    expect(fonts['cd-hiw-title']).toEqual([
      '23px',
      { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '600' },
    ]);
    expect(code).toMatch(/text-cd-hiw-title/);
  });

  it('three equal columns at a 38px gap', () => {
    expect((code.match(/grid grid-cols-3 gap-cd-38/g) ?? [])).toHaveLength(2); // steps + rail overlay
    expect(spacing['cd-38']).toBe('38px');
  });
});

describe('M66.8d — computed geometry at the required viewports', () => {
  it('the released column width resolves to 420px at 1440', () => {
    // 3 x 420 + 2 x 38 = 1336 = 1388 - 52. The design publishes 420px.
    expect(columnWidth(1440)).toBeCloseTo(420, 5);
    expect(3 * columnWidth(1440) + 2 * COL_GAP).toBeCloseTo(1336, 5);
  });

  it('the body max-width is 400px and is load-bearing', () => {
    expect(code).toMatch(/max-w-\[400px\]/);
    // At 1440 the box is capped at 400 inside a 420 column, which is what
    // creates the clearance below.
    expect(bodyBoxWidth(1440)).toBe(400);
  });

  it('CTO decision D-c — the connector never crosses the body box where the band is active', () => {
    // Strictly positive, asserted at and above the gate. The >=100px figure in
    // the design's own acceptance table is measured to the TITLE, not to the
    // body box; see the next test.
    for (const viewport of [1408, 1440, 1500, 1600, 1920]) {
      expect(bodyClearance(viewport)).toBeGreaterThan(0);
    }
    expect(bodyClearance(1440)).toBeCloseTo(12, 5);
  });

  it('CTO decision D-c — the >=100px requirement is asserted against the TITLE, matching the design evidence', () => {
    // GN-CD-HIW-004: "title 01 ends at x=179, segment 1 starts at x=438
    // (259px clear); title 02 ends at x=700, segment 2 starts at x=896
    // (196px clear)." Both are measured to titles, and both clear 100px.
    // Titles live in the cluster text column, which the tile and its 13px gap
    // shorten; a title can therefore never reach the segment.
    // The title starts after the 40px tile and the 13px cluster gap, so its
    // right edge is 53 + its own width. Widths are 0.52-em ESTIMATES.
    const segmentLeft = columnWidth(1440) + SEGMENT_INSET;
    for (const language of ['en', 'pl'] as const) {
      const widest = Math.max(
        ...getDictionary(language).howItWorks.steps.map((step) => titleWidth(step.title)),
      );
      expect(segmentLeft - (40 + 13 + widest)).toBeGreaterThanOrEqual(100);
    }
    // The design's own measured figures agree: 259px and 196px of clearance.
    expect(segmentLeft).toBeCloseTo(412, 5);
  });

  it('CTO decision D-b — the released geometry does not fit any LOWER existing breakpoint, which is why the gate is cd-header', () => {
    // Clearance is a flat -8px for every column narrower than 400px, so it
    // only turns positive above a 1404px viewport. Recorded so the threshold
    // choice cannot later be "simplified" down to lg or cd-engine.
    for (const viewport of [1024, 1240, 1280, 1340]) {
      expect(bodyClearance(viewport)).toBeCloseTo(-8, 5);
    }
    expect(GATE_PX).toBe(1400);
  });

  it('GN-CD-HIW-006 — the Trust gap is 14px, and the 18px page rhythm is untouched', () => {
    expect(code).toMatch(/cd-header:mb-\[-4px\]/);
    expect(spacing['cd-18']).toBe('18px');
    expect(canvasSource).toMatch(/flex flex-col lg:gap-cd-18/);
    expect(18 - 4).toBe(14);
    // The exception is owned HERE, not by Trust — whose lg:mt-0 contract
    // trustGeometry.spec.ts asserts and this milestone must not disturb.
    expect(trustCode).toMatch(/lg:mt-0/);
    expect(trustCode).not.toMatch(/-mt-cd-/);
  });
});

describe('M66.8d — icon tiles and the connector rail (GN-CD-HIW-004)', () => {
  it('the tile is a true 40x40 OUTER box — the design contradiction, resolved', () => {
    // 40px + a 1px border without border-box renders 41.6px, putting the tile
    // centre 0.8px off the rail. The spec resolves this explicitly.
    expect(code).toMatch(/h-\[40px\] w-\[40px\] shrink-0 box-border/);
    expect(code).toMatch(/rounded-cd-11 border border-cd-edge-hiw-40 bg-cd-tile-hiw shadow-cd-tile-hiw-glow/);
    expect(cd['edge-hiw-40']).toBe('rgba(34,211,238,0.40)');
    expect(images['cd-tile-hiw']).toBe(
      'radial-gradient(circle at 50% 28%, rgba(16,58,104,.98), rgba(5,10,20,.98))',
    );
    expect(shadows['cd-tile-hiw-glow']).toBe('0 0 22px rgba(34,211,238,.14) inset');
  });

  it('the HIW tile and the Trust tile are deliberately NOT unified', () => {
    // GN-CD-HIW-004: "they are separate treatments in the released system."
    expect(images['cd-tile-hiw']).not.toBe(images['cd-tile-trust']);
    expect(shadows['cd-tile-hiw-glow']).not.toBe(shadows['cd-tile-glow']);
    expect(cd['edge-hiw-40']).not.toBe(cd['edge-tile']);
  });

  it('the rail Y equals the tile centre — top 20 = tile top + half of 40', () => {
    expect(code).toMatch(/absolute left-0 right-0 top-cd-20 grid grid-cols-3 gap-cd-38/);
    expect(Number.parseFloat(spacing['cd-20'])).toBe(40 / 2);
  });

  it('EXACTLY TWO connector segments, each 52x1px, and NO trailing segment after step 03', () => {
    expect(OVERLAY).toMatch(/\[0, 1\]\.map/);
    expect(OVERLAY).toMatch(/h-px w-\[52px\]/);
    expect(OVERLAY).toMatch(/bg-cd-rail-1/);
    expect(OVERLAY).toMatch(/bg-cd-rail-2/);
    // The third grid cell is present and empty.
    expect(OVERLAY).toMatch(/<div \/>/);
  });

  it('NO full-width connector exists in the new band', () => {
    // The single full-width rail was rejected during review because it struck
    // through the title text once the step number moved beside the icon.
    expect(BAND).not.toMatch(/left-0 right-0 h-px/);
    expect(BAND).not.toMatch(/h-0\.5/);
    expect(BAND).not.toMatch(/bg-gradient-to-r/);
    // Every 1px horizontal rule in the band is exactly 52px wide.
    const widths = BAND.match(/h-px w-\[(\d+)px\]/g) ?? [];
    expect(widths.length).toBeGreaterThan(0);
    for (const w of widths) expect(w).toBe('h-px w-[52px]');
  });

  it('exactly two arrowheads, 6x7px, each flush against the following tile', () => {
    expect(OVERLAY).toMatch(/right-\[-46px\] top-\[-3\.5px\] h-0 w-0 border-y-\[3\.5px\] border-l-\[6px\] border-y-transparent/);
    expect(OVERLAY).toMatch(/border-l-cd-edge-hiw-55/);
    expect(OVERLAY).toMatch(/border-l-cd-edge-hiw-sky-48/);
    expect(3.5 * 2).toBe(7);
  });

  it('segment 2 is cooler and dimmer than segment 1 — both values required, not normalised', () => {
    expect(images['cd-rail-1']).toBe(
      'linear-gradient(90deg, rgba(34,211,238,0), rgba(34,211,238,.5) 34%, rgba(34,211,238,.5))',
    );
    expect(images['cd-rail-2']).toBe(
      'linear-gradient(90deg, rgba(34,211,238,0), rgba(56,189,248,.42) 34%, rgba(56,189,248,.42))',
    );
    expect(cd['edge-hiw-sky-48']).toBe('rgba(56,189,248,0.48)');
    // Each fades in from alpha 0 at 34%, so it emerges from the preceding
    // column rather than starting with a hard cap.
    expect(images['cd-rail-1']).toContain('34%');
    expect(images['cd-rail-2']).toContain('34%');
  });

  it('the overlay is inert and no z-index was invented', () => {
    expect(OVERLAY_START).toBeGreaterThan(-1);
    expect(OVERLAY).toMatch(/pointer-events-none/);
    expect(code.slice(OVERLAY_START - 120, OVERLAY_START)).toMatch(/aria-hidden="true"/);
    // DOM order places the overlay beneath the steps and the tiles' opaque
    // radial occludes the overlap. GN-CD-HIW-004: "Do not add z-index — and do
    // not reorder these two children."
    expect(BAND).not.toMatch(/z-\d|z-\[/);
    expect(code.indexOf('top-cd-20')).toBeLessThan(code.indexOf('relative grid grid-cols-3'));
  });

  it('the three released glyphs are inline SVG, at the released stroke, and decorative', () => {
    expect(code).toMatch(/<circle cx="11" cy="11" r="6\.2" \/>/);
    expect(code).toMatch(/M15\.6 15\.6 L19\.4 19\.4/);
    expect(code).toMatch(/M12 4\.4 20 8\.6 12 12\.8 4 8\.6 Z/);
    expect(code).toMatch(/M4 12\.6 12 16\.8 20 12\.6/);
    expect(code).toMatch(/M4 16\.4 12 20\.6 20 16\.4/);
    expect(code).toMatch(/M12 7\.2c-2-1\.5-4\.2-1\.9-6\.6-1\.7v11c2\.4-\.2 4\.6\.2 6\.6 1\.7 2-1\.5 4\.2-1\.9 6\.6-1\.7v-11c-2\.4-\.2-4\.6\.2-6\.6 1\.7Z/);
    expect(code).toMatch(/M12 7\.2v10\.9/);
    expect(code).toMatch(/strokeWidth="1\.6"/);
    expect(code).toMatch(/stroke="#7dd3fc"/);
    expect(code).toMatch(/width="18"\s*\n?\s*height="18"/);
    // Not rasterised, not substituted with an icon-library equivalent.
    expect(BAND).not.toMatch(/lucide|<Icon|<img/);
  });
});

describe('M66.8d — copy, localization and step internals', () => {
  it('DOM order is Ask anything -> AI reads the coverage -> You get a clear answer', () => {
    const en = getDictionary('en').howItWorks;
    expect(en.steps.map((s) => s.title)).toEqual([
      'Ask anything',
      'AI reads the coverage',
      'You get a clear answer',
    ]);
    expect(processSteps.map((s) => s.step)).toEqual(['01', '02', '03']);
    expect(code).toMatch(/processSteps\.map\(\(item, index\) => \{/);
  });

  it('CTO decision D-1 A — the STEP prefix is localized, never hardcoded', () => {
    expect(getDictionary('en').howItWorks.stepPrefix).toBe('STEP');
    expect(getDictionary('pl').howItWorks.stepPrefix).toBe('KROK');
    expect(code).toMatch(/\{t\.stepPrefix\} \{item\.step\}/);
    // No English literal anywhere in the component.
    expect(code).not.toMatch(/'STEP'|"STEP"|>STEP</);
  });

  it('the numerals come from the EXISTING language-independent data, unchanged', () => {
    expect(processSteps).toHaveLength(3);
    expect(getDictionary('pl').howItWorks.steps).toHaveLength(3);
    // Every visible string still resolves through the dictionary.
    expect(code).toMatch(/localized\?\.title \?\? item\.title/);
    expect(code).toMatch(/localized\?\.description \?\? item\.description/);
    expect(code).toMatch(/\{t\.label\}/);
    expect(code).toMatch(/\{t\.headline\}/);
  });

  it('no existing copy was rewritten — the bodies keep their typographic punctuation', () => {
    const en = getDictionary('en').howItWorks;
    expect(en.steps[0].description).toContain('’'); // you’d
    expect(en.steps[0].description).toContain('—'); // em dash
    expect(en.steps[2].description).toContain('—');
    expect(en.headline).toBe('From question to clarity, in three steps');
    expect(getDictionary('pl').howItWorks.headline).not.toBe(en.headline);
  });

  it('CTO decision D-f — the eyebrow keeps the CSS uppercase mechanism, and its stored strings are untouched', () => {
    expect(code).toMatch(/font-cd-mono uppercase text-cd-mono-section/);
    expect(getDictionary('en').howItWorks.label).toBe('How it works');
    expect(getDictionary('pl').howItWorks.label).toBe('Jak to działa');
    expect(fonts['cd-mono-section']).toEqual(['12px', { letterSpacing: '0.18em' }]);
  });

  it('the released step internals: number above title at 3px, cluster to body at 11px, gap 13', () => {
    expect(code).toMatch(/flex items-center gap-cd-13/);
    expect(code).toMatch(/mt-cd-3 font-cd-display text-cd-hiw-step-title/);
    expect(code).toMatch(/mt-cd-11 max-w-\[400px\]/);
    expect(spacing['cd-13']).toBe('13px');
    expect(spacing['cd-3']).toBe('3px');
    expect(spacing['cd-11']).toBe('11px');
    // min-width:0 so a long title ellipsises rather than overflowing the track.
    expect(code).toMatch(/className="min-w-0"/);
  });

  it('the released body type: 12.5px / 1.55 with text-wrap pretty', () => {
    // `cd-trust-body` is 12.5px but line-height 1.5; the released value is
    // 1.55, and the approved token table is closed at 14 keys, so the size and
    // line-height are declared directly rather than reusing a near-miss token.
    expect(code).toMatch(/text-\[12\.5px\] leading-\[1\.55\]/);
    expect(code).toMatch(/text-pretty/);
    expect(fonts['cd-trust-body']).toEqual(['12.5px', { lineHeight: '1.5', fontWeight: '400' }]);
  });

  it('the step titles are 15.5px / 600 / 1.3 — not the 15.5px/1.65/400 that already existed', () => {
    expect(fonts['cd-hiw-step-title']).toEqual(['15.5px', { lineHeight: '1.3', fontWeight: '600' }]);
    expect(fonts['cd-summary']).toEqual(['15.5px', { lineHeight: '1.65', fontWeight: '400' }]);
  });
});

describe('M66.8d — accessibility', () => {
  it('CTO decision D-2 — the section title is a real <h2>, and the eyebrow is not a heading', () => {
    // One <h2> per composition, each with a UNIQUE id so the document never
    // carries a duplicate. The section's aria-labelledby is unchanged.
    expect(code).toMatch(/<h2\s+id="how-it-works-heading-cd"/);
    expect(code).toMatch(/id="how-it-works-heading"/);
    expect(code).toMatch(/aria-labelledby="how-it-works-heading"/);
    expect((code.match(/id="how-it-works-heading"/g) ?? [])).toHaveLength(1);
    expect((code.match(/id="how-it-works-heading-cd"/g) ?? [])).toHaveLength(1);
    // The eyebrow is a <span>, never a heading level.
    const row = code.slice(code.indexOf('flex items-baseline'));
    expect(row.slice(0, row.indexOf('</span>'))).toMatch(/<span/);
    expect(code).not.toMatch(/<h1/);
  });

  it('the step titles are <h3>, one level below the section heading', () => {
    expect((code.match(/<h3/g) ?? [])).toHaveLength(2); // one per composition
  });

  it('CTO decision D-a — the step number ships #5b9fd0, NOT the released #5b7fa6 that fails SC 1.4.3', () => {
    // Measured 3.91:1 against the real six-layer composite; 9.5px is not
    // large-scale text, so AA requires 4.5:1. ink.core-sub measures 5.69:1.
    // The step number is the accessible mechanism for step ORDER, so it
    // cannot be sub-threshold. An EXISTING released token — no invented colour.
    expect(code).toMatch(/text-cd-ink-core-sub/);
    expect(code).not.toMatch(/5b7fa6|ink-meta/);
    const ink = (cd.ink ?? {}) as unknown as Record<string, string>;
    expect(ink['core-sub']).toBe('#5b9fd0');
    expect(ink.meta).toBe('#5b7fa6');
    expect(fonts['cd-mono-step']).toEqual(['9.5px', { letterSpacing: '0.18em' }]);
  });

  it('every decorative element in the band is hidden from assistive technology', () => {
    // EIGHT in source, because the tile and its glyph are inside a .map:
    //   1 rule field + 4 corner brackets + 1 rail overlay + 1 tile + 1 svg.
    expect((BAND.match(/aria-hidden="true"/g) ?? [])).toHaveLength(8);
    expect(BAND).toMatch(/aria-hidden="true" className="pointer-events-none absolute inset-0 bg-cd-field-hiw/);
    expect(BAND).toMatch(/focusable="false"/);
    // Nothing decorative escapes: no bare <svg> or bracket without the attribute.
    expect((BAND.match(/<svg/g) ?? [])).toHaveLength(1);
    expect((BAND.match(/h-\[16px\] w-\[16px\]/g) ?? [])).toHaveLength(4);
  });

  it('NOTHING in the band is interactive — no handler, link, role or tab stop', () => {
    for (const forbidden of [
      /onClick/, /onMouse/, /onKey/, /onFocus/,
      /href=/, /role="link"/, /role="button"/, /tabIndex/,
      /cursor-pointer/, /hover:/, /focus:/, /focus-visible:/,
    ]) {
      expect(BAND).not.toMatch(forbidden);
    }
  });

  it('CTO decision D-e — ZERO animation or transition in the new band subtree', () => {
    expect(BAND).not.toMatch(/@keyframes|animation:|\banimate-|transition|duration-|ease-/);
    // Nothing to suppress, so the band is identical under reduced motion.
    // (The legacy composition keeps its own motion and its own
    // prefers-reduced-motion handling — CTO decision D-4 requires it.)
  });

  it('no data, fetch or API behaviour — this section consumes no application data', () => {
    expect(code).not.toMatch(/\bfetch\(/);
    expect(code).not.toMatch(/useState|useEffect|useRef/);
    expect(code).not.toMatch(/'use client'/);
    expect(code).not.toMatch(/api\/|Api\(/);
  });
});

describe('M66.8d — the legacy composition is preserved, and the two cannot leak', () => {
  it('CTO decision D-4 — the pre-M66.8d markup is retained verbatim', () => {
    // Every load-bearing string from the previous implementation.
    expect(code).toMatch(/border-b border-border bg-surface\/40/);
    expect(code).toMatch(/hudCornerBracketClassName\('top-left'\)/);
    expect(code).toMatch(/hudCornerBracketClassName\('top-right'\)/);
    expect(code).toMatch(/mx-auto max-w-\[1480px\] px-4 py-8 sm:px-6 sm:py-10 lg:px-8/);
    expect(code).toMatch(/grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-5/);
    expect(code).toMatch(/absolute left-0 right-0 top-5 hidden sm:block/);
    expect(source).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(source).toMatch(/animation: none !important/);
    expect(code).toMatch(/h-11 w-11 items-center justify-center rounded-xl border border-cyan-500\/40/);
  });

  it('the new band cannot render below the gate, and the legacy cannot render at or above it', () => {
    expect(BAND_START).toBeGreaterThan(-1);
    // Legacy: hidden at the gate — two brackets and the container.
    expect((LEGACY.match(/cd-header:hidden/g) ?? [])).toHaveLength(3);
    // Band: hidden below the gate, shown at it.
    expect(BAND).toMatch(/^relative hidden overflow-hidden[^"]*cd-header:block/);
    // Nothing inside the band opts in at any lower breakpoint.
    expect(BAND).not.toMatch(/\b(sm|md|lg|xl|2xl|cd-hero|cd-engine):/);
    // ...and nothing in the legacy half uses the gate to become visible.
    expect(LEGACY).not.toMatch(/cd-header:block|cd-header:flex|cd-header:grid/);
  });

  it('exactly one gate is used, and no new breakpoint was created', () => {
    const prefixes = new Set(
      (code.match(/\b(sm|md|lg|xl|2xl|cd-header|cd-hero|cd-engine|cd-copy|cd-pill|cd-touch):/g) ?? []).map((p) =>
        p.replace(':', ''),
      ),
    );
    // `sm:` and `lg:` both belong to the RETAINED legacy composition
    // (`sm:px-6 sm:py-10 sm:grid-cols-3 sm:gap-5 sm:mb-5 sm:text-2xl` and
    // `lg:px-8`); `cd-header` is the one gate this milestone introduces.
    expect([...prefixes].sort()).toEqual(['cd-header', 'lg', 'sm']);
    expect(BAND).not.toMatch(/\blg:/);
    expect(BAND).not.toMatch(/\bsm:/);
    expect(screens['cd-header']).toBe('1400px');
    // M66.1 decision D4 stands: no minimum WIDTH FLOOR is reintroduced.
    // `min-w-0` is legitimate and required — GN-CD-HIW-002 puts it on the
    // cluster text column so a long title ellipsises rather than overflowing
    // the grid track. What must never come back is a px floor.
    expect(code).toMatch(/min-w-0/);
    expect(code).not.toMatch(/min-w-\[\d/);
    expect(code).not.toMatch(/min-w-cd-/);
    // Comment-stripped: this file and the component both DISCUSS 1360 at
    // length in order to explain why it is absent.
    expect(code).not.toMatch(/1360/);
  });

  it('CTO decision D-d — the legacy rail stays in the DOM for the preserved composition, and is display:none at desktop', () => {
    // Conditional rendering is impossible: this is a Server Component with no
    // viewport knowledge, and D-4 requires the rail below the gate. It is
    // removed from the rendered and accessibility trees at desktop by the
    // container's `cd-header:hidden`, which is what "no full-width rail"
    // means in practice here.
    const bandStart = code.indexOf('rounded-cd-16');
    const legacy = code.slice(0, bandStart);
    expect(legacy).toMatch(/absolute left-0 right-0 top-5 hidden sm:block/);
    expect(legacy).toMatch(/max-w-\[1480px\][^"]*cd-header:hidden/);
  });
});

describe('M66.8d — scope discipline', () => {
  it('Trust changed in exactly ONE place', () => {
    expect(trustCode).toMatch(/mt-cd-5 font-cd-display text-cd-trust-subhead text-cd-ink-primary/);
    expect(fonts['cd-trust-subhead']).toEqual(['14px', { lineHeight: '1.32', fontWeight: '600' }]);
    expect(spacing['cd-5']).toBe('5px');
    // Everything else in Trust, re-confirmed against GN-CD-180..185.
    expect(trustCode).toMatch(/lg:rounded-cd-16/);
    expect(trustCode).toMatch(/lg:border-cd-edge-section/);
    expect(trustCode).toMatch(/lg:bg-cd-trust/);
    expect(trustCode).toMatch(/lg:px-cd-20 lg:pb-cd-22 lg:pt-cd-18/);
    expect(trustCode).toMatch(/lg:grid-cols-5 lg:gap-cd-16/);
    expect(trustCode).toMatch(/bg-cd-field-trust/);
    expect(trustCode).toMatch(/id="trust-heading"/);
  });

  it('cd-card-head was NOT repointed — TrendingCard shares it', () => {
    expect(fonts['cd-card-head']).toEqual(['13px', { lineHeight: '1.32', fontWeight: '600' }]);
    expect(fonts['cd-trust-subhead']).not.toEqual(fonts['cd-card-head']);
  });

  it('no token was filed under hud-, whose ladder is capped at alpha .22', () => {
    for (const key of Object.keys(cd)) {
      if (!key.startsWith('hud-')) continue;
      expect(key).toMatch(/^hud-(sky|cyan)-\d{2}$/);
    }
    expect(cd['hud-hiw-55']).toBeUndefined();
    // rgba(34,211,238,0.55) also exists as hub-core; the Engine token is
    // deliberately not borrowed for a How It Works bracket.
    expect(cd['hub-core']).toBe('rgba(34,211,238,0.55)');
    expect(code).not.toMatch(/hub-core/);
  });

  it('exactly 14 keys were added, and no spacing token among them', () => {
    for (const key of ['cd-hiw-title', 'cd-hiw-step-title', 'cd-mono-step', 'cd-trust-subhead']) {
      expect(fonts[key]).toBeDefined();
    }
    for (const key of ['edge-hiw-55', 'edge-hiw-25', 'edge-hiw-40', 'edge-hiw-sky-48']) {
      expect(cd[key]).toBeDefined();
    }
    for (const key of ['cd-hiw', 'cd-field-hiw', 'cd-tile-hiw', 'cd-rail-1', 'cd-rail-2']) {
      expect(images[key]).toBeDefined();
    }
    expect(shadows['cd-tile-hiw-glow']).toBeDefined();
    // 40px and 52px are component dimensions, not rhythm steps.
    expect(spacing['cd-40']).toBeUndefined();
    expect(spacing['cd-52']).toBeUndefined();
    expect(code).toMatch(/h-\[40px\] w-\[40px\]/);
    expect(code).toMatch(/w-\[52px\]/);
  });

  it('the homepage composition and PageCanvas are untouched', () => {
    expect(pageSource).toMatch(/<HowItWorks language=\{language\} \/>/);
    expect(pageSource).toMatch(/<main className="pb-16 lg:pb-0">/);
    expect(pageSource.indexOf('<HowItWorks')).toBeLessThan(pageSource.indexOf('<TrustSection'));
    expect(canvasSource).toMatch(
      /relative mx-auto w-full max-w-cd-page px-cd-14 pb-cd-22 pt-cd-12 lg:px-cd-26 lg:pb-cd-60 lg:pt-cd-20/,
    );
  });

  it('no route, API or mobile chrome concern leaked into this milestone', () => {
    expect(code).not.toMatch(/HomepageSituationMap|VIEW ALL|MobileBottomNav|LanguageSelector/);
    expect(code).not.toMatch(/href="\//);
  });
});
