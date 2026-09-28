/**
 * ASK R2 — ROUTER / DESIGN COMPATIBILITY MATRIX (FREEZE PASS)
 *
 * CTO: a compatibility audit only. Do not change the design. Do not implement frontend code.
 *
 * ================== WHAT WAS AND WAS NOT AVAILABLE ==================
 *
 * `GNAI_ASK_INTELLIGENCE_WORKSPACE_R2_FINAL_DESIGN_AUTHORITY_D25`, reviewed SHA256
 * `4ca6c22d9e995901b9b61fd5e55080885913138d9877c296ed8acfd21399ed53`.
 *
 * THE FREEZE RULING STATED THIS PACKAGE WAS BEING SUPPLIED DIRECTLY. **It did not arrive.**
 * Re-checked at the start of the freeze pass: no uploads directory exists in this session, the
 * project carries the Ask AI Visual Spec Board v1.8 (`194977b4...`) and no D25 entry, and a
 * filesystem search for the name returns nothing. Its SHA256 remains unverified.
 *
 * WHAT CHANGES ANYWAY, AND WHY THIS IS STRONGER THAN THE PREVIOUS PASS. The freeze ruling
 * itself contains explicit design compatibility rulings for every row the previous pass
 * reported as a mismatch — Open full analysis, Run deeper analysis, sand/ComputeClass,
 * disclosures, Currently Verified, Specialist Intelligence and clarification. Those rows are
 * therefore resolved **by ruling**, which is authoritative, rather than by inference from
 * design text. What remains unaudited is only D25 content the ruling does not mention.
 *
 * So this matrix is audited against:
 *   (a) the THIRTEEN design states the CTO enumerated, which are authoritative as stated;
 *   (b) the SEVEN verification points the CTO enumerated;
 *   (c) design behaviour already documented in the accepted register — H's handoff contract
 *       for `Open full analysis` / `Run deeper analysis`, G's chip derivation rules, MA §3
 *       on sand, MA §11 and §12.
 *
 * It is NOT audited against D25's own text. Any state, chip or rule D25 contains beyond the
 * CTO's enumeration is UNAUDITED, and this file says so rather than implying coverage.
 * Recorded as fact BF-20.
 */

export type MatrixClass =
  /** The design state has a router plan fact that carries it. */
  | 'MATCH'
  /** The design state exists and no router plan fact produces it. */
  | 'DESIGN_HAS_NO_ROUTER_STATE'
  /** The router produces a fact the enumerated design states do not represent. */
  | 'ROUTER_HAS_NO_DESIGN_STATE';

export interface MatrixRow {
  readonly id: string;
  /** The design state or UI representation, in the CTO's own words where enumerated. */
  readonly designState: string;
  /** The router state or plan fact, named exactly as it appears in the plan. */
  readonly routerFact: string;
  readonly verdict: MatrixClass;
  /** Why, and what would have to change. Never softened.  */
  readonly note: string;
  /** True where the verdict depends on D25 text this session could not read. */
  readonly unauditedAgainstD25: boolean;
}

