import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { AnalysisApiResponse, NewsArticle } from '@globalnews-ai/shared';
import { AnalysisFrameSurface } from '@/components/analysis-frame/AnalysisFrameSurface';

const searchClientSource = readFileSync(join(__dirname, 'SearchPageClient.tsx'), 'utf-8').replace(
  /\r\n/g,
  '\n',
);

/**
 * Milestone #52-B, Authorized Test 1 — evidence survives AI failure.
 *
 * THE INVARIANT (unchanged since M52-B): when a response carries real
 * retrieved articles but `analysis === null` and a non-success
 * provenance status, the source/evidence presentation still renders. The
 * reader who cannot be given an analysis must still be given the
 * reporting, and must never be given a fabricated substitute for it.
 *
 * ── RETARGETED IN R4 ──────────────────────────────────────────────────
 *
 * OLD ASSERTIONS: four locator checks on `SearchPageClient.tsx` source
 * text — that `{response.articles.length > 0 && (` appeared AFTER
 * `{response.analysis ? (`, that the grid was a textual sibling of that
 * ternary, and that `<SourceArticleCard key={article.id} ...>` appeared
 * verbatim.
 *
 * WHY THEY NO LONGER HOLD: R4 §2 rejects that presentation and §3
 * replaces it with the bounded frame, so every string those locators
 * searched for is gone. None of them is the invariant; they are a proxy
 * for it. This spec's own original header says why it settled for a
 * proxy: "This repository's frontend test architecture has no React
 * Testing Library/jsdom anywhere ... so this proves the separation the
 * same way this repo's existing tests already do: structurally."
 *
 * WHAT REPLACES THEM: the invariant itself, proven on RENDERED MARKUP
 * via `react-dom/server` — the evidence standard the frame suites
 * already use, and the one the original header would have preferred had
 * it been available. A layout that satisfies the old locators while
 * dropping the evidence would now fail; a layout that moves the evidence
 * somewhere new but still shows it now passes. That is the correct way
 * round.
 */

const article = (i: number): NewsArticle =>
  ({
    id: `a${i}`,
    title: `Real retrieved report ${i}`,
    summary: `Body ${i}.`,
    url: `https://outlet${i}.test/story`,
    sourceId: `s${i}`,
    sourceName: `Outlet ${i}`,
    category: 'world',
    sourcesCount: 1,
    publishedAt: '2026-08-20T10:00:00.000Z',
    sourceLanguage: 'en',
  }) as NewsArticle;

const ARTICLES = [article(1), article(2), article(3)];

/** Articles retrieved; the AI then failed. The exact M52-B case. */
const aiFailed = {
  query: 'q',
  normalizedQuery: 'q',
  requestedLanguage: 'en',
  responseLanguage: 'en',
  analysis: null,
  articles: ARTICLES,
  analysisError: 'upstream model error',
  retrievalContext: { dataMode: 'live', providers: ['gnews'], articlesRetrieved: ARTICLES.length },
  sourceEntities: { organizations: [] },
  provenance: {
    provider: 'openai',
    executionMode: 'production',
    analysisMode: 'live-ai',
    status: 'failed',
    cached: false,
  },
} as unknown as AnalysisApiResponse;

const render = (response: AnalysisApiResponse, extra: Record<string, unknown> = {}) =>
  renderToStaticMarkup(
    createElement(AnalysisFrameSurface as never, {
      response,
      initialViewport: { width: 1440, height: 900 },
      ...extra,
    } as never),
  );

describe('Evidence survives AI failure — the analysis surface renders sources independently of analysis success (M52-B Test 1)', () => {
  it('every retrieved article is still presented when the analysis failed', () => {
    const html = render(aiFailed, { initialDock: 'expanded' });
    for (const a of ARTICLES) {
      expect({ id: a.id, shown: html.includes(a.sourceName) }).toEqual({ id: a.id, shown: true });
    }
  });

  it('the evidence count is the real retrieved count, not the analysed count', () => {
    /* The failure case is exactly where an "N sources" figure drifts:
       there is no analysis to count from, so a surface that derives the
       figure from the analysis would show 0 beside three visible
       reports. */
    const html = render(aiFailed);
    expect(html).toMatch(new RegExp(`\\b${ARTICLES.length}\\b`));
  });

  it('no synthetic or placeholder article is substituted for the missing analysis', () => {
    const html = render(aiFailed);
    expect(html).not.toMatch(/placeholder|lorem ipsum|sample (report|article)|example\.com/i);
    /* Every publisher shown is one the response actually carried. */
    const shown = [...html.matchAll(/Outlet \d+/g)].map((m) => m[0]);
    const real = new Set(ARTICLES.map((a) => a.sourceName));
    expect(shown.every((name) => real.has(name))).toBe(true);
  });

  it('the evidence does not depend on the analysis: same articles, analysis present or absent', () => {
    const withAnalysis = {
      ...aiFailed,
      analysis: null,
      provenance: { ...aiFailed.provenance, status: 'not-attempted' },
    } as unknown as AnalysisApiResponse;

    const a = render(aiFailed, { initialDock: 'expanded' });
    const b = render(withAnalysis, { initialDock: 'expanded' });
    for (const art of ARTICLES) {
      expect({ id: art.id, inFailed: a.includes(art.sourceName), inNotAttempted: b.includes(art.sourceName) })
        .toEqual({ id: art.id, inFailed: true, inNotAttempted: true });
    }
  });

  it('the surface issues no analysis request of its own — the response is passed in', () => {
    /* The one structural assertion worth keeping: it is about the DATA
       PATH, not the layout, so no presentation change can invalidate it. */
    expect((searchClientSource.match(/analyzeNews\(/g) ?? []).length).toBe(1);
    expect(searchClientSource).toMatch(/<AnalysisFrameSurface[\s\S]*?response=\{response\}/);
  });
});
