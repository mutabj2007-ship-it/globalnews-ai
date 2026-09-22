import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EnergyRetainedSurface } from '@/components/energy/EnergyRetainedSurface';
import { readEnergyObservations } from './energyReadModel';
import { energyStrings } from './energyStrings';
import { ENERGY_DEFAULT_URL_STATE } from './energyUrl';
jest.mock('@/components/navigation/ReturnControl', () => ({ ReturnControl: () => null }));
afterEach(() => jest.restoreAllMocks());
it.each(['en', 'pl'] as const)(
  'renders one honest coverage explanation and three views in %s',
  (locale) => {
    const html = renderToStaticMarkup(
      createElement(EnergyRetainedSurface, {
        read: { kind: 'EMPTY', observations: [] },
        strings: energyStrings(locale),
        urlState: ENERGY_DEFAULT_URL_STATE,
        locale,
      }),
    );
    expect((html.match(/data-energy-coverage=/g) ?? []).length).toBe(1);
    expect((html.match(/aria-current="page"/g) ?? []).length).toBe(1);
    expect((html.match(/<a /g) ?? []).length).toBe(3);
    expect(html).not.toContain('data-energy-absence-legend');
    expect(html).not.toContain('<article');
    expect(html).toContain(locale === 'pl' ? 'pozostają niezmierzone' : 'remain unmeasured');
  },
);
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
