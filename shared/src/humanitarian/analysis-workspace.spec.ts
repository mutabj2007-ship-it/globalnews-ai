import {
  ASK_HANDOFF_REFUSALS,
  CLAIM_CLASS_ADMISSION,
  DERIVED_WORKSPACE_DIMENSION,
  HUMANITARIAN_CLAIM_CLASSES,
  HUMANITARIAN_WORKSPACE_DIMENSIONS,
  HumanitarianWorkspaceRefused,
  MEASURE_DIMENSION,
  WORKSPACE_FORBIDDEN_CLAIM_ATTRIBUTES,
  WORKSPACE_MUST_NOT_IMPLY,
  assertDisagreementIsPreserved,
  assertMeasureRoutingIsTotal,
  assertNoNarrativeFiller,
  assertWorkspaceIsWellFormed,
  claimClassForBasis,
  humanitarianAskHandoff,
  projectHumanitarianWorkspace,
  projectWorkspaceFromRead,
  type HumanitarianAnalysisWorkspace,
  type HumanitarianWorkspaceDimensionId,
} from './analysis-workspace';
import {
  HUMANITARIAN_IMPACT_MEASURES,
  HUMANITARIAN_STATUS_MEASURES,
  hazardFromSourceCode,
  humanitarianIdentity,
  impactAuthorship,
  type HumanitarianClaim,
  type HumanitarianObservation,
} from './observation';
import {
  humanitarianReadAbsence,
  humanitarianRetainedRead,
  type HumanitarianRetainedRecord,
} from './retained-read';
import { domainObservationKey } from '../observation/domain-observation';

const AT = '2026-10-02T00:00:00.000Z';
const admitAll = (): boolean => true;

/* ────────────────────────────────────────────────────────────────────────────
   FIXTURES — Main's canonical record, built through Main's own entry points.

   The two sources this programme names are both expressible NOW, because Main's contract
   carries `GDACS_EVENTTYPE_TO_HAZARD` and `RELIEFWEB_DISASTER_TYPE_TO_HAZARD`. R1 had to
   substitute for the GDACS and ReliefWeb cases because no source identity existed; it does
   now, and the two cases below are the real ones.
   ──────────────────────────────────────────────────────────────────────────── */

function record(
  authority: string,
  upstreamId: string,
  claim: HumanitarianClaim,
  over: {
    readonly retrievedAt?: string;
    readonly vintage?: string | null;
    readonly basis?: 'OCCURRENCE' | 'PUBLISHER_VINTAGE' | 'RETRIEVAL_ONLY';
    readonly ordinal?: number;
    readonly authorship?: readonly {
      attribute: string;
      authorship: 'PUBLISHER_STATED' | 'LOCALLY_ASSERTED';
    }[];
  } = {},
): HumanitarianRetainedRecord {
  const identity = humanitarianIdentity(authority, upstreamId);
  const vintage = over.vintage === undefined ? '2026-10-01T00:00:00.000Z' : over.vintage;
  const retrievedAt = over.retrievedAt ?? '2026-10-01T06:00:00.000Z';
  const observation: HumanitarianObservation = {
    observationKey: domainObservationKey(identity),
    identity,
    observationKind: claim.claimType,
    subjectType: 'SOURCE_EVENT',
    subjectId: upstreamId,
    claim,
    temporal: {
      ...(vintage === null ? {} : { publisherVintage: vintage }),
      retrievedAt,
      temporalBasis: over.basis ?? 'PUBLISHER_VINTAGE',
    },
    provenance: {
      sourceType: 'PUBLIC_DATA',
      providerId: authority,
      retrievedAt,
      evidenceRole: 'REPORTING',
    },
    sourceReference: { sourceUrl: `https://example.invalid/${upstreamId}` },
    attributeAuthorship: over.authorship ?? [
      { attribute: 'sourceTitle', authorship: 'PUBLISHER_STATED' },
    ],
    revision: {
      revisionOrdinal: over.ordinal ?? 0,
      supersedesRevisionOrdinal: null,
      recordedAt: AT,
    },
  };
  return {
    captureKey: `capture-${authority}-${upstreamId}`,
    publisherReleasedAt: vintage ?? AT,
    observation,
  };
}

