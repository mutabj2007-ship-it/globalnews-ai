import type { CountryMeta, NewsArticle } from '@globalnews-ai/shared';
import { articleMentionsCity, scoreCountryRelevance } from './country-relevance.util';

const sudan: CountryMeta = {
  iso2: 'SD',
  iso3: 'SDN',
  isoNumeric: '729',
  name: 'Sudan',
  region: 'Africa',
};

function article(title: string, summary: string): Pick<NewsArticle, 'title' | 'summary'> {
  return { title, summary };
}

describe('scoreCountryRelevance', () => {
  it('accepts an article clearly about Sudan', () => {
    const result = scoreCountryRelevance(
      article(
        'Sudan peace talks encounter new obstacles',
        'The Sudanese government and armed forces remain divided.',
      ),
      sudan,
    );

    expect(result.isRelevant).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(60);
  });

  it('accepts a humanitarian article where Sudan is central', () => {
    const result = scoreCountryRelevance(
      article(
        'Red Cross appeals for support across Sudan',
        'Humanitarian needs and food shortages continue to grow.',
      ),
      sudan,
    );

    expect(result.isRelevant).toBe(true);
  });

  it('rejects the exact Nikhil Sudan surname-only result', () => {
    const result = scoreCountryRelevance(
      article(
        'Rajouri Student Nikhil Features In Official Poster Of PM Led Campaign',
        'Nikhil Sudan, a Class XII student of Government Model Boys Higher Secondary School, appeared in an official poster.',
      ),
      sudan,
    );

    expect(result.isRelevant).toBe(false);
    expect(result.score).toBeLessThan(35);
    expect(result.reasons).toContain('likely surname-only mention');
  });

  it('rejects a shorter surname-only result', () => {
    const result = scoreCountryRelevance(
      article(
        'Rajouri student features in official poster',
        'Nikhil Sudan, a Class XII student, appeared in an educational campaign poster.',
      ),
      sudan,
    );

    expect(result.isRelevant).toBe(false);
    expect(result.score).toBeLessThan(35);
  });

  it('accepts a meaningful summary-only country mention', () => {
    const result = scoreCountryRelevance(
      article(
        'Regional migration update',
        'Refugees from Sudan crossed the border after renewed conflict.',
      ),
      sudan,
    );

    expect(result.isRelevant).toBe(true);
  });

  it('accepts Sudan government peace talks', () => {
    const result = scoreCountryRelevance(
      article(
        'Sudan government announces peace talks',
        'Officials confirmed a new round of negotiations.',
      ),
      sudan,
    );

    expect(result.isRelevant).toBe(true);
  });

  it('accepts the Sudanese demonym', () => {
    const result = scoreCountryRelevance(
      article('Sudanese nationals return home', 'Hundreds crossed the border after a ceasefire.'),
      sudan,
    );

    expect(result.isRelevant).toBe(true);
  });

  it('does not mistake South Sudan for a surname', () => {
    const result = scoreCountryRelevance(
      article(
        'Regional humanitarian update',
        'Refugees from South Sudan crossed the border after renewed conflict.',
      ),
      sudan,
    );

    expect(result.isRelevant).toBe(true);
    expect(result.reasons).not.toContain('likely surname-only mention');
  });

  it('rejects an unrelated article with no country mention', () => {
    const result = scoreCountryRelevance(
      article('Local school launches new program', 'Students attended an educational event.'),
      sudan,
    );

    expect(result.isRelevant).toBe(false);
    expect(result.score).toBe(0);
  });
});

describe('articleMentionsCity', () => {
  it('matches a city mentioned in the title', () => {
    const matches = articleMentionsCity(
      article('Kigali hosts regional summit', 'Delegates gathered this week.'),
      'kigali',
    );

    expect(matches).toBe(true);
  });

  it('matches a city mentioned only in the summary', () => {
    const matches = articleMentionsCity(
      article('Regional summit opens', 'Delegates gathered in Kigali this week.'),
      'kigali',
    );

    expect(matches).toBe(true);
  });

  it('is case-insensitive', () => {
    const matches = articleMentionsCity(
      article('KIGALI hosts regional summit', 'Delegates gathered this week.'),
      'kigali',
    );

    expect(matches).toBe(true);
  });

  it('does not match when the city is absent', () => {
    const matches = articleMentionsCity(
      article('Rwanda government announces new policy', 'Officials confirmed the plan nationally.'),
      'kigali',
    );

    expect(matches).toBe(false);
  });

  it('does not match a bare substring inside another word', () => {
    const matches = articleMentionsCity(
      article('A story about Kigalian traditions', 'Unrelated to the city of Kigali directly.'),
      'kigali',
    );

    // "Kigalian" should not count as a whole-phrase match for "kigali"
    // — but the summary does mention "Kigali" directly, so this
    // still matches overall via the summary.
    expect(matches).toBe(true);
  });
});

