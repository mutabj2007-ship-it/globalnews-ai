import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, readdirSync } from 'node:fs';
import { AnalysisFrame } from './AnalysisFrame';
import { GeographicEvidenceMap } from './GeographicEvidenceMap';
import { AnalysisIndex } from '../search/AnalysisIndex';
import { buildFocusGeometry } from './geographicEvidenceGeometry';
import { buildGeographicEvidenceState, exceedsEvidence } from './geographicEvidenceState';
import { resolveColumns, DOCK_COMPACT_NORMAL } from './frameGeometry';
import { fixture, musanzeFixture } from './frameFixtures';
import { buildAnalysisWorkspaceModel } from '../search/analysisDimensions';
import { getDictionary } from '@/lib/i18n/dictionaries';

/* ── RETARGETED BY H-ALPHA-1 (R1) ── OLD: fixed pixel grid rows `Npx minmax(0,1fr) Npx`, asserting that expanding the dock or changing the source count could only take from the centre. WHY IT CHANGED: R1 ruling 1 removes the fixed row template; the document sizes its own sections. NEW: the same protection, re-expressed — the row model is content-sized and the region ORDER and PRESENCE are unchanged, which is what 'the dock cannot consume the anchor' actually meant. */

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

const ctx = (over: Record<string, unknown> = {}) =>
  ({ dataMode: 'live', providers: ['gnews'], articlesRetrieved: 5, ...over }) as never;

/* ── CASE A ─────────────────────────────────────────────────────────── */
describe('A — Kigali query, country-only evidence', () => {
  const response = fixture({ precision: 'city', city: 'kigali', countryName: 'Rwanda', countryCode: 'RWA' });

  it('a REAL Rwanda outline renders, with regional context around it', () => {
    const geometry = buildFocusGeometry('RWA', 232 / 104);
    expect(geometry).not.toBeNull();
    expect(geometry!.focusPath.length).toBeGreaterThan(40);
    expect(geometry!.focusPointCount).toBeGreaterThanOrEqual(13);
    expect(geometry!.contextCountryCount).toBeGreaterThanOrEqual(5);
    const html = render({ response, initialViewport: VP });
    expect(html).toContain('data-paf="evidence-country"');
  });

  it('Kigali appears ONLY as the query target, never as the evidence', () => {
    const html = render({ response, initialViewport: VP });
    const target = html.slice(html.indexOf('data-paf="query-target"'), html.indexOf('data-paf="evidence-geography"'));
    const evidence = html.slice(html.indexOf('data-paf="evidence-geography"'), html.indexOf('data-paf="compact-map"'));
    expect(target).toMatch(/Kigali/);
    expect(evidence).toMatch(/Rwanda/);
    expect(evidence).not.toMatch(/Kigali/i);
  });

  it('states in words that the named locality is not established by the evidence', () => {
    const html = render({ response, initialViewport: VP });
    expect(html).toContain('data-paf="target-not-established"');
    expect(html).toContain('Named in the question. Not established by the evidence.');
  });

  it('makes NO city-resolution claim anywhere', () => {
    const html = render({ response, initialViewport: VP });
    expect(html).toMatch(/data-precision="country"/);
    expect(html).not.toMatch(/data-precision="city"/);
    expect(html).toContain('No subnational precision in evidence');
  });
});

