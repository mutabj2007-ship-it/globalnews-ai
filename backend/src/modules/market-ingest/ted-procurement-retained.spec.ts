import { RIGHTS_RECORDS } from './market-acquisition-declarations';
import {
  inspectTedProcurementCapture,
  InvalidTedProcurementCapture,
  type TedProcurementRetainedCapture,
} from './ted-procurement-retained';
import { TED_PROCUREMENT_R1 } from './ted-procurement.reviewed';
import { createHash } from 'node:crypto';

function payload(over: Record<string, unknown> = {}): Buffer {
  return Buffer.from(
    JSON.stringify({
      totalNoticeCount: 1,
      timedOut: false,
      notices: [
        {
          'publication-number': '660332-2026',
          'publication-date': '2026-09-24+02:00',
          'notice-type': 'can-standard',
          'notice-title': {
            eng: 'Poland – Electricity – Supply of electricity',
            pol: 'Polska – Energia elektryczna – Dostawa energii elektrycznej',
          },
          'buyer-name': {
            pol: ['Państwowy Instytut Weterynaryjny'],
          },
          'buyer-country': ['POL'],
          'classification-cpv': ['09300000', '09300000'],
          'total-value': 4314672,
          'total-value-cur': ['PLN'],
          'deadline-receipt-tender-date-lot': ['2026-10-28+01:00'],
          'deadline-receipt-tender-time-lot': ['10:00:00+01:00'],
          links: {
            html: {
              ENG: 'https://ted.europa.eu/en/notice/-/detail/660332-2026',
              POL: 'https://ted.europa.eu/pl/notice/-/detail/660332-2026',
            },
            xml: { MUL: 'https://ted.europa.eu/en/notice/660332-2026/xml' },
          },
          ...over,
        },
      ],
    }),
  );
}

function capture(bytes = payload(), over: Partial<TedProcurementRetainedCapture> = {}): TedProcurementRetainedCapture {
  const hash = createHash('sha256').update(bytes).digest('hex');
  return {
    retrievalId: 'ted-procurement:test',
    providerId: 'TED',
    endpointId: TED_PROCUREMENT_R1.endpointId,
    requestPath: TED_PROCUREMENT_R1.requestPath,
    parameters: [
      { key: 'query', value: TED_PROCUREMENT_R1.query },
      { key: 'fields', value: JSON.stringify(TED_PROCUREMENT_R1.fields) },
      { key: 'page', value: String(TED_PROCUREMENT_R1.page) },
      { key: 'limit', value: String(TED_PROCUREMENT_R1.limit) },
      { key: 'scope', value: TED_PROCUREMENT_R1.scope },
      { key: 'checkQuerySyntax', value: 'false' },
      { key: 'paginationMode', value: TED_PROCUREMENT_R1.paginationMode },
      { key: 'onlyLatestVersions', value: String(TED_PROCUREMENT_R1.onlyLatestVersions) },
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
    parserId: TED_PROCUREMENT_R1.parserId,
    parserVersion: TED_PROCUREMENT_R1.parserVersion,
    rightsGrade: 'E-5',
    rightsInstrumentRef: RIGHTS_RECORDS.TED.instrument,
    payloadRetentionPermitted: true,
    payload: {
      bytes,
      storageState: 'RETAINED',
      byteLength: bytes.length,
      contentAddress: hash,
    },
    ...over,
  };
}

describe('retained TED procurement parser', () => {
  it('maps source-stated notice facts without score, ranking or inferred market movement', () => {
    const [notice] = inspectTedProcurementCapture(capture());
    expect(notice).toMatchObject({
      publicationNumber: '660332-2026',
      publicationDate: '2026-09-24+02:00',
      noticeType: 'can-standard',
      buyerCountries: ['POL'],
      cpvCodes: ['09300000'],
      totalValue: 4314672,
      totalValueCurrency: 'PLN',
      deadlineDates: ['2026-10-28+01:00'],
      deadlineTimes: ['10:00:00+01:00'],
      provider: 'TED',
      sourceClass: 'PROCUREMENT_NOTICE',
      freshnessBasis: 'RETAINED_ONLY',
    });
    expect(notice.title.en).toContain('Electricity');
    expect(notice.title.pl).toContain('Energia');
    expect(notice.buyerNames.pl).toEqual(['Państwowy Instytut Weterynaryjny']);
    expect(notice.sourceLinks.htmlEn).toContain('ted.europa.eu');
    expect(notice as any).not.toHaveProperty('score');
    expect(notice as any).not.toHaveProperty('rank');
    expect(notice as any).not.toHaveProperty('changeState');
  });

  it('shows no value unless value and one publisher currency are both present', () => {
    const [notice] = inspectTedProcurementCapture(
      capture(payload({ 'total-value-cur': [] })),
    );
    expect(notice.totalValue).toBeNull();
    expect(notice.totalValueCurrency).toBeNull();
  });

  it.each([
    { providerId: 'OTHER' },
    { admissibility: 'REFUSED' },
    { completeness: 'TRUNCATED' },
    { rightsGrade: 'E-4' },
    { rightsInstrumentRef: 'different' },
    { payloadRetentionPermitted: false },
    { parserVersion: '2' },
    { mediaType: 'text/html' },
    { parameters: [] },
  ] as readonly Partial<TedProcurementRetainedCapture>[])(
    'refuses capture-state drift %j',
    (over) => {
      expect(() => inspectTedProcurementCapture(capture(payload(), over))).toThrow(
        InvalidTedProcurementCapture,
      );
    },
  );

  it('refuses duplicate notice identity and non-TED links', () => {
    const bytes = Buffer.from(
      JSON.stringify({
        totalNoticeCount: 2,
        timedOut: false,
        notices: [
          JSON.parse(payload().toString()).notices[0],
          JSON.parse(payload().toString()).notices[0],
        ],
      }),
    );
    expect(() => inspectTedProcurementCapture(capture(bytes))).toThrow('DUPLICATE_NOTICE_IDENTITY');

    expect(() =>
      inspectTedProcurementCapture(
        capture(payload({ links: { html: { ENG: 'https://example.com/x' } } })),
      ),
    ).toThrow('SOURCE_LINK_MISSING');
  });
});
