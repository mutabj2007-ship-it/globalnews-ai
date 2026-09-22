import { normalizeUcdpGed } from './ucdp-ged.normalizer';
import {
  validateConflictObservation,
  decodeRetainedConflictRow,
} from './conflict-observation.validation';
import { ConflictObservationRepository } from './conflict-observation.repository';
import type { PrismaService } from '../../database/prisma.service';

function valid(): any {
  return JSON.parse(
    JSON.stringify(
      normalizeUcdpGed(
        Buffer.from(
          JSON.stringify([
            {
              id: 1,
              type_of_violence: 1,
              side_a: 'Synthetic group',
              latitude: 2,
              longitude: 45,
              where_prec: 5,
              date_prec: 1,
              date_start: '2026-03-14',
              date_end: '2026-03-14',
            },
          ]),
        ),
        {
          sha256: '0'.repeat(64),
          datasetVersion: 'test',
          envelope: 'array',
          schema: 'ucdp-ged-json-v1',
        },
        { retrievalId: 'test', runId: 'test', ingestedAt: '2026-09-22T00:00:00Z' },
      )[0],
    ),
  );
}
function row(): any {
  const o = valid();
  return {
    ...o,
    authority: o.identity.authority,
    upstreamEventId: o.identity.upstreamEventId,
    revisionOrdinal: 0,
    snapshotRetrievalId: 'test',
    snapshotAdmissibility: 'ADMITTED',
    countryIso3: null,
    occurredOn: new Date(o.temporal.eventStartedAt),
    ingestedAt: new Date(o.temporal.ingestedAt),
  };
}

describe('stored Conflict JSON fails closed', () => {
  it('accepts NONE only without coordinates and never invents a point', () => {
    const o = valid();
    o.geography.geometryKind = 'NONE';
    delete o.geography.coordinates;
    expect(validateConflictObservation(o)).toBe(o);
    o.geography.coordinates = null;
    expect(() => validateConflictObservation(o)).toThrow();
  });
  it('preserves valid polygon geometry and refuses a non-closed ring', () => {
    const o = valid();
    o.geography = {
      ...o.geography,
      geometryKind: 'POLYGON',
      denotation: 'AFFECTED_AREA',
      coordinates: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [0, 1],
            [0, 0],
          ],
        ],
      },
    };
    expect(validateConflictObservation(o)).toBe(o);
    o.geography.coordinates.coordinates[0].pop();
    expect(() => validateConflictObservation(o)).toThrow();
  });
  it('preserves a source-reported centroid without changing axes or fabricating fields', () => {
    const o = valid();
    expect(validateConflictObservation(o)).toBe(o);
    expect(decodeRetainedConflictRow(row())).toEqual(o);
    expect(o.geography).toMatchObject({
      denotation: 'SOURCE_REPORTED_CENTROID',
      origin: 'SOURCE_NATIVE',
      precision: 'COUNTRY',
      locationProvenance: 'STATED',
    });
    expect(o.geography.countryIso3).toBeUndefined();
  });
  it.each([
    ['identity.authority', 'other'],
    ['identity.upstreamEventId', ''],
    ['observationKey', 'fake'],
    ['owner', 'OTHER'],
    ['eventType', 'OTHER'],
    ['actors', {}],
    ['actors.0.kind', 'PERSON'],
    ['actors.0.upstreamName', 5],
    ['geography.geometryKind', 'CIRCLE'],
    ['geography.coordinates', { type: 'Point', coordinates: [181, 0] }],
    ['geography.coordinates', [1]],
    ['geography.crs', 'EPSG:3857'],
    ['geography.precision', 'SUPER_EXACT'],
    ['geography.precision', 'EXACT'],
    ['geography.origin', 'DERIVED'],
    ['geography.locationProvenance', 'GUESS'],
    ['geography.denotation', 'AFFECTED_AREA'],
    ['geography.countryIso3', 'Somalia'],
    ['geography.partitionUnitLevel', null],
    ['temporal.eventStartedAt', '2026-02-30'],
    ['temporal.eventEndedAt', '2020-01-01'],
    ['temporal.ingestedAt', 'today'],
    ['temporal.temporalProvenance', 'INFERRED'],
    ['severity', { kind: 'GNAI_DERIVED', value: 'HIGH', ruleId: 'invented' }],
    ['severity.reason', 'unknown'],
    ['sourceReference.sourceUrl', 'citation, 2026'],
    ['acquisition.snapshotAdmissibility', null],
    ['acquisition.runId', ''],
    ['revision.revisionOrdinal', 1],
    ['revision.revisionOrdinal', 0.5],
    ['revision.supersedesRevisionOrdinal', 0],
    ['revision.recordedAt', 'invalid'],
    ['headline', 'unapproved narrative'],
  ])('rejects invalid %s', (path, value) => {
    const o = valid();
    const keys = (path as string).split('.');
    let target = o;
    for (const key of keys.slice(0, -1)) target = target[key];
    target[keys[keys.length - 1]] = value;
    expect(() => validateConflictObservation(o)).toThrow('INVALID_RETAINED_CONFLICT_OBSERVATION');
  });
  it.each(['geography', 'revision', 'acquisition', 'severity', 'temporal', 'sourceReference'])(
    'rejects missing or null %s',
    (key) => {
      const o = valid();
      delete o[key];
      expect(() => validateConflictObservation(o)).toThrow();
      o[key] = null;
      expect(() => validateConflictObservation(o)).toThrow();
    },
  );
  it('accepts valid revision and publisher severity without deriving them', () => {
    const o = valid();
    o.revision = {
      ...o.revision,
      revisionOrdinal: 1,
      supersedesRevisionOrdinal: 0,
      revisionKind: 'SOURCE_REVISION',
    };
    o.severity = {
      kind: 'PUBLISHER_STATED',
      value: 'LOW',
      publisherAuthority: 'UCDP_GED',
      publisherScaleRef: 'test-scale',
    };
    expect(validateConflictObservation(o)).toBe(o);
  });
  it.each([
    'revisionOrdinal',
    'snapshotRetrievalId',
    'snapshotAdmissibility',
    'occurredOn',
    'ingestedAt',
    'countryIso3',
  ])('rejects mismatched index/provenance %s', (key) => {
    const r = row();
    r[key] = null;
    if (key === 'countryIso3') r[key] = 'SOM';
    expect(() => decodeRetainedConflictRow(r)).toThrow();
  });
  it('rejects the entire read, never partial data or an empty success', async () => {
    const bad = row();
    bad.geography = {};
    const repo = new ConflictObservationRepository({
      $queryRaw: jest.fn().mockResolvedValue([row(), bad]),
    } as unknown as PrismaService);
    await expect(repo.latest()).rejects.toThrow('INVALID_RETAINED_CONFLICT_OBSERVATION');
  });
});
