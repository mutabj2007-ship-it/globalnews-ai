import {
  classifyReAnalysisEvidence,
  deriveSnapshotState,
  dimensionsAreComparable,
  dimensionValuesAreIdentical,
} from './situation.state';

/**
 * S1 — THE STATE RULES, TESTED AGAINST THE CTO RULING SENTENCE BY SENTENCE.
 *
 *   "One snapshot NEVER proves STABLE. STABLE requires a later completed
 *    analysis comparable to an earlier snapshot and no material change.
 *    NOT RE-ANALYSED requires enough temporal evidence to establish that
 *    the subject has not been analysed since the relevant seen/reference
 *    point. Do not infer either from article counts."
 *
 * These functions are pure, so every one of those clauses is testable
 * exactly, with no database and no fake standing in for one.
 */

const T1 = new Date('2026-08-30T10:00:00.000Z');
const T2 = new Date('2026-08-31T10:00:00.000Z');

const DIMS = { severity: 'HIGH', countryCode: 'RW', confirmedByOfficialSource: false };

describe('S1 deriveSnapshotState — one snapshot never proves STABLE', () => {
  it('the first snapshot is FIRST_OBSERVATION, never STABLE', () => {
    const state = deriveSnapshotState(null, { analysedAt: T1, dimensions: DIMS });

    expect(state).toBe('FIRST_OBSERVATION');
    expect(state).not.toBe('STABLE');
  });

  it('the first snapshot is not MATERIAL_CHANGE either — there is nothing it changed from', () => {
    expect(deriveSnapshotState(null, { analysedAt: T1, dimensions: DIMS })).not.toBe(
      'MATERIAL_CHANGE',
    );
  });
});

describe('S1 deriveSnapshotState — STABLE requires later, comparable, unchanged', () => {
  it('later + comparable + identical values is STABLE', () => {
    expect(
      deriveSnapshotState(
        { analysedAt: T1, dimensions: DIMS },
        { analysedAt: T2, dimensions: { ...DIMS } },
      ),
    ).toBe('STABLE');
  });

  it('later + comparable + a changed value is MATERIAL_CHANGE', () => {
    expect(
      deriveSnapshotState(
        { analysedAt: T1, dimensions: DIMS },
        { analysedAt: T2, dimensions: { ...DIMS, severity: 'CRITICAL' } },
      ),
    ).toBe('MATERIAL_CHANGE');
  });

  it('NOT later — the same instant — is INCOMPARABLE, not STABLE', () => {
    // Two analyses bearing the same instant cannot be ordered, so neither
    // stability nor change is provable between them.
    expect(
      deriveSnapshotState(
        { analysedAt: T1, dimensions: DIMS },
        { analysedAt: new Date(T1.getTime()), dimensions: { ...DIMS } },
      ),
    ).toBe('INCOMPARABLE');
  });

  it('EARLIER than the previous snapshot is INCOMPARABLE, not STABLE', () => {
    expect(
      deriveSnapshotState(
        { analysedAt: T2, dimensions: DIMS },
        { analysedAt: T1, dimensions: { ...DIMS } },
      ),
    ).toBe('INCOMPARABLE');
  });

  it('a different dimension SET is INCOMPARABLE, not MATERIAL_CHANGE', () => {
    // A dimension appearing or disappearing is a fact about our own
    // measurement, not about the subject. Reporting it as MATERIAL_CHANGE
    // would present a change in the instrument as a change in the world.
    expect(
      deriveSnapshotState(
        { analysedAt: T1, dimensions: { severity: 'HIGH' } },
        { analysedAt: T2, dimensions: { severity: 'HIGH', escalation: 'NONE' } },
      ),
    ).toBe('INCOMPARABLE');
  });

  it('a dimension REMOVED is INCOMPARABLE too, in the same way', () => {
    expect(
      deriveSnapshotState(
        { analysedAt: T1, dimensions: { severity: 'HIGH', escalation: 'NONE' } },
        { analysedAt: T2, dimensions: { severity: 'HIGH' } },
      ),
    ).toBe('INCOMPARABLE');
  });

  it('null and false and 0 are DISTINCT dimension values, not interchangeable falsehoods', () => {
    expect(
      deriveSnapshotState(
        { analysedAt: T1, dimensions: { confirmed: null } },
        { analysedAt: T2, dimensions: { confirmed: false } },
      ),
    ).toBe('MATERIAL_CHANGE');

    expect(
      deriveSnapshotState(
        { analysedAt: T1, dimensions: { count: 0 } },
        { analysedAt: T2, dimensions: { count: false as unknown as number } },
      ),
    ).toBe('MATERIAL_CHANGE');
  });
});

