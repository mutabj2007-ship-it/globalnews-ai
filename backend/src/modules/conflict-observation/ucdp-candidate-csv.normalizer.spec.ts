import {
  assertPrecisionNotInferredFromGeometry,
  conflictEventKey,
} from '@globalnews-ai/shared';
import {
  extractUcdpCandidateEvidenceDetail,
  MAX_UCDP_CANDIDATE_CSV_BYTES,
  normalizeUcdpCandidateCsv,
  UCDP_CANDIDATE_CSV_HEADERS,
  type ReviewedUcdpCandidateCsvCapture,
} from './ucdp-candidate-csv.normalizer';

const profile: ReviewedUcdpCandidateCsvCapture = {
  sha256: '0'.repeat(64),
  datasetVersion: '26.0.8-test',
  sourceUrl: 'https://ucdp.uu.se/downloads/candidateged/test.csv',
  schema: 'ucdp-candidate-csv-v1',
};
const context = {
  retrievalId: 'candidate-test',
  runId: 'candidate-run',
  ingestedAt: '2026-09-24T12:00:00Z',
};

const base = (): Record<string, string> =>
  Object.fromEntries(UCDP_CANDIDATE_CSV_HEADERS.map((key) => [key, '']));

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value;
}

function capture(over: Record<string, string> = {}): Buffer {
  const row: Record<string, string> = {
    ...base(),
    id: '637360',
    type_of_violence: '3',
    side_a: 'Government of Afghanistan',
    side_b: 'Civilians',
    source_article: 'Source A,2026-08-10,"Quoted headline";Source B,2026-08-11,Other',
    source_office: 'Hasht e Subh Daily;Kabul Now',
    where_prec: '1',
    latitude: '34.349991',
    longitude: '62.200001',
    country: 'Afghanistan',
    date_prec: '1',
    date_start: '2026-08-10 00:00:00.000',
    date_end: '2026-08-10 00:00:00.000',
    ...over,
  };
  return Buffer.from(
    UCDP_CANDIDATE_CSV_HEADERS.join(',') +
      '\r\n' +
      UCDP_CANDIDATE_CSV_HEADERS.map((key) => csvCell(row[key])).join(',') +
      '\r\n',
  );
}

