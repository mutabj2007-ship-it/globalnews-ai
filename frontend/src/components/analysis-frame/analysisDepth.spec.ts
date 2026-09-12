import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AnalysisApiResponse } from '@globalnews-ai/shared';
import { AnalysisFrameSurface } from './AnalysisFrameSurface';
import { splitSynthesisParagraphs } from './briefModel';
import { fixture } from './frameFixtures';

/**
 * H-ALPHA-VISUAL-1 ADDENDUM — ANALYSIS DEPTH PRESENTATION.
 *
 * H-1  `analysis.summary` must not be rendered in the persistent band AND
 *      the Executive Brief at the same time.
 * H-2  the Executive Brief must expose the FULL synthesis — Main's 3-5
 *      and 6+ reports are multi-paragraph — and must not hide it behind
 *      an unconditional clamp.
 */

const src = (name: string): string => readFileSync(join(__dirname, name), 'utf8');
const codeOnly = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Three paragraphs, as a 6+ report synthesis would arrive. */
const P1 = 'PARA_ONE opens the synthesis and runs to a couple of sentences.';
const P2 = 'PARA_TWO carries the second movement of the argument.';
const P3 = 'PARA_THREE closes on what remains unresolved.';
const MULTI = `${P1}\n\n${P2}\n\n${P3}`;

const withSummary = (summary: string): AnalysisApiResponse => {
  const base = fixture();
  return {
    ...base,
    analysis: { ...(base.analysis as object), summary },
  } as AnalysisApiResponse;
};

const VIEWPORTS = [
  { name: '1440x900 desktop', width: 1440, height: 900 },
  { name: '1280x800 desktop', width: 1280, height: 800 },
  { name: '768x800 tablet', width: 768, height: 800 },
  { name: '390x844 phone', width: 390, height: 844 },
  { name: '375x844 phone', width: 375, height: 844 },
] as const;

const render = (response: AnalysisApiResponse, width: number, height: number): string =>
  renderToStaticMarkup(
    createElement(AnalysisFrameSurface as never, {
      response,
      initialViewport: { width, height },
      language: 'en',
    } as never),
  );

const band = (html: string): string =>
  html.slice(html.indexOf('data-paf="brief-row"'), html.indexOf('data-paf="centre-viewport"'));

/* ── H-1 ──────────────────────────────────────────────────────────── */
describe('H-1 — the summary is never in two places at once', () => {
  it.each(VIEWPORTS)('$name — the persistent band does not carry the summary', ({ width, height }) => {
    const html = render(withSummary(MULTI), width, height);
    expect(band(html)).not.toContain(P1);
    expect(band(html)).not.toContain(P2);
    /*
      The band still orients: headline and retrieval telemetry at every
      width, and evidence strength on DESKTOP.

      RETARGETED AT THE H-C2 MICRO-CLOSURE, AND DECLARED. DESIGN-C2 Lock 6
      ranks the trust summary BELOW the answer's first paragraph on phone —
      "never above it" — and permits the band only on desktop, where there
      is room and it displaces nothing. H-1's own invariant (the summary
      PARAGRAPHS are never duplicated into the band) is untouched and is the
      first two assertions above; what moved is one orientation line, by
      instruction.
    */
    expect(band(html)).toContain('data-paf="thesis-title"');
    const isPhone = width < 768;
    if (isPhone) {
      expect(band(html)).not.toContain('data-paf="evidence-word"');
      expect(html).toMatch(/data-paf="trust-summary" data-placement="reading"/);
    } else {
      expect(band(html)).toContain('data-paf="evidence-word"');
    }
  });

  it.each(VIEWPORTS)('$name — the summary text appears exactly once in the document', ({ width, height }) => {
    const html = render(withSummary(MULTI), width, height);
    for (const para of [P1, P2, P3]) {
      const count = html.split(para).length - 1;
      expect({ para: para.slice(0, 9), count }).toEqual({ para: para.slice(0, 9), count: 1 });
    }
  });

  it('the band component no longer references the paragraph at all', () => {
    expect(codeOnly(src('BriefRow.tsx'))).not.toMatch(/brief\.paragraph/);
  });

  it('the question and the index survive the change', () => {
    const html = render(withSummary(MULTI), 1440, 900);
    expect(html).toContain('data-paf="analysis-question-text"');
    expect(html).toContain('data-paf="index-column"');
    expect(html).toContain('data-paf="complete-record-entry"');
  });
});

/* ── H-2 ──────────────────────────────────────────────────────────── */
describe('H-2 — the Executive Brief exposes the whole synthesis', () => {
  it('splitting is layout-only: rejoining returns the input exactly', () => {
    expect(splitSynthesisParagraphs(MULTI).join('\n\n')).toBe(MULTI);
    expect(splitSynthesisParagraphs(P1)).toEqual([P1]);
    expect(splitSynthesisParagraphs('')).toEqual(['']);
  });

  it('nothing is re-summarised, sliced or reordered', () => {
    const parts = splitSynthesisParagraphs(MULTI);
    expect(parts).toEqual([P1, P2, P3]);
    expect(codeOnly(src('briefModel.ts'))).not.toMatch(/slice\(0,|substring|\.\.\.|truncat/i);
  });

  it.each(VIEWPORTS)('$name — every paragraph of a 6+ report synthesis is rendered', ({ width, height }) => {
    const html = render(withSummary(MULTI), width, height);
    const centre = html.slice(html.indexOf('data-paf="centre-viewport"'));
    for (const para of [P1, P2, P3]) expect(centre).toContain(para);
    expect((centre.match(/data-paf="brief-synthesis-paragraph"/g) ?? []).length).toBe(3);
  });

  it.each(VIEWPORTS)('$name — the synthesis carries no clamp at any viewport', ({ width, height }) => {
    const html = render(withSummary(MULTI), width, height);
    const synthesis = html.slice(
      html.indexOf('data-paf="brief-synthesis"'),
      html.indexOf('data-paf="location-detail-track"'),
    );
    /*
      SCOPE CORRECTION, DECLARED — H-C2 MICRO-CLOSURE.

      H-2's invariant is that THE SYNTHESIS is never clamped. DESIGN-C2
      Lock 6 places the phone trust summary inside this region, after the
      first paragraph, and that line legitimately carries `max-h-[24px]`
      (Lock 6's height ceiling) and `truncate` on its counts. Neither
      touches a paragraph.

      Rather than loosening the pattern, the trust summary is REMOVED from
      the region and the original assertion is then applied unchanged — so
      nothing else inside the synthesis may clamp anything, and the
      exception is exactly one named element. The paragraphs are also
      asserted individually below, which is the invariant itself.
    */
    /* The trust line contains only <span> children, so the first </div>
       after its opening tag is its own close. */
    const withoutTrustLine = synthesis.replace(
      /<div data-paf="trust-summary"[\s\S]*?<\/div>/,
      '',
    );
    expect(withoutTrustLine).not.toMatch(/line-clamp|truncate|max-h-\[/);
    for (const para of synthesis.match(/<p data-paf="brief-synthesis-paragraph"[^>]*>/g) ?? []) {
      expect(para).not.toMatch(/line-clamp|truncate|max-h-\[/);
    }
  });

  it('a single-paragraph summary is unchanged — one paragraph, same text', () => {
    const html = render(withSummary(P1), 1440, 900);
    const centre = html.slice(html.indexOf('data-paf="centre-viewport"'));
    expect((centre.match(/data-paf="brief-synthesis-paragraph"/g) ?? []).length).toBe(1);
    expect(centre).toContain(P1);
  });
});
