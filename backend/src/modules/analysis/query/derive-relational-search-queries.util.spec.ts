import { deriveRelationalSearchQueries } from './derive-relational-search-queries.util';

describe('deriveRelationalSearchQueries (Milestone #37)', () => {
  it('"How is the Iran conflict affecting oil prices?" -> X="Iran conflict", Y="oil prices"', () => {
    const result = deriveRelationalSearchQueries(
      'How is the Iran conflict affecting oil prices?',
    );
    expect(result).toEqual({
      providerQuery: 'Iran conflict oil prices',
      x: 'Iran conflict',
      y: 'oil prices',
    });
  });

  it('"How are US tariffs affecting European markets?" -> X="US tariffs", Y="European markets"', () => {
    const result = deriveRelationalSearchQueries(
      'How are US tariffs affecting European markets?',
    );
    expect(result).toEqual({
      providerQuery: 'US tariffs European markets',
      x: 'US tariffs',
      y: 'European markets',
    });
  });

  it('"How are interest rates affecting house prices?" -> X="interest rates", Y="house prices"', () => {
    const result = deriveRelationalSearchQueries(
      'How are interest rates affecting house prices?',
    );
    expect(result).toEqual({
      providerQuery: 'interest rates house prices',
      x: 'interest rates',
      y: 'house prices',
    });
  });

  it('"How is AI affecting employment?" -> X="AI", Y="employment" (single-word concepts)', () => {
    const result = deriveRelationalSearchQueries('How is AI affecting employment?');
    expect(result).toEqual({
      providerQuery: 'AI employment',
      x: 'AI',
      y: 'employment',
    });
  });

  it('"What impact are sanctions having on Russia\'s economy?" -> X="sanctions", Y="Russia\'s economy"', () => {
    const result = deriveRelationalSearchQueries(
      "What impact are sanctions having on Russia's economy?",
    );
    expect(result).toEqual({
      providerQuery: "sanctions Russia's economy",
      x: 'sanctions',
      y: "Russia's economy",
    });
  });

  it('"How is climate change affecting agriculture?" -> X="climate change", Y="agriculture"', () => {
    const result = deriveRelationalSearchQueries(
      'How is climate change affecting agriculture?',
    );
    expect(result).toEqual({
      providerQuery: 'climate change agriculture',
      x: 'climate change',
      y: 'agriculture',
    });
  });

  it('"does/do" variant: "How does inflation affect consumer spending?"', () => {
    const result = deriveRelationalSearchQueries(
      'How does inflation affect consumer spending?',
    );
    expect(result).toEqual({
      providerQuery: 'inflation consumer spending',
      x: 'inflation',
      y: 'consumer spending',
    });
  });

  it('"does/do" variant (plural): "How do sanctions affect trade?"', () => {
    const result = deriveRelationalSearchQueries('How do sanctions affect trade?');
    expect(result).toEqual({
      providerQuery: 'sanctions trade',
      x: 'sanctions',
      y: 'trade',
    });
  });

  it('"why is/are" variant: "Why is the war affecting food prices?"', () => {
    const result = deriveRelationalSearchQueries('Why is the war affecting food prices?');
    expect(result).toEqual({
      providerQuery: 'war food prices',
      x: 'war',
      y: 'food prices',
    });
  });

  it('"why is/are" variant (plural): "Why are tariffs affecting exports?"', () => {
    const result = deriveRelationalSearchQueries('Why are tariffs affecting exports?');
    expect(result).toEqual({
      providerQuery: 'tariffs exports',
      x: 'tariffs',
      y: 'exports',
    });
  });

  it('strips exactly one leading "the" from X ("the Iran conflict" -> "Iran conflict")', () => {
    const result = deriveRelationalSearchQueries('How is the Iran conflict affecting markets?');
    expect(result?.x).toBe('Iran conflict');
  });

  it('rejects an empty capture (X reduces to nothing after stripping "the")', () => {
    const result = deriveRelationalSearchQueries('How is the affecting oil prices?');
    expect(result).toBeUndefined();
  });

  it('rejects when X exceeds the 4-word maximum', () => {
    const result = deriveRelationalSearchQueries(
      'How is the ongoing major regional security crisis affecting oil prices?',
    );
    expect(result).toBeUndefined();
  });

  it('rejects when Y exceeds the 4-word maximum', () => {
    const result = deriveRelationalSearchQueries(
      'How is the Iran conflict affecting the ongoing major global oil trading markets?',
    );
    expect(result).toBeUndefined();
  });

  it('accepts X or Y at exactly the 4-word maximum (boundary, not off-by-one)', () => {
    const result = deriveRelationalSearchQueries(
      'How is the ongoing regional security crisis affecting oil prices?',
    );
    expect(result).toEqual({
      providerQuery: 'ongoing regional security crisis oil prices',
      x: 'ongoing regional security crisis',
      y: 'oil prices',
    });
  });

  it('an unrelated sentence returns undefined and does not throw', () => {
    expect(deriveRelationalSearchQueries('What is quantum computing?')).toBeUndefined();
    expect(deriveRelationalSearchQueries('NATO')).toBeUndefined();
    expect(deriveRelationalSearchQueries('Middle East')).toBeUndefined();
    expect(deriveRelationalSearchQueries("What's happening with NATO?")).toBeUndefined();
  });

  it('never returns a result whose x or y is empty', () => {
    const result = deriveRelationalSearchQueries('How is the Iran conflict affecting oil prices?');
    expect(result?.x.length).toBeGreaterThan(0);
    expect(result?.y.length).toBeGreaterThan(0);
  });

  it('is a pure, deterministic function — same input always produces the same output', () => {
    const input = 'How is the Iran conflict affecting oil prices?';
    expect(deriveRelationalSearchQueries(input)).toEqual(deriveRelationalSearchQueries(input));
  });
});
