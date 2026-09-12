/**
 * PAF-R1 Phase 0 — the frame's track arithmetic and its single
 * compression flag.
 *
 * THIS MODULE IS PURE ON PURPOSE. Every geometric invariant the handoff
 * calls non-negotiable (F-6, F-7, the 240px centre floor, the 60/30
 * hysteresis, the index's exemption from compression) is decided here,
 * in arithmetic, before any JSX exists. That is what makes them
 * provable rather than inspectable: `frameGeometry.spec.ts` sweeps the
 * whole supported range without a DOM.
 *
 * `centreHeight` IS DERIVED AND NEVER ASSIGNED. In CSS the centre is
 * `minmax(0,1fr)`; the number returned here exists only so tests can
 * assert the floor. Nothing writes it to a style. That is the whole
 * mechanism behind F-6 — expanding the dock cannot move rows 1 or 2
 * because no code sets the centre's height in the first place.
 *
 * Source: 13-IMPLEMENTATION-HANDOFF-PAF-R1 §3 and §4.2, which supersede
 * 03 §1-§3 and 07 §1-§5 (there is no page scroll to model).
 */

/** Command bar above the frame. Fixed, never part of the grid. */
export const COMMAND_BAR_HEIGHT = 48;

/*
 * ── THE NAVBAR THE SPECIFICATION DID NOT HAVE ────────────────────────
 *
 * R4 §6 does its arithmetic as `window - 48`: in the prototype the 48px
 * command bar IS the top chrome. The product puts the released `NavBar`
 * above it, and pretending otherwise is precisely the defect that
 * produced R1 ruling 1 — a frame sized to a viewport it did not have,
 * overhanging its own space by exactly one header.
 *
 * So the frame's height is the viewport minus BOTH bars. `NavBar`
 * renders `h-[52px]` below the `cd-header` breakpoint and `h-[62px]` at
 * and above it; those two numbers and the breakpoint are the only facts
 * imported here, and `navBarHeightContract.spec.ts` asserts all three
 * against NavBar's own source and tailwind.config so they cannot drift
 * apart in silence.
 *
 * CONSEQUENCE, STATED RATHER THAN DISCOVERED. §3.3's "opens compressed
 * below 852" is now evaluated against the REAL frame, so a 1440x900
 * window gives 800 and opens compressed. That is §3.3 doing what it says
 * on a viewport that genuinely has 800px of frame — not a new rule.
 */
export const NAVBAR_HEIGHT_COMPACT = 52;
export const NAVBAR_HEIGHT_WIDE = 62;
/** Tailwind screen `cd-header`, at which NavBar switches bars. */
export const NAVBAR_WIDE_FROM = 1400;

export function navBarHeightFor(viewportWidth: number): number {
  return viewportWidth >= NAVBAR_WIDE_FROM ? NAVBAR_HEIGHT_WIDE : NAVBAR_HEIGHT_COMPACT;
}

export const BRIEF_HEIGHT_NORMAL = 196;
export const BRIEF_HEIGHT_COMPRESSED = 52;

/*
 * ── ALPHA CLOSURE: THE COMPACT DOCK WAS EFFECTIVELY INVISIBLE ─────────
 *
 * 78px held a 26px header and a single row of publisher chips. On a real
 * Australia analysis that read as one thin line at the bottom edge —
 * "SOURCES DOCK · 5" — and an ordinary reader could miss that evidence
 * existed at all.
 *
 * The compact dock now carries at least one row of real source cards
 * (publisher, title, age, language, resolved geography) plus an explicit
 * expand control, so these heights are what that row costs. The centre
 * floor is unaffected: at the shortest frame this module admits, centre
 * still clears CENTRE_MIN_HEIGHT with room to spare.
 *
 * The dock is still COMPACT by default and still collapses on demand.
 * What changed is that "compact" now means small, not hidden.
 */
export const DOCK_COMPACT_NORMAL = 168;
export const DOCK_COMPACT_COMPRESSED = 128;

export const DOCK_EXPANDED_RATIO_NORMAL = 0.46;
export const DOCK_EXPANDED_RATIO_COMPRESSED = 0.42;

