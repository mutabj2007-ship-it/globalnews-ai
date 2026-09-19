/**
 * OFFICIAL-DATA SNAPSHOT STORE — THE NARROW DELEGATE SURFACE THIS MODULE USES.
 *
 * WHY A HAND-DECLARED PORT RATHER THAN THE GENERATED TYPES. The same three
 * reasons the Situation store gives, and one more that is specific to this
 * capability:
 *
 *   1. `backend/src/generated/prisma` is a BUILD ARTEFACT, not source — it is
 *      gitignored and produced by `prisma generate`, so the delegates for the
 *      four new models exist in no checkout until that has run;
 *   2. the store's logic can be unit-tested against a fake without a database,
 *      which is what makes the dedupe, immutability and pin guarantees testable
 *      at all;
 *   3. a client without the new delegates FAILS LOUDLY at construction, naming
 *      what is missing, rather than throwing "cannot read property 'create' of
 *      undefined" at the first retrieval;
 *   4. AND — the one that matters here — declaring the surface is how the
 *      SUBSTRATE STAYS REPLACEABLE. `OfficialDataSnapshotStore` is the contract
 *      port; this is the Prisma-shaped adapter behind it. Everything Postgres
 *      about this capability is in this file and the store that consumes it.
 *      Eurostat does not know it is backed by Prisma, and swapping Postgres for
 *      an object store means writing a sibling of the store class, not touching
 *      observation lineage, a provider adapter or a publishability rule.
 *
 * THE MUTABLE SURFACE IS DELIBERATELY ALMOST EMPTY. There is no way to express
 * an update to a payload's bytes, address, length or media type through these
 * types; the only update that exists is the collection transition and the pin
 * release. The append-only guarantee is enforced by the SHAPE of the arguments
 * before the database triggers ever see it — and the triggers are still there,
 * because a type is a guarantee about this code and a trigger is a guarantee
 * about the database.
 */

/** A payload row as the database holds it. `bytes` is null once collected. */
export interface SnapshotPayloadRow {
  contentAddress: string;
  bytes: Uint8Array | null;
  byteLength: number;
  mediaType: string;
  storageState: string;
  firstRetainedAt: Date;
}

export interface SnapshotRetrievalRow {
  retrievalId: string;
  providerId: string;
  endpointId: string;
  requestPath: string;
  parameters: unknown;
  requestedAt: Date;
  retrievedAt: Date;
  httpStatus: number;
  mediaType: string;
  byteLength: number;
  contentAddress: string | null;
  completeness: string;
  contentEncoding: string;
  wireByteLength: number | null;
  admissibility: string;
  refusalKey: string | null;
  refusalClass: string | null;
  parserId: string | null;
  parserVersion: string | null;
  parsedAt: Date | null;
  rightsGrade: string;
  rightsInstrumentRef: string;
  payloadRetentionPermitted: boolean;
  editionAnnotations: unknown;
  publisherReleasedAt: Date | null;
  publisherChangedAt: Date | null;
}

export interface SnapshotPinRow {
  id: string;
  contentAddress: string;
  citedBy: string;
  pinnedAt: Date;
  releasedAt: Date | null;
}

export interface SnapshotTombstoneRow {
  contentAddress: string;
  byteLength: number;
  mediaType: string;
  collectedAt: Date;
  policyId: string;
}

export interface SnapshotPayloadDelegate {
  findUnique(args: { where: { contentAddress: string } }): Promise<SnapshotPayloadRow | null>;

  /**
   * THE DEDUPE PRIMITIVE, AND IT IS ONE STATEMENT ON PURPOSE.
   *
   * SR-4 says identical bytes are one payload. Expressed as
   * find-then-insert, two concurrent retrievals of the same unchanged dataset
   * race and one of them fails on the primary key. Expressed as an upsert with
   * an EMPTY update, the second one is a no-op at the database and the bytes are
   * written exactly once — which is also why `update` here takes no fields: there
   * is nothing about an existing payload that a second sighting may change.
   */
  upsert(args: {
    where: { contentAddress: string };
    create: {
      contentAddress: string;
      bytes: Uint8Array | null;
      byteLength: number;
      mediaType: string;
      storageState: string;
    };
    update: Record<string, never>;
  }): Promise<SnapshotPayloadRow>;

  /**
   * THE COLLECTION TRANSITION — the only payload update in the whole store.
   * `bytes` can only be set to null here; the type says so, and the trigger
   * `snapshot_payload_append_only` says so again against every other writer.
   */
  update(args: {
    where: { contentAddress: string };
    data: { bytes: null; storageState: 'COLLECTED' };
  }): Promise<SnapshotPayloadRow>;
}

export interface SnapshotRetrievalDelegate {
  create(args: {
    data: {
      retrievalId: string;
      providerId: string;
      endpointId: string;
      requestPath: string;
      parameters: unknown;
      requestedAt: Date;
      retrievedAt: Date;
      httpStatus: number;
      mediaType: string;
      byteLength: number;
      contentAddress: string | null;
      contentEncoding: string;
      wireByteLength: number;
      admissibility: string;
      refusalKey: string | null;
      refusalClass: string | null;
      parserId: string | null;
      parserVersion: string | null;
      parsedAt: Date | null;
      completeness: string;
      rightsGrade: string;
      rightsInstrumentRef: string;
      payloadRetentionPermitted: boolean;
      editionAnnotations: unknown;
      publisherReleasedAt: Date | null;
      publisherChangedAt: Date | null;
    };
  }): Promise<SnapshotRetrievalRow>;

