import { mesh } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { FeatureCollection, MultiLineString } from 'geojson';
import worldAtlas50m from 'world-atlas/countries-50m.json';

import { splitAntimeridianLines } from '@/lib/map/antimeridian';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * COASTLINE AND INTERNAL BORDER — C907 §3
 * ════════════════════════════════════════════════════════════════════════════
 *
 * THE RULING: *"REFERENCE_COLOURS.coast exists but currently has zero
 * consumers. Golden coastline corresponds to #55707f. Restore a distinct
 * coastline treatment. DO NOT bring back a second misregistered land/coast
 * geometry dataset. The coastline must be derived/rendered from the SAME
 * governed Natural Earth 1:50m country basis now used for land. Shared country
 * borders must retain the approved `border` treatment. External land/water
 * edges must retain the approved `landEdge` treatment. No visible seam."*
 *
 * ── THE MEASUREMENT THIS ANSWERS ────────────────────────────────────────────
 *
 * On the golden world capture, 26 403 land/water boundary pixels were
 * isolated. Their brightest 2 % average (81.9, 109.4, 122.7); `landEdge`
 * `#55707f` is (85, 112, 127). Their 95th percentile is (65, 87, 100);
 * `border` `#3d5563` is (61, 85, 99). The golden frame draws TWO reference
 * lines. C906 drew one, at the border value, and the coast token had no
 * consumer at all — so the brightest reference line, the one v1.5 calls "the
 * land/water edge … the line that tells a reader where they are", was absent.
 *
 * ── HOW THE TWO ARE SEPARATED, WITHOUT A SECOND DATASET ─────────────────────
 *
 * This is the whole reason the ruling can ask for a distinct coastline and no
 * seam in the same sentence: `countries-50m` is a TOPOLOGY, not a pile of
 * polygons. Its arcs are SHARED — the segment between France and Belgium is
 * one arc, referenced by both countries, stored once. So the distinction is
 * not a geometric approximation to be computed with a tolerance; it is a
 * property the data already carries:
 *
 *     an arc referenced by TWO country geometries  →  an internal border
 *     an arc referenced by ONE                     →  an external edge, i.e.
 *                                                     the land/water boundary
 *
 * `topojson-client`'s `mesh(topology, object, filter)` is exactly this
 * question. The filter receives the two geometries adjacent to each arc, and
 * for an arc used once they are the same object:
 *
 *     mesh(topo, countries, (a, b) => a === b)   →  coastline
 *     mesh(topo, countries, (a, b) => a !== b)   →  internal borders
 *
 * ── WHY THIS CANNOT PRODUCE A SEAM ──────────────────────────────────────────
 *
 * C904's seam was a 1:110m land fill under a 1:50m shoreline: two
 * generalisations of one edge, about a kilometre apart at coastal zoom. The
 * C905 correction deleted the shoreline; what it could not do was give the
 * survivor the coastline's treatment, because one line layer over the country
 * polygons cannot tell a coast from a border.
 *
 * Here there is no second dataset and no second resolution. Both meshes are
 * built from the SAME ARCS as the land fill — the identical coordinate
 * sequences, not a co-registered copy of them — so a coastline vertex and the
 * land-polygon vertex beneath it are the same number. A registration seam is
 * not unlikely; it is unrepresentable.
 *
 * ── AND A DEFECT THE OLD LAYER HAD, CLOSED AS A SIDE EFFECT ─────────────────
 *
 * The single outline layer stroked every country's full ring, so every shared
 * border was drawn TWICE — once from each neighbour — at double weight and
 * double opacity. The internal mesh contains each shared arc exactly once.
 *
 * ── NOT EVIDENCE, NOT PRECISION, NOT REPORTING ──────────────────────────────
 *
 * Ruling D-2 holds unchanged: these are reference lines with no id, no
 * provenance and no precision; nothing here is queried or clickable, and no
 * selection or retained-reporting card can originate from one.
 */

/** Built once. The topology is a static import and never changes at runtime. */
let cachedCoastline: FeatureCollection<MultiLineString> | null = null;
let cachedBorders: FeatureCollection<MultiLineString> | null = null;

function buildMesh(interior: boolean): FeatureCollection<MultiLineString> {
  const topology = worldAtlas50m as unknown as Topology;
  const countries = topology.objects.countries as GeometryCollection;

  const geometry = mesh(topology, countries, (a, b) =>
    interior ? a !== b : a === b,
  ) as MultiLineString;

  /*
    THE SAME ANTIMERIDIAN TREATMENT THE LAND FILL GETS, for the same reason.
    These arcs are the land's own arcs, so Russia's and Fiji's seam-crossing
    edges are present here too, and MapLibre would draw the straight plane
    segment between 178.6°E and -180°E across every longitude — as a LINE this
    time rather than a filled band, which is no better. `splitAntimeridianLines`
    is the polygon adapter's own unwrap-then-mirror, applied to line geometry.
  */
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'MultiLineString',
          coordinates: splitAntimeridianLines(geometry.coordinates),
        },
      },
    ],
  };
}

/** The external land/water edge. Painted `landEdge`, the brightest reference line. */
export function getSpatialCoastline(): FeatureCollection<MultiLineString> {
  if (cachedCoastline === null) cachedCoastline = buildMesh(false);
  return cachedCoastline;
}

/** Shared admin-0 boundaries, each drawn once. Painted `border`. */
export function getSpatialInternalBorders(): FeatureCollection<MultiLineString> {
  if (cachedBorders === null) cachedBorders = buildMesh(true);
  return cachedBorders;
}

export const COASTLINE_SOURCE_ID = 'gn-coastline';
export const INTERNAL_BORDER_SOURCE_ID = 'gn-internal-borders';
export const COASTLINE_LAYER_ID = 'gn-countries-coastline';
