/**
 * Measured against the REAL governed pack data in this checkout, not fixtures,
 * for the three claims the Politics R1 package makes about it.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  POLITICS_COVERAGE_CANNOT_BE_ASSERTED_BY_THIS_VOCABULARY,
  POLITICS_RELEVANT_ROLE_NAMES,
  politicsCoverageFromPacks,
  politicsCoverageTally,
  type CoveragePackInput,
} from './politics-source-coverage';

/**
 * THE GOVERNED PACKS ARE READ AT TEST TIME, NOT IMPORTED.
 *
 * `import x from '…json'` put 917 KB of JSON into the ts-jest program for this
 * directory. Measured: `politics.spec.ts` boots a Nest app with a 5 s limit,
 * and running the two suites in parallel workers pushed that boot past it — a
 * flaky failure in a NEIGHBOURING test caused purely by this file's import
 * cost. Reading the files here keeps them out of the module graph.
 */
const DATA = join(__dirname, '..', 'global-reach', 'data');
const load = (file: string): CoveragePackInput[] =>
  JSON.parse(readFileSync(join(DATA, file), 'utf8')) as CoveragePackInput[];

const eastAfrica = (): CoveragePackInput[] => load('n-canonical-packs.json');
const middleEast = (): CoveragePackInput[] => load('o-canonical-packs.json');
const eu27 = (): CoveragePackInput[] => load('p-canonical-packs.json');

describe('Politics source coverage — the three programmes do not share a vocabulary', () => {
  it('EU-27 declares PARLIAMENT_GOVERNMENT in every pack, and every one is a gap', () => {
    const rows = politicsCoverageFromPacks(eu27());

    expect(rows).toHaveLength(27);
    expect(politicsCoverageTally(rows)).toEqual({
      COVERAGE_GAP: 27,
      ROLE_NOT_DECLARED: 0,
      PROGRAMME_SHAPE_OPAQUE: 0,
    });
    expect(new Set(rows.map((r) => r.declaredAs))).toEqual(new Set(['PARLIAMENT_GOVERNMENT']));
  });

  it('East Africa declares GOVERNMENT in all 11 packs, and every one is a gap', () => {
    /*
     * MY FIRST READING SAID 4 OF 11. It was wrong: seven of these packs append a
     * second JSON blob after the first, and a parser that sliced to the end of
     * the string failed on them. This expectation is the corrected measurement,
     * and the parser comment records the mistake.
     */
    const rows = politicsCoverageFromPacks(eastAfrica());

    expect(rows).toHaveLength(11);
    expect(politicsCoverageTally(rows)).toEqual({
      COVERAGE_GAP: 11,
      ROLE_NOT_DECLARED: 0,
      PROGRAMME_SHAPE_OPAQUE: 0,
    });
    expect(new Set(rows.map((r) => r.declaredAs))).toEqual(new Set(['GOVERNMENT']));
  });

  it('the Middle East programme records gaps as prose: 16 packs, nothing readable as a role', () => {
    /*
     * ITS `gaps` HOLDS STRINGS, NOT OBJECTS. That is why this is OPAQUE rather
     * than ROLE_NOT_DECLARED: the record cannot even be asked the question.
     */
    const rows = politicsCoverageFromPacks(middleEast());

    expect(rows).toHaveLength(16);
    expect(politicsCoverageTally(rows)).toEqual({
      COVERAGE_GAP: 0,
      ROLE_NOT_DECLARED: 0,
      PROGRAMME_SHAPE_OPAQUE: 16,
    });
  });

  it('across all 54 packs not one political institution is recorded as covered', () => {
    const rows = politicsCoverageFromPacks([
      ...eastAfrica(),
      ...middleEast(),
      ...eu27(),
    ]);

    expect(rows).toHaveLength(54);
    expect(politicsCoverageTally(rows)).toEqual({
      COVERAGE_GAP: 38,
      ROLE_NOT_DECLARED: 0,
      PROGRAMME_SHAPE_OPAQUE: 16,
    });
    expect(POLITICS_COVERAGE_CANNOT_BE_ASSERTED_BY_THIS_VOCABULARY).toBe(true);
  });
});

describe('Politics source coverage — silence must not read as zero', () => {
  it('an undeclared role is NOT reported as a gap', () => {
    const rows = politicsCoverageFromPacks([
      { iso3: 'XXA', gapReason: 'prose only, no JSON' },
      { iso3: 'XXB', gapReason: null },
      { iso3: 'XXC' },
    ]);

    expect(rows.map((r) => r.status)).toEqual([
      'PROGRAMME_SHAPE_OPAQUE',
      'PROGRAMME_SHAPE_OPAQUE',
      'PROGRAMME_SHAPE_OPAQUE',
    ]);
    expect(rows.every((r) => r.declaredAs === null)).toBe(true);
  });

  it('a readable record that declares other roles is ROLE_NOT_DECLARED, not a gap', () => {
    const rows = politicsCoverageFromPacks([
      {
        iso3: 'XXD',
        gapReason:
          'x {"gaps":[{"role":"CENTRAL_BANK","status":"COVERAGE_GAP","reason":"r"}]}',
      },
    ]);

    expect(rows[0].status).toBe('ROLE_NOT_DECLARED');
  });

  it('a statistics or central-bank role is never counted as political coverage', () => {
    expect(POLITICS_RELEVANT_ROLE_NAMES).not.toContain('OFFICIAL_STATISTICS');
    expect(POLITICS_RELEVANT_ROLE_NAMES).not.toContain('CENTRAL_BANK');
    expect(POLITICS_RELEVANT_ROLE_NAMES).not.toContain('HUMANITARIAN');
  });

  it("carries the programme's own role name and reason verbatim, inventing neither", () => {
    const reason = 'No current, rights-reviewed and payload-validated baseline in this category.';
    const rows = politicsCoverageFromPacks([
      {
        iso3: 'XXE',
        gapReason: `p {"gaps":[{"role":"PARLIAMENT_GOVERNMENT","status":"COVERAGE_GAP","reason":${JSON.stringify(reason)}}]}`,
      },
    ]);

    expect(rows[0].declaredAs).toBe('PARLIAMENT_GOVERNMENT');
    expect(rows[0].declaredReason).toBe(reason);
  });

  it('an unrecognised declared status is reported as unreadable, never flattened to a gap', () => {
    const rows = politicsCoverageFromPacks([
      {
        iso3: 'XXF',
        gapReason: 'p {"gaps":[{"role":"PARLIAMENT_GOVERNMENT","status":"SOMETHING_NEW","reason":"r"}]}',
      },
    ]);

    expect(rows[0].status).toBe('PROGRAMME_SHAPE_OPAQUE');
  });
});
