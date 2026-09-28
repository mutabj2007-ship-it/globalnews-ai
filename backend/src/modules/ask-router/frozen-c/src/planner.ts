/**
 * ASK R2 CORE ROUTER — THE PLANNER
 *
 * CRITICAL ARCHITECTURAL CONSTRAINT (Main, preserved by CTO ruling 6):
 *
 *   "NOTHING ROUTES ON IT [the class]. Routing reads orthogonal fields; the class is
 *    what the system *says* it is doing, so a disagreement is a defect a probe can
 *    catch — impossible when the label IS the decision."
 *
 * So this file NEVER reads `questionClass`. Every decision is taken from an orthogonal
 * envelope field, and probes B-1/B-2/B-3 assert it by source inspection. The class is
 * attached afterwards, purely as a label.
 *
 * CTO RULINGS CLOSED HERE
 *   1 · geography precedence reconciled; entity geography effective only when required
 *   2 · untransportable constraints: clarify -> broaden -> insufficient; no auto-narrowing
 *   3 · current office/status: official preferred, two-source partial verification, model prior cannot verify
 *   4 · registered != bound; no specialist execution plan without a callable seam
 */

import type {
  AskQuestionEnvelope,
  CapabilityState,
  ClarificationCause,
  DisclosureCode,
  DivergenceKind,
  EvidenceClass,
  EvidenceRequest,
  PlannedConstraint,
  PrecedenceRank,
  RefusalCode,
  RoutingPlan,
  SpatialPrecision,
  SpecialistLeg,
  SpecialistRequiredness,
  TerminalState,
  VerificationContract,
  VerificationOutcome,
  WithheldEvidence,
} from './ports.js';
import {
  DECLARED_PRECEDENCE,
  GEOGRAPHY_PRECEDENCE,
  LANDED_SCOPE_LATTICE,
  MAX_SELECTED_STORIES,
  PRECISION_ORDER,
} from './ports.js';
import {
  CAPABILITY_MAP,
  isUnmet,
  minimumStoriesFor,
  refusalForUnmet,
  type SpecialistRegistryPort,
} from './registry.js';
import { deriveQuestionClass, hasUnparsedSourceFrame, hasUnreadAxis } from './classify.js';
import { DERIVATION_COVERAGE } from './envelope.js';

function withinCeiling(precision: SpatialPrecision, ceiling: SpatialPrecision): boolean {
  return PRECISION_ORDER.indexOf(precision) <= PRECISION_ORDER.indexOf(ceiling);
}

/** Intents meaning the reader is asking about now. The planner reads the intent, never the class. */
const PRESENT_TENSE_INTENTS = new Set([
  'CURRENT_EVENT',
  'ARTICLE_ANCHORED',
  'GEOGRAPHIC_REGIONAL',
  'MULTI_ENTITY',
  'COMPARISON_RESEARCH',
]);

export interface PlannerDeps {
  readonly specialistRegistry: SpecialistRegistryPort;
  /**
   * Capability states, defaulting to the measured map. Injectable ONLY so a probe can
   * assert the counterfactual — that the verification contract admits
   * CURRENTLY_VERIFIED once official evidence is bound — rather than the contract being
   * hardcoded to today's gap. It is not a feature flag.
   */
  readonly capabilities?: Partial<Record<EvidenceClass, CapabilityState>>;
}

function capabilityOf(deps: PlannerDeps, cls: EvidenceClass): CapabilityState {
  return deps.capabilities?.[cls] ?? CAPABILITY_MAP[cls];
}

/* ------------------------------------------------------------------ *
 * EVIDENCE — from orthogonal fields, never from the class
 * ------------------------------------------------------------------ */

interface EvidenceNeeds {
  readonly requests: readonly EvidenceRequest[];
  readonly required: readonly EvidenceClass[];
  readonly preferred: readonly EvidenceClass[];
  readonly specialistWanted: boolean;
}

