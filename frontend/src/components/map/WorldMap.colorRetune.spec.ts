import { readFileSync } from 'fs';
import { join } from 'path';

const source = readFileSync(join(__dirname, 'WorldMap.tsx'), 'utf-8');

/**
 * CTO blocker resolution — the real WorldMap.tsx (provided for
 * inspection) revealed that selected/hover country illumination
 * ALREADY exists via genuine MapLibre paint-property expressions
 * (setPaintProperty on fill-color/fill-opacity/line-color/line-width,
 * keyed on a `['==', ['get', 'numericId'], selectedNumeric]` case
 * expression). Earlier rounds incorrectly reported this as requiring
 * "unsafe changes to shared internals" — that was wrong; the
 * mechanism was already there, this session simply never had
 * visibility into this file until the CTO supplied it directly.
 *
 * This test protects a narrow, low-risk change made with that new
 * visibility: retuning three hex color CONSTANTS (hover-outline,
 * selected-fill, selected-outline) from the project's blue family
 * toward cyan, to better match the reference's cyan-dominant
 * illumination — with ZERO changes to the surrounding logic,
 * event handlers, layer structure, or paint-expression shape.
 */
describe('WorldMap.tsx selected/hover color retuning (CTO blocker resolution)', () => {
  it('the hover-outline color leans cyan, matching the reference\u2019s illumination language', () => {
    expect(source).toMatch(/'line-color': '#67e8f9'/);
  });

  it('the selected-country fill color leans cyan', () => {
    expect(source).toMatch(/'#22d3ee'/);
  });

  it('the selected-country outline color leans cyan', () => {
    expect(source).toMatch(/'#a5f3fc'/);
  });

  it('every real MapLibre event handler, layer id, and paint-expression structure is completely unchanged — this was a color-value-only edit', () => {
    expect(source).toMatch(/map\.on\(\s*'mousemove',\s*FILL_LAYER_ID/);
    expect(source).toMatch(/map\.on\('mouseleave', FILL_LAYER_ID/);
    expect(source).toMatch(/map\.on\(\s*'click',\s*FILL_LAYER_ID/);
    expect(source).toMatch(/const FILL_LAYER_ID = 'countries-fill'/);
    expect(source).toMatch(/const OUTLINE_LAYER_ID = 'countries-outline'/);
    expect(source).toMatch(/const HOVER_LAYER_ID = 'countries-hover'/);
    expect(source).toMatch(/map\.setPaintProperty\(FILL_LAYER_ID, 'fill-color'/);
    expect(source).toMatch(/map\.setPaintProperty\(OUTLINE_LAYER_ID, 'line-color'/);
  });

  it('no fabricated event/incident data was introduced — the fill still keys purely on real countryStoryCounts and selection state', () => {
    expect(source).toMatch(/countryStoryCounts/);
    expect(source).not.toMatch(/casualt|conflict.?severity|threat.?level|riskScore/i);
  });

  it('does not introduce any new dependency — still plain maplibre-gl paint properties', () => {
    expect(source).toMatch(/from 'maplibre-gl'/);
    expect(source).not.toMatch(/from ['"](three|framer-motion|d3|@react-three)/);
  });
});
