/**
 * MY INTELLIGENCE — FROZEN PRESENTATION TOKENS (R1.2)
 *
 * Every value here is transcribed from the frozen design authority
 * `MY-INTELLIGENCE-R1.2-DESIGN-AUTHORITY/COMPONENTS_AND_TOKENS.md`, which the
 * Product Owner approved and froze. This module exists so that the frozen
 * values live in ONE auditable file rather than being scattered across a dozen
 * components where a later edit could drift from the authority unnoticed.
 *
 * TWO VALUES ARE DEFINED BY THEIR ABSENCE, AND THAT IS THE POINT.
 *
 *   mint   #5BE3A8  Part IV reserves filled mint for an ACTIVE WATCH, and
 *                   Watch runtime is inactive on Beta
 *                   (`WATCH_RUNTIME_ACTIVE = false`, two source constants).
 *                   It therefore must not appear anywhere on this surface.
 *   violet #8C86EE  Part IV reserves tier violet for a PAID TIER BOUNDARY.
 *                   R1.2 draws no tier boundary, so it must not appear either.
 *
 * They are exported as names so that a test can assert no component string
 * contains them, rather than as values anyone is invited to use. Nothing in
 * this directory may reference FORBIDDEN_* except that test.
 */

/** Part IV: filled mint means an active Watch. Watch is inactive. Never render. */
export const FORBIDDEN_WATCH_MINT = '#5BE3A8';
/** Part IV: tier violet marks a paid boundary. R1.2 draws none. Never render. */
export const FORBIDDEN_TIER_VIOLET = '#8C86EE';

/** Page background. */
export const MI_PAGE = 'bg-[#010a19]';

/** Section/story card surface. */
export const MI_CARD =
  'rounded-[12px] border border-[#0e2d4d] ' +
  'bg-[linear-gradient(to_bottom,#082038_0%,#041a30_46%,#02152b_100%)]';

/** Rail surface: Saved / For you / Following sections. */
export const MI_RAIL =
  'rounded-[12px] border border-[#0e2d4d] ' +
  'bg-[linear-gradient(to_bottom,#06192f,#041426)]';

/** Ask surface: Recent intelligence. */
export const MI_ASK_SURFACE =
  'rounded-[12px] border border-[#0e2d4d] ' +
  'bg-[linear-gradient(to_bottom,#04162b,#020f20)]';

export const MI_DIVIDER = 'border-[#0a2744]';

/** Brand accent. Saved-on, selected, links. NOT mint — this is the Home cyan. */
export const MI_ACCENT = '#5abff5';
/** Ask identity violet, used on action and history icons only. Not tier violet. */
export const MI_ASK_VIOLET = '#a78bfa';

/** Eyebrow: 12px / 600 / accent. */
export const MI_EYEBROW =
  'text-[12px] font-semibold uppercase tracking-[0.08em] text-[#5abff5]';

/** Greeting: 800 weight, -0.025em, 28 at 360 → 40 on desktop. */
export const MI_GREETING =
  'text-[28px] min-[380px]:text-[30px] md:text-[34px] lg:text-[40px] ' +
  'font-extrabold leading-[1.08] tracking-[-0.025em] text-white';

/** Every interactive target is at least 44px. */
export const MI_TARGET = 'min-h-[44px] min-w-[44px]';

/**
 * Selection surfaces. The bar fill is also the colour the action rail fades into.
 *
 * COLOR / ACTION-AWARENESS R1 — the rail is a RAISED intelligence surface:
 * darker than the page's cards, a 2px sand top rule, and a faint warm lift
 * around the action zone only. No yellow slab, no gradient wash, no glow ring.
 */
export const MI_SELECTION_FILL = '#04111f';
export const MI_SELECTION_BAR =
  'bg-[#04111f] border-t-2 border-[#6a5634] shadow-[0_-14px_32px_-20px_rgba(217,185,138,0.28)]';
