import type { NewsArticle } from '@globalnews-ai/shared';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE M1.0A EVIDENCE-PRECISION PRODUCER — RESTORED
 * ════════════════════════════════════════════════════════════════════════════
 *
 * WHY THIS FILE EXISTS AGAIN. `NewsArticle.geographicPrecision` is declared in
 * the shared contract and read by `evidenceDisplayCeiling`, and in the C907 line
 * NOTHING WROTE IT. The consumer therefore returned the constant `'unresolved'`
 * for every real response, which is why the Alpha evidence rail showed
 * "Evidence Geography: Iran" beside "UNRESOLVED" and read as a contradiction.
 *
 * This is a LOST CONVERGENCE REGRESSION, not a design change. The governing
 * contract — `backend/src/modules/spatial/spatial-precision.contract.ts`, present
 * in `alpha-convergence-2` and absent from the C907 line — describes this exact
 * producer and its exact semantics:
 *
 *     "The sole producer is `deriveGeographicPrecision` ... and the sole call
 *      site is `withDerivedEvidenceFields`, which passes
 *      `{ countryCode: article.countryCode }` and nothing else."
 *
 * The semantics are restored verbatim. Nothing is invented and no threshold
 * moves.
 *
 * ── THE ONE RULE THAT MATTERS ───────────────────────────────────────────────
 *
 * `NewsArticle.countryCode` is ARTICLE-LEVEL EVIDENCE. `NewsService.resolveArticleCountries`
 * sets it via `resolvePrimaryCountry`, which reads the ARTICLE'S OWN title and
 * summary and fails closed on a tie. It is not the query's country.
 *
 * `retrievalContext.countryCode` is a different thing wearing the same name: it
 * is what retrieval AIMED AT. It is pool-level association, it says nothing
 * about what any individual article establishes, and **it never enters this
 * file**. There is no import of it here and no parameter for it, so borrowed
 * precision is prevented by construction rather than by a comment.
 *
 * ── WHY THERE IS NO `city` PARAMETER, DELIBERATELY ──────────────────────────
 *
 * The historical producer declared one and the historical call site never
 * passed it. The M1.0A contract named that as its own worst feature — "the
 * function looks like a city-capable producer and is not wired as one" — so
 * restoring the misleading signature would restore the misleading part. CITY
 * needs an article-level city resolver, which does not exist. When one exists,
 * this producer gains the parameter and the ladder gains a reachable rung; until
 * then the absence is honest.
 */

/** The legacy wire vocabulary of `NewsArticle.geographicPrecision`. */
type GeographicPrecision = NonNullable<NewsArticle['geographicPrecision']>;

/**
 * COUNTRY when the article resolved a country FROM ITS OWN TEXT, UNKNOWN when it
 * did not. Those are the only two values this producer can emit, and that is the
 * whole contract.
 */
export function deriveGeographicPrecision(input: {
  readonly countryCode?: string;
}): GeographicPrecision {
  return input.countryCode !== undefined && input.countryCode !== '' ? 'country' : 'unknown';
}

/**
 * The sole call site, restored under its historical name so the contract that
 * describes it matches the code again.
 *
 * PROVIDER-SUPPLIED PRECISION IS PRESERVED AND NEVER OVERWRITTEN. If an article
 * already carries a precision — from a provider that genuinely knows better —
 * that value is authoritative and this function returns the article untouched.
 * The derivation fills an ABSENCE; it does not arbitrate against a producer that
 * knows more than `countryCode` does.
 */
export function withDerivedEvidenceFields(article: NewsArticle): NewsArticle {
  if (article.geographicPrecision !== undefined) return article;

  return {
    ...article,
    geographicPrecision: deriveGeographicPrecision({ countryCode: article.countryCode }),
  };
}
