import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ROOT,
  PACK_DIR,
  EU27,
  loadSourcePacks,
  validateSourcePacks,
  deriveCoverageStatus,
} from './verify-eu27-source-packs.mjs';

const catalogue = loadSourcePacks();
function rejects(name, mutate) {
  test(name, () => {
    const copy = structuredClone(catalogue);
    mutate(copy);
    assert.throws(() => validateSourcePacks(copy));
  });
}
test('accounts for every EU member with explicit incomplete coverage and zero activation', () => {
  assert.deepEqual(validateSourcePacks(catalogue), {
    countries: 27,
    sources: 162,
    statuses: { VALIDATED_LOCAL_BASELINE: 0, PARTIAL: 27, COVERAGE_GAP: 0 },
    enabledSources: 0,
  });
});
rejects('missing country cannot hide behind Poland', (c) => c.packs.pop());
rejects(
  'duplicate country cannot substitute for a missing country',
  (c) => (c.packs[1] = c.packs[0]),
);
rejects('non-EU member rejected', (c) => (c.packs[0].countryCode = 'GB'));
rejects(
  'forged validated baseline rejected',
  (c) => (c.packs[0].coverageStatus = 'VALIDATED_LOCAL_BASELINE'),
);
rejects('wrong country attribution rejected', (c) => (c.packs[0].sources[0].countryCode = 'PL'));
rejects('EU authority substituted into domestic pack rejected', (c) => {
  c.packs[0].sources[0].discoveryUrl = 'https://ec.europa.eu/eurostat/';
});
rejects('duplicate publisher identity rejected', (c) => {
  c.packs[0].sources[1].sourceId = c.packs[0].sources[0].sourceId;
});
rejects('missing official statistics category rejected', (c) => {
  c.packs[0].sources = c.packs[0].sources.filter((s) => s.role !== 'OFFICIAL_STATISTICS');
});
rejects('public broadcaster cannot count as independent publisher', (c) => {
  c.packs[0].sources[2].independenceStatus = 'REVIEW_REQUIRED';
});
rejects('unreviewed publisher ownership cannot be asserted', (c) => {
  c.packs[0].sources[0].ownershipGroup = 'assumed-independent';
});
rejects('national source cannot activate', (c) => (c.packs[0].sources[0].enabled = true));
rejects('transport cannot activate', (c) => (c.packs[0].sources[0].ingestionMethod = 'rss'));
rejects('candidate cannot mint rights binding', (c) => (c.packs[0].sources[0].rightsBinding = {}));
rejects(
  'candidate cannot claim permission',
  (c) => (c.packs[0].sources[0].rightsStatus = 'APPROVED'),
);
rejects('baseline cannot be promoted by source flag', (c) => {
  c.packs[0].sources[0].validationStatus = 'VALIDATED';
});
for (const key of ['productionHold', 'requiresSourceIdAuthorization']) {
  rejects('required activation guard: ' + key, (c) => (c.governance.activation[key] = false));
}
for (const key of ['massActivationAllowed', 'clickTriggeredAcquisitionAllowed']) {
  rejects('prohibited activation path: ' + key, (c) => (c.governance.activation[key] = true));
}
for (const key of ['preserveOriginal', 'translationIsSeparateDerivedArtifact']) {
  rejects('required language guard: ' + key, (c) => (c.governance.languagePolicy[key] = false));
}
for (const key of ['automaticTranslation', 'discardOriginalAfterTranslation']) {
  rejects(
    'prohibited language transformation: ' + key,
    (c) => (c.governance.languagePolicy[key] = true),
  );
}
rejects('expected language is not observed language', (c) => {
  c.packs[0].sources[0].observedContentLanguage = 'en';
});
rejects('Eurostat does not become national authority', (c) => {
  c.governance.supplementarySources[0].countsAsNationalAuthority = true;
});
rejects('Eurostat does not close journalism coverage', (c) => {
  c.governance.supplementarySources[0].countsAsDomesticJournalism = true;
});
rejects('Eurostat remains disabled', (c) => (c.governance.supplementarySources[0].enabled = true));
rejects('Eurostat ISO GR versus dataset EL mapping is explicit', (c) => {
  c.governance.supplementarySources[0].geoOverrides.GR = 'GR';
});
rejects('Eurostat RSS language variants cannot disappear', (c) => {
  c.governance.supplementarySources[0].updateFeeds.pop();
});
rejects('an RSS index cannot claim a tested feed', (c) => {
  c.packs.find((p) => p.countryCode === 'NL').sources[3].endpoints[0].status = 'VALIDATED';
});
rejects('missing endpoint documentation rejected', (c) => {
  c.packs.find((p) => p.countryCode === 'DK').sources[3].endpoints[0].documentationUrl = null;
});
rejects(
  'HTTP downgrade rejected',
  (c) => (c.packs[0].sources[0].discoveryUrl = 'http://example.org/'),
);
rejects('dangling historical fixture rejected', (c) => {
  c.packs.find((p) => p.countryCode === 'PL').sources[3].repositoryEvidence.push('missing.xml');
});
test('no domestic discovery is a coverage gap even with Eurostat available', () => {
  const empty = { countryCode: 'PL', sources: [], supplementarySourceIds: ['eu-eurostat'] };
  assert.equal(deriveCoverageStatus(empty), 'COVERAGE_GAP');
});
test('Poland keeps historical English GUS separate from Polish discovery', () => {
  const pl = catalogue.packs.find((p) => p.countryCode === 'PL');
  assert.equal(pl.coverageStatus, 'PARTIAL');
  assert.equal(pl.sources[0].existingRegistryId, 'feed:wp-pl');
  const gus = pl.sources[3];
  assert.ok(
    gus.endpoints.some((e) => e.language === 'en' && e.status === 'HISTORICAL_REGISTRY_RECORD'),
  );
  assert.ok(gus.endpoints.some((e) => e.language === 'pl' && e.kind === 'RSS_INDEX'));
  assert.match(pl.sources[5].endpoints[0].note, /PUBLIC_DATA/);
  assert.equal(pl.referenceImplementation.rejectedHistoricalCandidates.length, 3);
  assert.equal(pl.sources[2].rightsStatus, 'RESTRICTION_OBSERVED');
});
test('original scripts survive manifest serialization', () => {
  const byCode = Object.fromEntries(catalogue.packs.map((p) => [p.countryCode, p]));
  assert.equal(byCode.BG.sources[0].name, 'Дневник');
  assert.equal(byCode.GR.sources[0].name, 'Η Καθημερινή');
  assert.equal(byCode.PL.sources[3].name, 'Główny Urząd Statystyczny');
  assert.deepEqual(JSON.parse(JSON.stringify(catalogue)), catalogue);
});
test('R1 catalogue is isolated from product runtime and cannot acquire on click', () => {
  function scan(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = resolve(dir, entry.name);
      if (path === resolve(ROOT, PACK_DIR)) continue;
      if (entry.isDirectory()) scan(path);
      else if (/\.(ts|tsx|js|mjs)$/.test(entry.name) && !/\.(spec|test)\./.test(entry.name)) {
        const code = readFileSync(path, 'utf8');
        assert.doesNotMatch(
          code,
          /source-packs[\\/]eu27|eu27[\\/]countries/,
          'Runtime must not consume the R1 candidate catalogue: ' + path,
        );
      }
    }
  }
  scan(resolve(ROOT, 'backend/src'));
  scan(resolve(ROOT, 'frontend/src'));
});
test('language and ownership gaps remain explicit for multilingual markets', () => {
  for (const code of ['BE', 'CY', 'FI', 'IE', 'LU', 'MT']) {
    const p = catalogue.packs.find((p) => p.countryCode === code);
    assert.ok(p.languageTargets.length > 1);
    assert.equal(p.gaps.find((g) => g.role === 'DOMESTIC_PUBLISHER').status, 'COVERAGE_GAP');
  }
  assert.equal(EU27.length, 27);
});
