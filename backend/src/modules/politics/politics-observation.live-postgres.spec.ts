import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { domainObservationKey } from '@globalnews-ai/shared';
import { PrismaClient } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { politicsArtifactHash, type PoliticsCapture } from './politics.producer';
import { PoliticsObservationRepository } from './politics-observation.repository';

/*
  POLITICS INTEL R1 — the retained Politics store on disposable PostgreSQL. Opt-in, loopback only,
  one random schema per run. Synthetic evidence only: no provider, no fetch, no real Sejm capture.
  Covers Claude A's SUPER-01..04 against the database, plus the store's own append-only guarantees.
*/
const url = process.env.POLITICS_TEST_DATABASE_URL;
const schema = `politics_test_${randomUUID().replace(/-/g, '')}`;
const migrations = join(__dirname, '../../../prisma/migrations');
const live = url ? describe : describe.skip;

live('Politics retained store on disposable PostgreSQL (no providers)', () => {
  let db: Client;
  let prisma: PrismaClient;
  let repository: PoliticsObservationRepository;
  let captureNumber = 0;

  /** Retain bytes in the SHARED capture store, exactly as an acquisition adapter would. */
  async function retain(text: string): Promise<{ snapshotRetrievalId: string }> {
    const bytes = new Uint8Array(Buffer.from(text, 'utf8'));
    const hash = politicsArtifactHash(text);
    const retrievalId = `politics-test-${++captureNumber}`;
    const at = new Date(Date.UTC(2026, 9, 2, 12, 0, 0));
    await prisma.snapshotPayload.upsert({
      where: { contentAddress: hash },
      update: {},
      create: { contentAddress: hash, bytes, byteLength: bytes.length, mediaType: 'text/plain' },
    });
    await prisma.snapshotRetrieval.create({
      data: {
        retrievalId, providerId: 'SYNTHETIC_LEGISLATURE', endpointId: 'synthetic-test', requestPath: 'test',
        parameters: [], requestedAt: at, retrievedAt: at, httpStatus: 200, mediaType: 'text/plain',
        byteLength: bytes.length, contentAddress: hash, completeness: 'COMPLETE', contentEncoding: 'identity',
        wireByteLength: bytes.length, admissibility: 'ADMITTED', parserId: 'synthetic', parserVersion: '1',
        parsedAt: at, rightsGrade: 'E-5', rightsInstrumentRef: 'synthetic-test-only',
        payloadRetentionPermitted: true, editionAnnotations: {},
      },
    });
    return { snapshotRetrievalId: retrievalId };
  }

  /** A synthetic primary legislative-stage record from an official PL source. */
  function capture(upstreamId: string, over: { text?: string; stage?: string; ordinal?: number; kind?: string; subjectId?: string } = {}): PoliticsCapture {
    const text = over.text ?? `Synthetic record ${upstreamId}: the bill was passed at third reading.`;
    const sha256 = politicsArtifactHash(text);
    const identity = { domainId: 'POLITICS', upstreamAuthority: 'synthetic-legislature', upstreamId };
    const ordinal = over.ordinal ?? 0;
    const minute = String(ordinal).padStart(2, '0');
    return {
      artifact: { origin: 'CAPTURED_SOURCE', text, sha256, sourceUrl: `https://example.org/bill/${upstreamId}`, capturedAt: `2026-10-02T12:${minute}:00Z`, language: 'pl' },
      review: {
        reviewer: 'Test reviewer', reviewedAt: `2026-10-02T14:${minute}:00Z`, rationale: 'Synthetic test review', rightsBasis: 'synthetic-test-only',
        publicDisplayAuthorized: true, evidenceSufficient: true, activity: 'POLITICAL_PROCESS',
        ownership: { violenceOrProtectivePosture: false, organisedArmedActorParticipates: false },
      },
      observation: {
        observationKey: domainObservationKey(identity), identity, observationKind: 'LEGISLATIVE_STAGE',
        subjectType: 'LEGISLATIVE_SUBJECT', subjectId: over.subjectId ?? `bill-${upstreamId}`,
        claim: { kind: 'LEGISLATIVE_STAGE', stage: (over.stage ?? 'PASSED') as 'PASSED', sourceText: text },
        temporal: { occurredAt: '2026-10-01T10:00:00Z', publisherVintage: '2026-10-02T09:00:00Z', retrievedAt: `2026-10-02T12:${minute}:00Z`, temporalBasis: 'OCCURRENCE' },
        publishedAt: '2026-10-02T09:00:00Z', artifactSha256: sha256,
        provenance: { sourceType: 'OFFICIAL_SOURCE', jurisdiction: 'PL', institution: 'Synthetic Legislature', sourceUrl: `https://example.org/bill/${upstreamId}`, language: 'pl', retrievedAt: `2026-10-02T12:${minute}:00Z`, evidenceRole: 'PRIMARY_RECORD' },
        sourceReference: { sourceUrl: `https://example.org/bill/${upstreamId}`, citation: `Synthetic bill ${upstreamId}` },
        attributeAuthorship: [{ attribute: 'kind', authorship: 'LOCALLY_ASSERTED' }, { attribute: 'stage', authorship: 'LOCALLY_ASSERTED' }, { attribute: 'sourceText', authorship: 'PUBLISHER_STATED' }],
        revision: ordinal === 0
          ? { revisionOrdinal: 0, supersedesRevisionOrdinal: null, recordedAt: `2026-10-02T13:${minute}:00Z` }
          : { revisionOrdinal: ordinal, supersedesRevisionOrdinal: ordinal - 1, revisionKind: (over.kind ?? 'SOURCE_REVISION') as 'SOURCE_REVISION', recordedAt: `2026-10-02T13:${minute}:00Z` },
      },
    };
  }

  beforeAll(async () => {
    const parsed = new URL(url!);
    if (!['localhost', '127.0.0.1'].includes(parsed.hostname)) throw new Error('TEST_DATABASE_MUST_BE_LOCAL');
    db = new Client({ connectionString: url });
    await db.connect();
    await db.query(`CREATE SCHEMA "${schema}"`);
    await db.query(`SET search_path TO "${schema}"`);
    for (const migration of [
      '20260919030000_add_official_data_snapshot_store',
      '20260919040000_add_market_scheduled_ingest',
      '20260919050000_snapshot_admission_r2',
      '20260920140000_snapshot_retrieval_lineage_fields',
      '20261004120000_politics_observation_store',
    ])
      await db.query(readFileSync(join(migrations, migration, 'migration.sql'), 'utf8'));
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, options: `-c search_path=${schema}` }, { schema }) });
    repository = new PoliticsObservationRepository(prisma as PrismaService);
  }, 60_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    if (db) {
      await db.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await db.end();
    }
  });

  it('admits a reviewed primary record with its retained capture and reads it back canonically', async () => {
    const c = capture('a1');
    const stored = await repository.append(c, await retain(c.artifact.text));
    expect(stored).toEqual(c.observation);
    expect(await repository.currentByKey(c.observation.observationKey)).toEqual(c.observation);
    const row = await prisma.politicsObservation.findFirstOrThrow({ where: { upstreamId: 'a1' } });
    expect(row.countryIso3).toBe('POL');
    expect(row.effectiveOn.toISOString()).toBe('2026-10-01T10:00:00.000Z');
    expect(row.language).toBe('pl');
  });

  it('the shared-searchable record carries citation and clocks, never review or rights data', async () => {
    const [record] = await repository.searchRecords({ countryIso3: 'POL' }, 5);
    expect(record).toMatchObject({
      domain: 'POLITICS', eventKind: 'LEGISLATIVE_STAGE', stage: 'PASSED', countryIso3: 'POL',
      effectiveAt: '2026-10-01T10:00:00Z', temporalBasis: 'OCCURRENCE', language: 'pl',
      sourceType: 'OFFICIAL_SOURCE', evidenceRole: 'PRIMARY_RECORD',
      citation: { sourceUrl: 'https://example.org/bill/a1', label: 'Synthetic bill a1' },
      quotation: { authorship: 'PUBLISHER_STATED', readerRenderable: false },
    });
    const flat = JSON.stringify(record);
    for (const forbidden of ['reviewer', 'rationale', 'rightsBasis', 'snapshotRetrievalId', 'publicDisplayAuthorized', 'people'])
      expect(flat).not.toContain(forbidden);
  });

  it('re-appending the identical revision is idempotent; a different record at that ordinal is refused', async () => {
    const c = capture('a1');
    await repository.append(c, await retain(c.artifact.text));
    expect(await prisma.politicsObservation.count({ where: { upstreamId: 'a1' } })).toBe(1);
    const conflicting = capture('a1', { stage: 'REJECTED' });
    await expect(repository.append(conflicting, await retain(conflicting.artifact.text))).rejects.toThrow(/conflicting record/);
  });

  it('SUPER-01 · a source revision supersedes; only the latest ordinal is current, history is kept', async () => {
    const r1 = capture('a1', { ordinal: 1, stage: 'SIGNED', text: 'Synthetic record a1: the bill was signed.' });
    await repository.append(r1, await retain(r1.artifact.text));
    const current = await repository.current({ subjectId: 'bill-a1' });
    expect(current).toHaveLength(1);
    expect(current[0].revision.revisionOrdinal).toBe(1);
    expect(current[0].claim.stage).toBe('SIGNED');
    expect(await prisma.politicsObservation.count({ where: { upstreamId: 'a1' } })).toBe(2);
  });

  it('SUPER-02 · a retraction withholds the identity entirely and closes its chain', async () => {
    const c0 = capture('r1');
    await repository.append(c0, await retain(c0.artifact.text));
    const retract = capture('r1', { ordinal: 1, kind: 'RETRACTION' });
    await repository.append(retract, await retain(retract.artifact.text));
    expect(await repository.currentByKey(c0.observation.observationKey)).toBeNull();
    expect((await repository.current()).map(o => o.identity.upstreamId)).not.toContain('r1');
    expect((await repository.inventory()).withheld).toBe(true);
    const after = capture('r1', { ordinal: 2 });
    await expect(repository.append(after, await retain(after.artifact.text))).rejects.toThrow(/retracted/);
  });

  it('SUPER-03 · a missing predecessor is refused by the repository AND by the database', async () => {
    const orphan = capture('o1', { ordinal: 1 });
    await expect(repository.append(orphan, await retain(orphan.artifact.text))).rejects.toThrow(/preceding revision/);
    await expect(db.query(`INSERT INTO "PoliticsObservation"
      ("id","observationKey","upstreamAuthority","upstreamId","subjectType","subjectId","observationKind","claim",
       "temporal","provenance","sourceReference","attributeAuthorship","revision","revisionOrdinal","publishedAt",
       "artifactSha256","review","snapshotRetrievalId","snapshotAdmissibility","effectiveOn","retrievedAt","temporalBasis","language")
      SELECT 'raw-orphan','raw-key','x','raw',"subjectType","subjectId","observationKind","claim","temporal","provenance",
        "sourceReference","attributeAuthorship",'{"revisionOrdinal":1,"supersedesRevisionOrdinal":0,"revisionKind":"CORRECTION","recordedAt":"2026-10-02T13:00:00Z"}',
        1,"publishedAt","artifactSha256","review","snapshotRetrievalId","snapshotAdmissibility","effectiveOn","retrievedAt","temporalBasis","language"
      FROM "PoliticsObservation" LIMIT 1`)).rejects.toThrow(/exact, unretracted preceding revision/);
  });

  it('SUPER-04 · a revision cannot retarget its subject (repository and database)', async () => {
    const c0 = capture('s1');
    await repository.append(c0, await retain(c0.artifact.text));
    const moved = capture('s1', { ordinal: 1, subjectId: 'another-bill' });
    await expect(repository.append(moved, await retain(moved.artifact.text))).rejects.toThrow(/retarget/);
    await expect(db.query(`INSERT INTO "PoliticsObservation"
      ("id","observationKey","upstreamAuthority","upstreamId","subjectType","subjectId","observationKind","claim",
       "temporal","provenance","sourceReference","attributeAuthorship","revision","revisionOrdinal","publishedAt",
       "artifactSha256","review","snapshotRetrievalId","snapshotAdmissibility","effectiveOn","retrievedAt","temporalBasis","language")
      SELECT 'raw-retarget',"observationKey","upstreamAuthority","upstreamId","subjectType",'another-bill',"observationKind","claim","temporal","provenance",
        "sourceReference","attributeAuthorship",'{"revisionOrdinal":1,"supersedesRevisionOrdinal":0,"revisionKind":"CORRECTION","recordedAt":"2026-10-02T13:30:00Z"}',
        1,"publishedAt","artifactSha256","review","snapshotRetrievalId","snapshotAdmissibility","effectiveOn","retrievedAt","temporalBasis","language"
      FROM "PoliticsObservation" WHERE "upstreamId" = 's1'`)).rejects.toThrow(/preceding revision/);
  });

  it('is append-only: UPDATE, DELETE and TRUNCATE are refused', async () => {
    await expect(db.query(`UPDATE "PoliticsObservation" SET "language" = 'en'`)).rejects.toThrow(/append-only/);
    await expect(db.query(`DELETE FROM "PoliticsObservation"`)).rejects.toThrow(/append-only/);
    await expect(db.query(`TRUNCATE "PoliticsObservation"`)).rejects.toThrow(/append-only/);
  });

  it('refuses a capture link whose retained bytes are not this artifact, and anything the producer withholds', async () => {
    const c = capture('l1');
    await expect(repository.append(c, await retain('different bytes entirely'))).rejects.toThrow(/capture link/);
    const secondary = capture('l2');
    (secondary.observation.provenance as { evidenceRole: string }).evidenceRole = 'REPORTING';
    await expect(repository.append(secondary, await retain(secondary.artifact.text))).rejects.toThrow(/withheld/);
    expect(await prisma.politicsObservation.count({ where: { upstreamId: { in: ['l1', 'l2'] } } })).toBe(0);
  });

  it('country scope is a fact of a primary official record only; filters apply after revision selection', async () => {
    const pl = (await repository.current({ countryIso3: 'POL' })).map(o => o.identity.upstreamId);
    expect(pl).toEqual(expect.arrayContaining(['a1', 's1']));
    expect(pl).not.toContain('r1');
    expect(await repository.current({ countryIso3: 'KEN' })).toEqual([]);
    expect(await repository.current({ since: new Date('2027-01-01T00:00:00Z') })).toEqual([]);
    expect(await repository.current({ countryIso3: 'pol' })).toEqual([]);
  });
});
