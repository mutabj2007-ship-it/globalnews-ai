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

/** Selection surfaces. The bar fill is also the colour the action rail fades into. */
export const MI_SELECTION_FILL = '#061a30';
export const MI_SELECTION_BAR = 'bg-[#061a30] border-t border-[#0e2d4d]';

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

/** Radii from the authority: card 12, sheet 16 phone / 14 desktop, chip 5. */
export const MI_SHEET = 'rounded-t-[16px] sm:rounded-[14px]';
export const MI_CHIP = 'rounded-[5px]';
export const MI_PILL = 'rounded-[20px]';
