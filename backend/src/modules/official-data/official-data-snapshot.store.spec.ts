import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  assertCollectable,
  assertPayloadMatchesItsAddress,
  assertAdmissionRecordIsCoherent,
  assertRetrievalIsPublishable,
  refusalClassFor,
  refusalIsSecurityClass,
  sniffRefusal,
  refusalMayRetry,
  retrievalIsPublishable,
  parseRetained,
  retrievalIsReproducible,
  retrievalMaySupplyValues,
  snapshotContentAddress,
  SNAPSHOT_EXPOSURE,
  type OfficialDataRequestIdentity,
  type OfficialDataRetrieval,
  type RetainedPayload,
  type SnapshotAdmissionRecord,
  type SnapshotRefusalKey,
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
 * guarantee — the CHECK constraints, the triggers, the composite foreign key — is
 * proven in `official-data-snapshot.live-postgres.spec.ts`, which executes the real
 * migrations against a real PostgreSQL 17 in a disposable schema.
 *
 * R2 UPDATE, AND IT IS WORTH READING TWICE: that suite found a defect this one
 * could not. R1's `CHECK (contentAddress IS NOT NULL OR completeness = 'FAILED')`
 * makes R2's quarantine rule UNREPRESENTABLE — a secret-bearing capture is COMPLETE
 * and has no address. The contradiction is between two CHECK constraints, and
 * nothing but Postgres evaluates those. A fake would have accepted the migration.
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
  admission: {
    captureOutcome: 'COMPLETE' as const,
    admissibility: 'ADMITTED' as const,
    transport: { contentEncoding: 'identity' as const, wireByteLength: 3601 },
    parse: {
      parserId: 'eurostat-jsonstat',
      parserVersion: '1.0.0',
      parsedAt: '2026-09-19T02:51:53.000Z',
    },
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
  /*
    ── R2 · THESE SEVEN TESTS CHANGED SHAPE, AND THE REASON IS SNAP-R2-7 ──────

    Under R1 they called assertRetrievalIsPublishable(retrieval) and asserted four
    separate refusals: completeness, status, address, emptiness. R2 removes that
    predicate — not because those checks were wrong, but because the admission gate
    now performs all four AND SEVEN MORE, and keeping both would leave two
    publishability predicates that can disagree. The one in application code is the
    one that gets edited.

    So each check did not disappear; it MOVED. The gate refuses the capture at
    capture time with a named key, and the predicate became a statement about the
    verdict. The tests follow the checks to where they now live: what used to be
    completeness: 'TRUNCATED' reaching a publishability call is now a TRUNCATED
    capture that cannot be ADMITTED at all, refused by COH-4.
  */
  const admitted = (): SnapshotAdmissionRecord => ({
    captureOutcome: 'COMPLETE',
    admissibility: 'ADMITTED',
    transport: { contentEncoding: 'identity', wireByteLength: 3601 },
    parse: {
      parserId: 'eurostat-jsonstat',
      parserVersion: '1.0.0',
      parsedAt: '2026-09-19T02:51:53.000Z',
    },
  });

  it('an ADMITTED capture is publishable — the positive control', () => {
    expect(() => assertRetrievalIsPublishable(admitted())).not.toThrow();
    expect(retrievalIsPublishable(admitted())).toBe(true);
  });

  it('a REFUSED capture is not, and the message names the key', () => {
    const refused: SnapshotAdmissionRecord = {
      captureOutcome: 'COMPLETE',
      admissibility: 'REFUSED',
      refusalKey: 'PROVENANCE_HOST_MISMATCH',
      refusalClass: 'PERMANENT',
      transport: { contentEncoding: 'identity', wireByteLength: 3601 },
    };

    expect(() => assertRetrievalIsPublishable(refused)).toThrow(/SNAPSHOT_NOT_ADMITTED/);
    expect(() => assertRetrievalIsPublishable(refused)).toThrow(/PROVENANCE_HOST_MISMATCH/);
    expect(retrievalIsPublishable(refused)).toBe(false);
  });

  it('TRUNCATED cannot be ADMITTED — a capped stream is not a short dataset', () => {
    expect(() =>
      assertAdmissionRecordIsCoherent({ ...admitted(), captureOutcome: 'TRUNCATED' }),
    ).toThrow(/SNAP-R2-COH-4/);
  });

  it('FAILED cannot be ADMITTED either', () => {
    expect(() =>
      assertAdmissionRecordIsCoherent({ ...admitted(), captureOutcome: 'FAILED' }),
    ).toThrow(/SNAP-R2-COH-4/);
  });

  it('a refusal with no key cannot be classified, and is refused as incoherent', () => {
    expect(() =>
      assertAdmissionRecordIsCoherent({
        captureOutcome: 'COMPLETE',
        admissibility: 'REFUSED',
        transport: { contentEncoding: 'identity', wireByteLength: 10 },
      }),
    ).toThrow(/SNAP-R2-COH-1/);
  });

  it('an admitted capture carries no refusal key, and was parsed', () => {
    expect(() =>
      assertAdmissionRecordIsCoherent({
        ...admitted(),
        refusalKey: 'STATUS_NOT_OK',
        refusalClass: 'PERMANENT',
      }),
    ).toThrow(/SNAP-R2-COH-3/);

    const noParse = { ...admitted() } as Record<string, unknown>;
    delete noParse.parse;
    expect(() =>
      assertAdmissionRecordIsCoherent(noParse as unknown as SnapshotAdmissionRecord),
    ).toThrow(/SNAP-R2-COH-5/);
  });

  it('a refused capture was never parsed — P-1, parse once, after the gate', () => {
    expect(() =>
      assertAdmissionRecordIsCoherent({
        captureOutcome: 'COMPLETE',
        admissibility: 'REFUSED',
        refusalKey: 'PARSE_FAILED',
        refusalClass: 'PERMANENT',
        transport: { contentEncoding: 'identity', wireByteLength: 10 },
        parse: { parserId: 'x', parserVersion: '1', parsedAt: '2026-09-19T00:00:00.000Z' },
      }),
    ).toThrow(/SNAP-R2-COH-2/);
  });

  it('only TRANSIENT may retry, and a 404 is PERMANENT — the failure G measured', () => {
    expect(refusalMayRetry('STATUS_NOT_OK', 404)).toBe(false);
    expect(refusalMayRetry('STATUS_NOT_OK', 503)).toBe(true);
    expect(refusalMayRetry('STATUS_NOT_OK', 429)).toBe(true);
    expect(refusalMayRetry('PARSE_FAILED')).toBe(false);
    expect(refusalMayRetry('BODY_NOT_JSON_SHAPED')).toBe(true);
    expect(() => refusalClassFor('STATUS_NOT_OK')).toThrow(/SNAP-R2-CLASS-1/);
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
    /*
      `retrievalIsReproducible` IS UNCHANGED BY R2 and still takes a retrieval, not an
      admission record — the two answer different questions. Publishability asks "may
      this capture stand behind a figure"; reproducibility asks "can that figure be
      re-proved from bytes we hold", and a capture can be admitted and still
      irreproducible when the publisher's terms forbade retention.
    */
    const base: OfficialDataRetrieval = {
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
    };

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

/* ═══════════════════════════════════════════════════════════════════════════
 * E1 R2 SECURITY RE-REVIEW · ITEM C — THE SNIFF USES ONE OFFSET
 * ═══════════════════════════════════════════════════════════════════════════ */

describe('E1-C · leading whitespace does not change which refusal a body earns', () => {
  const ws = (prefix: string, body: number[]): Uint8Array =>
    new Uint8Array([...Buffer.from(prefix), ...body]);

  const GZIP = [0x1f, 0x8b, 0x08, 0x00];
  const ZIP = [0x50, 0x4b, 0x03, 0x04];
  const BOM = [0xef, 0xbb, 0xbf];
  const HTML = [...Buffer.from('<!DOCTYPE html><html>')];
  const JSON_OBJ = [...Buffer.from('{"value":{"0":3.1}}')];
  const JSON_ARR = [...Buffer.from('[1,2,3]')];

  it('the whitespace-prefixed HTML control is refused as not-JSON-shaped', () => {
    /*
      E1's required control. An HTML error page served as application/json with HTTP
      200 is the most common way official data silently becomes wrong, and a leading
      newline must not change the verdict.
    */
    for (const prefix of ['', ' ', '\n', '\r\n\t  ', '   \n\n   ']) {
      expect([prefix, sniffRefusal(ws(prefix, HTML))]).toEqual([prefix, 'BODY_NOT_JSON_SHAPED']);
    }
  });

  it('the whitespace-prefixed valid-JSON control is NOT refused', () => {
    // The other half of the pair: normalising the offset must not start refusing
    // bodies that are fine. A pipeline that refuses everything passes every negative
    // control ever written for it.
    for (const prefix of ['', ' ', '\n', '\r\n\t  ', '   \n\n   ']) {
      expect([prefix, sniffRefusal(ws(prefix, JSON_OBJ))]).toEqual([prefix, null]);
      expect([prefix, sniffRefusal(ws(prefix, JSON_ARR))]).toEqual([prefix, null]);
    }
  });

  it('THE DEFECT: whitespace-prefixed gzip is ENCODING_NOT_ALLOWED, not the retryable key', () => {
    /*
      THIS IS THE ONE THAT MATTERED. Before the fix the magic bytes were read at index
      0 while the JSON character was read at the first non-space byte. One space in
      front of a gzip body therefore skipped the gzip arm entirely and fell through to
      BODY_NOT_JSON_SHAPED — WHICH IS TRANSIENT. A body that must be refused
      permanently was instead refused retryably, so the fetch would repeat on a
      schedule.

      The misclassification mattered more than the miss: this function only refuses,
      so neither answer admits anything. What differed was the retry semantics, which
      is item B's territory reached through item C's bug.
    */
    for (const prefix of ['', ' ', '\n', '  \t']) {
      expect([prefix, sniffRefusal(ws(prefix, GZIP))]).toEqual([prefix, 'ENCODING_NOT_ALLOWED']);
    }

    // And the consequence, stated as the thing that actually protects the system.
    expect(refusalMayRetry('ENCODING_NOT_ALLOWED')).toBe(false);
    expect(refusalMayRetry('BODY_NOT_JSON_SHAPED')).toBe(true);
  });

  it('whitespace-prefixed ZIP is ARCHIVE_NOT_ALLOWED at every offset', () => {
    for (const prefix of ['', ' ', '\n\n', '\t']) {
      expect([prefix, sniffRefusal(ws(prefix, ZIP))]).toEqual([prefix, 'ARCHIVE_NOT_ALLOWED']);
    }
  });

  it('a BOM is REFUSED rather than skipped, wherever the whitespace ends', () => {
    // A BOM is content. Content that should not be there is a refusal, not something
    // to quietly step over — which is exactly why it is not in the whitespace set.
    for (const prefix of ['', ' ', '\n ']) {
      expect([prefix, sniffRefusal(ws(prefix, [...BOM, ...JSON_OBJ]))]).toEqual([
        prefix,
        'BODY_NOT_JSON_SHAPED',
      ]);
    }
  });

  it('an all-whitespace body is refused, not treated as an empty success', () => {
    expect(sniffRefusal(new Uint8Array(Buffer.from('   \n\t  ')))).toBe('BODY_NOT_JSON_SHAPED');
    expect(sniffRefusal(new Uint8Array(0))).toBe('BODY_NOT_JSON_SHAPED');
  });

  it('only the four JSON whitespace bytes are skipped — a NUL is not whitespace', () => {
    expect(sniffRefusal(new Uint8Array([0x00, ...JSON_OBJ]))).toBe('BODY_NOT_JSON_SHAPED');
    expect(sniffRefusal(new Uint8Array([0x0b, ...JSON_OBJ]))).toBe('BODY_NOT_JSON_SHAPED');
  });

  it('and the retained bytes are never rewritten — the sniff only reads', () => {
    const body = ws('  \n', JSON_OBJ);
    const before = Buffer.from(body).toString('hex');

    sniffRefusal(body);

    expect(Buffer.from(body).toString('hex')).toBe(before);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * E1 R2 SECURITY RE-REVIEW · ITEM B — THE DOMAIN HALF
 * ═══════════════════════════════════════════════════════════════════════════ */

describe('E1-B · a security refusal cannot be recorded retryable', () => {
  const securityRefusal = (
    key: SnapshotRefusalKey,
    refusalClass: 'PERMANENT' | 'TRANSIENT',
  ): SnapshotAdmissionRecord => ({
    captureOutcome: 'COMPLETE',
    admissibility: 'REFUSED',
    refusalKey: key,
    refusalClass,
    transport: { contentEncoding: 'identity', wireByteLength: 10 },
  });

  it.each([
    'SECRET_DETECTED',
    'PROVENANCE_HOST_MISMATCH',
    'DECOMPRESSION_BOUND_EXCEEDED',
    'ARCHIVE_NOT_ALLOWED',
    'ENCODING_NOT_ALLOWED',
  ] as const)('%s declared TRANSIENT is refused', (key) => {
    expect(refusalIsSecurityClass(key)).toBe(true);
    expect(() => assertAdmissionRecordIsCoherent(securityRefusal(key, 'TRANSIENT'))).toThrow(
      /SNAP-R2-SEC-B-1/,
    );
    expect(() => assertAdmissionRecordIsCoherent(securityRefusal(key, 'PERMANENT'))).not.toThrow();
  });

  it('THE EXACT STATE E1 PROVED POSSIBLE is now unrepresentable', () => {
    /*
      "E1 proved the current model can record SECRET_DETECTED while classifying the
      refusal as retryable/transient. That could resend a request known to have leaked
      a credential."
    */
    expect(() =>
      assertAdmissionRecordIsCoherent(securityRefusal('SECRET_DETECTED', 'TRANSIENT')),
    ).toThrow(/never retryable/);
    expect(refusalMayRetry('SECRET_DETECTED')).toBe(false);
  });

  it('and a class that merely disagrees with the table is refused too, security or not', () => {
    // PARSE_FAILED is PERMANENT and not a security key, so it exercises SEC-B-2 alone.
    expect(() =>
      assertAdmissionRecordIsCoherent({
        captureOutcome: 'COMPLETE',
        admissibility: 'REFUSED',
        refusalKey: 'PARSE_FAILED',
        refusalClass: 'TRANSIENT',
        transport: { contentEncoding: 'identity', wireByteLength: 10 },
      }),
    ).toThrow(/SNAP-R2-SEC-B-2/);
  });

  it('an operational refusal may still be TRANSIENT — the guard is targeted, not blanket', () => {
    expect(refusalIsSecurityClass('BODY_NOT_JSON_SHAPED')).toBe(false);
    expect(() =>
      assertAdmissionRecordIsCoherent({
        captureOutcome: 'COMPLETE',
        admissibility: 'REFUSED',
        refusalKey: 'BODY_NOT_JSON_SHAPED',
        refusalClass: 'TRANSIENT',
        transport: { contentEncoding: 'identity', wireByteLength: 10 },
      }),
    ).not.toThrow();
  });

  it('STATUS_NOT_OK is classified by the status, and 404 is PERMANENT', () => {
    const rec = (refusalClass: 'PERMANENT' | 'TRANSIENT'): SnapshotAdmissionRecord => ({
      captureOutcome: 'COMPLETE',
      admissibility: 'REFUSED',
      refusalKey: 'STATUS_NOT_OK',
      refusalClass,
      transport: { contentEncoding: 'identity', wireByteLength: 10 },
    });

    expect(() => assertAdmissionRecordIsCoherent(rec('TRANSIENT'), 404)).toThrow(/SNAP-R2-SEC-B-2/);
    expect(() => assertAdmissionRecordIsCoherent(rec('PERMANENT'), 404)).not.toThrow();
    expect(() => assertAdmissionRecordIsCoherent(rec('TRANSIENT'), 503)).not.toThrow();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * E1 R2 SECURITY RE-REVIEW · ITEM E — ONE SNAPSHOT PORT, AND MARKET USES IT
 * ═══════════════════════════════════════════════════════════════════════════ */

describe('E1-E · there is no Market-specific snapshot architecture', () => {
  const marketDir = join(__dirname, '..', 'market-ingest');

  const marketSources = (): Array<[string, string]> =>
    readdirSync(marketDir)
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'))
      .map(
        (f) =>
          [
            f,
            readFileSync(join(marketDir, f), 'utf8')
              .replace(/\/\*[\s\S]*?\*\//g, ' ')
              .replace(/(^|[^:])\/\/[^\n]*/g, '$1 '),
          ] as [string, string],
      );

  it('Market declares no snapshot store, payload table or content-address helper', () => {
    for (const [name, src] of marketSources().filter(([name]) => !name.endsWith('.spec.ts'))) {
      for (const forbidden of [
        'MarketSnapshot',
        'MarketPayload',
        'marketContentAddress',
        'computeSha256Hex',
        'SnapshotPayload',
      ]) {
        expect([name, forbidden, src.includes(forbidden)]).toEqual([name, forbidden, false]);
      }
    }
  });

  it('and it holds no bytes of its own — no Bytes column, no Buffer storage', () => {
    const schema = readFileSync(
      join(__dirname, '..', '..', '..', 'prisma', 'schema.prisma'),
      'utf8',
    );
    const marketModels = schema.match(/model Market\w* \{[\s\S]*?^\}/gm) ?? [];
    expect(marketModels.length).toBeGreaterThan(0);
    for (const model of marketModels) expect(model).not.toMatch(/\bBytes\b/);
    for (const [name, src] of marketSources()) {
      // Reading the canonical retained payload for digest validation is allowed.
      // A Market-owned payload writer or second byte store is not.
      expect([
        name,
        /snapshotPayload\.(?:create|upsert|update|delete)|Buffer\.from\(.*body|payloadBytes/i.test(
          src,
        ),
      ]).toEqual([name, false]);
    }
  });

  it('the Market observation cites a RETRIEVAL, not bytes alone — the R2 reconciliation', () => {
    const schema = readFileSync(
      join(__dirname, '..', '..', '..', 'prisma', 'schema.prisma'),
      'utf8',
    );
    const model = /model MarketObservation \{([\s\S]*?)^\}/m.exec(schema)?.[1] ?? '';

    // Both halves of the citation, and the composite relation that binds them.
    expect(model).toMatch(/snapshotRetrievalId\s+String\?/);
    expect(model).toMatch(/snapshotAdmissibility\s+String\?/);
    expect(model).toMatch(
      /@relation\(fields: \[snapshotRetrievalId, snapshotAdmissibility\], references: \[retrievalId, admissibility\]\)/,
    );
  });

  it('the store port remains the only seam a consumer needs', () => {
    /*
      G's Market R3 convergence consumes `Pick<OfficialDataSnapshotStore, 'retain'>`,
      which is exactly right: the narrowest possible view of the one port. This
      asserts the port still HAS that shape, so narrowing it stays possible.
    */
    const store = new PostgresOfficialDataSnapshotStore(
      {
        $transaction: () => undefined,
        snapshotPayload: { findUnique: () => {}, upsert: () => {}, update: () => {} },
        snapshotRetrieval: { create: () => {}, findMany: () => {} },
        snapshotPin: {
          upsert: () => {},
          findFirst: () => {},
          findMany: () => {},
          update: () => {},
        },
        snapshotTombstone: { create: () => {}, findUnique: () => {} },
      },
      ['eurostat'],
    );

    const narrowed: Pick<typeof store, 'retain'> = store;

    expect(typeof narrowed.retain).toBe('function');
  });
});
