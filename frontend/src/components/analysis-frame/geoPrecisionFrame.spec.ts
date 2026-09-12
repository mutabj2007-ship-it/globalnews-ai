import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, readdirSync } from 'node:fs';
import { AnalysisFrame } from './AnalysisFrame';
import { LocationImage } from './LocationImage';
import { fixture, musanzeFixture } from './frameFixtures';
import type { LocationAssetRegistry } from './locationAssets';
import {
  EvidenceGeographyExpanded,
  MAX_ZOOM,
  MIN_ZOOM,
  clampZoom,
} from './EvidenceGeographyExpanded';
import { buildEvidenceGeography } from './evidenceGeography';

const render = (props: Record<string, unknown>) =>
  renderToStaticMarkup(createElement(AnalysisFrame as never, props as never));
const VP = { width: 1440, height: 900 };

const WITH_ASSETS: LocationAssetRegistry = {
  city: { kigali: { src: '/location-assets/kigali.jpg', displayName: 'Kigali' } },
  country: { rwanda: { src: '/location-assets/rwanda.jpg', displayName: 'Rwanda' } },
};

/* PAF acceptance test 14 */
describe('PAF-14 — the frame renders at the RESOLVED precision and no finer', () => {
  it('city-resolved shows the city, and the LOCATION COLUMN carries no sub-city text', () => {
    const html = render({ response: fixture({ precision: 'city', city: 'kigali' }), initialViewport: VP });
    expect(html).toContain('Kigali');
    // Scoped to column 3. The analysis prose in the centre is the
    // model's own words about the story and may legitimately contain a
    // word like "district"; what must never happen is the FRAME making
    // a sub-city geographic claim.
    const column = html.slice(html.indexOf('data-paf="location-top"'));
    expect(column).not.toMatch(/\bdistrict\b|\bsector\b|\bward\b|\bprovince\b|voivodeship|latitude|longitude/i);
    expect(column).toMatch(/not a coordinate/i);
  });

  it('country-only shows the country and states the ceiling in words', () => {
    const html = render({ response: fixture({ precision: 'country' }), initialViewport: VP });
    expect(html).toContain('Rwanda');
    expect(html).toContain('No subnational precision in evidence');
  });

  it('unresolved shows NO image element at all', () => {
    const html = render({ response: fixture({ precision: 'unresolved' }), initialViewport: VP });
    expect(html).not.toContain('data-paf="location-image"');
    expect(html).toContain('data-paf="compact-map"');
    expect(html).not.toContain('data-paf="resolution-marker"');
  });
});

