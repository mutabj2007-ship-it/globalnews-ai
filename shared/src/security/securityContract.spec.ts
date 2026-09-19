/*
 * MAIN-SECURITY-PLATFORM-1 — CONTRACT TESTS AND MUTATION BITES
 *
 * Two kinds of test, kept apart on purpose:
 *
 *   CONTRACT   the rule holds on correct input.
 *   BITE       the rule REFUSES a specific wrong input. A guard is not evidence
 *              until a mutation proves it binds, so every refusal below is paired
 *              with the passing case it is the negation of.
 *
 * No provider runtime is exercised. Nothing here opens a socket, reads a feed or
 * needs a credential.
 */

import {
  ADMISSION_STAGES,
  AGGREGATION_BEARING_RELATIONS,
  AXIS_STATE_PERMITTING_ASSERTION,
  CHANGE_STATE_REQUIRING_FULL_COVERAGE,
  CLAIM_TYPE_ADMISSIBLE_INSTRUMENTS,
  DISCLOSURE_TIERS,
  DISCLOSURE_TIER_ORDER,
  FREE_TEXT_FIELDS_ARE_NOT_FIELD_CONTROLLABLE,
  HIGH_CONSEQUENCE_CLAIM_TYPES,
  IDENTITY_BASES_REFUSED,
  INSTRUMENTS_ADMITTING_NO_PERSON_CLAIM,
  INSTRUMENTS_ESTABLISHING_CULPABILITY,
  OUTCOMES_ESTABLISHING_ABSENCE,
  PERSON_FIELDS_DROPPED_AT_SEAM,
  PART_IX_RELATION_TYPES,
  PRODUCER_ACTIVATION_BLOCKERS,
  RELATION_AGGREGATE_ARTEFACT,
  S1_LINK_CATEGORY_STATUS,
  SECURITY_COVERAGE_AXES,
  SECURITY_DATA_LIMITS,
  SOURCE_QUERY_OUTCOMES,
  STANDINGS_NEVER_CURRENT,
  WITHDRAWN_BLOCKERS,
  CAP_STATUS,
  CYBER_INCIDENT_SOURCE_STATUS,
  ENTSOE_BUSINESS_TYPE,
  SABOTAGE_CONFIRMED_STATUS,
  admitAggregation,
  assertAssessmentIsHonest,
  assertCoverageDeclarationIsComplete,
  assertIncidentFacetIsSingular,
  assertSingleOccurrenceAcrossDomains,
  authorisationSatisfiesTier,
  axisCoverageState,
  claimLifecycleState,
  evaluateNaturalPersonClaim,
  incidentFacetOwner,
  instrumentAdmitsClaimType,
  notificationAssertsCauseOrActor,
  isAggregationOperation,
  mayAdmitArtifact,
  mayNotify,
  mayPromoteToEvidence,
  outcomeEstablishesAbsence,
  outcomeIsComplete,
} from './index';
import type {
  AgeableClaim,
  AxisFinding,
  CandidateArtifact,
  CoverageDeclaration,
  NaturalPersonClaim,
  NotificationCandidate,
  ProminencePolicy,
  SecurityAssessment,
  SourceQueryOutcome,
  SourceQueryRecord,
} from './index';

/* ─── fixtures ─────────────────────────────────────────────────────────────── */

const POLICY: ProminencePolicy = { reviewIntervalDays: 90, setBy: 'PRODUCT_OWNER/PO-2' };

function fullyCoveredDeclaration(): CoverageDeclaration {
  return {
    subjectId: 'SIT-PL-ENERGY-1',
    geographyId: 'PL',
    declaredBy: 'EDITORIAL',
    declaredAt: '2026-09-07T00:00:00Z',
    axes: SECURITY_COVERAGE_AXES.map((axis) => ({
      axis,
      expectedSourceSet: ['src-a'],
      knownExclusions: [],
    })),
  };
}

/** The real shape G measured: ENTSO-E covers occurrence, nothing covers the rest. */
function realisticPolishEnergyDeclaration(): CoverageDeclaration {
  return {
    subjectId: 'SIT-PL-ENERGY-1',
    geographyId: 'PL',
    declaredBy: 'EDITORIAL',
    declaredAt: '2026-09-07T00:00:00Z',
    axes: SECURITY_COVERAGE_AXES.map((axis) => ({
      axis,
      expectedSourceSet: axis === 'OCCURRENCE' ? ['entsoe'] : [],
      knownExclusions: [],
    })),
  };
}

function allSucceeded(sourceIds: readonly string[]): SourceQueryRecord[] {
  return sourceIds.map((sourceId) => ({
    sourceId,
    outcome: 'NO_RESULTS' as SourceQueryOutcome,
    attemptedAt: '2026-09-07T00:00:00Z',
  }));
}

function findingsFor(
  declaration: CoverageDeclaration,
  outcomes: readonly SourceQueryRecord[],
): AxisFinding[] {
  return SECURITY_COVERAGE_AXES.map((axis) => {
    const state = axisCoverageState(declaration, axis, outcomes);
    return state === AXIS_STATE_PERMITTING_ASSERTION
      ? { axis, coverageState: state, finding: 'nothing observed' }
      : { axis, coverageState: state, finding: null, absenceReason: `axis ${axis} is ${state}` };
  });
}

function assessmentFrom(
  declaration: CoverageDeclaration,
  outcomes: readonly SourceQueryRecord[],
  changeState: SecurityAssessment['changeState'],
  changeStateReason?: string,
): SecurityAssessment {
  return {
    subjectId: declaration.subjectId,
    assessedAt: '2026-09-07T00:00:00Z',
    producedBy: 'test-producer',
    coverage: declaration,
    outcomes,
    axisFindings: findingsFor(declaration, outcomes),
    changeState,
    changeStateReason,
  };
}

/* ─── §1 · A-24 COVERAGE ───────────────────────────────────────────────────── */