function deriveEvidenceNeeds(e: AskQuestionEnvelope): EvidenceNeeds {
  const requests: EvidenceRequest[] = [];
  const required: EvidenceClass[] = [];
  const preferred: EvidenceClass[] = [];

  const need = (cls: EvidenceClass, because: string, isRequired: boolean): void => {
    requests.push({ evidenceClass: cls, because, required: isRequired });
    if (isRequired) required.push(cls);
  };

  if (e.attachments.count > 0) need('UPLOADED_DOCUMENT', 'attachments.count', true);
  if (e.computation.requested) need('COMPUTATION', 'computation.requested', true);
  if (e.personal.requested) need('PERSONAL_LIBRARY', 'personal.requested', true);

  // An official artifact asked for AS SUCH is required: nothing else states the figure.
  if (e.official.requested) need('OFFICIAL_ARTIFACT', 'official.requested', true);

  // CTO ruling 3: a current office/status does NOT require official evidence and is NOT
  // refused absolutely. Official evidence is PREFERRED; current reporting can partially
  // verify. So this adds a preference, not a requirement.
  if (e.currentStatus.requested) preferred.push('OFFICIAL_ARTIFACT');

  const wantsReporting =
    e.time.requirement === 'RECENT' ||
    e.time.requirement === 'EXPLICIT_WINDOW' ||
    e.time.requirement === 'AS_OF_NOW' ||
    e.currentStatus.requested ||
    PRESENT_TENSE_INTENTS.has(e.classifiers.queryIntent) ||
    e.domains.domains.length > 0;

  // A personal question's evidence is the reader's own library, not fresh reporting.
  // Main's hard rule: never answered from news instead.
  if (wantsReporting && !e.personal.requested) {
    need('NEWS_REPORTING', 'temporal requirement, current status or present-tense intent', true);
  }

  if (required.length === 0) {
    need('MODEL_PRIOR', 'no evidence class is required', false);
  }

  return { requests, required, preferred, specialistWanted: e.domains.domains.length > 0 };
}

/* ------------------------------------------------------------------ *
 * SPECIALIST REQUIREDNESS — CTO correction 2
 * ------------------------------------------------------------------ */

/**
 * Per leg, never global. A domain is REQUIRED when the reader asked for the assessment
 * itself, or when the requested claim cannot be made without it. Otherwise SUPPLEMENTARY.
 */
function requirednessFor(
  e: AskQuestionEnvelope,
  domain: string,
): { requiredness: SpecialistRequiredness; source: 'DECLARED' | 'DEFAULTED' } {
  if (e.specialistRequest.explicitDomains.includes(domain)) {
    return { requiredness: 'REQUIRED', source: 'DECLARED' };
  }
  if (e.specialistRequest.materiallyRequiredDomains.includes(domain)) {
    return { requiredness: 'REQUIRED', source: 'DECLARED' };
  }
  // The axis has no landed producer, so SUPPLEMENTARY here may be a real judgement or may be
  // an absent one. The plan says which, rather than letting the permissive branch hide.
  const declared =
    e.specialistRequest.explicitDomains.length > 0 ||
    e.specialistRequest.materiallyRequiredDomains.length > 0;
  return { requiredness: 'SUPPLEMENTARY', source: declared ? 'DECLARED' : 'DEFAULTED' };
}

/* ------------------------------------------------------------------ *
 * SCOPE — ruling 1
 * ------------------------------------------------------------------ */

function presentRanks(e: AskQuestionEnvelope): Set<PrecedenceRank> {
  const present = new Set<PrecedenceRank>();
  if (e.selection.articleRefs.length > 0) present.add('SELECTION');
  for (const c of e.geography.candidates) {
    if (c.source === 'STORY_ANCHOR') present.add('ARTICLE_ANCHOR');
    if (c.source === 'DECLARED_REGION') present.add('DECLARED_REGION');
    if (c.source === 'TYPED_GEOGRAPHY') present.add('TYPED_GEOGRAPHY');
    if (c.source === 'ENTITY_GEOGRAPHY') present.add('ENTITY_GEOGRAPHY');
    if (c.source === 'MAP_GEOGRAPHY_CONTEXT') present.add('MAP_GEOGRAPHY_CONTEXT');
  }
  const sa = e.classifiers.sourceAttributed;
  if (sa.namedPublisher !== null && sa.parsed) present.add('SOURCE_INTENT');
  if (e.followUp.hasConversationContext) present.add('FOLLOW_UP_RELATION');
  present.add('CLASSIFIED_SHAPE');
  return present;
}

