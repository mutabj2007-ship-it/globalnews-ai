import {
  findCountryByIso2,
  findCountryByIso3,
  findCountryByNumeric,
  searchCountriesByName,
  resolveCountryByCity,
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

  describe('resolveCountryByCity', () => {
    it('resolves a curated capital city to its country', () => {
      expect(resolveCountryByCity('Kigali')?.iso3).toBe('RWA');
    });

    it('is case-insensitive', () => {
      expect(resolveCountryByCity('kigali')?.iso3).toBe('RWA');
      expect(resolveCountryByCity('KIGALI')?.iso3).toBe('RWA');
    });

    it('tolerates surrounding whitespace', () => {
      expect(resolveCountryByCity('  Nairobi  ')?.iso3).toBe('KEN');
    });

    it('resolves each curated city from the initial seed set', () => {
      const expected: Record<string, string> = {
        Kigali: 'RWA',
        Nairobi: 'KEN',
        Warsaw: 'POL',
        Madrid: 'ESP',
        London: 'GBR',
        Paris: 'FRA',
        Washington: 'USA',
        Kyiv: 'UKR',
        Beijing: 'CHN',
        Tokyo: 'JPN',
        Ottawa: 'CAN',
        Canberra: 'AUS',
        Brussels: 'BEL',
        Berlin: 'DEU',
        Rome: 'ITA',
        Moscow: 'RUS',
        Pretoria: 'ZAF',
        Cairo: 'EGY',
        Lagos: 'NGA',
      };

      for (const [city, iso3] of Object.entries(expected)) {
        expect(resolveCountryByCity(city)?.iso3).toBe(iso3);
      }

      expect(resolveCountryByCity('New Delhi')?.iso3).toBe('IND');
      expect(resolveCountryByCity('Addis Ababa')?.iso3).toBe('ETH');
    });

    it('returns undefined for a city that is not curated', () => {
      expect(resolveCountryByCity('Anytown')).toBeUndefined();
    });

    it('returns undefined for an empty string', () => {
      expect(resolveCountryByCity('')).toBeUndefined();
    });

    it('does not do partial/fuzzy matching', () => {
      expect(resolveCountryByCity('Kigal')).toBeUndefined();
      expect(resolveCountryByCity('Kigali, Rwanda')).toBeUndefined();
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