  findMany(args: {
    where: { contentAddress: string };
    orderBy: Array<{ retrievedAt?: 'asc' | 'desc' }>;
  }): Promise<SnapshotRetrievalRow[]>;
}

export interface SnapshotPinDelegate {
  /**
   * Pinning is IDEMPOTENT BY CITATION. Re-citing the same figure must not
   * create a second pin that later has to be released twice, so the unique
   * index (contentAddress, citedBy) is the conflict target and re-pinning an
   * unreleased pin changes nothing.
   */
  upsert(args: {
    where: { contentAddress_citedBy: { contentAddress: string; citedBy: string } };
    create: { contentAddress: string; citedBy: string; pinnedAt: Date };
    update: { releasedAt: null };
  }): Promise<SnapshotPinRow>;

  findFirst(args: {
    where: { contentAddress: string; releasedAt: null };
  }): Promise<SnapshotPinRow | null>;

  findMany(args: { where: { contentAddress: string } }): Promise<SnapshotPinRow[]>;

  /** Release, never delete — the released timestamp is what the grace window is measured from. */
  update(args: {
    where: { contentAddress_citedBy: { contentAddress: string; citedBy: string } };
    data: { releasedAt: Date };
  }): Promise<SnapshotPinRow>;
}

export interface SnapshotTombstoneDelegate {
  create(args: {
    data: {
      contentAddress: string;
      byteLength: number;
      mediaType: string;
      collectedAt: Date;
      policyId: string;
    };
  }): Promise<SnapshotTombstoneRow>;

  findUnique(args: { where: { contentAddress: string } }): Promise<SnapshotTombstoneRow | null>;
}

/**
 * The transactional surface. A retention and its retrieval row go through ONE
 * of these, handed to the callback by `$transaction`.
 *
 * WHY THE TRANSACTION IS THE WHOLE ARGUMENT FOR THIS SUBSTRATE. Main's own note
 * on option 1: a payload written in the same transaction as its retrieval row
 * cannot be orphaned or half-written. A store whose entire purpose is to be
 * believed later can least afford exactly that failure, and it is the property
 * a filesystem or an object store would have had to reconstruct.
 */
export interface SnapshotTransactionClient {
  snapshotPayload: SnapshotPayloadDelegate;
  snapshotRetrieval: SnapshotRetrievalDelegate;
  snapshotPin: SnapshotPinDelegate;
  snapshotTombstone: SnapshotTombstoneDelegate;
}

export interface SnapshotPrismaPort extends SnapshotTransactionClient {
  $transaction<T>(fn: (tx: SnapshotTransactionClient) => Promise<T>): Promise<T>;
}

export class SnapshotClientShapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotClientShapeError';
  }
}

/**
 * The delegates and methods this module calls, as data, so the check below and
 * this file's documentation cannot drift apart.
 */
const REQUIRED_SURFACE: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['snapshotPayload', ['findUnique', 'upsert', 'update']],
  ['snapshotRetrieval', ['create', 'findMany']],
  ['snapshotPin', ['upsert', 'findFirst', 'findMany', 'update']],
  ['snapshotTombstone', ['create', 'findUnique']],
] as const;

/**
 * THE ONE DOOR from an untyped client into this module.
 *
 * A real check, not a cast dressed up as one: it walks the required surface and
 * names the first thing missing. A client generated before this migration fails
 * here, at construction, saying which model is absent and that `prisma generate`
 * needs to run — rather than at 3am inside a retention.
 */
export function asSnapshotPrismaPort(client: unknown): SnapshotPrismaPort {
  if (client === null || typeof client !== 'object') {
    throw new SnapshotClientShapeError(
      'A Prisma client is required for the official-data snapshot store; received ' +
        (client === null ? 'null' : typeof client) +
        '.',
    );
  }

  const candidate = client as Record<string, unknown>;

  if (typeof candidate.$transaction !== 'function') {
    throw new SnapshotClientShapeError(
      'The client has no $transaction. A retention writes the payload and its retrieval row ' +
        'together or not at all, and cannot be performed without one.',
    );
  }

  for (const [model, methods] of REQUIRED_SURFACE) {
    const delegate = candidate[model] as Record<string, unknown> | undefined;

    if (delegate === undefined || delegate === null || typeof delegate !== 'object') {
      throw new SnapshotClientShapeError(
        `The Prisma client has no "${model}" delegate. Run \`prisma generate\` against a ` +
          'schema that includes the official-data snapshot models (migration ' +
          '20260919030000_add_official_data_snapshot_store).',
      );
    }

    for (const method of methods) {
      if (typeof delegate[method] !== 'function') {
        throw new SnapshotClientShapeError(
          `The Prisma client's "${model}" delegate has no ${method}(). The generated client ` +
            'does not match the schema this code was written against.',
        );
      }
    }
  }

  return client as SnapshotPrismaPort;
}
