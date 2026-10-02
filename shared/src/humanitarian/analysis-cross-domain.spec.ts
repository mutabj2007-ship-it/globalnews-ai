import { readFileSync } from 'fs';
import { join } from 'path';
import {
  CONFLICT_LINKED_HAZARD,
  CROSS_DOMAIN_RELATIONS,
  CrossDomainRefused,
  RELATION_ESTABLISHES_CONSEQUENCE,
  assertCrossDomainContextIsClosed,
  assertNoImpactAttributedToConflict,
  crossDomainSides,
  projectHumanitarianCrossDomain,
  statedFigures,
} from './analysis-cross-domain';
import { projectHumanitarianWorkspace } from './analysis-workspace';
import {
  ACCEPTED_SEVERITY_DERIVATION_RULES,
  SEVERITY_UNAVAILABLE_NO_RULE,
  conflictEventKey,
  type ConflictObservation,
} from '../conflict/observation';
import {
  hazardFromSourceCode,
  humanitarianIdentity,
  impactAuthorship,
  type HumanitarianClaim,
  type HumanitarianObservation,
} from './observation';
import type { HumanitarianRetainedRecord } from './retained-read';
import { domainObservationKey } from '../observation/domain-observation';

const AT = '2026-10-02T00:00:00.000Z';
const WINDOW = { from: '2026-09-01T00:00:00.000Z', to: '2026-10-02T00:00:00.000Z' };

function humRecord(
  authority: string,
  upstreamId: string,
  claim: HumanitarianClaim,
): HumanitarianRetainedRecord {
  const identity = humanitarianIdentity(authority, upstreamId);
  const observation: HumanitarianObservation = {
    observationKey: domainObservationKey(identity),
    identity,
    observationKind: claim.claimType,
    subjectType: 'SOURCE_EVENT',
    subjectId: upstreamId,
    claim,
    temporal: {
      publisherVintage: '2026-09-20T00:00:00.000Z',
      retrievedAt: '2026-09-21T00:00:00.000Z',
      temporalBasis: 'PUBLISHER_VINTAGE',
    },
    provenance: {
      sourceType: 'PUBLIC_DATA',
      providerId: authority,
      retrievedAt: '2026-09-21T00:00:00.000Z',
    },
    sourceReference: {},
    attributeAuthorship:
      claim.claimType === 'HUMANITARIAN_IMPACT_ASSERTION'
        ? [...impactAuthorship(claim.basis)]
        : [{ attribute: 'sourceTitle', authorship: 'PUBLISHER_STATED' as const }],
    revision: { revisionOrdinal: 0, supersedesRevisionOrdinal: null, recordedAt: AT },
  };
  return {
    captureKey: `cap-${upstreamId}`,
    publisherReleasedAt: '2026-09-20T00:00:00.000Z',
    observation,
  };
}

/** A flood event: the humanitarian source has NOT linked anything to conflict. */
function floodEvent(countries: readonly string[] = ['SDN']): HumanitarianRetainedRecord {
  return humRecord('GDACS', 'FL-1', {
    claimType: 'HUMANITARIAN_EVENT',
    hazardType: hazardFromSourceCode('GDACS', 'FL'),
    sourceNativeType: 'FL',
    sourceTitle: 'Flood',
    eventStatus: 'ONGOING',
    countryIso3: countries,
  });
}

/** A conflict-displacement event: the HUMANITARIAN publisher scoped its own hazard to conflict. */
function conflictDisplacementEvent(): HumanitarianRetainedRecord {
  return humRecord('RELIEFWEB', 'CD-1', {
    claimType: 'HUMANITARIAN_EVENT',
    hazardType: CONFLICT_LINKED_HAZARD,
    sourceNativeType: 'Conflict displacement',
    sourceTitle: 'Displacement in Sudan',
    eventStatus: 'ONGOING',
    countryIso3: ['SDN'],
  });
}

function displacedAssertion(aboutEventKey: string, value: number): HumanitarianRetainedRecord {
  return humRecord('RELIEFWEB', `I-${String(value)}`, {
    claimType: 'HUMANITARIAN_IMPACT_ASSERTION',
    measure: 'PEOPLE_DISPLACED',
    value,
    unit: 'PERSONS',
    basis: 'SOURCE_STATED',
    sourceBasisStatement: 'The report states this figure.',
    aboutEventKey,
    countryIso3: ['SDN'],
  });
}

