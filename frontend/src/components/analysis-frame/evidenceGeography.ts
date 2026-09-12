import type { AnalysisApiResponse, NewsArticle } from '@globalnews-ai/shared';
import { findCountryByIso2, findCountryByIso3 } from '@globalnews-ai/shared';
import { evidenceDisplayCeiling } from '@/lib/spatial/spatialPrecision';

/**
 * R4.1 — THE EVIDENCE MAP'S MODEL.
 *
 * ── WHY THIS MODULE EXISTS ────────────────────────────────────────────
 *
 * `geographicEvidenceState.ts` answers "what did retrieval AIM AT?" from
 * `AnalysisRetrievalContext`, and it is correct at that job. It is not a
 * model of what the EVIDENCE supports, because `retrievalContext` carries
 * a country only on the country-aware path: `analysis.service.ts` sets
 * `countryCode`/`countryName` behind `isCountryResponse`, so a story
 * reached as `?q=…&articleId=…` with no `countryCode` arrives with no
 * retrieval country at all — and the rail then reports "unresolved" while
 * every retrieved article is carrying its own resolved country.
 *
 * That per-article country is real production data, not a type that
 * happens to exist. `news.service.resolveArticleCountries()` runs
 * `resolvePrimaryCountry()` over every article on BOTH paths the analysis
 * pipeline uses (`search()` and `topHeadlines()`, via `buildResponse` and
 * `buildCachedResponse`), writing ISO 3166-1 alpha-2 into
 * `NewsArticle.countryCode`. See the R4.1 source trace.
 *
 * ── WHAT COUNTS AS EVIDENCE, AND WHY IT IS NOT ONE SOURCE ─────────────
 *
 * The first draft of this module made evidence mean `articles[].countryCode`
 * ALONE and treated `retrievalContext.countryCode` purely as a query
 * target. Nineteen accepted geography assertions failed, and they were
 * right to. `analysis.service.ts` sets `retrievalContext.countryCode` only
 * behind `isCountryResponse` — its presence therefore means the
 * COUNTRY-AWARE path ran, and `CountryNewsService` filtered the retained
 * pool through `scoreCountryRelevance()` at `isRelevant >= 35`. Every
 * article the reader is shown passed a country-relevance test. That is
 * the accepted G2 position recorded in `geographicEvidenceState.ts`, and
 * demoting it to "query target" would have claimed LESS than the evidence
 * supports — a different way of being wrong.
 *
 * So evidence has two admissible bases, and each country records its own:
 *
 *   'article-evidence'  the article resolved this country itself, via
 *                       `resolvePrimaryCountry()` over its title and
 *                       summary. Per-record, and the stronger basis.
 *   'retrieval-filter'  the country-aware retrieval filter every retained
 *                       article passed. Pool-level, and the accepted G2
 *                       basis this module must not weaken.
 *
 * `retrievalContext.city` is NOT in that list and never becomes evidence:
 * it is a query-resolution field, it says nothing about what the reporting
 * establishes, and its own doc comment says so.
 *
 * When the route's country and the articles' countries disagree, both are
 * shown and the disagreement is STATED. The route never overrides the
 * articles, and neither is silently dropped to make one story.
 *
 * ── FAIL-CLOSED TIES, MIRRORING THE BACKEND ───────────────────────────
 *
 * `resolvePrimaryCountry()` returns the UNIQUE maximum or nothing: an
 * article naming Iran and Israel with equal weight resolves to NEITHER,
 * because declaration order must never decide geographic truth. `primary`
 * below applies the same rule one level up — a tie across articles yields
 * no primary, rather than whichever country sorted first. Both countries
 * still appear as evidence; what is withheld is the claim that one of
 * them is the focus.
 *
 * ── PRECISION ─────────────────────────────────────────────────────────
 *
 * SPATIAL M1.0B — SUPERSEDES THE R4 FINDING RECORDED HERE.
 *
 * This block used to say `NewsArticle.geographicPrecision` "still has zero
 * writers", so nothing read it. M1.0A made that false: the field is produced,
 * its authoritative vocabulary is `SpatialPrecision`, and the producible set
 * today is COUNTRY and UNKNOWN. The ceiling is now read FROM THE ARTICLES via
 * `evidenceDisplayCeiling`, not inferred from whether a country happened to
 * be known.
 *
 * THE CORRECTION THAT MATTERS. The ceiling was `countries.length > 0`, and
 * `countries` may contain a 'retrieval-filter' entry — so a query country
 * with NO article-level support could raise the precision claim to 'country'
 * on its own. That is the borrowed-precision fallback the contract forbids.
 * Evidence LISTING is unchanged (the retrieval-filter basis is still admitted
 * and still displayed); what it can no longer do is assert precision.
 *
 * The ceiling remains 'country' or 'unresolved'. Never 'city': a
 * finer-than-country precision clamps DOWN in `displayCeilingFor`, and no
 * point marker, city, district or province geometry is derived anywhere.
 */

