import { readFileSync } from 'fs';
import { join } from 'path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type {
  AnalysisApiResponse,
  NewsAnalysisResult,
  NewsArticle,
  SourcedClaim,
} from '@globalnews-ai/shared';
import { AnalysisWorkspace, WORKSPACE_DIMENSION_ORDER } from './AnalysisWorkspace';
import {
  isActivationKey,
  resolveArrowTarget,
  rovingTabIndex,
  dimensionAccessibleName,
} from './AnalysisIndex';
import { ANALYSIS_VIEWPORT_HEADING_ID, ANALYSIS_VIEWPORT_ID } from './AnalysisViewport';
import { PRIMARY_DIMENSION_KEYS } from './analysisDimensions';
import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * H2B — Analysis Workspace shell and navigation.
 *
 * These are real rendering assertions, not source-text matching. The
 * repository has no jsdom and no React Testing Library, and H2B adds
 * neither — but `react-dom/server` runs perfectly in the existing
 * `testEnvironment: 'node'` harness, and the same technique is already
 * the accepted evidence standard in this repository (Claude G used
 * renderToStaticMarkup for the Hero live-feed lane).
 *
 * What that buys: the ARIA graph, the tab order, the roving tabindex and
 * the rendered counts are checked as the browser would receive them.
 * What it does not: real key events and real focus movement need a
 * browser, so the keyboard MODEL is unit-tested as pure functions here
 * and the interaction itself is a native-acceptance item.
 */

/* ------------------------------------------------------------------ *
 * Fixtures — production-shaped, never copied from the design prototype.
 * ------------------------------------------------------------------ */

function article(id: string): NewsArticle {
  return {
    id,
    title: `Title ${id}`,
    summary: `Summary ${id}`,
    url: `https://example.test/${id}`,
    sourceId: `src-${id}`,
    sourceName: `Source ${id}`,
    category: 'world',
    sourcesCount: 1,
    publishedAt: '2026-08-22T06:00:00.000Z',
  };
}

function claim(text: string, ids: string[], sourceCount?: number): SourcedClaim {
  return {
    claim: text,
    sourceArticleIds: ids,
    ...(sourceCount === undefined
      ? {}
      : { evidenceBreadth: { sourceCount, singleSource: sourceCount === 1 } }),
  };
}

const ARTICLES: NewsArticle[] = [article('a1'), article('a2')];

function analysisWith(overrides: Partial<NewsAnalysisResult> = {}): NewsAnalysisResult {
  const base: NewsAnalysisResult = {
    query: 'q',
    headline: 'Headline',
    summary: 'Summary.',
    keyFacts: [claim('Fact one', ['a1'], 1), claim('Fact two', ['a2'], 1)],
    agreements: [],
    differences: [],
    unknowns: [],
    timeline: [],
    confidence: { level: 'medium', score: 50, explanation: 'e' },
    entities: { countries: [], locations: [], people: [], organizations: [], topics: [] },
    sources: ARTICLES.map((a) => ({
      articleId: a.id,
      publisher: a.sourceName,
      title: a.title,
      url: a.url,
      publishedAt: a.publishedAt,
    })),
    generatedAt: '2026-08-22T06:05:00.000Z',
    analysisMode: 'live-ai',
    trustState: {
      level: 'moderate',
      reasons: [],
      distinctSourceArticleCount: 2,
      differenceTopicCount: 0,
      uncertaintyCount: 0,
    },
    context: [],
    relevance: [claim('Because', ['a1'], 1)],
    affectedParties: [],
    immediateImpacts: [],
    spilloverImplications: [],
    significance: null,
    watchNext: [],
  };
  return { ...base, ...overrides };
}

function responseWith(analysis: NewsAnalysisResult | null): AnalysisApiResponse {
  return {
    query: 'What is happening with the outbreak?',
    normalizedQuery: 'what is happening with the outbreak',
    requestedLanguage: 'en',
    responseLanguage: 'en',
    analysis,
    articles: ARTICLES,
    retrievalContext: { dataMode: 'live', providers: ['gnews'], articlesRetrieved: 2 },
    sourceEntities: { organizations: [] },
    provenance: {
      provider: 'openai',
      executionMode: 'production',
      analysisMode: 'live-ai',
      status: 'success',
      cached: false,
    },
  };
}

