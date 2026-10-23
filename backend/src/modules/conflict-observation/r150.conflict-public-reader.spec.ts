import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { ConflictObservation, ConflictRetainedEvidenceDetail } from '@globalnews-ai/shared';
import { ConflictObservationController } from './conflict-observation.controller';
import { ConflictObservationRepository } from './conflict-observation.repository';
import {
  extractUcdpCandidateEvidenceDetail,
  normalizeUcdpCandidateCsv,
  UCDP_CANDIDATE_CSV_HEADERS,
  type ReviewedUcdpCandidateCsvCapture,
} from './ucdp-candidate-csv.normalizer';

/*
  CTO R150 / PD-1 — the PUBLIC Conflict reader never serializes the reporting publisher's expression that UCDP
  recorded: `sourceReference.citation` (source_article), `sourceHeadline` (source_headline) or `sourceOriginal`
  (source_original). UCDP's own facts stay. Records are built by the REAL Candidate normalizer and evidence extractor
  from a capture carrying SYNTHETIC sentinels (no real headline is copied here), then served over HTTP by the real
  controller. The frontend's `/conflict-data/:path*` is a pure rewrite to these two routes (next.config), so this is
  the same response a reader gets on either origin.
*/
const HEADLINE = 'SENTINEL-HEADLINE-r150 publisher words';
const ARTICLE_HEAD = 'SENTINEL-ARTICLE-r150 quoted title';
const ORIGINAL = 'SENTINEL-ORIGINAL-r150 free text';
const SENTINELS = [HEADLINE, ARTICLE_HEAD, ORIGINAL, 'SENTINEL-'];

const profile: ReviewedUcdpCandidateCsvCapture = {
  sha256: '0'.repeat(64),
  datasetVersion: '26.0.8-test',
  sourceUrl: 'https://ucdp.uu.se/downloads/candidateged/test.csv',
  schema: 'ucdp-candidate-csv-v1',
};
const csvCell = (v: string) => (/[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v);
function capture(): Buffer {
  const row: Record<string, string> = {
    ...Object.fromEntries(UCDP_CANDIDATE_CSV_HEADERS.map((k) => [k, ''])),
    id: '637360',
    type_of_violence: '3',
    side_a: 'Government of Afghanistan',
    side_b: 'Civilians',
    source_article: `Source A,2026-08-10,"${ARTICLE_HEAD}";Source B,2026-08-11,Other`,
    source_office: 'Hasht e Subh Daily;@someone on X;Kabul Now',
    source_headline: HEADLINE,
    source_original: ORIGINAL,
    where_prec: '2',
    where_description: 'Herat city',
    latitude: '34.349991',
    longitude: '62.200001',
    country: 'Afghanistan',
    date_prec: '1',
    date_start: '2026-08-10 00:00:00.000',
    date_end: '2026-08-10 00:00:00.000',
  };
  return Buffer.from(
    UCDP_CANDIDATE_CSV_HEADERS.join(',') + '\r\n' + UCDP_CANDIDATE_CSV_HEADERS.map((k) => csvCell(row[k])).join(',') + '\r\n',
  );
}

const [observation] = normalizeUcdpCandidateCsv(capture(), profile, {
  retrievalId: 'candidate-test',
  runId: 'candidate-run',
  ingestedAt: '2026-09-24T12:00:00Z',
});
const detail = extractUcdpCandidateEvidenceDetail(capture(), {
  observationKey: observation.observationKey,
  upstreamEventId: '637360',
  retrievalId: 'candidate-test',
  contentAddress: 'a'.repeat(64),
}) as ConflictRetainedEvidenceDetail;

describe('CTO R150 / PD-1 · public Conflict reader withholds publisher expression', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const repository: Partial<ConflictObservationRepository> = {
      latest: async () => [observation],
      evidenceDetail: async (key: string) => (key === observation.observationKey ? detail : null),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [ConflictObservationController],
      providers: [{ provide: ConflictObservationRepository, useValue: repository }],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });
  afterAll(async () => app.close());

  it('precondition (non-vacuous): the retained record and evidence DO carry every sentinel', () => {
    expect(observation.sourceReference.citation).toContain(ARTICLE_HEAD);
    expect(detail.sourceHeadline).toBe(HEADLINE);
    expect(detail.sourceOriginal).toBe(ORIGINAL);
  });

  it('GET /conflict/observations: no sentinel anywhere in the JSON, no citation key; UCDP facts kept', async () => {
    const res = await request(app.getHttpServer()).get('/conflict/observations').expect(200);
    for (const s of SENTINELS) expect(res.text).not.toContain(s);
    const [row] = res.body as ConflictObservation[];
    expect(row.sourceReference).not.toHaveProperty('citation');
    expect(row.sourceReference.reportingOffice).toBe('Hasht e Subh Daily; Kabul Now');
    expect(res.text).not.toMatch(/@someone|on X/);
    expect(row.observationKey).toBe(observation.observationKey);
    expect(row.identity).toEqual(observation.identity);
    expect(row.geography).toEqual(observation.geography);
    expect(row.temporal).toEqual(observation.temporal);
    expect(row.actors).toEqual(observation.actors);
    expect(row.revision.upstreamVersion).toBe('26.0.8-test');
  });

  it('GET /conflict/observations/:key/evidence: no headline, no source_original; UCDP facts kept', async () => {
    const res = await request(app.getHttpServer())
      .get(`/conflict/observations/${encodeURIComponent(observation.observationKey)}/evidence`)
      .expect(200);
    for (const s of SENTINELS) expect(res.text).not.toContain(s);
    expect(res.body).not.toHaveProperty('sourceHeadline');
    expect(res.body).not.toHaveProperty('sourceOriginal');
    expect(res.body).toMatchObject({
      observationKey: observation.observationKey,
      authority: 'UCDP_GED',
      upstreamEventId: '637360',
      sourceParties: detail.sourceParties,
      whereDescription: 'Herat city',
      snapshotRetrievalId: 'candidate-test',
    });
  });

  it('an unknown record still reads as empty, not as an error', async () => {
    const res = await request(app.getHttpServer()).get('/conflict/observations/missing/evidence').expect(200);
    expect(res.text).toBe('');
  });
});
