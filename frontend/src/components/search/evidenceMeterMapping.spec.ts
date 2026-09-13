import type { TrustLevel } from '@globalnews-ai/shared';
import { resolveEvidenceMeter } from './analysisDimensions';

/**
 * H2A — evidence-support meter mapping.
 *
 * The design (07-INTERACTION-STATES section 4, 08-DATA-BINDING-MAP item 7)
 * specifies a three-segment meter driven by "the existing trust rating",
 * mapping LIMITED to 1, MODERATE to 2 and STRONG to 3.
 *
 * Production's TrustLevel has FOUR members and no 'strong':
 *   'high' | 'moderate' | 'limited' | 'insufficient'
 *
 * The CTO-approved mapping closes both gaps:
 *
 *   high         -> 3 segments, STRONG,       rated
 *   moderate     -> 2 segments, MODERATE,     rated
 *   limited      -> 1 segment,  LIMITED,      rated
 *   insufficient -> 0 segments, INSUFFICIENT, rated
 *   absent       -> 0 segments, UNRATED,      NOT rated
 *
 * The load-bearing assertion in this file is the last pair. 'insufficient'
 * and an absent trust state fill the same number of segments and mean
 * completely different things: one is a rated finding, the other is the
 * absence of any assessment. Presenting an assessed-and-insufficient
 * analysis as UNRATED would assert something untrue about it, and would
 * contradict the package's own non-negotiable 4 — "Insufficient Evidence
 * is a first-class result. It is never hidden, never styled as an error."
 */

describe('A. All five states', () => {
  it('high -> 3 of 3, STRONG, rated', () => {
    expect(resolveEvidenceMeter('high')).toEqual({
      level: 'high',
      filledSegments: 3,
      totalSegments: 3,
      label: 'STRONG',
      rated: true,
    });
  });

  it('moderate -> 2 of 3, MODERATE, rated', () => {
    expect(resolveEvidenceMeter('moderate')).toEqual({
      level: 'moderate',
      filledSegments: 2,
      totalSegments: 3,
      label: 'MODERATE',
      rated: true,
    });
  });

  it('limited -> 1 of 3, LIMITED, rated', () => {
    expect(resolveEvidenceMeter('limited')).toEqual({
      level: 'limited',
      filledSegments: 1,
      totalSegments: 3,
      label: 'LIMITED',
      rated: true,
    });
  });

  it('insufficient -> 0 of 3, INSUFFICIENT, and is still RATED', () => {
    expect(resolveEvidenceMeter('insufficient')).toEqual({
      level: 'insufficient',
      filledSegments: 0,
      totalSegments: 3,
      label: 'INSUFFICIENT',
      rated: true,
    });
  });

  it('absent -> 0 of 3, UNRATED, and is NOT rated', () => {
    const expected = {
      level: null,
      filledSegments: 0,
      totalSegments: 3,
      label: 'UNRATED',
      rated: false,
    };
    expect(resolveEvidenceMeter(null)).toEqual(expected);
    expect(resolveEvidenceMeter(undefined)).toEqual(expected);
  });
});

describe('B. insufficient is NEVER UNRATED — the critical distinction', () => {
  it('gives the two states different labels', () => {
    expect(resolveEvidenceMeter('insufficient').label).toBe('INSUFFICIENT');
    expect(resolveEvidenceMeter(null).label).toBe('UNRATED');
    expect(resolveEvidenceMeter('insufficient').label).not.toBe(resolveEvidenceMeter(null).label);
  });

  it('gives the two states different rated flags, which is what makes them un-confusable', () => {
    expect(resolveEvidenceMeter('insufficient').rated).toBe(true);
    expect(resolveEvidenceMeter(null).rated).toBe(false);
  });

  it('lets them share a segment count without sharing meaning', () => {
    const insufficient = resolveEvidenceMeter('insufficient');
    const absent = resolveEvidenceMeter(null);

    expect(insufficient.filledSegments).toBe(absent.filledSegments);
    expect(insufficient).not.toEqual(absent);
  });

  it('preserves the production level on insufficient and reports null only when genuinely absent', () => {
    expect(resolveEvidenceMeter('insufficient').level).toBe('insufficient');
    expect(resolveEvidenceMeter(null).level).toBeNull();
  });
});

describe('C. No synthesised score, no invented level', () => {
  it('never emits a numeric score or percentage the backend did not provide', () => {
    const levels: (TrustLevel | null)[] = ['high', 'moderate', 'limited', 'insufficient', null];
    levels.forEach((level) => {
      const state = resolveEvidenceMeter(level);
      expect(Object.keys(state).sort()).toEqual([
        'filledSegments',
        'label',
        'level',
        'rated',
        'totalSegments',
      ]);
      const serialized = JSON.stringify(state);
      expect(serialized).not.toMatch(/score|percent|confidence|ratio/i);
    });
  });

  it('always reports exactly three total segments', () => {
    const levels: (TrustLevel | null)[] = ['high', 'moderate', 'limited', 'insufficient', null];
    levels.forEach((level) => expect(resolveEvidenceMeter(level).totalSegments).toBe(3));
  });

  it('never fills more segments than the total, or fewer than zero', () => {
    const levels: (TrustLevel | null)[] = ['high', 'moderate', 'limited', 'insufficient', null];
    levels.forEach((level) => {
      const { filledSegments, totalSegments } = resolveEvidenceMeter(level);
      expect(filledSegments).toBeGreaterThanOrEqual(0);
      expect(filledSegments).toBeLessThanOrEqual(totalSegments);
    });
  });

  it('emits only labels from the approved five-word vocabulary — no STRONG-ish improvisation', () => {
    const labels = (
      ['high', 'moderate', 'limited', 'insufficient', null] as (TrustLevel | null)[]
    ).map((level) => resolveEvidenceMeter(level).label);
    expect(labels).toEqual(['STRONG', 'MODERATE', 'LIMITED', 'INSUFFICIENT', 'UNRATED']);
    expect(new Set(labels).size).toBe(5);
  });
});

describe('D. Determinism', () => {
  it('returns an equal state for repeated calls with the same input', () => {
    expect(resolveEvidenceMeter('moderate')).toEqual(resolveEvidenceMeter('moderate'));
    expect(resolveEvidenceMeter(null)).toEqual(resolveEvidenceMeter(undefined));
  });

  it('maps every production TrustLevel member — no member falls through to UNRATED', () => {
    const allProductionLevels: TrustLevel[] = ['high', 'moderate', 'limited', 'insufficient'];
    allProductionLevels.forEach((level) => {
      const state = resolveEvidenceMeter(level);
      expect(state.rated).toBe(true);
      expect(state.label).not.toBe('UNRATED');
      expect(state.level).toBe(level);
    });
  });
});
