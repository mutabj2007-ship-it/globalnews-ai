/**
 * ════════════════════════════════════════════════════════════════════════════
 * CF-D1 · ONE AUTHORITY FOR THE PRECISION LADDER — PINNED BY IDENTITY
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `MAIN-CONFLICT-CANONICAL-FOUNDATION-R2` §1.2: *"A spec must pin the frontend ladder to
 * the shared one by identity, not by content. A second list that happens to agree today
 * is the drift this promotion exists to end."*
 *
 * Content equality is the weaker test and it is the one that fails silently: two arrays
 * holding the same eight strings satisfy `toEqual` on the day they are written and keep
 * satisfying it right up until one of them gains a rung. Identity cannot drift, because
 * there is only one object.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { SPATIAL_PRECISION_LADDER, LOCATION_PROVENANCES } from '@globalnews-ai/shared';

import { PRODUCIBLE_SPATIAL_PRECISION } from './spatialPrecision';

const SELF = readFileSync(join(__dirname, 'spatialPrecision.ts'), 'utf-8');
const code = SELF.replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter((l) => !l.trimStart().startsWith('*') && !l.trimStart().startsWith('//'))
  .join('\n');

describe('the ladder has exactly one declaration, and this file is not it', () => {
  it('re-exports the shared ladder rather than redeclaring it', () => {
    expect(code).toMatch(
      /export type \{[^}]*SpatialPrecision[^}]*\} from '@globalnews-ai\/shared'/,
    );
  });

  it('declares no local union for either type', () => {
    /*
      The exact shape the promotion deleted: `export type SpatialPrecision = 'EXACT' | …`
      and `export type LocationProvenance = 'STATED' | …`. If either returns, this fails.
    */
    expect(code).not.toMatch(/export type SpatialPrecision\s*=\s*\n?\s*\|?\s*'/);
    expect(code).not.toMatch(/export type LocationProvenance\s*=\s*'/);
  });

  it('POSITIVE CONTROL · the scan finds a redeclaration when one is present', () => {
    expect(/export type SpatialPrecision\s*=\s*\n?\s*\|?\s*'/.test("export type SpatialPrecision =\n  | 'EXACT'")).toBe(true);
    expect(/export type LocationProvenance\s*=\s*'/.test("export type LocationProvenance = 'STATED' | 'INTERPRETED';")).toBe(true);
  });

  it('the shared ladder is the eight-rung accepted one', () => {
    expect([...SPATIAL_PRECISION_LADDER]).toEqual([
      'EXACT', 'CITY', 'SECTOR', 'DISTRICT', 'PROVINCE', 'COUNTRY', 'REGION', 'UNKNOWN',
    ]);
    expect([...LOCATION_PROVENANCES]).toEqual(['STATED', 'INTERPRETED', 'CONTESTED']);
  });
});

describe('the DISPLAY half stays frontend-owned — the deletion was of the duplicate, not the file', () => {
  it('PRODUCIBLE_SPATIAL_PRECISION is still declared HERE and was not promoted', () => {
    /*
      Main is explicit that this must not move: the backend must never learn what a
      precision looks like. It is the producible subset, not the vocabulary.
    */
    expect(code).toMatch(/export const PRODUCIBLE_SPATIAL_PRECISION/);
    expect([...PRODUCIBLE_SPATIAL_PRECISION]).toEqual(['COUNTRY', 'SECTOR', 'UNKNOWN']);
  });

  it('and every producible rung is a member of the shared ladder — a subset, never a widening', () => {
    /*
      This is the join that makes the two halves one system: the display half may narrow
      the canonical vocabulary and may never extend it. A rung here that shared does not
      declare would be a second vocabulary wearing a smaller name.
    */
    const ladder = new Set<string>(SPATIAL_PRECISION_LADDER);
    const notInLadder = PRODUCIBLE_SPATIAL_PRECISION.filter((p) => !ladder.has(p));
    expect(`producible rungs absent from the shared ladder: ${notInLadder.join(', ') || 'none'}`)
      .toBe('producible rungs absent from the shared ladder: none');
    expect(PRODUCIBLE_SPATIAL_PRECISION.length).toBeLessThan(SPATIAL_PRECISION_LADDER.length);
  });
});

describe('PRECISION IS NOT PROVENANCE, and the promotion did not merge them', () => {
  it('they are two separate vocabularies with no shared member', () => {
    /*
      One says how finely a location is known; the other says who said so. A member
      appearing in both would mean a provenance had become a precision, which is the
      confusion `assertProvenanceDoesNotRaisePrecision` exists to prevent.
    */
    const overlap = (LOCATION_PROVENANCES as readonly string[]).filter((p) =>
      (SPATIAL_PRECISION_LADDER as readonly string[]).includes(p),
    );
    expect(overlap).toEqual([]);
  });
});
