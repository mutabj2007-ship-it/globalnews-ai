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
      article({
        title: 'Dark Energy May Explain the Expansion of the Universe',
        summary: 'Scientists discuss cosmology.',
      }),
      'energy',
    );
    expect(result.isRelevant).toBe(false);
    expect(result.corroborationCount).toBe(1);
  });

  it('3. single-word summary-only match -> REJECT', () => {
    const result = scoreGenericRelevance(
      article({
        title: 'Afghanistan crisis deepens',
        summary: 'The climate of instability continues to worsen.',
      }),
      'climate',
    );
    expect(result.isRelevant).toBe(false);
    expect(result.corroborationCount).toBe(1);
  });

  it('4. single-word summary repeated (summaryMatch + summaryRepeatMatch) -> KEEP', () => {
    const result = scoreGenericRelevance(
      article({
        title: 'Global outlook',
        summary:
          'Energy prices are rising. Analysts expect energy costs to remain high through the year.',
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
      article({
        title: 'Weekly roundup',
        summary: 'A summary of the week in review.',
        category: 'technology',
      }),
      'technology',
    );
    expect(result.isRelevant).toBe(false);
    expect(result.corroborationCount).toBe(1);
  });

  it('7. climate incidental single mention -> REJECT', () => {
    const result = scoreGenericRelevance(
      article({
        title: 'Afghanistan crisis deepens as winter approaches',
        summary:
          'Aid workers describe the harsh climate as one of many challenges facing displaced families.',
      }),
      'climate',
    );
    expect(result.isRelevant).toBe(false);
  });

  it('8. agriculture title + summary -> KEEP', () => {
    const result = scoreGenericRelevance(
      article({
        title: 'Kerala will push organic farming in a big way: Agriculture Minister',
        summary:
          'The state agriculture department announced new subsidies for organic agriculture.',
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
    const result = scoreGenericRelevance(
      article({ title: 'Anything', summary: 'Anything at all' }),
      '   ',
    );
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

  describe('Milestone #46 — generic recall correction (multi-word inflection reuse)', () => {
    it('MULTI-WORD KEEP: "US expands semiconductor exports controls to allies" (exact phrase, unaffected positive control)', () => {
      const result = scoreGenericRelevance(
        article({
          title: 'US expands semiconductor exports controls to allies',
          summary: 'The policy broadens restrictions beyond direct rivals.',
        }),
        'semiconductor exports',
      );
      expect(result.isRelevant).toBe(true);
      expect(result.reasons).toContain('whole-phrase match');
    });

    it('MULTI-WORD KEEP (new, via M39 reuse): a generic query matching the "...e"/"...es" inflection pattern now passes, e.g. "house price" article for query "house prices"', () => {
      const result = scoreGenericRelevance(
        article({
          title: 'Rising interest rates weigh on house price trends nationwide',
          summary: 'Analysts expect continued softening through the year.',
        }),
        'house prices',
      );
      expect(result.isRelevant).toBe(true);
      expect(result.reasons).toContain('whole-phrase match');
    });

    it('SUPERSEDED BY MILESTONE #46 PHASE 2: "US tightens semiconductor export controls" for query "semiconductor exports" was REJECTED after Phase 1 (this exact test originally documented that as a known limitation) — Phase 2\'s bounded regular "+s" plural rule now correctly accepts it. Kept here, updated, as a historical marker of the Phase 1 -> Phase 2 transition; see the "Milestone #46 Phase 2" describe block below for the primary test of this behavior.', () => {
      const result = scoreGenericRelevance(
        article({
          title: 'US tightens semiconductor export controls',
          summary: 'The move targets advanced chip manufacturing equipment.',
        }),
        'semiconductor exports',
      );
      expect(result.isRelevant).toBe(true);
    });

    it('MULTI-WORD REJECT (unchanged, out of scope per M46 semiconductor boundary): genuine paraphrase is still not accepted', () => {
      const result = scoreGenericRelevance(
        article({
          title: 'New chip export restrictions target advanced semiconductors',
          summary: "The rules aim to slow rival nations' technological progress.",
        }),
        'semiconductor exports',
      );
      expect(result.isRelevant).toBe(false);
    });

    it('MULTI-WORD REJECT (unchanged, out of scope): non-adjacent token insertion is still not accepted', () => {
      const result = scoreGenericRelevance(
        article({
          title: 'Washington expands controls on semiconductor technology exports',
          summary: 'The expanded rules cover a wider range of chip-related goods.',
        }),
        'semiconductor exports',
      );
      expect(result.isRelevant).toBe(false);
    });

    it("ORGANIZATION KEEP tests — single-word gate is UNCHANGED by this correction (still requires corroboration >= 2); these remain REJECTED, exactly as before, per the M46 investigation's Part B finding (no safe correction implemented)", () => {
      const cases: Array<{ title: string; summary: string; query: string }> = [
        {
          title: 'NATO defense ministers meet to discuss regional security',
          summary: 'Officials convened to review current commitments.',
          query: 'NATO',
        },
        {
          title: 'UN Security Council meets over regional crisis',
          summary: 'World leaders gathered Tuesday to address the situation.',
          query: 'UN',
        },
        {
          title: 'WHO declares new health emergency',
          summary: 'The declaration triggers additional funding.',
          query: 'WHO',
        },
        {
          title: 'IMF approves new loan package',
          summary: 'The funding comes with conditions on reform.',
          query: 'IMF',
        },
        {
          title: 'OPEC agrees to extend production cuts',
          summary: 'The decision aims to stabilize prices.',
          query: 'OPEC',
        },
        {
          title: 'EU proposes new regulations on AI',
          summary: 'The draft rules would apply across the bloc.',
          query: 'EU',
        },
      ];
      for (const { title, summary, query } of cases) {
        const result = scoreGenericRelevance(article({ title, summary }), query);
        // Documenting the UNCHANGED (not newly broken, not newly fixed)
        // single-word behavior — see the M46 correction report for why
        // no safe general fix was implemented for this path.
        expect(result.isRelevant).toBe(false);
        expect(result.corroborationCount).toBe(1);
      }
    });

    it('PRECISION REGRESSION: ambiguous "energy" with only a weak single-title signal remains correctly rejected', () => {
      const result = scoreGenericRelevance(
        article({ title: 'Dark energy dominates the cosmos', summary: 'No further discussion.' }),
        'energy',
      );
      expect(result.isRelevant).toBe(false);
    });

    it('PRECISION REGRESSION: "UN" does not match mid-word occurrences ("undersea", "unusual")', () => {
      const result = scoreGenericRelevance(
        article({
          title: 'Scientists study unusual undersea volcanic activity',
          summary: 'The unprecedented discovery surprised researchers.',
        }),
        'UN',
      );
      expect(result.isRelevant).toBe(false);
      expect(result.corroborationCount).toBe(0);
    });

    it('PRECISION REGRESSION: "EU" does not match mid-word occurrences ("European", "eureka")', () => {
      const result = scoreGenericRelevance(
        article({
          title: 'European museum unveils new sculpture exhibit',
          summary: 'The eureka moment came after years of restoration work.',
        }),
        'EU',
      );
      expect(result.isRelevant).toBe(false);
      expect(result.corroborationCount).toBe(0);
    });

    it('Part B/C investigation, confirmed: title+summary co-occurrence (each mentioning the term once) already passes via the EXISTING, unmodified corroboration model — no code change needed for this case', () => {
      const result = scoreGenericRelevance(
        article({
          title: 'UN Security Council meets over regional crisis',
          summary: 'UN officials confirmed the session would continue into Wednesday.',
        }),
        'UN',
      );
      expect(result.isRelevant).toBe(true);
      expect(result.reasons).toContain('title match');
      expect(result.reasons).toContain('summary match');
    });

    it('Part B/C investigation, confirmed: the genuinely hard title-ONLY case remains rejected — no safe non-double-counting signal exists in currently-validated article structure (see M46 Phase 2 report)', () => {
      const result = scoreGenericRelevance(
        article({
          title: 'NATO defense ministers meet to discuss regional security',
          summary: 'Officials convened to review current commitments.',
        }),
        'NATO',
      );
      expect(result.isRelevant).toBe(false);
      expect(result.corroborationCount).toBe(1);
    });
  });

  describe('Milestone #46 (final safety correction) — GENERIC-ONLY regular "+s" plural equivalence, M39 relational matcher fully restored', () => {
    it('TARGET: "US tightens semiconductor export controls" KEEPs for query "semiconductor exports"', () => {
      const result = scoreGenericRelevance(
        article({
          title: 'US tightens semiconductor export controls',
          summary: 'The move targets advanced chip manufacturing equipment.',
        }),
        'semiconductor exports',
      );
      expect(result.isRelevant).toBe(true);
    });

    it('TARGET: market/markets', () => {
      const result = scoreGenericRelevance(
        article({ title: 'Emerging markets rally on renewed investor confidence' }),
        'emerging market',
      );
      expect(result.isRelevant).toBe(true);
    });

    it('TARGET: tariff/tariffs', () => {
      const result = scoreGenericRelevance(
        article({ title: 'New import tariffs take effect on steel goods' }),
        'import tariff',
      );
      expect(result.isRelevant).toBe(true);
    });

    it('existing M39 house price/prices still KEEPs (via the restored, unmodified generatePhraseVariants)', () => {
      const result = scoreGenericRelevance(
        article({ title: 'Rising interest rates weigh on house price trends nationwide' }),
        'house prices',
      );
      expect(result.isRelevant).toBe(true);
    });

    it('exact-phrase positive control remains unaffected', () => {
      const result = scoreGenericRelevance(
        article({ title: 'US expands semiconductor exports controls to allies' }),
        'semiconductor exports',
      );
      expect(result.isRelevant).toBe(true);
    });

    it('WITHDRAWN TARGET, now correctly EXCLUDED: job/jobs (stem "job" = 3 characters, below the generic-only 5-character floor) — accepted, intentional limitation, not a bug', () => {
      const result = scoreGenericRelevance(
        article({ title: 'Manufacturing jobs report shows modest gains this quarter' }),
        'manufacturing job',
      );
      expect(result.isRelevant).toBe(false);
    });

    it('ACCEPTED EXCLUSION: term/terms (stem "term" = 4 characters, below the 5-character floor)', () => {
      const result = scoreGenericRelevance(
        article({ title: 'Contract terms remain under negotiation this week' }),
        'contract term',
      );
      expect(result.isRelevant).toBe(false);
    });

    it('SAFETY: means/mean remains NON-EQUIVALENT in the generic path too (stem "mean" = 4 characters, below the 5-character floor)', () => {
      const result = scoreGenericRelevance(
        article({ title: 'What higher rates mean for the broader economy' }),
        'higher means',
      );
      expect(result.isRelevant).toBe(false);
    });

    it('ADVERSARIAL SAFETY (generic path): news/new', () => {
      const result = scoreGenericRelevance(
        article({ title: 'Global markets await interest rate decision new update' }),
        'markets news',
      );
      expect(result.isRelevant).toBe(false);
    });

    it('ADVERSARIAL SAFETY (generic path): gas/ga', () => {
      const result = scoreGenericRelevance(
        article({ title: 'A ga symbol appeared during the broadcast today' }),
        'broadcast gas',
      );
      expect(result.isRelevant).toBe(false);
    });

    it('ADVERSARIAL SAFETY (generic path): analysis/analysi', () => {
      const result = scoreGenericRelevance(
        article({ title: 'The analysi tool malfunctioned during live testing' }),
        'live analysis',
      );
      expect(result.isRelevant).toBe(false);
    });

    it('ADVERSARIAL SAFETY (generic path): status/statu', () => {
      const result = scoreGenericRelevance(
        article({ title: 'A statu was erected downtown this week' }),
        'downtown status',
      );
      expect(result.isRelevant).toBe(false);
    });

    it('ADVERSARIAL SAFETY (generic path): crisis/crisi', () => {
      const result = scoreGenericRelevance(
        article({ title: 'The crisi center opened its doors today' }),
        'today crisis',
      );
      expect(result.isRelevant).toBe(false);
    });

    it('ADVERSARIAL SAFETY (generic path): business/busines', () => {
      const result = scoreGenericRelevance(
        article({ title: 'The busines district expanded significantly' }),
        'significantly business',
      );
      expect(result.isRelevant).toBe(false);
    });

    it('ADVERSARIAL SAFETY (generic path): US/U', () => {
      const result = scoreGenericRelevance(
        article({ title: 'A single U flag was visible today' }),
        'today US',
      );
      expect(result.isRelevant).toBe(false);
    });
  });

  describe('Milestone #46 relational firewall — M39 fully restored, byte-for-byte behavior', () => {
    it('RESTORED: means/mean is NON-EQUIVALENT again in the relational path (this is the exact case the final safety correction exists to protect)', () => {
      const result = scoreRelationalRelevance(
        article({
          title: 'What interest rates mean for markets this year',
          summary: 'Analysts weigh in on the outlook.',
        }),
        'markets',
        'means',
      );
      expect(result.isRelevant).toBe(false);
    });

    it('full relational adversarial set remains blocked: news/new', () => {
      expect(
        scoreRelationalRelevance(
          article({
            title: 'Interest rates: what is new this quarter',
            summary: 'Markets react to the announcement.',
          }),
          'markets',
          'news',
        ).isRelevant,
      ).toBe(false);
    });

    it('full relational adversarial set remains blocked: gas/ga', () => {
      expect(
        scoreRelationalRelevance(
          article({
            title: 'Markets react to policy announcement',
            summary: 'A ga symbol appeared on the display panel.',
          }),
          'markets',
          'gas',
        ).isRelevant,
      ).toBe(false);
    });

    it('full relational adversarial set remains blocked: analysis/analysi, status/statu, crisis/crisi, business/busines, US/U', () => {
      expect(
        scoreRelationalRelevance(
          article({
            title: 'Markets react to policy announcement',
            summary: 'The analysi tool malfunctioned during testing.',
          }),
          'markets',
          'analysis',
        ).isRelevant,
      ).toBe(false);
      expect(
        scoreRelationalRelevance(
          article({
            title: 'Markets react to policy announcement',
            summary: 'A statu was erected in the town square.',
          }),
          'markets',
          'status',
        ).isRelevant,
      ).toBe(false);
      expect(
        scoreRelationalRelevance(
          article({
            title: 'Markets react to policy announcement',
            summary: 'The crisi center opened downtown.',
          }),
          'markets',
          'crisis',
        ).isRelevant,
      ).toBe(false);
      expect(
        scoreRelationalRelevance(
          article({
            title: 'Markets react to policy announcement',
            summary: 'The busines district expanded.',
          }),
          'markets',
          'business',
        ).isRelevant,
      ).toBe(false);
      expect(
        scoreRelationalRelevance(
          article({
            title: 'Markets react to policy announcement',
            summary: 'A single U flag was visible.',
          }),
          'markets',
          'US',
        ).isRelevant,
      ).toBe(false);
    });

    it('original M39 relational KEEP cases remain unchanged: house price/prices', () => {
      expect(
        scoreRelationalRelevance(
          article({ title: 'Interest rates and house price trends both covered' }),
          'interest rates',
          'house prices',
        ).isRelevant,
      ).toBe(true);
    });

    it('M37/M38 Iran conflict / oil prices relational regression unaffected', () => {
      expect(
        scoreRelationalRelevance(
          article({ title: 'Oil prices rise sharply as Iran conflict disrupts shipping' }),
          'Iran conflict',
          'oil prices',
        ).isRelevant,
      ).toBe(true);
    });

    it('"job losses" still does NOT match "jobs were lost" (unaffected by this correction)', () => {
      expect(
        scoreRelationalRelevance(
          article({ title: 'Report: jobs were lost amid rising interest rates' }),
          'interest rates',
          'job losses',
        ).isRelevant,
      ).toBe(false);
    });

    it('"gas" exact match still KEEPs (no variant generated, but exact matching is untouched)', () => {
      expect(
        scoreRelationalRelevance(
          article({ title: 'Gas prices and interest rates both rose sharply' }),
          'interest rates',
          'gas',
        ).isRelevant,
      ).toBe(true);
    });
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
        summary:
          'Analysts say artificial intelligence will change how people work, though employment overall may grow.',
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
        summary:
          'Experts warn that climate change is reshaping how agriculture is practiced worldwide.',
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

  it("does not apply scoreGenericRelevance's single-word corroboration-count model to X or Y independently — both-in-title is still sufficient on its own", () => {
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
      expect(result.reasons).toContain(
        'both concepts present together in the same summary sentence',
      );
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
          summary:
            'Interest rates rose again this week. In unrelated news, house prices in the region held steady last month.',
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
          summary: "Interest rates and house prices both featured prominently in today's report.",
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

    it('(Milestone #39 changes the REASON, not the outcome) singular/plural mismatch across DIFFERENT sentences: still REJECT, but now via Stage 2 scattered-context rather than Stage 1 absence', () => {
      const result = scoreRelationalRelevance(
        article({
          title: 'High interest rates are here to stay',
          summary: "But that's only part of the house price story.",
        }),
        'interest rates',
        'house prices',
      );
      // Milestone #39: "house price" (singular) now DOES satisfy
      // presence for a derived Y of "house prices" via the approved
      // +s inflection variant — Stage 1 passes for both concepts. But
      // Stage 2 (Milestone #38, unchanged) still requires both in the
      // SAME title or SAME summary sentence: "interest rates" is only
      // in the title, "house price" is only in a summary sentence that
      // doesn't also contain "interest rate(s)" — so this still
      // correctly rejects, now for the scattered-context reason.
      expect(result.isRelevant).toBe(false);
      expect(result.reasons).toContain(
        'both concepts present in the article, but never co-located in the title or a single summary sentence (scattered/disconnected mentions)',
      );
    });
  });

  describe('bounded relational inflection equivalence (Milestone #39)', () => {
    it('A. query "house prices" matches article "house price" -> MATCH/KEEP', () => {
      const result = scoreRelationalRelevance(
        article({ title: 'Interest rates and house price trends both covered in this report' }),
        'interest rates',
        'house prices',
      );
      expect(result.isRelevant).toBe(true);
    });

    it('B. query "house price" matches article "house prices" -> MATCH/KEEP', () => {
      const result = scoreRelationalRelevance(
        article({ title: 'Interest rates and house prices trends both covered in this report' }),
        'interest rates',
        'house price',
      );
      expect(result.isRelevant).toBe(true);
    });

    it('C. "interest rates" matches "interest rate" -> MATCH/KEEP', () => {
      const result = scoreRelationalRelevance(
        article({ title: 'Interest rate increases affected house prices this quarter' }),
        'interest rates',
        'house prices',
      );
      expect(result.isRelevant).toBe(true);
    });

    it('D. "climate changes" matches "climate change" -> MATCH/KEEP', () => {
      const result = scoreRelationalRelevance(
        article({ title: 'Climate change is affecting agriculture nationwide' }),
        'climate changes',
        'agriculture',
      );
      expect(result.isRelevant).toBe(true);
    });

    it('E. exact phrase still matches normally (no inflection needed)', () => {
      const result = scoreRelationalRelevance(
        article({ title: 'Oil prices rise sharply as Iran conflict disrupts shipping' }),
        'Iran conflict',
        'oil prices',
      );
      expect(result.isRelevant).toBe(true);
    });

    it('F. "house" does NOT match "warehouse" (whole-word boundary protected)', () => {
      const result = scoreRelationalRelevance(
        article({ title: 'Warehouse prices and interest rates both rose this year' }),
        'interest rates',
        'house',
      );
      expect(result.isRelevant).toBe(false);
      expect(result.reasons).toContain('Y absent');
    });

    it('G. "AI" does NOT match "chair"', () => {
      const result = scoreRelationalRelevance(
        article({ title: 'A new chair and interest rates were both discussed' }),
        'interest rates',
        'AI',
      );
      expect(result.isRelevant).toBe(false);
      expect(result.reasons).toContain('Y absent');
    });

    it('H. "employment" does NOT match "unemployment"', () => {
      const result = scoreRelationalRelevance(
        article({ title: 'Unemployment and interest rates both rose this quarter' }),
        'interest rates',
        'employment',
      );
      expect(result.isRelevant).toBe(false);
      expect(result.reasons).toContain('Y absent');
    });

    it('I. "oil prices" does NOT match "oil-pricing"', () => {
      const result = scoreRelationalRelevance(
        article({ title: 'Oil-pricing pressure increased amid Iran conflict tensions' }),
        'Iran conflict',
        'oil prices',
      );
      expect(result.isRelevant).toBe(false);
      expect(result.reasons).toContain('Y absent');
    });

    it('J. "employment" does NOT match "jobs" (semantic equivalence deliberately unsupported)', () => {
      const result = scoreRelationalRelevance(
        article({ title: 'AI is changing jobs across the economy' }),
        'AI',
        'employment',
      );
      expect(result.isRelevant).toBe(false);
      expect(result.reasons).toContain('Y absent');
    });

    it('K. "agriculture" does NOT match "farm output" (semantic equivalence deliberately unsupported)', () => {
      const result = scoreRelationalRelevance(
        article({ title: 'Climate change is reducing farm output nationwide' }),
        'climate change',
        'agriculture',
      );
      expect(result.isRelevant).toBe(false);
      expect(result.reasons).toContain('Y absent');
    });

    it('L. "Iran conflict" does NOT match "Middle East conflict" (entity equivalence deliberately unsupported)', () => {
      const result = scoreRelationalRelevance(
        article({ title: 'Middle East conflict lifts oil prices' }),
        'Iran conflict',
        'oil prices',
      );
      expect(result.isRelevant).toBe(false);
      expect(result.reasons).toContain('X absent');
    });

    it('M. irregular plural remains unsupported: "person" vs "people" -> NO MATCH', () => {
      const result = scoreRelationalRelevance(
        article({ title: 'People and interest rates were both discussed at the summit' }),
        'interest rates',
        'person',
      );
      expect(result.isRelevant).toBe(false);
      expect(result.reasons).toContain('Y absent');
    });

    it('N. M38 local-context rejection remains: X and Y in different sentences (with inflection) -> REJECT', () => {
      const result = scoreRelationalRelevance(
        article({
          summary:
            'Interest rate increases continued. Separately, the house price market improved.',
        }),
        'interest rates',
        'house prices',
      );
      expect(result.isRelevant).toBe(false);
      expect(result.reasons).toContain(
        'both concepts present in the article, but never co-located in the title or a single summary sentence (scattered/disconnected mentions)',
      );
    });

    it('O. same-sentence inflectional equivalents -> KEEP', () => {
      const result = scoreRelationalRelevance(
        article({
          title: 'Markets update',
          summary:
            'Rising interest rate pressure is beginning to weigh on house prices nationwide.',
        }),
        'interest rates',
        'house price',
      );
      expect(result.isRelevant).toBe(true);
      expect(result.reasons).toContain(
        'both concepts present together in the same summary sentence',
      );
    });

    it('P. same-title inflectional equivalents -> KEEP', () => {
      const result = scoreRelationalRelevance(
        article({ title: 'Rising interest rate hits house prices across the country' }),
        'interest rates',
        'house price',
      );
      expect(result.isRelevant).toBe(true);
      expect(result.reasons).toContain('both concepts present together in the title');
    });

    it('Q. connector words remain informational only — same-sentence match with no connector still KEEPs', () => {
      const result = scoreRelationalRelevance(
        article({
          title: 'Update',
          summary: "Interest rate and house prices both featured prominently in today's report.",
        }),
        'interest rates',
        'house price',
      );
      expect(result.isRelevant).toBe(true);
    });

    it('R. no causal claim introduced in reasons, even with an inflectional match', () => {
      const result = scoreRelationalRelevance(
        article({ title: 'Rising interest rate hits house prices across the country' }),
        'interest rates',
        'house price',
      );
      const causalLanguage = /\bcause[sd]?\b|\bresulted from\b/i;
      expect(result.reasons.some((r) => causalLanguage.test(r))).toBe(false);
    });

    it('"job losses" does NOT automatically match "jobs were lost" (syntactic rewrite, not simple inflection)', () => {
      const result = scoreRelationalRelevance(
        article({ title: 'Report: jobs were lost amid rising interest rates' }),
        'interest rates',
        'job losses',
      );
      expect(result.isRelevant).toBe(false);
      expect(result.reasons).toContain('Y absent');
    });

    it('"gas" (does not end in "e" or "es") generates no variant at all, but exact match still works', () => {
      // Under the narrowed "...e"/"...es"-only rule, "gas" doesn't end
      // in "e" (no forward variant) and doesn't end in "es" specifically
      // — it ends in "as" — (no backward variant either), so no
      // stripped/appended candidate is generated for it at all. Exact
      // matching (the phrase itself, always included) still works.
      const result = scoreRelationalRelevance(
        article({ title: 'Gas prices and interest rates both rose sharply' }),
        'interest rates',
        'gas',
      );
      expect(result.isRelevant).toBe(true);
    });

    describe('Milestone #39 safety correction — false-positive regression suite', () => {
      it('SAFETY: query concept "news" does NOT match article containing only "new" (both are real, distinct, unrelated words)', () => {
        // This is the exact false-positive the CTO's safety review
        // identified in an earlier, broader "-s" stripping rule: "news"
        // stripped of its trailing "s" produces "new", a real common
        // word. The narrowed "...es"-only backward rule structurally
        // prevents this — "news" ends in "ws", not "es", so no
        // candidate is ever generated for it at all.
        const result = scoreRelationalRelevance(
          article({ title: 'Interest rates: what is new this quarter' }),
          'interest rates',
          'news',
        );
        expect(result.isRelevant).toBe(false);
        expect(result.reasons).toContain('Y absent');
      });

      it('SAFETY: query concept "means" does NOT match article containing only "mean"', () => {
        const result = scoreRelationalRelevance(
          article({ title: 'What interest rates mean for markets' }),
          'interest rates',
          'means',
        );
        expect(result.isRelevant).toBe(false);
        expect(result.reasons).toContain('Y absent');
      });

      it('SAFETY: "new" as a query concept does NOT match article containing only "news" (reverse direction)', () => {
        const result = scoreRelationalRelevance(
          article({ title: 'Interest rates news roundup for this quarter' }),
          'interest rates',
          'new',
        );
        expect(result.isRelevant).toBe(false);
        expect(result.reasons).toContain('Y absent');
      });

      it('SAFETY: query concept "business" never generates a stripped "busines" candidate', () => {
        const result = scoreRelationalRelevance(
          article({
            title: 'Interest rates rise this week',
            summary: 'No mention anywhere in this text of that other word at all.',
          }),
          'interest rates',
          'business',
        );
        expect(result.isRelevant).toBe(false);
        expect(result.reasons).toContain('Y absent');
      });

      it('SAFETY: query concept "analysis" never generates a stripped "analysi" candidate', () => {
        const result = scoreRelationalRelevance(
          article({ title: 'Interest rates rise again this week' }),
          'interest rates',
          'analysis',
        );
        expect(result.isRelevant).toBe(false);
        expect(result.reasons).toContain('Y absent');
      });

      it('re-confirms the required positive cases still pass under the narrowed rule: price/prices, rate/rates, change/changes', () => {
        expect(
          scoreRelationalRelevance(
            article({ title: 'Interest rates and house price trends both covered' }),
            'interest rates',
            'house prices',
          ).isRelevant,
        ).toBe(true);
        expect(
          scoreRelationalRelevance(
            article({ title: 'Interest rate increases affected house prices this quarter' }),
            'interest rates',
            'house prices',
          ).isRelevant,
        ).toBe(true);
        expect(
          scoreRelationalRelevance(
            article({ title: 'Climate change is affecting agriculture nationwide' }),
            'climate changes',
            'agriculture',
          ).isRelevant,
        ).toBe(true);
      });
    });
  });
});
