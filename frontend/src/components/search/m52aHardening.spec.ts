import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AnalysisApiResponse, NewsArticle } from '@globalnews-ai/shared';
import { AnalysisFrameSurface } from '@/components/analysis-frame/AnalysisFrameSurface';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { fixture } from '@/components/analysis-frame/frameFixtures';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * I3 — the source is read with line endings normalized to LF in memory.
 *
 * This checkout is CRLF while the committed blob is LF. Every locator below
 * reasons about source STRUCTURE, never about EOL convention, so the two must
 * not be coupled. This normalizes ONLY the in-memory copy these assertions
 * read: no repository file is modified and no working-tree EOL normalization
 * is performed.
 */
const searchClientSource = readFileSync(join(__dirname, 'SearchPageClient.tsx'), 'utf-8').replace(
  /\r\n/g,
  '\n',
);

/**
 * Milestone #52-A — hardening the already-working M51 Map -> Story ->
 * Q&A journey. Behavioral tests only, per the explicit "prefer
 * behavior tests over brittle CSS-string tests" instruction.
 */
/*
 * ASK AI REV A §4.2 RETARGET — the dep list gained `storyTitle`.
 *
 * The INVARIANT this file pins is unchanged and is the reason the
 * assertion is written against the dep list at all: the memo is keyed on
 * URL-derived PRIMITIVES ONLY and never on `language`. Rev A adds one
 * more URL primitive — `storyTitle`, the transport that stops the
 * follow-up from becoming the story title — so the correct expression of
 * the same rule now names four params, not three. Nothing about
 * language-independence is relaxed; `not.toMatch(/\blanguage\b/)` below
 * still carries it.
 */
describe('A. storyContext is stable across renders (real lint defect found and fixed)', () => {
  it('storyContext is memoized with useMemo, not a fresh object literal every render', () => {
    // ASK/SEARCH R1 — useRef joins for the per-instance consent claim.
    expect(searchClientSource).toMatch(/import \{ useEffect, useMemo, useRef, useState \} from 'react'/);
    expect(searchClientSource).toMatch(/const storyContext: StoryContext \| undefined = useMemo\(/);
  });

  it('useMemo is keyed on the real primitive inputs (query, countryCodeParam, articleIdParam) \u2014 the smallest set that actually determines storyContext\u2019s content', () => {
    expect(searchClientSource).toMatch(/\[query, storyTitleParam, countryCodeParam, articleIdParam\],\s*\n\s*\);/);
  });

  it('the analysis effect honestly lists storyContext in its own dependency array \u2014 no eslint-disable directive, no suppressed exhaustive-deps rule', () => {
    expect(searchClientSource).not.toMatch(/\/\/\s*eslint-disable|\/\*\s*eslint-disable/);
    // M65 — the dependency array changed for one honest reason: the
    // empty-query branch no longer renders dictionary.noQuestionMessage
    // as an error (queryless /search is now a usable research
    // workspace), and the catch branch now selects a localized message
    // from the whole dictionary rather than one fixed string. The
    // contract this test exists to protect — an honest, complete
    // dependency array with no suppressed rule — is unchanged and is
    // still asserted above.
    // ASK/SEARCH R1 — two more honest members: the request identity and
    // the consent held for it, because arrival no longer implies compute.
    expect(searchClientSource).toMatch(
      /\}, \[query, language, hasResolvedLanguage, dictionary, storyContext, requestKey, consentedKey\]\);/,
    );
  });

  it('the effect body still only reads storyContext (not countryCodeParam/articleIdParam directly), so the memoized value is the single source of truth for the request', () => {
    /*
      Anchored on the effect's own dependency array, then walked backwards to
      the nearest enclosing `useEffect(() => {`.

      The previous form anchored on the literal comment text
      `// Milestone #47` with exact indentation and an LF newline, so on a CRLF
      checkout indexOf() returned -1; slice(-1, end) then inverted its range
      and produced an empty string. The assertion failed while the production
      effect it describes was entirely correct.
    */
    const effectEnd = searchClientSource.indexOf('}, [query, language, hasResolvedLanguage');
    const effectStart = searchClientSource.lastIndexOf('useEffect(() => {', effectEnd);
    expect(effectStart).toBeGreaterThan(-1);
    expect(effectEnd).toBeGreaterThan(effectStart);

    const effectBody = searchClientSource.slice(effectStart, effectEnd);
    expect(effectBody).toMatch(/analyzeNews\(query, language, storyContext\)/);

    // The memoized storyContext is the single source of truth for the request,
    // so the effect must not read the raw params directly. This test's title
    // has always claimed exactly that; now it is actually asserted.
    expect(effectBody).not.toMatch(/\bcountryCodeParam\b/);
    expect(effectBody).not.toMatch(/\barticleIdParam\b/);
  });
});

describe('B. Generic query without storyContext still works (no regression from memoization)', () => {
  it('storyContext resolves to undefined when the URL carries NO story parameter at all, exactly as before this round', () => {
    /*
     * ── RETARGETED BY THE ARTICLE-ANCHOR REPAIR ──────────────────────
     *
     * OLD: a regex pinning the exact expression
     *   `countryCodeParam ? { title, countryCode, articleId ?? undefined } : undefined`
     *
     * WHY IT NO LONGER HOLDS: that expression discarded `articleId`
     * whenever `countryCode` was absent, which stripped the story anchor
     * from the request and made the same story populate in Polish and
     * come back empty in English. The CTO authorised replacing it.
     *
     * WHAT THIS TEST WAS ACTUALLY FOR — its own title: a generic query
     * with NO story parameters still resolves to `undefined`. That is
     * unchanged and is asserted here directly, on the rule rather than on
     * its formatting. `articleAnchorParity.spec.ts` covers the rest of
     * the truth table.
     */
    expect(searchClientSource).toMatch(
      /articleIdParam !== null \|\| countryCodeParam !== null/,
    );
    expect(searchClientSource).toMatch(/:\s*undefined,\s*\n\s*\[query, storyTitleParam, countryCodeParam, articleIdParam\],/);
  });
});