describe('A-24 — coverage gap is not no-change', () => {
  it('the axes are the five the contract requires, and the list is closed', () => {
    expect(SECURITY_COVERAGE_AXES).toEqual([
      'OCCURRENCE',
      'CAUSE',
      'ACTOR',
      'POSTURE',
      'SEVERITY',
    ]);
  });

  it('EXACTLY ONE outcome establishes absence, and it is not SUCCESS', () => {
    expect(OUTCOMES_ESTABLISHING_ABSENCE).toEqual(['NO_RESULTS']);
    expect(outcomeEstablishesAbsence('NO_RESULTS')).toBe(true);
    expect(outcomeEstablishesAbsence('SUCCESS')).toBe(false);
  });

  it('every failure mode G observed is a distinct, non-absence outcome', () => {
    const observed: SourceQueryOutcome[] = [
      'AUTH_FAILED',
      'RATE_LIMITED',
      'TRUNCATED',
      'DEFUNCT',
      'UNREACHABLE_STANDING',
      'SOURCE_UNAVAILABLE',
      'NOT_ATTEMPTED',
    ];
    for (const outcome of observed) {
      expect(SOURCE_QUERY_OUTCOMES).toContain(outcome);
      expect(outcomeEstablishesAbsence(outcome)).toBe(false);
      expect(outcomeIsComplete(outcome)).toBe(false);
    }
  });

  it('BITE — a UCDP 401 does not read as a quiet week', () => {
    const outcomes: SourceQueryRecord[] = [
      { sourceId: 'src-a', outcome: 'AUTH_FAILED', attemptedAt: '2026-09-07T00:00:00Z' },
    ];
    expect(axisCoverageState(fullyCoveredDeclaration(), 'OCCURRENCE', outcomes)).toBe('UNESTABLISHED');
  });

  it('BITE — ENTSOG silent truncation is not a complete answer', () => {
    const outcomes: SourceQueryRecord[] = [
      { sourceId: 'src-a', outcome: 'TRUNCATED', attemptedAt: '2026-09-07T00:00:00Z' },
    ];
    expect(axisCoverageState(fullyCoveredDeclaration(), 'OCCURRENCE', outcomes)).toBe('UNESTABLISHED');
  });

  it('BITE — a DEFUNCT source answering from an empty shell is not a quiet week', () => {
    const outcomes: SourceQueryRecord[] = [
      { sourceId: 'src-a', outcome: 'DEFUNCT', attemptedAt: '2026-09-07T00:00:00Z' },
    ];
    expect(axisCoverageState(fullyCoveredDeclaration(), 'OCCURRENCE', outcomes)).toBe('UNESTABLISHED');
  });

  it('BITE — a source with NO recorded outcome is UNESTABLISHED, never ESTABLISHED', () => {
    expect(axisCoverageState(fullyCoveredDeclaration(), 'OCCURRENCE', [])).toBe('UNESTABLISHED');
  });

  it('an empty expected source set is a DECLARED GAP, not a pass', () => {
    const declaration = realisticPolishEnergyDeclaration();
    const outcomes = allSucceeded(['entsoe']);
    expect(axisCoverageState(declaration, 'OCCURRENCE', outcomes)).toBe('ESTABLISHED');
    for (const axis of ['CAUSE', 'ACTOR', 'POSTURE', 'SEVERITY'] as const) {
      expect(axisCoverageState(declaration, axis, outcomes)).toBe('GAP_DECLARED');
    }
  });

  it('a known exclusion produces GAP_BY_EXCLUSION — the FEWS NET case', () => {
    const declaration: CoverageDeclaration = {
      subjectId: 'SIT-SO-1',
      geographyId: 'SO',
      declaredBy: 'EDITORIAL',
      declaredAt: '2026-09-07T00:00:00Z',
      axes: SECURITY_COVERAGE_AXES.map((axis) => ({
        axis,
        expectedSourceSet: ['fewsnet'],
        knownExclusions: [
          {
            sourceId: 'fewsnet',
            excludes: 'Somalia, Afghanistan and Yemen paused August 2026',
            geographyIds: ['SO', 'AF', 'YE'],
            establishedBy: 'publisher announcement, not in-band',
          },
        ],
      })),
    };
    expect(axisCoverageState(declaration, 'OCCURRENCE', [])).toBe('GAP_BY_EXCLUSION');
  });

  it('BITE — a declaration that omits an axis is refused', () => {
    const declaration = fullyCoveredDeclaration();
    const missingActor: CoverageDeclaration = {
      ...declaration,
      axes: declaration.axes.filter((a) => a.axis !== 'ACTOR'),
    };
    expect(() => assertCoverageDeclarationIsComplete(missingActor)).toThrow(/SEC-COV-1/);
  });

  it('BITE — an unauthored declaration is refused', () => {
    expect(() =>
      assertCoverageDeclarationIsComplete({ ...fullyCoveredDeclaration(), declaredBy: '  ' }),
    ).toThrow(/SEC-COV-0/);
  });
});

/* ─── §2 · ASSESSMENT HONESTY ──────────────────────────────────────────────── */

describe('assessment — no evidence must not manufacture a substantive state', () => {
  it('NO_MATERIAL_CHANGE is permitted when every axis is established', () => {
    const assessment = assessmentFrom(
      fullyCoveredDeclaration(),
      allSucceeded(['src-a']),
      CHANGE_STATE_REQUIRING_FULL_COVERAGE,
    );
    expect(() => assertAssessmentIsHonest(assessment)).not.toThrow();
  });

  it('THE CENTRAL BITE — NO_MATERIAL_CHANGE is refused while any axis is uncovered', () => {
    const assessment = assessmentFrom(
      realisticPolishEnergyDeclaration(),
      allSucceeded(['entsoe']),
      CHANGE_STATE_REQUIRING_FULL_COVERAGE,
    );
    expect(() => assertAssessmentIsHonest(assessment)).toThrow(/SEC-ASSESS-6/);
    expect(() => assertAssessmentIsHonest(assessment)).toThrow(/NO DATA MAY NEVER BECOME SAFETY/);
  });

  it('the honest form of the same subject is a null state with a reason', () => {
    const assessment = assessmentFrom(
      realisticPolishEnergyDeclaration(),
      allSucceeded(['entsoe']),
      null,
      'cause, actor, posture and severity are permanently uncovered for this subject',
    );
    expect(() => assertAssessmentIsHonest(assessment)).not.toThrow();
  });

  it('BITE — a null state without a reason is refused', () => {
    const assessment = assessmentFrom(realisticPolishEnergyDeclaration(), allSucceeded(['entsoe']), null);
    expect(() => assertAssessmentIsHonest(assessment)).toThrow(/SEC-ASSESS-7/);
  });

  it('BITE — a missing axis is not an absence of news', () => {
    const declaration = fullyCoveredDeclaration();
    const outcomes = allSucceeded(['src-a']);
    const assessment: SecurityAssessment = {
      ...assessmentFrom(declaration, outcomes, null, 'r'),
      axisFindings: findingsFor(declaration, outcomes).filter((f) => f.axis !== 'ACTOR'),
    };
    expect(() => assertAssessmentIsHonest(assessment)).toThrow(/SEC-ASSESS-2/);
  });

  it('BITE — MISSING AXIS NOT INFERRED: an uncovered axis may not carry a finding', () => {
    const declaration = realisticPolishEnergyDeclaration();
    const outcomes = allSucceeded(['entsoe']);
    const inferred = findingsFor(declaration, outcomes).map((f) =>
      f.axis === 'CAUSE' ? { ...f, finding: 'no cause established', absenceReason: undefined } : f,
    );
    const assessment: SecurityAssessment = {
      ...assessmentFrom(declaration, outcomes, null, 'r'),
      axisFindings: inferred,
    };
    expect(() => assertAssessmentIsHonest(assessment)).toThrow(/SEC-ASSESS-4/);
  });

  it('BITE — a claimed coverage state the outcomes do not support is refused', () => {
    const declaration = fullyCoveredDeclaration();
    const outcomes: SourceQueryRecord[] = [
      { sourceId: 'src-a', outcome: 'RATE_LIMITED', attemptedAt: '2026-09-07T00:00:00Z' },
    ];
    const lying: AxisFinding[] = SECURITY_COVERAGE_AXES.map((axis) => ({
      axis,
      coverageState: 'ESTABLISHED',
      finding: 'nothing observed',
    }));
    const assessment: SecurityAssessment = {
      ...assessmentFrom(declaration, outcomes, null, 'r'),
      axisFindings: lying,
    };
    expect(() => assertAssessmentIsHonest(assessment)).toThrow(/SEC-ASSESS-3/);
  });
});

