import { placeResearchHeld } from './ChoosePlace';

/**
 * CTO R25 — V-02 country research fails closed for the two Congos only, until the COD/COG-safe
 * backend is live on Alpha. Every other place keeps its research action.
 */
describe('R25 · Choose a place research action is held for COD / COG only', () => {
  it.each([
    ['COD', true],
    ['COG', true],
    ['KEN', false],
    ['RWA', false],
    ['POL', false],
    ['TON', false],
    ['BDI', false],
  ])('country %s → held %s', (iso3, held) => {
    expect(placeResearchHeld({ kind: 'country', iso3, name: iso3 } as never)).toBe(held);
  });

  it('a region is never held', () => {
    expect(placeResearchHeld({ kind: 'region', region: 'east-africa' } as never)).toBe(false);
  });
});
