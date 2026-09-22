import {
  assertSecurityObservationIsWellFormed,
  domainObservationKey,
  OBSERVATION_ABSENCE_STATES,
  readerAbsence,
  SECURITY_AXES_NOT_REACHABLE_FROM_REPORTING,
  SECURITY_CLAIM_AUTHORSHIP,
  SECURITY_COVERAGE_AXES,
  SECURITY_DOMAIN_ID,
  SECURITY_OBSERVATION_KINDS,
  SECURITY_OBSERVATION_SUBJECT_TYPE,
  SECURITY_OBSERVED_AXIS,
  securityObservationIdentity,
  securityObservationKey,
  type ReaderAbsenceState,
  type SecurityObservation,
} from '@globalnews-ai/shared';

/** R2 retains this executable backend contract suite. Current release also runs shared Jest tests. */

/**
 * THE ONE ADMISSIBLE SHAPE, built once so every test below mutates a copy of something that
 * is known to pass. A fixture that started invalid would let a guard silently stop working.
 */
function admissibleObservation(): SecurityObservation {
  const identity = securityObservationIdentity('rwanda-times', 'https://example.test/a/1');
  return {
    observationKey: domainObservationKey(identity),
    identity,
    claimant: 'The Rwanda Times',
    observationKind: 'SECURITY_INCIDENT_REPORT',
    subjectType: SECURITY_OBSERVATION_SUBJECT_TYPE,
    subjectId: 'RW',
    claim: {
      claimType: 'INCIDENT_REPORTED',
      axis: 'OCCURRENCE',
      headline: 'Man shot dead in Kigali robbery',
      summary: 'Police said a suspect was arrested.',
      admittedByTerms: ['shot dead', 'police said'],
      ownership: {
        violenceOrProtectivePosture: true,
        organisedArmedActorParticipates: false,
        violenceTerms: ['shot dead'],
        organisedArmedActorTerms: [],
        politicalActivityTerms: [],
      },
    },
    temporal: {
      occurredAt: undefined,
      publisherVintage: '2026-09-20T08:00:00.000Z',
      retrievedAt: '2026-09-20T09:00:00.000Z',
      temporalBasis: 'PUBLISHER_VINTAGE',
    },
    provenance: {
      sourceType: 'NEWS_PROVIDER',
      providerId: 'gnews',
      sourceUrl: 'https://example.test/a/1',
      retrievedAt: '2026-09-20T09:00:00.000Z',
      evidenceRole: 'REPORTING',
    },
    sourceReference: { citation: undefined, sourceUrl: 'https://example.test/a/1' },
    attributeAuthorship: SECURITY_CLAIM_AUTHORSHIP,
    revision: {
      revisionOrdinal: 0,
      supersedesRevisionOrdinal: null,
      revisionKind: undefined,
      recordedAt: '2026-09-20T09:00:00.000Z',
    },
    geography: {
      geographyId: 'RW',
      geographyName: 'Rwanda',
      precision: 'COUNTRY',
      provenance: 'INTERPRETED',
      attributionScore: 82,
    },
  };
}

describe('the admissible shape', () => {
  it('passes the guard — the positive control every refusal below depends on', () => {
    expect(() => assertSecurityObservationIsWellFormed(admissibleObservation())).not.toThrow();
  });

  it('is a DomainObservation, so the platform guard runs on it too', () => {
    const observation = admissibleObservation();
    // The key must be the one the identity produces; a hand-written key can drift.
    expect(observation.observationKey).toBe(domainObservationKey(observation.identity));
    expect(observation.observationKey).toBe(
      securityObservationKey('rwanda-times', 'https://example.test/a/1'),
    );
  });

  it('length-prefixes the key, so two decompositions cannot encode to one', () => {
    const a = securityObservationKey('ab', 'cde');
    const b = securityObservationKey('abc', 'de');
    expect(a).not.toBe(b);
  });
});

describe('the ownership refusals — M-2, held at the record level', () => {
  it('refuses a Security observation whose T1 threshold is not met', () => {
    const observation = admissibleObservation();
    const broken: SecurityObservation = {
      ...observation,
      claim: {
        ...observation.claim,
        ownership: { ...observation.claim.ownership, violenceOrProtectivePosture: false },
      },
    };

    expect(() => assertSecurityObservationIsWellFormed(broken)).toThrow(/SEC-OBS-7/);
  });

  /**
   * ══ THE REFUSAL THAT MATTERS MOST ══
   *
   * UNDETERMINED is not NOT_MET. A record whose armed-hostility criteria nobody has assessed
   * has no incident owner, and Security must not hold it because Conflict has not claimed it.
   */
  it('refuses an UNDETERMINED T2 — undefined is not a decided false', () => {
    const observation = admissibleObservation();
    const broken: SecurityObservation = {
      ...observation,
      claim: {
        ...observation.claim,
        ownership: {
          ...observation.claim.ownership,
          organisedArmedActorParticipates: undefined,
        },
      },
    };

    expect(() => assertSecurityObservationIsWellFormed(broken)).toThrow(/SEC-OBS-8/);
  });

  it('refuses a T2 that is true — that occurrence belongs to CONFLICT', () => {
    const observation = admissibleObservation();
    const broken: SecurityObservation = {
      ...observation,
      claim: {
        ...observation.claim,
        ownership: { ...observation.claim.ownership, organisedArmedActorParticipates: true },
      },
    };

    expect(() => assertSecurityObservationIsWellFormed(broken)).toThrow(/SEC-OBS-8/);
  });
});

