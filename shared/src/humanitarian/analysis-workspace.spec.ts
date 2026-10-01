import {
  ASK_HANDOFF_REFUSALS,
  CLAIM_CLASS_ADMISSION,
  DERIVED_WORKSPACE_DIMENSION,
  HUMANITARIAN_CLAIM_CLASSES,
  HUMANITARIAN_WORKSPACE_DIMENSIONS,
  HumanitarianWorkspaceRefused,
  WORKSPACE_FORBIDDEN_CLAIM_ATTRIBUTES,
  WORKSPACE_MUST_NOT_IMPLY,
  assertNoNarrativeFiller,
  assertWorkspaceIsWellFormed,
  humanitarianAskHandoff,
  projectHumanitarianWorkspace,
  type AdmittedRetainedEvidenceReadModel,
  type HumanitarianWorkspaceDimensionId,
} from './analysis-workspace';
import type { DomainObservation } from '../observation/domain-observation';

const AT = '2026-10-01T00:00:00.000Z';

/**
 * A record shaped exactly as the Copernicus admitter builds one. The spec constructs the
 * READ MODEL rather than running the admitter, because the admitter needs a review
 * authority that has no production provider — `backend/.../analysis-workspace.contract.spec.ts`
 * is where the two shapes are proved to be the same shape.
 */
function record(over: {
  readonly key: string;
  readonly provider?: string;
  readonly kind?: string;
  readonly attributes?: readonly string[];
  readonly basis?: 'OCCURRENCE' | 'PUBLISHER_VINTAGE' | 'RETRIEVAL_ONLY';
  readonly vintage?: string | null;
  readonly retrievedAt?: string;
  readonly ordinal?: number;
}): AdmittedRetainedEvidenceReadModel {
  const provider = over.provider ?? 'COPERNICUS_EMS';
  const vintage = over.vintage === undefined ? '2026-09-30T00:00:00.000Z' : over.vintage;
  const observation: DomainObservation<unknown> = {
    observationKey: over.key,
    identity: { domainId: 'HUMANITARIAN', upstreamAuthority: provider, upstreamId: over.key },
    observationKind: over.kind ?? 'SOURCE_INUNDATION_EXTENT',
    subjectType: 'SOURCE_EVENT',
    subjectId: over.key,
    claim: {},
    temporal: {
      ...(vintage === null ? {} : { publisherVintage: vintage }),
      retrievedAt: over.retrievedAt ?? '2026-09-30T06:00:00.000Z',
      temporalBasis: over.basis ?? 'PUBLISHER_VINTAGE',
    },
    provenance: {
      sourceType: 'PUBLIC_DATA',
      providerId: provider,
      retrievedAt: over.retrievedAt ?? '2026-09-30T06:00:00.000Z',
      evidenceRole: 'PRIMARY_RECORD',
    },
    sourceReference: {},
    attributeAuthorship: (over.attributes ?? ['geometry', 'countryIso2']).map((attribute) => ({
      attribute,
      authorship: 'PUBLISHER_STATED' as const,
    })),
    revision: {
      revisionOrdinal: over.ordinal ?? 0,
      supersedesRevisionOrdinal: null,
      recordedAt: AT,
    },
  };
  return { captureKey: `capture-${over.key}`, publisherReleasedAt: vintage ?? AT, observation };
}

function dimension(
  workspace: ReturnType<typeof projectHumanitarianWorkspace>,
  id: HumanitarianWorkspaceDimensionId,
) {
  const found = workspace.dimensions.find((d) => d.id === id);
  if (found === undefined) throw new Error(`missing dimension ${id}`);
  return found;
}

