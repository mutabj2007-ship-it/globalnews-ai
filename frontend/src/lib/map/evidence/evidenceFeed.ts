import type { CountryNewsResponse, NewsArticle } from '@globalnews-ai/shared';
import { articleSpatialPrecision } from '@/lib/spatial/spatialPrecision';
import {
  type GeoResolution,
  isDrawableBoundary,
  precisionWithDistrictAttached,
} from '@/lib/spatial/geoResolution';
import { toSpatialPrecision } from '@/lib/spatial/geoResolution';
import type { DisplayPrecision } from '@/lib/map/spatial/precisionModel';
import { rendersAsPoint } from '@/lib/map/spatial/precisionModel';
import type { MapEvidenceGeography, MapGeography } from '@/lib/api/mapFeedApi';
import type { EvidenceGeography, EvidenceRecord, EvidenceSet } from './evidenceModel';
import type { ArticleWithProvenance } from '@/lib/spatial/spatialPrecision';

/**
 * SPATIAL M2 — THE REAL FEED, TURNED INTO EVIDENCE THE MAP CAN DRAW.
 *
 * Two producers, deliberately separate, because they carry different amounts
 * of truth and must not be blended into one confident-looking layer.
 *
 * ── 1. COUNTRY EVIDENCE, FROM THE LIVE COUNTRY FEED ───────────────────────
 *
 * `GET /news/country/:iso3` already returns real `NewsArticle[]`, and every
 * article carries `geographicPrecision` and `locationProvenance` — the two
 * axes, on the wire, today. This is the feed the World Map route has always
 * fetched; M2 stops throwing its geography away.
 *
 * The country identity comes from the ISO code the request was made with, NOT
 * from resolving the country's NAME out of text. That distinction matters
 * enormously right now — see the note on `geoRecordsFrom` — and it is why this
 * producer is unaffected by the resolver finding reported to G.
 *
 * ── 2. RESOLVED GEOGRAPHY, FROM G's RESOLVER ──────────────────────────────
 *
 * `GeoResolution` carries real GeoNames coordinates at CITY, ISO 3166-2 at
 * PROVINCE, and honest candidate lists when CONTESTED. `geoRecordsFrom` turns
 * one into records — and refuses to turn a CONTESTED one into anything
 * placeable, because the resolver deliberately declined to choose.
 *
 * ── WHAT NEITHER PRODUCER WILL DO ─────────────────────────────────────────
 *
 * Neither invents geography. There is no parameter on either function through
 * which a query's country, a publisher's country or a retrieval context could
 * reach a record, and neither ever produces a boundary: `isDrawableBoundary`
 * is false for every extent and the styling type `DrawableBoundary` is
 * constructed nowhere.
 */

/** ISO timestamp of the newest article, so the period window has a real edge. */
const newestPublishedAt = (articles: readonly NewsArticle[]): string => {
  let newest = 0;

  for (const article of articles) {
    const at = Date.parse(article.publishedAt);

    if (Number.isFinite(at) && at > newest) newest = at;
  }

  return new Date(newest === 0 ? Date.now() : newest).toISOString();
};

/**
 * One record per article, at the article's OWN precision.
 *
 * NOT one record per country. A country holding a STATED country-level article
 * and an INTERPRETED city-level article holds two different claims, and
 * collapsing them into a single country row would lose exactly the distinction
 * the two axes exist to preserve. `geographyTotals` re-aggregates for display
 * and keeps the finest precision claimed — that is a display decision, made
 * where display decisions belong.
 */