function conflictEvent(
  upstreamEventId: string,
  over: { readonly countryIso3?: string; readonly eventStartedAt?: string } = {},
): ConflictObservation {
  const identity = { authority: 'UCDP_GED' as const, upstreamEventId };
  return {
    observationKey: conflictEventKey(identity),
    identity,
    eventType: 'ARMED_CLASH',
    owner: 'CONFLICT',
    actors: [{ kind: 'ORGANISED_ARMED_ACTOR' as never, upstreamName: 'Party A' }],
    geography: {
      geometryKind: 'POINT',
      coordinates: { type: 'Point', coordinates: [32, 15] },
      crs: 'EPSG:4326',
      denotation: 'SOURCE_REPORTED_CENTROID',
      origin: 'SOURCE_NATIVE',
      precision: 'ADMIN2' as never,
      locationProvenance: 'STATED' as never,
      ...(over.countryIso3 === undefined ? {} : { countryIso3: over.countryIso3 }),
      countryIso3Basis: 'SOURCE_STATED',
    },
    temporal: {
      eventStartedAt: over.eventStartedAt ?? '2026-09-15T00:00:00.000Z',
      ingestedAt: '2026-09-16T00:00:00.000Z',
      temporalProvenance: 'EVENT_DATED_BY_SOURCE',
    },
    /* THE ONLY SEVERITY A PRODUCER CAN BUILD TODAY. Carried so the fixture is honest; the
       projection below never reads it, and the source scan proves it cannot. */
    severity: SEVERITY_UNAVAILABLE_NO_RULE,
    sourceReference: { citation: 'Radio Dabanga, 2026-09-15' },
    acquisition: {
      snapshotRetrievalId: 'snap-1',
      snapshotAdmissibility: 'ADMITTED',
      runId: 'run-1',
    },
    revision: { revisionOrdinal: 0, supersedesRevisionOrdinal: null, recordedAt: AT },
  } as ConflictObservation;
}

const FLOOD_KEY = domainObservationKey(humanitarianIdentity('GDACS', 'FL-1'));
const DISPLACEMENT_KEY = domainObservationKey(humanitarianIdentity('RELIEFWEB', 'CD-1'));

function contextFor(
  records: readonly HumanitarianRetainedRecord[],
  conflict: readonly ConflictObservation[],
) {
  const workspace = projectHumanitarianWorkspace(records, AT);
  const context = projectHumanitarianCrossDomain({
    workspace,
    records,
    conflict,
    window: WINDOW,
    projectedAt: AT,
  });
  return { workspace, context };
}

describe('HUM-XD · the relation is only ever what the evidence states', () => {
  it('NONE when no conflict record shares the country and window', () => {
    const { context } = contextFor([floodEvent()], [conflictEvent('1', { countryIso3: 'KEN' })]);
    expect(context.relation).toBe('NONE');
    expect(context.relationBasis).toBe('NONE');
    expect(context.conflictFacts).toEqual([]);
  });

  it('NONE when the conflict record falls outside the window the caller asked about', () => {
    const { context } = contextFor(
      [floodEvent()],
      [conflictEvent('1', { countryIso3: 'SDN', eventStartedAt: '2024-01-01T00:00:00.000Z' })],
    );
    expect(context.relation).toBe('NONE');
  });

  it('CO_OCCURRENCE_ONLY when they merely share a country and a window', () => {
    const { context } = contextFor([floodEvent()], [conflictEvent('1', { countryIso3: 'SDN' })]);
    expect(context.relation).toBe('CO_OCCURRENCE_ONLY');
    expect(context.relationBasis).toBe('SHARED_COUNTRY_AND_WINDOW');
    expect(context.conflictFacts).toHaveLength(1);
  });

  it('SOURCE_LINKED only when the HUMANITARIAN source scoped its own hazard to conflict', () => {
    const { context } = contextFor(
      [conflictDisplacementEvent()],
      [conflictEvent('1', { countryIso3: 'SDN' })],
    );
    expect(context.relation).toBe('SOURCE_LINKED');
    expect(context.relationBasis).toBe('HUMANITARIAN_SOURCE_STATED_CONFLICT_HAZARD');
  });

  it('more co-occurrences never become a stronger relation', () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      conflictEvent(String(i), { countryIso3: 'SDN' }),
    );
    const { context } = contextFor([floodEvent()], many);
    expect(context.relation).toBe('CO_OCCURRENCE_ONLY');
    expect(context.conflictFacts).toHaveLength(25);
  });

  it('NO relation establishes a humanitarian consequence — not even SOURCE_LINKED', () => {
    for (const relation of CROSS_DOMAIN_RELATIONS) {
      expect(RELATION_ESTABLISHES_CONSEQUENCE[relation]).toBe(false);
    }
    const { context } = contextFor(
      [conflictDisplacementEvent()],
      [conflictEvent('1', { countryIso3: 'SDN' })],
    );
    expect(context.establishesConsequence).toBe(false);
    expect(() => assertCrossDomainContextIsClosed(context)).not.toThrow();
  });

  it('a conflict record with no country join code never joins the context', () => {
    const { context } = contextFor([floodEvent()], [conflictEvent('1')]);
    expect(context.relation).toBe('NONE');
  });
});