/** The desktop panel: the same surface as a card, marked by the same 2px sand rule. */
export const MI_SELECTION_PANEL = 'border-t-2 border-t-[#6a5634]';

/** Follow toggle, ON. Matches the World chip tone. Ordinary personalisation, not Watch. */
export const MI_FOLLOW_ON =
  'bg-[#07304f] border border-[#1b6fa8] text-[#93cdf5]';
export const MI_FOLLOW_OFF =
  'bg-transparent border border-[#1d3a5a] text-[#cfe2f2]';

/** Bookmark, ON / OFF. */
export const MI_SAVED_ON = 'border-[#1b6fa8] text-[#5abff5]';
export const MI_SAVED_OFF = 'border-[#1d3a5a] text-[#cfe2f2]';

/** Source-unavailable notice. */
export const MI_UNAVAILABLE = 'text-[#ffcf7d]';

/** Status banners. */
export const MI_BANNER_DEGRADED =
  'bg-[#2a2110] border border-[#5a4a30] text-[#ffcf7d]';
export const MI_BANNER_ERROR =
  'bg-[#2a1418] border border-[#5a3a3f] text-[#ff8d97]';

/**
 * Sand — the Part IV compute boundary. The ONLY place this surface may signal
 * that AI is about to run. It carries no number, because Sand charging is off
 * (`SAND_CHARGING_ENABLED = false as const`) and the fixture quotes are design
 * fixtures, not prices.
 */
export const MI_SAND_NOTE =
  'bg-[#2e2618] border border-[#6a5634] text-[#D9B98A]';
export const MI_SAND_TAG =
  'border border-[#6a5634] text-[#D9B98A] text-[10px] leading-none';

/**
 * COLOR / ACTION-AWARENESS R1 — the SAME three sand values, applied to the
 * selection workflow. The semantic split is the point:
 *
 *   MI_SELECTION_MODE_CONTROL  warm AWARENESS of the selection workflow — the
 *                              ONE control that reads "Select stories" and then
 *                              "Selection mode · Done". Entering and leaving the
 *                              mode spend nothing, so it never carries the
 *                              lightning mark or the AI tag. Hover and focus
 *                              deepen the same sand (border + surface).
 *   MI_AI_ACTION_ON / _OFF     the COMPUTE commitment point: sand, the governed
 *                              lightning mark and the AI tag, on every action
 *                              that would run AI once confirmed.
 *   MI_LOCAL_ACTION            free, local controls (Clear, filters, select):
 *                              neutral cyan, never sand.
 */
export const MI_SELECTION_MODE_CONTROL =
  'border-2 border-[#6a5634] bg-[#2e2618] text-[#D9B98A] font-bold ' +
  'hover:border-[#8a7045] hover:bg-[#3a3020] focus-visible:border-[#8a7045] focus-visible:bg-[#3a3020]';
export const MI_AI_ACTION_ON =
  'border-[#6a5634] bg-[#2e2618] text-[#D9B98A] hover:border-[#8a7045]';
export const MI_AI_ACTION_OFF =
  'cursor-not-allowed border-[#3a3020] bg-[#17130c] text-[#7d725f]';
export const MI_LOCAL_ACTION = 'font-semibold text-[#5abff5]';
/** The selection-mode control's focus ring: the same sand, never a new colour. */
export const MI_SAND_FOCUS =
  'outline-none focus-visible:ring-2 focus-visible:ring-[#D9B98A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#010a19]';
/** Every visible focus ring on the selection workflow. */
export const MI_FOCUS =
  'outline-none focus-visible:ring-2 focus-visible:ring-[#5abff5] focus-visible:ring-offset-2 focus-visible:ring-offset-[#010a19]';

/** Radii from the authority: card 12, sheet 16 phone / 14 desktop, chip 5. */
export const MI_SHEET = 'rounded-t-[16px] sm:rounded-[14px]';
export const MI_CHIP = 'rounded-[5px]';
export const MI_PILL = 'rounded-[20px]';
