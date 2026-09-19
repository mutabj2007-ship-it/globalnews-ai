/**
 * MAIN-POLITICS-PLATFORM-1 — THE SHARED POLITICS CONTRACT, MADE EXECUTABLE.
 *
 *     baseline   C37  37FDBB150AB1C5DF30D80B788C7094B9600779BE5613F592CE4C6889A48CC891
 *
 * WHY THIS RUNS FROM THE BACKEND RUNNER. The backend resolves `@globalnews-ai/shared` to the
 * COMPILED `shared/dist`, so these tests exercise what a consumer actually imports rather than the
 * TypeScript source. That makes `build:shared` load-bearing, which is the point: a contract that
 * only holds before compilation is not a contract.
 *
 * A GUARD IS NOT EVIDENCE UNTIL A MUTATION PROVES IT BINDS. Where a test asserts an ABSENCE — no
 * aggregation function, no REGISTRY assignment, no new Watch state — it carries a positive control
 * that the same check reports the thing when it is present. An absence test with no positive
 * control cannot tell "nothing is there" from "I looked in the wrong place".
 */
import {
  POLITICS_DOMAIN_ID,
  POLITICS_DESIGN_AUTHORITY_SHA256,
  POLITICS_SUBJECT_TYPES,
  POLITICS_REFUSED_SUBJECT_TYPES,
  isPoliticsSubjectType,
  politicsSubjectRefusal,
  ELECTION_STAGES,
  LEGISLATIVE_STAGES,
  LEGISLATIVE_SOURCE_SCHEMES,
  SEJM_STAGE_CROSSWALK,
  EP_ACTIVITY_CROSSWALK,
  stageObservationIsHonest,
  EP_FORESEEN_ACTIVITY_IS_NOT_AN_EVENT,
  LAW_IN_FORCE_AXIS_IS_NOT_THE_PROPOSAL_AXIS,
  ELECTION_STAGE_STRUCTURED_PRODUCER,
  ELECTION_STAGES_WITH_STRUCTURED_PRODUCER,
  POLL_FIELD_ABSENCE_REASONS,
  pollAbsencesAreAccountable,
  COURT_OUTCOME_IS_REQUIRED_BY_CONTRACT,
  COURT_OUTCOME_PRODUCER_FACTS,
  COURT_RULING_SUBJECT_ATTACHMENT_PRODUCER,
  PROTEST_EVENT_PRODUCER_FACTS,
  PROTEST_STAGES,
  POLITICAL_ACTOR_ROLES,
  actorFacetIsAccountable,
  POLITICS_EDGE_TYPES,
  GOVERNANCE_STATE_CONSTITUTIVE_EDGES,
  POLITICS_LIFECYCLE_EVENTS,
  POLITICS_CHANGE_STATE_PRODUCER_GAPS,
  POLITICS_CHANGE_STATES_PRODUCIBLE_TODAY,
  POLITICS_WATCH_REGISTRATION_PROPOSAL,
  POLITICAL_SOURCE_CLASSES,
  POLITICAL_SOURCE_CLASS_WARRANT,
  INSTITUTIONAL_CLASS_CONSISTENT_WITH,
  classificationIsClaimScoped,
  institutionalClassIsConsistent,
  comparabilityAxesAllMatch,
  PRODUCIBLE_ELECTORAL_UNIT_KINDS,
  ELECTORAL_UNIT_KINDS,
  editorialOutcome,
  determinationIsAccountable,
  FUTURE_SECURITY_RECONCILIATION_REQUIRED,
  WATCH_CHANGE_STATES,
  WATCH_CHANGE_STATES_DERIVABLE_TODAY,
  WATCH_SUBJECT_TYPES_BY_SURFACE,
  relationshipEdgeKey,
  symmetricEdgeKey,
  canonicalEdgeKey,
  edgeCitesEvidence,
  edgeIntervalIsCoherent,
  edgeIsValid,
  PRODUCIBLE_RELATIONSHIP_VERIFICATION,
  type PoliticalActorFacet,
  type PoliticalArtifactClassification,
  type RelationshipEdge,
  type RelationshipEndpoint,
  type EditorialDetermination,
} from '@globalnews-ai/shared';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SHARED_POLITICS_SRC = join(__dirname, '../../../shared/src/politics/index.ts');
const SHARED_RELATIONSHIPS_SRC = join(__dirname, '../../../shared/src/relationships/index.ts');

