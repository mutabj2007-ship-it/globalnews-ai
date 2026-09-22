import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

export const BASELINE = 'BHR EGY IRN IRQ ISR JOR KWT LBN OMN PSE QAT SAU SYR TUR ARE YEM'.split(' ');
export const DEFAULT_ROOT = fileURLToPath(new URL('../shared/source-packs/middle-east-r1/', import.meta.url));
const DATE = '2026-09-22';
const nonempty = (x) => typeof x === 'string' && x.trim().length > 0;
const requireText = (x, label) => assert.ok(nonempty(x), label + ' must be nonempty');
function keys(value, expected, label) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), label + ' must be an object');
  assert.deepEqual(Object.keys(value).sort(), expected.split(' ').sort(), label + ' fields');
}
function url(value) {
  const parsed = new URL(value);
  assert.equal(parsed.protocol, 'https:', 'HTTPS source URL required');
  assert.equal(parsed.username + parsed.password, '', 'URL must not contain credentials');
  return parsed;
}
function list(value, label) {
  assert.ok(Array.isArray(value) && value.length > 0, label + ' must be a nonempty array');
  value.forEach((v) => requireText(v, label));
  assert.equal(new Set(value).size, value.length, label + ' must be unique');
}
export function readDataset(root = DEFAULT_ROOT) {
  const pack = JSON.parse(readFileSync(path.join(root, 'pack.json'), 'utf8'));
  // Fixed governed filenames: never trust a manifest reference as a filesystem path.
  const files = readdirSync(path.join(root, 'countries')).sort();
  assert.deepEqual(files, BASELINE.map((c) => c + '.json').sort(), 'country file inventory');
  return {
    pack,
    countries: BASELINE.map((c) => JSON.parse(readFileSync(path.join(root, 'countries', c + '.json'), 'utf8'))),
  };
}
export function validateDataset({ pack, countries }) {
  keys(pack, 'schemaVersion id agent reviewedOn baseCommit branch baseline scopeNote status enabled alphaActivation productionHold governance countries sharedGaps', 'pack');
  assert.equal(pack.schemaVersion, 1);
  assert.equal(pack.id, 'global-reach-middle-east-multi-vantage-r1');
  assert.equal(pack.agent, 'CODEX O');
  assert.equal(pack.reviewedOn, DATE);
  assert.equal(pack.baseCommit, 'dc0b029f0d29e07908c0dc8c66d3ad1bd216fc15');
  assert.equal(pack.branch, 'feature/beta-global-reach-middle-east-r1');
  assert.deepEqual(pack.baseline, BASELINE, 'governed country baseline');
  assert.equal(pack.scopeNote, "GlobalNews AI monitoring construct, not a geopolitical boundary claim.");
  assert.equal(pack.status, 'DORMANT_RESEARCH');
  assert.equal(pack.enabled, false);
  assert.equal(pack.alphaActivation, false);
  assert.equal(pack.productionHold, true);
  const positive = ['preserveCompetingReporting', 'preserveOriginalLanguage', 'preservePublisherAttribution'];
  const negative = ['countrySubstitutionAllowed', 'regionalProxyAllowed', 'translationCountsAsIndependentPublisher',
    'officialSourcesCountAsIndependentJournalisticCorroboration', 'politicalSentimentScoring',
    'ideologicalClassification', 'broadScrapingAllowed'];
  keys(pack.governance, [...positive, ...negative, 'activationRequires'].join(' '), 'governance');
  positive.forEach((k) => assert.equal(pack.governance[k], true, k));
  negative.forEach((k) => assert.equal(pack.governance[k], false, k));
  list(pack.governance.activationRequires, 'activation requirements');
  assert.equal(pack.governance.activationRequires.length, 6);
  list(pack.sharedGaps, 'shared gaps');
  assert.deepEqual(pack.countries, BASELINE.map((country) => ({ country, manifest: 'countries/' + country + '.json' })));
  assert.deepEqual(countries.map((c) => c.country), BASELINE, 'country packs and order');
  const ids = new Set();
  const observedNewsLanguages = new Set();
  const summaries = [];
  let sourceCount = 0;
  for (const country of countries) {
    keys(country, 'schemaVersion country status enabled languageTargets sources gaps', country.country);
    assert.equal(country.schemaVersion, 1);
    assert.equal(country.status, 'DORMANT_RESEARCH');
    assert.equal(country.enabled, false);
    list(country.languageTargets, 'language targets');
    country.languageTargets.forEach((l) => assert.match(l, /^[a-z]{2,3}$/));
    list(country.gaps, 'country gaps');
    assert.ok(Array.isArray(country.sources), 'source list');
    const publishers = new Set(), hosts = new Set(), observed = new Set(), observedLocalNews = new Set();
    let institutions = 0;
    const outcomes = {};
    for (const s of country.sources) {
      keys(s, 'id country language languageStatus publisher canonicalHost sourceType sourceKind endpoint verificationEvidence rights robots localInternationalBasis accessLimitation enabled', 'source');
      assert.equal(s.country, country.country, 'cross-country substitution');
      assert.equal(s.enabled, false, 'source activation forbidden');
      assert.match(s.language, /^[a-z]{2,3}$/);
      assert.ok(country.languageTargets.includes(s.language), 'source language must be a declared target');
      assert.ok(['observed', 'indexed', 'candidate'].includes(s.languageStatus));
      keys(s.publisher, 'id name identityStatus ownershipReview', 'publisher');
      requireText(s.publisher.id, 'publisher id');
      requireText(s.publisher.name, 'publisher identity');
      assert.ok(['page_observed', 'indexed', 'candidate'].includes(s.publisher.identityStatus));
      assert.equal(s.publisher.ownershipReview, 'NOT_REVIEWED');
      assert.equal(s.id, 'me-r1:' + country.country.toLowerCase() + ':' + s.publisher.id);
      assert.ok(!ids.has(s.id), 'duplicate source identity'); ids.add(s.id);
      assert.ok(['NEWS_PROVIDER', 'OFFICIAL_SOURCE'].includes(s.sourceType));
      const officialKinds = ['STATISTICS_OFFICE', 'CENTRAL_BANK', 'HUMANITARIAN_ORGANIZATION'];
      const newsKinds = ['NEWS_AGENCY', 'NEWSPAPER', 'NEWSROOM', 'BROADCASTER'];
      assert.ok((s.sourceType === 'OFFICIAL_SOURCE' ? officialKinds : newsKinds).includes(s.sourceKind), 'source kind');
      keys(s.endpoint, 'url kind feedUrl feedStatus machineIngestionReady', 'endpoint');
      assert.equal(url(s.endpoint.url).hostname, s.canonicalHost, 'canonical host');
      assert.equal(s.endpoint.kind, 'LANDING_PAGE');
      assert.equal(s.endpoint.feedUrl, null, 'R1 has no verified feeds');
      assert.ok(['NOT_VERIFIED', 'ADVERTISED_UNRESOLVED'].includes(s.endpoint.feedStatus));
      assert.equal(s.endpoint.machineIngestionReady, false);
      assert.ok(Array.isArray(s.verificationEvidence) && s.verificationEvidence.length > 0, 'verification evidence required');
      for (const e of s.verificationEvidence) {
        keys(e, 'url method checkedOn outcome note', 'evidence');
        url(e.url); requireText(e.note, 'evidence note');
        assert.equal(e.checkedOn, DATE);
        assert.ok(['web_open', 'web_search'].includes(e.method));
        assert.ok(['page_observed', 'index_observed', 'limited_content', 'retrieval_failed'].includes(e.outcome));
        assert.equal(e.method === 'web_search', e.outcome === 'index_observed', 'search evidence must be marked indexed');
      }
      assert.equal(s.verificationEvidence[0].url, s.endpoint.url, 'endpoint check evidence');
      const first = s.verificationEvidence[0].outcome;
      outcomes[first] = (outcomes[first] ?? 0) + 1;
      if (s.languageStatus === 'observed' || s.publisher.identityStatus === 'page_observed')
        assert.equal(first, 'page_observed', 'readable page required for observed identity/language');
      if (s.languageStatus === 'indexed' || s.publisher.identityStatus === 'indexed')
        assert.ok(s.verificationEvidence.some((e) => e.outcome === 'index_observed'), 'indexed evidence required');
      keys(s.rights, 'status binding instrumentUrl note', 'rights');
      assert.equal(s.rights.status, 'NOT_REVIEWED'); assert.equal(s.rights.binding, null);
      assert.equal(s.rights.instrumentUrl, null); requireText(s.rights.note, 'rights limit');
      keys(s.robots, 'url status checkedOn note', 'robots');
      assert.equal(s.robots.url, 'https://' + s.canonicalHost + '/robots.txt');
      assert.ok(['NOT_CHECKED', 'FETCH_FAILED', 'RESEARCH_TOOL_BLOCKED', 'RESTRICTIONS_OBSERVED'].includes(s.robots.status));
      assert.equal(s.robots.checkedOn, s.robots.status === 'NOT_CHECKED' ? null : DATE);
      requireText(s.robots.note, 'robots limitation');
      keys(s.localInternationalBasis, 'scope note', 'local/international basis');
      assert.ok(['LOCAL', 'INTERNATIONAL'].includes(s.localInternationalBasis.scope));
      requireText(s.localInternationalBasis.note, 'basis'); requireText(s.accessLimitation, 'access limitation');
      if (s.languageStatus === 'observed') observed.add(s.language);
      if (s.sourceType === 'NEWS_PROVIDER') {
        if (s.localInternationalBasis.scope === 'LOCAL') {
          publishers.add(s.publisher.id); hosts.add(s.canonicalHost.replace(/^www\./, ''));
          if (s.languageStatus === 'observed') observedLocalNews.add(s.language);
        }
        if (s.languageStatus === 'observed') observedNewsLanguages.add(s.language);
      } else institutions++;
      sourceCount++;
    }
    assert.ok(publishers.size >= 2 && hosts.size >= 2, country.country + ' needs two local news candidates');
    assert.ok(institutions >= 1, country.country + ' needs an institutional candidate');
    summaries.push({ country: country.country, candidates: country.sources.length,
      localNewsPublisherCandidates: publishers.size, institutionalCandidates: institutions,
      observedLanguages: [...observed].sort(),
      observedLocalNewsLanguages: [...observedLocalNews].sort(),
      languageTargetsWithoutObservedLocalNews: country.languageTargets.filter((l) => !observedLocalNews.has(l)),
      languageTargetsWithoutObservedEdition: country.languageTargets.filter((l) => !observed.has(l)),
      endpointOutcomes: outcomes, gaps: country.gaps });
  }
  for (const language of ['ar', 'he', 'fa', 'tr', 'en'])
    assert.ok(observedNewsLanguages.has(language), 'missing observed news language environment: ' + language);
  // Named ambiguous/blocked candidates must not silently be merged or promoted.
  const all = countries.flatMap((c) => c.sources);
  const find = (id) => { const s = all.find((s) => s.publisher.id === id); assert.ok(s, 'required vantage: ' + id); return s; };
  assert.notEqual(find('saba-ye').publisher.id, find('saba-sabanew').publisher.id);
  assert.notEqual(find('saba-ye').canonicalHost, find('saba-sabanew').canonicalHost);
  assert.equal(find('bbc-persian').localInternationalBasis.scope, 'INTERNATIONAL');
  assert.equal(find('ocha-opt').localInternationalBasis.scope, 'INTERNATIONAL');
  assert.equal(find('toi').robots.status, 'RESTRICTIONS_OBSERVED');
  assert.equal(find('bbc-persian').robots.status, 'RESEARCH_TOOL_BLOCKED');
  return { countries: summaries.length, sourceCandidates: sourceCount, verifiedFeeds: 0, rightsBindings: 0, activeSources: 0, summaries };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(validateDataset(readDataset()), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