/* ─── §3 · B-1 NAMED NATURAL PERSONS ───────────────────────────────────────── */

function personClaim(over: Partial<NaturalPersonClaim> = {}): NaturalPersonClaim {
  return {
    subjectIsNaturalPerson: true,
    claimType: 'ACTOR_ATTRIBUTION',
    instrument: 'COURT_JUDGMENT',
    claimantId: 'court-pl-1',
    recordScope: 'the judgment of 2026-05-01',
    identityBasis: 'DETERMINISTIC_RECORD',
    provenance: { sourceType: 'OFFICIAL_SOURCE' },
    recordDatedAt: '2026-05-01T00:00:00Z',
    ...over,
  };
}

describe('B-1 — high-consequence claims about identifiable natural persons', () => {
  it('identity known and claim evidenced are TWO fields, not one', () => {
    const verdict = evaluateNaturalPersonClaim(personClaim());
    expect(verdict.identityIsKnown).toBe(true);
    expect(verdict.claimIsSufficientlyEvidenced).toBe(true);
    expect(verdict.displayable).toBe(true);
  });

  it('THE CORE BITE — shared identity is not evidentiary permission', () => {
    const verdict = evaluateNaturalPersonClaim(
      personClaim({ instrument: 'SANCTIONS_LISTING', claimantId: 'ofsi' }),
    );
    expect(verdict.identityIsKnown).toBe(true);
    expect(verdict.claimIsSufficientlyEvidenced).toBe(false);
    expect(verdict.displayable).toBe(false);
    expect(verdict.reasons.join(' ')).toMatch(/SEC-PERSON-4/);
  });

  it('exactly one instrument establishes culpability', () => {
    expect(INSTRUMENTS_ESTABLISHING_CULPABILITY).toEqual(['COURT_JUDGMENT']);
  });

  it("BITE — none of G's five lower instruments may attribute an actor", () => {
    for (const instrument of [
      'SANCTIONS_LISTING',
      'INDICTMENT',
      'STATE_DECLARATION',
      'CSIRT_ADVISORY',
      'RESEARCH_CLUSTER_LABEL',
    ] as const) {
      expect(evaluateNaturalPersonClaim(personClaim({ instrument })).displayable).toBe(false);
    }
  });

  it('BITE — NO AI SIMILARITY', () => {
    const verdict = evaluateNaturalPersonClaim(personClaim({ identityBasis: 'AI_SIMILARITY' }));
    expect(verdict.identityIsKnown).toBe(false);
    expect(verdict.displayable).toBe(false);
    expect(verdict.reasons.join(' ')).toMatch(/SEC-PERSON-1/);
  });

  it('BITE — every refused identity basis is refused, not just the first', () => {
    for (const identityBasis of IDENTITY_BASES_REFUSED) {
      expect(evaluateNaturalPersonClaim(personClaim({ identityBasis })).displayable).toBe(false);
    }
  });

  it('BITE — NO GUILT BY ASSOCIATION', () => {
    const verdict = evaluateNaturalPersonClaim(
      personClaim({ instrument: 'DATASET_CODER_ASSIGNMENT', relatedSubjectIds: ['a', 'b', 'c'] }),
    );
    expect(verdict.claimIsSufficientlyEvidenced).toBe(false);
    expect(verdict.reasons.join(' ')).toMatch(/SEC-PERSON-5/);
  });

  it('BITE — a claim with no claimant is not displayable', () => {
    expect(evaluateNaturalPersonClaim(personClaim({ claimantId: '   ' })).displayable).toBe(false);
  });

  it('BITE — a claim with no record scope is not displayable', () => {
    expect(evaluateNaturalPersonClaim(personClaim({ recordScope: '' })).displayable).toBe(false);
  });

  it('the seam drop list names the fields G measured in every sanctions source', () => {
    for (const field of [
      'dateOfBirth',
      'placeOfBirth',
      'passportNumber',
      'nationalIdentityNumber',
      'address',
      'x_mitre_contributors',
    ]) {
      expect(PERSON_FIELDS_DROPPED_AT_SEAM).toContain(field);
    }
  });
});

/* ─── §4 · B-2 STALE UNVERIFIED CLAIMS ─────────────────────────────────────── */

function ageable(over: Partial<AgeableClaim> = {}): AgeableClaim {
  return {
    claimId: 'c1',
    standing: 'UNVERIFIED_CLAIM',
    recordDatedAt: '2026-01-01T00:00:00Z',
    firstAssertedAt: '2026-01-01T00:00:00Z',
    corroboratedBySecondSourceClass: false,
    ...over,
  };
}

describe('B-2 — permanence, prominence and alert eligibility are three things', () => {
  it('an old uncorroborated claim leaves the current picture and KEEPS ITS RECORD', () => {
    const state = claimLifecycleState(ageable(), '2026-09-07T00:00:00Z', POLICY);
    expect(state.recordPermanence).toBe('PERMANENT');
    expect(state.prominence).toBe('HISTORICAL');
    expect(state.alertEligibility).toBe('INELIGIBLE');
  });

  it('BITE — record permanence is PERMANENT in every branch, including the decayed one', () => {
    const cases: AgeableClaim[] = [
      ageable(),
      ageable({ corroboratedBySecondSourceClass: true }),
      ageable({ standing: 'WITHDRAWN' }),
      ageable({ standing: 'VERIFIED' }),
      ageable({ recordDatedAt: '2026-09-01T00:00:00Z', firstAssertedAt: '2026-09-01T00:00:00Z' }),
    ];
    for (const claim of cases) {
      expect(claimLifecycleState(claim, '2026-09-07T00:00:00Z', POLICY).recordPermanence).toBe(
        'PERMANENT',
      );
    }
  });

  it('corroboration from a SECOND source class keeps a claim current', () => {
    const state = claimLifecycleState(
      ageable({ corroboratedBySecondSourceClass: true }),
      '2026-09-07T00:00:00Z',
      POLICY,
    );
    expect(state.prominence).toBe('CURRENT');
    expect(state.alertEligibility).toBe('ELIGIBLE');
  });

  it('a court finding does not decay with age', () => {
    const state = claimLifecycleState(
      ageable({ standing: 'VERIFIED', recordDatedAt: '2019-01-01T00:00:00Z', firstAssertedAt: '2019-01-01T00:00:00Z' }),
      '2026-09-07T00:00:00Z',
      POLICY,
    );
    expect(state.prominence).toBe('CURRENT');
  });

  it('R1 · E-8 — a withdrawn claim keeps its record, leaves the current picture, never alerts', () => {
    const state = claimLifecycleState(
      ageable({ standing: 'WITHDRAWN' }),
      '2026-09-07T00:00:00Z',
      POLICY,
    );
    expect(state.recordPermanence).toBe('PERMANENT');
    expect(state.prominence).toBe('HISTORICAL');
    expect(state.alertEligibility).toBe('INELIGIBLE');
  });

  it('BITE — an unowned prominence policy is refused', () => {
    expect(() =>
      claimLifecycleState(ageable(), '2026-09-07T00:00:00Z', { reviewIntervalDays: 90, setBy: '' }),
    ).toThrow(/SEC-STALE-1/);
  });

  it('BITE — an unparseable date is not silently treated as fresh', () => {
    expect(() =>
      claimLifecycleState(
        ageable({ recordDatedAt: 'last Tuesday', firstAssertedAt: 'last Tuesday' }),
        '2026-09-07T00:00:00Z',
        POLICY,
      ),
    ).toThrow(/SEC-STALE-0/);
  });
});

