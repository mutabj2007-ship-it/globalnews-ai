import type { NewsArticle } from '@globalnews-ai/shared';

import { articleSpatialPrecision, evidenceDisplayCeiling } from './spatialPrecision';

/*
 * ════════════════════════════════════════════════════════════════════════════
 * EVIDENCE PRECISION — THE CONTRACT, PINNED — ALPHA PRECISION R1
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The Iran rail showed "Evidence Geography: Iran" beside "UNRESOLVED" and read
 * as a contradiction. It is not one: the country listing comes from
 * `NewsArticle.countryCode`, the precision axis from
 * `NewsArticle.geographicPrecision`, and only the first is produced.
 *
 * These cases pin the rule that keeps them separate. The governing risk is
 * BORROWED PRECISION — letting an association become a measurement — and every
 * case below exists to make that impossible to reintroduce quietly.
 */

const article = (over: Partial<NewsArticle> = {}): NewsArticle =>
  ({
    id: 'a1',
    title: 't',
    summary: 's',
    url: 'https://example.invalid/a1',
    sourceId: 'src',
    sourceName: 'Src',
    category: 'world',
    sourcesCount: 1,
    publishedAt: '2026-09-01T00:00:00.000Z',
    ...over,
  }) as NewsArticle;

describe('1 · a country-associated article with only country-level evidence', () => {
  it('reaches the country ceiling when its OWN precision says country', () => {
    const articles = [article({ countryCode: 'IR', geographicPrecision: 'country' })];
    expect(evidenceDisplayCeiling(articles)).toBe('country');
  });
});

describe('2 · finer precision remains finer only when actually evidenced', () => {
  it('a city-precision article is clamped DOWN to the surface geometry, never up', () => {
    /* The analysis surface draws country geometry only; a CITY record is drawn
       honestly at country, and never promotes the surface to city. */
    expect(articleSpatialPrecision(article({ geographicPrecision: 'city' }))).toBe('CITY');
    expect(evidenceDisplayCeiling([article({ geographicPrecision: 'city' })])).toBe('country');
  });

  it('a coordinate-precision article is likewise clamped, not honoured as a point', () => {
    expect(articleSpatialPrecision(article({ geographicPrecision: 'coordinate' }))).toBe('EXACT');
    expect(evidenceDisplayCeiling([article({ geographicPrecision: 'coordinate' })])).toBe('country');
  });
});

describe('3 · unresolved evidence remains unresolved', () => {
  it('an explicitly unknown precision does not resolve', () => {
    const articles = [article({ geographicPrecision: 'unknown' })];
    expect(evidenceDisplayCeiling(articles)).toBe('unresolved');
  });
});

describe('4 · retrieval/association geography ALONE cannot raise precision', () => {
  /*
    THE CENTRAL RULE. `countryCode` may establish that an article is ASSOCIATED
    with a country. It is not a statement about the precision of the evidence,
    and nothing may treat it as one.
  */
  it('countryCode without a precision leaves the ceiling unresolved', () => {
    const articles = [article({ countryCode: 'IR' })];
    expect(evidenceDisplayCeiling(articles)).toBe('unresolved');
  });

  it('many country-associated articles still cannot raise it', () => {
    const articles = [
      article({ id: 'a1', countryCode: 'IR' }),
      article({ id: 'a2', countryCode: 'IR' }),
      article({ id: 'a3', countryCode: 'IR' }),
      article({ id: 'a4', countryCode: 'IR' }),
    ];
    expect(evidenceDisplayCeiling(articles)).toBe('unresolved');
  });

  it('the precision consumer does not read countryCode at all', () => {
    const withCountry = [article({ countryCode: 'IR' })];
    const withoutCountry = [article({})];
    expect(evidenceDisplayCeiling(withCountry)).toBe(evidenceDisplayCeiling(withoutCountry));
  });
});

describe('5 · real resolved precision reaches evidenceDisplayCeiling', () => {
  it('one genuinely country-precise article among unresolved ones lifts the ceiling', () => {
    const articles = [
      article({ id: 'a1' }),
      article({ id: 'a2', geographicPrecision: 'unknown' }),
      article({ id: 'a3', geographicPrecision: 'country' }),
    ];
    expect(evidenceDisplayCeiling(articles)).toBe('country');
  });
});

describe('6 · the Iran case, as the producer now resolves it', () => {
  /*
    THE ORIGINAL DEFECT, AND ITS CORRECTION IN ONE CASE.

    Before the M1.0A producer was restored, these six articles carried NO
    precision at all — nothing wrote the field — so the ceiling was 'unresolved'
    while four of them plainly resolved Iran, and the rail read as a
    contradiction.

    With the producer restored, the four Iran articles carry precision 'country'
    derived from THEIR OWN countryCode, and the ceiling is 'country'. The two
    that resolved nothing carry 'unknown', which is an ASSESSED answer and does
    not drag the ceiling down.
  */
  it('four article-resolved Iran reports and two unresolved resolve to country', () => {
    const afterProducer = [
      article({ id: 'a1', countryCode: 'IR', geographicPrecision: 'country' }),
      article({ id: 'a2', countryCode: 'IR', geographicPrecision: 'country' }),
      article({ id: 'a3', countryCode: 'IR', geographicPrecision: 'country' }),
      article({ id: 'a4', countryCode: 'IR', geographicPrecision: 'country' }),
      article({ id: 'a5', geographicPrecision: 'unknown' }),
      article({ id: 'a6', geographicPrecision: 'unknown' }),
    ];
    expect(evidenceDisplayCeiling(afterProducer)).toBe('country');
  });

  it('an empty evidence set still resolves to nothing', () => {
    expect(evidenceDisplayCeiling([])).toBe('unresolved');
  });
});