/**
 * Handoff §3.1: "centreH has a floor of 240px. Where the expanded dock
 * would breach it, the dock takes the smaller share — analysis is the
 * subject, sources are the support."
 */
export const CENTRE_MIN_HEIGHT = 240;

/**
 * The centre's floor WHILE THE READER HAS EXPLICITLY EXPANDED SOURCES.
 *
 * PO ruling F-2a supersedes the 240px floor in that state. It does not remove
 * a floor altogether: the centre keeps enough height to stay oriented, and —
 * the load-bearing reason — the dock's own collapse control must never be the
 * thing that scrolls out of reach. 132px is the brief row plus one line of
 * analysis, which is the smallest centre that still reads as a document rather
 * than as a sliver.
 */
export const CENTRE_MIN_EXPANDED = 132;

/**
 * What the expanded dock needs to show its source cards WITHOUT an inner
 * vertical scrollbar.
 *
 * Ruling F-2a: "expanded state grows enough to show the intended source-card
 * presentation" and "NO inner vertical scrollbar whose purpose is to reveal
 * source images/cards". `SourcesDock` draws a 56px thumbnail row per expanded
 * card; this is the dock header plus three such cards plus their gaps, which
 * is the point at which horizontal navigation takes over from vertical growth.
 *
 * Ruling F-2a again, on what must NOT be done instead: "Do not shrink the
 * source imagery into illegibility merely to retain the old centre floor." So
 * this number is derived from the card, and the layout yields to it.
 */
export const DOCK_EXPANDED_CONTENT_HEIGHT = 392;

/** §4.2 hysteresis: compress above 60, restore below 30, hold between. */
export const COMPRESS_ABOVE = 60;
export const RESTORE_BELOW = 30;

/** §3.3: a frame shorter than this opens compressed. */
export const COMPRESSED_FRAME_HEIGHT = 852;

export type DockState = 'compact' | 'expanded';

export interface FrameTracks {
  readonly frameHeight: number;
  readonly briefHeight: number;
  readonly dockHeight: number;
  /** Derived. Never written to a style — see this module's doc comment. */
  readonly centreHeight: number;
  /**
   * False only when the frame is so short that even the COMPACT dock
   * cannot leave the centre its floor. The dock has already yielded
   * everything it can at that point, so this reports the fact rather
   * than pretending the floor held.
   */
  readonly centreFloorHonoured: boolean;
  /**
   * True when the dock track is tall enough to show the source cards without
   * scrolling inside itself.
   *
   * PO ruling F-2a forbids an inner vertical scrollbar whose purpose is to
   * reveal source imagery, and the dock now grows to fit rather than clamping.
   * This flag is false ONLY in the case the ruling itself names — "extremely
   * short viewports where expanded cards cannot coexist with a useful reader".
   *
   * WHAT IT DECIDES CHANGED IN THE C904 REVIEW, AND THE DIFFERENCE MATTERS.
   * It used to select a fallback: mount a scroller inside the dock. The review
   * rejected that, so it now selects a DESTINATION — the expand control opens
   * the dedicated Sources page instead of expanding in place. Nothing in the
   * product scrolls vertically inside the Sources region at any viewport, and
   * nothing is unreachable either.
   */
  readonly dockFitsContent: boolean;
}

export function frameHeightFor(windowHeight: number): number {
  return Math.max(0, windowHeight - COMMAND_BAR_HEIGHT);
}

/**
 * The frame's real height inside the product's chrome: the viewport less
 * the NavBar less the command bar. This is the value the CSS box is
 * sized to (`calc(100dvh - navbar)` on the shell, the command bar taken
 * by flow), so the arithmetic and the layout cannot disagree.
 */
export function framedHeightFor(windowHeight: number, windowWidth: number): number {
  return frameHeightFor(Math.max(0, windowHeight - navBarHeightFor(windowWidth)));
}

export interface CompressionInput {
  readonly centreScrollTop: number;
  readonly userForcedExpanded: boolean;
  readonly frameHeight: number;
  /** The flag's previous value — returned unchanged inside the hysteresis band. */
  readonly previousCompressed: boolean;
}

