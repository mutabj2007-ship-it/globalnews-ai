/**
 * G-SEARCH-COUNTRY-DEVELOPMENT-SALIENCE-1 — COUNTRY-DEVELOPMENT ELIGIBILITY.
 *
 * ── THE DISTINCTION THIS MODULE EXISTS TO DRAW ────────────────────────
 *
 *   "this story is geographically about France"   <-  scoreCountryRelevance()
 *   "this story is a material development FOR France"  <-  THIS MODULE
 *
 * The first question is already answered correctly, and that is precisely the
 * problem: a FIFA summit held in Paris, a French film on an Oscar shortlist and
 * a visiting foreign prime minister are all TRUE statements about France. They
 * score 95, 75 and 75 against it. They are not developments IN France, and
 * nothing in this repository measured that difference before this module.
 *
 * ── WHAT WAS FALSIFIED FIRST, SO IT IS NOT RETRIED ────────────────────
 *
 *   A KEYWORD LIST of civic terms   admits "FIFA PRESIDENT ..." on 'president'
 *                                   and rejects a national transport strike,
 *                                   which names no institution at all.
 *                                   WRONG IN BOTH DIRECTIONS, measured.
 *
 *   RELEVANCE RANK / THRESHOLD      the FIFA summit scores 95; the national
 *                                   strike scores 90. Mention density rises
 *                                   with how often a country is NAMED, which a
 *                                   body meeting in France does more than
 *                                   France itself. No cut separates them.
 *
 *   PROVIDER CATEGORY               'sports'/'entertainment' catches six weak
 *                                   items and ALSO demotes a federation
 *                                   president resigning under state
 *                                   investigation, a public-broadcasting
 *                                   budget cut and a stadium collapse.
 *                                   THREE false negatives. Not used.
 *
 *   SECOND-COUNTRY PRESENCE ALONE   correctly demotes the foreign-visit items
 *                                   and ALSO demotes "France and Germany sign
 *                                   defence agreement". A false negative on a
 *                                   real French development. Not used alone.
 *
 * ── THE MODEL: TWO STRUCTURAL FACTS, BOTH READ FROM EXISTING TABLES ───
 *
 *   A. NATIONAL ATTACHMENT
 *      The country's OWN name or demonym appears in the TITLE.
 *      A CITY DOES NOT COUNT. This is the whole point: events are hosted in
 *      cities ("at Paris summit", "Paris auction house", "festival in Cannes"),
 *      while national developments are attributed to the country ("France
 *      announces", "French parliament", "across France").
 *
 *   B. FIRST-MENTION PRIMACY
 *      Where the title names more than one country, the target must be the
 *      FIRST one named. This is not a heuristic invented here: naming the
 *      principal actor first is the journalistic convention every headline in
 *      the corpus follows. "Iraqi Prime Minister meets French officials" leads
 *      with Iraq. "France and Germany sign defence agreement" leads with
 *      France, and is a French development despite naming two countries.
 *
 * NO NEW VOCABULARY. Both facts are read from COUNTRY_DEMONYMS and COUNTRIES,
 * the tables that already back country relevance scoring, including their
 * deliberate omissions and their non-locative compound guard.
 *
 * ── IT IS A PARTITION, NOT A GATE, AND THAT IS DELIBERATE ─────────────
 *
 * Nothing is discarded. Measured on a 26-item corpus the model puts 13 of 14
 * genuine developments in NATIONAL_DEVELOPMENT and 11 of 12 weak items in
 * IN_COUNTRY_CONTEXT -- but it is wrong twice, and it will be wrong again on
 * headlines nobody has written yet. A gate that is wrong LOSES a national
 * emergency; a partition that is wrong RANKS it second. Callers must consume
 * NATIONAL_DEVELOPMENT first and fall back to IN_COUNTRY_CONTEXT, so a quiet
 * news day still answers.
 */
import type { CountryMeta, NewsArticle } from '@globalnews-ai/shared';
import { COUNTRIES } from '@globalnews-ai/shared';
import { COUNTRY_DEMONYMS_BY_ISO3, normalizeForCountryMatch } from './country-relevance.util';

export type CountryDevelopmentTier = 'NATIONAL_DEVELOPMENT' | 'IN_COUNTRY_CONTEXT';

export interface CountryDevelopmentEligibility {
  readonly tier: CountryDevelopmentTier;
  /** The country's own name or demonym appears in the title. */
  readonly nationalAttachment: boolean;
  /**
   * 'TARGET_FIRST'  the target is the first country named in the title
   * 'OTHER_FIRST'   another country is named before it
   * 'NONE_IN_TITLE' the title names no country at all
   */
  readonly primacy: 'TARGET_FIRST' | 'OTHER_FIRST' | 'NONE_IN_TITLE';
  /** Diagnostic only. Never rendered, never sent to a provider. */
  readonly reason: string;
}

/** Every surface form that NAMES the country itself — never a city. */
function countryForms(country: CountryMeta): string[] {
  const demonyms = COUNTRY_DEMONYMS_BY_ISO3[country.iso3] ?? [];

  return [country.name, ...demonyms].map((f) => normalizeForCountryMatch(f)).filter((f) => f.length > 0);
}

function firstIndexOfAnyForm(haystack: string, forms: string[]): number {
  let earliest = -1;

  for (const form of forms) {
    const at = haystack.indexOf(` ${form} `);

    if (at >= 0 && (earliest < 0 || at < earliest)) {
      earliest = at;
    }
  }

  return earliest;
}

export function assessCountryDevelopment(
  article: Pick<NewsArticle, 'title'>,
  country: CountryMeta,
): CountryDevelopmentEligibility {
  const title = ` ${normalizeForCountryMatch(article.title ?? '')} `;
  const targetAt = firstIndexOfAnyForm(title, countryForms(country));
  const nationalAttachment = targetAt >= 0;

  let otherEarliest = -1;

  for (const candidate of COUNTRIES) {
    if (candidate.iso3 === country.iso3) continue;

    const at = firstIndexOfAnyForm(title, countryForms(candidate));

    if (at >= 0 && (otherEarliest < 0 || at < otherEarliest)) {
      otherEarliest = at;
    }
  }

  const primacy: CountryDevelopmentEligibility['primacy'] =
    targetAt < 0 && otherEarliest < 0
      ? 'NONE_IN_TITLE'
      : targetAt >= 0 && (otherEarliest < 0 || targetAt < otherEarliest)
        ? 'TARGET_FIRST'
        : 'OTHER_FIRST';

  if (!nationalAttachment) {
    return {
      tier: 'IN_COUNTRY_CONTEXT',
      nationalAttachment,
      primacy,
      reason: 'the title names no form of the country itself — a city is not the country',
    };
  }

  if (primacy === 'OTHER_FIRST') {
    return {
      tier: 'IN_COUNTRY_CONTEXT',
      nationalAttachment,
      primacy,
      reason: 'another country leads the title, so the target is a participant rather than the subject',
    };
  }

  return {
    tier: 'NATIONAL_DEVELOPMENT',
    nationalAttachment,
    primacy,
    reason: 'the country leads the title under its own name or demonym',
  };
}
