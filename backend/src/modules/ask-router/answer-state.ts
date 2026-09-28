/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R2 CONSOLIDATED INTEGRATION R1 · GATE D — EVIDENCE ROLES → ANSWER STATE (§7)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * "No second sufficiency system: A's one pure derivation over the accepted internal
 * evidence state." The accepted internal state is frozen C's RoutingPlan (terminal,
 * required evidence, verification contract) plus what execution actually obtained, by
 * role. This function is the ONE place an answer state is decided; it reads nothing else.
 *
 * The rules §7 names, and where each is enforced:
 *
 *   Reference-only cannot produce Currently Verified
 *       CURRENTLY_VERIFIED requires an OFFICIAL item AND the plan's verification contract
 *       admitting it. REFERENCE never counts toward any required role.
 *   Model memory is non-citable background, never a citation
 *       MODEL_PRIOR is not a role; a plan with no required evidence yields
 *       REFERENCE_BACKGROUND, which the frozen plan already marks non-citable.
 *   Planning inability is not automatically INSUFFICIENT
 *       a non-executable terminal maps to CLARIFICATION_REQUIRED or
 *       CAPABILITY_UNAVAILABLE; INSUFFICIENT is reachable ONLY after execution.
 *   Clarification is a successful terminal costing no provider/model execution
 *       CLARIFICATION_REQUIRED is derived from the plan alone, before any evidence.
 *
 * Codes only; the frontend owns every word.
 */

import type { AskAnswerState, AskEvidenceRole } from '@globalnews-ai/shared';
import type { EvidenceClass, RoutingPlan, VerificationOutcome } from './frozen-c/src/ports';

/** Frozen C's evidence classes, as Ask evidence roles. MODEL_PRIOR has no role. */
export const ROLE_OF_EVIDENCE_CLASS: Readonly<Record<EvidenceClass, AskEvidenceRole | null>> = {
  NEWS_REPORTING: 'REPORTING',
  OFFICIAL_ARTIFACT: 'OFFICIAL',
  SPECIALIST_CLAIM: 'SPECIALIST',
  PERSONAL_LIBRARY: 'PERSONAL',
  UPLOADED_DOCUMENT: 'USER_FILE',
  COMPUTATION: 'COMPUTED',
  MODEL_PRIOR: null,
};

/** What execution obtained. Absent roles obtained nothing. */
export interface ObtainedEvidence {
  /** Count of admitted items per role. REFERENCE items are counted but never satisfy another role. */
  readonly items: Readonly<Partial<Record<AskEvidenceRole, number>>>;
  /** For a current-status plan: the executor's verification result, if it ran one. */
  readonly verification?: VerificationOutcome;
  /**
   * False when execution ran but produced no answer at all (the landed analysis path found
   * no evidence and made no model call). Then there is nothing to present as background.
   */
  readonly producedAnswer?: boolean;
}

export interface AnswerStateDecision {
  readonly state: AskAnswerState;
  /** Stable diagnostic code for telemetry (§19). */
  readonly basis: string;
  /** Roles the plan required that execution did not obtain. */
  readonly missingRoles: readonly AskEvidenceRole[];
}

/** The plan-only decision: terminals that end before any evidence exists. */
export function answerStateBeforeExecution(plan: RoutingPlan): AnswerStateDecision | null {
  switch (plan.terminalState) {
    case 'CLARIFICATION_REQUIRED':
      return { state: 'CLARIFICATION_REQUIRED', basis: 'PLAN_CLARIFICATION', missingRoles: [] };
    case 'BROADENING_OFFERED':
      /* A broader scope is OFFERED, never applied: the reader decides — a clarification. */
      return {
        state: 'CLARIFICATION_REQUIRED',
        basis: 'PLAN_BROADENING_OFFERED',
        missingRoles: [],
      };
    case 'CAPABILITY_UNAVAILABLE':
      return {
        state: 'CAPABILITY_UNAVAILABLE',
        basis: 'PLAN_CAPABILITY_UNAVAILABLE',
        missingRoles: [],
      };
    case 'IDENTITY_REQUIRED':
      return { state: 'CAPABILITY_UNAVAILABLE', basis: 'PLAN_IDENTITY_REQUIRED', missingRoles: [] };
    case 'REFERENCE_BACKGROUND_ONLY':
      return {
        state: 'REFERENCE_BACKGROUND',
        basis: 'PLAN_NO_REQUIRED_EVIDENCE',
        missingRoles: [],
      };
    case 'AWAITING_COMPUTE_CONSENT':
    case 'EXECUTABLE':
      return null;
  }
}