/** A GDACS flood event, with GDACS's own two-letter code mapped by Main's table. */
function gdacsFlood(
  id = 'FL-1',
  countries: readonly string[] = ['SDN'],
): HumanitarianRetainedRecord {
  return record('GDACS', id, {
    claimType: 'HUMANITARIAN_EVENT',
    hazardType: hazardFromSourceCode('GDACS', 'FL'),
    sourceNativeType: 'FL',
    sourceTitle: 'Flood in Sudan',
    eventStatus: 'ONGOING',
    countryIso3: countries,
  });
}

/** A ReliefWeb report, linked by the publisher to an event it names. */
function reliefWebReport(
  aboutEventKeys: readonly string[],
  id = 'RW-1',
): HumanitarianRetainedRecord {
  return record('RELIEFWEB', id, {
    claimType: 'HUMANITARIAN_REPORT',
    sourceTitle: 'Sudan: Flood Situation Report No. 3',
    sourceFormat: 'Situation Report',
    countryIso3: ['SDN'],
    aboutEventKeys,
  });
}

function impact(
  authority: string,
  id: string,
  aboutEventKey: string,
  measure: HumanitarianRetainedRecord extends never ? never : string,
  value: number | string,
  basis: 'SOURCE_STATED' | 'SOURCE_ESTIMATED' = 'SOURCE_STATED',
  unit: string | undefined = 'PERSONS',
): HumanitarianRetainedRecord {
  const isCount = (HUMANITARIAN_IMPACT_MEASURES as readonly string[]).includes(measure);
  return record(
    authority,
    id,
    {
      claimType: 'HUMANITARIAN_IMPACT_ASSERTION',
      measure: measure as never,
      value,
      ...(isCount ? { unit } : {}),
      basis,
      sourceBasisStatement: 'The report states this figure.',
      aboutEventKey,
      countryIso3: ['SDN'],
    },
    { authorship: [...impactAuthorship(basis)] as never },
  );
}

function dimension(workspace: HumanitarianAnalysisWorkspace, id: HumanitarianWorkspaceDimensionId) {
  const found = workspace.dimensions.find((d) => d.id === id);
  if (found === undefined) throw new Error(`missing dimension ${id}`);
  return found;
}

const EVENT_KEY = domainObservationKey(humanitarianIdentity('GDACS', 'FL-1'));

/* ────────────────────────────────────────────────────────────────────────── */

describe('HUM-WS-R2 · the contract is total and closed', () => {
  it('routes every measure Main declares, in both registries', () => {
    expect(() => assertMeasureRoutingIsTotal()).not.toThrow();
    for (const measure of [...HUMANITARIAN_IMPACT_MEASURES, ...HUMANITARIAN_STATUS_MEASURES]) {
      expect(HUMANITARIAN_WORKSPACE_DIMENSIONS).toContain(MEASURE_DIMENSION[measure]);
    }
  });

  it('keeps displacement in its own dimension, apart from the other counts', () => {
    expect(MEASURE_DIMENSION.PEOPLE_DISPLACED).toBe('DISPLACEMENT');
    expect(MEASURE_DIMENSION.PEOPLE_AFFECTED).toBe('REPORTED_IMPACT');
    expect(MEASURE_DIMENSION.HUMANITARIAN_ACCESS_STATUS).toBe('ACCESS_CONSTRAINTS');
    expect(MEASURE_DIMENSION.WATER_STATUS).toBe('SECTOR_CLAIMS');
  });

  it('declares every dimension exactly once, in order, derivation last, for any input', () => {
    const inputs: readonly (readonly HumanitarianRetainedRecord[])[] = [
      [],
      [gdacsFlood()],
      [gdacsFlood(), reliefWebReport([EVENT_KEY])],
      [gdacsFlood(), impact('RELIEFWEB', 'I1', EVENT_KEY, 'PEOPLE_DISPLACED', 12000)],
    ];
    for (const records of inputs) {
      const workspace = projectHumanitarianWorkspace(records, AT);
      expect(workspace.dimensions.map((d) => d.id)).toEqual([...HUMANITARIAN_WORKSPACE_DIMENSIONS]);
      expect(() => assertWorkspaceIsWellFormed(workspace)).not.toThrow();
      expect(() => assertDisagreementIsPreserved(workspace)).not.toThrow();
    }
  });

  it('is deterministic and orders by observationKey, not arrival', () => {
    const a = gdacsFlood('FL-1');
    const b = gdacsFlood('FL-2');
    expect(projectHumanitarianWorkspace([a, b], AT)).toEqual(
      projectHumanitarianWorkspace([b, a], AT),
    );
  });

  it('refuses an open field set in either direction', () => {
    const workspace = projectHumanitarianWorkspace([gdacsFlood()], AT);
    expect(() => assertWorkspaceIsWellFormed({ ...workspace, extra: 1 } as never)).toThrow(
      /FIELD_SET_OPEN/,
    );
  });
});

