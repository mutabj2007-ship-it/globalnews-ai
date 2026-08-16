import {
  deriveGenericNewsQuery,
  deriveFallbackNewsQuery,
  makeProviderSafeNewsQuery,
} from './derive-generic-news-query.util';

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

  describe('Milestone #46 (CI correction) — short-form "[adjective] developments/updates/news/happenings in X" without a leading "What are/is the"', () => {
    it('real-machine CI failure case: "Latest developments in semiconductor exports" -> "semiconductor exports"', () => {
      expect(deriveGenericNewsQuery('Latest developments in semiconductor exports')).toBe(
        'semiconductor exports',
      );
    });

    it('"Latest developments in NATO" -> "NATO"', () => {
      expect(deriveGenericNewsQuery('Latest developments in NATO')).toBe('NATO');
    });

    it('"Latest developments in oil prices" -> "oil prices"', () => {
      expect(deriveGenericNewsQuery('Latest developments in oil prices')).toBe('oil prices');
    });

    it('"Most important developments in X" short form is also supported by the same mechanism', () => {
      expect(deriveGenericNewsQuery('Most important developments in NATO')).toBe('NATO');
    });

    it('the corresponding long form (with "What are the") continues to work, unaffected', () => {
      expect(
        deriveGenericNewsQuery('What are the latest developments in semiconductor exports?'),
      ).toBe('semiconductor exports');
      expect(
        deriveGenericNewsQuery('What are the most important developments in NATO right now?'),
      ).toBe('NATO');
    });

    it('requires at least one adjective — a bare "Developments in X" (no adjective at all) is NOT matched by this pattern and falls through unchanged (conservative, avoids over-broadening)', () => {
      expect(deriveGenericNewsQuery('Developments in NATO')).toBe('Developments in NATO');
    });

    it('does not conflict with or change the existing "latest X news" pattern', () => {
      expect(deriveGenericNewsQuery('latest semiconductor news')).toBe('semiconductor');
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

describe('makeProviderSafeNewsQuery (query-limit correction, wiring revision)', () => {
  it('leaves a short, already-provider-safe derived query completely unchanged', () => {
    const derived = deriveGenericNewsQuery("What's happening in Ceuta?");
    expect(makeProviderSafeNewsQuery(derived)).toBe(derived);
  });

  it('reduces a long derived query using the existing deriveFallbackNewsQuery() reduction, not a new duplicate system', () => {
    const longMatched =
      "What's happening with the extremely complicated and multifaceted ongoing situation regarding trade tensions between the United States, European Union, and several major Southeast Asian economies over semiconductor export restrictions and technology transfer policies";
    const derived = deriveGenericNewsQuery(longMatched);
    expect(derived.length).toBeGreaterThan(180);

    const result = makeProviderSafeNewsQuery(derived);
    const expectedFallback = deriveFallbackNewsQuery(derived);
    expect(result).toBe(expectedFallback);
    expect(result.length).toBeLessThan(derived.length);
  });

  it('reduces a long derived query from a genuine multi-clause analytical question (no pattern matched upstream, so the derived input is nearly the full sentence)', () => {
    const rwanda =
      'Give me a comprehensive analysis of the current situation in Rwanda. Cover the most important recent political, economic, security, diplomatic, social, infrastructure, technology and regional developments affecting the country. Explain what has actually happened, identify the main actors involved, show where the available sources agree or differ, distinguish well-established facts from uncertain or incomplete information, explain why the developments matter for Rwanda and the wider Great Lakes and East African region, and identify any concrete upcoming decisions, scheduled events, pending negotiations, announced government actions, deadlines, reports, diplomatic processes or other evidence-backed developments that are genuinely worth watching next.';
    const derived = deriveGenericNewsQuery(rwanda);
    const result = makeProviderSafeNewsQuery(derived);
    expect(result.length).toBeLessThan(derived.length);
  });

  it('retains meaningful geography/entity/topic terms through reduction — Rwanda survives, even though the reducer alone cannot bring this specific question under the GNews 200-character threshold (that guarantee is GNewsProvider.search()\u2019s own unconditional backstop, not this function\u2019s job)', () => {
    const rwanda =
      'Give me a comprehensive analysis of the current situation in Rwanda. Cover the most important recent political, economic, security, diplomatic, social, infrastructure, technology and regional developments affecting the country. Explain what has actually happened, identify the main actors involved, show where the available sources agree or differ, distinguish well-established facts from uncertain or incomplete information, explain why the developments matter for Rwanda and the wider Great Lakes and East African region, and identify any concrete upcoming decisions, scheduled events, pending negotiations, announced government actions, deadlines, reports, diplomatic processes or other evidence-backed developments that are genuinely worth watching next.';
    const derived = deriveGenericNewsQuery(rwanda);
    const result = makeProviderSafeNewsQuery(derived);
    expect(result).toContain('Rwanda');
  });

  it('the Ukraine acceptance question retains Russia/Ukraine and its derived query is already short enough to reach the GNews threshold unaided', () => {
    const ukraine =
      'What is the latest situation in the Russia-Ukraine war, what are the most important recent developments, and what should we watch for next?';
    const derived = deriveGenericNewsQuery(ukraine);
    const result = makeProviderSafeNewsQuery(derived);
    expect(result).toMatch(/Russia|Ukraine/);
    expect(result.length).toBeLessThanOrEqual(200);
  });

  it('never returns a result longer than its own input', () => {
    const derived = deriveGenericNewsQuery(
      'What is the impact of new tariffs on global trade for the ongoing multilateral negotiations',
    );
    expect(makeProviderSafeNewsQuery(derived).length).toBeLessThanOrEqual(derived.length);
  });

  it('does NOT itself call deriveGenericNewsQuery — passing an already-short string through unaffected, even one that would look nothing like a fresh derivation', () => {
    const alreadyDerived = 'NATO summit Brussels';
    expect(makeProviderSafeNewsQuery(alreadyDerived)).toBe(alreadyDerived);
  });

  it('is a pure, deterministic function', () => {
    const derived = deriveGenericNewsQuery('What is the impact of new tariffs on global trade');
    expect(makeProviderSafeNewsQuery(derived)).toBe(makeProviderSafeNewsQuery(derived));
  });
});