describe('S1 deriveSnapshotState — state is NEVER inferred from article counts', () => {
  it('the function cannot see counts at all: identical dimensions are STABLE regardless', () => {
    // The ruling forbids inferring state from article counts. The way that
    // is honoured is that counts are not parameters — there is no argument
    // to pass them in. This test states the consequence: a story picked up
    // by many more outlets, with unchanged dimensions, is STABLE.
    const state = deriveSnapshotState(
      { analysedAt: T1, dimensions: DIMS },
      { analysedAt: T2, dimensions: { ...DIMS } },
    );

    expect(state).toBe('STABLE');
    expect(deriveSnapshotState.length).toBe(2);
  });
});

describe('S1 dimension comparison helpers', () => {
  it('comparability is about the KEY SET only, in any order', () => {
    expect(dimensionsAreComparable({ a: 1, b: 2 }, { b: 9, a: 8 })).toBe(true);
    expect(dimensionsAreComparable({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it('identity is value-by-value over a known-identical key set', () => {
    expect(dimensionValuesAreIdentical({ a: 1, b: 'x' }, { a: 1, b: 'x' })).toBe(true);
    expect(dimensionValuesAreIdentical({ a: 1, b: 'x' }, { a: 1, b: 'y' })).toBe(false);
  });
});

describe('S1 classifyReAnalysisEvidence — NULL MEANS NEVER', () => {
  it('a NULL lastAnalysedAt is NEVER_ANALYSED, whatever the reference point', () => {
    expect(classifyReAnalysisEvidence(null, T1)).toBe('NEVER_ANALYSED');
    expect(classifyReAnalysisEvidence(null, null)).toBe('NEVER_ANALYSED');
  });

  it('NEVER_ANALYSED is NOT reported as "not re-analysed since you looked"', () => {
    // The two are different claims. The second implies we analysed it once
    // and have not since; the first says we never did.
    expect(classifyReAnalysisEvidence(null, T1)).not.toBe('NOT_RE_ANALYSED_SINCE_REFERENCE');
  });

  it('analysed strictly after the reference point is ANALYSED_SINCE_REFERENCE', () => {
    expect(classifyReAnalysisEvidence(T2, T1)).toBe('ANALYSED_SINCE_REFERENCE');
  });

  it('analysed at or before the reference point is NOT_RE_ANALYSED_SINCE_REFERENCE', () => {
    expect(classifyReAnalysisEvidence(T1, T2)).toBe('NOT_RE_ANALYSED_SINCE_REFERENCE');
    expect(classifyReAnalysisEvidence(T1, new Date(T1.getTime()))).toBe(
      'NOT_RE_ANALYSED_SINCE_REFERENCE',
    );
  });

  it('WITHOUT a usable reference point the answer is INSUFFICIENT_EVIDENCE, not the reassuring one', () => {
    expect(classifyReAnalysisEvidence(T1, null)).toBe('INSUFFICIENT_EVIDENCE');
    expect(classifyReAnalysisEvidence(T1, undefined)).toBe('INSUFFICIENT_EVIDENCE');
    expect(classifyReAnalysisEvidence(T1, new Date('not a date'))).toBe('INSUFFICIENT_EVIDENCE');
  });
});
