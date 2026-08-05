import type { CountryMeta, NewsArticle } from '@globalnews-ai/shared';
import { scoreCountryRelevance } from './country-relevance.util';

const sudan: CountryMeta = {
  iso2: 'SD',
  iso3: 'SDN',
  isoNumeric: '729',
  name: 'Sudan',
  region: 'Africa',
};

function article(
  title: string,
  summary: string,
): Pick<NewsArticle, 'title' | 'summary'> {
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
      article(
        'Sudanese nationals return home',
        'Hundreds crossed the border after a ceasefire.',
      ),
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
      article(
        'Local school launches new program',
        'Students attended an educational event.',
      ),
      sudan,
    );

    expect(result.isRelevant).toBe(false);
    expect(result.score).toBe(0);
  });
});