describe('HUM-WS-R2 · NO_RETAINED_EVIDENCE is not an absence (the R1 correction)', () => {
  it('an empty store is the store state, never NOT_ASSESSED', () => {
    const workspace = projectHumanitarianWorkspace([], AT);
    for (const d of workspace.dimensions) {
      if (d.id === DERIVED_WORKSPACE_DIMENSION) continue;
      expect(d.state).toBe('EMPTY');
      expect(d.storeState).toBe('NO_RETAINED_EVIDENCE');
      expect(d.absence).toBeNull();
    }
  });

  it('the read-aware entry point repeats the read it was given, and never substitutes', () => {
    const notAssessed = projectWorkspaceFromRead(humanitarianReadAbsence('NOT_ASSESSED'), AT);
    expect(dimension(notAssessed, 'WHERE')).toMatchObject({
      absence: 'NOT_ASSESSED',
      storeState: null,
    });

    const gap = projectWorkspaceFromRead(humanitarianReadAbsence('SOURCE_NOT_CONNECTED'), AT);
    expect(dimension(gap, 'WHERE')).toMatchObject({ absence: 'COVERAGE_GAP', storeState: null });

    const emptyStore = projectWorkspaceFromRead(humanitarianRetainedRead([], admitAll), AT);
    expect(dimension(emptyStore, 'WHERE')).toMatchObject({
      absence: null,
      storeState: 'NO_RETAINED_EVIDENCE',
    });

    const retained = projectWorkspaceFromRead(
      humanitarianRetainedRead([gdacsFlood()], admitAll),
      AT,
    );
    expect(dimension(retained, 'WHAT_HAPPENED').state).toBe('CARRIED');
  });

  it('refuses a dimension that names both reasons, or neither', () => {
    const workspace = projectHumanitarianWorkspace([], AT);
    for (const patch of [{ absence: 'NOT_ASSESSED' as const }, { storeState: null }]) {
      const broken = {
        ...workspace,
        dimensions: workspace.dimensions.map((d) => (d.id === 'WHERE' ? { ...d, ...patch } : d)),
      };
      expect(() => assertWorkspaceIsWellFormed(broken as never)).toThrow(/EMPTY_REASON_AMBIGUOUS/);
    }
  });

  it('refuses a positive finding, which this substrate can never admit', () => {
    const workspace = projectHumanitarianWorkspace([], AT);
    const reassuring = {
      ...workspace,
      dimensions: workspace.dimensions.map((d) =>
        d.id === 'WHERE'
          ? { ...d, absence: 'ASSESSED_NOTHING_QUALIFIED' as const, storeState: null }
          : d,
      ),
    };
    expect(() => assertWorkspaceIsWellFormed(reassuring as never)).toThrow(/ABSENCE_REASSURES/);
  });
});

describe('HUM-WS-1 · no evidence', () => {
  it('carries nothing, derives the unknown roster, and refuses the Ask handoff', () => {
    const workspace = projectHumanitarianWorkspace([], AT);
    expect(workspace.records).toEqual([]);
    expect(workspace.eventKeys).toEqual([]);
    expect(dimension(workspace, DERIVED_WORKSPACE_DIMENSION).derivedFrom).toEqual(
      HUMANITARIAN_WORKSPACE_DIMENSIONS.filter((id) => id !== DERIVED_WORKSPACE_DIMENSION),
    );
    expect(humanitarianAskHandoff(workspace)).toEqual({
      available: false,
      refusal: 'NO_ADMITTED_RECORD',
    });
  });
});

