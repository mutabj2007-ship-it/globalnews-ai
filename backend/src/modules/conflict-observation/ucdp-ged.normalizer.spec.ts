import { conflictEventKey, assertPrecisionNotInferredFromGeometry } from '@globalnews-ai/shared';
import { normalizeUcdpGed, type ReviewedUcdpCapture } from './ucdp-ged.normalizer';

// Synthetic rule fixtures only. Never installed in the reviewed capture registry or UI.
export const record = (over: Record<string, unknown> = {}) => ({
  id: 17,
  type_of_violence: 1,
  side_a: 'Synthetic organised group',
  latitude: 2,
  longitude: 45,
  where_prec: 1,
  date_prec: 1,
  date_start: '2026-03-14',
  date_end: '2026-03-14',
  source_article: 'Synthetic citation, 2026-03-15',
  ...over,
});
const profile: ReviewedUcdpCapture = {
  sha256: '0'.repeat(64),
  datasetVersion: 'test-only',
  envelope: 'array',
  schema: 'ucdp-ged-json-v1',
};
const context = {
  retrievalId: 'test-capture',
  runId: 'test-run',
  ingestedAt: '2026-09-22T00:00:00Z',
};
const normalize = (rows: unknown = [record()], over = {}) =>
  normalizeUcdpGed(Buffer.from(JSON.stringify(rows)), { ...profile, ...over }, context);

describe('reviewed UCDP subset, adapted to the release contract', () => {
  it('uses shared identity, unavailable severity and citation without fabricating a URL', () => {
    const [o] = normalize();
    expect(o.observationKey).toBe(conflictEventKey(o.identity));
    expect(o.severity).toEqual({ kind: 'UNAVAILABLE', reason: 'NO_ACCEPTED_DERIVATION_RULE' });
    expect(o.sourceReference).toEqual({ citation: 'Synthetic citation, 2026-03-15' });
    expect(o.actors).toEqual([{ kind: 'ACTOR_UNIDENTIFIED' }]);
    expect(o.geography.countryIso3).toBeUndefined();
    expect(o.revision).toMatchObject({ revisionOrdinal: 0, supersedesRevisionOrdinal: null });
  });
  it.each([1, 2, 3])('admits only GED organised-violence ownership (%s)', (type) => {
    expect(normalize([record({ type_of_violence: type })])[0].owner).toBe('CONFLICT');
  });
  it.each([
    { type_of_violence: 9 },
    { type_of_violence: '1' },
    { side_a: '' },
    { side_a: null },
    { side_a: 42 },
    { type_of_violence: undefined },
  ])('refuses ambiguous ownership %j', (over) => {
    expect(() => normalize([record(over)])).toThrow('OWNERSHIP_UNRESOLVED');
  });
  it.each([
    [1, 'EXACT'],
    [2, 'CITY'],
    [3, 'DISTRICT'],
    [4, 'PROVINCE'],
    [5, 'COUNTRY'],
    [6, 'UNKNOWN'],
    [7, 'UNKNOWN'],
  ])('preserves precision code %s as %s', (code, precision) => {
    const g = normalize([record({ where_prec: code })])[0].geography;
    expect(g.precision).toBe(precision);
    expect(g.coordinates).toEqual({ type: 'Point', coordinates: [45, 2] });
    expect(g.locationProvenance).toBe('STATED');
    expect(g.denotation).toBe(Number(code) >= 4 ? 'SOURCE_REPORTED_CENTROID' : 'EVENT_LOCATION');
    expect(() => assertPrecisionNotInferredFromGeometry(g)).not.toThrow();
  });
  it.each([
    { latitude: 91 },
    { longitude: -181 },
    { latitude: '2' },
    { latitude: null },
    { where_prec: 0 },
    { where_prec: undefined },
  ])('refuses unusable geography %j', (over) => {
    expect(() => normalize([record(over)])).toThrow('GEOGRAPHY_UNUSABLE');
  });
  it.each([
    { date_start: '2026-02-30' },
    { date_end: '2026-03-01' },
    { date_start: 'yesterday' },
    { date_start: '2026-3-14' },
  ])('refuses invalid dates %j', (over) => {
    expect(() => normalize([record(over)])).toThrow('DATE_UNUSABLE');
  });
  it.each([null, 4, {}, { Result: [] }, [null], [{ id: {} }]])(
    'refuses malformed or unsupported shape %j',
    (value) => {
      expect(() => normalize(value)).toThrow();
    },
  );
  it('refuses invalid JSON, UTF8, oversized capture, unknown schema and overlarge batches', () => {
    expect(() => normalizeUcdpGed(Buffer.from('{'), profile, context)).toThrow('MALFORMED_CAPTURE');
    expect(() => normalizeUcdpGed(Buffer.from([0xff]), profile, context)).toThrow(
      'MALFORMED_CAPTURE',
    );
    expect(() => normalizeUcdpGed(Buffer.alloc(1_048_577), profile, context)).toThrow(
      'CAPTURE_SIZE_REFUSED',
    );
    expect(() => normalize([], { schema: 'unknown' })).toThrow('UNSUPPORTED_SCHEMA');
    expect(() => normalize(Array.from({ length: 501 }, (_, id) => record({ id: id + 1 })))).toThrow(
      'RECORD_BOUND',
    );
  });
  it('supports only the explicitly reviewed envelope and preserves verbatim identity', () => {
    expect(
      normalize({ Result: [record({ id: '17 ' })] }, { envelope: 'results' })[0].identity
        .upstreamEventId,
    ).toBe('17 ');
    expect(normalize([])).toEqual([]);
    expect(() => normalize([record(), record()])).toThrow('DUPLICATE_EVENT_IN_CAPTURE');
    expect(normalize([record(), record({ id: 18 })])).toHaveLength(2);
  });
});
