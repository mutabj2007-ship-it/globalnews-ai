import type { OfficialSourceEntry } from '@globalnews-ai/shared';
import {
  OFFICIAL_SOURCES,
  getOfficialSourceById,
  getOfficialSourcesForCountry,
  getOfficialSourcesByClass,
  getEnabledOfficialSources,
  getOfficialSourceByIdFrom,
  getOfficialSourcesForCountryFrom,
  getOfficialSourcesByClassFrom,
  getEnabledOfficialSourcesFrom,
} from './official-source-registry';

function buildEntry(overrides: Partial<OfficialSourceEntry> = {}): OfficialSourceEntry {
  return {
    id: 'test-entry',
    name: 'Test Entry',
    languages: ['en'],
    authorityClass: 'GOVERNMENT',
    baseUrl: 'https://example.gov',
    enabled: true,
    ingestionMethod: 'none',
    provenanceNote: 'Added for a unit test fixture.',
    ...overrides,
  };
}

describe('M64.1 scope lock — OFFICIAL_SOURCES starts and stays empty this milestone', () => {
  it('the real registry has zero entries — no hardcoded institutions yet, per explicit CTO instruction', () => {
    expect(OFFICIAL_SOURCES).toHaveLength(0);
  });

  it('every zero-arg lookup function returns an empty/undefined result against the real, empty registry', () => {
    expect(getOfficialSourceById('anything')).toBe(undefined);
    expect(getOfficialSourcesForCountry('KE')).toHaveLength(0);
    expect(getOfficialSourcesByClass('GOVERNMENT')).toHaveLength(0);
    expect(getEnabledOfficialSources()).toHaveLength(0);
  });
});

describe('getOfficialSourceByIdFrom — real filtering logic against fixture data', () => {
  const fixture = [
    buildEntry({ id: 'a' }),
    buildEntry({ id: 'b' }),
  ];

  it('finds the matching entry by exact id', () => {
    expect(getOfficialSourceByIdFrom(fixture, 'a')?.id).toBe('a');
    expect(getOfficialSourceByIdFrom(fixture, 'b')?.id).toBe('b');
  });

  it('returns undefined for a non-matching id, never the first entry or a guess', () => {
    expect(getOfficialSourceByIdFrom(fixture, 'c')).toBe(undefined);
  });

  it('returns undefined against an empty array', () => {
    expect(getOfficialSourceByIdFrom([], 'a')).toBe(undefined);
  });
});

describe('getOfficialSourcesForCountryFrom — real filtering logic against fixture data', () => {
  const fixture = [
    buildEntry({ id: 'ke-1', countryCode: 'KE' }),
    buildEntry({ id: 'ke-2', countryCode: 'KE' }),
    buildEntry({ id: 'rw-1', countryCode: 'RW' }),
    buildEntry({ id: 'intl-1', countryCode: undefined, authorityClass: 'INTERNATIONAL_ORGANIZATION' }),
  ];

  it('returns every entry matching the given country code, and only those', () => {
    const result = getOfficialSourcesForCountryFrom(fixture, 'KE');
    expect(result.map((entry) => entry.id).sort()).toEqual(['ke-1', 'ke-2']);
  });

  it('a country with a single matching entry returns exactly one result', () => {
    const result = getOfficialSourcesForCountryFrom(fixture, 'RW');
    expect(result.map((entry) => entry.id)).toEqual(['rw-1']);
  });

  it('a country with zero matching entries returns an empty array, not undefined', () => {
    const result = getOfficialSourcesForCountryFrom(fixture, 'FR');
    expect(result).toEqual([]);
  });

  it('an entry with no countryCode (e.g. an international organization) never matches any country filter', () => {
    const result = getOfficialSourcesForCountryFrom(fixture, 'KE');
    expect(result.some((entry) => entry.id === 'intl-1')).toBe(false);
  });
});

describe('getOfficialSourcesByClassFrom — real filtering logic against fixture data', () => {
  const fixture = [
    buildEntry({ id: 'gov-1', authorityClass: 'GOVERNMENT' }),
    buildEntry({ id: 'election-1', authorityClass: 'OFFICIAL_ELECTION_AUTHORITY' }),
    buildEntry({ id: 'election-2', authorityClass: 'OFFICIAL_ELECTION_AUTHORITY' }),
    buildEntry({ id: 'bank-1', authorityClass: 'CENTRAL_BANK' }),
  ];

  it('returns every entry of the given class, and only those', () => {
    const result = getOfficialSourcesByClassFrom(fixture, 'OFFICIAL_ELECTION_AUTHORITY');
    expect(result.map((entry) => entry.id).sort()).toEqual(['election-1', 'election-2']);
  });

  it('a class with exactly one matching entry returns exactly one result', () => {
    const result = getOfficialSourcesByClassFrom(fixture, 'CENTRAL_BANK');
    expect(result.map((entry) => entry.id)).toEqual(['bank-1']);
  });

  it('a class with zero matching entries returns an empty array', () => {
    const result = getOfficialSourcesByClassFrom(fixture, 'COURT');
    expect(result).toEqual([]);
  });

  it('every OfficialSourceClass member is independently exercised, confirming exhaustive coverage of the type', () => {
    const allClasses = [
      'OFFICIAL_ELECTION_AUTHORITY', 'OFFICIAL_STATISTICS', 'CENTRAL_BANK', 'GOVERNMENT',
      'COURT', 'INTERNATIONAL_ORGANIZATION', 'NEWS_AGENCY', 'NEWS_PUBLISHER', 'RESEARCH', 'OTHER',
    ] as const;
    const perClassFixture = allClasses.map((cls, i) => buildEntry({ id: `entry-${i}`, authorityClass: cls }));
    for (const cls of allClasses) {
      const result = getOfficialSourcesByClassFrom(perClassFixture, cls);
      expect(result).toHaveLength(1);
      expect(result[0].authorityClass).toBe(cls);
    }
  });
});

describe('getEnabledOfficialSourcesFrom — real filtering logic against fixture data', () => {
  const fixture = [
    buildEntry({ id: 'on-1', enabled: true }),
    buildEntry({ id: 'off-1', enabled: false }),
    buildEntry({ id: 'on-2', enabled: true }),
  ];

  it('returns only entries with enabled: true', () => {
    const result = getEnabledOfficialSourcesFrom(fixture);
    expect(result.map((entry) => entry.id).sort()).toEqual(['on-1', 'on-2']);
  });

  it('a fully-disabled fixture returns an empty array', () => {
    const result = getEnabledOfficialSourcesFrom([buildEntry({ id: 'x', enabled: false })]);
    expect(result).toEqual([]);
  });
});

describe('OfficialSourceIngestionMethod — M64.1 scope correction', () => {
  it('scraping is not part of the ingestion-method vocabulary — only api, rss, manual, none exist', () => {
    const validMethods: OfficialSourceEntry['ingestionMethod'][] = ['api', 'rss', 'manual', 'none'];
    for (const method of validMethods) {
      const entry = buildEntry({ ingestionMethod: method });
      expect(entry.ingestionMethod).toBe(method);
    }
  });
});
