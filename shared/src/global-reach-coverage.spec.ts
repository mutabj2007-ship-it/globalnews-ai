import {
  accountCountrySourceCoverage,
  accountDomainCoverage,
  coverageDomainOf,
  packEntryRightsState,
  rightsBlockActivation,
  sourceCoverageDisclosureFrom,
  stricterRightsState,
  type LocalSourceCandidate,
  type SourcePackEntry,
} from './global-reach';

/** T1 COVERAGE TRUTHFULNESS — the canonical coverage accounting, unit level. */
const candidate = (over: Partial<LocalSourceCandidate> = {}): LocalSourceCandidate => ({
  sourceId: 'x:1',
  origin: 'GLOBAL_REACH_PACK',
  iso3: 'KEN',
  domain: 'NEWS_REPORTING',
  canonicalHost: 'example.co.ke',
  active: false,
  rightsState: 'UNRESOLVED',
  measured: false,
  ...over,
});

describe('T1 · canonical coverage state per domain', () => {
  it('nothing listed is a COVERAGE_GAP, never UNVERIFIED', () => {
    expect(accountDomainCoverage('NEWS_REPORTING', []).state).toBe('COVERAGE_GAP');
  });

  it('listed but disabled is a COVERAGE_GAP (the registry CAN say: nothing is active)', () => {
    const d = accountDomainCoverage('NEWS_REPORTING', [candidate({ rightsState: 'CLEARED', measured: true })]);
    expect(d).toMatchObject({ state: 'COVERAGE_GAP', listedLocalSourceCount: 1, activeLocalSourceCount: 0 });
  });

  it('active but rights not cleared is still a COVERAGE_GAP', () => {
    for (const rightsState of ['UNRESOLVED', 'LIMITED_SCOPE_REVIEW', 'UNREVIEWED', 'RESTRICTED'] as const) {
      expect(
        accountDomainCoverage('NEWS_REPORTING', [candidate({ active: true, rightsState, measured: true })]).state,
      ).toBe('COVERAGE_GAP');
    }
  });

  it('active + cleared + measured is COVERED_LOCAL', () => {
    expect(
      accountDomainCoverage('NEWS_REPORTING', [candidate({ active: true, rightsState: 'CLEARED', measured: true })]),
    ).toMatchObject({ state: 'COVERED_LOCAL', qualifiedLocalSourceCount: 1 });
  });

  it('active + cleared but unmeasured is the only UNVERIFIED case', () => {
    expect(
      accountDomainCoverage('NEWS_REPORTING', [candidate({ active: true, rightsState: 'CLEARED' })]).state,
    ).toBe('UNVERIFIED');
  });

  it('one publisher in two registries merges, and the STRICTER rights state wins', () => {
    const d = accountDomainCoverage('NEWS_REPORTING', [
      candidate({ sourceId: 'pack', canonicalHost: 'wiadomosci.wp.pl', rightsState: 'UNREVIEWED' }),
      candidate({ sourceId: 'feed', canonicalHost: 'wp.pl', rightsState: 'PROHIBITED', active: true }),
    ]);
    expect(d.listedLocalSourceCount).toBe(1);
    expect(d.rightsBlockedLocalSourceCount).toBe(1);
    expect(d.state).toBe('COVERAGE_GAP');
  });

  it('domains are derived from the existing sourceClass', () => {
    expect(coverageDomainOf('NEWS_PROVIDER')).toBe('NEWS_REPORTING');
    expect(coverageDomainOf('OFFICIAL_SOURCE')).toBe('OFFICIAL_PUBLIC_DATA');
    expect(coverageDomainOf('PUBLIC_DATA')).toBe('OFFICIAL_PUBLIC_DATA');
  });

  it('country roll-up is the weakest domain', () => {
    const c = accountCountrySourceCoverage('KEN', [
      candidate({ active: true, rightsState: 'CLEARED', measured: true }),
    ]);
    expect(c.coverageDomains.map((d) => d.state)).toEqual(['COVERED_LOCAL', 'COVERAGE_GAP']);
    expect(c.coverageState).toBe('COVERAGE_GAP');
    expect(c.coverageGapReason).toContain('OFFICIAL_PUBLIC_DATA: no local source listed');
  });
});

