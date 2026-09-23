/* Offline only: no application bootstrap, database client, provider or HTTP dependency. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
require('ts-node').register({
  project: path.join(root, 'backend/tsconfig.json'),
  transpileOnly: true,
});
const {
  classifySecurityCandidate,
} = require('../backend/src/modules/security/classification/security-candidate.classifier');
const {
  buildSecurityObservation,
} = require('../backend/src/modules/security/provenance/security-observation.factory');
const {
  admitSecurityPublicContent,
} = require('../backend/src/modules/security/security-public-content');
const {
  NO_RETAINED_CAPTURE_APPROVAL,
} = require('../backend/src/modules/humanitarian/retained/retained-evidence');
const parse = (bytes) => JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const read = (file) => {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 32 * 1024 * 1024)
    throw Error('Regular local file <=32MiB required');
  return fs.readFileSync(file);
};
function inventory() {
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: root })
    .toString()
    .split('\0')
    .filter(Boolean);
  const artifacts = files
    .filter((p) => /\.(json|geojson|jsonl|csv|xml|html|txt|zip|tar)$/i.test(p))
    .map((p) => {
      const bytes = read(path.join(root, p));
      let value;
      try {
        value = parse(bytes);
      } catch {
        /* non-JSON catalogued by hash */
      }
      const rows = Array.isArray(value) ? value : value?.articles;
      const articleRows = Array.isArray(rows)
        ? rows.filter(
            (r) =>
              r &&
              typeof r.title === 'string' &&
              typeof r.summary === 'string' &&
              typeof r.url === 'string',
          ).length
        : 0;
      const fixture = /(^|\/)(fixtures?|__tests__)(\/|$)/i.test(p);
      const sourceAudit = p === 'backend/source-packs/east-africa-r1/captures.json';
      return {
        path: p,
        sha256: hash(bytes),
        bytes: bytes.length,
        articleRows,
        fixture,
        classification: fixture
          ? 'TEST_FIXTURE_EXCLUDED'
          : sourceAudit
            ? 'SOURCE_DISCOVERY_AUDIT_NOT_INCIDENT_CAPTURE'
            : articleRows
              ? 'ARTICLE_SHAPED_REQUIRES_REVIEW'
              : 'REFERENCE_CONFIGURATION_OR_UNVERIFIED_ARTIFACT',
        sourceAuditSamples: sourceAudit ? value.sources.filter((s) => s.sample).length : undefined,
        sourceAuditLinks: sourceAudit
          ? value.sources.reduce(
              (n, s) => n + (s.checks || []).reduce((m, c) => m + (c.xml?.items?.length || 0), 0),
              0,
            )
          : undefined,
        sourceAuditEntries:
          sourceAudit && Array.isArray(value?.sources) ? value.sources.length : undefined,
        publicAdmission: 'NOT_ESTABLISHED',
      };
    });
  return {
    scope:
      'Git-tracked data-like files only; ignores untracked/ignored holdings; does not expand archives or access DB/network',
    artifacts,
    dataLikeFiles: artifacts.length,
    nonFixtureArticleRows: artifacts
      .filter((a) => !a.fixture)
      .reduce((n, a) => n + a.articleRows, 0),
    articleShapedRows: artifacts.reduce((n, a) => n + a.articleRows, 0),
    limitations: [
      'Shape discovery is not rights, provenance or review approval.',
      'DB Article/ArticleCountry and SecurityObservation holdings are unmeasured.',
      'No installed Humanitarian capture review or Security publication grant.',
    ],
  };
}
function reviewArticles(rows) {
  if (!Array.isArray(rows) || rows.length > 10000)
    throw Error('Expected <=10000 retained Article rows');
  return rows.map((row) => {
    if (
      !row ||
      typeof row !== 'object' ||
      typeof row.title !== 'string' ||
      typeof row.summary !== 'string'
    )
      throw Error('Invalid retained Article');
    const decision = classifySecurityCandidate(row);
    const countries = Array.isArray(row.countries) ? row.countries : [];
    const projections = countries
      .filter((g) => g.isRelevant === true)
      .map((g) => {
        if (
          !/^[A-Z]{2}$/.test(g.countryCode) ||
          typeof g.countryName !== 'string' ||
          !Number.isFinite(g.relevanceScore)
        )
          return { built: false, refusal: 'Invalid retained ArticleCountry attribution' };
        const article = {
          ...row,
          firstSeenAt: row.fetchedAt,
          providerId: undefined,
          publishedAtBasis: ['publisher', 'observed'].includes(row.publishedAtBasis)
            ? row.publishedAtBasis
            : 'unproven',
        };
        return buildSecurityObservation(article, g, decision);
      });
    return {
      retainedId: row.id,
      recordSha256: hash(JSON.stringify(row)),
      classification: decision,
      status: 'INTERNAL_REVIEW_QUEUE_NOT_PUBLIC',
      projections,
      limitations: [
        'Country is corpus attribution, not incident location.',
        'Provider identity is not persisted on Article; do not reconstruct GNews/GDELT identity.',
        'Publication is not occurrence time; no actor, cause, severity or confidence finding.',
      ],
      publicGate: admitSecurityPublicContent(row),
      humanitarian: 'NO_ARTICLE_TO_HUMANITARIAN_ADMISSION_RULE',
    };
  });
}
function recordReview(queueBytes, decisions) {
  const queue = parse(queueBytes);
  if (
    !Array.isArray(queue.queue) ||
    !decisions ||
    decisions.queueSha256 !== hash(queueBytes) ||
    typeof decisions.reviewer !== 'string' ||
    !decisions.reviewer.trim() ||
    !Number.isFinite(Date.parse(decisions.reviewedAt)) ||
    !Array.isArray(decisions.records)
  )
    throw Error('Hash-bound reviewer, review time and decisions required');
  const seen = new Set();
  const records = decisions.records.map((d) => {
    const candidate = queue.queue.find(
      (q) => q.retainedId === d.retainedId && q.recordSha256 === d.recordSha256,
    );
    if (
      !candidate ||
      seen.has(d.retainedId) ||
      !['REVIEWED_INTERNAL', 'REJECTED'].includes(d.decision) ||
      typeof d.reason !== 'string' ||
      !d.reason.trim()
    )
      throw Error('Unknown, duplicate or incomplete review decision');
    seen.add(d.retainedId);
    return { ...d, publicPermitted: false };
  });
  return {
    ...decisions,
    records,
    status: 'INTERNAL_REVIEW_RECEIPT_NOT_PUBLIC_AUTHORITY',
    publicObservations: [],
  };
}
function admissionCheck(domain, bytes) {
  if (domain === 'security')
    return { ...admitSecurityPublicContent(parse(bytes)), persisted: false };
  if (domain !== 'humanitarian') throw Error('Expected humanitarian or security');
  return {
    permitted: false,
    reason:
      NO_RETAINED_CAPTURE_APPROVAL.review(hash(bytes)) === null
        ? 'NO_MATCHING_GOVERNED_CAPTURE_APPROVAL'
        : 'CURRENT_PROTECTION_AND_PUBLIC_READER_REQUIRED',
    persisted: false,
  };
}
function main(args) {
  const [command, input, extra] = args;
  if (command === 'inventory' && !input) return inventory();
  if (command === 'review' && input && !extra) {
    const bytes = read(input);
    return {
      exportSha256: hash(bytes),
      queue: reviewArticles(parse(bytes)),
      publicObservations: [],
    };
  }
  if (command === 'record-review' && input && extra)
    return recordReview(read(input), parse(read(extra)));
  if (command === 'admit' && input && extra) return admissionCheck(input, read(extra));
  throw Error(
    'Usage: node scripts/retained-evidence-offline.cjs inventory | review <local-article-export.json> | record-review <queue.json> <decisions.json> | admit <humanitarian|security> <local-record.json>',
  );
}
module.exports = { inventory, reviewArticles, recordReview, admissionCheck, main };
if (require.main === module) {
  try {
    const result = main(process.argv.slice(2));
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    if (result.permitted === false) process.exitCode = 2;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
