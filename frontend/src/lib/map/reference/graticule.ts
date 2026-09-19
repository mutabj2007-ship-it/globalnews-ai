import type { FeatureCollection, MultiLineString } from 'geojson';

import { DESIGN_REFERENCE, DESIGN_REFERENCE_WIDTH } from '@/lib/map/spatial/designRenderTokens';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE GRATICULE — C907 §4
 * ════════════════════════════════════════════════════════════════════════════
 *
 * THE RULING: *"Golden authority contains the subtle geographic grid. The
 * current registry says graticule is LIVE but the active map draws none.
 * Restore it as deterministic local reference geography. No network request.
 * No evidence semantics. No precision semantics. Use the approved graticule
 * token exactly."*
 *
 * ── WHAT WAS ACTUALLY MISSING ───────────────────────────────────────────────
 *
 * Everything except the layer. `DESIGN_REFERENCE.graticule` carried the v1.5
 * value, `DESIGN_REFERENCE_WIDTH.graticule` carried the width, the rail
 * carried a `GRID` control, and `layerRegistry` declared the layer
 * `runtime: 'LIVE'` with the note "Generated client-side from the camera; no
 * dataset at all." Four correct statements about a layer nobody had written.
 * The rail control governed nothing and the registry's claim was false.
 *
 * ── PROVENANCE: THE PROTOTYPE'S OWN DRAW LOOP ───────────────────────────────
 *
 * Not inferred from the screenshot. The prototype builds and draws it in three
 * statements:
 *
 *     const graticule = d3.geoGraticule10();
 *     …
 *     ctx.fillStyle = C.ocean; ctx.fillRect(0, 0, W, H);
 *     if (S.layers.grat) { ctx.beginPath(); path(graticule);
 *                          ctx.strokeStyle = C.grat; ctx.lineWidth = .6;
 *                          ctx.stroke(); }
 *     // land base
 *     ctx.beginPath(); S.geo.countries.forEach(f => path(f));
 *     ctx.fillStyle = C.land; ctx.fill();
 *
 * Three facts follow, and all three are implemented rather than approximated:
 *
 *   TEN DEGREES. `geoGraticule10` is d3's 10° grid. Measured independently on
 *   the golden world capture: regular meridians at 33 px over the map pane,
 *   which is a 10° interval at that frame's scale.
 *
 *   UNDER THE LAND, OVER THE OCEAN. It is stroked AFTER the ocean fill and
 *   BEFORE the land base, so land covers it. That is why the measurement found
 *   the grid in open ocean and lost it across South America — and it is why
 *   this layer is inserted directly above the background and beneath
 *   `LAND_LAYER_ID`, not on top of the map.
 *
 *   0.6 px, FLAT. `ctx.lineWidth = .6` with no zoom ramp, which is exactly what
 *   `DESIGN_REFERENCE_WIDTH.graticule` already says: base .6, perZoom 0, cap .6.
 *
 * ── THE THREE THINGS IT MAY NEVER DO ────────────────────────────────────────
 *
 * Ruling D-2's constraints on reference geography hold here by construction,
 * and more strongly than for the bundled files:
 *
 *   NO NETWORK      There is no dataset. The lines are computed from two
 *                   integer loops, in the browser, with no fetch of any kind.
 *   NEVER EVIDENCE  Nothing here reaches the evidence feed or any count.
 *   NEVER PRECISION A meridian carries no id, no provenance and no precision,
 *                   so `precisionModel` has nothing to read from it.
 *
 * ── WHY A GEOJSON SOURCE AND NOT A CAMERA-DERIVED OVERLAY ───────────────────
 *
 * The registry's note says "generated from the camera". A camera-derived grid
 * has to be rebuilt on every pan and zoom, and it is the kind of code that
 * quietly disagrees with the projection at the edges. A fixed graticule in
 * world coordinates is projected by the same engine that projects the
 * coastline, so the grid and the geography cannot drift apart — and it is
 * computed once, at module scope, rather than per frame.
 */

/** d3's `geoGraticule10` step, in degrees. */
export const GRATICULE_STEP_DEGREES = 10;

/**
 * How far the minor lines run toward the poles.
 *
 * d3's own minor extent stops at ±80°, and Web Mercator cannot show beyond
 * ±85.05 in any case. Stopping at 80 keeps the top and bottom of the frame
 * from filling with meridians converging on a point the projection never
 * reaches.
 */
export const GRATICULE_LATITUDE_LIMIT = 80;

/**
 * Vertices are emitted every `GRATICULE_STEP_DEGREES` along each line rather
 * than only at its ends.
 *
 * A meridian is straight in Mercator and a parallel is horizontal, so two
 * points would be geometrically sufficient — but MapLibre applies its own
 * subdivision and clipping to long segments, and a densified line behaves
 * identically at every zoom and across the antimeridian split. The cost is a
 * few hundred coordinates, computed once.
 */
function densify(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  for (let value = from; value < to; value += step) out.push(value);
  out.push(to);
  return out;
}

/**
 * The 10° graticule, in world coordinates.
 *
 * Deliberately a MultiLineString in ONE feature: the grid is a single piece of
 * reference furniture, not 53 individually meaningful lines, and one feature
 * means one draw call and nothing a click handler could ever resolve to.
 *
 * THE ANTIMERIDIAN IS NOT DUPLICATED. Meridians run from -180 up to but not
 * including +180, because with `renderWorldCopies: false` the two are the same
 * line on the one painted world and drawing both would double its weight.
 */
