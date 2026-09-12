import { COUNTRIES } from '@globalnews-ai/shared';
import { computeFeatureBounds, getCountryFeatureCollection } from '@/lib/map/countryGeometry';
import type { Bounds, CameraState } from '@/lib/map/camera/cameraState';

/**
 * SPATIAL M1a.1 — COVERAGE PAINT AND SELECTION CAMERA, ENGINE-FREE.
 *
 * The shell must look and behave exactly like the accepted World Map. The way
 * to guarantee that is not to re-derive the design — it is to LIFT the legacy
 * expressions out of `WorldMap.tsx` unchanged and put them somewhere both a
 * test and the canvas can read.
 *
 * EVERY NUMBER AND COLOUR BELOW IS COPIED, NOT CHOSEN. The step thresholds
 * (1/4/8/13), the heat ramp, the selected treatment (#22d3ee at 0.82, outline
 * #a5f3fc at 2.4) and the four antimeridian views are the legacy values
 * verbatim. `coveragePaint.spec.ts` re-reads `WorldMap.tsx` and asserts they
 * still match, so parity cannot rot silently on either side.
 *
 * WHY IT IS A MODULE AND NOT A COPY INSIDE THE CANVAS. These are MapLibre
 * expression ARRAYS — plain data. Keeping them out of the engine wrapper means
 * the coverage semantics are unit-testable with no browser, and the canvas
 * stays a thin applier rather than a second place design decisions live.
 */

export type PaintExpression = unknown;

export function isoToNumeric(iso3: string | null | undefined): string {
  if (!iso3) return '';

  return COUNTRIES.find((c) => c.iso3 === iso3)?.isoNumeric ?? '';
}

/**
 * The count input for the step ramps.
 *
 * H-C2 fix, preserved: a `match` needs at least one label/output pair, and an
 * empty count set collapses it to a degenerate expression MapLibre rejects.
 * An empty set already means "every country is zero", so the honest input is
 * the constant 0.
 */
export function countMatchExpression(countryStoryCounts: Record<string, number>): PaintExpression {
  const pairs: unknown[] = [];

  for (const [iso3, storyCount] of Object.entries(countryStoryCounts)) {
    const numericId = isoToNumeric(iso3);

    if (numericId) pairs.push(numericId, storyCount);
  }

  return pairs.length > 0 ? ['match', ['get', 'numericId'], ...pairs, 0] : 0;
}

const selectedCase = (selectedNumeric: string, whenSelected: unknown, otherwise: unknown): PaintExpression => [
  'case',
  ['==', ['get', 'numericId'], selectedNumeric],
  whenSelected,
  otherwise,
];

export interface CoveragePaint {
  readonly fillColor: PaintExpression;
  readonly fillOpacity: PaintExpression;
  readonly lineColor: PaintExpression;
  readonly lineWidth: PaintExpression;
}

export function coveragePaint(
  countryStoryCounts: Record<string, number>,
  selectedIso3: string | null,
): CoveragePaint {
  const counts = countMatchExpression(countryStoryCounts);
  const selected = isoToNumeric(selectedIso3);

  return {
    fillColor: selectedCase(selected, '#22d3ee', [
      'step', counts, '#0f1726', 1, '#17284a', 4, '#203e73', 8, '#2b5191', 13, '#3a65b5',
    ]),
    fillOpacity: selectedCase(selected, 0.82, [
      'step', counts, 0.05, 1, 0.16, 4, 0.23, 8, 0.31, 13, 0.4,
    ]),
    lineColor: selectedCase(selected, '#a5f3fc', [
      'step', counts, '#202b3e', 1, '#2a3b58', 4, '#35517c', 8, '#476da5', 13, '#5c83c7',
    ]),
    lineWidth: selectedCase(selected, 2.4, [
      'step', counts, 0.55, 1, 0.65, 4, 0.75, 8, 0.85, 13, 0.95,
    ]),
  };
}

/**
 * Countries whose raw bounding box spans nearly the whole world because their
 * geometry crosses ±180. Legacy uses a controlled view rather than fitBounds
 * for exactly these four; the same four, with the same numbers.
 */
export const ANTIMERIDIAN_VIEWS: Readonly<Record<string, { center: [number, number]; zoom: number }>> = {
  RUS: { center: [90, 61], zoom: 2.1 },
  FJI: { center: [178, -17.8], zoom: 4.4 },
  KIR: { center: [-157, 1.8], zoom: 3.2 },
  NZL: { center: [172, -41], zoom: 3.3 },
};

/** Legacy `fitBounds` padding and ceiling, preserved. */
export const SELECTION_FIT_PADDING = 70;
export const SELECTION_MAX_ZOOM = 5;

export type SelectionCamera =
  | { readonly kind: 'camera'; readonly camera: CameraState }
  | { readonly kind: 'bounds'; readonly bounds: Bounds }
  | null;

/**
 * Where the camera should go when a country is selected.
 *
 * Returns an INTENT INPUT, not a map call. That is the M1a.1 difference worth
 * naming: legacy called `fitBounds` straight on the engine, so a selection
 * moved the view without the camera history knowing, and "Previous View" could
 * not undo it. Here selection produces a camera the reducer commits like any
 * other move — so parity gains history rather than bypassing it, and every
 * M1a camera behaviour is preserved rather than worked around.
 *
 * `null` means the geometry is unknown and NOTHING should move. A selection
 * whose country we cannot place is not a reason to guess at a camera.
 */
export function selectionCameraFor(selectedIso3: string | null): SelectionCamera {
  if (!selectedIso3) return null;

  const special = ANTIMERIDIAN_VIEWS[selectedIso3];

  if (special !== undefined) {
    return { kind: 'camera', camera: { center: special.center, zoom: special.zoom, bearing: 0, pitch: 0 } };
  }

  const feature = getCountryFeatureCollection().features.find(
    (f) => f.properties.country?.iso3 === selectedIso3,
  );

  if (feature === undefined) return null;

  const bounds = computeFeatureBounds(feature);

  if (bounds === null) return null;

  /*
    FLATTENED, NOT CAST.
    `computeFeatureBounds` returns MapLibre's nested corner form
    `[[west, south], [east, north]]`; `Bounds` is the flat
    `[west, south, east, north]` the engine-free camera core uses. My first
    cut wrote `bounds as unknown as Bounds`, which compiled and was wrong —
    every consumer would have read a pair of arrays as four numbers. The spec
    caught it. A cast between two shapes that genuinely differ is a lie to the
    type system, so the conversion is done rather than asserted.
  */
  const [[west, south], [east, north]] = bounds;

  return { kind: 'bounds', bounds: [west, south, east, north] };
}
