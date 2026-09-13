import type { SpatialPrecision } from '@/lib/spatial/spatialPrecision';
import type { LocationProvenance } from '@/lib/spatial/spatialPrecision';

/**
 * SPATIAL M2 — THE TWO-AXIS PRECISION MODEL, AS CLAUDE DESIGN SPECIFIES IT.
 *
 * Part I §G and Part II §3: two independent fields, SUPERSEDING the former
 * single eight-value ceiling.
 *
 *   `precision`  governs halo geometry and the camera ceiling.
 *   `provenance` governs marker rendering, banner wording, verified-count
 *                inclusion and uncertainty disclosure.
 *
 * They are never collapsed into one confidence score. Part I §G is explicit
 * about why: "a STATED country record and an INTERPRETED city record are
 * differently useful, not rankable on one axis." No function here returns a
 * number that ranks a record, and none takes both fields and returns one
 * value — the shapes make the collapse unavailable rather than discouraged.
 *
 * ── WHAT THE ARBITRATION CHANGED ──────────────────────────────────────────
 *
 * `REGION` IS SUPRANATIONAL. Main arbitrated it, and Design and G now agree:
 * Design's REGION (East Africa, the Baltic, the Sahel) is supranational, and
 * G's subnational admin-1 is `PROVINCE`. The collision that blocked M2 is
 * closed, so `geoResolution.ts` may now translate G's vocabulary into this
 * one — in exactly one direction, through one named function.
 *
 * THE ABSOLUTE COUNTRY CLAMP IS GONE. M1.0B clamped CITY, EXACT, DISTRICT and
 * PROVINCE down to 'country' because no finer geometry existed in the
 * frontend. G now ships real city coordinates and real extents, so the clamp
 * would DESTROY legitimate precision — Main's ruling names this directly.
 * What replaces it is the honest rule, and it is the stronger one:
 *
 *     DISPLAYED PRECISION MAY NEVER EXCEED EVIDENCED PRECISION.
 *
 * A record may always be drawn coarser than it claims. It may never be drawn
 * finer. `displayPrecisionFor` enforces that against what geometry actually
 * exists, so removing the clamp cannot become an invitation to invent a
 * district.
 */

/**
 * Part II §3 adds `NONE` to the union: the state where a surface is drawing no
 * evidence at all, which is different from a record whose level is UNKNOWN.
 *
 * `SpatialPrecision` in `shared/` has seven members and no `NONE`. Widening
 * that union is a collision-sensitive shared change and is MAIN'S — see the
 * integration boundary in the CTO report. Until it lands, `NONE` lives here as
 * a display-only extension and never travels back toward the wire.
 */
export type DisplayPrecision = SpatialPrecision | 'NONE';

/**
 * Coarse-to-fine, as Part I §G orders it. REGION is SUPRANATIONAL and
 * therefore COARSER than COUNTRY — the arbitration made explicit as an index,
 * so "finer than" is a comparison rather than a memory.
 */
const RANK: Readonly<Record<DisplayPrecision, number>> = {
  NONE: 0,
  UNKNOWN: 1,
  REGION: 2,
  COUNTRY: 3,
  PROVINCE: 4,
  DISTRICT: 5,
  /*
   * SECTOR sits between DISTRICT and CITY because that is where it sits in the
   * ADMINISTRATIVE ladder: a sector is contained by a district, and a city is
   * addressed more finely still. The rank orders CONTAINMENT, which is the
   * question `isFinerThan` is asked — "may this record be drawn at that level".
   * It is not a statement about ground area; see HALO_RADIUS_KM, where SECTOR
   * is deliberately smaller than CITY and the reason is given.
   */
  SECTOR: 6,
  CITY: 7,
  EXACT: 8,
};

export function precisionRank(precision: DisplayPrecision): number {
  return RANK[precision] ?? RANK.UNKNOWN;
}

/** True when `candidate` asserts a finer geographic level than `limit`. */
export function isFinerThan(candidate: DisplayPrecision, limit: DisplayPrecision): boolean {
  return precisionRank(candidate) > precisionRank(limit);
}

