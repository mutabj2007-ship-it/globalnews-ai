/**
 * GLOBE LOCATOR — WHERE THE VIEWPORT INDICATOR GOES.
 *
 * Specification §3d: the lower-left cluster carries "the globe locator (global
 * camera position with a viewport indicator)". §"Design reference versus
 * production behaviour": production "must render the globe locator from the
 * live camera and world geography rather than from a fixed image."
 *
 * So the indicator is computed from the camera's real bounds every frame. This
 * module is the arithmetic, kept pure so the awkward cases — a camera wider
 * than the world, a camera crossing the antimeridian, a degenerate zero-width
 * camera — are answered in a test rather than discovered on screen.
 *
 * Coordinates are normalised 0..1 on an equirectangular projection: x from
 * -180..180 and y from 90..-90, y growing DOWNWARD to match SVG.
 */

export interface LngLatBounds {
  readonly west: number;
  readonly south: number;
  readonly east: number;
  readonly north: number;
}

export interface ViewportRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /**
   * True when the camera crosses the antimeridian, so the caller draws TWO
   * rectangles rather than one absurdly wide one. Returning a single rect that
   * spans the whole world would tell the reader they are looking at everything.
   */
  readonly wraps: boolean;
  /** The second rectangle's x, when `wraps`. Its width is `wrapWidth`. */
  readonly wrapX: number;
  readonly wrapWidth: number;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export function lngToX(lng: number): number {
  return clamp01((lng + 180) / 360);
}

export function latToY(lat: number): number {
  /* Latitude is clamped to the Mercator-usable range the camera itself is
     limited to; beyond it the indicator would leave the frame. */
  const bounded = Math.min(90, Math.max(-90, lat));
  return clamp01((90 - bounded) / 180);
}

export function viewportRectFor(bounds: LngLatBounds): ViewportRect {
  const y = latToY(bounds.north);
  const height = Math.max(0.004, latToY(bounds.south) - y);

  const west = lngToX(bounds.west);
  const east = lngToX(bounds.east);

  if (east >= west) {
    return {
      x: west,
      y,
      width: Math.max(0.004, east - west),
      height,
      wraps: false,
      wrapX: 0,
      wrapWidth: 0,
    };
  }

  /* Crossing the antimeridian: the camera occupies [west..1] and [0..east]. */
  return {
    x: west,
    y,
    width: Math.max(0.004, 1 - west),
    height,
    wraps: true,
    wrapX: 0,
    wrapWidth: Math.max(0.004, east),
  };
}

/**
 * A camera that already shows the whole world has nothing to locate, and a
 * rectangle around everything is noise rather than information. The caller
 * suppresses the indicator instead.
 *
 * THE TEST IS AREA, AND THE THRESHOLD IS NOT ARBITRARY. Judging the axes
 * separately gets the ordinary global view wrong: the camera is clamped to
 * roughly +/-85 degrees, so a whole-world view is FULL width but only ~0.94 of
 * the equirectangular height, and any per-axis rule that fires below 0.98 calls
 * it "meaningful" and draws a box around everything. The threshold therefore
 * sits below that 0.94 — 0.85 — which suppresses the global view while a
 * continent-scale camera, the next thing up from it, is around 0.1 and survives
 * comfortably.
 */
export function indicatorIsMeaningful(rect: ViewportRect): boolean {
  const covered = rect.wraps ? rect.width + rect.wrapWidth : rect.width;
  return covered * rect.height < 0.85;
}

/**
 * THE CAMERA'S BOUNDS, DERIVED FROM THE SAME CAMERA THE RENDERER USES.
 *
 * The locator needs a rectangle; the shell holds a centre and a zoom. Rather
 * than plumb bounds up out of the MapLibre instance — which would couple this
 * 64px widget to the renderer's lifecycle and give it a frame where it has no
 * answer at all — it derives them from the identical camera the renderer is
 * given. The two therefore cannot disagree about WHERE the camera is; at most
 * they differ marginally about the exact edge, which at this size is sub-pixel.
 *
 * Web Mercator: the world is 512 * 2^zoom CSS pixels wide at the equator.
 */
const WORLD_TILE_SIZE = 512;

export function boundsFromCamera(
  center: readonly [number, number],
  zoom: number,
  widthPx: number,
  heightPx: number,
): LngLatBounds {
  const worldPx = WORLD_TILE_SIZE * Math.pow(2, zoom);
  const lngSpan = (widthPx / worldPx) * 360;

  /* Latitude span is computed through the Mercator y so it is correct away from
     the equator, where a linear degrees-per-pixel figure is visibly wrong. */
  const latRad = (center[1] * Math.PI) / 180;
  const mercY = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
  const mercSpan = ((heightPx / worldPx) * 2 * Math.PI);

  const toLat = (m: number): number => (180 / Math.PI) * (2 * Math.atan(Math.exp(m)) - Math.PI / 2);

  const north = Math.min(85, toLat(mercY + mercSpan / 2));
  const south = Math.max(-85, toLat(mercY - mercSpan / 2));

  const wrapLng = (lng: number): number => {
    let value = lng;
    while (value > 180) value -= 360;
    while (value < -180) value += 360;
    return value;
  };

  /* A camera wider than the world is the whole world, not a wrapped sliver. */
  if (lngSpan >= 360) {
    return { west: -180, south, east: 180, north };
  }

  return {
    west: wrapLng(center[0] - lngSpan / 2),
    south,
    east: wrapLng(center[0] + lngSpan / 2),
    north,
  };
}