/**
 * ONE FLAG, TWO CAUSES (§4.2), so they cannot disagree.
 *
 * RECONCILIATION, STATED BECAUSE IT IS A DEVIATION FROM THE LITERAL
 * FORMULA. §4.2 writes
 *   compressed = (centreScrollTop > 60 && !userForcedExpanded) || frameHeight < 852
 * which parenthesises the override around the scroll cause only — so at
 * a 720px window (frame 672) `▾ FULL` could never expand anything. §3.3
 * says the opposite in the same document: "Opens compressed; `▾ FULL`
 * still available." The override is therefore applied to the whole
 * expression, which is the only reading that satisfies both sentences.
 * Recorded in the CTO report rather than silently chosen.
 */
export function resolveCompressed(input: CompressionInput): boolean {
  const { centreScrollTop, userForcedExpanded, frameHeight, previousCompressed } = input;

  if (userForcedExpanded) return false;

  const heightCause = frameHeight < COMPRESSED_FRAME_HEIGHT;
  if (heightCause) return true;

  if (centreScrollTop > COMPRESS_ABOVE) return true;
  if (centreScrollTop < RESTORE_BELOW) return false;

  return previousCompressed;
}

/**
 * `▾ FULL` holds until the next DOWNWARD pass of 60px (§4.2). This is
 * the predicate that clears it; the frame calls it on every scroll.
 */
export function shouldClearForcedExpansion(centreScrollTop: number): boolean {
  return centreScrollTop > COMPRESS_ABOVE;
}

export interface TrackInput {
  readonly frameHeight: number;
  readonly compressed: boolean;
  readonly dock: DockState;
}

export function resolveTracks(input: TrackInput): FrameTracks {
  const { frameHeight, compressed, dock } = input;

  const briefHeight = compressed ? BRIEF_HEIGHT_COMPRESSED : BRIEF_HEIGHT_NORMAL;
  const compactDock = compressed ? DOCK_COMPACT_COMPRESSED : DOCK_COMPACT_NORMAL;

  let dockHeight: number;

  if (dock === 'compact') {
    /*
      COMPACT IS UNCHANGED, DELIBERATELY. PO ruling F-2a: "compact state stays
      compact". The centre keeps its floor here exactly as before, because at
      rest the analysis is the subject and the dock is the support.
    */
    dockHeight = compactDock;
  } else {
    /*
      ══ PO RULING F-2a — EXPANDED MEANS EXPANDED ═══════════════════════════

      THIS SUPERSEDES HANDOFF §3.1's 240px CENTRE FLOOR, AND ONLY WHILE THE
      READER HAS EXPLICITLY EXPANDED THE DOCK. The ruling is explicit: "the
      centre reader MAY shrink below the old 240px floor while Sources is
      explicitly expanded", and "collapsing Sources immediately restores the
      normal reading geometry".

      WHY THE OLD RULE HAD TO GO. The expanded dock was capped at 46% of the
      frame, which is smaller than the source cards it exists to show — so its
      body fell back to `overflow-y-auto` and the reader got an inner vertical
      scrollbar whose only purpose was to uncover the card imagery. That is the
      behaviour the Product Owner rejected, and it was not a styling accident:
      it was the arithmetic here. Capping the height and scrolling the contents
      are the same decision.

      The floor is superseded, NOT deleted. `CENTRE_MIN_HEIGHT` still governs
      the compact state, still reports through `centreFloorHonoured`, and comes
      back the instant the dock collapses — which is why this is one branch of
      one function rather than a changed constant.

      The dock still cannot take the whole frame: the centre keeps
      `CENTRE_MIN_EXPANDED`, enough to show the reader what they are reading
      around and, crucially, enough that the collapse control is never pushed
      off screen. A dock that hid its own collapse control would be a trap.
    */
    const ratio = compressed ? DOCK_EXPANDED_RATIO_COMPRESSED : DOCK_EXPANDED_RATIO_NORMAL;
    const desired = Math.round(frameHeight * ratio);
    const expandedCeiling = frameHeight - briefHeight - CENTRE_MIN_EXPANDED;

    /*
      The dock takes the LARGER of its ratio and the height the source cards
      actually need, then yields only to the expanded ceiling. Before, the
      content height was not in this calculation at all — which is exactly how
      a dock ends up too short for its own contents.
    */
    dockHeight = Math.min(Math.max(compactDock, desired, DOCK_EXPANDED_CONTENT_HEIGHT), expandedCeiling);
  }

  const centreHeight = frameHeight - briefHeight - dockHeight;

  return {
    frameHeight,
    briefHeight,
    dockHeight,
    centreHeight,
    centreFloorHonoured: centreHeight >= CENTRE_MIN_HEIGHT,
    /*
      The compact dock is never expected to hold a full card set — it is a
      deliberate summary — so it reports fit only against its own height. The
      expanded dock is measured against what the cards actually need.
    */
    dockFitsContent: dock === 'compact' || dockHeight >= DOCK_EXPANDED_CONTENT_HEIGHT,
  };
}