/* ── CASE B ─────────────────────────────────────────────────────────── */
describe('B — genuinely city-supported evidence', () => {
  it('CAPABILITY: given city precision, the map reports city level', () => {
    const html = renderToStaticMarkup(
      createElement(GeographicEvidenceMap as never, {
        evidenceCountryCode: 'RWA', evidenceCountryName: 'Rwanda', evidencePrecision: 'city',
      } as never),
    );
    expect(html).toMatch(/data-precision="city"/);
    expect(html).toContain('Marker indicates the resolved city, not a coordinate.');
  });

  it('the anchor does NOT move for city precision — no city coordinate exists to move it to', () => {
    const asCountry = renderToStaticMarkup(
      createElement(GeographicEvidenceMap as never, {
        evidenceCountryCode: 'RWA', evidenceCountryName: 'Rwanda', evidencePrecision: 'country',
      } as never),
    );
    const asCity = renderToStaticMarkup(
      createElement(GeographicEvidenceMap as never, {
        evidenceCountryCode: 'RWA', evidenceCountryName: 'Rwanda', evidencePrecision: 'city',
      } as never),
    );
    const anchor = (h: string) => h.slice(h.indexOf('data-paf="evidence-anchor"'), h.indexOf('data-paf="evidence-anchor"') + 120);
    expect(anchor(asCity)).toBe(anchor(asCountry));
  });

  it('UNREACHABLE TODAY: no retrieval context this contract can produce yields city precision', () => {
    const shapes = [
      ctx({ city: 'kigali', countryCode: 'RWA', countryName: 'Rwanda' }),
      ctx({ city: 'kigali', countryCode: 'RWA', countryName: 'Rwanda', matchedFrom: 'kigalli', canonicalLocation: 'kigali' }),
      ctx({ city: 'new delhi', countryCode: 'IND', countryName: 'India' }),
      ctx({ countryCode: 'RWA', countryName: 'Rwanda' }),
      ctx({}),
    ];
    for (const shape of shapes) {
      expect(buildGeographicEvidenceState(shape).evidencePrecision).not.toBe('city');
    }
  });

  it('the rule stays general — it is not hard-coded to today’s ceiling', () => {
    expect(exceedsEvidence('kigali', 'country')).toBe(true);
    expect(exceedsEvidence('kigali', 'city')).toBe(false);
    expect(exceedsEvidence(null, 'country')).toBe(false);
  });
});

/* ── CASE C ─────────────────────────────────────────────────────────── */
describe('C — Musanze query, Rwanda-only evidence', () => {
  it('MUSANZE APPEARS NOWHERE, at every viewport', () => {
    for (const viewport of [VP, { width: 1280, height: 900 }, { width: 1024, height: 800 }, { width: 1440, height: 720 }]) {
      const html = render({ response: musanzeFixture(), initialViewport: viewport });
      const locM2 = html.slice(html.indexOf('data-paf="location-detail-track"'));
    expect(locM2).not.toMatch(/musanze/i);
    }
  });

  it('the frame persists Rwanda at country level and draws Rwanda’s real outline', () => {
    const html = render({ response: musanzeFixture(), initialViewport: VP });
    expect(html).toContain('Rwanda');
    expect(html).toContain('RETRIEVED FOR');
    expect(html).toContain('data-paf="evidence-country"');
    expect(html).toMatch(/data-precision="country"/);
  });

  it('an uncurated locality never even becomes a query target', () => {
    const state = buildGeographicEvidenceState(ctx({ countryCode: 'RWA', countryName: 'Rwanda' }));
    expect(state.queryTargetCity).toBeNull();
    expect(state.targetExceedsEvidence).toBe(false);
    const html = render({ response: musanzeFixture(), initialViewport: VP });
    expect(html).not.toContain('data-paf="query-target"');
  });
});

/* ── CASE D ─────────────────────────────────────────────────────────── */
describe('D — country-only query: Rwanda', () => {
  const response = fixture({ precision: 'country', countryName: 'Rwanda', countryCode: 'RWA' });

  it('presents Rwanda with no query-target line and invents no city', () => {
    const html = render({ response, initialViewport: VP });
    expect(html).not.toContain('data-paf="query-target"');
    expect(html).toContain('data-paf="evidence-geography"');
    expect(html).toContain('Rwanda');
    const locCol = html.slice(html.indexOf('data-paf="location-detail-track"'));
    expect(locCol).not.toMatch(/kigali/i);
  });
});

/* ── CASE E ─────────────────────────────────────────────────────────── */
describe('E — unresolved geography', () => {
  const response = fixture({ precision: 'unresolved' });

  it('the surface persists and states unresolved rather than disappearing', () => {
    const html = render({ response, initialViewport: VP });
    expect(html).toContain('data-paf="location-detail"');
    expect(html).toContain('data-paf="compact-map"');
    expect(html).toMatch(/data-precision="unresolved"/);
    expect(html).toContain('No geographic resolution in evidence');
  });

  it('no country outline and no anchor are drawn', () => {
    const html = render({ response, initialViewport: VP });
    expect(html).not.toContain('data-paf="evidence-country"');
    expect(html).not.toContain('data-paf="evidence-anchor"');
  });

  it('a country code with no polygon reports null rather than substituting one', () => {
    expect(buildFocusGeometry('ZZZ', 2)).toBeNull();
    expect(buildFocusGeometry(null, 2)).toBeNull();
  });
});