function render(response: AnalysisApiResponse, language: 'en' | 'pl' = 'en'): string {
  return renderToStaticMarkup(createElement(AnalysisWorkspace, { response, language }));
}

const source = (file: string) => readFileSync(join(__dirname, file), 'utf-8');

const WORKSPACE_SRC = source('AnalysisWorkspace.tsx');
const INDEX_SRC = source('AnalysisIndex.tsx');
const VIEWPORT_SRC = source('AnalysisViewport.tsx');
const SEARCH_CLIENT_SRC = source('SearchPageClient.tsx');

const WORKSPACE_CODE = codeOnly(WORKSPACE_SRC);
const INDEX_CODE = codeOnly(INDEX_SRC);
const VIEWPORT_CODE = codeOnly(VIEWPORT_SRC);
const SEARCH_CLIENT_CODE = codeOnly(SEARCH_CLIENT_SRC);

const countOf = (haystack: string, needle: string): number => haystack.split(needle).length - 1;

/**
 * Source assertions must test CODE, not prose. These files explain at
 * length why they never fetch and never call scrollIntoView, so a naive
 * substring search finds the explanation and reports a violation that
 * does not exist. Stripping comments first is what makes the assertion
 * mean what it says.
 */
function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** The rendered markup of one tab, from its id to the start of the next. */
function tabMarkup(html: string, variant: 'desktop' | 'mobile', key: string): string {
  const start = html.indexOf(`id="gn-tab-${variant}-${key}"`);
  if (start === -1) return '';
  const rest = html.slice(start + 1);
  const next = rest.indexOf('id="gn-tab-');
  return next === -1 ? rest : rest.slice(0, next);
}

/* ------------------------------------------------------------------ *
 * A. Exactly seven dimensions, in the approved order
 * ------------------------------------------------------------------ */

describe('A. Seven navigation dimensions, exact order', () => {
  it('exposes the adapter order unchanged, without redeclaring it', () => {
    expect([...WORKSPACE_DIMENSION_ORDER]).toEqual([...PRIMARY_DIMENSION_KEYS]);
    expect(WORKSPACE_DIMENSION_ORDER).toHaveLength(7);
  });

  it('renders exactly seven tabs in each navigation variant', () => {
    const html = render(responseWith(analysisWith()));
    PRIMARY_DIMENSION_KEYS.forEach((key) => {
      expect(countOf(html, `id="gn-tab-desktop-${key}"`)).toBe(1);
      expect(countOf(html, `id="gn-tab-mobile-${key}"`)).toBe(1);
    });
    expect(countOf(html, 'id="gn-tab-desktop-')).toBe(7);
    expect(countOf(html, 'id="gn-tab-mobile-')).toBe(7);
  });

  it('renders them in the exact approved DOM order in both variants', () => {
    const html = render(responseWith(analysisWith()));
    (['desktop', 'mobile'] as const).forEach((variant) => {
      const positions = PRIMARY_DIMENSION_KEYS.map((key) =>
        html.indexOf(`id="gn-tab-${variant}-${key}"`),
      );
      expect(positions.every((p) => p > -1)).toBe(true);
      expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    });
  });

  it('never renders an eighth primary dimension', () => {
    const html = render(responseWith(analysisWith()));
    expect(countOf(html, 'role="tab"')).toBe(14); // 7 per variant, one variant displayed
    ['spillover', 'agreements', 'differences', 'timeline', 'relationships', 'watch-next'].forEach(
      (forbidden) => expect(html).not.toContain(`gn-tab-desktop-${forbidden}`),
    );
  });
});

/* ------------------------------------------------------------------ *
 * B. Active selection
 * ------------------------------------------------------------------ */

