/*
  ── B4-A · DATA-PENDING TESTS ─────────────────────────────────────────────

  The `it.skip` entries below are not failures of the recovered Economy
  substrate. They assert against official-source registry entries that canonical
  seeded and this deployment deliberately does not: OFFICIAL_SOURCES is empty by
  design, and the whole point of the Economy data finding is that no
  central-bank or statistics producer exists yet.

  They are skipped with a stated reason rather than satisfied with invented
  fixtures, because a seeded fake would turn "we have no data" into "we have
  data" in the one place a reviewer would check.
*/
import {
  type EconomyConsensusBenchmark,
  type EconomyValueSemantics,
  assertConsensusIsNotObservation,
  assertReleaseStatusIsApplicable,
  economyHasObservationSource,
} from '@globalnews-ai/shared';
import { OFFICIAL_SOURCES } from '../official-sources/official-source-registry';
import {
  ECONOMY_CAPABILITY_FACTS,
  ECONOMY_OBSERVATION_AVAILABILITY,
  AVAILABLE_ECONOMY_CATEGORIES,
  assertCategoryProducible,
  economyCapability,
  economyDeploymentHasObservationSource,
} from './economy-capability.contract';
import { economySourceProvenance } from './economy-source-class.adapter';

describe('ADAPT-1 Gate 4 - source class attaches to the claim, not the institution', () => {
  /* B4-A DATA-PENDING — asserts against a SEEDED official-source registry. Canonical seeded 4 entries; this deployment seeds 0 by design ("OFFICIAL_SOURCES starts empty and stays empty this milestone"). Seeding fake entries to make this pass is exactly the fabrication the ruling forbids. It will pass when G seeds the registry, and must not before. */
  it.skip('the SAME institution yields different evidence roles for different claims', () => {
    const decision = economySourceProvenance({
      claimKind: 'POLICY_DECISION_RECORD',
      officialSourceId: 'pl-nbp',
    });
    const release = economySourceProvenance({
      claimKind: 'STATISTICAL_RELEASE',
      officialSourceId: 'pl-nbp',
    });
    const commentary = economySourceProvenance({
      claimKind: 'REPORTING_ON_ECONOMY',
      officialSourceId: 'pl-nbp',
    });

    // The institutional fact is constant...
    expect(decision.authorityClass).toBe('CENTRAL_BANK');
    expect(release.authorityClass).toBe('CENTRAL_BANK');
    expect(commentary.authorityClass).toBe('CENTRAL_BANK');

    // ...and the per-record fact is not. Now derived by the SHARED mapping.
    expect(decision.evidenceRole).toBe('PRIMARY_RECORD');
    expect(release.evidenceRole).toBe('REFERENCE_DATA');
    expect(commentary.evidenceRole).toBe('REPORTING');

    expect(decision.sourceType).toBe('OFFICIAL_SOURCE');
    expect(release.sourceType).toBe('PUBLIC_DATA');
    expect(commentary.sourceType).toBe('NEWS_PROVIDER');
  });

  it('an UNREGISTERED publisher is never promoted to PUBLIC_DATA or given an authority class', () => {
    const p = economySourceProvenance({
      claimKind: 'STATISTICAL_RELEASE',
      officialSourceId: 'not-in-the-registry',
    });

    expect(p.sourceType).toBe('NEWS_PROVIDER');
    expect(p.authorityClass).toBeUndefined();
    expect(p.institution).toBeUndefined();
  });

  /* B4-A DATA-PENDING — asserts against a SEEDED official-source registry. Canonical seeded 4 entries; this deployment seeds 0 by design ("OFFICIAL_SOURCES starts empty and stays empty this milestone"). Seeding fake entries to make this pass is exactly the fabrication the ruling forbids. It will pass when G seeds the registry, and must not before. */
  it.skip('source language is preserved and nothing is translated', () => {
    const p = economySourceProvenance({
      claimKind: 'STATISTICAL_RELEASE',
      officialSourceId: 'pl-gus',
      language: 'pl',
    });

    expect(p.language).toBe('pl');
    expect(p.jurisdiction).toBe('PL');
  });

  it('Economy declares no provenance vocabulary of its own - the shape is the shared one', () => {
    const p = economySourceProvenance({ claimKind: 'REPORTING_ON_ECONOMY' });
    const allowed = new Set([
      'sourceType',
      'providerId',
      'institution',
      'jurisdiction',
      'language',
      'sourceUrl',
      'retrievedAt',
      'evidenceRole',
      'authorityClass',
    ]);

    for (const key of Object.keys(p)) expect(allowed.has(key)).toBe(true);
  });
});

