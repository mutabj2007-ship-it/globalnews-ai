import { classifyQueryIntent, type QueryIntent } from './query-intent.util';

/**
 * G-ALPHA-2 STAGE 2 ACCEPTANCE — THE DETERMINISTIC QUERY-CLASS CORPUS.
 *
 * BUILT AROUND CLASSES, NOT PHRASES — which is the point, and is why most of
 * this file is generated rather than typed. Each class is expressed as a set of
 * SHAPES crossed with a set of SUBJECTS drawn from different continents and
 * naming conventions. A classifier that had memorised the reported sentences
 * would pass a handful of these and fail the rest; only one that reads shape
 * passes the cross-product.
 *
 * The countries below are chosen deliberately: single-word and multi-word
 * names, a name with a definite article, and — in the ambiguity section — the
 * names that are also ordinary English words.
 */

const SUBJECT_PAIRS: ReadonlyArray<readonly [string, string, string, string]> = [
  // [first name, second name, expected first, expected second]
  ['Russia', 'Ukraine', 'Russia', 'Ukraine'],
  ['Rwanda', 'Kenya', 'Rwanda', 'Kenya'],
  ['Poland', 'Germany', 'Poland', 'Germany'],
  ['Nigeria', 'Ghana', 'Nigeria', 'Ghana'],
  ['Japan', 'South Korea', 'Japan', 'South Korea'],
  ['Brazil', 'Argentina', 'Brazil', 'Argentina'],
  ['India', 'Pakistan', 'India', 'Pakistan'],
  ['Spain', 'Portugal', 'Spain', 'Portugal'],
];

function names(query: string): string[] {
  return classifyQueryIntent(query).sides.map((side) => side.name);
}

function intentOf(query: string): QueryIntent {
  return classifyQueryIntent(query).intent;
}

/* ------------------------------------------------------------------ *
 * CLASS: MULTI_ENTITY — two or more countries, no comparison asked.
 * ------------------------------------------------------------------ */

describe('CLASS multi-entity — a question naming two countries is answered about both', () => {
  const SHAPES: ReadonlyArray<(a: string, b: string) => string> = [
    (a, b) => `What is happening between ${a} and ${b}?`,
    (a, b) => `What is going on between ${a} and ${b}`,
    (a, b) => `Latest developments between ${a} and ${b}`,
    (a, b) => `Tensions between ${a} and ${b} this week`,
  ];

  for (const shape of SHAPES) {
    it.each(SUBJECT_PAIRS)(
      `"${shape('X', 'Y')}" resolves both sides — %s / %s`,
      (a, b, expectedA, expectedB) => {
        const query = shape(a, b);

        expect(intentOf(query)).toBe('MULTI_ENTITY');
        expect(names(query)).toEqual([expectedA, expectedB]);
      },
    );
  }

  it('order follows the question, never the country table', () => {
    expect(names('What is happening between Ukraine and Russia?')).toEqual(['Ukraine', 'Russia']);
    expect(names('What is happening between Russia and Ukraine?')).toEqual(['Russia', 'Ukraine']);
  });

  it('ALPHA SEARCH REPAIR — the reported East Africa question preserves Rwanda and DR Congo as explicit countries', () => {
    const result = classifyQueryIntent(
      'indicate me a full story happening in the East African region, economically, politically. ' +
        'include conflicts occurrences between Rwanda and DR congo and their current development',
    );

    expect(result.countries.map((country) => country.iso3)).toEqual(['RWA', 'COD']);
    expect(result.sides.map((country) => country.iso3)).toEqual(['RWA', 'COD']);
  });
});

/* ------------------------------------------------------------------ *
 * CLASS: demonym geography — the adjectival form is the user naming a place.
 * ------------------------------------------------------------------ */

