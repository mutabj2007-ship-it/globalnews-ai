/**
 * SPATIAL M1a — CAMERA STATE.
 *
 * The camera is DATA, not a side effect on a map object. Every control, URL
 * and keyboard gesture in this shell produces a `CameraState`; the engine
 * wrapper is the only thing that turns one into a MapLibre call.
 *
 * WHY THIS IS A SEPARATE, ENGINE-FREE MODULE. It imports nothing from
 * `maplibre-gl`, so the whole camera contract is unit-testable in this
 * repository's node-only jest environment, and so replacing or wrapping the
 * engine later cannot silently change what a camera means.
 *
 * PRECISION IS NOT HERE, AND THAT IS DELIBERATE. Nothing in this module reads
 * `SpatialPrecision`. A camera says where the viewport is; precision says what
 * may be asserted. M1.0A made those separate axes and M1.0B enforced it in the
 * frontend — a zoom level must never become an evidence claim, so the type
 * that carries zoom has no field that could be mistaken for one.
 */

export interface CameraState {
  /** [longitude, latitude]. */
  readonly center: readonly [number, number];
  readonly zoom: number;
  readonly bearing: number;
  readonly pitch: number;
}

/**
 * WORLD. The reset target, and the shell's initial camera.
 *
 * Matches the values the existing `WorldMap` opens with, so "Reset World"
 * returns to the view this product has always started from rather than to a
 * new opinion about where the world begins.
 */
export const WORLD_CAMERA: CameraState = {
  center: [12, 20],
  zoom: 1.1,
  bearing: 0,
  pitch: 0,
};

/** Also matching the existing World Map. */
export const MIN_ZOOM = 0.6;
export const MAX_ZOOM = 6;

/** One press of a zoom control. */
export const ZOOM_STEP = 0.75;

/**
 * How many snapshots "Previous View" can walk back through.
 *
 * Bounded on purpose: an unbounded stack is a memory leak on a surface a user
 * can pan for a long time, and nobody navigates back through fifty views.
 *
 * SPATIAL M2 — 24 -> 25, ON MAIN'S ARBITRATION. Design Part I §C and Part II
 * §3 both specify a 25-deep history ("Previous view pops a 25-deep camera
 * history including the selection that was active"), and Main ruled: one
 * reducer, one stack, maximum depth 25. M1a's 24 was my own round number and
 * had no source; the spec's does.
 */
export const CAMERA_HISTORY_LIMIT = 25;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/**
 * ── LONGITUDE IS SIGNED, UNWRAPPED, AND NOT CLAMPED TO ±180 ───────────────
 *
 * THE WRAP THAT USED TO BE ON THIS LINE IS GONE. It folded every longitude into
 * [-180, 180] on the way out of this module, which made three different
 * positions indistinguishable to everything downstream:
 *
 *     190 became -170          540 became 180          654.918 became -65.082
 *
 * That was harmless while the engine clamped the camera inside one world and
 * nothing could ever hold a longitude outside it. Design v1.7 removed the
 * clamp, and the fold immediately became a lie: the transform travelled past
 * ±180 while the state this module published had been rewritten to a different
 * place. MEASURED on the shipped build — the readout claimed 76.41°W while the
 * map pane was open water, and reloading that URL landed on the world at the
 * SAME reported camera. The camera the product displayed and the camera the
 * user was looking through were not the same camera.
 *
 * So: 190 is not the same camera as -170, 540 is not the same camera as 180,
 * and 654.918 restores as 654.918. `camerasEqual` compares the raw values, so
 * wrapped equivalents are correctly different positions — history, the URL and
 * Previous View all now carry the longitude the user actually reached.
 *
 * ── WHAT IS STILL DONE HERE, AND WHY IT IS NOT THE SAME THING ─────────────
 *
 * LATITUDE IS STILL CLAMPED, to the Web Mercator limit. That is not a fold:
 * there is no latitude beyond ±85.05 to represent, so clamping loses no
 * position, while wrapping longitude discarded a real one.
 *
 * NON-FINITE IS STILL REPAIRED TOWARD WORLD. A NaN or an Infinity arrives from
 * a URL a person can type, and is not an error to throw. There is deliberately
 * NO `LNG_LIMIT` beside it: a finite longitude is a valid camera however large,
 * and inventing a bound would reintroduce the fold under another name.
 */
