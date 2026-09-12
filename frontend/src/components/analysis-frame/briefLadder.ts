/**
 * PAF-R1 — the compressed brief's width yielding ladder.
 *
 * Pure, so the fitting invariant can be swept rather than eyeballed.
 *
 * WHY AN EXPLICIT ORDER EXISTS AT ALL (03 §2a): the clause is the only
 * flexible item in the row, so without an order it absorbs 100% of any
 * deficit and collapses to zero — taking the conclusion with it while
 * the fixed telemetry cluster stays at full size. That inverts the
 * band's entire purpose.
 *
 * THE THRESHOLDS ARE NOT DESIGN CHOICES. Each is the width at which the
 * next retained set stops satisfying
 *
 *     sum(retained widths) <= band content width   (band - 52px padding)
 *
 * Handoff §4.3 states them normatively as 790 / 724 / 612 / 557 and this
 * module implements exactly those; `fits()` re-derives the inequality so
 * a future width change cannot silently break it.
 *
 * MEASURE THE BAND, NEVER DERIVE IT. The caller must pass the band
 * element's own border-box width from a ResizeObserver. `viewport −
 * column` is wrong at three of five breakpoints, and `contentRect`
 * excludes the 52px of horizontal padding and fires every threshold one
 * step early.
 */

/** Horizontal padding inside the band, excluded from the content budget. */
export const BAND_PADDING = 52;

/** Measured item widths from 03 §2a, including their leading gaps. */
export const ITEM_WIDTH = {
  glyph: 23,
  /** 32ch floor. The title is a DIRECT flex child of the band — see below. */
  titleFloor: 306,
  clause: 100,
  meterSegments: 45,
  /** The word MODERATE. Never yields. */
  evidenceWord: 62,
  locationToken: 65,
  controlFull: 86,
  controlGlyph: 28,
} as const;

const GAPS = { afterTitle: 12, afterClause: 14, afterBars: 10, afterWord: 14 } as const;

export const THRESHOLD = {
  locationToken: 790,
  clause: 724,
  meterSegments: 612,
  controlLabel: 557,
} as const;

/**
 * Below this band width the retained set no longer fits and the title
 * ellipsises inside its 32ch floor. 03 §2a acknowledges this explicitly:
 * the narrowest supported desktop band is 468px at S, "where the title
 * ellipsises 4px inside its floor". Stated, not hidden.
 */
export const TITLE_FLOOR_HOLDS_TO = 499;

export interface BriefBandLayout {
  readonly bandWidth: number;
  readonly contentWidth: number;
  readonly showLocationToken: boolean;
  readonly showClause: boolean;
  readonly showMeterSegments: boolean;
  readonly controlLabelled: boolean;
  /** Never false. Listed so the invariant is assertable, not assumed. */
  readonly showTitle: true;
  /** Never false. */
  readonly showEvidenceWord: true;
  /** Never false. */
  readonly showControl: true;
  readonly retainedWidth: number;
  readonly fits: boolean;
  readonly titleEllipsised: boolean;
}

export function resolveBriefBand(bandWidth: number, clauseAvailable: boolean): BriefBandLayout {
  const contentWidth = Math.max(0, bandWidth - BAND_PADDING);

  const showLocationToken = bandWidth >= THRESHOLD.locationToken;
  // A clause that the contract never supplied is not "yielded" — it was
  // never there. See RULING 2: an ordinary analysis has no thesis clause
  // and the band must never fabricate one from the summary paragraph.
  const showClause = clauseAvailable && bandWidth >= THRESHOLD.clause;
  const showMeterSegments = bandWidth >= THRESHOLD.meterSegments;
  const controlLabelled = bandWidth >= THRESHOLD.controlLabel;

  let retained = ITEM_WIDTH.glyph + ITEM_WIDTH.titleFloor + GAPS.afterTitle;
  if (showClause) retained += ITEM_WIDTH.clause + GAPS.afterClause;
  if (showMeterSegments) retained += ITEM_WIDTH.meterSegments + GAPS.afterBars;
  retained += ITEM_WIDTH.evidenceWord + GAPS.afterWord;
  retained += controlLabelled ? ITEM_WIDTH.controlFull : ITEM_WIDTH.controlGlyph;
  if (showLocationToken) retained += ITEM_WIDTH.locationToken;

  return {
    bandWidth,
    contentWidth,
    showLocationToken,
    showClause,
    showMeterSegments,
    controlLabelled,
    showTitle: true,
    showEvidenceWord: true,
    showControl: true,
    retainedWidth: retained,
    fits: retained <= contentWidth,
    titleEllipsised: retained > contentWidth,
  };
}