/* ─── §5 · B-3 AGGREGATE INFRASTRUCTURE ────────────────────────────────────── */

describe('B-3 — the aggregation gate sits at admission', () => {
  it('one document against one asset is a record, not a topology', () => {
    expect(
      isAggregationOperation({
        relationType: 'DEPENDS_ON',
        sourceDocumentIds: ['d1'],
        retainedRelationCount: 1,
        resultingTier: 'PUBLIC_SAFE',
      }),
    ).toBe(false);
  });

  it('joining documents into a topology IS aggregation', () => {
    expect(
      isAggregationOperation({
        relationType: 'DEPENDS_ON',
        sourceDocumentIds: ['d1', 'd2'],
        retainedRelationCount: 1,
        resultingTier: 'ACCESS_CONTROL_NEEDED',
      }),
    ).toBe(true);
  });

  it('THE CORE BITE — the default is refusal, not admission', () => {
    const decision = admitAggregation({
      relationType: 'EXPOSES',
      sourceDocumentIds: ['d1', 'd2', 'd3'],
      retainedRelationCount: 3,
      resultingTier: 'ACCESS_CONTROL_NEEDED',
    });
    expect(decision.verdict).toBe('REJECT');
    expect(decision.reason).toMatch(/SEC-AGG-2/);
  });

  it('BITE — DO_NOT_EXPOSE is refused even WITH authorisation', () => {
    const decision = admitAggregation(
      {
        relationType: 'EXPOSES',
        sourceDocumentIds: ['d1', 'd2'],
        retainedRelationCount: 2,
        resultingTier: 'DO_NOT_EXPOSE',
      },
      { relationType: 'EXPOSES', authorisedTier: 'DO_NOT_EXPOSE', authorisedBy: 'someone' },
    );
    expect(decision.verdict).toBe('REJECT');
    expect(decision.reason).toMatch(/SEC-AGG-1/);
  });

  it('BITE — an authorisation does not generalise to another relation type', () => {
    const decision = admitAggregation(
      {
        relationType: 'DEPENDS_ON',
        sourceDocumentIds: ['d1', 'd2'],
        retainedRelationCount: 2,
        resultingTier: 'COARSE_ONLY',
      },
      { relationType: 'EXPOSES', authorisedTier: 'COARSE_ONLY', authorisedBy: 'po' },
    );
    expect(decision.verdict).toBe('REJECT');
    expect(decision.reason).toMatch(/SEC-AGG-3/);
  });

  it('an authorisation short of the resulting tier COARSENS before retention', () => {
    const decision = admitAggregation(
      {
        relationType: 'EXPOSES',
        sourceDocumentIds: ['d1', 'd2'],
        retainedRelationCount: 2,
        resultingTier: 'ACCESS_CONTROL_NEEDED',
      },
      { relationType: 'EXPOSES', authorisedTier: 'COARSE_ONLY', authorisedBy: 'po' },
    );
    expect(decision.verdict).toBe('COARSEN');
  });

  it('an explicit, matching, owned authorisation admits', () => {
    const decision = admitAggregation(
      {
        relationType: 'EXPOSES',
        sourceDocumentIds: ['d1', 'd2'],
        retainedRelationCount: 2,
        resultingTier: 'ACCESS_CONTROL_NEEDED',
      },
      { relationType: 'EXPOSES', authorisedTier: 'ACCESS_CONTROL_NEEDED', authorisedBy: 'po' },
    );
    expect(decision.verdict).toBe('ADMIT');
  });

  it('the contract names the aggregation-bearing relations and BUILDS NO GRAPH', () => {
    /*
      R1 · E-4(b) / E-9. R0 named two of Part IX's seven relation types and E1
      measured a SPILLOVER_TO join walking through the gate. The list is now
      derived from the audited seven — and naming them is still not building them.
    */
    expect(AGGREGATION_BEARING_RELATIONS).toContain('EXPOSES');
    expect(AGGREGATION_BEARING_RELATIONS).toContain('DEPENDS_ON');
    expect(AGGREGATION_BEARING_RELATIONS).toContain('SPILLOVER_TO');
    expect(AGGREGATION_BEARING_RELATIONS.length).toBe(PART_IX_RELATION_TYPES.length);
    const exported = require('./index') as Record<string, unknown>;
    for (const forbidden of ['buildExposureGraph', 'traverseDependencies', 'createEdge']) {
      expect(exported[forbidden]).toBeUndefined();
    }
  });
});

/* ─── §6 · B-4 ADMISSION PIPELINE ──────────────────────────────────────────── */

function artifact(over: Partial<CandidateArtifact> = {}): CandidateArtifact {
  return {
    artifactId: 'a1',
    provenance: { sourceType: 'OFFICIAL_SOURCE' },
    evidenceRole: 'PRIMARY_RECORD',
    dataTier: 'OPEN',
    claimantId: 'ministry-x',
    isAiSynthesis: false,
    ...over,
  };
}

function notification(over: Partial<NotificationCandidate> = {}): NotificationCandidate {
  return {
    subjectId: 'SIT-1',
    assessment: assessmentFrom(
      fullyCoveredDeclaration(),
      allSucceeded(['src-a']),
      'SIGNIFICANT_CHANGE',
    ),
    evidenceSourceClasses: ['GOVERNMENT', 'RESEARCH'],
    assertedAxes: [],
    onlyMovementIsPossiblyRelatedEdge: false,
    restsOnUnsupportedProviderState: false,
    restsOnAiSynthesis: false,
    ...over,
  };
}

