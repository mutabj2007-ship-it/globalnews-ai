import {
  isConflictRetainedEvidenceDetail,
  readConflictEvidenceDetail,
} from './evidenceDetail';

describe('Conflict retained evidence-detail client', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const payload = {
    observationKey: 'cfl:1:8:UCDP_GED:6:637360',
    authority: 'UCDP_GED',
    upstreamEventId: '637360',
    sourceParties: ['Government of Example', 'Example Armed Group'],
    whereDescription: 'Source place',
    sourceHeadline: 'Source headline',
    sourceOriginal: 'Example outlet',
    conflictName: 'Example conflict',
    dyadName: 'Government of Example - Example Armed Group',
    numberOfSources: 4,
    sourceCountryName: 'DR Congo (Zaire)',
    snapshotRetrievalId: 'candidate-test',
    snapshotContentAddress: 'a'.repeat(64),
  } as const;

  it('accepts only the retained evidence-detail shape', () => {
    expect(isConflictRetainedEvidenceDetail(payload)).toBe(true);
    expect(isConflictRetainedEvidenceDetail({ ...payload, authority: 'OTHER' })).toBe(false);
    expect(
      isConflictRetainedEvidenceDetail({ ...payload, snapshotContentAddress: 'not-a-digest' }),
    ).toBe(false);
    expect(isConflictRetainedEvidenceDetail({ ...payload, sourceParties: [42] })).toBe(false);
  });

  it('performs one same-origin retained read and no provider request', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(
      readConflictEvidenceDetail('cfl:1:8:UCDP_GED:6:637360'),
    ).resolves.toEqual(payload);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      '/conflict-data/observations/cfl%3A1%3A8%3AUCDP_GED%3A6%3A637360/evidence',
    );
    expect(init).toMatchObject({ cache: 'no-store' });
    expect(String(url)).not.toMatch(/^https?:\/\//);
  });

  it('fails closed on invalid or unavailable detail', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ nope: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    await expect(readConflictEvidenceDetail('x')).resolves.toBeNull();
  });
});
