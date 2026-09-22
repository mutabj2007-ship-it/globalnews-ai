import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readElection, readPolitics } from './retainedReaders';

// Data seam only. It is intentionally not imported by an accepted visual route.
describe('retained reader adapters pending visual-authority ruling', () => {
  afterEach(() => jest.restoreAllMocks());
  it.each(['en', 'pl'] as const)('preserves the disabled gate in %s', async locale => {
    const payload = { domain: 'ELECTION', state: 'COVERAGE_GAP', locale, records: [], reason: 'READER_DISABLED' };
    const fetcher = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(payload)));
    expect(await readElection(locale)).toEqual({ status: 'READ', data: payload });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0][0])).toContain('/election/evidence/ke?locale=' + locale);
    expect(fetcher.mock.calls[0][1]).toMatchObject({ cache: 'no-store', redirect: 'error' });
  });
  it('distinguishes the actual empty-ledger shape from transport failure', async () => {
    const payload = { observations: [], absence: 'NOT_ASSESSED', truncated: false, acquisition: 'RETAINED_ONLY',
      coverage: { checkedCaptures: 0, admittedObservations: 0, withheld: false } };
    const fetcher = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(payload)));
    expect(await readPolitics()).toEqual({ status: 'READ', data: payload });
    fetcher.mockRejectedValue(new Error('offline'));
    expect(await readPolitics()).toEqual({ status: 'UNAVAILABLE' });
  });
  it.each([null, {}, { acquisition: 'LIVE_NEWS', observations: [] }, { domain: 'ELECTION', state: 'EVIDENCE', records: [] }])('withholds malformed or ungoverned payload %j', async payload => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify(payload)));
    expect((await readPolitics()).status).toBe('UNAVAILABLE');
    expect((await readElection('en')).status).toBe('UNAVAILABLE');
  });
  it('does not turn HTTP failure into empty retention', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 503 }));
    expect((await readPolitics()).status).toBe('UNAVAILABLE');
  });
  it('preserves withheld/partial metadata without computing an assessment', async () => {
    const payload = { observations: [], absence: 'EVIDENCE_WITHHELD', truncated: true, acquisition: 'RETAINED_ONLY',
      coverage: { checkedCaptures: 1, admittedObservations: 0, withheld: true } };
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(payload)));
    expect(await readPolitics()).toEqual({ status: 'READ', data: payload });
  });
  it.each(['en', 'pl'] as const)('preserves the admitted declaration without promoting its state in %s', async locale => {
    const bundle = JSON.parse(readFileSync(resolve(__dirname, '../../../../backend/src/modules/election/data/6de1471074dc8162b038b949c0283fca029dea571a6ef6ee0564b89371cbe5fd.json'), 'utf8'));
    const raw = bundle.records[0];
    const label = locale === 'pl' ? 'OFICJALNE OGŁOSZENIE' : 'OFFICIAL DECLARATION';
    const record = { ...raw, label, qualifiedReading: label + ' · ' + raw.votesAsPublished };
    jest.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ domain: 'ELECTION', locale, state: 'EVIDENCE', records: [record] })));
    const result = await readElection(locale);
    expect(result.status).toBe('READ');
    if (result.status === 'READ') {
      expect(result.data.records[0].kind).toBe('OFFICIAL_DECLARATION');
      expect(result.data.records[0].election.eventId).toBe('ke-ol-kalou-mna-2026-07-16');
      expect(result.data.records[0]).not.toHaveProperty('reportedness');
      expect(result.data.records[0]).not.toHaveProperty('finality');
    }
    record.source.url = 'javascript:alert(1)';
    expect((await readElection(locale)).status).toBe('UNAVAILABLE');
  });
});