describe('HUM-WS · the workspace is well formed whatever it is given', () => {
  it('declares every dimension exactly once, in reading order, with the derivation last', () => {
    for (const records of [
      [],
      [record({ key: 'a' })],
      [record({ key: 'b' }), record({ key: 'a' })],
    ]) {
      const workspace = projectHumanitarianWorkspace(records, AT);
      expect(workspace.dimensions.map((d) => d.id)).toEqual([...HUMANITARIAN_WORKSPACE_DIMENSIONS]);
      expect(workspace.dimensions[workspace.dimensions.length - 1]?.id).toBe(
        DERIVED_WORKSPACE_DIMENSION,
      );
      expect(() => assertWorkspaceIsWellFormed(workspace)).not.toThrow();
    }
  });

  it('is deterministic and orders records by observationKey, not by arrival', () => {
    const forward = projectHumanitarianWorkspace([record({ key: 'a' }), record({ key: 'b' })], AT);
    const reversed = projectHumanitarianWorkspace([record({ key: 'b' }), record({ key: 'a' })], AT);
    expect(reversed).toEqual(forward);
    expect(forward.records.map((r) => r.observationKey)).toEqual(['a', 'b']);
  });

  it('refuses a dimension that is empty without a reason, and one that reassures', () => {
    const workspace = projectHumanitarianWorkspace([], AT);
    const broken = {
      ...workspace,
      dimensions: workspace.dimensions.map((d) => (d.id === 'WHERE' ? { ...d, absence: null } : d)),
    };
    expect(() => assertWorkspaceIsWellFormed(broken)).toThrow(HumanitarianWorkspaceRefused);
    const reassuring = {
      ...workspace,
      dimensions: workspace.dimensions.map((d) =>
        d.id === 'WHERE' ? { ...d, absence: 'ASSESSED_NOTHING_QUALIFIED' as const } : d,
      ),
    };
    expect(() => assertWorkspaceIsWellFormed(reassuring)).toThrow(/ABSENCE_REASSURES/);
  });

  it('refuses an open field set in either direction', () => {
    const workspace = projectHumanitarianWorkspace([], AT);
    expect(() => assertWorkspaceIsWellFormed({ ...workspace, extra: 1 } as never)).toThrow(
      /FIELD_SET_OPEN/,
    );
  });
});

describe('HUM-WS-1 · no evidence', () => {
  it('empties every substantive dimension at the floor and claims nothing about the world', () => {
    const workspace = projectHumanitarianWorkspace([], AT);
    expect(workspace.records).toEqual([]);
    expect(workspace.distinctProviders).toBe(0);
    for (const d of workspace.dimensions) {
      if (d.id === DERIVED_WORKSPACE_DIMENSION) continue;
      expect(d.state).toBe('EMPTY');
      expect(d.absence).toBe('NOT_ASSESSED');
      expect(d.claims).toEqual([]);
    }
  });

  it('derives the unknown roster from the empty dimensions rather than authoring it', () => {
    const workspace = projectHumanitarianWorkspace([], AT);
    const derived = dimension(workspace, DERIVED_WORKSPACE_DIMENSION);
    expect(derived.state).toBe('DERIVED');
    expect(derived.derivedFrom).toEqual(
      HUMANITARIAN_WORKSPACE_DIMENSIONS.filter((id) => id !== DERIVED_WORKSPACE_DIMENSION),
    );
  });

  it('refuses the Ask handoff rather than composing a question from nothing', () => {
    expect(humanitarianAskHandoff(projectHumanitarianWorkspace([], AT))).toEqual({
      available: false,
      refusal: 'NO_ADMITTED_RECORD',
    });
  });
});

