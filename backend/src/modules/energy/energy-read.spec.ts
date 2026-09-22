import { createHash } from 'node:crypto';
import { inspectEnergyRow, EnergyReadRepository } from './energy-read.repository';
import type { PrismaService } from '../../database/prisma.service';
jest.mock('../../database/prisma.service', () => ({ PrismaService: class {} }));
// Synthetic test-only data. Never imported by the runtime or admitted to a database.
function row() {
  const fact = {
    subjectId: 'test-system',
    subjectName: 'Test system',
    subjectType: 'SYSTEM',
    geographyId: 'PL',
    spatialPrecision: 'COUNTRY',
    metric: 'GENERATION',
    period: '2026-08',
    value: 0,
    unit: 'MWh',
    releaseStatus: 'PRELIMINARY',
    publisherChangedAt: null,
    institution: 'Test authority',
  };
  const bytes = Buffer.from(JSON.stringify({ record: fact }));
  return {
    observationKey: 'test-key',
    revision: 1,
    admission: 'ADMITTED',
    publicDisclosureApproved: true,
    reviewedBy: 'test-reviewer',
    reviewRef: 'test-review',
    parserVersion: 'energy-record-v1',
    evidencePointer: '/record',
    payload: {
      ...fact,
      observationKey: 'test-key',
      retrievalId: 'test-capture',
      freshnessBasis: 'RETAINED_ONLY',
      provenance: {
        sourceType: 'PUBLIC_DATA',
        evidenceRole: 'REFERENCE_DATA',
        providerId: 'TEST',
        institution: fact.institution,
        retrievedAt: '2026-09-01T00:00:00.000Z',
      },
    },
    snapshotRetrieval: {
      retrievalId: 'test-capture',
      providerId: 'TEST',
      admissibility: 'ADMITTED',
      completeness: 'COMPLETE',
      httpStatus: 200,
      rightsGrade: 'E-5',
      rightsInstrumentRef: 'test-rights',
      payloadRetentionPermitted: true,
      requestedAt: new Date('2026-09-01'),
      retrievedAt: new Date('2026-09-01'),
      contentAddress: createHash('sha256').update(bytes).digest('hex'),
      payload: { storageState: 'RETAINED', bytes, byteLength: bytes.length },
    },
  };
}
it('reproduces zero as an observed value without deriving anything else', () => {
  const result = inspectEnergyRow(row());
  expect(result?.value).toBe(0);
  expect(result?.provenance.institution).toBe('Test authority');
  expect(result).not.toHaveProperty('geometry');
  expect(result).not.toHaveProperty('reviewedBy');
});
it.each([
  ['admission', (r: any): unknown => (r.admission = 'REFUSED')],
  ['disclosure', (r: any): unknown => (r.publicDisclosureApproved = false)],
  ['review', (r: any): unknown => (r.reviewRef = null)],
  ['parser', (r: any): unknown => (r.parserVersion = 'unreviewed')],
  ['digest', (r: any): unknown => (r.snapshotRetrieval.contentAddress = 'bad')],
  ['rights', (r: any): unknown => (r.snapshotRetrieval.rightsGrade = 'UNKNOWN')],
  ['capture', (r: any): unknown => (r.snapshotRetrieval.admissibility = 'REFUSED')],
  ['news', (r: any): unknown => (r.payload.provenance.sourceType = 'NEWS_PROVIDER')],
  ['authority', (r: any): unknown => (r.payload.provenance.institution = 'Other')],
  ['numeric', (r: any): unknown => (r.payload.value = 7)],
  ['unit', (r: any): unknown => (r.payload.unit = 'MW')],
  ['geography', (r: any): unknown => (r.payload.geographyId = 'DE')],
  ['null', (r: any): unknown => (r.payload.value = null)],
  ['pointer', (r: any): unknown => (r.evidencePointer = '/missing')],
] as const)('refuses %s mismatch', (_, mutate) => {
  const r = row();
  mutate(r);
  expect(inspectEnergyRow(r)).toBeNull();
});
it('does not resurrect an older value behind a refused revision', async () => {
  const newer = { ...row(), revision: 2, admission: 'REFUSED' };
  const db = { energyObservation: { findMany: jest.fn().mockResolvedValue([newer, row()]) } };
  expect(await new EnergyReadRepository(db as unknown as PrismaService).latest()).toEqual([]);
});
it('reads an empty store without provider calls', async () => {
  const fetcher = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('No external call'));
  try {
    const db = { energyObservation: { findMany: jest.fn().mockResolvedValue([]) } };
    expect(await new EnergyReadRepository(db as unknown as PrismaService).latest()).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  } finally {
    fetcher.mockRestore();
  }
});
