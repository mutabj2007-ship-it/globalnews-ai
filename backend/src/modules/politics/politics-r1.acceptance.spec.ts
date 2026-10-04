import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { domainObservationKey } from '@globalnews-ai/shared';
import { PrismaClient } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { routeAskR2 } from '../ask-router/ask-r2-route';
import { landedSpecialistRegistryPort } from '../ask-router/specialist-registry.port';
import { AskSpecialistReadCoordinator } from '../ask-intelligence/ask-specialist-read.coordinator';
import { politicsArtifactHash, type PoliticsCapture } from './politics.producer';
import { PoliticsObservationRepository } from './politics-observation.repository';

/*
  POLITICS INTEL R1 — FIRST END-TO-END ACCEPTANCE (promotion gate G8/G9).

  Every query runs through the ONE shared path: the real router (routeAskR2, prior turn via priorQuestion)
  → the real contributor selection → the real AskSpecialistReadCoordinator → the real
  PoliticsObservationRepository on disposable local PostgreSQL. No model, no provider, no network.
  Rows are SYNTHETIC (E1: Sejm is BLOCKED_RIGHTS): this proves wiring, never coverage.

  The spec asserts only invariants that must ALWAYS hold. Positive outcomes are scored by the gate's
  evaluator from POLITICS_ACCEPTANCE_REPORT, so a dependency gap is a reported FAIL, never hidden.
*/
const url = process.env.POLITICS_TEST_DATABASE_URL;
const QUERIES = process.env.POLITICS_ACCEPTANCE_QUERIES;
const REPORT = process.env.POLITICS_ACCEPTANCE_REPORT;
const live = url ? describe : describe.skip;
const schema = `politics_accept_${randomUUID().replace(/-/g, '')}`;
const migrations = join(__dirname, '../../../prisma/migrations');
const NOW = new Date('2026-10-04T12:00:00.000Z');

interface Query { id: string; kind: 'POS' | 'NEG'; language: 'en' | 'pl'; turns: string[] }

const DEFAULT_QUERIES: Query[] = [
  { id: 'P1-EN', kind: 'POS', language: 'en', turns: ['What changed politically in Poland?'] },
  { id: 'P2-EN', kind: 'POS', language: 'en', turns: ['What did the Sejm decide?'] },
  { id: 'N1-EN', kind: 'NEG', language: 'en', turns: ['What is the weather in Poland?'] },
  { id: 'N3-EN', kind: 'NEG', language: 'en', turns: ["What is Poland's inflation rate?"] },
];

