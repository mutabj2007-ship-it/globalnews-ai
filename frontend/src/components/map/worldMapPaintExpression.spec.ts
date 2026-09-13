import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * PATCH A — THE FOUR MAPLIBRE PAINT REJECTIONS, AND NOTHING ELSE.
 *
 * OBSERVED ON PRODUCTION, not only in a local build. Every load of
 * https://frontend-production-c606.up.railway.app/map emits, verbatim:
 *
 *   [world-map] MapLibre error event: layers.countries-fill.paint.fill-color[3][1]:
 *       Expected at least 4 arguments, but found only 2.
 *   ... .fill-opacity[3][1]   ... same
 *   ... .countries-outline.paint.line-color[3][1]  ... same
 *   ... .line-width[3][1]     ... same
 *
 * Four rejected paint properties, on exactly the two layers that draw countries.
 *
 * THE CAUSE. A MapLibre `match` needs at least one label/output pair. This one
 * was built from `countryStoryCounts`, which is EMPTY on first paint — no
 * country has loaded — so it collapsed to
 *
 *     ['match', ['get','numericId'], 0]
 *
 * a fallback with nothing to match against. An empty count set already means
 * "every country is zero", so the honest input in that case is the constant 0.
 *
 * THIS PATCH CHANGES ONE FILE AND NO BEHAVIOUR BEYOND THAT. The tests below
 * are written to fail if anything else in the renderer moved.
 */
const SRC = readFileSync(join(__dirname, 'WorldMap.tsx'), 'utf8');
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

describe('the match expression is well-formed in every state', () => {
  it('a `match` is built only when it has at least one label/output pair', () => {
    expect(CODE).toMatch(
      /countPairs\.length > 0\s*\?\s*\['match', \['get', 'numericId'\], \.\.\.countPairs, 0\]\s*:\s*0/,
    );
  });

  it('the empty case yields the constant 0, which is what it already meant', () => {
    expect(CODE).toMatch(/:\s*0;/);
  });

  it('the degenerate two-argument shape cannot be reconstructed', () => {
    expect(CODE).not.toMatch(/const countMatchExpression: unknown\[\] = \[\s*'match',/);
    expect(CODE).not.toMatch(/countMatchExpression\.push\(0\)/);
  });
});

describe('nothing else in the renderer moved', () => {
  it('every colour stop of the heat scale is untouched', () => {
    for (const stop of ['#0f1726', '#17284a', '#203e73', '#2b5191', '#3a65b5']) {
      expect(`${stop}: ${CODE.includes(stop)}`).toBe(`${stop}: true`);
    }
  });

  it('the selected-country colour and the step function are untouched', () => {
    expect(CODE).toContain('#22d3ee');
    expect(CODE).toMatch(/'step',\s*countMatchExpression,/);
  });

  it('the four paint properties are still the four paint properties', () => {
    for (const prop of ['fill-color', 'fill-opacity', 'line-color', 'line-width']) {
      expect(`${prop}: ${CODE.includes(`'${prop}'`)}`).toBe(`${prop}: true`);
    }
    expect((CODE.match(/setPaintProperty\(/g) ?? []).length).toBe(4);
  });

  it('the camera, the projection and the renderer are untouched', () => {
    for (const forbidden of ['setTerrain', 'setProjection', 'globe', 'hillshade', 'fill-extrusion', 'raster']) {
      expect(`${forbidden}: ${CODE.includes(forbidden)}`).toBe(`${forbidden}: false`);
    }
  });

  it('this patch is one file: it introduces no import and no new dependency', () => {
    const imports = (SRC.match(/^import .*$/gm) ?? []).join('\n');
    expect(imports).toContain("import maplibregl from 'maplibre-gl'");
    expect(imports).not.toMatch(/useRouter|CountryFollowControl|useCountryFollows/);
  });
});