export type EvidenceBasis = 'article-evidence' | 'retrieval-filter';

export interface EvidenceCountry {
  readonly iso2: string;
  readonly iso3: string;
  readonly isoNumeric: string;
  /** Canonical English name from the curated registry, never the article's prose. */
  readonly name: string;
  readonly articleCount: number;
  readonly articleIds: readonly string[];
  /** Where this country's support comes from. Never inferred. */
  readonly basis: EvidenceBasis;
}

export interface QueryTarget {
  readonly iso2: string | null;
  readonly iso3: string | null;
  readonly name: string | null;
  /** The locality the QUESTION named. Display only — never a precision claim. */
  readonly city: string | null;
}

export type EvidencePrecisionCeiling = 'country' | 'unresolved';

export interface EvidenceGeographyModel {
  /** Every country the retained reporting supports, most-supported first. */
  readonly countries: readonly EvidenceCountry[];
  /** The unique most-supported country, or null on a tie or an empty set. */
  readonly primary: EvidenceCountry | null;
  readonly resolvedArticleCount: number;
  readonly unresolvedArticleCount: number;
  readonly totalArticleCount: number;
  readonly precisionCeiling: EvidencePrecisionCeiling;
  /** What the route/question aimed at. NOT evidence. */
  readonly queryTarget: QueryTarget | null;
  /**
   * True when a query target country exists, evidence exists, and the
   * target is not among the countries the evidence supports.
   */
  readonly targetDisagreesWithEvidence: boolean;
  /** True when there is nothing honest to draw. */
  readonly empty: boolean;
}

export const EMPTY_EVIDENCE_GEOGRAPHY: EvidenceGeographyModel = {
  countries: [],
  primary: null,
  resolvedArticleCount: 0,
  unresolvedArticleCount: 0,
  totalArticleCount: 0,
  precisionCeiling: 'unresolved',
  queryTarget: null,
  targetDisagreesWithEvidence: false,
  empty: true,
};

function nonEmpty(value: string | null | undefined): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

/**
 * THE TWO CARRIERS USE DIFFERENT ISO WIDTHS, and this is load-bearing.
 *
 *   NewsArticle.countryCode              alpha-2 ('IR'), per its doc comment
 *   AnalysisRetrievalContext.countryCode alpha-3 ('RWA') — the existing
 *                                        rail passes it straight to
 *                                        `buildFocusGeometry`, which
 *                                        matches on `iso3`
 *
 * Resolving by width rather than assuming one convention is a LOOKUP in
 * the curated registry, not an inference: a code that matches neither
 * returns undefined and is counted unresolved.
 */
function metaForCode(code: string): ReturnType<typeof findCountryByIso2> {
  const upper = code.toUpperCase();
  return upper.length === 2 ? findCountryByIso2(upper) : findCountryByIso3(upper);
}

/**
 * The article's OWN declared country, or null.
 *
 * Deliberately does not fall back to the analysis entities, the question
 * text, the source name or the retrieval country. An article without a
 * resolved country is counted as unresolved and stays visibly unresolved;
 * that is the honest state, and borrowing a country from elsewhere is
 * exactly the fabrication this module exists to prevent.
 */
function countryOf(article: NewsArticle): string | null {
  return nonEmpty(article.countryCode);
}