describe('HUM-WS-2 · one GDACS event only', () => {
  const only = [gdacsFlood()];

  it("carries the hazard the source's own code maps to, and its stated status", () => {
    const workspace = projectHumanitarianWorkspace(only, AT);
    const what = dimension(workspace, 'WHAT_HAPPENED');
    expect(what.state).toBe('CARRIED');
    expect(what.claims.map((c) => c.attribute)).toEqual([
      'hazardType:FLOOD',
      'eventStatus:ONGOING',
    ]);
    for (const claim of what.claims) {
      expect(claim.claimClass).toBe('FACT');
      expect(claim.value).toBeNull();
      expect(claim.records.map((r) => r.providerId)).toEqual(['GDACS']);
    }
  });

  it('places the event at COUNTRY precision from the ISO3 the source scoped, and no finer', () => {
    const workspace = projectHumanitarianWorkspace(only, AT);
    expect(dimension(workspace, 'WHERE').claims.map((c) => c.attribute)).toEqual([
      'countryIso3:SDN',
    ]);
    const serialised = JSON.stringify(workspace);
    for (const forbidden of ['coordinates', 'geometry', 'centroid', 'EXACT', 'DISTRICT']) {
      expect(serialised).not.toContain(forbidden);
    }
  });

  it('asserts no impact of any kind from an event alone', () => {
    const workspace = projectHumanitarianWorkspace(only, AT);
    for (const id of [
      'REPORTED_IMPACT',
      'DISPLACEMENT',
      'ACCESS_CONSTRAINTS',
      'SECTOR_CLAIMS',
    ] as const) {
      expect(dimension(workspace, id)).toMatchObject({
        state: 'EMPTY',
        storeState: 'NO_RETAINED_EVIDENCE',
        absence: null,
      });
    }
  });

  it('cannot establish disagreement from one source', () => {
    const workspace = projectHumanitarianWorkspace(only, AT);
    expect(workspace.distinctProviders).toBe(1);
    expect(dimension(workspace, 'SOURCE_DISAGREEMENT')).toMatchObject({
      state: 'EMPTY',
      absence: 'COVERAGE_GAP',
    });
  });

  it('offers the Ask engine the hazard type as its subject, and only that', () => {
    const handoff = humanitarianAskHandoff(projectHumanitarianWorkspace(only, AT));
    if (!handoff.available) throw new Error('expected a subject');
    expect(handoff.observationKinds).toEqual(['FLOOD']);
    expect(Object.keys(handoff).sort()).toEqual(['available', 'observationKinds', 'records']);
  });
});

describe('HUM-WS-3 · one ReliefWeb report only', () => {
  it('carries the report on the source timeline and still asserts no event occurred', () => {
    const workspace = projectHumanitarianWorkspace([reliefWebReport([EVENT_KEY])], AT);
    expect(dimension(workspace, 'SOURCE_TIMELINE').state).toBe('CARRIED');
    /* A publisher report is not a hazard occurrence record. Without the event, the workspace
       says the store holds no event — it does not promote the report into one. */
    expect(dimension(workspace, 'WHAT_HAPPENED')).toMatchObject({
      state: 'EMPTY',
      storeState: 'NO_RETAINED_EVIDENCE',
    });
    expect(humanitarianAskHandoff(workspace)).toEqual({
      available: false,
      refusal: 'NO_STATED_SUBJECT',
    });
  });

  it("keeps the publisher's own event linkage without inventing an event record", () => {
    const workspace = projectHumanitarianWorkspace([reliefWebReport([EVENT_KEY])], AT);
    expect(workspace.eventKeys).toEqual([EVENT_KEY]);
    expect(workspace.records.map((r) => r.providerId)).toEqual(['RELIEFWEB']);
  });
});

describe('HUM-WS-4 · multiple corroborating reports', () => {
  const corroborating = [
    gdacsFlood(),
    reliefWebReport([EVENT_KEY], 'RW-1'),
    reliefWebReport([EVENT_KEY], 'RW-2'),
  ];

  it('carries each report separately and never merges them into one', () => {
    const workspace = projectHumanitarianWorkspace(corroborating, AT);
    expect(dimension(workspace, 'SOURCE_TIMELINE').claims).toHaveLength(2);
    expect(workspace.records).toHaveLength(3);
    expect(workspace.distinctProviders).toBe(2);
  });

  it('agreement between two sources is not corroboration of a figure neither stated', () => {
    const workspace = projectHumanitarianWorkspace(corroborating, AT);
    expect(dimension(workspace, 'REPORTED_IMPACT').state).toBe('EMPTY');
    expect(dimension(workspace, 'SOURCE_DISAGREEMENT')).toMatchObject({
      state: 'EMPTY',
      absence: 'NO_QUALIFYING_EVIDENCE',
    });
  });
});

