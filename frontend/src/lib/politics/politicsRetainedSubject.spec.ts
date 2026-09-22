import { selectRetainedPoliticsSubject, politicsSourceLanguageNotice } from './politicsRetainedSubject';
import type { PoliticsReadResponse } from '@globalnews-ai/shared';

describe('Politics retained frontend seam', () => {
  it('honest absence remains empty without any preview fallback', () => {
    expect(selectRetainedPoliticsSubject({ observations: [], absence: 'NOT_ASSESSED', acquisition: 'RETAINED_ONLY', truncated: false }, 'KE')).toEqual([]);
  });
  it('selects by stable subject id preserving server order and all provenance', () => {
    const first = { subjectId: 'one', provenance: { language: 'sw' } };
    const second = { subjectId: 'two' };
    const response = { observations: [first, second, first], acquisition: 'RETAINED_ONLY' } as unknown as PoliticsReadResponse;
    const selected = selectRetainedPoliticsSubject(response, 'one');
    expect(selected).toEqual([first, first]);
    expect(selected[0]).toBe(first);
    expect(selected[0].provenance.language).toBe('sw');
  });
  it('discloses original-language text in EN and PL', () => {
    expect(politicsSourceLanguageNotice('sw', 'en')).toBe('Source language: sw. Original wording retained.');
    expect(politicsSourceLanguageNotice('sw', 'pl')).toBe('Język źródła: sw. Zachowano oryginalne brzmienie.');
  });
});
