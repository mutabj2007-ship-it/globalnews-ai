import { humanitarianReadAbsence, parseHumanitarianRetainedRead } from './retained-read';

describe('Humanitarian retained read admission', () => {
  it('distinguishes unassessed from unavailable without exposing withheld evidence', () => {
    expect(humanitarianReadAbsence('NOT_ASSESSED').absence).toBe('NOT_ASSESSED');
    for (const state of ['SOURCE_TEMPORARILY_UNAVAILABLE', 'SOURCE_NOT_CONNECTED', 'EVIDENCE_WITHHELD', 'COVERAGE_GAP'] as const) {
      expect(humanitarianReadAbsence(state)).toEqual({ kind: 'UNAVAILABLE', absence: 'COVERAGE_GAP', observations: [] });
    }
  });
  it.each([null, [], {}, {kind:'NO_RESULTS'}, {kind:'UNAVAILABLE',absence:'ASSESSED_NOTHING_QUALIFIED',observations:[]},
    {kind:'UNAVAILABLE',absence:'NOT_ASSESSED',observations:[{incident:'fixture'}]},
    {kind:'UNAVAILABLE',absence:'COVERAGE_GAP',observations:[],protectionClassId:'private'},
  ])('fails closed for malformed, positive absence or unadmitted records: %j', value => {
    expect(parseHumanitarianRetainedRead(value)).toBeNull();
  });
  it('admits only the closed supported response', () => {
    const read = humanitarianReadAbsence('NOT_ASSESSED');
    expect(parseHumanitarianRetainedRead(read)).toEqual(read);
  });
});