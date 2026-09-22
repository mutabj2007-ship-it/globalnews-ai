import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const PACK_DIR = 'backend/src/modules/source-packs/eu27';
export const EU27 = [
  'AT',
  'BE',
  'BG',
  'CY',
  'CZ',
  'DE',
  'DK',
  'EE',
  'ES',
  'FI',
  'FR',
  'GR',
  'HR',
  'HU',
  'IE',
  'IT',
  'LT',
  'LU',
  'LV',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SE',
  'SI',
  'SK',
];
export const ROLES = [
  'DOMESTIC_PUBLISHER',
  'PUBLIC_NEWS',
  'OFFICIAL_STATISTICS',
  'PARLIAMENT_GOVERNMENT',
  'CENTRAL_BANK',
];
const STATUSES = ['VALIDATED_LOCAL_BASELINE', 'PARTIAL', 'COVERAGE_GAP'];
const nonempty = (v) => typeof v === 'string' && v.trim().length > 0;
function https(value) {
  const url = new URL(value);
  assert.equal(url.protocol, 'https:', 'Discovery endpoints must use HTTPS');
  assert.ok(!url.username && !url.password, 'No URL credentials');
}
function date(value) {
  assert.match(value, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(new Date(value).toISOString().slice(0, 10), value);
}
export function loadSourcePacks() {
  const dir = resolve(ROOT, PACK_DIR);
  const names = readdirSync(resolve(dir, 'countries')).sort();
  assert.deepEqual(
    names,
    EU27.map((code) => code + '.json'),
    'Exact EU-27 file membership',
  );
  const parse = (path) => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
  return {
    governance: parse(resolve(dir, 'governance.json')),
    packs: names.map((name) => parse(resolve(dir, 'countries', name))),
  };
}

/** R1 admits discovery candidates only. A homepage or historical fetch cannot promote a baseline. */
export function deriveCoverageStatus(pack) {
  const local = pack.sources.filter(
    (source) => source.scope === 'NATIONAL' && source.countryCode === pack.countryCode,
  );
  return local.some(
    (source) =>
      source.discoveryEvidence.outcome === 'PAGE_OBSERVED' ||
      source.authorityEvidenceUrls.length > 0,
  )
    ? 'PARTIAL'
    : 'COVERAGE_GAP';
}

export function validateSourcePacks({ governance: g, packs }) {
  assert.equal(g.schemaVersion, 1);
  assert.equal(g.packVersion, 'EU27-R1');
  assert.deepEqual(g.memberCountryCodes, EU27);
  assert.deepEqual(g.coverageStatuses, STATUSES);
  https(g.membershipEvidenceUrl);
  date(g.reviewedAt);
  assert.deepEqual(packs.map((p) => p.countryCode).sort(), EU27, 'Exact EU-27 membership');
  assert.equal(g.baselineRequirements.independentDomesticPublishers, 2);
  assert.equal(g.baselineRequirements.distinctReviewedOwnershipGroups, 2);
  assert.deepEqual(g.baselineRequirements.requiredRoles, ROLES.slice(1));
  assert.equal(g.activation.productionHold, true);
  assert.equal(g.activation.massActivationAllowed, false);
  assert.equal(g.activation.clickTriggeredAcquisitionAllowed, false);
  assert.equal(g.activation.ingestionMethod, 'none');
  assert.equal(g.activation.requiresSourceIdAuthorization, true);
  assert.equal(g.activation.rightsEvaluator, 'shared/src/rights/source-rights.ts');
  for (const [key, value] of Object.entries({
    preserveOriginal: true,
    automaticTranslation: false,
    discardOriginalAfterTranslation: false,
    translationIsSeparateDerivedArtifact: true,
  }))
    assert.equal(g.languagePolicy[key], value, key);
  assert.equal(g.languagePolicy.unknownLanguage, 'und');
  assert.deepEqual(g.languagePolicy.requiredEvidenceFields, [
    'sourceId',
    'sourceUrl',
    'originalLanguage',
    'originalText',
    'originalPayloadHash',
    'retrievedAt',
    'publishedAt',
  ]);
  assert.equal(g.supplementarySources.length, 1);
  const eurostat = g.supplementarySources[0];
  assert.equal(eurostat.sourceId, 'eu-eurostat');
  assert.equal(eurostat.existingRegistryId, 'eurostat');
  assert.equal(eurostat.scope, 'EU_SUPPLEMENTARY');
  assert.equal(eurostat.role, 'OFFICIAL_STATISTICS');
  assert.equal(eurostat.countryCode, null);
  assert.equal(eurostat.countsAsDomesticJournalism, false);
  assert.equal(eurostat.countsAsNationalAuthority, false);
  assert.equal(eurostat.enabled, false);
  assert.equal(eurostat.ingestionMethod, 'none');
  assert.equal(eurostat.rightsStatus, 'EXISTING_BINDING_REQUIRES_RESOLUTION');
  assert.deepEqual(eurostat.rightsBinding, {
    rightsAuthorityId: 'ECONOMY_ACQUISITION_RIGHTS',
    rightsRecordKey: 'EUROSTAT',
  });
  assert.deepEqual(eurostat.geoOverrides, { GR: 'EL' });
  assert.equal(
    eurostat.api.url,
    'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data',
  );
  https(eurostat.api.documentationUrl);
  https(eurostat.updateFeedDocumentationUrl);
  assert.equal(eurostat.api.status, 'DOCUMENTED_NOT_FETCHED');
  assert.deepEqual(
    eurostat.updateFeeds,
    ['en', 'de', 'fr'].map((language) => ({
      language,
      url:
        'https://ec.europa.eu/eurostat/api/dissemination/catalogue/rss/' +
        language +
        '/statistics-update.rss',
    })),
  );

  const ids = new Set([eurostat.sourceId]);
  for (const p of packs) {
    assert.equal(p.schemaVersion, 1);
    assert.equal(p.packId, 'eu27-' + p.countryCode.toLowerCase() + '-r1');
    assert.ok(nonempty(p.countryName) && nonempty(p.coverageReason));
    date(p.reviewedAt);
    assert.ok(STATUSES.includes(p.coverageStatus));
    assert.equal(
      p.coverageStatus,
      deriveCoverageStatus(p),
      p.countryCode + ': discovery is not a validated baseline',
    );
    assert.deepEqual(p.supplementarySourceIds, ['eu-eurostat']);
    assert.ok(p.languageTargets.length > 0);
    assert.deepEqual(p.gaps.map((gap) => gap.role).sort(), [...ROLES].sort());
    for (const gap of p.gaps) {
      assert.equal(gap.status, 'COVERAGE_GAP');
      assert.ok(nonempty(gap.reason) && nonempty(gap.nextAction));
    }
    assert.ok(p.sources.filter((s) => s.role === 'DOMESTIC_PUBLISHER').length >= 2);
    for (const role of ROLES) assert.ok(p.sources.some((s) => s.role === role));
    for (const s of p.sources) {
      assert.ok(!ids.has(s.sourceId), 'Duplicate source identity');
      ids.add(s.sourceId);
      assert.ok(s.sourceId.startsWith('eu27:' + p.countryCode.toLowerCase() + ':'));
      assert.ok(nonempty(s.name));
      assert.equal(s.countryCode, p.countryCode, 'Foreign authority cannot close a local gap');
      assert.equal(s.scope, 'NATIONAL');
      assert.ok(ROLES.includes(s.role));
      https(s.discoveryUrl);
      assert.ok(
        !new URL(s.discoveryUrl).hostname.endsWith('europa.eu'),
        'EU authority cannot become domestic journalism',
      );
      assert.equal(s.enabled, false);
      assert.equal(s.ingestionMethod, 'none');
      assert.equal(s.rightsBinding, null, 'Candidate cannot mint rights');
      assert.ok(['UNREVIEWED', 'RESTRICTION_OBSERVED'].includes(s.rightsStatus));
      if (s.rightsStatus === 'RESTRICTION_OBSERVED') {
        https(s.rightsEvidence.url);
        date(s.rightsEvidence.reviewedAt);
        assert.ok(nonempty(s.rightsEvidence.note));
      }
      assert.equal(s.validationStatus, 'CANDIDATE');
      assert.equal(s.ownershipGroup, null, 'R1 does not validate ownership groups');
      assert.equal(
        s.independenceStatus,
        s.role === 'DOMESTIC_PUBLISHER' ? 'REVIEW_REQUIRED' : 'NOT_COUNTED_AS_INDEPENDENT',
      );
      assert.equal(s.observedContentLanguage, null);
      assert.equal(s.languageStatus, 'REQUIRES_PAYLOAD_REVIEW');
      assert.ok(Array.isArray(s.expectedLanguages));
      for (const lang of [...s.expectedLanguages, ...p.languageTargets])
        assert.match(lang, /^[a-z]{2,3}(-[A-Za-z0-9]+)*$/);
      date(s.discoveryEvidence.checkedAt);
      assert.equal(s.discoveryEvidence.method, 'WEB_TOOL_CACHED_PAGE');
      assert.ok(
        ['PAGE_OBSERVED', 'LIMITED_PAGE', 'ACCESS_UNRESOLVED'].includes(
          s.discoveryEvidence.outcome,
        ),
      );
      https(s.discoveryEvidence.finalUrl);
      assert.ok(nonempty(s.discoveryEvidence.note));
      assert.ok(s.blockers.includes('RIGHTS_REVIEW_REQUIRED'));
      assert.ok(s.blockers.includes('TRANSPORT_AND_PAYLOAD_VALIDATION_REQUIRED'));
      if (s.role === 'DOMESTIC_PUBLISHER')
        assert.ok(s.blockers.includes('OWNERSHIP_AND_EDITORIAL_INDEPENDENCE_REVIEW_REQUIRED'));
      for (const url of s.authorityEvidenceUrls) https(url);
      for (const e of s.endpoints) {
        https(e.url);
        date(e.reviewedAt);
        assert.ok(['RSS', 'RSS_INDEX', 'API', 'API_DOCS'].includes(e.kind));
        assert.ok(
          [
            'DOCUMENTED_NOT_FETCHED',
            'HISTORICAL_REGISTRY_RECORD',
            'DISCOVERY_ACCESS_UNRESOLVED',
          ].includes(e.status),
        );
        assert.ok(nonempty(e.note));
        assert.match(e.language, /^[a-z]{2,3}$/);
        if (e.status === 'HISTORICAL_REGISTRY_RECORD') {
          assert.ok(nonempty(s.existingRegistryId));
          assert.ok(s.repositoryEvidence.length > 0);
        } else https(e.documentationUrl);
      }
      for (const path of s.repositoryEvidence ?? []) {
        assert.ok(!path.includes('..') && !path.includes('\\') && !path.startsWith('/'));
        assert.ok(existsSync(resolve(ROOT, path)), 'Missing historical evidence: ' + path);
      }
    }
  }
  return {
    countries: packs.length,
    sources: packs.reduce((n, p) => n + p.sources.length, 0),
    statuses: Object.fromEntries(
      STATUSES.map((status) => [status, packs.filter((p) => p.coverageStatus === status).length]),
    ),
    enabledSources: 0,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(JSON.stringify(validateSourcePacks(loadSourcePacks()), null, 2));
}
