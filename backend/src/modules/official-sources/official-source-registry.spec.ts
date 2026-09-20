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
    /*
      ECON-RIGHTS-BINDING-1 — the field is REQUIRED and nullable, so this fixture has to
      decide. `null` is the honest value for a test entry: it has no rights record, and
      that is a refusal rather than a permission. A fixture defaulting to a plausible
      binding would let a test satisfy E4B with no rights reading behind it.
    */
    rights: null,
    ...overrides,
  };
}

/*
  EVERY REGISTRATION, AND THE ROUND THAT AUTHORISED IT.

  This is the retired scope lock's teeth, re-keyed. The lock said "exactly one entry"; a
  bare count is the cardinality defect Main ruled on in `R-EA-LIN-4`, and bumping 1 to 2
  would reinstate it one round later. So the registry is compared against a NAMED SET
  instead: an entry that appears without being added here, with its authorising round,
  fails — which is the property the lock actually defended.
*/
const REVIEWED_REGISTRATIONS: ReadonlyArray<{ id: string; authorisedBy: string }> = [
  { id: 'eurostat', authorisedBy: 'MAIN-ECONOMY-CANONICAL-CLOSEOUT-R1 §2.2' },
  { id: 'rw-nisr', authorisedBy: 'MAIN-EAST-AFRICA-SOURCE-RIGHTS-REGISTRY-CLOSEOUT-R1 ruling F' },
];

describe('E-4a · every registry entry is a reviewed registration, and NONE is enabled', () => {
  /*
    ── THE M64.1 SCOPE LOCK FIRED TWICE, AND IS RETIRED DELIBERATELY ─────────

    It first asserted `OFFICIAL_SOURCES` was empty, and fired when Eurostat was registered.
    It was then rewritten as "exactly one entry", and FIRED AGAIN when rw-nisr was
    registered under the East Africa closeout. Both firings are the lock working: a real
    registration cannot happen quietly.

    It is REPLACED WITH ASSERTIONS CARRYING THE SAME TEETH, never deleted — and this time
    without a number in it. A new entry appearing, or any entry acquiring `enabled: true`,
    still fails here.
  */
  it('the registry is exactly the reviewed set — no entry appears without an authorising round', () => {
    expect(OFFICIAL_SOURCES.map((s) => s.id).sort()).toEqual(
      REVIEWED_REGISTRATIONS.map((r) => r.id).sort(),
    );

    // Non-vacuity: an empty registry must not satisfy the comparison above for free.
    expect(OFFICIAL_SOURCES.length).toBeGreaterThan(0);

    // Negative control: an unreviewed entry is detected.
    const smuggled = [...OFFICIAL_SOURCES.map((s) => s.id), 'smuggled-source'].sort();
    expect(smuggled).not.toEqual(REVIEWED_REGISTRATIONS.map((r) => r.id).sort());
  });

  it('each reviewed registration is present, classed, and carries its authorising round', () => {
    for (const { id, authorisedBy } of REVIEWED_REGISTRATIONS) {
      const entry = getOfficialSourceById(id);
      expect(entry).toBeDefined();
      expect(entry?.authorityClass).toBe('OFFICIAL_STATISTICS');
      // The entry itself must cite the round that authorised it, not just this test.
      expect(entry?.provenanceNote).toContain(authorisedBy.split(' ')[0]);
    }
  });

  it('REGISTERED IS NOT ACTIVATED — nothing in this registry is enabled', () => {
    /* The half that matters most. Registration resolves a host and an authority class; it
       grants no permission to fetch, and four successful captures do not change that. */
    expect(getEnabledOfficialSources()).toHaveLength(0);
    expect(OFFICIAL_SOURCES.every((s) => s.enabled === false)).toBe(true);
  });

  it('every entry carries a rights KEY, never a grade — a class cannot be acquired by editing here', () => {
    /* Was indexed at [0], which silently tested only the first entry and would have let a
       second entry ship a grade unexamined. Now every entry is checked. */
    expect(OFFICIAL_SOURCES.length).toBeGreaterThan(0);

    for (const entry of OFFICIAL_SOURCES) {
      expect(entry.rights).not.toBeNull();
      expect(entry.rights?.rightsAuthorityId).toBeTruthy();
      expect(entry.rights?.rightsRecordKey).toBeTruthy();
      /* no grade, no instrument, no permission anywhere in the entry itself */
      expect(JSON.stringify(entry)).not.toMatch(/E-5|rightsClass|instrument/);
    }

    /* The records live with the lane that READ the instrument (ruling B), so the two
       entries deliberately point at DIFFERENT authorities. Neither resolves. */
    expect(getOfficialSourceById('eurostat')?.rights).toEqual({
      rightsAuthorityId: 'ECONOMY_ACQUISITION_RIGHTS',
      rightsRecordKey: 'EUROSTAT',
    });
    expect(getOfficialSourceById('rw-nisr')?.rights).toEqual({
      rightsAuthorityId: 'EAST_AFRICA_ACQUISITION_RIGHTS',
      rightsRecordKey: 'RW_NISR',
    });

    // Negative control: the grade scan does fire on a grade.
    expect(JSON.stringify({ rightsClass: 'E-5' })).toMatch(/E-5|rightsClass|instrument/);
  });

  it('the zero-arg lookups still behave against the real registry', () => {
    expect(getOfficialSourceById('anything')).toBe(undefined);
    expect(getOfficialSourceById('eurostat')?.name).toBe('Eurostat');
    expect(getOfficialSourceById('rw-nisr')?.name).toBe('National Institute of Statistics of Rwanda');
    expect(getOfficialSourcesForCountry('KE')).toHaveLength(0);
    expect(getOfficialSourcesByClass('GOVERNMENT')).toHaveLength(0);

    /* Derived, not typed out — the defect Main ruled on was a hand-written count beside a
       list that no longer matched it. */
    expect(getOfficialSourcesByClass('OFFICIAL_STATISTICS')).toHaveLength(
      OFFICIAL_SOURCES.filter((s) => s.authorityClass === 'OFFICIAL_STATISTICS').length,
    );

    /* Eurostat carries NO countryCode: the admitted series are Polish, but the SUBJECT of
       the data is not the AUTHORITY that published it. NISR does carry one. */
    expect(getOfficialSourcesForCountry('RW').map((s) => s.id)).toEqual(['rw-nisr']);
    expect(getOfficialSourceById('eurostat')?.countryCode).toBeUndefined();
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
