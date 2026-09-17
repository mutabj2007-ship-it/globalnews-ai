import type { AnalysisApiResponse } from '@globalnews-ai/shared';

import type { PrimaryDimensionKey } from './analysisDimensions';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * J-2 — WHY THIS DIMENSION IS EMPTY, IN WORDS A READER CAN USE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CTO ruling: *"Do not collapse both into an indistinguishable generic zero if
 * the backend already knows which occurred … Do not expose internal
 * implementation jargon to normal readers. The user-facing meaning should remain
 * truthful."*
 *
 * The backend now reports, per dimension, how many entries the model generated
 * and how many survived grounding. Those counts are DIAGNOSTICS and must never
 * be rendered: a reader does not need "3 generated, 0 accepted", they need to
 * know whether the reporting was silent or whether it did not support what was
 * drafted. Those are opposite facts, and one generic sentence asserted the first
 * whichever was true.
 *
 * ─── WHY THIS IS NOT A SECOND RELEVANCE JUDGEMENT ─────────────────────────
 *
 * Nothing here inspects content, re-scores anything, or decides what should have
 * been admitted. It reads two integers the validator already produced. A
 * dimension with even one surviving entry is simply NOT EMPTY and gets no
 * sentence at all.
 *
 * ─── ABSENT COUNTS ARE THEIR OWN ANSWER ───────────────────────────────────
 *
 * `dimensionGrounding` is optional: a result produced before the census existed,
 * or any hand-built test double, carries none. That must read as "no reason
 * available" and fall back to the original generic wording — never be guessed at
 * as one state or the other.
 */

/** The response field each rendered dimension is built from. */
const DIMENSION_FIELDS: Readonly<Partial<Record<PrimaryDimensionKey, string>>> = {
  'why-this-matters': 'relevance',
  'who-is-affected': 'affectedParties',
  'immediate-effects': 'immediateImpacts',
  'key-facts': 'keyFacts',
};

export type DimensionEmptyReason =
  /** The model proposed entries and every one failed grounding. */
  | 'ALL_REJECTED'
  /** The model proposed nothing. The reporting is silent on this dimension. */
  | 'NOTHING_GENERATED'
  /** No census available, or the dimension is not empty. */
  | 'UNKNOWN';

export function dimensionFieldFor(dimension: PrimaryDimensionKey): string | undefined {
  return DIMENSION_FIELDS[dimension];
}

/**
 * Why this dimension shows nothing.
 *
 * Only meaningful when the dimension has zero rendered entries; a caller asks
 * this INSTEAD of printing a generic empty line, not in addition to counting.
 */
export function dimensionEmptyReason(
  response: AnalysisApiResponse,
  dimension: PrimaryDimensionKey,
): DimensionEmptyReason {
  const field = dimensionFieldFor(dimension);
  if (field === undefined) return 'UNKNOWN';

  const census = response.analysis?.dimensionGrounding?.[field];
  if (census === undefined) return 'UNKNOWN';

  if (census.accepted > 0) return 'UNKNOWN';

  return census.generated > 0 ? 'ALL_REJECTED' : 'NOTHING_GENERATED';
}

/**
 * The dictionary key for the sentence to show, or the generic one when the
 * product genuinely cannot say which state this is.
 *
 * Returning a KEY rather than a string keeps every reader-facing word in the
 * dictionaries, where both languages stay in step.
 */
export function dimensionEmptyLabelKey(
  reason: DimensionEmptyReason,
): 'noItemsInDimension' | 'noGroundedItemsInDimension' | 'nothingReportedInDimension' {
  switch (reason) {
    case 'ALL_REJECTED':
      return 'noGroundedItemsInDimension';
    case 'NOTHING_GENERATED':
      return 'nothingReportedInDimension';
    default:
      return 'noItemsInDimension';
  }
}
