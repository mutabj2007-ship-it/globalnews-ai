import { DESIGN_REFERENCE } from '@/lib/map/spatial/designRenderTokens';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CONTEXTUAL REFERENCE GEOGRAPHY — PO RULING D-2
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The defect this closes, in the Product Owner's words: *"NO tiny world
 * thumbnail floating in a mostly empty canvas"*, and for the Rwanda state
 * *"contextual East Africa geography with lakes/cities/borders visible"*.
 *
 * The measured cause was not a broken renderer. `EvidenceMapCanvas` drew
 * exactly two sources — bundled 110m country polygons and evidence circles —
 * so at country zoom it drew one outline on an empty ground. Natural Earth
 * 1:110m carries no lakes, no cities and no sub-national lines, and
 * `frontend/public` carried no geographic data at all.
 *
 * ── WHAT THIS MODULE IS, AND WHAT IT IS NOT ─────────────────────────────────
 *
 * It is a DECLARATION of sources and layers, with no engine call in it, so the
 * draw order and the paint can be asserted by a unit test rather than by
 * looking at a screenshot. `EvidenceMapCanvas` is the only thing that hands
 * these to MapLibre.
 *
 * It is NOT a basemap provider. Every byte is same-origin and static, served
 * from `frontend/public/reference/`. No tile server, no style server, no
 * token, no viewport leaves the browser — the product still has ZERO external
 * map endpoints, which is the guarantee `basemapSource.ts` and
 * `labelPlacement.ts` both record, and ruling D-2's "do not introduce a
 * commercial/vendor basemap dependency" is satisfied structurally rather than
 * by policy.
 *
 * ── THE THREE THINGS REFERENCE GEOGRAPHY MAY NEVER DO ───────────────────────
 *
 * Ruling D-2, carried verbatim: *"It must never be counted as evidence. It
 * must never increase evidence precision. It must never create reporting where
 * none exists."*
 *
 * Those are enforced by construction, not by intention:
 *
 *   NEVER EVIDENCE      These layers come from static files on the frontend
 *                       origin, not from the evidence service. Nothing here
 *                       reaches `evidenceFeed`, `mapFeed` or any count. The
 *                       rail's own copy already says it: "Zoom reveals more
 *                       world. It never reveals more evidence."
 *
 *   NEVER PRECISION     No layer here carries an evidence id, a precision or a
 *                       provenance, so `precisionModel` has nothing to read
 *                       from them. A lake cannot raise a country-ceiling
 *                       record to district precision because the record never
 *                       meets the lake.
 *
 *   NEVER REPORTING     These layers are not clickable and not queried. They
 *                       are below the interactive country layer in the stack
 *                       and register no handler, so no selection, callout or
 *                       retained-reporting card can originate from one.
 *
 * ── SUBORDINATION IS THE WHOLE POINT ────────────────────────────────────────
 *
 * Ruling 3 of the convergence authority, restated by D-2 as "keep the existing
 * evidence/rendering layers above it": basemap -> halo -> evidence -> labels.
 * Every layer declared here belongs to the FIRST band and is inserted beneath
 * the evidence fill, so a lake or a river can never draw over the state of the
 * country it describes.
 */

/** Where the generated baseline is served from. Same-origin, static, no token. */
export const REFERENCE_BASE_PATH = '/reference';

export type ReferenceSourceId = 'lakes' | 'rivers' | 'admin1Lines';

/**
 * COASTLINE AND ADMIN-0 LINES WERE HERE AND ARE DELETED — PO C904 REVIEW.
 *
 * Both were duplicates of an edge the surface already draws, and a duplicate
 * edge is exactly where a registration seam lives:
 *
 *   coastline    the land polygon's own outline IS the coastline. C904 drew it
 *                twice, at two resolutions, and the ruling rejected the result.
 *                One basis, one edge, drawn once.
 *
 *   admin0-lines the country outline already draws the international boundary.
 *                A second line layer over it was a different generalisation of
 *                the same border waiting to diverge from the first.
 *
 * What remains is what the base geometry genuinely does not contain: inland
 * water, rivers, and sub-national boundaries. Everything here is Natural Earth
 * 1:50m, the same basis as `spatialCountryGeometry`.
 */
export const REFERENCE_SOURCES: Readonly<Record<ReferenceSourceId, string>> = {
  lakes: `${REFERENCE_BASE_PATH}/lakes.json`,
  rivers: `${REFERENCE_BASE_PATH}/rivers.json`,
  admin1Lines: `${REFERENCE_BASE_PATH}/admin1-lines.json`,
};

