import {
  findCountryByIso2,
  findCountryByIso3,
  findCountryByNumeric,
  searchCountriesByName,
  ALL_ISO3_CODES,
} from '@globalnews-ai/shared';

describe('country lookup utilities', () => {
  describe('findCountryByIso3', () => {
    it('resolves a known code', () => {
      expect(findCountryByIso3('ESP')?.name).toBe('Spain');
    });

    it('is case-insensitive', () => {
      expect(findCountryByIso3('esp')?.name).toBe('Spain');
    });

    it('returns undefined for an unknown code', () => {
      expect(findCountryByIso3('ZZZ')).toBeUndefined();
    });

    it('tolerates surrounding whitespace', () => {
      expect(findCountryByIso3('  esp  ')?.name).toBe('Spain');
    });
  });

  describe('findCountryByIso2', () => {
    it('resolves a known alpha-2 code', () => {
      expect(findCountryByIso2('ES')?.iso3).toBe('ESP');
    });
  });

  describe('findCountryByNumeric', () => {
    it('resolves the ISO 3166-1 numeric code used by the map feature ids', () => {
      expect(findCountryByNumeric('724')?.iso3).toBe('ESP');
    });

    it('pads short numeric strings', () => {
      expect(findCountryByNumeric('36')?.iso3).toBe('AUS');
    });
  });

  describe('searchCountriesByName', () => {
    it('matches a partial, case-insensitive name', () => {
      const results = searchCountriesByName('spa');
      expect(results.some((c) => c.iso3 === 'ESP')).toBe(true);
    });

    it('does not require exact capitalization', () => {
      const results = searchCountriesByName('SPAIN');
      expect(results.some((c) => c.iso3 === 'ESP')).toBe(true);
    });

    it('returns an empty array for an empty query', () => {
      expect(searchCountriesByName('')).toEqual([]);
    });

    it('respects the limit parameter', () => {
      const results = searchCountriesByName('a', 3);
      expect(results.length).toBeLessThanOrEqual(3);
    });
  });

  describe('ALL_ISO3_CODES', () => {
    it('contains no duplicate codes', () => {
      expect(new Set(ALL_ISO3_CODES).size).toBe(ALL_ISO3_CODES.length);
    });

    it('every code is a real 3-letter uppercase string', () => {
      expect(ALL_ISO3_CODES.every((code) => /^[A-Z]{3}$/.test(code))).toBe(true);
    });
  });
});
