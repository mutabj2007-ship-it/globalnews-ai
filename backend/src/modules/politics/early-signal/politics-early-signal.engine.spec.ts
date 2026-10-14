/**
 * R66 T3 — Politics early-signal OFFLINE engine: negative, chronology, region and adapter tests.
 * Pure: no DB, network, provider, model, clock or Nest container. Synthetic fixtures only.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  EAST_AFRICA_MEMBERS,
  EU27_MEMBERS,
  MIDDLE_EAST_MEMBERS,
  POLITICS_ES_CONTRACT_VERSION,
  type RetainedPoliticsObservation,
} from '@globalnews-ai/shared';
import {
  forbiddenKeyPaths,
  impactOf,
  PREDICATE_RULES,
  reportingChainOf,
  runPoliticsEarlySignal,
} from './politics-early-signal.engine';
import {
  fromRetainedPoliticsObservation,
  PoliticsEarlySignalReadAdapter,
  POLITICS_EARLY_SIGNAL_PUBLIC_READ_ENABLED,
} from './politics-early-signal.read-adapter';
import { evaluation, STATE_FIXTURES, syn, SYNTHETIC_RIGHTS_HELD } from './fixtures/politics-early-signal.synthetic.fixtures';

const run = runPoliticsEarlySignal;
const wire = (id: string, host: string, cluster: string | null = null) =>
  syn(id, { host, publisherId: `syn:pub-${id}`, chain: { originSelf: false, declaredWireOrigin: 'SynWire', similarityClusterId: cluster } });

describe('R66 T3 · named reader states (one synthetic fixture each, for the frontend contract)', () => {
  it('EVIDENCE: two independent chains → CORROBORATED, OBSERVED_EFFECT, chain count 2', () => {
    const m = run(STATE_FIXTURES.EVIDENCE);
    expect(m.absence).toBeNull();
    expect(m.developments[0].statementStatus).toBe('CORROBORATED');
    expect(m.developments[0].sourceChainCount).toBe(2);
    expect(m.developments[0].impact.evidenceClass).toBe('OBSERVED_EFFECT');
  });
  it('ABSENCE_NO_MATCH: completed search, nothing matched → named absence, not "nothing happened"', () => {
    const m = run(STATE_FIXTURES.ABSENCE_NO_MATCH);
    expect(m.developments).toEqual([]);
    expect(m.absence).toEqual({ state: 'COMPLETED_NO_MATCH', wordingCode: 'SEARCH_COMPLETED_NO_MATCHING_REPORTS' });
  });
  it('RIGHTS_WITHHELD: all items held → RIGHTS_WITHHELD with a count, never no-match (F-1)', () => {
    const m = run(STATE_FIXTURES.RIGHTS_WITHHELD);
    expect(m.absence?.state).toBe('RIGHTS_WITHHELD');
    expect(m.withheld).toEqual({ count: 2, reasons: { RIGHTS_NOT_CLEARED: 2 } });
  });
  it('NOT_CHECKED: search never ran → SEARCH_NOT_RUN and lastEvaluatedAt null (F-3)', () => {
    const m = run(STATE_FIXTURES.NOT_CHECKED);
    expect(m.absence?.state).toBe('SEARCH_NOT_RUN');
    expect(m.evaluation.lastEvaluatedAt).toBeNull();
  });
  it('NO_CHANGE: same chains as baseline → NO_MATERIAL_CHANGE, with the evaluation time', () => {
    const m = run(STATE_FIXTURES.NO_CHANGE);
    expect(m.developments[0].change).toBe('NO_MATERIAL_CHANGE');
    expect(m.evaluation.lastEvaluatedAt).toBe('2026-01-10T12:00:00Z');
  });
  it('PROVIDER_FAILURE: keeps the last completed time, shows no developments, names the failure', () => {
    const m = run(STATE_FIXTURES.PROVIDER_FAILURE);
    expect(m.developments).toEqual([]);
    expect(m.absence?.state).toBe('PROVIDER_FAILED');
    expect(m.evaluation.lastEvaluatedAt).toBe('2026-01-09T12:00:00Z');
    expect(m.evaluation.lastAttempt).toEqual({ at: '2026-01-10T12:00:00Z', access: 'PROVIDER_FAILED' });
  });
  it('DISPUTED: only a human-reviewed pair of attributed claims; both claims kept', () => {
    const d = run(STATE_FIXTURES.DISPUTED).developments[0];
    expect(d.disputed).toEqual([{ claimKeys: ['deputies-3', 'deputies-4'], derivedBy: 'HUMAN_REVIEW', reviewedAt: '2026-01-10T11:00:00Z' }]);
    expect(d.claims.map((c) => c.claimKey)).toEqual(['deputies-3', 'deputies-4']);
  });
  it('CORRECTED: original kept as CORRECTED, correction CURRENT, corrected flag set, no summing', () => {
    const d = run(STATE_FIXTURES.CORRECTED).developments[0];
    expect(d.corrected).toBe(true);
    expect(d.claims.find((c) => c.claimKey === 'claim-co-a')?.status).toBe('CORRECTED');
    expect(d.claims.find((c) => c.claimKey === 'claim-co-b')?.status).toBe('CURRENT');
    expect(d.sourceChainCount).toBe(1);
    expect(d.requiresHumanReview).toBe(true);
  });
  it('every state fixture is SYNTHETIC_FIXTURE and every read model is contract v1 without forbidden keys', () => {
    for (const [name, f] of Object.entries(STATE_FIXTURES)) {
      expect(f.observations.every((o) => o.dataOrigin === 'SYNTHETIC_FIXTURE')).toBe(true);
      const m = run(f);
      expect(m.contractVersion).toBe(POLITICS_ES_CONTRACT_VERSION);
      expect([name, forbiddenKeyPaths(m)]).toEqual([name, []]);
    }
  });
});

describe('R66 T3 · negatives', () => {
  it('N-01 one wire on four hosts, same cluster → ONE chain, ATTRIBUTED, never corroborated', () => {
    const d = run({ observations: [wire('w1', 'a.synthetic.test', 'c'), wire('w2', 'b.synthetic.test', 'c'), wire('w3', 'c.synthetic.test', 'c'), wire('w4', 'd.synthetic.test', 'c')], evaluation: evaluation() }).developments[0];
    expect(d.sourceChainCount).toBe(1);
    expect(d.sourceChains).toEqual(['wire:synwire']);
    expect(d.statementStatus).toBe('ATTRIBUTED');
  });
  it('N-02 four rewrites with DIFFERENT headlines (clusters) but wire credit → still one chain', () => {
    const d = run({ observations: ['p', 'q', 'r', 's'].map((k, i) => wire(`rw${i}`, `${k}.synthetic.test`, k)), evaluation: evaluation() }).developments[0];
    expect(d.sourceChainCount).toBe(1);
    expect(d.statementStatus).toBe('ATTRIBUTED');
  });
  it('N-03 two items with no chain evidence → not established, never corroborated', () => {
    const o = (id: string) => syn(id, { chain: { originSelf: false } });
    const d = run({ observations: [o('u1'), o('u2')], evaluation: evaluation() }).developments[0];
    expect(d.sourceChainCount).toBe(0);
    expect(d.unestablishedChainItems).toBe(2);
    expect(d.statementStatus).toBe('ATTRIBUTED');
  });
  it('N-04 chain decision ignores host', () => {
    expect(reportingChainOf(wire('h1', 'x.synthetic.test')).chainId).toBe(reportingChainOf(wire('h1', 'y.synthetic.test')).chainId);
  });
  it('N-05 missing provider → withheld UNKNOWN_PROVENANCE', () => {
    const m = run({ observations: [syn('np', { deliveredByProviderId: null })], evaluation: evaluation() });
    expect(m.absence?.state).toBe('RIGHTS_WITHHELD');
    expect(m.withheld.reasons).toEqual({ UNKNOWN_PROVENANCE: 1 });
  });
  it('N-06 screenshot is never an origin (FRN shape, EA-ES-03): no development from a screenshot alone', () => {
    const m = run({ observations: [syn('shot', { artefactKind: 'SCREENSHOT', claim: { predicate: 'COALITION_ANNOUNCED' } })], evaluation: evaluation() });
    expect(m.developments).toEqual([]);
    expect(m.withheld.reasons).toEqual({ DERIVATIVE_ARTEFACT_REFUSED: 1 });
  });
  it('N-07 bare "Congo" decides nothing → country NOT_ESTABLISHED, region NOT_ESTABLISHED', () => {
    const d = run({ observations: [syn('bc', { places: [{ iso3: 'COD', locality: null, precision: 'COUNTRY', role: 'EVENT_PLACE', basis: 'OBSERVED_PRIMARY', bareCongo: true }] })], evaluation: evaluation() }).developments[0];
    expect(d.country).toEqual({ iso3: null, precision: 'NOT_ESTABLISHED', basis: 'NOT_ESTABLISHED' });
    expect(d.region).toBe('NOT_ESTABLISHED');
  });
  it('N-08 COD vs COG: conflicting observed event places → NOT_ESTABLISHED; COG office does not override a COD event', () => {
    const both = syn('cg', { places: [
      { iso3: 'COD', locality: null, precision: 'COUNTRY', role: 'EVENT_PLACE', basis: 'OBSERVED_PRIMARY' },
      { iso3: 'COG', locality: null, precision: 'COUNTRY', role: 'EVENT_PLACE', basis: 'OBSERVED_PRIMARY' },
    ] });
    expect(run({ observations: [both], evaluation: evaluation() }).developments[0].country.iso3).toBeNull();
    const office = syn('of', { places: [
      { iso3: 'COD', locality: 'Goma', precision: 'LOCALITY', role: 'EVENT_PLACE', basis: 'OBSERVED_PRIMARY' },
      { iso3: 'COG', locality: 'Brazzaville', precision: 'LOCALITY', role: 'OFFICE', basis: 'OBSERVED_PRIMARY' },
    ] });
    expect(run({ observations: [office], evaluation: evaluation() }).developments[0].country).toEqual({ iso3: 'COD', precision: 'LOCALITY', basis: 'OBSERVED_PRIMARY' });
  });
  it('N-09 client-requested country and publisher location are not event evidence', () => {
    const o = syn('cr', { places: [
      { iso3: 'COD', locality: null, precision: 'COUNTRY', role: 'CLIENT_REQUESTED', basis: 'OBSERVED_PRIMARY' },
      { iso3: 'RWA', locality: null, precision: 'COUNTRY', role: 'PUBLISHER_LOCATION', basis: 'OBSERVED_PRIMARY' },
    ] });
    expect(run({ observations: [o], evaluation: evaluation() }).developments[0].country.iso3).toBeNull();
  });
  it('N-10 FRN-shape announcement place is ATTRIBUTED (never observed) and classified East Africa', () => {
    const d = run({ observations: [syn('frn', { claim: { predicate: 'COALITION_ANNOUNCED' }, places: [{ iso3: 'COD', locality: 'Goma', precision: 'LOCALITY', role: 'ANNOUNCEMENT_PLACE', basis: 'ATTRIBUTED_BY_PUBLISHER' }] })], evaluation: evaluation() }).developments[0];
    expect(d.country).toEqual({ iso3: 'COD', precision: 'LOCALITY', basis: 'ATTRIBUTED_BY_PUBLISHER' });
    expect(d.region).toBe('EAST_AFRICA');
    expect(d.region).not.toBe('MIDDLE_EAST');
    expect(d.impact.evidenceClass).toBe('SUGGESTS_RISK_ONLY');
  });
  it('N-11 ambiguous event date → no merge; publication time is not back-filled as event time', () => {
    const a = syn('ad1', { claim: { eventTime: { from: null, to: null, basis: 'NOT_ESTABLISHED' } } });
    const b = syn('ad2');
    const m = run({ observations: [a, b], evaluation: evaluation() });
    expect(m.developments).toHaveLength(2);
    const lone = m.developments.find((d) => d.claims.some((c) => c.claimKey === 'claim-ad1'))!;
    expect(lone.timeline.eventTime).toEqual({ from: null, to: null, basis: 'NOT_ESTABLISHED' });
    expect(lone.timeline.earliestPublishedAt).toBe('2026-01-10T08:00:00Z');
  });
  it('N-12 Sep/Oct ambush shape: different incidents/dates/units → separate developments; nothing summed', () => {
    const sep = wire('amb-sep', 'w.synthetic.test');
    const sepO = { ...sep, places: [{ iso3: 'COD', locality: 'South Kivu', precision: 'ADMIN1' as const, role: 'EVENT_PLACE' as const, basis: 'OBSERVED_PRIMARY' as const }], claim: { ...sep.claim, predicate: 'CASUALTIES_REPORTED', incidentKey: 'syn-sep-ambush', eventTime: { from: '2025-09-17', to: '2025-09-17', basis: 'AS_REPORTED' as const }, quantity: { value: 20, unit: 'KILLED_OR_WOUNDED' as const, qualifier: 'ABOUT' as const } } };
    const oct = syn('amb-oct', { places: [{ iso3: 'COD', locality: null, precision: 'COUNTRY', role: 'EVENT_PLACE', basis: 'OBSERVED_PRIMARY' }], claim: { predicate: 'CASUALTIES_REPORTED', incidentKey: 'syn-oct-incidents', eventTime: { from: '2025-10-01', to: '2025-10-12', basis: 'AS_REPORTED' }, quantity: { value: 25, unit: 'KILLED', qualifier: 'EXACT' } } });
    const m = run({ observations: [sepO, oct], evaluation: evaluation() });
    expect(m.developments).toHaveLength(2);
    expect(JSON.stringify(m)).not.toMatch(/"(total|sum)"/);
    for (const d of m.developments) expect(d.requiresHumanReview).toBe(true);
  });
  it('N-13 retraction → development RETRACTED, chain count 0, impact INSUFFICIENT', () => {
    const d = run({ observations: [syn('rt-a'), syn('rt-b', { publisherId: 'syn:pub-rt-a', mutation: { kind: 'RETRACTED', supersedesObservationId: 'rt-a', observedAt: '2026-01-10T11:00:00Z' } })], evaluation: evaluation() }).developments[0];
    expect(d.retracted).toBe(true);
    expect(d.sourceChainCount).toBe(0);
    expect(d.impact).toEqual({ evidenceClass: 'INSUFFICIENT', hypotheses: [] });
  });
  it('N-14 a RULE-derived dispute is ignored; DISPUTED needs human review', () => {
    const f = STATE_FIXTURES.DISPUTED;
    const d = run({ ...f, humanDisputes: [{ ...f.humanDisputes![0], derivedBy: 'RULE' }] }).developments[0];
    expect(d.disputed).toEqual([]);
  });
  it('N-15 no baseline → change null (NEW is not derivable without run history)', () => {
    expect(run({ observations: [syn('nb')], evaluation: evaluation() }).developments[0].change).toBeNull();
  });
  it('N-16 first-seen is never taken from collection time; firstSeenAt null stays null', () => {
    const d = run({ observations: [syn('fs', { clocks: { firstSeenAt: null } })], evaluation: evaluation() }).developments[0];
    expect(d.timeline.earliestFirstSeenAt).toBeNull();
  });
  it('N-17 impact: unknown predicate → INSUFFICIENT; attributed effect → risk only, horizon UNSPECIFIED; never evaluated → no notBefore', () => {
    expect(impactOf(['SOMETHING_NEW'], true, '2026-01-10T12:00:00Z')).toEqual({ evidenceClass: 'INSUFFICIENT', hypotheses: [] });
    const att = impactOf(['FACILITY_CLOSED'], false, null);
    expect(att.evidenceClass).toBe('SUGGESTS_RISK_ONLY');
    for (const h of att.hypotheses) {
      expect(h.horizon).toBe('UNSPECIFIED');
      expect(h.nextCheck).toEqual(expect.objectContaining({ notBefore: null, basis: 'NOT_EVALUATED', scheduled: false }));
      expect(h.competingHypothesisCodes.length).toBeGreaterThan(0);
      expect(h.disconfirmerCodes.length).toBeGreaterThan(0);
    }
  });
  it('N-18 every impact rule carries competing hypotheses, disconfirmers and a check condition; domains are the R66 six', () => {
    const domains = new Set(['PEOPLE', 'TRANSPORT', 'TRADE', 'JOBS', 'HUMANITARIAN_ACCESS', 'SERVICES']);
    for (const r of Object.values(PREDICATE_RULES))
      for (const h of r.hypotheses) {
        expect(domains.has(h.domain)).toBe(true);
        expect(h.competing.length && h.disconfirmers.length && h.nextCheck.length).toBeTruthy();
      }
  });
  it('N-19 genuine no-change notice (EPRA-shape, EA-ES-11) is NO_CHANGE_NOTICE, not a risk', () => {
    expect(impactOf(['PRICE_REVIEW_UNCHANGED'], true, '2026-01-10T12:00:00Z').evidenceClass).toBe('NO_CHANGE_NOTICE');
  });
  it('N-20 PARTIAL access → no developments, named partial absence', () => {
    const m = run({ observations: [syn('pa')], evaluation: evaluation({ access: 'PARTIAL', previousCompletedAt: null }) });
    expect(m.absence).toEqual({ state: 'PARTIAL', wordingCode: 'SEARCH_INCOMPLETE_SOME_SOURCES_UNAVAILABLE' });
    expect(m.evaluation.lastEvaluatedAt).toBeNull();
  });
});

describe('R66 T3 · chronology (EA-shaped synthetic replays; evaluation steps in order)', () => {
  it('C-01 ambush shape (EA-ES-01): unplaced early trace → wire report → syndications add nothing → independent outlet adds evidence', () => {
    const early = syn('c1-trace', { places: [], claim: { incidentKey: null, eventTime: { from: null, to: null, basis: 'NOT_ESTABLISHED' }, predicate: 'CASUALTIES_REPORTED' } });
    const t0 = run({ observations: [early], evaluation: evaluation({ attemptedAt: '2026-01-01T00:00:00Z' }) });
    expect(t0.developments[0].region).toBe('NOT_ESTABLISHED');
    expect(t0.developments[0].change).toBeNull();

    const place = [{ iso3: 'COD', locality: 'South Kivu', precision: 'ADMIN1' as const, role: 'EVENT_PLACE' as const, basis: 'OBSERVED_PRIMARY' as const }];
    const mk = (o: ReturnType<typeof syn>) => ({ ...o, places: place, claim: { ...o.claim, predicate: 'CASUALTIES_REPORTED', incidentKey: 'syn-ambush', eventTime: { from: '2025-09-17', to: '2025-09-17', basis: 'AS_REPORTED' as const } } });
    const w0 = mk(wire('c1-w0', 'wire.synthetic.test'));
    const t1 = run({ observations: [w0], evaluation: evaluation({ attemptedAt: '2026-01-02T00:00:00Z', previousCompletedAt: '2026-01-01T00:00:00Z', baseline: {} }) });
    expect(t1.developments[0].region).toBe('EAST_AFRICA');
    expect(t1.developments[0].sourceChains).toEqual(['wire:synwire']);

    const copies = ['c1-w1', 'c1-w2', 'c1-w3'].map((id) => mk(wire(id, `${id}.synthetic.test`)));
    const t2 = run({ observations: [w0, ...copies], evaluation: evaluation({ attemptedAt: '2026-01-03T00:00:00Z', previousCompletedAt: '2026-01-02T00:00:00Z', baseline: { 'syn-ambush': ['wire:synwire'] } }) });
    expect(t2.developments[0].change).toBe('NO_MATERIAL_CHANGE');
    expect(t2.developments[0].statementStatus).toBe('ATTRIBUTED');

    const indepOutlet = mk(syn('c1-nz'));
    const t3 = run({ observations: [w0, ...copies, indepOutlet], evaluation: evaluation({ attemptedAt: '2026-01-04T00:00:00Z', previousCompletedAt: '2026-01-03T00:00:00Z', baseline: { 'syn-ambush': ['wire:synwire'] } }) });
    expect(t3.developments[0].change).toBe('NEW_EVIDENCE');
    expect(t3.developments[0].sourceChainCount).toBe(2);
    expect(t3.developments[0].statementStatus).toBe('CORROBORATED');
    expect(t3.developments[0].requiresHumanReview).toBe(true);
  });
  it('C-02 successive tolls (Rubavu-shape, EA-ES-05) are UPDATES: latest CURRENT, earlier SUPERSEDED, never added', () => {
    const q = (v: number) => ({ value: v, unit: 'KILLED' as const, qualifier: 'AT_LEAST' as const });
    const a = syn('toll-1', { claim: { predicate: 'CASUALTIES_REPORTED', quantity: q(3) } });
    const b = syn('toll-2', { publisherId: 'syn:pub-toll-1', claim: { predicate: 'CASUALTIES_REPORTED', quantity: q(7) }, mutation: { kind: 'UPDATE', supersedesObservationId: 'toll-1', observedAt: '2026-01-11T00:00:00Z' } });
    const d = run({ observations: [a, b], evaluation: evaluation() }).developments[0];
    expect(d.claims.map((c) => [c.claimKey, c.status, c.quantity?.value])).toEqual([['claim-toll-1', 'SUPERSEDED_BY_UPDATE', 3], ['claim-toll-2', 'CURRENT', 7]]);
    expect(d.corrected).toBe(false);
    expect(d.sourceChainCount).toBe(1);
  });
  it('C-03 outbreak declared → ended (Ebola-shape, EA-ES-07): two separate notices, end notice is NO_CHANGE_NOTICE', () => {
    const decl = syn('ob-1', { claim: { predicate: 'OUTBREAK_DECLARED', incidentKey: 'syn-outbreak' } });
    const end = syn('ob-2', { claim: { predicate: 'OUTBREAK_ENDED', incidentKey: 'syn-outbreak-end', eventTime: { from: '2026-02-20', to: '2026-02-20' } } });
    const m = run({ observations: [decl, end], evaluation: evaluation() });
    expect(m.developments).toHaveLength(2);
    expect(m.developments.find((d) => d.developmentKey === 'syn-outbreak-end')!.impact.evidenceClass).toBe('NO_CHANGE_NOTICE');
  });
  it('C-04 next-check notBefore is derived from the LAST COMPLETED evaluation, never from a provider-failed attempt', () => {
    const ok = run({ observations: [syn('nx')], evaluation: evaluation({ attemptedAt: '2026-01-10T12:00:00Z' }) });
    expect(ok.developments[0].impact.hypotheses[0].nextCheck.notBefore).toBe('2026-01-11T00:00:00.000Z'); // FACILITY_CLOSED: +12h
    const failed = run({ observations: [syn('nx')], evaluation: evaluation({ attemptedAt: '2026-01-12T12:00:00Z', access: 'PROVIDER_FAILED', previousCompletedAt: '2026-01-10T12:00:00Z' }) });
    expect(failed.evaluation.lastEvaluatedAt).toBe('2026-01-10T12:00:00Z');
    expect(failed.developments).toEqual([]);
  });
  it('C-05 connectivity shutdown (Tanzania-shape, EA-ES-08): attributed only → risk; corroborated → observed effect now', () => {
    const one = run({ observations: [syn('ct-1', { claim: { predicate: 'CONNECTIVITY_DISRUPTED' }, places: [{ iso3: 'TZA', locality: null, precision: 'COUNTRY', role: 'EVENT_PLACE', basis: 'OBSERVED_PRIMARY' }] })], evaluation: evaluation() });
    expect(one.developments[0].impact.evidenceClass).toBe('SUGGESTS_RISK_ONLY');
    const two = run({ observations: ['ct-1', 'ct-2'].map((id) => syn(id, { claim: { predicate: 'CONNECTIVITY_DISRUPTED' }, places: [{ iso3: 'TZA', locality: null, precision: 'COUNTRY', role: 'EVENT_PLACE', basis: 'OBSERVED_PRIMARY' }] })), evaluation: evaluation() });
    expect(two.developments[0].impact.evidenceClass).toBe('OBSERVED_EFFECT');
    expect(two.developments[0].impact.hypotheses.every((h) => h.horizon === 'OBSERVED_NOW')).toBe(true);
  });
  it('C-06 Finance-bill-shape (EA-ES-09): protest → legislative withdrawal stay separate developments with own predicates', () => {
    const protest = syn('fb-1', { claim: { predicate: 'PROTEST_HELD', incidentKey: 'syn-protest' } });
    const leg = syn('fb-2', { claim: { predicate: 'LEGISLATIVE_STAGE', incidentKey: 'syn-bill' } });
    const m = run({ observations: [protest, leg], evaluation: evaluation() });
    expect(m.developments.map((d) => d.developmentKey)).toEqual(['syn-bill', 'syn-protest']);
  });
});

describe('R66 T3 · regions (EA11 behaviourally; EU27 and ME16 structurally; reviewer status honest)', () => {
  const at = (iso3: string) => run({ observations: [syn(`r-${iso3}`, { places: [{ iso3, locality: null, precision: 'COUNTRY', role: 'EVENT_PLACE', basis: 'OBSERVED_PRIMARY' }] })], evaluation: evaluation() }).developments[0];
  it.each([...EAST_AFRICA_MEMBERS])('EA11 %s → EAST_AFRICA, EA validator review pending', (iso3) => {
    const d = at(iso3);
    expect([d.region, d.regionalReview]).toEqual(['EAST_AFRICA', 'EA_VALIDATOR_REVIEW_PENDING']);
  });
  it('EU27: all 27 → EU27, REVIEWER_UNBOUND (not certified)', () => {
    expect(EU27_MEMBERS).toHaveLength(27);
    for (const iso3 of EU27_MEMBERS) expect([at(iso3).region, at(iso3).regionalReview]).toEqual(['EU27', 'REVIEWER_UNBOUND']);
  });
  it('ME16: all 16 → MIDDLE_EAST, REVIEWER_UNBOUND (not certified)', () => {
    expect(MIDDLE_EAST_MEMBERS).toHaveLength(16);
    for (const iso3 of MIDDLE_EAST_MEMBERS) expect([at(iso3).region, at(iso3).regionalReview]).toEqual(['MIDDLE_EAST', 'REVIEWER_UNBOUND']);
  });
  it('outside the 54 → OUTSIDE_DECLARED_SCOPE; COG is not East Africa', () => {
    expect(at('COG').region).toBe('OUTSIDE_DECLARED_SCOPE');
    expect(at('USA').region).toBe('OUTSIDE_DECLARED_SCOPE');
  });
});

describe('R66 T3 · read adapter (versioned, read-only, disabled for public)', () => {
  it('public read is DISABLED by code literal', () => {
    expect(POLITICS_EARLY_SIGNAL_PUBLIC_READ_ENABLED).toBe(false);
    expect(new PoliticsEarlySignalReadAdapter({ kind: 'FIXTURE_LOCAL', input: STATE_FIXTURES.EVIDENCE }).readPublic()).toEqual({ contractVersion: 'politics-early-signal/v1', status: 'DISABLED', reason: 'RELEASE_GATES_NOT_MET' });
  });
  it('even if the gate were open, synthetic data is REFUSED for public readers', () => {
    expect(new PoliticsEarlySignalReadAdapter({ kind: 'FIXTURE_LOCAL', input: STATE_FIXTURES.EVIDENCE }, true).readPublic()).toEqual({ contractVersion: 'politics-early-signal/v1', status: 'REFUSED', reason: 'SYNTHETIC_DATA_NEVER_PUBLIC' });
  });
  it('fixture-local read refuses non-synthetic observations', () => {
    const bad = { ...STATE_FIXTURES.EVIDENCE, observations: [{ ...STATE_FIXTURES.EVIDENCE.observations[0], dataOrigin: 'RETAINED' as const }] };
    expect(() => new PoliticsEarlySignalReadAdapter({ kind: 'FIXTURE_LOCAL', input: bad }).readFixtureLocal()).toThrow('SYNTHETIC_FIXTURE observations only');
  });
  it('retained Politics observations map with every use HOLD → RIGHTS_WITHHELD; none shown', () => {
    const retained = {
      observationKey: 'k1', identity: { domainId: 'POLITICS', upstreamAuthority: 'syn:authority', upstreamId: '1' },
      observationKind: 'LEGISLATIVE_STAGE', subjectType: 'LEGISLATIVE_PROCESS', subjectId: 's1',
      claim: { kind: 'LEGISLATIVE_STAGE', stage: 'INTRODUCED', sourceText: 'synthetic' },
      temporal: { retrievedAt: '2026-01-10T00:00:00Z', temporalBasis: 'PUBLISHER_VINTAGE' },
      publishedAt: '2026-01-09T00:00:00Z', artifactSha256: 'x',
    } as unknown as RetainedPoliticsObservation;
    expect(fromRetainedPoliticsObservation(retained).rights).toEqual(SYNTHETIC_RIGHTS_HELD);
    const m = new PoliticsEarlySignalReadAdapter({ kind: 'RETAINED', observations: [retained], evaluation: evaluation() }).readRetainedOffline();
    expect(m.absence?.state).toBe('RIGHTS_WITHHELD');
    expect(m.developments).toEqual([]);
  });
  it('live Alpha state today (no retained captures, no search) → SEARCH_NOT_RUN, never "nothing happened"', () => {
    const m = new PoliticsEarlySignalReadAdapter({ kind: 'RETAINED', observations: [], evaluation: evaluation({ access: 'SEARCH_NOT_RUN' }) }).readRetainedOffline();
    expect(m.absence).toEqual({ state: 'SEARCH_NOT_RUN', wordingCode: 'NO_SEARCH_HAS_RUN' });
  });
});

describe('R66 T3 · structural guards (zero runtime wiring)', () => {
  const read = (p: string) => readFileSync(join(__dirname, p), 'utf8');
  it('politics.module.ts and app.module.ts do not import the early-signal engine, adapter or fixtures', () => {
    expect(read('../politics.module.ts')).not.toMatch(/early-signal/);
    expect(read('../../../app.module.ts')).not.toMatch(/early-signal/);
  });
  it('engine and adapter declare no controller, schedule, timer, network or DB access', () => {
    for (const f of ['politics-early-signal.engine.ts', 'politics-early-signal.read-adapter.ts']) {
      const src = read(f);
      expect(src).not.toMatch(/@Controller|@Cron|@Interval|setInterval\(|setTimeout\(|fetch\(|PrismaService|HttpService|Date\.now\(|new Date\(\)/);
    }
  });
  it('the frozen WatchChangeState union is not extended by the contract (only the two derivable members appear)', () => {
    const contract = readFileSync(join(__dirname, '../../../../../shared/src/politics/early-signal.ts'), 'utf8');
    expect(contract).not.toMatch(/WatchChangeState\s*=/);
    expect(contract).toMatch(/'NEW_EVIDENCE' \| 'NO_MATERIAL_CHANGE' \| null/);
  });
});
