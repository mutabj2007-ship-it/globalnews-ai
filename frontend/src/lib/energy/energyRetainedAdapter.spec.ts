import { energyFrameFromRetained } from './energyRetainedAdapter';
import { ENERGY_GOVERNED_FRAME } from './energyGoverned';
import { isEnergyObservation, type EnergyObservation } from '@globalnews-ai/shared';
import { energyHref, energyStateFromSearchParams } from './energyUrl';
// Explicitly synthetic test records, never loaded by a runtime route.
const fact = (overrides: Partial<EnergyObservation> = {}): EnergyObservation => ({
  observationKey: 'test-observation', subjectId: 'test-subject', subjectName: 'Test subject',
  subjectType: 'GRID_SITUATION', geographyId: 'PL', spatialPrecision: 'COUNTRY',
  metric: 'FLOW', period: '2026-08', value: 0, unit: 'MWh', releaseStatus: 'PRELIMINARY',
  publisherChangedAt: null, retrievalId: 'test-retrieval', freshnessBasis: 'RETAINED_ONLY',
  provenance: { sourceType: 'PUBLIC_DATA', evidenceRole: 'REFERENCE_DATA', institution: 'Test authority', providerId: 'TEST', retrievedAt: '2026-09-01T00:00:00.000Z' },
  ...overrides,
});
const adapt = (observations: EnergyObservation[], locale: 'en' | 'pl' = 'en') => energyFrameFromRetained({ kind: 'OBSERVATIONS', observations }, locale);
it.each(['EMPTY', 'UNAVAILABLE'] as const)('preserves exact governed absence frame for %s', kind => {
  expect(energyFrameFromRetained({kind, observations: []}, 'en')).toBe(ENERGY_GOVERNED_FRAME);
});
it.each(['SUPPLY_SITUATION', 'CORRIDOR', 'INFRASTRUCTURE_ASSET', 'GRID_SITUATION'] as const)('binds exact %s identity with a working selection URL', subjectType => {
  const o = fact({ subjectType });
  const subject = adapt([o]).subjects[0];
  expect(subject.type).toBe(subjectType);
  const url = energyHref({ substrate: 'spatial', window: '7d', subject: subject.id });
  expect(energyStateFromSearchParams(new URL(url, 'http://localhost').searchParams).subject).toBe(subject.id);
});
it.each(['en', 'pl'] as const)('binds zero, period, authority, provenance and retrieval in existing %s detail slots', locale => {
  const frame = adapt([fact()], locale);
  const subject = frame.subjects[0];
  const values = subject.fields.map(f => f.value);
  expect(values).toEqual(expect.arrayContaining(['0 MWh', '2026-08', 'Test authority · TEST', 'test-retrieval', 'COUNTRY', 'REFERENCE_DATA']));
  expect(subject.fields[0].key).toContain(locale === 'pl' ? 'Obserwacja' : 'Observation');
  expect(subject.fields[1].value).toBe(locale === 'pl' ? 'Przepływ' : 'Flow');
  expect(subject.evidence[0].title).toContain('Test authority');
  expect(subject.evidence[0].disclosure).toEqual({ rights: 'RIGHTS_ALLOWED', exposure: 'EXPOSURE_ALLOWED' });
});
it('raw FLOW and STORAGE cannot populate assessed ratios, changes, geometry, Watch or confidence', () => {
  const frame = adapt([fact(), fact({ observationKey: 'storage', metric: 'STORAGE', value: 72, unit: 'GWh' })]);
  expect(frame.subjects).toHaveLength(1);
  for (const key of ['feed', 'changeRows', 'flowNodes', 'flowLinks', 'dependence', 'storage', 'spatialGeometry', 'withheldGeometry'] as const) expect(frame[key]).toEqual([]);
  expect(frame.subjects[0]).toMatchObject({ changeState: null, assessment: null, confidence: null, geometry: null, watched: null, corridorRole: null, assetRole: null, lastChecked: null, nextCheck: null, artifactsReviewed: 0, timeline: [], crossDomain: [] });
  expect(frame.watchCount).toBeNull();
  expect(frame.zones).toBe(ENERGY_GOVERNED_FRAME.zones);
  expect(frame.subjects[0]).not.toHaveProperty('attentionRank');
});
it('keeps null numeric values absent while preserving the unit', () => {
  expect(adapt([fact({value: null})]).subjects[0].fields.map(f => f.value)).toContain('— MWh');
});
it('fails closed on generic types, withdrawn records and conflicting subject identity', () => {
  expect(isEnergyObservation(fact({subjectType: 'SYSTEM' as any}))).toBe(false);
  expect(adapt([fact({subjectType: 'SYSTEM' as any})])).toBe(ENERGY_GOVERNED_FRAME);
  expect(adapt([fact({releaseStatus: 'WITHDRAWN'})])).toBe(ENERGY_GOVERNED_FRAME);
  expect(adapt([fact(), fact({observationKey: 'other', subjectType: 'CORRIDOR'})])).toBe(ENERGY_GOVERNED_FRAME);
});
it('uses lexical subject order without an attention feed and retains all observations', () => {
  const data = adapt([fact({subjectId: 'z'}), fact({subjectId: 'a'})]);
  expect(data.subjects.map(s => s.fields.find(f => f.key === 'Subject identity')?.value)).toEqual(['a','z']);
  expect(data.feed).toEqual([]);
});
it('keeps URI-shaped source identities reachable without coercing their meaning', () => {
  const id = 'urn:authority:energy:system/a';
  const subject = adapt([fact({subjectId:id})]).subjects[0];
  expect(subject.fields.map(f => f.value)).toContain(id);
  const url = energyHref({substrate:'spatial',window:'7d',subject:subject.id});
  expect(energyStateFromSearchParams(new URL(url,'http://localhost').searchParams).subject).toBe(subject.id);
  expect(subject.geometry).toBeNull();
});
it.each(['en','pl'] as const)('banner distinguishes retained, empty and unavailable reads in %s', locale => {
  const { energyRetainedStrings } = require('./energyRetainedAdapter');
  const empty = energyRetainedStrings({kind:'EMPTY', observations:[]},locale);
  const unavailable = energyRetainedStrings({kind:'UNAVAILABLE', observations:[]},locale);
  const retained = energyRetainedStrings({kind:'OBSERVATIONS', observations:[fact()]},locale);
  expect(unavailable.governedBanner).not.toBe(empty.governedBanner);
  expect(retained.governedBanner).not.toBe(empty.governedBanner);
  expect(retained.governedBanner).not.toBe(unavailable.governedBanner);
});
