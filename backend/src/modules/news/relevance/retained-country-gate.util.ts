import type { NewsArticle } from '@globalnews-ai/shared';
import { resolvePrimaryCountry } from '../country/country-relevance.util';

/**
 * REV A · 1 — RETAINED COUNTRY FAIL-CLOSED.
 *
 * R1's lexical parity made retained reporting able to match again. It could not
 * tell one country from another, and the R1 package pinned that as a disclosed
 * limitation. The CTO required the pin removed and a real gate put in its place.
 *
 * ── NO NEW GEOGRAPHY VOCABULARY EXISTS HERE ───────────────────────────────
 *
 * Country identity comes from exactly one place: `resolvePrimaryCountry()` in
 * `country-relevance.util.ts`, the accepted C907 authority, called unmodified.
 * This file holds no country list, no alias table, no demonym, no city. It
 * decides ADMISSION from what that resolver returns and nothing else.
 *
 * ── THE RULE ──────────────────────────────────────────────────────────────
 *
 *   query establishes no country            -> admit; the lexical gate decides
 *   article country == query country        -> admit
 *   article country != query country        -> REJECT  (contradiction)
 *   article country cannot be established   -> REJECT  (fail closed)
 *
 * The last line is the one worth defending. For a question scoped to a country,
 * an article whose own country cannot be established is not evidence about that
 * country — it is an unknown being counted as a match. Admitting it is how a
 * retained fallback quietly becomes "some articles that shared some words".
 * This costs recall, deliberately, and only on the retained path, and only when
 * the reader actually named a country.
 *
 * ── WHERE THE ARTICLE'S COUNTRY COMES FROM, IN ORDER ──────────────────────
 *
 *   1. `article.countryCode` — the value the country pipeline already computed
 *      and persisted. Preferred because it was derived once, by the same
 *      authority, with more context than this call site has.
 *   2. otherwise `resolvePrimaryCountry(title, summary)` — the article's OWN
 *      text.
 *
 * ── WHAT IS NEVER CONSULTED, AND WHY ──────────────────────────────────────
 *
 *   sourceName / sourceId / domain / publisher
 *       The outlet's country is not the event's country. A Reuters piece about
 *       Kenya filed from London is not a British story. `GdeltDocProvider`
 *       already refuses to map `sourcecountry` for this exact reason and that
 *       refusal must not be undone one layer up.
 *
 *   the query's country, as a property OF THE ARTICLE
 *       This function READS both and compares them. It never writes the query's
 *       country onto the article, never returns a modified article, and never
 *       raises an article's geographic precision. Retrieval context is not
 *       evidence, and promoting it here would manufacture the precision the
 *       precision model exists to withhold.
 */

export type RetainedCountryDecision = 'admit' | 'reject';

export interface RetainedCountryVerdict {
  readonly decision: RetainedCountryDecision;
  readonly queryCountry?: string;
  readonly articleCountry?: string;
  readonly reason: string;
}

/**
 * The country a retained query establishes, or undefined.
 *
 * The query text is handed to the accepted resolver as a title with no summary.
 * That is the resolver's own shape and it is not re-tuned here: a query is a
 * short span of prose, which is what a title is.
 */
export function resolveRetainedQueryCountry(query: string): string | undefined {
  const text = (query ?? '').trim();
  if (text.length === 0) return undefined;

  return resolvePrimaryCountry({ title: text, summary: '' })?.countryCode;
}

/** The country an article establishes from its OWN evidence. Never its publisher's. */
export function resolveRetainedArticleCountry(
  article: Pick<NewsArticle, 'title' | 'summary' | 'countryCode'>,
): string | undefined {
  const persisted = article.countryCode?.trim();
  if (persisted) return persisted.toUpperCase();

  return resolvePrimaryCountry({
    title: article.title ?? '',
    summary: article.summary ?? '',
  })?.countryCode;
}

export function retainedCountryVerdict(
  article: Pick<NewsArticle, 'title' | 'summary' | 'countryCode'>,
  queryCountry: string | undefined,
): RetainedCountryVerdict {
  if (queryCountry === undefined) {
    return {
      decision: 'admit',
      reason: 'the query establishes no country, so no country constraint applies',
    };
  }

  const articleCountry = resolveRetainedArticleCountry(article);

  if (articleCountry === undefined) {
    return {
      decision: 'reject',
      queryCountry,
      reason:
        'the query names a country and the article establishes none of its own — failing closed ' +
        'rather than counting an unknown as a match',
    };
  }

  if (articleCountry !== queryCountry) {
    return {
      decision: 'reject',
      queryCountry,
      articleCountry,
      reason: `the article establishes ${articleCountry}, which contradicts the query's ${queryCountry}`,
    };
  }

  return {
    decision: 'admit',
    queryCountry,
    articleCountry,
    reason: `the article establishes ${articleCountry}, matching the query`,
  };
}
