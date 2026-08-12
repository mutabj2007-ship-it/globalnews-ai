import { deriveGenericNewsQuery, deriveFallbackNewsQuery } from './derive-generic-news-query.util';

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

  describe('Milestone #46 — expanded subject-extraction patterns', () => {
    it('the exact real-runtime NATO failure query now derives to "NATO"', () => {
      expect(
        deriveGenericNewsQuery('What are the most important developments in NATO right now?'),
      ).toBe('NATO');
    });

    it('handles "What are the latest developments in the X" (strips leading "the" from the captured subject)', () => {
      expect(deriveGenericNewsQuery('What are the latest developments in the UN?')).toBe('UN');
    });

    it('handles the pattern with no trailing time-phrase', () => {
      expect(deriveGenericNewsQuery('What are the key updates on semiconductor exports')).toBe(
        'semiconductor exports',
      );
    });

    it('handles "today" as the trailing time-phrase', () => {
      expect(
        deriveGenericNewsQuery('What are the major happenings with AI regulation today?'),
      ).toBe('AI regulation');
    });

    it('handles "currently" as the trailing time-phrase', () => {
      expect(deriveGenericNewsQuery('What is the current news on oil prices currently?')).toBe(
        'oil prices',
      );
    });

    it('"Tell me about X"', () => {
      expect(deriveGenericNewsQuery('Tell me about oil prices')).toBe('oil prices');
    });

    it('"Give me the latest on X"', () => {
      expect(deriveGenericNewsQuery('Give me the latest on the Middle East')).toBe('Middle East');
    });

    it('does not falsely match "What is the capital of France?" (no developments/updates/news/happenings verb present)', () => {
      expect(deriveGenericNewsQuery('What is the capital of France?')).toBe(
        'What is the capital of France',
      );
    });

    it('remains a no-op for an already-concise entity query', () => {
      expect(deriveGenericNewsQuery('NATO')).toBe('NATO');
      expect(deriveGenericNewsQuery('UN')).toBe('UN');
    });
  });

  describe('deriveFallbackNewsQuery (Milestone #46 — bounded fallback derivation)', () => {
    it('strips the closed stopword set from an already-derived (unmatched-sentence) primary query', () => {
      expect(deriveFallbackNewsQuery('What is the impact of new tariffs on global trade')).toBe(
        'impact tariffs global trade',
      );
    });

    it('returns undefined when nothing would be stripped (avoids re-running an identical, already-failed search)', () => {
      expect(deriveFallbackNewsQuery('NATO')).toBeUndefined();
      expect(deriveFallbackNewsQuery('semiconductor exports')).toBeUndefined();
    });

    it('returns undefined when stripping would remove every word', () => {
      expect(deriveFallbackNewsQuery('what is the')).toBeUndefined();
    });

    it('is a pure, deterministic function', () => {
      const input = 'What is the impact of new tariffs on global trade';
      expect(deriveFallbackNewsQuery(input)).toBe(deriveFallbackNewsQuery(input));
    });
  });
});
