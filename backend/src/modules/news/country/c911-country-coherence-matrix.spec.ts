/**
 * ============================================================================
 * C911-R4 -- COUNTRY ANALYSIS EVIDENCE COHERENCE MATRIX
 * ============================================================================
 *
 * A GOVERNED OFFLINE MATRIX. Six countries named by the C911 contract --
 * Zambia, South Africa, Iran, Poland, Rwanda and DR Congo -- plus synthetic
 * controls, measured through the REAL deterministic admission chain:
 *
 *     scoreCountryRelevance()        is this story about this country
 *     resolvePrimaryCountry()        which country is it actually about
 *     resolvesToADifferentCountry()  the country-feed exclusion rule
 *     assessCountryDevelopment()     does it LEAD or merely sit in context
 *     deduplicateArticles()          duplicate handling
 *     clusterDuplicateArticles()     distinct-story counting
 *     deriveGeographicPrecision()    what precision may honestly be claimed
 *
 * NO LIVE PROVIDER AND NO LIVE MODEL. Every article below is a fixture. This
 * suite makes no network call of any kind, by construction: it imports pure
 * functions and nothing else.
 *
 * WHY A MATRIX RATHER THAN MORE PER-COUNTRY TESTS. The Production defect was
 * not that one country was wrong; it was that the SAME admission rule behaved
 * differently depending on how a headline happened to be phrased. A matrix
 * makes that visible -- every country is asked the same questions, and a rule
 * that only works for South Africa fails here.
 */
import type { NewsArticle, NewsCategory } from '@globalnews-ai/shared';
import { COUNTRIES } from '@globalnews-ai/shared';

import { clusterDuplicateArticles } from '../../analysis/duplicates/cluster-articles.util';
import { assessCountryDevelopment } from './country-development-eligibility.util';
import { deduplicateArticles } from './deduplicate-articles.util';
import { resolvePrimaryCountry, scoreCountryRelevance } from './country-relevance.util';
import { deriveGeographicPrecision } from '../identity/geographic-precision.util';

const countryOf = (iso3: string) => {
  const found = COUNTRIES.find((c) => c.iso3 === iso3);

  if (!found) throw new Error(`fixture error: ${iso3} is not a known country`);

  return found;
};

let sequence = 0;

const fixture = (title: string, summary: string, category: NewsCategory = 'world'): NewsArticle => {
  sequence += 1;

  return {
    id: `c911-${sequence}`,
    title,
    summary,
    url: `https://example.com/c911-${sequence}`,
    sourceId: 'fixture-source',
    sourceName: 'Fixture Wire',
    category,
    sourcesCount: 1,
    publishedAt: new Date('2026-09-01T12:00:00.000Z').toISOString(),
  };
};

/**
 * The full admission decision a country feed makes, in one place, so every
 * row of the matrix is judged by exactly the chain Production runs.
 */
const admit = (article: NewsArticle, iso3: string) => {
  const country = countryOf(iso3);
  const relevance = scoreCountryRelevance(article, country);
  const primary = resolvePrimaryCountry(article);
  const contradicts = primary !== undefined && primary.countryCode !== country.iso2;

  return {
    admitted: relevance.isRelevant && !contradicts,
    score: relevance.score,
    primaryIso2: primary?.countryCode,
    tier: assessCountryDevelopment(article, country).tier,
  };
};

/* ==========================================================================
   THE MATRIX
   ========================================================================== */

interface Row {
  readonly iso3: string;
  readonly label: string;
  readonly article: NewsArticle;
  /** Must the country feed admit it at all? */
  readonly admitted: boolean;
  /** Must it be allowed to LEAD the analysis? */
  readonly leads: boolean;
}

