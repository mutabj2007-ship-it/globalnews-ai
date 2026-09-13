import type { Geometry, Position } from 'geojson';

/**
 * R4 GEOGRAPHY ZOOM — THE PROJECTION, AND WHY IT HAD TO CHANGE.
 *
 * ── THE ARITHMETIC THAT MADE THE LAST ATTEMPT FAIL ───────────────────────
 *
 * Under an equirectangular projection a country's on-screen size is
 * `width ÷ 360°` and nothing else. Cropping latitude changes how TALL the box
 * is; it does not change how big Kenya is by one pixel. That is exactly why
 * 7c4898ef removed the dead space and still did not deliver the zoom: the
 * frame moved, the geography did not.
 *
 * With full longitude — and full longitude is non-negotiable, because a map
 * missing the Americas or the Pacific is not a world map — the only remaining
 * lever is a projection that uses vertical space. This is that projection.
 *
 * ── WEB MERCATOR, CLIPPED TO THE INHABITED WORLD ─────────────────────────
 *
 * `y = ln(tan(π/4 + φ/2))`, scaled by 180/π so x and y share units and the
 * projection is CONFORMAL: at any point the horizontal and vertical scales are
 * equal, so country SHAPES are preserved. That is the property that makes
 * outlines recognisable, and it is the opposite of stretching — a stretch
 * would scale one axis and not the other, which is precisely what this does
 * not do.
 *
 * It is also the projection the full World Map already renders, so the two
 * surfaces now agree about the shape of the world.
 *
 * WHAT IT COSTS, STATED PLAINLY: Mercator exaggerates AREA with latitude. A
 * country's position and shape are true; its area relative to an equatorial
 * country is not. Clipping at 75°N keeps that within the range every web map
 * has trained readers on, and Greenland — the usual casualty — is truncated by
 * the frame rather than dominating it.
 *
 * ── THE CLIP IS THE INHABITED BAND, AND IT IS WHY THE WASTE IS GONE ──────
 *
 *   75°N   above it: Arctic Ocean, the top of Greenland, Svalbard. No
 *          retrieval has ever resolved there and none can meaningfully.
 *   57°S   below it: the Southern Ocean and Antarctica. Tierra del Fuego
 *          (55.9°S) and Stewart Island (47°S) are both kept.
 *
 * Everything between is where people live, and it is now the whole picture.
 */
export const LAT_NORTH = 75;
export const LAT_SOUTH = -57;

/** Degrees per radian — keeps projected y in the same units as x. */
const K = 180 / Math.PI;

function mercatorY(latitude: number): number {
  return K * Math.log(Math.tan(Math.PI / 4 + (latitude * Math.PI) / 360));
}

/** Projected y of the frame's top and bottom edges. */
const Y_TOP = mercatorY(LAT_NORTH);
const Y_BOTTOM = mercatorY(LAT_SOUTH);

/** The frame, in projected units. x is longitude; y is Mercator-scaled. */
export const FRAME_WIDTH = 360;
export const FRAME_HEIGHT = Y_TOP - Y_BOTTOM;

/**
 * The frame's aspect, and therefore the canvas box's. The box is sized FROM
 * this so the picture and its container are the same rectangle — no
 * letterbox, and no stretch, at any width.
 */
export const MAP_ASPECT = FRAME_WIDTH / FRAME_HEIGHT;

/**
 * A NUMERICAL guard, not a visual one. Mercator runs to infinity at the poles,
 * so coordinates are held inside a band far OUTSIDE the frame — never at the
 * frame's own edge.
 *
 * That distinction matters and cost a render to learn: clamping to LAT_NORTH
 * itself flattened every Arctic coastline onto the top edge and drew northern
 * Canada, Greenland and Siberia as one solid bar across the top of the map.
 * Letting the geometry run past the frame and be clipped by the viewBox gives
 * the honest result — a coastline cut by the frame, exactly like every other
 * clipped map.
 */
const GUARD_NORTH = 86;
const GUARD_SOUTH = -86;

/** Project one [lon, lat] into frame units. */
function project([lon, lat]: Position): string {
  const safe = Math.min(GUARD_NORTH, Math.max(GUARD_SOUTH, lat));
  return `${(lon + 180).toFixed(2)} ${(Y_TOP - mercatorY(safe)).toFixed(2)}`;
}

/** Every Nth vertex. 110m detail is finer than a few hundred pixels can show. */
const KEEP_EVERY = 2;

function ringPath(ring: Position[]): string {
  if (ring.length < 3) return '';
  /* A ring entirely outside the frame is DROPPED rather than clamped: clamping
     it would lay a degenerate sliver along the frame edge — which is how
     Antarctica would otherwise reappear as a line across the bottom. */
  let inside = false;
  for (const point of ring) {
    const lat = point[1];
    if (lat <= LAT_NORTH && lat >= LAT_SOUTH) {
      inside = true;
      break;
    }
  }
  if (!inside) return '';

  const kept: Position[] = [];
  for (let i = 0; i < ring.length; i += KEEP_EVERY) kept.push(ring[i]);
  const last = ring[ring.length - 1];
  if (kept[kept.length - 1] !== last) kept.push(last);
  if (kept.length < 3) return '';

  return `M${kept.map(project).join('L')}Z`;
}

/** One GeoJSON geometry as an SVG path in frame units. */
export function geometryToFramePath(geometry: Geometry): string {
  if (geometry.type === 'Polygon') {
    return geometry.coordinates.map(ringPath).join('');
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.map((polygon) => polygon.map(ringPath).join('')).join('');
  }
  return '';
}

/** Parallels drawn every 15°, in frame units — real latitudes, not decoration. */
export function parallels(): number[] {
  const lines: number[] = [];
  for (let lat = LAT_NORTH - 15; lat > LAT_SOUTH; lat -= 15) {
    lines.push(Y_TOP - mercatorY(lat));
  }
  return lines;
}

/** Meridians every 30°, in frame units. */
export function meridians(): number[] {
  const lines: number[] = [];
  for (let lon = -150; lon < 180; lon += 30) lines.push(lon + 180);
  return lines;
}
