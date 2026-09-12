/**
 * H-C2 TRANCHE 3 — SOURCES CARD GEOMETRY, UNDER DESIGN-C2 LOCK 1 AND LOCK 2.
 *
 * WHAT CHANGED FROM THE R3 BAND TABLE, AND WHY.
 *
 * R3 stated how many cards must be FULLY VISIBLE per band and let width be
 * derived from the track. LOCK 1 now states the card's own proportions in
 * pixels, and LOCK 2 requires a card-QUANTISED desktop advance ("exactly one
 * card width plus one gap"). A derived width cannot be quantised against
 * without re-deriving the stride on every resize, so the desktop card becomes
 * a locked constant and the band count becomes a CAP on how many of them the
 * strip may show at once. The R3 promise ("three whole cards at 1440") is
 * unchanged; only the mechanism that guarantees it is.
 *
 * THE DESKTOP WIDTH IS PINNED AT 320, THE BOTTOM OF LOCK 1's 320-360 RANGE,
 * AND THAT IS ARITHMETIC RATHER THAN PREFERENCE. Lock 1 fixes four things at
 * once: the image is the full card width at 16:9; the card totals 280-300px;
 * the text block is padded 16px and carries exactly three lines at 12/15/12;
 * and the image is never below 58% of the card. The three locked text lines
 * at their locked sizes cannot render in less than
 *     16 + 16 (padding) + 16.8 (mono) + 5 + 44 (two 15px lines, 44px target)
 *     + 5 + 16.8 (mono)  =  119.6px
 * so the image may be at most 300 - 119.6 = 180.4px, and a 16:9 image of
 * 180.4px belongs to a card 320.7px wide. Every width above ~321 pushes the
 * card past its own locked 300px ceiling. 320 is therefore the only value in
 * Lock 1's stated range that satisfies Lock 1's other three numbers. This is
 * reported to the CTO rather than resolved by softening a lock.
 */

/* ── LOCK 1 — CARD PROPORTIONS ─────────────────────────────────────── */

/** Locked: image region is the full card width at 16:9. */
export const IMAGE_ASPECT_W = 16;
export const IMAGE_ASPECT_H = 9;

/** Locked: "The image region is never less than 58% of the card's total height." */
export const MIN_IMAGE_RATIO = 0.58;

/** Locked: text block padding 16px; image padding 0. */
export const TEXT_PADDING = 16;

/**
 * The three locked text lines plus their padding, measured on the built
 * component. Not a target — a consequence of the locked type scale.
 *   16 + 16 padding · 16.8 mono · 5 gap · 44 title target · 5 gap · 16.8 mono
 */
export const CARD_TEXT_BLOCK = 120;

/** Locked: desktop card width. See the file header for why it is a point. */
export const DESKTOP_CARD_WIDTH = 320;
/** Lock 1's stated desktop range, kept as data so a test can state it. */
export const DESKTOP_CARD_RANGE = [320, 360] as const;

/** Locked: mobile card width is 86% of the viewport, +/-4%. */
export const MOBILE_CARD_PCT = 0.86;
export const MOBILE_CARD_PCT_RANGE = [0.82, 0.9] as const;

/** Locked: gap 14 +/-2 desktop, 12 +/-2 mobile. Section gutter 16 mobile. */
export const GAP_DESKTOP = 14;
export const GAP_MOBILE = 12;
export const SECTION_GUTTER = 16;

/** Locked: radius 10px, image top corners clipped to match. */
export const CARD_RADIUS = 10;

/** Locked: desktop card totals 280-300px. */
export const CARD_TOTAL_RANGE = [280, 300] as const;

/** Lock 1: "No image element under 96px in either dimension anywhere." */
export const MIN_IMAGE_EDGE = 96;
/** Lock 1 mobile floor for the image region. */
export const MOBILE_IMAGE_MIN = 140;
/** Lock 1 desktop floor for the image region. */
export const DESKTOP_IMAGE_MIN = 180;

/* ── LOCK 2 — DESKTOP SOURCE NAVIGATION ────────────────────────────── */

