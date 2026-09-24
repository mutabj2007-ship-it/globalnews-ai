import { createHash } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import {
  CONFLICT_ADMISSION_TRANSACTION_TIMEOUT_MS,
  ConflictObservationProducer,
} from './conflict-observation.producer';
import { ConflictObservationRepository } from './conflict-observation.repository';
import { ConflictObservationController } from './conflict-observation.controller';
import type { ReviewedUcdpCapture } from './ucdp-ged.normalizer';

const fixture = (over = {}) => ({
  id: 17,
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

function capture(rows: unknown = [fixture()], day = 20) {
  const bytes = Buffer.from(JSON.stringify(rows));
  const hash = createHash('sha256').update(bytes).digest('hex');
  return {
    retrievalId: `capture-${day}`,
    providerId: 'UCDP_GED',
    admissibility: 'ADMITTED',
    completeness: 'COMPLETE',
    refusalKey: null,
    httpStatus: 200,
    payloadRetentionPermitted: true,
    rightsGrade: 'E-5',
    rightsInstrumentRef: 'https://ucdp.uu.se/downloads/ — UCDP datasets licensed CC BY 4.0',
    parserId: 'ucdp-ged-json',
    parserVersion: '1',
    parsedAt: new Date(),
    retrievedAt: new Date(`2026-09-${day}T00:00:00Z`),
    mediaType: 'application/json',
    byteLength: bytes.length,
    contentAddress: hash,
    payload: {
      bytes,
      contentAddress: hash,
      byteLength: bytes.length,
      mediaType: 'application/json',
      storageState: 'RETAINED',
    },
  };
}

function harness(initial = capture()) {
  let current = initial;
  const profiles: ReviewedUcdpCapture[] = [];
  const rows: any[] = [];
  const pins: any[] = [];
  const tx = {
    snapshotPin: {
      updateMany: jest.fn(async ({ where, data }) => {
        let count = 0;
        for (const pin of pins) {
          if (
            pin.contentAddress === where.contentAddress &&
            where.citedBy.in.includes(pin.citedBy) &&
            pin.releasedAt !== null &&
            pin.releasedAt !== undefined
          ) {
            Object.assign(pin, data);
            count++;
          }
        }
        return { count };
      }),
      createMany: jest.fn(async ({ data, skipDuplicates }) => {
        let count = 0;
        for (const pin of data) {
          const exists = pins.some(
            (current) =>
              current.contentAddress === pin.contentAddress && current.citedBy === pin.citedBy,
          );
          if (exists) {
            if (skipDuplicates) continue;
            throw new Error('PIN_UNIQUE_COLLISION');
          }
          pins.push(pin);
          count++;
        }
        return { count };
      }),
    },
    snapshotRetrieval: { findUnique: jest.fn(async () => current) },
    conflictObservation: {
      findMany: jest.fn(async ({ where }) => {
        const keys: string[] = where.observationKey?.in ?? [where.observationKey];
        return rows
          .filter((row) => keys.includes(row.observationKey))
          .sort(
            (a, b) =>
              a.observationKey.localeCompare(b.observationKey) ||
              b.revisionOrdinal - a.revisionOrdinal,
          );
      }),
      createMany: jest.fn(async ({ data }) => {
        rows.push(...data);
        return { count: data.length };
      }),
    },
  };
  const db = {
    $transaction: jest.fn(async (fn) => {
      const beforeRows = rows.length;
      const beforePins = pins.length;
      try {
        return await fn(tx);
      } catch (error) {
        rows.splice(beforeRows);
        pins.splice(beforePins);
        throw error;
      }
    }),
  };
  const select = (next: ReturnType<typeof capture>, review = true) => {
    current = next;
    if (review)
      profiles.push({
        sha256: next.contentAddress,
        datasetVersion: `test-${next.retrievalId}`,
        envelope: 'array',
        schema: 'ucdp-ged-json-v1',
      });
  };
  select(initial);
  return {
    rows,
    pins,
    tx,
    db,
    profiles,
    select,
    producer: new ConflictObservationProducer(db as unknown as PrismaService, profiles),
  };
}

describe('bounded retained-only admission', () => {
  it('starts closed without a reviewed capture', async () => {
    const h = harness();
    h.profiles.length = 0;
    await expect(h.producer.admitRetained('capture-20', 'run')).rejects.toThrow(
      'SCHEMA_NOT_CONFIRMED',
    );
    expect(h.rows).toHaveLength(0);
  });
  it.each([
    { admissibility: 'REFUSED' },
    { providerId: 'OTHER' },
    { completeness: 'TRUNCATED' },
    { parserVersion: '99' },
    { payloadRetentionPermitted: false },
    { rightsGrade: 'E-4' },
    { rightsInstrumentRef: '' },
    { parserId: null },
    { refusalKey: 'HOST_MISMATCH' },
  ])('refuses ineligible retrieval %j', async (over) => {
    const h = harness({ ...capture(), ...over } as ReturnType<typeof capture>);
    await expect(h.producer.admitRetained('capture-20', 'run')).rejects.toThrow(
      'CAPTURE_NOT_ADMITTED',
    );
    expect(h.rows).toHaveLength(0);
  });
  it('refuses missing/tampered bytes and malformed/unsupported capture before writes', async () => {
    const h = harness();
    const bad = capture();
    bad.payload.bytes = Buffer.from('corrupt');
    h.select(bad);
    await expect(h.producer.admitRetained('capture-20', 'run')).rejects.toThrow('INTEGRITY');
    h.select(capture([fixture(), null]));
    await expect(h.producer.admitRetained('capture-20', 'run')).rejects.toThrow(
      'MALFORMED_CAPTURE',
    );
    h.select(capture({ unexpected: [] }));
    await expect(h.producer.admitRetained('capture-20', 'run')).rejects.toThrow(
      'UNSUPPORTED_SCHEMA',
    );
    expect(h.tx.conflictObservation.createMany).not.toHaveBeenCalled();
  });
  it('appends revisions, preserves history, deduplicates replays including older captures', async () => {
    const first = capture();
    const h = harness(first);
    await expect(h.producer.admitRetained(first.retrievalId, 'one')).resolves.toEqual({
      inserted: 1,
      duplicates: 0,
    });
    await expect(h.producer.admitRetained(first.retrievalId, 'two')).resolves.toEqual({
      inserted: 0,
      duplicates: 1,
    });
    const revised = capture([fixture({ latitude: 3 })], 21);
    h.select(revised);
    await h.producer.admitRetained(revised.retrievalId, 'three');
    expect(h.rows.map((r) => r.revisionOrdinal)).toEqual([0, 1]);
    expect(h.rows[0].geography.coordinates).toEqual({ type: 'Point', coordinates: [45, 2] });
    expect(h.rows[1].revision).toMatchObject({
      supersedesRevisionOrdinal: 0,
      revisionKind: 'SOURCE_REVISION',
    });
    h.select(first);
    await expect(h.producer.admitRetained(first.retrievalId, 'four')).resolves.toEqual({
      inserted: 0,
      duplicates: 1,
    });
    expect(h.rows).toHaveLength(2);
    expect(h.tx.snapshotPin.createMany).toHaveBeenCalledTimes(2);
    expect(h.tx.conflictObservation.createMany).toHaveBeenCalledTimes(2);
    expect(h.db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
      timeout: CONFLICT_ADMISSION_TRANSACTION_TIMEOUT_MS,
    });
  });
  it('uses a constant number of database round trips for a multi-observation batch', async () => {
    const h = harness(capture([fixture({ id: 17 }), fixture({ id: 18 }), fixture({ id: 19 })]));
    await expect(h.producer.admitRetained('capture-20', 'bulk')).resolves.toEqual({
      inserted: 3,
      duplicates: 0,
    });
    expect(h.rows).toHaveLength(3);
    expect(h.pins).toHaveLength(3);
    expect(h.tx.conflictObservation.findMany).toHaveBeenCalledTimes(1);
    expect(h.tx.snapshotPin.updateMany).toHaveBeenCalledTimes(1);
    expect(h.tx.snapshotPin.createMany).toHaveBeenCalledTimes(1);
    expect(h.tx.conflictObservation.createMany).toHaveBeenCalledTimes(1);
  });

  it('rejects out-of-order capture and rolls back the entire batch', async () => {
    const h = harness(capture([fixture()], 21));
    await h.producer.admitRetained('capture-21', 'one');
    h.select(capture([fixture({ id: 18 }), fixture({ latitude: 4 })], 20));
    await expect(h.producer.admitRetained('capture-20', 'two')).rejects.toThrow(
      'STALE_OR_UNORDERED',
    );
    expect(h.rows).toHaveLength(1);
  });
  it('does not infer retraction from absent records in a bounded capture', async () => {
    const h = harness();
    await h.producer.admitRetained('capture-20', 'one');
    h.select(capture([], 21));
    await h.producer.admitRetained('capture-21', 'two');
    expect(h.rows).toHaveLength(1);
  });
});

describe('retained read seam', () => {
  it('returns honest empty data and bounds invalid internal limits without invoking a producer', async () => {
    const db = { $queryRaw: jest.fn().mockResolvedValue([]) };
    const repository = new ConflictObservationRepository(db as unknown as PrismaService);
    const controller = new ConflictObservationController(repository);
    expect(await controller.observations({})).toEqual([]);
    await repository.latest(NaN);
    await repository.latest(900);
    await repository.latest(0);
    expect(db.$queryRaw.mock.calls.map((call) => call[1])).toEqual([250, 250, 500, 1]);
    expect(db.$queryRaw.mock.calls[0][0].join('?')).toMatch(/DISTINCT ON/);
  });
  it('returns canonical retained axes unchanged', async () => {
    const h = harness();
    await h.producer.admitRetained('capture-20', 'test');
    const repository = new ConflictObservationRepository({
      $queryRaw: jest.fn().mockResolvedValue(h.rows),
    } as unknown as PrismaService);
    const [o] = await repository.latest();
    expect(o.geography).toEqual(h.rows[0].geography);
    expect(o.acquisition.snapshotRetrievalId).toBe('capture-20');
    expect(o.revision.revisionOrdinal).toBe(0);
    expect(o).not.toHaveProperty('captureHash');
  });
});