function scopeUnder(
  order: readonly PrecedenceRank[],
  present: ReadonlySet<PrecedenceRank>,
): PrecedenceRank {
  for (const rank of order) {
    if (present.has(rank)) return rank;
  }
  return 'CLASSIFIED_SHAPE';
}

/* ------------------------------------------------------------------ *
 * CONSTRAINTS — ruling 2
 * ------------------------------------------------------------------ */

/** The nearest precision the product can actually produce, or null when none is. */
function broadenPrecision(ceiling: SpatialPrecision): SpatialPrecision | null {
  const i = PRECISION_ORDER.indexOf(ceiling);
  return i >= 0 ? (PRECISION_ORDER[i] as SpatialPrecision) : null;
}

function deriveConstraints(
  e: AskQuestionEnvelope,
  identitySatisfied: boolean,
): readonly PlannedConstraint[] {
  const out: PlannedConstraint[] = [];

  /**
   * Does anything OTHER than this axis still scope the question? Ruling 2 rung 2 offers a
   * broader scope; rung 3 applies when broadening would leave nothing to answer.
   */
  const otherScopeRemains = (excluding: 'GEOGRAPHY' | 'TOPIC' | 'TIME'): boolean => {
    const geo = e.geography.candidates.some((c) =>
      withinCeiling(c.precision, e.geography.producibleCeiling),
    );
    const domains = e.domains.domains.length > 0;
    const selection = e.selection.articleRefs.length > 0;
    const frame = e.classifiers.sourceAttributed.namedPublisher !== null;
    if (excluding === 'GEOGRAPHY') return domains || selection || frame;
    return geo || domains || selection || frame;
  };

  for (const c of e.geography.candidates) {
    const ok = withinCeiling(c.precision, e.geography.producibleCeiling);
    if (ok) {
      out.push({
        axis: 'GEOGRAPHY',
        value: `${c.source}:${c.value}:${c.precision}`,
        carried: true,
        refusal: null,
        readerResolvable: false,
        broadenedTo: null,
      });
      continue;
    }
    // Above the producible ceiling. The reader cannot make the ladder deeper, so this is
    // not reader-resolvable; the honest move is to OFFER the nearest producible precision.
    const broader = broadenPrecision(e.geography.producibleCeiling);
    out.push({
      axis: 'GEOGRAPHY',
      value: `${c.source}:${c.value}:${c.precision}`,
      carried: false,
      refusal: 'CONSTRAINT_ABOVE_PRODUCIBLE_CEILING',
      readerResolvable: false,
      // Never applied. Offered, and the reader decides.
      broadenedTo: broader === null ? null : `${c.value}:${broader}`,
    });
  }

  // G B-1: no topic dimension exists anywhere in the product.
  for (const term of e.topic.readerTerms) {
    out.push({
      axis: 'TOPIC',
      value: term,
      carried: false,
      refusal: 'CONSTRAINT_UNTRANSPORTABLE',
      readerResolvable: false,
      broadenedTo: otherScopeRemains('TOPIC') ? 'WITHOUT_TOPIC_CONSTRAINT' : null,
    });
  }

  // G B-2: no time channel anywhere. Only a period the READER stated is their constraint.
  if (e.time.statedPeriod !== null) {
    out.push({
      axis: 'TIME',
      value: e.time.statedPeriod,
      carried: false,
      refusal: 'CONSTRAINT_UNTRANSPORTABLE',
      readerResolvable: false,
      broadenedTo: otherScopeRemains('TIME') ? 'WITHOUT_TIME_CONSTRAINT' : null,
    });
  }

  for (const d of e.domains.domains) {
    out.push({
      axis: 'DOMAIN',
      value: d,
      carried: true,
      refusal: null,
      readerResolvable: false,
      broadenedTo: null,
    });
  }

  if (e.selection.articleRefs.length > 0) {
    let refusal: RefusalCode | null = null;
    if (identitySatisfied) {
      if (e.selection.articleRefs.length > MAX_SELECTED_STORIES) refusal = 'SELECTION_EXCEEDS_MAX';
      else if (
        e.selection.action !== null &&
        e.selection.articleRefs.length < minimumStoriesFor(e.selection.action)
      ) {
        refusal = 'SELECTION_BELOW_MINIMUM';
      }
    }
    out.push({
      axis: 'SELECTION',
      value: `${e.selection.action ?? 'NONE'}:${e.selection.articleRefs.length}`,
      carried: refusal === null,
      refusal,
      // The reader CAN resolve a selection: add or remove members. Ruling 2 rung 1.
      readerResolvable: refusal !== null,
      broadenedTo: null,
    });
  }

  const sa = e.classifiers.sourceAttributed;
  if (sa.namedPublisher !== null && sa.parsed) {
    out.push({
      axis: 'SOURCE_FRAME',
      value: sa.namedPublisher,
      carried: true,
      refusal: null,
      readerResolvable: false,
      broadenedTo: null,
    });
  }

  return out;
}

