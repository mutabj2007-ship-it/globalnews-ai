import type { Bounds, CameraState } from '@/lib/map/camera/cameraState';
import { isDeclaredProductRegion } from '@/lib/map/region/declaredProductRegions';

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
  /**
   * C911-V2 -- the country this target IS, when it is one.
   *
   * A jump target used to carry bounds and nothing else, so a jump could only
   * ever move a camera. That is why selecting RWANDA from JUMP TO VALIDATION
   * STATE moved the viewport and left the intelligence rail describing Poland:
   * there was no identity in the target for the shell to select.
   *
   * Present ONLY on COUNTRY-rung targets. A supranational region is not a
   * selectable evidence geography -- the accepted rule the search path already
   * states -- so 'world', 'africa', 'eastAfrica' and 'europe' deliberately
   * carry no identity, and neither does the city rung.
   *
   * THIS IS NOT A GEOGRAPHY TABLE. It is the ISO-3 of a country this table
   * already names and already carries real bounds for; the canonical country
   * record still lives in COUNTRIES and is resolved from this id by the single
   * selection handler, exactly as a map click is.
   */
  readonly countryIso3?: string;

  /**
   * ══ MAP-REGION-STATE-PRESENTATION-1 — THE GOVERNED REGION THIS TARGET IS ══
   *
   * The same repair `countryIso3` made, one rung up, for the same measured
   * reason: a jump target carried bounds and nothing else, so a jump could only
   * ever move a camera. East Africa flew the viewport, wrote `cam=` alone, and
   * left the right rail reading World.
   *
   * WHY THE COMMENT ABOVE SAYS `eastAfrica` CARRIES NO IDENTITY, AND WHY THAT
   * IS NO LONGER THE WHOLE STORY. The rule it rests on — "a supranational
   * region is not a selectable evidence geography" — STILL STANDS. This id does
   * not make East Africa an evidence geography, nothing aggregates member
   * evidence because of it, and the regional rail card remains the one that
   * refuses to answer "what is retained HERE?".
   *
   * What changed is that the product now GOVERNS a region by this name.
   * `declaredProductRegions.ts` publishes `region:east-africa` with an approved
   * membership and a named authority, so binding to it is not minting an
   * identity from a label key — the alias trap RSC-1 warns about — it is naming
   * one the Product Owner already declared.
   *
   * ONLY A DECLARED PRODUCT REGION MAY APPEAR HERE, and that is enforced rather
   * than asked for: `assertGovernedJumpRegions()` refuses anything else, so a
   * future target cannot acquire a region identity merely by being written next
   * to one that has it.
   */
  readonly regionId?: string;
}

/**
 * The governed product region `eastAfrica` names. Declared as a named constant
 * so the id cannot drift from the declaration that owns its membership, and so
 * a reader of the table below sees a bound identity rather than a bare string.
 */
export const GOVERNED_EAST_AFRICA_ID = 'region:east-africa';

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
  /*
    THE ONE TARGET WITH A GOVERNED IDENTITY. The bounds are UNCHANGED — this is
    not a re-framing, and §10 protects the existing East Africa camera move —
    and `regionId` is what makes the jump establish scope rather than only
    moving the viewport.
  */
  {
    id: 'eastAfrica',
    rung: 'SUBREGION',
    bounds: [28.8, -11.8, 42, 5.5],
    regionId: GOVERNED_EAST_AFRICA_ID,
  },
  { id: 'europe', rung: 'CONTINENT', bounds: [-11, 35, 40, 71] },
  { id: 'rwanda', rung: 'COUNTRY', bounds: [28.86, -2.84, 30.9, -1.05], countryIso3: 'RWA' },
  { id: 'kenya', rung: 'COUNTRY', bounds: [33.9, -4.7, 41.9, 5.5], countryIso3: 'KEN' },
  { id: 'poland', rung: 'COUNTRY', bounds: [14.12, 49, 24.15, 54.84], countryIso3: 'POL' },
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

/**
 * EVERY `regionId` IN THE TABLE IS A DECLARED PRODUCT REGION — CHECKED, NOT ASKED.
 *
 * RSC-1's alias trap is that a plausible-looking region id gets minted from a
 * label key and then travels through the URL as though a gazetteer held it.
 * This refuses that at the source: a jump target may only name a region the
 * product has actually declared, with a membership and an authority behind it.
 *
 * Returns the offending entries rather than throwing, so a spec can assert on
 * an empty list and a failure names what is wrong instead of crashing an
 * import that half the map depends on.
 */
/**
 * The camera frame the deployment already publishes for a governed region.
 *
 * A CAMERA TARGET, NOT A BOUNDARY. These are the same bounds the jump has
 * always flown to, so using them as the region's extent asserts nothing new —
 * the regional card continues to state separately that no regional boundary is
 * drawn, because none is. `null` for any id the table does not name, so a
 * region without published bounds is not framed.
 */
export function governedRegionExtent(regionId: string): Bounds | null {
  const target = DEPLOYMENT_JUMP_TARGETS.find((candidate) => candidate.regionId === regionId);

  return target?.bounds ?? null;
}

/**
 * ══ MAP-PL-ACTIVE-REGION-LABEL-1 — THE DICTIONARY KEY FOR A GOVERNED REGION ══
 *
 * A declared product region carries a `label` ("East Africa"), and that label
 * is DATA: it names the region in the declaration that owns its membership, in
 * one language. It is not display copy, and rendering it to a Polish reader is
 * how "EAST AFRICA" appeared on the active chip while the secondary control
 * beside it read "AFRYKA WSCHODNIA".
 *
 * Every string a reader sees comes from the dictionary keyed by jump-target id
 * — the rule this table's own header states — and the PL dictionary already
 * holds `eastAfrica: 'Afryka Wschodnia'`. This returns that key so the surface
 * can look the name up instead of printing the declaration's.
 *
 * `null` when no jump target names the region, in which case the caller keeps
 * whatever G published. Nothing is invented and no translation is performed
 * here; this only says WHICH key to read.
 */
export function governedRegionLabelKey(regionId: string): string | null {
  return DEPLOYMENT_JUMP_TARGETS.find((target) => target.regionId === regionId)?.id ?? null;
}

export function assertGovernedJumpRegions(
  targets: readonly JumpTarget[] = DEPLOYMENT_JUMP_TARGETS,
): readonly string[] {
  return targets
    .filter((target) => target.regionId !== undefined && !isDeclaredProductRegion(target.regionId))
    .map((target) => `${target.id} -> ${String(target.regionId)}`);
}
