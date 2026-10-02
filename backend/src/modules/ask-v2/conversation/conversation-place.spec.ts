import {
  inheritedConversationCountry,
  MAX_CONTINUATION_WORDS,
  typedCountriesOf,
} from './conversation-place';

const en = (question: string) => ({ question, language: 'en' });

describe('conversation place — explicit state from the reader’s own earlier questions', () => {
  it('reads typed countries, not demonyms', () => {
    expect(typedCountriesOf('What is going on in Madagascar?', 'en')).toEqual(['MDG']);
    expect(typedCountriesOf('What caused the Rwandan genocide?', 'en')).toEqual([]);
    expect(typedCountriesOf('Co się dzieje w Polsce?', 'pl')).toEqual(['POL']);
    expect(typedCountriesOf('Habari za Kenya?', 'sw')).toBeNull();
  });

  it('a short follow-up with no place continues the conversation country', () => {
    const earlier = [en('What is going on in Madagascar?'), en('Which news are in Iran?')];
    expect(inheritedConversationCountry('And the economy?', 'en', earlier)).toBe('MDG');
    expect(inheritedConversationCountry('What about yesterday?', 'en', earlier)).toBe('MDG');
  });

  it('a newly typed place always wins (explicit switch)', () => {
    const earlier = [en('Which news are in Iran?')];
    expect(inheritedConversationCountry('What is going on in Madagascar?', 'en', earlier)).toBeNull();
    expect(inheritedConversationCountry('What about Madagascar?', 'en', earlier)).toBeNull();
  });

  it('skips place-less turns to the nearest one that typed a country', () => {
    const earlier = [en('And the economy?'), en('What is going on in Madagascar?')];
    expect(inheritedConversationCountry('What about yesterday?', 'en', earlier)).toBe('MDG');
  });

  it('never picks a side of an earlier comparison', () => {
    const earlier = [en('Compare Rwanda and Kenya')];
    expect(inheritedConversationCountry('And the economy?', 'en', earlier)).toBeNull();
  });

  it('a long self-contained question is a new topic', () => {
    const long = Array.from({ length: MAX_CONTINUATION_WORDS + 1 }, () => 'word').join(' ');
    expect(inheritedConversationCountry(long, 'en', [en('News in Kenya')])).toBeNull();
  });

  it('nothing to inherit in a new thread', () => {
    expect(inheritedConversationCountry('And the economy?', 'en', [])).toBeNull();
  });
});