describe('B. Active dimension state', () => {
  it('defaults to the Executive Brief', () => {
    const html = render(responseWith(analysisWith()));
    expect(tabMarkup(html, 'desktop', 'brief')).toContain('aria-selected="true"');
    expect(tabMarkup(html, 'desktop', 'key-facts')).toContain('aria-selected="false"');
  });

  it('marks exactly one tab selected per variant', () => {
    const html = render(responseWith(analysisWith()));
    expect(countOf(html, 'aria-selected="true"')).toBe(2);
    expect(countOf(html, 'aria-selected="false"')).toBe(12);
  });

  it('does not rely on colour alone: the active row also carries a shape cue and a state attribute', () => {
    const html = render(responseWith(analysisWith()));
    // aria-selected is the programmatic cue; the rail/dot is the visual one.
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('bg-gn-ai'); // brief accent rail, filled
    expect(html).toContain('bg-gn-line-inert'); // the six inactive rails
  });

  it('names the active dimension in the viewport heading, not only in the tablist', () => {
    const html = render(responseWith(analysisWith()));
    const label = getDictionary('en').analysisWorkspace.dimensions.brief;
    expect(html).toContain(`id="${ANALYSIS_VIEWPORT_HEADING_ID}"`);
    expect(html.slice(html.indexOf(ANALYSIS_VIEWPORT_HEADING_ID))).toContain(label);
  });
});

/* ------------------------------------------------------------------ *
 * C. Zero-count dimensions
 * ------------------------------------------------------------------ */

describe('C. Zero-count dimensions remain visible and selectable', () => {
  const emptyAnalysis = analysisWith({ keyFacts: [], relevance: [] });

  it('still renders every dimension when the analysis has no items at all', () => {
    const html = render(responseWith(emptyAnalysis));
    expect(countOf(html, 'id="gn-tab-desktop-')).toBe(7);
  });

  it('never disables a zero-count tab', () => {
    const html = render(responseWith(emptyAnalysis));
    expect(html).not.toContain('disabled');
    expect(html).not.toContain('aria-disabled="true"');
  });

  it('renders the literal count 0 rather than hiding the row', () => {
    const html = render(responseWith(emptyAnalysis));
    expect(tabMarkup(html, 'desktop', 'key-facts')).toContain('>0</span>');
  });

  it('puts the zero count in the accessible name, so absence is announced', () => {
    const html = render(responseWith(emptyAnalysis));
    expect(html).toContain('aria-label="Key facts, 0 items"');
  });

  it('still renders all seven when the AI failed entirely', () => {
    const html = render(responseWith(null));
    expect(countOf(html, 'id="gn-tab-desktop-')).toBe(7);
    expect(html).toContain('aria-label="Key facts, 0 items"');
  });
});

/* ------------------------------------------------------------------ *
 * D. Count rendering
 * ------------------------------------------------------------------ */

describe('D. Counts come from the adapter and are rendered honestly', () => {
  it('renders each dimension real count', () => {
    const html = render(responseWith(analysisWith()));
    expect(html).toContain('aria-label="Key facts, 2 items"'); // keyFacts.length
    expect(html).toContain('aria-label="Why this matters, 1 item"'); // relevance.length
  });

  it('renders an em dash for the uncountable Executive Brief, never a zero', () => {
    const html = render(responseWith(analysisWith()));
    expect(tabMarkup(html, 'desktop', 'brief')).toContain('\u2014');
    expect(tabMarkup(html, 'desktop', 'brief')).not.toContain('>0</span>');
    expect(html).not.toContain('aria-label="Executive brief, 0 items"');
  });

  it('pluralizes through the shared helper, including Polish forms', () => {
    const pl = getDictionary('pl').analysisWorkspace;
    const one = dimensionAccessibleName(
      { key: 'key-facts', count: 1 } as never,
      pl.dimensions,
      'pl',
      pl.itemForms,
    );
    const few = dimensionAccessibleName(
      { key: 'key-facts', count: 3 } as never,
      pl.dimensions,
      'pl',
      pl.itemForms,
    );
    const many = dimensionAccessibleName(
      { key: 'key-facts', count: 12 } as never,
      pl.dimensions,
      'pl',
      pl.itemForms,
    );
    expect(one).toContain('1 pozycja');
    expect(few).toContain('3 pozycje');
    expect(many).toContain('12 pozycji');
  });
});

/* ------------------------------------------------------------------ *
 * E. Accessibility semantics
 * ------------------------------------------------------------------ */

