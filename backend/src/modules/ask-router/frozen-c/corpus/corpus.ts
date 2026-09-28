/**
 * ASK R2 CORE ROUTER — DETERMINISTIC EVALUATION CORPUS (R1 revision)
 *
 * CTO: "Build the deterministic evaluation corpus first" (R1) and "Update the
 * deterministic corpus for these rulings. Do not change expected outputs merely to make
 * tests green — correct the planner where appropriate."
 *
 * HOW THIS REVISION WAS MADE. Every changed expectation below is changed because a CTO
 * ruling changed what the right answer IS, and each carries the ruling number. No
 * expectation was changed to match planner behaviour. `docs/05-CHANGED-ROWS.md` lists
 * every row whose terminal state moved, with the ruling that moved it.
 *
 * NO LIVE PROVIDER. NO MODEL CALL. NO NETWORK. Every row is a pure value.
 *
 * Each row supplies the SIX LANDED CLASSIFIER READINGS as declared input. This package
 * never classifies a question, so a row's `reading` is a fixture standing in for what the
 * landed classifiers return — see `docs/03-LIMITS.md` §3.
 */

import type {
  AskQuestionClass,
  DivergenceKind,
  LandedClassifierReading,
  LanguageClassification,
  MultiStoryAction,
  PersonalScope,
  PrecedenceRank,
  RefusalCode,
  SpatialPrecision,
  TemporalRequirement,
  TerminalState,
} from '../src/ports.js';

export interface CorpusInput {
  readonly rawQuestion: string;
  readonly questionLanguage: string | null;
  readonly languageClassification: LanguageClassification;

  readonly identityVerified?: boolean;
  readonly computeConsent?: 'ABSENT' | 'GRANTED';

  readonly declaredRegion?: string;
  readonly typedGeography?: { value: string; precision: SpatialPrecision };
  readonly entityGeography?: { value: string; precision: SpatialPrecision };
  readonly storyAnchorCountry?: string;
  readonly mapContextCountry?: string;

  readonly topicTerms?: readonly string[];
  readonly statedPeriod?: string;
  readonly temporalRequirement?: TemporalRequirement;

  readonly selectionAction?: MultiStoryAction;
  readonly articleRefs?: readonly string[];

  readonly personalRequested?: boolean;
  readonly personalScope?: PersonalScope;

  readonly attachmentCount?: number;
  readonly computationRequested?: boolean;
  readonly officialRequested?: boolean;
  readonly officialTerms?: readonly string[];
  readonly currentStatusRequested?: boolean;
  readonly currentStatusTerms?: readonly string[];
  readonly explicitSpecialistDomains?: readonly string[];
  readonly materiallySpecialistDomains?: readonly string[];

  readonly reading: LandedClassifierReading;
}

export interface CorpusExpectation {
  readonly questionClass: AskQuestionClass;
  readonly terminalState: TerminalState;
  /** Sorted, deduplicated. */
  readonly refusals: readonly RefusalCode[];
  readonly scopedBy: PrecedenceRank;
  readonly scopedByLanded: PrecedenceRank;
  readonly divergenceKind: DivergenceKind;
  readonly geographyRequired: boolean;
  readonly modelPriorPermitted: boolean;
  /** Constraint axes the plan must report as dropped, sorted. */
  readonly droppedConstraintAxes: readonly string[];
  /** Obligations on the answer, sorted. Distinct from refusals (CTO correction 2). */
  readonly disclosures: readonly string[];
  /** Per-domain requiredness, where the row exists to pin it. */
  readonly specialistRequiredness?: Readonly<Record<string, string>>;
  /** True when a REQUIRED specialist leg is unmet, so reporting is not a substitute. */
  readonly reportingSubstitutionForbidden?: boolean;
  /**
   * Clarification reason/candidate data, as "CODE:axis:observed:candidate" with `-` for null.
   * Required by the CTO clarification ruling: one UI state, truthful differing copy.
   */
  readonly clarification?: readonly string[];
  /** Present when the row exists to pin a verification contract (CTO ruling 3). */
  readonly verificationOutcomes?: readonly string[];
}

export interface CorpusRow {
  readonly id: string;
  readonly provenance: string;
  /** Set when a CTO R1 ruling changed this row's expected terminal state. */
  readonly changedByRuling?: string;
  readonly input: CorpusInput;
  readonly expect: CorpusExpectation;
}

function reading(over: Partial<LandedClassifierReading> = {}): LandedClassifierReading {
  return {
    queryIntent: 'EXPLANATION',
    analyticalDomains: [],
    sourceAttributed: { parsed: true, namedPublisher: null },
    eventAnchor: { hasEventAnchor: false, aspectCount: 0 },
    conversationSubject: { hasPriorQuestion: false, focusFromPriorQuestion: [] },
    questionAsksAboutCoverage: false,
    ...over,
  };
}

/** A 64-hex stand-in for `articleRef = sha256(normalizeArticleUrl(url))`. */
function ref(n: number): string {
  return n.toString(16).padStart(64, '0');
}

