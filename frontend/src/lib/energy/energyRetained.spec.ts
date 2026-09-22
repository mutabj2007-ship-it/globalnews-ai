import { readEnergyObservations } from './energyReadModel';
afterEach(() => jest.restoreAllMocks());
it('distinguishes a failed read from empty evidence', async () => {
  const fetcher = jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false } as Response);
  expect((await readEnergyObservations()).kind).toBe('UNAVAILABLE');
  fetcher.mockResolvedValue({ ok: true, json: async () => [] } as Response);
  expect((await readEnergyObservations()).kind).toBe('EMPTY');
  expect(String(fetcher.mock.calls[0][0])).toMatch(/\/energy\/observations$/);
});
it('refuses malformed or generic news-shaped JSON', async () => {
  jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue({
      ok: true,
      json: async () => [{ title: 'Power news', value: 42 }],
    } as Response);
  expect((await readEnergyObservations()).kind).toBe('UNAVAILABLE');
});
