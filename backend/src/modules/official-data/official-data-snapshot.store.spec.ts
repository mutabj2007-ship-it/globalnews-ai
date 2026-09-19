import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  assertCollectable,
  assertPayloadMatchesItsAddress,
  assertRetrievalIsPublishable,
  parseRetained,
  retrievalIsReproducible,
  retrievalMaySupplyValues,
  snapshotContentAddress,
  SNAPSHOT_EXPOSURE,
  type OfficialDataRequestIdentity,
  type OfficialDataRetrieval,
  type RetainedPayload,
  type SnapshotContentAddress,
} from '@globalnews-ai/shared';

import { SnapshotClientShapeError } from './official-data-snapshot.prisma-port';
import {
  computeSha256Hex,
  PostgresOfficialDataSnapshotStore,
  SnapshotStoreError,
} from './official-data-snapshot.store';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * OFFICIAL-DATA SNAPSHOT STORE — RUNTIME INTEGRITY A … G
 * ════════════════════════════════════════════════════════════════════════════
 *
 * THE FAKE IS A REAL LITTLE DATABASE, NOT A CALL RECORDER. The guarantees under
 * test — dedupe, immutability, transactional all-or-nothing, pin protection —
 * cannot be observed by asserting which methods were called. `$transaction`
 * works on a COPY and commits it only when the callback resolves, so a rollback
 * is a real rollback, and the primary-key collision that makes SR-4 work is a
 * real collision.
 *
 * What the fake does NOT do is re-implement Postgres. The SQL-level half of each
 * guarantee — the CHECK constraints, the five triggers, the foreign keys — is
 * stated in the migration and is proven against a real PostgreSQL 16 when one is
 * available. Docker was not running in this environment, and that limit is
 * recorded in the package rather than papered over: the TypeScript half is
 * proven here, the SQL half is proven by inspection of the migration and is
 * listed as an outstanding validation step.
 *
 * THE EUROSTAT BYTES ARE REAL. `fixtures/eurostat-une_rt_m-D2.body` is the exact
 * 3601-byte response captured under ECON-EUROSTAT-BYTE-CAPTURE-D2-R1, whose
 * SHA-256 was independently reproduced by two HTTP clients. No test here issues
 * a network request; byte-preserving transport is already proven and re-proving
 * it would just be noise against a public endpoint.
 */

const FIXTURES = join(__dirname, 'fixtures');

/** The D-2 capture: Eurostat une_rt_m, Poland, 3601 bytes. */
const EUROSTAT_BYTES = new Uint8Array(readFileSync(join(FIXTURES, 'eurostat-une_rt_m-D2.body')));
const EUROSTAT_SHA = 'c37c607cf568606316269f3afaadbc5596fa5c2c8a14a3ba789e4f47e1077bc9';

/** The D-2 negative control: a 404 body, 144 bytes. */
const EUROSTAT_404_BYTES = new Uint8Array(readFileSync(join(FIXTURES, 'eurostat-404-D2.body')));

const ALLOWLIST = ['eurostat'] as const;

/* ───────────────────────────────────────────────────────────────────────────
 * THE FAKE
 * ─────────────────────────────────────────────────────────────────────────── */

interface Tables {
  payloads: Array<{
    contentAddress: string;
    bytes: Uint8Array | null;
    byteLength: number;
    mediaType: string;
    storageState: string;
    firstRetainedAt: Date;
  }>;
  retrievals: Array<Record<string, unknown> & { retrievalId: string; retrievedAt: Date }>;
  pins: Array<{
    id: string;
    contentAddress: string;
    citedBy: string;
    pinnedAt: Date;
    releasedAt: Date | null;
  }>;
  tombstones: Array<{
    contentAddress: string;
    byteLength: number;
    mediaType: string;
    collectedAt: Date;
    policyId: string;
  }>;
}

const emptyTables = (): Tables => ({ payloads: [], retrievals: [], pins: [], tombstones: [] });

const clone = (t: Tables): Tables => ({
  payloads: t.payloads.map((r) => ({ ...r })),
  retrievals: t.retrievals.map((r) => ({ ...r })),
  pins: t.pins.map((r) => ({ ...r })),
  tombstones: t.tombstones.map((r) => ({ ...r })),
});

interface Fake {
  tables: Tables;
  writes: string[];
  client: unknown;
}