describe('the axis refusals — one axis reachable, four structurally not', () => {
  it('refuses a claim that declares any axis other than OCCURRENCE', () => {
    for (const axis of SECURITY_AXES_NOT_REACHABLE_FROM_REPORTING) {
      const observation = admissibleObservation();
      const broken: SecurityObservation = {
        ...observation,
        claim: { ...observation.claim, axis },
      };
      expect(() => assertSecurityObservationIsWellFormed(broken)).toThrow(/SEC-OBS-4/);
    }
  });

  it('names OCCURRENCE as the one reachable axis, and the other four as unreachable', () => {
    expect(SECURITY_OBSERVED_AXIS).toBe('OCCURRENCE');
    expect([...SECURITY_AXES_NOT_REACHABLE_FROM_REPORTING].sort()).toEqual(
      ['ACTOR', 'CAUSE', 'POSTURE', 'SEVERITY'].sort(),
    );
    // Together they must be exactly the accepted five — no axis is silently unaccounted for.
    expect([SECURITY_OBSERVED_AXIS, ...SECURITY_AXES_NOT_REACHABLE_FROM_REPORTING].sort()).toEqual(
      [...SECURITY_COVERAGE_AXES].sort(),
    );
  });
});

describe('the attribution refusals', () => {
  it('refuses an observation with no claimant — an anonymous claim is not evidence', () => {
    const broken: SecurityObservation = { ...admissibleObservation(), claimant: '   ' };
    expect(() => assertSecurityObservationIsWellFormed(broken)).toThrow(/SEC-OBS-5b/);
  });

  it('refuses an observation with no headline', () => {
    const observation = admissibleObservation();
    const broken: SecurityObservation = {
      ...observation,
      claim: { ...observation.claim, headline: '  ' },
    };
    expect(() => assertSecurityObservationIsWellFormed(broken)).toThrow(/SEC-OBS-5/);
  });

  it('refuses an admission nobody can reproduce', () => {
    const observation = admissibleObservation();
    const broken: SecurityObservation = {
      ...observation,
      claim: { ...observation.claim, admittedByTerms: [] },
    };
    expect(() => assertSecurityObservationIsWellFormed(broken)).toThrow(/SEC-OBS-6/);
  });

  it('separates publisher-stated attributes from locally-asserted ones', () => {
    const byAttribute = new Map(
      SECURITY_CLAIM_AUTHORSHIP.map((row) => [row.attribute, row.authorship]),
    );
    expect(byAttribute.get('headline')).toBe('PUBLISHER_STATED');
    expect(byAttribute.get('summary')).toBe('PUBLISHER_STATED');
    // A locally-derived threshold must never be citable as something the publisher said.
    expect(byAttribute.get('admittedByTerms')).toBe('LOCALLY_ASSERTED');
    expect(byAttribute.get('ownership')).toBe('LOCALLY_ASSERTED');
  });
});

describe('the geography refusals — precision and provenance stay apart', () => {
  it('refuses UNKNOWN precision', () => {
    const observation = admissibleObservation();
    const broken: SecurityObservation = {
      ...observation,
      geography: { ...observation.geography, precision: 'UNKNOWN' },
    };
    expect(() => assertSecurityObservationIsWellFormed(broken)).toThrow(/SEC-OBS-11/);
  });

  it('refuses a subject and a geography that disagree', () => {
    const observation = admissibleObservation();
    const broken: SecurityObservation = { ...observation, subjectId: 'KE' };
    expect(() => assertSecurityObservationIsWellFormed(broken)).toThrow(/SEC-OBS-10/);
  });

  it('refuses an observation attributed to no geography', () => {
    const observation = admissibleObservation();
    const broken: SecurityObservation = {
      ...observation,
      subjectId: '',
      geography: { ...observation.geography, geographyId: '' },
    };
    expect(() => assertSecurityObservationIsWellFormed(broken)).toThrow(/SEC-OBS-9/);
  });
});

