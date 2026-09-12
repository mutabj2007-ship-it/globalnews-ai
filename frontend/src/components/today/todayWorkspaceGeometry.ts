/**
 * R5.9 / R7 — THE TODAY FRAME GEOMETRY, AS ARITHMETIC.
 *
 * Every number here is quoted from `06-GEOGRAPHY-AND-HELP.md` §A6–§A8 and
 * `09-ACCEPTANCE-CRITERIA.md` F13–F19. Nothing is chosen.
 *
 * ── WHY THIS IS A PURE MODULE AND NOT LOGIC INSIDE THE PANEL ──────────────
 *
 * `08 §4` is explicit: the region "derives its tier from known chrome heights
 * — never from a measured element; a stale measurement re-clips the region."
 * So the tier is a function of ONE input — the right column's height — and
 * that height is itself computed from known chrome
 * (`viewport − 46 command bar − header track − dock track`).
 *
 * Keeping it pure has a second benefit that matters more than tidiness: F13–F19
 * become arithmetic that a unit test can prove at every height, not just at the
 * handful of viewport sizes a browser pass can visit.
 *
 * ── THE ONE CONTRADICTION IN THE SOURCE DOCUMENT, AND HOW IT IS RESOLVED ──
 *
 * `06 §A7`'s tier table still carries an older revision in which the map is
 * "dropped, label as text" at tiers C–E with heights 96 / 52 / 0. The SAME
 * section's prose reverses exactly that:
 *
 *     "The canvas is never dropped and never falls below 72px. Earlier
 *      revisions shrank it to 52 and then to 0, retaining only a text label;
 *      that is reversed."
 *
 * F15 agrees — "renders at every tier and never falls below 72px. It is never
 * replaced by a text label" — and so does the CTO's own ruling: "must never
 * disappear; absolute floor 72px". Three sources against one stale table.
 *
 * THIS MODULE IMPLEMENTS THE FLOOR, NOT THE TABLE, and the divergence is
 * reported rather than absorbed.
 */

/* ── §A6/§A7 — the declared constants. Two numbers per floor so they cannot
      drift: chrome + scroll body. ─────────────────────────────────────────── */

/** WATCH: 34 header + 120 scroll body. */
export const WATCH_CHROME = 34;
export const WATCH_BODY_FLOOR = 120;
export const WATCH_FLOOR = WATCH_CHROME + WATCH_BODY_FLOOR; // 154

/** Geography: 27 header + 18 label line + 5 padding, over a 120 country list. */
export const GEO_CHROME = 50;
export const GEO_BODY_FLOOR = 120;
export const GEO_FLOOR = GEO_CHROME + GEO_BODY_FLOOR; // 170

/** ANALYSE: 41 header strip + 120 scroll body. Recorded, because recording it
    as 0 is what hid a 77px clip of the centre column (§A7). */
/*
  R4 CORRECTION 2 — 48, NOT 41.

  The header now carries a 44px filled primary action, and a 44px control in a
  41px track overflows into the scrolling body beneath it: MEASURED, the CTA's
  lower edge crossed the body's top and grazed the first record. 48 gives the
  control its full target with 2px of breathing room either side.

  NOTHING DOWNSTREAM MOVES. ANALYSE_FLOOR becomes 48 + 120 = 168, and the body
  minimum is max(ANALYSE_FLOOR, WATCH_FLOOR, GEO_FLOOR) — still GEOGRAPHY's 170,
  which binds at both 41 and 48. The dock ceiling, the relocation trigger and
  every tier the engine resolves are unchanged, and the floor is still stated as
  its own two numbers exactly as B10 requires.
*/
export const ANALYSE_CHROME = 48;
export const ANALYSE_BODY_FLOOR = 120;
export const ANALYSE_FLOOR = ANALYSE_CHROME + ANALYSE_BODY_FLOOR; // 161

/** Region parts (§A7). */
export const GEO_HEADER_H = 27;
export const GEO_FOOTER_CTA_H = 51;
export const GEO_ROWS_PREFERRED = 132;
export const GEO_ROWS_COMPACT = 72;

/** Canvas targets and floor (§A2/§A7, F13/F15). */
export const CANVAS_TARGET = 220;
export const CANVAS_CTA_RELOCATION = 96;
export const CANVAS_FLOOR = 72;

/** WATCH's bounded share: clamp(154, 34% of column, 260). */
export const WATCH_SHARE = 0.34;
export const WATCH_MAX = 260;

