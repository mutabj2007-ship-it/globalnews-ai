import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * PATCH D — THE ANALYSIS ENTRY IS NAMED FOR WHAT IT DOES.
 *
 * OBSERVED ON PRODUCTION: the control at the foot of the map's country panel
 * reads "View full country coverage" and navigates to `/search?q=<country>`,
 * which does not list coverage — it RUNS AN ANALYSIS of the country name.
 * Meanwhile the panel above it already renders `response.articles` in full,
 * with no truncation, so the coverage was already on screen and the button
 * promised to go and fetch it.
 *
 * THE DESTINATION IS UNCHANGED. Only the label was wrong.
 */
const CODE = readFileSync(join(__dirname, 'CountryPanel.tsx'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');
const dict = (f: string): string =>
  readFileSync(join(__dirname, '..', '..', 'lib', 'i18n', 'dictionaries', f), 'utf8');

describe('the control says what it does', () => {
  it('it is labelled as an analysis, not as a coverage listing', () => {
    expect(CODE).toMatch(/\{t\.panel\.analyseCountry\}/);
    expect(CODE).not.toMatch(/\{t\.panel\.viewFullCoverage\}/);
  });

  it('the navigation is untouched — this patch changes one label', () => {
    expect(CODE).toMatch(/\/search\?q=\$\{encodeURIComponent\(country\.name\)\}/);
    expect(CODE).toMatch(/router\.push\(/);
  });

  it('the new key ships in EVERY dictionary this release line carries', () => {
    /* a key present in one and missing in the other renders `undefined` to
       half the readers, which is worse than the wrong label */
    for (const f of ['en.ts', 'pl.ts']) {
      expect(`${f}: ${/analyseCountry:\s*'[^']+'/.test(dict(f))}`).toBe(`${f}: true`);
    }
  });

  it('the OLD key is retained, because another sentence still uses that wording', () => {
    /* `noCoverageSuffix` ends "...or view full coverage below." — deleting
       `viewFullCoverage` would break a sentence that is still correct */
    for (const f of ['en.ts', 'pl.ts']) {
      expect(`${f}: ${/viewFullCoverage:\s*'[^']+'/.test(dict(f))}`).toBe(`${f}: true`);
    }
  });

  it('this patch touches neither the renderer nor the URL persistence', () => {
    /* Patch A and Patch B own those; this one must not drift into either */
    for (const forbidden of ['setPaintProperty', 'countMatchExpression', 'router.replace',
                             'window.location.search', 'maplibregl']) {
      expect(`${forbidden}: ${CODE.includes(forbidden)}`).toBe(`${forbidden}: false`);
    }
  });
});