/**
 * THE derivation. For a plan that did not end before execution, `obtained` is required.
 */
export function deriveAnswerState(
  plan: RoutingPlan,
  obtained?: ObtainedEvidence,
): AnswerStateDecision {
  const early = answerStateBeforeExecution(plan);
  /* Nothing was produced: a reference plan must not be shown as an empty "background". */
  if (
    obtained?.producedAnswer === false &&
    (early === null || early.state === 'REFERENCE_BACKGROUND')
  ) {
    return { state: 'INSUFFICIENT', basis: 'NO_ANSWER_PRODUCED', missingRoles: [] };
  }
  if (early !== null) return early;
  if (plan.terminalState === 'AWAITING_COMPUTE_CONSENT') {
    /* Nothing ran: consent is a precondition, not an evidence outcome. */
    return { state: 'CLARIFICATION_REQUIRED', basis: 'AWAITING_COMPUTE_CONSENT', missingRoles: [] };
  }
  const items = obtained?.items ?? {};
  const has = (role: AskEvidenceRole): boolean => (items[role] ?? 0) > 0;

  const requiredRoles = [
    ...new Set(
      plan.evidenceRequests
        .filter((r) => r.required)
        .map((r) => ROLE_OF_EVIDENCE_CLASS[r.evidenceClass])
        .filter((r): r is AskEvidenceRole => r !== null),
    ),
  ];
  const missingRoles = requiredRoles.filter((r) => !has(r));

  /* Current status (frozen ruling 3): the contract's admissible outcomes, and only those. */
  if (plan.verification !== null) {
    const v = obtained?.verification;
    if (
      v === 'CURRENTLY_VERIFIED' &&
      has('OFFICIAL') &&
      plan.verification.admissibleOutcomes.includes(v)
    ) {
      return { state: 'CURRENTLY_VERIFIED', basis: 'OFFICIAL_CURRENT_EVIDENCE', missingRoles };
    }
    if (
      v === 'CURRENT_REPORTING_PARTIAL_VERIFICATION' &&
      (items.REPORTING ?? 0) >= plan.verification.minIndependentFreshSources &&
      plan.verification.admissibleOutcomes.includes(v)
    ) {
      return { state: 'PARTIAL', basis: 'REPORTING_PARTIAL_VERIFICATION', missingRoles };
    }
    return { state: 'INSUFFICIENT', basis: 'VERIFICATION_NOT_MET', missingRoles };
  }

  if (requiredRoles.length === 0) {
    return { state: 'REFERENCE_BACKGROUND', basis: 'NO_REQUIRED_EVIDENCE', missingRoles };
  }
  if (missingRoles.length === 0) {
    return { state: 'CURRENT_REPORTING', basis: 'REQUIRED_EVIDENCE_OBTAINED', missingRoles };
  }
  if (missingRoles.length < requiredRoles.length) {
    return { state: 'PARTIAL', basis: 'SOME_REQUIRED_EVIDENCE_MISSING', missingRoles };
  }
  return { state: 'INSUFFICIENT', basis: 'NO_REQUIRED_EVIDENCE_OBTAINED', missingRoles };
}

/**
 * Volatility guard (A / QQ-9): may a REFERENCE item be used for this plan at all? Only
 * for stable background — never for a current status, a stated window, or a present-
 * tense question that requires reporting.
 */
export function referenceAdmissibleFor(plan: RoutingPlan): boolean {
  return (
    plan.verification === null &&
    !plan.evidenceRequests.some((r) => r.required && r.evidenceClass !== 'MODEL_PRIOR') &&
    (plan.terminalState === 'REFERENCE_BACKGROUND_ONLY' ||
      plan.terminalState === 'AWAITING_COMPUTE_CONSENT')
  );
}