describe('CLASS demonym — an adjectival form names a country', () => {
  const DEMONYMS: ReadonlyArray<readonly [string, string]> = [
    ['Ukrainian', 'Ukraine'],
    ['Russian', 'Russia'],
    ['Kenyan', 'Kenya'],
    ['Rwandan', 'Rwanda'],
    ['Polish', 'Poland'],
    ['Nigerian', 'Nigeria'],
    ['Japanese', 'Japan'],
    ['Brazilian', 'Brazil'],
    ['Spanish', 'Spain'],
    ['German', 'Germany'],
  ];

  it.each(DEMONYMS)('"%s election" is read as a question about %s', (demonym, country) => {
    const result = classifyQueryIntent(`${demonym} election`);

    expect(result.intent).toBe('GEOGRAPHIC_REGIONAL');
    expect(result.countries.map((c) => c.name)).toEqual([country]);
  });

  it('TWO demonyms are a multi-entity question, not one country', () => {
    const result = classifyQueryIntent('the Ukrainian and Russian conflicts');

    expect(result.intent).toBe('MULTI_ENTITY');
    expect(result.sides.map((s) => s.name)).toEqual(['Ukraine', 'Russia']);
  });

  it('THE REPORTED SENTENCE — resolved by shape, with no rule naming these countries', () => {
    const result = classifyQueryIntent(
      'Provide recent updates in the Ukrainian and Russian conflicts affecting both ' +
        'countries and other countries affected economically and politically.',
    );

    expect(result.intent).toBe('MULTI_ENTITY');
    expect(result.sides.map((s) => s.name)).toEqual(['Ukraine', 'Russia']);
  });

  it('a non-locative compound is still not a country', () => {
    // The curated table's own guard, relied on rather than re-implemented.
    expect(classifyQueryIntent('french fries recipe').countries).toEqual([]);
    expect(classifyQueryIntent('turkish delight shops').countries).toEqual([]);
  });

  it('a genuinely locative use of the same adjective still resolves', () => {
    expect(classifyQueryIntent('French policy on energy').countries.map((c) => c.name)).toEqual([
      'France',
    ]);
  });
});

/* ------------------------------------------------------------------ *
 * CLASS: COMPARISON_RESEARCH — an explicit comparison with real members.
 * ------------------------------------------------------------------ */

describe('CLASS comparison with determinable members', () => {
  const SHAPES: ReadonlyArray<(a: string, b: string) => string> = [
    (a, b) => `Compare ${a} and ${b}`,
    (a, b) => `Compare the current situations in ${a} and ${b}.`,
    (a, b) => `Comparison of ${a} and ${b}`,
    (a, b) => `${a} versus ${b}`,
    (a, b) => `${a} vs ${b}`,
    (a, b) => `Difference between ${a} and ${b}`,
  ];

  for (const shape of SHAPES) {
    it.each(SUBJECT_PAIRS)(
      `"${shape('X', 'Y')}" is a comparison over both — %s / %s`,
      (a, b, expectedA, expectedB) => {
        const query = shape(a, b);

        expect(intentOf(query)).toBe('COMPARISON_RESEARCH');
        expect(names(query)).toEqual([expectedA, expectedB]);
      },
    );
  }

  it('three members are all kept', () => {
    expect(names('Compare the economies of Nigeria, Kenya and Rwanda')).toEqual([
      'Nigeria',
      'Kenya',
      'Rwanda',
    ]);
  });

  it('ASK EXPLICIT-SCOPE R1 — a country list later in a long comparison is still authoritative', () => {
    const result = classifyQueryIntent(
      'Compare how current local reporting in Israel, Iran, Saudi Arabia, Turkey and the UAE ' +
        'is framing the same regional security developments.',
    );

    expect(result.intent).toBe('CLARIFICATION_REQUIRED');
    expect(result.countries.map((country) => country.name)).toEqual([
      'Israel',
      'Iran',
      'Saudi Arabia',
      'Turkey',
      'United Arab Emirates',
    ]);
    expect(result.reason).toContain('retrieval ceiling');
  });

  it('G-ALPHA-2.1 (C) — MORE THAN THREE COUNTRIES IS NOT QUIETLY TRUNCATED', () => {
    /*
     * G-ALPHA-2 capped retrieval at three and recorded the truncation only in
     * the diagnostic `reason`, which nothing downstream reads and no reader
     * ever sees — so a six-country question was answered from three and looked
     * exactly like a complete answer. It now asks instead.
     */
    const result = classifyQueryIntent(
      'Compare Nigeria, Kenya, Rwanda, Uganda, Tanzania and Ethiopia',
    );

    expect(result.intent).toBe('CLARIFICATION_REQUIRED');
    expect(result.sides).toEqual([]);
    expect(result.countries.length).toBeGreaterThan(3);
    expect(result.reason).toContain('retrieval ceiling');
  });

  it('the ceiling applies to a plain multi-country question too, not just comparisons', () => {
    const result = classifyQueryIntent(
      'What is happening between Nigeria, Kenya, Rwanda and Uganda?',
    );

    expect(result.intent).toBe('CLARIFICATION_REQUIRED');
    expect(result.sides).toEqual([]);
  });

  it('exactly three is still retrieved — the ceiling is not lowered', () => {
    const result = classifyQueryIntent('Compare the economies of Nigeria, Kenya and Rwanda');

    expect(result.intent).toBe('COMPARISON_RESEARCH');
    expect(result.sides.map((side) => side.name)).toEqual(['Nigeria', 'Kenya', 'Rwanda']);
  });
});

/* ------------------------------------------------------------------ *
 * CLASS: CLARIFICATION_REQUIRED — the CTO's explicit requirement.
 * ------------------------------------------------------------------ */

