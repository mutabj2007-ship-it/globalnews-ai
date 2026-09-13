import type { CountryFeature, CountryFeatureCollection } from '@/lib/map/countryGeometry';

/**
 * ── PO-1 — WHY A RENDERER NEEDS THIS AND A PROJECTION DOES NOT ─────────────
 *
 * `world-atlas/countries-110m` stores three countries whose rings TOUCH BOTH
 * EDGES of the lon/lat plane: Russia (two rings), Fiji (one) and Antarctica
 * (one). Inside such a ring two consecutive vertices sit at, say, 178.6°E and
 * -180°E — the same physical place, 0.4° apart on the globe, and 358.6° apart
 * on the plane.
 *
 * d3-geo, which the homepage Hero and the legacy World Map both use, CLIPS the
 * sphere at the antimeridian before projecting, so that pair is cut into two
 * edge points and the country renders correctly. MapLibre does not clip: it
 * takes the coordinates as plane coordinates and draws the straight segment
 * between them. That segment crosses the ENTIRE WORLD, and the ring it belongs
 * to fills as a band spanning every longitude at that latitude.
 *
 * Measured on the integrated build at 1440x900: bands at ~65°N and ~71°N
 * (Russia) and ~16°S (Fiji), each the full width of the canvas. Together with
 * `renderWorldCopies` they are what reads as "the map is repeated across the
 * viewport".
 *
 * THIS IS A RENDERER ADAPTER, NOT A DATA CORRECTION. The source data is right;
 * it is right for a clipping projection. Nothing here is applied to
 * `getCountryFeatureCollection()` itself, because the Hero and the legacy map
 * consume that through d3 and are correct today — this runs at the MapLibre
 * source boundary and nowhere else.
 *
 * ── WHAT IT DOES ──────────────────────────────────────────────────────────
 *
 * UNWRAP, then MIRROR.
 *
 * Unwrap walks a ring and, whenever the longitude jumps by more than 180°,
 * shifts every following vertex by ∓360° so the ring stays continuous. Russia's
 * Chukotka lobe then lives just PAST +180 rather than leaping back to -180, and
 * the band is gone. No vertex moves on the globe: 181.4°E and -178.6°E are the
 * same meridian.
 *
 * Unwrapping alone would hide that lobe, because with world copies off the
 * renderer draws only [-180, 180]. So each split polygon is emitted TWICE — once
 * unwrapped and once shifted a further -360° — and whichever copy falls inside
 * the world is the one that draws. The far side is off-world and simply is not
 * painted. This is the standard antimeridian treatment; it adds polygons, never
 * vertices of its own invention.
 *
 * Antarctica is passed through this unchanged and is unaffected: its only jump
 * is the closing vertex of a ring that already spans -180..180 along the polar
 * edge, so unwrapping rewrites that one vertex to the point it already
 * coincides with, and the mirrored copy falls entirely off-world.
 */

/** A jump larger than this is a seam crossing, not a real step. */
const SEAM_DELTA_DEGREES = 180;

/** One full turn of the plane. */
const TURN_DEGREES = 360;

type Ring = readonly (readonly number[])[];
type PolygonRings = readonly Ring[];

function ringCrossesSeam(ring: Ring): boolean {
  for (let i = 1; i < ring.length; i += 1) {
    const previous = ring[i - 1][0];
    const current = ring[i][0];

    if (Math.abs(current - previous) > SEAM_DELTA_DEGREES) return true;
  }

  return false;
}

/**
 * A ring made continuous, and shifted by `offsetDegrees` afterwards.
 *
 * Latitude is copied through untouched — the seam is a longitude construct and
 * a ring that crossed it is still the same shape north to south.
 */
function unwrapRing(ring: Ring, offsetDegrees: number): number[][] {
  const out: number[][] = [];
  let carry = 0;

  for (let i = 0; i < ring.length; i += 1) {
    const [longitude, latitude] = ring[i];

    if (i > 0) {
      const delta = longitude - ring[i - 1][0];

      if (delta > SEAM_DELTA_DEGREES) carry -= TURN_DEGREES;
      else if (delta < -SEAM_DELTA_DEGREES) carry += TURN_DEGREES;
    }

    out.push([longitude + carry + offsetDegrees, latitude]);
  }

  return out;
}

function unwrapPolygon(rings: PolygonRings, offsetDegrees: number): number[][][] {
  return rings.map((ring) => unwrapRing(ring, offsetDegrees));
}

/** Every polygon of a feature, whatever its geometry type, or null if it has none. */
function polygonsOf(feature: CountryFeature): PolygonRings[] | null {
  const geometry = feature.geometry;

  if (geometry.type === 'Polygon') return [geometry.coordinates as PolygonRings];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates as unknown as PolygonRings[];

  return null;
}

/**
 * The same countries, safe to hand to a non-clipping renderer.
 *
 * Features with no seam-crossing ring are returned BY REFERENCE — 174 of the
 * 177 countries are untouched objects, so this cannot perturb anything that
 * compares identity, and the cost is one pass over the coordinates.
 */
export function splitAntimeridianFeatures(
  collection: CountryFeatureCollection,
): CountryFeatureCollection {
  const features = collection.features.map((feature) => {
    const polygons = polygonsOf(feature);

    if (polygons === null) return feature;

    const crossing = polygons.some((rings) => rings.some((ring) => ringCrossesSeam(ring)));

    if (!crossing) return feature;

    const rebuilt: number[][][][] = [];

    for (const rings of polygons) {
      if (!rings.some((ring) => ringCrossesSeam(ring))) {
        rebuilt.push(rings as unknown as number[][][]);
        continue;
      }

      /* The continuous polygon, and its image one turn to the west. */
      rebuilt.push(unwrapPolygon(rings, 0));
      rebuilt.push(unwrapPolygon(rings, -TURN_DEGREES));
    }

    return {
      ...feature,
      geometry: { type: 'MultiPolygon', coordinates: rebuilt },
    } as CountryFeature;
  });

  return { type: 'FeatureCollection', features };
}

/**
 * C907 §3 — THE SAME TREATMENT, FOR LINES.
 *
 * The coastline and the internal-border mesh are derived from the SAME arcs as
 * the country polygons, so they cross the antimeridian in exactly the same
 * three places and would draw exactly the same world-spanning bands. A line
 * has no rings and no holes, so the polygon function above cannot take it —
 * but the algorithm is identical and is reused rather than restated: unwrap
 * the jump, then emit the western mirror so whichever copy falls inside the
 * painted world is the one that draws.
 *
 * Lines that never cross are returned by reference, untouched.
 */
export function splitAntimeridianLines(
  lines: readonly (readonly (readonly number[])[])[],
): number[][][] {
  const out: number[][][] = [];

  for (const line of lines) {
    if (!ringCrossesSeam(line)) {
      out.push(line as unknown as number[][]);
      continue;
    }

    out.push(unwrapRing(line, 0));
    out.push(unwrapRing(line, -TURN_DEGREES));
  }

  return out;
}

/** Exported for the guard: which countries this actually has to rewrite. */
export function seamCrossingFeatureIds(collection: CountryFeatureCollection): string[] {
  const ids: string[] = [];

  for (const feature of collection.features) {
    const polygons = polygonsOf(feature);

    if (polygons === null) continue;
    if (polygons.some((rings) => rings.some((ring) => ringCrossesSeam(ring)))) {
      ids.push(String(feature.id));
    }
  }

  return ids;
}