export const DESIGN_MATRIX: readonly MatrixRow[] = [
  /* ======================= the thirteen enumerated states ======================= */

  {
    id: 'DM-01',
    designState: 'Empty',
    routerFact: '(none — no envelope exists before a question)',
    verdict: 'DESIGN_HAS_NO_ROUTER_STATE',
    note: 'Correct by construction rather than a gap. A plan exists only once a question does, and the dock issues no request on open — "Opening a panel is navigation, not a question." The router must NOT acquire an empty state, because producing a plan for no question is how a surface starts spending on arrival.',
    unauditedAgainstD25: false,
  },
  {
    id: 'DM-02',
    designState: 'Reference Background',
    routerFact: "terminalState 'REFERENCE_BACKGROUND_ONLY' · modelPriorPermitted true · modelPriorCitable false · disclosure REFERENCE_BACKGROUND_NOT_CITABLE",
    verdict: 'MATCH',
    note: 'The router carries three separate facts the design needs: that background is permitted, that it is never citable, and the disclosure obligation. RISK, unverifiable here: if D25 renders Reference Background inside the same evidence panel as sourced claims, non-citability is lost visually even though the plan states it. The plan emits an EMPTY source set on this path, which is the hook to render against.',
    unauditedAgainstD25: true,
  },
  {
    id: 'DM-03',
    designState: 'Currently Verified',
    routerFact: "VerificationOutcome 'CURRENTLY_VERIFIED' — declared but NOT admissible today",
    verdict: 'MATCH',
    note:
      'CONFIRMED BY FREEZE RULING: "Currently Verified remains a conditional design state. It may render only after execution/evidence verification actually earns it. The fact that no current executor can always produce it does not remove the state." So the state stays and the router models it correctly: declared, excluded from the admissible set while official evidence is unbound (R3-3), and conditionally restored when it is (R3-4). No change needed.',
    unauditedAgainstD25: false,
  },
  {
    id: 'DM-04',
    designState: 'Current Intelligence',
    routerFact: "questionClass 'CURRENT_REPORTING' · terminalState 'EXECUTABLE' · required evidence NEWS_REPORTING",
    verdict: 'MATCH',
    note: 'The only fully bound path in the product. NEWS_REPORTING is the single BOUND evidence class (probe H-4), so this is the one design state the router can satisfy end to end today.',
    unauditedAgainstD25: false,
  },
  {
    id: 'DM-05',
    designState: 'Clarification Required',
    routerFact: "terminalState 'CLARIFICATION_REQUIRED' · refusal codes CLARIFICATION_REQUIRED · LANGUAGE_UNCLASSIFIED · LANGUAGE_UNSUPPORTED · SOURCE_FRAME_UNPARSED · SELECTION_EXCEEDS_MAX · SELECTION_BELOW_MINIMUM",
    verdict: 'MATCH',
    note: 'One design state, SIX router causes. See DM-16: the causes are materially different to a reader and the enumeration has no sub-states for them.',
    unauditedAgainstD25: true,
  },
  {
    id: 'DM-06',
    designState: 'Broadening Offered',
    routerFact: "terminalState 'BROADENING_OFFERED' · PlannedConstraint.broadenedTo · disclosure CONSTRAINT_NOT_APPLIED",
    verdict: 'MATCH',
    note: 'The plan names the broader scope WITHOUT applying it, and probe R2-3 asserts a broadening is never marked carried. The design must therefore render an OFFER the reader accepts, never an applied result — otherwise "no automatic narrowing" is satisfied in the plan and broken on screen.',
    unauditedAgainstD25: true,
  },
  {
    id: 'DM-07',
    designState: 'Partial Evidence',
    routerFact: "VerificationOutcome 'CURRENT_REPORTING_PARTIAL_VERIFICATION' · VerificationContract.minIndependentFreshSources 2 · asOfTimeRequired true · disclosure PARTIAL_VERIFICATION_AS_OF_TIME",
    verdict: 'MATCH',
    note: 'The as-of time is a CONTRACT REQUIREMENT, not a nicety: the plan sets asOfTimeRequired true and the disclosure names it. A Partial Evidence rendering without an as-of time would break ruling 3.',
    unauditedAgainstD25: true,
  },
  {
    id: 'DM-08',
    designState: 'Insufficient Evidence',
    routerFact: "terminalState 'INSUFFICIENT_EVIDENCE' AND VerificationOutcome 'INSUFFICIENT_EVIDENCE' — two different things sharing one name",
    verdict: 'MATCH',
    note:
      'AMBIGUITY CLOSED BY THE FINAL SEMANTIC CORRECTION. INSUFFICIENT_EVIDENCE is now reserved exclusively for a post-execution outcome where an available evidence path was attempted and the kept scope could not support the claim. It is no longer a TerminalState or a RefusalCode (probes SC-1, SC-3), and planning-time inability resolves to CAPABILITY_UNAVAILABLE, CLARIFICATION_REQUIRED or BROADENING_OFFERED (SC-4, SC-5). One name, one meaning.',
    unauditedAgainstD25: false,
  },
  {
    id: 'DM-09',
    designState: 'Capability Unavailable',
    routerFact: "terminalState 'CAPABILITY_UNAVAILABLE' · withheldEvidence[] · codes NO_CAPABILITY · SECURITY_HOLD_UPLOAD · NO_EXECUTOR_COMPUTATION · SPECIALIST_NOT_BOUND · SPECIALIST_NOT_REGISTERED · MODEL_PRIOR_FORBIDDEN",
    verdict: 'MATCH',
    note: 'Every unmet class is named individually in withheldEvidence with its own code, so the design can distinguish an upload hold from a missing computation executor from an unbound specialist. MODEL_PRIOR_FORBIDDEN rides with every one of them, which is the hook that stops the surface offering model knowledge as a consolation.',
    unauditedAgainstD25: false,
  },
  {
    id: 'DM-10',
    designState: 'Specialist Intelligence',
    routerFact: "SpecialistLeg { domain, requiredness, registered, bound, refusal, mustDisclose } · disclosure SPECIALIST_INTELLIGENCE_NOT_USED",
    verdict: 'MATCH',
    note:
      'CONFIRMED BY FREEZE RULING: "Specialist Intelligence may render only after a BOUND Specialist executor actually contributes Specialist evidence. Domain detection alone can never mount this state." That is exactly what the router enforces — registered and bound are separate fields, and no SPECIALIST_CLAIM evidence request is emitted without a proven seam (R4-2, R4-3). The previous pass raised this as the highest risk; the ruling makes it a rule.',
    unauditedAgainstD25: false,
  },
  {
    id: 'DM-11',
    designState: 'Personal Intelligence',
    routerFact: "questionClass 'PERSONAL_INTELLIGENCE' · terminalState 'IDENTITY_REQUIRED' or 'EXECUTABLE' · PERSONAL_LIBRARY is IDENTITY_GATED",
    verdict: 'MATCH',
    note: 'Main\'s hard rule is carried in the plan: a personal question with no verified identity terminates IDENTITY_REQUIRED and the reporting leg is never offered instead, "because that is not a degraded answer to the question asked, it is a confident answer to a different one."',
    unauditedAgainstD25: false,
  },
  {
    id: 'DM-12',
    designState: 'Open full analysis',
    routerFact: '(none BY RULING — an integration/Handoff action over a stored result, not a router state)',
    verdict: 'MATCH',
    note:
      'RESOLVED BY FREEZE RULING: "Open full analysis is NOT a router state. It is an integration/Handoff action over an existing stored result: 0 AI, 0 provider, no compute. Do not add an artificial router terminal for it." The router correctly emits nothing for it, and the previous pass was wrong to call this a router gap. H-A1/H-A2 remain the integration prerequisite, which is Handoff scope and not router scope.',
    unauditedAgainstD25: false,
  },
  {
    id: 'DM-13',
    designState: 'Run deeper analysis',
    routerFact: "partial — computeConsent and terminalState 'AWAITING_COMPUTE_CONSENT' exist; NO compute-class escalation does",
    verdict: 'MATCH',
    note:
      'RESOLVED BY FREEZE RULING: "Run deeper analysis maps to the Ask-V2 compute lifecycle. Router provides the plan; Ask V2 determines ComputeClass and explicit acceptance. Do not add Sand/ComputeClass to the router merely to satisfy the UI." The router supplies the plan and stops there, which is now the required behaviour rather than a shortfall.',
    unauditedAgainstD25: false,
  },
  {
    id: 'DM-14',
    designState: 'Map-origin context',
    routerFact: "GeographyCandidate.source 'MAP_GEOGRAPHY_CONTEXT' · scopedBy · geographyRequired",
    verdict: 'MATCH',
    note: 'The router answers G\'s R-CHIP-1 directly: scopedBy states WHAT SCOPED THE ANSWER rather than which store is populated, which is the whole defect G measured. Map-origin geography is the lowest geography rung in both the declared table and the landed chain, so a typed place or a declared region correctly overrides it.',
    unauditedAgainstD25: false,
  },

  /* ================ router facts the enumeration does not represent ================ */

  {
    id: 'DM-15',
    designState: '(none enumerated for "plan ready, consent absent")',
    routerFact: "terminalState 'AWAITING_COMPUTE_CONSENT' · refusal COMPUTE_CONSENT_ABSENT",
    verdict: 'ROUTER_HAS_NO_DESIGN_STATE',
    note:
      'NOT RULED ON, AND NOT A BLOCKER. The CTO has verified that /search?q= alone does not authorize compute and that explicit consent or Run is required, so the mechanism exists in the product and integration has an affordance for it. The enumerated states simply do not name "plan ready, waiting for consent" — and because a model call is compute, the router state also covers Reference Background, which makes it broader than the Run control. Recorded so it is not mistaken for closed.',
    unauditedAgainstD25: true,
  },
  {
    id: 'DM-16',
    designState: '(one Clarification Required state for six causes)',
    routerFact: 'LANGUAGE_UNCLASSIFIED · LANGUAGE_UNSUPPORTED vs SELECTION_EXCEEDS_MAX · SELECTION_BELOW_MINIMUM vs SOURCE_FRAME_UNPARSED vs CLARIFICATION_REQUIRED',
    verdict: 'MATCH',
    note:
      'RESOLVED BY FREEZE RULING: "one UI state is sufficient for multiple clarification causes. Router must provide reason/candidate data so copy can differ truthfully." The router now carries ClarificationCause[] — code, axis, observed, candidate — so a selection fault reports 9 against a limit of 8 while a language fault reports pl against a supported en (probes CL-1, CL-2, CL-3). Codes and values only; the frontend writes the words.',
    unauditedAgainstD25: false,
  },
  {
    id: 'DM-17',
    designState: '(none enumerated for disclosures as a class)',
    routerFact: 'disclosures[] — SPECIALIST_INTELLIGENCE_NOT_USED · REFERENCE_BACKGROUND_NOT_CITABLE · PARTIAL_VERIFICATION_AS_OF_TIME · CONSTRAINT_NOT_APPLIED',
    verdict: 'MATCH',
    note:
      'RESOLVED BY FREEZE RULING: disclosures[] is retained, and for an unavailable SUPPLEMENTARY specialist "integration will render a neutral capability/coverage disclosure ... This is not a separate top-level engine state." So the obligation has a home in integration rather than needing an engine state, and the router emitting a code is the correct half of the contract.',
    unauditedAgainstD25: false,
  },
  {
    id: 'DM-18',
    designState: '(none enumerated)',
    routerFact: "questionClass 'HISTORICAL' · time.statedPeriod",
    verdict: 'ROUTER_HAS_NO_DESIGN_STATE',
    note:
      'NOT A BLOCKER. A dated past period has no enumerated state, and because no time channel exists such a plan terminates BROADENING_OFFERED carrying CONSTRAINT_NOT_APPLIED — which integration can render through the existing Reference Background plus disclosure path. Recorded rather than escalated.',
    unauditedAgainstD25: true,
  },
  {
    id: 'DM-19',
    designState: '(Capability Unavailable carries it today)',
    routerFact: "refusal OFFICIAL_VERIFICATION_UNAVAILABLE on an EXECUTABLE plan",
    verdict: 'MATCH',
    note:
      'RESOLVED BY THE DISCLOSURES RULING. OFFICIAL_VERIFICATION_UNAVAILABLE on an EXECUTABLE plan is a neutral capability/coverage disclosure rendered by integration, not a top-level state. It is the cause of Partial Evidence rather than Currently Verified, and it travels as a code beside PARTIAL_VERIFICATION_AS_OF_TIME.',
    unauditedAgainstD25: false,
  },
  {
    id: 'DM-20',
    designState: '(no UI state — engineering telemetry)',
    routerFact: 'scopedByLanded · divergenceKind · reportingSubstitutionForbidden',
    verdict: 'ROUTER_HAS_NO_DESIGN_STATE',
    note: 'Correctly absent from the design. These exist for the convergence record, not for readers, and rendering them would leak engineering state onto a reader surface. Listed so the audit is complete rather than because it is a gap.',
    unauditedAgainstD25: false,
  },

  /* ====================== the seven verification points ====================== */

  {
    id: 'DM-21',
    designState: 'VERIFY · sand appears only on compute',
    routerFact: '(none BY RULING — sand and ComputeClass belong to the Ask-V2 compute lifecycle)',
    verdict: 'MATCH',
    note:
      'RESOLVED BY FREEZE RULING: "Do not add Sand/ComputeClass to the router merely to satisfy the UI." Sand belongs to the Ask-V2 compute lifecycle. SAND_CHARGING_ENABLED = false is a measured CTO fact, and the router emitting no cost is now correct by instruction. The previous pass treated this as a router shortfall; it was a scope error.',
    unauditedAgainstD25: false,
  },
  {
    id: 'DM-22',
    designState: 'VERIFY · unbound Specialist capability cannot be rendered as if executed',
    routerFact: 'SpecialistLeg.bound false · withheldEvidence[].forDomain · no SPECIALIST_CLAIM evidence request',
    verdict: 'MATCH',
    note: 'The router makes this structurally checkable: probe R4-2 asserts no specialist execution plan is emitted while no seam is proven, and R4-3 proves that is conditional. The design side cannot be verified here, and DM-10 states the risk.',
    unauditedAgainstD25: true,
  },
  {
    id: 'DM-23',
    designState: 'VERIFY · model-only Reference Background is not rendered as citable Reference evidence',
    routerFact: 'modelPriorCitable false (always) · disclosure REFERENCE_BACKGROUND_NOT_CITABLE · empty source set · MODEL_PRIOR_FORBIDDEN wherever a required class is unmet',
    verdict: 'MATCH',
    note: 'Four independent facts carry it, and probes H-1 to H-3 hold them. The strongest is that MODEL_PRIOR is forbidden outright whenever a required evidence class is unmet, so background can never be substituted for evidence the product does not have.',
    unauditedAgainstD25: true,
  },
  {
    id: 'DM-24',
    designState: 'VERIFY · file/upload UI remains FUTURE / SECURITY HOLD',
    routerFact: "attachments.count always 0 · UPLOADED_DOCUMENT is SECURITY_HOLD · refusal SECURITY_HOLD_UPLOAD · terminalState CAPABILITY_UNAVAILABLE",
    verdict: 'MATCH',
    note: 'The router refuses every attachment-bearing question and F\'s gate keeps upload NOT AUTHORISED with 15 blocking conditions. G B-3 additionally REFUSED the uploaded-file chip as contradicting an accepted ruling. So no upload affordance may be enabled, and a file chip must not be renderable even as a placeholder.',
    unauditedAgainstD25: true,
  },
  {
    id: 'DM-25',
    designState: 'VERIFY · full-screen phone Ask requires no router behaviour inconsistent with Map state restoration',
    routerFact: 'route() is pure — no clock, no randomness, no stored state, no map camera, no view state',
    verdict: 'MATCH',
    note: 'Satisfied by construction and probe-asserted: F-1 and F-3 establish purity, so the router holds nothing that a restore could contradict. The one requirement it places on restoration is that MAP_GEOGRAPHY_CONTEXT provenance must survive it — if the restored selection is lost, scopedBy falls to CLASSIFIED_SHAPE and the chip would claim global scope, which is G\'s "World Events" untruth in a new place.',
    unauditedAgainstD25: true,
  },
  {
    id: 'DM-26',
    designState: 'VERIFY · Open full analysis maps to existing-result navigation, not new compute',
    routerFact: '(none BY RULING — see DM-12; the router must not acquire a terminal for it)',
    verdict: 'MATCH',
    note:
      'RESOLVED BY FREEZE RULING — Open full analysis is an integration/Handoff action over a stored result, so the verification is satisfied by the router emitting nothing that could compute. Adding a terminal for it is explicitly forbidden.',
    unauditedAgainstD25: false,
  },
  {
    id: 'DM-27',
    designState: 'VERIFY · Run deeper analysis maps to explicit compute acceptance',
    routerFact: "computeConsent 'ABSENT' | 'GRANTED' — for the current question only",
    verdict: 'MATCH',
    note:
      'RESOLVED BY FREEZE RULING — explicit compute acceptance is Ask-V2 lifecycle. The router provides the plan and neither determines nor announces ComputeClass.',
    unauditedAgainstD25: false,
  },

  /* ====================== chip provenance ====================== */

  {
    id: 'DM-28',
    designState: 'VERIFY · every visible context chip has a real Question Envelope / provenance source',
    routerFact: 'geography chip -> geography.candidates[].source + scopedBy · subject chip -> topic.readerTerms · time chip -> time.statedPeriod · specialist chip -> specialistLegs[] · personal chip -> personal.scope',
    verdict: 'MATCH',
    note: 'Every chip the register names has an envelope field, and scopedBy gives the chip its truth condition rather than its store. TWO CAVEATS, both real: topic.readerTerms and time.statedPeriod have NO LANDED PRODUCER (BF-08, BF-09), so those chips are renderable only once a producer exists; and the sub-national place chip stays blocked by E1 OB-6, which is itself UNMEASURED.',
    unauditedAgainstD25: true,
  },
  {
    id: 'DM-29',
    designState: 'World Events chip',
    routerFact: "scopedBy 'CLASSIFIED_SHAPE' — the rank-9 unconditional default",
    verdict: 'MATCH',
    note: 'G\'s R-CHIP-2 holds that World Events is a positive claim about global scope, never a resting state. CLASSIFIED_SHAPE is exactly that claim: it means no scope source was present, not that none was looked for. IMPROVED BY CORRECTION 1: because a typed place is now typed rather than entity-derived, O1, H1 and NC2 no longer fall to the rank-9 default, so there are strictly fewer questions that would have shown a false World Events.',
    unauditedAgainstD25: true,
  },
];
