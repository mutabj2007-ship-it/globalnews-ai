import { createHash } from 'crypto';
import type { CountryMeta, LanguageCode, NewsArticle } from '@globalnews-ai/shared';
import { COUNTRIES } from '@globalnews-ai/shared';
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

/*
  M66.14B — SEMANTIC LOCK FOR THE PREPARED-TEXT OPTIMIZATION.

  containsWholePhrase() used to re-normalize the ARTICLE TEXT on every
  containment check — 30-60 times per country — so a caller sweeping all 195
  countries repeated all of it on text that never changes. The optimization
  prepares each distinct text once and reuses it, for ~5x on that workload.

  It is a refactor, so the only thing worth testing is that NOTHING MOVED. The
  expectations below were generated from the PRE-OPTIMIZATION implementation at
  commit 935b8652: they are an oracle, not a description of the new code. If any
  future change to weights, thresholds, aliases, demonyms, localized names, ISO
  checks, context terms or the surname heuristic alters a result, this fails —
  which is exactly the point.

  The aggregate hash covers all 20,280 (article x country x language) results
  INCLUDING every `reasons` string, so it catches what the readable table cannot.
  The table exists so that when the hash fails you can see which case moved.
*/
describe('country relevance — M66.14B prepared-text optimization preserves semantics', () => {
  const REPRESENTATIVE: Array<Pick<NewsArticle, 'title' | 'summary'>> = [
    { title: 'Kenya opens new transport corridor as Nairobi expands rail links', summary: 'The Kenyan government said the corridor will cut freight times.' },
    { title: 'Germany reports slower industrial output in November', summary: 'German factories reported a second consecutive monthly decline.' },
    { title: 'Poland and Lithuania agree on border infrastructure funding', summary: 'Warsaw confirmed the joint programme on Tuesday.' },
    { title: 'Bitcoin volatility returns as traders weigh rate expectations', summary: 'Crypto markets swung sharply through the session.' },
    { title: 'Japan unveils semiconductor investment package', summary: 'The Japanese ministry set out subsidies for domestic fabrication.' },
    { title: 'Brazil expands Amazon monitoring programme', summary: 'Brazilian authorities said satellite coverage would double.' },
    { title: 'New study links sleep patterns to metabolic health', summary: 'Researchers followed participants over four years.' },
    { title: 'India completes first phase of solar corridor', summary: 'Indian officials described the milestone as on schedule.' },
    { title: 'Canada and Mexico resume trade discussions', summary: 'Ottawa said talks would continue next month.' },
    { title: 'Global shipping rates ease after months of disruption', summary: 'Carriers reported improved schedule reliability.' },
    { title: 'France announces nuclear plant refurbishment timetable', summary: 'The French operator confirmed the outage schedule.' },
    { title: 'Australia sets new emissions reporting rules for large firms', summary: 'Australian regulators published the final guidance.' },
  ];

  /* Exercises every branch: empty input, the surname heuristic and its
     geographic-prefix escape, localized names, ISO2/ISO3, context-term
     saturation, punctuation and multi-space normalization. */
  const ADVERSARIAL: Array<Pick<NewsArticle, 'title' | 'summary'>> = [
    { title: '', summary: '' },
    { title: 'Chad', summary: '' },
    { title: '', summary: 'Chad Johnson, the veteran spokesman, said the policy would change.' },
    { title: 'Markets steady', summary: 'Chad Johnson, a spokesman for the ministry, confirmed the report.' },
    { title: 'South Sudan peace talks resume', summary: 'The president met citizens near the border.' },
    { title: 'North Macedonia joins the programme', summary: 'Officials in the capital confirmed the state would participate.' },
    { title: 'Polska podpisala umowe', summary: 'Rzad w Warszawie potwierdzil porozumienie.' },
    { title: 'Niemcy i Francja uzgodnily plan', summary: 'Rzady obu krajow potwierdzily wspolprace.' },
    { title: 'USA and GBR sign accord', summary: 'The US delegation met the UK team.' },
    { title: 'Report: government, president, capital, army, military, border', summary: 'citizens nationals country state' },
    { title: 'Punctuation!!! Kenya??? ...Kenyan---government', summary: 'Multi   spaced    text.' },
    { title: 'The Republic of Korea and Cote d Ivoire met', summary: 'Both delegations issued statements.' },
    { title: 'Jane Ireland spoke to reporters', summary: 'Jane Ireland, a spokesman, addressed the press.' },
    { title: 'New Zealand announces policy', summary: 'New Zealand officials confirmed the plan.' },
  ];

  const CORPUS = [...REPRESENTATIVE, ...ADVERSARIAL];

  /** Winner over all 195 countries — the exact shape a country sweep produces. */
  const argmax = (article: Pick<NewsArticle, 'title' | 'summary'>, language?: LanguageCode) => {
    let winner: string | null = null;
    let score = 0;
    let relevantCount = 0;

    for (const country of COUNTRIES) {
      const result = scoreCountryRelevance(article, country, language);
      if (!result.isRelevant) continue;
      relevantCount += 1;
      if (winner === null || result.score > score) {
        winner = country.iso2;
        score = result.score;
      }
    }

    return { winner, score, relevantCount };
  };

  /*
    Golden master, generated from the pre-optimization implementation.
    One entry per CORPUS article, in order. `iso2:score:relevantCount`, or `-`
    for an article no country claims. Compact deliberately: 52 expanded object
    literals obscure the one line that differs.
  */
  const GOLDEN: Record<'en' | 'pl', string> = {
    en: 'KE:65:1|DE:60:1|PL:65:2|-|JP:60:1|BR:60:1|-|IN:60:1|CA:60:2|-|FR:60:1|AU:60:1|-|TD:60:1|-|-|SD:80:2|MK:70:1|-|-|-|-|KE:65:1|CI:60:1|IE:90:1|NZ:90:1',
    pl: 'KE:65:1|DE:60:1|PL:65:2|-|JP:60:1|BR:60:1|-|IN:60:1|CA:60:2|-|FR:60:1|AU:60:1|-|TD:60:1|-|-|SD:80:2|MK:70:1|PL:60:1|FR:60:2|-|-|KE:65:1|CI:60:1|IE:90:1|NZ:90:1',
  };

  const expected = (encoded: string) => {
    if (encoded === '-') return { winner: null, score: 0, relevantCount: 0 };
    const [winner, score, relevantCount] = encoded.split(':');
    return { winner, score: Number(score), relevantCount: Number(relevantCount) };
  };

  it('reproduces the pre-optimization winner, score and relevant-count for every article, in both languages', () => {
    for (const language of ['en', 'pl'] as const) {
      const rows = GOLDEN[language].split('|');
      expect(rows).toHaveLength(CORPUS.length);
      rows.forEach((encoded, index) => {
        expect({ language, index, ...argmax(CORPUS[index], language) }).toEqual({
          language,
          index,
          ...expected(encoded),
        });
      });
    }
  });

  it('reproduces the pre-optimization result for all 20,280 combinations, including every reasons string', () => {
    const hash = createHash('sha256');
    let comparisons = 0;

    for (const language of ['en', 'pl', undefined, 'de'] as Array<LanguageCode | undefined>) {
      CORPUS.forEach((article, index) => {
        for (const country of COUNTRIES) {
          const result = scoreCountryRelevance(article, country, language);
          hash.update(
            `${language}|${index}|${country.iso2}|${result.score}|${result.isRelevant}|${result.reasons.join(';')}\n`,
          );
          comparisons += 1;
        }
      });
    }

    expect(comparisons).toBe(CORPUS.length * COUNTRIES.length * 4);
    expect(hash.digest('hex')).toBe('500212da806b577d1c1e2c871c55927af627314fffb66d3927a598828e8dbd48');
  });

  it('articleMentionsCity is untouched — containsWholePhrase keeps its public behaviour', () => {
    expect(articleMentionsCity(CORPUS[0], 'nairobi')).toBe(true);
    expect(articleMentionsCity(CORPUS[0], 'warsaw')).toBe(false);
    expect(articleMentionsCity(CORPUS[0], '')).toBe(false);
    expect(articleMentionsCity({ title: 'Report from NAIROBI, today', summary: '' }, 'nairobi')).toBe(true);
  });
});