describe('HUM-WS-5 · contradictory impact figures', () => {
  const contradicting = [
    gdacsFlood(),
    impact('GDACS', 'I1', EVENT_KEY, 'PEOPLE_DISPLACED', 12000),
    impact('RELIEFWEB', 'I2', EVENT_KEY, 'PEOPLE_DISPLACED', 31000),
  ];

  it('carries BOTH figures, each with its own source, and reconciles neither', () => {
    const workspace = projectHumanitarianWorkspace(contradicting, AT);
    const displacement = dimension(workspace, 'DISPLACEMENT');
    expect(displacement.state).toBe('CARRIED');
    expect(displacement.claims.map((c) => c.value).sort()).toEqual([12000, 31000]);
    expect(displacement.claims.map((c) => c.records[0]?.providerId).sort()).toEqual([
      'GDACS',
      'RELIEFWEB',
    ]);
  });

  it('names the disagreement without resolving it', () => {
    const workspace = projectHumanitarianWorkspace(contradicting, AT);
    const dispute = dimension(workspace, 'SOURCE_DISAGREEMENT');
    expect(dispute.state).toBe('CARRIED');
    expect(dispute.claims).toHaveLength(2);
    expect(() => assertDisagreementIsPreserved(workspace)).not.toThrow();
  });

  it('detects a workspace that collapsed a disputed figure into one row', () => {
    const workspace = projectHumanitarianWorkspace(contradicting, AT);
    const collapsed = {
      ...workspace,
      dimensions: workspace.dimensions.map((d) =>
        d.id === 'DISPLACEMENT' ? { ...d, claims: d.claims.slice(0, 1) } : d,
      ),
    };
    expect(() => assertDisagreementIsPreserved(collapsed)).toThrow(/DISAGREEMENT_RESOLVED/);
  });

  it('two assertions about DIFFERENT events are not a disagreement', () => {
    const second = domainObservationKey(humanitarianIdentity('GDACS', 'FL-2'));
    const workspace = projectHumanitarianWorkspace(
      [
        gdacsFlood('FL-1'),
        gdacsFlood('FL-2'),
        impact('GDACS', 'I1', EVENT_KEY, 'PEOPLE_DISPLACED', 12000),
        impact('RELIEFWEB', 'I2', second, 'PEOPLE_DISPLACED', 31000),
      ],
      AT,
    );
    expect(dimension(workspace, 'SOURCE_DISAGREEMENT').state).toBe('EMPTY');
    expect(dimension(workspace, 'DISPLACEMENT').claims).toHaveLength(2);
  });

  it('a figure never arrives in the product voice: FACT claims carry no value', () => {
    const workspace = projectHumanitarianWorkspace(contradicting, AT);
    for (const d of workspace.dimensions) {
      for (const claim of d.claims) {
        if (claim.claimClass === 'FACT') expect(claim.value).toBeNull();
        else expect(claim.value).not.toBeNull();
      }
    }
    const smuggled = {
      ...workspace,
      dimensions: workspace.dimensions.map((d) =>
        d.id === 'WHAT_HAPPENED'
          ? { ...d, claims: d.claims.map((c) => ({ ...c, value: 999 })) }
          : d,
      ),
    };
    expect(() => assertWorkspaceIsWellFormed(smuggled as never)).toThrow(/FACT_CARRIES_FIGURE/);
  });

  it('no FACT attribute may name an impact word', () => {
    for (const forbidden of WORKSPACE_FORBIDDEN_CLAIM_ATTRIBUTES) {
      const workspace = projectHumanitarianWorkspace([gdacsFlood()], AT);
      const attributes = workspace.dimensions.flatMap((d) =>
        d.claims.filter((c) => c.claimClass === 'FACT').map((c) => c.attribute),
      );
      expect(attributes).not.toContain(forbidden);
    }
  });
});

