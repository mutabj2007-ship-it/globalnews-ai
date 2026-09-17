import type { SpecialistDomainId } from '@/lib/specialist/specialistDomain';

/**
 * THE SPECIALIST HUD GRAMMAR — SEVEN ORDERED SLOTS, ONE 30px LINE.
 *
 *     authority  Shared Specialist Addendum §02
 *                71646a05b4055ec547527b22cae68bd2ecc50d054370d0db91b3bd350fdd2ff5
 *
 * "Seven ordered slots on one 30px line. The order is fixed product-wide so the
 * eye learns position rather than label. A domain with nothing for a slot
 * COLLAPSES it; no slot is ever filled with decoration. Growth goes to popup,
 * rail and workspace — never to HUD height."
 *
 * §21 forbids "an eighth HUD slot, or a second HUD line". Both are unrepresentable
 * here rather than merely discouraged: the slot order is a frozen tuple and the
 * renderer maps over it.
 *
 * ── WHERE THE LINE LIVES, AND WHY IT COSTS NO CHROME ──────────────────────
 *
 * §02, verbatim: "THE HUD LINE IS DRAWN INSIDE THE MAP CANVAS ON DESKTOP AND
 * INSIDE THE PEEK DETENT ON COMPACT, SO IT ADDS NO CHROME HEIGHT ON EITHER."
 *
 * That sentence is the whole reason a seventh slot is affordable. The compact
 * budget is already fully spent — see `COMPACT_CHROME_HARD_MAX` — so a
 * specialist line that added height would have to take it from the map.
 *
 * ── THE FIGURE THAT CHANGED, AND WHICH ONE GOVERNS ────────────────────────
 *
 * Part V §08 states compact fixed chrome as 46px top bar + 32px precision
 * banner = 78px. The Addendum's authority README lists that figure under
 * "Superseded — do not build from": "The compact chrome figure 46 + 32 = 78px —
 * corrected to 52 + 30 = 82px HARD MAX." Part IV R2 §16.2 is the source of the
 * cap and is unchanged, and the implementation already builds 52 + 30. So the
 * correction closes a documentation drift rather than moving a pixel.
 */

export const HUD_SLOTS = [
  'MODE',
  'STATE',
  'PRIMARY_MEASURE',
  'CHANGE',
  'SCOPE',
  'CONFIDENCE',
  'WATCH',
] as const;

export type HudSlot = (typeof HUD_SLOTS)[number];

/** §02. Inherited from Part IV §16.2 and NOT superseded by any specialist figure. */
export const COMPACT_TOP_BAR_PX = 52;
export const COMPACT_CHANGE_STRIP_PX = 30;
export const COMPACT_CHROME_HARD_MAX = COMPACT_TOP_BAR_PX + COMPACT_CHANGE_STRIP_PX;

/** The line's own height, wherever it is drawn. It is never chrome. */
export const HUD_LINE_PX = 30;

export interface HudSlotValue {
  /** The rendered text. An EMPTY value collapses the slot — it is never padded. */
  readonly value: string;
  /** Optional short qualifier rendered at reduced weight beside the value. */
  readonly qualifier?: string;
  /**
   * The amber rung, where the slot carries one — Part V C·4 / Addendum §02.
   * `null` for every slot that is not expressing change or lateness.
   */
  readonly amber?: 'PRIMARY' | 'SECONDARY' | 'TERTIARY' | null;
}

export type HudLine = Readonly<Partial<Record<HudSlot, HudSlotValue>>>;

/**
 * The slots that will actually render, in the frozen order, with empties
 * dropped.
 *
 * A domain that has nothing for CHANGE gets six cells, not five cells and a
 * dash. "No slot is ever filled with decoration" — so the collapse happens
 * here, once, rather than in each domain's configuration.
 */
export function renderableSlots(line: HudLine): readonly (readonly [HudSlot, HudSlotValue])[] {
  return HUD_SLOTS.map((slot) => [slot, line[slot]] as const).filter(
    (entry): entry is readonly [HudSlot, HudSlotValue] =>
      entry[1] !== undefined && entry[1].value.trim().length > 0,
  );
}

/**
 * A HUD line is well-formed when it introduces no slot the grammar does not
 * have. Exported so a domain's configuration can be asserted at test time
 * rather than discovered on screen.
 */
export function hudLineIsWellFormed(line: Readonly<Record<string, unknown>>): boolean {
  return Object.keys(line).every((key) => (HUD_SLOTS as readonly string[]).includes(key));
}

/**
 * MODE is the active lens and is always the first slot. Supplied by the
 * platform rather than by the domain, so a domain cannot rename its own lens
 * in the one position the eye uses to orient.
 */
export function modeSlot(_domain: SpecialistDomainId, label: string): HudLine {
  return { MODE: { value: label, amber: null } };
}
