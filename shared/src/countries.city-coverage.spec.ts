/**
 * G-SEARCH-CITY-COVERAGE-GAP-1 — curated city coverage.
 *
 * Sits beside countries.ts, matching geo-fuzzy-resolver.spec.ts.
 *
 * WHAT THIS PINS. The curated table was, in effect, a CAPITALS table — 21 of
 * its 24 entries were capitals — and it had never been audited against the
 * priority programme. SIX of the nine East Africa priority countries had ZERO
 * curated cities, while Canberra, Ottawa and Pretoria were carried for
 * countries in no priority set at all. A story naming only the capital, which
 * is how national news from those countries is usually written, resolved to no
 * country and never entered country retrieval.
 */
import {
  resolveCountryByCity,
  resolveLocationContext,
  normalizeGeographicLookupKey,
  getCuratedCityNames,
} from './countries';

const expectCity = (input: string, iso3: string) =>
  expect(resolveCountryByCity(input)?.iso3).toBe(iso3);

describe('priority-country capitals that were missing entirely', () => {
  it.each([
    ['Kampala', 'UGA'],
    ['Kinshasa', 'COD'],
    ['Juba', 'SSD'],
    ['Mogadishu', 'SOM'],
  ])('%s resolves to %s', (city, iso3) => expectCity(city, iso3));

  it.each([
    ['Dodoma', 'TZA'],
    ['Dar es Salaam', 'TZA'],
    ['Gitega', 'BDI'],
    ['Bujumbura', 'BDI'],
  ])('%s resolves to %s — capital AND news centre are both curated', (city, iso3) =>
    expectCity(city, iso3),
  );

  it('every East Africa priority country now has at least one curated city', () => {
    const priority = ['KEN', 'UGA', 'TZA', 'RWA', 'BDI', 'COD', 'SSD', 'SOM', 'ETH'];
    const covered = new Set(
      getCuratedCityNames()
        .map((city) => resolveCountryByCity(city)?.iso3)
        .filter((iso3): iso3 is string => iso3 !== undefined),
    );

    expect(priority.filter((iso3) => !covered.has(iso3))).toEqual([]);
  });
});

describe('non-capital metropolises — the reported gap', () => {
  it.each([
    ['Marseille', 'FRA'],
    ['Lyon', 'FRA'],
    ['Toulouse', 'FRA'],
    ['Bordeaux', 'FRA'],
    ['Strasbourg', 'FRA'],
    ['Lille', 'FRA'],
    ['Nantes', 'FRA'],
    ['Cannes', 'FRA'],
    ['Mombasa', 'KEN'],
    ['Goma', 'COD'],
  ])('%s resolves to %s', (city, iso3) => expectCity(city, iso3));

  it('THE REPORTED FAILURE: a disaster titled only by city now resolves', () => {
    expect(resolveLocationContext('Marseille')?.country.iso3).toBe('FRA');
    expect(resolveLocationContext('Lyon')?.country.iso3).toBe('FRA');
  });
});

describe('Polish cities are curated in BOTH spellings, and that is not optional', () => {
  it('the lookup key preserves diacritics, so the two spellings are DIFFERENT keys', () => {
    expect(normalizeGeographicLookupKey('Kraków')).toBe('kraków');
    expect(normalizeGeographicLookupKey('Krakow')).toBe('krakow');
    expect(normalizeGeographicLookupKey('Kraków')).not.toBe(normalizeGeographicLookupKey('Krakow'));
  });

  it.each([
    ['Kraków', 'Krakow'],
    ['Gdańsk', 'Gdansk'],
    ['Wrocław', 'Wroclaw'],
    ['Poznań', 'Poznan'],
    ['Łódź', 'Lodz'],
  ])('%s and %s both resolve to Poland', (diacritic, ascii) => {
    expectCity(diacritic, 'POL');
    expectCity(ascii, 'POL');
  });

  it('Katowice resolves', () => expectCity('Katowice', 'POL'));
});

describe('FALSE-POSITIVE CONTROLS — names that must NOT be curated', () => {
  it.each([
    ['Nice', 'a common English adjective'],
    ['Mobile', 'a common English noun'],
    ['Reading', 'a common English gerund'],
    ['Split', 'a common English verb'],
    ['Bath', 'a common English noun'],
    ['Springfield', 'ambiguous across many countries'],
    ['Victoria', 'ambiguous across many countries'],
  ])('%s stays unresolved — %s', (name) => {
    expect(resolveCountryByCity(name)).toBeUndefined();
  });

  it('Hargeisa stays unresolved — its mapping is a political claim, not a fact', () => {
    // Capital of Somaliland, whose status is disputed. Mapping it to SOM or
    // anywhere else asserts a position this table must not take.
    expect(resolveCountryByCity('Hargeisa')).toBeUndefined();
  });

  it('Zanzibar stays unresolved — it is a region, not a city', () => {
    expect(resolveCountryByCity('Zanzibar')).toBeUndefined();
  });
});

describe('existing behaviour is unchanged', () => {
  it.each([
    ['Kigali', 'RWA'],
    ['Nairobi', 'KEN'],
    ['Paris', 'FRA'],
    ['Warsaw', 'POL'],
    ['Addis Ababa', 'ETH'],
    ['New Delhi', 'IND'],
  ])('%s still resolves to %s', (city, iso3) => expectCity(city, iso3));

  it('punctuation tolerance still applies to a new city', () => {
    expectCity('Marseille,', 'FRA');
    expectCity('  kinshasa  ', 'COD');
  });

  it('a country identifier still takes precedence over any city reading', () => {
    expect(resolveLocationContext('Georgia')?.country.iso3).toBe('GEO');
  });

  it('no fuzzy widening: a near-miss still resolves to nothing here', () => {
    // Typo correction lives in geo-fuzzy-resolver.ts and stays there.
    expect(resolveCountryByCity('Marseile')).toBeUndefined();
    expect(resolveCountryByCity('Kampalla')).toBeUndefined();
  });
});
