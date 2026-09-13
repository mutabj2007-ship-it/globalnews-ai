/**
 * PART IV §6.1a — THE WATCH CTA EARNS ITS PROMINENCE.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE SENTENCE THE WHOLE LADDER IMPLEMENTS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * "A filled mint button against a name the user has not yet read is an ASK, not
 * an offer."
 *
 * So the control does not start prominent and it is never made prominent by the
 * product's wish to sell. It is promoted only once the reader has enough context
 * to know what they would be watching — which means prominence is a FUNCTION OF
 * THE READER'S ATTENTION, not of the page's intent.
 *
 *   STAGE 1  HOVER      no watch affordance at all — identity and counts only
 *   STAGE 2  SELECTED   quiet mint glyph in the callout; recognisable, not loud
 *   STAGE 3  OPENED     outline mint, full width, EQUAL weight with Follow/Ask
 *   STAGE 4  UNDERSTOOD filled mint, sole primary — only now is it dominant
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PROMOTION IS A CROSS-FADE, NOT AN ARRIVAL
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * "Promotion is a cross-fade of the SAME control in the SAME position. Never a
 * new element appearing, never a nudge, never motion on the map."
 *
 * A button that appears is an interruption; a button that firms up is an
 * observation. The component therefore renders one element at every stage and
 * changes only its treatment — the ladder returns a STAGE, never a decision
 * about whether to mount something.
 *
 * "Demotion does not occur within a session": once understood, a subject stays
 * understood, so `promote` only ever moves forward.
 */

export type WatchCtaStage = 'HOVER' | 'SELECTED' | 'OPENED' | 'UNDERSTOOD';

export const WATCH_CTA_STAGES: readonly WatchCtaStage[] = [
  'HOVER',
  'SELECTED',
  'OPENED',
  'UNDERSTOOD',
];

/**
 * The five things that count as understanding, from §6.1a. Each is evidence the
 * reader engaged with the SUBJECT rather than with the interface.
 */
export type UnderstandingSignal =
  | 'ASSESSMENT_SCROLLED'
  | 'ASK_ANSWERED'
  | 'SOURCE_OPENED'
  | 'DWELL_REACHED'
  | 'ARRIVED_FROM_WATCHBOARD';

export const UNDERSTANDING_SIGNALS: readonly UnderstandingSignal[] = [
  'ASSESSMENT_SCROLLED',
  'ASK_ANSWERED',
  'SOURCE_OPENED',
  'DWELL_REACHED',
  'ARRIVED_FROM_WATCHBOARD',
];

/**
 * The dwell threshold, in milliseconds.
 *
 * A DECLARED PLACEHOLDER like every other figure in Part IV — long enough that
 * a glance does not promote, short enough that genuine reading does. It is named
 * here so the one place it is tuned is obvious.
 */
export const DWELL_THRESHOLD_MS = 12000;

export interface WatchCtaInput {
  /** Is a subject selected at all? Nothing below SELECTED without one. */
  readonly selected: boolean;
  /** Is the intelligence card open, rather than just the map callout? */
  readonly cardOpen: boolean;
  /** Any one of these promotes to UNDERSTOOD. */
  readonly signals: ReadonlySet<UnderstandingSignal>;
}

/**
 * The stage, computed rather than stored.
 *
 * Deriving it means the ladder cannot drift out of step with the surface: there
 * is no "current stage" that something forgot to update, and the same input
 * always yields the same treatment.
 */
export function watchCtaStage(input: WatchCtaInput): WatchCtaStage {
  if (!input.selected) return 'HOVER';
  if (!input.cardOpen) return 'SELECTED';

  return input.signals.size > 0 ? 'UNDERSTOOD' : 'OPENED';
}

/** Stage 1 shows nothing at all — §6.1a's "no watch affordance". */
export function watchCtaIsVisible(stage: WatchCtaStage): boolean {
  return stage !== 'HOVER';
}

/**
 * Whether the CTA is the sole full-width primary.
 *
 * TRUE ONLY AT STAGE 4, which is the resolution §14.3 asks for: the action
 * cluster has no room for a fourth primary, so Watch takes the single primary
 * slot — but only once it has been earned, and Follow and Ask keep equal weight
 * beside it until then. At every earlier stage the accepted cluster is untouched.
 */
export function watchCtaIsSolePrimary(stage: WatchCtaStage): boolean {
  return stage === 'UNDERSTOOD';
}

/**
 * Monotonic promotion. Demotion does not occur within a session, so a signal set
 * only ever grows — this helper exists so callers add to it rather than
 * replacing it and accidentally moving a reader backwards.
 */
export function promote(
  signals: ReadonlySet<UnderstandingSignal>,
  signal: UnderstandingSignal,
): ReadonlySet<UnderstandingSignal> {
  if (signals.has(signal)) return signals;

  const next = new Set(signals);

  next.add(signal);

  return next;
}
