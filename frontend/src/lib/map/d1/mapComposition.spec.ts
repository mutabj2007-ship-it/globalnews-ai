import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  LEGEND_ROW_ORDER,
  LOWER_LEFT_CLUSTER,
  MAP_SPLIT_MODES,
  SHEET_DETENTS,
  TOP_RIGHT_CLUSTER,
  clusterFor,
  compactLegendRows,
  controlsMayMerge,
  impliesEvidence,
  labelDetailFor,
  mapIsDominant,
  sheetHeightPercent,
  showsInlineMiniMap,
  splitFor,
  treatmentFor,
} from './mapComposition';

const source = readFileSync(join(__dirname, 'mapComposition.ts'), 'utf8');

describe('the flexible map pane — the proportions the matrix names', () => {
  it.each([
    ['explore', 70, 30],
    ['question', 50, 50],
    ['answer', 35, 65],
  ] as const)('%s is %i/%i', (mode, map, ask) => {
    expect(splitFor(mode)).toEqual({ mode, mapPercent: map, askPercent: ask });
  });

  it('every mode accounts for the whole row', () => {
    for (const mode of MAP_SPLIT_MODES) {
      const split = splitFor(mode);
      expect(split.mapPercent + split.askPercent).toBe(100);
    }
  });

  it('the dock keeps the map ON SCREEN — a map that disappears takes the sense of place with it', () => {
    expect(splitFor('dock').mapPercent).toBeGreaterThan(0);
  });

  it('full-map collapses the Ask column without deleting the conversation', () => {
    /* The board's D1..D6 camera-continuity rule requires returning to the same
       conversation, so 0% is a collapsed column and not a destroyed one. The
       re-entry affordance is the component's job; this asserts the proportion. */
    expect(splitFor('full-map')).toEqual({ mode: 'full-map', mapPercent: 100, askPercent: 0 });
  });

  it('PROPORTION NEVER TOUCHES SEMANTICS — the split type carries no evidence field', () => {
    /* "Map: owns proportion only — never semantics, precision or ceiling."
       A behavioural test cannot catch a precision field being added later, so
       this reads the module's own text. */
    const splitBlock = source.slice(source.indexOf('export interface MapSplit'), source.indexOf('const SPLITS'));
    expect(splitBlock).not.toMatch(/precision|evidence|ceiling|halo/i);
  });
});

describe('label simplification follows rendered WIDTH, not the mode name', () => {
  it('simplifies progressively as the pane narrows', () => {
    expect(labelDetailFor(1200)).toBe('full');
    expect(labelDetailFor(720)).toBe('full');
    expect(labelDetailFor(600)).toBe('reduced');
    expect(labelDetailFor(420)).toBe('reduced');
    expect(labelDetailFor(320)).toBe('minimal');
  });

  it('the same mode gives different detail on different displays — which is the point', () => {
    /* Answer is 35%: 896px on a 2560 display, 448px on a 1280 one. A mode-keyed
       table would have called both the same and been wrong twice. */
    expect(labelDetailFor(Math.round(2560 * 0.35))).toBe('full');
    expect(labelDetailFor(Math.round(1280 * 0.35))).toBe('reduced');
  });

  it('never returns a state that means "no map" — the basemap is never swapped for schematic polygons', () => {
    for (const width of [0, 1, 100, 5000]) {
      expect(['full', 'reduced', 'minimal']).toContain(labelDetailFor(width));
    }
  });
});

describe('control hierarchy — specification §3d', () => {
  it('the lower-left cluster is globe locator, then Layers, then 3D, in that order', () => {
    expect([...LOWER_LEFT_CLUSTER]).toEqual(['globe-locator', 'layers', 'three-d']);
  });

  it('zoom and layer-visibility stay top-right', () => {
    expect([...TOP_RIGHT_CLUSTER]).toEqual(['zoom', 'layer-visibility']);
    expect(clusterFor('zoom')).toBe('top-right');
    expect(clusterFor('globe-locator')).toBe('lower-left');
  });

  it('THE GLOBE LOCATOR IS NOT THE 3D TOGGLE — they may never be merged', () => {
    expect(controlsMayMerge('globe-locator', 'three-d')).toBe(false);
    expect(controlsMayMerge('three-d', 'globe-locator')).toBe(false);
  });

  it('no control appears in both clusters', () => {
    for (const control of LOWER_LEFT_CLUSTER) {
      expect(TOP_RIGHT_CLUSTER).not.toContain(control);
    }
  });
});