live('Politics R1 acceptance through the shared Ask path (synthetic rows, no providers)', () => {
  let db: Client;
  let prisma: PrismaClient;
  let repository: PoliticsObservationRepository;
  let n = 0;
  const seededQuotations: string[] = [];
  const otherReads = { conflict: 0, market: 0, economy: 0 };

  async function retain(text: string) {
    const bytes = new Uint8Array(Buffer.from(text, 'utf8'));
    const hash = politicsArtifactHash(text);
    const retrievalId = `accept-${++n}`;
    const at = new Date(Date.UTC(2026, 9, 2, 12));
    await prisma.snapshotPayload.upsert({ where: { contentAddress: hash }, update: {}, create: { contentAddress: hash, bytes, byteLength: bytes.length, mediaType: 'text/plain' } });
    await prisma.snapshotRetrieval.create({ data: {
      retrievalId, providerId: 'SYNTHETIC_LEGISLATURE', endpointId: 'synthetic-acceptance', requestPath: 'test', parameters: [],
      requestedAt: at, retrievedAt: at, httpStatus: 200, mediaType: 'text/plain', byteLength: bytes.length, contentAddress: hash,
      completeness: 'COMPLETE', contentEncoding: 'identity', wireByteLength: bytes.length, admissibility: 'ADMITTED',
      parserId: 'synthetic', parserVersion: '1', parsedAt: at, rightsGrade: 'E-5', rightsInstrumentRef: 'synthetic-test-only',
      payloadRetentionPermitted: true, editionAnnotations: {},
    } });
    return { snapshotRetrievalId: retrievalId };
  }

  function bill(upstreamId: string, jurisdiction: 'PL' | 'KE', stage: string, ordinal: number, text: string): PoliticsCapture {
    const sha256 = politicsArtifactHash(text);
    const identity = { domainId: 'POLITICS', upstreamAuthority: `synthetic-legislature-${jurisdiction}`, upstreamId };
    const m = String(ordinal).padStart(2, '0');
    const sourceUrl = `https://example.org/${jurisdiction}/bill/${upstreamId}`;
    seededQuotations.push(text);
    return {
      artifact: { origin: 'CAPTURED_SOURCE', text, sha256, sourceUrl, capturedAt: `2026-10-02T12:${m}:00Z`, language: jurisdiction === 'PL' ? 'pl' : 'en' },
      review: {
        reviewer: 'Acceptance reviewer', reviewedAt: `2026-10-02T14:${m}:00Z`, rationale: 'Synthetic acceptance review', rightsBasis: 'synthetic-test-only',
        publicDisplayAuthorized: true, evidenceSufficient: true, activity: 'POLITICAL_PROCESS',
        ownership: { violenceOrProtectivePosture: false, organisedArmedActorParticipates: false },
      },
      observation: {
        observationKey: domainObservationKey(identity), identity, observationKind: 'LEGISLATIVE_STAGE', subjectType: 'LEGISLATIVE_SUBJECT',
        subjectId: `bill-${upstreamId}`, claim: { kind: 'LEGISLATIVE_STAGE', stage: stage as 'PASSED', sourceText: text },
        temporal: { occurredAt: '2026-09-18T10:00:00Z', publisherVintage: '2026-09-18T12:00:00Z', retrievedAt: `2026-10-02T12:${m}:00Z`, temporalBasis: 'OCCURRENCE' },
        publishedAt: '2026-09-18T12:00:00Z', artifactSha256: sha256,
        provenance: { sourceType: 'OFFICIAL_SOURCE', jurisdiction, institution: `Synthetic legislature (${jurisdiction})`, sourceUrl, language: jurisdiction === 'PL' ? 'pl' : 'en', retrievedAt: `2026-10-02T12:${m}:00Z`, evidenceRole: 'PRIMARY_RECORD' },
        sourceReference: { sourceUrl, citation: `Synthetic bill ${upstreamId}` },
        attributeAuthorship: [{ attribute: 'kind', authorship: 'LOCALLY_ASSERTED' }, { attribute: 'stage', authorship: 'LOCALLY_ASSERTED' }, { attribute: 'sourceText', authorship: 'PUBLISHER_STATED' }],
        revision: ordinal === 0
          ? { revisionOrdinal: 0, supersedesRevisionOrdinal: null, recordedAt: `2026-10-02T13:${m}:00Z` }
          : { revisionOrdinal: ordinal, supersedesRevisionOrdinal: ordinal - 1, revisionKind: 'SOURCE_REVISION', recordedAt: `2026-10-02T13:${m}:00Z` },
      },
    };
  }

  const coordinator = () => new AskSpecialistReadCoordinator(
    { currentForCountry: async () => { otherReads.conflict++; return []; }, evidenceDetails: async () => new Map(), currentByKey: async () => null } as never,
    { procurement: async () => { otherReads.market++; return []; } } as never,
    { readNisrHeadlineCpi: async () => { otherReads.economy++; return { slot: { kind: 'GAP', seriesId: 'x', periodId: 'UNKNOWN', reason: 'NO_PRODUCER' }, publishable: false, retainedState: 'NO_CAPTURE' }; } } as never,
    repository,
  );

  beforeAll(async () => {
    const parsed = new URL(url!);
    if (!['localhost', '127.0.0.1'].includes(parsed.hostname)) throw new Error('TEST_DATABASE_MUST_BE_LOCAL');
    db = new Client({ connectionString: url });
    await db.connect();
    await db.query(`CREATE SCHEMA "${schema}"`);
    await db.query(`SET search_path TO "${schema}"`);
    for (const m of ['20260919030000_add_official_data_snapshot_store', '20260919040000_add_market_scheduled_ingest', '20260919050000_snapshot_admission_r2',
      '20260920140000_snapshot_retrieval_lineage_fields', '20261004120000_politics_observation_store', '20261004130000_politics_reinstatement'])
      await db.query(readFileSync(join(migrations, m, 'migration.sql'), 'utf8'));
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, options: `-c search_path=${schema}` }, { schema }) });
    repository = new PoliticsObservationRepository(prisma as PrismaService);
    // seedProfile (acceptance-queries.json): bill-A rev0 PASSED → rev1 SIGNED; bill-B rev0 INTRODUCED; one KEN control row.
    for (const c of [
      bill('A', 'PL', 'PASSED', 0, 'Synthetic record A: the bill was passed at third reading.'),
      bill('A', 'PL', 'SIGNED', 1, 'Synthetic record A: the bill was signed.'),
      bill('B', 'PL', 'INTRODUCED', 0, 'Synthetic record B: the bill was introduced.'),
      bill('K', 'KE', 'PASSED', 0, 'Synthetic record K: the bill was passed.'),
    ]) await repository.append(c, await retain(c.artifact.text));
  }, 60_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    if (db) { await db.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await db.end(); }
  });

  it('runs every acceptance query through the shared path and writes the report', async () => {
    const queries: Query[] = QUERIES ? JSON.parse(readFileSync(QUERIES, 'utf8')).queries : DEFAULT_QUERIES;
    const c = coordinator();
    const report = [];
    for (const q of queries) {
      let prior: string | undefined;
      let set: Awaited<ReturnType<AskSpecialistReadCoordinator['read']>> | undefined;
      for (const turn of q.turns) {
        const route = routeAskR2(
          { originalQuestion: turn, sourceLanguage: q.language, normalizationLanguage: q.language, displayLanguage: q.language, origin: 'ASK' },
          { computeConsent: 'GRANTED', requestInstant: NOW.toISOString(), ...(prior === undefined ? {} : { priorQuestion: prior }) },
          { specialistRegistry: landedSpecialistRegistryPort(() => ['CONFLICT'], ['CONFLICT']) },
        );
        set = await c.read(route, NOW);
        prior = turn;
      }
      const politics = set!.contributions.filter((x) => x.contributorId === 'POLITICS');
      const observations = politics.flatMap((x) => x.observations);
      const flat = JSON.stringify(set!.contributions);
      report.push({
        id: q.id,
        politicsRowsRetrieved: observations.map((o) => o.reference),
        politicsCountries: [...new Set(observations.map((o) => o.geography))],
        eventKinds: [...new Set(observations.map((o) => o.kind.split(':')[0]))],
        revisionOrdinals: Object.fromEntries(observations.map((o) => [o.reference, o.provenance?.revisionOrdinal])),
        citations: observations.map((o) => ({
          retrievalKey: o.reference, sourceUrl: o.source.url, artifactSha256: o.provenance?.artifactSha256,
          sourceType: o.provenance?.sourceType, evidenceRole: o.provenance?.evidenceRole,
        })),
        changeStates: [],
        quotationRendered: seededQuotations.some((text) => flat.includes(text)),
        absence: politics.length === 0 ? 'NOT_CONSIDERED' : politics[0].status === 'USED' ? null : politics[0].status,
        politicsStatus: politics.map((x) => x.status),
        politicsDisclosures: politics.flatMap((x) => x.disclosures),
      });
    }
    if (REPORT) writeFileSync(REPORT, JSON.stringify(report, null, 2));

    // INVARIANTS that must always hold, whatever the positive outcome:
    for (const r of report) {
      expect({ id: r.id, quotationRendered: r.quotationRendered }).toEqual({ id: r.id, quotationRendered: false });
      if (queries.find((q) => q.id === r.id)?.kind === 'NEG') expect({ id: r.id, rows: r.politicsRowsRetrieved }).toEqual({ id: r.id, rows: [] });
      // A retained official record is never presented as current.
      if (r.politicsRowsRetrieved.length) expect(r.politicsDisclosures).toContain('RETAINED_NOT_CURRENT');
      // Superseded revisions never leak: one row per identity.
      expect(new Set(r.politicsRowsRetrieved).size).toBe(r.politicsRowsRetrieved.length);
    }
  });

  it('freshness: an older admitted record is still served, with its own date and an explicit no-recent disclosure', async () => {
    const route = routeAskR2(
      { originalQuestion: 'What changed politically in Poland?', sourceLanguage: 'en', normalizationLanguage: 'en', displayLanguage: 'en', origin: 'ASK' },
      { computeConsent: 'GRANTED', requestInstant: NOW.toISOString() },
      { specialistRegistry: landedSpecialistRegistryPort(() => ['CONFLICT'], ['CONFLICT']) },
    );
    Object.assign(otherReads, { conflict: 0, market: 0, economy: 0 });
    const set = await coordinator().read(route, NOW);
    const p = set.contributions.find((x) => x.contributorId === 'POLITICS')!;
    expect(p.status).toBe('USED');
    expect(p.temporalBasis).toBe('RETAINED_OFFICIAL_RECORD');
    // Event 2026-09-18, retrieved 2026-10-02, asked 2026-10-04: the 7-day window is judged on the EVENT date.
    expect(p.disclosures).toEqual(expect.arrayContaining(['RETAINED_NOT_CURRENT', 'NO_RECENT_RETAINED_RECORD']));
    for (const o of p.observations) {
      expect(o.period).toBe('2026-09-18');
      expect(o.provenance?.effectiveAt).toBe('2026-09-18T10:00:00Z');
      expect(o.retainedAt).not.toBe(o.provenance?.effectiveAt);
    }
    // The current revision of bill A (SIGNED, ordinal 1) is served; the superseded PASSED revision is not.
    const a = p.observations.find((o) => o.kind === 'LEGISLATIVE_STAGE:SIGNED');
    expect(a?.provenance?.revisionOrdinal).toBe(1);
    expect(p.observations.some((o) => o.kind === 'LEGISLATIVE_STAGE:PASSED' && o.geography === 'POL')).toBe(false);
    // A Politics read touches no other governed store.
    expect(otherReads).toEqual({ conflict: 0, market: 0, economy: 0 });
  });
});