describe('T1 · rights states are recorded, never upgraded', () => {
  const entry = (standing: 'PERMITTED' | 'RESTRICTED' | 'UNKNOWN', usageNote: string, binding = false) =>
    ({
      rights: {
        standing,
        usageNote,
        binding: binding ? { rightsAuthorityId: 'a', rightsRecordKey: 'k' } : null,
      },
    }) as unknown as SourcePackEntry;

  it('reads the preserved original research status', () => {
    expect(packEntryRightsState(entry('UNKNOWN', 'Dormant research; original rights status LIMITED_SCOPE_REVIEW. x'))).toBe(
      'LIMITED_SCOPE_REVIEW',
    );
    expect(packEntryRightsState(entry('UNKNOWN', 'original rights status UNREVIEWED.'))).toBe('UNREVIEWED');
    expect(packEntryRightsState(entry('UNKNOWN', 'original rights status RESTRICTION_OBSERVED.'))).toBe('RESTRICTED');
    expect(packEntryRightsState(entry('UNKNOWN', 'no status here'))).toBe('UNRESOLVED');
    expect(packEntryRightsState(entry('UNKNOWN', 'original rights status NOT_REVIEWED.'))).toBe('UNREVIEWED');
    /* ambiguous research wording: the normalizer keeps standing UNKNOWN, so never CLEARED, never a restriction */
    expect(
      packEntryRightsState(entry('UNKNOWN', 'original rights status RESTRICTION_OR_NOTICE_OBSERVED.')),
    ).toBe('UNRESOLVED');
    expect(packEntryRightsState(entry('RESTRICTED', 'x'))).toBe('RESTRICTED');
    expect(packEntryRightsState(entry('PERMITTED', 'x', true))).toBe('CLEARED');
  });

  it('only RESTRICTED and PROHIBITED block activation; merging never upgrades', () => {
    expect(rightsBlockActivation('RESTRICTED')).toBe(true);
    expect(rightsBlockActivation('PROHIBITED')).toBe(true);
    expect(rightsBlockActivation('UNRESOLVED')).toBe(false);
    expect(rightsBlockActivation('RIGHTS_UNDER_E1_REVIEW')).toBe(false);
    expect(stricterRightsState('CLEARED', 'UNRESOLVED')).toBe('UNRESOLVED');
    expect(stricterRightsState('PROHIBITED', 'CLEARED')).toBe('PROHIBITED');
  });
});

describe('T1 · reader disclosure', () => {
  it('a news-domain gap carries LOCAL_COVERAGE_ABSENT and names the international source with its rights', () => {
    const coverage = accountCountrySourceCoverage('KEN', [candidate()]);
    const d = sourceCoverageDisclosureFrom({
      coverage,
      governed: true,
      localities: ['LOCAL', 'UNVERIFIED_LOCALITY', 'UNVERIFIED_LOCALITY', 'INTERNATIONAL'],
      contributingInternational: [
        {
          sourceId: 'gnews',
          displayName: 'GNews',
          basis: 'INTERNATIONAL_AGGREGATOR',
          active: true,
          rightsState: 'RIGHTS_UNDER_E1_REVIEW',
          rightsNote: 'n',
        },
      ],
    });
    expect(d).toEqual({
      iso3: 'KEN',
      governed: true,
      state: 'COVERAGE_GAP',
      domains: [
        { domain: 'NEWS_REPORTING', state: 'COVERAGE_GAP' },
        { domain: 'OFFICIAL_PUBLIC_DATA', state: 'COVERAGE_GAP' },
      ],
      evidence: { local: 1, international: 1, unverifiedLocality: 2 },
      internationalSources: [{ sourceId: 'gnews', displayName: 'GNews', rightsState: 'RIGHTS_UNDER_E1_REVIEW' }],
      notice: 'LOCAL_COVERAGE_ABSENT',
    });
  });

  it('covered local news carries no notice', () => {
    const coverage = accountCountrySourceCoverage('KEN', [
      candidate({ active: true, rightsState: 'CLEARED', measured: true }),
    ]);
    expect(
      sourceCoverageDisclosureFrom({ coverage, governed: true, localities: [], contributingInternational: [] }).notice,
    ).toBeNull();
  });
});
