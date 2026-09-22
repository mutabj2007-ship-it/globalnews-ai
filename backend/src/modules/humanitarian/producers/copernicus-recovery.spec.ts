import {
  produceInundationExtents, CopernicusPayloadRefused,
  type EmsDelineationPayload, type EmsDelineationFeature,
} from './copernicus-ems.producer';

const feature: EmsDelineationFeature = {
  activationCode:'EMSR999', productId:'DEL-01', featureId:'F1', geometryType:'Polygon',
  crs:'EPSG:4326', coordinates:[[[1,1],[2,1],[2,2],[1,1]]],
};

describe('Copernicus R1.2 recovery boundary', () => {
  const keyFor = jest.fn(({sourceGeometryId}: {sourceGeometryId:string}) => ({
    recordKey: sourceGeometryId, presentationPartitionKey:'synthetic-test-partition',
  }));
  beforeEach(() => keyFor.mockClear());
  it.each([null, {}, {features:null}, {features:[null]}, {features:[{...feature,activationCode:''}]},
    {features:[{...feature,featureId:'a/b'}]}, {features:[{...feature,featureId:' F1'}]},
    {features:[{...feature,geometryType:42}]},
  ])('refuses malformed source envelopes before authority keying: %j', payload => {
    expect(() => produceInundationExtents(payload as EmsDelineationPayload, {keyFor})).toThrow(CopernicusPayloadRefused);
    expect(keyFor).not.toHaveBeenCalled();
  });
  it('refuses duplicate/conflicting revisions before emitting any batch member', () => {
    for (const next of [feature, {...feature, coordinates:[[[3,3],[4,3],[4,4],[3,3]]]}]) {
      expect(() => produceInundationExtents({features:[feature,next]}, {keyFor})).toThrow(/revision reconciliation/);
      expect(keyFor).not.toHaveBeenCalled();
    }
  });
  it('replays the same source identity without minting an unrelated identity', () => {
    const first = produceInundationExtents({features:[feature]}, {keyFor});
    const next = produceInundationExtents({features:[{...feature,coordinates:[[[3,3],[4,3],[4,4],[3,3]]]}]}, {keyFor});
    expect(next.emitted[0]?.recordKey).toBe(first.emitted[0]?.recordKey);
    // These are geometries, not revisioned observations; no wall-clock chronology is invented.
    expect(JSON.stringify(first)).not.toMatch(/occurredAt|publisherVintage|retrievedAt|recordedAt|revisionOrdinal/);
    expect(first.emitted[0]?.geometry.origin).toBe('SOURCE_NATIVE');
  });
});