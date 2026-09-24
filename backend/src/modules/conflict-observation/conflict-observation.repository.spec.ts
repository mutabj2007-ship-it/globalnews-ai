import { ConflictObservationRepository } from './conflict-observation.repository';
import { UCDP_CANDIDATE_CSV_HEADERS } from './ucdp-candidate-csv.normalizer';

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value;
}

function retainedBytes(): Buffer {
  const row: Record<string, string> = Object.fromEntries(
    UCDP_CANDIDATE_CSV_HEADERS.map((key) => [key, '']),
  );
  Object.assign(row, {
    id: '637360',
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

  return Buffer.from(
    UCDP_CANDIDATE_CSV_HEADERS.join(',') +
      '\r\n' +
      UCDP_CANDIDATE_CSV_HEADERS.map((key) => csvCell(row[key])).join(',') +
      '\r\n',
  );
}

function harness(overrides: Record<string, unknown> = {}) {
  const conflictRow = {
    observationKey: 'cfl:1:8:UCDP_GED:6:637360',
    authority: 'UCDP_GED',
    upstreamEventId: '637360',
    snapshotRetrievalId: 'candidate-test',
    snapshotAdmissibility: 'ADMITTED',
  };
  const capture = {
    retrievalId: 'candidate-test',
    providerId: 'UCDP_GED',
    admissibility: 'ADMITTED',
    completeness: 'COMPLETE',
    refusalKey: null,
    parserId: 'ucdp-candidate-csv',
    parserVersion: '1',
    mediaType: 'text/csv',
    contentAddress: 'a'.repeat(64),
    payload: {
      storageState: 'RETAINED',
      bytes: retainedBytes(),
      contentAddress: 'a'.repeat(64),
    },
  };

  const prisma = {
    conflictObservation: {
      findFirst: jest.fn().mockResolvedValue(
        Object.prototype.hasOwnProperty.call(overrides, 'conflictRow')
          ? overrides.conflictRow
          : conflictRow,
      ),
    },
    snapshotRetrieval: {
      findUnique: jest.fn().mockResolvedValue(
        Object.prototype.hasOwnProperty.call(overrides, 'capture')
          ? overrides.capture
          : capture,
      ),
    },
  };

  return {
    prisma,
    repository: new ConflictObservationRepository(prisma as any),
  };
}

describe('ConflictObservationRepository evidence detail', () => {
  it('reads supplementary source detail only from the admitted retained capture', async () => {
    const h = harness();
    await expect(
      h.repository.evidenceDetail('cfl:1:8:UCDP_GED:6:637360'),
    ).resolves.toMatchObject({
      authority: 'UCDP_GED',
      upstreamEventId: '637360',
      sourceParties: ['Government of Example', 'Example Armed Group'],
      whereDescription: 'Source described location',
      sourceHeadline: 'Source headline',
      snapshotRetrievalId: 'candidate-test',
      snapshotContentAddress: 'a'.repeat(64),
    });
    expect(h.prisma.snapshotRetrieval.findUnique).toHaveBeenCalledTimes(1);
  });

  it.each([
    null,
    { observationKey: 'x', authority: 'OTHER', upstreamEventId: '1', snapshotRetrievalId: 'r', snapshotAdmissibility: 'ADMITTED' },
    { observationKey: 'x', authority: 'UCDP_GED', upstreamEventId: '1', snapshotRetrievalId: null, snapshotAdmissibility: null },
  ])('refuses detail when the observation does not cite an admitted UCDP capture: %j', async (conflictRow) => {
    const h = harness({ conflictRow });
    await expect(h.repository.evidenceDetail('x')).resolves.toBeNull();
    expect(h.prisma.snapshotRetrieval.findUnique).not.toHaveBeenCalled();
  });

  it('refuses non-retained or non-admitted snapshot state', async () => {
    const h = harness({
      capture: {
        retrievalId: 'candidate-test',
        providerId: 'UCDP_GED',
        admissibility: 'REFUSED',
        completeness: 'COMPLETE',
        refusalKey: 'HOST_MISMATCH',
        parserId: 'ucdp-candidate-csv',
        parserVersion: '1',
        mediaType: 'text/csv',
        contentAddress: 'a'.repeat(64),
        payload: {
          storageState: 'RETAINED',
          bytes: retainedBytes(),
          contentAddress: 'a'.repeat(64),
        },
      },
    });
    await expect(h.repository.evidenceDetail('x')).resolves.toBeNull();
  });

  it('fails closed when supplementary retained bytes are malformed', async () => {
    const h = harness({
      capture: {
        retrievalId: 'candidate-test',
        providerId: 'UCDP_GED',
        admissibility: 'ADMITTED',
        completeness: 'COMPLETE',
        refusalKey: null,
        parserId: 'ucdp-candidate-csv',
        parserVersion: '1',
        mediaType: 'text/csv',
        contentAddress: 'a'.repeat(64),
        payload: {
          storageState: 'RETAINED',
          bytes: Buffer.from('bad,header\n1,2\n'),
          contentAddress: 'a'.repeat(64),
        },
      },
    });
    await expect(h.repository.evidenceDetail('x')).resolves.toBeNull();
  });
});