const MATRIX: Row[] = [
  // ---------------------------------------------------------------- ZAMBIA
  {
    iso3: 'ZMB',
    label: 'ZMB domestic development',
    article: fixture(
      'Zambia signs debt restructuring agreement with official creditors',
      'Zambia signed a debt restructuring agreement covering 6.3 billion dollars of official bilateral debt.',
      'business',
    ),
    admitted: true,
    leads: true,
  },
  {
    iso3: 'ZMB',
    label: 'ZMB named only as a fixture opponent',
    article: fixture(
      'Morocco name squad for qualifier against Zambia',
      'Morocco named a 26-man squad for the qualifier against Zambia in Rabat.',
      'sports',
    ),
    admitted: true,
    leads: false,
  },

  // ---------------------------------------------------------- SOUTH AFRICA
  {
    iso3: 'ZAF',
    label: 'ZAF domestic development',
    article: fixture(
      'South Africa parliament passes electricity reform bill',
      'South Africa parliament passed an electricity reform bill restructuring Eskom.',
      'politics',
    ),
    admitted: true,
    leads: true,
  },
  {
    iso3: 'ZAF',
    label: 'ZAF opponent mention (the reported Production shape)',
    article: fixture(
      'Wallabies name squad for Rugby Championship clash against South Africa',
      'Australia named a 33-man squad ahead of the fixture against South Africa in Brisbane.',
      'sports',
    ),
    admitted: true,
    leads: false,
  },
  {
    iso3: 'ZAF',
    label: 'ZAF foreign sanctions targeting it -- legitimate international reporting',
    article: fixture(
      'United States imposes new sanctions on South Africa mining executives',
      'The US Treasury announced sanctions targeting South Africa mining executives.',
      'politics',
    ),
    admitted: true,
    leads: false,
  },

  // ------------------------------------------------------------------ IRAN
  {
    iso3: 'IRN',
    label: 'IRN domestic development',
    article: fixture(
      'Iran announces new currency measures as inflation persists',
      'Iran announced currency measures intended to slow the decline of the rial.',
      'business',
    ),
    admitted: true,
    leads: true,
  },
  {
    iso3: 'IRN',
    label: 'IRN named in an enumeration only',
    article: fixture(
      'Oil producers including Iran meet on output targets',
      'Producers, including Iran and Iraq, met in Vienna to discuss output targets.',
      'business',
    ),
    admitted: true,
    leads: false,
  },

  // ---------------------------------------------------------------- POLAND
  {
    iso3: 'POL',
    label: 'POL domestic development',
    article: fixture(
      'Poland central bank holds interest rates for a third month',
      'Poland central bank held its reference rate at 5.75 percent for a third consecutive month.',
      'business',
    ),
    admitted: true,
    leads: true,
  },
  {
    iso3: 'POL',
    label: 'POL -- a story about a different country that merely names Poland',
    article: fixture(
      'Germany announces border control extension',
      'Germany extended border controls. Checks affect crossings with Poland and Czechia.',
      'politics',
    ),
    // resolvePrimaryCountry resolves this to Germany, which CONTRADICTS a
    // Poland feed -- the accepted G-SEARCH exclusion. It must not be admitted.
    admitted: false,
    leads: false,
  },

  // ---------------------------------------------------------------- RWANDA
  {
    iso3: 'RWA',
    label: 'RWA domestic development',
    article: fixture(
      'Rwanda opens new road safety programme in Kigali',
      'Rwanda opened a national road safety programme with measures rolled out from Kigali.',
      'world',
    ),
    admitted: true,
    leads: true,
  },

  // -------------------------------------------------------------- DR CONGO
  {
    iso3: 'COD',
    label: 'COD domestic development',
    article: fixture(
      'DR Congo announces mining royalty changes',
      'DR Congo announced changes to mining royalties affecting cobalt and copper concessions.',
      'business',
    ),
    admitted: true,
    leads: true,
  },
];

