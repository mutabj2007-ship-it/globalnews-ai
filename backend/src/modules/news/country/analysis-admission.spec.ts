import { COUNTRIES } from '@globalnews-ai/shared';

import { admitsToAnalysisCorpus, assessCountryDevelopment } from './country-development-eligibility.util';
import { scoreCountryRelevance } from './country-relevance.util';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * K — IRRELEVANT-SOURCE ADMISSION
 * ════════════════════════════════════════════════════════════════════════════
 *
 * THE MEASURED DEFECT. A Hindustan Times article comparing a Mumbai flat's price
 * to a house in Poland entered a POLAND analysis corpus, reached the model,
 * consumed tokens and appeared as a retained source.
 *
 * ─── THE TRACE, AND THE TWO THINGS THAT WERE WRONG ────────────────────────
 *
 *   provider retrieval   fine — the article genuinely mentions Poland.
 *   relevance scoring    fine, and that is the trap: `scoreCountryRelevance`
 *                        answers "is this about Poland", and the honest answer
 *                        is yes.
 *   ADMISSION            *** WRONG ***. The analysis path applied `isRelevant`
 *                        as its ONLY condition. Country relevance is necessary
 *                        and not sufficient.
 *   partition            `assessCountryDevelopment` already drew the missing
 *                        distinction — and had exactly ONE caller,
 *                        country-news.service.ts. The analysis path never
 *                        called it.
 *   classifier           *** ALSO WRONG ***. Even called, it rated the Mumbai
 *                        headline NATIONAL_DEVELOPMENT: "Mumbai" is a CITY and
 *                        never counts, so Poland was the first and only country
 *                        named. Measured before the fix.
 *
 * So K needed BOTH corrections. Wiring the partition alone would not have
 * rejected the measured article.
 *
 * NO PUBLISHER IS BLOCKED and no threshold moved. The test is the article's
 * frame, not its source — fixture 7 asserts exactly that.
 */

const POL = COUNTRIES.find((c) => c.iso3 === 'POL')!;

const admits = (title: string, language?: string): boolean =>
  admitsToAnalysisCorpus({ title }, POL, language);