export function countryRecordsFrom(
  response: CountryNewsResponse,
  displayName: string,
): readonly EvidenceRecord[] {
  const geography: EvidenceGeography = {
    id: response.countryCode,
    countryIso3: response.countryCode,
    displayName,
    /*
      NO POINT. A country-precision record has no coordinate, and a centroid
      would be a claim about a place inside the country that no article made.
      Part I §G: "a country-ceiling record can never render as a point on a
      street."
    */
  };

  return response.articles.map((article) => ({
    id: article.id,
    geography,
    precision: articleSpatialPrecision(article) as DisplayPrecision,
    provenance: (article as ArticleWithProvenance).locationProvenance,
    /* One article is one report. The source count is the article's own. */
    reportCount: 1,
    sourceCount: article.sourcesCount > 0 ? article.sourcesCount : 1,
    confidence: article.confidence,
    lastObservedAt: article.publishedAt,
    headline: article.title,
    topics: article.category ? [article.category] : undefined,
  }));
}

export function countryEvidenceSet(
  response: CountryNewsResponse,
  displayName: string,
): EvidenceSet {
  const records = countryRecordsFrom(response, displayName);

  return {
    records,
    scope: 'GLOBAL',
    loadedAt: newestPublishedAt(response.articles),
  };
}

/** Merge several countries' sets into the one the World Map draws. */
export function mergeEvidenceSets(sets: readonly EvidenceSet[]): EvidenceSet {
  if (sets.length === 0) {
    return { records: [], scope: 'GLOBAL', loadedAt: new Date(0).toISOString() };
  }

  let loadedAt = 0;

  for (const set of sets) {
    const at = Date.parse(set.loadedAt);

    if (Number.isFinite(at) && at > loadedAt) loadedAt = at;
  }

  return {
    records: sets.flatMap((set) => set.records),
    scope: 'GLOBAL',
    loadedAt: new Date(loadedAt).toISOString(),
  };
}

export interface GeoRecordInput {
  readonly id: string;
  readonly resolution: GeoResolution;
  readonly lastObservedAt: string;
  readonly reportCount?: number;
  readonly sourceCount?: number;
  readonly headline?: string;
}

/**
 * Records from a G resolution.
 *
 * ── CONTESTED PRODUCES NOTHING PLACEABLE, AND THAT IS THE POINT ───────────
 *
 * G's §7: a CONTESTED resolution has no `place`, "so there is nothing to place
 * on the map. The live adapter therefore DECLINES rather than picking a
 * candidate ... The honest surface for a contested geography is a
 * clarification request, not a guess rendered dashed."
 *
 * So this returns an empty record list for CONTESTED, and the candidates are
 * returned separately by `contestedCandidatesFor` for a surface that asks
 * WHICH — never for one that draws six dots and lets the reader assume the
 * biggest is right.
 *
 * ── AND A DISTRICT CODE NEVER RAISES THE LEVEL ────────────────────────────
 *
 * `precisionWithDistrictAttached` is the ceiling rule from the consuming side.
 */
export function geoRecordsFrom(input: GeoRecordInput): readonly EvidenceRecord[] {
  const { resolution } = input;

  if (resolution.provenance === 'CONTESTED' || resolution.place === undefined) return [];

  const place = resolution.place;
  const precision = precisionWithDistrictAttached(resolution);

  /*
    The geography id is the JOIN KEY at the level the record actually holds —
    G's §1 table, used as the identity rather than as decoration. A CITY record
    keyed by its country would merge with every other record in that country
    and lose the coordinate that makes it a city record at all.
  */
  const id =
    precision === 'CITY' && place.cityName !== undefined
      ? `${place.country.iso3}:${place.regionCode ?? '-'}:${place.cityName}`
      : precision === 'PROVINCE' && place.regionCode !== undefined
        ? place.regionCode
        : place.country.iso3;

  const displayName =
    precision === 'CITY'
      ? (place.cityName ?? place.country.name)
      : precision === 'PROVINCE'
        ? (place.regionName ?? place.regionCode ?? place.country.name)
        : place.country.name;

  return [
    {
      id: input.id,
      geography: {
        id,
        countryIso3: place.country.iso3,
        displayName,
        /*
          THE REAL COORDINATE, AND ONLY WHERE THERE IS ONE. G supplies `point`
          at CITY precision only — real GeoNames settlement coordinates rounded
          to five decimal places, not a country centroid standing in for a city.
        */
        point: precision === 'CITY' ? place.point : undefined,
      },
      precision,
      provenance: resolution.provenance,
      reportCount: input.reportCount ?? 1,
      sourceCount: input.sourceCount ?? 1,
      lastObservedAt: input.lastObservedAt,
      headline: input.headline,
    },
  ];
}

