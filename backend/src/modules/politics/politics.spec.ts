import * as producer from './politics.producer';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { domainObservationKey } from '@globalnews-ai/shared';
import { politicsArtifactHash, producePoliticsLedger, producePoliticsObservation, type PoliticsCapture } from './politics.producer';
import { PoliticsReadModule } from './politics.module';

// Synthetic test evidence, local to this spec; never imported by the retained ledger.
function fixture(): PoliticsCapture {
  const text = 'Test source: a peaceful demonstration was held.';
  const sha256 = politicsArtifactHash(text);
  const identity = { domainId: 'POLITICS', upstreamAuthority: 'test-publisher', upstreamId: 'test-1' };
  return {
    artifact: { origin: 'CAPTURED_SOURCE', text, sha256, sourceUrl: 'https://example.org/test', capturedAt: '2026-09-02T12:00:00Z', language: 'sw' },
    review: {
      reviewer: 'Test reviewer', reviewedAt: '2026-09-02T14:00:00Z', rationale: 'Synthetic test review', rightsBasis: 'Synthetic test text',
      publicDisplayAuthorized: true, evidenceSufficient: true, activity: 'POLITICAL_PROCESS',
      ownership: { violenceOrProtectivePosture: false, organisedArmedActorParticipates: false },
      sustainedMobilisation: { kind: 'SUSTAINED_MOBILISATION', aboutRefs: ['test-subject'], admitted: true, decidedBy: 'Test editor', decidedAt: '2026-09-02T13:00:00Z', rationale: 'Synthetic sustained campaign evidence' },
    },
    observation: {
      observationKey: domainObservationKey(identity), identity, observationKind: 'PROTEST_HELD', subjectType: 'PROTEST_CAMPAIGN', subjectId: 'test-subject',
      claim: { kind: 'PROTEST_HELD', stage: 'HELD', sourceText: text },
      temporal: { occurredAt: '2026-09-01T09:00:00Z', publisherVintage: '2026-09-02T10:00:00Z', retrievedAt: '2026-09-02T12:00:00Z', temporalBasis: 'OCCURRENCE' },
      publishedAt: '2026-09-02T10:00:00Z', artifactSha256: sha256,
      provenance: { sourceType: 'NEWS_PROVIDER', sourceUrl: 'https://example.org/test', language: 'sw', retrievedAt: '2026-09-02T12:00:00Z', evidenceRole: 'REPORTING' },
      sourceReference: { sourceUrl: 'https://example.org/test' },
      attributeAuthorship: [{ attribute: 'kind', authorship: 'LOCALLY_ASSERTED' }, { attribute: 'stage', authorship: 'LOCALLY_ASSERTED' }, { attribute: 'sourceText', authorship: 'PUBLISHER_STATED' }],
      revision: { revisionOrdinal: 0, supersedesRevisionOrdinal: null, recordedAt: '2026-09-02T13:00:00Z' },
    },
  };
}
const mutate = (change: (c: PoliticsCapture) => void): PoliticsCapture => { const c = fixture(); change(c); return c; };

