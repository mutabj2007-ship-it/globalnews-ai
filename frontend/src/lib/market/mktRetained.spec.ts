import { isMarketReadObservation, readMarketObservations, deriveFreshness } from './mktReadModel';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MarketScreen } from '@/components/market/MarketScreen';
const observation = {
  observationKey: 'test-only',
  seriesId: 'test-series',
  periodId: '2026-08',
  value: 12,
  unit: 'EUR',
  publisherVintage: null,
  publisherChangedAt: '2026-09-01T00:00:00Z',
  vintageProvenance: 'PUBLISHER_CHANGED_AT' as const,
  releaseStatus: 'PRELIMINARY' as const,
  provider: 'EUROSTAT',
  sourceClass: 'STATISTICAL_RELEASE',
  retentionIsFinal: false,
  freshnessBasis: 'RETAINED_ONLY' as const,
};
afterEach(() => jest.restoreAllMocks());
it.each([
  null,
  {},
  { ...observation, unit: null },
  { ...observation, sourceClass: 'CORRIDOR' },
  { ...observation, provider: 'UNKNOWN' },
  { ...observation, value: Infinity },
  { ...observation, publisherChangedAt: 'bad' },
  { ...observation, retentionIsFinal: true },
])('rejects malformed public JSON %p', (o) => {
  expect(isMarketReadObservation(o)).toBe(false);
});
it('reads retained rows through the internal endpoint and binds the accepted dashboard', async () => {
  const fetcher = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue({ ok: true, json: async () => [null, observation] } as Response);
  const result = await readMarketObservations();
  expect(result).toEqual({ kind: 'OBSERVATIONS', observations: [observation] });
  expect(String(fetcher.mock.calls[0][0])).toMatch(/\/market\/observations$/);
  expect(deriveFreshness(observation).kind).toBe('STALE');
  const html = renderToStaticMarkup(createElement(MarketScreen, { locale: 'en', read: result }));
  expect(html).toContain('data-mkt="observation"');
  expect(html).toContain('STATISTICAL_RELEASE');
  expect(html).toContain('data-mkt-freshness="STALE"');
});
it('retains the honest empty state', async () => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => [] } as Response);
  expect(await readMarketObservations()).toEqual({
    kind: 'UNAVAILABLE',
    reason: 'NO_OBSERVATION_STORED',
  });
});
it('distinguishes a failed endpoint from a healthy empty database', async () => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false } as Response);
  expect(await readMarketObservations()).toEqual({
    kind: 'UNAVAILABLE',
    reason: 'NO_READ_ENDPOINT',
  });
});
it('withholds all-invalid payloads without crashing the dashboard', async () => {
  jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue({ ok: true, json: async () => [null, { unit: 4 }] } as Response);
  expect(await readMarketObservations()).toEqual({
    kind: 'UNAVAILABLE',
    reason: 'NO_DISPLAYABLE_OBSERVATION',
  });
});

it.each([undefined, null, '', 'UNKNOWN'])(
  'does not turn missing/unknown API status %p into FINAL',
  async (releaseStatus) => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({
        ok: true,
        json: async () => [{ ...observation, releaseStatus }],
      } as Response);
    expect(await readMarketObservations()).toEqual({
      kind: 'UNAVAILABLE',
      reason: 'NO_DISPLAYABLE_OBSERVATION',
    });
  },
);
it('renders the explicit preliminary state without displaying FINAL', async () => {
  jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue({ ok: true, json: async () => [observation] } as Response);
  const read = await readMarketObservations();
  const html = renderToStaticMarkup(createElement(MarketScreen, { locale: 'en', read }));
  expect(html).toContain('data-mkt-release="PRELIMINARY"');
  expect(html).not.toContain('data-mkt-release="FINAL"');
});

it('binds verified trade context inside the accepted card note and preserves the empty substrate', () => {
 const rich = { ...observation, context: { reporter: 'PL', partner: 'DE', product: '01', flow: '1', indicators: 'VALUE_IN_EUROS', freq: 'M' }, retainedAt: '2026-09-02T00:00:00Z', retrievalId: 'test-capture' };
 const html = renderToStaticMarkup(createElement(MarketScreen, { locale: 'en', read: { kind: 'OBSERVATIONS', observations: [rich] } }));
 expect(html).toContain('PL / DE');
 expect(html).toContain('Commodity:');
 expect(html).toContain('2026-09-02T00:00:00Z');
 const empty = renderToStaticMarkup(createElement(MarketScreen, { locale: 'en', read: { kind: 'UNAVAILABLE', reason: 'NO_OBSERVATION_STORED' } }));
 expect(empty).toContain('substrate-well');
 expect(empty).toContain('repeating-linear-gradient');
});

it('keeps an admitted null measurement explicit rather than dropping its record', async () => {
 jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => [{ ...observation, value: null }] } as Response);
 const result = await readMarketObservations();
 expect(result.kind).toBe('OBSERVATIONS');
 const html = renderToStaticMarkup(createElement(MarketScreen, { locale: 'en', read: result }));
 expect(html).toContain('data-mkt="observation"');
 expect(html).toContain('data-mkt-freshness="UNAVAILABLE"');
 expect(html).toContain('—');
});