describe('F. Stale-response protection across rapid navigation (Story A -> Story B)', () => {
  it('the effect uses a cancelled flag set in its cleanup function, so a slower Story A response can never overwrite a newer Story B\u2019s state once the effect has re-run', () => {
    expect(searchClientSource).toMatch(/let cancelled = false;/);
    expect(searchClientSource).toMatch(/return \(\) => \{\s*\n\s*cancelled = true;\s*\n\s*\};/);
  });

  it('every state-setting callback checks the cancelled flag before writing state', () => {
    expect(searchClientSource).toMatch(/if \(!cancelled\) setResponse\(result\);/);
    expect(searchClientSource).toMatch(/if \(cancelled\) return;/);
    expect(searchClientSource).toMatch(/if \(!cancelled\) setIsLoading\(false\);/);
  });

  it('the effect now correctly re-runs when storyContext changes (memoized identity change reflects a real content change) \u2014 this is what actually triggers the cancel-and-restart behavior between two different stories', () => {
    expect(searchClientSource).toMatch(/storyContext, requestKey, consentedKey\]\);/);
  });
});

/*
 * ── G RETARGETED IN R4 ────────────────────────────────────────────────
 *
 * OLD ASSERTIONS: three locators on `SearchPageClient.tsx` source text —
 * the literal `response.provenance.status === 'not-attempted'`, the
 * literal `<AnalysisModeBadge provenance={response.provenance}
 * language={language} />`, and the literal `{response.articles.map(...`.
 *
 * WHY THEY NO LONGER HOLD: R4 §2 rejects that document and §3 replaces
 * it with the bounded frame, so all three literals moved out of this
 * file. The INVARIANTS did not move, and are restated below against
 * rendered markup — which is what "never bypassed" was always about.
 *
 * WHAT THIS CAUGHT. The middle assertion was not stale: it found a real
 * regression. Mounting the frame put live-vs-mock labelling only inside
 * Complete Record, one control away from a reader with no reason to
 * press it — a mock analysis would have read exactly like a live one.
 * `AnalysisModeBadge` was moved into the frame's persistent command bar
 * in response. The test earned its keep; it is retargeted, not relaxed.
 */
describe('G. Evidence/citation integrity and demo-mode labeling remain governed by the existing, single response contract', () => {
  const article = (i: number): NewsArticle =>
    ({
      id: `a${i}`, title: `Report ${i}`, summary: `Body ${i}.`,
      url: `https://outlet${i}.test/s`, sourceId: `s${i}`, sourceName: `Outlet ${i}`,
      category: 'world', sourcesCount: 1, publishedAt: '2026-08-20T10:00:00.000Z',
      sourceLanguage: 'en',
    }) as NewsArticle;

  const ARTICLES = [article(1), article(2)];

  const build = (status: string, executionMode: string, analysis: unknown) =>
    ({
      query: 'q', normalizedQuery: 'q', requestedLanguage: 'en', responseLanguage: 'en',
      analysis, articles: ARTICLES,
      retrievalContext: { dataMode: 'live', providers: ['gnews'], articlesRetrieved: ARTICLES.length },
      sourceEntities: { organizations: [] },
      provenance: { provider: 'openai', executionMode, analysisMode: 'live-ai', status, cached: false },
    }) as unknown as AnalysisApiResponse;

  const render = (response: AnalysisApiResponse) =>
    renderToStaticMarkup(
      createElement(AnalysisFrameSurface as never, {
        response, initialViewport: { width: 1440, height: 900 }, initialDock: 'expanded',
      } as never),
    );

  it('the not-attempted and failed states are distinguished by provenance.status, not a second error model', () => {
    const notAttempted = render(build('not-attempted', 'production', null));
    const failed = render(build('failed', 'production', null));
    /* Different reasons must not render the same sentence — the defect
       R4 corrected in the frame's own state resolution. */
    expect(notAttempted).not.toBe(failed);
    expect(notAttempted).toMatch(/data-evidence-state="[a-z-]+"/);
    expect(failed).toMatch(/data-evidence-state="[a-z-]+"/);
  });

  it('live-vs-mock labeling is rendered on the DEFAULT surface, in both the analyzed and non-analyzed states, never bypassed', () => {
    const t = getDictionary('en').analysisModeBadge;

    /* Analyzed, but produced in DEMO mode. This is the case that matters:
       the output looks complete, so nothing else on screen tells the
       reader it is not live. */
    const demo = renderToStaticMarkup(
      createElement(AnalysisFrameSurface as never, {
        response: {
          ...fixture(),
          provenance: {
            provider: 'openai', executionMode: 'mock', analysisMode: 'mock',
            status: 'success', cached: false,
          },
        },
        initialViewport: { width: 1440, height: 900 },
      } as never),
    );
    expect(demo).toContain(t.demoAiAnalysis);

    /* Non-analyzed: still labelled, still without opening anything. */
    const notAttempted = render(build('not-attempted', 'production', null));
    expect(notAttempted).toContain(t.notAttempted);
  });

  it('displayed sources come directly from response.articles — no placeholder or synthetic article', () => {
    const html = render(build('failed', 'production', null));
    for (const a of ARTICLES) {
      expect({ id: a.id, shown: html.includes(a.sourceName) }).toEqual({ id: a.id, shown: true });
    }
    expect(html).not.toMatch(/placeholder.*article|fake.*article|dummy.*article/i);
  });
});