describe('HUM-WS-2/3 · a single admitted source only', () => {
  /**
   * THE CONTRACT ASKED FOR "ONE GDACS EVENT ONLY" AND "ONE RELIEFWEB REPORT ONLY".
   * Neither producer exists at this baseline — `git grep -i gdacs` is empty and
   * `reliefweb` appears only in a negative test — and this lane may not acquire
   * provider data, so a GDACS fixture would be an invented source. The governing
   * property those two cases test is SINGLE-SOURCE behaviour, and it is tested here
   * against the one source that is real. See the package report, conflict C2.
   */
  const single = [record({ key: 'ems-1' })];

  it('carries what the publisher stated and nothing else', () => {
    const workspace = projectHumanitarianWorkspace(single, AT);
    expect(dimension(workspace, 'WHAT_HAPPENED').state).toBe('CARRIED');
    expect(dimension(workspace, 'WHERE').state).toBe('CARRIED');
    expect(dimension(workspace, 'WHEN').state).toBe('CARRIED');
    expect(dimension(workspace, 'SOURCE_TIMELINE').state).toBe('CARRIED');
  });

  it('leaves impact, displacement, access and sector EMPTY with SOURCE_NOT_CONNECTED', () => {
    const workspace = projectHumanitarianWorkspace(single, AT);
    for (const id of [
      'REPORTED_IMPACT',
      'DISPLACEMENT',
      'ACCESS_CONSTRAINTS',
      'SECTOR_CLAIMS',
    ] as const) {
      expect(dimension(workspace, id)).toMatchObject({
        state: 'EMPTY',
        absence: 'SOURCE_NOT_CONNECTED',
      });
    }
  });

  it('every carried claim names at least one admitted record', () => {
    const workspace = projectHumanitarianWorkspace(single, AT);
    const claims = workspace.dimensions.flatMap((d) => d.claims);
    expect(claims.length).toBeGreaterThan(0);
    for (const claim of claims) {
      expect(claim.records.length).toBeGreaterThanOrEqual(1);
      expect(claim.records.map((r) => r.observationKey)).toEqual(['ems-1']);
      expect(claim.records.map((r) => r.captureKey)).toEqual(['capture-ems-1']);
    }
  });
});

describe('HUM-WS-4 · multiple corroborating records', () => {
  it('carries one claim per record and keeps each claim pointing only at its own record', () => {
    const workspace = projectHumanitarianWorkspace(
      [record({ key: 'ems-1' }), record({ key: 'ems-2' })],
      AT,
    );
    const where = dimension(workspace, 'WHERE');
    expect(where.state).toBe('CARRIED');
    expect(where.claims).toHaveLength(2);
    expect(where.claims.flatMap((c) => c.records.map((r) => r.observationKey))).toEqual([
      'ems-1',
      'ems-2',
    ]);
  });

  it('does not treat corroboration as agreement: two records from one provider cannot establish disagreement', () => {
    const workspace = projectHumanitarianWorkspace(
      [record({ key: 'a' }), record({ key: 'b' })],
      AT,
    );
    expect(workspace.distinctProviders).toBe(1);
    expect(dimension(workspace, 'SOURCE_DISAGREEMENT')).toMatchObject({
      state: 'EMPTY',
      absence: 'COVERAGE_GAP',
    });
  });

  it('two providers make disagreement examinable rather than established', () => {
    const workspace = projectHumanitarianWorkspace(
      [record({ key: 'a' }), record({ key: 'b', provider: 'OTHER_PUBLIC_DATA' })],
      AT,
    );
    expect(workspace.distinctProviders).toBe(2);
    expect(dimension(workspace, 'SOURCE_DISAGREEMENT')).toMatchObject({
      state: 'EMPTY',
      absence: 'NO_QUALIFYING_EVIDENCE',
    });
  });
});

