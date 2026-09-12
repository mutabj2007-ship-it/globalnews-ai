import type { TrustReason } from '@globalnews-ai/shared';
import { TRUST_REASON_LABELS, trustReasonLabel, selectPrimaryReason } from './trustReasonLabels';

const ALL_REASONS: TrustReason[] = [
  'no-grounded-evidence',
  'single-distinct-article',
  'multiple-distinct-articles',
  'relational-support-adequate',
  'relational-support-limited',
  'requested-direction-unsupported',
  'reverse-evidence-present',
  'mixed-evidence-present',
  'uncertainties-reported',
  'differences-reported',
  'mock-execution',
];

describe('trustReasonLabels (Milestone #44)', () => {
  it('F. every TrustReason value has a non-empty label', () => {
    for (const reason of ALL_REASONS) {
      expect(typeof trustReasonLabel(reason)).toBe('string');
      expect(trustReasonLabel(reason).length).toBeGreaterThan(0);
    }
  });

  it('the label map is exhaustive over all 11 known reasons (no extras, no gaps)', () => {
    expect(Object.keys(TRUST_REASON_LABELS).sort()).toEqual([...ALL_REASONS].sort());
  });

  it('G. primary reason selection is deterministic and presentation-only', () => {
    // Same input -> same output, every time.
    const reasons: TrustReason[] = ['uncertainties-reported', 'mixed-evidence-present'];
    const first = selectPrimaryReason(reasons);
    const second = selectPrimaryReason(reasons);
    expect(first).toBe(second);
    // Higher-priority code wins regardless of array order.
    expect(selectPrimaryReason(['differences-reported', 'mock-execution'])).toBe('mock-execution');
    expect(selectPrimaryReason(['mock-execution', 'differences-reported'])).toBe('mock-execution');
  });

  it('selects requested-direction-unsupported over lower-priority reasons', () => {
    expect(
      selectPrimaryReason(['uncertainties-reported', 'requested-direction-unsupported', 'differences-reported']),
    ).toBe('requested-direction-unsupported');
  });

  it('falls back to the first supplied reason for an unrecognized-order edge case (defensive)', () => {
    expect(selectPrimaryReason(['no-grounded-evidence'])).toBe('no-grounded-evidence');
  });

  it('returns undefined only for an empty reasons array', () => {
    expect(selectPrimaryReason([])).toBeUndefined();
  });
});