/**
 * The candidates a CONTESTED resolution offers, in G's order.
 *
 * UNSORTED AND UNTRUNCATED. Reordering by population would be the resolver's
 * refusal to choose, quietly overridden by the presentation layer.
 */
export function contestedCandidatesFor(resolution: GeoResolution): readonly EvidenceGeography[] {
  if (resolution.provenance !== 'CONTESTED') return [];

  return resolution.candidates.map((candidate, index) => ({
    id: `${candidate.country.iso3}:${candidate.regionCode ?? '-'}:${candidate.cityName ?? index}`,
    countryIso3: candidate.country.iso3,
    displayName:
      candidate.cityName !== undefined
        ? `${candidate.cityName}, ${candidate.country.name}`
        : candidate.country.name,
    point: candidate.point,
  }));
}

/**
 * A last structural restatement of G's §4, at the boundary where records reach
 * the renderer: NOTHING derived becomes a border.
 *
 * Returns the extents that may be used as CAMERA TARGETS, and is named so that
 * a caller reaching for geometry finds a function that says camera.
 */
export function cameraTargetsOnly(
  resolutions: readonly GeoResolution[],
): readonly NonNullable<GeoResolution['place']>['extent'][] {
  return resolutions
    .map((resolution) => resolution.place?.extent ?? null)
    .filter((extent) => extent !== null && !isDrawableBoundary(extent));
}

/* ════════════════════════════════════════════════════════════════════════════
   3. G's MAP FEED — THE LIVE PRODUCTION ADAPTER
   ════════════════════════════════════════════════════════════════════════════

   `GET /geo/map-feed` returns `MapEvidenceGeography`, and it is a DIFFERENT
   shape from the `GeoResolution` the two functions above consume: it carries a
   collision-free `geographyId`, a `joinKeys` block, a camera, and — decisively
   — the two booleans that make the record's state readable rather than
   inferable.

   `geoRecordsFrom` above is retained unchanged because Analysis still holds
   `GeoResolution` values. This is the adapter the MAP uses, and it is separate
   rather than merged so that neither shape's rules leak into the other's.

   ── THE STATE IS READ FROM `renderable` AND `contested` ────────────────────

   G's §1: the four states "are mutually exclusive by construction", and
   `renderable` exists "so H never has to reconstruct that logic from three
   nullable fields and get it subtly wrong on one surface out of six". So the
   branch below tests those two booleans, in that order, and never asks whether
   `place` happens to be defined.

   ── AND `geographyId` IS TREATED AS OPAQUE ────────────────────────────────

   G's §2: "Treat it as opaque. Parse it and you have coupled to this rule.
   Join on `joinKeys`, which is what they are for." So the id is copied whole
   and the country comes from `joinKeys.iso3`. No substring of the id is read
   anywhere in this file.
*/

export interface MapFeedRecordInput {
  readonly id: string;
  readonly feed: MapEvidenceGeography;
  readonly lastObservedAt: string;
  readonly reportCount?: number;
  readonly sourceCount?: number;
  readonly headline?: string;
  /**
   * The item's own category, carried so a selection-scoped card filter can
   * narrow the MARKERS as well as the list. Design revision 1.2 block 06
   * requires both, and a marker with no category could only ever be filtered
   * out or never — both of which would be wrong for half the set.
   */
  readonly topics?: readonly string[];
  /**
   * THE JOIN-KEY INTEGRITY GUARD, AND THE ONE REASON IT EXISTS.
   *
   * When the caller already knows which country's feed the text came from —
   * the map does, because it requested that country by ISO code — a resolution
   * whose `joinKeys.iso3` disagrees is DISCARDED rather than drawn.
   *
   * This is not a workaround for the resolver finding reported to G alongside
   * this package; it does not correct a resolution or substitute a better one.
   * It is the ordinary consuming-side check that a joined record belongs to the
   * row it was joined onto. Its effect here is that a Kenyan headline which
   * resolves to a settlement in another country contributes NOTHING, instead of
   * putting a marker on the wrong continent.
   */
  readonly expectCountryIso3?: string;
}