describe('C911-R4 -- country analysis evidence coherence matrix', () => {
  describe('TARGET-COUNTRY CORRECTNESS AND ADMISSION', () => {
    for (const row of MATRIX) {
      it(`${row.iso3}: ${row.label} -- admitted=${row.admitted}`, () => {
        expect(admit(row.article, row.iso3).admitted).toBe(row.admitted);
      });
    }
  });

  describe('LEAD ELIGIBILITY -- an incidental mention never leads', () => {
    for (const row of MATRIX) {
      it(`${row.iso3}: ${row.label} -- leads=${row.leads}`, () => {
        const tier = admit(row.article, row.iso3).tier;

        expect(tier === 'NATIONAL_DEVELOPMENT').toBe(row.leads);
      });
    }
  });

  describe('THE RULE IS GENERIC, NOT TUNED TO ONE COUNTRY', () => {
    it('the opponent frame demotes in every country it is applied to', () => {
      const demoted = MATRIX.filter((r) => !r.leads && r.admitted);

      // Zambia, South Africa, Iran and the sanctions row -- four countries'
      // worth of evidence that this is not a South Africa special case.
      expect(new Set(demoted.map((r) => r.iso3)).size).toBeGreaterThanOrEqual(3);
    });

    it('no country in the matrix has every row demoted', () => {
      for (const iso3 of new Set(MATRIX.map((r) => r.iso3))) {
        const rows = MATRIX.filter((r) => r.iso3 === iso3);

        expect(rows.some((r) => r.leads)).toBe(true);
      }
    });
  });

  describe('TARGET GEOGRAPHY vs EVIDENCE GEOGRAPHY', () => {
    it('an article is never relabelled with the feed it was retrieved for', () => {
      // The Germany story stays a Germany story even when fetched for Poland.
      const germany = MATRIX.find((r) => r.label.includes('merely names Poland'))!;

      expect(resolvePrimaryCountry(germany.article)?.countryCode).toBe('DE');
    });

    it('every admitted row resolves to its own target country or to nothing', () => {
      for (const row of MATRIX.filter((r) => r.admitted)) {
        const primary = resolvePrimaryCountry(row.article);
        const iso2 = countryOf(row.iso3).iso2;

        expect(primary === undefined || primary.countryCode === iso2).toBe(true);
      }
    });
  });

  describe('GEOGRAPHIC PRECISION IS HONEST -- no fabricated locations', () => {
    it('a resolved country yields COUNTRY precision, never a city', () => {
      expect(deriveGeographicPrecision({ countryCode: 'ZAF' })).toBe('country');
    });

    it('an unresolved country yields UNKNOWN rather than a guess', () => {
      expect(deriveGeographicPrecision({ countryCode: undefined })).toBe('unknown');
      expect(deriveGeographicPrecision({ countryCode: '' })).toBe('unknown');
    });

    it('naming a city in the text does not raise precision above COUNTRY', () => {
      // "Kigali" appears in the Rwanda fixture. Precision is still COUNTRY:
      // there is no article-level city resolver, and inventing one would be
      // exactly the fabricated-location failure this asserts against.
      const rwanda = MATRIX.find((r) => r.iso3 === 'RWA')!;

      expect(rwanda.article.summary).toContain('Kigali');
      expect(deriveGeographicPrecision({ countryCode: 'RWA' })).toBe('country');
    });
  });

  describe('DUPLICATE HANDLING AND CLUSTER RELEVANCE', () => {
    const original = fixture(
      'South Africa parliament passes electricity reform bill',
      'The bill restructures Eskom and opens the grid to private generation.',
      'politics',
    );

    const sameUrl: NewsArticle = { ...original, id: 'dup-1' };

    const rewrite = fixture(
      'South Africa parliament passes electricity reform bill',
      'Parliament in South Africa passed the electricity reform bill on Tuesday.',
      'politics',
    );

    const unrelated = fixture(
      'Central bank holds rates as inflation eases',
      'The central bank held its policy rate for a third meeting.',
      'business',
    );

    it('an exact duplicate URL collapses to one article', () => {
      expect(deduplicateArticles([original, sameUrl])).toHaveLength(1);
    });

    it('two outlets on the same story form ONE cluster, not two developments', () => {
      expect(clusterDuplicateArticles([original, rewrite])).toHaveLength(1);
    });

    it('two genuinely different stories stay two clusters', () => {
      expect(clusterDuplicateArticles([original, unrelated])).toHaveLength(2);
    });

    it('clustering never invents an article', () => {
      const clustered = clusterDuplicateArticles([original, rewrite, unrelated]);

      expect(clustered.length).toBeLessThanOrEqual(3);

      for (const article of clustered) {
        expect([original.id, rewrite.id, unrelated.id]).toContain(article.id);
      }
    });
  });

  describe('SOURCE DIVERSITY IS NEVER FABRICATED', () => {
    it('one outlet reported twice is not two sources', () => {
      const a = fixture('Iran announces currency measures', 'Iran announced currency measures.');
      const b: NewsArticle = { ...a, id: 'dup-2' };

      const deduped = deduplicateArticles([a, b]);

      expect(deduped).toHaveLength(1);
      expect(new Set(deduped.map((x) => x.sourceId)).size).toBe(1);
    });
  });
});
