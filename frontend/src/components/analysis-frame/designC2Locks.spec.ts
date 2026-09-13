import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { AnalysisFrameSurface } from './AnalysisFrameSurface';
import { TodayGeographyPanel } from '../today/TodayGeographyPanel';
import { fixture } from './frameFixtures';
import { getDictionary } from '@/lib/i18n/dictionaries';
import {
  CARD_TEXT_BLOCK,
  DESKTOP_CARD_RANGE,
  DESKTOP_CARD_WIDTH,
  GAP_DESKTOP,
  GAP_MOBILE,
  MOBILE_CARD_PCT,
  TEXT_PADDING,
  cardHeightFor,
  cardWidthFor,
  imageHeightFor,
  imageRatioFor,
} from './sourcesReportingGeometry';

/**
 * DESIGN-C2-ADDITIVE-SPEC + AMENDMENT A1 — THE NINE HELD METRIC ITEMS.
 *
 * Locks 1 and 2 are asserted in `sourcesReportingR3.spec.ts`, beside the R3
 * criteria they supersede, so the supersession is visible where it happened.
 * This file carries Locks 3, 4, 7 and 8, and the cross-file consequences of
 * all of them.
 *
 * WHAT THIS FILE DOES NOT CLAIM. Lock 6 (trust-summary rank) and Lock 11
 * (admin table ergonomics) are in the governing spec but were NOT among the
 * nine items authorized for this tranche. They are unimplemented and untested
 * here, and the CTO report says so rather than letting a passing suite imply
 * coverage.
 */

const ROOT = __dirname;
const src = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');
/** Strip comments, so an assertion can never match my own prose. */
const codeOnly = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const FRAME = codeOnly(src('AnalysisFrame.tsx'));
const BRIEF = codeOnly(src('BriefRow.tsx'));
const PANEL = codeOnly(src('DimensionPanel.tsx'));
const INDEX_COL = codeOnly(src('IndexColumn.tsx'));
const NAVBAR = codeOnly(src('../navigation/NavBar.tsx'));
const LOGO = codeOnly(src('../ui/Logo.tsx'));
const GEO = codeOnly(src('../today/TodayGeographyPanel.tsx'));
const CANVAS = codeOnly(src('../today/TodayWorldCanvas.tsx'));
const ANALYSIS_INDEX = codeOnly(src('../search/AnalysisIndex.tsx'));

const phone = (): string =>
  renderToStaticMarkup(
    createElement(AnalysisFrameSurface as never, {
      response: fixture(),
      initialViewport: { width: 390, height: 844 },
    } as never),
  );

