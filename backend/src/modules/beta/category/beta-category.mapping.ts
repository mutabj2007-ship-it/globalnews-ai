import type { BetaCategory, NewsCategory } from '@globalnews-ai/shared';

/**
 * BETA-SIMPLE-ASK-SAND-1 §15/§17 — mapping the public Beta categories
 * onto the stored corpus.
 *
 * The two vocabularies genuinely differ, and pretending otherwise
 * would be the bug here:
 *
 *   NewsCategory (existing, provider-shaped, in shared/src/news.ts):
 *     world | politics | business | technology | science | health |
 *     sports | entertainment
 *
 *   BetaCategory (§15, product-shaped):
 *     world | economy | energy | security | humanitarian
 *
 * Only `world` exists in both. "Energy", "Security" and
 * "Humanitarian" are not provider categories at all — they are
 * subject areas that cut across several of them.
 *
 * SO THE MAPPING IS TWO-PART: a set of NewsCategory values to draw
 * from, plus keyword terms used to narrow within them. The keywords
 * are matched against titles and summaries of ALREADY-STORED
 * articles — this is filtering, not retrieval. §16 is explicit that a
 * category click "must not automatically trigger expensive new
 * synthesis", and nothing here performs a provider call or a model
 * call.
 *
 * WHAT THIS IS NOT: a classifier. It does not claim that every
 * article it selects is "really about" energy. It selects stored
 * articles that plausibly concern the subject, so a public entry
 * surface has something current and cited to show. The authoritative
 * classification work lives in the analysis module and is not
 * duplicated here.
 */

export interface BetaCategoryMapping {
  /** Stored NewsCategory values to draw from. Empty means "any category". */
  sourceCategories: readonly NewsCategory[];
  /**
   * Lowercase terms narrowed against title/summary. Empty means no
   * narrowing — used by `world`, which is a breadth surface, not a
   * subject one.
   */
  terms: readonly string[];
  /** English display title. Localized in the frontend dictionary. */
  title: string;
}

export const BETA_CATEGORY_MAPPINGS: Readonly<Record<BetaCategory, BetaCategoryMapping>> = {
  /**
   * `world` is the "current developments" surface (§15's "What's
   * happening now"), not a subject filter — so it draws from the
   * whole corpus with no term narrowing. Narrowing it would make the
   * broadest surface the emptiest one.
   */
  world: {
    sourceCategories: [],
    terms: [],
    title: 'World',
  },

  economy: {
    sourceCategories: ['business', 'politics'],
    terms: [
      'econom',
      'inflation',
      'gdp',
      'trade',
      'tariff',
      'currency',
      'central bank',
      'interest rate',
      'debt',
      'budget',
      'investment',
      'market',
      'unemployment',
      'export',
      'import',
    ],
    title: 'Economy',
  },

  energy: {
    sourceCategories: ['business', 'science', 'politics'],
    terms: [
      'energy',
      'electricity',
      'power grid',
      'oil',
      'gas',
      'petroleum',
      'renewable',
      'solar',
      'wind power',
      'hydro',
      'nuclear',
      'pipeline',
      'fuel',
      'coal',
      'grid',
    ],
    title: 'Energy',
  },

  security: {
    sourceCategories: ['politics', 'world'],
    terms: [
      'security',
      'military',
      'conflict',
      'attack',
      'armed',
      'troops',
      'ceasefire',
      'peacekeep',
      'insurgen',
      'terror',
      'defence',
      'defense',
      'sanction',
      'border',
      'rebel',
    ],
    title: 'Security',
  },

  humanitarian: {
    sourceCategories: ['health', 'world', 'politics'],
    terms: [
      'humanitarian',
      'refugee',
      'displac',
      'famine',
      'aid',
      'relief',
      'drought',
      'flood',
      'outbreak',
      'epidemic',
      'malnutrition',
      'shelter',
      'asylum',
      'crisis',
      'unhcr',
    ],
    title: 'Humanitarian',
  },
};

/**
 * Whether a stored article plausibly concerns this category.
 *
 * Substring matching, not word-boundary matching, and deliberately:
 * the term list uses stems ('econom', 'displac', 'insurgen') so one
 * entry covers economy/economic/economics and
 * displace/displaced/displacement. A word-boundary match would need
 * every inflection spelled out, and would miss the ones nobody
 * thought of.
 *
 * The cost is occasional false positives from an unrelated word
 * containing a stem. For a public entry surface that shows cited,
 * clickable articles, showing a loosely-related story is a far
 * smaller failure than showing an empty category.
 */
export function matchesBetaCategory(
  category: BetaCategory,
  article: { title: string; summary: string },
): boolean {
  const mapping = BETA_CATEGORY_MAPPINGS[category];
  if (mapping.terms.length === 0) return true;

  const haystack = `${article.title} ${article.summary}`.toLowerCase();
  return mapping.terms.some((term) => haystack.includes(term));
}