describe('CLASS implicit comparison — clarify, never invent the members', () => {
  it.each([
    'Which country is more powerful in East Africa?',
    'Which country is richer in West Africa?',
    'Which countries are safer in the Balkans?',
    'Which nation is stronger in the region?',
    'Who is more powerful?',
    'Compare them',
    'Compare the two economies',
  ])('"%s" requires clarification', (query) => {
    expect(intentOf(query)).toBe('CLARIFICATION_REQUIRED');
  });

  it('NO MEMBER IS EVER INVENTED for a clarification case', () => {
    const result = classifyQueryIntent('Which country is more powerful in East Africa?');

    expect(result.sides).toEqual([]);
    expect(result.countries).toEqual([]);
  });

  it('naming only ONE member is still not enough to compare', () => {
    const result = classifyQueryIntent('Compare Kenya with its neighbours');

    expect(result.intent).toBe('CLARIFICATION_REQUIRED');
    expect(result.sides).toEqual([]);
  });

  it('a coordination frame that produced only one country contributes NOTHING', () => {
    /*
     * Deliberate, and worth stating because it looks like a missed
     * opportunity. A frame is only allowed to contribute when it genuinely
     * coordinated — two or more countries. One country out of a frame is
     * indistinguishable from ordinary prepositional geography, which
     * detectLocation() already owns; promoting it here would create a second
     * geographic authority competing with that one, and the two would
     * eventually disagree. So "Compare Kenya with its neighbours" reports no
     * countries at all, and asks for clarification.
     */
    expect(classifyQueryIntent('Compare Kenya with its neighbours').countries).toEqual([]);
  });

  it('a single DEMONYM is a determinable member, and one is still not two', () => {
    const result = classifyQueryIntent('Compare Kenyan policy with the wider region');

    expect(result.intent).toBe('CLARIFICATION_REQUIRED');
    expect(result.sides).toEqual([]);
    expect(result.countries.map((c) => c.name)).toEqual(['Kenya']);
    expect(result.reason).toContain('one determinable member');
  });

  it('the moment a second member IS determinable it stops being a clarification', () => {
    expect(intentOf('Compare Kenya with Rwanda')).toBe('COMPARISON_RESEARCH');
  });
});

/* ------------------------------------------------------------------ *
 * CLASS: EXPLANATION — what something IS, not what is happening with it.
 * ------------------------------------------------------------------ */

describe('CLASS explanation — the subject is extracted, never the whole sentence', () => {
  const TOPICS = [
    'quantum',
    'quantum computing',
    'inflation',
    'a recession',
    'the eurozone',
    'machine learning',
  ];

  it.each(TOPICS)('"What is %s?" extracts the subject', (topic) => {
    const result = classifyQueryIntent(`What is ${topic}?`);

    expect(result.intent).toBe('EXPLANATION');
    expect(result.subject).toBe(topic.replace(/^(?:a|an|the)\s+/i, ''));
  });

  it.each(TOPICS)('"Explain %s." extracts the same subject', (topic) => {
    const result = classifyQueryIntent(`Explain ${topic}.`);

    expect(result.intent).toBe('EXPLANATION');
    expect(result.subject).toBe(topic.replace(/^(?:a|an|the)\s+/i, ''));
  });

  it('covers the rest of the family', () => {
    expect(classifyQueryIntent('Define sovereign debt').subject).toBe('sovereign debt');
    expect(classifyQueryIntent('What does inflation mean').subject).toBe('inflation');
    expect(classifyQueryIntent('How does quantum computing work').subject).toBe(
      'quantum computing',
    );
  });

  it('A CURRENT-EVENT MARKER OUTRANKS THE EXPLANATION READING', () => {
    // These open exactly like explanations and are plainly news questions.
    for (const query of [
      'What is happening in Spain?',
      'What is the latest on the strike',
      'What is the current situation',
      'What is the news today',
    ]) {
      expect(intentOf(query)).not.toBe('EXPLANATION');
    }
  });

  it('G-ALPHA-2.1 (B) — THE ORIGINAL ALPHA LONG-FORM CASE now reduces to its concept', () => {
    /*
     * This exact sentence was the reported defect. G-ALPHA-2 refused it because
     * the captured body was eight words, over the bound. The bound did not
     * move: the body is REDUCED first — the trailing elaboration clause is
     * dropped and the concept is taken out of the embedded "what X is" frame —
     * and the unchanged bound then accepts what remains.
     */
    expect(
      classifyQueryIntent('Explain what quantum is and elaborate more about it.'),
    ).toMatchObject({ intent: 'EXPLANATION', subject: 'quantum' });

    // The reported input was two sentences. Extraction reads the first clause,
    // so the subject is never a span that crosses the question mark.
    expect(
      classifyQueryIntent('What is quantum? Explain what quantum is and elaborate more about it.'),
    ).toMatchObject({ intent: 'EXPLANATION', subject: 'quantum' });
  });

  it('a genuinely oversized concept is STILL REFUSED, never truncated into a fragment', () => {
    // Nothing here is an elaboration tail or an embedded copular frame, so
    // after every subtractive step this is still a sentence, not a concept.
    const result = classifyQueryIntent(
      'Explain the entire history of the european monetary union since 1979',
    );

    expect(result.subject).toBeUndefined();
    expect(result.intent).toBe('CURRENT_EVENT');
  });
});