export const CORPUS: readonly CorpusRow[] = [
  /* ================= the seven cases named in the round brief ================= */

  {
    id: 'B1-reference-historical-figure',
    provenance:
      'Brief case 1. CTO: "General/reference knowledge is authorized. Model knowledge may provide non-citable REFERENCE BACKGROUND." Must NOT retrieve: L measured that a definition question which retrieves and finds nothing is answered with an absence-of-reporting claim, "the exact false statement the module was built to prevent".',
    input: {
      rawQuestion: 'Who was Hitler?',
      questionLanguage: 'en',
      languageClassification: 'CLASSIFIED',
      reading: reading({ queryIntent: 'ENTITY_BACKGROUND' }),
    },
    expect: {
      questionClass: 'REFERENCE',
      terminalState: 'REFERENCE_BACKGROUND_ONLY',
      refusals: [],
      scopedBy: 'CLASSIFIED_SHAPE',
      scopedByLanded: 'CLASSIFIED_SHAPE',
      divergenceKind: 'NONE',
      geographyRequired: false,
      modelPriorPermitted: true,
      droppedConstraintAxes: [],
      disclosures: ['REFERENCE_BACKGROUND_NOT_CITABLE'],
    },
  },

  {
    id: 'B2-current-office-holder',
    changedByRuling:
      'RULING 3 — was CAPABILITY_UNAVAILABLE (as REFUSED_NO_EXECUTOR). Official evidence is now PREFERRED, not required, so current reporting can partially verify. RULING 1 also changed its scope: entity geography is now an effective rung because the reporting leg requires geography.',
    provenance:
      'Brief case 2. CTO ruling 3: "Do not require official evidence or refuse absolutely. Official unavailable + at least two independent fresh reporting sources agree -> answer with CURRENT REPORTING/PARTIAL VERIFICATION and as-of time. reference/model background alone cannot verify a current office/status."',
    input: {
      rawQuestion: 'Who is the current president of Rwanda?',
      questionLanguage: 'en',
      languageClassification: 'CLASSIFIED',
      // CTO CORRECTION 1: the reader types this place in the question, so its provenance
      // is TYPED_GEOGRAPHY. ENTITY_GEOGRAPHY is reserved for geography derived from a
      // resolved entity the reader did NOT name.
      typedGeography: { value: 'RWA', precision: 'COUNTRY' },
      currentStatusRequested: true,
      currentStatusTerms: ['current president'],
      temporalRequirement: 'AS_OF_NOW',
      reading: reading({ queryIntent: 'ENTITY_BACKGROUND' }),
    },
    expect: {
      questionClass: 'CURRENT_STATUS_VERIFICATION',
      terminalState: 'EXECUTABLE',
      refusals: ['MODEL_PRIOR_CANNOT_VERIFY', 'OFFICIAL_VERIFICATION_UNAVAILABLE'],
      // Entity geography becomes effective scope because the reporting leg requires it.
      scopedBy: 'TYPED_GEOGRAPHY',
      scopedByLanded: 'TYPED_GEOGRAPHY',
      divergenceKind: 'NONE',
      geographyRequired: true,
      modelPriorPermitted: false,
      droppedConstraintAxes: [],
      disclosures: ['PARTIAL_VERIFICATION_AS_OF_TIME'],
      // CURRENTLY_VERIFIED is absent because official evidence is not bound.
      verificationOutcomes: ['CURRENT_REPORTING_PARTIAL_VERIFICATION', 'INSUFFICIENT_EVIDENCE'],
    },
  },

  {
    id: 'B3-topic-geography-time',
    changedByRuling:
      'RULING 2 — was CLARIFICATION_REQUIRED. Neither topic nor time is reader-resolvable (they are product gaps, not ambiguities), so the correct rung is explicit broadening.',
    provenance:
      'Brief case 3 and G\'s named failure "Entertainment in Rwanda presents as merely Rwanda". G B-1: no topic dimension exists. G B-2: no time channel anywhere. CTO ruling 2: never silently drop; clarify, else offer explicit broadening, else insufficient. No automatic narrowing.',
    input: {
      rawQuestion: 'Entertainment news in Rwanda this week',
      questionLanguage: 'en',
      languageClassification: 'CLASSIFIED',
      typedGeography: { value: 'RWA', precision: 'COUNTRY' },
      topicTerms: ['entertainment'],
      statedPeriod: 'this week',
      temporalRequirement: 'EXPLICIT_WINDOW',
      reading: reading({ queryIntent: 'CURRENT_EVENT' }),
    },
    expect: {
      questionClass: 'CURRENT_REPORTING',
      terminalState: 'BROADENING_OFFERED',
      refusals: ['BROADENING_OFFERED', 'CONSTRAINT_UNTRANSPORTABLE'],
      scopedBy: 'TYPED_GEOGRAPHY',
      scopedByLanded: 'TYPED_GEOGRAPHY',
      divergenceKind: 'NONE',
      geographyRequired: true,
      modelPriorPermitted: false,
      droppedConstraintAxes: ['TIME', 'TOPIC'],
      disclosures: ['CONSTRAINT_NOT_APPLIED'],
      clarification: [],
    },
  },

  {
    id: 'B4-computation',
    changedByRuling: 'TERMINAL RENAMED — REFUSED_NO_EXECUTOR became CAPABILITY_UNAVAILABLE under ruling 2 rung 3. Behaviour unchanged.',
    provenance:
      'Brief case 4. E1 area 18: zero child_process/spawn/execSync/new Function/node:vm — "ABSENT — and must stay absent". CTO: computation remains NOT IMPLEMENTED; the router may recognize the need but cannot fabricate an executor.',
    input: {
      rawQuestion: 'Solve x^3 - 4x + 1 = 0',
      questionLanguage: 'en',
      languageClassification: 'CLASSIFIED',
      computationRequested: true,
      reading: reading({ queryIntent: 'EXPLANATION' }),
    },
    expect: {
      questionClass: 'COMPUTATION',
      terminalState: 'CAPABILITY_UNAVAILABLE',
      refusals: ['MODEL_PRIOR_FORBIDDEN', 'NO_EXECUTOR_COMPUTATION'],
      scopedBy: 'CLASSIFIED_SHAPE',
      scopedByLanded: 'CLASSIFIED_SHAPE',
      divergenceKind: 'NONE',
      geographyRequired: false,
      modelPriorPermitted: false,
      droppedConstraintAxes: [],
      disclosures: [],
    },
  },

  {
    id: 'B5-file-engineering',
    changedByRuling: 'TERMINAL RENAMED — CAPABILITY_UNAVAILABLE. Behaviour unchanged; files remain SECURITY HOLD.',
    provenance:
      'Brief case 5. F-ASK-R2-FILE-TOOL-SECURITY-GATE-R1: FILE UPLOAD = NOT AUTHORISED, 15 blocking conditions, 4 untradeable. CTO: no uploads, no USER_FILE execution.',
    input: {
      rawQuestion: 'Explain this structural drawing',
      questionLanguage: 'en',
      languageClassification: 'CLASSIFIED',
      attachmentCount: 1,
      reading: reading({ queryIntent: 'EXPLANATION' }),
    },
    expect: {
      questionClass: 'UPLOADED_DOCUMENT',
      terminalState: 'CAPABILITY_UNAVAILABLE',
      refusals: ['MODEL_PRIOR_FORBIDDEN', 'SECURITY_HOLD_UPLOAD'],
      scopedBy: 'CLASSIFIED_SHAPE',
      scopedByLanded: 'CLASSIFIED_SHAPE',
      divergenceKind: 'NONE',
      geographyRequired: false,
      modelPriorPermitted: false,
      droppedConstraintAxes: [],
      disclosures: [],
    },
  },

  {
    id: 'B6a-subnational-place',
    changedByRuling:
      'RULING 2 — was CLARIFICATION_REQUIRED. The reader cannot make the administrative ladder deeper, so the honest rung is an explicit offer of the nearest producible precision.',
    provenance:
      'Brief case 6 at a precision the product cannot produce. administrative-ladder.contract ceiling governs; E1: do not widen at a call site. E1 OB-6 (UNMEASURED, G B-4): no context channel may carry a place identity beyond countryCode.',
    input: {
      rawQuestion: "What's happening in eastern DRC?",
      questionLanguage: 'en',
      languageClassification: 'CLASSIFIED',
      typedGeography: { value: 'eastern DRC', precision: 'SUB_NATIONAL' },
      temporalRequirement: 'RECENT',
      reading: reading({ queryIntent: 'CURRENT_EVENT', analyticalDomains: ['security'] }),
    },
    expect: {
      questionClass: 'SPECIALIST_DOMAIN',
      terminalState: 'BROADENING_OFFERED',
      refusals: [
        'BROADENING_OFFERED',
        'CONSTRAINT_ABOVE_PRODUCIBLE_CEILING',
        'SPECIALIST_NOT_BOUND',
      ],
      scopedBy: 'TYPED_GEOGRAPHY',
      scopedByLanded: 'TYPED_GEOGRAPHY',
      divergenceKind: 'NONE',
      geographyRequired: true,
      modelPriorPermitted: false,
      droppedConstraintAxes: ['GEOGRAPHY'],
      specialistRequiredness: { security: 'SUPPLEMENTARY' },
      disclosures: ['CONSTRAINT_NOT_APPLIED', 'SPECIALIST_INTELLIGENCE_NOT_USED'],
    },
  },

  {
    id: 'B6b-country-precision-specialist',
    provenance:
      'Brief case 6 at a producible precision. MA §6: Conflict is the one registered domain and still lacks payload, DTO, service contract and route. F\'s Support audit: ConflictAssessmentRail has 0 non-spec referrers. CTO ruling 4: registered != bound; no specialist execution plan without a callable seam.',
    input: {
      rawQuestion: "What's happening in the DRC?",
      questionLanguage: 'en',
      languageClassification: 'CLASSIFIED',
      typedGeography: { value: 'COD', precision: 'COUNTRY' },
      reading: reading({ queryIntent: 'CURRENT_EVENT', analyticalDomains: ['security'] }),
    },
    expect: {
      questionClass: 'SPECIALIST_DOMAIN',
      terminalState: 'EXECUTABLE',
      refusals: ['SPECIALIST_NOT_BOUND'],
      scopedBy: 'TYPED_GEOGRAPHY',
      scopedByLanded: 'TYPED_GEOGRAPHY',
      divergenceKind: 'NONE',
      geographyRequired: true,
      modelPriorPermitted: false,
      droppedConstraintAxes: [],
      specialistRequiredness: { security: 'SUPPLEMENTARY' },
      disclosures: ['SPECIALIST_INTELLIGENCE_NOT_USED'],
    },
  },

  {
    id: 'B7a-personal-anonymous',
    changedByRuling: 'TERMINAL RENAMED — REFUSED_IDENTITY_REQUIRED became IDENTITY_REQUIRED. Behaviour unchanged.',
    provenance:
      'Brief case 7. Main finding 3: "a personal question without a verified identity is IDENTITY_REQUIRED — never answered from news instead, because that is not a degraded answer to the question asked, it is a confident answer to a different one."',
    input: {
      rawQuestion: 'Compare my saved stories',
      questionLanguage: 'en',
      languageClassification: 'CLASSIFIED',
      personalRequested: true,
      personalScope: 'SAVED_STORIES',
      selectionAction: 'COMPARE',
      reading: reading({ queryIntent: 'COMPARISON_RESEARCH' }),
    },
    expect: {
      questionClass: 'PERSONAL_INTELLIGENCE',
      terminalState: 'IDENTITY_REQUIRED',
      refusals: ['IDENTITY_REQUIRED'],
      scopedBy: 'CLASSIFIED_SHAPE',
      scopedByLanded: 'CLASSIFIED_SHAPE',
      divergenceKind: 'NONE',
      geographyRequired: false,
      modelPriorPermitted: false,
      droppedConstraintAxes: [],
      disclosures: [],
    },
  },

  {
    id: 'B7b-personal-verified',
    provenance:
      'Negative control for B7a: IDENTITY_REQUIRED must not be unconditional. SavedStory and /users/me/saved/stories are live (E1 §0). SELECTION is a declared-only rung, so the divergence here is ADDITIVE rather than contradictory.',
    input: {
      rawQuestion: 'Compare my saved stories',
      questionLanguage: 'en',
      languageClassification: 'CLASSIFIED',
      identityVerified: true,
      personalRequested: true,
      personalScope: 'SAVED_STORIES',
      selectionAction: 'COMPARE',
      articleRefs: [ref(1), ref(2), ref(3)],
      reading: reading({ queryIntent: 'COMPARISON_RESEARCH' }),
    },
    expect: {
      questionClass: 'PERSONAL_INTELLIGENCE',
      terminalState: 'EXECUTABLE',
      refusals: [],
      scopedBy: 'SELECTION',
      scopedByLanded: 'CLASSIFIED_SHAPE',
      divergenceKind: 'ADDITIVE',
      geographyRequired: false,
      modelPriorPermitted: false,
      droppedConstraintAxes: [],
      disclosures: [],
    },
  },

  {
    id: 'B7c-selection-over-max',
    provenance:
      'MAX_SELECTED_STORIES = 8, accepted and built. CTO ruling 2 rung 1: the reader CAN resolve a selection, so this clarifies rather than broadens. Silent truncation would omit members without saying so, which the accepted coverageGap discipline exists to prevent.',
    input: {
      rawQuestion: 'Compare my saved stories',
      questionLanguage: 'en',
      languageClassification: 'CLASSIFIED',
      identityVerified: true,
      personalRequested: true,
      personalScope: 'SAVED_STORIES',
      selectionAction: 'COMPARE',
      articleRefs: [ref(1), ref(2), ref(3), ref(4), ref(5), ref(6), ref(7), ref(8), ref(9)],
      reading: reading({ queryIntent: 'COMPARISON_RESEARCH' }),
    },
    expect: {
      questionClass: 'PERSONAL_INTELLIGENCE',
      terminalState: 'CLARIFICATION_REQUIRED',
      refusals: ['SELECTION_EXCEEDS_MAX'],
      scopedBy: 'SELECTION',
      scopedByLanded: 'CLASSIFIED_SHAPE',
      divergenceKind: 'ADDITIVE',
      geographyRequired: false,
      modelPriorPermitted: false,
      droppedConstraintAxes: ['SELECTION'],
      disclosures: [],
      clarification: ['SELECTION_EXCEEDS_MAX:SELECTION:9:8'],
    },
  },

  {
    id: 'B7d-selection-below-minimum',
    provenance: 'MULTI_STORY_MIN_STORIES: COMPARE needs at least two members. Reader-resolvable, so rung 1.',
    input: {
      rawQuestion: 'Compare my saved stories',
      questionLanguage: 'en',
      languageClassification: 'CLASSIFIED',
      identityVerified: true,
      personalRequested: true,
      personalScope: 'SAVED_STORIES',
      selectionAction: 'COMPARE',
      articleRefs: [ref(1)],
      reading: reading({ queryIntent: 'COMPARISON_RESEARCH' }),
    },
    expect: {
      questionClass: 'PERSONAL_INTELLIGENCE',
      terminalState: 'CLARIFICATION_REQUIRED',
      refusals: ['SELECTION_BELOW_MINIMUM'],
      scopedBy: 'SELECTION',
      scopedByLanded: 'CLASSIFIED_SHAPE',
      divergenceKind: 'ADDITIVE',
      geographyRequired: false,
      modelPriorPermitted: false,
      droppedConstraintAxes: ['SELECTION'],
      disclosures: [],
      clarification: ['SELECTION_BELOW_MINIMUM:SELECTION:1:2'],
    },
  },

  /* ================= official artifact: Main's largest honesty gap ================= */

  {
    id: 'O1-official-statistical-figure',
    changedByRuling:
      'TERMINAL RENAMED — CAPABILITY_UNAVAILABLE. Ruling 3 deliberately does NOT reach this row: an official STATISTIC is not a current office/status, so official evidence stays required and the refusal stands. That distinction is the point.',
    provenance:
      'Main: the official-document spine — including the real NISR August 2026 All Rwanda CPI observation, reference period 2026-08 — "is not reachable from Ask. A reader asking for Rwanda\'s latest CPI is answered from news about the figure, never from the retained artifact that states it."',
    input: {
      rawQuestion: "What is Rwanda's latest CPI?",
      questionLanguage: 'en',
      languageClassification: 'CLASSIFIED',
      // CTO CORRECTION 1: the reader types this place in the question, so its provenance
      // is TYPED_GEOGRAPHY. ENTITY_GEOGRAPHY is reserved for geography derived from a
      // resolved entity the reader did NOT name.
      typedGeography: { value: 'RWA', precision: 'COUNTRY' },
      officialRequested: true,
      officialTerms: ['CPI'],
      reading: reading({ queryIntent: 'ENTITY_BACKGROUND' }),
    },
    expect: {
      questionClass: 'OFFICIAL_DOCUMENT',
      terminalState: 'CAPABILITY_UNAVAILABLE',
      refusals: ['MODEL_PRIOR_FORBIDDEN', 'NO_CAPABILITY'],
      // Nothing requires geography, so entity geography stays derived context — the
      // conditional half of ruling 1. The landed chain scopes it anyway, hence RULED.
      scopedBy: 'TYPED_GEOGRAPHY',
      scopedByLanded: 'TYPED_GEOGRAPHY',
      divergenceKind: 'NONE',
      geographyRequired: false,
      modelPriorPermitted: false,
      droppedConstraintAxes: [],
      disclosures: [],
    },
  },

  /* ================= historical ================= */

  {
    id: 'H1-historical-explicit-period',
    changedByRuling: 'RULING 2 — was CLARIFICATION_REQUIRED. A historical period is not reader-resolvable either, so it broadens.',
    provenance:
      'Main finding 4: time.statedPeriod must be TEXT at the reader\'s own precision. Reachability row for the HISTORICAL class (Main probe C-2: the derivation must reach every one of the ten).',
    input: {
      rawQuestion: 'What happened in Rwanda in 1994?',
      questionLanguage: 'en',
      languageClassification: 'CLASSIFIED',
      // CTO CORRECTION 1: the reader types this place in the question, so its provenance
      // is TYPED_GEOGRAPHY. ENTITY_GEOGRAPHY is reserved for geography derived from a
      // resolved entity the reader did NOT name.
      typedGeography: { value: 'RWA', precision: 'COUNTRY' },
      statedPeriod: '1994',
      temporalRequirement: 'HISTORICAL',
      reading: reading({ queryIntent: 'ENTITY_BACKGROUND' }),
    },
    expect: {
      questionClass: 'HISTORICAL',
      terminalState: 'BROADENING_OFFERED',
      refusals: ['BROADENING_OFFERED', 'CONSTRAINT_UNTRANSPORTABLE'],
      scopedBy: 'TYPED_GEOGRAPHY',
      scopedByLanded: 'TYPED_GEOGRAPHY',
      divergenceKind: 'NONE',
      geographyRequired: false,
      modelPriorPermitted: false,
      droppedConstraintAxes: ['TIME'],
      disclosures: ['CONSTRAINT_NOT_APPLIED'],
    },
  },

  /* ================= multilingual: L's measured failure, closed ================= */

  {
    id: 'L1-en-control',
    changedByRuling: 'RULING 2 — was CLARIFICATION_REQUIRED; time broadens. The EN control still differs from its twins by REFUSAL CODE, which is what the row is for.',
    provenance:
      'L\'s English control. "What is the security situation on the border today?" -> domains [security].',
    input: {
      rawQuestion: 'What is the security situation on the border today?',
      questionLanguage: 'en',
      languageClassification: 'CLASSIFIED',
      statedPeriod: 'today',
      temporalRequirement: 'RECENT',
      reading: reading({ queryIntent: 'CURRENT_EVENT', analyticalDomains: ['security'] }),
    },
    expect: {
      questionClass: 'SPECIALIST_DOMAIN',
      terminalState: 'BROADENING_OFFERED',
      refusals: ['BROADENING_OFFERED', 'CONSTRAINT_UNTRANSPORTABLE', 'SPECIALIST_NOT_BOUND'],
      scopedBy: 'CLASSIFIED_SHAPE',
      scopedByLanded: 'CLASSIFIED_SHAPE',
      divergenceKind: 'NONE',
      geographyRequired: true,
      modelPriorPermitted: false,
      droppedConstraintAxes: ['TIME'],
      specialistRequiredness: { security: 'SUPPLEMENTARY' },
      disclosures: ['CONSTRAINT_NOT_APPLIED', 'SPECIALIST_INTELLIGENCE_NOT_USED'],
    },
  },

  {
    id: 'L2-pl-twin-no-accidental-match',
    provenance:
      'L measured: PL/FR/SW/AR twins carry domains [] because detection is English substring matching, "and a question with no domain is a news question by construction". CTO ruling 7: unclassified/unsupported language must never silently become CURRENT_NEWS.',
    input: {
      rawQuestion: 'Jaka jest sytuacja bezpieczenstwa na granicy dzisiaj?',
      questionLanguage: 'pl',
      languageClassification: 'CLASSIFIED',
      statedPeriod: 'dzisiaj',
      temporalRequirement: 'RECENT',
      reading: reading({ queryIntent: 'CURRENT_EVENT', analyticalDomains: [] }),
    },
    expect: {
      questionClass: 'CLARIFICATION_REQUIRED',
      terminalState: 'CLARIFICATION_REQUIRED',
      refusals: ['LANGUAGE_UNSUPPORTED'],
      scopedBy: 'CLASSIFIED_SHAPE',
      scopedByLanded: 'CLASSIFIED_SHAPE',
      divergenceKind: 'NONE',
      geographyRequired: true,
      modelPriorPermitted: false,
      droppedConstraintAxes: [],
      disclosures: [],
      clarification: ['LANGUAGE_UNSUPPORTED:-:pl:en'],
    },
  },

  {
    id: 'L3-pl-accidental-coverage-suppressed',
    provenance:
      'L\'s strongest finding: "the presence of accidental multilingual detection that nobody declared and no test covers" — `region` matches in Polish while `région` fails on one diacritic. The landed classifier DOES return a domain here; the envelope must still declare the axis unread, because derivation state is decided by language coverage and never by match count.',
    input: {
      rawQuestion: 'Jakie sa zagrozenia bezpieczenstwa w regionie?',
      questionLanguage: 'pl',
      languageClassification: 'CLASSIFIED',
      reading: reading({ queryIntent: 'CURRENT_EVENT', analyticalDomains: ['security'] }),
    },
    expect: {
      questionClass: 'CLARIFICATION_REQUIRED',
      terminalState: 'CLARIFICATION_REQUIRED',
      refusals: ['LANGUAGE_UNSUPPORTED'],
      scopedBy: 'CLASSIFIED_SHAPE',
      scopedByLanded: 'CLASSIFIED_SHAPE',
      divergenceKind: 'NONE',
      geographyRequired: true,
      modelPriorPermitted: false,
      droppedConstraintAxes: [],
      disclosures: [],
      clarification: ['LANGUAGE_UNSUPPORTED:-:pl:en'],
    },
  },

  {
    id: 'L4-ar-eastern-numerals',
    provenance:
      'L measured: /\\d/ matches only U+0030-0039 and the `u` flag does not widen it; an Eastern-Arabic numeral is not a number to any \\d check and Number() agrees. AR is not production-selectable yet (MA §11), so it is UNSUPPORTED rather than merely uncovered.',
    input: {
      rawQuestion: 'ma huwa alwad alamni ala alhudud fi 2026?',
      questionLanguage: 'ar',
      languageClassification: 'UNSUPPORTED',
      statedPeriod: 'AR-EASTERN-NUMERAL-2026',
      temporalRequirement: 'EXPLICIT_WINDOW',
      reading: reading({ queryIntent: 'CURRENT_EVENT', analyticalDomains: [] }),
    },
    expect: {
      questionClass: 'CLARIFICATION_REQUIRED',
      terminalState: 'CLARIFICATION_REQUIRED',
      refusals: ['LANGUAGE_UNSUPPORTED'],
      scopedBy: 'CLASSIFIED_SHAPE',
      scopedByLanded: 'CLASSIFIED_SHAPE',
      divergenceKind: 'NONE',
      geographyRequired: true,
      modelPriorPermitted: false,
      droppedConstraintAxes: [],
      disclosures: [],
      clarification: ['LANGUAGE_UNSUPPORTED:-:ar:en'],
    },
  },

  {
    id: 'L5-unidentified-language',
    provenance:
      'L gate Q3: "an unreadable question is disclosed, never defaulted — this is the gate that closes the security example, because \'no signal\' and \'a news topic\' are currently the same output."',
    input: {
      rawQuestion: 'qwerty asdf zxcv',
      questionLanguage: null,
      languageClassification: 'UNCLASSIFIED',
      reading: reading({ queryIntent: 'CURRENT_EVENT' }),
    },
    expect: {
      questionClass: 'CLARIFICATION_REQUIRED',
      terminalState: 'CLARIFICATION_REQUIRED',
      refusals: ['LANGUAGE_UNCLASSIFIED'],
      scopedBy: 'CLASSIFIED_SHAPE',
      scopedByLanded: 'CLASSIFIED_SHAPE',
      divergenceKind: 'NONE',
      geographyRequired: true,
      modelPriorPermitted: false,
      droppedConstraintAxes: [],
      disclosures: [],
      clarification: ['LANGUAGE_UNCLASSIFIED:-:-:en'],
    },
  },

  /* ================= G's second named failure ================= */

  {
    id: 'G1-convention-centre-yesterday',
    changedByRuling: 'RULING 2 — was CLARIFICATION_REQUIRED; time broadens.',
    provenance:
      'G\'s named failure: "Convention centre yesterday (Rwanda) falls back to World Events" — the chip says world events; the answer was about Rwanda. R-CHIP-2: World Events is a positive claim about global scope, not a resting state. A plan that fell back to rank 9 here would be that untruth in planner form.',
    input: {
      rawQuestion: 'Convention centre yesterday',
      questionLanguage: 'en',
      languageClassification: 'CLASSIFIED',
      typedGeography: { value: 'RWA', precision: 'COUNTRY' },
      statedPeriod: 'yesterday',
      temporalRequirement: 'RECENT',
      reading: reading({ queryIntent: 'CURRENT_EVENT' }),
    },
    expect: {
      questionClass: 'CURRENT_REPORTING',
      terminalState: 'BROADENING_OFFERED',
      refusals: ['BROADENING_OFFERED', 'CONSTRAINT_UNTRANSPORTABLE'],
      scopedBy: 'TYPED_GEOGRAPHY',
      scopedByLanded: 'TYPED_GEOGRAPHY',
      divergenceKind: 'NONE',
      geographyRequired: true,
      modelPriorPermitted: false,
      droppedConstraintAxes: ['TIME'],
      disclosures: ['CONSTRAINT_NOT_APPLIED'],
    },
  },

  /* ================= precedence, after ruling 1 ================= */

  {
    id: 'P1-typed-geography-outranks-story-context',
    changedByRuling:
      'RULING 1 — scope was ARTICLE_ANCHOR with precedenceDivergence true. The CTO reconciled the table: "Current typed user scope must outrank inherited story context." This row is how C-R2 is closed.',
    provenance:
      'Was THE REPORTED CONFLICT C-R2. Main\'s table ranked ARTICLE_ANCHOR above TYPED_GEOGRAPHY; the landed chain sets typedScopeOverridesStory = true, so "a typed place outranks any context" (G, measured at analysis.service.ts:1149-1159). The reconciled table now agrees with the landed chain.',
    input: {
      rawQuestion: 'What about Kenya?',
      questionLanguage: 'en',
      languageClassification: 'CLASSIFIED',
      typedGeography: { value: 'KEN', precision: 'COUNTRY' },
      storyAnchorCountry: 'RWA',
      reading: reading({ queryIntent: 'ARTICLE_ANCHORED' }),
    },
    expect: {
      questionClass: 'CURRENT_REPORTING',
      terminalState: 'EXECUTABLE',
      refusals: [],
      scopedBy: 'TYPED_GEOGRAPHY',
      scopedByLanded: 'TYPED_GEOGRAPHY',
      divergenceKind: 'NONE',
      geographyRequired: true,
      modelPriorPermitted: false,
      droppedConstraintAxes: [],
      disclosures: [],
    },
  },

  {
    id: 'P2-declared-region-outranks-all-geography',
    provenance:
      'Both tables agree: an explicit requested region is the top of the CTO\'s geography ordering and P1 of the landed lattice ("a scope, never a precision"). Negative control proving divergence is not always present.',
    input: {
      rawQuestion: 'What is happening in East Africa?',
      questionLanguage: 'en',
      languageClassification: 'CLASSIFIED',
      declaredRegion: 'EAST_AFRICA',
      typedGeography: { value: 'KEN', precision: 'COUNTRY' },
      mapContextCountry: 'RWA',
      reading: reading({ queryIntent: 'GEOGRAPHIC_REGIONAL' }),
    },
    expect: {
      questionClass: 'CURRENT_REPORTING',
      terminalState: 'EXECUTABLE',
      refusals: [],
      scopedBy: 'DECLARED_REGION',
      scopedByLanded: 'DECLARED_REGION',
      divergenceKind: 'NONE',
      geographyRequired: true,
      modelPriorPermitted: false,
      droppedConstraintAxes: [],
      disclosures: [],
    },
  },

  {
    id: 'P3-map-context-only',
    provenance:
      'G: the map hands off and never executes; geographyContextDto with a governed-country 400 has landed. Map country is the lowest geography rung in both tables.',
    input: {
      rawQuestion: 'What is happening here?',
      questionLanguage: 'en',
      languageClassification: 'CLASSIFIED',
      mapContextCountry: 'RWA',
      reading: reading({ queryIntent: 'CURRENT_EVENT' }),
    },
    expect: {
      questionClass: 'CURRENT_REPORTING',
      terminalState: 'EXECUTABLE',
      refusals: [],
      scopedBy: 'MAP_GEOGRAPHY_CONTEXT',
      scopedByLanded: 'MAP_GEOGRAPHY_CONTEXT',
      divergenceKind: 'NONE',
      geographyRequired: true,
      modelPriorPermitted: false,
      droppedConstraintAxes: [],
      disclosures: [],
    },
  },

  {
    id: 'P4-story-context-outranks-map-country',
    provenance:
      'CTO ruling 1 ordering, lower half: story context sits above Map country. With no typed or entity geography present, the story anchor scopes the plan. Reachability row for the ARTICLE_ANCHOR rung after the reconciliation moved it.',
    input: {
      rawQuestion: 'What else has been reported?',
      questionLanguage: 'en',
      languageClassification: 'CLASSIFIED',
      storyAnchorCountry: 'RWA',
      mapContextCountry: 'KEN',
      reading: reading({ queryIntent: 'ARTICLE_ANCHORED' }),
    },
    expect: {
      questionClass: 'CURRENT_REPORTING',
      terminalState: 'EXECUTABLE',
      refusals: [],
      scopedBy: 'ARTICLE_ANCHOR',
      scopedByLanded: 'ARTICLE_ANCHOR',
      divergenceKind: 'NONE',
      geographyRequired: true,
      modelPriorPermitted: false,
      droppedConstraintAxes: [],
      disclosures: [],
    },
  },

  {
    id: 'P5-entity-geography-effective-when-required',
    provenance:
      'CTO ruling 1, second clause: "Entity geography is derived context and only becomes effective scope when the planner actually requires it." Here the reporting leg requires geography, so it IS effective. Paired with O1 and H1, where nothing requires it and it is not.',
    input: {
      rawQuestion: 'What is happening with Safaricom?',
      questionLanguage: 'en',
      languageClassification: 'CLASSIFIED',
      entityGeography: { value: 'KEN', precision: 'COUNTRY' },
      reading: reading({ queryIntent: 'CURRENT_EVENT' }),
    },
    expect: {
      questionClass: 'CURRENT_REPORTING',
      terminalState: 'EXECUTABLE',
      refusals: [],
      scopedBy: 'ENTITY_GEOGRAPHY',
      scopedByLanded: 'ENTITY_GEOGRAPHY',
      divergenceKind: 'NONE',
      geographyRequired: true,
      modelPriorPermitted: false,
      droppedConstraintAxes: [],
      disclosures: [],
    },
  },

  /* ================= source-attributed frame: REV C ================= */

  {
    id: 'S1-unparsed-publisher-frame',
    provenance:
      'L routed this to Main: "a frame that does not parse resumes ordinary routing, which is the publisher substitution REV C exists to prevent, reached because the question was in Polish." The landed module: answering a question about one publisher with another publisher\'s reporting "is not a smaller failure than answering nothing — it is a different and worse one."',
    input: {
      rawQuestion: 'Co KT Press napisal o tym?',
      questionLanguage: 'pl',
      languageClassification: 'CLASSIFIED',
      reading: reading({
        queryIntent: 'CURRENT_EVENT',
        sourceAttributed: { parsed: false, namedPublisher: 'KT Press' },
      }),
    },
    expect: {
      questionClass: 'CLARIFICATION_REQUIRED',
      terminalState: 'CLARIFICATION_REQUIRED',
      // Both causes are true and both are reported; neither masks the other.
      refusals: ['LANGUAGE_UNSUPPORTED', 'SOURCE_FRAME_UNPARSED'],
      scopedBy: 'CLASSIFIED_SHAPE',
      scopedByLanded: 'CLASSIFIED_SHAPE',
      divergenceKind: 'NONE',
      geographyRequired: true,
      modelPriorPermitted: false,
      droppedConstraintAxes: [],
      disclosures: [],
      clarification: ['LANGUAGE_UNSUPPORTED:-:pl:en', 'SOURCE_FRAME_UNPARSED:SOURCE_FRAME:KT Press:-'],
    },
  },

  {
    id: 'S2-parsed-publisher-frame',
    provenance:
      'Negative control for S1: a parsed frame must scope by SOURCE_INTENT and must not clarify. SOURCE_INTENT is a declared-only rung, so the divergence is ADDITIVE.',
    input: {
      rawQuestion: 'What has KT Press reported about the budget?',
      questionLanguage: 'en',
      languageClassification: 'CLASSIFIED',
      reading: reading({
        queryIntent: 'CURRENT_EVENT',
        sourceAttributed: { parsed: true, namedPublisher: 'KT Press' },
      }),
    },
    expect: {
      questionClass: 'CURRENT_REPORTING',
      terminalState: 'EXECUTABLE',
      refusals: [],
      scopedBy: 'SOURCE_INTENT',
      scopedByLanded: 'CLASSIFIED_SHAPE',
      divergenceKind: 'ADDITIVE',
      geographyRequired: true,
      modelPriorPermitted: false,
      droppedConstraintAxes: [],
      disclosures: [],
    },
  },

  /* ================= compute consent ================= */

  {
    id: 'C1-consent-absent-blocks-spend',
    provenance:
      'CTO: "`/search?q=` or `/ask?q=` does not constitute permission to spend compute." E1-D2 asked whether arrival is consent; the CTO answered no, so the planner reads consent and never infers it from a route.',
    input: {
      rawQuestion: 'What is happening in Kenya?',
      questionLanguage: 'en',
      languageClassification: 'CLASSIFIED',
      computeConsent: 'ABSENT',
      typedGeography: { value: 'KEN', precision: 'COUNTRY' },
      reading: reading({ queryIntent: 'CURRENT_EVENT' }),
    },
    expect: {
      questionClass: 'CURRENT_REPORTING',
      terminalState: 'AWAITING_COMPUTE_CONSENT',
      refusals: ['COMPUTE_CONSENT_ABSENT'],
      scopedBy: 'TYPED_GEOGRAPHY',
      scopedByLanded: 'TYPED_GEOGRAPHY',
      divergenceKind: 'NONE',
      geographyRequired: true,
      modelPriorPermitted: false,
      droppedConstraintAxes: [],
      disclosures: [],
    },
  },

  {
    id: 'C2-consent-absent-still-refuses-first',
    changedByRuling: 'TERMINAL RENAMED — CAPABILITY_UNAVAILABLE. Ordering unchanged.',
    provenance:
      'Ordering control: a question with no executor costs nothing to refuse, so CAPABILITY_UNAVAILABLE must precede AWAITING_COMPUTE_CONSENT.',
    input: {
      rawQuestion: 'Solve x^3 - 4x + 1 = 0',
      questionLanguage: 'en',
      languageClassification: 'CLASSIFIED',
      computeConsent: 'ABSENT',
      computationRequested: true,
      reading: reading({ queryIntent: 'EXPLANATION' }),
    },
    expect: {
      questionClass: 'COMPUTATION',
      terminalState: 'CAPABILITY_UNAVAILABLE',
      refusals: ['MODEL_PRIOR_FORBIDDEN', 'NO_EXECUTOR_COMPUTATION'],
      scopedBy: 'CLASSIFIED_SHAPE',
      scopedByLanded: 'CLASSIFIED_SHAPE',
      divergenceKind: 'NONE',
      geographyRequired: false,
      modelPriorPermitted: false,
      droppedConstraintAxes: [],
      disclosures: [],
    },
  },

  {
    id: 'C3-reference-also-needs-consent',
    provenance: 'A model call is compute, so REFERENCE_BACKGROUND_ONLY is not a free path around the consent gate.',
    input: {
      rawQuestion: 'Who was Hitler?',
      questionLanguage: 'en',
      languageClassification: 'CLASSIFIED',
      computeConsent: 'ABSENT',
      reading: reading({ queryIntent: 'ENTITY_BACKGROUND' }),
    },
    expect: {
      questionClass: 'REFERENCE',
      terminalState: 'AWAITING_COMPUTE_CONSENT',
      refusals: ['COMPUTE_CONSENT_ABSENT'],
      scopedBy: 'CLASSIFIED_SHAPE',
      scopedByLanded: 'CLASSIFIED_SHAPE',
      divergenceKind: 'NONE',
      geographyRequired: false,
      modelPriorPermitted: true,
      droppedConstraintAxes: [],
      disclosures: ['REFERENCE_BACKGROUND_NOT_CITABLE'],
    },
  },

  /* ================= specialist registry: ruling 4 ================= */

  {
    id: 'R1-unregistered-domain',
    provenance:
      'H: a domain not in registeredDomains() renders withheld, NAMING the domain. Humanitarian is not registered. CTO ruling 4: the code for unregistered must differ from the code for registered-but-unbound, or the two failures are indistinguishable in the register.',
    input: {
      rawQuestion: 'What is the humanitarian situation in the DRC?',
      questionLanguage: 'en',
      languageClassification: 'CLASSIFIED',
      typedGeography: { value: 'COD', precision: 'COUNTRY' },
      reading: reading({
        queryIntent: 'CURRENT_EVENT',
        analyticalDomains: ['ILLUSTRATIVE:humanitarian'],
      }),
    },
    expect: {
      questionClass: 'SPECIALIST_DOMAIN',
      terminalState: 'EXECUTABLE',
      refusals: ['SPECIALIST_NOT_REGISTERED'],
      scopedBy: 'TYPED_GEOGRAPHY',
      scopedByLanded: 'TYPED_GEOGRAPHY',
      divergenceKind: 'NONE',
      geographyRequired: true,
      modelPriorPermitted: false,
      droppedConstraintAxes: [],
      specialistRequiredness: { 'ILLUSTRATIVE:humanitarian': 'SUPPLEMENTARY' },
      disclosures: ['SPECIALIST_INTELLIGENCE_NOT_USED'],
    },
  },

  {
    id: 'R2-both-registered-and-unregistered',
    provenance:
      'Brief case 6 fans out to Conflict AND Humanitarian. Both codes must appear; neither may mask the other. Absence is stated per domain, never averaged.',
    input: {
      rawQuestion: 'What is the security and humanitarian situation in the DRC?',
      questionLanguage: 'en',
      languageClassification: 'CLASSIFIED',
      typedGeography: { value: 'COD', precision: 'COUNTRY' },
      reading: reading({
        queryIntent: 'CURRENT_EVENT',
        analyticalDomains: ['security', 'ILLUSTRATIVE:humanitarian'],
      }),
    },
    expect: {
      questionClass: 'SPECIALIST_DOMAIN',
      terminalState: 'EXECUTABLE',
      refusals: ['SPECIALIST_NOT_BOUND', 'SPECIALIST_NOT_REGISTERED'],
      scopedBy: 'TYPED_GEOGRAPHY',
      scopedByLanded: 'TYPED_GEOGRAPHY',
      divergenceKind: 'NONE',
      geographyRequired: true,
      modelPriorPermitted: false,
      droppedConstraintAxes: [],
      specialistRequiredness: { security: 'SUPPLEMENTARY', 'ILLUSTRATIVE:humanitarian': 'SUPPLEMENTARY' },
      disclosures: ['SPECIALIST_INTELLIGENCE_NOT_USED'],
    },
  },

  /* ================= follow-up ================= */

  {
    id: 'F1-follow-up-relation-scopes',
    provenance:
      'FOLLOW_UP_RELATION is a declared-only rung above geography. AskRoutingOptions has exactly one field today and this is it; ConversationSubjectAnchor.focus[] is derived from the PRIOR question only (G B-1).',
    input: {
      rawQuestion: 'And after that?',
      questionLanguage: 'en',
      languageClassification: 'CLASSIFIED',
      mapContextCountry: 'RWA',
      reading: reading({
        queryIntent: 'CURRENT_EVENT',
        conversationSubject: { hasPriorQuestion: true, focusFromPriorQuestion: ['budget'] },
      }),
    },
    expect: {
      questionClass: 'CURRENT_REPORTING',
      terminalState: 'EXECUTABLE',
      refusals: [],
      scopedBy: 'FOLLOW_UP_RELATION',
      scopedByLanded: 'MAP_GEOGRAPHY_CONTEXT',
      divergenceKind: 'ADDITIVE',
      geographyRequired: true,
      modelPriorPermitted: false,
      droppedConstraintAxes: [],
      disclosures: [],
    },
  },

  /* ================= landed verdict passthrough ================= */

  {
    id: 'V1-landed-clarification-intent',
    provenance:
      'CLARIFICATION_REQUIRED already exists as a landed QueryIntent. The router honours the landed verdict rather than re-deciding it — that is what "no seventh classifier" means in practice. CTO: clarification is a valid terminal planning state.',
    input: {
      rawQuestion: 'it',
      questionLanguage: 'en',
      languageClassification: 'CLASSIFIED',
      reading: reading({ queryIntent: 'CLARIFICATION_REQUIRED' }),
    },
    expect: {
      questionClass: 'CLARIFICATION_REQUIRED',
      terminalState: 'CLARIFICATION_REQUIRED',
      refusals: ['CLARIFICATION_REQUIRED'],
      scopedBy: 'CLASSIFIED_SHAPE',
      scopedByLanded: 'CLASSIFIED_SHAPE',
      divergenceKind: 'NONE',
      geographyRequired: false,
      modelPriorPermitted: false,
      droppedConstraintAxes: [],
      disclosures: [],
      clarification: ['CLARIFICATION_REQUIRED:-:-:-'],
    },
  },

  /* ================= ruling 2 rung 3 ================= */

  {
    id: 'W1-topic-only-nothing-left-to-broaden',
    changedByRuling:
      'FINAL SEMANTIC CORRECTION — was INSUFFICIENT_EVIDENCE. Nothing was attempted here: the topic axis has no channel at all, so this is a missing capability, not evidence that fell short. INSUFFICIENT_EVIDENCE is now reserved exclusively for the post-execution verification outcome.',
    provenance:
      'CTO ruling 2 rung 3, reachability row. The reader\'s only constraint is a topic, which has no channel (G B-1). Removing it leaves "all news, everywhere, any time", which is not an answer — so the honest terminal is insufficient evidence rather than a broadening nobody would accept.',
    input: {
      rawQuestion: 'Entertainment news',
      questionLanguage: 'en',
      languageClassification: 'CLASSIFIED',
      topicTerms: ['entertainment'],
      reading: reading({ queryIntent: 'CURRENT_EVENT' }),
    },
    expect: {
      questionClass: 'CURRENT_REPORTING',
      terminalState: 'CAPABILITY_UNAVAILABLE',
      refusals: ['CONSTRAINT_UNTRANSPORTABLE', 'MODEL_PRIOR_FORBIDDEN'],
      scopedBy: 'CLASSIFIED_SHAPE',
      scopedByLanded: 'CLASSIFIED_SHAPE',
      divergenceKind: 'NONE',
      geographyRequired: true,
      modelPriorPermitted: false,
      droppedConstraintAxes: ['TOPIC'],
      disclosures: [],
      clarification: [],
    },
  },

  /* ================= ruling 3, second reading ================= */

  {
    id: 'W2-current-status-with-typed-place',
    provenance:
      'Rulings 1 and 3 together: a typed place outranks entity geography, and a current office/status plans the two-source partial-verification path rather than refusing. The as-of time requirement and the model-prior prohibition ride with it.',
    input: {
      rawQuestion: 'Who is the president of Kenya right now?',
      questionLanguage: 'en',
      languageClassification: 'CLASSIFIED',
      typedGeography: { value: 'KEN', precision: 'COUNTRY' },
      currentStatusRequested: true,
      currentStatusTerms: ['president'],
      temporalRequirement: 'AS_OF_NOW',
      reading: reading({ queryIntent: 'ENTITY_BACKGROUND' }),
    },
    expect: {
      questionClass: 'CURRENT_STATUS_VERIFICATION',
      terminalState: 'EXECUTABLE',
      refusals: ['MODEL_PRIOR_CANNOT_VERIFY', 'OFFICIAL_VERIFICATION_UNAVAILABLE'],
      scopedBy: 'TYPED_GEOGRAPHY',
      scopedByLanded: 'TYPED_GEOGRAPHY',
      divergenceKind: 'NONE',
      geographyRequired: true,
      modelPriorPermitted: false,
      droppedConstraintAxes: [],
      disclosures: ['PARTIAL_VERIFICATION_AS_OF_TIME'],
      verificationOutcomes: ['CURRENT_REPORTING_PARTIAL_VERIFICATION', 'INSUFFICIENT_EVIDENCE'],
    },
  },

  /* ================= negative controls for the probes themselves ================= */

  {
    id: 'NC1-plain-reporting-must-not-clarify',
    provenance:
      'Negative control. If the clarification or broadening rules leaked, every row would stop short and the corpus would prove nothing. A plain country-scoped reporting question with no unstated constraint must be EXECUTABLE with no refusals at all.',
    input: {
      rawQuestion: 'What is happening in Kenya?',
      questionLanguage: 'en',
      languageClassification: 'CLASSIFIED',
      typedGeography: { value: 'KEN', precision: 'COUNTRY' },
      reading: reading({ queryIntent: 'CURRENT_EVENT' }),
    },
    expect: {
      questionClass: 'CURRENT_REPORTING',
      terminalState: 'EXECUTABLE',
      refusals: [],
      scopedBy: 'TYPED_GEOGRAPHY',
      scopedByLanded: 'TYPED_GEOGRAPHY',
      divergenceKind: 'NONE',
      geographyRequired: true,
      modelPriorPermitted: false,
      droppedConstraintAxes: [],
      disclosures: [],
      clarification: [],
    },
  },

  {
    id: 'NC2-model-prior-never-fills-a-gap',
    changedByRuling: 'TERMINAL RENAMED — CAPABILITY_UNAVAILABLE. Behaviour unchanged.',
    provenance:
      'Negative control for the evidence boundary. Main: MODEL_PRIOR is "forbidden when required is non-empty". A question needing an unbound class must never come back as background prose.',
    input: {
      rawQuestion: "What is Kenya's latest official inflation figure?",
      questionLanguage: 'en',
      languageClassification: 'CLASSIFIED',
      // CTO CORRECTION 1: the reader types this place in the question, so its provenance
      // is TYPED_GEOGRAPHY. ENTITY_GEOGRAPHY is reserved for geography derived from a
      // resolved entity the reader did NOT name.
      typedGeography: { value: 'KEN', precision: 'COUNTRY' },
      officialRequested: true,
      officialTerms: ['official inflation figure'],
      reading: reading({ queryIntent: 'ENTITY_BACKGROUND' }),
    },
    expect: {
      questionClass: 'OFFICIAL_DOCUMENT',
      terminalState: 'CAPABILITY_UNAVAILABLE',
      refusals: ['MODEL_PRIOR_FORBIDDEN', 'NO_CAPABILITY'],
      scopedBy: 'TYPED_GEOGRAPHY',
      scopedByLanded: 'TYPED_GEOGRAPHY',
      divergenceKind: 'NONE',
      geographyRequired: false,
      modelPriorPermitted: false,
      droppedConstraintAxes: [],
      disclosures: [],
    },
  },

  /* ================= CTO correction 1 · geography provenance ================= */

  {
    id: 'P6-typed-place-outranks-resolved-entity-geography',
    provenance:
      'CTO correction 1 defines ENTITY_GEOGRAPHY as geography derived from a resolved entity the reader did NOT name. Here the reader names Uganda and the entity resolves to Kenya, so the two provenances genuinely coexist and the typed place must win (rank 5 over rank 6).',
    input: {
      rawQuestion: 'What is happening with Safaricom in Uganda?',
      questionLanguage: 'en',
      languageClassification: 'CLASSIFIED',
      typedGeography: { value: 'UGA', precision: 'COUNTRY' },
      entityGeography: { value: 'KEN', precision: 'COUNTRY' },
      reading: reading({ queryIntent: 'CURRENT_EVENT' }),
    },
    expect: {
      questionClass: 'CURRENT_REPORTING',
      terminalState: 'EXECUTABLE',
      refusals: [],
      scopedBy: 'TYPED_GEOGRAPHY',
      scopedByLanded: 'TYPED_GEOGRAPHY',
      divergenceKind: 'NONE',
      geographyRequired: true,
      modelPriorPermitted: false,
      droppedConstraintAxes: [],
      disclosures: [],
    },
  },

  {
    id: 'O2-entity-geography-not-required',
    provenance:
      'Keeps ruling 1\'s conditional half reachable in the corpus with an HONEST provenance: the reader names no place, an entity resolves to one, and nothing requires geography — so entity geography stays derived context while the landed chain would scope it. Replaces the RULED coverage that correction 1 removed from O1, H1 and NC2.',
    input: {
      rawQuestion: "What is Safaricom's latest audited revenue?",
      questionLanguage: 'en',
      languageClassification: 'CLASSIFIED',
      entityGeography: { value: 'KEN', precision: 'COUNTRY' },
      officialRequested: true,
      officialTerms: ['audited revenue'],
      reading: reading({ queryIntent: 'ENTITY_BACKGROUND' }),
    },
    expect: {
      questionClass: 'OFFICIAL_DOCUMENT',
      terminalState: 'CAPABILITY_UNAVAILABLE',
      refusals: ['MODEL_PRIOR_FORBIDDEN', 'NO_CAPABILITY'],
      scopedBy: 'CLASSIFIED_SHAPE',
      scopedByLanded: 'ENTITY_GEOGRAPHY',
      divergenceKind: 'RULED',
      geographyRequired: false,
      modelPriorPermitted: false,
      droppedConstraintAxes: [],
      disclosures: [],
    },
  },

  /* ================= CTO correction 2 · specialist requiredness ================= */

  {
    id: 'D3a-explicitly-requested-specialist',
    provenance:
      'CTO correction 2, first case: "Explicitly requested specialist -> missing/unbound specialist is CAPABILITY_UNAVAILABLE." The reader asks for the assessment itself, so reporting is not an answer to the question asked.',
    input: {
      rawQuestion: 'Give me the conflict assessment for the DRC',
      questionLanguage: 'en',
      languageClassification: 'CLASSIFIED',
      typedGeography: { value: 'COD', precision: 'COUNTRY' },
      explicitSpecialistDomains: ['security'],
      reading: reading({ queryIntent: 'CURRENT_EVENT', analyticalDomains: ['security'] }),
    },
    expect: {
      questionClass: 'SPECIALIST_DOMAIN',
      terminalState: 'CAPABILITY_UNAVAILABLE',
      refusals: ['MODEL_PRIOR_FORBIDDEN', 'SPECIALIST_NOT_BOUND'],
      scopedBy: 'TYPED_GEOGRAPHY',
      scopedByLanded: 'TYPED_GEOGRAPHY',
      divergenceKind: 'NONE',
      geographyRequired: true,
      modelPriorPermitted: false,
      droppedConstraintAxes: [],
      // No disclosure: there is no answer to disclose anything about.
      disclosures: [],
      specialistRequiredness: { security: 'REQUIRED' },
      reportingSubstitutionForbidden: true,
    },
  },

  {
    id: 'D3b-specialist-materially-required',
    provenance:
      'CTO correction 2, second case: "Specialist materially required for the requested claim -> do not silently substitute ordinary reporting." Severity is a Conflict-owned claim (MA §6: HOSTILITY_SEVERITY), so reporting cannot stand in for it. Enforced structurally — the reporting leg is removed from the plan, not merely deprioritised.',
    input: {
      rawQuestion: 'How severe is the hostility in the DRC?',
      questionLanguage: 'en',
      languageClassification: 'CLASSIFIED',
      typedGeography: { value: 'COD', precision: 'COUNTRY' },
      materiallySpecialistDomains: ['security'],
      reading: reading({ queryIntent: 'CURRENT_EVENT', analyticalDomains: ['security'] }),
    },
    expect: {
      questionClass: 'SPECIALIST_DOMAIN',
      terminalState: 'CAPABILITY_UNAVAILABLE',
      refusals: ['MODEL_PRIOR_FORBIDDEN', 'SPECIALIST_NOT_BOUND'],
      scopedBy: 'TYPED_GEOGRAPHY',
      scopedByLanded: 'TYPED_GEOGRAPHY',
      divergenceKind: 'NONE',
      geographyRequired: true,
      modelPriorPermitted: false,
      droppedConstraintAxes: [],
      disclosures: [],
      specialistRequiredness: { security: 'REQUIRED' },
      reportingSubstitutionForbidden: true,
    },
  },
];