export function buildGraticule(): FeatureCollection<MultiLineString> {
  const lines: number[][][] = [];

  for (let lon = -180; lon < 180; lon += GRATICULE_STEP_DEGREES) {
    lines.push(
      densify(-GRATICULE_LATITUDE_LIMIT, GRATICULE_LATITUDE_LIMIT, GRATICULE_STEP_DEGREES).map(
        (lat) => [lon, lat],
      ),
    );
  }

  for (let lat = -GRATICULE_LATITUDE_LIMIT; lat <= GRATICULE_LATITUDE_LIMIT; lat += GRATICULE_STEP_DEGREES) {
    lines.push(densify(-180, 180, GRATICULE_STEP_DEGREES).map((lon) => [lon, lat]));
  }

  return {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: lines } }],
  };
}

/**
 * ══ THE SUPPORTED-ZOOM CONTRACT — R2-B §8 ═════════════════════════════════
 *
 * MAP-GRID-RENDERING
 *
 * THE REPORT: "GRID clicked; no change." THE FINDING: nothing is broken. The
 * source exists, the layer exists, `apply(GRATICULE_LAYER_ID, …)` sets its
 * visibility, and the toggle has worked since the R1 correction. The grid was
 * drawing exactly where this file says it draws — and that is nowhere a reader
 * looking at a country can see it.
 *
 * THREE FACTS COMPOUND, AND ALL THREE ARE DELIBERATE:
 *
 *   IT IS UNDER THE LAND. Stroked after the ocean fill and before the land
 *   base, because that is the prototype's draw order and what the golden world
 *   frame shows. So it reads across open water and is COVERED BY LAND. A
 *   reader zoomed to Kenya, Rwanda or Poland is looking at a viewport that is
 *   almost entirely land, and there is nothing for the grid to show through.
 *
 *   THE CELL IS BIGGER THAN THE VIEW. At 10°, a cell is about 1,100 km. Past
 *   the zoom computed below, a typical viewport fits INSIDE one cell and
 *   contains no line at all — so the layer is visible, painting correctly, and
 *   has nothing in frame to paint.
 *
 *   IT IS 7.5% ALPHA AT 0.6 px. Subtle by design — v1.5 raised it from 5%
 *   precisely so it would clear the noise floor — but never assertive.
 *
 * ── WHAT IS NOT CHANGED, AND WHY ──────────────────────────────────────────
 *
 * None of the three. The draw order is C907 §4 and is measured against the
 * golden frame; the 10° step is d3's `geoGraticule10` and was confirmed
 * independently at 33 px per meridian on the golden capture; the colour and
 * width are design tokens. Moving the grid above the land, tightening the step
 * or raising the alpha would each change governed geometry to fix a reporting
 * problem, and would make the map disagree with the reference it was measured
 * against.
 *
 * So the contract is DECLARED rather than the geometry adjusted: the product
 * states where this layer can be seen, and the rail tells the reader when they
 * are outside it instead of leaving them clicking a control that cannot
 * answer.
 */

/**
 * The zoom past which a viewport can contain NO graticule line.
 *
 * Derived, not chosen. Web Mercator shows `360 / 2^zoom` degrees across a
 * 512 px tile, so a viewport of `w` pixels spans
 *
 *     degrees = 360 · w / (512 · 2^zoom)
 *
 * and at least one line is guaranteed in frame only while `degrees >= 10`.
 * For a 1000 px map pane — the desktop canvas after the layer rail and the
 * right rail are taken out of a 1440 px window — that gives
 *
 *     2^zoom <= 360 · 1000 / (512 · 10) = 70.3      zoom <= 6.13
 *
 * Rounded DOWN to 6, because the guarantee has to hold at the stated value
 * rather than near it.
 *
 * It is a GUARANTEE THRESHOLD, not a cut-off. Above it a line may still be in
 * view — the reader may simply be near one — and the layer is never disabled
 * or hidden on account of zoom. Nothing here changes what is drawn.
 */
export const GRATICULE_GUARANTEED_ZOOM = 6;

/** The reference pane width the threshold above is computed for. */
export const GRATICULE_REFERENCE_PANE_PX = 1000;

/**
 * Degrees of longitude across a map pane at a given zoom.
 *
 * Exported so the threshold can be re-derived by a test rather than restated
 * by one. A constant a spec merely repeats back is a constant nothing checks.
 */
export function graticuleDegreesAcross(zoom: number, panePx: number): number {
  return (360 * panePx) / (512 * 2 ** zoom);
}

/**
 * Whether a line is GUARANTEED to be in frame at this zoom.
 *
 * `false` does not mean the grid is off or broken. It means the product
 * cannot promise the reader will see it, which is exactly the sentence the
 * rail needs in order to stop a working control from reading as a dead one.
 */
export function graticuleGuaranteedAtZoom(
  zoom: number,
  panePx: number = GRATICULE_REFERENCE_PANE_PX,
): boolean {
  return graticuleDegreesAcross(zoom, panePx) >= GRATICULE_STEP_DEGREES;
}

export const GRATICULE_SOURCE_ID = 'gn-graticule';
export const GRATICULE_LAYER_ID = 'gn-graticule-line';

/** The rail control that owns it — `GRID` in `LayerToggleRail`. */
export const GRATICULE_RAIL_KEY = 'graticule';

/**
 * Paint, read from the tokens rather than restated. `rgba(126,166,186,.075)`
 * is v1.5's lift from 5% — "the graticule was below the noise floor of the old
 * land" — and MapLibre takes the colour and the opacity together in one rgba
 * string exactly as the prototype's `strokeStyle` does.
 */
export const GRATICULE_PAINT = {
  'line-color': DESIGN_REFERENCE.graticule,
  'line-width': DESIGN_REFERENCE_WIDTH.graticule.base,
} as const;
