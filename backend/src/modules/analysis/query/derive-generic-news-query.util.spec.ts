import { deriveGenericNewsQuery } from './derive-generic-news-query.util';

describe('deriveGenericNewsQuery (Milestone #35)', () => {
  it('"What\'s happening in the Middle East?" -> "Middle East"', () => {
    expect(deriveGenericNewsQuery("What's happening in the Middle East?")).toBe('Middle East');
  });

  it('"What\'s happening with East Africa?" -> "East Africa"', () => {
    expect(deriveGenericNewsQuery("What's happening with East Africa?")).toBe('East Africa');
  });

  it('"What\'s happening with NATO?" -> "NATO"', () => {
    expect(deriveGenericNewsQuery("What's happening with NATO?")).toBe('NATO');
  });

  it('"What\'s going on with OpenAI?" -> "OpenAI"', () => {
    expect(deriveGenericNewsQuery("What's going on with OpenAI?")).toBe('OpenAI');
  });

  it('"latest semiconductor news" -> "semiconductor"', () => {
    expect(deriveGenericNewsQuery('latest semiconductor news')).toBe('semiconductor');
  });

  it('"latest quantum computing news" -> "quantum computing"', () => {
    expect(deriveGenericNewsQuery('latest quantum computing news')).toBe('quantum computing');
  });

  it('"NATO" -> unchanged (already concise, no-op)', () => {
    expect(deriveGenericNewsQuery('NATO')).toBe('NATO');
  });

  it('"East Africa" -> unchanged (already concise, no-op)', () => {
    expect(deriveGenericNewsQuery('East Africa')).toBe('East Africa');
  });

  it('an unmatched sentence falls back to the safe punctuation-normalized original', () => {
    expect(deriveGenericNewsQuery('Why did the stock market drop today?')).toBe(
      'Why did the stock market drop today',
    );
  });

  it('"What is quantum?" -> unchanged except harmless punctuation normalization, never rewritten toward general knowledge', () => {
    expect(deriveGenericNewsQuery('What is quantum?')).toBe('What is quantum');
  });

  it('never returns an empty string for realistic non-empty input', () => {
    expect(deriveGenericNewsQuery('quantum')).toBe('quantum');
    expect(deriveGenericNewsQuery('quantum').length).toBeGreaterThan(0);
  });

  it('does not match "what is X" as a subject-extraction pattern (requires a happening/going-on/new/latest verb)', () => {
    // Guards against a false-positive that would collapse "What is
    // quantum?" (general-knowledge-shaped) down to just "quantum" —
    // that must never happen per M35 architectural rule 8.
    expect(deriveGenericNewsQuery('What is the capital of France?')).toBe(
      'What is the capital of France',
    );
  });

  it('trims exactly one leading "the" from an extracted subject, not from an already-concise query', () => {
    expect(deriveGenericNewsQuery("What's happening in the Sahel?")).toBe('Sahel');
    expect(deriveGenericNewsQuery('The Hague')).toBe('The Hague');
  });

  it('is a pure, deterministic function — same input always produces the same output', () => {
    const input = "What's happening with NATO?";
    expect(deriveGenericNewsQuery(input)).toBe(deriveGenericNewsQuery(input));
  });
});
