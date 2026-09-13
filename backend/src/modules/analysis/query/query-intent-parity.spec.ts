import { classifyQueryIntent, type QueryIntent } from './query-intent.util';

/**
 * G-ALPHA-2.1 (A + D) ACCEPTANCE — EN / PL PARITY, CASE BY CASE.
 *
 * Every case below is a PAIR: the same question in English and in Polish, with
 * one expected class for both. A pair that diverges is a parity defect, and
 * writing the corpus this way is what makes such a defect impossible to miss —
 * a Polish gap cannot hide behind a passing English assertion.
 *
 * The Polish side is bounded patterns and curated names throughout. No
 * translation call, no LLM, no stemmer.
 */

interface Pair {
  readonly en: string;
  readonly pl: string;
  readonly intent: QueryIntent;
  readonly sides?: readonly string[];
  readonly subject?: { en: string; pl: string };
}

const PAIRS: readonly Pair[] = [
  // ---- multi-entity -------------------------------------------------
  {
    en: 'What is happening between Russia and Ukraine?',
    pl: 'Co dzieje się między Rosją a Ukrainą?',
    intent: 'MULTI_ENTITY',
    sides: ['Russia', 'Ukraine'],
  },
  {
    en: 'What is happening between Poland and Germany?',
    pl: 'Co dzieje się między Polską a Niemcami?',
    intent: 'MULTI_ENTITY',
    sides: ['Poland', 'Germany'],
  },

  // ---- explicit comparison ------------------------------------------
  {
    en: 'Compare the current situations in Rwanda and Kenya.',
    pl: 'Porównaj sytuację w Rwandzie i Kenii',
    intent: 'COMPARISON_RESEARCH',
    sides: ['Rwanda', 'Kenya'],
  },
  {
    en: 'Compare Poland and Germany',
    pl: 'Porównaj Polskę i Niemcy',
    intent: 'COMPARISON_RESEARCH',
    sides: ['Poland', 'Germany'],
  },
  {
    en: 'Difference between Poland and Germany',
    pl: 'Różnice między Polską a Niemcami',
    intent: 'COMPARISON_RESEARCH',
    sides: ['Poland', 'Germany'],
  },

  // ---- clarification required ---------------------------------------
  {
    en: 'Which country is more powerful in East Africa?',
    pl: 'Które państwo jest silniejsze w Afryce Wschodniej?',
    intent: 'CLARIFICATION_REQUIRED',
    sides: [],
  },

  // ---- explanation ---------------------------------------------------
  {
    en: 'What is quantum?',
    pl: 'Co to jest kwant?',
    intent: 'EXPLANATION',
    subject: { en: 'quantum', pl: 'kwant' },
  },
  {
    en: 'What is inflation?',
    pl: 'Czym jest inflacja?',
    intent: 'EXPLANATION',
    subject: { en: 'inflation', pl: 'inflacja' },
  },
  {
    // THE ORIGINAL ALPHA LONG-FORM DEFECT, in both languages.
    en: 'Explain what quantum is and elaborate more about it.',
    pl: 'Wyjaśnij czym jest kwant i opowiedz o tym więcej',
    intent: 'EXPLANATION',
    subject: { en: 'quantum', pl: 'kwant' },
  },
  {
    en: 'Can you explain quantum computing in more detail?',
    pl: 'Czy możesz wyjaśnić obliczenia kwantowe dokładniej?',
    intent: 'EXPLANATION',
    subject: { en: 'quantum computing', pl: 'obliczenia kwantowe' },
  },

  // ---- entity background ---------------------------------------------
  {
    en: 'What do you know about Donald Trump?',
    pl: 'Co wiesz o Donaldzie Trumpie?',
    intent: 'ENTITY_BACKGROUND',
    sides: [],
  },
  {
    en: 'Who is Emmanuel Macron?',
    pl: 'Kim jest Emmanuel Macron?',
    intent: 'ENTITY_BACKGROUND',
    sides: [],
  },

  // ---- geographic / regional -----------------------------------------
  {
    en: 'Kenyan election results',
    pl: 'Co dzieje się w Kenii?',
    intent: 'GEOGRAPHIC_REGIONAL',
    sides: [],
  },
  {
    en: 'Polish energy policy',
    pl: 'Najnowsze wiadomości z Polski',
    intent: 'GEOGRAPHIC_REGIONAL',
    sides: [],
  },

  // ---- current event (the default, both languages) --------------------
  {
    en: 'cybersecurity',
    pl: 'cyberbezpieczeństwo',
    intent: 'CURRENT_EVENT',
    sides: [],
  },
];

describe('EN / PL parity — the same question gets the same class in both languages', () => {
  it.each(PAIRS.map((pair) => [pair.intent, pair.en, pair.pl, pair] as const))(
    '%s — "%s" / "%s"',
    (_intent, _en, _pl, pair) => {
      const en = classifyQueryIntent(pair.en);
      const pl = classifyQueryIntent(pair.pl);

      expect(en.intent).toBe(pair.intent);
      expect(pl.intent).toBe(pair.intent);

      if (pair.sides) {
        expect(en.sides.map((side) => side.name)).toEqual(pair.sides);
        expect(pl.sides.map((side) => side.name)).toEqual(pair.sides);
      }

      if (pair.subject) {
        expect(en.subject).toBe(pair.subject.en);
        expect(pl.subject).toBe(pair.subject.pl);
      }
    },
  );

  it('every required Polish class is actually exercised by this corpus', () => {
    const covered = new Set(PAIRS.map((pair) => pair.intent));

    for (const required of [
      'CURRENT_EVENT',
      'EXPLANATION',
      'ENTITY_BACKGROUND',
      'COMPARISON_RESEARCH',
      'MULTI_ENTITY',
      'CLARIFICATION_REQUIRED',
      'GEOGRAPHIC_REGIONAL',
    ] as const) {
      expect(covered.has(required)).toBe(true);
    }
  });

  it('ARTICLE_ANCHORED outranks every Polish reading too', () => {
    for (const pair of PAIRS) {
      expect(classifyQueryIntent(pair.pl, { hasResolvedArticleAnchor: true }).intent).toBe(
        'ARTICLE_ANCHORED',
      );
    }
  });
});

describe('the Polish additions cannot misread ordinary Polish prose', () => {
  it('a Polish function word never becomes a country', () => {
    for (const query of [
      'Co to jest kwant?',
      'Czy to jest ważne?',
      'Nie wiem co o tym myśleć',
      'To jest bardzo dobre',
    ]) {
      expect(classifyQueryIntent(query).sides).toEqual([]);
    }
  });

  it('a Polish preposition alone does not name a place', () => {
    expect(classifyQueryIntent('Co dzieje się w tym roku?').countries).toEqual([]);
    expect(classifyQueryIntent('Powiedz mi o tym więcej').countries).toEqual([]);
  });

  it('the existing Milestone #47 Polish shapes still classify without sides', () => {
    // These already had working Polish retrieval. Nothing may take it away:
    // no sides means no per-side reroute, so they keep the M47 path exactly.
    for (const query of [
      'Polska, bezpieczeństwo',
      'Jakie są najważniejsze wiadomości z Polski?',
      'Najnowsze informacje o NATO',
    ]) {
      expect(classifyQueryIntent(query).sides).toEqual([]);
      expect(classifyQueryIntent(query).intent).not.toBe('CLARIFICATION_REQUIRED');
    }
  });
});
