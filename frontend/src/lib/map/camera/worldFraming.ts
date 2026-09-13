import { MAX_ZOOM, MIN_ZOOM, WORLD_CAMERA, type CameraState } from './cameraState';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * VIEWPORT-AWARE WORLD FRAMING — C907 §6
 * ════════════════════════════════════════════════════════════════════════════
 *
 * THE RULING: *"the 0.6 underzoom that allows one tiny world inside a huge
 * empty field is rejected by the golden visual contract. Establish an effective
 * VIEWPORT-AWARE minimum framing rule. Do NOT blindly hardcode a zoom merely
 * because a screenshot used one."*
 *
 * ── GOVERNANCE SUPERSESSION — READ THIS BEFORE "RESTORING" v1.7 ─────────────
 *
 * DESIGN v1.7's acceptance list contains the item "underzoom below world-fit
 * floor". THAT ITEM IS SUPERSEDED for the protected Spatial release, by the
 * C907 §0.1(4) final ruling:
 *
 *     "The old unrestricted-underzoom aspect of v1.7 is SUPERSEDED for the
 *      protected Spatial release. The Product Owner's golden visual contract
 *      now governs. Accepted: viewport-derived effective minimum zoom /
 *      framing floor."
 *
 * THIS IS RECORDED HERE BECAUSE IT HAS ALREADY BEEN LOST ONCE. C906 removed the
 * world-fit floor citing v1.7, correctly at the time, and the Alpha then shipped
 * both failure cameras at zoom 0.6. An agent reading v1.7 alone would remove it
 * again as a conformance fix. It is not a regression; it is the ruling.
 *
 * WHAT v1.7 STILL GOVERNS, UNCHANGED: free unclamped horizontal panning, ocean
 * field past the world's edge, one painted world with `renderWorldCopies:false`,
 * and the C906 canonical longitude domain. None of that is touched here.
 *
 * ── WHAT THIS RESTORES, AND WHAT IT DELIBERATELY DOES NOT ───────────────────
 *
 * This computation existed before C906 and was removed on purpose. The removal
 * note in `EvidenceMapCanvas` records it exactly: the world-fit floor was "the
 * vertical half of the same clamp" as the horizontal pan wall, `transformConstrain`
 * removed both at once, and Design v1.7's acceptance list asks for "underzoom
 * below world-fit floor" by name.
 *
 * Two things were folded together there that are not the same decision:
 *
 *   PAN is free, and stays free. v1.7: "Horizontal panning is free and
 *   unclamped … Beyond the single world's edge the user sees ocean field, not
 *   another Africa." `transformConstrain` is untouched by this module, and so
 *   is the C906 canonical-longitude correction. A reader may still drag past
 *   the edge and see ocean.
 *
 *   ZOOM is not. Pulling back until the Earth is a small object floating in a
 *   near-black field is the composition the golden authority rejects, and the
 *   Product Owner has now ruled on it. Restoring a floor costs nothing that
 *   v1.7 asked for, because v1.7's sentence is about DRAGGING past the edge,
 *   not about shrinking the world.
 *
 * ── THE RULE, AND WHY IT IS DERIVED RATHER THAN CHOSEN ──────────────────────
 *
 * A Web Mercator world is `TILE_SIZE × 2^zoom` CSS pixels on each side. The
 * zoom at which it exactly covers a pane is therefore
 *
 *     worldFitZoom = log2(max(paneWidth, paneHeight) / TILE_SIZE)
 *
 * `max`, not `width`: on a landscape pane the width is the binding dimension
 * and the whole 360° fills the frame — which is what the golden world capture
 * shows, measured at ~362° of longitude across the map pane from its own 10°
 * graticule. On a portrait pane the height binds instead, the world fills the
 * frame vertically and the reader pans horizontally. Either way there is no
 * empty field, which is the property the ruling is actually about.
 *
 * NO SCREENSHOT NUMBER IS COPIED. The golden frame's own `Z 1.6` readout is the
 * d3 prototype's scale factor `k`, not a MapLibre zoom, and equating the two
 * would be exactly the blind hardcoding the ruling forbids. What is taken from
 * the golden is the RELATIONSHIP — the world fills the usable map area — and
 * the relationship is then solved for whatever viewport the reader actually
 * has.
 *
 * ── RESIZE IS THE SAME RULE, NOT A SECOND ONE ───────────────────────────────
 *
 * Because the floor is a function of the pane, a window resize re-evaluates it
 * with no extra logic: widen the window and the floor rises, so a camera that
 * was legal becomes the new floor and the world still fills the frame.
 */