describe('HUM-WS-5 · contradictory impact figures', () => {
  /**
   * There is no figure to contradict. The substrate carries no `value` and no `unit`,
   * deliberately, and the admitter already proves a body with `severity`, `casualties`
   * and `population` is admitted with none of it surviving. So the testable property is
   * that the workspace REFUSES to carry a figure at all — a contradiction cannot be
   * rendered because neither side of it can exist.
   */
  it('refuses any claim naming an impact attribute, even when a record states it', () => {
    for (const attribute of WORKSPACE_FORBIDDEN_CLAIM_ATTRIBUTES) {
      const workspace = projectHumanitarianWorkspace(
        [record({ key: 'x', attributes: ['geometry', attribute] })],
        AT,
      );
      const attributes = workspace.dimensions.flatMap((d) => d.claims.map((c) => c.attribute));
      expect(attributes).not.toContain(attribute);
    }
  });

  it('declares ESTIMATE and INTERPRETATION unreachable, and refuses one if constructed', () => {
    expect(CLAIM_CLASS_ADMISSION.ESTIMATE.reachableFromRetainedEvidence).toBe(false);
    expect(CLAIM_CLASS_ADMISSION.INTERPRETATION.reachableFromRetainedEvidence).toBe(false);
    expect(CLAIM_CLASS_ADMISSION.SOURCE_ASSERTION.reachableFromRetainedEvidence).toBe(false);
    expect(CLAIM_CLASS_ADMISSION.FACT.reachableFromRetainedEvidence).toBe(true);

    const workspace = projectHumanitarianWorkspace([record({ key: 'x' })], AT);
    const smuggled = {
      ...workspace,
      dimensions: workspace.dimensions.map((d) =>
        d.id === 'REPORTED_IMPACT'
          ? {
              ...d,
              state: 'CARRIED' as const,
              absence: null,
              claims: [
                {
                  claimClass: 'ESTIMATE' as never,
                  assertion: 'FACT' as const,
                  attribute: 'reportedImpact',
                  authorship: 'PUBLISHER_STATED' as const,
                  records: workspace.records,
                },
              ],
            }
          : d,
      ),
    };
    expect(() => assertWorkspaceIsWellFormed(smuggled)).toThrow(/CLAIM_CLASS_/);
  });

  it('keeps the five labels declared so none is silently dropped', () => {
    expect([...HUMANITARIAN_CLAIM_CLASSES]).toEqual([
      'FACT',
      'SOURCE_ASSERTION',
      'ESTIMATE',
      'INTERPRETATION',
      'UNKNOWN',
    ]);
    for (const claimClass of HUMANITARIAN_CLAIM_CLASSES) {
      expect(CLAIM_CLASS_ADMISSION[claimClass].requires).not.toHaveLength(0);
    }
  });
});

describe('HUM-WS-6 · stale evidence', () => {
  /**
   * There is no record-level TTL in the substrate; cadence governs the authority clock,
   * not evidence freshness. So staleness is not invented here either: WHEN carries the
   * publisher's BASIS, and a reader is told which clock a record is on.
   */
  it('names the temporal basis rather than asserting currency', () => {
    for (const basis of ['OCCURRENCE', 'PUBLISHER_VINTAGE', 'RETRIEVAL_ONLY'] as const) {
      const workspace = projectHumanitarianWorkspace([record({ key: 'x', basis })], AT);
      expect(dimension(workspace, 'WHEN').claims.map((c) => c.attribute)).toEqual([
        `temporalBasis:${basis}`,
      ]);
    }
  });

  it('a retrieval-only record cannot be read as an occurrence, and carries a null vintage honestly', () => {
    const workspace = projectHumanitarianWorkspace(
      [record({ key: 'x', basis: 'RETRIEVAL_ONLY', vintage: null })],
      AT,
    );
    expect(workspace.records[0]?.publisherVintage).toBeNull();
    expect(dimension(workspace, 'WHEN').claims[0]?.attribute).toBe('temporalBasis:RETRIEVAL_ONLY');
  });

  it('carries the projection time rather than reading a clock', () => {
    expect(projectHumanitarianWorkspace([], '2020-01-01T00:00:00.000Z').projectedAt).toBe(
      '2020-01-01T00:00:00.000Z',
    );
  });
});

describe('HUM-WS-7 · unknown population impact', () => {
  it('states the population dimension as unknown, never as none', () => {
    const workspace = projectHumanitarianWorkspace([record({ key: 'x' })], AT);
    const impact = dimension(workspace, 'REPORTED_IMPACT');
    expect(impact.state).toBe('EMPTY');
    expect(impact.absence).not.toBe('ASSESSED_NOTHING_QUALIFIED');
    expect(dimension(workspace, DERIVED_WORKSPACE_DIMENSION).derivedFrom).toContain(
      'REPORTED_IMPACT',
    );
  });

  it('UNKNOWN is a dimension state and never the class of a claim', () => {
    expect(CLAIM_CLASS_ADMISSION.UNKNOWN.assertsAs).toBeNull();
    const workspace = projectHumanitarianWorkspace([record({ key: 'x' })], AT);
    expect(workspace.dimensions.flatMap((d) => d.claims.map((c) => c.claimClass))).not.toContain(
      'UNKNOWN',
    );
  });

  it('refuses reader text that would turn an absence into relief', () => {
    for (const forbidden of WORKSPACE_MUST_NOT_IMPLY) {
      expect(() => assertNoNarrativeFiller(`Conditions are ${forbidden}.`, 'test')).toThrow(
        HumanitarianWorkspaceRefused,
      );
    }
    expect(() =>
      assertNoNarrativeFiller('Not assessed. No admitted record for this scope.', 'test'),
    ).not.toThrow();
  });
});