/* ------------------------------------------------------------------ *
 * CLASS: ENTITY_BACKGROUND
 * ------------------------------------------------------------------ */

describe('CLASS entity background — a named subject that is not a place', () => {
  it.each([
    'What do you know about Donald Trump?',
    'What do you know about President Donald Trump?',
    'What can you tell me about semiconductor exports?',
    'Do you know anything about the NATO summit?',
    'Tell me about the Rwanda election',
    'Who is Emmanuel Macron?',
  ])('"%s" is an entity-background question', (query) => {
    expect(intentOf(query)).toBe('ENTITY_BACKGROUND');
  });

  it('it does NOT re-extract the subject — that authority stays in M35/D2', () => {
    // No `subject` is offered for this class, so derive-generic-news-query.util
    // remains the single place a background subject is derived.
    expect(classifyQueryIntent('What do you know about Donald Trump?').subject).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ *
 * CLASS: CURRENT_EVENT — the default, and the no-regression guarantee.
 * ------------------------------------------------------------------ */

describe('CLASS current event — the default keeps every existing shape unchanged', () => {
  it.each([
    'NATO',
    'cybersecurity',
    "What's happening in the Middle East?",
    'What is happening with NATO?',
    'How is climate change affecting food prices?',
    'oil price cap',
    'semiconductor exports',
    'Polska, bezpieczeństwo',
    'co dzieje się w Polsce',
  ])('"%s" carries no sides and no subject, so nothing downstream changes', (query) => {
    const result = classifyQueryIntent(query);

    expect(result.sides).toEqual([]);
    expect(result.subject).toBeUndefined();
  });

  it('an empty or punctuation-only query is classified, never thrown on', () => {
    for (const query of ['', '   ', '???', '...']) {
      expect(() => classifyQueryIntent(query)).not.toThrow();
      expect(classifyQueryIntent(query).sides).toEqual([]);
    }
  });
});

/* ------------------------------------------------------------------ *
 * THE AMBIGUITY GUARDS — what the classifier deliberately refuses to see.
 * ------------------------------------------------------------------ */

describe('a country NAME needs a coordination frame; a function word never resolves', () => {
  it('an ungated sentence mentioning an ambiguous name resolves nothing', () => {
    // Georgia, Turkey, Chad and Jordan are ordinary words as well as countries.
    // Without a coordination frame this classifier does not claim them — the
    // same restraint COUNTRY_CONTEXT_PATTERN already exercises.
    for (const query of [
      'Turkey prices rise before the holidays',
      'Jordan scored twice last night',
      'Chad was appointed to the board',
    ]) {
      expect(classifyQueryIntent(query).sides).toEqual([]);
    }
  });

  it('a coordination frame does NOT license a lone function word', () => {
    // "between us and them" must never become the United States.
    for (const query of ['between us and them', 'compare it and that', 'us vs them']) {
      expect(classifyQueryIntent(query).sides).toEqual([]);
    }
  });

  it('THE REPORTED MISROUTE — "it" never contributes a country', () => {
    const result = classifyQueryIntent(
      'What is quantum? Explain what quantum is and elaborate more about it.',
    );

    expect(result.countries).toEqual([]);
    expect(result.sides).toEqual([]);
  });

  it('a frame naming only one country is left to ordinary geographic routing', () => {
    // detectLocation() already owns this shape; claiming it here would create a
    // second, competing geographic authority.
    expect(classifyQueryIntent('news between Kenya and the coast').sides).toEqual([]);
  });
});

describe('ARTICLE_ANCHORED is reported, and is decided by the caller', () => {
  it('an anchored request is classified ARTICLE_ANCHORED whatever the sentence says', () => {
    for (const query of [
      'Compare Rwanda and Kenya',
      'What is quantum?',
      'Which country is more powerful in East Africa?',
      'the Ukrainian and Russian conflicts',
    ]) {
      const result = classifyQueryIntent(query, { hasResolvedArticleAnchor: true });

      expect(result.intent).toBe('ARTICLE_ANCHORED');
      expect(result.sides).toEqual([]);
      expect(result.subject).toBeUndefined();
    }
  });
});
