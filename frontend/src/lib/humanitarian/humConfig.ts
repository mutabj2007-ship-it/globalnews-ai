/**
 * PART X · HUMANITARIAN — GEOMETRY AND CAPS, READ OFF THE FROZEN REGISTERS.
 *
 * Every number here is quoted from R13 or R14. None was chosen by this lane.
 *
 * A DETENT COLLISION I AM NOT RESOLVING. Two accepted authorities already carry
 * different detent tables — `MobileBottomSheet` (PEEK 148px, HALF 0.52, FULL 0.74)
 * and `ECONOMY_SHEET_DETENTS` (PEEK 180px, HALF 55%). A third would be drift, so
 * these values are bound to PART X'S OWN R14 text and the collision is REPORTED for
 * a ruling rather than settled here.
 */

/** R13: "attention queue capped at 5 rows with surplus routed to a drawer". */
export const HUM_QUEUE_CAP = 5;

/** R13: "context rail capped at 336px and never grows". */
export const HUM_RAIL_PX = 336;

/** R14: "Rail narrows to 288px" at 1280. */
export const HUM_RAIL_NARROW_PX = 288;

/** R14 viewport family. 1512 is the reference for all ten drawn states. */
export const HUM_VIEWPORTS = { phoneMin: 375, phoneRef: 390, phoneMax: 430, laptop: 1280, reference: 1512, wide: 1920 } as const;

/** R14: "Minimum interactive height 44px." */
export const HUM_HIT_TARGET_PX = 44;

/** R14: "Smallest runtime type 10.5px mono metadata and 12.5px sans body." */
export const HUM_TYPE_FLOOR = { monoPx: 10.5, bodyPx: 12.5 } as const;

/**
 * R14: "No map below a HALF detent." Enforced by the shell, not by CSS — a slot that
 * is not mounted cannot be revealed by a stylesheet edit.
 */
export const HUM_MAP_MIN_DETENT = 'HALF' as const;

/** R14 phone detents, bound to Part X's own text. See the collision note above. */
export const HUM_DETENT_GEOMETRY = { peekPx: 148, halfFraction: 0.52, fullFraction: 0.9 } as const;

/** R13: surplus width at 1920 becomes comparison columns inside zone C, never a fifth region. */
export const HUM_ZONE_COUNT = 4;