/** Web Mercator tile size in CSS pixels. MapLibre's world is 512 × 2^zoom. */
export const TILE_SIZE = 512;

/** The zoom at which one painted world exactly covers a pane of this size. */
export function worldFitZoom(paneWidth: number, paneHeight: number): number {
  const span = Math.max(paneWidth, paneHeight);

  /* A pane with no area is not a measurement; the caller keeps its current floor. */
  if (!Number.isFinite(span) || span <= 0) return MIN_ZOOM;

  return Math.log2(span / TILE_SIZE);
}

/**
 * The floor actually handed to the engine.
 *
 * Clamped into the product's declared range for one reason that matters: the
 * STATE layer's `normaliseCamera` already clamps every camera to
 * `[MIN_ZOOM, MAX_ZOOM]`, so a floor outside that range would be a floor the
 * camera state could never express — the engine and the URL would disagree
 * about what view the reader is on, and "URL reload reproduces the sane
 * camera" would stop being true.
 *
 * On a pane narrower than `TILE_SIZE × 2^MIN_ZOOM` (~776 px) the fit zoom falls
 * below `MIN_ZOOM` and `MIN_ZOOM` binds instead. That is still void-free — the
 * world OVERFLOWS a pane that small rather than floating inside it — so the
 * ruling's requirement holds at every viewport, by the floor or by the clamp.
 */
export function effectiveMinZoom(paneWidth: number, paneHeight: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, worldFitZoom(paneWidth, paneHeight)));
}

/**
 * RESET WORLD, framed for this pane.
 *
 * Centre, bearing and pitch are `WORLD_CAMERA`'s, untouched — the golden world
 * composition is centred where it is and that is not a viewport question. Only
 * the zoom is solved, and it is solved to the same value as the floor, so
 * RESET WORLD lands exactly at "the world fills the usable map area" rather
 * than somewhere above it.
 *
 * WHY THIS IS NOT IN THE REDUCER. `cameraIntents` is pure and knows no
 * viewport; making it viewport-aware would put a DOM measurement inside the
 * state machine that owns the URL and the Previous View history. The
 * substitution belongs at the engine boundary, which is where C906 already put
 * the longitude clamp, and the applied camera is reported back on `moveend` so
 * the URL, the HUD and the history all carry the zoom actually in use.
 */
export function worldCameraForPane(paneWidth: number, paneHeight: number): CameraState {
  return { ...WORLD_CAMERA, zoom: effectiveMinZoom(paneWidth, paneHeight) };
}

/**
 * Does this camera ask for the world view?
 *
 * Compares the CENTRE only, and deliberately. `WORLD_CAMERA.zoom` is a
 * constant the state layer still carries, but the zoom the engine should use
 * for it depends on the pane — so the question "is this a reset to world" must
 * not be asked about the zoom, or a reset would stop being recognised the
 * moment it was correctly reframed.
 */
export function isWorldCameraRequest(camera: CameraState): boolean {
  return (
    Math.abs(camera.center[0] - WORLD_CAMERA.center[0]) < 1e-4 &&
    Math.abs(camera.center[1] - WORLD_CAMERA.center[1]) < 1e-4 &&
    camera.bearing === WORLD_CAMERA.bearing &&
    camera.pitch === WORLD_CAMERA.pitch
  );
}