describe('K — analytical admission requires material relevance, not mention', () => {
  describe('THE REQUIRED FIXTURES', () => {
    it('1. Poland domestic policy article → ADMIT', () => {
      expect(admits('Poland revives tax proposal in parliamentary committee')).toBe(true);
    });

    it('2. Poland border/security article → ADMIT', () => {
      expect(admits('Poland tightens border security after airspace incursion')).toBe(true);
    });

    it('3. Orlen / Poland energy article → ADMIT', () => {
      expect(admits('Orlen seeks alternative crude supplies for Poland refineries')).toBe(true);
    });

    it('4. foreign article materially affecting Poland → ADMIT', () => {
      /*
        The event is decided elsewhere and lands on Poland. Poland leads the
        title under its own name, which is what the partition measures.
      */
      expect(admits('Poland faces higher tariffs under new EU energy ruling')).toBe(true);
      expect(admits('Poland and Germany sign defence agreement')).toBe(true);
    });

    it('5. Mumbai property article comparing prices to a Poland house → REJECT', () => {
      /* The measured case. */
      expect(admits('Mumbai flat costs more than a house in Poland')).toBe(false);
      expect(admits('This Mumbai apartment is pricier than a villa in Poland, says report')).toBe(
        false,
      );
    });

    it('6. article with an incidental Poland mention → REJECT', () => {
      /* Poland as a participant, a yardstick, or an item in a list. */
      expect(admits('German chancellor visits Poland for talks')).toBe(false);
      expect(admits('Indian startup valued at more than Poland annual budget')).toBe(false);
      expect(admits('EU bloc including Poland agrees new framework')).toBe(false);
    });

    it('7. foreign publisher, genuinely about Poland → ADMIT', () => {
      /*
        THE DEFECT IS RELEVANCE ADMISSION, NOT PUBLISHER IDENTITY. Nothing in
        this path knows or asks who published an article.
      */
      expect(admits('Poland announces new energy subsidy programme')).toBe(true);
    });
  });

  describe('COUNTRY RELEVANCE ALONE WOULD HAVE ADMITTED THE MUMBAI ARTICLE', () => {
    it('the old single condition rates it relevant — which is why it got in', () => {
      const article = {
        title: 'Mumbai flat costs more than a house in Poland',
        summary: 'A comparison of property prices in Mumbai and Poland.',
      };

      expect(scoreCountryRelevance(article, POL).isRelevant).toBe(true);
      expect(admitsToAnalysisCorpus(article, POL)).toBe(false);
    });

    it('so the two conditions are genuinely independent, not a restatement', () => {
      const domestic = {
        title: 'Poland revives tax proposal in parliamentary committee',
        summary: 'The proposal returns to committee.',
      };

      expect(scoreCountryRelevance(domestic, POL).isRelevant).toBe(true);
      expect(admitsToAnalysisCorpus(domestic, POL)).toBe(true);
    });
  });

  describe('THE CLASSIFIER NEEDED THE COMPARATIVE FRAME TOO', () => {
    it('rejects a yardstick reached across an intervening noun phrase', () => {
      expect(assessCountryDevelopment({ title: 'Mumbai flat costs more than a house in Poland' }, POL).tier).toBe(
        'IN_COUNTRY_CONTEXT',
      );
    });

    it('and a directly adjacent yardstick', () => {
      expect(assessCountryDevelopment({ title: 'Startup valued at more than Poland budget' }, POL).tier).toBe(
        'IN_COUNTRY_CONTEXT',
      );
    });

    it('but NOT a quantity frame, where the country locates the subject', () => {
      /*
        The false negative this guard exists to prevent. "Fewer than 10 people
        in Poland" is a genuine Polish development; the number after the marker
        is what distinguishes it from a comparison OF Poland.
      */
      expect(admits('Fewer than 10 people in Poland were affected by the outage')).toBe(true);
    });

    it('and not a comparison the country itself is making', () => {
      expect(admits('Poland spends more than Germany on defence')).toBe(true);
    });
  });

  describe('THE GATE DOES NOT RULE ON TEXT IT CANNOT READ', () => {
    /*
      COUNTRY_DEMONYMS_BY_ISO3 is English-only. Gating on it for a Polish
      headline rejected the ENTIRE Polish corpus — measured by
      polish-query-routing.spec.ts before this was corrected.
    */
    it('a non-English language defers to country relevance rather than rejecting', () => {
      expect(admits('Rosja i Ukraina rozmawiają o zawieszeniu broni', 'pl')).toBe(true);
      expect(admits('Mumbai flat costs more than a house in Poland', 'pl')).toBe(true);
    });

    it('English, and an unspecified language, are gated', () => {
      expect(admits('Mumbai flat costs more than a house in Poland', 'en')).toBe(false);
      expect(admits('Mumbai flat costs more than a house in Poland')).toBe(false);
    });
  });

  describe('NO COUNTRY-SPECIFIC RULE WAS ADDED', () => {
    it('the same frames demote a yardstick for any country', () => {
      const KEN = COUNTRIES.find((c) => c.iso3 === 'KEN')!;
      const FRA = COUNTRIES.find((c) => c.iso3 === 'FRA')!;

      expect(assessCountryDevelopment({ title: 'Lagos rent is higher than a home in Kenya' }, KEN).tier).toBe(
        'IN_COUNTRY_CONTEXT',
      );
      expect(assessCountryDevelopment({ title: 'Tokyo flat costs more than a house in France' }, FRA).tier).toBe(
        'IN_COUNTRY_CONTEXT',
      );
    });

    it('and admit a genuine development for any country', () => {
      const KEN = COUNTRIES.find((c) => c.iso3 === 'KEN')!;

      expect(admitsToAnalysisCorpus({ title: 'Kenya raises fuel levy in new finance bill' }, KEN)).toBe(
        true,
      );
    });
  });
});