describe('HUM-XD · Conflict facts and Humanitarian assertions stay two lists', () => {
  it('keeps the two sides separate and never merges them', () => {
    const { context } = contextFor(
      [conflictDisplacementEvent(), displacedAssertion(DISPLACEMENT_KEY, 31000)],
      [conflictEvent('1', { countryIso3: 'SDN' })],
    );
    const sides = crossDomainSides(context);
    expect(sides.conflict).toHaveLength(1);
    expect(sides.humanitarian).toHaveLength(1);
    expect(sides.humanitarian[0]?.measure).toBe('PEOPLE_DISPLACED');
    expect(sides.humanitarian[0]?.value).toBe(31000);
    /* No field anywhere joins a conflict key to a figure. */
    expect(Object.keys(context).sort()).toEqual([
      'conflictFacts',
      'establishesConsequence',
      'humanitarianAssertions',
      'projectedAt',
      'relation',
      'relationBasis',
      'unknownDimensions',
    ]);
  });

  it('every humanitarian assertion traces to a record the workspace admitted', () => {
    const { workspace, context } = contextFor(
      [conflictDisplacementEvent(), displacedAssertion(DISPLACEMENT_KEY, 31000)],
      [conflictEvent('1', { countryIso3: 'SDN' })],
    );
    expect(() => assertNoImpactAttributedToConflict(context, workspace)).not.toThrow();
  });

  it('catches a figure that cites a conflict record', () => {
    const { workspace, context } = contextFor(
      [conflictDisplacementEvent(), displacedAssertion(DISPLACEMENT_KEY, 31000)],
      [conflictEvent('1', { countryIso3: 'SDN' })],
    );
    const conflictKey = context.conflictFacts[0]?.observationKey ?? '';
    const forged = {
      ...context,
      humanitarianAssertions: context.humanitarianAssertions.map((ref) => ({
        ...ref,
        records: [{ ...ref.records[0]!, observationKey: conflictKey }],
      })),
    };
    expect(() => assertNoImpactAttributedToConflict(forged, workspace)).toThrow(
      /IMPACT_FROM_CONFLICT|ASSERTION_NOT_ADMITTED/,
    );
  });

  it('a conflict-only context carries NO humanitarian figure at all', () => {
    const { context } = contextFor([floodEvent()], [conflictEvent('1', { countryIso3: 'SDN' })]);
    expect(context.humanitarianAssertions).toEqual([]);
    expect(context.relation).toBe('CO_OCCURRENCE_ONLY');
  });

  it('carries only FACTS on the conflict side: no figure, no narrative, no shape', () => {
    const { context } = contextFor([floodEvent()], [conflictEvent('1', { countryIso3: 'SDN' })]);
    const fact = context.conflictFacts[0]!;
    expect(Object.keys(fact).sort()).toEqual([
      'countryIso3',
      'eventStartedAt',
      'eventType',
      'observationKey',
      'owner',
      'spatialPrecision',
      'temporalProvenance',
      'upstreamAuthority',
    ]);
    const serialised = JSON.stringify(context);
    for (const forbidden of [
      'severity',
      'coordinates',
      'citation',
      'headline',
      'summary',
      'description',
    ]) {
      expect(serialised).not.toContain(forbidden);
    }
  });

  it('preserves the unknown dimensions rather than dropping them when crossing domains', () => {
    const { workspace, context } = contextFor(
      [floodEvent()],
      [conflictEvent('1', { countryIso3: 'SDN' })],
    );
    const empty = workspace.dimensions.filter((d) => d.state === 'EMPTY').map((d) => d.id);
    expect(context.unknownDimensions).toEqual(empty);
    expect(context.unknownDimensions).toContain('DISPLACEMENT');
  });
});

