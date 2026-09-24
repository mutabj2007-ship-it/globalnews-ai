import type { EvidenceRecord } from './evidenceModel';
import { evidencePlaceMarks } from './evidencePlaceMarks';

const record = (
  id: string,
  geographyId: string,
  point: readonly [number, number],
  precision: EvidenceRecord['precision'] = 'CITY',
  provenance: EvidenceRecord['provenance'] = 'STATED',
): EvidenceRecord => ({
  id,
  geography: {
    id: geographyId,
    countryIso3: 'YEM',
    displayName: geographyId,
    point,
  },
  precision,
  provenance,
  reportCount: 1,
  sourceCount: 1,
  publisherId: 'UCDP_GED',
  lastObservedAt: '2026-08-31',
});

describe('evidencePlaceMarks', () => {
  it('returns one mark and therefore one stable key per evidence geography', () => {
    const marks = evidencePlaceMarks([
      record('a', 'conflict-point:YEM:44:15', [44, 15]),
      record('b', 'conflict-point:YEM:44:15', [44, 15]),
      record('c', 'conflict-point:YEM:45:15', [45, 15]),
    ]);

    expect(marks).toHaveLength(2);
    expect(marks.map((mark) => mark.geographyId)).toEqual([
      'conflict-point:YEM:44:15',
      'conflict-point:YEM:45:15',
    ]);
    expect(new Set(marks.map((mark) => mark.geographyId)).size).toBe(marks.length);
  });

  it('keeps nearby-but-distinct source points separate', () => {
    expect(
      evidencePlaceMarks([
        record('a', 'p1', [44, 15]),
        record('b', 'p2', [44.0001, 15]),
      ]),
    ).toHaveLength(2);
  });

  it('keeps the finest asserted precision and strongest stated provenance for a shared place', () => {
    const [mark] = evidencePlaceMarks([
      record('a', 'same', [44, 15], 'CITY', 'INTERPRETED'),
      record('b', 'same', [44, 15], 'EXACT', 'STATED'),
    ]);

    expect(mark.precision).toBe('EXACT');
    expect(mark.provenance).toBe('STATED');
    expect(mark.point).toEqual([44, 15]);
  });

  it('withholds non-point-renderable records from the shared mark set', () => {
    expect(
      evidencePlaceMarks([
        record('a', 'country', [44, 15], 'COUNTRY', 'STATED'),
        record('b', 'unknown', [44, 15], 'UNKNOWN', 'INTERPRETED'),
      ]),
    ).toEqual([]);
  });
});