/** Comments are stripped before any prohibition is searched for, so the file's own prose about a */
/** forbidden thing can never satisfy — or fail — a check about executable code. */
function executableBody(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

describe('1 · domain registration — the Q16 answer', () => {
  it('registers as POLITICS, and the platform id is an open branded string so no union is widened', () => {
    expect(POLITICS_DOMAIN_ID).toBe('POLITICS');
    // The platform's own file states it: an OPEN branded string, not a closed union.
    const claim = readFileSync(join(__dirname, '../../../shared/src/specialist-claim.ts'), 'utf8');
    expect(claim).toContain('an OPEN branded string, not a closed union');
    expect(claim).toContain('A closed union would make');
  });

  it('does not adopt ELECTION as the domain id — Election is a SUBJECT of Politics', () => {
    expect(POLITICS_DOMAIN_ID).not.toBe('ELECTION');
    expect(POLITICS_SUBJECT_TYPES).toContain('ELECTION');
  });

  it('cites design authority by digest, because the registry refuses an unrecognised hash', () => {
    for (const digest of Object.values(POLITICS_DESIGN_AUTHORITY_SHA256)) {
      expect(digest).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('POSITIVE CONTROL: the executable-body stripper leaves real code intact', () => {
    const body = executableBody(SHARED_POLITICS_SRC);
    expect(body).toContain('export const POLITICS_DOMAIN_ID');
    expect(body).not.toContain('THE NINTH DECISION');
  });
});

describe('2 · political actor is a facet, never a second identity system', () => {
  it('carries no id, no name and no image field — identity stays on the shared participant surface', () => {
    const body = executableBody(SHARED_POLITICS_SRC);
    expect(body).not.toMatch(/readonly\s+(actorId|personId|politicianId|displayName|imageUrl|portrait)\b/);
    expect(body).toContain('readonly entityRef: string');
  });

  it('a role is held for a period, in a jurisdiction, on evidence', () => {
    const facet: PoliticalActorFacet = {
      entityRef: 'entity:1', role: 'OFFICEHOLDER', jurisdiction: 'KE',
      heldFrom: '2022-09-13', evidenceRefs: ['ev:1'],
    };
    expect(actorFacetIsAccountable(facet)).toBe(true);
    expect(actorFacetIsAccountable({ ...facet, evidenceRefs: [] })).toBe(false);
    expect(actorFacetIsAccountable({ ...facet, jurisdiction: '  ' })).toBe(false);
  });

  it('the electoral authority is a ROLE, so its statements cannot bypass claim-level authority', () => {
    expect(POLITICAL_ACTOR_ROLES).toContain('ELECTORAL_AUTHORITY');
    const body = executableBody(SHARED_POLITICS_SRC);
    expect(body).not.toMatch(/readonly\s+electoralAuthority\s*:/);
  });
});

describe('3 · three subjects, and three refusals that are part of the contract', () => {
  it('exactly three persistent subject types', () => {
    expect(POLITICS_SUBJECT_TYPES).toEqual(['ELECTION', 'LEGISLATIVE_SUBJECT', 'PROTEST_CAMPAIGN']);
  });

  it('CONSTITUENCY, POLL and GOVERNANCE_STATE are refused, each with its accepted disposition', () => {
    expect(politicsSubjectRefusal('CONSTITUENCY')).toBe('GEOGRAPHY_FACET_OF_ELECTION');
    expect(politicsSubjectRefusal('POLL')).toBe('EVIDENCE_ARTIFACT');
    expect(politicsSubjectRefusal('GOVERNANCE_STATE')).toBe('DERIVED_COMPOSITE_ASSESSMENT');
    for (const refused of Object.keys(POLITICS_REFUSED_SUBJECT_TYPES)) {
      expect(isPoliticsSubjectType(refused)).toBe(false);
    }
  });

  it('POSITIVE CONTROL: a genuine subject is not reported as refused', () => {
    expect(politicsSubjectRefusal('ELECTION')).toBeNull();
    expect(isPoliticsSubjectType('ELECTION')).toBe(true);
  });

  it('stage vocabularies and change states share no word — the four axes cannot be substituted', () => {
    const stages = [...ELECTION_STAGES, ...LEGISLATIVE_STAGES, ...PROTEST_STAGES];
    for (const state of WATCH_CHANGE_STATES) {
      expect(stages).not.toContain(state as never);
    }
    // POSITIVE CONTROL: the two sets are non-empty, so the disjointness is not vacuous.
    expect(stages.length).toBeGreaterThan(15);
    expect(WATCH_CHANGE_STATES.length).toBe(7);
  });
});

describe('4 · relationship substrate — minimum, evidence-bearing, and not a graph platform', () => {
  const edge = (over: Partial<RelationshipEdge> = {}): RelationshipEdge => {
    const base = {
      edgeType: POLITICS_EDGE_TYPES.SUPPORTS_GOVERNMENT.id,
      source: { objectType: 'POLITICAL_ACTOR', objectId: 'a' },
      target: { objectType: 'POLITICAL_ACTOR', objectId: 'b' },
      validFrom: '2025-11-01',
    };
    return {
      ...base,
      edgeId: relationshipEdgeKey(base),
      directionality: 'DIRECTED',
      assertion: 'STATED',
      evidenceRefs: ['ev:1'],
      ...over,
    } as RelationshipEdge;
  };

  it('NO TRAVERSAL EXISTS — no path, reachability, centrality, degree or cluster function', () => {
    const body = executableBody(SHARED_RELATIONSHIPS_SRC);
    expect(body).not.toMatch(/function\s+\w*(traverse|path|reach|centrality|degree|cluster|neighbou?rs)\w*\s*\(/i);
    // POSITIVE CONTROL: the same search finds a function that IS there.
    expect(body).toMatch(/function\s+relationshipEdgeKey\s*\(/);
  });

  it('every edge cites evidence — an uncited edge is not a weak edge, it is unaccountable', () => {
    expect(edgeCitesEvidence(edge())).toBe(true);
    expect(edgeCitesEvidence(edge({ evidenceRefs: [] }))).toBe(false);
    expect(edgeIsValid(edge({ evidenceRefs: [] }))).toBe(false);
  });

  it('absent validTo means STILL HOLDING; an inverted interval is a broken record', () => {
    expect(edgeIntervalIsCoherent(edge())).toBe(true);
    expect(edgeIntervalIsCoherent(edge({ validTo: '2026-01-01' }))).toBe(true);
    expect(edgeIntervalIsCoherent(edge({ validTo: '2024-01-01' }))).toBe(false);
  });

  it('the key is length-prefixed, so endpoints containing the separator cannot collide', () => {
    const a = relationshipEdgeKey({
      edgeType: 'T', source: { objectType: 'X:Y', objectId: 'Z' },
      target: { objectType: 'P', objectId: 'Q' }, validFrom: '2025-01-01',
    });
    const b = relationshipEdgeKey({
      edgeType: 'T', source: { objectType: 'X', objectId: 'Y:Z' },
      target: { objectType: 'P', objectId: 'Q' }, validFrom: '2025-01-01',
    });
    expect(a).not.toBe(b);
  });

  it('the same membership written either way is ONE symmetric edge, not two', () => {
    const forward = { edgeType: POLITICS_EDGE_TYPES.COALITION_MEMBER.id, source: { objectType: 'A', objectId: '1' }, target: { objectType: 'A', objectId: '2' }, validFrom: '2025-01-01' };
    const backward = { ...forward, source: forward.target, target: forward.source };
    expect(symmetricEdgeKey(forward)).toBe(symmetricEdgeKey(backward));
    // POSITIVE CONTROL: the DIRECTED key does distinguish them, which is why the type carries direction.
    expect(relationshipEdgeKey(forward)).not.toBe(relationshipEdgeKey(backward));
  });

  it('a re-formed coalition is a second edge, because validFrom is part of the key', () => {
    const first = { edgeType: 'T', source: { objectType: 'A', objectId: '1' }, target: { objectType: 'A', objectId: '2' }, validFrom: '2020-01-01' };
    expect(relationshipEdgeKey(first)).not.toBe(relationshipEdgeKey({ ...first, validFrom: '2025-01-01' }));
  });

  it('verification is DECLARED and produced by nothing — the empty set is the measurement', () => {
    expect(PRODUCIBLE_RELATIONSHIP_VERIFICATION).toEqual([]);
  });

  it('governance state names its constitutive edges and no scorer exists to consume them', () => {
    expect(GOVERNANCE_STATE_CONSTITUTIVE_EDGES).toEqual(['COALITION_MEMBER', 'SUPPORTS_GOVERNMENT', 'IN_OPPOSITION_TO', 'APPOINTED_BY']);
    const body = executableBody(SHARED_POLITICS_SRC);
    expect(body).not.toMatch(/function\s+\w*(deriveGovernance|governanceStateOf|scoreGovernance)\w*\s*\(/i);
  });
});

describe('5 · lifecycle events, Watch, and the producer gaps', () => {
  it('adds NO Watch change state — the seven stay seven', () => {
    expect(WATCH_CHANGE_STATES.length).toBe(7);
    for (const event of POLITICS_LIFECYCLE_EVENTS) {
      expect(WATCH_CHANGE_STATES).toContain(event.expectedChangeState);
    }
  });

  it('every lifecycle event id is domain-scoped, so no shared word is silently reused', () => {
    for (const event of POLITICS_LIFECYCLE_EVENTS) {
      expect(event.eventId.startsWith('POLITICS:')).toBe(true);
    }
    for (const key of Object.keys(POLITICS_EDGE_TYPES)) {
      expect(POLITICS_EDGE_TYPES[key as keyof typeof POLITICS_EDGE_TYPES].id.startsWith('POLITICS:')).toBe(true);
    }
  });

  it('THE MEASURED GAP: most Politics events expect a state nothing can produce today', () => {
    expect(POLITICS_CHANGE_STATES_PRODUCIBLE_TODAY).toEqual([...WATCH_CHANGE_STATES_DERIVABLE_TODAY]);
    const blocked = POLITICS_LIFECYCLE_EVENTS.filter(
      (e) => !POLITICS_CHANGE_STATES_PRODUCIBLE_TODAY.includes(e.expectedChangeState),
    );
    expect(blocked.length).toBeGreaterThan(POLITICS_LIFECYCLE_EVENTS.length / 2);
    // Every blocked state names its missing capability rather than being silently absent.
    for (const event of blocked) {
      expect(Object.keys(POLITICS_CHANGE_STATE_PRODUCER_GAPS)).toContain(event.expectedChangeState);
    }
  });

  it('revisions are marked as revisions — a recount is not a new event', () => {
    const revisions = POLITICS_LIFECYCLE_EVENTS.filter((e) => e.isRevisionOfPriorEvent).map((e) => e.eventId);
    expect(revisions).toEqual(['POLITICS:RESULT_CORRECTED', 'POLITICS:GAZETTE_CORRECTION']);
  });

  it('POLL_PUBLISHED is NEW_EVIDENCE whether or not it moves the assessment', () => {
    const poll = POLITICS_LIFECYCLE_EVENTS.find((e) => e.eventId === 'POLITICS:POLL_PUBLISHED');
    expect(poll?.expectedChangeState).toBe('NEW_EVIDENCE');
  });

  it('Watch registration is STILL A PROPOSAL — the surface exists and registers nothing', () => {
    /*
      ── SUPERSEDED TWICE, RETIRED WITH ITS TEETH KEPT ──────────────────────

      As delivered this asserted the surface table was exactly
      `['CONFLICT','ECONOMY','MAP','MARKET']` and carried no `POLITICS` key. Both halves
      are C39-era facts:

        · the four-surface list was ALREADY stale against SECURITY, landed by
          MAIN-SECURITY-PLATFORM-1-R1 before Politics was touched at all;
        · the missing POLITICS key is exactly what MAIN-POLITICS-PLATFORM-PROMOTION-R3
          PL-B6(b) deliberately adds — "G's PL-N4 is right that the absence is a decision
          and not a stale table".

      So the surface assertion is no longer a control; it is a snapshot of a tree two
      promotions ago. What it was REALLY protecting is untouched and is asserted below.
    */
    expect(Object.keys(WATCH_SUBJECT_TYPES_BY_SURFACE)).toContain('POLITICS');

    /* THE HALF THAT STILL MATTERS. Registering any of the six would delete the control
       that says they are unregistered, and `PoliticsWatchSubjectTypeIsNotRegistered` is
       the compile-time half of this same statement. */
    const registered = Object.values(WATCH_SUBJECT_TYPES_BY_SURFACE).flat();
    for (const proposed of POLITICS_WATCH_REGISTRATION_PROPOSAL.proposedSubjectTypes) {
      expect(`${proposed}: ${registered.includes(proposed as never)}`).toBe(`${proposed}: false`);
    }
    /* the POLITICS row is EMPTY — the surface is nameable, nothing is watchable on it */
    expect(WATCH_SUBJECT_TYPES_BY_SURFACE.POLITICS).toEqual([]);
    expect(POLITICS_WATCH_REGISTRATION_PROPOSAL.blockedBy.length).toBe(4);
  });
});

describe('6 · artifact-level source class — the §12 rule, with a carrier', () => {
  const classification = (over: Partial<PoliticalArtifactClassification> = {}): PoliticalArtifactClassification => ({
    artifactRef: 'art:1',
    politicalClass: 'ELECTORAL_AUTHORITY_RECORD',
    assignedFrom: 'ARTIFACT_INSPECTION',
    authoritativeForClaimRef: 'claim:declared-result',
    ...over,
  });

  it('there is NOWHERE to record that a class came from the registry', () => {
    const body = executableBody(SHARED_POLITICS_SRC);
    // Scoped to the union itself. A whole-file search would be a false positive: 'INSTITUTION' is
    // a legitimate POLITICAL_ACTOR_ROLE, and the first draft of this guard did exactly that.
    const union = /export type PoliticalClassAssignment =([^;]*);/.exec(body);
    expect(union).not.toBeNull();
    const members = union![1];
    expect(members).toContain("'ARTIFACT_INSPECTION'");
    expect(members).toContain("'PUBLISHER_DECLARATION'");
    expect(members).not.toMatch(/'REGISTRY'|'INSTITUTION'|'AUTHORITY_CLASS'|'DERIVED'/);
    // POSITIVE CONTROL: the same extraction over a union that DOES carry a registry member reports it.
    const control = /export type PoliticalClassAssignment =([^;]*);/.exec(
      "export type PoliticalClassAssignment = 'ARTIFACT_INSPECTION' | 'REGISTRY';",
    );
    expect(control![1]).toMatch(/'REGISTRY'/);
  });

  it('two artifacts from one institution can carry different classes — the rule R06 exists for', () => {
    const gazette = classification({ politicalClass: 'ELECTORAL_AUTHORITY_RECORD' });
    const remark = classification({ artifactRef: 'art:2', politicalClass: 'GOVERNMENT_STATEMENT' });
    expect(gazette.politicalClass).not.toBe(remark.politicalClass);
  });

  it('every class states what it is authority FOR and what it never implies', () => {
    for (const cls of POLITICAL_SOURCE_CLASSES) {
      const warrant = POLITICAL_SOURCE_CLASS_WARRANT[cls];
      expect(warrant.authorityFor.length).toBeGreaterThan(0);
      expect(warrant.neverImplies.length).toBeGreaterThan(0);
    }
    expect(POLITICAL_SOURCE_CLASS_WARRANT.POLLING_SURVEY.neverImplies).toBe('Election outcome');
  });

  it('a classification that names no claim cannot honour claim-level authority', () => {
    expect(classificationIsClaimScoped(classification())).toBe(true);
    expect(classificationIsClaimScoped(classification({ authoritativeForClaimRef: '  ' }))).toBe(false);
  });

  it('institutional class is a CONSISTENCY check, never a derivation, and silence is not a contradiction', () => {
    expect(institutionalClassIsConsistent(classification())).toBeNull();
    const withProvenance = classification({
      provenance: { sourceType: 'OFFICIAL_SOURCE', authorityClass: 'OFFICIAL_ELECTION_AUTHORITY' },
    });
    expect(institutionalClassIsConsistent(withProvenance)).toBe(true);
    expect(institutionalClassIsConsistent({ ...withProvenance, politicalClass: 'POLLING_SURVEY' })).toBe(false);
    // A registry class the map says nothing about returns null rather than false.
    expect(
      institutionalClassIsConsistent(
        classification({ provenance: { sourceType: 'PUBLIC_DATA', authorityClass: 'OTHER' } }),
      ),
    ).toBeNull();
  });

  it('COURT and OFFICIAL_ELECTION_AUTHORITY already exist in canonical — C-05 is smaller than escalated', () => {
    // `OfficialSourceClass` is a type with no runtime array, so the union itself is read from source.
    const union = readFileSync(join(__dirname, '../../../shared/src/officialSources.ts'), 'utf8');
    expect(union).toMatch(/export type OfficialSourceClass =[\s\S]*?'COURT'/);
    expect(union).toMatch(/export type OfficialSourceClass =[\s\S]*?'OFFICIAL_ELECTION_AUTHORITY'/);
    // POSITIVE CONTROL: a class that is NOT in the union is not found by the same search.
    expect(union).not.toMatch(/export type OfficialSourceClass =[\s\S]*?'POLLING_SURVEY'/);
    expect(Object.keys(INSTITUTIONAL_CLASS_CONSISTENT_WITH)).toContain('OFFICIAL_ELECTION_AUTHORITY');
    // The two genuinely new classes Politics needs are absent from the institutional union.
    expect(union).not.toContain("'PARLIAMENTARY_RECORD'");
  });

  it('SourceType x EvidenceRole is reused, not replaced — no second provenance model is declared', () => {
    const body = executableBody(SHARED_POLITICS_SRC);
    expect(body).not.toMatch(/(type|interface)\s+Political(Provenance|SourceType|EvidenceRole)\b/);
    expect(body).toMatch(/readonly provenance\?: SourceProvenance/);
  });
});

describe('7 · poll artifact — evidence, and aggregation is structurally impossible', () => {
  it('NO FUNCTION TAKES POLLS AND RETURNS A NUMBER — no average, trend, lead, swing or projection', () => {
    const body = executableBody(SHARED_POLITICS_SRC);
    expect(body).not.toMatch(/function\s+\w*(average|aggregate|trend|projection|forecast|swing|lead|midpoint|weighted)\w*\s*\(/i);
    // POSITIVE CONTROL: the same search finds the comparability function that IS present.
    expect(body).toMatch(/function\s+comparabilityAxesAllMatch\s*\(/);
  });

  it('carries every field the accepted design requires of a poll', () => {
    const body = executableBody(SHARED_POLITICS_SRC);
    for (const field of ['pollsterRef', 'sponsorRef', 'fieldStart', 'fieldEnd', 'sampleSize',
      'population', 'geographyRef', 'questionWording', 'mode', 'marginOfError', 'publishedAt',
      'methodologyRef', 'revisesArtifactRef']) {
      expect(body).toContain(`readonly ${field}`);
    }
  });

  it('fieldwork is a PERIOD, not a date', () => {
    const body = executableBody(SHARED_POLITICS_SRC);
    expect(body).toMatch(/readonly fieldStart: string;\s*readonly fieldEnd: string;/);
  });

  it('margin of error is only carried when published — never computed from the sample size', () => {
    const body = executableBody(SHARED_POLITICS_SRC);
    expect(body).toContain('readonly marginOfError?: number');
    expect(body).not.toMatch(/Math\.sqrt|1\.96/);
  });

  it('all four comparability axes must match, and matching is a precondition, not a permission', () => {
    const all = { samePollster: true, sameSampleFrame: true, sameQuestionWording: true, bothPublishMargins: true };
    expect(comparabilityAxesAllMatch(all)).toBe(true);
    for (const key of Object.keys(all) as (keyof typeof all)[]) {
      expect(comparabilityAxesAllMatch({ ...all, [key]: false })).toBe(false);
    }
  });
});

describe('8 · electoral geography — a separate axis, and the ladder is untouched', () => {
  it('no electoral unit kind is producible — the whole axis is unaddressable today', () => {
    expect(PRODUCIBLE_ELECTORAL_UNIT_KINDS).toEqual([]);
    expect(ELECTORAL_UNIT_KINDS).toContain('CONSTITUENCY');
  });

  it('an electoral unit carries NO geometry — a unit that cannot be drawn gets no outline', () => {
    const body = executableBody(SHARED_POLITICS_SRC);
    expect(body).not.toMatch(/readonly\s+(geometry|polygon|boundary|coordinates|bbox)\b/i);
    expect(body).toContain('readonly reportedAgainstGeographyId: string');
  });

  it('canonical still rules the constituency off the administrative axis, and this contract did not change it', () => {
    const ladder = readFileSync(join(__dirname, '../modules/geo/administrative-ladder.contract.ts'), 'utf8');
    expect(ladder).toContain('ELECTORAL axis, not administrative');
    expect(ladder).toContain('No rung carries it');
  });
});

describe('9 · editorial thresholds — a decision record, never a constant', () => {
  const determination = (over: Partial<EditorialDetermination> = {}): EditorialDetermination => ({
    kind: 'SUSTAINED_MOBILISATION', aboutRefs: ['candidate:1'], admitted: true,
    decidedBy: 'editor@example', decidedAt: '2026-09-06', rationale: 'Four coordinated events over three weeks with a named convenor.',
    ...over,
  });

  it('NO THRESHOLD VALUE EXISTS — there is no number to tune', () => {
    const body = executableBody(SHARED_POLITICS_SRC);
    expect(body).not.toMatch(/(SUSTAINED|MOBILISATION|COMPARAB\w*)_(THRESHOLD|MIN|DAYS|COUNT)\s*=/i);
    expect(body).not.toMatch(/minEvents|minDays|thresholdDays/i);
    // POSITIVE CONTROL: the decision-record surface IS present.
    expect(body).toMatch(/function\s+editorialOutcome\s*\(/);
  });

  it('absence of a determination is its own state — never a default of false', () => {
    expect(editorialOutcome([], 'SUSTAINED_MOBILISATION', 'candidate:1')).toEqual({ status: 'NOT_DETERMINED' });
    expect(editorialOutcome([determination()], 'SUSTAINED_MOBILISATION', 'candidate:1').status).toBe('ADMITTED');
    expect(editorialOutcome([determination({ admitted: false })], 'SUSTAINED_MOBILISATION', 'candidate:1').status).toBe('REFUSED');
    // A determination about something else does not leak onto this subject.
    expect(editorialOutcome([determination()], 'POLL_COMPARABILITY', 'candidate:1').status).toBe('NOT_DETERMINED');
  });

  it('a determination with no accountable human decider is refused, in every spelling', () => {
    expect(determinationIsAccountable(determination())).toBe(true);
    for (const who of ['SYSTEM', 'system', 'auto', 'AI', '   ']) {
      expect(determinationIsAccountable(determination({ decidedBy: who }))).toBe(false);
    }
    expect(determinationIsAccountable(determination({ rationale: '' }))).toBe(false);
  });
});

describe('10 · Security is recorded, never resolved', () => {
  it('carries the five items verbatim and declares no Security vocabulary', () => {
    expect(FUTURE_SECURITY_RECONCILIATION_REQUIRED.length).toBe(5);
    for (const item of FUTURE_SECURITY_RECONCILIATION_REQUIRED) {
      expect(item).toMatch(/^S-[1-5]: /);
    }
    const body = executableBody(SHARED_POLITICS_SRC);
    expect(body).not.toMatch(/(type|interface|const)\s+\w*Security\w*\s*[=:]/);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * R1 · E1-POLITICS-PLATFORM-1 B-1 — SYMMETRIC EDGE IDENTITY AND VALIDITY
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * THE DEFECT, IN ONE SENTENCE: `edgeIsValid` compared against `relationshipEdgeKey`
 * unconditionally, while `symmetricEdgeKey` defines order-independent identity, so exactly one
 * orientation of a canonical symmetric id passed validation and the other failed.
 *
 * THE FIXTURE IS DELIBERATELY UNSORTED. `party-b` sorts after `party-a`, so writing the edge
 * "forward" as (party-b -> party-a) is the orientation the old code rejected. A fixture whose
 * endpoints happened to be in sorted order would pass under both the broken and the corrected
 * implementation and would prove nothing — which is exactly how the R0 suite missed this.
 */
describe('R1 · B-1 · symmetric edge identity', () => {
  const UNSORTED_FIRST = { objectType: 'POLITICAL_ACTOR', objectId: 'party-b' } as const;
  const SORTED_FIRST = { objectType: 'POLITICAL_ACTOR', objectId: 'party-a' } as const;
  const SYM = POLITICS_EDGE_TYPES.COALITION_MEMBER.id;
  const DIR = POLITICS_EDGE_TYPES.SUPPORTS_GOVERNMENT.id;
  const FROM = '2025-11-01';

  const sym = (source: RelationshipEndpoint, target: RelationshipEndpoint): RelationshipEdge => {
    const base = { edgeType: SYM, directionality: 'SYMMETRIC' as const, source, target, validFrom: FROM };
    return { ...base, edgeId: canonicalEdgeKey(base), assertion: 'STATED', evidenceRefs: ['ev:1'] };
  };
  const dir = (source: RelationshipEndpoint, target: RelationshipEndpoint): RelationshipEdge => {
    const base = { edgeType: DIR, directionality: 'DIRECTED' as const, source, target, validFrom: FROM };
    return { ...base, edgeId: canonicalEdgeKey(base), assertion: 'STATED', evidenceRefs: ['ev:1'] };
  };

  it('1 · DIRECTED: A->B and B->A are different edges, and both are valid', () => {
    const ab = dir(UNSORTED_FIRST, SORTED_FIRST);
    const ba = dir(SORTED_FIRST, UNSORTED_FIRST);
    expect(ab.edgeId).not.toBe(ba.edgeId);
    expect(edgeIsValid(ab)).toBe(true);
    expect(edgeIsValid(ba)).toBe(true);
    // Direction sensitivity is unchanged: the directed key is still the direction-bearing one.
    expect(canonicalEdgeKey(ab)).toBe(relationshipEdgeKey(ab));
  });

  it('2 · SYMMETRIC: A<->B and B<->A produce the SAME key', () => {
    expect(sym(UNSORTED_FIRST, SORTED_FIRST).edgeId).toBe(sym(SORTED_FIRST, UNSORTED_FIRST).edgeId);
    expect(canonicalEdgeKey(sym(UNSORTED_FIRST, SORTED_FIRST))).toBe(
      symmetricEdgeKey(sym(SORTED_FIRST, UNSORTED_FIRST)),
    );
  });

  it('3 · THE BLOCKER: edgeIsValid accepts the canonical symmetric id in EITHER caller ordering', () => {
    expect(edgeIsValid(sym(UNSORTED_FIRST, SORTED_FIRST))).toBe(true);
    expect(edgeIsValid(sym(SORTED_FIRST, UNSORTED_FIRST))).toBe(true);
    // And the caller never had to pre-sort: neither fixture was sorted by hand.
    expect(sym(UNSORTED_FIRST, SORTED_FIRST).source.objectId).toBe('party-b');
  });

  it('4 · reversing a symmetric edge does not mint a second identity', () => {
    const ids = new Set([
      sym(UNSORTED_FIRST, SORTED_FIRST).edgeId,
      sym(SORTED_FIRST, UNSORTED_FIRST).edgeId,
    ]);
    expect(ids.size).toBe(1);
    // The directed key WOULD have minted two — which is why validity must not use it here.
    const twoWays = new Set([
      relationshipEdgeKey(sym(UNSORTED_FIRST, SORTED_FIRST)),
      relationshipEdgeKey(sym(SORTED_FIRST, UNSORTED_FIRST)),
    ]);
    expect(twoWays.size).toBe(2);
  });

  it('5 · a malformed or foreign edgeId still fails, in both directionalities', () => {
    expect(edgeIsValid({ ...sym(UNSORTED_FIRST, SORTED_FIRST), edgeId: 'rel:1:hand-written' })).toBe(false);
    expect(edgeIsValid({ ...sym(UNSORTED_FIRST, SORTED_FIRST), edgeId: '' })).toBe(false);
    // The directed key on a SYMMETRIC edge is now REFUSED — it is the duplicate-minting spelling.
    const s = sym(UNSORTED_FIRST, SORTED_FIRST);
    expect(edgeIsValid({ ...s, edgeId: relationshipEdgeKey(s) })).toBe(false);
    expect(edgeIsValid({ ...dir(UNSORTED_FIRST, SORTED_FIRST), edgeId: 'nope' })).toBe(false);
  });

  it('6 · evidence, interval and provenance requirements are unchanged by the correction', () => {
    const s = sym(UNSORTED_FIRST, SORTED_FIRST);
    expect(edgeIsValid({ ...s, evidenceRefs: [] })).toBe(false);
    expect(edgeIsValid({ ...s, validTo: '2024-01-01' })).toBe(false);
    expect(edgeIsValid({ ...s, validTo: '2026-01-01' })).toBe(true);
    expect(edgeCitesEvidence({ ...s, evidenceRefs: [] })).toBe(false);
    expect(edgeIntervalIsCoherent({ ...s, validTo: '2024-01-01' })).toBe(false);
    // Provenance and assertion state remain optional/present as declared, not silently required.
    expect(edgeIsValid({ ...s, provenance: 'STATED' })).toBe(true);
    expect(edgeIsValid({ ...s, assertion: 'CONTESTED' })).toBe(true);
  });

  it('7 · COALITION_MEMBER is the SYMMETRIC type this correction exists for', () => {
    expect(POLITICS_EDGE_TYPES.COALITION_MEMBER.directionality).toBe('SYMMETRIC');
    expect(GOVERNANCE_STATE_CONSTITUTIVE_EDGES).toContain('COALITION_MEMBER');
    const symmetricTypes = Object.values(POLITICS_EDGE_TYPES).filter((t) => t.directionality === 'SYMMETRIC');
    expect(symmetricTypes).toHaveLength(1);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * R2 · LIFECYCLE RECONCILIATION AGAINST REAL SOURCE SCHEMAS
 * ═══════════════════════════════════════════════════════════════════════════ */
describe('R2 · legislative failure state', () => {
  it('1 · REJECTED exists — a defeated bill has an honest target', () => {
    expect(LEGISLATIVE_STAGES).toContain('REJECTED');
    expect(LEGISLATIVE_STAGES).toContain('PASSED');
    // and it is DISTINCT from the two acts it would otherwise be misreported as
    expect(LEGISLATIVE_STAGES).toContain('VETOED');
    expect(LEGISLATIVE_STAGES).toContain('WITHDRAWN');
    expect(new Set(LEGISLATIVE_STAGES).size).toBe(LEGISLATIVE_STAGES.length);
  });

  it('2 · a rejection lifecycle event exists and lands on the shared seven', () => {
    const ev = POLITICS_LIFECYCLE_EVENTS.find((e) => e.eventId === 'POLITICS:BILL_REJECTED');
    expect(ev).toBeDefined();
    expect(WATCH_CHANGE_STATES).toContain(ev!.expectedChangeState);
    expect(ev!.attachesTo).toBe('LEGISLATIVE_SUBJECT');
  });

  it('3 · no new Watch state was added to accommodate any of this', () => {
    expect(WATCH_CHANGE_STATES.length).toBe(7);
    for (const e of POLITICS_LIFECYCLE_EVENTS) expect(WATCH_CHANGE_STATES).toContain(e.expectedChangeState);
  });
});

describe('R2 · source-stage fidelity — the summary is not the procedure', () => {
  it('4 · UNMAPPABLE forces a null summary stage — "do not collapse", enforced', () => {
    const base = { subjectId: 's', sourceScheme: 'SEJM_PROCESS_STAGE' as const, sourceValue: 'SejmReading', observedAt: '2026-01-01' };
    expect(stageObservationIsHonest({ ...base, fidelity: 'UNMAPPABLE', summaryStage: null })).toBe(true);
    expect(stageObservationIsHonest({ ...base, fidelity: 'UNMAPPABLE', summaryStage: 'PASSED' })).toBe(false);
  });

  it('5 · CONDITIONAL must name the field it depended on', () => {
    const base = { subjectId: 's', sourceScheme: 'SEJM_PROCESS_STAGE' as const, sourceValue: 'Voting', observedAt: '2026-01-01', fidelity: 'CONDITIONAL' as const, summaryStage: 'PASSED' as const };
    expect(stageObservationIsHonest({ ...base, conditionOn: 'ProcessDetails.passed' })).toBe(true);
    expect(stageObservationIsHonest(base)).toBe(false);
    expect(stageObservationIsHonest({ ...base, conditionOn: '   ' })).toBe(false);
  });

  it('6 · the source value is always carried verbatim and never empty', () => {
    expect(stageObservationIsHonest({ subjectId: 's', sourceScheme: 'EP_ACTIVITY_TYPE', sourceValue: '', observedAt: 'x', fidelity: 'EXACT', summaryStage: 'AMENDED' })).toBe(false);
  });

  it('7 · SEJM CROSSWALK: all 14 variants, 2 EXACT / 3 CONDITIONAL / 9 UNMAPPABLE', () => {
    expect(SEJM_STAGE_CROSSWALK.length).toBe(14);
    const by = (f: string) => SEJM_STAGE_CROSSWALK.filter((e) => e.fidelity === f).length;
    expect(by('EXACT')).toBe(2); expect(by('CONDITIONAL')).toBe(3); expect(by('UNMAPPABLE')).toBe(9);
  });

  it('8 · EP CROSSWALK: 8 measured signals, 3 EXACT / 2 CONDITIONAL / 3 UNMAPPABLE', () => {
    expect(EP_ACTIVITY_CROSSWALK.length).toBe(8);
    const by = (f: string) => EP_ACTIVITY_CROSSWALK.filter((e) => e.fidelity === f).length;
    expect(by('EXACT')).toBe(3); expect(by('CONDITIONAL')).toBe(2); expect(by('UNMAPPABLE')).toBe(3);
  });

  it('9 · NO GENERIC "OTHER" was created to make either table complete', () => {
    for (const e of [...SEJM_STAGE_CROSSWALK, ...EP_ACTIVITY_CROSSWALK]) {
      expect(e.summaryStage).not.toBe('OTHER' as never);
      if (e.fidelity === 'UNMAPPABLE') { expect(e.summaryStage).toBeNull(); expect(e.note.length).toBeGreaterThan(0); }
      if (e.fidelity === 'CONDITIONAL') { expect((e.conditionOn ?? '').length).toBeGreaterThan(0); }
      if (e.summaryStage !== null) expect(LEGISLATIVE_STAGES).toContain(e.summaryStage);
    }
    const body = executableBody(SHARED_POLITICS_SRC);
    expect(body).not.toMatch(/'OTHER'|'UNKNOWN_STAGE'|'MISC'/);
  });

  it('10 · rejection now HAS a crosswalk target in both parliaments', () => {
    expect(EP_ACTIVITY_CROSSWALK.find((e) => e.sourceValue === 'PLENARY_REJECT_COUNCIL_POSITION')!.summaryStage).toBe('REJECTED');
    expect(SEJM_STAGE_CROSSWALK.find((e) => e.sourceValue === 'Voting')!.conditionOn).toContain('passed');
  });

  it('11 · scheduled is not happened, and the law-in-force axis is not the proposal axis', () => {
    expect(EP_FORESEEN_ACTIVITY_IS_NOT_AN_EVENT).toBe(true);
    expect(LAW_IN_FORCE_AXIS_IS_NOT_THE_PROPOSAL_AXIS).toBe(true);
    expect(LEGISLATIVE_SOURCE_SCHEMES).toContain('EU_CDM');
  });
});

describe('R2 · election, poll, court, protest', () => {
  it('12 · the Election vocabulary is UNCHANGED — this is a source limitation, not a shape problem', () => {
    expect(ELECTION_STAGES.length).toBe(9);
    expect(Object.keys(ELECTION_STAGE_STRUCTURED_PRODUCER).sort()).toEqual([...ELECTION_STAGES].sort());
    expect(ELECTION_STAGES_WITH_STRUCTURED_PRODUCER).toEqual(['RESULT_DECLARED']);
    // every stage without a producer says so, rather than being silently absent
    for (const s of ELECTION_STAGES) expect(ELECTION_STAGE_STRUCTURED_PRODUCER[s].length).toBeGreaterThan(0);
  });

  it('13 · poll absence is permitted WITH A REASON, and never reconstructed', () => {
    expect(POLL_FIELD_ABSENCE_REASONS).toEqual(['NOT_PUBLISHED', 'NOT_IN_STRUCTURED_METADATA']);
    // the Eurobarometer case: sizes is an empty array, so sampleSize is absent for a stated reason
    expect(pollAbsencesAreAccountable({ questionWording: 'q', marginOfError: 1, sponsorRef: 's' }, { sampleSize: 'NOT_IN_STRUCTURED_METADATA' })).toBe(true);
    // absent with NO reason is not accountable
    expect(pollAbsencesAreAccountable({ questionWording: 'q', marginOfError: 1, sponsorRef: 's' }, {})).toBe(false);
    // present AND claimed absent is incoherent
    expect(pollAbsencesAreAccountable({ sampleSize: 1000, questionWording: 'q', marginOfError: 1, sponsorRef: 's' }, { sampleSize: 'NOT_PUBLISHED' })).toBe(false);
    // still no margin can be computed — the prohibition is unchanged
    const body = executableBody(SHARED_POLITICS_SRC);
    expect(body).not.toMatch(/Math\.sqrt|1\.96/);
  });

  it('14 · the mandatory poll evidence requirements are NOT weakened', () => {
    const body = executableBody(SHARED_POLITICS_SRC);
    for (const f of ['pollsterRef', 'fieldStart', 'fieldEnd', 'publishedAt', 'geographyRef', 'population']) {
      expect(body).toMatch(new RegExp(`readonly ${f}: `));   // required, no "?"
    }
  });

  it('15 · court outcome is optional evidence, not a required carrier', () => {
    expect(COURT_OUTCOME_IS_REQUIRED_BY_CONTRACT).toBe(false);
    expect(COURT_OUTCOME_PRODUCER_FACTS.EU_CELLAR).toContain('NO OUTCOME MODELLED');
    expect(COURT_OUTCOME_PRODUCER_FACTS.KENYA_LAW).toContain('no formal licence');
    expect(COURT_RULING_SUBJECT_ATTACHMENT_PRODUCER).toContain('NONE');
    // no outcome is inferred from document text anywhere
    const body = executableBody(SHARED_POLITICS_SRC);
    expect(body).not.toMatch(/function\s+\w*(inferOutcome|parseJudgment|extractOutcome)\w*\s*\(/i);
  });

  it('16 · protest: provider unsuitability recorded, identity unchanged', () => {
    expect(PROTEST_EVENT_PRODUCER_FACTS.UCDP_VPP).toContain('dyad-year');
    expect(PROTEST_EVENT_PRODUCER_FACTS.P0_SET).toContain('NO PROTEST EVENT PRODUCER');
    // Protest Campaign is still a PRIMARY subject with its own stages — not reshaped to fit UCDP
    expect(POLITICS_SUBJECT_TYPES).toContain('PROTEST_CAMPAIGN');
    expect(PROTEST_STAGES).toEqual(['CALLED', 'HELD', 'ESCALATED', 'CONCLUDED']);
  });
});
