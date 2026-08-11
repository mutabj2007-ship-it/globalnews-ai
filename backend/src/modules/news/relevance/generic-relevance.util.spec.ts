import type { NewsArticle } from '@globalnews-ai/shared';
import { scoreGenericRelevance, scoreRelationalRelevance } from './generic-relevance.util';

function article(overrides: Partial<Pick<NewsArticle, 'title' | 'summary' | 'category'>>) {
  return {
    title: 'Untitled',
    summary: '',
    category: 'world' as NewsArticle['category'],
    ...overrides,
  };
}

describe('scoreGenericRelevance (Milestone #36)', () => {
  it('1. cybersecurity: title + summary corroborate -> KEEP', () => {
    const result = scoreGenericRelevance(
      article({
        title: 'Sens. Schiff and Klobuchar unveil new cybersecurity bill',
        summary: 'The bipartisan cybersecurity bill aims to protect infrastructure.',
      }),
      'cybersecurity',
    );
    expect(result.isRelevant).toBe(true);
    expect(result.corroborationCount).toBeGreaterThanOrEqual(2);
  });

  it('2. single-word title-only match -> REJECT', () => {
    const result = scoreGenericRelevance(
      article({ title: 'Dark Energy May Explain the Expansion of the Universe', summary: 'Scientists discuss cosmology.' }),
      'energy',
    );
    expect(result.isRelevant).toBe(false);
    expect(result.corroborationCount).toBe(1);
  });

  it('3. single-word summary-only match -> REJECT', () => {
    const result = scoreGenericRelevance(
      article({ title: 'Afghanistan crisis deepens', summary: 'The climate of instability continues to worsen.' }),
      'climate',
    );
    expect(result.isRelevant).toBe(false);
    expect(result.corroborationCount).toBe(1);
  });

  it('4. single-word summary repeated (summaryMatch + summaryRepeatMatch) -> KEEP', () => {
    const result = scoreGenericRelevance(
      article({
        title: 'Global outlook',
        summary: 'Energy prices are rising. Analysts expect energy costs to remain high through the year.',
      }),
      'energy',
    );
    expect(result.isRelevant).toBe(true);
    expect(result.corroborationCount).toBe(2);
    expect(result.reasons).toContain('summary match');
    expect(result.reasons).toContain('summary repeated');
  });

  it('5. category + summary (e.g. technology) -> KEEP', () => {
    const result = scoreGenericRelevance(
      article({
        title: 'Firms unveil new devices',
        summary: 'The technology sector saw major announcements this week.',
        category: 'technology',
      }),
      'technology',
    );
    expect(result.isRelevant).toBe(true);
    expect(result.reasons).toContain('category alignment');
  });

  it('6. category only -> REJECT', () => {
    const result = scoreGenericRelevance(
      article({ title: 'Weekly roundup', summary: 'A summary of the week in review.', category: 'technology' }),
      'technology',
    );
    expect(result.isRelevant).toBe(false);
    expect(result.corroborationCount).toBe(1);
  });

  it('7. climate incidental single mention -> REJECT', () => {
    const result = scoreGenericRelevance(
      article({
        title: 'Afghanistan crisis deepens as winter approaches',
        summary: 'Aid workers describe the harsh climate as one of many challenges facing displaced families.',
      }),
      'climate',
    );
    expect(result.isRelevant).toBe(false);
  });

  it('8. agriculture title + summary -> KEEP', () => {
    const result = scoreGenericRelevance(
      article({
        title: 'Kerala will push organic farming in a big way: Agriculture Minister',
        summary: 'The state agriculture department announced new subsidies for organic agriculture.',
      }),
      'agriculture',
    );
    expect(result.isRelevant).toBe(true);
  });

  it('9. OpenAI title + summary -> KEEP', () => {
    const result = scoreGenericRelevance(
      article({
        title: 'OpenAI announces new model release',
        summary: 'OpenAI said the new model improves reasoning capabilities.',
      }),
      'OpenAI',
    );
    expect(result.isRelevant).toBe(true);
  });

  it('10. Middle East whole phrase in title -> KEEP', () => {
    const result = scoreGenericRelevance(
      article({
        title: 'Middle East flights: Air Canada, Air France and Scoot extend suspensions',
        summary: 'Several carriers extended flight suspensions.',
      }),
      'Middle East',
    );
    expect(result.isRelevant).toBe(true);
  });

  it('11. 2-3 word whole phrase only in summary -> KEEP', () => {
    const result = scoreGenericRelevance(
      article({
        title: 'Officials meet to discuss policy',
        summary: 'The talks focused heavily on quantum computing research funding.',
      }),
      'quantum computing',
    );
    expect(result.isRelevant).toBe(true);
  });

  it('12. 2-3 word partial-token overlap but no whole phrase -> REJECT', () => {
    const result = scoreGenericRelevance(
      article({
        title: 'Quantum leap in battery research',
        summary: 'Engineers used advanced computing clusters to simulate battery chemistry.',
      }),
      'quantum computing',
    );
    expect(result.isRelevant).toBe(false);
  });

  it('13. 4+ word complete phrase -> KEEP', () => {
    const phrase = 'How is the Iran conflict affecting oil prices';
    const result = scoreGenericRelevance(
      article({
        title: 'Analysis: how is the Iran conflict affecting oil prices this week',
        summary: 'Markets react to tensions.',
      }),
      phrase,
    );
    expect(result.isRelevant).toBe(true);
  });

  it('14. 4+ word partial overlap -> REJECT', () => {
    const phrase = 'How is the Iran conflict affecting oil prices';
    const result = scoreGenericRelevance(
      article({
        title: 'Oil prices rise amid Iran tensions',
        summary: 'Analysts discuss conflict in the region.',
      }),
      phrase,
    );
    expect(result.isRelevant).toBe(false);
  });

  it('15. never admits an empty/invalid search phrase accidentally', () => {
    const result = scoreGenericRelevance(article({ title: 'Anything', summary: 'Anything at all' }), '   ');
    expect(result.isRelevant).toBe(false);
  });

  it('no individual signal alone may admit a single-word result (explicit corroboration-count guard)', () => {
    // Title match alone (the exact case the CTO's correction targeted).
    const titleOnly = scoreGenericRelevance(
      article({ title: 'Dark energy dominates the cosmos', summary: 'No further discussion.' }),
      'energy',
    );
    expect(titleOnly.corroborationCount).toBe(1);
    expect(titleOnly.isRelevant).toBe(false);
  });
});