function buildFake(seed: Tables = emptyTables()): Fake {
  const state = { tables: seed };
  const writes: string[] = [];
  let n = 1;

  // The getter matters: `$transaction` REPLACES state.tables with the committed
  // clone, so delegates that closed over the array they were built with would
  // keep reading a stale one.
  const delegatesFor = (get: () => Tables): Record<string, unknown> => ({
    snapshotPayload: {
      findUnique: async (a: { where: { contentAddress: string } }) =>
        get().payloads.find((p) => p.contentAddress === a.where.contentAddress) ?? null,

      upsert: async (a: {
        where: { contentAddress: string };
        create: {
          contentAddress: string;
          bytes: Uint8Array | null;
          byteLength: number;
          mediaType: string;
          storageState: string;
        };
      }) => {
        const t = get();
        const existing = t.payloads.find((p) => p.contentAddress === a.where.contentAddress);

        if (existing !== undefined) {
          // The empty-update branch. SR-4: a second sighting writes nothing.
          writes.push(`payload.noop:${a.where.contentAddress.slice(0, 8)}`);
          return existing;
        }

        const row = { ...a.create, firstRetainedAt: new Date('2026-09-19T00:00:00.000Z') };
        t.payloads.push(row);
        writes.push(`payload.insert:${row.contentAddress.slice(0, 8)}`);
        return row;
      },

      update: async (a: {
        where: { contentAddress: string };
        data: { bytes: null; storageState: 'COLLECTED' };
      }) => {
        const t = get();
        const row = t.payloads.find((p) => p.contentAddress === a.where.contentAddress);
        if (row === undefined) throw new Error('no such payload');

        // The trigger's job, mirrored: only bytes -> null is permitted.
        row.bytes = null;
        row.storageState = a.data.storageState;
        writes.push(`payload.collect:${row.contentAddress.slice(0, 8)}`);
        return row;
      },
    },

    snapshotRetrieval: {
      create: async (a: { data: Record<string, unknown> & { retrievalId: string } }) => {
        const t = get();
        if (t.retrievals.some((r) => r.retrievalId === a.data.retrievalId)) {
          throw new Error('duplicate retrievalId (primary key)');
        }
        const row = { ...a.data } as Tables['retrievals'][number];
        t.retrievals.push(row);
        writes.push(`retrieval.insert:${a.data.retrievalId}`);
        return row;
      },
      findMany: async (a: { where: { contentAddress: string } }) =>
        get()
          .retrievals.filter((r) => r.contentAddress === a.where.contentAddress)
          .sort((x, y) => x.retrievedAt.getTime() - y.retrievedAt.getTime()),
    },

    snapshotPin: {
      upsert: async (a: {
        where: { contentAddress_citedBy: { contentAddress: string; citedBy: string } };
        create: { contentAddress: string; citedBy: string; pinnedAt: Date };
      }) => {
        const t = get();
        const key = a.where.contentAddress_citedBy;
        const existing = t.pins.find(
          (p) => p.contentAddress === key.contentAddress && p.citedBy === key.citedBy,
        );

        if (existing !== undefined) {
          existing.releasedAt = null; // re-arm, never a second pin
          writes.push(`pin.rearm:${existing.citedBy}`);
          return existing;
        }

        const row = { id: `pin-${n++}`, ...a.create, releasedAt: null };
        t.pins.push(row);
        writes.push(`pin.insert:${row.citedBy}`);
        return row;
      },
      findFirst: async (a: { where: { contentAddress: string; releasedAt: null } }) =>
        get().pins.find(
          (p) => p.contentAddress === a.where.contentAddress && p.releasedAt === null,
        ) ?? null,
      findMany: async (a: { where: { contentAddress: string } }) =>
        get().pins.filter((p) => p.contentAddress === a.where.contentAddress),
      update: async (a: {
        where: { contentAddress_citedBy: { contentAddress: string; citedBy: string } };
        data: { releasedAt: Date };
      }) => {
        const t = get();
        const key = a.where.contentAddress_citedBy;
        const row = t.pins.find(
          (p) => p.contentAddress === key.contentAddress && p.citedBy === key.citedBy,
        );
        if (row === undefined) throw new Error('no such pin');
        row.releasedAt = a.data.releasedAt;
        return row;
      },
    },

    snapshotTombstone: {
      create: async (a: { data: Tables['tombstones'][number] }) => {
        const t = get();
        if (t.tombstones.some((x) => x.contentAddress === a.data.contentAddress)) {
          throw new Error('duplicate tombstone (primary key)');
        }
        const row = { ...a.data };
        t.tombstones.push(row);
        writes.push(`tombstone.insert:${row.contentAddress.slice(0, 8)}`);
        return row;
      },
      findUnique: async (a: { where: { contentAddress: string } }) =>
        get().tombstones.find((x) => x.contentAddress === a.where.contentAddress) ?? null,
    },
  });

  const committed = delegatesFor(() => state.tables);

  const client = {
    ...committed,
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
      const working = clone(state.tables);
      const tx = delegatesFor(() => working);
      const result = await fn(tx); // throws => `working` is discarded
      state.tables = working;
      return result;
    },
  };

  return {
    get tables() {
      return state.tables;
    },
    writes,
    client,
  };
}

/* ───────────────────────────────────────────────────────────────────────────
 * SHARED INPUT BUILDERS
 * ─────────────────────────────────────────────────────────────────────────── */

const eurostatRequest = (over: Partial<OfficialDataRequestIdentity> = {}) =>
  ({
    providerId: 'eurostat',
    endpointId: 'une_rt_m',
    requestPath: 'statistics/1.0/data/une_rt_m',
    parameters: [
      { key: 'format', value: 'JSON' },
      { key: 'lang', value: 'EN' },
      { key: 'geo', value: 'PL' },
      { key: 's_adj', value: 'SA' },
      { key: 'age', value: 'TOTAL' },
      { key: 'sex', value: 'T' },
      { key: 'unit', value: 'PC_ACT' },
      { key: 'lastTimePeriod', value: '1' },
    ],
    requestedAt: '2026-09-19T02:51:50.000Z',
    ...over,
  }) satisfies OfficialDataRequestIdentity;