/**
 * §3.3 — the frame's opening compression state, before the user has
 * scrolled or overridden anything.
 */
export function opensCompressed(frameHeight: number): boolean {
  return frameHeight < COMPRESSED_FRAME_HEIGHT;
}

/* ------------------------------------------------------------------ *
 * Width breakpoints (§3.2)
 * ------------------------------------------------------------------ */

export type FrameBreakpoint = 'XL' | 'L' | 'M' | 'M_NARROW' | 'S' | 'XS';

/**
 * PAF-R1.2 (P2) — the index track widened from 196/180 to 260/236.
 *
 * The released row is a FIXED 212px inside a 196px track, which is what
 * produced the horizontal scrollbar. The measured requirement, at JetBrains
 * Mono's 0.6em advance, is 219.7px for `INSUFFICIENT EVIDENCE` and 234.2px
 * for the Polish `NIEWYSTARCZAJĄCE DOWODY`, plus 24px of container padding —
 * so 260px carries both languages on one line with the dedicated count
 * column intact.
 *
 * This supersedes handoff §3.1's `196px | 1fr | 296px` on CTO instruction
 * that "the left/centre boundary may move moderately to the right". Test 8's
 * actual guarantee — the index track is identical in both compression
 * states — is unaffected: compression is still not an input to
 * `resolveColumns()`.
 */
export const INDEX_TRACK_XL_L = 260;
export const INDEX_TRACK_M = 236;

/**
 * PAF-R1.2 CLOSURE — THE 1072px CROSSOVER.
 *
 * The centre is the analytical reading surface and takes precedence over the
 * previous boundary (CTO ruling). Its target is a ~560px prose measure.
 *
 * THE ARITHMETIC, because it is not the arithmetic the closure was first
 * written against. With the M tracks the centre is `w - 236 - 276 = w - 512`,
 * so the M geometry reaches 560 at exactly w = 1072. 1072 is therefore the
 * width at and above which the EXISTING M tracks are already sufficient —
 * it is NOT a width at which the wider L tracks become affordable. Starting
 * L at 1072 would give `1072 - 260 - 296 = 516` and deepen the deficit
 * rather than close it. So L is unchanged at >= 1280, M is unchanged and
 * now begins at 1072, and the band below it gets a state of its own.
 *
 * M_NARROW (1024..1071) is the narrowest three-column split that keeps the
 * target AND every preserved element:
 *
 *   centre  = 1024 - 212 - 252 = 560 at the bottom of the band, 607 at the top
 *   index   = 212 -> 120.4px of label area at JetBrains Mono's 0.6em advance
 *             plus 0.09em tracking. The longest label word in either
 *             language is the Polish 16-character one at 115.9px, so it
 *             wraps BETWEEN words and is never broken through a word or
 *             truncated. The dedicated count column is untouched: the badge
 *             is `shrink-0` with its own `min-w-[26px]` track.
 *   rail    = 252 -> the EN precision sentence sets on one line (233.6px);
 *             the longer PL one wraps. Geography persists, as it must.
 *
 * Nothing is hidden and nothing scrolls horizontally at any width in this
 * band. `breakpointSweep()` below proves the target across the whole
 * supported range rather than at sampled widths.
 */
