import { DESIGN_REFERENCE, DESIGN_REFERENCE_WIDTH } from '@/lib/map/spatial/designRenderTokens';
import {
  GRATICULE_LATITUDE_LIMIT,
  GRATICULE_PAINT,
  GRATICULE_STEP_DEGREES,
  buildGraticule,
} from './graticule';

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * THE GRATICULE — C907 §4
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ACCEPTANCE EVIDENCE, measured on GOLDEN-01: regular meridians at 33 px across
 * the map pane, which is a 10° interval at that frame's scale. The prototype's
 * own draw loop confirms it independently — `d3.geoGraticule10()`, stroked at
 * `lineWidth .6` between the ocean fill and the land base.
 *
 * C906 had the token, the width, the rail control and a registry entry claiming
 * `runtime: 'LIVE'`. It had no layer.
 */
const collection = buildGraticule();
const lines = collection.features[0].geometry.coordinates;

describe('1 · the grid the golden frame shows', () => {
  it('is a 10° graticule', () => {
    expect(GRATICULE_STEP_DEGREES).toBe(10);
  });

  it('is one feature, so it is one piece of furniture and one draw call', () => {
    expect(collection.features).toHaveLength(1);
    expect(collection.features[0].geometry.type).toBe('MultiLineString');
  });

  it('carries 36 meridians and 17 parallels', () => {
    /* -180..170 inclusive at 10° = 36; -80..80 inclusive at 10° = 17. */
    expect(lines).toHaveLength(53);
  });

  it('does not draw the antimeridian twice', () => {
    /*
      With `renderWorldCopies: false`, -180 and +180 are the same line on the
      one painted world, and drawing both would double its weight exactly
      where the seam already needs care.
    */
    expect(lines.some((line) => line[0][0] === 180)).toBe(false);
  });

  it('stops short of the poles, where Mercator cannot go', () => {
    const meridians = lines.slice(0, 36);

    expect(GRATICULE_LATITUDE_LIMIT).toBe(80);
    expect(meridians.every((line) => line.every(([, lat]) => Math.abs(lat) <= 80))).toBe(true);
  });

  it('every vertex is a real position', () => {
    expect(
      lines.every((line) =>
        line.every(([lon, lat]) => Math.abs(lon) <= 180 && Math.abs(lat) <= 90),
      ),
    ).toBe(true);
  });
});

describe('2 · the approved token, exactly', () => {
  it('takes its colour and width from the tokens rather than restating them', () => {
    expect(GRATICULE_PAINT['line-color']).toBe(DESIGN_REFERENCE.graticule);
    expect(GRATICULE_PAINT['line-width']).toBe(DESIGN_REFERENCE_WIDTH.graticule.base);
  });

  it('is v1.5’s lifted value — the 5% grid was below the noise floor of the old land', () => {
    expect(DESIGN_REFERENCE.graticule).toBe('rgba(126,166,186,.075)');
    expect(DESIGN_REFERENCE_WIDTH.graticule).toEqual({ base: 0.6, perZoom: 0, cap: 0.6 });
  });
});

describe('3 · no network, no evidence, no precision', () => {
  const source = require('fs').readFileSync(require('path').join(__dirname, 'graticule.ts'), 'utf8');
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('fetches nothing — there is no dataset at all', () => {
    expect(code).not.toMatch(/fetch\(|http|\.json|REFERENCE_BASE_PATH/);
  });

  it('carries no evidence id, provenance or precision', () => {
    expect(code).not.toMatch(/evidence|precision|provenance|articleId/i);
    expect(collection.features[0].properties).toEqual({});
  });

  it('is deterministic — the same call twice is the same grid', () => {
    expect(JSON.stringify(buildGraticule())).toBe(JSON.stringify(buildGraticule()));
  });
});

describe('4 · it is drawn where the prototype draws it', () => {
  const canvas = require('fs').readFileSync(
    require('path').join(__dirname, '..', '..', '..', 'components', 'map', 'shell', 'EvidenceMapCanvas.tsx'),
    'utf8',
  );

  it('goes in above the ocean background and BENEATH the land fill', () => {
    /*
      The prototype: ocean fill, graticule, then `// land base`. So the grid
      reads across open water and is covered by land — which is what the
      measurement of the golden capture found, and why the layer is added
      before LAND_LAYER_ID rather than on top of the stack.
    */
    expect(canvas.indexOf('GRATICULE_LAYER_ID,')).toBeLessThan(canvas.indexOf('id: LAND_LAYER_ID,'));
  });

  it('the GRID rail control now governs a layer that exists', () => {
    expect(canvas).toMatch(/apply\(GRATICULE_LAYER_ID, layers\.graticule !== false\)/);
  });

  it('the registry no longer claims a layer nobody wrote', () => {
    const registry = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'layers', 'layerRegistry.ts'),
      'utf8',
    );
    const entry = registry.slice(registry.indexOf("id: 'graticule'"), registry.indexOf("id: 'countryEvidence'"));

    expect(entry).toMatch(/runtime: 'LIVE'/);
    expect(entry).toMatch(/graticule\.ts/);
    expect(entry).toMatch(/defaultOn: true/);
  });
});