function buildQueryTarget(response: AnalysisApiResponse): QueryTarget | null {
  const context = response.retrievalContext;
  if (context === undefined) return null;

  const raw = nonEmpty(context.countryCode);
  const meta = raw === null ? undefined : metaForCode(raw);
  const city = nonEmpty(context.city);
  const name = nonEmpty(context.countryName) ?? meta?.name ?? null;

  if (raw === null && city === null && name === null) return null;

  return {
    iso2: meta?.iso2 ?? null,
    iso3: meta?.iso3 ?? null,
    name,
    city,
  };
}

export function buildEvidenceGeography(
  response: AnalysisApiResponse | null,
): EvidenceGeographyModel {
  if (response === null) return EMPTY_EVIDENCE_GEOGRAPHY;

  const articles = response.articles ?? [];
  const grouped = new Map<string, { ids: string[] }>();
  let unresolved = 0;

  for (const article of articles) {
    const iso2 = countryOf(article);
    if (iso2 === null) {
      unresolved += 1;
      continue;
    }
    const key = iso2.toUpperCase();
    const bucket = grouped.get(key) ?? { ids: [] };
    bucket.ids.push(article.id);
    grouped.set(key, bucket);
  }

  const countries: EvidenceCountry[] = [];
  for (const [iso2, bucket] of grouped) {
    const meta = metaForCode(iso2);
    if (meta === undefined) {
      // A code we have no curated metadata for cannot be drawn or named
      // honestly, so it is counted as unresolved rather than guessed at.
      unresolved += bucket.ids.length;
      continue;
    }
    countries.push({
      iso2: meta.iso2,
      iso3: meta.iso3,
      isoNumeric: meta.isoNumeric,
      name: meta.name,
      articleCount: bucket.ids.length,
      articleIds: bucket.ids,
      basis: 'article-evidence',
    });
  }

  // Most-supported first; ISO as the tie-break so ordering is STABLE for
  // display. Ordering is presentation only — `primary` below refuses to
  // turn a tie into a finding.
  countries.sort((a, b) =>
    b.articleCount !== a.articleCount
      ? b.articleCount - a.articleCount
      : a.iso2.localeCompare(b.iso2),
  );

  const primary =
    countries.length > 0 &&
    (countries.length === 1 || countries[0].articleCount > countries[1].articleCount)
      ? countries[0]
      : null;

  const resolvedArticleCount = countries.reduce((sum, c) => sum + c.articleCount, 0);
  const queryTarget = buildQueryTarget(response);

  /*
   * The country-aware retrieval filter, admitted as evidence on the G2
   * basis above — but only when the articles did not already resolve it
   * themselves, so a country never appears twice and the stronger
   * per-record basis always wins the entry.
   *
   * `articleCount` is the retained pool size, because that is exactly what
   * this basis supports: every retained article passed the filter. It is
   * not a per-record count and is not presented as one.
   */
  if (
    queryTarget !== null &&
    queryTarget.iso3 !== null &&
    !countries.some((c) => c.iso3 === queryTarget.iso3)
  ) {
    const meta = findCountryByIso3(queryTarget.iso3);
    if (meta !== undefined) {
      countries.push({
        iso2: meta.iso2,
        iso3: meta.iso3,
        isoNumeric: meta.isoNumeric,
        name: queryTarget.name ?? meta.name,
        articleCount: articles.length,
        articleIds: articles.map((a) => a.id),
        basis: 'retrieval-filter',
      });
    }
  }

  /*
   * §4.5 — disagreement is measured against PER-RECORD evidence only.
   * Comparing the route country against a list that now contains the route
   * country (as 'retrieval-filter') could never disagree with itself.
   */
  const articleEvidence = countries.filter((c) => c.basis === 'article-evidence');
  const targetDisagreesWithEvidence =
    queryTarget !== null &&
    queryTarget.iso3 !== null &&
    articleEvidence.length > 0 &&
    !articleEvidence.some((c) => c.iso3 === queryTarget.iso3);

  return {
    countries,
    primary,
    resolvedArticleCount,
    unresolvedArticleCount: unresolved,
    totalArticleCount: articles.length,
    /*
     * SPATIAL M1.0B — from the ARTICLES' own precision, never from the
     * presence of a country in `countries` (which can be retrieval-filter).
     */
    precisionCeiling: evidenceDisplayCeiling(articles),
    queryTarget,
    targetDisagreesWithEvidence,
    empty: countries.length === 0,
  };
}
