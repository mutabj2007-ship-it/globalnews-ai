import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  classifyRefusal,
  GEOMETRY_DATA_DEFECT_CODES,
  GEOMETRY_PROGRAMMING_MISTAKE_CODES,
  GEOMETRY_RETIRED_REFUSAL_CODES,
  refusalClassAlarms,
  refusalCodeOf,
  UNCLASSIFIED_REFUSAL_CODE,
} from '@globalnews-ai/shared';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE BIDIRECTIONAL VOCABULARY GATE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ALPHA-HUMANITARIAN-GX14-SECURITY-PATCH-R1 · defect 2.
 *
 * E1 measured R1's vocabulary against reality and found it invented: codes that read
 * correctly and matched nothing. The repair is not a bigger list — it is a list that
 * CANNOT DRIFT, because the test reads the source at run time and fails in both
 * directions.
 *
 *   forward   every code the runtime throws is governed
 *   backward  every governed code is reachable, or explicitly retired with a reason
 *
 * The forward direction is what stops the next person adding a `throw` and forgetting.
 * The backward direction is what caught this defect: eight governed codes that nothing
 * threw. Either alone would have passed R1.
 */

/**
 * BOTH places Humanitarian refusal codes are thrown.
 *
 * The scrape originally read only `shared/`, and that blind spot was found the hard
 * way: the producer lane's composition root throws `GEOMETRY_AUTHORITY_DIGEST_DRIFTED`
 * — GA-33's own runtime code — from `backend/`, and the gate reported a perfectly
 * reconciled vocabulary while not looking at it.
 *
 * A vocabulary scoped more narrowly than the runtime is a vocabulary with a blind spot,
 * and the blind spot is invisible precisely because the gate passes.
 */
const SCRAPE_ROOTS = [
  join(__dirname, '..', '..', '..', '..', 'shared', 'src', 'humanitarian'),
  __dirname,
];

/**
 * Every refusal code the runtime actually throws, read from the source.
 *
 * A code is the portion of a thrown message before the first colon — which is exactly
 * what `refusalCodeOf` extracts at run time, so this scrape and the extractor agree by
 * construction rather than by coincidence.
 *
 * Deliberately scraped rather than hand-listed: a hand-list here would be a second copy
 * of the vocabulary, and the whole defect was two lists that disagreed.
 *
 * SPEC FILES ARE EXCLUDED, and the reason is not convenience. Specs throw deliberately
 * bogus codes as negative controls — `GEOMETRY_FAKE_CODE_12_34` is in this very suite,
 * and the producer lane's spec throws it too. Scraping them would force the vocabulary
 * to GOVERN the fake codes, which is the exact inverse of what they exist to prove.
 */
function thrownCodes(): Set<string> {
  const found = new Set<string>();
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith('.ts')) continue;
      if (entry.name.endsWith('.spec.ts')) continue;
      for (const m of readFileSync(full, 'utf8').matchAll(/['"`](GEOMETRY_[A-Z0-9_]+):/g)) {
        found.add(m[1]!);
      }
    }
  };
  for (const root of SCRAPE_ROOTS) walk(root);
  return found;
}

const GOVERNED = new Set([...GEOMETRY_PROGRAMMING_MISTAKE_CODES, ...GEOMETRY_DATA_DEFECT_CODES]);