/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE CANONICAL LONGITUDE DOMAIN — PO RULING A, C906
 * ════════════════════════════════════════════════════════════════════════════
 *
 * SUPERSEDES the signed/unwrapped/unbounded longitude contract, on measured
 * Alpha failure. The Product Owner's screenshots carried persisted cameras of
 *
 *     cam=0.6 / -1889° / +85°        cam=0.6 / +241° / -85°
 *
 * and the ruling is exact: *"A map may be flexible, but it may not let the
 * single painted world disappear into thousands of degrees of empty
 * longitude."*
 *
 * ── WHY THE OLD CONTRACT WAS DEFENSIBLE AND STILL FAILED ────────────────────
 *
 * It was built to fix a real defect: `normaliseCenter` used to FOLD longitude
 * while the engine transform had genuinely travelled, so the readout and the
 * view disagreed and the disagreement was blamed on the readout. Unwrapping
 * state made them agree again.
 *
 * What it missed is that agreeing about being lost is still being lost. With
 * `renderWorldCopies: false` there is exactly one painted world, so a camera at
 * -1889° agrees with the transform, restores faithfully from a URL, and shows
 * the reader an empty ocean for ever.
 *
 * ── THE CORRECTION: ONE DOMAIN, ENTERED AT EVERY EDGE ───────────────────────
 *
 * The canonical domain is [-180, 180). Everything entering the camera — a URL,
 * a gesture, a restored history entry, a jump target — is WRAPPED into it, so
 * ±360 can never accumulate: 241 is 241 - 360 = -119, and -1889 is -89, which
 * is the position over the Americas the reader was actually at in world terms.
 *
 * Wrapping is deliberately not clamping. A clamp would answer -1889 with -180,
 * inventing a position the reader never chose; the wrap returns the one they
 * did, expressed canonically. The engine is separately held inside the same
 * domain (see `transformConstrain` in `EvidenceMapCanvas`), so state and
 * transform agree — which is the property the superseded contract was
 * protecting, now achieved without letting the world disappear.
 *
 * The readout, Previous View and `camerasEqual` are all unaffected in
 * substance: inside one domain there are no wrapped equivalents left to
 * confuse, so two cameras compare equal exactly when they show the same view.
 */
export function wrapLongitude(lng: number): number {
  if (!Number.isFinite(lng)) return WORLD_CAMERA.center[0];

  /* ((x + 180) mod 360 + 360) mod 360 - 180 — positive-safe, so -1889 -> -89. */
  const wrapped = ((((lng + 180) % 360) + 360) % 360) - 180;

  /*
    A wrap of exactly +180 lands on -180, which is the same meridian. Returning
    the negative end keeps the domain half-open and single-valued, so the URL
    for one view is one string.
  */
  return Object.is(wrapped, -0) ? 0 : wrapped;
}

/** The domain's bounds, exported so the engine and the tests share one source. */
export const LNG_MIN = -180;
export const LNG_MAX = 180;

export function normaliseCenter(center: readonly [number, number]): readonly [number, number] {
  const [lngRaw, latRaw] = center;
  const lng = wrapLongitude(lngRaw);
  const lat = Number.isFinite(latRaw) ? clamp(latRaw, -85.05112878, 85.05112878) : WORLD_CAMERA.center[1];

  return [lng, lat];
}

/**
 * Every camera that leaves this module is clamped and finite.
 *
 * A NaN or out-of-range camera is not an error to throw — it arrives from a
 * URL a user can type — so it is repaired toward WORLD rather than crashing
 * the surface.
 */