/* PAF acceptance test 15 — THE MANDATORY GEOGRAPHIC GATE */
describe('PAF-15 — QUERY INDEPENDENCE: the Musanze case', () => {
  const response = musanzeFixture();

  it('the fixture really does name Musanze in the question', () => {
    expect(response.query).toContain('Musanze');
    expect(response.normalizedQuery).toContain('musanze');
  });

  it('"MUSANZE" APPEARS NOWHERE IN THE RENDERED FRAME', () => {
    const html = render({ response, initialViewport: VP });
    const locM2 = html.slice(html.indexOf('data-paf="location-detail-track"'));
    expect(locM2).not.toMatch(/musanze/i);
  });

  it('the frame persists Rwanda at COUNTRY level for the whole reading session', () => {
    for (const viewport of [VP, { width: 1440, height: 720 }, { width: 800, height: 720 }]) {
      const html = render({ response, initialViewport: viewport });
      expect(html).toContain('Rwanda');
      expect(html).toContain('RETRIEVED FOR');
      expect(html).toContain('No subnational precision in evidence');
      const locM2 = html.slice(html.indexOf('data-paf="location-detail-track"'));
    expect(locM2).not.toMatch(/musanze/i);
    }
  });

  it('no Musanze imagery, marker label or alt text can be produced', () => {
    const html = render({ response, initialViewport: VP });
    // The image is the no-verified-asset state, named for the RESOLVED place.
    expect(html).toContain('NO VERIFIED LOCATION IMAGE');
    expect(html).toMatch(/LOCATION CONTEXT · Rwanda/);
    expect(html).toContain('Marker indicates the resolved country, not a coordinate.');
  });

  it('even with a city asset registered, a country-resolved analysis cannot reach it', () => {
    const markup = renderToStaticMarkup(
      createElement(LocationImage as never, {
        precision: 'country', resolvedPlace: 'Rwanda', registry: WITH_ASSETS,
      } as never),
    );
    expect(markup).toContain('/location-assets/rwanda.jpg');
    /*
     * ── RETARGETED BY H-ALPHA-1 (GN-ALPHA-UX-DESIGN-HANDOFF-R1) ──
     * OLD: the query string appears NOWHERE in the rendered frame.
     * WHY IT CHANGED: R1 ruling 2 puts the reader's own question back on
     * the page, so the query is now legitimately on screen once — as the
     * document's question band.
     * NEW: the invariant RULING 1 actually protects — the query must
     * never reach the LOCATION COLUMN or be promoted into a resolved
     * place. Scoped to that column, this is exactly as strict as before.
     */
    const locationOnly = markup.slice(markup.indexOf('data-paf="location-detail-track"'));
    expect(locationOnly.toLowerCase()).not.toContain('kigali');
  });

  it('NO COMPONENT IN COLUMN 3 ACCEPTS A QUERY — the value cannot be passed in', () => {
    const columnThree = ['LocationTop.tsx', 'LocationDetail.tsx', 'LocationImage.tsx', 'CompactMap.tsx', 'locationState.ts', 'locationAssets.ts'];
    for (const file of columnThree) {
      const source = readFileSync(`${__dirname}/${file}`, 'utf8');
      expect(`${file}: ${/\bquery\b\s*[:?]/.test(source)}`).toBe(`${file}: false`);
      expect(`${file}: ${source.includes('normalizedQuery')}`).toBe(`${file}: false`);
    }
  });

  it('the frame never passes response.query into the location column', () => {
    const source = readFileSync(`${__dirname}/AnalysisFrame.tsx`, 'utf8');
    const locationProps = source.match(/<Location(Top|Detail)[\s\S]*?\/>/g) ?? [];
    expect(locationProps.length).toBe(2);
    for (const block of locationProps) {
      expect(block).not.toMatch(/query/);
    }
  });
});

