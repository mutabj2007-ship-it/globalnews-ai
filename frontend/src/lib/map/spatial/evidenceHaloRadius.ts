import { MAX_ZOOM, MIN_ZOOM } from '@/lib/map/camera/cameraState';

/**
 * THE PRECISION HALO'S RADIUS, IN REAL GROUND KILOMETRES.
 *
 * Part I §G: "The precision halo is drawn in REAL GROUND UNITS — 260 km for a
 * country ceiling, 110 km province, 45 km district, 14 km city, 0 for EXACT —
 * so it shrinks and grows correctly with zoom."
 *
 * MapLibre's `circle-radius` is in SCREEN PIXELS, so a fixed value would be the
 * failure that rule forbids. Web Mercator's ground resolution is
 *
 *     metres per pixel = 156543.03392 * cos(latitude) / 2^zoom
 *
 * so the radius is `haloMetres * 2^zoom / (C * cos(lat))`, evaluated in the
 * engine per zoom and per latitude.
 *
 * ── WHY THIS LIVES IN ITS OWN MODULE ──────────────────────────────────────
 *
 * MEASURED ON LIVE ALPHA, Chrome console:
 *
 *     layers.gn-evidence-halo.paint.circle-radius: "zoom" expression may only
 *     be used as input to a top-level "step" or "interpolate" expression.
 *
 * MapLibre 4 accepted `['zoom']` nested inside arithmetic; 5.24 enforces the
 * documented rule. Correcting that is only half the job — the halo is a TRUTH
 * CLAIM about precision, so the corrected expression has to be shown to draw
 * the same circle. It is extracted here, away from the canvas component and
 * its MapLibre import, so it can be evaluated in this repository's `node` test
 * environment and the equivalence measured rather than asserted.
 */
export const EARTH_CIRCUMFERENCE_OVER_TILE = 156543.03392;

/** The radius formula with the zoom factor already resolved to a constant. */
export const haloRadiusAtZoom = (zoom: number): unknown => [
  '/',
  ['*', ['get', 'haloMetres'], Math.pow(2, zoom)],
  ['*', EARTH_CIRCUMFERENCE_OVER_TILE, ['cos', ['*', ['get', 'lat'], Math.PI / 180]]],
];

/**
 * THE MATHS IS UNCHANGED, AND THAT IS PROVABLE RATHER THAN ASSERTED.
 *
 * The radius is exponential in zoom with base 2. `interpolate` with
 * `['exponential', 2]` between stops z0 and z1 yields
 *
 *     out(z) = out0 + (out1 - out0) * (2^(z-z0) - 1) / (2^(z1-z0) - 1)
 *
 * and substituting `out1 = out0 * 2^(z1-z0)` collapses it to `out0 * 2^(z-z0)`
 * — EXACTLY the original, for ANY pair of stops. So two stops suffice and the
 * curve is identical, not approximated.
 *
 * THE STOPS ARE THE CAMERA'S OWN LIMITS, not magic numbers: this map is clamped
 * to `MIN_ZOOM`/`MAX_ZOOM`, so they span everything reachable and there is no
 * extrapolation for MapLibre to clamp.
 *
 * `['get','lat']` stays inside the outputs, which is allowed — only `['zoom']`
 * is constrained.
 */
export const haloRadiusExpression = (): unknown => [
  'interpolate',
  ['exponential', 2],
  ['zoom'],
  MIN_ZOOM,
  haloRadiusAtZoom(MIN_ZOOM),
  MAX_ZOOM,
  haloRadiusAtZoom(MAX_ZOOM),
];
