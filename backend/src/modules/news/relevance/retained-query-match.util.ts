import type { NewsArticle } from '@globalnews-ai/shared';
import { HEADLINE_STOPWORDS, isCountryTerm } from '../../analysis/relevance/anchor-relevance.util';
import { scoreGenericRelevance } from './generic-relevance.util';

/**
 * R1-C — RETAINED-REPORTING MATCH PARITY.
 *
 * ── THE DEFECT ────────────────────────────────────────────────────────────
 *
 * When live retrieval produced nothing, `NewsService.search()` fell through to
 * retained reporting, and retained reporting asked the database for articles
 * whose title or summary CONTAINS THE WHOLE QUERY STRING as one contiguous run
 * of characters.
 *
 * For a natural-language query that is a sentence fragment — the shape
 * AnalysisService actually derives — that is not a strict filter, it is an
 * impossible one. The live Alpha case:
 *
 *     query: "eastern Democratic Republic of Congo"
 *
 * No headline and essentially no summary contains that exact 36-character run.
 * The stage ran, cost a database round trip, and could not have returned
 * anything whatever the database held. It was structurally incapable of
 * succeeding, which is a different and worse thing than being empty.
 *
 * ── WHAT THIS IS, AND WHAT IT DELIBERATELY IS NOT ─────────────────────────
 *
 * It is NOT a new scoring model. Every per-term decision below is
 * `scoreGenericRelevance()` — the live generic gate — called UNMODIFIED. This
 * file contributes a term set and a counting rule and no matching logic of its
 * own. That is the same division of labour, and the same sentence, as
 * `isMateriallyRelatedToAnchor()`, which is where the counting rule comes from.
 *
 * It is NOT applied to live retrieval. Live results continue through
 * `applyRelevanceMode()` exactly as before, byte for byte. This changes what
 * the RETAINED branch can admit, and nothing else.
 *
 * ── THE COUNTING RULE, AND THE ONE THING THAT IS INVERTED ─────────────────
 *
 * Lifted verbatim from `isMateriallyRelatedToAnchor()`:
 *
 *     with distinctive terms available:  >= 1 distinctive AND >= 2 total
 *     with none available:               >= 3 supporting
 *
 * WHAT IS INVERTED IS WHICH TERM COUNTS AS DISTINCTIVE, AND THE INVERSION IS
 * THE WHOLE POINT. The anchor matcher is asking "is this candidate about the
 * same STORY?", so it DISCARDS country terms — a shared country is not a
 * topical relation, and letting Congo match Congo would admit every unrelated
 * story from the same country. This matcher is asking a different question,
 * "is this retained article about the PLACE or subject the reader asked
 * about?", and there the country term is the single most identifying token in
 * the query. So `isCountryTerm` — the same predicate, unmodified — selects the
 * distinctive set here instead of filtering it out.
 *
 * This was measured before it was written. Feeding the DRC query straight into
 * `extractAnchorTerms()` yields distinctive [] and supporting
 * ["eastern", "democratic", "republic"] — "congo" removed as a country term —
 * and a real article about fighting in eastern Congo then scores
 * `isRelated: false`. Reusing the anchor extractor unchanged would have looked
 * like maximal reuse and would have been wrong.
 *
 * ── WHY COMMON WORDS CANNOT CARRY AN ADMISSION ────────────────────────────
 *
 * Three independent bounds, none of them new:
 *
 *   1. Stopwords and tokens shorter than three characters never become terms.
 *      HEADLINE_STOPWORDS is imported from the anchor module, not re-declared.
 *   2. Every surviving term must clear `scoreGenericRelevance`'s SINGLE-WORD
 *      rule, which already requires TWO independent corroborating signals
 *      (title, summary, summary-repeated, category alignment). A word
 *      mentioned once in passing is not a match.
 *   3. When the query carries a distinctive term, at least one distinctive
 *      term must match. Ordinary vocabulary alone can never satisfy that, so
 *      an article about "the Democratic Party" cannot be admitted for a query
 *      about the Democratic Republic of Congo: "congo" is the distinctive term
 *      and it is absent.
 *
 * ── A DISCLOSED LIMITATION, NOT A CLAIM ───────────────────────────────────
 *
 * Two countries whose names share their distinctive token are not separated by
 * this rule. A Republic of the Congo (Brazzaville) story can match a query
 * about the Democratic Republic of the Congo, because "congo" matches and one
 * supporting term is enough to reach the total. Distinguishing them needs
 * country RESOLUTION, which `country-relevance.util.ts` performs and which this
 * path does not run.
 *
 * ── CORRECTED: THAT FALSE POSITIVE IS NO LONGER TOLERATED HERE ──────────────
 *
 * This comment used to end by calling a Brazzaville match "strictly better than
 * the current state of matching nothing at all". That was written while the
 * shared authority could not tell the two Congos apart, and it is now false in
 * both halves.
 *
 * It is false as a FACT: `country-relevance.util.ts` now consumes multi-word
 * country aliases, so "Democratic Republic of Congo" resolves to CD and a
 * Brazzaville article resolves to CG. `retained-country-gate.util.ts` runs that
 * resolution and REJECTS the pair, so a Brazzaville story no longer reaches the
 * reader on a DRC question.
 *
 * It was also false as a JUDGEMENT, and that is the part worth keeping. Serving
 * reporting about the wrong country is not a smaller failure than serving
 * nothing — it is a different and worse one. Nothing tells the reader the
 * evidence is about a country 2,000 km from the one they asked about, so a
 * visible absence becomes an invisible error. This module's token rule is still
 * deliberately coarse; what changed is that the gate above it is now able to
 * catch what this rule lets through, and the coarseness is a bounded input to a
 * decision rather than the decision itself.
 */

