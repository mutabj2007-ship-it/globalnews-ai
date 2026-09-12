import { resolveCountriesByDemonym, resolvePrimaryCountry } from './country-relevance.util';

/**
 * G-ALPHA-2 STAGE 1 ACCEPTANCE — DEMONYM COUNTRY RESOLUTION.
 *
 * THE MEASURED DEFECT. On the governing baseline, country NAMES resolved 12/12
 * and their adjectival forms resolved 0/12. "Kenyan election" and "the
 * Ukrainian and Russian conflicts" named countries as plainly as "in Kenya"
 * does, and the pipeline saw no geography at all.
 *
 * NO NEW GAZETTEER. This function reads the SAME curated COUNTRY_DEMONYMS table
 * that already backs country relevance scoring, including its deliberate
 * omissions and its non-locative compound guard. Those omissions are the safety
 * property and are asserted below, because a future contributor who "completes"
 * the table would silently reintroduce ambiguity this design refuses.
 */

function resolved(text: string): string[] {
  return resolveCountriesByDemonym(text).map((country) => country.name);
}

describe('an unambiguous adjectival form resolves its country', () => {
  it.each([
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
    ['Italian', 'Italy'],
    ['Swedish', 'Sweden'],
  ])('"%s" -> %s', (demonym, country) => {
    expect(resolved(`${demonym} politics this year`)).toEqual([country]);
  });

  it('is case-insensitive and position-independent', () => {
    expect(resolved('KENYAN election')).toEqual(['Kenya']);
    expect(resolved('the recent kenyan election')).toEqual(['Kenya']);
    expect(resolved('an election, Kenyan, was held')).toEqual(['Kenya']);
  });
});

describe('several demonyms in one sentence all resolve, in the order they appear', () => {
  it('THE REPORTED SENTENCE resolves both countries', () => {
    expect(
      resolved(
        'Provide recent updates in the Ukrainian and Russian conflicts affecting both ' +
          'countries and other countries affected economically and politically.',
      ),
    ).toEqual(['Ukraine', 'Russia']);
  });

  it('resolves three', () => {
    expect(resolved('Kenyan, Rwandan and Ugandan trade')).toEqual(['Kenya', 'Rwanda', 'Uganda']);
  });

  it('never repeats a country named twice', () => {
    expect(resolved('Kenyan politics and Kenyan trade')).toEqual(['Kenya']);
  });
});

describe('THE SAFETY PROPERTY — the table’s deliberate omissions are load-bearing', () => {
  it.each([
    // Ambiguous or non-national: each of these is deliberately absent from the
    // curated table, and each would misroute if it were added.
    'american',
    'American',
    'korean',
    'Korean',
    'congolese',
    'Congolese',
    'guinean',
    'Guinean',
    'dominican',
    'Dominican',
    'georgian',
    'Georgian',
    'english',
    'English',
  ])('"%s" resolves NOTHING, by design', (demonym) => {
    expect(resolved(`${demonym} affairs`)).toEqual([]);
  });

  it('a non-locative compound does not name a country', () => {
    expect(resolved('french fries recipe')).toEqual([]);
    expect(resolved('turkish delight shops')).toEqual([]);
  });

  it('but a genuinely locative use of the same word still resolves', () => {
    expect(resolved('French policy on energy')).toEqual(['France']);
    expect(resolved('Turkish inflation figures')).toEqual(['Turkey']);
  });

  it('a compound and a locative use in the same sentence resolve correctly', () => {
    expect(resolved('french fries are popular, but French policy is changing')).toEqual(['France']);
  });

  it('an ordinary sentence with no demonym resolves nothing', () => {
    for (const text of [
      'What is quantum?',
      'Explain what quantum is and elaborate more about it.',
      'What do you know about Donald Trump?',
      'cybersecurity',
      '',
    ]) {
      expect(resolved(text)).toEqual([]);
    }
  });

  it('a whole word is required — a demonym inside a longer word does not count', () => {
    expect(resolved('polishing the silver')).toEqual([]);
  });
});

describe('NIGER STATE / BAGO REGRESSION GUARD', () => {
  /*
   * Demonym resolution and subnational collision resolution are separate
   * systems, and this change touches only the first. These assertions exist so
   * that stays true — the full contract lives in subnational-collision.spec.ts
   * and is unchanged.
   */
  it('the confirmed article still resolves to Nigeria, never to sovereign Niger', () => {
    const resolvedCountry = resolvePrimaryCountry({
      title: 'Bago Mourns Village Head Killed By Bandits In Niger',
      summary: 'The incident happened in Niger State, Nigeria, according to local officials.',
    });

    expect(resolvedCountry?.countryName).toBe('Nigeria');
  });

  it('demonym resolution does not fire on that article at all', () => {
    expect(resolved('Bago Mourns Village Head Killed By Bandits In Niger')).toEqual([]);
  });
});
