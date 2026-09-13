import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * LIVE ALPHA — THE TWO DECORATIVE CANVASES MUST NOT GIVE TWO CHILDREN THE SAME KEY.
 *
 * WHAT WAS MEASURED, on the exact live source, in real Chromium against `next dev`
 * — production strips this warning, so production cannot host the measurement and
 * a production console reporting zero proves nothing:
 *
 *     /   desktop  8 warnings      /   tablet  6      /   mobile  6
 *
 * React names the key itself and names the consequence: `Encountered two children
 * with the same key, "000" ... Non-unique keys may cause children to be duplicated
 * and/or omitted.` Both canvases key their children on
 * `feature.properties.numericId`, and that id is NOT unique in this collection —
 * "000" occurs more than once.
 *
 * WHY A SOURCE-TEXT GUARD IS THE SECONDARY EVIDENCE HERE, NOT THE PRIMARY. A guard
 * that reads source can only see what was written, never what was rendered. The
 * primary evidence is the browser count going to zero on all three viewports with
 * these two files as the only change. This file exists so a later edit cannot put
 * the bare id back without a test saying so.
 */
const HERO = join(__dirname, 'HeroIntelligenceField.tsx');
const TODAY = join(__dirname, '..', 'today', 'TodayWorldCanvas.tsx');
const read = (p: string): string => readFileSync(p, 'utf8');
/* the fix is discussed in comments in both files, so comments must not satisfy it */
const stripComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

describe('the decorative canvases key their children uniquely', () => {
  it('the hero country layer disambiguates the repeated numeric id', () => {
    const code = stripComments(read(HERO));
    expect(code).toMatch(/collection\.features\.map\(\(feature: CountryFeature, index: number\) =>/);
    expect(code).toMatch(/key=\{`\$\{feature\.properties\.numericId\}-\$\{index\}`\}/);
  });

  it('the today world canvas does the same, and takes the index BEFORE the filter', () => {
    const code = stripComments(read(TODAY));
    expect(code).toMatch(/\.features\.map\(\(f, index\) => \(\{/);
    expect(code).toMatch(/key: `\$\{f\.properties\.numericId\}-\$\{index\}`/);
    /* the filter must stay downstream of the map, or the indices stop being the
       map positions and two survivors could share one */
    const mapAt = code.indexOf('.features.map(');
    const filterAt = code.indexOf('.filter(');
    expect(mapAt).toBeGreaterThan(-1);
    expect(filterAt).toBeGreaterThan(mapAt);
  });

  /**
   * THE POSITIVE CONTROL. Reverting either file to the exact expression that was
   * measured warning must fail this test — otherwise the guard would pass on the
   * very source it was written to reject.
   */
  it('the bare numeric id is not a key in either file', () => {
    for (const p of [HERO, TODAY]) {
      const code = stripComments(read(p));
      expect(code).not.toMatch(/key=\{feature\.properties\.numericId\}/);
      expect(code).not.toMatch(/key:\s*f\.properties\.numericId\s*,/);
    }
  });

  /**
   * THE DETERMINISM CONTROL. A random or time-based key would also silence the
   * warning — and would remount every path on every render, which is worse than
   * the defect. Neither canvas may reach for one.
   */
  it('no key is made from randomness or the clock', () => {
    for (const p of [HERO, TODAY]) {
      const code = stripComments(read(p));
      for (const forbidden of ['Math.random', 'Date.now', 'crypto.randomUUID']) {
        expect(code).not.toContain(forbidden);
      }
    }
  });
});