export function normaliseCamera(camera: CameraState): CameraState {
  return {
    center: normaliseCenter(camera.center),
    zoom: Number.isFinite(camera.zoom) ? clamp(camera.zoom, MIN_ZOOM, MAX_ZOOM) : WORLD_CAMERA.zoom,
    bearing: Number.isFinite(camera.bearing) ? ((camera.bearing % 360) + 360) % 360 : 0,
    pitch: Number.isFinite(camera.pitch) ? clamp(camera.pitch, 0, 60) : 0,
  };
}

/**
 * Positional equality within a tolerance, so float drift is not a new view.
 *
 * PO RULING A (C906) — THERE ARE NO WRAPPED EQUIVALENTS LEFT TO DISTINGUISH.
 *
 * This used to document the opposite: "190 and -170 compare unequal", so that
 * Previous View restored the camera the user was at rather than a fold of it.
 * That distinction existed only because longitude was unbounded. Every camera
 * now enters the canonical [-180, 180) domain at its edge, so 190 IS -170 —
 * they are one position with one spelling, and comparing the stored values
 * still answers "same view?" correctly.
 *
 * Previous View is therefore still truthful: the history holds canonical
 * cameras, and popping one restores the view it recorded.
 */
export function camerasEqual(a: CameraState, b: CameraState, epsilon = 1e-6): boolean {
  return (
    Math.abs(a.center[0] - b.center[0]) < epsilon &&
    Math.abs(a.center[1] - b.center[1]) < epsilon &&
    Math.abs(a.zoom - b.zoom) < epsilon &&
    Math.abs(a.bearing - b.bearing) < epsilon &&
    Math.abs(a.pitch - b.pitch) < epsilon
  );
}

export function isWorldCamera(camera: CameraState): boolean {
  return camerasEqual(normaliseCamera(camera), WORLD_CAMERA, 1e-4);
}

/** [west, south, east, north]. */
export type Bounds = readonly [number, number, number, number];

/**
 * A camera that frames `bounds`.
 *
 * DELIBERATELY APPROXIMATE, AND NAMED SO. This is the engine-free fallback
 * used for state, URLs and tests; the engine wrapper prefers MapLibre's own
 * `fitBounds`, which knows the real viewport. Keeping a pure version means the
 * camera contract can be reasoned about and tested without a browser, and the
 * two never disagree about anything that matters — the centre — only about
 * how tightly the edges are hugged.
 */
export function cameraForBounds(bounds: Bounds, padding = 0.4): CameraState {
  const [west, south, east, north] = bounds;
  const spanLng = Math.max(Math.abs(east - west), 1e-6);
  const spanLat = Math.max(Math.abs(north - south), 1e-6);
  const span = Math.max(spanLng, spanLat) * (1 + padding);
  const zoom = Math.log2(360 / span);

  return normaliseCamera({
    center: [(west + east) / 2, (south + north) / 2],
    zoom,
    bearing: 0,
    pitch: 0,
  });
}

/**
 * SPATIAL M2 — THE HISTORY ENTRY, WIDENED ON MAIN'S ARBITRATION.
 *
 * Design Part I §C: "Previous view pops a 25-deep camera history INCLUDING
 * THE SELECTION THAT WAS ACTIVE." M1a stored bare cameras, so stepping back
 * out of a country returned the viewport and left the country selected — the
 * card stayed open describing a place the map was no longer looking at.
 *
 * The selection is stored as an OPAQUE STRING, not as a `MapSelection`. The
 * camera core imports nothing from the state model and nothing from the
 * evidence model, and it must stay that way: a camera module that knows what a
 * selection means is a camera module that can be tempted to move itself when
 * one changes. The shell serialises and resolves; this only carries.
 */
export interface CameraSnapshot {
  readonly camera: CameraState;
  /** Opaque selection token, or null for "nothing was selected". */
  readonly selection: string | null;
}

export function cameraSnapshot(
  camera: CameraState,
  selection: string | null = null,
): CameraSnapshot {
  return { camera: normaliseCamera(camera), selection };
}