describe('E. Navigation accessibility', () => {
  const html = render(responseWith(analysisWith()));

  it('uses a real tablist/tab/tabpanel graph', () => {
    expect(countOf(html, 'role="tablist"')).toBe(2);
    expect(countOf(html, 'role="tabpanel"')).toBe(1);
    expect(html).toContain('aria-orientation="vertical"');
    expect(html).toContain('aria-orientation="horizontal"');
  });

  it('points every tab at the single viewport panel', () => {
    expect(countOf(html, `aria-controls="${ANALYSIS_VIEWPORT_ID}"`)).toBe(14);
    expect(html).toContain(`id="${ANALYSIS_VIEWPORT_ID}"`);
  });

  it('labels the panel by its visible heading', () => {
    expect(html).toContain(`aria-labelledby="${ANALYSIS_VIEWPORT_HEADING_ID}"`);
  });

  it('makes the panel programmatically focusable but not a tab stop', () => {
    const panel = html.slice(html.indexOf(`id="${ANALYSIS_VIEWPORT_ID}"`));
    expect(panel.slice(0, 300)).toContain('tabindex="-1"');
  });

  it('implements a roving tabindex: exactly one tab stop per variant', () => {
    expect(countOf(html, 'tabindex="0"')).toBe(2);
    expect(countOf(html, 'tabindex="-1"')).toBe(13); // 12 tabs + the panel
  });

  it('carries a polite live region so a dimension change is announced', () => {
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('Showing');
  });

  it('gives both tablists an accessible name', () => {
    const t = getDictionary('en').analysisWorkspace;
    expect(html).toContain(`aria-label="${t.indexLabel}"`);
    expect(html).toContain(`aria-label="${t.navigatorLabel}"`);
  });

  it('marks every decorative rail, dot and square aria-hidden', () => {
    expect(countOf(html, 'aria-hidden="true"')).toBeGreaterThanOrEqual(15);
  });

  it('renders exactly one h1 in the workspace — the analysis question', () => {
    expect(countOf(html, '<h1')).toBe(1);
    expect(html).toContain('What is happening with the outbreak?');
  });

  it('never uses scrollIntoView anywhere in the shell', () => {
    [WORKSPACE_CODE, INDEX_CODE, VIEWPORT_CODE].forEach((code) =>
      expect(code).not.toContain('scrollIntoView'),
    );
  });
});

/* ------------------------------------------------------------------ *
 * F. Keyboard model (pure)
 * ------------------------------------------------------------------ */

describe('F. Keyboard model', () => {
  it('moves on the vertical axis for the desktop index', () => {
    expect(resolveArrowTarget('ArrowDown', 0, 7, 'desktop')).toBe(1);
    expect(resolveArrowTarget('ArrowUp', 3, 7, 'desktop')).toBe(2);
    expect(resolveArrowTarget('ArrowRight', 0, 7, 'desktop')).toBeNull();
  });

  it('moves on the horizontal axis for the mobile navigator', () => {
    expect(resolveArrowTarget('ArrowRight', 0, 7, 'mobile')).toBe(1);
    expect(resolveArrowTarget('ArrowLeft', 3, 7, 'mobile')).toBe(2);
    expect(resolveArrowTarget('ArrowDown', 0, 7, 'mobile')).toBeNull();
  });

  it('jumps to first and last with Home and End on both axes', () => {
    (['desktop', 'mobile'] as const).forEach((variant) => {
      expect(resolveArrowTarget('Home', 4, 7, variant)).toBe(0);
      expect(resolveArrowTarget('End', 1, 7, variant)).toBe(6);
    });
  });

  it('does not wrap around at either end', () => {
    expect(resolveArrowTarget('ArrowUp', 0, 7, 'desktop')).toBe(0);
    expect(resolveArrowTarget('ArrowDown', 6, 7, 'desktop')).toBe(6);
  });

  it('returns null for keys it does not own, so Tab still leaves the tablist', () => {
    ['Tab', 'Escape', 'a', 'PageDown'].forEach((key) =>
      expect(resolveArrowTarget(key, 0, 7, 'desktop')).toBeNull(),
    );
  });

  it('activates on Enter and Space only', () => {
    expect(isActivationKey('Enter')).toBe(true);
    expect(isActivationKey(' ')).toBe(true);
    expect(isActivationKey('ArrowDown')).toBe(false);
    expect(isActivationKey('Tab')).toBe(false);
  });

  it('keeps exactly one row in the tab order', () => {
    expect(rovingTabIndex(2, 2)).toBe(0);
    expect(rovingTabIndex(0, 2)).toBe(-1);
  });

  it('is safe on an empty list', () => {
    expect(resolveArrowTarget('ArrowDown', 0, 0, 'desktop')).toBeNull();
  });
});