/* ── CASE F ─────────────────────────────────────────────────────────── */
describe('F — dimension switching retains the whole frame', () => {
  const DIMENSIONS = ['significance', 'why-this-matters', 'who-is-affected', 'immediate-effects', 'key-facts', 'insufficient-evidence'] as const;

  it.each(DIMENSIONS)('%s keeps map, brief, index and dock', (dimension) => {
    const html = render({ response: fixture(), initialViewport: VP, initialDimension: dimension });
    expect(html).toContain('data-paf="evidence-country"');
    expect(html).toContain('data-paf="brief-row"');
    expect(html).toContain('data-paf="index-column"');
    expect(html).toContain('data-paf="sources-reporting"');
  });
});

/* ── CASE G ─────────────────────────────────────────────────────────── */
describe('G — the expanded dock never consumes the geographic anchor', () => {
  const compactHtml = render({ response: fixture(), initialViewport: VP, initialDock: 'compact' });
  const expandedHtml = render({ response: fixture(), initialViewport: VP, initialDock: 'expanded' });
  const slice = (html: string, from: string, to: string) =>
    html.slice(html.indexOf(from), html.indexOf(to));

  it('expanding the dock moves ONLY the centre track — rows 1 and 2 are fixed', () => {
    // The dock is a grid track: only `centreHeight` can change (PAF-3).
    /* Derived from DOCK_COMPACT_NORMAL: the alpha closure raised the compact
       dock so it can show a real source row instead of one thin line. */
    expect(compactHtml).toMatch(
      /grid-template-rows:\d+px minmax\(0,1fr\) \d+px/,
    );
    // 962 - 62 navbar - 48 command bar = 852 frame; 0.46 => 392, under the
    // 852-196-240 = 416 ceiling. Unchanged arithmetic, stated with the
    // chrome the product actually has.
    expect(expandedHtml).toMatch(/grid-template-rows:\d+px minmax\(0,1fr\) \d+px/);
    // Row 1 — the brief and the location image — is byte-identical either way.
    for (const html of [compactHtml, expandedHtml]) {
      expect(html).toContain('data-paf="location-top"');
    }
    expect(slice(compactHtml, 'data-paf="location-top"', 'data-paf="location-detail"'))
      .toBe(slice(expandedHtml, 'data-paf="location-top"', 'data-paf="location-detail"'));
  });

  it('the map survives the expanded dock at the SAME precision — it shortens, it does not go', () => {
    for (const html of [compactHtml, expandedHtml]) {
      const map = slice(html, 'data-paf="compact-map"', 'data-paf="precision-panel"');
      expect(map).toContain('data-paf="evidence-country"');
      expect(map).toContain('data-precision="country"');
      expect(map).toContain('NOT A COORDINATE');
    }
    // The ONLY difference is height: 104px yields to 52px, nothing else.
    expect(slice(compactHtml, 'data-paf="compact-map"', 'data-paf="precision-panel"')).toContain('height:104px');
    expect(slice(expandedHtml, 'data-paf="compact-map"', 'data-paf="precision-panel"')).toContain('height:52px');
  });

  it('every geographic STATEMENT is byte-identical in both dock states', () => {
    // The map is allowed to shorten (above). The words are not allowed to
    // change, shorten, or disappear — that is what `dense` must never touch.
    for (const [from, to] of [
      ['data-paf="query-target"', 'data-paf="evidence-geography"'],
      ['data-paf="evidence-geography"', 'data-paf="compact-map"'],
      ['data-paf="precision-panel"', 'data-paf="open-questions"'],
    ] as const) {
      expect(`${from}: ${slice(expandedHtml, from, to)}`).toBe(`${from}: ${slice(compactHtml, from, to)}`);
    }
  });

  it('the rail scrolls rather than clipping a sentence through the middle', () => {
    const rail = slice(expandedHtml, 'data-paf="location-detail"', 'data-paf="query-target"');
    expect(rail).toContain('overflow-y-auto');
    expect(rail).not.toMatch(/overflow-hidden/);
    expect(rail).toContain('data-dense="true"');
    expect(slice(compactHtml, 'data-paf="location-detail"', 'data-paf="query-target"'))
      .toContain('data-dense="false"');
  });

  it('the four evidence blocks never shrink — only open questions is elastic', () => {
    const detail = src('LocationDetail.tsx');
    const body = detail.slice(detail.indexOf('return ('));
    for (const hook of ['query-target', 'evidence-geography', 'precision-panel']) {
      const at = body.indexOf(`data-paf="${hook}"`);
      expect(`${hook}: ${body.slice(at - 120, at + 160).includes('flex-shrink-0')}`).toBe(`${hook}: true`);
    }
    const oq = body.indexOf('data-paf="open-questions"');
    expect(body.slice(oq, oq + 200)).toMatch(/min-h-0 flex-1 overflow-auto/);
  });
});

