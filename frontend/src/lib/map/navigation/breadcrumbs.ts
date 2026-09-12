import type { Bounds, CameraState } from '@/lib/map/camera/cameraState';

/**
 * SPATIAL M2 — THE BREADCRUMB SCALE LADDER, FROM DESIGN PART I §E.
 *
 * "World / Africa / East Africa / Rwanda / Kigali, plus validation jumps.
 * Highlights the scale the camera is currently inside, so the user always
 * knows where they are in the hierarchy."
 *
 * TWO SEPARATE THINGS, DELIBERATELY NOT ONE. The ladder is a SCALE indicator
 * derived from zoom alone — it says how far in the camera is, not what it is
 * looking at. The jumps are configured DESTINATIONS. Conflating them would
 * produce the familiar map-UI lie where a breadcrumb reads "Rwanda" because
 * the zoom is high, while the camera is over the Pacific.
 *
 * NOTHING HERE MOVES THE CAMERA. `activeScale` reads one; a jump returns
 * bounds for the shell to turn into a `focus` intent. Part II §3: "Search and
 * breadcrumbs call focus. Nothing else may animate the camera."
 */

/** Coarse to fine. The rungs the spec names. */
export type ScaleRung = 'WORLD' | 'CONTINENT' | 'SUBREGION' | 'COUNTRY' | 'CITY';

export const SCALE_RUNGS: readonly ScaleRung[] = [
  'WORLD',
  'CONTINENT',
  'SUBREGION',
  'COUNTRY',
  'CITY',
];

/**
 * The zoom at which each rung becomes the one the camera is "inside".
 *
 * Chosen against the layer zoom ranges in Part I §F rather than invented:
 * admin-1 reference geography appears at Z6 and admin-2 at Z8, so Z6 is where
 * a viewport has stopped being a country view and become a sub-country one.
 */
export const RUNG_MIN_ZOOM: Readonly<Record<ScaleRung, number>> = {
  WORLD: 0,
  CONTINENT: 2.2,
  SUBREGION: 3.6,
  COUNTRY: 5,
  CITY: 8,
};

export function activeScale(camera: CameraState): ScaleRung {
  let active: ScaleRung = 'WORLD';

  for (const rung of SCALE_RUNGS) {
    if (camera.zoom >= RUNG_MIN_ZOOM[rung]) active = rung;
  }

  return active;
}

/** Whether a rung is at or above the camera's current scale. */
export function isScaleReached(rung: ScaleRung, camera: CameraState): boolean {
  return SCALE_RUNGS.indexOf(rung) <= SCALE_RUNGS.indexOf(activeScale(camera));
}

/**
 * A configured destination. Part I §E calls these "validation jumps" — the
 * regions a deployment is actually about.
 *
 * `bounds` is real geography from a gazetteer, never derived from the evidence
 * currently on screen. A jump target that moved with the data would make the
 * ladder a summary of the query rather than a map of the world.
 */
export interface JumpTarget {
  readonly id: string;
  readonly rung: ScaleRung;
  readonly bounds: Bounds;
}

/**
 * The deployment's jump targets.
 *
 * Rwanda, Kenya and Poland are the three regions Part II §8 question 6 names
 * as the programme's validation regions, plus their containing scales. Bounds
 * are the countries' real extents.
 *
 * NO LABELS HERE. Every string a reader sees comes from the dictionary, keyed
 * by `id`, so this table cannot become a second place English lives.
 */
export const DEPLOYMENT_JUMP_TARGETS: readonly JumpTarget[] = [
  { id: 'world', rung: 'WORLD', bounds: [-180, -60, 180, 78] },
  { id: 'africa', rung: 'CONTINENT', bounds: [-18, -35, 52, 37] },
  { id: 'eastAfrica', rung: 'SUBREGION', bounds: [28.8, -11.8, 42, 5.5] },
  { id: 'europe', rung: 'CONTINENT', bounds: [-11, 35, 40, 71] },
  { id: 'rwanda', rung: 'COUNTRY', bounds: [28.86, -2.84, 30.9, -1.05] },
  { id: 'kenya', rung: 'COUNTRY', bounds: [33.9, -4.7, 41.9, 5.5] },
  { id: 'poland', rung: 'COUNTRY', bounds: [14.12, 49, 24.15, 54.84] },
  /*
    KIGALI — the CITY rung, added under the PO's golden-frame correction.

    The golden chip row ends `… RWANDA · KIGALI`, and without a city-rung
    target the ladder's last rung was reachable only by free zooming. These
    bounds are the city's real extent, not a point with a padding box invented
    around it, and Kigali is the capital of the deployment's primary validation
    country — so this is a supported validation destination, not the decorative
    state the same ruling forbids.
  */
  { id: 'kigali', rung: 'CITY', bounds: [29.98, -2.05, 30.2, -1.87] },
];

/**
 * THE VALIDATION STATES — the subset the intelligence rail offers.
 *
 * PO ruling: *"Restore JUMP TO VALIDATION STATE only for actual supported
 * validation states. Do not create decorative states."*
 *
 * These four are the deployment's actual validation regions: the three
 * countries Part II §8 question 6 names, plus the declared product region that
 * contains the primary one. `world`, `africa`, `europe` and `kigali` are
 * NAVIGATION — they move the camera and they belong in the breadcrumb row —
 * but nobody validates the product against "the world", so offering them here
 * would be exactly the decorative state the ruling forbids.
 *
 * It is an ordered subset of `DEPLOYMENT_JUMP_TARGETS`, never a second table,
 * so a validation state cannot exist here without real bounds.
 */
export const VALIDATION_STATE_IDS: readonly string[] = ['rwanda', 'eastAfrica', 'kenya', 'poland'];

export function validationStates(): readonly JumpTarget[] {
  return VALIDATION_STATE_IDS.map((id) =>
    DEPLOYMENT_JUMP_TARGETS.find((target) => target.id === id),
  ).filter((target): target is JumpTarget => target !== undefined);
}

export function jumpTargetById(id: string): JumpTarget | undefined {
  return DEPLOYMENT_JUMP_TARGETS.find((target) => target.id === id);
}

/** The ladder to render: one entry per rung, marked with whether it is reached. */
export interface BreadcrumbRung {
  readonly rung: ScaleRung;
  readonly reached: boolean;
  readonly active: boolean;
}

export function breadcrumbLadder(camera: CameraState): readonly BreadcrumbRung[] {
  const active = activeScale(camera);

  return SCALE_RUNGS.map((rung) => ({
    rung,
    reached: SCALE_RUNGS.indexOf(rung) <= SCALE_RUNGS.indexOf(active),
    active: rung === active,
  }));
}
