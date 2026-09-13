import type { SituationIdentity, SituationObservation } from './situation.contract';
import type { AttachmentDecision, SituationAnchor } from './situation-identity.port';

/**
 * SITUATION MEMORY — S1-R2. THE PHASE GATE, AS A TYPE.
 *
 * G's recommendation, accepted by the CTO: "Do not let tier 2 govern anything
 * yet." Phase 1 computes the decision for every observation, RECORDS it, and
 * acts on none of it.
 *
 * The consequence for persistence is precise and easy to get wrong: in phase 1
 * the store cannot know WHICH situation an observation belongs to, so it must
 * not create or attach one. That is not a failure — it is the expected outcome
 * of every observation until the threshold is validated, and modelling it as an
 * error would make the normal case look like a fault in the logs.
 *
 * So resolution returns a RESULT, not an identity:
 *
 *   { outcome: 'SHADOW_ONLY', identity: null, decision }   ◀ phase 1, always
 *   { outcome: 'RESOLVED',    identity,       decision }   ◀ phase 2, later
 *
 * Nothing here decides when phase 2 begins. G's exit criterion is a live-scored
 * distribution with visible bimodal separation and a threshold chosen from THAT.
 */

export type AttachmentOutcome = 'SHADOW_ONLY' | 'RESOLVED';

export interface AttachmentResolution {
  readonly outcome: AttachmentOutcome;
  /** Null whenever the outcome is SHADOW_ONLY. Never a guess. */
  readonly identity: SituationIdentity | null;
  /** The decision to record, whatever the outcome. */
  readonly decision: AttachmentDecision;
  /** The candidate the decision was about, when there was one. */
  readonly candidate: SituationAnchor | null;
}

/**
 * WHAT THE SHADOW RECORD KEEPS.
 *
 * ATTACH_RECOMMENDED     the policy would attach, and did not.
 * OPEN_NEW_RECOMMENDED   the policy would open a new situation in this bucket.
 * NO_CANDIDATE           the bucket held nothing to compare against.
 *
 * NO_CANDIDATE is a first-class value rather than an omitted row. A gathered
 * distribution missing its empty-bucket cases is a biased one, and the bias
 * runs towards believing continuity is easier to establish than it is.
 */
export type ShadowRecommendation =
  | 'ATTACH_RECOMMENDED'
  | 'OPEN_NEW_RECOMMENDED'
  | 'NO_CANDIDATE';

export function recommendationFrom(
  decision: AttachmentDecision,
  anchorCount: number,
): ShadowRecommendation {
  if (anchorCount === 0) {
    return 'NO_CANDIDATE';
  }
  return decision.attached ? 'ATTACH_RECOMMENDED' : 'OPEN_NEW_RECOMMENDED';
}

/**
 * PHASE 1. Never resolves an identity, whatever the score says.
 *
 * The `attached: true` case is the one that matters here: the policy recommends
 * attaching and this function STILL returns null. That is the shadow contract
 * in one line, and the spec asserts it directly.
 */
export function resolveShadowOnly(
  _observation: SituationObservation,
  decision: AttachmentDecision,
  candidate: SituationAnchor | null,
): AttachmentResolution {
  return { outcome: 'SHADOW_ONLY', identity: null, decision, candidate };
}