/** Locked: "Peek 12-48px of the next card always visible where more exist." */
export const PEEK_MIN = 12;
export const PEEK_MAX = 48;
/** Locked: Previous/Next are 32x32 targets, 8px clear, inset 8px. */
export const NAV_TARGET = 32;
export const NAV_CLEAR = 8;
export const NAV_INSET = 8;
/** Locked: "Snap animation over 240ms" is prohibited. This is the ceiling. */
export const SNAP_MS = 240;
/** The breakpoint at which Lock 2's desktop navigation model applies. */
export const DESKTOP_FROM = 768;

/* ── DERIVED GEOMETRY ──────────────────────────────────────────────── */

export function imageHeightFor(cardWidth: number): number {
  return Math.round((cardWidth * IMAGE_ASPECT_H) / IMAGE_ASPECT_W);
}

export function cardHeightFor(cardWidth: number): number {
  return imageHeightFor(cardWidth) + CARD_TEXT_BLOCK;
}

/** Lock 1's governing proportion rule, as a number rather than a promise. */
export function imageRatioFor(cardWidth: number): number {
  return imageHeightFor(cardWidth) / cardHeightFor(cardWidth);
}

/** The locked card width at a given viewport. */
export function cardWidthFor(viewportWidth: number): number {
  if (viewportWidth >= DESKTOP_FROM) return DESKTOP_CARD_WIDTH;
  return Math.round(viewportWidth * MOBILE_CARD_PCT);
}

export function gapFor(viewportWidth: number): number {
  return viewportWidth >= DESKTOP_FROM ? GAP_DESKTOP : GAP_MOBILE;
}

/* ── THE R3 BAND COUNTS, RETAINED AS A CAP ─────────────────────────── */

export interface SourceCardBand {
  readonly from: number;
  /**
   * Cards that must be FULLY visible at this band — a FLOOR, not a ceiling.
   *
   * CTO RULING, H-C2 RUNTIME CORRECTION C1. R3's count was implemented as a
   * `Math.min` over what the lane could actually hold, which made it a cap.
   * Measured on the converged runtime with six sources: 374px of unused lane
   * at 1440, 854px at 1920 and 1494px at 2560 — the dead space GREW with the
   * viewport, because the strip stayed pinned at 1066px from 1440 upward.
   *
   * The count is now what it was ruled to be: the number of whole cards a
   * lane is expected to show AT LEAST. A wider lane shows more of them; a
   * lane too narrow to reach the floor drops a column and says so through
   * `droppedColumn`, exactly as before.
   */
  readonly visible: number;
}

export const SOURCE_CARD_BANDS: readonly SourceCardBand[] = [
  { from: 1440, visible: 3 },
  { from: 1024, visible: 2 },
  { from: 768, visible: 2 },
  { from: 0, visible: 1 },
] as const;

export function resolveSourceCardBand(viewportWidth: number): SourceCardBand {
  for (const band of SOURCE_CARD_BANDS) {
    if (viewportWidth >= band.from) return band;
  }
  return SOURCE_CARD_BANDS[SOURCE_CARD_BANDS.length - 1] as SourceCardBand;
}

export interface StripLayout {
  readonly cardWidth: number;
  readonly gap: number;
  /** One card plus one gap. Lock 2's quantum. */
  readonly stride: number;
  /** Cards fully visible at rest. */
  readonly visible: number;
  /** Visible sliver of the following card, px. 0 when nothing follows. */
  readonly peek: number;
  /** Width the scroll viewport is pinned to, so the peek cannot exceed 48. */
  readonly viewportWidth: number;
  readonly imageHeight: number;
  readonly cardHeight: number;
  /** True when the band's card count could not be honoured at this width. */
  readonly droppedColumn: boolean;
}

/**
 * @param trackWidth     usable width available to the strip, px.
 * @param viewportWidth  selects the band, the card width and the gap.
 * @param count          how many source cards exist. Decides whether a peek
 *                       is owed at all — Lock 2 requires one only "where
 *                       more exist".
 *
 * WHY THE SCROLL VIEWPORT IS PINNED RATHER THAN LEFT TO FILL THE LANE.
 * A full-lane scroller shows whatever remains of the next card, which at a
 * 1100px lane is 112px — Lock 2 caps the peek at 48. Pinning the viewport to
 * `visible * stride + peek` makes the peek an exact locked value instead of a
 * remainder, and it is also what makes the quantised advance land on a card
 * edge at the strip's left inset.
 */
