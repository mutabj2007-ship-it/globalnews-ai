import type { AskV2FollowedOutcome } from '@/lib/api/askV2Api';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CLAUDE DESIGN R3 · D08 — HOW ONE FOLLOWED-CHECK OUTCOME PRESENTS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CTO directive 9 Oct 2026: "Use an exhaustive typed mapping, one compact status and appropriate
 * detail per result, not seven simultaneous giant pills. Keep INSUFFICIENT_BASELINE distinct from
 * INCOMPLETE_CHECK and UNCHANGED."
 *
 * CLAUDE CODE R3-H01 §2: "The pill↔outcome map must be total: use `Record<AskV2FollowedOutcome,
 * …>`, so an eighth outcome fails to compile." That is the whole reason this is a `Record` over
 * the union and not a lookup with a default: a new backend outcome must break the build rather
 * than fall through to a sentence that is not true of it.
 *
 * WHAT THIS MODULE DOES NOT DO:
 *   · It holds no words. Every label and every detail sentence is `followStrings(locale).outcome`
 *     and `.outcomeDetail` — Claude L's territory, EN and PL qualified, five locales still
 *     drafts. Nothing here is translated, reworded or defaulted to English.
 *   · It does not merge outcomes. All seven keep their own label and their own detail; `tone` is
 *     only how the one compact status is PAINTED, and four tones over seven outcomes is what
 *     stops the row from becoming seven pills competing for the same glance.
 *   · It decides nothing about materiality, counts or freshness. Those are the server's.
 *
 * WHY THESE FOUR TONES, AND WHY THE GROUPING IS A TRUTH RULE RATHER THAN A STYLE CHOICE:
 *
 *   REPORTED    something was found and admitted: NEW_EVIDENCE, MATERIAL_CHANGE, CORRECTION.
 *   SETTLED     the check COMPLETED and found nothing new: UNCHANGED, NO_RELEVANT_UPDATE.
 *   BASELINE    there was nothing to compare with, so this check became the starting point:
 *               INSUFFICIENT_BASELINE. It is informational. It is NOT "no change" — there was
 *               no previous answer for anything to change from.
 *   INCOMPLETE  the check did not complete: INCOMPLETE_CHECK. The baseline is kept.
 *
 * INCOMPLETE_CHECK must never share SETTLED. The programme's own wording rule is that "an
 * incomplete check never reads as 'nothing changed'" and that NOT_ASSESSED never silently
 * becomes "nothing happened"; a shared tone would say exactly that in colour, under a label
 * that says the opposite in words. INSUFFICIENT_BASELINE must never share SETTLED either, for
 * the same reason read from the other end: an absent baseline is not a quiet result.
 *
 * `attention` marks the two tones a reader should look at, and is deliberately NOT urgency:
 * REPORTED because there is something new to read, INCOMPLETE because the check owes them
 * another run. Nothing here manufactures urgency, counts anything, or ranks severity.
 */
export type FollowOutcomeTone = 'REPORTED' | 'SETTLED' | 'BASELINE' | 'INCOMPLETE';

export interface FollowOutcomePresentation {
  readonly tone: FollowOutcomeTone;
  /** Worth the reader's eye. Not urgency, not severity, not a count. */
  readonly attention: boolean;
}

export const FOLLOW_OUTCOME_PRESENTATION: Readonly<
  Record<AskV2FollowedOutcome, FollowOutcomePresentation>
> = Object.freeze({
  /* Newly admitted relevant evidence, including reporting found now but published earlier. */
  NEW_EVIDENCE: { tone: 'REPORTED', attention: true },
  /* A supported change in the underlying event or condition. */
  MATERIAL_CHANGE: { tone: 'REPORTED', attention: true },
  /* A publisher the baseline relied on led with a correction notice. Flagged, never adjudicated. */
  CORRECTION: { tone: 'REPORTED', attention: true },
  /* Completed; the same relevant evidence. New wording alone is never a change. */
  UNCHANGED: { tone: 'SETTLED', attention: false },
  /* Completed; no relevant evidence at all. This never means nothing is happening. */
  NO_RELEVANT_UPDATE: { tone: 'SETTLED', attention: false },
  /* No valid prior comparable evidence: this check IS the new starting point. */
  INSUFFICIENT_BASELINE: { tone: 'BASELINE', attention: false },
  /* The search failed or a reader was degraded. The baseline is kept, not replaced. */
  INCOMPLETE_CHECK: { tone: 'INCOMPLETE', attention: true },
});

export function followOutcomePresentation(
  outcome: AskV2FollowedOutcome,
): FollowOutcomePresentation {
  return FOLLOW_OUTCOME_PRESENTATION[outcome];
}