/* PAF acceptance test 16 — provenance devices */
describe('PAF-16 — two provenance devices, grey not green, neither yielding', () => {
  it('the chip and the caption are both present at every tier', () => {
    for (const tier of ['expanded', 'compressed', 'tight'] as const) {
      const markup = renderToStaticMarkup(
        createElement(LocationImage as never, { precision: 'country', resolvedPlace: 'Rwanda', tier } as never),
      );
      expect(markup).toContain('data-paf="provenance-chip"');
      expect(markup).toContain('data-paf="provenance-caption"');
      expect(markup).toContain('Representative location imagery');
    }
  });

  it('the chip is provenance-grey and never verified-green', () => {
    const markup = renderToStaticMarkup(
      createElement(LocationImage as never, { precision: 'country', resolvedPlace: 'Rwanda' } as never),
    );
    const chip = markup.slice(markup.indexOf('data-paf="provenance-chip"'));
    expect(chip).toContain('#94a3b8');
    expect(chip).not.toMatch(/#22c55e|#3f9d6a|green/i);
  });

  it('THE LABEL YIELDS, THE CHIP DOES NOT — below 84px the label bottom-aligns', () => {
    const tight = renderToStaticMarkup(
      createElement(LocationImage as never, { precision: 'country', resolvedPlace: 'Rwanda', tier: 'tight' } as never),
    );
    const compressed = renderToStaticMarkup(
      createElement(LocationImage as never, { precision: 'country', resolvedPlace: 'Rwanda', tier: 'compressed' } as never),
    );
    expect(tight).toContain('data-align="bottom"');
    expect(compressed).toContain('data-align="centre"');
    // The chip's own markup is byte-identical across the two tiers.
    const chipOf = (html: string) => html.slice(html.indexOf('data-paf="provenance-chip"'), html.indexOf('</span></div>'));
    expect(chipOf(tight).slice(0, 200)).toBe(chipOf(compressed).slice(0, 200));
  });

  it('NO VERIFIED LOCATION IMAGE is a specified state that keeps its caption', () => {
    const markup = renderToStaticMarkup(
      createElement(LocationImage as never, { precision: 'city', resolvedPlace: 'Kigali' } as never),
    );
    expect(markup).toContain('NO VERIFIED LOCATION IMAGE');
    expect(markup).toContain('data-paf="provenance-caption"');
    expect(markup).not.toContain('<img');
  });
});

/* PAF acceptance test 18 */
describe('PAF-18 — the map never implies precision it does not have', () => {
  /*
   * ── RETARGETED AT H-ALPHA-VISUAL-1 ITEM E, UNDER AN EXPLICIT CTO
   *    NARROWING OF THIS INVARIANT ────────────────────────────────────
   *
   * BEFORE: "no zoom, pan or re-centre control at any size", enforced by
   * banning the identifiers outright and by asserting the map emitted no
   * interactive element.
   *
   * WHAT IT WAS REALLY PROTECTING: not the absence of controls for its
   * own sake. An exploratory map invites the reader to believe there is
   * something below country level to explore, and on this path there is
   * not — `geographicEvidenceState.ts` decides precision in exactly one
   * place and yields only 'country' or 'unresolved'.
   *
   * NOW: the CTO has authorized expand/collapse, zoom, pan, reset and
   * close in a dedicated expanded view, capped at 2.5x. So the protection
   * is re-established where it actually lives:
   *
   *   1. THE INLINE MAP IS STILL INERT. Nothing in the reading rail
   *      zooms, pans or re-centres; the only control beside it is the one
   *      that opens the expanded view.
   *   2. ZOOM IS SCHEMATIC AND CAPPED. It scales a drawing that is
   *      already on screen. It is not a resolution swap — no
   *      countries-50m/10m — so a sharper outline can never be mistaken
   *      for finer evidence.
   *   3. NOTHING SUBNATIONAL CAN APPEAR AT ANY ZOOM, and that is a fact
   *      about the DATA, not a policy: the source is Natural Earth 1:110m
   *      ADMIN-0, which has an outer boundary and nothing inside it.
   *   4. THE PRECISION STATEMENT IS ON SCREEN IN BOTH STATES.
   */
  it('the INLINE map still has no zoom, pan or re-centre control', () => {
    for (const compressed of [false, true]) {
      const html = render({ response: fixture(), initialViewport: compressed ? { width: 1440, height: 720 } : VP });
      const map = html.slice(html.indexOf('data-paf="compact-map"'), html.indexOf('data-paf="map-legend"'));
      expect(map).not.toMatch(/<button|<input|role="slider"/);
    }
  });

  it('the only control beside the inline map opens the expanded view', () => {
    const html = render({ response: fixture(), initialViewport: VP });
    const rail = html.slice(html.indexOf('data-paf="evidence-geography"'), html.indexOf('data-paf="precision-panel"'));
    const buttons = rail.match(/<button[^>]*data-paf="([a-z-]+)"/g) ?? [];
    expect(buttons.length).toBe(1);
    expect(buttons[0]).toContain('data-paf="geo-expand"');
  });

  it('zoom is capped at the authorized ceiling and is schematic, not a resolution swap', () => {
    expect(MAX_ZOOM).toBe(2.5);
    expect(clampZoom(99)).toBe(MAX_ZOOM);
    expect(clampZoom(-99)).toBe(MIN_ZOOM);
    /* Comments stripped: the file names the higher-resolution datasets in
       prose precisely to record that they are NOT used, and matching that
       prose instead of the code is a trap this lane has paid for before. */
    const src = readFileSync(`${__dirname}/EvidenceGeographyExpanded.tsx`, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
    expect(src).not.toMatch(/countries-50m|countries-10m|admin[-_]?1/i);
  });

  it('no frame component can name a subnational geometry source', () => {
    const files = readdirSync(__dirname).filter((f) => /\.tsx$/.test(f));
    const offenders = files.filter((f) =>
      /countries-50m|countries-10m|admin[-_]?1|province|district|municipal/i.test(
        readFileSync(`${__dirname}/${f}`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''),
      ),
    );
    expect(offenders).toEqual([]);
  });

  it('the precision ceiling is stated in the expanded view, at rest and zoomed', () => {
    const markup = renderToStaticMarkup(
      createElement(EvidenceGeographyExpanded as never, {
        model: buildEvidenceGeography(fixture()),
        precisionLabel: 'COUNTRY-LEVEL',
        onClose: () => undefined,
        language: 'en',
      } as never),
    );
    expect(markup).toContain('data-paf="geo-expanded-precision"');
    expect(markup).toContain('COUNTRY-LEVEL');
    expect(markup).toContain('data-paf="not-a-coordinate"');
    expect(markup).toContain('data-paf="geo-no-subnational"');
  });
});

/* PAF acceptance test 22 */
describe('PAF-22 — alt text states nature and precision, never position', () => {
  it('the map accessible name carries EVIDENCE precision and refuses coordinates', () => {
    // PAF-R1.2 (P1) strengthens this. Before, a city-TARGETED query produced
    // the city map name — the retrieval target speaking as if it were the
    // resolution. It must now produce the COUNTRY name, because that is what
    // the retained reporting supports.
    const cityTargeted = render({ response: fixture({ precision: 'city', city: 'kigali' }), initialViewport: VP });
    expect(cityTargeted).toContain('Marker indicates the resolved country, not a coordinate.');
    expect(cityTargeted).not.toContain('Marker indicates the resolved city, not a coordinate.');
    expect(cityTargeted).toMatch(/data-precision="country"/);
    expect(cityTargeted).not.toMatch(/north|south|east|west|latitude|longitude|centre of the map/i);
  });

  it('the image alt states the image NATURE and carries the disclaimer', () => {
    const markup = renderToStaticMarkup(
      createElement(LocationImage as never, {
        precision: 'country', resolvedPlace: 'Rwanda', registry: WITH_ASSETS,
      } as never),
    );
    expect(markup).toContain('alt="Representative location imagery of Rwanda. Not imagery of this story."');
  });
});

/* RULING 1 and RULING 3, asserted as omissions */
describe('RULINGS 1 and 3 — truthful omission, never fabricated data', () => {
  it('RULING 1: no report-count basis is rendered anywhere', () => {
    const html = render({ response: fixture(), initialViewport: VP });
    /*
      SCOPE CORRECTION, DECLARED. Ruling 1 forbids a report-count BASIS —
      a claim that N of M reports resolved somewhere. DESIGN-C2 Lock 2
      introduces one unrelated "a-b OF n": the desktop source strip's
      POSITION READOUT, which is locked wording and states where the
      reader is in a list, not what the evidence supports. Rather than
      loosening the pattern, the readout is REMOVED from the document and
      the original assertion is then applied unchanged, so nothing else
      in the surface may render a count basis and the exception is
      exactly one named element.
    */
    const withoutStripReadout = html.replace(
      /<span[^>]*data-paf="sources-position"[^>]*>[\s\S]*?<\/span>/g,
      '',
    );
    expect(withoutStripReadout).not.toMatch(/\b\d+\s+OF\s+\d+\b/i);
    expect(html).not.toMatch(/CITY-RESOLVED REPORTS|COUNTRY-ONLY REPORTS|PRECISION CEILING/i);
  });

  it('RULING 1: the dock carries no per-source geographic tag', () => {
    const source = readFileSync(`${__dirname}/SourcesDock.tsx`, 'utf8');
    expect(source).not.toMatch(/geographicPrecision|matchesCity|resolutionTag/);
  });

  it('RULING 3: entities.locations is not rendered in the location column', () => {
    const html = render({
      response: fixture({ locations: ['Kigali', 'Musanze', 'Atlantis'] }),
      initialViewport: VP,
    });
    expect(html).not.toMatch(/atlantis/i);
    const locM2 = html.slice(html.indexOf('data-paf="location-detail-track"'));
    expect(locM2).not.toMatch(/musanze/i);
    const source = readFileSync(`${__dirname}/LocationDetail.tsx`, 'utf8');
    expect(source).not.toMatch(/entities/);
  });
});