export const M_L_CROSSOVER = 1072;
export const INDEX_TRACK_M_NARROW = 212;
export const RAIL_TRACK_M_NARROW = 252;

/** The prose measure the centre is held to wherever the frame is a column grid. */
export const CENTRE_READING_TARGET = 560;

export interface ColumnTracks {
  readonly breakpoint: FrameBreakpoint;
  /** null at S — the index becomes a chip row inside row 1 (§3.2). */
  readonly indexWidth: number | null;
  /** null at XS only: the right column persists at every desktop width. */
  readonly rightWidth: number | null;
  readonly indexIsChipRow: boolean;
  /** XS hands off to the mobile model in `08`; the frame does not apply. */
  readonly frameApplies: boolean;
  /** Centre content max-width; null means "no cap at this width". */
  readonly centreMaxWidth: number | null;
}

export function resolveBreakpoint(viewportWidth: number): FrameBreakpoint {
  if (viewportWidth >= 1600) return 'XL';
  if (viewportWidth >= 1280) return 'L';
  if (viewportWidth >= M_L_CROSSOVER) return 'M';
  if (viewportWidth >= 1024) return 'M_NARROW';
  if (viewportWidth >= 768) return 'S';
  return 'XS';
}

export function resolveColumns(viewportWidth: number): ColumnTracks {
  const breakpoint = resolveBreakpoint(viewportWidth);

  switch (breakpoint) {
    case 'XL':
      return { breakpoint, indexWidth: 260, rightWidth: 296, indexIsChipRow: false, frameApplies: true, centreMaxWidth: 1100 };
    case 'L':
      return { breakpoint, indexWidth: 260, rightWidth: 296, indexIsChipRow: false, frameApplies: true, centreMaxWidth: null };
    case 'M':
      return { breakpoint, indexWidth: 236, rightWidth: 276, indexIsChipRow: false, frameApplies: true, centreMaxWidth: null };
    case 'M_NARROW':
      return {
        breakpoint,
        indexWidth: INDEX_TRACK_M_NARROW,
        rightWidth: RAIL_TRACK_M_NARROW,
        indexIsChipRow: false,
        frameApplies: true,
        centreMaxWidth: null,
      };
    case 'S':
      // "Index column becomes a 36px chip row inside row 1, beneath the
      // brief. Right column persists — geography is the last thing to
      // leave." (§3.2)
      return { breakpoint, indexWidth: null, rightWidth: 268, indexIsChipRow: true, frameApplies: true, centreMaxWidth: null };
    case 'XS':
    default:
      return { breakpoint, indexWidth: null, rightWidth: null, indexIsChipRow: false, frameApplies: false, centreMaxWidth: null };
  }
}

/**
 * The centre width at a viewport width, for the column-grid breakpoints.
 * Returns null where the index is not a fixed column (S) or the frame does
 * not apply (XS) — those are a different layout model, not a narrower one.
 */
export function centreWidthFor(viewportWidth: number): number | null {
  const c = resolveColumns(viewportWidth);
  if (!c.frameApplies || c.indexIsChipRow || c.indexWidth === null || c.rightWidth === null) return null;
  return viewportWidth - c.indexWidth - c.rightWidth;
}

/**
 * Every column-grid width from 1024 up, and whether it holds the reading
 * target. Exists so the guarantee is swept rather than sampled.
 */
export function breakpointSweep(from = 1024, to = 2560): ReadonlyArray<{
  readonly width: number;
  readonly centre: number;
  readonly holdsTarget: boolean;
}> {
  const out: Array<{ width: number; centre: number; holdsTarget: boolean }> = [];
  for (let width = from; width <= to; width += 1) {
    const centre = centreWidthFor(width);
    if (centre === null) continue;
    out.push({ width, centre, holdsTarget: centre >= CENTRE_READING_TARGET });
  }
  return out;
}

/** F-2 / Test 8: the index track is not a function of `compressed`. */
export function indexTrackWidth(viewportWidth: number, _compressed: boolean): number | null {
  return resolveColumns(viewportWidth).indexWidth;
}
