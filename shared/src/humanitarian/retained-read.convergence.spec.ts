import { domainObservationKey } from '../observation/domain-observation';
import { ABSENCE_MUST_NOT_IMPLY, OBSERVATION_ABSENCE_STATES } from '../observation/absence';
import { projectHumanitarianWorkspace } from './analysis-workspace';
import { humanitarianIdentity, type HumanitarianObservation } from './observation';
import {
  HUMANITARIAN_READ_MAX_ROWS,
  HUMANITARIAN_RETAINED_READ_KINDS,
  HumanitarianReadRefused,
  humanitarianReadAbsence,
  humanitarianRetainedRead,
  parseHumanitarianRetainedRead,
  type HumanitarianRetainedRecord,
} from './retained-read';

/**
 * HUMANITARIAN DATA R1 CONVERGENCE — the retained-read success contract (CTO rulings):
 *   · RETAINED rows are Main's canonical HumanitarianObservation (no second record system);
 *   · NO_RETAINED_EVIDENCE is Humanitarian-specific, never an absence value, never an assessment;
 *   · only reader-admissible rows; no reader-facing geometry in R1 (C-3); a read is never thinned.
 */

const AT = '2026-10-01T00:00:00.000Z';

function observation(upstreamId: string, geometryRecordKey?: string): HumanitarianObservation {
  const identity = humanitarianIdentity('GDACS', upstreamId);
  return {
    observationKey: domainObservationKey(identity),
    identity,
    observationKind: 'HUMANITARIAN_EVENT',
    subjectType: 'SOURCE_EVENT',
    subjectId: upstreamId,
    claim: {
      claimType: 'HUMANITARIAN_EVENT',
      hazardType: 'FLOOD',
      sourceNativeType: 'FL',
      sourceTitle: `Flood ${upstreamId}`,
      eventStatus: 'ONGOING',
      countryIso3: ['RWA'],
      ...(geometryRecordKey === undefined ? {} : { geometryRecordKey }),
    },
    temporal: { publisherVintage: AT, retrievedAt: AT, temporalBasis: 'PUBLISHER_VINTAGE' },
    provenance: {
      sourceType: 'PUBLIC_DATA',
      providerId: 'GDACS',
      retrievedAt: AT,
      evidenceRole: 'PRIMARY_RECORD',
    },
    sourceReference: {},
    attributeAuthorship: [{ attribute: 'hazardType', authorship: 'PUBLISHER_STATED' }],
    revision: { revisionOrdinal: 0, supersedesRevisionOrdinal: null, recordedAt: AT },
  } as HumanitarianObservation;
}

const row = (id: string, geometryRecordKey?: string): HumanitarianRetainedRecord => ({
  captureKey: `capture-${id}`,
  publisherReleasedAt: AT,
  observation: observation(id, geometryRecordKey),
});
const admitAll = () => true;
const admitNone = () => false;

describe('three result states, and NO_RETAINED_EVIDENCE is not an absence', () => {
  it('the closed kind registry', () => {
    expect([...HUMANITARIAN_RETAINED_READ_KINDS]).toEqual([
      'UNAVAILABLE',
      'NO_RETAINED_EVIDENCE',
      'RETAINED',
    ]);
  });

  it('an empty store query is NO_RETAINED_EVIDENCE — never ASSESSED_NOTHING_QUALIFIED', () => {
    const read = humanitarianRetainedRead([], admitAll);
    expect(read).toEqual({ kind: 'NO_RETAINED_EVIDENCE', observations: [] });
    expect(read).not.toHaveProperty('absence');
    expect(JSON.stringify(read)).not.toContain('ASSESSED_NOTHING_QUALIFIED');
  });

  it('the global seven-state absence authority is untouched (Security/Energy undisturbed)', () => {
    expect(OBSERVATION_ABSENCE_STATES).toHaveLength(7);
    expect(OBSERVATION_ABSENCE_STATES as readonly string[]).not.toContain('NO_RETAINED_EVIDENCE');
  });

  it('the lossy reader projection is preserved for source topology and withholding', () => {
    for (const state of [
      'SOURCE_NOT_CONNECTED',
      'SOURCE_TEMPORARILY_UNAVAILABLE',
      'EVIDENCE_WITHHELD',
    ] as const) {
      expect(humanitarianReadAbsence(state)).toEqual({
        kind: 'UNAVAILABLE',
        absence: 'COVERAGE_GAP',
        observations: [],
      });
    }
  });

  it('the state names carry no reassurance', () => {
    for (const kind of HUMANITARIAN_RETAINED_READ_KINDS) {
      for (const word of ABSENCE_MUST_NOT_IMPLY) expect(kind.toLowerCase()).not.toContain(word);
    }
  });
});