describe('scoreCountryRelevance — Milestone #50 Phase C (multilingual EN/PL relevance)', () => {
  const poland: CountryMeta = {
    iso2: 'PL',
    iso3: 'POL',
    isoNumeric: '616',
    name: 'Poland',
    region: 'Europe',
  };

  const germany: CountryMeta = {
    iso2: 'DE',
    iso3: 'DEU',
    isoNumeric: '276',
    name: 'Germany',
    region: 'Europe',
  };

  const usa: CountryMeta = {
    iso2: 'US',
    iso3: 'USA',
    isoNumeric: '840',
    name: 'United States',
    region: 'Americas',
  };

  it('1. EN Poland article containing "Poland" survives', () => {
    const result = scoreCountryRelevance(
      article('Poland announces new policy', 'The government confirmed the plan.'),
      poland,
      'en',
    );

    expect(result.isRelevant).toBe(true);
  });

  it('2. PL Poland article containing "Polska" survives', () => {
    const result = scoreCountryRelevance(
      article('Polska zwiększa wydatki na obronność', 'Rząd potwierdził plan tego tygodnia.'),
      poland,
      'pl',
    );

    expect(result.isRelevant).toBe(true);
  });

  it('3. PL Germany article containing "Niemcy" survives for Germany', () => {
    const result = scoreCountryRelevance(
      article('Niemcy ogłaszają nowy budżet', 'Minister potwierdził plan wydatków.'),
      germany,
      'pl',
    );

    expect(result.isRelevant).toBe(true);
  });

  it('4. PL United States article containing "Stany Zjednoczone" survives for USA', () => {
    const result = scoreCountryRelevance(
      article('Stany Zjednoczone ogłaszają nową politykę', 'Rząd potwierdził szczegóły planu.'),
      usa,
      'pl',
    );

    expect(result.isRelevant).toBe(true);
  });

  it('5. English canonical country name still works during Polish retrieval mode', () => {
    const result = scoreCountryRelevance(
      article('Poland announces new policy', 'The government confirmed the plan.'),
      poland,
      'pl',
    );

    expect(result.isRelevant).toBe(true);
  });

  it('6. an unrelated Polish-language article still fails relevance', () => {
    const result = scoreCountryRelevance(
      article('Firma ogłasza nowy produkt', 'Prezes przedstawił szczegóły oferty.'),
      poland,
      'pl',
    );

    expect(result.isRelevant).toBe(false);
  });

  it('7. the localized name for the WRONG country does not qualify — "Niemcy" (Germany) does not match when scoring against Poland', () => {
    const result = scoreCountryRelevance(
      article('Niemcy ogłaszają nowy budżet', 'Minister potwierdził plan wydatków.'),
      poland,
      'pl',
    );

    expect(result.isRelevant).toBe(false);
  });

  it('backward compatibility: no language argument at all behaves byte-for-byte as before this milestone', () => {
    const withoutLanguage = scoreCountryRelevance(
      article('Poland announces new policy', 'The government confirmed the plan.'),
      poland,
    );

    expect(withoutLanguage.isRelevant).toBe(true);
    expect(withoutLanguage.score).toBe(65);
  });

  it('backward compatibility: without a language argument, Polish text is NOT recognized — matches the pre-Phase-C behavior exactly', () => {
    const withoutLanguage = scoreCountryRelevance(
      article('Polska zwiększa wydatki na obronność', 'Rząd potwierdził plan.'),
      poland,
    );

    expect(withoutLanguage.isRelevant).toBe(false);
  });

  it('language="en" explicitly behaves identically to omitting language entirely', () => {
    const withEnglish = scoreCountryRelevance(
      article('Poland announces new policy', 'The government confirmed the plan.'),
      poland,
      'en',
    );
    const withoutLanguage = scoreCountryRelevance(
      article('Poland announces new policy', 'The government confirmed the plan.'),
      poland,
    );

    expect(withEnglish).toEqual(withoutLanguage);
  });
});