describe('B-4 — four stages, and passing one never means passing the next', () => {
  it('the four stages are distinct and ordered', () => {
    expect(ADMISSION_STAGES).toEqual([
      'SOURCE_ADMISSION',
      'EVIDENCE',
      'ASSESSMENT',
      'NOTIFICATION',
    ]);
  });

  it('THE CORE BITE — an anonymous artifact enters the RECORD and not the EVIDENCE SET', () => {
    const anonymous = artifact({ claimantId: '' });
    expect(mayAdmitArtifact(anonymous).permitted).toBe(true);
    expect(mayPromoteToEvidence(anonymous).permitted).toBe(false);
    expect(mayPromoteToEvidence(anonymous).reasons.join(' ')).toMatch(/SEC-EVID-1/);
  });

  it('BITE — AI synthesis is not an artifact at all', () => {
    expect(mayAdmitArtifact(artifact({ isAiSynthesis: true })).permitted).toBe(false);
  });

  it('BITE — an allegation is never more available than its evidence', () => {
    expect(mayPromoteToEvidence(artifact({ dataTier: 'UNAVAILABLE' })).permitted).toBe(false);
  });

  it('BITE — SOURCE ADMISSION IS NOT ALERT ELIGIBILITY', () => {
    const admissible = artifact();
    expect(mayAdmitArtifact(admissible).permitted).toBe(true);
    expect(mayPromoteToEvidence(admissible).permitted).toBe(true);
    const single = notification({
      assertedAxes: ['CAUSE'],
      evidenceSourceClasses: ['GOVERNMENT'],
    });
    expect(mayNotify(single).permitted).toBe(false);
    expect(mayNotify(single).reasons.join(' ')).toMatch(/SEC-NOTIFY-5/);
  });

  it('a cause/actor alert with a SECOND source class is permitted', () => {
    expect(
      mayNotify(
        notification({ assertedAxes: ['CAUSE'], evidenceSourceClasses: ['GOVERNMENT', 'COURT'] }),
      ).permitted,
    ).toBe(true);
  });

  it('BITE — the same source class twice is not corroboration', () => {
    expect(
      mayNotify(
        notification({
          assertedAxes: ['ACTOR'],
          evidenceSourceClasses: ['GOVERNMENT', 'GOVERNMENT', 'GOVERNMENT'],
        }),
      ).permitted,
    ).toBe(false);
  });

  it('BITE — AI SYNTHESIS CANNOT AUTHORIZE AN ALERT', () => {
    const synth = notification({ restsOnAiSynthesis: true });
    expect(mayNotify(synth).permitted).toBe(false);
    expect(mayNotify(synth).reasons.join(' ')).toMatch(/SEC-NOTIFY-2/);
  });

  it('BITE — an unsupported provider state cannot authorize an alert', () => {
    expect(mayNotify(notification({ restsOnUnsupportedProviderState: true })).permitted).toBe(false);
  });

  it('BITE — a POSSIBLY_RELATED edge is the absence of authority, not evidence of it', () => {
    const weak = notification({ onlyMovementIsPossiblyRelatedEdge: true });
    expect(mayNotify(weak).permitted).toBe(false);
    expect(mayNotify(weak).reasons.join(' ')).toMatch(/SEC-NOTIFY-4/);
  });

  it('BITE — a null change state never notifies', () => {
    const quiet = notification({
      assessment: assessmentFrom(
        realisticPolishEnergyDeclaration(),
        allSucceeded(['entsoe']),
        null,
        'four axes permanently uncovered',
      ),
    });
    expect(mayNotify(quiet).permitted).toBe(false);
    expect(mayNotify(quiet).reasons.join(' ')).toMatch(/SEC-NOTIFY-1/);
  });
});

/* ─── §7 · M-2 APPROVED AUTHORITY ──────────────────────────────────────────── */

describe('M-2 — protest ownership, Product Owner approved', () => {
  it('Security owns the incident when armed-hostility criteria are NOT met', () => {
    expect(incidentFacetOwner('NOT_MET')).toBe('SECURITY');
  });

  it('Conflict owns the incident once the criteria are met', () => {
    expect(incidentFacetOwner('MET')).toBe('CONFLICT');
  });

  it('THE CORE BITE — UNDETERMINED has NO owner, and does not default to Security', () => {
    expect(incidentFacetOwner('UNDETERMINED')).toBeNull();
  });

  it('BITE — Security may not claim the incident while the criteria are undetermined', () => {
    expect(() => assertIncidentFacetIsSingular('UNDETERMINED', ['SECURITY'])).toThrow(/SEC-M2-2/);
  });

  it('BITE — Security may not claim the incident once Conflict owns it', () => {
    expect(() => assertIncidentFacetIsSingular('MET', ['SECURITY'])).toThrow(/SEC-M2-3/);
  });

  it('BITE — Conflict may not claim the incident when the criteria are not met', () => {
    expect(() => assertIncidentFacetIsSingular('NOT_MET', ['CONFLICT'])).toThrow(/SEC-M2-3/);
  });

  it('ONE OCCURRENCE, THREE DOMAIN FACETS is permitted', () => {
    expect(() =>
      assertSingleOccurrenceAcrossDomains([
        { occurrenceId: 'occ-1', facetDomain: 'POLITICS' },
        { occurrenceId: 'occ-1', facetDomain: 'SECURITY' },
        { occurrenceId: 'occ-1', facetDomain: 'CONFLICT' },
      ]),
    ).not.toThrow();
  });

  it('BITE — a domain holding TWO facets of one occurrence is a duplicate truth record', () => {
    expect(() =>
      assertSingleOccurrenceAcrossDomains([
        { occurrenceId: 'occ-1', facetDomain: 'SECURITY' },
        { occurrenceId: 'occ-1', facetDomain: 'SECURITY' },
      ]),
    ).toThrow(/SEC-M2-1/);
  });

  it('BITE — a facet with no canonical occurrence is an independent record', () => {
    expect(() =>
      assertSingleOccurrenceAcrossDomains([{ occurrenceId: '  ', facetDomain: 'SECURITY' }]),
    ).toThrow(/SEC-M2-0/);
  });
});

/* ─── §8 · REGISTERS ───────────────────────────────────────────────────────── */

