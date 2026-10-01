/**
 * MAIN-HUMANITARIAN-DATA-AUTHORITY-R1 — contract/validator spec.
 *
 * Within Main's ownership only: this file tests the canonical record contract. It starts no
 * transport, activates no producer, touches no database and asserts nothing about Admin,
 * frontend visuals, caching, PWA behaviour or Ask routing.
 *
 * Malformed, oversized and unknown evidence must FAIL CLOSED, and each refusal below names
 * the code it is held to so a reviewer can see the rule rather than infer it.
 */

import {
  HUMANITARIAN_DOMAIN_ID,
  HUMANITARIAN_OBSERVATION_KINDS,
  HUMANITARIAN_HAZARD_TYPES,
  HUMANITARIAN_IMPACT_MEASURES,
  HUMANITARIAN_STATUS_MEASURES,
  GDACS_EVENTTYPE_TO_HAZARD,
  hazardFromSourceCode,
  assertHumanitarianClaimIsWellFormed,
  impactAuthorship,
  humanitarianIdentity,
  HumanitarianRecordRefused,
  type HumanitarianEventClaim,
  type HumanitarianImpactAssertionClaim,
} from './observation';

const event = (o: Partial<HumanitarianEventClaim> = {}): HumanitarianEventClaim => ({
  claimType: 'HUMANITARIAN_EVENT',
  hazardType: 'FLOOD',
  sourceNativeType: 'FL',
  sourceTitle: 'Flood in X',
  eventStatus: 'ONGOING',
  countryIso3: ['RWA'],
  ...o,
});

const impact = (
  o: Partial<HumanitarianImpactAssertionClaim> = {},
): HumanitarianImpactAssertionClaim => ({
  claimType: 'HUMANITARIAN_IMPACT_ASSERTION',
  measure: 'FATALITIES',
  value: 12,
  unit: 'PERSONS',
  basis: 'SOURCE_STATED',
  sourceBasisStatement: '12 dead, government figure',
  aboutEventKey: 'obs:1:12:HUMANITARIAN:5:GDACS:4:1234',
  countryIso3: ['RWA'],
  ...o,
});

describe('the canonical Humanitarian record reuses the platform, and mints no second system', () => {
  it('uses the domain id the Copernicus scaffold already emits', () => {
    expect(HUMANITARIAN_DOMAIN_ID).toBe('HUMANITARIAN');
  });

  it('declares a closed three-member observation-kind registry', () => {
    expect(HUMANITARIAN_OBSERVATION_KINDS).toHaveLength(3);
    expect([...HUMANITARIAN_OBSERVATION_KINDS]).toEqual([
      'HUMANITARIAN_EVENT',
      'HUMANITARIAN_REPORT',
      'HUMANITARIAN_IMPACT_ASSERTION',
    ]);
  });

  it('never lets a caller choose the domain id', () => {
    expect(humanitarianIdentity('GDACS', '1234').domainId).toBe('HUMANITARIAN');
  });

  it('puts the asserted/estimated distinction on the platform authorship axis', () => {
    expect(impactAuthorship('SOURCE_STATED')[0]).toEqual({
      attribute: 'value',
      authorship: 'PUBLISHER_STATED',
    });
    expect(impactAuthorship('SOURCE_ESTIMATED')[0]!.authorship).toBe('LOCALLY_ASSERTED');
  });
});

describe('kind and claim may not disagree', () => {
  it('admits a well-formed event', () => {
    expect(() => assertHumanitarianClaimIsWellFormed('HUMANITARIAN_EVENT', event())).not.toThrow();
  });

  it('HUM-K-1 refuses an observation kind outside the registry', () => {
    expect(() => assertHumanitarianClaimIsWellFormed('HUMANITARIAN_THING', event())).toThrow(
      /HUM-K-1/,
    );
  });

  it('HUM-K-2 refuses a kind that disagrees with its claimType', () => {
    expect(() => assertHumanitarianClaimIsWellFormed('HUMANITARIAN_REPORT', event())).toThrow(
      /HUM-K-2/,
    );
  });

  it('refuses with the contract error type, not a bare Error', () => {
    expect(() => assertHumanitarianClaimIsWellFormed('x', event())).toThrow(
      HumanitarianRecordRefused,
    );
  });
});

describe('country scope is the source’s, verbatim or absent', () => {
  it('HUM-C-1 refuses a two-letter code', () => {
    expect(() =>
      assertHumanitarianClaimIsWellFormed('HUMANITARIAN_EVENT', event({ countryIso3: ['RW'] })),
    ).toThrow(/HUM-C-1/);
  });

  it('HUM-C-1 refuses lowercase — we do not normalize on the source’s behalf', () => {
    expect(() =>
      assertHumanitarianClaimIsWellFormed('HUMANITARIAN_EVENT', event({ countryIso3: ['rwa'] })),
    ).toThrow(/HUM-C-1/);
  });

  it('admits an empty list, because a source may not scope an event to countries', () => {
    expect(() =>
      assertHumanitarianClaimIsWellFormed('HUMANITARIAN_EVENT', event({ countryIso3: [] })),
    ).not.toThrow();
  });
});

