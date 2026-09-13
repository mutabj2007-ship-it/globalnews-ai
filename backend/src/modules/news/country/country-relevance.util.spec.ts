import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { CountryMeta, LanguageCode, NewsArticle } from '@globalnews-ai/shared';
import { COUNTRIES } from '@globalnews-ai/shared';
import {
  articleMentionsCity,
  resolvePrimaryCountry,
  scoreCountryRelevance,
} from './country-relevance.util';

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

  /*
    CONVERTED UNDER CTO-AUTHORIZED G2 CORRECTION B — THE ASSERTION WAS THE BUG.

    This block asserted that an article about SOUTH SUDAN is relevant to SUDAN.
    It passed because preparedContainsPhrase is a whole-phrase test on
    space-padded text and 'South Sudan' contains ' sudan ' — the pre-existing
    collision the CTO ordered fixed. The surname-guard intent it was really
    written to protect is kept verbatim below; only the country it expects has
    changed, because the country it expected was wrong.
  */
  it('does not mistake South Sudan for a surname — and no longer mistakes it for Sudan', () => {
    const southSudanArticle = article(
      'Regional humanitarian update',
      'Refugees from South Sudan crossed the border after renewed conflict.',
    );

    const result = scoreCountryRelevance(southSudanArticle, sudan);

    // The original intent, unchanged: the surname heuristic must not fire here.
    expect(result.reasons).not.toContain('likely surname-only mention');

    // The fix: the longer country name takes the mention.
    expect(result.isRelevant).toBe(false);

    const southSudan: CountryMeta = {
      iso2: 'SS',
      iso3: 'SSD',
      isoNumeric: '728',
      name: 'South Sudan',
      region: 'Africa',
    };

    const correct = scoreCountryRelevance(southSudanArticle, southSudan);

    expect(correct.isRelevant).toBe(true);
    expect(correct.reasons).not.toContain('likely surname-only mention');
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

  The aggregate hash covers all 20,384 (article x country x language) results
  INCLUDING every `reasons` string, so it catches what the readable table cannot.
  The table exists so that when the hash fails you can see which case moved.
*/
describe('country relevance — M66.14B prepared-text optimization preserves semantics', () => {
  const REPRESENTATIVE: Array<Pick<NewsArticle, 'title' | 'summary'>> = [
    {
      title: 'Kenya opens new transport corridor as Nairobi expands rail links',
      summary: 'The Kenyan government said the corridor will cut freight times.',
    },
    {
      title: 'Germany reports slower industrial output in November',
      summary: 'German factories reported a second consecutive monthly decline.',
    },
    {
      title: 'Poland and Lithuania agree on border infrastructure funding',
      summary: 'Warsaw confirmed the joint programme on Tuesday.',
    },
    {
      title: 'Bitcoin volatility returns as traders weigh rate expectations',
      summary: 'Crypto markets swung sharply through the session.',
    },
    {
      title: 'Japan unveils semiconductor investment package',
      summary: 'The Japanese ministry set out subsidies for domestic fabrication.',
    },
    {
      title: 'Brazil expands Amazon monitoring programme',
      summary: 'Brazilian authorities said satellite coverage would double.',
    },
    {
      title: 'New study links sleep patterns to metabolic health',
      summary: 'Researchers followed participants over four years.',
    },
    {
      title: 'India completes first phase of solar corridor',
      summary: 'Indian officials described the milestone as on schedule.',
    },
    {
      title: 'Canada and Mexico resume trade discussions',
      summary: 'Ottawa said talks would continue next month.',
    },
    {
      title: 'Global shipping rates ease after months of disruption',
      summary: 'Carriers reported improved schedule reliability.',
    },
    {
      title: 'France announces nuclear plant refurbishment timetable',
      summary: 'The French operator confirmed the outage schedule.',
    },
    {
      title: 'Australia sets new emissions reporting rules for large firms',
      summary: 'Australian regulators published the final guidance.',
    },
  ];

  /* Exercises every branch: empty input, the surname heuristic and its
     geographic-prefix escape, localized names, ISO2/ISO3, context-term
     saturation, punctuation and multi-space normalization. */
  const ADVERSARIAL: Array<Pick<NewsArticle, 'title' | 'summary'>> = [
    { title: '', summary: '' },
    { title: 'Chad', summary: '' },
    { title: '', summary: 'Chad Johnson, the veteran spokesman, said the policy would change.' },
    {
      title: 'Markets steady',
      summary: 'Chad Johnson, a spokesman for the ministry, confirmed the report.',
    },
    {
      title: 'South Sudan peace talks resume',
      summary: 'The president met citizens near the border.',
    },
    {
      title: 'North Macedonia joins the programme',
      summary: 'Officials in the capital confirmed the state would participate.',
    },
    { title: 'Polska podpisala umowe', summary: 'Rzad w Warszawie potwierdzil porozumienie.' },
    {
      title: 'Niemcy i Francja uzgodnily plan',
      summary: 'Rzady obu krajow potwierdzily wspolprace.',
    },
    { title: 'USA and GBR sign accord', summary: 'The US delegation met the UK team.' },
    {
      title: 'Report: government, president, capital, army, military, border',
      summary: 'citizens nationals country state',
    },
    { title: 'Punctuation!!! Kenya??? ...Kenyan---government', summary: 'Multi   spaced    text.' },
    {
      title: 'The Republic of Korea and Cote d Ivoire met',
      summary: 'Both delegations issued statements.',
    },
    {
      title: 'Jane Ireland spoke to reporters',
      summary: 'Jane Ireland, a spokesman, addressed the press.',
    },
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
    Golden master. One entry per CORPUS article, in order.
    `iso2:score:relevantCount`, or `-` for an article no country claims. Compact
    deliberately: 52 expanded object literals obscure the one line that differs.

    RE-BASELINED ONCE, UNDER CTO-AUTHORIZED G2 CORRECTION A — NOT WEAKENED.

    This master was generated from the pre-optimization implementation and has
    held unchanged through the M66.14B prepared-text refactor, which is exactly
    what it exists to prove. Correction A is the first DELIBERATE semantic change
    since: a curated city now counts as the country reference it already is.

    Two of the twenty-six entries move, and both are recorded below rather than
    quietly absorbed. PRE_CORRECTION_GOLDEN keeps the old values in the file, and
    the delta test below proves the change is exactly what was authorized and
    nothing more — same winner, same relevant-country count, score only up, and
    only for articles that actually contain a curated city.
  */
  const PRE_CORRECTION_GOLDEN: Record<'en' | 'pl', string> = {
    en: 'KE:65:1|DE:60:1|PL:65:2|-|JP:60:1|BR:60:1|-|IN:60:1|CA:60:2|-|FR:60:1|AU:60:1|-|TD:60:1|-|-|SD:80:2|MK:70:1|-|-|-|-|KE:65:1|CI:60:1|IE:90:1|NZ:90:1',
    pl: 'KE:65:1|DE:60:1|PL:65:2|-|JP:60:1|BR:60:1|-|IN:60:1|CA:60:2|-|FR:60:1|AU:60:1|-|TD:60:1|-|-|SD:80:2|MK:70:1|PL:60:1|FR:60:2|-|-|KE:65:1|CI:60:1|IE:90:1|NZ:90:1',
  };

  /*
    LAYER 2 — after CTO-authorized G2 CORRECTION A (curated cities), before
    CORRECTION B. Kept so each authorized step stays separately auditable.
      [2] 'Warsaw confirmed…' counts for Poland: 65 -> 95
      [8] 'Ottawa said…'      counts for Canada: 60 -> 90
  */
  const GOLDEN_AFTER_CITIES: Record<'en' | 'pl', string> = {
    en: 'KE:65:1|DE:60:1|PL:95:2|-|JP:60:1|BR:60:1|-|IN:60:1|CA:90:2|-|FR:60:1|AU:60:1|-|TD:60:1|-|-|SD:80:2|MK:70:1|-|-|-|-|KE:65:1|CI:60:1|IE:90:1|NZ:90:1',
    pl: 'KE:65:1|DE:60:1|PL:95:2|-|JP:60:1|BR:60:1|-|IN:60:1|CA:90:2|-|FR:60:1|AU:60:1|-|TD:60:1|-|-|SD:80:2|MK:70:1|PL:60:1|FR:60:2|-|-|KE:65:1|CI:60:1|IE:90:1|NZ:90:1',
  };

  /*
    LAYER 3 — CURRENT, after CTO-authorized G2 CORRECTION B.

    Two delta classes, both audited by the guards below and by nothing else:

    (a) SUMMARY DEMONYM, +25. Seven articles name their country in the TITLE and
        its demonym in the SUMMARY ('The Kenyan government…', 'German
        factories…', 'The Japanese ministry…', 'Brazilian authorities…',
        'Indian officials…', 'The French operator…', 'Australian regulators…').
        Winner and relevant-count unchanged in every case; only the score rises.
          [0] KE 65 -> 90   [1] DE 60 -> 85   [4] JP 60 -> 85   [5] BR 60 -> 85
          [7] IN 60 -> 85   [10] FR 60 -> 85  [11] AU 60 -> 85

    (b) THE SOUTH SUDAN FIX, the defect CTO ordered corrected.
          [16] SD:80:2 -> SS:80:1
        'South Sudan peace talks resume' resolved to SUDAN, because ' sudan ' is
        a whole phrase inside ' south sudan ' and the resulting 80-80 tie was
        won on COUNTRIES declaration order. Sudan is no longer relevant to it at
        all, which is why the relevant-count drops to 1.
  */
  const GOLDEN: Record<'en' | 'pl', string> = {
    en: 'KE:90:1|DE:85:1|PL:95:2|-|JP:85:1|BR:85:1|-|IN:85:1|CA:90:2|-|FR:85:1|AU:85:1|-|TD:60:1|-|-|SS:80:1|MK:70:1|-|-|-|-|KE:65:1|CI:60:1|IE:90:1|NZ:90:1',
    pl: 'KE:90:1|DE:85:1|PL:95:2|-|JP:85:1|BR:85:1|-|IN:85:1|CA:90:2|-|FR:85:1|AU:85:1|-|TD:60:1|-|-|SS:80:1|MK:70:1|PL:60:1|FR:60:2|-|-|KE:65:1|CI:60:1|IE:90:1|NZ:90:1',
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

  /*
    ── RE-BASELINED FOR MADAGASCAR, AND THIS IS NOT GUARD DEBT ───────────────

    AUTHORISED by the Product Owner after G independently verified the exact
    MG/MDG restoration.

    REASON: `shared/src/countries.ts` regained Madagascar, recovered verbatim
    from formal C55. `COUNTRIES` is an input to this loop, so the combination
    space grew by one country:

        26 articles x 195 countries x 4 languages = 20,280   (before)
        26 articles x 196 countries x 4 languages = 20,384   (now)

    OLD DIGEST, RETAINED:
        630690c80472f5f3f939fe3787966ab9b2a198619d2f3eae9db5da64b723b3d4

    It is not merely recorded in this comment — the test immediately below
    ASSERTS it still holds over the pre-Madagascar 195 countries. So the whole
    difference between the two digests is the new MG rows, and NO OTHER SEARCH
    SEMANTIC CHANGED. The per-article golden above — winner, score and
    relevant-count for all 26 articles in both languages — is untouched and
    still passes, which says the same thing a second way.
  */
  it('reproduces the pre-optimization result for all 20,384 combinations, including every reasons string', () => {
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
    expect(hash.digest('hex')).toBe(
      // Re-baselined per authorized correction; every prior value kept here so
      // no re-baseline can ever be silent.
      //   pre-Correction-A: 500212da806b577d1c1e2c871c55927af627314fffb66d3927a598828e8dbd48
      //   post-Correction-A: 054a50b289b57e04ff0db73c92480ed25690f806fa006f277e3283e93235a827
      '4a19aa38005f9411bdfa397b015da7b6596f3da284d19d5e261c8dfe9d47f575',
    );
  });

  /*
    ── THE DIGEST MOVED, AND THIS IS THE PROOF OF WHY ────────────────────────

    R8 restored MADAGASCAR to `shared/src/countries.ts` (195 -> 196 entries),
    recovered verbatim from formal C55. `COUNTRIES` is an input to the loop
    above, so one more country means one more row in the hashed stream and a
    different digest. THAT IS A SEMANTIC INPUT CHANGING, not a regression — but
    "the input changed" is a claim, and a golden digest is worthless if it may
    be re-minted whenever it disagrees.

    SO THE OLD DIGEST IS NOT DISCARDED. It is asserted here over exactly the 195
    countries that existed before, and it still holds. Measured: every score,
    every isRelevant and every reasons string for every pre-existing country is
    byte-identical. The entire difference between the two digests is the MG rows
    that did not exist before.

    The per-article golden above — winner, score and relevant-count for all 26
    articles in both languages — is UNCHANGED and still passes, which is the
    second, independent statement that Madagascar wins nothing it should not.
  */
  it('THE OLD DIGEST STILL HOLDS over the pre-Madagascar registry — the delta is only the new rows', () => {
    const hash = createHash('sha256');
    let comparisons = 0;

    for (const language of ['en', 'pl', undefined, 'de'] as Array<LanguageCode | undefined>) {
      CORPUS.forEach((article, index) => {
        for (const country of COUNTRIES.filter((candidate) => candidate.iso3 !== 'MDG')) {
          const result = scoreCountryRelevance(article, country, language);
          hash.update(
            `${language}|${index}|${country.iso2}|${result.score}|${result.isRelevant}|${result.reasons.join(';')}\n`,
          );
          comparisons += 1;
        }
      });
    }

    expect(comparisons).toBe(CORPUS.length * (COUNTRIES.length - 1) * 4);
    expect(hash.digest('hex')).toBe(
      '630690c80472f5f3f939fe3787966ab9b2a198619d2f3eae9db5da64b723b3d4',
    );
  });

  it('Madagascar is actually in the registry — this control is not vacuous', () => {
    expect(COUNTRIES.some((country) => country.iso3 === 'MDG')).toBe(true);
    /*
      196, NOT 197 — and the difference is a grep I got wrong first time.
      `grep -c "iso3:"` on `countries.ts` returns one more than the array
      holds, because `CountryMeta` DECLARES the field as well. The registry
      went 195 -> 196 with Madagascar; formal C55 also holds 196. The GAP was
      always exactly one country, which is what mattered, but the absolute
      numbers I first reported were inflated by the interface line.
    */
    expect(COUNTRIES).toHaveLength(196);
  });

  /*
    THE LAYERED CONVERSION GUARD.

    Every authorized correction that moves this master must declare exactly
    which entries it moves and why, as a DIFF against the layer before it. A
    future re-baseline cannot be silent: it either satisfies one of these
    guards or it fails them, and failing them is the intended signal.
  */
  it('G2 CORRECTION A — the ONLY layer-1 -> layer-2 changes are score increases on the SAME winner, driven by a curated city', () => {
    const CURATED_CITY_ARTICLE_INDICES = [2, 8];
    let changed = 0;

    for (const language of ['en', 'pl'] as const) {
      const before = PRE_CORRECTION_GOLDEN[language].split('|');
      const after = GOLDEN_AFTER_CITIES[language].split('|');

      expect(after).toHaveLength(before.length);

      after.forEach((encoded, index) => {
        if (encoded === before[index]) {
          return;
        }

        changed += 1;

        expect({ language, index, expected: CURATED_CITY_ARTICLE_INDICES.includes(index) }).toEqual(
          { language, index, expected: true },
        );

        const wasResult = expected(before[index]);
        const isResult = expected(encoded);

        expect({ language, index, winner: isResult.winner, count: isResult.relevantCount }).toEqual({
          language,
          index,
          winner: wasResult.winner,
          count: wasResult.relevantCount,
        });
        expect(isResult.score).toBeGreaterThan(wasResult.score);
      });
    }

    expect(changed).toBe(CURATED_CITY_ARTICLE_INDICES.length * 2);
  });

  it('G2 CORRECTION B — layer-2 -> layer-3 moves exactly two classes: summary demonyms, and the South Sudan fix', () => {
    const SUMMARY_DEMONYM_INDICES = [0, 1, 4, 5, 7, 10, 11];
    const SOUTH_SUDAN_INDEX = 16;
    let demonymChanges = 0;
    let southSudanChanges = 0;

    for (const language of ['en', 'pl'] as const) {
      const before = GOLDEN_AFTER_CITIES[language].split('|');
      const after = GOLDEN[language].split('|');

      expect(after).toHaveLength(before.length);

      after.forEach((encoded, index) => {
        if (encoded === before[index]) {
          return;
        }

        const wasResult = expected(before[index]);
        const isResult = expected(encoded);

        if (index === SOUTH_SUDAN_INDEX) {
          southSudanChanges += 1;

          // The defect and its correction, stated exactly.
          expect({ language, was: wasResult.winner, is: isResult.winner }).toEqual({
            language,
            was: 'SD',
            is: 'SS',
          });
          // Sudan stops being relevant at all — it is not merely out-ranked.
          expect(isResult.relevantCount).toBe(wasResult.relevantCount - 1);
          expect(isResult.score).toBe(wasResult.score);
          return;
        }

        demonymChanges += 1;

        // Everything else that moved is a summary demonym, and may ONLY raise
        // the score of the country that was already winning.
        expect({ language, index, expected: SUMMARY_DEMONYM_INDICES.includes(index) }).toEqual({
          language,
          index,
          expected: true,
        });
        expect({ language, index, winner: isResult.winner, count: isResult.relevantCount }).toEqual({
          language,
          index,
          winner: wasResult.winner,
          count: wasResult.relevantCount,
        });
        // +25 exactly — the authorized summary-demonym weight, not a range.
        expect(isResult.score - wasResult.score).toBe(25);
      });
    }

    // Non-vacuous, and exactly the classes claimed — no more, no fewer.
    expect(demonymChanges).toBe(SUMMARY_DEMONYM_INDICES.length * 2);
    expect(southSudanChanges).toBe(2);
  });

  it('every corpus article outside those declared classes is byte-identical across ALL THREE layers', () => {
    const MOVED = new Set([0, 1, 2, 4, 5, 7, 8, 10, 11, 16]);

    for (const language of ['en', 'pl'] as const) {
      const layer1 = PRE_CORRECTION_GOLDEN[language].split('|');
      const layer3 = GOLDEN[language].split('|');

      layer3.forEach((encoded, index) => {
        if (MOVED.has(index)) {
          return;
        }

        expect({ language, index, encoded }).toEqual({ language, index, encoded: layer1[index] });
      });
    }
  });

  it('articleMentionsCity is untouched — containsWholePhrase keeps its public behaviour', () => {
    expect(articleMentionsCity(CORPUS[0], 'nairobi')).toBe(true);
    expect(articleMentionsCity(CORPUS[0], 'warsaw')).toBe(false);
    expect(articleMentionsCity(CORPUS[0], '')).toBe(false);
    expect(
      articleMentionsCity({ title: 'Report from NAIROBI, today', summary: '' }, 'nairobi'),
    ).toBe(true);
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
  const POLISH_ARTICLE = {
    title: 'Polska podpisala umowe',
    summary: 'Rzad w Warszawie potwierdzil porozumienie.',
  };

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

/* ───────────── G2 CORRECTION A — CURATED CITY GEOGRAPHIC RESOLUTION ───────────── */

describe('G2 Correction A — a curated city resolves its own country, and nothing else', () => {
  const byIso2 = (iso2: string): CountryMeta => {
    const country = COUNTRIES.find((candidate) => candidate.iso2 === iso2);

    if (!country) {
      throw new Error(`Test fixture error: ${iso2} is not in COUNTRIES.`);
    }

    return country;
  };

  const ukraine = byIso2('UA');
  const germany = byIso2('DE');
  const unitedStates = byIso2('US');
  const france = byIso2('FR');
  const india = byIso2('IN');
  const japan = byIso2('JP');
  const china = byIso2('CN');

  /*
    THE POINT OF THE WHOLE CORRECTION. Each of these named a country the
    repository could already resolve, and each returned nothing before.
  */
  it('SUCCESSFUL MATCHES — a city in the TITLE scores as a country reference in the title', () => {
    const cases: Array<[string, string, CountryMeta]> = [
      ['Kyiv says talks on the grain corridor will resume next week', 'Negotiators are expected to meet again.', ukraine],
      ['Berlin coalition agrees on a new energy subsidy package', 'The measure takes effect in January.', germany],
      ['Beijing reports stronger third-quarter exports', 'Demand rose across south-east Asia.', china],
      ['Tokyo signals it is ready to act on the currency', 'Traders expect intervention.', japan],
      ['New Delhi unveils a rail investment plan', 'The programme will run for five years.', india],
    ];

    for (const [title, summary, country] of cases) {
      const result = scoreCountryRelevance({ title, summary }, country);

      expect({ title, score: result.score, isRelevant: result.isRelevant }).toEqual({
        title,
        score: 60,
        isRelevant: true,
      });
      expect(result.reasons).toContain('country reference appears in title');
    }
  });

  it('SUCCESSFUL MATCH — a city in the SUMMARY scores exactly as a country name there would', () => {
    const withCity = scoreCountryRelevance(
      { title: 'Farmers block motorways in a widening protest', summary: 'Demonstrations spread from Paris to the south.' },
      france,
    );
    const withName = scoreCountryRelevance(
      { title: 'Farmers block motorways in a widening protest', summary: 'Demonstrations spread from France to the south.' },
      france,
    );

    // Same weight, same scale — the city is not a new signal on a new axis.
    expect(withCity.score).toBe(withName.score);
    expect(withCity.reasons).toContain('country reference appears in summary');
  });

  it('BOTH SPELLINGS the repository curates resolve the same country', () => {
    for (const city of ['Kyiv', 'Kiev']) {
      expect(
        scoreCountryRelevance({ title: `${city} confirms the schedule`, summary: 'Officials gave no further detail.' }, ukraine)
          .isRelevant,
      ).toBe(true);
    }
  });

  it('A CITY NEVER RESOLVES A COUNTRY THAT DOES NOT OWN IT', () => {
    const article = { title: 'Berlin coalition agrees on a new energy subsidy package', summary: 'The measure takes effect in January.' };

    // Germany owns 'berlin'. Nobody else may claim it.
    expect(scoreCountryRelevance(article, germany).isRelevant).toBe(true);

    for (const other of [ukraine, france, unitedStates, china, japan]) {
      expect({ iso2: other.iso2, relevant: scoreCountryRelevance(article, other).isRelevant }).toEqual({
        iso2: other.iso2,
        relevant: false,
      });
    }
  });

  it('WHOLE-PHRASE ONLY — a city may not match as a substring of a longer word', () => {
    expect(
      scoreCountryRelevance(
        { title: 'Parisian bakeries report a quiet summer', summary: 'Trade groups described the season as slow.' },
        france,
      ).isRelevant,
    ).toBe(false);
  });

  it('LOCATION UNRESOLVED IS PRESERVED — a genuinely placeless article still scores zero', () => {
    for (const country of [ukraine, germany, unitedStates, france, india, japan, china]) {
      const result = scoreCountryRelevance(
        {
          title: 'Global markets steady after coordinated central bank statement',
          summary: 'Analysts described the move as procedural.',
        },
        country,
      );

      expect({ iso2: country.iso2, relevant: result.isRelevant }).toEqual({
        iso2: country.iso2,
        relevant: false,
      });
    }
  });

  it('NO THRESHOLD MOVED — a summary-only reference still scores 30 and is still not relevant', () => {
    const result = scoreCountryRelevance(
      { title: 'Exports rebound in the third quarter', summary: 'Officials in Berlin welcomed the figures.' },
      germany,
    );

    expect(result.score).toBe(30);
    expect(result.isRelevant).toBe(false);
  });
});

describe('G2 Correction A — person-name collisions are rejected, and only those', () => {
  const byIso2 = (iso2: string): CountryMeta => {
    const country = COUNTRIES.find((candidate) => candidate.iso2 === iso2);

    if (!country) {
      throw new Error(`Test fixture error: ${iso2} is not in COUNTRIES.`);
    }

    return country;
  };

  const unitedStates = byIso2('US');
  const france = byIso2('FR');
  const germany = byIso2('DE');
  const russia = byIso2('RU');

  it('REJECTED — the city as a SURNAME, with or without person context', () => {
    expect(
      scoreCountryRelevance(
        {
          title: 'Denzel Washington returns to the stage',
          summary: 'The actor said the run will last twelve weeks.',
        },
        unitedStates,
      ).isRelevant,
    ).toBe(false);

    expect(
      scoreCountryRelevance(
        { title: 'Irving Berlin retrospective opens', summary: 'The singer’s catalogue is performed in full.' },
        germany,
      ).isRelevant,
    ).toBe(false);
  });

  it('REJECTED — the city as a FORENAME, with or without person context', () => {
    expect(
      scoreCountryRelevance(
        { title: 'Paris Hilton launches a new venture', summary: 'The actress described it as a long-term project.' },
        france,
      ).isRelevant,
    ).toBe(false);
  });

  it('NOT REJECTED — a geographic preposition settles it as a place, whatever follows', () => {
    // 'in Paris' is a location even though 'Paris Hilton' shape and person
    // context are both present in the same article.
    expect(
      scoreCountryRelevance(
        {
          title: 'Talks continue in Paris Thursday',
          summary: 'A senior doctor briefed delegates on the health annexe.',
        },
        france,
      ).isRelevant,
    ).toBe(true);
  });

  /*
    CONVERTED UNDER CTO-APPROVED MILESTONE 27 REGRESSION CORRECTION.

    THIS ASSERTION WAS THE DEFECT, WRITTEN DOWN. It required 'Berlin Wall',
    'Tokyo Olympics' and 'Moscow Exchange' to resolve, on the reasoning that
    with no PERSON context a capitalised word beside a city is ordinary prose.
    'Kigali Coffee Co. opens new location' is the same construction and the same
    reasoning let it through — scoring 65 for Rwanda and breaking Milestone 27's
    authoritative assertion in CountryNewsService.

    All four are proper names built on a city. The guard is now structural:
    adjacency to a capitalised word, not personhood. These three flip to
    REJECTED, which the CTO approved explicitly, and they fail CLOSED — such an
    article can still resolve on other evidence, as the control below shows.
  */
  it('REJECTED — organisation and monument names built on a city, exactly like personal names', () => {
    const cases: Array<[string, string, CountryMeta]> = [
      ['Berlin Wall anniversary marked across the city', 'Ceremonies ran through the afternoon.', germany],
      ['Tokyo Olympics venues find new tenants', 'Operators confirmed the leases.', byIso2('JP')],
      ['Moscow Exchange extends trading hours', 'The change applies from Monday.', russia],
      ['Kigali Coffee Co. opens new location', 'The cafe chain expanded to a third city.', byIso2('RW')],
    ];

    for (const [title, summary, country] of cases) {
      expect({ title, relevant: scoreCountryRelevance({ title, summary }, country).isRelevant }).toEqual({
        title,
        relevant: false,
      });
    }
  });

  it('NON-VACUOUS — every city rejected above still resolves under clear locative use', () => {
    const cases: Array<[string, string, CountryMeta]> = [
      ['Berlin coalition agrees on the energy package', 'It takes effect in January.', germany],
      ['Tokyo signals it is ready to act on the currency', 'Traders expect intervention.', byIso2('JP')],
      ['Moscow confirmed the agreement on Tuesday', 'Both sides issued statements.', russia],
      ['Kigali hosts the regional summit', 'Officials gathered for two days.', byIso2('RW')],
    ];

    for (const [title, summary, country] of cases) {
      expect({ title, relevant: scoreCountryRelevance({ title, summary }, country).isRelevant }).toEqual({
        title,
        relevant: true,
      });
    }
  });

  /*
    CONVERTED: multi-word cities are no longer exempt from the guard. The old
    exemption reasoned they cannot be PERSONAL names — true, and irrelevant,
    since they can certainly be organisation names. What must hold is that
    locative use still works, which is what this now proves.
  */
  it('MULTI-WORD CURATED CITIES still read as places in locative use', () => {
    expect(
      scoreCountryRelevance(
        { title: 'New Delhi hosts the summit', summary: 'The president arrived on Tuesday.' },
        byIso2('IN'),
      ).isRelevant,
    ).toBe(true);
  });

  it('THE COUNTRY-NAME SURNAME GUARD IS UNTOUCHED — it still fires exactly as before', () => {
    // The pre-existing isLikelySurnameOnlyMention() path, unchanged by this work.
    const result = scoreCountryRelevance(
      { title: 'Local team wins the final', summary: 'The student Ryan Chad scored twice in the second half.' },
      byIso2('TD'),
    );

    expect(result.isRelevant).toBe(false);
  });
});

/* ═════════ G2 CORRECTION B — DEMONYM RESOLUTION, END TO END ═════════════════ */

/*
  These exercise the WHOLE resolver — resolvePrimaryCountry() over all 195
  countries — rather than a single country's score, because every requirement
  the CTO set is about which country wins, or about no country winning.

  Every CTO-required example appears here by name.
*/
describe('G2 Correction B — the resolver end to end', () => {
  const resolve = (title: string, summary: string): string | null =>
    resolvePrimaryCountry({ title, summary })?.countryCode ?? null;

  describe('REGRESSION — everything that resolved before still resolves', () => {
    it('a country NAME in the title still resolves, unchanged', () => {
      expect(resolve('Nigeria central bank raises benchmark rate', 'The naira fell sharply.')).toBe(
        'NG',
      );
      expect(resolve('Brazil expands Amazon monitoring programme', 'Coverage would double.')).toBe(
        'BR',
      );
    });

    it('CORRECTION A — a curated CITY still resolves its own country', () => {
      expect(resolve('Kyiv says talks on grain corridor resume', 'Negotiators meet next week.')).toBe(
        'UA',
      );
      expect(resolve('Berlin coalition agrees on energy subsidies', 'It starts in January.')).toBe(
        'DE',
      );
      expect(resolve('New Delhi unveils a rail investment plan', 'It runs for five years.')).toBe(
        'IN',
      );
    });

    it('CORRECTION A — the person-name guard still rejects a city used as a name', () => {
      expect(
        resolve('Denzel Washington returns to the stage', 'The actor said the run lasts weeks.'),
      ).toBeNull();
      expect(
        resolve('Paris Hilton launches a new venture', 'The actress called it long-term.'),
      ).toBeNull();
    });
  });

  describe('SAFE DEMONYMS RESOLVE', () => {
    it('a Tier 1 demonym in the title resolves at exactly 45', () => {
      const cases: Array<[string, string, string]> = [
        ['Ukrainian forces repel an overnight drone strike', 'Air defences intercepted most.', 'UA'],
        ['Pakistani regulators publish the final guidance', 'It applies from Monday.', 'PK'],
        ['Kenyan operators expand the payments framework', 'The rollout begins next month.', 'KE'],
        ['Australian firms face new emissions reporting', 'The rules start in July.', 'AU'],
      ];

      for (const [title, summary, iso2] of cases) {
        const result = resolvePrimaryCountry({ title, summary });
        expect({ title, iso2: result?.countryCode ?? null, score: result?.score ?? null }).toEqual({
          title,
          iso2,
          score: 45,
        });
      }
    });

    it('a Tier 2 demonym resolves too, once its compound guard is satisfied', () => {
      expect(resolve('Israeli strikes hit Gaza as talks stall', 'Mediators saw movement.')).toBe(
        'IL',
      );
      expect(resolve('Japanese yen slides to a fresh low', 'Traders expect intervention.')).toBe(
        'JP',
      );
      expect(resolve('French farmers block motorways', 'Protests spread through the region.')).toBe(
        'FR',
      );
    });

    it('a demonym in the SUMMARY ALONE is not enough — 25 is below the threshold', () => {
      // Deliberately conservative: a passing nationality mention must not put a
      // marker on a map by itself.
      expect(resolve('Quarterly figures published', 'Ukrainian officials welcomed them.')).toBeNull();
    });
  });

  describe('CTO RULE — explicit geography OUTRANKS demonym evidence', () => {
    it('Chinese-owned factory opens in Kenya -> Kenya', () => {
      expect(resolve('Chinese-owned factory opens in Kenya', 'It will employ 400 people.')).toBe(
        'KE',
      );
    });

    it('Ukrainian refugees settle in Poland -> Poland', () => {
      expect(resolve('Ukrainian refugees settle in Poland', 'Councils said housing is stretched.')).toBe(
        'PL',
      );
    });

    it('the ranking is structural, not incidental — a place scores 60, a demonym 45', () => {
      const kenya = COUNTRIES.find((c) => c.iso2 === 'KE') as CountryMeta;
      const china = COUNTRIES.find((c) => c.iso2 === 'CN') as CountryMeta;
      const article = {
        title: 'Chinese-owned factory opens in Kenya',
        summary: 'It will employ 400 people.',
      };

      expect(scoreCountryRelevance(article, kenya).score).toBe(60);
      expect(scoreCountryRelevance(article, china).score).toBe(45);
      expect(scoreCountryRelevance(article, kenya).reasons).toContain(
        'country reference appears in title',
      );
      expect(scoreCountryRelevance(article, china).reasons).toContain('demonym appears in title');
    });
  });

  describe('CTO RULE — the South Sudan defect is fixed', () => {
    it('South Sudanese refugees... -> South Sudan, never Sudan', () => {
      expect(resolve('South Sudanese refugees cross the border', 'Arrivals rose sharply.')).toBe(
        'SS',
      );
    });

    it('South Sudan peace talks... -> South Sudan, never Sudan', () => {
      expect(resolve('South Sudan peace talks resume', 'The president met citizens.')).toBe('SS');
    });

    it('a genuine Sudan article still resolves to Sudan', () => {
      expect(resolve('Sudan announces a new transitional council', 'Officials confirmed it.')).toBe(
        'SD',
      );
    });

    it('the same longest-name rule fixes Congo and Guinea, which share the defect', () => {
      expect(resolve('DR Congo announces mining reform', 'Officials confirmed the timetable.')).toBe(
        'CD',
      );
      expect(resolve('Papua New Guinea signs the accord', 'The prime minister attended.')).toBe('PG');
      // And the shorter names still work on their own.
      expect(resolve('Guinea holds the vote in October', 'The commission published the roll.')).toBe(
        'GN',
      );
    });
  });

  describe('CTO RULE — non-locative compounds do not resolve', () => {
    it('rejects the compound while the plain demonym still works', () => {
      const cases: Array<[string, string]> = [
        ['German shepherd rescued from the canal', 'The dog was returned to its owner.'],
        ['Danish pastry sales rise across the chain', 'The bakery said margins improved.'],
        ['Russian roulette scene cut from the film', 'The board cited the depiction.'],
        ['The Indian Ocean is warming faster than modelled', 'Researchers published the finding.'],
        ['Swiss cheese exports climb again', 'Producers reported higher volumes.'],
        ['Greek yogurt drives the category', 'Retailers reported stronger demand.'],
      ];

      for (const [title, summary] of cases) {
        expect({ title, resolved: resolve(title, summary) }).toEqual({ title, resolved: null });
      }
    });

    it('NON-VACUOUS — the same demonyms resolve when NOT in a compound', () => {
      expect(resolve('German factories report a second monthly decline', 'Output fell.')).toBe('DE');
      expect(resolve('Russian output steadies after the cut', 'Producers confirmed it.')).toBe('RU');
      expect(resolve('Indian officials described the milestone', 'It is on schedule.')).toBe('IN');
    });
  });

  describe('CTO RULE — capitalisation protects against lexical false positives', () => {
    it('nail polish... -> unresolved', () => {
      expect(resolve('Nail polish sales rebound in the quarter', 'Retailers saw demand.')).toBeNull();
    });

    it('an afghan (the blanket) -> unresolved', () => {
      expect(resolve('An afghan was draped over the sofa', 'The auction listed textiles.')).toBeNull();
    });

    it('NON-VACUOUS — capitalised, the same words resolve', () => {
      expect(resolve('Polish border works enter a second phase', 'Contractors confirmed.')).toBe(
        'PL',
      );
      expect(resolve('Afghan officials confirmed the crossing', 'Traffic resumed on Tuesday.')).toBe(
        'AF',
      );
    });

    it("an ISO code is only a code when written as one — 'in', 'can', 'and', 'are' are not countries", () => {
      const prose = {
        title: 'The board can and are expected to meet',
        summary: 'Officials said it is so, per the notes.',
      };

      for (const iso2 of ['IN', 'CA', 'AD', 'AE', 'IT', 'IS', 'SO', 'TO', 'PE']) {
        const country = COUNTRIES.find((c) => c.iso2 === iso2) as CountryMeta;
        expect({ iso2, score: scoreCountryRelevance(prose, country).score }).toEqual({
          iso2,
          score: 0,
        });
      }

      // NON-VACUOUS: a real uppercase code still scores exactly what it did.
      const usa = COUNTRIES.find((c) => c.iso2 === 'US') as CountryMeta;
      const coded = { title: 'USA and GBR sign accord', summary: 'The delegations met.' };
      expect(scoreCountryRelevance(coded, usa).reasons).toContain('ISO3 code appears');
    });
  });

  describe('CTO RULE — ambiguity fails closed', () => {
    it('ambiguous shared demonyms resolve to NOTHING', () => {
      const cases: Array<[string, string]> = [
        ['Korean talks stall again', 'Delegations left without a statement.'],
        ['Congolese mining output rises', 'Producers reported higher volumes.'],
        ['Dominican tourism receipts climb', 'Operators reported a strong season.'],
        ['American Airlines cancels 200 flights', 'The carrier blamed crew shortages.'],
        ['Georgian architecture draws new interest', 'Buyers cited the period detail.'],
      ];

      for (const [title, summary] of cases) {
        expect({ title, resolved: resolve(title, summary) }).toEqual({ title, resolved: null });
      }
    });

    it('EQUAL competing demonym evidence resolves to NOTHING — declaration order never decides', () => {
      expect(
        resolve('Indian students face new Canadian visa rules', 'The change takes effect in March.'),
      ).toBeNull();
    });

    it('EQUAL competing PLACE evidence also resolves to nothing, for the same reason', () => {
      expect(
        resolve('Russia and India expand energy cooperation', 'Both sides confirmed the deal.'),
      ).toBeNull();
    });

    it('but an unequal contest still has a winner — failing closed is not failing always', () => {
      // Poland is named AND its city is in the summary; Lithuania is only named.
      expect(
        resolve(
          'Poland and Lithuania agree on border infrastructure funding',
          'Warsaw confirmed the joint programme on Tuesday.',
        ),
      ).toBe('PL');
    });
  });

  describe('CTO RULE — placeless stories stay unresolved', () => {
    it('an article with no geography resolves to nothing', () => {
      const cases: Array<[string, string]> = [
        ['Global markets steady after a coordinated statement', 'Analysts called it procedural.'],
        ['Open-source model claims parity with frontier systems', 'Results are unreproduced.'],
        ['New study links sleep patterns to metabolic health', 'Participants were followed.'],
        ['Global shipping rates ease after months of disruption', 'Reliability improved.'],
      ];

      for (const [title, summary] of cases) {
        expect({ title, resolved: resolve(title, summary) }).toEqual({ title, resolved: null });
      }
    });
  });

  describe('the table itself', () => {
    it('the three ambiguous roots are ABSENT, and only their explicit forms are present', () => {
      const source = readFileSync(join(__dirname, 'country-relevance.util.ts'), 'utf-8');
      const table = /const COUNTRY_DEMONYMS[\s\S]*?\n};/.exec(source);

      expect(table).not.toBeNull();

      for (const banned of ["'korean'", "'congolese'", "'guinean'", "'dominican'", "'american'", "'georgian'", "'english'"]) {
        expect({ banned, present: table![0].includes(banned) }).toEqual({ banned, present: false });
      }

      for (const required of ["'south korean'", "'north korean'", "'south sudanese'", "'papua new guinean'"]) {
        expect({ required, present: table![0].includes(required) }).toEqual({
          required,
          present: true,
        });
      }
    });

    it('no demonym is claimed by two different countries', () => {
      const source = readFileSync(join(__dirname, 'country-relevance.util.ts'), 'utf-8');
      const table = /const COUNTRY_DEMONYMS[\s\S]*?\n};/.exec(source);
      const all = [...table![0].matchAll(/'([a-z ]+)'/g)].map((m) => m[1]);

      expect(all.length).toBeGreaterThan(100);
      expect(new Set(all).size).toBe(all.length);
    });
  });
});

/* ═══ MILESTONE 27 REGRESSION — A CITY TOKEN IS NOT AUTOMATICALLY A LOCATION ═══ */

/*
  CountryNewsService retrieves stored articles by a FREE-TEXT search for the
  city, then filters them with scoreCountryRelevance(...).isRelevant. That
  filter IS Milestone 27's protection. If the same token that retrieved the
  article is also allowed to prove the article is about the country, the check
  is circular and there is no gate at all.

  These live here, at resolver level, because the root cause is here — and the
  authoritative assertion in country-news.service.spec.ts is deliberately left
  untouched.
*/
describe('Milestone 27 — a city inside a proper name may not establish geography', () => {
  const byIso2 = (iso2: string): CountryMeta => {
    const country = COUNTRIES.find((candidate) => candidate.iso2 === iso2);

    if (!country) {
      throw new Error(`Test fixture error: ${iso2} is not in COUNTRIES.`);
    }

    return country;
  };

  const rwanda = byIso2('RW');
  const resolve = (title: string, summary: string): string | null =>
    resolvePrimaryCountry({ title, summary })?.countryCode ?? null;

  it('THE REGRESSION — the exact CountryNewsService fixture no longer manufactures Rwanda', () => {
    const article = {
      title: 'Kigali Coffee Co. opens new location',
      summary: 'The cafe chain expanded to a third city.',
    };

    const result = scoreCountryRelevance(article, rwanda);

    // It scored 65 and was relevant. The city gave +60 and 'city' in the
    // summary is a COUNTRY_CONTEXT_TERM worth +5. Only the +5 may remain.
    expect(result.score).toBe(5);
    expect(result.isRelevant).toBe(false);
    expect(result.reasons).not.toContain('country reference appears in title');

    // And nothing else picks it up either.
    expect(resolve(article.title, article.summary)).toBeNull();
  });

  it('THE CONTRAST — the same city, both ways, in one test', () => {
    // Locative: Kigali is doing the work of a place.
    expect(resolve('Kigali marks anniversary with a national ceremony', 'The capital city held the event.')).toBe(
      'RW',
    );

    // Proper name: Kigali is part of a company's name.
    expect(resolve('Kigali Coffee Co. opens new location', 'The cafe chain expanded to a third city.')).toBeNull();
  });

  it('THE MILESTONE 27 CORPUS still qualifies — every legitimate Kigali fixture', () => {
    const cases: Array<[string, string]> = [
      ['Kigali city council approves new budget', 'The Rwanda capital city council voted today.'],
      ['Kigali hosts regional summit', 'Officials gathered for two days.'],
      ['Kigali transit project breaks ground', 'Construction begins this month.'],
      ['Kigali marks anniversary with Rwanda ceremony', 'The capital city held a national event.'],
    ];

    for (const [title, summary] of cases) {
      expect({ title, resolved: resolve(title, summary) }).toEqual({ title, resolved: 'RW' });
    }
  });

  it('THE RULE IS ADJACENCY, NOT PERSONHOOD — all three name classes fail closed', () => {
    const cases: Array<[string, string, string]> = [
      ['person', 'Denzel Washington returns to the stage', 'The run lasts twelve weeks.'],
      ['person', 'Paris Hilton launches a new venture', 'It is a long-term project.'],
      ['organisation', 'Kigali Coffee Co. opens new location', 'The chain expanded again.'],
      ['organisation', 'Moscow Exchange extends trading hours', 'The change applies Monday.'],
      ['monument', 'Berlin Wall anniversary marked across the city', 'Ceremonies ran all afternoon.'],
      ['event', 'Tokyo Olympics venues find new tenants', 'Operators confirmed the leases.'],
    ];

    // NONE of them carries a person-context term. The old guard rejected only
    // the first two; the structural guard rejects all six.
    for (const [kind, title, summary] of cases) {
      expect({ kind, title, resolved: resolve(title, summary) }).toEqual({
        kind,
        title,
        resolved: null,
      });
    }
  });

  describe('CTO-required locative forms that must keep working', () => {
    it('New Delhi announces ... remains valid geographic evidence', () => {
      expect(resolve('New Delhi announces a rail investment plan', 'It runs for five years.')).toBe(
        'IN',
      );
    });

    it('in New Delhi ... remains valid', () => {
      expect(resolve('Talks conclude in New Delhi', 'Delegations issued a joint statement.')).toBe(
        'IN',
      );
    });

    it('Addis Ababa hosts ... remains valid', () => {
      expect(resolve('Addis Ababa hosts the continental summit', 'Leaders met for three days.')).toBe(
        'ET',
      );
    });

    it('in Addis Ababa ... remains valid', () => {
      expect(resolve('The signing took place in Addis Ababa', 'Both parties confirmed the terms.')).toBe(
        'ET',
      );
    });

    it('a geographic preposition still overrides an adjacent capitalised word', () => {
      expect(resolve('Talks continue in Paris Thursday', 'Delegates met through the evening.')).toBe(
        'FR',
      );
    });
  });

  /*
    THE DOCUMENTED LIMITATION, ASSERTED SO IT CANNOT BE FORGOTTEN.

    In a fully title-cased headline every word is capitalised, so rule 3 cannot
    distinguish a name from a sentence and the city evidence is dropped. This is
    a FALSE NEGATIVE and it is deliberate: it fails closed, the prepositional
    form still works, and the article can still resolve through a country name.

    If a later milestone teaches the guard to recognise title case, THIS TEST
    SHOULD FAIL and be converted. That is the intended signal.
  */
  it('KNOWN LIMITATION — a fully title-cased headline fails closed rather than guessing', () => {
    expect(resolve('Kigali Marks Anniversary With National Ceremony', 'Officials attended.')).toBeNull();

    // Sentence case — the same story — resolves.
    expect(resolve('Kigali marks anniversary with national ceremony', 'Officials attended.')).toBe(
      'RW',
    );

    // And even title-cased, the prepositional form survives.
    expect(resolve('Ceremony Held In Kigali On Tuesday', 'Officials attended.')).toBe('RW');
  });
});
