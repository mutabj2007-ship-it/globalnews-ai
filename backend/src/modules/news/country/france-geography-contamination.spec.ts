/**
 * G-SEARCH-QUALITY-POST-AUTH-PREP-1 — CLASS B.
 *
 * QUERY GEOGRAPHY IS NOT ARTICLE GEOGRAPHY.
 *
 * THE MEASURED FAILURE. "What are the latest developments in France?" returned
 * an Evidence Geography of "France • Israel". Nothing was broken on the way
 * there: the article names France once, scores 85 against France and passes
 * isRelevant; the frontend evidence model reads both admissible bases — the
 * retrieval filter (France) and the article's own resolvePrimaryCountry()
 * (Israel) — and its contract says that when they disagree, BOTH are shown and
 * the disagreement is STATED.
 *
 * So this is not a frontend defect. The backend produced a disagreement it
 * should never have produced, on a path where the reader NAMED the country.
 *
 * THIS SUITE IS DELIBERATELY SEPARATE FROM THE SALIENCE SUITE. The two defects
 * were reported together and are not the same defect: this one is about an
 * article whose subject is ANOTHER country; that one is about articles whose
 * subject really is France and which are merely not developments. A single
 * suite would let a fix for one be mistaken for a fix for the other.
 */
import { COUNTRIES } from '@globalnews-ai/shared';
import { resolvePrimaryCountry, scoreCountryRelevance } from './country-relevance.util';

const FRANCE = COUNTRIES.find((c) => c.iso3 === 'FRA')!;

/** The composed admission rule, stated here exactly as country-news.service applies it. */
const admitted = (article: { title: string; summary: string }, country: typeof FRANCE) => {
  const relevance = scoreCountryRelevance(article, country);
  const primary = resolvePrimaryCountry(article);
  const differentCountry = primary !== undefined && primary.countryCode !== country.iso2;

  return relevance.isRelevant && !differentCountry;
};

const ISRAEL_STORY = {
  title: 'Israel strikes targets as France calls for restraint',
  summary:
    'Israeli forces conducted operations in Israel and the region; the French foreign ministry urged de-escalation.',
};

const GENUINE_FRANCE_STORIES = [
  {
    title: 'France announces new budget as parliament debates pension reform',
    summary: 'The French government presented the finance bill to the National Assembly in Paris.',
  },
  {
    title: 'French president dissolves government after election setback',
    summary: 'France enters a period of political uncertainty as the president names a new prime minister.',
  },
  {
    title: 'Strikes disrupt transport across France for a third day',
    summary: 'Rail and air travel in France were affected as unions extended industrial action.',
  },
];

describe('CLASS B — incidental article geography must not become the query geography', () => {
  it('THE REPORTED FAILURE: the Israel story passes country relevance for France', () => {
    // This is why the defect was invisible: nothing here is a bug.
    const relevance = scoreCountryRelevance(ISRAEL_STORY, FRANCE);

    expect(relevance.isRelevant).toBe(true);
    expect(relevance.score).toBeGreaterThanOrEqual(35);
  });

  it('and it resolves its OWN primary country to Israel, not France', () => {
    const primary = resolvePrimaryCountry(ISRAEL_STORY);

    expect(primary).toBeDefined();
    expect(primary!.countryCode).toBe('IL');
    expect(primary!.countryCode).not.toBe(FRANCE.iso2);
  });

  it('so a France request must NOT admit it', () => {
    expect(admitted(ISRAEL_STORY, FRANCE)).toBe(false);
  });

  it.each(GENUINE_FRANCE_STORIES.map((s, i) => [i + 1, s] as const))(
    'genuine France development %i is still admitted',
    (_i, story) => {
      expect(admitted(story, FRANCE)).toBe(true);
    },
  );

  it('FAIL-CLOSED: an article that resolves to NO country is not excluded', () => {
    // Absence of a competing country is not evidence of a competing country.
    const noCountry = {
      title: 'France and Germany both signal support in equal measure',
      summary: 'France and Germany issued identical statements.',
    };
    const primary = resolvePrimaryCountry(noCountry);

    if (primary === undefined) {
      expect(admitted(noCountry, FRANCE)).toBe(scoreCountryRelevance(noCountry, FRANCE).isRelevant);
    } else {
      // If it does resolve, it must resolve to one of the two it names -- never to nothing else.
      expect(['FR', 'DE']).toContain(primary.countryCode);
    }
  });

  it('THE INVERSION GUARD: the predicate compares alpha-2 to alpha-2', () => {
    // Comparing PrimaryCountryResult.countryCode (alpha-2) against CountryMeta.iso3
    // would make every article "a different country" and silently empty every
    // country feed. This asserts the two sides are the same code space.
    const primary = resolvePrimaryCountry(GENUINE_FRANCE_STORIES[0]);

    expect(primary!.countryCode).toBe(FRANCE.iso2);
    expect(primary!.countryCode).not.toBe(FRANCE.iso3);
  });
});