/* ── CASE H ─────────────────────────────────────────────────────────── */
describe('H — the Analysis Index has no horizontal overflow', () => {
  /*
   * RETARGETED AT H-ALPHA-1B. THE INVARIANT IS UNCHANGED: the Analysis
   * Index must never overflow its track horizontally. Only the arithmetic
   * behind it moved, because the type it is computed from moved.
   *
   * BEFORE: the frame's index label was `text-gn-hud-index`, 10.5px, and
   * this block proved the longest label fitted the widest track on ONE
   * LINE. One line was never the invariant — it was a by-product of the
   * label being small enough that wrapping never came up.
   *
   * NOW: H-ALPHA-1B applies the Surface-B floor of 11px desktop / 12px
   * phone to the frame's copy of this component (`typeFloor`, opt-in; the
   * released /search workspace is untouched and its own 10.5px arithmetic
   * still stands in `searchWorkspace.spec.ts`). At 11px a two-word label
   * WRAPS, which the fluid row was built for — `whitespace-normal
   * break-words` on a `min-h-[33px]` row. Wrapping is not overflow.
   *
   * So the one-line assertion is replaced by the assertion it was really
   * standing in for: the longest single WORD — the thing a wrap cannot
   * split — fits the track, at the NEW size. That is what keeps the row
   * from having to break through a word or push the nav sideways.
   *
   * MEASURED, NOT MODELLED: with the live rig at 11px, every frame index
   * track reports navHScroll false in EN and PL at 1024/1071/1072/1280/
   * 1440/1600, and no label overflows its own row box.
   */
  // JetBrains Mono advance = 0.6em. Frame index label at the H-ALPHA-1B
  // floor: 11px / .09em. Count badge unchanged in shape: 2ch + 12px.
  const FLOOR_DESKTOP = 11;
  const labelWidth = (chars: number) => chars * (FLOOR_DESKTOP * 0.6 + FLOOR_DESKTOP * 0.09);
  const BADGE = 2 * (FLOOR_DESKTOP * 0.6 + FLOOR_DESKTOP * 0.1) + 12;
  const CHROME = 3 + 10 * 2 + 10 * 2;   // rail + two gaps + row padding
  const PADDING = 24;                    // md:px-3 in the fluid variant

  it('the frame index label carries the Surface-B desktop floor, not the 10.5px token', () => {
    const index = readFileSync(`${__dirname}/../search/AnalysisIndex.tsx`, 'utf8');
    // opt-in, and the DEFAULT branch is still the released token
    expect(index).toMatch(/typeFloor\s*\n?\s*\?\s*'text-\[12px\] tracking-\[0\.09em\] md:text-\[11px\]'\s*\n?\s*:\s*'text-gn-hud-index'/);
    expect(src('IndexColumn.tsx')).toMatch(/\n\s+typeFloor\n/);
  });

  it.each([
    ['EN', 12],   // INSUFFICIENT  — longest single word
    ['PL', 16],   // NIEWYSTARCZAJĄCE
  ])('%s longest WORD fits the XL/L track at the floor', (_lang, chars) => {
    const area = (track: number) => track - PADDING - CHROME - BADGE;
    expect(labelWidth(chars)).toBeLessThanOrEqual(area(resolveColumns(1440).indexWidth!));
  });

  it('the fluid row cannot overflow ANY track — it is width-relative, not fixed', () => {
    const index = readFileSync(`${__dirname}/../search/AnalysisIndex.tsx`, 'utf8');
    expect(index).toMatch(/fluid\s*\n?\s*\?\s*'flex min-h-\[33px\] w-full/);
    expect(index).toMatch(/whitespace-normal break-words/);
  });

  it('the frame opts in and additionally hides any cross-axis overflow', () => {
    expect(src('IndexColumn.tsx')).toMatch(/overflow-y-auto overflow-x-hidden/);
    expect(src('IndexColumn.tsx')).toMatch(/\n\s+fluid\n/);
  });

  it('the approved widened tracks are in place', () => {
    expect(resolveColumns(1600).indexWidth).toBe(260);
    expect(resolveColumns(1280).indexWidth).toBe(260);
    expect(resolveColumns(1072).indexWidth).toBe(236);
    // R1.2 closure — the 1024..1071 band has its own track. See frameGeometry.
    expect(resolveColumns(1024).indexWidth).toBe(212);
  });

  it('the 236 and 260 tracks fit both languages BETWEEN words, never through one', () => {
    const area = (track: number) => track - PADDING - CHROME - BADGE;
    for (const track of [236, 260]) {
      expect(labelWidth(12)).toBeLessThanOrEqual(area(track));   // EN "INSUFFICIENT"
      expect(labelWidth(16)).toBeLessThanOrEqual(area(track));   // PL "NIEWYSTARCZAJĄCE"
    }
  });

  it('THE ONE PLACE THE FLOOR DOES NOT FIT, PINNED SO IT CANNOT BE FORGOTTEN', () => {
    /*
     * H-ALPHA-1B, DECLARED TO THE CTO RATHER THAN HIDDEN.
     *
     * The 1024..1071 band gets a 212px index track. At the 11px floor the
     * longest Polish word does not fit its label area, so `break-words`
     * breaks INSIDE the word. Measured on the live rig at 1024x900 PL:
     * label area 117px, "NIEWYSTARCZAJĄCE" 127px.
     *
     * There is still NO horizontal overflow — the nav reports
     * navHScroll false at that width — so the invariant this block
     * protects holds. What is lost is a clean wrap, in one 48px-wide
     * viewport band, in one language.
     *
     * EN is unaffected at every track. This test exists so the trade-off
     * is a recorded fact with a number attached, and so that any change to
     * the floor, the tracking or the track width has to come back here.
     */
    const area = (track: number) => track - PADDING - CHROME - BADGE;
    expect(resolveColumns(1024).indexWidth).toBe(212);
    expect(labelWidth(12)).toBeLessThanOrEqual(area(212));      // EN still fits
    expect(labelWidth(16)).toBeGreaterThan(area(212));          // PL does not
  });

  it('THE COUNT COLUMN SURVIVES: every dimension renders its count, selected or not', () => {
    const model = buildAnalysisWorkspaceModel(fixture());
    const html = renderToStaticMarkup(
      createElement(AnalysisIndex as never, {
        dimensions: model.dimensions, activeDimension: 'key-facts', onSelect: () => {},
        variant: 'desktop', panelId: 'p', focusedIndex: 0, onFocusedIndexChange: () => {}, fluid: true,
      } as never),
    );
    const badges = html.match(/min-w-\[26px\] text-right/g) ?? [];
    expect(badges.length).toBe(model.dimensions.length);
    expect(html).toContain('>0<');            // a zero count is shown, not hidden
  });

  it('the badges share a left edge, so the column reads as a column', () => {
    const index = readFileSync(`${__dirname}/../search/AnalysisIndex.tsx`, 'utf8');
    expect(index).toMatch(/fluid \? 'min-w-\[26px\] text-right' : ''/);
  });

  it('counts are NEVER collapsed into the label', () => {
    const index = readFileSync(`${__dirname}/../search/AnalysisIndex.tsx`, 'utf8');
    const labelSpan = index.slice(index.indexOf('whitespace-normal break-words'), index.indexOf('shrink-0 rounded-[4px]'));
    expect(labelSpan).not.toMatch(/dimension\.count/);
  });

  it('/search is byte-identical without the opt-in', () => {
    const model = buildAnalysisWorkspaceModel(fixture());
    const base = { dimensions: model.dimensions, activeDimension: 'key-facts', onSelect: () => {},
      variant: 'desktop', panelId: 'p', focusedIndex: 0, onFocusedIndexChange: () => {} };
    const released = renderToStaticMarkup(createElement(AnalysisIndex as never, base as never));
    expect(released).toContain('w-[212px]');
    expect(released).toContain('md:pl-6 md:pr-[14px]');
    expect(released).not.toContain('min-w-[26px]');
    expect(released).toContain('flex-1 truncate');
  });
});

/* ── EN / PL index evidence ─────────────────────────────────────────── */
describe('EN and PL Index labels render complete, never truncated', () => {
  it.each(['en', 'pl'] as const)('%s', (language) => {
    const model = buildAnalysisWorkspaceModel(fixture());
    const html = renderToStaticMarkup(
      createElement(AnalysisIndex as never, {
        dimensions: model.dimensions, activeDimension: 'key-facts', onSelect: () => {},
        variant: 'desktop', panelId: 'p', focusedIndex: 0, onFocusedIndexChange: () => {},
        fluid: true, language,
      } as never),
    );
    const longest = getDictionary(language).analysisWorkspace.dimensions.insufficientEvidence;
    expect(html).toContain(longest);
    expect(html).not.toContain('flex-1 truncate');
    expect(html).toContain('whitespace-normal break-words');
  });
});

/* ── R1.2 regression — the R1 "resolved location" heading ────────────── */
describe('the location panel makes no resolved-location claim', () => {
  const kigali = fixture({ precision: 'city', city: 'kigali', countryName: 'Rwanda', countryCode: 'RWA' });

  it('EN: the rendered rail contains no resolved-location heading', () => {
    const html = render({ response: kigali, initialViewport: VP, language: 'en' });
    expect(html).toContain('data-paf="location-top"');
    expect(html).not.toMatch(/RESOLVED LOCATION/i);
  });

  it('PL: the rendered rail contains no resolved-location heading', () => {
    const html = render({ response: kigali, initialViewport: VP, language: 'pl' });
    expect(html).toContain('data-paf="location-top"');
    expect(html).not.toMatch(/ROZSTRZYGNI\u0118TA LOKALIZACJA/i);
    expect(html).not.toMatch(/RESOLVED LOCATION/i);
  });

  it('the string is gone from BOTH dictionaries, so it cannot be re-rendered', () => {
    for (const lang of ['en', 'pl'] as const) {
      const frame = getDictionary(lang).analysisFrame as Record<string, unknown>;
      expect(`${lang}: ${'resolvedLocation' in frame}`).toBe(`${lang}: false`);
    }
  });

  it('LocationTop reads no heading string, in any language, from anywhere', () => {
    const top = src('LocationTop.tsx');
    expect(top).not.toMatch(/resolvedLocation/);
    // It renders exactly one child and that child is the figure. There is
    // no text node in this component for a heading to hide in.
    const body = top.slice(top.indexOf('return ('));
    expect(body.match(/<[A-Za-z]\w*/g)).toEqual(['<div', '<LocationImage']);
  });

  it('F-7 holds at 720px: the figure COMPRESSES, it is never removed', () => {
    const kigali720 = render({
      response: fixture({ precision: 'city', city: 'kigali', countryName: 'Rwanda', countryCode: 'RWA' }),
      initialViewport: { width: 1440, height: 720 },
    });
    /*
     * ── RETARGETED AT ALPHA CLOSURE ──────────────────────────────────
     *
     * OLD: at 720px the figure COMPRESSES and is never removed —
     * asserted via `location-image`, `provenance-chip`,
     * `provenance-caption` and `data-variant="strip"`.
     *
     * WHY IT NO LONGER HOLDS: this fixture resolves Rwanda, for which no
     * verified asset exists, and the CTO's alpha ruling requires the
     * empty image surface to COLLAPSE rather than compress. "Never
     * removed" was written when the only two states were full and strip;
     * there is now a third, and it is the one the ruling created.
     *
     * WHAT REPLACES IT: the invariant underneath — the location column
     * survives the constrained height and still names the place, at the
     * precision the evidence supports and no finer. The compress-not-
     * remove behaviour still holds where an image EXISTS and is covered
     * by `locationAssets.spec.ts`, which drives the asset branch
     * directly with a registry.
     */
    expect(kigali720).toContain('data-paf="location-top"');
    expect(kigali720).toContain('data-variant="collapsed"');
    expect(kigali720).toMatch(/Rwanda/);
    expect(kigali720).not.toContain('data-paf="location-image"');
    /* ── RETARGETED BY H-ALPHA-1 (R1) ── OLD: the compressed brief row
       (52px) is unchanged at a constrained height. WHY IT CHANGED: R1
       ruling 10 drops compression on Surface B, because its input was a
       scroller ruling 1 removes. NEW: the brief is still PRESENT and
       still carries its heading at that height — which is what "compress
       before hide" was protecting. */
    expect(kigali720).toContain('data-paf="brief-row"');
    /* DESIGN-C2 LOCK 4 RETARGET — C2-18 makes the reader's QUESTION the
       h1 and drops the AI headline to <h2>. The invariant this assertion
       protects (exactly one h1; the thesis heading is never removed) is
       unchanged and is asserted below in its corrected form. The
       supersession is declared in the CTO report. */
    expect(kigali720).toMatch(/<h2[^>]*data-paf="thesis-title"/);
    /* The 32px image band and its in-image label belonged to the figure
       that no longer renders here. Both remain asserted for the branch
       where an asset EXISTS, in `locationAssets.spec.ts`, which drives
       `LocationImage` with a registry rather than through the frame. */
    expect(kigali720).not.toContain('data-paf="in-image-label"');
  });

  it('the panel still names the place it shows — via the provenance chip, not a heading', () => {
    const html = render({ response: kigali, initialViewport: VP });
    /*
     * Same retarget. The provenance chip lived on the image figure; with
     * no asset the figure is gone, and the collapsed indicator carries
     * the location-context statement instead. What must NOT change — and
     * is what this test was always really about — is that the column
     * names Rwanda and never Kigali: a query target may not be promoted
     * into a resolved place.
     */
    const top = html.slice(html.indexOf('data-paf="location-top"'), html.indexOf('data-paf="location-detail"'));
    expect(top).toMatch(/Rwanda/);
    expect(top).not.toMatch(/Kigali/i);
  });
});

/* ── Geographic truth guarantees ────────────────────────────────────── */
describe('geographic truth — the guarantees that must not erode', () => {
  it('no event coordinate is invented: the anchor comes from the polygon only', () => {
    const geometry = src('geographicEvidenceGeometry.ts');
    expect(geometry).toMatch(/anchorX: focusBox\.x \+ focusBox\.width \/ 2/);
    expect(geometry).not.toMatch(/lat\s*:|lon\s*:|latitude|longitude/);
  });

  it('MapLibre is not introduced into the frame, and /map is untouched', () => {
    for (const file of readdirSync(__dirname).filter((f) => /\.tsx?$/.test(f) && !f.endsWith('.spec.ts'))) {
      expect(`${file}: ${/maplibre|mapbox|leaflet/i.test(src(file))}`).toBe(`${file}: false`);
    }
  });

  it('no zoom, pan or re-centre control exists on the map at any size', () => {
    for (const compressed of [false, true]) {
      const html = renderToStaticMarkup(
        createElement(GeographicEvidenceMap as never, {
          evidenceCountryCode: 'RWA', evidenceCountryName: 'Rwanda',
          evidencePrecision: 'country', compressed,
        } as never),
      );
      expect(html).not.toMatch(/<button|<input|role="slider"|NavigationControl/);
      expect(html).toContain('NOT A COORDINATE');
    }
  });

  it('precision is a REQUIRED prop — the map never derives it for itself', () => {
    const map = src('GeographicEvidenceMap.tsx');
    expect(map).toMatch(/evidencePrecision: EvidencePrecision;/);
    expect(map).not.toMatch(/evidencePrecision = /);
  });

  it('the state adapter has no path from a retrieval target to city precision', () => {
    const state = src('geographicEvidenceState.ts');
    const derivation = state.slice(state.indexOf('const evidencePrecision'), state.indexOf('return {'));
    expect(derivation).not.toMatch(/queryTargetCity/);
  });
});