describe('HUM-WS-R2 · the claim ladder, corrected by evidence', () => {
  it('reads the class from the basis the source stated, never from the value', () => {
    expect(claimClassForBasis('SOURCE_STATED')).toBe('SOURCE_ASSERTION');
    expect(claimClassForBasis('SOURCE_ESTIMATED')).toBe('ESTIMATE');
  });

  it('carries a stated figure as SOURCE_ASSERTION and an estimate as ESTIMATE', () => {
    const workspace = projectHumanitarianWorkspace(
      [
        gdacsFlood(),
        impact('RELIEFWEB', 'I1', EVENT_KEY, 'PEOPLE_AFFECTED', 50000, 'SOURCE_STATED'),
        impact('RELIEFWEB', 'I2', EVENT_KEY, 'PEOPLE_IN_NEED', 80000, 'SOURCE_ESTIMATED'),
      ],
      AT,
    );
    const classes = dimension(workspace, 'REPORTED_IMPACT')
      .claims.map((c) => c.claimClass)
      .sort();
    expect(classes).toEqual(['ESTIMATE', 'SOURCE_ASSERTION']);
    for (const claim of dimension(workspace, 'REPORTED_IMPACT').claims) {
      expect(claim.assertion).toBe('REPORTED_STATEMENT');
    }
  });

  it('SOURCE_ASSERTION and ESTIMATE are reachable now; INTERPRETATION never is', () => {
    expect(CLAIM_CLASS_ADMISSION.SOURCE_ASSERTION.reachableFromRetainedEvidence).toBe(true);
    expect(CLAIM_CLASS_ADMISSION.ESTIMATE.reachableFromRetainedEvidence).toBe(true);
    expect(CLAIM_CLASS_ADMISSION.INTERPRETATION.reachableFromRetainedEvidence).toBe(false);
    expect(CLAIM_CLASS_ADMISSION.UNKNOWN.reachableFromRetainedEvidence).toBe(false);
  });

  it('keeps all five labels declared, and lands each on the accepted two-kind axis or nowhere', () => {
    expect([...HUMANITARIAN_CLAIM_CLASSES]).toEqual([
      'FACT',
      'SOURCE_ASSERTION',
      'ESTIMATE',
      'INTERPRETATION',
      'UNKNOWN',
    ]);
    for (const claimClass of HUMANITARIAN_CLAIM_CLASSES) {
      const admission = CLAIM_CLASS_ADMISSION[claimClass];
      expect(admission.requires.length).toBeGreaterThan(0);
      if (admission.assertsAs !== null) {
        expect(['FACT', 'REPORTED_STATEMENT']).toContain(admission.assertsAs);
      }
    }
  });

  it('refuses a smuggled INTERPRETATION claim', () => {
    const workspace = projectHumanitarianWorkspace([gdacsFlood()], AT);
    const smuggled = {
      ...workspace,
      dimensions: workspace.dimensions.map((d) =>
        d.id === 'REPORTED_IMPACT'
          ? {
              ...d,
              state: 'CARRIED' as const,
              absence: null,
              storeState: null,
              claims: [
                {
                  claimClass: 'INTERPRETATION',
                  assertion: 'FACT',
                  attribute: 'PEOPLE_AFFECTED',
                  authorship: 'PUBLISHER_STATED',
                  value: 1,
                  unit: 'PERSONS',
                  records: workspace.records,
                },
              ],
            }
          : d,
      ),
    };
    expect(() => assertWorkspaceIsWellFormed(smuggled as never)).toThrow(/CLAIM_CLASS_/);
  });
});

describe('HUM-WS-6 · stale evidence', () => {
  it('names the temporal basis per record rather than asserting currency', () => {
    for (const basis of ['OCCURRENCE', 'PUBLISHER_VINTAGE', 'RETRIEVAL_ONLY'] as const) {
      const workspace = projectHumanitarianWorkspace(
        [
          record(
            'GDACS',
            'FL-1',
            {
              claimType: 'HUMANITARIAN_EVENT',
              hazardType: 'FLOOD',
              sourceNativeType: 'FL',
              sourceTitle: 'Flood',
              eventStatus: 'NOT_STATED',
              countryIso3: ['SDN'],
            },
            { basis },
          ),
        ],
        AT,
      );
      expect(dimension(workspace, 'WHEN').claims.map((c) => c.attribute)).toEqual([
        `temporalBasis:${basis}`,
      ]);
    }
  });

  it('a record with no publisher vintage carries null, not the retrieval time', () => {
    const workspace = projectHumanitarianWorkspace(
      [
        record(
          'GDACS',
          'FL-1',
          {
            claimType: 'HUMANITARIAN_EVENT',
            hazardType: 'FLOOD',
            sourceNativeType: 'FL',
            sourceTitle: 'Flood',
            eventStatus: 'NOT_STATED',
            countryIso3: ['SDN'],
          },
          { vintage: null, basis: 'RETRIEVAL_ONLY', retrievedAt: '2026-09-01T00:00:00.000Z' },
        ),
      ],
      AT,
    );
    expect(workspace.records[0]?.publisherVintage).toBeNull();
    expect(workspace.records[0]?.retrievedAt).toBe('2026-09-01T00:00:00.000Z');
  });

  it('carries the projection time it was given rather than reading a clock', () => {
    expect(projectHumanitarianWorkspace([], '2020-01-01T00:00:00.000Z').projectedAt).toBe(
      '2020-01-01T00:00:00.000Z',
    );
  });
});