/** One token of a natural-language query, after normalisation. */
function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .trim();
}

export interface RetainedQueryTerms {
  /** Country terms from the query. These identify the PLACE the reader asked about. */
  readonly distinctive: string[];
  /** Remaining content words. These corroborate; they never admit alone. */
  readonly supporting: string[];
}

/**
 * Splits a natural-language query into distinctive and supporting terms.
 *
 * Casing is NOT consulted, unlike `extractAnchorTerms()`. That function reads a
 * headline, where an interior capital is evidence of a proper noun. This one
 * reads a query that has already passed through `makeProviderSafeNewsQuery()`
 * and may be wholly lower-cased, so casing here would be noise pretending to be
 * signal.
 */
export function extractRetainedQueryTerms(query: string): RetainedQueryTerms {
  const distinctive: string[] = [];
  const supporting: string[] = [];
  const seen = new Set<string>();

  for (const word of (query ?? '').split(/\s+/).filter(Boolean)) {
    const normalized = normalizeToken(word);
    if (normalized.length < 3) continue;
    if (HEADLINE_STOPWORDS.has(normalized)) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    if (isCountryTerm(normalized)) distinctive.push(normalized);
    else supporting.push(normalized);
  }

  return { distinctive, supporting };
}

export interface RetainedQueryMatchResult {
  readonly isMatch: boolean;
  readonly matchedDistinctive: string[];
  readonly matchedSupporting: string[];
  readonly reason: string;
}

/**
 * Does this retained article answer the query's meaningful terms?
 *
 * Counting rule per the module comment. Every per-term decision is
 * `scoreGenericRelevance()`, unmodified.
 */
export function matchesRetainedQuery(
  article: Pick<NewsArticle, 'title' | 'summary' | 'category'>,
  terms: RetainedQueryTerms,
): RetainedQueryMatchResult {
  const matchedDistinctive = terms.distinctive.filter(
    (term) => scoreGenericRelevance(article, term).isRelevant,
  );
  const matchedSupporting = terms.supporting.filter(
    (term) => scoreGenericRelevance(article, term).isRelevant,
  );
  const total = matchedDistinctive.length + matchedSupporting.length;

  if (terms.distinctive.length > 0) {
    const isMatch = matchedDistinctive.length >= 1 && total >= 2;
    return {
      isMatch,
      matchedDistinctive,
      matchedSupporting,
      reason: isMatch
        ? `matched distinctive [${matchedDistinctive.join(', ')}] plus ${total} query terms in total`
        : matchedDistinctive.length === 0
          ? 'no distinctive query term matched — ordinary vocabulary alone cannot admit a retained article'
          : 'only one query term matched — insufficient corroboration',
    };
  }

  const isMatch = matchedSupporting.length >= 3;
  return {
    isMatch,
    matchedDistinctive,
    matchedSupporting,
    reason: isMatch
      ? `query carries no distinctive term; matched ${matchedSupporting.length} supporting terms`
      : 'query carries no distinctive term and fewer than three supporting terms matched',
  };
}

/**
 * The tokens the DATABASE should cast its net with.
 *
 * Deliberately the union, deliberately OR'd at the SQL layer, deliberately
 * wider than the gate above: the query's job is to produce CANDIDATES cheaply,
 * and admission belongs to the accepted gate, in one place, where it can be
 * reasoned about. A narrow SQL predicate would move part of the admission
 * decision into Prisma where no test looks at it.
 */
export function retainedCandidateTerms(terms: RetainedQueryTerms): string[] {
  return [...terms.distinctive, ...terms.supporting];
}