describe('registers — the facts that must not be re-derived optimistically', () => {
  it('S-1 is NOT closed, and the absent category is named', () => {
    const absent = S1_LINK_CATEGORY_STATUS.filter((c) => c.partIxTreatment === 'ABSENT');
    expect(absent).toHaveLength(1);
    expect(absent[0].category).toBe('political assassination attempts');
    expect(absent[0].note).toMatch(/bound to B-1/i);
  });

  it('R1 — U-2 is WITHDRAWN; A09/A13 stands, because it is a docStatus finding', () => {
    /*
      R0 asserted U-2 as an active blocker. G's SOURCE-CLOSURE-1 established that
      A53 = Planned maintenance and A54 = Unplanned outage, so the contradiction
      never existed. The obsolete blocker is NOT preserved merely because it
      appeared in an earlier accepted package. A09/A13 is untouched by that
      withdrawal: it concerns docStatus, not businessType.
    */
    const ids = PRODUCER_ACTIVATION_BLOCKERS.map((b) => b.id);
    expect(ids).not.toContain('U-2');
    expect(ids).toContain('U-2b');
    const a13 = PRODUCER_ACTIVATION_BLOCKERS.filter((b) => b.id === 'U-2b')[0];
    expect(a13.finding).toMatch(/A13 must never produce a restoration event/);
  });

  it('the measured data limits are preserved exactly', () => {
    expect(SECURITY_DATA_LIMITS.corridorSpatialCapability).toBe('ENDPOINT_ONLY');
    expect(SECURITY_DATA_LIMITS.postureProducerCount).toBe(0);
    expect(SECURITY_DATA_LIMITS.sabotageConfirmedProducerCount).toBe(0);
    expect(SECURITY_DATA_LIMITS.cyberIncidentConfirmedProducerCount).toBe(0);
    expect(SECURITY_DATA_LIMITS.sharedAssetRegistry).toBe('ABSENT');
    expect(SECURITY_DATA_LIMITS.partIxObjectsProducible).toBe(2);
    expect(SECURITY_DATA_LIMITS.partIxObjectsContextOnly).toBe(4);
    expect(SECURITY_DATA_LIMITS.partIxObjectsUnreachable).toBe(5);
    expect(SECURITY_DATA_LIMITS.lifecycleEventsWithProducer).toBe(2);
  });

  it('the eleven objects partition exactly', () => {
    expect(
      SECURITY_DATA_LIMITS.partIxObjectsProducible +
        SECURITY_DATA_LIMITS.partIxObjectsContextOnly +
        SECURITY_DATA_LIMITS.partIxObjectsUnreachable,
    ).toBe(11);
  });

  it('the contract declares no Security runtime active', () => {
    const exported = require('./index') as Record<string, unknown>;
    for (const forbidden of [
      'activateProvider',
      'startSecurityRuntime',
      'SECURITY_RUNTIME_ACTIVE',
      'createSituation',
      'clusterOccurrencesIntoSituation',
    ]) {
      expect(exported[forbidden]).toBeUndefined();
    }
  });
});

/* ═══════════════════════════════════════════════════════════════════════════════
 * R1 · E1 CANDIDATE-REVIEW CLOSURES
 * ═══════════════════════════════════════════════════════════════════════════════ */

describe('R1 · E-1 — the admissibility matrix reaches every claim type, not two cells', () => {
  it('a detention on a research cluster label is REFUSED — the R0 hole', () => {
    const verdict = evaluateNaturalPersonClaim(
      personClaim({ claimType: 'DETENTION', instrument: 'RESEARCH_CLUSTER_LABEL' }),
    );
    expect(verdict.identityIsKnown).toBe(true);
    expect(verdict.claimIsSufficientlyEvidenced).toBe(false);
    expect(verdict.displayable).toBe(false);
    expect(verdict.reasons.join(' ')).toMatch(/SEC-PERSON-6/);
  });

  it('a charge on a dataset coder assignment is REFUSED', () => {
    expect(
      evaluateNaturalPersonClaim(
        personClaim({ claimType: 'CHARGE', instrument: 'DATASET_CODER_ASSIGNMENT' }),
      ).displayable,
    ).toBe(false);
  });

  it('THE GRID — three instruments admit NO claim about a natural person, ever', () => {
    for (const instrument of INSTRUMENTS_ADMITTING_NO_PERSON_CLAIM) {
      for (const claimType of HIGH_CONSEQUENCE_CLAIM_TYPES) {
        expect(instrumentAdmitsClaimType(instrument, claimType)).toBe(false);
        expect(
          evaluateNaturalPersonClaim(personClaim({ claimType, instrument })).displayable,
        ).toBe(false);
      }
    }
  });

  it('POSITIVE CONTROL — detention and charge ARE displayable on court and indictment', () => {
    for (const claimType of ['DETENTION', 'CHARGE', 'SECURITY_CONDUCT'] as const) {
      for (const instrument of ['COURT_JUDGMENT', 'INDICTMENT'] as const) {
        expect(
          evaluateNaturalPersonClaim(personClaim({ claimType, instrument })).displayable,
        ).toBe(true);
      }
    }
  });

  it('culpability is still COURT_JUDGMENT alone — the R0 rule is not weakened', () => {
    expect(INSTRUMENTS_ESTABLISHING_CULPABILITY).toEqual(['COURT_JUDGMENT']);
    expect(CLAIM_TYPE_ADMISSIBLE_INSTRUMENTS.ACTOR_ATTRIBUTION).toEqual(['COURT_JUDGMENT']);
    expect(CLAIM_TYPE_ADMISSIBLE_INSTRUMENTS.CYBER_ACTOR_STATUS).toEqual(['COURT_JUDGMENT']);
  });

  it('every claim type has an explicit admissible-instrument list — no cell is undefined', () => {
    for (const claimType of HIGH_CONSEQUENCE_CLAIM_TYPES) {
      expect(Array.isArray(CLAIM_TYPE_ADMISSIBLE_INSTRUMENTS[claimType])).toBe(true);
      expect(CLAIM_TYPE_ADMISSIBLE_INSTRUMENTS[claimType].length).toBeGreaterThan(0);
    }
  });
});

describe('R1 · E-2 / E-8 — a replaced or withdrawn reading is never current', () => {
  it('THE BLOCKING BITE — a SUPERSEDED claim is HISTORICAL and INELIGIBLE', () => {
    const state = claimLifecycleState(
      ageable({ standing: 'SUPERSEDED' }),
      '2026-09-07T00:00:00Z',
      POLICY,
    );
    expect(state.prominence).toBe('HISTORICAL');
    expect(state.alertEligibility).toBe('INELIGIBLE');
    expect(state.recordPermanence).toBe('PERMANENT');
  });

  it('a RECENT superseded claim is still not current — age is irrelevant', () => {
    const state = claimLifecycleState(
      ageable({
        standing: 'SUPERSEDED',
        recordDatedAt: '2026-09-06T00:00:00Z',
        firstAssertedAt: '2026-09-06T00:00:00Z',
      }),
      '2026-09-07T00:00:00Z',
      POLICY,
    );
    expect(state.alertEligibility).toBe('INELIGIBLE');
  });

  it('a CORROBORATED superseded claim is still not current — corroboration is irrelevant', () => {
    const state = claimLifecycleState(
      ageable({ standing: 'SUPERSEDED', corroboratedBySecondSourceClass: true }),
      '2026-09-07T00:00:00Z',
      POLICY,
    );
    expect(state.alertEligibility).toBe('INELIGIBLE');
  });

  it('both never-current standings are covered, and the record survives both', () => {
    expect(STANDINGS_NEVER_CURRENT).toEqual(['WITHDRAWN', 'SUPERSEDED']);
    for (const standing of STANDINGS_NEVER_CURRENT) {
      const state = claimLifecycleState(ageable({ standing }), '2026-09-07T00:00:00Z', POLICY);
      expect(state.recordPermanence).toBe('PERMANENT');
      expect(state.prominence).toBe('HISTORICAL');
      expect(state.alertEligibility).toBe('INELIGIBLE');
    }
  });
});

