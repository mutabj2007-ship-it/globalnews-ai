import assert from 'node:assert/strict';
import test from 'node:test';
import { readDataset, validateDataset } from './verify-middle-east-source-packs.mjs';

const fixture = readDataset();
const get = (data, country) => data.countries.find((p) => p.country === country);
test('complete dormant pack validates without network or application imports', () => {
  const report = validateDataset(fixture);
  assert.equal(report.countries, 16);
  assert.equal(report.sourceCandidates, 50);
  assert.equal(report.activeSources + report.rightsBindings + report.verifiedFeeds, 0);
  assert.ok(report.summaries.every((s) => s.localNewsPublisherCandidates >= 2));
  assert.ok(report.summaries.find((s) => s.country === 'ISR').languageTargetsWithoutObservedEdition.includes('ar'));
  assert.ok(report.summaries.find((s) => s.country === 'PSE').languageTargetsWithoutObservedLocalNews.includes('en'));
  assert.ok(report.summaries.find((s) => s.country === 'KWT').languageTargetsWithoutObservedLocalNews.includes('ar'));
});
const cases = [
  ['country omitted', (d) => d.countries.pop()],
  ['baseline expanded', (d) => d.pack.baseline.push('CYP')],
  ['baseline reordered', (d) => d.pack.baseline.reverse()],
  ['manifest path escape', (d) => d.pack.countries[0].manifest = '../outside.json'],
  ['source activated', (d) => d.countries[0].sources[0].enabled = true],
  ['pack activated', (d) => d.pack.enabled = true],
  ['country activated', (d) => d.countries[0].enabled = true],
  ['Alpha activated', (d) => d.pack.alphaActivation = true],
  ['production HOLD removed', (d) => d.pack.productionHold = false],
  ['political sentiment enabled', (d) => d.pack.governance.politicalSentimentScoring = true],
  ['ideological source field', (d) => d.countries[0].sources[0].ideology = 'unapproved'],
  ['political score field', (d) => d.countries[0].sources[0].politicalSentiment = 0.7],
  ['competing reports discarded', (d) => d.pack.governance.preserveCompetingReporting = false],
  ['regional proxy enabled', (d) => d.pack.governance.regionalProxyAllowed = true],
  ['source moved across country', (d) => d.countries[0].sources[0].country = 'QAT'],
  ['missing publisher identity', (d) => delete d.countries[0].sources[0].publisher],
  ['missing access limitation', (d) => d.countries[0].sources[0].accessLimitation = ''],
  ['missing verification', (d) => d.countries[0].sources[0].verificationEvidence = []],
  ['failed page claimed observed', (d) => d.countries[0].sources[0].languageStatus = 'observed'],
  ['search evidence claimed live page', (d) => d.countries[0].sources[0].verificationEvidence[1].outcome = 'page_observed'],
  ['missing country gaps', (d) => d.countries[0].gaps = []],
  ['missing regional gaps', (d) => d.pack.sharedGaps = []],
  ['rights silently approved', (d) => d.countries[0].sources[0].rights.status = 'APPROVED'],
  ['rights binding added', (d) => d.countries[0].sources[0].rights.binding = 'unreviewed'],
  ['robots silently allowed', (d) => d.countries[0].sources[0].robots.status = 'ALLOW'],
  ['known robots restrictions erased', (d) => { const s = get(d, 'ISR').sources[1]; s.robots.status = 'NOT_CHECKED'; s.robots.checkedOn = null; }],
  ['unverified feed URL added', (d) => d.countries[0].sources[0].endpoint.feedUrl = 'https://www.bna.bh/feed/'],
  ['machine acquisition enabled', (d) => d.countries[0].sources[0].endpoint.machineIngestionReady = true],
  ['endpoint host mismatch', (d) => d.countries[0].sources[0].canonicalHost = 'other.example'],
  ['credentials in endpoint', (d) => d.countries[0].sources[0].endpoint.url = 'https://secret@www.bna.bh/'],
  ['duplicate publisher record', (d) => d.countries[0].sources[1] = structuredClone(d.countries[0].sources[0])],
  ['one newsroom standing for country', (d) => d.countries[0].sources.splice(1, 1)],
  ['institution omitted', (d) => d.countries[0].sources.pop()],
  ['international voice substitutes domestic', (d) => d.countries[0].sources[0].localInternationalBasis.scope = 'INTERNATIONAL'],
  ['Hebrew reporting removed', (d) => { const s = get(d, 'ISR').sources[0]; s.language = 'en'; }],
  ['Persian reporting no longer observed', (d) => { const s = get(d, 'IRN').sources.find((s) => s.publisher.id === 'isna'); s.languageStatus = 'candidate'; }],
  ['Saba hosts merged', (d) => { const s = get(d, 'YEM').sources[1]; s.canonicalHost = 'www.sabanew.net'; s.endpoint.url = 'https://www.sabanew.net/'; }],
  ['BBC recast as domestic', (d) => get(d, 'IRN').sources.find((s) => s.publisher.id === 'bbc-persian').localInternationalBasis.scope = 'LOCAL'],
];
for (const [label, mutate] of cases) {
  test('rejects ' + label, () => {
    const changed = structuredClone(fixture);
    mutate(changed);
    assert.throws(() => validateDataset(changed));
  });
}
