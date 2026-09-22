import { makeNisrCpiDecoder } from '@globalnews-ai/shared';
import { PrismaService } from '../../../database/prisma.service';
import { PostgresOfficialDataSnapshotStore } from '../official-data-snapshot.store';
import { RetainedNisrCpiReader, retainedNisrSourceUrl } from './nisr-cpi-retained.reader';
import { NISR_CPI_EXTRACTOR_ID, NISR_CPI_EXTRACTOR_VERSION } from './nisr-cpi-pdf.extractor';
import { nisrCpiEditionOrderFor } from '../../economy/producers/nisr-cpi-economy.normalizer';

jest.mock('@globalnews-ai/shared', () => ({
  ...jest.requireActual('@globalnews-ai/shared'), makeNisrCpiDecoder: jest.fn(),
}));
jest.mock('../official-data-snapshot.store');

// Synthetic control data tests the read boundary; it is never evidence of a real capture.
const address = 'a'.repeat(64);
const row = {
  retrievalId: 'admitted', contentAddress: address, retrievedAt: new Date('2026-09-20T00:00:00Z'),
  extractorId: NISR_CPI_EXTRACTOR_ID, extractorVersion: NISR_CPI_EXTRACTOR_VERSION,
  publisherReleasedAt: new Date('2026-09-10T00:00:00Z'),
  parserId: 'nisr.cpi.pdf', parserVersion: '1.0.0', referencePeriod: '2026-08', sourceLanguage: 'en',
};
const retrieval = {
  retrievalId: row.retrievalId, contentAddress: address,
  request: { providerId: 'rw-nisr', endpointId: 'cpi-monthly-en', requestPath: '/sites/default/files/retained-test.pdf' },
};

describe('retained NISR read boundary', () => {
  const open = jest.fn();
  const retrievalsFor = jest.fn();
  const decode = jest.fn();
  const findFirst = jest.fn();
  const findMany = jest.fn();
  const reader = new RetainedNisrCpiReader({ snapshotRetrieval: { findFirst, findMany } } as unknown as PrismaService);
  const read = () => reader.read('rw-nisr', 'cpi-monthly-en');
  beforeEach(() => {
    jest.clearAllMocks();
    (PostgresOfficialDataSnapshotStore as jest.Mock).mockImplementation(() => ({ open, retrievalsFor }));
    (makeNisrCpiDecoder as jest.Mock).mockReturnValue(decode);
    findFirst.mockResolvedValue({ ...row });
    findMany.mockResolvedValue([{ contentAddress: address }]);
    open.mockResolvedValue({ bytes: new Uint8Array([1]) });
    retrievalsFor.mockResolvedValue([retrieval]);
    decode.mockReturnValue({ ok: true, value: { referencePeriod: '2026-08', sourceLanguage: 'en', publicationDate: '2026-09-10' } });
  });
  it('opens retained bytes and attributes the selected admission, not the last same-byte retrieval', async () => {
    retrievalsFor.mockResolvedValue([retrieval, { ...retrieval, retrievalId: 'unrelated', request: { providerId: 'other', endpointId: 'other' } }]);
    const result = await read();
    expect(result.kind).toBe('RETAINED');
    if (result.kind === 'RETAINED') {
      expect(result.retrieval).toBe(retrieval);
      expect(result.sourceUrl).toBe('https://statistics.gov.rw/sites/default/files/retained-test.pdf');
    }
    expect(open).toHaveBeenCalledWith(address);
    expect(decode).toHaveBeenCalledWith(new Uint8Array([1]));
  });
  it('refuses missing captures', async () => {
    findFirst.mockResolvedValue(null);
    expect(await read()).toEqual({ kind: 'NONE', refusal: 'NO_ADMITTED_CAPTURE' });
    expect(open).not.toHaveBeenCalled();
  });
  it('refuses missing bytes', async () => {
    open.mockResolvedValue(null);
    expect(await read()).toEqual({ kind: 'NONE', refusal: 'PAYLOAD_NOT_RETAINED' });
    expect(decode).not.toHaveBeenCalled();
  });
  it.each([{ extractorId: 'other' }, { extractorVersion: '2' }])('refuses extractor mismatch %j', async (patch) => {
    findFirst.mockResolvedValue({ ...row, ...patch });
    expect(await read()).toEqual({ kind: 'NONE', refusal: 'EXTRACTOR_IDENTITY_MISMATCH' });
    expect(open).not.toHaveBeenCalled();
  });
  it('refuses parse failure', async () => {
    decode.mockReturnValue({ ok: false });
    expect(await read()).toEqual({ kind: 'NONE', refusal: 'PARSE_FAILED' });
  });
  it.each([[], [{ ...retrieval, retrievalId: 'other' }], [{ ...retrieval, request: { providerId: 'other', endpointId: 'cpi-monthly-en' } }]])('requires the exact retrieval lineage %j', async (...entries) => {
    retrievalsFor.mockResolvedValue(entries);
    expect(await read()).toEqual({ kind: 'NONE', refusal: 'NO_RETRIEVAL_LINEAGE' });
  });
  it.each([{ parserId: 'other' }, { parserVersion: '2' }, { referencePeriod: '2026-07' }, { sourceLanguage: 'pl' }, { publisherReleasedAt: new Date('2026-09-11T00:00:00Z') }])('refuses inconsistent persisted lineage %j', async (patch) => {
    findFirst.mockResolvedValue({ ...row, ...patch });
    expect(await read()).toEqual({ kind: 'NONE', refusal: 'LINEAGE_MISMATCH' });
  });
  it('does not promote a repeated conflicting payload into a revision', async () => {
    findMany.mockResolvedValue([{ contentAddress: 'b'.repeat(64) }, { contentAddress: address }, { contentAddress: address }]);
    const result = await read();
    expect(result.kind).toBe('RETAINED');
    if (result.kind === 'RETAINED') expect(nisrCpiEditionOrderFor(result.priorContentAddresses, result.contentAddress)).toBe('AMBIGUOUS');
    expect(findMany.mock.calls[0][0].where).toMatchObject({ providerId: 'rw-nisr', endpointId: 'cpi-monthly-en', admissibility: 'ADMITTED', OR: [{ referencePeriod: '2026-08' }, { referencePeriod: null }] });
  });
});


describe('retained document citations', () => {
  it('uses the governed origin and refuses alternate hosts and malformed paths', () => {
    expect(retainedNisrSourceUrl('/sites/default/files/report.pdf')).toBe('https://statistics.gov.rw/sites/default/files/report.pdf');
    for (const path of [undefined, '//example.com/report.pdf', '/\\example.com/report.pdf', 'https://example.com', 'report.pdf']) {
      expect(retainedNisrSourceUrl(path)).toBeUndefined();
    }
  });
});