describe('R1 · E-3 — prominence does not reset on re-publication', () => {
  it('THE LAUNDERING BITE — an old allegation re-issued today stays HISTORICAL', () => {
    const state = claimLifecycleState(
      ageable({
        recordDatedAt: '2026-09-07T00:00:00Z',
        firstAssertedAt: '2026-01-01T00:00:00Z',
      }),
      '2026-09-07T00:00:00Z',
      POLICY,
    );
    expect(state.prominence).toBe('HISTORICAL');
    expect(state.alertEligibility).toBe('INELIGIBLE');
    expect(state.reason).toMatch(/Re-publication does not restart the clock/);
  });

  it('POSITIVE CONTROL — a genuinely new allegation is CURRENT', () => {
    const state = claimLifecycleState(
      ageable({
        recordDatedAt: '2026-09-01T00:00:00Z',
        firstAssertedAt: '2026-09-01T00:00:00Z',
      }),
      '2026-09-07T00:00:00Z',
      POLICY,
    );
    expect(state.prominence).toBe('CURRENT');
  });
});

describe('R1 · E-4 / E-9 — the B-3 perimeter matches the threat', () => {
  it('THE BLOCKING BITE (a) — ONE document that IS a topology is an aggregation', () => {
    const single = {
      relationType: 'EXPOSES',
      sourceDocumentIds: ['d1'],
      retainedRelationCount: 12,
      resultingTier: 'ACCESS_CONTROL_NEEDED' as const,
    };
    expect(isAggregationOperation(single)).toBe(true);
    expect(admitAggregation(single).verdict).toBe('REJECT');
  });

  it('one relation from one document is still a record, not a topology', () => {
    const record = {
      relationType: 'EXPOSES',
      sourceDocumentIds: ['d1'],
      retainedRelationCount: 1,
      resultingTier: 'PUBLIC_SAFE' as const,
    };
    expect(isAggregationOperation(record)).toBe(false);
    expect(admitAggregation(record).verdict).toBe('ADMIT');
  });

  it('THE BLOCKING BITE (b) — SPILLOVER_TO is inside the gate', () => {
    const spill = {
      relationType: 'SPILLOVER_TO',
      sourceDocumentIds: ['d1', 'd2'],
      retainedRelationCount: 2,
      resultingTier: 'ACCESS_CONTROL_NEEDED' as const,
    };
    expect(isAggregationOperation(spill)).toBe(true);
    expect(admitAggregation(spill).verdict).toBe('REJECT');
  });

  it('ALL SEVEN Part IX relation types are audited and none is invented', () => {
    expect(PART_IX_RELATION_TYPES).toEqual([
      'EXPOSES',
      'DEPENDS_ON',
      'DISRUPTED',
      'SPILLOVER_TO',
      'REFERENCES_DOMAIN',
      'ATTRIBUTED_TO',
      'POSSIBLY_RELATED',
    ]);
    expect(PART_IX_RELATION_TYPES).toHaveLength(7);
    for (const relation of PART_IX_RELATION_TYPES) {
      expect(['INFRASTRUCTURE', 'ASSOCIATION', 'NONE']).toContain(
        RELATION_AGGREGATE_ARTEFACT[relation],
      );
    }
  });

  it('every accumulation-bearing relation participates in admission', () => {
    for (const relation of PART_IX_RELATION_TYPES) {
      const bearing = RELATION_AGGREGATE_ARTEFACT[relation] !== 'NONE';
      expect(AGGREGATION_BEARING_RELATIONS.indexOf(relation) !== -1).toBe(bearing);
      if (bearing) {
        expect(
          admitAggregation({
            relationType: relation,
            sourceDocumentIds: ['d1', 'd2'],
            retainedRelationCount: 2,
            resultingTier: 'ACCESS_CONTROL_NEEDED',
          }).verdict,
        ).toBe('REJECT');
      }
    }
  });

  it('the two artefact kinds are kept apart rather than lumped', () => {
    expect(RELATION_AGGREGATE_ARTEFACT.EXPOSES).toBe('INFRASTRUCTURE');
    expect(RELATION_AGGREGATE_ARTEFACT.DEPENDS_ON).toBe('INFRASTRUCTURE');
    expect(RELATION_AGGREGATE_ARTEFACT.DISRUPTED).toBe('INFRASTRUCTURE');
    expect(RELATION_AGGREGATE_ARTEFACT.SPILLOVER_TO).toBe('INFRASTRUCTURE');
    expect(RELATION_AGGREGATE_ARTEFACT.REFERENCES_DOMAIN).toBe('INFRASTRUCTURE');
    expect(RELATION_AGGREGATE_ARTEFACT.ATTRIBUTED_TO).toBe('ASSOCIATION');
    expect(RELATION_AGGREGATE_ARTEFACT.POSSIBLY_RELATED).toBe('ASSOCIATION');
  });

  it('THE BLOCKING BITE (c) — a PUBLIC_SAFE authorisation does not satisfy COARSE_ONLY', () => {
    const decision = admitAggregation(
      {
        relationType: 'DEPENDS_ON',
        sourceDocumentIds: ['d1', 'd2'],
        retainedRelationCount: 2,
        resultingTier: 'COARSE_ONLY',
      },
      { relationType: 'DEPENDS_ON', authorisedTier: 'PUBLIC_SAFE', authorisedBy: 'po' },
    );
    expect(decision.verdict).toBe('COARSEN');
    expect(decision.reason).toMatch(/SEC-AGG-5/);
  });

  it('the ladder is ordinal in both directions, and DO_NOT_EXPOSE is unsatisfiable', () => {
    expect(authorisationSatisfiesTier('ACCESS_CONTROL_NEEDED', 'COARSE_ONLY')).toBe(true);
    expect(authorisationSatisfiesTier('COARSE_ONLY', 'COARSE_ONLY')).toBe(true);
    expect(authorisationSatisfiesTier('PUBLIC_SAFE', 'COARSE_ONLY')).toBe(false);
    expect(authorisationSatisfiesTier('COARSE_ONLY', 'ACCESS_CONTROL_NEEDED')).toBe(false);
    for (const tier of DISCLOSURE_TIERS) {
      expect(authorisationSatisfiesTier(tier, 'DO_NOT_EXPOSE')).toBe(false);
    }
    expect(DISCLOSURE_TIER_ORDER.PUBLIC_SAFE).toBeLessThan(DISCLOSURE_TIER_ORDER.COARSE_ONLY);
    expect(DISCLOSURE_TIER_ORDER.COARSE_ONLY).toBeLessThan(
      DISCLOSURE_TIER_ORDER.ACCESS_CONTROL_NEEDED,
    );
    expect(DISCLOSURE_TIER_ORDER.ACCESS_CONTROL_NEEDED).toBeLessThan(
      DISCLOSURE_TIER_ORDER.DO_NOT_EXPOSE,
    );
  });
});