/**
 * The rail code each layer answers to, so the WATER / ADM0 / ADM1 toggles
 * govern the reference layers exactly as they govern the existing ones. A
 * layer with no registry id would be a layer the reader cannot turn off, which
 * the rail contract does not allow.
 */
export type ReferenceRailKey = 'hydrography' | 'rivers' | 'admin1';

export interface ReferenceLayerSpec {
  readonly id: string;
  readonly type: 'fill' | 'line';
  readonly source: ReferenceSourceId;
  readonly rail: ReferenceRailKey;
  /**
   * Below this zoom the layer is not drawn. A 1:50m river at the world view is
   * a grey smear over the ocean, and drawing it would trade the orientation
   * the world view exists to give for detail nobody can read at that scale.
   */
  readonly minzoom?: number;
  readonly paint: Record<string, unknown>;
}

/**
 * BOTTOM TO TOP. This array IS the draw order, and the canvas inserts every
 * entry beneath the evidence fill in exactly this sequence.
 *
 * Water sits directly on the land fill, because a lake is a hole in the land
 * and anything drawn between them would be under water. The river network and
 * the sub-national boundary then stack upward in increasing locality, which is
 * also increasing zoom — so as the reader descends the scale ladder the map
 * gains lines rather than replacing them.
 *
 * The coastline and the international boundary are ABSENT from this list by
 * design: the spatial surface draws both from its own 1:50m country polygons,
 * and drawing them again here is what produced the registration seam the C904
 * review rejected.
 */
export const REFERENCE_LAYERS: readonly ReferenceLayerSpec[] = [
  {
    id: 'gn-ref-lakes-fill',
    type: 'fill',
    source: 'lakes',
    rail: 'hydrography',
    paint: { 'fill-color': DESIGN_REFERENCE.water, 'fill-opacity': 1 },
  },
  {
    id: 'gn-ref-lakes-line',
    type: 'line',
    source: 'lakes',
    rail: 'hydrography',
    paint: { 'line-color': DESIGN_REFERENCE.waterEdge, 'line-width': 0.6 },
  },
  {
    id: 'gn-ref-rivers',
    type: 'line',
    source: 'rivers',
    rail: 'rivers',
    /* The registry's own range for `rivers` is [4, 11]. */
    minzoom: 4,
    paint: { 'line-color': DESIGN_REFERENCE.river, 'line-width': 0.7 },
  },
  {
    id: 'gn-ref-admin1',
    type: 'line',
    source: 'admin1Lines',
    rail: 'admin1',
    /* The registry's own range for `admin1` is [6, 13]. */
    minzoom: 6,
    paint: {
      'line-color': DESIGN_REFERENCE.border,
      /* Subordinate to the international boundary it sits inside. */
      'line-opacity': 0.4,
      'line-width': 0.5,
    },
  },
];

/**
 * NATURAL EARTH 1:50m DOES NOT PUBLISH SUB-NATIONAL LINES FOR EAST AFRICA,
 * AND THAT IS RECORDED HERE BECAUSE IT MATTERS TO RULING D-2.
 *
 * `ne_50m_admin_1_states_provinces_lines` carries 581 features across exactly
 * nine federal states — BRA, AUS, USA, CAN, RUS, IDN, CHN, IND, ZAF. It
 * contains no Rwandan feature, and none for Uganda, Kenya, Tanzania, Burundi,
 * DR Congo or Ethiopia either. Measured, not assumed.
 *
 * The consequence is stronger than the exclusion filter the build script also
 * applies: around Rwanda there is no second administrative source to confuse
 * with NISR, because upstream publishes none at this scale. NISR remains the
 * only sub-national geometry drawn anywhere near Rwanda, as ruling D-2
 * requires.
 */
export const ADMIN1_COVERAGE = {
  countriesWithLines: 9,
  eastAfricaFeatures: 0,
  rwandaFeatures: 0,
  administrativeAuthorityForRwanda: 'NISR',
} as const;

/**
 * Natural Earth is public domain and asks for no attribution, but naming the
 * source is how a reader tells reference geography from evidence — so it is
 * shown, and it names a dataset rather than a vendor.
 */
export const REFERENCE_ATTRIBUTION =
  'Reference geography: Natural Earth 1:50m (public domain). Not evidence.';