/**
 * THE GOVERNING RULE, AS A FUNCTION.
 *
 * Part I §G: "Zooming may reveal more world. It must never manufacture more
 * evidence." The displayed level is the finest level that is BOTH claimed by
 * the record AND supported by geometry this frontend actually holds.
 *
 * `available` is what the surface can honestly draw — passed in rather than
 * assumed, because it is a property of the loaded datasets and not of the
 * record. Admin-1 and admin-2 are Missing · M7 (Part II §4), so today the
 * World Map passes COUNTRY and a CITY record with a real point passes CITY.
 *
 * This is the replacement for the deleted clamp and it is strictly stronger:
 * the clamp said "never finer than a country" and lost real city precision;
 * this says "never finer than the evidence, and never finer than the geometry"
 * and loses nothing that can be drawn.
 */
export function displayPrecisionFor(
  evidenced: DisplayPrecision,
  available: DisplayPrecision,
): DisplayPrecision {
  return isFinerThan(evidenced, available) ? available : evidenced;
}

/**
 * PROVENANCE NEVER RAISES PRECISION.
 *
 * Kept as a named guard, as M1.0A shipped it: the parameter is accepted and
 * demonstrably not read, so promoting a STATED location means deleting a
 * function someone has to look at, rather than adding a quiet branch.
 */
export function provenanceAdjustedPrecision(
  precision: DisplayPrecision,
  provenance: LocationProvenance | undefined,
): DisplayPrecision {
  void provenance;

  return precision;
}

/**
 * ── GEOMETRY ──────────────────────────────────────────────────────────────
 *
 * Part I §G, verbatim: "260 km for a country ceiling, 110 km province, 45 km
 * district, 14 km city, 0 for EXACT". In REAL GROUND UNITS, so the halo
 * shrinks and grows correctly with zoom and "a country-ceiling record can
 * never render as a point on a street".
 *
 * REGION has NO fixed radius. It fits the bounds of the named region from a
 * controlled region gazetteer, and — Part I §G again — "a region with no
 * gazetteer entry degrades to UNKNOWN rather than to an invented radius."
 * `null` is that degradation, and it is why this returns a nullable rather
 * than a number with a fallback.
 *
 * HALO RADIUS IS A FUNCTION OF PRECISION ONLY. There is no provenance
 * parameter, so provenance cannot change it.
 */
export const HALO_RADIUS_KM: Readonly<Record<DisplayPrecision, number | null>> = {
  EXACT: 0,
  CITY: 14,
  /*
   * ── SECTOR: 8 km, AND IT IS A FALLBACK, NOT A DESCRIPTION ──────────────
   *
   * Authorised as the "nominal camera/halo fallback radius", explicitly
   * SUBORDINATE to authoritative polygon geometry: where a verified boundary
   * exists, the camera and the halo derive from the polygon's own extent and
   * this number is not consulted. It is reached only in the no-polygon case,
   * which is today's case for all 30 Rwandan districts and all 416 sectors —
   * see `rwandaBoundaryGeometryCoverage()` in the backend authority module.
   *
   * WHY IT IS SMALLER THAN CITY, WHICH LOOKS BACKWARDS AND IS NOT.
   *
   * RANK orders administrative CONTAINMENT — a sector is inside a district —
   * and this table is in GROUND KILOMETRES. The two genuinely diverge here and
   * the divergence is the honest answer: Rwanda's 416 sectors average roughly
   * 63 km², a radius near 4.5 km, so 8 km is already generous. A CITY halo of
   * 14 km is a metropolitan extent, which is a larger piece of ground than a
   * sector while being a finer address. Forcing this to 15 km to preserve a
   * monotonic-looking column would draw a circle twice the size of the thing it
   * claims to describe, which is the exact failure the real-ground-units rule
   * exists to prevent.
   */
  SECTOR: 8,
  DISTRICT: 45,
  PROVINCE: 110,
  COUNTRY: 260,
  /* Gazetteer bounds, never a radius. */
  REGION: null,
  UNKNOWN: null,
  NONE: null,
};