describe('R1 · E-5 — notification authority matches the axis the copy claims', () => {
  it('THE COMPOSITION BITE — occurrence evidence does not authorize a cause notification', () => {
    const declaration = realisticPolishEnergyDeclaration();
    const outcomes = allSucceeded(['entsoe']);
    const candidate = notification({
      assessment: assessmentFrom(declaration, outcomes, 'SIGNIFICANT_CHANGE'),
      assertedAxes: ['CAUSE'],
      evidenceSourceClasses: ['GOVERNMENT', 'COURT'],
    });
    const verdict = mayNotify(candidate);
    expect(verdict.permitted).toBe(false);
    expect(verdict.reasons.join(' ')).toMatch(/SEC-NOTIFY-6/);
  });

  it('POSITIVE CONTROL — asserting only the axis that IS established is permitted', () => {
    const declaration = realisticPolishEnergyDeclaration();
    const outcomes = allSucceeded(['entsoe']);
    const candidate = notification({
      assessment: assessmentFrom(declaration, outcomes, 'SIGNIFICANT_CHANGE'),
      assertedAxes: ['OCCURRENCE'],
      evidenceSourceClasses: ['GOVERNMENT', 'COURT'],
    });
    expect(mayNotify(candidate).permitted).toBe(true);
  });

  it('the three axes stay independent all the way to delivery', () => {
    const declaration = realisticPolishEnergyDeclaration();
    const outcomes = allSucceeded(['entsoe']);
    const assessment = assessmentFrom(declaration, outcomes, 'SIGNIFICANT_CHANGE');
    for (const axis of ['CAUSE', 'ACTOR', 'POSTURE', 'SEVERITY'] as const) {
      expect(
        mayNotify(
          notification({
            assessment,
            assertedAxes: [axis],
            evidenceSourceClasses: ['GOVERNMENT', 'COURT'],
          }),
        ).permitted,
      ).toBe(false);
    }
  });

  it('assertsCauseOrActor is DERIVED, so it cannot drift from what the copy says', () => {
    const base = notification({ assertedAxes: ['ACTOR'], evidenceSourceClasses: ['GOVERNMENT'] });
    expect(notificationAssertsCauseOrActor(base)).toBe(true);
    expect(notificationAssertsCauseOrActor(notification({ assertedAxes: ['OCCURRENCE'] }))).toBe(
      false,
    );
  });
});

describe('R1 · source register — U-2 withdrawn, rights preserved', () => {
  it('U-2 and S-6 are WITHDRAWN, and are no longer producer-activation blockers', () => {
    const withdrawn = WITHDRAWN_BLOCKERS.map((b) => b.id);
    expect(withdrawn).toContain('U-2');
    expect(withdrawn).toContain('S-6');
    const active = PRODUCER_ACTIVATION_BLOCKERS.map((b) => b.id);
    expect(active).not.toContain('U-2');
    expect(active).not.toContain('S-6');
  });

  it('the corrected ENTSO-E semantics are recorded positively', () => {
    expect(ENTSOE_BUSINESS_TYPE.A53).toMatch(/Planned maintenance/);
    expect(ENTSOE_BUSINESS_TYPE.A54).toMatch(/Unplanned/);
  });

  it('A09 / A13 survives the withdrawal — it is a docStatus finding, not businessType', () => {
    const ids = PRODUCER_ACTIVATION_BLOCKERS.map((b) => b.id);
    expect(ids).toContain('U-2b');
  });

  it('ENTSO-E RIGHTS still block activation, with the carve-outs named', () => {
    const ids = PRODUCER_ACTIVATION_BLOCKERS.map((b) => b.id);
    expect(ids).toContain('RIGHTS-ENTSOE-A78');
    expect(ids).toContain('RIGHTS-ENTSOE-A79');
    expect(ids).toContain('RIGHTS-ENTSOE-ASSET');
    const a78 = PRODUCER_ACTIVATION_BLOCKERS.filter((b) => b.id === 'RIGHTS-ENTSOE-A78')[0];
    for (const carveOut of ['Moldova', 'Turkey', 'France-Angleterre', 'Nemo']) {
      expect(a78.finding).toContain(carveOut);
    }
  });

  it('DesInventar is HOLD on a FOUND restrictive basis, never "licence not found"', () => {
    const d = PRODUCER_ACTIVATION_BLOCKERS.filter((b) => b.id === 'LIC-DESINVENTAR')[0];
    expect(d).toBeDefined();
    expect(d.finding).toMatch(/PERSONAL, NON-COMMERCIAL/);
    expect(d.finding).toMatch(/DERIVATIVE/);
    expect(d.finding).toMatch(/not "licence not found"/);
  });

  it('CAP informs the shape and produces no posture producer', () => {
    expect(CAP_STATUS.shapeInformsObjectF).toBe(true);
    expect(CAP_STATUS.securityCategoryFeedFound).toBe(false);
    expect(CAP_STATUS.compliantPostureProducerExists).toBe(false);
  });

  it('SEC 8-K is a CANDIDATE, and CYBER_INCIDENT_CONFIRMED is NOT producer-ready', () => {
    expect(CYBER_INCIDENT_SOURCE_STATUS.classification).toBe(
      'SOURCE_CANDIDATE_DEFINITIONAL_FIT_PENDING',
    );
    expect(CYBER_INCIDENT_SOURCE_STATUS.producerReady).toBe(false);
    expect(CYBER_INCIDENT_SOURCE_STATUS.cannotEstablish).toContain('NAMED_SYSTEM');
  });

  it('SABOTAGE_CONFIRMED is closed negative', () => {
    expect(SABOTAGE_CONFIRMED_STATUS.producerExists).toBe(false);
    expect(SABOTAGE_CONFIRMED_STATUS.closure).toBe('CLOSED_NEGATIVE');
  });

  it('a field-level drop list is necessary and NOT sufficient — prose is named', () => {
    expect(FREE_TEXT_FIELDS_ARE_NOT_FIELD_CONTROLLABLE).toContain('UKStatementofReasons');
    expect(FREE_TEXT_FIELDS_ARE_NOT_FIELD_CONTROLLABLE).toContain('OtherInformation');
    for (const f of ['passportNumber', 'nationalIdentityNumber', 'address']) {
      expect(PERSON_FIELDS_DROPPED_AT_SEAM).toContain(f);
    }
  });
});

describe('R1 · PRESERVED — nothing already closed regressed', () => {
  it('A-24 remains closed: exactly one outcome establishes absence', () => {
    expect(OUTCOMES_ESTABLISHING_ABSENCE).toEqual(['NO_RESULTS']);
  });

  it('M-2 remains closed and unchanged', () => {
    expect(incidentFacetOwner('MET')).toBe('CONFLICT');
    expect(incidentFacetOwner('NOT_MET')).toBe('SECURITY');
    expect(incidentFacetOwner('UNDETERMINED')).toBeNull();
  });

  it('S-1 remains OPEN with the sixth category absent and bound to B-1', () => {
    const absent = S1_LINK_CATEGORY_STATUS.filter((c) => c.partIxTreatment === 'ABSENT');
    expect(absent).toHaveLength(1);
    expect(absent[0].category).toBe('political assassination attempts');
    expect(HIGH_CONSEQUENCE_CLAIM_TYPES).not.toContain('TARGETED_PERSON');
  });
});
