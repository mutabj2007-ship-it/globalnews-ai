import { CountryNewsController } from './country-news.controller';
import type { CountryNewsResponse } from '@globalnews-ai/shared';

/**
 * Milestone #49 (World Map EN/PL integration). No spec existed for
 * this controller before this milestone. Mirrors the minimal,
 * dependency-free mock pattern already established for
 * news.controller.spec.ts in Milestone #48 Phase D.
 */
function makeService() {
  return {
    getCountryNews: jest.fn().mockResolvedValue({} as CountryNewsResponse),
  };
}

describe('CountryNewsController (Milestone #49 — language handoff)', () => {
  it('forwards lang=en to CountryNewsService.getCountryNews as the 5th argument', async () => {
    const service = makeService();
    const controller = new CountryNewsController(service as never);

    await controller.getCountryNews(
      { countryCode: 'RWA' } as never,
      { category: undefined, limit: 8, lang: 'en' } as never,
    );

    expect(service.getCountryNews).toHaveBeenCalledWith('RWA', undefined, 8, undefined, 'en');
  });

  it('forwards lang=pl the same way', async () => {
    const service = makeService();
    const controller = new CountryNewsController(service as never);

    await controller.getCountryNews(
      { countryCode: 'RWA' } as never,
      { category: undefined, limit: 8, lang: 'pl' } as never,
    );

    expect(service.getCountryNews).toHaveBeenCalledWith('RWA', undefined, 8, undefined, 'pl');
  });

  it('no lang in the query remains backward compatible — the service receives undefined, not a different call shape', async () => {
    const service = makeService();
    const controller = new CountryNewsController(service as never);

    await controller.getCountryNews({ countryCode: 'RWA' } as never, { category: undefined, limit: 8 } as never);

    expect(service.getCountryNews).toHaveBeenCalledWith('RWA', undefined, 8, undefined, undefined);
  });

  it('category and limit continue to forward unchanged alongside lang', async () => {
    const service = makeService();
    const controller = new CountryNewsController(service as never);

    await controller.getCountryNews(
      { countryCode: 'ESP' } as never,
      { category: 'business', limit: 12, lang: 'pl' } as never,
    );

    expect(service.getCountryNews).toHaveBeenCalledWith('ESP', 'business', 12, undefined, 'pl');
  });
});