describe('HUM-WS-8 · no geometry', () => {
  it('empties WHERE with a stated reason when the publisher stated no geometry', () => {
    const workspace = projectHumanitarianWorkspace(
      [record({ key: 'x', attributes: ['countryIso2'] })],
      AT,
    );
    expect(dimension(workspace, 'WHERE')).toMatchObject({
      state: 'EMPTY',
      absence: 'EVIDENCE_WITHHELD',
    });
    expect(dimension(workspace, 'WHERE').claims).toEqual([]);
    expect(() => assertWorkspaceIsWellFormed(workspace)).not.toThrow();
  });

  it('a record with no geometry still carries WHAT_HAPPENED, WHEN and the timeline', () => {
    const workspace = projectHumanitarianWorkspace(
      [record({ key: 'x', attributes: ['countryIso2'] })],
      AT,
    );
    expect(dimension(workspace, 'WHAT_HAPPENED').state).toBe('CARRIED');
    expect(dimension(workspace, 'WHEN').state).toBe('CARRIED');
    expect(dimension(workspace, 'SOURCE_TIMELINE').state).toBe('CARRIED');
  });

  it('the unknown roster gains WHERE when geometry is absent', () => {
    const workspace = projectHumanitarianWorkspace(
      [record({ key: 'x', attributes: ['countryIso2'] })],
      AT,
    );
    expect(dimension(workspace, DERIVED_WORKSPACE_DIMENSION).derivedFrom).toContain('WHERE');
  });
});

describe('HUM-WS · the Ask handoff is a subject, never a prompt', () => {
  it('offers the publisher kinds and the record pointers, and nothing else', () => {
    const handoff = humanitarianAskHandoff(
      projectHumanitarianWorkspace([record({ key: 'x' })], AT),
    );
    expect(handoff.available).toBe(true);
    if (!handoff.available) throw new Error('unreachable');
    expect(Object.keys(handoff).sort()).toEqual(['available', 'observationKinds', 'records']);
    expect(handoff.observationKinds).toEqual(['SOURCE_INUNDATION_EXTENT']);
    expect(handoff.records.map((r) => r.observationKey)).toEqual(['x']);
  });

  it('de-duplicates and orders kinds so the subject is stable across runs', () => {
    const handoff = humanitarianAskHandoff(
      projectHumanitarianWorkspace(
        [
          record({ key: 'b', kind: 'SOURCE_INUNDATION_EXTENT' }),
          record({ key: 'a', kind: 'SOURCE_AFFECTED_AREA_EXTENT' }),
          record({ key: 'c', kind: 'SOURCE_INUNDATION_EXTENT' }),
        ],
        AT,
      ),
    );
    if (!handoff.available) throw new Error('expected an available subject');
    expect(handoff.observationKinds).toEqual([
      'SOURCE_AFFECTED_AREA_EXTENT',
      'SOURCE_INUNDATION_EXTENT',
    ]);
  });

  it('names every refusal it can return', () => {
    expect([...ASK_HANDOFF_REFUSALS]).toEqual(['NO_ADMITTED_RECORD', 'NO_STATED_SUBJECT']);
  });

  /* `providerId` IS allowed and is not an exception to this rule: a reader must be able
     to see WHOSE record this is. What may not appear is anything that would make the
     subject executable here — a prompt, an authored question, a model or a system
     instruction. The surface composes the question in the reader's language; this does
     not, and that is what the scan proves. */
  it('carries no prompt, no authored question and no model or instruction reference', () => {
    const handoff = humanitarianAskHandoff(
      projectHumanitarianWorkspace([record({ key: 'x' })], AT),
    );
    const serialised = JSON.stringify(handoff).toLowerCase();
    for (const forbidden of [
      'prompt',
      'question',
      'model',
      'instruction',
      'temperature',
      'completion',
    ]) {
      expect(serialised).not.toContain(forbidden);
    }
    expect(serialised).toContain('providerid');
  });
});
