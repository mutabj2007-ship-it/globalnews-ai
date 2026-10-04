import { politicsScopeCountryIso3, politicsSearchRecord, type RetainedPoliticsObservation } from './retained';

const base = (provenance: Partial<RetainedPoliticsObservation['provenance']>): RetainedPoliticsObservation => ({
  observationKey: 'k', identity: { domainId: 'POLITICS', upstreamAuthority: 'a', upstreamId: 'u' },
  observationKind: 'LEGISLATIVE_STAGE', subjectType: 'LEGISLATIVE_SUBJECT', subjectId: 'bill',
  claim: { kind: 'LEGISLATIVE_STAGE', stage: 'PASSED', sourceText: 'The bill was passed.' },
  temporal: { publisherVintage: '2026-10-02T09:00:00Z', retrievedAt: '2026-10-02T12:00:00Z', temporalBasis: 'PUBLISHER_VINTAGE' },
  provenance: { sourceType: 'OFFICIAL_SOURCE', evidenceRole: 'PRIMARY_RECORD', jurisdiction: 'PL', language: 'pl', ...provenance },
  sourceReference: { sourceUrl: 'https://example.org/b' },
  attributeAuthorship: [], revision: { revisionOrdinal: 0, supersedesRevisionOrdinal: null, recordedAt: '2026-10-02T13:00:00Z' },
  publishedAt: '2026-10-02T09:00:00Z', artifactSha256: 'a'.repeat(64),
});

describe('Politics shared-searchable representation', () => {
  it('scopes a country only from a primary official record, via the shared registry', () => {
    expect(politicsScopeCountryIso3(base({}))).toBe('POL');
    expect(politicsScopeCountryIso3(base({ evidenceRole: 'REPORTING' }))).toBeNull();
    expect(politicsScopeCountryIso3(base({ sourceType: 'NEWS_PROVIDER' }))).toBeNull();
    expect(politicsScopeCountryIso3(base({ jurisdiction: 'EAC' }))).toBeNull();
    expect(politicsScopeCountryIso3(base({ jurisdiction: 'ZZ' }))).toBeNull();
    expect(politicsScopeCountryIso3(base({ jurisdiction: undefined }))).toBeNull();
  });

  it('effective time falls back to publication and says so; the quotation is never reader-renderable', () => {
    const r = politicsSearchRecord(base({}));
    expect(r.effectiveAt).toBe('2026-10-02T09:00:00Z');
    expect(r.temporalBasis).toBe('PUBLISHER_VINTAGE');
    expect(r.quotation).toEqual({ text: 'The bill was passed.', authorship: 'PUBLISHER_STATED', readerRenderable: false });
    expect(Object.keys(r).sort()).toEqual([
      'citation', 'countryIso3', 'domain', 'effectiveAt', 'eventKind', 'evidenceRole', 'language', 'publishedAt',
      'quotation', 'retrievalKey', 'retrievedAt', 'revisionOrdinal', 'sourceType', 'stage', 'subjectId', 'subjectType', 'temporalBasis',
    ]);
  });
});