describe('a hazard we cannot map is refused, never bucketed', () => {
  it('maps the codes GDACS itself publishes', () => {
    expect(hazardFromSourceCode('GDACS', 'EQ')).toBe('EARTHQUAKE');
    expect(hazardFromSourceCode('GDACS', 'TC')).toBe('TROPICAL_CYCLONE');
    expect(hazardFromSourceCode('RELIEFWEB', 'Earthquake')).toBe('EARTHQUAKE');
  });

  it('HUM-HAZ-1 refuses an unmapped code', () => {
    expect(() => hazardFromSourceCode('GDACS', 'XX')).toThrow(/HUM-HAZ-1/);
  });

  it('offers no OTHER or UNKNOWN member for an unmapped hazard to fall into', () => {
    expect(HUMANITARIAN_HAZARD_TYPES.filter((h) => /OTHER|UNKNOWN|MISC/.test(h))).toEqual([]);
  });

  it('HUM-E-1 keeps the source-native code, because it is what makes the mapping auditable', () => {
    expect(() =>
      assertHumanitarianClaimIsWellFormed('HUMANITARIAN_EVENT', event({ sourceNativeType: '  ' })),
    ).toThrow(/HUM-E-1/);
  });

  it('positive control: every mapped GDACS code is a declared hazard type', () => {
    for (const hazard of Object.values(GDACS_EVENTTYPE_TO_HAZARD)) {
      expect(HUMANITARIAN_HAZARD_TYPES).toContain(hazard);
    }
  });
});

describe('an impact assertion carries one measure, with a unit and a basis', () => {
  it('admits a well-formed count', () => {
    expect(() =>
      assertHumanitarianClaimIsWellFormed('HUMANITARIAN_IMPACT_ASSERTION', impact()),
    ).not.toThrow();
  });

  it('HUM-I-1 refuses an assertion that names no event', () => {
    expect(() =>
      assertHumanitarianClaimIsWellFormed(
        'HUMANITARIAN_IMPACT_ASSERTION',
        impact({ aboutEventKey: '' }),
      ),
    ).toThrow(/HUM-I-1/);
  });

  it.each([
    ['a word', 'many' as unknown as number],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('HUM-I-2 refuses %s as a count', (_label, value) => {
    expect(() =>
      assertHumanitarianClaimIsWellFormed('HUMANITARIAN_IMPACT_ASSERTION', impact({ value })),
    ).toThrow(/HUM-I-2/);
  });

  it('HUM-I-3 refuses a negative count', () => {
    expect(() =>
      assertHumanitarianClaimIsWellFormed('HUMANITARIAN_IMPACT_ASSERTION', impact({ value: -1 })),
    ).toThrow(/HUM-I-3/);
  });

  it('HUM-I-4 requires a unit, so "households" is never read as "people"', () => {
    expect(() =>
      assertHumanitarianClaimIsWellFormed('HUMANITARIAN_IMPACT_ASSERTION', impact({ unit: '' })),
    ).toThrow(/HUM-I-4/);
  });

  it('HUM-I-6 requires the source sentence the basis was read from', () => {
    expect(() =>
      assertHumanitarianClaimIsWellFormed(
        'HUMANITARIAN_IMPACT_ASSERTION',
        impact({ sourceBasisStatement: ' ' }),
      ),
    ).toThrow(/HUM-I-6/);
  });

  it('admits zero WHEN A SOURCE ASSERTS IT — asserted zero is evidence', () => {
    expect(() =>
      assertHumanitarianClaimIsWellFormed('HUMANITARIAN_IMPACT_ASSERTION', impact({ value: 0 })),
    ).not.toThrow();
  });
});

describe('status measures are categorical and stay apart from counts', () => {
  it('admits a status measure carrying the source’s own term', () => {
    expect(() =>
      assertHumanitarianClaimIsWellFormed(
        'HUMANITARIAN_IMPACT_ASSERTION',
        impact({ measure: 'SHELTER_STATUS', value: 'severely constrained', unit: undefined }),
      ),
    ).not.toThrow();
  });

  it('HUM-I-5 refuses a number for a status measure', () => {
    expect(() =>
      assertHumanitarianClaimIsWellFormed(
        'HUMANITARIAN_IMPACT_ASSERTION',
        impact({ measure: 'SHELTER_STATUS', value: 3, unit: undefined }),
      ),
    ).toThrow(/HUM-I-5/);
  });

  it('the two measure vocabularies share no member', () => {
    const overlap = HUMANITARIAN_IMPACT_MEASURES.filter((m) =>
      (HUMANITARIAN_STATUS_MEASURES as readonly string[]).includes(m),
    );
    expect(overlap).toEqual([]);
  });
});

describe('zero is never inferred from absence, structurally', () => {
  it('no event field names an impact measure, so there is no field to be missing', () => {
    /*
      R-READER-1. The first version of this check matched the SUBSTRING "count" and flagged
      `countryIso3`, which is a country list and not a quantity. The repair belongs in the
      reader: test the PROPERTY — no event field may name a member of the impact vocabulary.
    */
    const flat = (s: string) => s.replace(/_/g, '').toLowerCase();
    const measures = [...HUMANITARIAN_IMPACT_MEASURES, ...HUMANITARIAN_STATUS_MEASURES].map(flat);
    const namesAMeasure = (key: string) => measures.some((m) => flat(key).includes(m));

    expect(Object.keys(event()).filter(namesAMeasure)).toEqual([]);

    /* positive control: the repaired check still catches a genuine quantity field. */
    const mutated = { ...event(), peopleAffected: 0 } as Record<string, unknown>;
    expect(Object.keys(mutated).filter(namesAMeasure)).toEqual(['peopleAffected']);
  });
});
