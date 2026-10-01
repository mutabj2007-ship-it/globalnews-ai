import { ABSENCE_MUST_NOT_IMPLY, humanitarianReadAbsence } from '@globalnews-ai/shared';
import type { HumanitarianRetainedRead } from '@globalnews-ai/shared';
import {
  humanitarianReadExplanation,
  humanitarianReadLabel,
  humanitarianReadState,
} from './humanitarianReadLabel';

/**
 * HUMANITARIAN DATA R1 CONVERGENCE — reader copy for the retained-read result states. The empty
 * store is a fact about OUR store; no label or explanation may read as "assessed, nothing happened".
 */
const NO_RETAINED: HumanitarianRetainedRead = { kind: 'NO_RETAINED_EVIDENCE', observations: [] };
const FORBIDDEN = [
  ...ABSENCE_MUST_NOT_IMPLY,
  'no impact',
  'no displacement',
  'unaffected',
  'under control',
  'all clear',
  'nothing happened.',
];

describe('retained-read states — truthful reader copy', () => {
  it('NO_RETAINED_EVIDENCE says it is not an assessment, in both languages', () => {
    expect(humanitarianReadLabel(NO_RETAINED, 'en')).toMatch(/not an assessment/i);
    expect(humanitarianReadLabel(NO_RETAINED, 'pl')).toMatch(/nie jest ocena/i);
    expect(humanitarianReadExplanation(NO_RETAINED, 'en')).toMatch(/says nothing about whether/i);
  });

  it.each(['en', 'pl'] as const)('%s: no state reads as reassurance', (locale) => {
    for (const read of [
      humanitarianReadAbsence('NOT_ASSESSED'),
      humanitarianReadAbsence('SOURCE_TEMPORARILY_UNAVAILABLE'),
      NO_RETAINED,
    ]) {
      const text =
        `${humanitarianReadLabel(read, locale)} ${humanitarianReadExplanation(read, locale)}`.toLowerCase();
      for (const word of FORBIDDEN) expect(text).not.toContain(word);
    }
  });

  it('the state token keeps NO_RETAINED_EVIDENCE distinct from every absence', () => {
    expect(humanitarianReadState(NO_RETAINED)).toBe('NO_RETAINED_EVIDENCE');
    expect(humanitarianReadState(humanitarianReadAbsence('NOT_ASSESSED'))).toBe('NOT_ASSESSED');
    expect(humanitarianReadState(humanitarianReadAbsence('SOURCE_NOT_CONNECTED'))).toBe(
      'COVERAGE_GAP',
    );
  });

  it('PL is authored, not English fallback', () => {
    expect(humanitarianReadLabel(NO_RETAINED, 'pl')).not.toBe(
      humanitarianReadLabel(NO_RETAINED, 'en'),
    );
    expect(humanitarianReadExplanation(NO_RETAINED, 'pl')).not.toBe(
      humanitarianReadExplanation(NO_RETAINED, 'en'),
    );
  });
});