const retainInput = (over: Record<string, unknown> = {}) => ({
  retrievalId: 'r-1',
  request: eurostatRequest(),
  retrievedAt: '2026-09-19T02:51:52.000Z',
  httpStatus: 200,
  mediaType: 'application/json',
  bytes: EUROSTAT_BYTES,
  completeness: 'COMPLETE' as const,
  rights: {
    grade: 'E-5',
    instrumentRef: 'https://ec.europa.eu/eurostat/about-us/policies/copyright',
    payloadRetentionPermitted: true,
  },
  editionAnnotations: {
    UPDATE_DATA: '2026-09-17T23:00:00+0200',
    OBS_COUNT: '755932',
    OBS_PERIOD_OVERALL_LATEST: '2026-08',
  },
  ...over,
});

const storeOn = (fake: Fake) => new PostgresOfficialDataSnapshotStore(fake.client, [...ALLOWLIST]);

/* ═══════════════════════════════════════════════════════════════════════════
 * THE FIXTURE ITSELF
 * ═══════════════════════════════════════════════════════════════════════════ */

describe('the D-2 fixture is the bytes D-2 captured, unchanged', () => {
  it('hashes to the address two independent HTTP clients agreed on', () => {
    expect(computeSha256Hex(EUROSTAT_BYTES)).toBe(EUROSTAT_SHA);
    expect(EUROSTAT_BYTES.byteLength).toBe(3601);
  });

  it('and the store computes that same address from the bytes, not from this constant', async () => {
    const fake = buildFake();
    const retrieval = await storeOn(fake).retain(retainInput());

    expect(retrieval.contentAddress).toBe(EUROSTAT_SHA);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * A · IDENTICAL BYTES — ONE PAYLOAD, TWO RETRIEVALS
 * ═══════════════════════════════════════════════════════════════════════════ */

describe('A · capturing the same bytes twice dedupes safely', () => {
  it('produces ONE payload and TWO retrievals — SR-3, SR-4', async () => {
    const fake = buildFake();
    const store = storeOn(fake);

    const first = await store.retain(retainInput({ retrievalId: 'r-1' }));
    const second = await store.retain(
      retainInput({ retrievalId: 'r-2', retrievedAt: '2026-09-19T03:00:00.000Z' }),
    );

    expect(first.contentAddress).toBe(second.contentAddress);
    expect(fake.tables.payloads).toHaveLength(1);
    expect(fake.tables.retrievals).toHaveLength(2);
  });

  it('and the second capture writes NO BYTES — the whole point of content addressing', async () => {
    const fake = buildFake();
    const store = storeOn(fake);

    await store.retain(retainInput({ retrievalId: 'r-1' }));
    const writesAfterFirst = [...fake.writes];
    await store.retain(retainInput({ retrievalId: 'r-2' }));

    const newWrites = fake.writes.slice(writesAfterFirst.length);

    expect(newWrites.filter((w) => w.startsWith('payload.insert'))).toEqual([]);
    expect(newWrites.some((w) => w.startsWith('payload.noop'))).toBe(true);
    expect(newWrites.some((w) => w.startsWith('retrieval.insert'))).toBe(true);
  });

  it('both retrievals remain readable by address, oldest first — SR-6', async () => {
    const fake = buildFake();
    const store = storeOn(fake);

    await store.retain(
      retainInput({ retrievalId: 'r-2', retrievedAt: '2026-09-19T03:00:00.000Z' }),
    );
    await store.retain(
      retainInput({ retrievalId: 'r-1', retrievedAt: '2026-09-19T02:00:00.000Z' }),
    );

    const found = await store.retrievalsFor(snapshotContentAddress(EUROSTAT_SHA));

    expect(found.map((r) => r.retrievalId)).toEqual(['r-1', 'r-2']);
  });

  it('the retained bytes re-open byte-identical to what went in', async () => {
    const fake = buildFake();
    const store = storeOn(fake);
    await store.retain(retainInput());

    const opened = await store.open(snapshotContentAddress(EUROSTAT_SHA));

    expect(opened).not.toBeNull();
    expect(Buffer.from(opened!.bytes)).toEqual(Buffer.from(EUROSTAT_BYTES));
    expect(opened!.byteLength).toBe(3601);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * B · CHANGED BYTES — A SECOND PAYLOAD, NEVER AN OVERWRITE
 * ═══════════════════════════════════════════════════════════════════════════ */

describe('B · one byte of difference is a different payload', () => {
  /*
    The edition problem in miniature. G measured Eurostat serving three editions
    of one dataset in fifteen minutes, with the same periods carrying different
    values. "Latest response wins and deletes previous" is the shape this
    contract exists to refuse, so the test asserts the OLD payload survives —
    not merely that the new one appears.
  */
  const mutated = (): Uint8Array => {
    const copy = new Uint8Array(EUROSTAT_BYTES);
    copy[copy.length - 2] = copy[copy.length - 2]! ^ 0x01;
    return copy;
  };

  it('creates a SECOND payload and leaves the first standing — SR-5, SR-8', async () => {
    const fake = buildFake();
    const store = storeOn(fake);

    await store.retain(retainInput({ retrievalId: 'r-1' }));
    const edition2 = await store.retain(retainInput({ retrievalId: 'r-2', bytes: mutated() }));

    expect(edition2.contentAddress).not.toBe(EUROSTAT_SHA);
    expect(fake.tables.payloads).toHaveLength(2);

    // the original is still openable, which is what "a superseded edition is
    // evidence" actually means
    const original = await store.open(snapshotContentAddress(EUROSTAT_SHA));
    expect(original).not.toBeNull();
    expect(Buffer.from(original!.bytes)).toEqual(Buffer.from(EUROSTAT_BYTES));
  });

  it('one flipped bit changes the address — the difference is not size-based', async () => {
    const changed = mutated();

    expect(changed.byteLength).toBe(EUROSTAT_BYTES.byteLength);
    expect(computeSha256Hex(changed)).not.toBe(EUROSTAT_SHA);
  });

  it('there is no update path that could overwrite a payload', async () => {
    const fake = buildFake();
    await storeOn(fake).retain(retainInput());

    // The only payload write after creation is the collection transition, and
    // the port's type admits nothing else. This asserts the runtime shape too.
    const payload = fake.tables.payloads[0]!;
    expect(payload.storageState).toBe('RETAINED');
    expect(fake.writes.filter((w) => w.startsWith('payload.collect'))).toEqual([]);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * C · HASH VERIFICATION — A CALLER CANNOT CLAIM SHA X FOR BYTES Y
 * ═══════════════════════════════════════════════════════════════════════════ */

describe('C · the store computes the address; a caller cannot supply one', () => {
  it('`retain` takes bytes and has no address parameter at all — SR-2', async () => {
    const fake = buildFake();
    const store = storeOn(fake);

    // Passing an address is not expressible; passing one anyway is ignored,
    // and the stored address is the hash of the bytes.
    const retrieval = await store.retain(
      retainInput({ contentAddress: 'f'.repeat(64) } as Record<string, unknown>),
    );

    expect(retrieval.contentAddress).toBe(EUROSTAT_SHA);
    expect(fake.tables.payloads[0]!.contentAddress).toBe(EUROSTAT_SHA);
  });

  it('a forged address is rejected by the contract assertion — SR-12', () => {
    const forged = {
      contentAddress: 'a'.repeat(64) as SnapshotContentAddress,
      byteLength: EUROSTAT_BYTES.byteLength,
      mediaType: 'application/json',
      bytes: EUROSTAT_BYTES,
    } as unknown as RetainedPayload;

    expect(() => assertPayloadMatchesItsAddress(forged, computeSha256Hex)).toThrow(
      /SNAPSHOT_ADDRESS_MISMATCH/,
    );
  });

  it('a length that disagrees with the bytes is rejected too', () => {
    const wrongLength = {
      contentAddress: EUROSTAT_SHA as SnapshotContentAddress,
      byteLength: 1,
      mediaType: 'application/json',
      bytes: EUROSTAT_BYTES,
    } as unknown as RetainedPayload;

    expect(() => assertPayloadMatchesItsAddress(wrongLength, computeSha256Hex)).toThrow(
      /SNAPSHOT_LENGTH_MISMATCH/,
    );
  });

  it('an address that is not a SHA-256 is refused at the constructor — SR-1', () => {
    for (const bad of ['', 'abc', 'A'.repeat(64), 'g'.repeat(64), '0'.repeat(63)]) {
      expect(() => snapshotContentAddress(bad)).toThrow(/SNAPSHOT_ADDRESS_INVALID/);
    }
    expect(() => snapshotContentAddress(EUROSTAT_SHA)).not.toThrow();
  });

  it('and a real payload passes the same assertion — a positive control', async () => {
    const fake = buildFake();
    await storeOn(fake).retain(retainInput());
    const opened = await storeOn(fake).open(snapshotContentAddress(EUROSTAT_SHA));

    expect(() => assertPayloadMatchesItsAddress(opened!, computeSha256Hex)).not.toThrow();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * D · THE PARSER BOUNDARY
 * ═══════════════════════════════════════════════════════════════════════════ */

describe('D · a parser cannot mint a reference for bytes that never passed through the store', () => {
  /*
    THE STRUCTURAL HALF IS PROVEN BY THE COMPILER, NOT HERE. `RetainedPayload`
    carries a non-exported unique symbol, so an object literal cannot satisfy the
    type — Main's package carries the TS2741 negative control showing exactly
    that, and it is reproduced in this package's validation folder.

    What is provable at runtime is the second half: even holding a payload, a
    parser cannot attribute its output to a retrieval that did not produce it.
  */
  const retrievalFor = (
    address: string,
    mediaType = 'application/json',
  ): OfficialDataRetrieval => ({
    retrievalId: 'r-1',
    request: eurostatRequest(),
    retrievedAt: '2026-09-19T02:51:52.000Z',
    httpStatus: 200,
    mediaType,
    byteLength: EUROSTAT_BYTES.byteLength,
    contentAddress: snapshotContentAddress(address),
    completeness: 'COMPLETE',
    rights: {
      grade: 'E-5',
      instrumentRef: 'ref',
      payloadRetentionPermitted: true,
    },
    editionAnnotations: {},
  });

  it('parses when the payload IS the one this retrieval produced', async () => {
    const fake = buildFake();
    await storeOn(fake).retain(retainInput());
    const payload = (await storeOn(fake).open(snapshotContentAddress(EUROSTAT_SHA)))!;

    const parsed = parseRetained(payload, retrievalFor(EUROSTAT_SHA), (bytes, address) => ({
      length: bytes.byteLength,
      address,
    }));

    expect(parsed).toEqual({ length: 3601, address: EUROSTAT_SHA });
  });

  it('refuses a payload that is not the one this retrieval produced', async () => {
    const fake = buildFake();
    await storeOn(fake).retain(retainInput());
    const payload = (await storeOn(fake).open(snapshotContentAddress(EUROSTAT_SHA)))!;

    expect(() => parseRetained(payload, retrievalFor('b'.repeat(64)), () => 'parsed')).toThrow(
      /SNAPSHOT_PARSE_MISMATCH/,
    );
  });

  it('refuses when the media types disagree', async () => {
    const fake = buildFake();
    await storeOn(fake).retain(retainInput());
    const payload = (await storeOn(fake).open(snapshotContentAddress(EUROSTAT_SHA)))!;

    expect(() =>
      parseRetained(payload, retrievalFor(EUROSTAT_SHA, 'text/csv'), () => 'parsed'),
    ).toThrow(/SNAPSHOT_MEDIA_TYPE_MISMATCH/);
  });

  it('refuses a retrieval that retained nothing', async () => {
    const fake = buildFake();
    await storeOn(fake).retain(retainInput());
    const payload = (await storeOn(fake).open(snapshotContentAddress(EUROSTAT_SHA)))!;

    const retainedNothing = { ...retrievalFor(EUROSTAT_SHA) } as Record<string, unknown>;
    delete retainedNothing.contentAddress;

    expect(() =>
      parseRetained(payload, retainedNothing as unknown as OfficialDataRetrieval, () => 'parsed'),
    ).toThrow(/SNAPSHOT_PARSE_WITHOUT_ADDRESS/);
  });

  it('the store is the only source of a payload — an unknown address opens to null', async () => {
    const fake = buildFake();
    const opened = await storeOn(fake).open(snapshotContentAddress('c'.repeat(64)));

    expect(opened).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * E · A FAILED OR PARTIAL RESPONSE CANNOT BACK A PUBLISHED FIGURE
 * ═══════════════════════════════════════════════════════════════════════════ */

describe('E · failed and partial responses are retained as evidence, never as figures', () => {
  const publishableBase = (): OfficialDataRetrieval => ({
    retrievalId: 'r-1',
    request: eurostatRequest(),
    retrievedAt: '2026-09-19T02:51:52.000Z',
    httpStatus: 200,
    mediaType: 'application/json',
    byteLength: 3601,
    contentAddress: snapshotContentAddress(EUROSTAT_SHA),
    completeness: 'COMPLETE',
    rights: { grade: 'E-5', instrumentRef: 'ref', payloadRetentionPermitted: true },
    editionAnnotations: {},
  });

  it('a COMPLETE 200 with bytes is publishable — the positive control', () => {
    expect(() => assertRetrievalIsPublishable(publishableBase())).not.toThrow();
  });

  it('TRUNCATED is refused — a capped stream is not a short dataset — SR-16', () => {
    expect(() =>
      assertRetrievalIsPublishable({ ...publishableBase(), completeness: 'TRUNCATED' }),
    ).toThrow(/SNAPSHOT_NOT_COMPLETE/);
  });

  it('FAILED is refused', () => {
    expect(() =>
      assertRetrievalIsPublishable({ ...publishableBase(), completeness: 'FAILED' }),
    ).toThrow(/SNAPSHOT_NOT_COMPLETE/);
  });

  it('a non-2xx status is refused even when bytes arrived', () => {
    // The D-2 404 is a real one: 144 bytes of Eurostat error JSON.
    expect(() =>
      assertRetrievalIsPublishable({
        ...publishableBase(),
        httpStatus: 404,
        byteLength: EUROSTAT_404_BYTES.byteLength,
      }),
    ).toThrow(/SNAPSHOT_NON_SUCCESS_STATUS/);
  });

  it('a retrieval with no content address is refused', () => {
    const noAddress = { ...publishableBase() } as Record<string, unknown>;
    delete noAddress.contentAddress;

    expect(() =>
      assertRetrievalIsPublishable(noAddress as unknown as OfficialDataRetrieval),
    ).toThrow(/SNAPSHOT_NO_CONTENT_ADDRESS/);
  });

  it('an empty body is refused', () => {
    expect(() => assertRetrievalIsPublishable({ ...publishableBase(), byteLength: 0 })).toThrow(
      /SNAPSHOT_EMPTY_BODY/,
    );
  });

  it('but the failed response is still RETAINED — the failure is evidence too', async () => {
    const fake = buildFake();
    const store = storeOn(fake);

    await store.retain(
      retainInput({
        retrievalId: 'r-404',
        bytes: EUROSTAT_404_BYTES,
        httpStatus: 404,
        completeness: 'FAILED',
      }),
    );

    expect(fake.tables.retrievals).toHaveLength(1);
    expect(fake.tables.retrievals[0]!.httpStatus).toBe(404);
    expect(fake.tables.payloads).toHaveLength(1);
  });

  it('reproducibility is reported, not assumed — SR-17', () => {
    const base = publishableBase();

    expect(retrievalIsReproducible(base)).toBe(true);
    expect(
      retrievalIsReproducible({
        ...base,
        rights: { ...base.rights, payloadRetentionPermitted: false },
      }),
    ).toBe(false);
    expect(retrievalIsReproducible({ ...base, completeness: 'TRUNCATED' })).toBe(false);
  });

  it('rights-forbidden retention stores the record and NOT the bytes — SR-18', async () => {
    const fake = buildFake();
    const store = storeOn(fake);

    await store.retain(
      retainInput({
        rights: {
          grade: 'E-2b',
          instrumentRef: 'all-rights-reserved',
          payloadRetentionPermitted: false,
        },
      }),
    );

    const payload = fake.tables.payloads[0]!;

    expect(payload.storageState).toBe('NOT_RETAINED_BY_RIGHTS');
    expect(payload.bytes).toBeNull();
    // the address and length survive: "we held bytes that hashed to X and did
    // not keep them" is a different fact from "we have no snapshot"
    expect(payload.contentAddress).toBe(EUROSTAT_SHA);
    expect(payload.byteLength).toBe(3601);
    expect(await store.open(snapshotContentAddress(EUROSTAT_SHA))).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * F · PINNED EVIDENCE SURVIVES COLLECTION
 * ═══════════════════════════════════════════════════════════════════════════ */

describe('F · a collection operation cannot remove published evidence', () => {
  const ADDRESS = snapshotContentAddress(EUROSTAT_SHA);

  const seeded = async () => {
    const fake = buildFake();
    const store = storeOn(fake);
    await store.retain(retainInput());
    return { fake, store };
  };

  it('an unpinned payload collects, and leaves a tombstone rather than a hole — SR-20', async () => {
    const { fake, store } = await seeded();

    const tombstone = await store.collect({
      address: ADDRESS,
      policyId: 'eurostat-unpinned-24m',
      collectedAt: '2026-10-01T00:00:00.000Z',
    });

    expect(tombstone.contentAddress).toBe(EUROSTAT_SHA);
    expect(tombstone.byteLength).toBe(3601);
    expect(tombstone.mediaType).toBe('application/json');
    expect(tombstone.policyId).toBe('eurostat-unpinned-24m');

    // the bytes are gone, the record is not
    expect(await store.open(ADDRESS)).toBeNull();
    expect(fake.tables.payloads).toHaveLength(1);
    expect(fake.tables.retrievals).toHaveLength(1);
    expect(await store.retentionClassOf(ADDRESS)).toBe('COLLECTED');
  });

  it('a PINNED payload REFUSES collection, on any policy, at any age — SR-19', async () => {
    const { store } = await seeded();

    await store.pin(ADDRESS, {
      citedBy: 'eco:1:7:s-unemp8:2026-08',
      pinnedAt: '2026-09-19T03:00:00.000Z',
    });

    await expect(
      store.collect({
        address: ADDRESS,
        policyId: 'eurostat-unpinned-24m',
        collectedAt: '2030-01-01T00:00:00.000Z',
      }),
    ).rejects.toThrow(SnapshotStoreError);

    await expect(
      store.collect({
        address: ADDRESS,
        policyId: 'eurostat-unpinned-24m',
        collectedAt: '2030-01-01T00:00:00.000Z',
      }),
    ).rejects.toThrow(/SNAPSHOT_PINNED_NOT_COLLECTABLE/);

    // and the bytes really are still there
    const opened = await store.open(ADDRESS);
    expect(opened).not.toBeNull();
    expect(Buffer.from(opened!.bytes)).toEqual(Buffer.from(EUROSTAT_BYTES));
  });

  it('the contract assertion refuses it independently of the store', () => {
    expect(() => assertCollectable('PINNED', ADDRESS)).toThrow(/SNAPSHOT_PINNED_NOT_COLLECTABLE/);
    expect(() => assertCollectable('RETAINED', ADDRESS)).not.toThrow();
  });

  it('there is no policy id that overrides a pin — no `force` exists', async () => {
    const { store } = await seeded();
    await store.pin(ADDRESS, { citedBy: 'eco:1:x', pinnedAt: '2026-09-19T03:00:00.000Z' });

    for (const policyId of ['force', 'emergency-storage-pressure', 'admin-override']) {
      await expect(
        store.collect({ address: ADDRESS, policyId, collectedAt: '2030-01-01T00:00:00.000Z' }),
      ).rejects.toThrow(/SNAPSHOT_PINNED_NOT_COLLECTABLE/);
    }
  });

  it('collection without a named policy is refused', async () => {
    const { store } = await seeded();

    await expect(
      store.collect({ address: ADDRESS, policyId: '   ', collectedAt: '2026-10-01T00:00:00.000Z' }),
    ).rejects.toThrow(/SNAPSHOT_COLLECT_WITHOUT_POLICY/);
  });

  it('pinning is idempotent by citation — re-citing does not create a second pin', async () => {
    const { fake, store } = await seeded();
    const reason = { citedBy: 'eco:1:same', pinnedAt: '2026-09-19T03:00:00.000Z' };

    await store.pin(ADDRESS, reason);
    await store.pin(ADDRESS, reason);
    await store.pin(ADDRESS, { ...reason, pinnedAt: '2026-09-20T03:00:00.000Z' });

    expect(fake.tables.pins).toHaveLength(1);
    expect(await store.isPinned(ADDRESS)).toBe(true);
  });

  it('releasing a pin does not collect on the spot — it makes the payload ELIGIBLE', async () => {
    const { fake, store } = await seeded();
    await store.pin(ADDRESS, { citedBy: 'eco:1:x', pinnedAt: '2026-09-19T03:00:00.000Z' });

    await store.releasePin(ADDRESS, 'eco:1:x', '2026-09-25T00:00:00.000Z');

    expect(await store.isPinned(ADDRESS)).toBe(false);
    expect(await store.retentionClassOf(ADDRESS)).toBe('RETAINED');
    // the bytes are untouched by the release itself
    expect(await store.open(ADDRESS)).not.toBeNull();
    // and the pin ROW survives, because the grace window is measured from it
    expect(fake.tables.pins).toHaveLength(1);
    expect(fake.tables.pins[0]!.releasedAt).not.toBeNull();
  });

  it('a pin with no citation is refused — a pin that cannot be re-derived cannot be released', async () => {
    const { store } = await seeded();

    await expect(
      store.pin(ADDRESS, { citedBy: '  ', pinnedAt: '2026-09-19T03:00:00.000Z' }),
    ).rejects.toThrow(/SNAPSHOT_PIN_WITHOUT_CITATION/);
  });

  it('pinning bytes that were collected is refused — that would assert absent evidence', async () => {
    const { store } = await seeded();
    await store.collect({
      address: ADDRESS,
      policyId: 'p-1',
      collectedAt: '2026-10-01T00:00:00.000Z',
    });

    await expect(
      store.pin(ADDRESS, { citedBy: 'eco:1:x', pinnedAt: '2026-10-02T00:00:00.000Z' }),
    ).rejects.toThrow(/SNAPSHOT_PIN_AFTER_COLLECTION/);
  });

  it('the retention class is DERIVED — a pin makes it PINNED without a stored flag', async () => {
    const { fake, store } = await seeded();

    expect(await store.retentionClassOf(ADDRESS)).toBe('RETAINED');
    await store.pin(ADDRESS, { citedBy: 'eco:1:x', pinnedAt: '2026-09-19T03:00:00.000Z' });
    expect(await store.retentionClassOf(ADDRESS)).toBe('PINNED');

    // and the payload row never stored 'PINNED' — that is the drift this avoids
    expect(fake.tables.payloads[0]!.storageState).toBe('RETAINED');
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * G · CREDENTIALS NEVER REACH EVIDENCE STORAGE
 * ═══════════════════════════════════════════════════════════════════════════ */

describe('G · a credential-bearing request is refused before anything is written', () => {
  const CREDENTIAL_KEYS = [
    'apikey',
    'api_key',
    'key',
    'token',
    'access_token',
    'auth',
    'authorization',
    'password',
    'secret',
    'signature',
    'sig',
    'sessionid',
    'session_id',
  ];

  it.each(CREDENTIAL_KEYS)('refuses parameter "%s" — SR-22', async (key) => {
    const fake = buildFake();
    const store = storeOn(fake);

    await expect(
      store.retain(
        retainInput({
          request: eurostatRequest({
            parameters: [
              { key: 'geo', value: 'PL' },
              { key, value: 'super-secret-value' },
            ],
          }),
        }),
      ),
    ).rejects.toThrow(/SNAPSHOT_REQUEST_CARRIES_CREDENTIAL/);

    // NOTHING WAS WRITTEN. The refusal is before the transaction, not a
    // cleanup after it — a credential in an immutable record outlives every
    // rotation, so there must be no window in which it was stored.
    expect(fake.tables.payloads).toEqual([]);
    expect(fake.tables.retrievals).toEqual([]);
    expect(fake.writes).toEqual([]);
  });

  it('matches case-insensitively, so ApiKey and TOKEN are caught too', () => {
    for (const key of ['ApiKey', 'TOKEN', 'Authorization', 'Secret']) {
      expect(() =>
        assertRequestCarriesNoCredentialLocal(
          eurostatRequest({ parameters: [{ key, value: 'v' }] }),
        ),
      ).toThrow(/SNAPSHOT_REQUEST_CARRIES_CREDENTIAL/);
    }
  });

  it('refuses a requestPath that is a URL — parameters cannot be smuggled past the check', async () => {
    const fake = buildFake();
    const store = storeOn(fake);

    for (const requestPath of [
      'https://ec.europa.eu/eurostat/api/data/une_rt_m',
      'statistics/1.0/data/une_rt_m?apikey=leak',
    ]) {
      await expect(
        store.retain(retainInput({ request: eurostatRequest({ requestPath }) })),
      ).rejects.toThrow(/SNAPSHOT_REQUEST_PATH_IS_A_URL/);
    }

    expect(fake.tables.retrievals).toEqual([]);
  });

  it('a clean request is accepted — the positive control', async () => {
    const fake = buildFake();
    await expect(storeOn(fake).retain(retainInput())).resolves.toBeDefined();
    expect(fake.tables.retrievals).toHaveLength(1);
  });

  it('the stored parameters are exactly what was sent, in order', async () => {
    const fake = buildFake();
    await storeOn(fake).retain(retainInput());

    expect(fake.tables.retrievals[0]!.parameters).toEqual([
      { key: 'format', value: 'JSON' },
      { key: 'lang', value: 'EN' },
      { key: 'geo', value: 'PL' },
      { key: 's_adj', value: 'SA' },
      { key: 'age', value: 'TOTAL' },
      { key: 'sex', value: 'T' },
      { key: 'unit', value: 'PC_ACT' },
      { key: 'lastTimePeriod', value: '1' },
    ]);
  });
});

/** Local re-export so the case-insensitivity test reads against the contract itself. */
function assertRequestCarriesNoCredentialLocal(request: OfficialDataRequestIdentity): void {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const shared = require('@globalnews-ai/shared') as {
    assertRequestCarriesNoCredential: (r: OfficialDataRequestIdentity) => void;
  };
  shared.assertRequestCarriesNoCredential(request);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * THE BOUNDARY PROPERTIES
 * ═══════════════════════════════════════════════════════════════════════════ */

describe('the store is provider-scoped and cannot be pointed at the open web', () => {
  it('refuses a provider that is not allowlisted', async () => {
    const fake = buildFake();
    const store = storeOn(fake);

    await expect(
      store.retain(retainInput({ request: eurostatRequest({ providerId: 'example.com' }) })),
    ).rejects.toThrow(/SNAPSHOT_PROVIDER_NOT_ALLOWLISTED/);

    expect(fake.tables.retrievals).toEqual([]);
  });

  it('DEFAULTS TO EMPTY — a store built without an allowlist refuses everything', async () => {
    const fake = buildFake();
    const store = new PostgresOfficialDataSnapshotStore(fake.client); // no allowlist

    await expect(store.retain(retainInput())).rejects.toThrow(/SNAPSHOT_PROVIDER_NOT_ALLOWLISTED/);
  });

  it('nothing here is served — the exposure is a constant, not configuration', () => {
    expect(SNAPSHOT_EXPOSURE).toBe('INTERNAL_ONLY');
  });

  it('the platform supplies no edition comparator and never orders editions — SR-13', () => {
    // First-seen-wins on ORDERING: only a provider's own comparator can say
    // which of two annotation sets is newer, and AMBIGUOUS is a real answer.
    expect(retrievalMaySupplyValues('ADVANCED')).toBe(true);
    expect(retrievalMaySupplyValues('SAME')).toBe(true);
    expect(retrievalMaySupplyValues('BEHIND')).toBe(false);
    expect(retrievalMaySupplyValues('AMBIGUOUS')).toBe(false);
  });

  it('edition annotations are stored verbatim and never interpreted — SR-9', async () => {
    const fake = buildFake();
    await storeOn(fake).retain(retainInput());

    expect(fake.tables.retrievals[0]!.editionAnnotations).toEqual({
      UPDATE_DATA: '2026-09-17T23:00:00+0200',
      OBS_COUNT: '755932',
      OBS_PERIOD_OVERALL_LATEST: '2026-08',
    });
  });
});

describe('a client without the snapshot delegates fails loudly at construction', () => {
  it('names the missing model rather than throwing inside a write', () => {
    expect(() => new PostgresOfficialDataSnapshotStore({ $transaction: () => undefined })).toThrow(
      SnapshotClientShapeError,
    );
    expect(() => new PostgresOfficialDataSnapshotStore({ $transaction: () => undefined })).toThrow(
      /snapshotPayload/,
    );
  });

  it('requires a transaction — a retention is all-or-nothing', () => {
    expect(() => new PostgresOfficialDataSnapshotStore({ snapshotPayload: {} })).toThrow(
      /\$transaction/,
    );
  });

  it('refuses a non-client outright', () => {
    expect(() => new PostgresOfficialDataSnapshotStore(null)).toThrow(SnapshotClientShapeError);
    expect(() => new PostgresOfficialDataSnapshotStore('a client, honest')).toThrow(
      SnapshotClientShapeError,
    );
  });
});

describe('a retention is atomic', () => {
  it('a failure inside the transaction leaves NOTHING behind', async () => {
    const fake = buildFake();
    const store = storeOn(fake);

    await store.retain(retainInput({ retrievalId: 'r-1' }));

    // Same retrievalId — the primary key rejects it inside the transaction.
    await expect(
      store.retain(retainInput({ retrievalId: 'r-1', bytes: EUROSTAT_404_BYTES })),
    ).rejects.toThrow(/duplicate retrievalId/);

    // The second payload must NOT have been committed by the half that succeeded.
    expect(fake.tables.payloads).toHaveLength(1);
    expect(fake.tables.payloads[0]!.contentAddress).toBe(EUROSTAT_SHA);
    expect(fake.tables.retrievals).toHaveLength(1);
  });
});