describe('HUM-XD · displacement is never inferred from conflict severity, structurally', () => {
  const moduleSource = readFileSync(join(__dirname, 'analysis-cross-domain.ts'), 'utf8');
  /** Comments stripped, so prose explaining the prohibition cannot satisfy it. */
  const code = moduleSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('never reads severity in any form', () => {
    for (const pattern of [/severity/i, /severityValueOrNull/, /severityIsDisplayable/]) {
      expect(code).not.toMatch(pattern);
    }
  });

  it('there is nothing to infer from: no severity derivation rule is accepted', () => {
    expect(ACCEPTED_SEVERITY_DERIVATION_RULES).toHaveLength(0);
    expect(SEVERITY_UNAVAILABLE_NO_RULE).toEqual({
      kind: 'UNAVAILABLE',
      reason: 'NO_ACCEPTED_DERIVATION_RULE',
    });
  });

  it('a conflict event alone leaves every impact dimension empty', () => {
    const { workspace, context } = contextFor(
      [floodEvent()],
      [conflictEvent('1', { countryIso3: 'SDN' }), conflictEvent('2', { countryIso3: 'SDN' })],
    );
    for (const id of [
      'REPORTED_IMPACT',
      'DISPLACEMENT',
      'ACCESS_CONSTRAINTS',
      'SECTOR_CLAIMS',
    ] as const) {
      const dimension = workspace.dimensions.find((d) => d.id === id)!;
      expect(dimension.state).toBe('EMPTY');
      expect(dimension.claims).toEqual([]);
    }
    expect(statedFigures(workspace)).toEqual([]);
    expect(context.humanitarianAssertions).toEqual([]);
  });

  it('contains no model, provider, fetch or prompt path', () => {
    for (const pattern of [
      /fetch\s*\(/,
      /analyzeNews/,
      /askV2Api/,
      /prompt/i,
      /openai|anthropic/i,
    ]) {
      expect(code).not.toMatch(pattern);
    }
  });

  it('refuses an overclaiming context even if one is constructed by hand', () => {
    const { context } = contextFor([floodEvent()], [conflictEvent('1', { countryIso3: 'SDN' })]);
    expect(() =>
      assertCrossDomainContextIsClosed({ ...context, establishesConsequence: true } as never),
    ).toThrow(CrossDomainRefused);
    expect(() =>
      assertCrossDomainContextIsClosed({ ...context, unknownDimensions: ['NOT_A_DIMENSION'] }),
    ).toThrow(/UNKNOWN_DIMENSION_FOREIGN/);
  });
});

describe('HUM-XD · the cross-domain projection is deterministic', () => {
  it('orders conflict facts by key and is stable across arrival order', () => {
    const a = conflictEvent('aaa', { countryIso3: 'SDN' });
    const b = conflictEvent('bbb', { countryIso3: 'SDN' });
    const forward = contextFor([floodEvent()], [a, b]).context;
    const reversed = contextFor([floodEvent()], [b, a]).context;
    expect(reversed).toEqual(forward);
  });

  it('carries the projection time it was given', () => {
    const { context } = contextFor([floodEvent()], []);
    expect(context.projectedAt).toBe(AT);
  });

  it('a humanitarian record scoped to no country joins nothing', () => {
    const { context } = contextFor([floodEvent([])], [conflictEvent('1', { countryIso3: 'SDN' })]);
    expect(context.relation).toBe('NONE');
  });

  it('the flood case is not upgraded merely because displacement figures exist', () => {
    const { context } = contextFor(
      [floodEvent(), displacedAssertion(FLOOD_KEY, 9000)],
      [conflictEvent('1', { countryIso3: 'SDN' })],
    );
    expect(context.relation).toBe('CO_OCCURRENCE_ONLY');
    expect(context.humanitarianAssertions).toHaveLength(1);
    expect(context.establishesConsequence).toBe(false);
  });
});