describe('UCDP Candidate CSV retained normalizer', () => {
  it('maps exact source event facts without narrative or severity inference', () => {
    const [o] = normalizeUcdpCandidateCsv(capture(), profile, context);
    expect(o.observationKey).toBe(conflictEventKey(o.identity));
    expect(o.identity).toEqual({ authority: 'UCDP_GED', upstreamEventId: '637360' });
    expect(o.owner).toBe('CONFLICT');
    expect(o.eventType).toBe('EVENT_TYPE_NOT_CLASSIFIED');
    expect(o.actors).toEqual([{ kind: 'ACTOR_UNIDENTIFIED' }]);
    expect(o.severity).toEqual({ kind: 'UNAVAILABLE', reason: 'NO_ACCEPTED_DERIVATION_RULE' });
    expect(o.temporal).toMatchObject({
      eventStartedAt: '2026-08-10',
      eventEndedAt: '2026-08-10',
      temporalProvenance: 'EVENT_DATED_BY_SOURCE',
    });
    expect(o.sourceReference.reportingOffice).toBe('Hasht e Subh Daily;Kabul Now');
    expect(o.sourceReference.citation).toContain('Source A,2026-08-10');
  });

  it('uses the canonical country registry as an explicit source-name normalization, never coordinates', () => {
    const [o] = normalizeUcdpCandidateCsv(capture({ country: 'DR Congo (Zaire)' }), profile, context);
    expect(o.geography).toMatchObject({
      countryIso3: 'COD',
      countryIso3Basis: 'SOURCE_COUNTRY_NAME_NORMALIZED',
      sourceCountryName: 'DR Congo (Zaire)',
      locationProvenance: 'STATED',
    });
    expect(() => assertPrecisionNotInferredFromGeometry(o.geography)).not.toThrow();

    const [unknown] = normalizeUcdpCandidateCsv(capture({ id: '637361', country: 'Unmapped Source Country' }), profile, context);
    expect(unknown.geography.countryIso3).toBeUndefined();
    expect(unknown.geography.countryIso3Basis).toBeUndefined();
  });

  it.each([
    ['1', 'EXACT', 'EVENT_LOCATION'],
    ['2', 'CITY', 'EVENT_LOCATION'],
    ['3', 'DISTRICT', 'EVENT_LOCATION'],
    ['4', 'PROVINCE', 'SOURCE_REPORTED_CENTROID'],
    ['5', 'COUNTRY', 'SOURCE_REPORTED_CENTROID'],
    ['6', 'UNKNOWN', 'SOURCE_REPORTED_CENTROID'],
    ['7', 'UNKNOWN', 'SOURCE_REPORTED_CENTROID'],
  ])('preserves where_prec %s as %s / %s', (code, precision, denotation) => {
    const [o] = normalizeUcdpCandidateCsv(capture({ where_prec: code }), profile, context);
    expect(o.geography.precision).toBe(precision);
    expect(o.geography.denotation).toBe(denotation);
  });

  it.each([
    { latitude: '91' },
    { longitude: '-181' },
    { where_prec: '0' },
    { where_prec: 'x' },
    { type_of_violence: '9' },
    { side_a: '' },
    { date_start: '2026-02-30 00:00:00.000' },
    { date_end: '2026-08-09 00:00:00.000' },
  ] as readonly Record<string, string>[])('refuses unusable event fields %j', (over) => {
    expect(() => normalizeUcdpCandidateCsv(capture(over), profile, context)).toThrow();
  });

  it('filters only by an explicit governed ISO3 allowlist after validating the whole retained row', () => {
    const scopedProfile: ReviewedUcdpCandidateCsvCapture = {
      ...profile,
      countryAllowlistIso3: ['COD'],
    };
    const afghanistan = normalizeUcdpCandidateCsv(capture(), scopedProfile, context);
    expect(afghanistan).toEqual([]);

    const congo = normalizeUcdpCandidateCsv(
      capture({ id: '637362', country: 'DR Congo (Zaire)' }),
      scopedProfile,
      context,
    );
    expect(congo).toHaveLength(1);
    expect(congo[0].geography.countryIso3).toBe('COD');
  });

  it('extracts retained evidence detail without upgrading actor kind or event classification', () => {
    const bytes = capture({
      side_a: 'Government of Example',
      side_b: 'Example Armed Group',
      where_description: 'Source described location',
      source_headline: 'Source headline',
      source_original: 'Example outlet',
      conflict_name: 'Example conflict',
      dyad_name: 'Government of Example - Example Armed Group',
      number_of_sources: '4',
      country: 'DR Congo (Zaire)',
    });

    expect(
      extractUcdpCandidateEvidenceDetail(bytes, {
        observationKey: 'cfl:1:8:UCDP_GED:6:637360',
        upstreamEventId: '637360',
        retrievalId: 'candidate-test',
        contentAddress: 'a'.repeat(64),
      }),
    ).toEqual({
      observationKey: 'cfl:1:8:UCDP_GED:6:637360',
      authority: 'UCDP_GED',
      upstreamEventId: '637360',
      sourceParties: ['Government of Example', 'Example Armed Group'],
      whereDescription: 'Source described location',
      sourceHeadline: 'Source headline',
      sourceOriginal: 'Example outlet',
      conflictName: 'Example conflict',
      dyadName: 'Government of Example - Example Armed Group',
      numberOfSources: 4,
      sourceCountryName: 'DR Congo (Zaire)',
      snapshotRetrievalId: 'candidate-test',
      snapshotContentAddress: 'a'.repeat(64),
    });
  });

  it('returns null when the selected upstream event is not present in the retained capture', () => {
    expect(
      extractUcdpCandidateEvidenceDetail(capture(), {
        observationKey: 'missing',
        upstreamEventId: '999999',
        retrievalId: 'candidate-test',
        contentAddress: 'b'.repeat(64),
      }),
    ).toBeNull();
  });

  it('pins the exact reviewed header and refuses schema drift', () => {
    const bytes = capture();
    const text = bytes.toString('utf8').replace(/^id,/, 'event_id,');
    expect(() => normalizeUcdpCandidateCsv(Buffer.from(text), profile, context)).toThrow(
      'SCHEMA_NOT_CONFIRMED_BY_CAPTURE',
    );
  });

  it('refuses unreviewed source origins, oversized bytes and duplicate event identity', () => {
    expect(() =>
      normalizeUcdpCandidateCsv(
        capture(),
        { ...profile, sourceUrl: 'https://example.com/test.csv' },
        context,
      ),
    ).toThrow('UNSUPPORTED_SOURCE');
    expect(() =>
      normalizeUcdpCandidateCsv(Buffer.alloc(MAX_UCDP_CANDIDATE_CSV_BYTES + 1), profile, context),
    ).toThrow('CAPTURE_SIZE_REFUSED');

    const first = capture().toString('utf8').trimEnd();
    const row = first.split(/\r?\n/)[1];
    expect(() =>
      normalizeUcdpCandidateCsv(Buffer.from(first + '\r\n' + row + '\r\n'), profile, context),
    ).toThrow('DUPLICATE_EVENT_IN_CAPTURE');
  });
});