/** The geography of one map-feed place, at the level the feed asserted. */
function geographyOf(place: MapGeography, precision: DisplayPrecision): EvidenceGeography {
  return {
    /* OPAQUE. Copied, never parsed. */
    id: place.geographyId,
    /* JOINED, never read out of the id or the label. */
    countryIso3: place.joinKeys.iso3,
    /* The name the reader used, which is what G's `label` is for. */
    displayName: place.label,
    /*
      A POINT ONLY WHERE THE RECORD HOLDS ONE.

      Two independent conditions, both required: the precision must be one that
      renders as a point at all, and the place must actually be a settlement.
      `camera.center` exists at every level — for a COUNTRY or a PROVINCE it is
      the centre of a DERIVED EXTENT, and promoting that to a record's point
      would be exactly the centroid-standing-in-for-a-place failure the
      precision model exists to prevent.
    */
    point:
      rendersAsPoint(precision) && place.kind === 'city'
        ? [place.camera.center[0], place.camera.center[1]]
        : undefined,
  };
}

/**
 * Records from one map-feed projection.
 *
 * Returns AT MOST ONE record, and an empty list for every state that is not
 * renderable — CONTESTED and UNRESOLVABLE alike. A contested projection's
 * candidates are offered by `mapFeedCandidatesFor`, for a surface that asks
 * WHICH; they are never drawn as the answer.
 */
export function mapFeedRecordsFrom(input: MapFeedRecordInput): readonly EvidenceRecord[] {
  const { feed } = input;

  if (!feed.renderable) return [];
  if (feed.contested) return [];

  const place = feed.place;

  /*
    `renderable` is documented as true only when `place` is present. This
    narrows the optional for the type system and, if a producer ever breaks that
    invariant, declines rather than throwing inside a render.
  */
  if (place === undefined) return [];

  if (
    input.expectCountryIso3 !== undefined &&
    place.joinKeys.iso3.toUpperCase() !== input.expectCountryIso3.toUpperCase()
  ) {
    return [];
  }

  const precision = toSpatialPrecision(feed.precision);

  /*
    NOTHING RENDERABLE AT UNKNOWN OR NONE. A record whose level is not on the
    ladder has no geometry to occupy, and drawing it at its country would be a
    claim the feed did not make.
  */
  if (precision === 'UNKNOWN' || precision === 'NONE') return [];

  return [
    {
      id: input.id,
      geography: geographyOf(place, precision),
      precision,
      provenance: feed.locationProvenance,
      reportCount: input.reportCount ?? 1,
      sourceCount: input.sourceCount ?? 1,
      lastObservedAt: input.lastObservedAt,
      headline: input.headline,
      topics: input.topics,
    },
  ];
}

/**
 * The candidates a CONTESTED map-feed projection offers, in G's order.
 *
 * UNSORTED AND UNTRUNCATED, for the same reason as `contestedCandidatesFor`:
 * G's §1 says these "are NOT a ranking ... nothing separated them", and
 * reordering by population here would be the resolver's refusal to choose,
 * quietly overridden by the presentation layer.
 */
export function mapFeedCandidatesFor(
  feed: MapEvidenceGeography,
): readonly EvidenceGeography[] {
  if (!feed.contested) return [];

  const precision = toSpatialPrecision(feed.precision);

  return feed.candidates.map((candidate) => geographyOf(candidate, precision));
}
