import type { NewsArticle } from '@globalnews-ai/shared';
import {
  type DisplayPrecision,
  displayPrecisionFor,
  isFinerThan,
} from '@/lib/map/spatial/precisionModel';

/**
 * SPATIAL M1.0B — THE FRONTEND'S ONE READER OF ARTICLE PRECISION.
 *
 * ALPHA PRECISION R1 — THE LINE BELOW WAS FALSE IN THIS TREE AND IS CORRECTED.
 * It claimed M1.0A made the field produced. Measured here: no backend file
 * writes `NewsArticle.geographicPrecision`, two backend specs assert its
 * absence, and `withDerivedEvidenceFields` — named as its writer — does not
 * exist anywhere in this repository or in either historical worktree available.
 * The M1.0A contract module that documented the producer
 * (`backend/src/modules/spatial/spatial-precision.contract.ts`) is itself
 * ABSENT from the C907 line. Retained verbatim below as the superseded claim,
 * because deleting it would erase the conflict rather than record it:
 *
 * M1.0A made `NewsArticle.geographicPrecision` a produced field with a stated
 * contract. Until now the frontend did not read it: every geography surface
 * inferred precision from whether a country happened to be known, and the
 * comments around them still said the field "has zero writers". Both are now
 * false, and this module is the single place the frontend reconciles with the
 * source of truth.
 *
 * WHY THIS FILE DUPLICATES A BACKEND FUNCTION, AND WHY THAT IS GUARDED.
 *
 * The authoritative translation lives in
 * `backend/src/modules/spatial/spatial-precision.contract.ts`. It is NOT in
 * `@globalnews-ai/shared`, so the frontend cannot import it, and M1.0B is
 * forbidden from changing backend or shared to move it. The only remaining
 * options were to duplicate it or to leave the frontend unreconciled.
 *
 * Duplicating a total function is normally how two sources of truth are born.
 * So this copy is PINNED: `spatialPrecision.spec.ts` reads the backend
 * contract file and asserts, arm by arm, that this implementation agrees with
 * it — the same cross-workspace technique `adminCapabilityParity.spec.ts`
 * already uses in this repository. If the backend mapping changes and this one
 * does not, the suite fails.
 *
 * THE PROPER FIX IS STILL OPEN AND IS NOT MINE TO MAKE: promoting
 * `toSpatialPrecision` into `shared/` would delete this file entirely. That is
 * a shared-contract change, which this authorization freezes. Reported, not
 * worked around silently.
 */

/**
 * The levels the pipeline can actually emit today, mirrored from
 * `PRODUCIBLE_SPATIAL_PRECISION` and pinned against it by spec.
 *
 * Consumers must not build UI that assumes anything else arrives. CITY,
 * EXACT, DISTRICT, PROVINCE and REGION are declared in the vocabulary and
 * produced by nothing.
 */

export type SpatialPrecision =
  | 'EXACT'
  | 'CITY'
  | 'SECTOR'
  | 'DISTRICT'
  | 'PROVINCE'
  | 'COUNTRY'
  | 'REGION'
  | 'UNKNOWN';

export type LegacyGeographicPrecision = 'country' | 'region' | 'city' | 'coordinate' | 'unknown';

/**
 * SPATIAL PRODUCTION PORT — the optional article field, as a FRONTEND-LOCAL
 * PROJECTION rather than a change to the shared `NewsArticle` contract.
 *
 * C55 adds `locationProvenance?: LocationProvenance` to `NewsArticle`. Every
 * consumer in this port only ever READS it — never writes it, never asserts on
 * it, never propagates it to the backend — so a projection satisfies them all
 * and `shared/NewsArticle` stays untouched.
 *
 * ABSENT MEANS "NOT ASSESSED", which is exactly the semantics C55 documents.
 * A record from a backend that does not send the field simply reads `undefined`.
 */
export type ArticleWithProvenance = NewsArticle & {
  readonly locationProvenance?: LocationProvenance;
};

export type LocationProvenance = 'STATED' | 'INTERPRETED' | 'CONTESTED';

