import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { FeatureCollection, Geometry } from 'geojson';
import worldAtlas50m from 'world-atlas/countries-50m.json';
import { findCountryByNumeric } from '@globalnews-ai/shared';
import type { CountryFeature, CountryFeatureCollection } from '@/lib/map/countryGeometry';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE SPATIAL SURFACE'S COUNTRY GEOMETRY — ONE CONSISTENT 1:50m BASIS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * PO ruling, C904 review: *"the 110m land fill + 50m shoreline mismatch is NOT
 * approved. Use a consistent Natural Earth 1:50m basis for land/coastline,
 * hydrography where applicable, supporting reference geography. No visible
 * registration seam should be knowingly shipped."*
 *
 * ── WHAT WAS WRONG, STATED PLAINLY ──────────────────────────────────────────
 *
 * C904 drew the land from the bundled 1:110m boundary and then drew a separate
 * 1:50m shoreline over it. Two renderings of the same edge at two resolutions
 * differ by about a kilometre on a coast at high zoom, and I shipped that
 * knowingly with a comment explaining it. The ruling is right: an explained
 * seam is still a seam.
 *
 * ── THE CORRECTION IS SUBTRACTION, NOT ADDITION ─────────────────────────────
 *
 * The fix is NOT a third dataset reconciling the first two. It is to draw the
 * coast ONCE, as the edge of the land, at the same resolution as everything
 * else on the surface. So:
 *
 *   - this module supplies the spatial canvas with 1:50m countries;
 *   - the separate `coastline` reference layer is DELETED — the land polygon's
 *     own outline is the coastline, and at one basis it cannot disagree;
 *   - the separate `admin0-lines` reference layer is DELETED for the same
 *     reason — the country outline already draws the international boundary,
 *     and a second line layer over it was a duplicate waiting to diverge.
 *
 * The reference set that remains — lakes, rivers, sub-national lines — is
 * Natural Earth 1:50m, the same basis as this file, so every drawn edge on the
 * spatial surface now comes from one generation of one dataset.
 *
 * ── WHY A SEPARATE MODULE AND NOT AN EDIT TO countryGeometry.ts ─────────────
 *
 * `countryGeometry.ts` is imported by seventeen modules — the Hero, the legacy
 * World Map, the Today canvas, the Analysis compact maps. Those surfaces are
 * ACCEPTED and internally consistent at 110m: none of them draws a 50m
 * shoreline, so none of them has the seam this ruling is about. Switching the
 * shared module would change four accepted surfaces to fix a defect that
 * exists in one, which is the broad convergence the same ruling forbids.
 *
 * So the spatial surface gets its own geometry and nothing else moves.
 *
 * ── THE EVIDENCE JOIN IS UNCHANGED, AND THAT IS THE POINT ───────────────────
 *
 * Identical property shape, identical ISO 3166-1 numeric key, identical
 * metadata lookup. `coveragePaint`, the hover and selection filters, the watch
 * edge and the evidence fill all address features exactly as before — they
 * match on `numericId`, which does not know what resolution drew the polygon.
 * A finer outline is a smoother edge, never a stronger claim, and reference
 * geography does not become evidence by being drawn better.
 *
 * Upstream, verified rather than assumed: world-atlas 2.0.2 publishes
 * `countries-50m.json`, and its own File Reference states the topology "is
 * derived from the Natural Earth's Admin 0 country boundaries, 1:50m medium
 * scale" — the same source generation as the lakes, rivers and sub-national
 * lines in `frontend/public/reference/`.
 */

let cachedCollection: CountryFeatureCollection | null = null;

/**
 * The 1:50m countries, joined to the curated registry by ISO numeric id.
 *
 * Byte-for-byte the same procedure as `getCountryFeatureCollection`, against a
 * finer topology. Kept as its own cache so the two resolutions can coexist in
 * one page — the map route may render the spatial shell while the Hero on a
 * prefetched homepage still holds the 110m collection, and neither should
 * evict the other.
 */
export function getSpatialCountryFeatureCollection(): CountryFeatureCollection {
  if (cachedCollection) return cachedCollection;

  const topology = worldAtlas50m as unknown as Topology;
  const countriesObject = topology.objects.countries as GeometryCollection;
  const converted = feature(topology, countriesObject) as unknown as FeatureCollection<Geometry>;

  const features: CountryFeature[] = converted.features.map((f) => {
    const numericId = String(f.id ?? '').padStart(3, '0');

    return {
      ...f,
      id: numericId,
      properties: {
        numericId,
        country: findCountryByNumeric(numericId),
      },
    };
  });

  cachedCollection = { type: 'FeatureCollection', features };
  return cachedCollection;
}
