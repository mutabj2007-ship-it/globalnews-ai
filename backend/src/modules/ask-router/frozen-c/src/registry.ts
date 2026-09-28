/**
 * ASK R2 CORE ROUTER — CAPABILITY REGISTRY AND EVIDENCE-CLASS BOUNDARY
 *
 * Main's measurement is the whole content of this file:
 *
 *   analysis.module.ts:27  imports: [NewsModule, AuthModule, HistoryModule]
 *   "ASK CAN REACH NEWS REPORTING AND NOTHING ELSE. One evidence class is wired;
 *    six are named by the instruction."
 *
 * And the generalised honesty rule, from the landed source-attributed module:
 *   "Answering a question about one publisher with another publisher's reporting is
 *    not a smaller failure than answering nothing — it is a different and worse one."
 *
 * REGISTERED IS NOT BOUND. That distinction is the reason `REGISTERED_UNBOUND` exists
 * as its own state: Conflict is the one registered specialist domain and MA §6 still
 * lists its assessment payload, DTO, service contract and HTTP route as missing, while
 * F's Support audit measured `ConflictAssessmentRail` at 0 non-spec referrers. Handing
 * a reader to a surface nobody can open has already shipped once in this product.
 */

import type { CapabilityState, EvidenceClass, MultiStoryAction, RefusalCode } from './ports.js';

/**
 * The capability map, as measured by Main at the approved baseline.
 * This is the one table that decides whether a plan can be honoured.
 */
export const CAPABILITY_MAP: Readonly<Record<EvidenceClass, CapabilityState>> = {
  /** Wired. The only evidence class Ask can reach. */
  NEWS_REPORTING: 'BOUND',
  /**
   * The producer is ratified — the real NISR August 2026 All Rwanda CPI observation,
   * reference period 2026-08 — and it is NOT REACHABLE FROM ASK. Main's grep over the
   * 4,531-line service for official-data/snapshot/economy returned one hit, "the word
   * 'economy' in a prose comment".
   */
  OFFICIAL_ARTIFACT: 'NO_CAPABILITY',
  /** Registry exists, one domain registers, `SpecialistModule` adds no route. */
  SPECIALIST_CLAIM: 'REGISTERED_UNBOUND',
  /** Unplumbed rather than unbuilt: the service signature has six positional parameters and none is an identity. */
  PERSONAL_LIBRARY: 'IDENTITY_GATED',
  /** Refused by an accepted gate, not merely absent. F: 15 blocking conditions, 4 untradeable. */
  UPLOADED_DOCUMENT: 'SECURITY_HOLD',
  /** Available — but see `MODEL_PRIOR` rule below. It is not a gap-filler. */
  MODEL_PRIOR: 'BOUND',
  /** E1 area 18: "ABSENT — and must stay absent." */
  COMPUTATION: 'NOT_IMPLEMENTED',
};

/** States in which a required evidence class cannot be honoured. */
const UNMET_STATES: readonly CapabilityState[] = [
  'NO_CAPABILITY',
  'REGISTERED_UNBOUND',
  'SECURITY_HOLD',
  'NOT_IMPLEMENTED',
];

export function isUnmet(state: CapabilityState): boolean {
  return UNMET_STATES.includes(state);
}

/** The refusal CODE for an unmet class. Codes only — the frontend owns every word. */
export function refusalForUnmet(evidenceClass: EvidenceClass): RefusalCode {
  switch (evidenceClass) {
    case 'UPLOADED_DOCUMENT':
      return 'SECURITY_HOLD_UPLOAD';
    case 'COMPUTATION':
      return 'NO_EXECUTOR_COMPUTATION';
    case 'SPECIALIST_CLAIM':
      return 'SPECIALIST_NOT_BOUND';
    default:
      return 'NO_CAPABILITY';
  }
}

/* ------------------------------------------------------------------ *
 * SPECIALIST REGISTRY PORT
 * ------------------------------------------------------------------ */

/**
 * `specialist-claim.ts` states what is deliberately absent:
 *
 *   "There is no mapping from a user's words to a `QuestionKind` ...
 *    Intent classification is a separate contract and it is not Support's."
 *
 * That hole is deliberate and this router DOES NOT FILL IT. The router asks the
 * registry about an analytical domain; it owns no analytical-domain-to-specialist-domain
 * table of its own. A probe asserts that `src/` contains no specialist domain literal.
 */
export interface SpecialistResolution {
  /** Is a specialist domain registered for this analytical domain? */
  readonly registered: boolean;
  /** Is there a transport that can actually execute an assessment? */
  readonly bound: boolean;
}

export interface SpecialistRegistryPort {
  resolve(analyticalDomain: string): SpecialistResolution;
}

/* ------------------------------------------------------------------ *
 * SELECTION MINIMA
 * ------------------------------------------------------------------ */

/**
 * `MAX_SELECTED_STORIES = 8` and the existence of per-action minima in
 * `MULTI_STORY_MIN_STORIES` are attested and accepted. The individual minimum VALUES
 * are not attested in the register, so only the one that is logically entailed by the
 * action is declared here and the rest default to 1.
 *
 * UNATTESTED_MINIMA records that honestly rather than presenting a guess as measurement.
 */
export const UNATTESTED_MINIMA = true;

export function minimumStoriesFor(action: MultiStoryAction): number {
  switch (action) {
    case 'COMPARE':
    case 'EXPLAIN_DISAGREEMENTS':
    case 'WHAT_CHANGED':
      // A comparison of one thing is not a comparison. Entailed, not guessed.
      return 2;
    default:
      return 1;
  }
}
