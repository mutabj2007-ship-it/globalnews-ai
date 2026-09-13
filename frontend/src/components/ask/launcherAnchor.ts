/**
 * ═══ R2 FINDING 2 — THE LAUNCHER IS SURFACE-AWARE, NOT WIDTH-AWARE ═════
 *
 * WHAT R1 GOT WRONG. R1 moved the compact launcher to `top-[92px]` to
 * clear the Map's bottom sheet. The dock is mounted from the ROOT LAYOUT,
 * so that moved it on EVERY route below 861px — and the CTO is right that
 * R1's own evidence shows the result: at 375x844 on `/search` the
 * launcher lands on the workspace command bar and the mode badge, and at
 * 414x896 it lands on `h1[analysis-question-text]`, the reader's own
 * question. Measured, both, in `evidence/launcher-probe-*.txt`.
 *
 * A width cannot answer this question, because the thing being avoided is
 * different on every surface: a bottom sheet on the Map, a fixed bottom
 * navigation on the home page, a command bar and a question heading on
 * the Analysis workspace.
 *
 * SO THE ANCHOR IS CHOSEN BY MEASUREMENT, NOT BY A ROUTE LIST. A route
 * list is a second source of truth that goes stale the moment a surface
 * moves its chrome; this asks the page what is actually under each
 * candidate position and takes the clearer one. A surface added later is
 * handled without this file knowing it exists.
 *
 * DESKTOP IS NOT MEASURED AND NOT CHANGED. At and above the `spatial`
 * breakpoint the released `bottom-4 end-4` placement is accepted design
 * and is returned without inspecting anything.
 */

/** Tailwind screen `spatial`. The same 861px the Map shell switches at. */
export const SPATIAL_FROM = 861;

/** The launcher's own box, used to build the candidate rectangles. */
export const LAUNCHER_W = 132;
export const LAUNCHER_H = 44;
export const LAUNCHER_GAP = 16;

/**
 * Compact top offset: clear of the NavBar (52px below `cd-header`) plus a
 * gap. On the Map this also clears the permanent mobile HUD, which is
 * why the Map resolves to `top` — see `MobileSpatialShell`'s own
 * `PERMANENT_HUD_PX`.
 */
export const COMPACT_TOP_PX = 92;

export type LauncherAnchor = 'bottom' | 'top';

export interface AnchorInput {
  readonly viewportWidth: number;
  /** Protected elements the TOP candidate would cover. */
  readonly topCollisions: number;
  /** Protected elements the BOTTOM candidate would cover. */
  readonly bottomCollisions: number;
}

/**
 * PURE, SO THE RULE IS PROVABLE WITHOUT A BROWSER.
 *
 * `bottom` is the released placement and therefore the default and the
 * tie-break: the launcher moves only when the bottom is demonstrably
 * worse, never on a hunch about a viewport width.
 */
export function chooseAnchor(input: AnchorInput): LauncherAnchor {
  if (input.viewportWidth >= SPATIAL_FROM) return 'bottom';
  return input.bottomCollisions > input.topCollisions ? 'top' : 'bottom';
}

/**
 * What must not be covered, as a selector, so the rule the Product Owner
 * stated in prose is the rule the code applies:
 * "question headings, badges, navigation, article content or other
 * primary controls".
 *
 * `article content` is the one item not listed here, and deliberately:
 * a fixed affordance on a scrolling document floats over prose as the
 * reader scrolls, and no anchor avoids that. What IS guaranteed is that
 * the document's end clears the launcher — see `useLauncherAnchor`'s
 * reserved space — so no content is permanently unreachable beneath it.
 */
export const PROTECTED_SELECTOR = [
  'nav',
  'header',
  '[role="banner"]',
  '[role="navigation"]',
  'h1',
  'h2',
  'a[href]',
  'button',
  '[role="button"]',
  'input',
  'select',
  'summary',
  '[data-paf="command-bar"]',
  '[data-paf="workspace-back"]',
  '[data-gn="mobile-sheet"]',
  '[data-gn="mobile-hud"]',
].join(',');
