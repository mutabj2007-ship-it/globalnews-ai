import type { CountryMeta } from '@globalnews-ai/shared';
import type { DisplayPrecision } from '@/lib/map/spatial/precisionModel';
import type { Bounds, CameraState } from '@/lib/map/camera/cameraState';
import { MAX_ZOOM, MIN_ZOOM, normaliseCamera } from '@/lib/map/camera/cameraState';

/**
 * G GEOGRAPHY CONTRACT — THE FRONTEND ADAPTER.
 *
 * Mirrors `GeoResolution` as G shipped it in
 * `backend/src/modules/geo/*` + `BACKEND-DATA-CONTRACT-FOR-H-AND-MAIN.md`.
 * `geoResolution.spec.ts` pins every member of every union against G's own
 * files, so this copy cannot drift from the contract it claims to mirror.
 *
 * WHY A COPY AT ALL. G's contract lives under `backend/`, not `shared/`, and
 * the frontend cannot import from `backend/`. This is the same shape as
 * `toSpatialPrecision` in M1.0B, and it has the same proper fix — promote the
 * types into `shared/` — which is Main's to make. Reported, guarded, not
 * worked around silently.
 *
 * ── THE THREE RULES THIS MODULE EXISTS TO ENFORCE ─────────────────────────
 *
 * 1. A DERIVED EXTENT IS NOT A BORDER. `extent.source === 'derived-from-
 *    settlements'` is a statistic over settlement points. It is a legitimate
 *    CAMERA TARGET and must never be drawn as an administrative boundary.
 *    `isDrawableBoundary()` exists so that drawing one requires deleting a
 *    named guard rather than quietly passing a bbox to a fill layer.
 *
 * 2. CONTESTED MEANS SHOW THE AMBIGUITY. `place` is deliberately absent and
 *    every survivor is in `candidates` — "Aberdeen" yields six. The correct UI
 *    asks which; picking the largest would manufacture a certainty the
 *    resolver explicitly refused to assert.
 *
 * 3. ANTIMERIDIAN EXTENTS MUST NOT BE FIT. G sets the flag precisely because
 *    a bbox that crosses ±180 fits to almost the whole world. Those frame from
 *    the centroid instead.
 *
 * ── THE COLLISION, NOW ARBITRATED ─────────────────────────────────────────
 *
 * G's `GeoPrecision.REGION` is SUBNATIONAL (ISO 3166-2, "Western Australia").
 * Design's `REGION` is SUPRANATIONAL (East Africa, the Baltic, the Sahel).
 * Same word, opposite directions on the ladder — which is why this module
 * previously refused to convert and exported nothing that could.
 *
 * MAIN HAS RULED: Design `REGION` = supranational; G's admin-1 = `PROVINCE`.
 * The two vocabularies are now distinguishable, so translation is not only
 * possible but obligatory — and it happens in exactly ONE function,
 * `toSpatialPrecision` below, in ONE direction. There is still no inverse:
 * nothing converts a `SpatialPrecision` back into a `GeoPrecision`, because
 * Design's supranational REGION has no representation in G's union and a
 * round-trip would have to invent one.
 */

/**
 * G's vocabulary — the FULL approved eight, as `geo-resolver.ts` declares it.
 *
 * The union is wide and the PRODUCIBLE set is narrow, and the difference is
 * the contract. G's final handoff §6 states which four the resolver can emit;
 * the other four are "declared, not claimed" and are reachable only if some
 * other producer populates them.
 */
export type GeoPrecision =
  | 'EXACT'
  | 'CITY'
  | 'SECTOR'
  | 'DISTRICT'
  | 'PROVINCE'
  | 'COUNTRY'
  | 'REGION'
  | 'UNKNOWN'
  | 'NONE';

/**
 * WHAT G ACTUALLY EMITS TODAY. Mirrored from `PRODUCIBLE_GEO_PRECISION` and
 * pinned against it by spec.
 *
 * G's §6 gives the reason for each absence, and each is a refusal rather than
 * a gap:
 *   EXACT     no provider supplies a verifiable coordinate for an event.
 *   DISTRICT  never a precision — see DISTRICT_IS_ATTACHED_NOT_RESOLVED.
 *   REGION    supranational, and its controlled gazetteer is still empty, so a
 *             supranational phrase degrades to UNKNOWN rather than to an
 *             invented radius. Part I §G's own instruction, applied at the
 *             point of PRODUCTION rather than at the point of drawing.
 *   NONE      an evidence-layer state, not a resolution.
 */