describe('RETAINED: Main records, reader-admissible only, never thinned', () => {
  it('admits well-formed, reader-admissible Main observations', () => {
    const read = humanitarianRetainedRead([row('1'), row('2')], admitAll);
    expect(read.kind).toBe('RETAINED');
    expect(read.observations).toHaveLength(2);
  });

  it('HUM-READ-5: one non-admissible record refuses the whole read (no silent thinning)', () => {
    let calls = 0;
    const onlyFirst = () => ++calls === 1;
    expect(() => humanitarianRetainedRead([row('1'), row('2')], onlyFirst)).toThrow(/HUM-READ-5/);
    expect(() => humanitarianRetainedRead([row('1')], admitNone)).toThrow(HumanitarianReadRefused);
  });

  it('HUM-READ-4 (C-3): a row referencing governed geometry never reaches a reader in R1', () => {
    expect(() => humanitarianRetainedRead([row('1', 'geom:copernicus:EMSR1')], admitAll)).toThrow(
      /HUM-READ-4/,
    );
  });

  it('a hand-written key that disagrees with its identity is refused (Main identity spine)', () => {
    const bad = row('1');
    const forged = { ...bad, observation: { ...bad.observation, observationKey: 'obs:forged' } };
    expect(() => humanitarianRetainedRead([forged], admitAll)).toThrow();
  });

  it('HUM-READ-1: rows carry exactly the pointer + observation, nothing smuggled', () => {
    const smuggled = { ...row('1'), coordinates: [1, 2] } as unknown as HumanitarianRetainedRecord;
    expect(() => humanitarianRetainedRead([smuggled], admitAll)).toThrow(/HUM-READ-1/);
  });

  it("H's analysis workspace consumes the RETAINED rows directly (one record authority)", () => {
    const read = humanitarianRetainedRead([row('1')], admitAll);
    const workspace = projectHumanitarianWorkspace(read.observations, AT);
    expect(workspace.records).toHaveLength(1);
  });
});

describe('parsing an untrusted payload fails closed', () => {
  it('round-trips the three valid shapes', () => {
    const shapes = [
      humanitarianReadAbsence('NOT_ASSESSED'),
      humanitarianRetainedRead([], admitAll),
      humanitarianRetainedRead([row('1')], admitAll),
    ];
    for (const shape of shapes) {
      expect(parseHumanitarianRetainedRead(JSON.parse(JSON.stringify(shape)))).toEqual(
        JSON.parse(JSON.stringify(shape)),
      );
    }
  });

  it.each([
    { kind: 'NO_RETAINED_EVIDENCE', observations: [row('1')] },
    { kind: 'NO_RETAINED_EVIDENCE', observations: [], absence: 'NOT_ASSESSED' },
    { kind: 'RETAINED', observations: [] },
    { kind: 'RETAINED', observations: [{ incident: 'fixture' }] },
    { kind: 'RETAINED', observations: [row('1', 'geom:x')] },
    { kind: 'RETAINED', observations: [row('1')], absence: 'COVERAGE_GAP' },
    { kind: 'ASSESSED', observations: [] },
  ])('refuses %j', (payload) => {
    expect(parseHumanitarianRetainedRead(JSON.parse(JSON.stringify(payload)))).toBeNull();
  });

  it('bounds the row count', () => {
    const many = Array.from({ length: HUMANITARIAN_READ_MAX_ROWS + 1 }, (_, i) => row(String(i)));
    expect(parseHumanitarianRetainedRead({ kind: 'RETAINED', observations: many })).toBeNull();
  });
});