describe('HUM-WS-7 · unknown population impact', () => {
  it('states the impact dimension as unknown, never as zero and never as none', () => {
    const workspace = projectHumanitarianWorkspace([gdacsFlood()], AT);
    const impactDimension = dimension(workspace, 'REPORTED_IMPACT');
    expect(impactDimension.state).toBe('EMPTY');
    expect(impactDimension.claims).toEqual([]);
    expect(JSON.stringify(impactDimension)).not.toContain('"value":0');
    expect(dimension(workspace, DERIVED_WORKSPACE_DIMENSION).derivedFrom).toContain(
      'REPORTED_IMPACT',
    );
  });

  it('UNKNOWN is a dimension state and never a claim class', () => {
    const workspace = projectHumanitarianWorkspace([gdacsFlood()], AT);
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

  it('a zero a source actually asserted is carried, because the source asserted it', () => {
    const workspace = projectHumanitarianWorkspace(
      [gdacsFlood(), impact('RELIEFWEB', 'I1', EVENT_KEY, 'FATALITIES', 0)],
      AT,
    );
    const claims = dimension(workspace, 'REPORTED_IMPACT').claims;
    expect(claims).toHaveLength(1);
    expect(claims[0]?.value).toBe(0);
    expect(claims[0]?.claimClass).toBe('SOURCE_ASSERTION');
  });
});

describe('HUM-WS-8 · no geometry', () => {
  it('a record with no country scope empties WHERE with a stated reason', () => {
    const workspace = projectHumanitarianWorkspace([gdacsFlood('FL-1', [])], AT);
    expect(dimension(workspace, 'WHERE')).toMatchObject({
      state: 'EMPTY',
      absence: 'EVIDENCE_WITHHELD',
      storeState: null,
    });
    expect(dimension(workspace, 'WHAT_HAPPENED').state).toBe('CARRIED');
    expect(dimension(workspace, DERIVED_WORKSPACE_DIMENSION).derivedFrom).toContain('WHERE');
  });

  it('never carries a coordinate, a polygon or a precision finer than the country', () => {
    const workspace = projectHumanitarianWorkspace(
      [gdacsFlood(), impact('RELIEFWEB', 'I1', EVENT_KEY, 'PEOPLE_DISPLACED', 12000)],
      AT,
    );
    const serialised = JSON.stringify(workspace);
    for (const forbidden of ['coordinates', 'geometryRecordKey', 'POLYGON', 'crs', 'centroid']) {
      expect(serialised).not.toContain(forbidden);
    }
  });
});

describe('HUM-WS · the Ask handoff carries a subject and never a prompt', () => {
  it('de-duplicates and orders hazard types so the subject is stable', () => {
    const second = record('GDACS', 'EQ-1', {
      claimType: 'HUMANITARIAN_EVENT',
      hazardType: hazardFromSourceCode('GDACS', 'EQ'),
      sourceNativeType: 'EQ',
      sourceTitle: 'Earthquake',
      eventStatus: 'ONGOING',
      countryIso3: ['SDN'],
    });
    const handoff = humanitarianAskHandoff(
      projectHumanitarianWorkspace([gdacsFlood(), second], AT),
    );
    if (!handoff.available) throw new Error('expected a subject');
    expect(handoff.observationKinds).toEqual(['EARTHQUAKE', 'FLOOD']);
  });

  it('names every refusal it can return', () => {
    expect([...ASK_HANDOFF_REFUSALS]).toEqual(['NO_ADMITTED_RECORD', 'NO_STATED_SUBJECT']);
  });

  it('carries no prompt, no authored question and no model or instruction reference', () => {
    const handoff = humanitarianAskHandoff(projectHumanitarianWorkspace([gdacsFlood()], AT));
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