/* ------------------------------------------------------------------ *
 * G. Responsive navigation contract
 * ------------------------------------------------------------------ */

describe('G. Responsive contract', () => {
  const html = render(responseWith(analysisWith()));

  it('shows the index from the 768px breakpoint and hides it below', () => {
    expect(html).toContain('hidden md:flex');
  });

  it('shows the navigator below 768px and hides it at and above', () => {
    expect(html).toContain('flex md:hidden');
  });

  /*
     R2a — RETARGETED, NOT WEAKENED. CTO ruling, R2a authorization.

     THE OLD ASSERTION: `md:grid-cols-[236px_minmax(0,1fr)]`.

     WHY THE APPROVED BEHAVIOUR INVALIDATES IT. 236px was the released
     track, and it is the direct cause of the defect the CTO ordered
     fixed. The track's own padding (`md:pl-6 md:pr-[14px]` = 38px) left
     a 198px content box while the index row was a FIXED 212px — a 14px
     overflow, measured in Chromium, which is where the horizontal
     scrollbar came from. The same fixed row left 151px of label area
     against the 153px `INSUFFICIENT EVIDENCE` and 167px
     `NIEWYSTARCZAJĄCE DOWODY` need, so both truncated. Asserting 236px
     now pins the broken geometry.

     THE REPLACEMENT IS STRICTLY STRONGER. It asserted one class string;
     this asserts the approved width AND the fluid mechanism that makes
     overflow structurally impossible AND that the old fixed row is gone.
     The measured proof — no overflow, no truncation, counts visible, in
     EN and PL — lives in `searchWorkspace.spec.ts`, because a class name
     is not evidence that a layout fits.
  */
  it('R2a: establishes the approved 260px desktop index track', () => {
    expect(html).toContain('md:grid-cols-[260px_minmax(0,1fr)]');
    expect(html).not.toContain('md:grid-cols-[236px_minmax(0,1fr)]');
  });

  it('R2a: the index row is fluid, so it cannot overflow the track', () => {
    expect(html).toContain('min-h-[33px] w-full');
    expect(html).not.toContain('h-[33px] w-[212px]');
    expect(html).toContain('whitespace-normal break-words');
  });

  it('R2a: the dedicated count column survives the widening', () => {
    expect(html).toContain('min-w-[26px] text-right');
  });

  it('makes the mobile chip row horizontally scrollable with snap, not wrapped', () => {
    expect(html).toContain('overflow-x-auto');
    expect(html).toContain('whitespace-nowrap');
    expect(html).toContain('scroll-snap-align:start');
    expect(INDEX_CODE).toContain("scrollSnapType: 'x proximity'");
  });

  it('sets scrollLeft rather than scrollIntoView for chip auto-scroll (03 §2)', () => {
    expect(INDEX_CODE).not.toContain('scrollIntoView');
  });
});

/* ------------------------------------------------------------------ *
 * H. The H2A adapter is consumed, never duplicated
 * ------------------------------------------------------------------ */

describe('H. Adapter consumption', () => {
  it('builds the view-model through the H2A adapter', () => {
    expect(WORKSPACE_CODE).toContain("from './analysisDimensions'");
    expect(WORKSPACE_CODE).toContain('buildAnalysisWorkspaceModel(response)');
  });

  it('does not re-read production analysis fields inside any shell component', () => {
    const forbidden = [
      'analysis.keyFacts',
      'analysis.relevance',
      'analysis.affectedParties',
      'analysis.immediateImpacts',
      'analysis.uncertainties',
      'analysis.unknowns',
      'analysis.significance',
      'analysis.trustState',
      'response.analysis',
    ];
    [WORKSPACE_CODE, INDEX_CODE, VIEWPORT_CODE].forEach((code) =>
      forbidden.forEach((field) => expect(code).not.toContain(field)),
    );
  });

  it('does not redeclare the dimension list, order or accents in the UI layer', () => {
    [INDEX_CODE, VIEWPORT_CODE].forEach((src) => {
      expect(src).not.toContain("'why-this-matters',\n");
      expect(src).not.toContain('PRIMARY_DIMENSION_KEYS = [');
    });
  });
});