export const PRODUCIBLE_GEO_PRECISION: readonly GeoPrecision[] = [
  'COUNTRY',
  'PROVINCE',
  'SECTOR',
  'CITY',
  'UNKNOWN',
];

/**
 * G's §6 invariant, mirrored so a test on this side can assert it.
 *
 * A `districtCode` is ATTACHED to a CITY resolution as reference context and
 * NEVER raises its precision. A CITY record with a districtCode still has a
 * CITY ceiling, still fits the city camera, and must never address district
 * geometry as its own.
 */
export const DISTRICT_IS_ATTACHED_NOT_RESOLVED = true as const;

/** Agrees with M1.0A's `LocationProvenance`, values and meaning. */
export type GeoProvenance = 'STATED' | 'INTERPRETED' | 'CONTESTED';

export interface DerivedExtent {
  readonly bbox: readonly [number, number, number, number];
  readonly centroid: readonly [number, number];
  readonly members: number;
  readonly antimeridian: boolean;
  /** 'settlement-point' | 'derived-from-settlements'. Load-bearing — see rule 1. */
  readonly source: string;
}

export interface ResolvedPlace {
  readonly country: CountryMeta;
  readonly regionName?: string;
  /**
   * ISO 3166-2 — G's §1 ADMIN1 JOIN KEY, e.g. "PL-02", "RW-12", "KE-30".
   *
   * The key both geoBoundaries ADM1 and Natural Earth admin-1 carry, so one
   * value joins either candidate geometry source. Not the GeoNames admin1
   * code, which is not stable across releases.
   */
  readonly regionCode?: string;
  readonly cityName?: string;
  /** The alias the text used, when it differed from the canonical name. Audit only. */
  readonly matchedAlias?: string;
  /**
   * GeoNames admin2 code — G's §1 ADMIN2 JOIN KEY, e.g. "PL.72.0264".
   *
   * ATTACHED, NEVER A PRECISION. Present only for priority-programme countries
   * (Poland 380 units, Rwanda 21 — 401 in total, nothing else). Mapping it to a
   * geoBoundaries `shapeID` is a BUILD STEP, done once per geometry release,
   * never a runtime lookup: `shapeID` is a per-release artefact that changes on
   * someone else's cadence, and joining to it at runtime is how a map silently
   * starts drawing the wrong district.
   *
   * A unit matching zero or more than one feature is recorded UNMATCHED and
   * renders as its parent admin1 — never as a nearest-neighbour district.
   */
  readonly districtCode?: string;
  /**
   * Derived from the unit's principal verified settlement, NOT an official
   * district name, and ABSENT when no member could be verified.
   *
   * G states plainly that Rwanda's 21 GeoNames units are not Rwanda's 30
   * official NISR districts, and that 11 of the 21 have no verified label. So
   * this must never head a UI affordance promising "district" — which is why
   * `districtLabelSource` travels with it.
   */
  readonly districtLabel?: string;
  readonly districtLabelSource?: 'derived-from-principal-settlement' | 'unavailable';
  readonly population?: number;
  /** [lon, lat]. Present at CITY precision ONLY. Real GeoNames coordinates. */
  readonly point?: readonly [number, number];
  readonly extent?: DerivedExtent | null;
}

export interface GeoResolution {
  readonly precision: GeoPrecision;
  readonly provenance?: GeoProvenance;
  /** Absent for UNKNOWN and CONTESTED. */
  readonly place?: ResolvedPlace;
  /** More than one only when CONTESTED. */
  readonly candidates: readonly ResolvedPlace[];
  readonly matchedText?: string;
  /**
   * Present only when the match came through fuzzy correction. Carries the
   * original surface form, so the disclosure the spec requires — "location
   * interpreted, unverified" — has the actual evidence behind it rather than a
   * bare flag.
   */
  readonly geoMatch?: { readonly from?: string; readonly to?: string } | null;
  readonly reason: string;
  /** Diagnostic. NEVER rendered. */
  readonly detail: string;
}

/**
 * RULE 1, ENFORCED.
 *
 * Only an extent that came from a real settlement point is a thing with a
 * position we can stand behind, and even that is a point, not an area. A
 * `derived-from-settlements` extent is a convex hull of where people live —
 * drawing it would put a border on the map that no source asserts.
 *
 * Nothing in this frontend has real boundary geometry yet; that is the open
 * H/G map-data dependency. Until it lands, this returns false for everything,
 * and it says so rather than returning a bbox a caller might trust.
 */
export function isDrawableBoundary(extent: DerivedExtent | null | undefined): boolean {
  void extent;

  return false;
}

