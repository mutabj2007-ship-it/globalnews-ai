import { createHash } from 'node:crypto';
import {
  inspectTedProcurementCapture,
  InvalidTedProcurementCapture,
  TED_MARKET_ALPHA_R1_ENDPOINT_ID,
  TED_MARKET_ALPHA_R1_FIELDS,
  TED_MARKET_ALPHA_R1_LIMIT,
  TED_MARKET_ALPHA_R1_PARSER_ID,
  TED_MARKET_ALPHA_R1_PARSER_VERSION,
  TED_MARKET_ALPHA_R1_QUERY,
  TED_MARKET_ALPHA_R1_REQUEST_PATH,
} from './ted-procurement-retained';
import { MarketReadRepository } from './market-read.repository';

function payload(over: Record<string, unknown> = {}): Buffer {
  return Buffer.from(JSON.stringify({
    totalNoticeCount: 1,
    timedOut: false,
    notices: [{
      'publication-number': '660238-2026',
      'publication-date': '2026-09-24+02:00',
      'notice-type': 'cn-standard',
      'notice-title': {
        eng: 'Poland - Refuse and waste related services - Waste management',
        pol: 'Polska - Usługi związane z odpadami - Zagospodarowanie odpadów',
      },
      'buyer-name': { pol: ['Miejski Zakład Oczyszczania w Pruszkowie sp. z o.o.'] },
      'buyer-country': ['POL'],
      'classification-cpv': ['90500000'],
      'deadline-receipt-tender-date-lot': ['2026-10-28+01:00'],
      'deadline-receipt-tender-time-lot': ['10:00:00+01:00'],
      links: {
        html: {
          ENG: 'https://ted.europa.eu/en/notice/-/detail/660238-2026',
          POL: 'https://ted.europa.eu/pl/notice/-/detail/660238-2026',
        },
      },
      ...over,
    }],
  }));
}

function capture(over: Record<string, unknown> = {}) {
  const bytes = (over.bytes as Buffer | undefined) ?? payload();
  const hash = createHash('sha256').update(bytes).digest('hex');
  return {
    retrievalId: 'ted-test',
    providerId: 'TED',
    endpointId: TED_MARKET_ALPHA_R1_ENDPOINT_ID,
    requestPath: TED_MARKET_ALPHA_R1_REQUEST_PATH,
    parameters: [
      { key: 'method', value: 'POST' },
      { key: 'query', value: TED_MARKET_ALPHA_R1_QUERY },
      { key: 'fields', value: JSON.stringify(TED_MARKET_ALPHA_R1_FIELDS) },
      { key: 'page', value: '1' },
      { key: 'limit', value: String(TED_MARKET_ALPHA_R1_LIMIT) },
      { key: 'scope', value: 'ALL' },
      { key: 'checkQuerySyntax', value: 'false' },
      { key: 'paginationMode', value: 'PAGE_NUMBER' },
      { key: 'onlyLatestVersions', value: 'true' },
    ],
    requestedAt: new Date('2026-09-24T10:00:00Z'),
    retrievedAt: new Date('2026-09-24T10:00:01Z'),
    httpStatus: 200,
    mediaType: 'application/json',
    byteLength: bytes.length,
    contentAddress: hash,
    completeness: 'COMPLETE',
    admissibility: 'ADMITTED',
    refusalKey: null,
    parserId: TED_MARKET_ALPHA_R1_PARSER_ID,
    parserVersion: TED_MARKET_ALPHA_R1_PARSER_VERSION,
    parsedAt: new Date('2026-09-24T10:00:02Z'),
    rightsGrade: 'E-5',
    rightsInstrumentRef: 'Commission Decision 2011/833/EU',
    payloadRetentionPermitted: true,
    payload: {
      bytes,
      storageState: 'RETAINED',
      byteLength: bytes.length,
      mediaType: 'application/json',
      contentAddress: hash,
    },
    ...over,
  };
}

