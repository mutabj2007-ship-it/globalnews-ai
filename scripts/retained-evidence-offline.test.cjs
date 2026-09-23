const { test } = require('node:test');
const assert = require('node:assert/strict');
// Tripwires installed before importing any domain code. No DB or provider is booted.
for (const name of ['node:http', 'node:https']) {
  const module = require(name);
  module.request = module.get = () => {
    throw Error('NETWORK_FORBIDDEN');
  };
}
require('node:net').Socket.prototype.connect = () => {
  throw Error('NETWORK_FORBIDDEN');
};
global.fetch = () => {
  throw Error('NETWORK_FORBIDDEN');
};
const { reviewArticles, admissionCheck } = require('./retained-evidence-offline.cjs');
const synthetic = {
  id: 'TEST-ONLY',
  title: 'Shooting reported',
  summary: 'The shooting was committed by an unaffiliated individual acting alone.',
  url: 'https://example.invalid/test-only',
  sourceId: 'test-only',
  sourceName: 'TEST ONLY',
  category: 'world',
  sourcesCount: 1,
  publishedAt: '2026-01-01T00:00:00Z',
  fetchedAt: '2026-01-02T00:00:00Z',
  publishedAtBasis: 'publisher',
  countries: [{ countryCode: 'PL', countryName: 'Poland', relevanceScore: 80, isRelevant: true }],
};
test('test-only internally reviewed candidate maps retained facts but never public approval', () => {
  const [review] = reviewArticles([synthetic]);
  assert.equal(review.classification.verdict, 'ADMITTED_TO_SECURITY');
  const result = review.projections[0];
  assert.equal(result.built, true);
  assert.equal(result.observation.temporal.retrievedAt, synthetic.fetchedAt);
  assert.equal(result.observation.temporal.occurredAt, undefined);
  assert.equal(result.observation.geography.precision, 'COUNTRY');
  assert.equal(result.observation.geography.provenance, 'INTERPRETED');
  assert.equal(result.observation.claim.headline, synthetic.title);
  assert.equal(result.observation.claimant, synthetic.sourceName);
  assert.equal(review.publicGate.permitted, false);
});
test('empty holdings stay empty', () => assert.deepEqual(reviewArticles([]), []));
test('missing retention timestamp and unresolved ownership refuse projection', () => {
  assert.equal(
    reviewArticles([{ ...synthetic, fetchedAt: undefined }])[0].projections[0].built,
    false,
  );
  assert.equal(
    reviewArticles([{ ...synthetic, summary: 'A shooting was reported.' }])[0].projections[0].built,
    false,
  );
});
test('no country inferred from headline or Article country field', () => {
  assert.deepEqual(
    reviewArticles([{ ...synthetic, countries: [], countryCode: 'PL' }])[0].projections,
    [],
  );
});
test('observed or unknown publication basis never becomes event or publisher time', () => {
  for (const publishedAtBasis of ['observed', 'untrusted']) {
    const result = reviewArticles([{ ...synthetic, publishedAtBasis }])[0].projections[0];
    assert.equal(result.observation.temporal.publisherVintage, undefined);
    assert.equal(result.observation.temporal.occurredAt, undefined);
  }
});
test('caller approval flags cannot cross either public gate', () => {
  const bytes = Buffer.from(JSON.stringify({ ...synthetic, reviewed: true, publicApproved: true }));
  for (const domain of ['humanitarian', 'security']) {
    assert.equal(admissionCheck(domain, bytes).permitted, false);
    assert.equal(admissionCheck(domain, bytes).persisted, false);
  }
});
test('human review receipt binds exact queue and record bytes without public promotion', () => {
  const { recordReview } = require('./retained-evidence-offline.cjs');
  const crypto = require('node:crypto');
  const queue = reviewArticles([synthetic]);
  const bytes = Buffer.from(JSON.stringify({ queue }));
  const decision = {
    queueSha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    reviewer: 'SYNTHETIC REVIEWER TEST ONLY',
    reviewedAt: '2026-01-03T00:00:00Z',
    records: [
      {
        retainedId: synthetic.id,
        recordSha256: queue[0].recordSha256,
        decision: 'REVIEWED_INTERNAL',
        reason: 'Synthetic mapping reviewed in test only',
      },
    ],
  };
  assert.equal(recordReview(bytes, decision).records[0].publicPermitted, false);
  assert.throws(() => recordReview(Buffer.from(JSON.stringify({ queue: [] })), decision));
  assert.throws(() =>
    recordReview(bytes, { ...decision, records: [decision.records[0], decision.records[0]] }),
  );
  assert.throws(() =>
    recordReview(bytes, {
      ...decision,
      records: [{ ...decision.records[0], decision: 'PUBLIC_APPROVED' }],
    }),
  );
});