describe('Politics governed producer', () => {
  it('admits supported peaceful sustained protest and preserves provenance/authorship', () => {
    const c = fixture();
    expect(producePoliticsObservation(c)).toEqual(c.observation);
    expect(producePoliticsObservation(c).provenance.language).toBe('sw');
  });
  it.each<[string, (c: PoliticsCapture) => void]>([
    ['organized armed violence', c => { c.review.ownership = { violenceOrProtectivePosture: true, organisedArmedActorParticipates: true }; }],
    ['ordinary violence mentioning politics', c => { c.review.ownership = { violenceOrProtectivePosture: true, organisedArmedActorParticipates: false }; }],
    ['ordinary crime', c => { c.review.activity = 'CRIME'; }],
    ['speech alone', c => { c.review.activity = 'SPEECH_ONLY'; }],
    ['unknown activity', c => { c.review.activity = 'UNKNOWN'; }],
    ['insufficient evidence', c => { c.review.evidenceSufficient = false; }],
    ['unknown ownership', c => { c.review.ownership = { ...c.review.ownership, violenceOrProtectivePosture: undefined }; }],
    ['unknown armed actors', c => { c.review.ownership = { ...c.review.ownership, organisedArmedActorParticipates: undefined }; }],
    ['no sustained mobilisation decision', c => { delete c.review.sustainedMobilisation; }],
    ['preview fixture', c => { c.artifact.origin = 'PREVIEW_FIXTURE'; }],
    ['unreviewed rights', c => { c.review.publicDisplayAuthorized = false; }],
    ['changed capture bytes', c => { c.artifact.text += 'changed'; }],
    ['generated paraphrase', c => { c.observation.claim.sourceText = 'not in the captured source'; }],
    ['missing authorship', c => { (c.observation as any).attributeAuthorship = []; }],
    ['wrong language', c => { (c.observation.provenance as any).language = 'en'; }],
    ['publication after ingestion', c => { (c.observation as any).publishedAt = '2027-01-01T00:00:00Z'; }],
    ['event after ingestion', c => { (c.observation.temporal as any).occurredAt = '2027-01-01T00:00:00Z'; }],
    ['impossible calendar date', c => { (c.observation.temporal as any).occurredAt = '2026-02-30T00:00:00Z'; }],
    ['invalid date', c => { c.artifact.capturedAt = 'yesterday'; }],
  ])('withholds %s', (_name, change) => {
    const c = mutate(change);
    expect(() => producePoliticsObservation(c)).toThrow();
    expect(producePoliticsLedger([c])).toEqual({ observations: [], withheld: true });
  });
  it('admits a reviewed primary election process notice, never a preview or result', () => {
    const c = fixture();
    Object.assign(c.observation, { subjectType: 'ELECTION', observationKind: 'ELECTION_PROCESS_NOTICE', claim: { kind: 'ELECTION_PROCESS_NOTICE', stage: 'ANNOUNCED', sourceText: c.artifact.text } });
    Object.assign(c.observation.provenance, { evidenceRole: 'PRIMARY_RECORD' });
    expect(producePoliticsLedger([c]).observations).toHaveLength(1);
    c.artifact.origin = 'PREVIEW_FIXTURE';
    expect(producePoliticsLedger([c]).observations).toHaveLength(0);
    c.artifact.origin = 'CAPTURED_SOURCE';
    Object.assign(c.observation.claim, { stage: 'RESULT_DECLARED', winner: 'fabricated' });
    expect(producePoliticsLedger([c]).observations).toHaveLength(0);
  });
  it('requires primary evidence for legislative stages', () => {
    const c = fixture();
    Object.assign(c.observation, { subjectType: 'LEGISLATIVE_SUBJECT', observationKind: 'LEGISLATIVE_STAGE', claim: { kind: 'LEGISLATIVE_STAGE', stage: 'REJECTED', sourceText: c.artifact.text } });
    expect(producePoliticsLedger([c]).withheld).toBe(true);
    Object.assign(c.observation.provenance, { evidenceRole: 'PRIMARY_RECORD' });
    expect(producePoliticsLedger([c]).observations).toHaveLength(1);
  });
  it('deduplicates exact repeats without mutating the capture', () => {
    const c = fixture(), before = JSON.stringify(c);
    expect(producePoliticsLedger([c, c]).observations).toHaveLength(1);
    expect(JSON.stringify(c)).toBe(before);
  });
  it('withholds conflicting duplicates, missing revisions and invalid corrections', () => {
    const c = fixture(), next = fixture();
    Object.assign(next.observation.revision, { revisionOrdinal: 1, supersedesRevisionOrdinal: 0, revisionKind: 'SOURCE_REVISION' });
    expect(producePoliticsLedger([next, c]).observations[0].revision.revisionOrdinal).toBe(1);
    expect(producePoliticsLedger([next]).withheld).toBe(true);
    next.review.evidenceSufficient = false;
    expect(producePoliticsLedger([c, next]).observations).toHaveLength(0);
    const conflict = fixture();
    Object.assign(conflict.observation.temporal, { occurredAt: '2026-09-01T08:00:00Z' });
    expect(producePoliticsLedger([c, conflict]).observations).toHaveLength(0);
  });
  it('preserves separate publication, source revision, ingestion and record clocks', () => {
    const c = fixture();
    Object.assign(c.observation, { sourceUpdatedAt: '2026-09-02T11:00:00Z' });
    Object.assign(c.observation.temporal, { publisherVintage: c.observation.sourceUpdatedAt });
    expect(producePoliticsObservation(c)).toEqual(c.observation);
  });
  it('retractions suppress the latest claim and bounded ledgers fail closed', () => {
    const c = fixture(), next = fixture();
    Object.assign(next.observation.revision, { revisionOrdinal: 1, supersedesRevisionOrdinal: 0, revisionKind: 'RETRACTION' });
    expect(producePoliticsLedger([c, next])).toEqual({ observations: [], withheld: true });
    expect(producePoliticsLedger(Array(501).fill(c)).observations).toHaveLength(0);
  });
});

