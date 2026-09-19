/**
 * ════════════════════════════════════════════════════════════════════════════
 * SPATIAL PRECISION AND LOCATION PROVENANCE — THE SHARED AUTHORITY · CF-D1
 * ════════════════════════════════════════════════════════════════════════════
 *
 * PROPOSED for `shared/src/spatial/precision.ts`. Nothing lands without authorization.
 *
 * ── WHY THIS MOVES, AND WHO ASKED ─────────────────────────────────────────
 *
 * `frontend/src/lib/spatial/spatialPrecision.ts` says it in its own words:
 *
 *   "THE PROPER FIX IS STILL OPEN AND IS NOT MINE TO MAKE: promoting
 *    `toSpatialPrecision` into `shared/` would delete this file entirely. That is a
 *    shared-contract change, which this authorization freezes. Reported, not worked
 *    around silently."
 *
 * H reported it and named Main as its owner. G then hit the same wall from the other
 * side (CF-D1): a backend Conflict producer cannot emit a precision rung because the
 * ladder lives in the frontend. Two lanes, one missing shared contract.
 *
 * ── WHAT IS PROMOTED AND WHAT IS NOT ──────────────────────────────────────
 *
 * PROMOTED: the ladder, the provenance vocabulary, the independence guarantee, and the
 * one lossy legacy translation.
 *
 * NOT PROMOTED: `PRODUCIBLE_SPATIAL_PRECISION`, the display ceilings,
 * `evidenceDisplayCeiling`, `precisionExceedsGeometry`, `DisplayPrecision`. Those are
 * answers to "what may this surface DRAW", and the backend must never learn what a
 * precision looks like — the same test `shared/src/conflict.ts` applied when it left
 * `SEVERITY_TREATMENT` in the frontend.
 *
 * NOT WIDENED: the frontend severity-ladder work and any widening of
 * `PRODUCIBLE_SPATIAL_PRECISION` remain frontend-owned and do not reach this file.
 */

/* ═══════════════════════════════════════════════════════════════════════════
 * 1 · THE LADDER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ── A DISCREPANCY, REPORTED RATHER THAN RESOLVED SILENTLY ─────────────────
 *
 * `GLOBALNEWS_AI_DEVELOPMENT_II_C28PLUS_MASTER_AUTHORITY.txt` §4 states Spatial
 * Intelligence v1.7's ladder as SEVEN rungs:
 *
 *     EXACT / CITY / DISTRICT / PROVINCE / COUNTRY / REGION / UNKNOWN
 *
 * The landed frontend type carries EIGHT — `SECTOR` sits between CITY and DISTRICT, and
 * `PRODUCIBLE_SPATIAL_PRECISION` lists it as PRODUCIBLE today (Rwanda sector depth,
 * §5 of the same authority).
 *
 * The landed eight are promoted, because promoting the seven would DELETE A RUNG THAT
 * IS CURRENTLY PRODUCED — the one direction a precision contract must never move. The
 * Master Authority's §4 text lags its own §5 by one rung and needs a CTO/PO
 * documentation correction. That is reported here, not decided here.
 */
export const SPATIAL_PRECISION_LADDER = [
  'EXACT',
  'CITY',
  'SECTOR',
  'DISTRICT',
  'PROVINCE',
  'COUNTRY',
  'REGION',
  'UNKNOWN',
] as const;
export type SpatialPrecision = (typeof SPATIAL_PRECISION_LADDER)[number];

/**
 * Finer is a LOWER rank. `UNKNOWN` is deliberately not on the ladder as a rung — it is
 * the absence of a rung, and giving it a rank would let a comparison treat "we do not
 * know" as coarser-than-REGION rather than as no claim at all.
 */
const PRECISION_RANK: Readonly<Record<SpatialPrecision, number | null>> = Object.freeze({
  EXACT: 0,
  CITY: 1,
  SECTOR: 2,
  DISTRICT: 3,
  PROVINCE: 4,
  COUNTRY: 5,
  REGION: 6,
  UNKNOWN: null,
});

export class SpatialPrecisionRefused extends Error {}

/**
 * Comparison REFUSES on UNKNOWN rather than answering.
 *
 * `isFinerThan(UNKNOWN, COUNTRY)` has no true answer, and every default is a lie in one
 * direction: `false` says it is coarser, `true` says it is finer. A refusal is the only
 * honest third option, and it forces the caller to handle absence where absence is.
 */