/* ------------------------------------------------------------------ *
 * VERIFICATION — ruling 3
 * ------------------------------------------------------------------ */

function deriveVerification(
  e: AskQuestionEnvelope,
  deps: PlannerDeps,
): VerificationContract | null {
  if (!e.currentStatus.requested) return null;

  const officialEvidence = capabilityOf(deps, 'OFFICIAL_ARTIFACT');
  const reportingBound = capabilityOf(deps, 'NEWS_REPORTING') === 'BOUND';

  const admissible: VerificationOutcome[] = [];
  if (!isUnmet(officialEvidence)) admissible.push('CURRENTLY_VERIFIED');
  if (reportingBound) admissible.push('CURRENT_REPORTING_PARTIAL_VERIFICATION');
  // Always admissible: the executor may find fewer than two agreeing fresh sources.
  admissible.push('INSUFFICIENT_EVIDENCE');

  return {
    mode: 'CURRENT_STATUS',
    officialEvidence,
    minIndependentFreshSources: 2,
    asOfTimeRequired: true,
    modelPriorMayVerify: false,
    admissibleOutcomes: admissible,
  };
}

/* ------------------------------------------------------------------ *
 * PLAN
 * ------------------------------------------------------------------ */

export function plan(e: AskQuestionEnvelope, deps: PlannerDeps): RoutingPlan {
  const needs = deriveEvidenceNeeds(e);
  const { required, preferred, specialistWanted } = needs;
  // Copied so the specialist branch can append only where a callable seam is proven.
  const requests: EvidenceRequest[] = [...needs.requests];

  const identityRequired = required.includes('PERSONAL_LIBRARY');
  const identitySatisfied = e.identity.state === 'VERIFIED_ANALYSIS_USER';

  const constraints = deriveConstraints(e, identitySatisfied);
  const refusals = new Set<RefusalCode>();
  const disclosures = new Set<DisclosureCode>();
  const withheld: WithheldEvidence[] = [];

  /* --- scope: ruling 1, with entity geography conditional on being required --- */
  const geographyRequired = required.includes('NEWS_REPORTING');
  const present = presentRanks(e);
  const effective = new Set(present);
  if (!geographyRequired) {
    // "Entity geography is derived context and only becomes effective scope when the
    // planner actually requires it." Nothing requires geography here, so it stays context.
    effective.delete('ENTITY_GEOGRAPHY');
  }
  const scopedBy = scopeUnder(DECLARED_PRECEDENCE, effective);
  // The landed chain is unconditional, so it is scored against the unfiltered set.
  const scopedByLanded = scopeUnder(LANDED_SCOPE_LATTICE, present);

  let divergenceKind: DivergenceKind = 'NONE';
  if (scopedBy !== scopedByLanded) {
    if (!LANDED_SCOPE_LATTICE.includes(scopedBy)) divergenceKind = 'ADDITIVE';
    else if (
      scopedByLanded === 'ENTITY_GEOGRAPHY' &&
      !geographyRequired &&
      GEOGRAPHY_PRECEDENCE.includes(scopedByLanded)
    ) {
      divergenceKind = 'RULED';
    } else divergenceKind = 'CONTRADICTORY';
  }

  /* --- language and clarification causes --- */
  if (e.language.classification === 'UNCLASSIFIED') refusals.add('LANGUAGE_UNCLASSIFIED');
  else if (e.language.classification === 'UNSUPPORTED') refusals.add('LANGUAGE_UNSUPPORTED');
  else if (hasUnreadAxis(e)) refusals.add('LANGUAGE_UNSUPPORTED');

  if (hasUnparsedSourceFrame(e)) refusals.add('SOURCE_FRAME_UNPARSED');
  if (e.classifiers.queryIntent === 'CLARIFICATION_REQUIRED') refusals.add('CLARIFICATION_REQUIRED');

  /* --- evidence: ruling 4, applied to EVERY class rather than only to specialists ---
   *
   * "No specialist execution plan may be emitted until a callable executor seam is
   * proven." The principle is not specialist-specific: a class with no callable seam is
   * a WITHHELD ABSENCE, never a request. So an unmet class is recorded only in
   * `withheldEvidence`, and `evidenceRequests` contains nothing the product cannot run.
   *
   * Found by probe R4-1, which first failed on `COMPUTATION` being requested while
   * NOT_IMPLEMENTED. The first fix attempt was an exemption inside the probe; that was a
   * probe written around a defect, so the planner was corrected instead.
   */
  let unmetRequired = false;
  const runnable: EvidenceRequest[] = [];
  for (const r of requests) {
    const state = capabilityOf(deps, r.evidenceClass);
    if (isUnmet(state)) {
      const code = refusalForUnmet(r.evidenceClass);
      refusals.add(code);
      withheld.push({ evidenceClass: r.evidenceClass, state, refusal: code, forDomain: null });
      if (r.required) unmetRequired = true;
      continue;
    }
    runnable.push(r);
  }
  requests.length = 0;
  requests.push(...runnable);

  /* --- preferred evidence: ruling 3's stronger outcome, declared when unreachable --- */
  for (const cls of preferred) {
    const state = capabilityOf(deps, cls);
    if (isUnmet(state)) {
      refusals.add('OFFICIAL_VERIFICATION_UNAVAILABLE');
      withheld.push({
        evidenceClass: cls,
        state,
        refusal: 'OFFICIAL_VERIFICATION_UNAVAILABLE',
        forDomain: null,
      });
    }
  }

  /* --- specialists: ruling 4 plus CTO correction 2 (requiredness is contextual) --- */
  const specialistLegs: SpecialistLeg[] = [];
  let requiredSpecialistUnmet = false;
  if (specialistWanted) {
    const specialistState = capabilityOf(deps, 'SPECIALIST_CLAIM');
    for (const domain of e.domains.domains) {
      const res = deps.specialistRegistry.resolve(domain);
      const { requiredness, source: requirednessSource } = requirednessFor(e, domain);
      const unmet = !res.registered || !res.bound;
      const code: RefusalCode | null = !unmet
        ? null
        : !res.registered
          ? 'SPECIALIST_NOT_REGISTERED'
          : 'SPECIALIST_NOT_BOUND';

      if (code !== null) refusals.add(code);

      if (unmet) {
        withheld.push({
          evidenceClass: 'SPECIALIST_CLAIM',
          state: res.registered ? specialistState : 'NO_CAPABILITY',
          refusal: code as RefusalCode,
          forDomain: domain,
        });
        if (requiredness === 'REQUIRED') {
          // Explicitly requested, or materially required for the claim. Reporting is not a
          // substitute for it, so the question is refused rather than answered from news.
          requiredSpecialistUnmet = true;
        } else {
          // Supplementary: reporting may execute, and the answer must say this was missing.
          disclosures.add('SPECIALIST_INTELLIGENCE_NOT_USED');
        }
      } else {
        // Only reachable once a callable seam is proven for that domain.
        requests.push({
          evidenceClass: 'SPECIALIST_CLAIM',
          because: `domain:${domain}:${requiredness}`,
          required: requiredness === 'REQUIRED',
        });
      }

      specialistLegs.push({
        domain,
        requiredness,
        requirednessSource,
        registered: res.registered,
        bound: res.bound,
        refusal: code,
        mustDisclose: unmet && requiredness === 'SUPPLEMENTARY',
      });
    }
  }

  /**
   * "Specialist materially required for the requested claim -> do not silently substitute
   * ordinary reporting." Enforced structurally: the reporting leg is removed from the plan,
   * so no downstream reader can treat it as the answer.
   */
  const reportingSubstitutionForbidden = requiredSpecialistUnmet;
  if (reportingSubstitutionForbidden) {
    for (let i = requests.length - 1; i >= 0; i -= 1) {
      if (requests[i]?.evidenceClass === 'NEWS_REPORTING') requests.splice(i, 1);
    }
  }

  /* --- ruling 3: model prior can never verify a current status --- */
  const verification = deriveVerification(e, deps);
  if (verification !== null) refusals.add('MODEL_PRIOR_CANNOT_VERIFY');

  /* --- dropped constraints, split by ruling 2's ladder --- */
  const dropped = constraints.filter((c) => !c.carried);
  for (const c of dropped) {
    if (c.refusal !== null) refusals.add(c.refusal);
  }
  const clarifiable = dropped.filter((c) => c.readerResolvable);
  const broadenable = dropped.filter((c) => !c.readerResolvable && c.broadenedTo !== null);
  const unanswerable = dropped.filter((c) => !c.readerResolvable && c.broadenedTo === null);

  /* --- terminal state. The ORDER is the argument. --- */
  const languageBlocked =
    e.language.classification !== 'CLASSIFIED' ||
    hasUnreadAxis(e) ||
    hasUnparsedSourceFrame(e) ||
    e.classifiers.queryIntent === 'CLARIFICATION_REQUIRED';

  let terminalState: TerminalState;
  if (languageBlocked) {
    terminalState = 'CLARIFICATION_REQUIRED';
  } else if (unmetRequired || requiredSpecialistUnmet) {
    // Refusing costs nothing, so it precedes the consent gate and is more informative.
    terminalState = 'CAPABILITY_UNAVAILABLE';
  } else if (identityRequired && !identitySatisfied) {
    terminalState = 'IDENTITY_REQUIRED';
    refusals.add('IDENTITY_REQUIRED');
  } else if (clarifiable.length > 0) {
    // Ruling 2 rung 1: the reader can resolve it, so ask.
    terminalState = 'CLARIFICATION_REQUIRED';
  } else if (broadenable.length > 0) {
    // Ruling 2 rung 2: offer an explicit broader scope. NEVER applied automatically.
    terminalState = 'BROADENING_OFFERED';
    refusals.add('BROADENING_OFFERED');
  } else if (unanswerable.length > 0) {
    /**
     * Ruling 2 rung 3, under the FINAL SEMANTIC CORRECTION. Removing the constraint would
     * leave nothing to answer, and the reason is that the axis has NO CHANNEL AT ALL — a
     * missing capability, not evidence that was attempted and fell short. So this is
     * CAPABILITY_UNAVAILABLE. Calling it INSUFFICIENT_EVIDENCE would claim a retrieval
     * happened, which is the exact overclaim the correction removes.
     */
    terminalState = 'CAPABILITY_UNAVAILABLE';
  } else if (e.computeConsent === 'ABSENT') {
    // A model call is compute too, so reference background is not a way around this.
    terminalState = 'AWAITING_COMPUTE_CONSENT';
    refusals.add('COMPUTE_CONSENT_ABSENT');
  } else if (required.length === 0) {
    terminalState = 'REFERENCE_BACKGROUND_ONLY';
  } else {
    terminalState = 'EXECUTABLE';
  }

  // MODEL_PRIOR is "forbidden when required is non-empty". The code is emitted where a
  // reader would otherwise expect model knowledge to fill the gap that was just refused.
  if (terminalState === 'CAPABILITY_UNAVAILABLE') refusals.add('MODEL_PRIOR_FORBIDDEN');

  /* --- clarification causes: reason and candidate data, never copy --- */
  const clarification: ClarificationCause[] = [];
  if (terminalState === 'CLARIFICATION_REQUIRED') {
    const supported = DERIVATION_COVERAGE[0] ?? 'en';
    if (e.language.classification === 'UNCLASSIFIED') {
      clarification.push({
        code: 'LANGUAGE_UNCLASSIFIED',
        axis: null,
        observed: null,
        candidate: supported,
      });
    } else if (e.language.classification === 'UNSUPPORTED' || hasUnreadAxis(e)) {
      clarification.push({
        code: 'LANGUAGE_UNSUPPORTED',
        axis: null,
        observed: e.language.questionLanguage,
        candidate: supported,
      });
    }
    if (hasUnparsedSourceFrame(e)) {
      clarification.push({
        code: 'SOURCE_FRAME_UNPARSED',
        axis: 'SOURCE_FRAME',
        observed: e.classifiers.sourceAttributed.namedPublisher,
        candidate: null,
      });
    }
    if (e.classifiers.queryIntent === 'CLARIFICATION_REQUIRED') {
      clarification.push({
        code: 'CLARIFICATION_REQUIRED',
        axis: null,
        observed: null,
        candidate: null,
      });
    }
    for (const c of clarifiable) {
      if (c.refusal === 'SELECTION_EXCEEDS_MAX') {
        clarification.push({
          code: c.refusal,
          axis: 'SELECTION',
          observed: String(e.selection.articleRefs.length),
          candidate: String(MAX_SELECTED_STORIES),
        });
      } else if (c.refusal === 'SELECTION_BELOW_MINIMUM') {
        clarification.push({
          code: c.refusal,
          axis: 'SELECTION',
          observed: String(e.selection.articleRefs.length),
          candidate:
            e.selection.action === null ? null : String(minimumStoriesFor(e.selection.action)),
        });
      }
    }
  }

  if (terminalState === 'BROADENING_OFFERED') disclosures.add('CONSTRAINT_NOT_APPLIED');
  if (verification !== null && terminalState === 'EXECUTABLE') {
    disclosures.add('PARTIAL_VERIFICATION_AS_OF_TIME');
  }

  const modelPriorPermitted =
    required.length === 0 &&
    verification === null &&
    (terminalState === 'REFERENCE_BACKGROUND_ONLY' || terminalState === 'AWAITING_COMPUTE_CONSENT');

  if (modelPriorPermitted) disclosures.add('REFERENCE_BACKGROUND_NOT_CITABLE');

  return {
    // Attached AFTER every decision above, purely as a label.
    questionClass: deriveQuestionClass(e),
    scopedBy,
    scopedByLanded,
    precedenceDivergence: scopedBy !== scopedByLanded,
    divergenceKind,
    geographyRequired,
    evidenceRequests: requests,
    specialistLegs,
    reportingSubstitutionForbidden,
    withheldEvidence: withheld,
    constraints,
    verification,
    terminalState,
    refusals: [...refusals].sort(),
    clarification,
    disclosures: [...disclosures].sort(),
    modelPriorPermitted,
    modelPriorCitable: false,
  };
}