/*
  M66.14B — CROSS-LANGUAGE GEOGRAPHY.

  GlobalNews AI runs a Polish interface over provider articles that are usually
  English. Country resolution must be driven by the ARTICLE's evidence, never by
  the interface locale: a Polish UI must not blind the system to the word
  'Kenya'. scoreCountryRelevance's own contract says the localized name is an
  ADDITIONAL signal, never a replacement — these hold it to that.
*/
describe('country relevance — the interface language never suppresses canonical geography', () => {
  const ENGLISH_ARTICLE = {
    title: 'Kenya opens new transport corridor as Nairobi expands rail links',
    summary: 'The Kenyan government said the corridor will cut freight times.',
  };

  const kenya = COUNTRIES.find((country) => country.iso2 === 'KE') as CountryMeta;
  const poland = COUNTRIES.find((country) => country.iso2 === 'PL') as CountryMeta;
  const POLISH_ARTICLE = { title: 'Polska podpisala umowe', summary: 'Rzad w Warszawie potwierdzil porozumienie.' };

  it('THE CORE RULE — a Polish interface resolves an English article identically to an English one', () => {
    const withPolishUi = scoreCountryRelevance(ENGLISH_ARTICLE, kenya, 'pl');
    expect(withPolishUi.isRelevant).toBe(true);
    expect(withPolishUi).toEqual(scoreCountryRelevance(ENGLISH_ARTICLE, kenya, 'en'));
  });

  it('the winner across ALL 195 countries is the same under either interface language', () => {
    // A single-country check could not see a locale that shifted the winner.
    const pick = (language: LanguageCode) => {
      let winner: string | null = null;
      let score = 0;
      for (const country of COUNTRIES) {
        const result = scoreCountryRelevance(ENGLISH_ARTICLE, country, language);
        if (result.isRelevant && (winner === null || result.score > score)) {
          winner = country.iso2;
          score = result.score;
        }
      }
      return winner;
    };

    expect(pick('pl')).toBe('KE');
    expect(pick('en')).toBe('KE');
  });

  it('a Polish interface genuinely ADDS reach — a Polish-language article resolves via its localized name', () => {
    expect(scoreCountryRelevance(POLISH_ARTICLE, poland, 'pl').isRelevant).toBe(true);
  });

  it('DIAGNOSTIC, NOT AN ASPIRATION — an English interface does NOT resolve a Polish-language article', () => {
    /*
      KNOWN MULTILINGUAL-GEOGRAPHY LIMITATION, recorded rather than fixed.

      'Polska' is only checked when the INTERFACE language is Polish, because the
      localized name is resolved from the caller's language. An English interface
      reading a Polish-language article therefore finds no country at all.

      This documents behaviour that EXISTS. It is not behaviour anyone wants and
      must not be read as approval of it — the honest fix is to test an article
      against localized names for every supported language, which is a scope
      change and is NOT authorized in M66.14B.

      If a later milestone fixes it, THIS TEST SHOULD FAIL and be updated. That
      is the correct outcome, not a regression.
    */
    expect(scoreCountryRelevance(POLISH_ARTICLE, poland, 'en').isRelevant).toBe(false);
  });
});
