/**
 * SPATIAL M1a — GEOMETRY DENSITY.
 *
 * How much boundary detail a surface draws. It is a RENDERING budget and
 * nothing else: density never changes which countries are evidence, never
 * changes what may be asserted about them, and never appears in a precision
 * calculation. A denser outline is a smoother edge, not a stronger claim.
 *
 * THE WORLD MAP IS FULL. It is the dedicated, full-viewport geographic
 * surface — the one place where the whole point is the map — so it draws every
 * country the registry knows at the full detail the local geometry boundary
 * provides. The compact surfaces inside Analysis are deliberately not touched
 * by this milestone and keep their own behaviour.
 */

export type GeometryDensity = 'full' | 'compact';

export const WORLD_MAP_DENSITY: GeometryDensity = 'full';

export interface DensityBudget {
  /** Every country in the registry, or only those a surface was given. */
  readonly includesAllCountries: boolean;
  /** Outline width in px at the base zoom. */
  readonly outlineWidth: number;
  /** Fill opacity for an un-highlighted country. */
  readonly baseFillOpacity: number;
}

/*
  THE RESTING VALUES, TAKEN FROM WHAT THE EXISTING MAP ACTUALLY SHOWS.

  `WorldMap.tsx` declares `fill-opacity: 0.1` in its style and then immediately
  overrides it with a data-driven expression whose no-stories step is 0.05. So
  0.1 is a value the legacy map holds for one frame and 0.05 is the one a user
  ever sees.

  My first cut copied the 0.1 literal, and the browser acceptance run showed
  why that matters: at 0.1 the world picked up visible rectangular bands that
  the legacy map does not show. They are pre-existing artefacts of
  antimeridian-crossing polygons in the shared `countryGeometry` boundary —
  compounded fills that 0.05 keeps below the visible threshold and 0.1 does
  not. The geometry is not this milestone's to change, and brightening the
  surface until a latent artefact surfaces is not a foundation. Matched to the
  resting value instead, and the artefact is reported.
*/
const BUDGETS: Readonly<Record<GeometryDensity, DensityBudget>> = {
  full: { includesAllCountries: true, outlineWidth: 0.6, baseFillOpacity: 0.05 },
  compact: { includesAllCountries: false, outlineWidth: 1, baseFillOpacity: 0.04 },
};

export function densityBudget(density: GeometryDensity): DensityBudget {
  return BUDGETS[density] ?? BUDGETS.compact;
}