export const PRODUCIBLE_SPATIAL_PRECISION: readonly SpatialPrecision[] = [
  'COUNTRY',
  'SECTOR',
  'UNKNOWN',
];

/**
 * Translates the legacy wire vocabulary into the authoritative one.
 *
 * Mirrors `toSpatialPrecision`. Total, and lossy in exactly one place:
 *
 *   'region' -> UNKNOWN, NEVER 'REGION'. The authoritative REGION is
 *   SUPRANATIONAL; the legacy 'region' is treated everywhere in this codebase
 *   as SUBNATIONAL. Translating it would invert its meaning — from finer than
 *   a country to coarser than one — in the one direction a precision ceiling
 *   must never move. UNKNOWN is the only answer that claims nothing.
 *
 * ABSENT MEANS UNKNOWN AND NOTHING ELSE. Not the retrieval country, not the
 * query's country, not the publisher's country.
 */
export function toSpatialPrecision(
  legacy: LegacyGeographicPrecision | undefined,
): SpatialPrecision {
  switch (legacy) {
    case 'country':
      return 'COUNTRY';
    case 'city':
      return 'CITY';
    case 'coordinate':
      return 'EXACT';
    case 'region':
      /* Not REGION. See the note above. */
      return 'UNKNOWN';
    case 'unknown':
      return 'UNKNOWN';
    default:
      return 'UNKNOWN';
  }
}

/**
 * An article's precision, read from the article itself.
 *
 * THE SOURCE OF TRUTH IS THE FIELD, NOT THE COUNTRY CODE. The two agree for
 * everything the current pipeline derives, because `deriveGeographicPrecision`
 * returns 'country' exactly when `countryCode` is present — but
 * `withDerivedEvidenceFields` writes `article.geographicPrecision ?? derived`,
 * so a provider that supplies its own precision is never overwritten. Reading
 * `countryCode` would therefore silently disagree with a provider-supplied
 * value, which is precisely the reconciliation M1.0B exists to make.
 *
 * This function CANNOT see a retrieval context, a query or a publisher. That
 * is deliberate: it has no parameter through which a query's geography could
 * be attributed to an article.
 */
export function articleSpatialPrecision(article: Pick<NewsArticle, 'geographicPrecision'>): SpatialPrecision {
  return toSpatialPrecision(article.geographicPrecision);
}

/**
 * The rule, enforced rather than documented: provenance never raises precision.
 *
 * Returns the precision unchanged, whatever the provenance. It exists as a
 * function so that any future code tempted to promote a STATED location has to
 * delete a named guard to do it, instead of quietly adding a branch.
 */
export function assertProvenanceDoesNotRaisePrecision(
  precision: SpatialPrecision,
  provenance: LocationProvenance | undefined,
): SpatialPrecision {
  /*
   * Accepted and deliberately not read — that is the whole statement. The
   * signature admits the value a caller might act on; the body demonstrates
   * that acting on it is not part of the contract.
   */
  void provenance;

  return precision;
}

/**
 * What a surface is allowed to DRAW for a given precision.
 *
 * ── SPATIAL M2 — THE ABSOLUTE COUNTRY CLAMP IS GONE ───────────────────────
 *
 * M1.0B hardcoded this: CITY, EXACT, DISTRICT and PROVINCE all returned
 * 'country', unconditionally, because in M1.0B no finer geometry existed
 * anywhere in the frontend. That was true then and is false now — G ships real
 * city coordinates and real extents — so the clamp had stopped protecting
 * anything and started DESTROYING legitimate precision. Main's ruling names
 * exactly that: "remove the absolute country clamp; displayed precision may
 * never exceed evidenced precision; legitimate CITY/PROVINCE precision must
 * not be destroyed."
 *
 * WHAT REPLACED IT IS STRICTLY STRONGER, not weaker. The rule is now
 * `displayPrecisionFor(evidenced, available)` in `precisionModel.ts`: the
 * displayed level is the finest level BOTH claimed by the record AND supported
 * by geometry the surface actually holds. The old clamp said "never finer than
 * a country" and lost real city precision on the way; this says "never finer
 * than the evidence, and never finer than the geometry" and loses nothing that
 * can honestly be drawn.
 *
 * THIS FUNCTION IS THE ANALYSIS WORKSPACE'S BUDGET, AND SAYS SO.
 * `'country' | 'unresolved'` is not a statement about the product — it is the
 * two display states the Analysis geography surface has, because country
 * outlines are the only geometry it loads. It is expressed as
 * `available: 'COUNTRY'` rather than as a switch, so a surface that holds more
 * geometry asks `displayCeilingWithin` instead of inheriting a limit that was
 * never about it.
 */