/* ------------------------------------------------------------------ *
 * I. No second fetch path
 * ------------------------------------------------------------------ */

describe('I. No second analysis fetch path', () => {
  it('contains no network primitive in any new shell component', () => {
    [WORKSPACE_CODE, INDEX_CODE, VIEWPORT_CODE].forEach((code) => {
      expect(code).not.toMatch(/\bfetch\s*\(/);
      expect(code).not.toContain('XMLHttpRequest');
      expect(code).not.toContain('EventSource');
      expect(code).not.toContain('axios');
      expect(code).not.toContain('analyzeNews');
      expect(code).not.toContain('analysisApi');
    });
  });

  it('leaves SearchPageClient as the only caller, with exactly one call site', () => {
    expect(countOf(SEARCH_CLIENT_CODE, 'analyzeNews(')).toBe(1);
    expect(SEARCH_CLIENT_CODE).toContain("from '@/lib/api/analysisApi'");
  });

  /*
   * RETARGETED IN R4. Old assertion: the literal
   * `<AnalysisWorkspace response={response}`. R4 §2 rejects that
   * component's presentation and §3 replaces it, so the component name
   * changed — the invariant did not. What this test protects is that the
   * analysis surface is HANDED the response rather than fetching one, so
   * it is asserted against whatever component is mounted.
   */
  it('passes the already-fetched response down rather than re-requesting it', () => {
    expect(SEARCH_CLIENT_CODE).toMatch(/<AnalysisFrameSurface[\s\S]*?response=\{response\}/);
    /* And the mounted surface performs no request of its own. */
    const surface = readFileSync(
      join(__dirname, '..', 'analysis-frame', 'AnalysisFrameSurface.tsx'),
      'utf-8',
    );
    expect(surface).not.toMatch(/analyzeNews\(|\bfetch\s*\(|useEffect/);
  });
});

/* ------------------------------------------------------------------ *
 * J. Existing search behaviour is intact
 * ------------------------------------------------------------------ */

describe('J. Existing behaviour preserved', () => {
  it('keeps the stale-response cancellation guard untouched', () => {
    expect(SEARCH_CLIENT_CODE).toContain('let cancelled = false;');
    expect(SEARCH_CLIENT_CODE).toContain('if (!cancelled) setResponse(result);');
    expect(SEARCH_CLIENT_CODE).toContain('cancelled = true;');
  });

  it('keeps the memoized storyContext and its dependency array honest', () => {
    expect(SEARCH_CLIENT_CODE).toContain('const storyContext: StoryContext | undefined = useMemo(');
    // A real suppression directive only ever appears inside a comment, so
    // this checks the raw source for the directive form, not the word.
    expect(SEARCH_CLIENT_SRC).not.toMatch(/\/\/\s*eslint-disable|\/\*\s*eslint-disable/);
  });

  /*
   * RETARGETED IN R4. Old assertions: `<AnalysisResultView` appears in
   * SearchPageClient BELOW `<AnalysisWorkspace`, and the literal
   * `{response.articles.length > 0 && (` is present in that file.
   *
   * Both describe the long `/search` document R4 §2 rejects: the record
   * "beneath the shell" and the source grid at the end of the page. The
   * record and the sources both still exist — in the frame's Complete
   * Record and its Sources Dock — so what these two tests were really
   * asserting ("nothing is lost", "sources are not gated by the
   * analysis") is asserted where it can no longer be satisfied by
   * accident: on rendered markup, field by field, in
   * `analysis-frame/r4DataPreservation.spec.ts` and
   * `evidenceSurvivesAiFailure.spec.ts`.
   *
   * What remains here is the part specific to THIS file: the long-form
   * record must not be rendered inline on /search a second time.
   */
  it('the long-form record is reachable but NOT rendered inline a second time', () => {
    expect(SEARCH_CLIENT_CODE).not.toContain('<AnalysisResultView');
    expect(SEARCH_CLIENT_CODE).not.toContain('<AnalysisClassicRecord');
    const record = readFileSync(
      join(__dirname, '..', 'analysis-frame', 'CompleteRecordView.tsx'),
      'utf-8',
    );
    expect(record).toContain('<AnalysisResultView');
  });

  it('renders only one h1 on the page: the shell owns it once a response exists', () => {
    expect(SEARCH_CLIENT_CODE).toContain('showsWorkspace ? null : (');
  });
});

/* ------------------------------------------------------------------ *
 * K. Localization
 * ------------------------------------------------------------------ */

describe('K. Localization', () => {
  it('renders Polish dimension labels when the language is Polish', () => {
    const html = render(responseWith(analysisWith()), 'pl');
    const pl = getDictionary('pl').analysisWorkspace.dimensions;
    expect(html).toContain(pl.keyFacts);
    expect(html).toContain(pl.insufficientEvidence);
  });

  it('keeps en and pl structurally identical for the workspace group', () => {
    const en = getDictionary('en').analysisWorkspace;
    const pl = getDictionary('pl').analysisWorkspace;
    expect(Object.keys(pl).sort()).toEqual(Object.keys(en).sort());
    expect(Object.keys(pl.dimensions).sort()).toEqual(Object.keys(en.dimensions).sort());
    expect(pl.itemForms).toHaveLength(3);
  });

  it('hardcodes no user-visible English in the shell components', () => {
    [WORKSPACE_CODE, INDEX_CODE, VIEWPORT_CODE].forEach((code) => {
      expect(code).toContain('getDictionary(language)');
      // No second localization mechanism: the shell never carries its own map.
      expect(code).not.toMatch(/\ben:\s*'/);
    });
  });
});

/* ------------------------------------------------------------------ *
 * L. Dictionary regression guard
 * ------------------------------------------------------------------ */

describe('L. H2B extends the dictionary and removes nothing', () => {
  /**
   * WHY THIS EXISTS.
   *
   * The first H2B delivery was rejected: the Analysis Workspace strings had
   * been added to a copy of the dictionary taken from a DIFFERENT checkout,
   * which lacked content the H2A parent already had. Writing that file back
   * silently deleted an entire `admin` group and several hero/heroContext
   * keys, and `Dictionary = typeof en` propagated the loss into 19
   * TypeScript errors across five unrelated files.
   *
   * Jest did not catch it, because nothing in the search suite reads those
   * keys. These assertions close that gap: they fail loudly if a future
   * slice ever rebuilds the dictionary from the wrong base again.
   */
  const en = getDictionary('en');
  const pl = getDictionary('pl');

  it('still carries every group that existed before H2B', () => {
    (
      [
        'admin',
        'hero',
        'heroContext',
        'analysisResultView',
        'navBar',
        'footer',
        'map',
        'privacyPage',
        'termsPage',
        'sourcePolicyPage',
      ] as const
    ).forEach((group) => {
      expect(en).toHaveProperty(group);
      expect(pl).toHaveProperty(group);
    });
  });

  it('still carries the specific keys the regression destroyed', () => {
    expect(en.heroContext).toHaveProperty('locationUnresolved');
    expect(en.heroContext).toHaveProperty('articleEvidence');
    expect(en.hero).toHaveProperty('feedPanelFocusNone');
    expect(en.hero).toHaveProperty('feedPanelFocusOf');
    expect(en.hero).toHaveProperty('feedPanelFocusStoryForms');
    expect(en.hero).toHaveProperty('feedPanelFocusLive');

    expect(pl.heroContext).toHaveProperty('locationUnresolved');
    expect(pl.heroContext).toHaveProperty('articleEvidence');
    expect(pl.hero).toHaveProperty('feedPanelFocusNone');
    expect(pl.hero).toHaveProperty('feedPanelFocusOf');
    expect(pl.hero).toHaveProperty('feedPanelFocusStoryForms');
    expect(pl.hero).toHaveProperty('feedPanelFocusLive');
  });

  it('keeps en and pl structurally identical at the top level', () => {
    expect(Object.keys(pl).sort()).toEqual(Object.keys(en).sort());
  });

  it('adds the workspace group without displacing anything', () => {
    expect(en).toHaveProperty('analysisWorkspace');
    expect(pl).toHaveProperty('analysisWorkspace');
    // A dictionary that lost a group would be smaller, not larger.
    expect(Object.keys(en).length).toBeGreaterThan(50);
  });
});