describe('the refusal vocabulary is closed, and matches what the runtime throws', () => {
  it('the scrape finds a substantial vocabulary (positive control)', () => {
    /*
      If the regex ever stopped matching, both directions below would pass against an
      empty set and this suite would report a perfectly reconciled vocabulary of
      nothing. That is the failure mode a scraping test has, so it is checked first.
    */
    const thrown = thrownCodes();
    expect(thrown.size).toBeGreaterThan(40);
    expect(thrown.has('GEOMETRY_PROJECTION_WITHOUT_COORDINATES')).toBe(true);
    expect(thrown.has('GEOMETRY_CRS_UNSUPPORTED')).toBe(true);
    // And the backend root is genuinely in scope — the blind spot, asserted closed.
    expect(thrown.has('GEOMETRY_AUTHORITY_DIGEST_DRIFTED')).toBe(true);
  });

  it('FORWARD · every runtime-thrown refusal code is governed', () => {
    const ungoverned = [...thrownCodes()].filter((c) => !GOVERNED.has(c)).sort();

    /*
      An ungoverned code is not a leak — it becomes UNCLASSIFIED and alarms, so it fails
      safe. It is an OPERABILITY defect: every unclassified code pages somebody, and an
      alarm that fires on routine data is one that gets muted.
    */
    expect(ungoverned).toEqual([]);
  });

  it('BACKWARD · every governed code is reachable, or retired with a documented reason', () => {
    const thrown = thrownCodes();
    const unreachable = [...GOVERNED].filter((c) => !thrown.has(c)).sort();

    // Nothing governed may be unreachable. Retired codes are NOT governed — they live
    // in their own map, which is what "explicitly reserved/deprecated" means here.
    expect(unreachable).toEqual([]);
  });

  it('the retired codes are out of the vocabulary and each carries its reason', () => {
    const retired = Object.entries(GEOMETRY_RETIRED_REFUSAL_CODES);
    // Was 8. GEOMETRY_RING_NOT_CLOSED was un-retired when Main's R5 began throwing it
    // for real -- a retirement is a claim about the code, and claims about code expire.
    expect(retired.length).toBe(7);

    for (const [code, reason] of retired) {
      // Retired means retired: classifying one must land in the residual.
      expect([code, GOVERNED.has(code)]).toEqual([code, false]);
      expect([code, classifyRefusal(code)]).toEqual([code, 'UNCLASSIFIED']);

      // And the reason is a real sentence, not a placeholder.
      expect([code, reason.length > 30]).toEqual([code, true]);
    }

    // The category error is called what it is, rather than filed as a near-miss.
    expect(GEOMETRY_RETIRED_REFUSAL_CODES['RENDERER_CANNOT_DRAW_KIND']).toMatch(/CATEGORY ERROR/);
  });

  it('the two governed lists are disjoint — a code has exactly one class', () => {
    const overlap = GEOMETRY_PROGRAMMING_MISTAKE_CODES.filter((c) =>
      GEOMETRY_DATA_DEFECT_CODES.includes(c),
    );
    expect(overlap).toEqual([]);
  });

  it('the classification is INTENTIONAL, not a mirror of where the code lives', () => {
    /*
      The rule E1 gave was "classify each runtime refusal intentionally", and the way to
      fail it is to derive the class from something mechanical — the file, a prefix, the
      order of discovery. These pairs share a prefix and sit in DIFFERENT classes, which
      a mechanical rule cannot produce.
    */
    expect(classifyRefusal('GEOMETRY_COORDINATES_NOT_CLOSED')).toBe('DATA_DEFECT');
    expect(classifyRefusal('GEOMETRY_COORDINATE_TYPE_DISAGREES')).toBe('DATA_DEFECT');
    expect(classifyRefusal('GEOMETRY_COARSENING_NOT_COARSER')).toBe('PROGRAMMING_MISTAKE');

    // Both are about a derivation's parent; one is bad input, one is our pipeline.
    expect(classifyRefusal('GEOMETRY_DERIVATION_PARENT_ID_DISAGREES')).toBe('DATA_DEFECT');
    expect(classifyRefusal('GEOMETRY_PRESENTED_DERIVATION_NOT_MARKED')).toBe('PROGRAMMING_MISTAKE');
  });

  it('the far side of the boundary does not alarm; our side always does', () => {
    for (const code of GEOMETRY_DATA_DEFECT_CODES) {
      expect([code, refusalClassAlarms(classifyRefusal(code))]).toEqual([code, false]);
    }
    for (const code of GEOMETRY_PROGRAMMING_MISTAKE_CODES) {
      expect([code, refusalClassAlarms(classifyRefusal(code))]).toEqual([code, true]);
    }
  });

  it('AS-E1-7 SURVIVES THE RECONCILIATION · the residual still alarms', () => {
    /*
      The risk in growing a vocabulary from 18 codes to 56 is that the residual stops
      being exercised and quietly rots. These are the R1 negative controls, re-run
      against the new vocabulary.
    */
    const fake = new Error('GEOMETRY_FAKE_CODE_12_34: something that looks official');
    expect(/^GEOMETRY_[A-Z0-9_]+$/.test('GEOMETRY_FAKE_CODE_12_34')).toBe(true);
    expect(refusalCodeOf(fake)).toBe(UNCLASSIFIED_REFUSAL_CODE);
    expect(classifyRefusal(refusalCodeOf(fake))).toBe('UNCLASSIFIED');
    expect(refusalClassAlarms('UNCLASSIFIED')).toBe(true);

    // The coordinate-smuggling shape, and a retired name someone might still throw.
    expect(refusalCodeOf(new Error('GEOMETRY_48_25_11_5: nothing to see'))).toBe(
      UNCLASSIFIED_REFUSAL_CODE,
    );
    // GEOMETRY_RING_NOT_CLOSED was un-retired when R5 began throwing it, so the stale-name
    // probe uses one that is still retired.
    expect(refusalCodeOf(new Error('GEOMETRY_CRS_NOT_SUPPORTED: stale name'))).toBe(
      UNCLASSIFIED_REFUSAL_CODE,
    );
  });

  it('and a REAL code now survives extraction — which R1 got wrong', () => {
    /*
      The half that was actually broken. Under R1 every one of these became
      UNCLASSIFIED, because the governed spelling did not exist.
    */
    for (const [message, expected] of [
      ['GEOMETRY_CRS_UNSUPPORTED: EPSG:3857 is not admitted', 'DATA_DEFECT'],
      ['GEOMETRY_MISSING_COORDINATES: none supplied', 'DATA_DEFECT'],
      ['GEOMETRY_COORDINATES_NOT_CLOSED: ring does not close', 'DATA_DEFECT'],
      ['GEOMETRY_ANONYMOUS: sourceId is empty', 'DATA_DEFECT'],
      ['GEOMETRY_KIND_NOT_DECLARED_BY_DOMAIN: POLYGON from a point-only domain', 'DATA_DEFECT'],
      ['GEOMETRY_SILENT_RESHAPE: geometry was altered', 'PROGRAMMING_MISTAKE'],
      ['GEOMETRY_PARTITION_BESPOKE: a bespoke unit', 'PROGRAMMING_MISTAKE'],
      ['GEOMETRY_CADENCE_LAG_VIOLATED: authored inside the window', 'PROGRAMMING_MISTAKE'],
    ] as const) {
      const code = refusalCodeOf(new Error(message));
      expect([message, code]).not.toEqual([message, UNCLASSIFIED_REFUSAL_CODE]);
      expect([message, classifyRefusal(code)]).toEqual([message, expected]);
    }
  });

  it('GX-23 PRIVACY IS UNCHANGED · no code carries a protected fact', () => {
    /*
      A vocabulary three times larger is three times more surface for a name that says
      too much. Every governed code is checked for the words a refusal code must never
      contain — the protected classification itself, or anything record-identifying.
    */
    for (const code of [...GOVERNED]) {
      expect([code, /PROTECTED|CLASS_P|PART_|SECRET|COORD_[0-9]/.test(code)]).toEqual([
        code,
        false,
      ]);
      // Codes are names, never values: no digits that could be a coordinate.
      expect([code, /[0-9]+\.[0-9]/.test(code)]).toEqual([code, false]);
    }
  });
});
