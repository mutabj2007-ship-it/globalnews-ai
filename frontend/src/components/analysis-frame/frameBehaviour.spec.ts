import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, readdirSync } from 'node:fs';
import { AnalysisFrame } from './AnalysisFrame';
import { CompleteRecordView } from './CompleteRecordView';
import { EvidenceLibrary } from './EvidenceLibrary';
import { SourcesDock } from './SourcesDock';
import { fixture, article } from './frameFixtures';
import { resolveTracks, frameHeightFor, DOCK_COMPACT_NORMAL } from './frameGeometry';
import { CLAIM_PAGE_SIZE } from './DimensionPanel';

const render = (props: Record<string, unknown>) =>
  renderToStaticMarkup(createElement(AnalysisFrame as never, props as never));
/* ── AMENDED BY MAIN-FINAL-CORRECTED-ALPHA-CONVERGENCE-1, PO DECISION 4 ──
   THE FRAME UNDER TEST IS UNCHANGED; ONLY THE WINDOW AROUND IT GREW.
   `12-FOUR-SIDED-FRAME-GEOMETRY` does its arithmetic as `window - 48`,
   because in the prototype the 48px command bar IS the top chrome. The
   product also renders the released `NavBar` above it, and at 1440 that is
   the WIDE bar: `cd-header` is 1400px, so NavBar is 62px here, not 52px.
   The frame is `window - 62 - 48`, and 962 therefore yields the SAME 852px
   frame these
   assertions were written against, and every one of them — including the
   104px map and the 0.46 dock ratio — continues to assert exactly what it
   asserted before. Leaving 900 here would have silently moved the tests
   onto §6's constrained-laptop path instead. */
const VP = { width: 1440, height: 962 };
const src = (f: string) => readFileSync(`${__dirname}/${f}`, 'utf8');