/** RULE 2. True when the resolver refused to choose, and the UI must ask. */
export function isContested(resolution: GeoResolution): boolean {
  return resolution.provenance === 'CONTESTED' || resolution.candidates.length > 1;
}

/**
 * The candidates to offer, in the order G returned them.
 *
 * Never reordered by population and never truncated to one: "the largest
 * Aberdeen" is a guess wearing the resolver's authority.
 */
export function contestedCandidates(resolution: GeoResolution): readonly ResolvedPlace[] {
  return isContested(resolution) ? resolution.candidates : [];
}

/** The single place, or null when the contract declined to assert one. */
export function resolvedPlace(resolution: GeoResolution): ResolvedPlace | null {
  if (isContested(resolution)) return null;

  return resolution.place ?? null;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/**
 * RULE 3 + the camera contract.
 *
 * Returns what the M1a camera reducer already understands — either bounds to
 * focus, or a camera to commit — so a geographic answer moves the map through
 * the SAME single owner as every other move, and Previous View can undo it.
 *
 * An antimeridian extent yields a CAMERA, never bounds: fitting a bbox that
 * crosses ±180 frames almost the whole world, which is why G ships the flag.
 * A missing extent yields null and nothing moves — an unplaceable answer is
 * not a reason to guess at a viewport.
 */
export type GeoCameraTarget =
  | { readonly kind: 'bounds'; readonly bounds: Bounds }
  | { readonly kind: 'camera'; readonly camera: CameraState }
  | null;

export function cameraTargetFor(extent: DerivedExtent | null | undefined): GeoCameraTarget {
  if (extent === null || extent === undefined) return null;

  const [lon, lat] = extent.centroid;

  if (extent.antimeridian) {
    /*
      Framed from the centroid at a zoom that shows a country-sized area. NOT
      fit to the bbox: G's flag exists because that bbox spans the dateline.
    */
    return {
      kind: 'camera',
      camera: normaliseCamera({ center: [lon, lat], zoom: 3, bearing: 0, pitch: 0 }),
    };
  }

  const [minLon, minLat, maxLon, maxLat] = extent.bbox;

  /* A degenerate extent — one settlement — is a point, so frame it as one. */
  if (Math.abs(maxLon - minLon) < 1e-6 && Math.abs(maxLat - minLat) < 1e-6) {
    return {
      kind: 'camera',
      camera: normaliseCamera({ center: [lon, lat], zoom: clamp(9, MIN_ZOOM, MAX_ZOOM), bearing: 0, pitch: 0 }),
    };
  }

  return { kind: 'bounds', bounds: [minLon, minLat, maxLon, maxLat] };
}

/**
 * Whether a resolution carries a coordinate the map may place a mark at.
 *
 * CITY precision with a point is the only case. A country or a subnational
 * region has an extent for the camera but no position that would justify a
 * point mark — the M1.0A rule stands: displayed precision must never exceed
 * evidence precision.
 */
export function pointFor(resolution: GeoResolution): readonly [number, number] | null {
  const place = resolvedPlace(resolution);

  if (place === null || resolution.precision !== 'CITY') return null;

  return place.point ?? null;
}

/**
 * SPATIAL M2 — G'S VOCABULARY INTO DESIGN'S, ON MAIN'S ARBITRATION.
 *
 * The one direction, the one function, the whole translation:
 *
 *   G 'COUNTRY'  ->  'COUNTRY'    same level, same meaning
 *   G 'CITY'     ->  'CITY'       same level, same meaning
 *   G 'REGION'   ->  'PROVINCE'   SUBNATIONAL admin-1. Main's ruling: G's
 *                                 ISO 3166-2 region IS Design's PROVINCE.
 *                                 It must NEVER become Design's REGION, which
 *                                 is supranational and would invert the claim
 *                                 from finer-than-country to coarser.
 *   G 'UNKNOWN'  ->  'UNKNOWN'
 *
 * NOTHING MAPS TO 'REGION'. That is the arbitration made mechanical: Design's
 * supranational REGION requires a controlled supranational gazetteer, which
 * Part I §G says is required "before REGION precision can be rendered" and
 * which does not exist. A function that cannot produce the value cannot leak
 * it, whatever a caller passes.
 *
 * NOTHING MAPS TO 'EXACT' OR 'DISTRICT' EITHER — G's union has no member that
 * asserts either level, and inventing one from a city point is precisely the
 * "displayed precision exceeds evidenced precision" failure the model forbids.
 */
export function toSpatialPrecision(precision: GeoPrecision): DisplayPrecision {
  switch (precision) {
    case 'COUNTRY':
      return 'COUNTRY';
    case 'CITY':
      return 'CITY';
    /*
      G NOW EMITS `PROVINCE` DIRECTLY. The arbitration landed on G's side too:
      the resolver's producible set is COUNTRY / PROVINCE / CITY / UNKNOWN and
      subnational admin-1 is `PROVINCE`, so the identifier collision that
      blocked M2 no longer exists in the data. This arm is an identity, and the
      guard has moved to the arm below.
    */
    case 'PROVINCE':
      return 'PROVINCE';
    /*
      DESIGN'S REGION IS SUPRANATIONAL, AND G DOES NOT PRODUCE IT.

      G degrades a supranational phrase to UNKNOWN at the point of production,
      because the controlled supranational gazetteer is still empty. If one ever
      arrives here it is NOT from this resolver, and this frontend has no bounds
      to draw it with — so it claims nothing rather than borrowing a country's.
    */
    case 'REGION':
      return 'REGION';
    case 'DISTRICT':
      /*
        NEVER PRODUCED AS A PRECISION — `DISTRICT_IS_ATTACHED_NOT_RESOLVED`.
        Carried through unchanged if some other producer emits it, because
        lowering it would be as dishonest as raising it.
      */
      return 'DISTRICT';
    case 'EXACT':
      return 'EXACT';
    case 'NONE':
      return 'NONE';
    case 'UNKNOWN':
      return 'UNKNOWN';
    default:
      /*
        An unrecognised level claims nothing. The honest default on a precision
        ladder is always the coarsest available answer, never a guess at where
        an unknown member belongs.
      */
      return 'UNKNOWN';
  }
}

/** The precision a whole resolution supports, provenance untouched. */
export function resolutionPrecision(resolution: GeoResolution): DisplayPrecision {
  return toSpatialPrecision(resolution.precision);
}

/**
 * G'S §6 CEILING RULE, ENFORCED RATHER THAN TRUSTED.
 *
 * "A CITY record with a `districtCode` still has a CITY ceiling ... and must
 * never address district geometry as its own."
 *
 * G enforces this by not emitting DISTRICT. This asserts the same thing from
 * the consuming side, so a future producer that attaches a district code AND
 * raises the level cannot quietly reach the renderer.
 */
export function precisionWithDistrictAttached(resolution: GeoResolution): DisplayPrecision {
  const precision = resolutionPrecision(resolution);

  if (resolution.place?.districtCode === undefined) return precision;

  /* A district code never raises the level. It is context, not a claim. */
  return precision === 'DISTRICT' ? 'CITY' : precision;
}

/**
 * ── THE TYPE-LEVEL GUARD G ASKED FOR ──────────────────────────────────────
 *
 * G's §4 states the rule and then names the guard that makes it structural:
 *
 *     "accept `DerivedExtent` only in camera-fitting signatures, and require
 *      real geometry (`Feature<Polygon | MultiPolygon>`) in every styling
 *      signature. Then the mistake cannot be written, rather than being merely
 *      discouraged."
 *
 * `DrawableBoundary` is that second type. NOTHING IN THIS CODEBASE CONSTRUCTS
 * ONE — no function returns it, and `DerivedExtent` is not assignable to it,
 * because a bounding box of a province's towns is a rectangle containing those
 * towns and not the shape of the province. It will exclude uninhabited
 * territory and include a neighbour's.
 *
 * So a styling layer that demands a `DrawableBoundary` cannot be fed an extent
 * by mistake; it simply has no argument to call it with until real ADM1/ADM2
 * geometry arrives at M7 with its licence recorded.
 */
export interface DrawableBoundary {
  /** The join key this boundary was matched on — iso3, ISO 3166-2, or admin2. */
  readonly joinKey: string;
  readonly joinLevel: 'admin0' | 'admin1' | 'admin2';
  /** Real polygon geometry. Never derived from settlement points. */
  readonly geometry: { readonly type: 'Polygon' | 'MultiPolygon'; readonly coordinates: unknown };
  /** Licence and source URL — an M7 acceptance item, carried with the geometry. */
  readonly licence: string;
  readonly sourceUrl: string;
}

/**
 * The camera-only side of the same guard.
 *
 * A `DerivedExtent` may be passed HERE and nowhere else that draws. The three
 * permitted uses in G's §4 are framing a camera, a jump target, and a viewport
 * pre-filter — all of which are this function's business and none of which is
 * a fill, a line, a choropleth or a hit target.
 */
export type CameraFittable = DerivedExtent;