/** §A8 — below 154 + 170 the two floors cannot both be honoured. */
export const TIER_E_COLUMN = WATCH_FLOOR + GEO_FLOOR; // 324

/** Frame chrome (`02 §2`). */
export const COMMAND_BAR_H = 46;
export const HEADER_H_EXPANDED = 118;
export const HEADER_COLLAPSE_SCROLL = 40;
export const DOCK_H_COMPACT = 62;
export const DOCK_H_EXPANDED = 292;

export type GeographyTier = 'A' | 'B' | 'C' | 'D' | 'E';
export type WorldMapCtaPosition = 'region-footer' | 'region-header' | 'permanent-chrome';

export interface GeographyLayout {
  tier: GeographyTier;
  /** Bounded share of the column. */
  watchHeight: number;
  /** Everything the column has left. */
  regionHeight: number;
  /** F13/F15 — dominant, `flex:1`, never below 72, never replaced by text. */
  canvasHeight: number;
  /** F16 — `flex:0 0 auto`, so it can never clip the canvas. */
  rowsHeight: number;
  ctaPosition: WorldMapCtaPosition;
  /** F18 — false at tiers A–D. The column itself scrolls only at E. */
  columnScrolls: boolean;
  /**
   * F14 — whether the canvas absorbs surplus column height.
   *
   * TRUE in the frozen rail and in a dock tab, exactly as validated. FALSE in
   * the three-column composition, where the canvas is sized from the map's own
   * aspect and the surplus goes to the country list instead.
   */
  canvasGrows: boolean;
  /**
   * R4 ZOOM — set ONLY where the box's width is not known in advance.
   *
   * In the three-column composition the width is a constant, so the canvas
   * height is computed in pixels and the rows take the exact remainder. In a
   * relocated dock TAB the width is whatever the frame happens to be, and a
   * pixel height computed from the wrong width is what left 380px of the panel
   * empty at 768. There the canvas takes `width:100%` with this aspect ratio
   * instead, so the box matches the picture at ANY width and the tab scrolls.
   */
  canvasAspect: number | null;
}

/**
 * The right column's height, from KNOWN chrome only (§A7) — never measured.
 */