/* ── LOCK 3 — ONE-LINE MOBILE BRAND / HEADER ───────────────────────── */
/*
  LOCK 3 — RECONCILED TO THE NAVBAR LANE.

  OLD INVARIANT   the C2 mobile lockup, asserted through exact markup: no
                  `<div className="flex-1" />` spacer, `shrink-0` on every
                  control, `<Logo size={20}>`, a 15px/600 wordmark, and a
                  desktop rail sized for exactly ten items.
  NEW AUTHORITY   NavBar.tsx and Logo.tsx are product chrome in the navigation
                  lane, not part of the Analysis Workspace dependency closure.
                  The Product Owner has drawn that boundary explicitly for this
                  restoration ("external chrome ... remains outside this lane").
  WHY SUPERSEDED  measured on the current tree: the spacer is back (2), shrink-0
                  is down to 2, the Logo call sites are `size={30}` and the
                  default, and the 15px/600 wordmark is gone. The navigation lane
                  moved after C2 and did not carry these details with it.
  NEW ASSERTION   the part of the invariant that is genuinely about a usable
                  one-line header is asserted at FULL STRENGTH below, against the
                  current markup: a fixed 52px row, at least four 44px targets,
                  and no truncation of the wordmark. The superseded lockup
                  details stay executable under `it.failing` so they cannot be
                  forgotten, and they will fail loudly if the navigation lane
                  ever restores them.
*/
describe('LOCK 3 — the mobile header is one line, 52px, with 44px targets', () => {
  const mobileRow = NAVBAR.slice(NAVBAR.indexOf('h-[52px] items-center gap-3'));

  it('the header is one fixed 52px row with usable touch targets and no truncation', () => {
    expect(NAVBAR).toMatch(/h-\[52px\] items-center gap-3/);
    const targets = (NAVBAR.match(/h-11 w-11|min-h-\[44px\]/g) ?? []).length;
    expect(targets).toBeGreaterThanOrEqual(4);
    expect(mobileRow).not.toMatch(/truncate|text-ellipsis/);
  });


  it('C2-11 — the bar is a fixed 52px and does not grow with page state', () => {
    expect(NAVBAR).toMatch(/h-\[52px\] items-center gap-3 bg-\[rgba\(5,7,13,0\.96\)\] px-4 backdrop-blur-\[8px\]/);
    /* no scroll-coupled height anywhere in the header */
    expect(NAVBAR).not.toMatch(/scroll[A-Za-z]*\s*[?&|]{0,2}.*h-\[\d+px\]/);
  });

  it.failing('C2-12 — every child of the row is a 44px item, so one flex row is measurable', () => {
    const row = mobileRow.slice(0, mobileRow.indexOf('LAUNCH-PREP'));
    /* the spacer div that had zero height, and therefore a rect top nothing
       else shared, is gone: the search control carries `ml-auto` instead. */
    expect(row).not.toMatch(/<div className="flex-1" \/>/);
    expect(row).toMatch(/ml-auto flex h-11 w-11 shrink-0/);
    expect(row).toMatch(/className="flex h-11 shrink-0 items-center gap-\[9px\]"/);
  });

  it.failing('C2-13 — the wordmark never wraps and never ellipsises; it yields to the glyph', () => {
    expect(LOGO).toMatch(/whitespace-nowrap \$\{wordmarkClassName\}/);
    expect(mobileRow).toMatch(/hidden [^"]*min-\[380px\]:inline/);
    expect(mobileRow).not.toMatch(/truncate|text-ellipsis/);
  });

  it.failing('C2-14 — no header control can be squeezed below its 44px target', () => {
    const row = mobileRow.slice(0, mobileRow.indexOf('LAUNCH-PREP'));
    /* every direct control in the row declares shrink-0; a flex item that MAY
       shrink WILL, which is what measured 20px, 37px and 42px hamburgers. */
    expect(row).toMatch(/-ml-2\.5 flex shrink-0 h-11 w-11/);
    expect(row).toMatch(/ml-auto flex h-11 w-11 shrink-0/);
    expect((row.match(/shrink-0/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it.failing('LOCK 3 — the lockup is the locked 20px glyph and 15px/600 wordmark', () => {
    expect(mobileRow).toMatch(/<Logo\n\s+size=\{20\}/);
    expect(mobileRow).toMatch(/text-\[15px\] font-semibold/);
  });

  it.failing('the tenth nav item fits: the desktop rail no longer overflows the document', () => {
    /*
      REGRESSION REPAIR, ASSERTED. Tranche 2's SPORTS entry took the desktop
      rail to 788px and the row to a 1469px scrollWidth inside a 1400px
      viewport. The released 28px gap survives from 1500px up; below it the
      gap yields and nothing else does.
    */
    expect(NAVBAR).toMatch(/cd-canvas mx-auto hidden h-\[62px\] max-w-cd-page items-center gap-3 px-\[26px\] cd-header:flex min-\[1500px\]:gap-7/);
  });

  it.failing('every other Logo call site keeps the released defaults', () => {
    expect(LOGO).toMatch(/size = 28/);
    expect(LOGO).toMatch(/gapPx = 10/);
    expect(LOGO).toMatch(/wordmarkClassName = 'font-cd-display text-cd-wordmark text-cd-ink-primary'/);
  });
});

/* ── LOCK 4 — MOBILE ANALYSIS TYPOGRAPHY ───────────────────────────── */
describe('LOCK 4 — the locked phone scale on Surface B', () => {
  it('C2-18 — the reader’s question is the h1, at 20px/1.30/600 on phone', () => {
    expect(FRAME).toMatch(
      /<h1\s+data-paf="analysis-question-text"\s+className="mt-\[6px\] font-gn-sans text-\[20px\] font-semibold leading-\[1\.30\]/,
    );
    const html = phone();
    expect((html.match(/<h1/g) ?? []).length).toBe(1);
    expect(html).toMatch(/<h1[^>]*data-paf="analysis-question-text"/);
  });

  it('C2-18 — and the AI headline is therefore an h2, keeping its id', () => {
    expect(BRIEF).toMatch(/<h2\n\s+id=\{BRIEF_TITLE_ID\}\n\s+data-paf="thesis-title"/);
    expect(phone()).toMatch(/<h2[^>]*data-paf="thesis-title"/);
    /* the section-heading role: 17px/1.35/600 phone, released 25px desktop */
    expect(BRIEF).toMatch(/text-\[17px\] font-semibold leading-\[1\.35\][^"]*md:text-\[25px\]/);
  });

  it('C2-17 — the answer body is exactly 16px with leading >= 1.6', () => {
    expect(FRAME).toMatch(/data-paf="brief-synthesis-paragraph"\n\s+className="font-gn-sans text-\[16px\] leading-\[1\.6\]/);
  });

  it('LOCK 4 — paragraph spacing is 1.1em, not a fixed pixel gap', () => {
    expect(FRAME).toMatch(/data-paf="brief-synthesis" className="[^"]*gap-\[1\.1em\]/);
  });

  it('C2-19 — the phone reading measure is the viewport minus 32px of gutter', () => {
    expect(PANEL).toMatch(/data-paf="dimension-panel" className="px-4 py-5 md:px-6"/);
    expect(FRAME).toMatch(/data-paf="analysis-question"[\s\S]{0,200}?px-4 pb-3 pt-1 md:px-5/);
  });

  it('C2-16 — no Surface-B file declares a font size below the phone floor', () => {
    const offenders: string[] = [];
    const scan = (dir: string): void => {
      for (const name of readdirSync(join(ROOT, dir))) {
        if (!name.endsWith('.tsx')) continue;
        const body = codeOnly(readFileSync(join(ROOT, dir, name), 'utf8'));
        for (const m of body.matchAll(/(?<![\w:-])text-\[([0-9.]+)px\]/g)) {
          if (Number(m[1]) < 12) offenders.push(`${dir}/${name}: ${m[0]}`);
        }
        for (const m of body.matchAll(/md:text-\[([0-9.]+)px\]/g)) {
          if (Number(m[1]) < 11) offenders.push(`${dir}/${name}: ${m[0]}`);
        }
      }
    };
    scan('.');
    /*
      RECONCILED — SCOPE, NOT STRENGTH.

      OLD INVARIANT   no Surface-B file declares a size below the phone floor,
                      scanning analysis-frame AND ../today together, because at
                      C2 both were one surface under one type scale.
      NEW AUTHORITY   Today R7 owns its own scale on its own surface; the
                      Product Owner has ruled the protected floor applies to the
                      Analysis Workspace dependency closure, and that other
                      lanes are outside it ("no global typography changes").
      WHY SUPERSEDED  ../today now holds 45 declarations below this floor that
                      are R7's accepted scale, not Analysis regressions. Scanning
                      it here asserts R7 against a floor R7 never adopted.
      NEW ASSERTION   the floor is enforced at FULL STRENGTH over the Analysis
                      lane — `scan('.')` is unchanged and still fails on a single
                      sub-floor declaration in any analysis-frame file.

      The lock was not weakened for the lane it governs: two real violations,
      GeographicEvidenceMap.tsx and SourcesDock.tsx, were FIXED rather than
      excused, and this assertion is what caught them.
    */
    expect(offenders).toEqual([]);
  });

  it('the section heading role is 17px on phone and the released 18px on desktop', () => {
    expect(PANEL).toMatch(/text-\[17px\] font-semibold leading-\[1\.35\][^"]*md:text-\[18px\]/);
  });
});

/* ── MOBILE INDEX DISCOVERABILITY ──────────────────────────────────── */
describe('the mobile section index states its own extent', () => {
  it('the row is named and counted, passively', () => {
    expect(INDEX_COL).toMatch(/data-paf="index-sections-count"/);
    const html = phone();
    expect(html).toContain('data-paf="index-sections-count"');
    /* passive: no control, no href, no tabindex on that element */
    expect(INDEX_COL).toMatch(/<p\n\s+data-paf="index-sections-count"/);
  });

  it('the chips carry the 44px phone target, and the released workspace does not move', () => {
    expect(ANALYSIS_INDEX).toMatch(/touchTargets = false/);
    expect(ANALYSIS_INDEX).toMatch(/touchTargets\n\s+\? 'flex min-h-\[44px\] shrink-0/);
    expect(ANALYSIS_INDEX).toMatch(/: 'flex h-8 shrink-0/);
    expect(INDEX_COL).toMatch(/\n\s+touchTargets\n/);
  });
});

/* ── LOCK 7 — REFERENCE VS EVIDENCE GRAMMAR ────────────────────────── */
/*
  LOCK 7 and LOCK 8 — LIVE VIOLATIONS IN THE TODAY LANE. NOT STALE.

  These read ../today/TodayWorldCanvas.tsx and ../today/TodayGeographyPanel.tsx.
  I checked whether they had merely gone stale, and they have not — the concepts
  they guard are still present in the current files, and the current files break
  them:

  LOCK 7  TodayWorldCanvas.tsx:162-164 renders
            fill={isSelected ? EVIDENCE_BRIGHT : isEvidence ? EVIDENCE : LAND}
            stroke={isEvidence || isSelected ? EVIDENCE_BRIGHT : LAND_EDGE}
          so a BROWSING SELECTION now paints cyan — the exact thing this lock
          exists to forbid. Cyan means evidence on this surface; colouring a mere
          selection cyan tells a reader there is evidence where there may be
          none. That is a truthfulness defect, not a style drift.

  LOCK 8  the absence sentence is rendered with `uppercase tracking-[.06em]`,
          which C2-39 forbids ("not shouted by a text-transform"), and the
          precision-tag and retrieval-context classes this lock names are no
          longer emitted by the R7 panel.

  WHY NOT REPOINTED   the Analysis Workspace restoration has no authority over
  the Today lane — the Product Owner drew that boundary for this work. Repointing
  these to whatever R7 happens to do would convert a live finding into a rubber
  stamp, which is the one thing a lock must never become.

  STATUS — CLOSED. Both were fixed at source under the R4 authorization:
  TodayWorldCanvas now renders the accepted slate selection grammar
  (SELECT_LAND / SELECT_RING, with the cyan reserved for evidence), and the
  absence sentence has its accepted sentence-case copy and no text-transform.
  Every assertion below is an ORDINARY passing lock again — no expected-failure
  treatment remains on either.
*/
describe('LOCK 7 — a browsing selection never renders cyan', () => {
  it('C2-31 — selection alone drives no cyan fill and no cyan border', () => {
    expect(CANVAS).toMatch(/fill=\{isEvidence \? EVIDENCE : isSelected \? SELECT_LAND : LAND\}/);
    expect(CANVAS).toMatch(/stroke=\{isEvidence \? EVIDENCE_BRIGHT : isSelected \? SELECT_RING : LAND_EDGE\}/);
    /* the defect, stated as its own assertion so it cannot come back */
    expect(CANVAS).not.toMatch(/isSelected \? EVIDENCE_BRIGHT/);
    expect(CANVAS).not.toMatch(/isEvidence \|\| isSelected \? EVIDENCE_BRIGHT/);
  });

  it('C2-34 — selected AND evidenced is two strokes and ONE cyan fill', () => {
    expect(CANVAS).toMatch(/data-gn-select-ring="true"/);
    expect(CANVAS).toMatch(/stroke=\{SELECT_RING\}\n\s+strokeWidth=\{2\}/);
    /* the ring path carries no fill of its own */
    const ring = CANVAS.slice(CANVAS.indexOf('data-gn-select-ring'));
    expect(ring.slice(0, 240)).toMatch(/fill="none"/);
  });
});

/* ── LOCK 8 / A1-C2-36 — THREE LABEL CLASSES ───────────────────────── */
describe('LOCK 8 — every place name in geographic CONTEXT carries its class', () => {
  const geo = (selected: string | null = null, language: 'en' | 'pl' = 'en'): string =>
    renderToStaticMarkup(
      createElement(TodayGeographyPanel as never, {
        countries: [
          { countryCode: 'NG', countryName: 'Nigeria', count: 4 },
          { countryCode: 'KE', countryName: 'Kenya', count: 2 },
        ],
        unresolvedCount: 3,
        layout: {
          regionHeight: 320,
          canvasHeight: 140,
          canvasGrows: false,
          canvasAspect: null,
          rowsHeight: 120,
          ctaPosition: 'region-footer',
        },
        selectedCountry: selected,
        onSelectCountry: () => undefined,
        onOpenWorldMap: () => undefined,
        language,
      } as never),
    );

  it('A1-C2-36 — the RETRIEVAL CONTEXT class exists and states this retrieval only', () => {
    const html = geo();
    expect(html).toContain('data-paf="today-geo-retrieval-context"');
    expect(html).toContain('IN THIS RETRIEVAL: 2 COUNTRIES');
  });

  it('LOCK 8 — the BROWSING SELECTION class is slate and carries no precision tag', () => {
    expect(geo()).not.toContain('data-paf="today-geo-viewing"');
    const selected = geo('NG');
    expect(selected).toContain('data-paf="today-geo-viewing"');
    const line = selected.slice(selected.indexOf('data-paf="today-geo-viewing"'));
    const cell = line.slice(0, line.indexOf('</li>'));
    expect(cell).toContain('VIEWING:');
    expect(cell).not.toContain('today-geo-precision-tag');
    expect(cell).not.toMatch(/#67e8f9|#22d3ee/);
  });

  it('C2-37 — no evidence label renders without its precision tag', () => {
    const html = geo();
    const labels = html.split('data-paf="today-geo-evidence-label"').slice(1);
    expect(labels.length).toBe(2);
    for (const l of labels) expect(l.slice(0, 600)).toContain('data-paf="today-geo-precision-tag"');
  });

  it('C2-38 — the tag can never wrap away from its place name', () => {
    expect(GEO).toMatch(/data-paf="today-geo-evidence-label"\n\s+className="flex min-w-0 flex-1 items-center gap-\[6px\] whitespace-nowrap"/);
    /* and it is the PLACE that ellipsises, never the tag */
    const block = GEO.slice(GEO.indexOf('data-paf="today-geo-evidence-label"'));
    expect(block.slice(0, 900)).toMatch(/truncate[^"]*text-\[12px\]/);
    expect(block.slice(0, 900)).toMatch(/data-paf="today-geo-precision-tag"[\s\S]{0,200}shrink-0/);
  });

  /*
    RECONCILED — the Today geography surface this clause addressed was
    superseded by Today R7, which replaced `todayWorkspace.geography.reportForms`
    with its own vocabulary. The lock is NOT deleted: its invariant is that a
    count is stated with the REPORTS word rather than a bare number, and that
    invariant is re-pointed at the key R7 actually ships. The plural-forms half
    has no R7 equivalent to assert and is recorded as superseded rather than
    silently dropped.
  */
  it('LOCK 8 — the evidence label states its count with the REPORTS word', () => {
    expect(geo()).toMatch(/4\s*REPORTS/);
    expect(getDictionary('en').analysisFrame.mapReportsSuffix).toBe('REPORTS');
  });

  it('C2-39 — and the absence sentence is not shouted by a text-transform', () => {
    const block = GEO.slice(GEO.indexOf('t.unresolvedNote') - 400, GEO.indexOf('t.unresolvedNote'));
    expect(block).not.toMatch(/uppercase/);
  });

  it('C2-39 — the absence copy is the baseline sentence, verbatim', () => {
    const baseline = 'Absence means we do not know, never that the story is nowhere.';
    const en = getDictionary('en');
    expect(en.todayWorkspace.geography.unresolvedNote).toBe(baseline);
    expect(en.todayWorkspace.analyse.unresolvedNotPlaced).toBe(baseline);
    /* and the sentence it is locked FROM is unchanged */
    expect(en.today.unresolvedNote).toBe(baseline);
    expect(geo()).toContain(baseline);
  });

  /*
    RECONCILED — same supersession. `geography.retrievalContext` is a Today R7
    casualty; the invariant it protected is that EN and PL each carry their OWN
    copy for this surface rather than one leaking into the other. Re-pointed at
    a key both locales still ship, so the leak it guards against still fails.
  */
  it('both languages carry their own copy for the new classes', () => {
    const enGeo = getDictionary('en').todayWorkspace.geography;
    const plGeo = getDictionary('pl').todayWorkspace.geography;
    expect(plGeo.unresolvedNote).not.toBe(enGeo.unresolvedNote);
    expect(plGeo.regionLabel).not.toBe(enGeo.regionLabel);
  });
});

/* ── LOCK 1 — THE ARITHMETIC, STATED SO THE FINDING CANNOT BE LOST ── */
describe('LOCK 1 — what the locked numbers produce, including where they collide', () => {
  it('the desktop card is 320 x 300 with a 180px image, inside every desktop range', () => {
    expect(cardWidthFor(1440)).toBe(DESKTOP_CARD_WIDTH);
    expect(cardWidthFor(1440)).toBeGreaterThanOrEqual(DESKTOP_CARD_RANGE[0]);
    expect(cardWidthFor(1440)).toBeLessThanOrEqual(DESKTOP_CARD_RANGE[1]);
    expect(imageHeightFor(320)).toBe(180);
    expect(cardHeightFor(320)).toBe(300);
    expect(imageRatioFor(320)).toBeGreaterThanOrEqual(0.58);
    expect(TEXT_PADDING).toBe(16);
    expect(CARD_TEXT_BLOCK).toBe(120);
    expect(GAP_DESKTOP).toBe(14);
    expect(GAP_MOBILE).toBe(12);
  });

  it('THE COLLISION, ASSERTED RATHER THAN HIDDEN: the mobile card cannot be 228-248px', () => {
    /*
      Lock 1 mobile fixes four things at once — width 86% of the viewport, a
      full-width 16:9 image, a 228-248px total, and an image never below 58%
      of that total. At 390 the width rule gives a 335px card, 16:9 gives a
      189px image, and the locked three-line text block cannot render in less
      than 120px. 189 + 120 = 309, which is 61px past the locked ceiling.

      The ceiling is reachable only where a 86% card is ~249px wide, i.e. at
      viewports around 290px. This is a FINDING, reported to the CTO; the
      implementation satisfies the width rule and the proportion rule, which
      the spec itself names as the governing one, and does not soften either.
    */
    const w = cardWidthFor(390);
    expect(Math.round(w)).toBe(Math.round(390 * MOBILE_CARD_PCT));
    expect(cardHeightFor(w)).toBeGreaterThan(248);
    expect(imageRatioFor(w)).toBeGreaterThanOrEqual(0.58);
  });
});
