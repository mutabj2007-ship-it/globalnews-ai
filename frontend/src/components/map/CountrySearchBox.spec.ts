import { searchCountries } from './CountrySearchBox';

/**
 * Milestone #49 Phase D — searchCountries() merges the existing,
 * UNMODIFIED shared searchCountriesByName() (canonical name/code/alias
 * matching) with a supplementary localized-name check, so Polish-mode
 * search recognizes "Polska" in addition to "Poland", while English
 * search behavior is completely untouched.
 */
describe('searchCountries (Milestone #49 Phase D)', () => {
  describe('English search compatibility (unchanged)', () => {
    it('"Poland" resolves POL', () => {
      const results = searchCountries('Poland', 'en', 8);
      expect(results.some((c) => c.iso3 === 'POL')).toBe(true);
    });

    it('"Spain" resolves ESP', () => {
      const results = searchCountries('Spain', 'en', 8);
      expect(results.some((c) => c.iso3 === 'ESP')).toBe(true);
    });
  });

  describe('Polish search recognizes localized names', () => {
    it('"Polska" resolves POL', () => {
      const results = searchCountries('Polska', 'pl', 8);
      expect(results.some((c) => c.iso3 === 'POL')).toBe(true);
    });

    it('"Niemcy" resolves DEU', () => {
      const results = searchCountries('Niemcy', 'pl', 8);
      expect(results.some((c) => c.iso3 === 'DEU')).toBe(true);
    });

    it('"Hiszpania" resolves ESP', () => {
      const results = searchCountries('Hiszpania', 'pl', 8);
      expect(results.some((c) => c.iso3 === 'ESP')).toBe(true);
    });
  });

  describe('Polish search ALSO preserves canonical English compatibility', () => {
    it('"Poland" still resolves POL while Polish UI is active', () => {
      const results = searchCountries('Poland', 'pl', 8);
      expect(results.some((c) => c.iso3 === 'POL')).toBe(true);
    });
  });

  it('merged results contain no duplicate countries when both canonical and localized names match', () => {
    const results = searchCountries('pol', 'pl', 8);
    const iso3List = results.map((c) => c.iso3);
    expect(new Set(iso3List).size).toBe(iso3List.length);
  });
});