describe('ADAPT-1 Gate 3 - the three axes, with releaseStatus NULLABLE per the contract', () => {
  it('an ACTUAL carries a release status', () => {
    const s: EconomyValueSemantics = {
      releaseStatus: 'PRELIMINARY',
      valueKind: 'ACTUAL',
      freshness: 'FRESH',
    };

    expect(() => assertReleaseStatusIsApplicable(s)).not.toThrow();
  });

  it('a FORECAST, DERIVED or TARGET carries NULL - it has no publisher release cycle', () => {
    for (const valueKind of ['FORECAST', 'DERIVED', 'TARGET'] as const) {
      const ok: EconomyValueSemantics = { releaseStatus: null, valueKind, freshness: 'UNDETERMINED' };
      expect(() => assertReleaseStatusIsApplicable(ok)).not.toThrow();

      const wrong: EconomyValueSemantics = {
        releaseStatus: 'FINAL',
        valueKind,
        freshness: 'UNDETERMINED',
      };
      expect(() => assertReleaseStatusIsApplicable(wrong)).toThrow(/ECON-AXIS-1/);
    }
  });

  it('revisionOrdinal is meaningful only on a REVISED release', () => {
    expect(() =>
      assertReleaseStatusIsApplicable({
        releaseStatus: 'FINAL',
        valueKind: 'ACTUAL',
        freshness: 'FRESH',
        revisionOrdinal: 2,
      }),
    ).toThrow(/ECON-AXIS-2/);
  });
});

describe('ADAPT-1 - consensus is a derived benchmark, not an observation', () => {
  const benchmark: EconomyConsensusBenchmark = {
    seriesId: 'TEST-SERIES-1',
    periodId: '2026-01',
    value: 5.1,
    unit: 'percent',
    aggregationMethod: 'MEDIAN',
    contributorCount: 3,
    collectionCutoff: '2026-01-28T12:00:00.000Z',
    contributingForecastRefs: ['fc-a', 'fc-b', 'fc-c'],
    valueKind: 'DERIVED',
  };

  it('carries value, method, N, cutoff and contributing references', () => {
    expect(() => assertConsensusIsNotObservation(benchmark)).not.toThrow();
    expect(benchmark.aggregationMethod).toBe('MEDIAN');
    expect(benchmark.contributingForecastRefs).toHaveLength(3);
  });

  it('carries NO release status', () => {
    expect('releaseStatus' in benchmark).toBe(false);
  });

  it('an N that cannot be attributed to named forecasts is rejected', () => {
    expect(() => assertConsensusIsNotObservation({ ...benchmark, contributorCount: 40 })).toThrow();
  });
});

describe('ADAPT-1 Gate 2 - capability stays G-owned and uses the SHARED gap/availability vocabulary', () => {
  it('this deployment is NO_OBSERVATION_SOURCE, expressed in the shared vocabulary', () => {
    expect(ECONOMY_OBSERVATION_AVAILABILITY).toBe('NO_OBSERVATION_SOURCE');
    expect(economyHasObservationSource(ECONOMY_OBSERVATION_AVAILABILITY)).toBe(false);
    expect(economyDeploymentHasObservationSource()).toBe(false);
  });

  it('NO Economy category is available, and every fact carries a SHARED gap reason', () => {
    expect(AVAILABLE_ECONOMY_CATEGORIES).toEqual([]);
    expect(ECONOMY_CAPABILITY_FACTS).toHaveLength(7);
    for (const fact of ECONOMY_CAPABILITY_FACTS) {
      expect(fact.state).not.toBe('AVAILABLE');
      // A fact about US, never about the publisher - the publisher does collect these.
      expect(fact.gapReason).toBe('NO_PRODUCER');
      expect(fact.evidence.length).toBeGreaterThan(40);
    }
  });

  /* B4-A DATA-PENDING — asserts against a SEEDED official-source registry. Canonical seeded 4 entries; this deployment seeds 0 by design ("OFFICIAL_SOURCES starts empty and stays empty this milestone"). Seeding fake entries to make this pass is exactly the fabrication the ruling forbids. It will pass when G seeds the registry, and must not before. */
  it.skip('the measured reason holds: every registered source is disabled with no ingestion', () => {
    expect(OFFICIAL_SOURCES).toHaveLength(4);
    expect(OFFICIAL_SOURCES.filter((s) => s.enabled)).toHaveLength(0);
    expect(OFFICIAL_SOURCES.filter((s) => s.ingestionMethod !== 'none')).toHaveLength(0);
  });

  it('every candidate source id names a source that actually exists in the registry', () => {
    const ids = new Set(OFFICIAL_SOURCES.map((s) => s.id));

    for (const fact of ECONOMY_CAPABILITY_FACTS) {
      for (const id of fact.candidateSourceIds) expect(ids.has(id)).toBe(true);
    }
  });

  it('serving a value for an unavailable category is refused, not degraded', () => {
    expect(() => assertCategoryProducible('INFLATION_CPI')).toThrow(/ECON-CAPABILITY-2/);
    expect(economyCapability('PUBLIC_DEBT_FISCAL').state).toBe('UNAVAILABLE_NO_PRODUCER');
  });

  it('FIXTURE is declared in the shared vocabulary and is NOT this deployment state', () => {
    expect(ECONOMY_OBSERVATION_AVAILABILITY).not.toBe('FIXTURE');
    expect(economyHasObservationSource('FIXTURE')).toBe(false);
  });
});