describe('SELECTION MUST NOT VISUALLY IMPLY EVIDENCE', () => {
  it('selecting a country with no evidence gives it a ring and NOTHING else', () => {
    const treatment = treatmentFor({ selected: true, hasEvidence: false, rendersAsPoint: false });
    expect(treatment).toEqual({ selection: 'ring', evidence: 'none' });
    expect(impliesEvidence(treatment)).toBe(false);
  });

  it('the two channels are independent — a country may carry either, both or neither', () => {
    expect(treatmentFor({ selected: false, hasEvidence: true, rendersAsPoint: false }).evidence).toBe('fill');
    expect(treatmentFor({ selected: true, hasEvidence: true, rendersAsPoint: false })).toEqual({
      selection: 'ring',
      evidence: 'fill',
    });
    expect(treatmentFor({ selected: false, hasEvidence: false, rendersAsPoint: false })).toEqual({
      selection: 'none',
      evidence: 'none',
    });
  });

  it('point evidence is a halo and area evidence is a fill — selection is neither, ever', () => {
    expect(treatmentFor({ selected: true, hasEvidence: true, rendersAsPoint: true }).evidence).toBe('halo');
    for (const selected of [true, false]) {
      const t = treatmentFor({ selected, hasEvidence: false, rendersAsPoint: true });
      expect(t.evidence).toBe('none');
    }
  });

  it('NO combination of selection alone can produce an evidence treatment', () => {
    for (const rendersAsPoint of [true, false]) {
      expect(impliesEvidence(treatmentFor({ selected: true, hasEvidence: false, rendersAsPoint }))).toBe(false);
    }
  });
});

describe('the compact evidence legend', () => {
  it('shows only the states actually present, in the fixed order', () => {
    expect(compactLegendRows(new Set(['interpreted', 'verified']))).toEqual(['verified', 'interpreted']);
  });

  it('is never empty — an absent-evidence map still has to SAY so', () => {
    /* Silence would read as "not looked at", which is a different claim. */
    expect(compactLegendRows(new Set())).toEqual(['none']);
  });

  it('carries no row for SELECTION — that would be the same conflation in words', () => {
    expect(LEGEND_ROW_ORDER).not.toContain('selected' as never);
    expect(source.slice(source.indexOf('LegendRowKey'))).not.toMatch(/'selected'/);
  });
});

describe('the phone composition — map-first, three detents', () => {
  it('has exactly the three detents the specification names', () => {
    expect([...SHEET_DETENTS]).toEqual(['peek', 'half', 'full']);
  });

  it('the map stays dominant at peek, and is not dominant once the sheet takes half or more', () => {
    expect(mapIsDominant('peek')).toBe(true);
    expect(mapIsDominant('half')).toBe(false);
    expect(mapIsDominant('full')).toBe(false);
  });

  it('detents only ever grow', () => {
    expect(sheetHeightPercent('peek')).toBeLessThan(sheetHeightPercent('half'));
    expect(sheetHeightPercent('half')).toBeLessThan(sheetHeightPercent('full'));
  });

  it('geography never leaves the screen — full covers the map, so the mini-map appears', () => {
    expect(showsInlineMiniMap('full')).toBe(true);
    expect(showsInlineMiniMap('peek')).toBe(false);
    expect(showsInlineMiniMap('half')).toBe(false);
  });

  it('no detent hides the sheet entirely — dismissal is a different interaction', () => {
    for (const detent of SHEET_DETENTS) {
      expect(sheetHeightPercent(detent)).toBeGreaterThan(0);
    }
  });
});