export function resolveColumnHeight(input: {
  viewportHeight: number;
  headerCollapsed: boolean;
  dockExpanded: boolean;
}): number {
  const header = input.headerCollapsed ? 0 : HEADER_H_EXPANDED;
  const dock = input.dockExpanded ? DOCK_H_EXPANDED : DOCK_H_COMPACT;
  return Math.max(0, input.viewportHeight - COMMAND_BAR_H - header - dock);
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

/**
 * §A7's steps 0–3, applied to a region height. EXTRACTED, NOT CHANGED: this is
 * verbatim the body `resolveGeographyLayout` ran inline before, so every one of
 * the 1,201 heights the tier test proves resolves to the same three numbers.
 *
 * It is a function now because the relocated dock (`05 §5.1`) gives geography a
 * region height DIRECTLY — in a tab it is the only region present, so there is
 * no column to split and no WATCH share to subtract. Re-deriving the interior
 * there by inverting the clamp would have been a second, differently-wrong copy
 * of this arithmetic.
 */
function resolveRegionInterior(regionHeight: number): {
  canvasHeight: number;
  rowsHeight: number;
  ctaPosition: WorldMapCtaPosition;
} {
  const canvasWith = (rows: number, footer: number): number =>
    regionHeight - GEO_HEADER_H - rows - footer;

  /* Step 0 — everything at its preferred size. */
  let rowsHeight = GEO_ROWS_PREFERRED;
  let ctaPosition: WorldMapCtaPosition = 'region-footer';
  let canvasHeight = canvasWith(rowsHeight, GEO_FOOTER_CTA_H);

  /* Step 1 — the canvas is served before the list. */
  if (canvasHeight < CANVAS_TARGET) {
    rowsHeight = GEO_ROWS_COMPACT;
    canvasHeight = canvasWith(rowsHeight, GEO_FOOTER_CTA_H);
  }

  /* Step 2 — the CTA relocates into the header and returns its 51px. */
  if (canvasHeight < CANVAS_CTA_RELOCATION) {
    ctaPosition = 'region-header';
    canvasHeight = canvasWith(rowsHeight, 0);
  }

  /* Step 3 — the floor. The canvas is never dropped and never goes below it. */
  if (canvasHeight < CANVAS_FLOOR) {
    canvasHeight = CANVAS_FLOOR;
  }

  return { canvasHeight, rowsHeight, ctaPosition };
}

/**
 * `05 §5.1` — GEOGRAPHY AS A DOCK TAB, WHERE IT IS THE ONLY REGION PRESENT.
 *
 * It takes the whole tab body, so `regionHeight` is given rather than derived,
 * `watchHeight` is 0 (WATCH is a sibling tab, not a neighbour), and the column
 * does not scroll because in a tab there is no column.
 *
 * `ctaPosition` is PINNED to `permanent-chrome`, which is how the panel renders
 * no control of its own. §5.1 is explicit about why: while relocated the dock
 * tab strip owns OPEN WORLD MAP, and leaving the tier's own position active
 * would put two instances about 160px apart. Exactly one, in every
 * configuration.
 */
export function resolveGeographyRegionLayout(
  regionHeight: number,
  ctaOwner: 'region' | 'chrome',
): GeographyLayout {
  const region = Math.max(GEO_FLOOR, regionHeight);
  const interior = resolveRegionInterior(region);
  return {
    tier: tierLetter(region + WATCH_FLOOR),
    watchHeight: 0,
    regionHeight: region,
    canvasHeight: interior.canvasHeight,
    rowsHeight: interior.rowsHeight,
    /*
      `region` — the tier decides between footer and header, and the region
      draws it. `chrome` — the region draws NOTHING and the dock owns the one
      control, which is what relocation requires (`05 §5.1`).
    */
    ctaPosition: ctaOwner === 'chrome' ? 'permanent-chrome' : interior.ctaPosition,
    columnScrolls: false,
    canvasGrows: true,
    canvasAspect: null,
  };
}

/**
 * `05 §5.1` — GEOGRAPHY AS A DOCK TAB. The dock owns OPEN WORLD MAP.
 *
 * R4 ZOOM: the tab is as wide as the frame and much shorter than the map wants
 * to be, so a height-capped box left the picture at 374px in a 754px panel —
 * MEASURED, 380px of horizontal void, half the tab empty. The canvas takes the
 * full width at the frame's aspect instead and the dock body scrolls, which is
 * what a tall picture in a short slot should do.
 */
export function resolveRelocatedGeographyLayout(regionHeight: number): GeographyLayout {
  return {
    tier: tierLetter(regionHeight + WATCH_FLOOR),
    watchHeight: 0,
    regionHeight: Math.max(GEO_FLOOR, regionHeight),
    /* Unused while `canvasAspect` is set; kept truthful as the floor. */
    canvasHeight: CANVAS_FLOOR,
    rowsHeight: GEO_ROWS_PREFERRED,
    ctaPosition: 'permanent-chrome',
    columnScrolls: false,
    canvasGrows: false,
    canvasAspect: MAP_ASPECT,
  };
}

/**
 * R4 CORRECTION — GEOGRAPHY AS ITS OWN FULL-HEIGHT COLUMN.
 *
 * It is no longer a share of a rail it splits with WATCH, so `regionHeight` is
 * the whole body and `watchHeight` is 0. The practical effect is the one the
 * correction asked for: at a 720 frame with the dock closed the canvas resolves
 * to 330px instead of the 206px it got as the lower half of a shared rail, and
 * the country rows keep their preferred 132px instead of compacting to 72.
 *
 * The region owns its own OPEN WORLD MAP again, in the position its tier picks.
 */
export function resolveGeographyColumnLayout(
  regionHeight: number,
  columnWidth: number,
): GeographyLayout {
  const footer = GEO_FOOTER_CTA_H;
  /*
    THE CANVAS IS THE MAP'S OWN SIZE, NOT A BOX THE MAP SITS INSIDE.

    At 922fcef the canvas took every surplus pixel (F14) and the map — which
    cannot stretch without lying about where countries are — simply floated in
    the middle of it. 59% of the canvas was void, the caption sat 76px below
    the map's edge, and the country list started 98px below it.

    So the box is now sized FROM the picture: `width ÷ MAP_ASPECT` is exactly
    the height the map will draw at, and the surplus goes to the country list
    instead, where it becomes readable rows rather than emptiness.
  */
  const natural = Math.round(columnWidth / MAP_ASPECT);
  /*
    THE PARTS SUM TO THE REGION AT EVERY HEIGHT, AND THAT IS ASSERTED.

    The footer CTA is affordable only once the region can hold header, canvas
    floor, rows floor AND footer; below that it moves into the region header,
    which is the tier engine's own existing rule. Then the canvas takes its
    natural height within what is left, and the rows take the exact remainder —
    not a floored value that could push the total past the region. At 922fcef
    that floor-first ordering was what put the frozen rail 1px over its own
    region; this resolver cannot repeat it.
  */
  const wantsFooter =
    regionHeight >= GEO_HEADER_H + CANVAS_FLOOR + GEO_ROWS_COMPACT + footer;
  const footerH = wantsFooter ? footer : 0;
  const maxCanvas = regionHeight - GEO_HEADER_H - footerH - GEO_ROWS_COMPACT;
  const canvasHeight = Math.min(
    Math.max(natural, CANVAS_FLOOR),
    Math.max(CANVAS_FLOOR, maxCanvas),
  );
  const rowsHeight = Math.max(0, regionHeight - GEO_HEADER_H - footerH - canvasHeight);
  const ctaPosition: WorldMapCtaPosition = wantsFooter ? 'region-footer' : 'region-header';

  return {
    tier: tierLetter(regionHeight + WATCH_FLOOR),
    watchHeight: 0,
    regionHeight: Math.max(GEO_FLOOR, regionHeight),
    canvasHeight,
    rowsHeight,
    ctaPosition,
    columnScrolls: false,
    /*
      FALSE is the whole correction: the canvas no longer absorbs surplus, so
      it can never be taller than the picture it contains. The frozen rail
      resolver keeps TRUE and keeps F14 exactly as validated.
    */
    canvasGrows: false,
    /* The width is a constant here, so the height is computed in pixels. */
    canvasAspect: null,
  };
}

/**
 * §A7's yielding order, applied in order and only in order:
 *
 *   1. canvas < 220 → country rows drop 132 → 72. The canvas is served first.
 *   2. canvas < 96  → the footer CTA moves into the region header, and its
 *                     51px goes to the canvas.
 *   3. canvas < 72  → tier E. Canvas pinned at 72, rows at 72, CTA to
 *                     permanent chrome, and the COLUMN scrolls — because
 *                     below 324 no fixed allocation honours both floors, and
 *                     clipping either would be the defect.
 *
 * Surplus always lands on the canvas, never on padding and never on the rows
 * (F14): `canvas = region − header − rows − footer` and nothing else consumes
 * the remainder.
 */
export function resolveGeographyLayout(columnHeight: number): GeographyLayout {
  /* Tier E first: it is a statement about the COLUMN, not about the canvas. */
  if (columnHeight < TIER_E_COLUMN) {
    return {
      tier: 'E',
      watchHeight: WATCH_FLOOR,
      regionHeight: GEO_FLOOR,
      canvasHeight: CANVAS_FLOOR,
      rowsHeight: GEO_ROWS_COMPACT,
      ctaPosition: 'permanent-chrome',
      columnScrolls: true,
      canvasGrows: true,
      canvasAspect: null,
    };
  }

  const watchHeight = Math.round(clamp(columnHeight * WATCH_SHARE, WATCH_FLOOR, WATCH_MAX));
  const regionHeight = columnHeight - watchHeight;
  const { canvasHeight, rowsHeight, ctaPosition } = resolveRegionInterior(regionHeight);

  return {
    tier: tierLetter(columnHeight),
    watchHeight,
    regionHeight,
    canvasHeight,
    rowsHeight,
    ctaPosition,
    columnScrolls: false,
    canvasGrows: true,
    canvasAspect: null,
  };
}

/**
 * §A7's OWN TIER LETTERS, which are bands of the COLUMN height:
 *
 *     ≥465 A · 421–464 B · 387–420 C · 324–386 D · <324 E
 *
 * CTO ruling, generation 2: normalize the letters to this authoritative
 * vocabulary and leave the validated arithmetic alone. Earlier revisions of
 * this module derived the letter from the canvas outcome, which made a 580px
 * viewport report C where the table says D. The BEHAVIOUR was, and remains,
 * the table's — rows compact, CTA in the region header. Only the name moves.
 */
function tierLetter(columnHeight: number): GeographyTier {
  if (columnHeight < TIER_E_COLUMN) return 'E';
  if (columnHeight <= 386) return 'D';
  if (columnHeight <= 420) return 'C';
  if (columnHeight <= 464) return 'B';
  return 'A';
}

/**
 * The right column's height inside a BOUNDED TODAY SECTION rather than a
 * full-page frame.
 *
 * CTO ruling, generation 3: Today stays part of the normally scrolling
 * homepage. There is no document-level `overflow:hidden` and no command bar
 * inside the section, so the column is the section's own frame height less its
 * header and dock tracks — and nothing else. Same tier engine, one fewer
 * subtraction, still computed and never measured.
 */
export function resolveSectionColumnHeight(input: {
  frameHeight: number;
  headerCollapsed: boolean;
  dockExpanded: boolean;
}): number {
  const header = input.headerCollapsed ? 0 : HEADER_H_EXPANDED;
  const dock = input.dockExpanded ? DOCK_H_EXPANDED : DOCK_H_COMPACT;
  return Math.max(0, input.frameHeight - header - dock);
}

/**
 * R4 CORRECTION — THE THREE-COLUMN DESKTOP COMPOSITION.
 *
 *     WATCH  |  ANALYSE  |  GEOGRAPHY
 *      240      1fr          324
 *
 * WATCH is COMPACT by contract, so it is a fixed narrow track rather than a
 * share: a proportional WATCH would grow on a wide monitor into space it has
 * nothing to put, and shrink on a laptop into a column that truncates country
 * names. 240px holds the longest country label in both locales at 11.5px with
 * room for a count, which is the whole job.
 *
 * GEOGRAPHY keeps the 324px it was measured at in R5.9, so the frozen tier
 * arithmetic still resolves against the width it was validated for.
 *
 * ANALYSE takes what is left, and takes it as `minmax(0, 1fr)` — without the
 * `minmax(0, …)` a long headline sets the track's min-content width and pushes
 * the whole grid wider than the frame.
 */
export const WATCH_COL_W = 240;

/**
 * R4 GEOGRAPHY SIZE CHILD — GEOGRAPHY IS WIDER, AND WHY IT HAD TO BE.
 *
 * The map is equirectangular, so at a given column width its height is fixed
 * by geography itself: width ÷ MAP_ASPECT. At 324px that is 135px, and no
 * amount of box height makes it bigger — it can only be surrounded by more
 * void. MEASURED at 922fcef: a 324×330 canvas box drawing a 324×135 map, with
 * 98px of dead space above AND below it.
 *
 * So the only honest lever for "a substantially larger map" is WIDTH. 420
 * gives a 420×175 map: 30% wider, 69% more area, and it still leaves ANALYSE
 * 738px at a 1440 viewport, which is more than the 834 it had at 922fcef minus
 * what a situation row actually needs.
 *
 * BELOW 1280 IT REVERTS TO 324. At 1024 a 420px geography column would leave
 * ANALYSE about 350px, where a 13px headline wraps three or four times. The
 * map is worth width; it is not worth making the centre column unreadable.
 */
export const GEO_COL_W = 420;
export const GEO_COL_W_M = 324;
/** Above this the wide geography column applies; below it, GEO_COL_W_M. */
export const M_BREAKPOINT = 1280;

/**
 * The map's own aspect, from the projection itself rather than a number kept
 * here in parallel with it. Height follows from width and nothing else — that
 * is what makes the picture undistorted, and it is why the canvas box is sized
 * FROM it rather than the map being fitted INTO a box chosen for other reasons.
 *
 * R4 ZOOM REVISION: the clipped Mercator frame is 1.937 where the
 * equirectangular one was 2.400, so the same column width now yields a 217px
 * map instead of 175px — and, far more importantly, the geography inside it is
 * magnified with latitude instead of being drawn flat.
 */
export { MAP_ASPECT } from '@/components/today/todayMapProjection';
import { MAP_ASPECT } from '@/components/today/todayMapProjection';

/** The bounded workspace's own height. A design constant, not a viewport unit. */
export const TODAY_FRAME_H = 720;
/** S breakpoint (`07`): WATCH and geography relocate into dock tabs. */
export const S_BREAKPOINT = 1024;
export const TODAY_FRAME_H_S = 640;

/**
 * `05 §5` — THE DOCK CEILING, AND THE RELOCATION IT TRIGGERS.
 *
 * ── WHY THE DOCK IS CAPPED AT ALL ────────────────────────────────────────
 *
 * B5/B17: expanding the dock must reduce ANALYSE and nothing else, and ANALYSE
 * has a floor of `ANALYSE_FLOOR` = 41 + 120. An uncapped dock at a short frame
 * leaves the centre below that floor, and — the sentence in `05 §5.1` worth
 * keeping — "reducing a panel below its floor is not reducing it, it is
 * clipping it". So the dock takes the SMALLER of its preferred height and
 * whatever is left above the floor.
 *
 * ── AND WHY THE CAP CANNOT BE THE WHOLE ANSWER ───────────────────────────
 *
 * Capped far enough, the dock becomes a strip too short to show one source
 * card — 36px of header plus 144px for a card is the 180px in
 * `DOCK_RELOCATION_FLOOR` — at which point capping further only trades one
 * unusable region for another. `05 §5.1` resolves it: the right column
 * RELOCATES into the dock as tabs, the same treatment the S breakpoint uses,
 * and the dock then takes `max(180, frameH − headerH − ANALYSE_FLOOR)`.
 *
 * Either the column is served in place or it moves into the dock. It is never
 * squeezed to a hairline, and ANALYSE never goes under its floor. Both of
 * those are arithmetic here rather than a hope in a stylesheet.
 */
export const DOCK_RELOCATION_FLOOR = 180;

/**
 * B17 — THE BODY MINIMUM, RE-DERIVED FOR THE THREE-COLUMN COMPOSITION.
 *
 * B17 stated the dock cap as `max(161, 274)`, and the 274 was WATCH's floor
 * plus the 120px of geography that had to stay visible BELOW it. That number
 * existed only because WATCH and GEOGRAPHY were STACKED in one 324px rail: the
 * rail's height had to hold both.
 *
 * Under the corrected composition they are SIDE BY SIDE, each in its own
 * column, and every column is exactly `bodyHeight` tall. So the body no longer
 * has to hold a sum — it has to clear the TALLEST single floor:
 *
 *     ANALYSE   41 + 120 = 161
 *     WATCH     34 + 120 = 154
 *     GEOGRAPHY 50 + 120 = 170   ← the binding one
 *
 * 170, not 274. This is a consequence of the recomposition, not a relaxation:
 * at 274 the dock was capped to protect a stacking that no longer exists, and
 * leaving it there would have starved the dock for no reason any region needs.
 * Every floor is still enforced, and the unit test proves all three at once.
 */
export const COLUMN_MIN_IN_PLACE = Math.max(ANALYSE_FLOOR, WATCH_FLOOR, GEO_FLOOR);

export interface DockResolution {
  /** The dock track's height. */
  dockHeight: number;
  /** True when WATCH and geography live in dock tabs rather than the column. */
  relocated: boolean;
  /** What remains for ANALYSE and, when not relocated, the right column. */
  bodyHeight: number;
}

export function resolveDock(input: {
  frameHeight: number;
  headerCollapsed: boolean;
  dockExpanded: boolean;
  smallViewport: boolean;
}): DockResolution {
  const header = input.headerCollapsed ? 0 : HEADER_H_EXPANDED;

  /*
    B17's `max(161, 274)`, in full. While the column is served IN PLACE the
    dock may only take what is left above BOTH floors — ANALYSE's and the
    column's — because the dock is the region whose growth pushes on them.
  */
  const inPlaceCeiling =
    input.frameHeight - header - Math.max(ANALYSE_FLOOR, COLUMN_MIN_IN_PLACE);
  const capped = Math.min(DOCK_H_EXPANDED, inPlaceCeiling);

  /*
    TWO TRIGGERS, ONE MECHANISM. The S breakpoint has no room for a 324px
    column at any dock height. A short frame runs out of room only once the
    dock is open, and the point it runs out is where the cap would leave a dock
    too short for one source card — capping past there trades one unusable
    region for another. Both end in the SAME relocated layout, so there is one
    relocated code path to test and one OPEN WORLD MAP owner.
  */
  const relocated =
    input.smallViewport || (input.dockExpanded && capped < DOCK_RELOCATION_FLOOR);

  /*
    Once relocated the column is no longer in place, so its 274 leaves the
    ceiling and only ANALYSE's floor remains — which is exactly why §5.1's own
    worked example turns a rejected 102px dock into a usable 215px one.
  */
  const relocatedCeiling = input.frameHeight - header - ANALYSE_FLOOR;

  const dockHeight = !input.dockExpanded
    ? DOCK_H_COMPACT
    : relocated
      ? Math.max(DOCK_RELOCATION_FLOOR, relocatedCeiling)
      : Math.max(DOCK_H_COMPACT, capped);

  return {
    dockHeight,
    relocated,
    bodyHeight: Math.max(ANALYSE_FLOOR, input.frameHeight - header - dockHeight),
  };
}