describe('the domain and kind refusals', () => {
  it('refuses an observation claiming another domain', () => {
    const observation = admissibleObservation();
    const identity = { ...observation.identity, domainId: 'CONFLICT' };
    const broken: SecurityObservation = {
      ...observation,
      identity,
      observationKey: domainObservationKey(identity),
    };
    expect(() => assertSecurityObservationIsWellFormed(broken)).toThrow(/SEC-OBS-1/);
  });

  it('refuses an undeclared observation kind', () => {
    const broken: SecurityObservation = {
      ...admissibleObservation(),
      observationKind: 'SECURITY_POSTURE_DECLARATION',
    };
    expect(() => assertSecurityObservationIsWellFormed(broken)).toThrow(/SEC-OBS-2/);
  });

  it('declares exactly one kind — a kind without a producer is not declared', () => {
    expect(SECURITY_OBSERVATION_KINDS).toEqual(['SECURITY_INCIDENT_REPORT']);
    expect(SECURITY_DOMAIN_ID).toBe('SECURITY');
  });
});

describe('the temporal model — a publication date is not an occurrence time', () => {
  it('refuses an OCCURRENCE basis with no occurredAt', () => {
    const observation = admissibleObservation();
    const broken: SecurityObservation = {
      ...observation,
      temporal: { ...observation.temporal, temporalBasis: 'OCCURRENCE' },
    };
    // The PLATFORM guard catches this one — SecurityObservation inherits it rather than
    // restating it, which is the whole reason it extends DomainObservation.
    expect(() => assertSecurityObservationIsWellFormed(broken)).toThrow(/PL-T-1/);
  });

  it('refuses a PUBLISHER_VINTAGE basis with no publisherVintage', () => {
    const observation = admissibleObservation();
    const broken: SecurityObservation = {
      ...observation,
      temporal: { ...observation.temporal, publisherVintage: undefined },
    };
    expect(() => assertSecurityObservationIsWellFormed(broken)).toThrow(/PL-T-2/);
  });

  it('accepts RETRIEVAL_ONLY with neither, because that is the honest weakest basis', () => {
    const observation = admissibleObservation();
    const retrievalOnly: SecurityObservation = {
      ...observation,
      temporal: {
        occurredAt: undefined,
        publisherVintage: undefined,
        retrievedAt: '2026-09-20T09:00:00.000Z',
        temporalBasis: 'RETRIEVAL_ONLY',
      },
    };
    expect(() => assertSecurityObservationIsWellFormed(retrievalOnly)).not.toThrow();
  });
});

describe('the reader projection is lossy, and that is the anti-oracle property', () => {
  it('collapses the seven internal states into three reader states', () => {
    const projected = new Set<ReaderAbsenceState>(
      OBSERVATION_ABSENCE_STATES.map((state) => readerAbsence(state)),
    );
    expect(OBSERVATION_ABSENCE_STATES).toHaveLength(7);
    expect(projected.size).toBe(3);
  });

  it('makes a withhold indistinguishable from an ordinary coverage gap', () => {
    // D-1: "a distinguishable withhold is an ORACLE."
    expect(readerAbsence('EVIDENCE_WITHHELD')).toBe('COVERAGE_GAP');
    expect(readerAbsence('COVERAGE_GAP')).toBe('COVERAGE_GAP');
    expect(readerAbsence('SOURCE_NOT_CONNECTED')).toBe('COVERAGE_GAP');
    expect(readerAbsence('SOURCE_TEMPORARILY_UNAVAILABLE')).toBe('COVERAGE_GAP');
    expect(readerAbsence('NO_QUALIFYING_EVIDENCE')).toBe('COVERAGE_GAP');
  });

  it('keeps NOT_ASSESSED distinct — it claims less than a coverage gap, not more', () => {
    expect(readerAbsence('NOT_ASSESSED')).toBe('NOT_ASSESSED');
  });
});

describe('what the record structurally cannot hold', () => {
  it('has no severity, cause, actor or posture field on the claim', () => {
    const claim = admissibleObservation().claim as unknown as Record<string, unknown>;
    // Not "is undefined" — ABSENT. A nullable field is a field a later producer fills.
    expect(Object.keys(claim).sort()).toEqual(
      ['admittedByTerms', 'axis', 'claimType', 'headline', 'ownership', 'summary'].sort(),
    );
  });

  it('has no natural-person field anywhere in the record', () => {
    const serialised = JSON.stringify(admissibleObservation()).toLowerCase();
    for (const forbidden of [
      'person',
      'nationality',
      'yearofbirth',
      'dateofbirth',
      'fullname',
      'suspectname',
      'victim',
    ]) {
      expect(serialised).not.toContain(`"${forbidden}"`);
    }
  });
});
