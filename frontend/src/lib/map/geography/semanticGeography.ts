import type { Bounds } from '@/lib/map/camera/cameraState';
import type { NavigatorPlace } from '@/lib/api/geoNavigatorApi';
import { navigatorCameraTarget, navigatorCountryIso3 } from '@/lib/api/geoNavigatorApi';
import type { PlaceResult } from '@/lib/map/search/placeSearch';
import type { MapSelection } from '@/lib/map/state/mapState';

/**
 * ══ ONE SEMANTIC SELECTION SYSTEM — MAP-SEARCH-CITY/REGION-SEMANTIC-SELECTION-1
 *
 * THE DEFECT THIS EXISTS FOR, as the live inspection recorded it three times
 * over: a geography action moved the camera and established no scope. East
 * Africa, Kigali CITY and Kigali REGION each flew the viewport, left `cam=`
 * alone in the URL, and left the right rail reading World.
 *
 * The cause was never downstream. `MapPageClient` already has exactly one URL
 * writer and it already serialises `spatialSelection` into `sel=`; the state
 * model already had a REGION branch that clears the country so a region cannot
 * collapse into one. What was missing is that **no selection was ever produced**
 * — each path dispatched `focus-bounds` and returned.
 *
 * So this module does one thing: turn a committed search row into the semantic
 * selection it represents. It is the single place that decision is made, which
 * is what stops CITY and REGION from being patched independently and drifting.
 *
 * ── THE THREE AXES, HELD APART ────────────────────────────────────────────
 *
 *     SEMANTIC SELECTION SCOPE     what the reader chose       Kigali CITY
 *     EVIDENCE RESOLUTION CEILING  where evidence resolves     Rwanda COUNTRY
 *     CAMERA STATE                 where the viewport sits     lon/lat/zoom
 *
 * A city selection names the FIRST. It does not lower the second and it is not
 * the third. `EVIDENCE_CEILING_KIND` in `mapState.ts` states the ceiling once;
 * nothing here re-decides it, and nothing here aggregates or invents evidence
 * for a city.
 */

/** Where a region sits in the hierarchy. The two are framed differently. */
export type RegionScale = 'SUPRANATIONAL' | 'SUBNATIONAL';

export function regionScaleFor(kind: NavigatorPlace['kind']): RegionScale | null {
  if (kind === 'region') return 'SUPRANATIONAL';
  if (kind === 'admin1' || kind === 'admin2') return 'SUBNATIONAL';

  return null;
}

/**
 * ══ WHY A SUBNATIONAL REGION MAY BE FRAMED AND A SUPRANATIONAL ONE MAY NOT ══
 *
 * `regionSelection.ts` refuses an extent for OPERATIONAL and UNDEFINED regions,
 * and its reason is exact and still binding:
 *
 *     "flying the camera to a confident frame around a region whose membership
 *      is disputed — is a claim the product would be making in the most
 *      persuasive medium it has, which is the map itself."
 *
 * That reasoning is about CONTESTED MEMBERSHIP. It does not transfer to an
 * ISO 3166-2 province. `admin1:RW-01` has published bounds — the live navigator
 * returns `bounds.bbox` for it with `source: "derived-from-settlements"` — and
 * nobody disputes which province Kigali is. Refusing to frame it would not be
 * caution; it would be a regression against a behaviour §10 protects
 * ("Kigali REGION camera navigation" is live PASS).
 *
 * So the rule is stated by SCALE rather than inherited wholesale:
 *
 *   SUPRANATIONAL   frame only when `regionSelection.ts` grants an extent,
 *                   which is INSTITUTIONAL and STATISTICAL only. Unchanged.
 *   SUBNATIONAL     frame from G's published bounds for that node.
 *
 * Neither case invents a boundary. A subnational region with no published
 * bounds is not framed, exactly as a contested supranational one is not.
 */
export function subnationalExtentFor(place: NavigatorPlace): Bounds | null {
  return navigatorCameraTarget(place);
}

/**
 * A city, as a place the reader selected — never as an evidence geography.
 *
 * `countryIso3` is the EVIDENCE CEILING for this selection, carried so a
 * surface can name it honestly ("evidence resolves at Rwanda") rather than
 * quietly showing the country's evidence under the city's name. It is read from
 * G's published hierarchy via `navigatorCountryIso3`; nothing is parsed out of
 * the geographyId, which the navigator contract calls opaque.
 */
export interface CitySelection {
  readonly geographyId: string;
  readonly name: string;
  /** The evidence ceiling. `null` when G publishes no country ancestor. */
  readonly countryIso3: string | null;
  /** The smallest honest frame around the settlement, or null. */
  readonly extent: Bounds | null;
  readonly provenance: string;
}

export function citySelectionFrom(place: NavigatorPlace): CitySelection | null {
  if (place.kind !== 'city') return null;

  return {
    geographyId: place.geographyId,
    name: place.name,
    countryIso3: navigatorCountryIso3(place) ?? null,
    extent: navigatorCameraTarget(place),
    /*
      G's own dataset attribution, carried verbatim. The parser exposes it as
      `datasetAttribution`; it is never composed here, because an attribution
      this product wrote itself would be a licence claim nobody granted.
    */
    provenance: place.datasetAttribution,
  };
}

/**
 * THE COMMIT RULE — what a search row becomes when the reader presses it.
 *
 * Returns `undefined` for a row that carries no semantic identity, which is the
 * signal to fall through to the camera-only path. That is not a failure: a
 * local jump-target row is a label over a hard-coded box, and minting an
 * identity from a label key is the alias trap `regionSelection.ts` names.
 * The one jump target that DOES have a governed identity is bound explicitly —
 * see `governedRegionForJumpTarget`.
 */
export function selectionForPlaceResult(result: PlaceResult): MapSelection | null | undefined {
  if (result.kind === 'COUNTRY' && result.countryIso3) {
    return { kind: 'COUNTRY', id: result.countryIso3 };
  }

  /*
    A navigator row's `id` IS G's geographyId, so it is carried whole. A local
    jump-target row's id is a minted `city:<labelKey>` / `region:<labelKey>`
    string, which is NOT a gazetteer id — those rows are excluded by
    `hasGazetteerIdentity` below rather than by guessing at the shape here.
  */
  if (result.kind === 'CITY' && hasGazetteerIdentity(result)) {
    return { kind: 'CITY', id: result.id };
  }

  if (result.kind === 'REGION' && hasGazetteerIdentity(result)) {
    return { kind: 'REGION', id: result.id };
  }

  return undefined;
}

/**
 * A row backed by a real gazetteer node, as opposed to a local label.
 *
 * Navigator rows carry a `context` line built from G's own hierarchy, or a
 * `region` identity, or a country. A local jump-target row carries a
 * `REFERENCE` annotation and none of those — it is a label over a box. The
 * distinction is read from what the row HAS rather than from how its id is
 * spelled, so a change to the minting convention cannot silently promote a
 * label into an identity.
 */
export function hasGazetteerIdentity(result: PlaceResult): boolean {
  if (result.region !== undefined) return true;

  return result.context !== undefined || result.countryIso3 !== undefined;
}