describe('scoreRelationalRelevance (Milestone #37 base presence / Milestone #38 relational context)', () => {
  it('1. X + Y both in title -> KEEP', () => {
    const result = scoreRelationalRelevance(
      article({ title: 'Oil prices rise sharply as Iran conflict disrupts shipping' }),
      'Iran conflict',
      'oil prices',
    );
    expect(result.isRelevant).toBe(true);
  });

  it('2. (Milestone #38 strengthening) X in title, Y ONLY in a different summary sentence -> now REJECT (was KEEP under M37)', () => {
    const result = scoreRelationalRelevance(
      article({
        title: 'Iran conflict enters critical phase',
        summary: 'Analysts say oil prices could be affected in coming weeks.',
      }),
      'Iran conflict',
      'oil prices',
    );
    // Milestone #38: title alone only has X, and the summary sentence
    // containing Y does not also contain X — neither Stage 2 condition
    // (both-in-title, both-in-one-summary-sentence) is satisfied, even
    // though Stage 1 base presence passes for both concepts.
    expect(result.isRelevant).toBe(false);
    expect(result.reasons).toContain(
      'both concepts present in the article, but never co-located in the title or a single summary sentence (scattered/disconnected mentions)',
    );
  });

  it('3. (Milestone #38 strengthening) X in summary, Y ONLY in title -> now REJECT (was KEEP under M37)', () => {
    const result = scoreRelationalRelevance(
      article({
        title: 'Oil prices climb amid market jitters',
        summary: 'The Iran conflict remains a major factor for traders.',
      }),
      'Iran conflict',
      'oil prices',
    );
    expect(result.isRelevant).toBe(false);
  });

  it('4. both X and Y in the SAME summary sentence -> KEEP', () => {
    const result = scoreRelationalRelevance(
      article({
        title: 'Weekly markets roundup',
        summary: 'The Iran conflict continues to weigh on oil prices this week.',
      }),
      'Iran conflict',
      'oil prices',
    );
    expect(result.isRelevant).toBe(true);
    expect(result.reasons).toContain('both concepts present together in the same summary sentence');
  });

  it('5. X only, Y absent -> REJECT (Stage 1 base presence, unchanged)', () => {
    const result = scoreRelationalRelevance(
      article({ title: 'Iran conflict enters another week' }),
      'Iran conflict',
      'oil prices',
    );
    expect(result.isRelevant).toBe(false);
    expect(result.reasons).toContain('Y absent');
  });

  it('6. Y only, X absent -> REJECT (Stage 1 base presence, unchanged)', () => {
    const result = scoreRelationalRelevance(
      article({ title: 'Oil prices rise after inventory report' }),
      'Iran conflict',
      'oil prices',
    );
    expect(result.isRelevant).toBe(false);
    expect(result.reasons).toContain('X absent');
  });

  it('7. neither present -> REJECT', () => {
    const result = scoreRelationalRelevance(
      article({ title: 'Local election results announced' }),
      'Iran conflict',
      'oil prices',
    );
    expect(result.isRelevant).toBe(false);
  });

  it('8. (Milestone #38 strengthening) single-word concepts (AI + employment), X in title only, Y in a different summary sentence -> now REJECT (was KEEP under M37)', () => {
    const result = scoreRelationalRelevance(
      article({
        title: 'Report: AI to disrupt future job market',
        summary: 'Analysts say artificial intelligence will change how people work, though employment overall may grow.',
      }),
      'AI',
      'employment',
    );
    // Milestone #38: "AI" is present only in the title; "employment" is
    // present only in a summary sentence that does not itself contain
    // "AI" — scattered mentions, no longer sufficient.
    expect(result.isRelevant).toBe(false);
  });

  it('9. climate change + agriculture, both present together in ONE summary sentence -> KEEP', () => {
    const result = scoreRelationalRelevance(
      article({
        title: 'Farmers adapt to shifting weather patterns',
        summary: 'Experts warn that climate change is reshaping how agriculture is practiced worldwide.',
      }),
      'climate change',
      'agriculture',
    );
    expect(result.isRelevant).toBe(true);
  });

  it('10. (Milestone #38 strengthening) "Climate change continues. Separately, agricultural exports rise." shape -> now REJECT (was KEEP under M37)', () => {
    const result = scoreRelationalRelevance(
      article({
        title: 'Iran conflict continues',
        summary: 'Separately, oil prices were unchanged this week.',
      }),
      'Iran conflict',
      'oil prices',
    );
    // Milestone #38 intentionally reverses the M37-era decision for
    // this exact shape: both concepts are present, but in different,
    // unrelated sentences — Stage 2 relational context is not
    // satisfied, so this is now correctly rejected as scattered
    // mentions rather than kept as "joint topical relevance."
    expect(result.isRelevant).toBe(false);
  });

  it('11. empty X cannot accidentally pass', () => {
    const result = scoreRelationalRelevance(
      article({ title: 'Iran conflict and oil prices both mentioned here' }),
      '   ',
      'oil prices',
    );
    expect(result.isRelevant).toBe(false);
  });

  it('11b. empty Y cannot accidentally pass', () => {
    const result = scoreRelationalRelevance(
      article({ title: 'Iran conflict and oil prices both mentioned here' }),
      'Iran conflict',
      '   ',
    );
    expect(result.isRelevant).toBe(false);
  });

  it('does not apply scoreGenericRelevance\'s single-word corroboration-count model to X or Y independently — both-in-title is still sufficient on its own', () => {
    // Both single-word concepts appear together in the title — under
    // scoreGenericRelevance's OWN single-word rule this would need a
    // second corroborating signal (corroborationCount>=2); relational
    // mode does not require that, since both-in-title already
    // satisfies Milestone #38's Stage 2 relational-context requirement
    // directly.
    const result = scoreRelationalRelevance(
      article({ title: 'AI reshapes employment trends, report finds' }),
      'AI',
      'employment',
    );
    expect(result.isRelevant).toBe(true);
  });

  describe('Milestone #38 required cases', () => {
    it('A. X + Y strongly connected in title -> KEEP', () => {
      const result = scoreRelationalRelevance(
        article({ title: 'AI adoption reshapes employment across the industry' }),
        'AI',
        'employment',
      );
      expect(result.isRelevant).toBe(true);
      expect(result.reasons).toContain('both concepts present together in the title');
    });

    it('B. X + Y in same relevant summary sentence -> KEEP', () => {
      const result = scoreRelationalRelevance(
        article({
          title: 'Markets update',
          summary: 'Rising interest rates are beginning to weigh on house prices nationwide.',
        }),
        'interest rates',
        'house prices',
      );
      expect(result.isRelevant).toBe(true);
      expect(result.reasons).toContain('both concepts present together in the same summary sentence');
    });

    it('C. X only -> REJECT', () => {
      const result = scoreRelationalRelevance(
        article({ title: 'Interest rates rise again this quarter' }),
        'interest rates',
        'house prices',
      );
      expect(result.isRelevant).toBe(false);
      expect(result.reasons).toContain('Y absent');
    });

    it('D. Y only -> REJECT', () => {
      const result = scoreRelationalRelevance(
        article({ title: 'House prices climb in most regions' }),
        'interest rates',
        'house prices',
      );
      expect(result.isRelevant).toBe(false);
      expect(result.reasons).toContain('X absent');
    });

    it('E. X and Y in separate unrelated sentences -> REJECT', () => {
      const result = scoreRelationalRelevance(
        article({
          title: 'Weekly roundup',
          summary: 'Interest rates rose again this week. In unrelated news, house prices in the region held steady last month.',
        }),
        'interest rates',
        'house prices',
      );
      expect(result.isRelevant).toBe(false);
    });

    it('F. "Climate change continues. Separately, agricultural exports rise." -> REJECT', () => {
      const result = scoreRelationalRelevance(
        article({
          title: 'Weekly briefing',
          summary: 'Climate change continues. Separately, agricultural exports rise.',
        }),
        'climate change',
        'agriculture',
      );
      // Note: this article's summary never contains the literal word
      // "agriculture" (it says "agricultural exports"), so Stage 1
      // (Y absent) already rejects this case — a real, disclosed
      // lexical limitation (see the function's own doc comment), not
      // something Milestone #38 fixes. The scattered-sentence Stage 2
      // rejection is independently verified by test 10 above, using
      // concepts that DO satisfy Stage 1 exactly.
      expect(result.isRelevant).toBe(false);
    });

    it('G. non-causal connector wording ("amid") satisfying the existing lexical concept contract -> KEEP', () => {
      const result = scoreRelationalRelevance(
        article({
          title: 'Markets react',
          summary: 'Oil prices remain volatile amid Iran conflict uncertainty.',
        }),
        'Iran conflict',
        'oil prices',
      );
      expect(result.isRelevant).toBe(true);
      // Connector detection is informational only — verifying it's
      // present in `reasons`, but the KEEP decision itself came from
      // Stage 2 (same-sentence co-occurrence), not from the connector.
      expect(result.reasons.some((r) => r.includes('amid'))).toBe(true);
    });

    it('connector words are never required for KEEP — same-sentence co-occurrence with NO connector still passes', () => {
      const result = scoreRelationalRelevance(
        article({
          title: 'Update',
          summary: 'Interest rates and house prices both featured prominently in today\'s report.',
        }),
        'interest rates',
        'house prices',
      );
      expect(result.isRelevant).toBe(true);
    });

    it('causal-safety: no returned reason ever asserts or implies causation, only presence/co-location/connector-presence', () => {
      const result = scoreRelationalRelevance(
        article({
          title: 'Oil prices remain volatile amid Iran conflict uncertainty',
        }),
        'Iran conflict',
        'oil prices',
      );
      const causalLanguage = /\bcause[sd]?\b|\bresulted from\b/i;
      expect(result.reasons.some((r) => causalLanguage.test(r))).toBe(false);
    });

    it('known limitation (documented, not fixed): singular/plural mismatch still fails Stage 1', () => {
      const result = scoreRelationalRelevance(
        article({
          title: 'High interest rates are here to stay',
          summary: "But that's only part of the house price story.",
        }),
        'interest rates',
        'house prices',
      );
      // "house price" (singular, as written by the article) does not
      // whole-phrase-match a derived Y of "house prices" (plural) —
      // an accepted, disclosed lexical gap, explicitly not addressed
      // in Milestone #38 per its own non-goals.
      expect(result.isRelevant).toBe(false);
      expect(result.reasons).toContain('Y absent');
    });
  });
});
