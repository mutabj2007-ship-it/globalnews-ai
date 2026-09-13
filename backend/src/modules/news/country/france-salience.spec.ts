/**
 * G-SEARCH-QUALITY-POST-AUTH-PREP-1 — CLASS A.
 *
 * SALIENCE IS NOT RELEVANCE, AND THIS REPOSITORY HAS NO SALIENCE SIGNAL.
 *
 * THE MEASURED FAILURE. "What are the latest developments in France?" returned
 * a FIFA/Infantino item, an Oscar shortlist item and an Iraqi PM visit. The
 * Product Owner rejected them, and they are right to: none is a development IN
 * France.
 *
 * THIS SUITE IS A CHARACTERIZATION, NOT A FIX. It exists to state exactly what
 * the code does today and exactly why the obvious fixes do not work, so the
 * next lane does not spend itself rediscovering that. IT PASSES. A suite that
 * failed would assert a fix nobody has authorized.
 *
 * WHY THE CLASS B FIX DOES NOT REACH THIS. The Class B predicate excludes an
 * article whose own primary country is a DIFFERENT country. These three
 * resolve their primary country to FRANCE -- correctly. They are geographically
 * right and editorially wrong, which is a different axis entirely.
 *
 * WHY A KEYWORD GATE DOES NOT REACH IT EITHER -- MEASURED, NOT ASSUMED. See the
 * last two cases: the already-curated COUNTRY_CONTEXT_TERMS list admits the
 * FIFA story (on "president", meaning the president of FIFA) and rejects a
 * genuine national transport strike (which names no institution at all). It is
 * wrong in BOTH directions on this corpus.
 */
import { COUNTRIES } from '@globalnews-ai/shared';
import { resolvePrimaryCountry, scoreCountryRelevance } from './country-relevance.util';

const FRANCE = COUNTRIES.find((c) => c.iso3 === 'FRA')!;

const REJECTED_BY_PRODUCT_OWNER = [
  {
    id: 'FIFA / Gianni Infantino',
    title: 'FIFA president Gianni Infantino confirms World Cup plans at Paris summit',
    summary: 'Infantino spoke alongside football federation officials in France about the tournament calendar.',
  },
  {
    id: 'Oscar shortlist',
    title: 'Oscar shortlist announced with French entry among international films',
    summary: 'The Academy in Los Angeles revealed the shortlist; France submitted a drama for consideration.',
  },
  {
    id: 'Iraqi PM visit',
    title: 'Iraqi Prime Minister meets French officials during European tour',
    summary: 'The Iraqi PM travelled from Baghdad to Paris for talks on reconstruction and energy.',
  },
];

const GENUINE_FRANCE_DEVELOPMENTS = [
  {
    id: 'budget / pension reform',
    title: 'France announces new budget as parliament debates pension reform',
    summary: 'The French government presented the finance bill to the National Assembly in Paris.',
  },
  {
    id: 'government dissolved',
    title: 'French president dissolves government after election setback',
    summary: 'France enters a period of political uncertainty as the president names a new prime minister.',
  },
  {
    id: 'national transport strike',
    title: 'Strikes disrupt transport across France for a third day',
    summary: 'Rail and air travel in France were affected as unions extended industrial action.',
  },
];

/** Copied verbatim from country-relevance.util.ts. No new vocabulary is introduced here. */
const COUNTRY_CONTEXT_TERMS = [
  'government', 'president', 'capital', 'army', 'military', 'border', 'citizens',
  'nationals', 'country', 'state', 'province', 'city', 'refugees', 'migrants',
  'embassy', 'election', 'parliament', 'economy', 'war', 'conflict', 'peace',
  'humanitarian',
];

const hasContextTerm = (a: { title: string; summary: string }) =>
  COUNTRY_CONTEXT_TERMS.some((w) =>
    new RegExp(`\\b${w}\\b`).test(`${a.title} ${a.summary}`.toLowerCase()),
  );

describe('CLASS A — salience/eligibility, characterized', () => {
  it.each(REJECTED_BY_PRODUCT_OWNER.map((a) => [a.id, a] as const))(
    'THE DEFECT: "%s" passes country relevance for France today',
    (_id, article) => {
      expect(scoreCountryRelevance(article, FRANCE).isRelevant).toBe(true);
    },
  );

  it.each(REJECTED_BY_PRODUCT_OWNER.map((a) => [a.id, a] as const))(
    'and the Class B geography predicate CANNOT exclude "%s" — it really is about France',
    (_id, article) => {
      const primary = resolvePrimaryCountry(article);

      // Not a different country. Class B is silent here, by construction.
      expect(primary === undefined || primary.countryCode === FRANCE.iso2).toBe(true);
    },
  );

  it.each(GENUINE_FRANCE_DEVELOPMENTS.map((a) => [a.id, a] as const))(
    'control: genuine development "%s" is relevant and resolves to France',
    (_id, article) => {
      expect(scoreCountryRelevance(article, FRANCE).isRelevant).toBe(true);
      expect(resolvePrimaryCountry(article)!.countryCode).toBe(FRANCE.iso2);
    },
  );

  it('A KEYWORD GATE IS WRONG IN BOTH DIRECTIONS — false positive', () => {
    const fifa = REJECTED_BY_PRODUCT_OWNER[0];

    // "president" matches -- the president of FIFA. A curated institution list
    // cannot tell a head of state from the head of a football federation.
    expect(hasContextTerm(fifa)).toBe(true);
  });

  it('A KEYWORD GATE IS WRONG IN BOTH DIRECTIONS — false negative', () => {
    const strike = GENUINE_FRANCE_DEVELOPMENTS[2];

    // A national transport strike is unambiguously a development in France and
    // names no curated institution at all.
    expect(hasContextTerm(strike)).toBe(false);
  });

  it('THE GAP, STATED: relevance ranking does not order by salience', () => {
    const fifaScore = scoreCountryRelevance(REJECTED_BY_PRODUCT_OWNER[0], FRANCE).score;
    const strikeScore = scoreCountryRelevance(GENUINE_FRANCE_DEVELOPMENTS[2], FRANCE).score;

    // The FIFA summit outranks the national strike. Not a threshold problem:
    // the scorer answers "is this about France", and both honestly are.
    expect(fifaScore).toBeGreaterThanOrEqual(strikeScore);
  });
});
