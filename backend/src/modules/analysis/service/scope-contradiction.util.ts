import { resolveCountryByAnyIdentifier, type NewsArticle } from '@globalnews-ai/shared';
import { resolvePrimaryCountry } from '../../news/country/country-relevance.util';

/**
 * MASTER CTO R5 · GEO-E2E-D1 (#89) — A TOP-UP REPORT MUST NOT CONTRADICT THE ONE COUNTRY IT IS ADMITTED FOR.
 *
 * Defect (Fork E end-to-end fixture E2E-7a, present on 737c42f / baa9167): a COD-typed question with a
 * gated subject ran the anchored supplement; its retained read matches ANY term ("congo"), the anchor
 * gate checks actors and topics only, so a correctly stored Republic-of-the-Congo (Brazzaville) report
 * reached the evidence and the model context of a DR Congo answer. The country feed never had this
 * defect: CountryNewsService already excludes "an article that positively resolves to a different
 * country" (`resolvesToADifferentCountry`). The member/per-side and domain top-ups admitted on
 * `scoreCountryRelevance` + `admitsToAnalysisCorpus` alone, without that safeguard.
 *
 * THE SAME RULE, NOT A NEW ONE. The article's OWN text is read by `resolvePrimaryCountry` — the
 * resolver NewsService tags every live article with and the country feed already uses — and only a
 * POSITIVE resolution to a different country excludes. A tie or no country evidence is NOT a
 * different country: absence of a competing country is not evidence of one (so an office-based-in or
 * incidental mention inside a report whose own evidence is the scope country is kept, and a bare
 * "Congo" report is not decided either way). No keyword, city or threshold is added.
 *
 * NEVER THE REQUESTED CODE AS EVIDENCE, NEVER A STORED CODE OVER THE TEXT. The scope country is the
 * question's; the article's country comes from the article. A persisted `countryCode` is not read
 * by the exclusion at all, so a legacy wrong code can neither exclude a report whose own text is the
 * scope country nor admit one whose text is another country. Where an admitted report's own text
 * establishes no country but its STORED code names another country, the stored label is withheld
 * (`withoutUnsupportedForeignLabel`): the report is not silently labelled — or counted — as that
 * other country inside this answer, and it is not relabelled as the scope country either.
 */
export function articleContradictsCountryScope(
  article: Pick<NewsArticle, 'title' | 'summary'>,
  scopeIso2: string,
): boolean {
  const own = resolvePrimaryCountry(article);
  return own !== undefined && own.countryCode !== scopeIso2;
}

const iso2Of = (code: string | undefined | null): string | undefined =>
  typeof code === 'string' && code.trim() !== '' ? resolveCountryByAnyIdentifier(code.trim())?.iso2 : undefined;

/**
 * An ADMITTED report whose stored code names a country other than the scope, and whose own text does
 * not support that code (no country, or the scope country itself), keeps everything except that
 * unsupported label: it is neither shown nor counted as the other country, and not relabelled.
 * Everything else is returned unchanged (same object).
 */
export function withoutUnsupportedForeignLabel<T extends NewsArticle>(article: T, scopeIso2: string): T {
  const stored = iso2Of(article.countryCode);
  if (stored === undefined || stored === scopeIso2) return article;
  const own = resolvePrimaryCountry(article);
  if (own !== undefined && own.countryCode === stored) return article;
  const { countryCode: _code, countryName: _name, ...rest } = article;
  return rest as T;
}