export function precisionIsFinerThan(a: SpatialPrecision, b: SpatialPrecision): boolean {
  const ra = PRECISION_RANK[a];
  const rb = PRECISION_RANK[b];
  if (ra === null || rb === null) {
    throw new SpatialPrecisionRefused(
      `SP-1: UNKNOWN precision cannot be ordered against ${ra === null ? b : a}. ` +
        'Absence of a precision claim is not a coarse precision claim.',
    );
  }
  return ra < rb;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2 · LOCATION PROVENANCE — A DIFFERENT AXIS, AND IT STAYS DIFFERENT
 * ═══════════════════════════════════════════════════════════════════════════ */

export const LOCATION_PROVENANCES = ['STATED', 'INTERPRETED', 'CONTESTED'] as const;
export type LocationProvenance = (typeof LOCATION_PROVENANCES)[number];

/**
 * THE RULE, ENFORCED RATHER THAN DOCUMENTED — Spatial Intelligence v1.7:
 *
 *   "Translated/interpreted geography may never upgrade itself to stronger evidence
 *    merely because it was normalized."
 *
 * H's `assertProvenanceDoesNotRaisePrecision` is carried over verbatim in behaviour: the
 * signature admits the value a caller might act on, and the body demonstrates that
 * acting on it is not part of the contract. It exists so a future promotion has to
 * delete a named guard instead of quietly adding a branch.
 */
export function assertProvenanceDoesNotRaisePrecision(
  precision: SpatialPrecision,
  provenance: LocationProvenance | undefined,
): SpatialPrecision {
  void provenance;
  return precision;
}

/**
 * ABSENT MEANS NOT ASSESSED — and it is a distinguishable absence.
 *
 * A record from a producer that does not send the field reads `undefined`. That is not
 * `STATED`, not `INTERPRETED`, and not a reason to withhold. A-24's rule applies here
 * exactly as it does to the Security absence vocabulary: distinguishable absences must
 * not collapse.
 */
export const LOCATION_PROVENANCE_ABSENT_MEANS = 'NOT_ASSESSED' as const;

/* ═══════════════════════════════════════════════════════════════════════════
 * 3 · THE INDEPENDENCE STATEMENT — FOUR AXES, NOT ONE LADDER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *     precision   how finely the location is known
 *     geometry    what shape the source published      (SourceGeometryKind)
 *     denotation  what the shape MEANS                 (GeometryDenotation)
 *     provenance  how we came to know it               (LocationProvenance)
 *
 * No function anywhere in this module derives any one of these from any other, and
 * there is no field that could hold a combined value. The independence is structural:
 * there is nothing to enforce because there is nothing that could violate it.
 *
 * Geometry COERCION is refused by the accepted
 * `assertNotACoercion` / `PROHIBITED_GEOMETRY_COERCIONS` in
 * `shared/src/humanitarian/spatial-geometry.ts`, which already names
 * `POLYGON_TO_CENTROID_FOR_RENDERING`, `BBOX_TO_POINT`, `LINE_TO_ENDPOINT` and
 * `ANY_GEOMETRY_TO_POINT_TO_SATISFY_A_RENDERER`. THIS MODULE DOES NOT RESTATE THEM.
 * A second coercion table is the drift this promotion exists to prevent.
 */

/* ═══════════════════════════════════════════════════════════════════════════
 * 4 · THE LEGACY TRANSLATION — LOSSY IN EXACTLY ONE PLACE, ON PURPOSE
 * ═══════════════════════════════════════════════════════════════════════════ */

export type LegacyGeographicPrecision = 'country' | 'region' | 'city' | 'coordinate' | 'unknown';

/**
 * `'region'` → `UNKNOWN`, NEVER `'REGION'`.
 *
 * The authoritative `REGION` is SUPRANATIONAL; the legacy `'region'` is treated
 * everywhere in this codebase as SUBNATIONAL. Translating it would invert its meaning —
 * from finer than a country to coarser than one — in the one direction a precision
 * ceiling must never move. `UNKNOWN` is the only answer that claims nothing.
 *
 * ABSENT MEANS UNKNOWN AND NOTHING ELSE. Not the retrieval country, not the query's
 * country, not the publisher's country.
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
    case 'unknown':
    case undefined:
      return 'UNKNOWN';
  }
}
