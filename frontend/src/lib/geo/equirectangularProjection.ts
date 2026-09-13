/**
 * CTO Frontend Visual Revision — Hero world geometry, Section 6.
 *
 * A deliberately simple equirectangular projection (plain linear
 * lon/lat -> x/y scaling) — NOT d3-geo, NOT any new dependency. This
 * is genuinely all the math an equirectangular projection needs; a
 * projection library would be solving a problem this simple case
 * doesn't have. Consumes the SAME real GeoJSON data the project
 * already has (world-atlas + topojson-client, via
 * `getCountryFeatureCollection()` — unchanged, not duplicated), and
 * produces plain SVG `<path d="...">` strings.
 *
 * Runs server-side only (imported from a Server Component) — the
 * actual GeoJSON parsing/projection computation happens at
 * render/build time; only the resulting lightweight SVG markup is
 * sent to the client. This is what keeps the Hero's client bundle
 * unaffected despite using the real, sizeable world-atlas dataset.
 *
 * Coordinate decimation (`simplifyRing`) keeps the output SVG
 * reasonably sized: full Natural Earth 110m detail is unnecessary for
 * a decorative ~500px hero visual — every Nth point is kept, which
 * preserves recognizable continent silhouettes while sharply
 * reducing path length.
 */

export interface ProjectionViewport {
  width: number;
  height: number;
}

/** Plain equirectangular projection: longitude/latitude map linearly to x/y. */
export function projectPoint([lon, lat]: [number, number], viewport: ProjectionViewport): [number, number] {
  const x = ((lon + 180) / 360) * viewport.width;
  const y = ((90 - lat) / 180) * viewport.height;
  return [x, y];
}

/** Keeps every Nth coordinate (plus always the first and last) to bound path complexity. */
export function simplifyRing(ring: [number, number][], keepEvery: number): [number, number][] {
  if (ring.length <= 2 || keepEvery <= 1) return ring;

  const simplified: [number, number][] = [];
  for (let i = 0; i < ring.length; i += keepEvery) {
    simplified.push(ring[i]);
  }
  const last = ring[ring.length - 1];
  const lastSimplified = simplified[simplified.length - 1];
  if (lastSimplified !== last) {
    simplified.push(last);
  }
  return simplified;
}

/** Converts one polygon ring (an array of [lon, lat] points) into an SVG path 'd' fragment. */
export function ringToPathD(ring: [number, number][], viewport: ProjectionViewport, keepEvery: number): string {
  const simplified = simplifyRing(ring, keepEvery);
  if (simplified.length < 2) return '';

  const projected = simplified.map((point) => projectPoint(point, viewport));
  const [firstX, firstY] = projected[0];
  const rest = projected
    .slice(1)
    .map(([x, y]) => `L ${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(' ');

  return `M ${firstX.toFixed(1)} ${firstY.toFixed(1)} ${rest} Z`;
}

type GeoJsonGeometry =
  | { type: 'Polygon'; coordinates: [number, number][][] }
  | { type: 'MultiPolygon'; coordinates: [number, number][][][] };

/**
 * Converts a single GeoJSON Polygon/MultiPolygon geometry into one
 * combined SVG path 'd' string (all rings concatenated — this is
 * exactly how SVG paths natively express multi-ring/multi-part
 * shapes, using the fill-rule to handle holes correctly).
 */
export function geometryToPathD(
  geometry: GeoJsonGeometry | null | undefined,
  viewport: ProjectionViewport,
  keepEvery: number = 3,
): string {
  if (!geometry) return '';

  if (geometry.type === 'Polygon') {
    return geometry.coordinates.map((ring) => ringToPathD(ring, viewport, keepEvery)).join(' ');
  }

  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates
      .map((polygon) => polygon.map((ring) => ringToPathD(ring, viewport, keepEvery)).join(' '))
      .join(' ');
  }

  return '';
}