export type DisplayableGeographyCeiling = 'country' | 'unresolved';

/**
 * The geometry the Analysis Workspace actually holds. Country outlines, and
 * nothing finer — admin-1 and admin-2 are Missing · M7 in Design Part II §4.
 */
export const ANALYSIS_AVAILABLE_GEOMETRY: DisplayPrecision = 'COUNTRY';

/**
 * The ceiling a surface may draw at, given what geometry it has.
 *
 * REGION resolves to 'unresolved' rather than 'country', and now for the
 * arbitrated reason rather than an ambiguous one: Design's REGION is
 * SUPRANATIONAL, so drawing it as a country would be FINER than the assertion
 * — the one direction a ceiling must never move — and its controlled
 * supranational gazetteer is empty, so no bounds exist to draw anyway.
 */
export function displayCeilingWithin(
  precision: DisplayPrecision,
  available: DisplayPrecision,
): DisplayableGeographyCeiling {
  const displayed = displayPrecisionFor(precision, available);

  if (displayed === 'UNKNOWN' || displayed === 'NONE') return 'unresolved';

  /* Supranational, and coarser than a country. Never drawn as one. */
  if (displayed === 'REGION') return 'unresolved';

  return 'country';
}

export function displayCeilingFor(precision: SpatialPrecision): DisplayableGeographyCeiling {
  return displayCeilingWithin(precision, ANALYSIS_AVAILABLE_GEOMETRY);
}

/**
 * WHETHER A RECORD'S OWN PRECISION SURVIVED THE SURFACE'S GEOMETRY BUDGET.
 *
 * The half M1.0B could not express. A CITY record drawn on a country-only
 * surface is drawn honestly — coarser than it claims — but the reader should
 * be told the record knows more than the picture shows, and the intelligence
 * card and banner need to know that too. True means the drawing is coarser
 * than the evidence; the evidence itself is untouched either way.
 */
export function precisionExceedsGeometry(
  precision: DisplayPrecision,
  available: DisplayPrecision = ANALYSIS_AVAILABLE_GEOMETRY,
): boolean {
  return isFinerThan(precision, available);
}

/**
 * The ceiling a whole set of articles supports.
 *
 * 'country' when AT LEAST ONE article's own precision supports it; otherwise
 * 'unresolved'. An empty set is 'unresolved' — absence of evidence is not a
 * country-level claim.
 *
 * Takes articles and nothing else. There is no parameter for a retrieval
 * context, so a query country cannot reach this calculation.
 */
export function evidenceDisplayCeiling(
  articles: readonly Pick<NewsArticle, 'geographicPrecision'>[],
): DisplayableGeographyCeiling {
  for (const article of articles) {
    if (displayCeilingFor(articleSpatialPrecision(article)) === 'country') return 'country';
  }

  return 'unresolved';
}


/*
 * ALPHA PRECISION R1 REV A — `evidencePrecisionAssessed()` WAS REMOVED, NOT KEPT.
 *
 * R1 added it to distinguish "no article carried a precision" from "precision
 * was assessed and did not resolve", because in the C907 line NOTHING wrote
 * `NewsArticle.geographicPrecision` and the ceiling was a silent constant.
 *
 * The M1.0A producer is now restored (`news/identity/geographic-precision.util.ts`),
 * so every article on both the live and cached paths carries an ASSESSED value —
 * 'country' or 'unknown'. The distinction the helper existed to express is now
 * carried by the field itself, and keeping the helper would leave two ways to
 * ask one question. It was removed rather than retained as a second truth
 * source.
 */