export function resolveStrip(
  trackWidth: number,
  viewportWidth: number,
  count: number,
): StripLayout {
  const band = resolveSourceCardBand(viewportWidth);
  const cardWidth = cardWidthFor(viewportWidth);
  const gap = gapFor(viewportWidth);
  const stride = cardWidth + gap;

  /*
    How many whole cards plus a minimum peek the lane can hold.

    C1 — `band.visible` IS NO LONGER IN THIS EXPRESSION. It was the cap; it is
    now the floor the band is measured against below. What bounds `visible` is
    the lane itself and the number of sources that exist — nothing else, so a
    wide desktop consumes the width available to it instead of stopping at a
    fixed small number.
  */
  const fits = Math.max(1, Math.floor((trackWidth - PEEK_MIN) / stride));
  const visible = Math.max(1, Math.min(fits, Math.max(1, count)));

  const hasMore = count > visible;
  const remainder = trackWidth - visible * stride;
  const peek = hasMore ? Math.max(PEEK_MIN, Math.min(PEEK_MAX, remainder)) : 0;

  const pinned = hasMore
    ? visible * stride + peek
    : visible * cardWidth + Math.max(0, visible - 1) * gap;

  return {
    cardWidth,
    gap,
    stride,
    visible,
    peek,
    viewportWidth: Math.min(trackWidth, pinned),
    imageHeight: imageHeightFor(cardWidth),
    cardHeight: cardHeightFor(cardWidth),
    /*
      The band's floor could not be honoured by this lane — the same fact
      `droppedColumn` always described, now computed against `fits` because
      `visible` is additionally limited by how many sources exist, and having
      only two sources is not a dropped column.
    */
    droppedColumn: fits < band.visible,
  };
}

/* ── LOCK 2 — POSITION READOUT AND BOUNDARY STATE ──────────────────── */

export interface StripPosition {
  /** 1-based index of the first fully visible card. */
  readonly first: number;
  /** 1-based index of the last fully visible card. */
  readonly last: number;
  readonly total: number;
  readonly atStart: boolean;
  readonly atEnd: boolean;
}

/**
 * Lock 2's readout, computed from scroll offset rather than from a page
 * counter, so it stays correct after a native trackpad scroll as well as
 * after a control activation. C2-7 asks that it be correct after EVERY
 * advance; deriving it is the only way that is true of scrolls it did not
 * cause.
 */
export function stripPosition(
  scrollLeft: number,
  stride: number,
  visible: number,
  total: number,
): StripPosition {
  if (total <= 0) return { first: 0, last: 0, total: 0, atStart: true, atEnd: true };
  const maxIndex = Math.max(0, total - visible);
  const index = Math.max(0, Math.min(maxIndex, Math.round(scrollLeft / stride)));
  const first = index + 1;
  const last = Math.min(total, index + visible);
  return {
    first,
    last,
    total,
    atStart: index <= 0,
    atEnd: index >= maxIndex,
  };
}

/** Lock 2: advancing moves by exactly one card width plus one gap. */
export function advanceOffset(scrollLeft: number, stride: number, direction: -1 | 1, total: number, visible: number): number {
  const maxIndex = Math.max(0, total - visible);
  const index = Math.max(0, Math.min(maxIndex, Math.round(scrollLeft / stride)));
  const next = Math.max(0, Math.min(maxIndex, index + direction));
  return next * stride;
}

/* ── VERTICAL COLLAPSE — R3, UNCHANGED ─────────────────────────────── */

/** Section header (label + count + navigation row). */
export const SOURCES_SECTION_CHROME = 34;

export function sourceSectionHeight(cardHeight: number): number {
  return SOURCES_SECTION_CHROME + cardHeight;
}

export function sourcesMustCollapse(availableHeight: number, cardHeight: number): boolean {
  return availableHeight > 0 && availableHeight < sourceSectionHeight(cardHeight);
}
