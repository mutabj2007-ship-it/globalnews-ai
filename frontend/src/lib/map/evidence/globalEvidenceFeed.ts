import { COUNTRIES, type LanguageCode, type NewsArticle, type NewsResponse } from '@globalnews-ai/shared';
import { articleSpatialPrecision } from '@/lib/spatial/spatialPrecision';
import type { DisplayPrecision } from '@/lib/map/spatial/precisionModel';
import type { EvidenceRecord, EvidenceSet } from './evidenceModel';
import type { ArticleWithProvenance } from '@/lib/spatial/spatialPrecision';

/**
 * SPATIAL M2 · H-1 — THE WORLD VIEW'S EVIDENCE SOURCE.
 *
 * ── THE DEFECT THIS CLOSES (H-1 / P6) ────────────────────────────────────
 *
 * Browser acceptance against the real backend reported, on a clean `/map`:
 *
 *     ranked=0  geographies=null  reports=null  sources=null
 *
 * while `GET /geo/map-feed` itself passed. Both were true, and they were not
 * about the same thing.
 *
 * Reproduced on the authoritative C2 tree, production build, and the decisive
 * measurement is not about a response at all:
 *
 *     P6 · CLEAN /map : ranked 0, totals null, sourceCards 0
 *        evidence requests made: 0
 *        all requests: GET /api/users/me | GET /api/follows/countries
 *
 * **ZERO EVIDENCE REQUESTS ARE MADE.** The live response is not lost, not
 * rejected and not mis-mapped — it is never asked for. The Spatial evidence
 * model had exactly one feeder, `GET /news/country/:iso3`, and that feeder is
 * triggered only by selecting a country. A freshly opened map therefore had an
 * empty `evidenceSet`; `ContextSummaryPanel` rendered its honest empty state;
 * and the three totals elements the probe read DID NOT EXIST — which is why the
 * result is `null` rather than `0`.
 *
 * `/geo/map-feed` passing is consistent with all of that: it resolves TEXT, and
 * there is no text to resolve until a feed lands. It is an enrichment over
 * evidence, never a source of it.
 *
 * ── THE SOURCE, AND WHY IT IS THIS ONE ────────────────────────────────────
 *
 * `GET /news/top-headlines` — already shipped, already the homepage's own
 * feed, and every article it returns carries the fields the evidence model
 * needs, each resolved by the backend and none by me:
 *
 *   countryCode           ISO 3166-1 alpha-2, "resolved by the backend from
 *                         the article's own text or the query country, NEVER
 *                         back-filled"
 *   geographicPrecision   per article, absent means "not assessed"
 *   locationProvenance    per article, and it never affects precision
 *   sourceId · sourceName · url · imageUrl · publishedAt · category
 *
 * No fixture, no mock geography, no fabricated count, and G's precision and
 * provenance semantics are carried through untouched because they arrive on
 * the record and are not recomputed here.
 *
 * ── THE ONE RULE THAT MATTERS MOST ────────────────────────────────────────
 *
 * `countryCode`'s own contract: *"A consumer must read absence as 'we do not
 * know', never as 'nowhere'."*
 *
 * So an article without one produces **no record**. It is not placed at a
 * guess, not attributed to the reader's location, not attributed to the
 * publisher's country, and not dropped into an "unknown" bucket that would
 * then be drawn somewhere. It contributes nothing to the map and stays
 * perfectly readable everywhere else. There is no parameter on this function
 * through which a fallback country could arrive.
 */

/** ISO-2 → ISO-3, through the shipped registry. A JOIN, never an inference. */
const iso3ForIso2 = new Map(COUNTRIES.map((country) => [country.iso2, country.iso3]));

export interface GlobalEvidenceOptions {
  /** Localised country name, supplied by the caller that owns the dictionary. */
  readonly displayNameFor: (iso3: string, fallback: string) => string;
  readonly language?: LanguageCode;
}

/** The articles that carry a country the registry knows. Nothing else. */
export function placeableArticles(
  articles: readonly NewsArticle[],
): readonly { readonly article: NewsArticle; readonly iso3: string }[] {
  const out: { article: NewsArticle; iso3: string }[] = [];

  for (const article of articles) {
    if (article.countryCode === undefined) continue;

    const iso3 = iso3ForIso2.get(article.countryCode.toUpperCase());

    /*
      A code the registry does not know is DISCARDED, not coerced. The map can
      only draw countries it has geometry for, and inventing an identity for an
      unrecognised code would put a record somewhere no article claimed.
    */
    if (iso3 === undefined) continue;

    out.push({ article, iso3 });
  }

  return out;
}

/**
 * One record per placeable article, at the ARTICLE's own precision.
 *
 * Not one per country: a country holding a STATED country-level article and an
 * INTERPRETED city-level article holds two different claims, and collapsing
 * them would lose exactly the distinction the two axes exist to preserve.
 * `geographyTotals` re-aggregates for display, which is where display
 * decisions belong.
 */
export function globalEvidenceRecords(
  articles: readonly NewsArticle[],
  options: GlobalEvidenceOptions,
): readonly EvidenceRecord[] {
  return placeableArticles(articles).map(({ article, iso3 }) => ({
    id: article.id,
    geography: {
      id: iso3,
      countryIso3: iso3,
      displayName: options.displayNameFor(iso3, article.countryName ?? iso3),
      /*
        NO POINT. A country-precision record has no coordinate, and a centroid
        would be a claim about a place inside the country that no article made.
        A finer point arrives only from G's map feed, which asserts one.
      */
    },
    precision: articleSpatialPrecision(article) as DisplayPrecision,
    provenance: (article as ArticleWithProvenance).locationProvenance,
    /* One article is one report. */
    reportCount: 1,
    /*
      The provider's own `sourcesCount` is carried for producers that populate
      it, but the DISTINCT-outlet count comes from `publisherId` — see the note
      on `EvidenceRecord.publisherId`.
    */
    sourceCount: article.sourcesCount > 0 ? article.sourcesCount : 1,
    publisherId: article.sourceId,
    confidence: article.confidence,
    lastObservedAt: article.publishedAt,
    headline: article.title,
    topics: article.category ? [article.category] : undefined,
  }));
}

/** The newest article's timestamp, so the period window has a real edge. */
const newestPublishedAt = (articles: readonly NewsArticle[]): string => {
  let newest = 0;

  for (const article of articles) {
    const at = Date.parse(article.publishedAt);

    if (Number.isFinite(at) && at > newest) newest = at;
  }

  return new Date(newest === 0 ? Date.now() : newest).toISOString();
};

export function globalEvidenceSet(
  response: NewsResponse,
  options: GlobalEvidenceOptions,
): EvidenceSet {
  const records = globalEvidenceRecords(response.articles, options);

  return {
    records,
    /*
      GLOBAL — this is the whole-world scope Part II §3 names, and it is the
      honest label for a feed that was not asked about any one place.
    */
    scope: 'GLOBAL',
    loadedAt: newestPublishedAt(response.articles),
  };
}
