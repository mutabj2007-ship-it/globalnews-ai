/*
  ── B4-A · DATA-PENDING TESTS ─────────────────────────────────────────────

  The `it.skip` entries below are not failures of the recovered Economy
  substrate. They assert against official-source registry FIELDS this deployment
  does not yet populate.

  CORRECTED 2026-09-20: this header used to read "OFFICIAL_SOURCES is empty by
  design". It is not empty - it holds eurostat and rw-nisr, both registered and
  both disabled. Registration is not ingestion, so the Economy data finding is
  unchanged: no central-bank or statistics PRODUCER exists yet.

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
  candidateCardinalitySentence,
  economyDeploymentHasObservationSource,
} from './economy-capability.contract';
import { economySourceProvenance } from './economy-source-class.adapter';

describe('ADAPT-1 Gate 4 - source class attaches to the claim, not the institution', () => {
  /* B4-A DATA-PENDING — asserts against official-source registry FIELDS this deployment does not yet populate. The registry is NO LONGER EMPTY (eurostat, rw-nisr), so the old rationale here — "this deployment seeds 0 by design" — was stale and is corrected. What is still absent is the per-claim evidence-role and language data these assert against. Seeding fake entries to make them pass is exactly the fabrication the ruling forbids. */
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

  /* B4-A DATA-PENDING — asserts against official-source registry FIELDS this deployment does not yet populate. The registry is NO LONGER EMPTY (eurostat, rw-nisr), so the old rationale here — "this deployment seeds 0 by design" — was stale and is corrected. What is still absent is the per-claim evidence-role and language data these assert against. Seeding fake entries to make them pass is exactly the fabrication the ruling forbids. */
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

  /*
    RETIRED TRIPWIRE, REPLACED WITH EQUAL TEETH - NOT DELETED.

    This was `it.skip` with the note "canonical seeded 4 entries; this deployment seeds 0
    by design". Both halves were stale: the registry now holds real entries, and the
    original assertion would fail for the wrong reason anyway - eurostat carries
    `ingestionMethod: 'api'`, which with `enabled: false` reads "an API source that is
    switched off" and is the true statement rather than a violation.

    So the teeth are preserved where they actually bite: NOTHING IS ENABLED. That is the
    activation gate, it is the property the skipped test was reaching for, and unlike the
    original it is asserted against a NON-EMPTY registry.
  */
  it('the registry is non-empty, and not one registered source is enabled', () => {
    // Non-vacuity first: an empty registry would satisfy the loop below for free.
    expect(OFFICIAL_SOURCES.length).toBeGreaterThan(0);
    expect(OFFICIAL_SOURCES.filter((s) => s.enabled)).toEqual([]);

    // Positive control: the predicate can see an enabled source when one exists.
    const enabledProbe = [...OFFICIAL_SOURCES, { ...OFFICIAL_SOURCES[0], id: 'probe', enabled: true }];
    expect(enabledProbe.filter((s) => s.enabled)).toHaveLength(1);
  });

  it('every candidate source id names a source that actually exists in the registry', () => {
    const ids = new Set(OFFICIAL_SOURCES.map((s) => s.id));

    /*
      R-EA-LIN-5 - NON-VACUITY CONTROL. This loop is the one that passed while every array
      it iterated was empty: `R-B`, an empty set satisfies every "every member is X"
      assertion. Asserting that at least one row names a real publisher is what gives the
      loop something to do, so emptying the table can no longer be mistaken for passing.
    */
    const named = ECONOMY_CAPABILITY_FACTS.flatMap((f) => f.candidateSourceIds);
    expect(named.length).toBeGreaterThan(0);
    expect(named).toContain('rw-nisr');

    for (const fact of ECONOMY_CAPABILITY_FACTS) {
      for (const id of fact.candidateSourceIds) expect(ids.has(id)).toBe(true);
    }
  });

  /*
    R-EA-LIN-4 - THE ASSERTION THE ROUND ACTUALLY NEEDED, and the one that has something
    to say when an array is empty. `state` is a claim ABOUT `candidateSourceIds`; this
    checks the claim against the thing it claims about, in both directions.
  */
  it('every declared state agrees with the array it describes, in both directions', () => {
    for (const fact of ECONOMY_CAPABILITY_FACTS) {
      if (fact.candidateSourceIds.length > 0) {
        expect(fact.state).toBe('UNAVAILABLE_SOURCE_DISABLED');
      } else {
        expect(fact.state).toBe('UNAVAILABLE_NO_PRODUCER');
      }
    }

    // Both branches are actually exercised - otherwise the test above is half-vacuous.
    const withCandidates = ECONOMY_CAPABILITY_FACTS.filter((f) => f.candidateSourceIds.length > 0);
    const without = ECONOMY_CAPABILITY_FACTS.filter((f) => f.candidateSourceIds.length === 0);
    expect(withCandidates.length).toBeGreaterThan(0);
    expect(without.length).toBeGreaterThan(0);
  });

  it('no evidence string carries a hand-written cardinality that could contradict its array', () => {
    /*
      The failure mode this closes, verbatim from the defect: "Four candidate publishers
      are registered for CPI" printed beside an empty array. Number words are banned from
      the prose precisely because they are the form the lie took.
    */
    const NUMBER_WORDS = /\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/i;

    for (const fact of ECONOMY_CAPABILITY_FACTS) {
      const generated = candidateCardinalitySentence(fact.candidateSourceIds);
      const handWritten = fact.evidence.replace(generated, '');
      expect(handWritten).not.toMatch(NUMBER_WORDS);
    }

    // Positive control: the matcher does detect a number word when one is present.
    expect('Four candidate publishers are registered').toMatch(NUMBER_WORDS);

    // And the interpolated half DOES state the count - it is derived, so it may.
    const cpi = economyCapability('INFLATION_CPI');
    expect(cpi.evidence).toContain(String(cpi.candidateSourceIds.length));
    expect(cpi.evidence).toContain('rw-nisr');
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