/* PAF acceptance test 3 (render half) */
describe('PAF-3 — the dock is a grid track, so expanding it can only take from the centre', () => {
  it('the frame assigns row heights to rows 1 and 3 only; row 2 is 1fr', () => {
    const html = render({ response: fixture(), initialViewport: VP });
    /* Derived from DOCK_COMPACT_NORMAL: the alpha closure raised the compact
       dock so it can show a real source row instead of one thin line. */
        /*
      ANALYSIS-WORKSPACE-FLEX-1 RETARGET — THE ROW MODEL BECAME RANGES.

      The invariant this assertion exists for is UNCHANGED and is still
      what is asserted: rows 1 and 3 carry the heights `resolveTracks`
      decided, and row 2 is the flexible track that absorbs the
      difference — which is why expanding the dock can only take from the
      centre (PAF-3/F-6). The centre's height is still never written to a
      style; the companion assertion below still proves that.

      What changed is that each track is now a RANGE around the same
      number, so a short brief can return space (row 1's ceiling) and the
      source cards can be fully shown instead of clipped (row 3's floor).
      `minmax(min-content, Npx) minmax(240px,1fr) minmax(Npx, max-content)`
      is the same three numbers as `Npx minmax(0,1fr) Npx`.
    */
    expect(html).toMatch(
      /grid-template-rows:minmax\(min-content,\s*max-content\) minmax\(\d+px,\s*1fr\) minmax\(\d+px,\s*max-content\)/,
    );
  });

  it('the centre height is never written to a style anywhere in the frame', () => {
    for (const file of readdirSync(__dirname).filter((f) => /\.tsx$/.test(f))) {
      expect(`${file}: ${/height:\s*`?\$\{[^}]*centreHeight/.test(src(file))}`).toBe(`${file}: false`);
    }
  });
});

/* PAF acceptance test 4 — scale */
describe('PAF-4 — 1, 18 and 800 sources are structurally identical', () => {
  it.each([1, 18, 120])('%i sources leaves every track height unchanged', (count) => {
    const html = render({ response: fixture({ articleCount: count }), initialViewport: VP });
    /* Derived from DOCK_COMPACT_NORMAL: the alpha closure raised the compact
       dock so it can show a real source row instead of one thin line. */
        /*
      ANALYSIS-WORKSPACE-FLEX-1 RETARGET — THE ROW MODEL BECAME RANGES.

      The invariant this assertion exists for is UNCHANGED and is still
      what is asserted: rows 1 and 3 carry the heights `resolveTracks`
      decided, and row 2 is the flexible track that absorbs the
      difference — which is why expanding the dock can only take from the
      centre (PAF-3/F-6). The centre's height is still never written to a
      style; the companion assertion below still proves that.

      What changed is that each track is now a RANGE around the same
      number, so a short brief can return space (row 1's ceiling) and the
      source cards can be fully shown instead of clipped (row 3's floor).
      `minmax(min-content, Npx) minmax(240px,1fr) minmax(Npx, max-content)`
      is the same three numbers as `Npx minmax(0,1fr) Npx`.
    */
    expect(html).toMatch(
      /grid-template-rows:minmax\(min-content,\s*max-content\) minmax\(\d+px,\s*1fr\) minmax\(\d+px,\s*max-content\)/,
    );
    expect(html).toContain('data-paf="brief-row"');
    expect(html).toContain('data-paf="location-detail"');
  });

  it('the expanded dock scrolls internally rather than growing the frame', () => {
    const sources = Array.from({ length: 200 }, (_, i) => ({
      articleId: `a${i}`, citationNumber: i + 1, article: article(i + 1), source: null,
      supports: [], cited: true,
    }));
    const html = renderToStaticMarkup(
      createElement(SourcesDock as never, {
        sources, expanded: true, onToggle: () => {}, highlightedArticleId: null,
      } as never),
    );
    expect(html).toMatch(/data-paf="dock-expanded"[^>]*overflow-y-auto/);
  });
});

/* PAF acceptance test 11 */
describe('PAF-11 — dimension change replaces the centre and never concatenates', () => {
  it('only one dimension panel is mounted at a time', () => {
    const html = render({ response: fixture(), initialViewport: VP });
    expect((html.match(/data-paf="dimension-panel"/g) ?? []).length).toBe(1);
  });

  it('there is no "show all" and the index is not a set of anchor links', () => {
    const html = render({ response: fixture(), initialViewport: VP });
    expect(html).not.toMatch(/show all/i);
    const index = html.slice(html.indexOf('data-paf="index-column"'), html.indexOf('data-paf="centre-viewport"'));
    expect(index).not.toMatch(/href="#/);
  });

  it('selecting a dimension resets the centre scroll and moves focus to the h2', () => {
    const source = src('AnalysisFrame.tsx');
    expect(source).toMatch(/centreRef\.current\.scrollTop = 0/);
    expect(source).toMatch(/getElementById\(DIMENSION_HEADING_ID\)\?\.focus\(\)/);
  });

  it('compressed, dock and the right column are NOT reset on dimension change', () => {
    const source = src('AnalysisFrame.tsx');
    const handler = source.slice(source.indexOf('const onSelectDimension'), source.indexOf('const onOpenSource'));
    expect(handler).not.toMatch(/setDock\(|setCompressed\(|setUserForcedExpanded\(/);
  });
});

/* PAF acceptance test 12 */
describe('PAF-12 — claim ROWS, not cards', () => {
  it('the centre contains no card borders, backgrounds, radii or shadows', () => {
    const html = render({ response: fixture(), initialViewport: VP, initialDimension: 'key-facts' });
    const centre = html.slice(html.indexOf('data-paf="centre-viewport"'), html.indexOf('data-paf="location-detail-track"'));
    expect(centre).toContain('data-paf="claim-row"');
    expect(centre).not.toMatch(/rounded-(gn-module|2xl|xl)|shadow-|bg-gn-panel|bg-surface/);
  });

  it('each row carries an ordinal gutter and a rule, and the list has no card wrapper', () => {
    const html = render({ response: fixture(), initialViewport: VP, initialDimension: 'key-facts' });
    expect(html).toContain('data-paf="ordinal-gutter"');
    expect(html).toMatch(/data-paf="claim-row"[^>]*border-b border-\[#101923\]/);
  });
});

/* PAF acceptance test 13 */
describe('PAF-13 — citation binding', () => {
  it('activation expands the dock, scrolls it by scrollTop, and leaves focus on the marker', () => {
    const source = src('AnalysisFrame.tsx');
    const handler = source.slice(source.indexOf('const onOpenSource'), source.indexOf('const gridTemplateColumns'));
    expect(handler).toMatch(/setDock\('expanded'\)/);
    expect(handler).toMatch(/container\.scrollTop = /);
    expect(handler).not.toMatch(/\.focus\(\)/);       // focus stays on the marker
    expect(handler).not.toMatch(/scrollIntoView/);
  });

  it('the marker is a button with a name identifying the source and the destination', () => {
    const html = render({ response: fixture(), initialViewport: VP });
    // The brief dimension has no claims; switch to one that does by
    // checking the row component directly through a claim-bearing render.
    expect(src('ClaimRow.tsx')).toMatch(/data-paf="citation-marker"/);
    expect(src('ClaimRow.tsx')).toMatch(/aria-label=\{t\.citationMarker/);
    expect(html).toBeTruthy();
  });

  it('an uncited claim shows UNCITED and never a marker', () => {
    expect(src('ClaimRow.tsx')).toMatch(/entry\.uncited \? \(/);
    expect(src('ClaimRow.tsx')).toMatch(/\{t\.uncited\}/);
  });
});

/* PAF acceptance test 19 */
describe('PAF-19 — every state renders with a stated reason, never a blank panel', () => {
  it('a dimension with no items states so', () => {
    const html = render({ response: fixture({ keyFactCount: 0 }), initialViewport: VP });
    expect(html).toBeTruthy();
    expect(src('DimensionPanel.tsx')).toMatch(/data-paf="empty-dimension"/);
  });

  it('zero sources renders NO REPORTS RETRIEVED and the dock is not expandable', () => {
    const html = renderToStaticMarkup(
      createElement(SourcesDock as never, { sources: [], expanded: false, onToggle: () => {}, highlightedArticleId: null } as never),
    );
    expect(html).toContain('NO REPORTS RETRIEVED');
    expect(html).toMatch(/data-paf="dock-toggle"[^>]*disabled/);
  });

  it('unresolved geography states its condition rather than disappearing', () => {
    const html = render({ response: fixture({ precision: 'unresolved' }), initialViewport: VP });
    expect(html).toContain('data-paf="location-detail"');
    expect(html).toContain('No geographic resolution in evidence');
  });

  it('zero open questions renders its stated zero-state', () => {
    const html = render({ response: fixture({ uncertainties: 0 }), initialViewport: VP });
    expect(html).toContain('data-paf="no-open-questions"');
  });
});

/* R4 — the state the old single string could not express */
describe('R4 — a zero-article response never claims retrieval succeeded', () => {
  it('resolves to a different state, with a different sentence', () => {
    const zero = fixture({ analysisNull: true, articleCount: 0 });
    const html = render({ response: zero, initialViewport: VP });
    expect(html).not.toContain('ANALYSIS UNAVAILABLE · REPORTING SURVIVES');
    expect(html).not.toMatch(/RETRIEVAL SUCCEEDED/);
    expect(html).toMatch(/data-evidence-state="(no-evidence|provider-unavailable)"/);
  });
});

/* PAF acceptance test 20 */
describe('PAF-20 — analysis failure leaves the evidence fully usable', () => {
  const failed = fixture({ analysisNull: true });

  /*
     R4 — RETARGETED, NOT WEAKENED. Authorization §5 requires the frame to
     hold four distinct absent-analysis states.

     THE OLD ASSERTION expected the single string
     'ANALYSIS UNAVAILABLE · RETRIEVAL SUCCEEDED'. It was correct for THIS
     fixture — articles survive an AI failure — but the product emitted it
     for every absent analysis, including zero-article responses, where it
     claimed a retrieval success that had not happened and pointed at
     reporting that was not there.

     THE REPLACEMENT IS STRICTLY STRONGER. It pins the state machine, not
     one string: this fixture must resolve to `analysis-failed`, and the
     sibling test below proves a zero-article response resolves to
     something else. A single-string assertion could not tell those apart.
  */
  it('the centre states what still works', () => {
    /*
      RETARGETED AT THE H-C2 MICRO-CLOSURE, NOT WEAKENED. The invariant is
      that the centre tells the reader the retrieved reporting still works.
      Main's failure-kind handoff is now wired, so the SENTENCE that says it
      is the specific one — this fixture carries `status: 'failed'` with no
      `failureReason`, which Main deliberately classifies as the weaker
      'ai-response-unusable' rather than guessing an outage. The heading is
      unchanged, because `stateAnalysisFailed` is retained for that case.
    */
    const html = render({ response: failed, initialViewport: VP });
    expect(html).toContain('data-evidence-state="analysis-failed"');
    expect(html).toContain('ANALYSIS UNAVAILABLE · REPORTING SURVIVES');
    expect(html).toMatch(/reporting below was retrieved successfully and is unaffected/i);
  });

  it('the sources region and the whole frame survive', () => {
    /* RETARGETED AT H-ALPHA-VISUAL-1 ITEM A — the invariant is unchanged
       (the sources region survives / is a labelled landmark / is last in
       DOM order). Only the region's identity moved: the reading path
       carries `sources-reporting`, and `sources-dock` is now the forensic
       view under the Complete Analysis Record. */
    const html = render({ response: failed, initialViewport: VP });
    expect(html).toContain('data-paf="sources-reporting"');
    expect(html).toContain('data-paf="brief-row"');
    expect(html).toContain('data-paf="location-detail"');
  });

  it('the library renders the articles regardless of the analysis', () => {
    const html = renderToStaticMarkup(
      createElement(EvidenceLibrary as never, { articles: failed.articles } as never),
    );
    expect(html).toContain('EVENT EVIDENCE');
    expect((html.match(/data-paf="event-evidence-chip"/g) ?? []).length).toBe(failed.articles.length);
  });
});

/* PAF acceptance test 21 */
describe('PAF-21 — accessibility structure', () => {
  const html = render({ response: fixture(), initialViewport: VP });

  it('the landmarks the handoff names are all present', () => {
    expect(html).toMatch(/role="banner"/);
    expect(html).toMatch(/<nav[^>]*aria-label="Analysis index"/);
    expect(html).toMatch(/<main[^>]*role="tabpanel"/);
    expect(html).toMatch(/role="complementary"[^>]*aria-label="Location context"/);
    expect(html).toMatch(/<section[^>]*aria-label="SOURCES &amp; REPORTING"/);
    expect(html).toMatch(/<section[^>]*aria-label="Analysis thesis"/);
  });

  it('there are exactly two skip links and they are first in the DOM', () => {
    expect(html).toContain('Skip to analysis');
    expect(html).toContain('Skip to location context');
    expect(html.indexOf('Skip to analysis')).toBeLessThan(html.indexOf('data-paf="brief-row"'));
    expect(html.indexOf('Skip to analysis')).toBeLessThan(html.indexOf('Skip to location context'));
  });

  it('DOM order is command -> skip -> brief -> index -> centre -> right -> dock', () => {
    const at = (needle: string) => html.indexOf(needle);
    expect(at('data-paf="command-bar"')).toBeLessThan(at('data-paf="brief-row"'));
    expect(at('data-paf="brief-row"')).toBeLessThan(at('data-paf="index-column"'));
    expect(at('data-paf="index-column"')).toBeLessThan(at('data-paf="centre-viewport"'));
    expect(at('data-paf="centre-viewport"')).toBeLessThan(at('data-paf="location-detail-track"'));
    expect(at('data-paf="location-detail-track"')).toBeLessThan(at('data-paf="sources-reporting"'));
  });

  it('exactly one h1 — the reader\u2019s question — with the thesis heading below it', () => {
    /* DESIGN-C2 LOCK 4 RETARGET — C2-18 makes the reader's QUESTION the
       h1 and drops the AI headline to <h2>. The invariant this assertion
       protects (exactly one h1; the thesis heading is never removed) is
       unchanged and is asserted below in its corrected form. The
       supersession is declared in the CTO report. */
    for (const viewport of [VP, { width: 1440, height: 720 }]) {
      const markup = render({ response: fixture(), initialViewport: viewport });
      expect((markup.match(/<h1/g) ?? []).length).toBe(1);
      expect(markup).toMatch(/<h1[^>]*data-paf="analysis-question-text"/);
      expect(markup).toMatch(/<h2[^>]*data-paf="thesis-title"/);
    }
  });

  it('the index is a vertical tablist and the centre is its tabpanel', () => {
    expect(html).toMatch(/role="tablist"[^>]*aria-orientation="vertical"/);
    expect(html).toMatch(/role="tabpanel"[^>]*aria-labelledby="gn-paf-dimension-heading"/);
  });

  it('the forensic dock keeps its disclosure semantics, in the Complete Record', () => {
    /* RETARGETED: the invariant is that the dock's expand/collapse is a
       real button carrying `aria-expanded` and `aria-controls` — never a
       div. The dock left the reading path at H-ALPHA-VISUAL-1, so the
       assertion follows it to the destination it now lives in rather than
       being deleted. */
    const record = renderToStaticMarkup(
      createElement(CompleteRecordView as never, {
        response: fixture(),
        language: 'en',
        onBack: () => undefined,
      } as never),
    );
    expect(record).toContain('data-paf="record-sources-forensic"');
    expect(record).toMatch(/data-paf="dock-toggle"[\s\S]{0,400}?aria-expanded/);
    expect(record).toMatch(/aria-controls="gn-paf-sources-dock"/);
  });

  it('every focusable control carries a visible focus ring', () => {
    for (const file of readdirSync(__dirname).filter((f) => /\.tsx$/.test(f))) {
      const text = src(file);
      const buttons = (text.match(/<button/g) ?? []).length;
      const rings = (text.match(/focus-visible:outline-gn-focus/g) ?? []).length;
      expect(`${file}: buttons ${buttons} <= rings ${rings}`).toBe(`${file}: buttons ${buttons} <= rings ${Math.max(rings, buttons)}`);
    }
  });
});

/* PAF acceptance test 23 */
describe('PAF-23 — localization', () => {
  it('the frame renders entirely in Polish when asked', () => {
    const html = render({ response: fixture(), initialViewport: VP, language: 'pl' });
    expect(html).toContain('Przejdź do analizy');
    expect(html).toContain('ŹRÓDŁA I DONIESIENIA');
    expect(html).not.toContain('Skip to analysis');
    expect(html).not.toContain('SOURCES DOCK');
  });

  it('place names keep their diacritics and are never truncated by the frame', () => {
    const html = render({
      response: fixture({ precision: 'city', city: 'kraków', countryName: 'Poland' }),
      initialViewport: VP, language: 'pl',
    });
    expect(html).toContain('Kraków');
  });

  it('no frame string is hard-coded in a component', () => {
    const offenders: string[] = [];
    for (const file of readdirSync(__dirname).filter((f) => /\.tsx$/.test(f))) {
      const text = src(file);
      // Long capitalised prose in JSX text position would be untranslated copy.
      if (/>\s*[A-Z][a-z]+ [a-z]+ [a-z]+ [a-z]+/.test(text)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});

/* PAF acceptance test 24 */
describe('PAF-24 — long text', () => {
  it('a 40-claim dimension paginates at 8 with SHOW REMAINING', () => {
    expect(CLAIM_PAGE_SIZE).toBe(8);
    expect(src('DimensionPanel.tsx')).toMatch(/entries\.slice\(0, CLAIM_PAGE_SIZE\)/);
    expect(src('DimensionPanel.tsx')).toMatch(/data-paf="show-remaining"/);
  });

  it('no claim text is ever truncated — the row clamps nothing', () => {
    expect(src('ClaimRow.tsx')).not.toMatch(/line-clamp|truncate|slice\(0,/);
  });

  it('the summary is never sliced, and is no longer clamped anywhere', () => {
    /* ── RETARGETED AT H-ALPHA-VISUAL-1 H-1/H-2 ──
       OLD: the band clamped the paragraph to four lines but never sliced
       the string. The no-slicing half is the real invariant and is kept.
       The clamp itself is now a DEFECT rather than a feature: Main proved
       the band and the Executive Brief rendered the same
       `analysis.summary` simultaneously, so the clamp truncated the copy
       the reader met first. The band no longer carries the summary at
       all, and the Executive Brief renders it whole. */
    /* Comments stripped: BriefRow names the removed clamp in prose
       precisely to record that it is gone, and matching that prose
       instead of the code is a trap this lane has paid for before. */
    const briefCode = src('BriefRow.tsx')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
    expect(briefCode).not.toMatch(/line-clamp/);
    expect(briefCode).not.toMatch(/paragraph\.slice|substring|split\('\. '\)/);
    expect(src('AnalysisFrame.tsx')).not.toMatch(/line-clamp[^"'\s]*[\s"']*[^>]*brief-synthesis/);
  });
});

/* PAF acceptance test 26 */
describe('PAF-26 — no prototype residue', () => {
  it('no illustrative content from the reference prototype ships', () => {
    const banned = [
      'District health programme expansion announced in Kigali',
      'Agreement on the announcement, divergence on funding basis',
      'The EastAfrican',
      'Analysis Workspace v3',
      'GNAI MAP',
    ];
    for (const file of readdirSync(__dirname).filter((f) => /\.tsx?$/.test(f) && !f.includes('Fixtures') && !f.endsWith('.spec.ts'))) {
      for (const phrase of banned) {
        expect(`${file} / ${phrase}: ${src(file).includes(phrase)}`).toBe(`${file} / ${phrase}: false`);
      }
    }
  });
});

/* PAF acceptance test 25 is a diff-scope assertion; see frameNoContractChange.spec.ts */
describe('CompleteRecordView', () => {
  it('is a separate destination with its own back control and permits document scroll', () => {
    const html = renderToStaticMarkup(
      createElement(CompleteRecordView as never, { response: fixture() } as never),
    );
    expect(html).toContain('COMPLETE ANALYSIS RECORD');
    expect(html).toContain('FORENSIC / AUDIT PATH · NOT THE READING PATH');
    expect(html).toContain('ANALYSIS WORKSPACE');
  });
});

describe('frameGeometry is the single source of the track numbers', () => {
  it('frameGeometry is still the single source of the COLUMN numbers', () => {
    /* ── RETARGETED BY H-ALPHA-1 (R1) ── OLD: the rendered grid rows equal `resolveTracks`
       exactly. WHY IT CHANGED: ruling 1 removes the row template; ruling
       14 keeps `frameGeometry.ts` untouched, and it still owns the COLUMN
       model, which is what the desktop composition depends on. NEW: the
       columns still come from that one module, asserted at each desktop
       breakpoint — the single-source property, on the axis that still has
       one. */
    for (const [width, cols] of [
      [1440, '260px minmax(0,1fr) 296px'],
      [1024, '212px minmax(0,1fr) 252px'],
      [768, 'minmax(0,1fr) 268px'],
    ] as Array<[number, string]>) {
      const html = render({ response: fixture(), initialViewport: { width, height: 900 } });
      expect({ width, ok: html.includes(`grid-template-columns:${cols}`) }).toEqual({ width, ok: true });
    }
  });
});
