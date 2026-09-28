/**
 * ════════════════════════════════════════════════════════════════════════════
 * B · READER TOPIC — closes the router's BF-08, `topic.readerTerms`
 * ════════════════════════════════════════════════════════════════════════════
 *
 * WHY THE LANDED CLASSIFIER CANNOT BE REUSED, MEASURED
 *
 *   classifyCategory({title:'entertainment news in rwanda this week'})  -> 'world'
 *   classifyCategory({title:'sports results'})                          -> 'world'
 *   classifyCategory({title:''})                                        -> 'world'
 *
 * Two independent disqualifications, and the second is the interesting one:
 *
 *   1  IT IS TOTAL WITH A FLOOR. `world` is returned for a question with no
 *      topic AND for no question at all. A producer that reports `world` for a
 *      topicless question has laundered absence into a value — the same failure
 *      as a parser reading an empty cell as zero.
 *
 *   2  ITS VOCABULARY POINTS THE OTHER WAY. `CATEGORY_RULES` has seven rules
 *      (`world` has none) and their keywords are CONTENT words — `movie`,
 *      `film`, `celebrity`; `match`, `tournament`, `championship`. An article
 *      says "the film premiered"; it does not say "this is entertainment".
 *      A READER DOES THE OPPOSITE: they name the category. The article axis and
 *      the question axis need INVERSE vocabularies.
 *
 * That is a far better reason for Main's rule 4 than duplication, and it is why
 * this producer reads the `NewsCategory` UNION as a vocabulary and does not touch
 * `classifyCategory`. Reading a union is not merging two axes.
 *
 * `AnalyticalDomain` IS NOT IMPORTED BY THIS FILE. `entertainment` is never
 * inserted into it, and a grep for the identifier in this module returns nothing.
 * The eight domains keep their meaning and their producer.
 */

import { NEWS_CATEGORIES, type NewsCategory } from '@globalnews-ai/shared';
import type { ReaderTopic } from './ask-context-producers.contract';

/**
 * The words a READER uses to name a category, mapped onto the landed union.
 *
 * Every key is a span a reader plausibly writes when they mean the category.
 * Deliberately narrow: this is naming, not aboutness. "a film about Rwanda" is
 * a question about a film and this producer says nothing about it — inferring
 * `entertainment` from `film` would be re-implementing the article classifier in
 * the wrong direction, which is the mistake this whole file exists to avoid.
 */
export const READER_CATEGORY_TERMS: Readonly<Record<string, NewsCategory>> = {
  entertainment: 'entertainment',
  'show business': 'entertainment',
  showbiz: 'entertainment',
  culture: 'entertainment',
  sport: 'sports',
  sports: 'sports',
  politics: 'politics',
  political: 'politics',
  business: 'business',
  economy: 'business',
  economic: 'business',
  technology: 'technology',
  tech: 'technology',
  science: 'science',
  scientific: 'science',
  health: 'health',
  world: 'world',
};

/**
 * Words that are never a reader's topic: function words, and the question frame
 * itself. Kept small on purpose — an over-long stoplist silently eats real terms.
 */
const NON_TOPICAL: readonly string[] = [
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'what', 'which', 'who', 'whom',
  'whose', 'when', 'where', 'why', 'how', 'happened', 'happening', 'tell', 'me', 'about',
  'in', 'on', 'at', 'of', 'for', 'from', 'to', 'and', 'or', 'with', 'this', 'that', 'these',
  'those', 'it', 'its', 'do', 'does', 'did', 'has', 'have', 'had', 'will', 'would', 'can',
  'could', 'should', 'news', 'latest', 'current', 'please', 'give', 'show',
];

function normalize(query: string): string {
  return query.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Longest first, so "show business" is found before "business".
 *
 * EXPORTED, AND THE REASON IS A MUTATION THAT DID NOT BITE. Mutation M-7 removed
 * this sort and no test failed — because the lexicon's own insertion order
 * already happens to put every longer term before its shorter substring. The sort
 * is therefore UNOBSERVABLE today and purely defensive against the next key
 * somebody appends.
 *
 * A behavioural test cannot catch that, so the INVARIANT is asserted directly on
 * this array instead. Recorded rather than quietly patched: a clause that is
 * correct, load-bearing for the future, and unexercised is exactly the shape this
 * lane has twice mistaken for coverage.
 */
export const CATEGORY_TERMS_BY_LENGTH: readonly string[] = Object.keys(READER_CATEGORY_TERMS).sort(
  (a, b) => b.length - a.length,
);

/**
 * Produce the reader's topic, or absence.
 *
 * `provenance` is `STATED` only when the reader NAMED a category. A question with
 * topical words but no category name is `INTERPRETED` — it carries `readerTerms`
 * and no `newsCategory`. A question with neither is `ABSENT`, and then the
 * OPTIONAL FIELDS ARE OMITTED RATHER THAN SET TO UNDEFINED, so
 * `'newsCategory' in topic === false` is the honest test and `toBeUndefined()`
 * cannot pass by accident.
 */
export function detectReaderTopic(query: string): ReaderTopic {
  const normalized = normalize(query);
  if (normalized.length === 0) return { readerTerms: [], provenance: 'ABSENT' };

  const padded = ` ${normalized} `;
  let categoryTerm: string | null = null;
  let newsCategory: NewsCategory | null = null;

  for (const term of CATEGORY_TERMS_BY_LENGTH) {
    if (!padded.includes(` ${term} `)) continue;
    const mapped = READER_CATEGORY_TERMS[term];
    if (mapped === undefined) continue;
    categoryTerm = term;
    newsCategory = mapped;
    break;
  }

  const readerTerms = normalized
    .split(' ')
    .filter((w) => w.length > 2 && !NON_TOPICAL.includes(w));

  if (categoryTerm !== null && newsCategory !== null) {
    return { newsCategory, categoryTerm, readerTerms, provenance: 'STATED' };
  }
  if (readerTerms.length > 0) {
    return { readerTerms, provenance: 'INTERPRETED' };
  }
  return { readerTerms: [], provenance: 'ABSENT' };
}

/** Held so a spec can assert the union was read rather than re-declared. */
export const TOPIC_VOCABULARY_SOURCE = NEWS_CATEGORIES;
