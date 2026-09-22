import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ConflictObservationProducer } from './conflict-observation.producer';
import { ConflictObservationRepository } from './conflict-observation.repository';
import type { ReviewedUcdpCapture } from './ucdp-ged.normalizer';

const url = process.env.CONFLICT_TEST_DATABASE_URL;
const schema = `conflict_test_${randomUUID().replace(/-/g, '')}`;
const migrations = join(__dirname, '../../../prisma/migrations');
const live = url ? describe : describe.skip;

live('Conflict recovery on disposable PostgreSQL (no providers)', () => {
  let db: Client;
  let prisma: PrismaClient;
  let producer: ConflictObservationProducer;
  let repository: ConflictObservationRepository;
  const profiles: ReviewedUcdpCapture[] = [];
  let captureNumber = 0;
  const fixture = (id: number, over = {}) => ({
    id,
    type_of_violence: 1,
    side_a: 'Synthetic group',
    latitude: 2,
    longitude: 45,
    where_prec: 5,
    date_prec: 1,
    date_start: '2026-03-14',
    date_end: '2026-03-14',
    ...over,
  });

  async function retain(records: unknown[]) {
    const bytes = Buffer.from(JSON.stringify(records));
    const hash = createHash('sha256').update(bytes).digest('hex');
    const retrievalId = `test-${++captureNumber}`;
    const retrievedAt = new Date(Date.UTC(2026, 8, 22, 0, captureNumber));
    await prisma.snapshotPayload.upsert({
      where: { contentAddress: hash },
      update: {},
      create: {
        contentAddress: hash,
        bytes,
        byteLength: bytes.length,
        mediaType: 'application/json',
      },
    });
    await prisma.snapshotRetrieval.create({
      data: {
        retrievalId,
        providerId: 'UCDP_GED',
        endpointId: 'synthetic-test',
        requestPath: 'test',
        parameters: [],
        requestedAt: retrievedAt,
        retrievedAt,
        httpStatus: 200,
        mediaType: 'application/json',
        byteLength: bytes.length,
        contentAddress: hash,
        completeness: 'COMPLETE',
        contentEncoding: 'identity',
        wireByteLength: bytes.length,
        admissibility: 'ADMITTED',
        parserId: 'ucdp-ged-json',
        parserVersion: '1',
        parsedAt: retrievedAt,
        rightsGrade: 'E-5',
        rightsInstrumentRef: 'synthetic-test-only',
        payloadRetentionPermitted: true,
        editionAnnotations: {},
      },
    });
    profiles.push({
      sha256: hash,
      datasetVersion: 'synthetic-test',
      envelope: 'array',
      schema: 'ucdp-ged-json-v1',
    });
    return retrievalId;
  }

  beforeAll(async () => {
    // Explicit opt-in and loopback only. Never use the application's DATABASE_URL.
    const parsed = new URL(url!);
    if (!['localhost', '127.0.0.1'].includes(parsed.hostname))
      throw new Error('TEST_DATABASE_MUST_BE_LOCAL');
    db = new Client({ connectionString: url });
    await db.connect();
    await db.query(`CREATE SCHEMA "${schema}"`);
    await db.query(`SET search_path TO "${schema}"`);
    for (const migration of [
      '20260919030000_add_official_data_snapshot_store',
      '20260919040000_add_market_scheduled_ingest',
      '20260919050000_snapshot_admission_r2',
      '20260920140000_snapshot_retrieval_lineage_fields',
      '20260921030000_add_conflict_observation',
    ])
      await db.query(readFileSync(join(migrations, migration, 'migration.sql'), 'utf8'));
    await db.query(`INSERT INTO "ConflictObservation"
      ("id","observationKey","authority","upstreamEventId","eventType","owner","actors","geography",
       "temporal","severity","sourceReference","acquisition","revision","occurredOn")
      VALUES ('legacy','legacy','UCDP_GED','legacy','EVENT_TYPE_NOT_CLASSIFIED','CONFLICT','[]','{}',
        '{}','{}','{}','{}','{"revisionOrdinal":0,"supersedesRevisionOrdinal":null}', '2000-01-01')`);
    await db.query(
      readFileSync(
        join(migrations, '20260922120000_conflict_append_only_revisions/migration.sql'),
        'utf8',
      ),
    );
    await db.query(
      readFileSync(
        join(migrations, '20260922130000_conflict_revision_hardening/migration.sql'),
        'utf8',
      ),
    );
    prisma = new PrismaClient({
      adapter: new PrismaPg(
        { connectionString: url, options: `-c search_path=${schema}` },
        { schema },
      ),
    });
    producer = new ConflictObservationProducer(prisma as PrismaService, profiles);
    repository = new ConflictObservationRepository(prisma as PrismaService);
  }, 60_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    if (db) {
      // Only the random schema created by this test is removed.
      await db.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await db.end();
    }
  });

  it('migrates populated baseline without losing the existing row', async () => {
    expect(
      await prisma.conflictObservation.count({ where: { id: 'legacy', revisionOrdinal: 0 } }),
    ).toBe(1);
  });
  it('writes, pins, deduplicates and reads the latest revision after an event date correction', async () => {
    const first = await retain([fixture(17)]);
    expect(await producer.admitRetained(first, 'first')).toEqual({ inserted: 1, duplicates: 0 });
    const next = await retain([fixture(17, { date_start: '2025-01-01', date_end: '2025-01-01' })]);
    await producer.admitRetained(next, 'second');
    expect(await producer.admitRetained(first, 'replay')).toEqual({ inserted: 0, duplicates: 1 });
    const retained = await repository.latest(1);
    expect(retained).toHaveLength(1);
    expect(retained[0].revision.revisionOrdinal).toBe(1);
    expect(retained[0].temporal.eventStartedAt).toBe('2025-01-01');
    expect(await prisma.conflictObservation.count({ where: { upstreamEventId: '17' } })).toBe(2);
    expect(await prisma.snapshotPin.count()).toBe(2);
  });
  it('refuses malformed batch with no partial writes or pins', async () => {
    const before = await prisma.snapshotPin.count();
    const bad = await retain([fixture(18), null]);
    await expect(producer.admitRetained(bad, 'invalid')).rejects.toThrow('MALFORMED_CAPTURE');
    expect(await prisma.conflictObservation.count({ where: { upstreamEventId: '18' } })).toBe(0);
    expect(await prisma.snapshotPin.count()).toBe(before);
  });
  it('database rejects overwrites, deletes, duplicate revision and forged admitted retrieval', async () => {
    await expect(
      db.query(`UPDATE "ConflictObservation" SET "owner"='POLITICS' WHERE "id"='legacy'`),
    ).rejects.toMatchObject({ code: 'P0001' });
    await expect(
      db.query(`DELETE FROM "ConflictObservation" WHERE "id"='legacy'`),
    ).rejects.toMatchObject({ code: 'P0001' });
    const row = await prisma.conflictObservation.findFirstOrThrow({
      where: { upstreamEventId: '17' },
    });
    const { id: _id, ...data } = row;
    await expect(
      prisma.conflictObservation.create({ data: { ...data, id: randomUUID() } as never }),
    ).rejects.toMatchObject({ code: 'P2002' });
    await expect(
      prisma.conflictObservation.create({
        data: {
          ...data,
          id: randomUUID(),
          observationKey: 'forged',
          upstreamEventId: 'forged',
          snapshotRetrievalId: 'missing',
        } as never,
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });
  it('concurrent replay creates exactly one first revision and is safely retryable', async () => {
    const id = await retain([fixture(19)]);
    const results = await Promise.allSettled([
      producer.admitRetained(id, 'race-a'),
      producer.admitRetained(id, 'race-b'),
    ]);
    expect(results.some((r) => r.status === 'fulfilled')).toBe(true);
    expect(await producer.admitRetained(id, 'retry')).toEqual({ inserted: 0, duplicates: 1 });
    expect(await prisma.conflictObservation.count({ where: { upstreamEventId: '19' } })).toBe(1);
  });

  it('refuses malformed retained JSON at the real read boundary', async () => {
    // The legacy fixture deliberately has malformed JSON; it must poison no API response.
    await expect(repository.latest(500)).rejects.toThrow('INVALID_RETAINED_CONFLICT_OBSERVATION');
  });

  it('blocks TRUNCATE including CASCADE at the statement boundary', async () => {
    const before = await prisma.conflictObservation.count();
    await expect(db.query('TRUNCATE "ConflictObservation"')).rejects.toMatchObject({
      code: 'P0001',
    });
    await expect(db.query('TRUNCATE "ConflictObservation" CASCADE')).rejects.toMatchObject({
      code: 'P0001',
    });
    expect(await prisma.conflictObservation.count()).toBe(before);
  });

  it('enforces predecessor existence, identity, link and kind independently of the producer', async () => {
    const prior = await prisma.conflictObservation.findFirstOrThrow({
      where: { upstreamEventId: '17', revisionOrdinal: 1 },
    });
    for (const over of [
      {
        revisionOrdinal: 4,
        revision: {
          revisionOrdinal: 4,
          supersedesRevisionOrdinal: 3,
          revisionKind: 'SOURCE_REVISION',
        },
      },
      {
        revisionOrdinal: 2,
        upstreamEventId: 'different',
        revision: {
          revisionOrdinal: 2,
          supersedesRevisionOrdinal: 1,
          revisionKind: 'SOURCE_REVISION',
        },
      },
      {
        revisionOrdinal: 2,
        revision: {
          revisionOrdinal: 2,
          supersedesRevisionOrdinal: 0,
          revisionKind: 'SOURCE_REVISION',
        },
      },
      { revisionOrdinal: 2, revision: { revisionOrdinal: 2, supersedesRevisionOrdinal: 1 } },
      {
        revisionOrdinal: 2,
        revision: { revisionOrdinal: 2, supersedesRevisionOrdinal: 1, revisionKind: 'UNKNOWN' },
      },
    ]) {
      await expect(
        prisma.conflictObservation.create({
          data: {
            ...prior,
            ...over,
            id: randomUUID(),
            captureHash: null,
            captureRetrievedAt: null,
            snapshotRetrievalId: null,
            snapshotAdmissibility: null,
          } as never,
        }),
      ).rejects.toThrow();
    }
  });

  it('all guarded DOWN scripts refuse a populated table without removing protections', async () => {
    for (const migration of [
      '20260922130000_conflict_revision_hardening',
      '20260922120000_conflict_append_only_revisions',
      '20260921030000_add_conflict_observation',
    ]) {
      await expect(
        db.query(readFileSync(join(migrations, migration, 'DOWN.sql'), 'utf8')),
      ).rejects.toMatchObject({ code: '23514' });
      await db.query('ROLLBACK');
    }
    await expect(db.query('TRUNCATE "ConflictObservation"')).rejects.toMatchObject({
      code: 'P0001',
    });
  });

  it('guarded rollback succeeds on an empty isolated table in reverse migration order', async () => {
    const emptySchema = `${schema}_empty`;
    await db.query(`CREATE SCHEMA "${emptySchema}"`);
    try {
      await db.query(`SET search_path TO "${emptySchema}", "${schema}"`);
      for (const migration of [
        '20260921030000_add_conflict_observation',
        '20260922120000_conflict_append_only_revisions',
        '20260922130000_conflict_revision_hardening',
      ]) {
        await db.query(readFileSync(join(migrations, migration, 'migration.sql'), 'utf8'));
      }
      for (const migration of [
        '20260922130000_conflict_revision_hardening',
        '20260922120000_conflict_append_only_revisions',
        '20260921030000_add_conflict_observation',
      ]) {
        await db.query(readFileSync(join(migrations, migration, 'DOWN.sql'), 'utf8'));
      }
      const result = await db.query(
        'SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema=$1 AND table_name=$2',
        [emptySchema, 'ConflictObservation'],
      );
      expect(result.rows[0].n).toBe(0);
    } finally {
      await db.query('ROLLBACK');
      await db.query(`SET search_path TO "${schema}"`);
      await db.query(`DROP SCHEMA "${emptySchema}" CASCADE`);
    }
  });
});