/**
 * THE FALLBACK IS SUBORDINATE, EXPRESSED AS A FUNCTION RATHER THAN A COMMENT.
 *
 * A caller that holds a verified polygon extent passes it and gets it back;
 * only a caller with nothing gets the nominal radius. So "do not use the 8 km
 * fallback when polygon extent exists" is something the type system asks about
 * at the call site instead of something a reviewer has to notice.
 *
 * `polygonExtentKm` is the radius of the authoritative geometry's own extent.
 * `null` means no verified polygon — NOT a derived extent, NOT a settlement
 * bounding box. Those are camera aids and must never be passed here.
 */
export function haloRadiusKmWithGeometry(
  precision: DisplayPrecision,
  polygonExtentKm: number | null,
): number | null {
  if (polygonExtentKm !== null) return polygonExtentKm;

  return HALO_RADIUS_KM[precision] ?? null;
}

export function haloRadiusKm(precision: DisplayPrecision): number | null {
  return HALO_RADIUS_KM[precision] ?? null;
}

/**
 * ── CAMERA ────────────────────────────────────────────────────────────────
 *
 * "Focus fits the camera to the evidence's own precision level ... It never
 * zooms past the ceiling, because that would imply precision the record does
 * not have. Provenance does not change the fit."
 *
 * Expressed as a maximum zoom rather than a target, because focus must be
 * free to stop SHORT of the ceiling when the geometry it is fitting is larger
 * — framing Russia at the country ceiling is a low zoom, not zoom 4.
 */
export const FOCUS_MAX_ZOOM: Readonly<Record<DisplayPrecision, number>> = {
  EXACT: 13,
  CITY: 11,
  /*
   * Between DISTRICT and CITY, matching the rank. Like the halo radius this is
   * the NO-POLYGON fallback: with a verified boundary the camera fits the
   * polygon's extent and stops wherever that extent puts it.
   */
  SECTOR: 10,
  DISTRICT: 9,
  PROVINCE: 7,
  COUNTRY: 5,
  REGION: 3.5,
  UNKNOWN: 2,
  NONE: 2,
};

export function focusMaxZoom(precision: DisplayPrecision): number {
  return FOCUS_MAX_ZOOM[precision] ?? FOCUS_MAX_ZOOM.UNKNOWN;
}

/**
 * Whether a record may be drawn as a POINT.
 *
 * Only EXACT and CITY. Part II §8 question 9 closes the residual case
 * explicitly: "Where interpretation produced a location but no level can be
 * asserted, the record is UNKNOWN / INTERPRETED and is never rendered as a
 * point." Provenance is not a parameter, so an INTERPRETED city is still a
 * point — drawn differently in kind, at the same place.
 *
 * ── SECTOR IS AN AREA, AND THEREFORE FALSE ────────────────────────────────
 *
 * `rendersAsPoint('SECTOR') === false`, unconditionally. A sector is an
 * administrative AREA; drawing one as a dot would assert a point location the
 * record does not have, which is the same class of error as drawing a country
 * as a dot.
 *
 * THE ABSENCE OF A POLYGON DOES NOT CONVERT IT INTO A POINT. Where no verified
 * boundary exists a centroid or bounding box may be used to MOVE THE CAMERA —
 * navigation — and may not be depicted as the administrative boundary, and may
 * not be drawn as the sector's marker. The no-geometry state is disclosed as a
 * coverage gap, not resolved by falling back to a dot.
 *
 * A point feature that happens to LIE INSIDE a sector is a different record
 * with its own precision, and it renders by its own precision. That is not an
 * exception to this rule; it is a separate record passing through the same
 * function.
 */
export function rendersAsPoint(precision: DisplayPrecision): boolean {
  return precision === 'EXACT' || precision === 'CITY';
}

/**
 * ── MARKER STYLE — THE PROVENANCE AXIS ────────────────────────────────────
 *
 * Part I §G: INTERPRETED and CONTESTED are "drawn differently in KIND —
 * dashed, hollow, grey, no pulse — not merely labelled differently, at
 * whatever precision level the record holds."
 *
 * So this returns a shape, not a colour variant. `filled: false` and
 * `dashed: true` are structural facts a renderer cannot express as a lighter
 * cyan by accident.
 */
