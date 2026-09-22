import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const language = (value) =>
  typeof value === 'string' && /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(value);
const fail = (ok, reason) => {
  if (!ok) throw new Error(reason);
};
export const PROGRAMMES = [
  {
    lane: 'N',
    region: 'region:east-africa',
    directory: 'backend/source-packs/east-africa-r1',
    filename: /^[A-Z]{3}\.json$/,
  },
  {
    lane: 'O',
    region: 'region:middle-east',
    directory: 'shared/source-packs/middle-east-r1/countries',
    filename: /^[A-Z]{3}\.json$/,
  },
  {
    lane: 'P',
    region: 'region:european-union',
    directory: 'backend/src/modules/source-packs/eu27/countries',
    filename: /^[A-Z]{2}\.json$/,
  },
];
export function readInputs(root = ROOT) {
  return PROGRAMMES.flatMap((programme) =>
    fs
      .readdirSync(path.join(root, programme.directory))
      .filter((f) => programme.filename.test(f))
      .sort()
      .map((filename) => {
        const manifestPath = programme.directory + '/' + filename;
        const bytes = fs.readFileSync(path.join(root, manifestPath));
        return {
          lane: programme.lane,
          region: programme.region,
          manifestPath,
          sha256: sha(bytes),
          raw: JSON.parse(bytes.toString('utf8')),
        };
      }),
  );
}
function countryFor(input, countries) {
  const identifier = input.lane === 'P' ? input.raw.countryCode : input.raw.country;
  const country = countries.find((c) => (input.lane === 'P' ? c.iso2 : c.iso3) === identifier);
  fail(country, 'NONCANONICAL_COUNTRY');
  return country;
}
function gapEvidence(input) {
  const r = input.raw;
  // Retain gap evidence, never use the research package's coverageStatus as final coverage.
  return input.lane === 'N'
    ? { findings: r.findings, independenceRule: r.independenceRule, categories: r.categoryAudit }
    : input.lane === 'O'
      ? { gaps: r.gaps, languageTargets: r.languageTargets }
      : {
          gaps: r.gaps,
          coverageReason: r.coverageReason,
          languageTargets: r.languageTargets,
          supplementarySourceIds: r.supplementarySourceIds,
        };
}
function candidate(input, source, country) {
  const lane = input.lane;
  fail(source.enabled === false && source.alphaEnabled !== true, 'SOURCE_NOT_DORMANT');
  fail(!source.duplicateOf, 'EXPLICIT_ALIAS_OF:' + source.duplicateOf);
  const sourceId = lane === 'P' ? source.sourceId : source.id;
  fail(
    typeof sourceId === 'string' && /^[a-z0-9][a-z0-9:._-]+$/.test(sourceId),
    'INVALID_SOURCE_ID',
  );
  if (lane === 'O') fail(source.country === country.iso3, 'SOURCE_COUNTRY_MISMATCH');
  if (lane === 'P')
    fail(
      source.countryCode === country.iso2 && source.scope === 'NATIONAL',
      'SOURCE_COUNTRY_OR_SCOPE_MISMATCH',
    );
  const publisherName = lane === 'O' ? source.publisher?.name : source.name;
  fail(typeof publisherName === 'string' && publisherName.trim(), 'MISSING_PUBLISHER');
  const url = new URL(
    lane === 'N' ? source.homepage : lane === 'O' ? source.endpoint?.url : source.discoveryUrl,
  );
  fail(
    ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password,
    'UNSAFE_DISCOVERY_URL',
  );
  const host = (lane === 'O' ? source.canonicalHost : url.hostname)
    ?.toLowerCase()
    .replace(/^www\./, '')
    .replace(/\.$/, '');
  fail(
    typeof host === 'string' &&
      /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/.test(host) &&
      !host.includes('..'),
    'INVALID_HOST',
  );
  const classes =
    lane === 'N'
      ? {
          LOCAL_NEWS: 'NEWS_PROVIDER',
          PUBLIC_NEWS: 'NEWS_PROVIDER',
          GOVERNMENT: 'OFFICIAL_SOURCE',
          STATISTICS: 'PUBLIC_DATA',
          CENTRAL_BANK: 'OFFICIAL_SOURCE',
          HUMANITARIAN: 'OFFICIAL_SOURCE',
        }
      : {
          DOMESTIC_PUBLISHER: 'NEWS_PROVIDER',
          PUBLIC_NEWS: 'NEWS_PROVIDER',
          OFFICIAL_STATISTICS: 'PUBLIC_DATA',
          PARLIAMENT_GOVERNMENT: 'OFFICIAL_SOURCE',
          CENTRAL_BANK: 'OFFICIAL_SOURCE',
        };
  const sourceClass =
    lane === 'O' ? source.sourceType : classes[lane === 'N' ? source.category : source.role];
  fail(
    ['NEWS_PROVIDER', 'OFFICIAL_SOURCE', 'PUBLIC_DATA'].includes(sourceClass),
    'UNKNOWN_SOURCE_CLASS',
  );
  let basis;
  if (lane === 'N') {
    fail(
      ['COUNTRY_FOCUSED_CANDIDATE', 'INSTITUTIONAL', 'EXILE_OR_CROSS_BORDER'].includes(
        source.locality,
      ),
      'UNKNOWN_LOCALITY',
    );
    basis =
      source.locality === 'EXILE_OR_CROSS_BORDER' || ['unocha.org', 'ifrc.org'].includes(host)
        ? 'INTERNATIONAL'
        : 'LOCAL';
  } else basis = lane === 'O' ? source.localInternationalBasis?.scope : 'LOCAL';
  fail(['LOCAL', 'INTERNATIONAL'].includes(basis), 'UNKNOWN_LOCALITY');
  const rightsStatus = lane === 'P' ? source.rightsStatus : source.rights?.status;
  const allowedRights =
    lane === 'N'
      ? ['RESTRICTION_OR_NOTICE_OBSERVED', 'UNRESOLVED', 'RESTRICTED', 'LIMITED_SCOPE_REVIEW']
      : lane === 'O'
        ? ['NOT_REVIEWED']
        : ['UNREVIEWED', 'RESTRICTION_OBSERVED'];
  fail(allowedRights.includes(rightsStatus), 'RIGHTS_STATUS_REQUIRES_REVIEW');
  fail(
    !source.rightsBinding && !source.rights?.binding && source.rights?.reuseApproved !== true,
    'RIGHTS_BINDING_REQUIRES_REVIEW',
  );
  // Declared feed language is retained as declared metadata, not detected article language.
  // Unobserved target/expected languages remain only in the original evidence reference.
  const declaredLanguage =
    lane === 'N'
      ? source.declaredFeedLanguage
      : lane === 'O' && source.languageStatus === 'observed'
        ? source.language
        : lane === 'P'
          ? source.observedContentLanguage
          : null;
  const provenance = {
    adapter: 'DORMANT_REGIONAL_R1',
    lane,
    manifestPath: input.manifestPath,
    manifestSha256: input.sha256,
    originalSourceId: sourceId,
    interpretation:
      'Research evidence only; no product verification, rights admission or network transport. Original names/languages/evidence are retained without translation or inferred detection.',
    originalEvidence: source,
  };
  return {
    sourceId,
    publisherName,
    iso2: country.iso2,
    iso3: country.iso3,
    governedRegion: input.region,
    canonicalHost: host,
    transport: 'NONE',
    endpoint: null,
    sourceClass,
    languages: language(declaredLanguage) ? [declaredLanguage] : [],
    basis,
    rights: {
      standing: ['RESTRICTED', 'RESTRICTION_OBSERVED'].includes(rightsStatus)
        ? 'RESTRICTED'
        : 'UNKNOWN',
      binding: null,
      usageNote:
        'Dormant research; original rights status ' +
        rightsStatus +
        '. No permission inferred. ' +
        (source.rights?.note || ''),
    },
    verifiedAt: null,
    captureCapability: 'UNKNOWN',
    activationStatus: 'DISABLED',
    failureReason:
      'Product verification, rights and transport admission remain unresolved; original research observations are not operational coverage.',
    provenanceNote: JSON.stringify(provenance),
    health: {
      status: 'UNKNOWN',
      lastAttemptAt: null,
      lastSuccessAt: null,
      consecutiveFailures: 0,
      failureReason: null,
    },
  };
}
export function normalizeInputs(inputs, countries) {
  const rejected = [],
    pending = [];
  const packs = inputs.map((input) => {
    fail(
      PROGRAMMES.some((p) => p.lane === input.lane && p.region === input.region),
      'UNAPPROVED_PROGRAMME',
    );
    fail(
      input.raw.schemaVersion === 1 && Array.isArray(input.raw.sources),
      'INVALID_RESEARCH_SCHEMA',
    );
    fail(input.raw.enabled !== true && input.raw.alphaEnabled !== true, 'PACK_NOT_DORMANT');
    const c = countryFor(input, countries);
    const pack = {
      schemaVersion: 1,
      iso2: c.iso2,
      iso3: c.iso3,
      governedRegion: input.region,
      verifiedAt: null,
      gapReason:
        'No operational local baseline admitted. Original gaps: ' +
        JSON.stringify(gapEvidence(input)),
      provenanceNote: JSON.stringify({
        adapter: 'DORMANT_REGIONAL_R1',
        lane: input.lane,
        manifestPath: input.manifestPath,
        manifestSha256: input.sha256,
        originalLanguagePolicy:
          'Original names and language evidence retained; no translation or language inference.',
      }),
      entries: [],
    };
    for (const source of input.raw.sources) {
      const context = {
        lane: input.lane,
        manifestPath: input.manifestPath,
        manifestSha256: input.sha256,
        originalSourceId: source.sourceId || source.id,
      };
      try {
        pending.push({ pack, entry: candidate(input, source, c), context });
      } catch (error) {
        rejected.push({ ...context, reason: String(error.message) });
      }
    }
    return pack;
  });
  const index = new Map();
  for (const item of pending) {
    const name = item.entry.publisherName
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]/gu, '');
    for (const key of [
      'host:' + item.entry.canonicalHost,
      'name:' + name,
      'id:' + item.entry.sourceId,
    ]) {
      if (!index.has(key)) index.set(key, []);
      index.get(key).push(item);
    }
  }
  const conflicts = new Map();
  // Refuse every ambiguous identity, never let input order choose a winner or invent IDs.
  for (const [key, group] of index)
    if (group.length > 1)
      for (const item of group) {
        if (!conflicts.has(item)) conflicts.set(item, []);
        conflicts.get(item).push(key);
      }
  for (const item of pending) {
    if (conflicts.has(item))
      rejected.push({
        ...item.context,
        reason: 'AMBIGUOUS_PUBLISHER_IDENTITY:' + conflicts.get(item).join(','),
      });
    else item.pack.entries.push(item.entry);
  }
  for (const pack of packs) {
    const meta = JSON.parse(pack.provenanceNote);
    const omitted = rejected.filter((r) => r.manifestPath === meta.manifestPath);
    if (omitted.length)
      pack.gapReason +=
        ' Refused normalization: ' +
        JSON.stringify(
          omitted.map(({ originalSourceId, reason }) => ({ originalSourceId, reason })),
        );
  }
  return {
    packs,
    report: {
      version: 1,
      policy:
        'All sources disabled; unknown rights not upgraded; coverage is calculated only by shared accountSourceCoverage; no acquisition.',
      inputs: inputs.map(({ lane, manifestPath, sha256, raw }) => ({
        lane,
        manifestPath,
        sha256,
        candidates: raw.sources.length,
      })),
      candidates: inputs.reduce((n, i) => n + i.raw.sources.length, 0),
      admittedRecords: packs.reduce((n, p) => n + p.entries.length, 0),
      rejected,
    },
  };
}
export function generatedFiles(result) {
  const files = {};
  for (const p of PROGRAMMES)
    files[p.lane.toLowerCase() + '-canonical-packs.json'] = result.packs.filter(
      (pack) => pack.governedRegion === p.region,
    );
  files['regional-admission.json'] = result.report;
  return files;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  fail(
    process.argv.includes('--check') || process.argv.includes('--write'),
    'Choose --check or --write; no network mode exists',
  );
  const {
    COUNTRIES,
    loadSourcePacks,
    EAST_AFRICA_MEMBERS,
    MIDDLE_EAST_MEMBERS,
  } = require('../../shared/dist');
  const { supranationalById } = require('../../backend/dist/modules/geo/supranational-membership');
  const regions = [
    {
      id: 'region:east-africa',
      members: EAST_AFRICA_MEMBERS,
      provenanceNote: 'Existing governed authority',
    },
    {
      id: 'region:middle-east',
      members: MIDDLE_EAST_MEMBERS,
      provenanceNote: 'Existing governed authority',
    },
    {
      id: 'region:european-union',
      members: supranationalById('region:european-union').members,
      provenanceNote: 'Existing EU27 authority',
    },
  ];
  const result = normalizeInputs(readInputs(), COUNTRIES);
  loadSourcePacks(result.packs, regions); // M validates the full combined snapshot before any output.
  for (const [name, value] of Object.entries(generatedFiles(result))) {
    const target = path.join(ROOT, 'backend/src/modules/global-reach/data', name),
      bytes = JSON.stringify(value, null, 2) + '\n';
    if (process.argv.includes('--check'))
      fail(fs.readFileSync(target, 'utf8') === bytes, 'STALE_CANONICAL_DATA:' + name);
    else fs.writeFileSync(target, bytes);
  }
  console.log(
    JSON.stringify(
      {
        countries: result.packs.length,
        candidates: result.report.candidates,
        admitted: result.report.admittedRecords,
        rejected: result.report.rejected,
      },
      null,
      2,
    ),
  );
}
