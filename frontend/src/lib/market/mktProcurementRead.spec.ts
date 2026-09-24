import {
  isMarketProcurementNotice,
  procurementBuyerNames,
  procurementSourceHref,
  procurementTitle,
  type MarketProcurementReadResult,
} from './mktProcurementRead';

const notice = {
  procurementKey: 'mktproc:1:11:660332-2026',
  publicationNumber: '660332-2026',
  publicationDate: '2026-09-24+02:00',
  noticeType: 'can-standard',
  title: {
    en: 'English title',
    pl: 'Polski tytuł',
    fallback: 'English title',
    fallbackLanguage: 'eng',
  },
  buyerNames: {
    pl: ['Kupujący'],
    fallback: ['Kupujący'],
    fallbackLanguage: 'pol',
  },
  buyerCountries: ['POL'],
  cpvCodes: ['09300000'],
  totalValue: 4314672,
  totalValueCurrency: 'PLN',
  deadlineDates: ['2026-10-28+01:00'],
  deadlineTimes: ['10:00:00+01:00'],
  sourceLinks: {
    htmlEn: 'https://ted.europa.eu/en/notice/-/detail/660332-2026',
    htmlPl: 'https://ted.europa.eu/pl/notice/-/detail/660332-2026',
  },
  provider: 'TED',
  sourceClass: 'PROCUREMENT_NOTICE',
  retrievalId: 'ted-procurement:test',
  retainedAt: '2026-09-24T10:00:01.000Z',
  snapshotContentAddress: 'a'.repeat(64),
  freshnessBasis: 'RETAINED_ONLY',
} as const;

describe('Market procurement retained read model', () => {
  it('accepts the retained procurement contract and rejects semantic drift', () => {
    expect(isMarketProcurementNotice(notice)).toBe(true);
    expect(isMarketProcurementNotice({ ...notice, provider: 'OTHER' })).toBe(false);
    expect(isMarketProcurementNotice({ ...notice, totalValueCurrency: null })).toBe(false);
    expect(
      isMarketProcurementNotice({ ...notice, snapshotContentAddress: 'not-a-digest' }),
    ).toBe(false);
  });

  it('selects authored EN/PL source text without translating or inventing', () => {
    expect(procurementTitle(notice, 'en')).toBe('English title');
    expect(procurementTitle(notice, 'pl')).toBe('Polski tytuł');
    expect(procurementBuyerNames(notice, 'en')).toEqual(['Kupujący']);
    expect(procurementBuyerNames(notice, 'pl')).toEqual(['Kupujący']);
    expect(procurementSourceHref(notice, 'en')).toContain('/en/');
    expect(procurementSourceHref(notice, 'pl')).toContain('/pl/');
  });

  it('keeps the unavailable and retained result states distinct', () => {
    const available: MarketProcurementReadResult = { kind: 'PROCUREMENT', notices: [notice] };
    const unavailable: MarketProcurementReadResult = {
      kind: 'UNAVAILABLE',
      reason: 'NO_RETAINED_PROCUREMENT',
    };
    expect(available.kind).toBe('PROCUREMENT');
    expect(unavailable.kind).toBe('UNAVAILABLE');
  });
});