describe('public GET has no acquisition', () => {
  it('boots only Politics, returns honest absence, rejects unbounded reads, and makes zero outbound calls', async () => {
    const outbound = jest.spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('provider call forbidden'); });
    const http = jest.spyOn(require('node:http'), 'request');
    const https = jest.spyOn(require('node:https'), 'request');
    const module = await Test.createTestingModule({ imports: [PoliticsReadModule] }).compile();
    const app = module.createNestApplication();
    try {
      await app.init();
      expect(outbound).not.toHaveBeenCalled();
      expect(http).not.toHaveBeenCalled();
      expect(https).not.toHaveBeenCalled();
      const response = await request(app.getHttpServer()).get('/politics/observations').expect(200);
      expect(response.body).toEqual({ observations: [], absence: 'NOT_ASSESSED', truncated: false, acquisition: 'RETAINED_ONLY' });
      for (const query of ['limit=0', 'limit=101', 'limit=NaN', 'limit=1&limit=2', 'subjectId=']) {
        await request(app.getHttpServer()).get('/politics/observations?' + query).expect(400);
      }
      expect(outbound).not.toHaveBeenCalled();
      expect(https).not.toHaveBeenCalled();
      // HTTP calls are the six Supertest loopback requests, not outbound providers.
      expect(http).toHaveBeenCalledTimes(6);
    } finally { await app.close(); jest.restoreAllMocks(); }
  });
});

it('public read exposes admitted retained rows with bounded selection, never acquires', async () => {
  const admitted = producePoliticsObservation(fixture());
  const ledger = jest.spyOn(producer, 'producePoliticsLedger').mockReturnValue({ observations: Array(101).fill(admitted), withheld: false });
  const outbound = jest.spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('acquisition forbidden'); });
  const module = await Test.createTestingModule({ imports: [PoliticsReadModule] }).compile();
  const app = module.createNestApplication();
  try {
    await app.init();
    const response = await request(app.getHttpServer()).get('/politics/observations?subjectId=test-subject&limit=1').expect(200);
    expect(response.body.observations).toEqual([admitted]);
    expect(response.body.truncated).toBe(true);
    expect(response.body.absence).toBeNull();
    const empty = await request(app.getHttpServer()).get('/politics/observations?subjectId=missing').expect(200);
    expect(empty.body.observations).toEqual([]);
    expect(empty.body.absence).toBe('NOT_ASSESSED');
    expect(ledger).toHaveBeenCalledTimes(1); // initialized once, not per public read
    expect(outbound).not.toHaveBeenCalled();
  } finally { await app.close(); jest.restoreAllMocks(); }
});