describe('retained TED Market notice parser', () => {
  it('emits a source-backed procurement artifact without a numeric market observation', () => {
    const [notice] = inspectTedProcurementCapture(capture() as any);
    expect(notice).toMatchObject({
      artifactClass: 'PROCUREMENT_NOTICE',
      providerId: 'TED',
      portalReference: { portalId: 'TED', noticeId: '660238-2026' },
      buyerCountryIso3: 'POL',
      cpvCodes: ['90500000'],
      totalValue: null,
      currency: null,
      deadlineDate: '2026-10-28+01:00',
      deadlineTime: '10:00:00+01:00',
      freshnessBasis: 'RETAINED_ONLY',
    });
    expect(notice.title.en).toContain('Waste');
    expect(notice.title.pl).toContain('Zagospodarowanie');
    expect(notice.sourceUrl).toMatch(/^https:\/\/ted\.europa\.eu\//);
  });

  it('keeps a stated value only when the source also states one currency', () => {
    const [notice] = inspectTedProcurementCapture(capture({
      bytes: payload({ 'total-value': 4314672, 'total-value-cur': ['PLN'] }),
    }) as any);
    expect(notice.totalValue).toBe(4314672);
    expect(notice.currency).toBe('PLN');
  });

  it.each([
    { providerId: 'OTHER' },
    { admissibility: 'REFUSED' },
    { completeness: 'FAILED' },
    { parserId: 'other' },
    { rightsGrade: 'E-4' },
    { payloadRetentionPermitted: false },
  ])('refuses capture state %j', (over) => {
    expect(() => inspectTedProcurementCapture(capture(over) as any)).toThrow(
      InvalidTedProcurementCapture,
    );
  });

  it.each([
    { 'buyer-country': ['DEU'] },
    { 'notice-type': 'can-standard' },
    { 'publication-date': '2026-09-23+02:00' },
    { 'classification-cpv': ['bad'] },
  ])('refuses notice outside the bounded Alpha scope %j', (noticeOver) => {
    expect(() =>
      inspectTedProcurementCapture(capture({ bytes: payload(noticeOver) }) as any),
    ).toThrow(InvalidTedProcurementCapture);
  });

  it('refuses request-parameter drift and digest mismatch', () => {
    const drift = capture();
    drift.parameters = [...drift.parameters];
    drift.parameters[1] = { key: 'query', value: 'different' };
    expect(() => inspectTedProcurementCapture(drift as any)).toThrow('REQUEST_PARAMETERS_DRIFT');

    const badDigest = capture();
    badDigest.contentAddress = '0'.repeat(64);
    expect(() => inspectTedProcurementCapture(badDigest as any)).toThrow('CAPTURE_DIGEST_MISMATCH');
  });
});

describe('EAST AFRICA P0 · B — the real repository filters BEFORE the limit', () => {
  // Real parser, real repository; only Prisma is faked. 20 admitted POL notices (the governed
  // capture ceiling), newest first.
  const ids = Array.from({ length: 20 }, (_, i) => `${String(660200 + i)}-2026`);
  const many = Buffer.from(JSON.stringify({
    totalNoticeCount: ids.length,
    timedOut: false,
    notices: ids.map((id) => ({
      ...JSON.parse(payload().toString()).notices[0],
      'publication-number': id,
      links: { html: { ENG: `https://ted.europa.eu/en/notice/-/detail/${id}` } },
    })),
  }));
  const repo = (captures: unknown[]) =>
    new MarketReadRepository({
      snapshotRetrieval: { findMany: jest.fn(async () => captures) },
    } as never);

  it('a scope match outside the first N is still returned; held counts the whole capture', async () => {
    const r = repo([capture({ bytes: many })]);
    const target = ids[17];
    const out = await r.procurementMatching((n) => n.portalReference.noticeId === target, 1);
    expect(out.held).toBe(20);
    expect(out.notices.map((n) => n.portalReference.noticeId)).toEqual([target]);
    // The unfiltered dashboard read keeps its newest-first limit semantics.
    expect((await r.procurement(5)).map((n) => n.portalReference.noticeId)).toEqual(ids.slice(0, 5));
  });

  it('no admitted capture is held = 0 (NO_DATA), distinct from no match (NO_MATCH)', async () => {
    expect(await repo([]).procurementMatching(() => true)).toEqual({ held: 0, notices: [] });
    const none = await repo([capture({ bytes: many })]).procurementMatching(() => false);
    expect(none).toEqual({ held: 20, notices: [] });
  });
});
