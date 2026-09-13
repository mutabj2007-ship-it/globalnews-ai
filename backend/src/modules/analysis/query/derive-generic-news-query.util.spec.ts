import {
  deriveGenericNewsQuery,
  deriveFallbackNewsQuery,
  makeProviderSafeNewsQuery,
  toProviderSafePunctuation,
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

    const result = makeProviderSafeNewsQuery(derived) as string;
    /*
     * PUNCTUATION-SAFETY CORRECTION — the reduction is unchanged, its INPUT is.
     *
     * This assertion's purpose is that makeProviderSafeNewsQuery reuses the
     * existing deriveFallbackNewsQuery() reduction rather than inventing a
     * second one, and that purpose is unchanged. What changed is that the
     * reduction now runs on the PROVIDER-SAFE string: previously this expected
     * "...United States, European Union..." with the commas intact, which is
     * exactly the shape the live GNews endpoint refuses with HTTP 400.
     * Asserting the old value would be pinning the defect.
     */
    const expectedFallback = deriveFallbackNewsQuery(toProviderSafePunctuation(derived));
    expect(result).toBe(expectedFallback);
    expect(result.length).toBeLessThan(derived.length);
  });

  it('reduces a long derived query from a genuine multi-clause analytical question (no pattern matched upstream, so the derived input is nearly the full sentence)', () => {
    const rwanda =
      'Give me a comprehensive analysis of the current situation in Rwanda. Cover the most important recent political, economic, security, diplomatic, social, infrastructure, technology and regional developments affecting the country. Explain what has actually happened, identify the main actors involved, show where the available sources agree or differ, distinguish well-established facts from uncertain or incomplete information, explain why the developments matter for Rwanda and the wider Great Lakes and East African region, and identify any concrete upcoming decisions, scheduled events, pending negotiations, announced government actions, deadlines, reports, diplomatic processes or other evidence-backed developments that are genuinely worth watching next.';
    const derived = deriveGenericNewsQuery(rwanda);
    const result = makeProviderSafeNewsQuery(derived) as string;
    expect(result.length).toBeLessThan(derived.length);
  });

  it('retains meaningful geography/entity/topic terms through reduction — Rwanda survives, even though the reducer alone cannot bring this specific question under the GNews 200-character threshold (that guarantee is GNewsProvider.search()\u2019s own unconditional backstop, not this function\u2019s job)', () => {
    const rwanda =
      'Give me a comprehensive analysis of the current situation in Rwanda. Cover the most important recent political, economic, security, diplomatic, social, infrastructure, technology and regional developments affecting the country. Explain what has actually happened, identify the main actors involved, show where the available sources agree or differ, distinguish well-established facts from uncertain or incomplete information, explain why the developments matter for Rwanda and the wider Great Lakes and East African region, and identify any concrete upcoming decisions, scheduled events, pending negotiations, announced government actions, deadlines, reports, diplomatic processes or other evidence-backed developments that are genuinely worth watching next.';
    const derived = deriveGenericNewsQuery(rwanda);
    const result = makeProviderSafeNewsQuery(derived) as string;
    expect(result).toContain('Rwanda');
  });

  it('the Ukraine acceptance question retains Russia/Ukraine and its derived query is already short enough to reach the GNews threshold unaided', () => {
    const ukraine =
      'What is the latest situation in the Russia-Ukraine war, what are the most important recent developments, and what should we watch for next?';
    const derived = deriveGenericNewsQuery(ukraine);
    const result = makeProviderSafeNewsQuery(derived) as string;
    expect(result).toMatch(/Russia|Ukraine/);
    expect(result.length).toBeLessThanOrEqual(200);
  });

  it('never returns a result longer than its own input', () => {
    const derived = deriveGenericNewsQuery(
      'What is the impact of new tariffs on global trade for the ongoing multilateral negotiations',
    );
    expect((makeProviderSafeNewsQuery(derived) as string).length).toBeLessThanOrEqual(
      derived.length,
    );
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

/**
 * PROVIDER PUNCTUATION SAFETY — the measured HTTP 400.
 *
 * Every case below is bound to evidence the real Windows host produced against
 * the live GNews credential, one variable at a time:
 *
 *     STATUSES 0:200 1:200 2:200 3:200 4:400 5:400 6:200 7:400 8:400
 *     LADDER-VERDICT: COMMA-CONFIRMED-STRONG
 *
 * probe 4 the exact failing Analysis query, two commas      -> 400
 * probe 3 the identical sentence with the commas removed    -> 200
 * probe 5 "political, economic", nineteen characters        -> 400
 * probe 7 "Rwanda?"                                         -> 400
 * probe 0 "Rwanda"                                          -> 200
 * probe 8 the failing query with %20 instead of "+"         -> 400
 *
 * Probe 5 is what makes the finding conclusive rather than merely consistent:
 * ONE comma fails a query far shorter than any length limit, so length and term
 * count are excluded. Probe 8 excludes the space encoding. `max` was excluded
 * separately — the same host returns 200 for both max=10 and max=20.
 */
describe('toProviderSafePunctuation (provider 400 correction)', () => {
  it('removes the commas that the live host proved return HTTP 400', () => {
    const failing =
      'What are the latest political, economic, security and regional developments affecting Rwanda';
    expect(toProviderSafePunctuation(failing)).toBe(
      'What are the latest political economic security and regional developments affecting Rwanda',
    );
  });

  it('leaves a query that never contained special characters completely unchanged', () => {
    expect(toProviderSafePunctuation('Rwanda')).toBe('Rwanda');
    expect(toProviderSafePunctuation('Middle East')).toBe('Middle East');
  });

  it('removes the question mark GNews documents as requiring quotes', () => {
    expect(toProviderSafePunctuation('Rwanda?')).toBe('Rwanda');
  });

  /* THE CTO AMENDMENT. An ASCII-only filter would turn "bezpieczeństwo" into
     "bezpiecze stwo" and delete "Łódź" outright — fixing English retrieval by
     silently destroying Polish. These three are the exact examples required. */
  it('PRESERVES POLISH LETTERS — Polska, bezpieczeństwo', () => {
    expect(toProviderSafePunctuation('Polska, bezpieczeństwo')).toBe('Polska bezpieczeństwo');
  });

  it('PRESERVES POLISH LETTERS — Łódź, gospodarka', () => {
    expect(toProviderSafePunctuation('Łódź, gospodarka')).toBe('Łódź gospodarka');
  });

  it('Rwanda, security -> Rwanda security', () => {
    expect(toProviderSafePunctuation('Rwanda, security')).toBe('Rwanda security');
  });

  it('preserves letters of other scripts and every numeral', () => {
    expect(toProviderSafePunctuation('Côte d’Ivoire économie')).toBe('Côte d Ivoire économie');
    expect(toProviderSafePunctuation('Україна, безпека')).toBe('Україна безпека');
    expect(toProviderSafePunctuation('COVID-19')).toBe('COVID 19');
  });

  it('replaces removed punctuation with a space rather than deleting it, so two terms never fuse', () => {
    /* "Rwanda,security" must not become the single nonsense token
       "Rwandasecurity" — that would be a worse query than the one we started
       with, and it would fail silently by returning nothing. */
    expect(toProviderSafePunctuation('Rwanda,security')).toBe('Rwanda security');
  });

  it('collapses the whitespace it creates, leaving no double or edge spaces', () => {
    expect(toProviderSafePunctuation('  Rwanda ,,  security  ')).toBe('Rwanda security');
  });
});

describe('makeProviderSafeNewsQuery (provider 400 correction)', () => {
  it('sends the failing Rwanda question without its commas', () => {
    const derived = deriveGenericNewsQuery(
      'What are the latest political, economic, security and regional developments affecting Rwanda?',
    );
    const sent = makeProviderSafeNewsQuery(derived) as string;
    expect(sent).toBe(
      'What are the latest political economic security and regional developments affecting Rwanda',
    );
    expect(sent).not.toMatch(/[^\p{L}\p{N}\s]/u);
  });

  it('the bounded fallback query is provider-safe too, not just the primary', () => {
    const derived = deriveGenericNewsQuery(
      'What are the latest political, economic, security and regional developments affecting Rwanda?',
    );
    const fallback = deriveFallbackNewsQuery(derived);
    expect(fallback).toBeDefined();
    const sent = makeProviderSafeNewsQuery(fallback as string) as string;
    expect(sent).not.toMatch(/[^\p{L}\p{N}\s]/u);
    expect(sent).toContain('Rwanda');
  });

  /**
   * CHANGED ASSERTION — FLAGGED, NOT BURIED.
   *
   * This test previously read "never emits an empty q, even for a query made
   * only of symbols" and asserted a non-empty return, on the reasoning that an
   * empty `q` is itself a documented 400. That reasoning was half right: an
   * empty q IS a 400, but the value the old code returned instead was the
   * ORIGINAL punctuation — which is the malformed-query-syntax 400 this whole
   * correction exists to prevent. Both branches of the old choice were a 400;
   * the test pinned one of them.
   *
   * The CTO amendment closes it: when normalization leaves no Unicode letter or
   * numeral, the honest answer is that there is no retrievable query, and no
   * request is made at all. The assertion below is the new contract.
   */
  it('REGRESSION 14 — reports "no retrievable query" instead of restoring unsendable punctuation', () => {
    expect(makeProviderSafeNewsQuery('!!!')).toBeUndefined();
    expect(makeProviderSafeNewsQuery('??? ... ---')).toBeUndefined();
    expect(makeProviderSafeNewsQuery('   ')).toBeUndefined();
  });

  it('REGRESSION 14 — and never invents a substitute term to search for', () => {
    const sent = makeProviderSafeNewsQuery('@@@ ###');
    expect(sent).toBeUndefined();
    // Named explicitly so a future "helpful" default cannot slip in silently.
    expect(sent).not.toBe('news');
    expect(sent).not.toBe('world');
  });

  it('a single real word survives punctuation stripping and is still sent', () => {
    expect(makeProviderSafeNewsQuery('"Rwanda"')).toBe('Rwanda');
    expect(makeProviderSafeNewsQuery('2026!')).toBe('2026');
  });

  it('keeps Polish retrieval intact end to end', () => {
    const sent = makeProviderSafeNewsQuery('Polska, bezpieczeństwo, gospodarka') as string;
    expect(sent).toBe('Polska bezpieczeństwo gospodarka');
    expect(sent).toContain('bezpieczeństwo');
  });

  /**
   * REGRESSION 11 and 12 — carried forward verbatim from the approved
   * correction's own acceptance list, restated here so the final closure
   * cannot pass while quietly regressing the correction it builds on.
   */
  it('REGRESSION 11 — the Rwanda comma query still succeeds', () => {
    const derived = deriveGenericNewsQuery(
      'What are the latest political, economic, security and regional developments affecting Rwanda?',
    );
    const sent = makeProviderSafeNewsQuery(derived) as string;
    expect(sent).toBeDefined();
    expect(sent).toContain('Rwanda');
    expect(sent).not.toMatch(/[^\p{L}\p{N}\s]/u);
  });

  it('REGRESSION 12 — Polish Unicode survives: Łódź, bezpieczeństwo, Polska', () => {
    expect(makeProviderSafeNewsQuery('Łódź, gospodarka')).toBe('Łódź gospodarka');
    expect(makeProviderSafeNewsQuery('Polska, bezpieczeństwo')).toBe('Polska bezpieczeństwo');

    const all = makeProviderSafeNewsQuery('Łódź; Polska — bezpieczeństwo!') as string;
    expect(all).toContain('Łódź');
    expect(all).toContain('Polska');
    expect(all).toContain('bezpieczeństwo');
  });

  it('REGRESSION 12 — an ASCII-only sanitizer would have destroyed these, so prove the class is Unicode-aware', () => {
    // [A-Za-z0-9 ] would turn "bezpieczeństwo" into "bezpiecze stwo" and delete
    // "Łódź" entirely. The explicit CTO prohibition, pinned as a test.
    const sent = makeProviderSafeNewsQuery('Łódź, bezpieczeństwo') as string;
    expect(sent).not.toContain('bezpiecze stwo');
    expect(sent.startsWith('Ł')).toBe(true);
  });
});