export interface MarkerStyle {
  readonly filled: boolean;
  readonly dashed: boolean;
  readonly pulses: boolean;
  /** The legend entry this marker must match. Part I §E: five entries only. */
  readonly legendKey: LegendKey;
}

/** Part I §E: "If a colour is not in the legend it may not appear on the map." */
export type LegendKey = 'verified' | 'attention' | 'interpreted' | 'none' | 'reference';

export const LEGEND_KEYS: readonly LegendKey[] = [
  'verified',
  'attention',
  'interpreted',
  'none',
  'reference',
];

export function markerStyleFor(
  precision: DisplayPrecision,
  provenance: LocationProvenance | undefined,
): MarkerStyle {
  /*
    A record with no assertable level is not evidence geography at all, and
    Part I's colour grammar puts UNKNOWN precision in muted grey alongside
    interpreted and contested — "always dashed, never filled solid".
  */
  if (precision === 'NONE') {
    return { filled: false, dashed: true, pulses: false, legendKey: 'none' };
  }

  if (provenance === 'INTERPRETED' || provenance === 'CONTESTED' || precision === 'UNKNOWN') {
    return { filled: false, dashed: true, pulses: false, legendKey: 'interpreted' };
  }

  return { filled: true, dashed: false, pulses: true, legendKey: 'verified' };
}

/**
 * Whether a record counts toward a VERIFIED total without a qualifier.
 *
 * Part II §8 question 9: an interpreted record "is never counted in verified
 * totals without the qualifier". Contested is the same case — incompatible
 * source locations are not a verified location.
 */
export function countsAsVerified(provenance: LocationProvenance | undefined): boolean {
  return provenance === undefined || provenance === 'STATED';
}

/**
 * ── LANGUAGE ──────────────────────────────────────────────────────────────
 *
 * The banner "states precision in words and appends provenance when it is not
 * STATED". Returns the two KEYS the dictionary must resolve rather than a
 * string, so the copy is translated in one place and the rule is testable
 * without a language.
 *
 * `provenanceKey` is null for STATED and for absent provenance — nothing is
 * appended, which is the spec's own phrasing turned into a shape.
 */
export interface PrecisionStatementKeys {
  readonly precisionKey: DisplayPrecision;
  readonly provenanceKey: 'interpreted' | 'contested' | null;
}

export function precisionStatementKeys(
  precision: DisplayPrecision,
  provenance: LocationProvenance | undefined,
): PrecisionStatementKeys {
  const provenanceKey =
    provenance === 'INTERPRETED' ? 'interpreted' : provenance === 'CONTESTED' ? 'contested' : null;

  return { precisionKey: precision, provenanceKey };
}

/**
 * The reference-geography ceiling for a bare camera, with nothing selected.
 *
 * Part I §E: the trust banner "states the evidence ceiling of the current
 * selection, OR the reference-geography ceiling of the current zoom". This is
 * that second half — and it is deliberately a statement about REFERENCE
 * geography, never about evidence. Zooming in raises what the map can draw; it
 * raises nothing about what is known.
 *
 * Thresholds follow the layer zoom ranges in Part I §F: admin-1 becomes
 * visible reference geography at Z6 and admin-2 at Z8, so those are the zooms
 * at which the map could honestly say it is showing province or district
 * outlines — once M7 supplies them. `available` gates exactly that, which is
 * why a deployment without the datasets can never reach the finer answers.
 */
export function referenceCeilingForZoom(
  zoom: number,
  available: DisplayPrecision = 'COUNTRY',
): DisplayPrecision {
  /*
   * SECTOR is deliberately NOT reachable here. This function answers "what
   * REFERENCE geography could the map honestly say it is showing at this
   * zoom", and reference sector outlines require sector polygons, which this
   * product does not hold. Zooming to 12 must not start claiming sector-level
   * reference geography off the back of a zoom threshold alone. When verified
   * sector polygons land, `available` is what admits them — not a new branch
   * here.
   */
  const byZoom: DisplayPrecision = zoom >= 8 ? 'DISTRICT' : zoom >= 6 ? 'PROVINCE' : 'COUNTRY';

  return isFinerThan(byZoom, available) ? available : byZoom;
}
