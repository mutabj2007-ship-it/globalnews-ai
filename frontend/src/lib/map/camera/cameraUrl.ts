import { MAX_ZOOM, MIN_ZOOM, WORLD_CAMERA, type CameraState, normaliseCamera } from './cameraState';

/**
 * SPATIAL M1a — URL-SAFE CAMERA STATE.
 *
 * One query parameter, `?cam=`, holding `zoom/lng/lat` — the deck.gl and
 * Mapbox convention, so the shape is familiar and short enough to survive
 * being pasted into a chat message.
 *
 *   ?cam=3.25/30.06/-1.94
 *
 * URL-SAFE MEANS EXACTLY THAT. Only digits, '-', '.' and '/' are ever
 * produced, so nothing needs percent-encoding and a copied link does not grow
 * escape sequences. Bearing and pitch are NOT serialised at M1a: the shell
 * does not rotate or tilt, and a parameter for a capability that does not
 * exist is a promise this milestone cannot keep.
 *
 * EVERY INPUT IS UNTRUSTED. A camera can arrive from a hand-edited address
 * bar, so `decodeCamera` never throws and never returns a broken camera: it
 * returns null for anything it cannot read, and the caller falls back to
 * WORLD. Values that parse but are out of range are clamped by
 * `normaliseCamera` rather than rejected, because a slightly-too-far zoom is a
 * user asking for something reasonable, not an attack.
 */

export const CAMERA_QUERY_KEY = 'cam';

/** Enough to place a country precisely; short enough to stay readable. */
const ZOOM_DP = 2;
const COORD_DP = 4;

const trimZeros = (value: string): string =>
  value.includes('.') ? value.replace(/0+$/, '').replace(/\.$/, '') : value;

export function encodeCamera(camera: CameraState): string {
  const c = normaliseCamera(camera);

  return [
    trimZeros(c.zoom.toFixed(ZOOM_DP)),
    trimZeros(c.center[0].toFixed(COORD_DP)),
    trimZeros(c.center[1].toFixed(COORD_DP)),
  ].join('/');
}

/** A finite number, or null. Rejects '', ' ', 'NaN', 'Infinity', '1e5', hex. */
const strictNumber = (raw: string): number | null => {
  if (!/^-?\d+(\.\d+)?$/.test(raw)) return null;

  const value = Number(raw);

  return Number.isFinite(value) ? value : null;
};

export function decodeCamera(raw: string | null | undefined): CameraState | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 64) return null;

  const parts = raw.split('/');

  if (parts.length !== 3) return null;

  const zoom = strictNumber(parts[0]);
  const lng = strictNumber(parts[1]);
  const lat = strictNumber(parts[2]);

  if (zoom === null || lng === null || lat === null) return null;

  /*
   * ── LONGITUDE IS NO LONGER RANGE-CHECKED, AND LATITUDE STILL IS ──────────
   *
   * SUPERSEDED CLAUSE: "a longitude of 999 is not a user asking to see
   * something slightly further east — it is a malformed link". That was sound
   * while the engine clamped the camera inside one world, because no legitimate
   * camera could hold such a value and one could only arrive by corruption.
   *
   * Design v1.7 removed the clamp and Main ruled the longitude signed and
   * unwrapped, so a camera outside ±180 is now an ORDINARY POSITION a reader
   * can reach by dragging. Rejecting it would mean the one thing a URL exists
   * to do — restore what someone was looking at — silently failed for every
   * view past the antimeridian, and 654.918 would come back as the world.
   *
   * There is deliberately NO REPLACEMENT BOUND. Any finite longitude is a valid
   * camera; an `LNG_LIMIT` would be the same fold under another name, and the
   * malformed cases this clause actually protected against — NaN, Infinity,
   * empty, hex, exponent notation — are all still refused by `strictNumber`
   * above, which is where they belong.
   *
   * LATITUDE IS STILL CHECKED, because ±90 is not a convention: there is no
   * position beyond the pole to restore, so a value outside it is malformed in
   * a way a longitude of 999 no longer is.
   */
  if (lat < -90 || lat > 90) return null;

  return normaliseCamera({ center: [lng, lat], zoom, bearing: 0, pitch: 0 });
}

/**
 * The camera to open with, given a URL's search params.
 *
 * Absent or unreadable -> WORLD. This is the only place that decision is made.
 */
export function cameraFromSearchParams(params: URLSearchParams | null | undefined): CameraState {
  return decodeCamera(params?.get(CAMERA_QUERY_KEY) ?? null) ?? WORLD_CAMERA;
}

/**
 * The search string this camera should produce, PRESERVING every other
 * parameter already on the URL.
 *
 * The World Map carries its own state in the query (selected country,
 * category), so a camera update must never be written by replacing the search
 * string wholesale. At WORLD the parameter is REMOVED rather than written,
 * which keeps a link to the default view clean and makes "no camera in the
 * URL" and "the world camera" the same thing, in both directions.
 */
export function searchParamsWithCamera(
  existing: URLSearchParams | null | undefined,
  camera: CameraState,
): URLSearchParams {
  const params = new URLSearchParams(existing?.toString() ?? '');
  const normalised = normaliseCamera(camera);

  if (encodeCamera(normalised) === encodeCamera(WORLD_CAMERA)) {
    params.delete(CAMERA_QUERY_KEY);
  } else {
    params.set(CAMERA_QUERY_KEY, encodeCamera(normalised));
  }

  return params;
}

/** The clamped range a decoded camera can occupy, re-exported for tests and docs. */
export const CAMERA_URL_ZOOM_RANGE: readonly [number, number] = [MIN_ZOOM, MAX_ZOOM];
