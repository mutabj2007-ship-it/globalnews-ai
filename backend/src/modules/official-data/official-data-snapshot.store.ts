import { createHash } from 'node:crypto';

import {
  assertAdmissionRecordIsCoherent,
  assertProviderScoped,
  assertRequestCarriesNoCredential,
  snapshotContentAddress,
  type OfficialDataRequestIdentity,
  type OfficialDataRetrieval,
  type OfficialDataSnapshotStore,
  type RetainedPayload,
  type SnapshotAdmissionRecord,
  type SnapshotCompleteness,
  type SnapshotContentAddress,
  type SnapshotPinReason,
  type SnapshotRetentionClass,
  type SnapshotRightsState,
  type SnapshotTombstone,
} from '@globalnews-ai/shared';

import {
  asSnapshotPrismaPort,
  type SnapshotPayloadRow,
  type SnapshotPrismaPort,
  type SnapshotRetrievalRow,
  type SnapshotTransactionClient,
} from './official-data-snapshot.prisma-port';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE POSTGRES-BACKED OFFICIAL-DATA SNAPSHOT STORE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The accepted `OfficialDataSnapshotStore` port (SR-1 … SR-22), implemented over
 * Postgres `Bytes` — Product Owner decision P-1.
 *
 * ── WHAT THIS CLASS IS RESPONSIBLE FOR, AND WHAT IT IS NOT ────────────────
 *
 * IT IS: hashing bytes, writing them once, recording each fetch, pinning by
 * citation, and refusing the operations the contract refuses.
 *
 * IT IS NOT: a parser, a fetcher, a scheduler, or provider semantics. It issues
 * no HTTP request — the caller hands it bytes that the accepted safe-fetch order
 * of operations already produced. It never orders editions, because SR-13 says
 * edition order is provider knowledge and the platform substitutes no default.
 *
 * ── THE NO-FORGE PROPERTY, BOTH HALVES ────────────────────────────────────
 *
 * §6 of the contract seals `RetainedPayload` with a non-exported unique symbol,
 * so nothing outside a store can construct one. This class is a store, and it
 * constructs one in exactly one place: `sealPayload()` below, from bytes it
 * holds, with an address it computed itself. `retain()` takes `bytes` and never
 * an address, which is the other half — a caller that could name its own address
 * could name one for bytes it invented.
 *
 * The single cast in this file is the one the seal requires and it is confined
 * to `sealPayload()`, where the address has just been computed from the bytes
 * being sealed. Every exit from this class re-verifies that with
 * `assertPayloadMatchesItsAddress()` at the boundary — the type stops the
 * accident, the assertion stops the shortcut.
 *
 * ── WHY THE SUBSTRATE IS INVISIBLE ABOVE THIS LINE ────────────────────────
 *
 * Everything Postgres about this capability is in this file and the port beside
 * it. Callers see the contract's port. Replacing Postgres with an object store
 * means writing a sibling class; it does not touch Economy observation lineage,
 * a provider adapter, or a publishability rule.
 */

/** Raised when the store is asked to do something the contract forbids. */
export class SnapshotStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotStoreError';
  }
}

/** The storage dispositions the payload table holds. PINNED is not one — it is derived. */
export type SnapshotStorageState =
  | 'RETAINED'
  | 'COLLECTED'
  | 'NOT_RETAINED_BY_RIGHTS'
  /** R2 · SNAP-R2-12 — a secret was found in the body, so no byte was committed. */
  | 'NOT_RETAINED_BY_QUARANTINE';

export interface RetainInput {
  readonly retrievalId: string;
  readonly request: OfficialDataRequestIdentity;
  readonly retrievedAt: string;
  readonly httpStatus: number;
  readonly mediaType: string;
  /**
   * R2 · SR-1 — THE DECODED BYTES. The caller supplies the body after transport
   * `Content-Encoding` removal and after nothing else, and the store hashes what it
   * is handed. The decode is the capture client's, because the store has no response
   * to decode; the store's job is to refuse an incoherent record, and it can do that
   * today.
   */
  readonly bytes: Uint8Array;
  readonly completeness: SnapshotCompleteness;
  readonly rights: SnapshotRightsState;
  readonly editionAnnotations: Readonly<Record<string, string>>;
  readonly publisherReleasedAt?: string;
  readonly publisherChangedAt?: string;

  /**
   * R2 · THE ADMISSION VERDICT. REQUIRED, NOT OPTIONAL, AND THAT IS S-1.
   *
   * An optional verdict defaults to ABSENT, and absent is not `REFUSED` — it is a
   * third state no constraint describes and every reader would have to guess about.
   * Required means a caller cannot retain a capture without having decided, which is
   * the default-deny property expressed in a type rather than in a default value.
   *
   * The transport evidence rides with it: `admission.transport` carries the
   * `contentEncoding` as received and the wire length. Neither is an identity.
   */
  readonly admission: SnapshotAdmissionRecord;
}

export interface CollectInput {
  readonly address: SnapshotContentAddress;
  readonly policyId: string;
  readonly collectedAt: string;
}

/** SHA-256 over the exact bytes, lowercase hex. No decode, no normalisation, no copy through a string. */
export function computeSha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export class PostgresOfficialDataSnapshotStore implements OfficialDataSnapshotStore {
  private readonly db: SnapshotPrismaPort;

  /**
   * @param client an untyped Prisma client — validated by `asSnapshotPrismaPort`
   * @param allowlistedProviderIds the official-source registry ids this store will accept.
   *   DEFAULT IS EMPTY, AND THAT IS THE CORRECT DEFAULT. A store constructed
   *   without an explicit allowlist refuses every retrieval, so forgetting to
   *   pass one fails closed rather than accepting the open web.
   */
  constructor(
    client: unknown,
    private readonly allowlistedProviderIds: readonly string[] = [],
  ) {
    this.db = asSnapshotPrismaPort(client);
  }

  /**
   * SR-1 · SR-2 · SR-4 · SR-5 — hash, write once, record the fetch.
   *
   * The whole method is one transaction. A payload that existed without its
   * retrieval row, or a retrieval row pointing at bytes that were never written,
   * are both states this store must never be found in, and a transaction is the
   * only thing that actually guarantees that.
   */
  async retain(input: RetainInput): Promise<OfficialDataRetrieval> {
    // SR-22 first: a credential must never reach storage, so it is refused
    // BEFORE anything is written, not cleaned up afterwards.
    assertRequestCarriesNoCredential(input.request);

    /*
      R2 · SNAP-R2-8, AT THE SAME POINT AND FOR THE SAME REASON.

      An incoherent verdict — a refusal with no key, an admission with a refusal key,
      an admission of a TRUNCATED capture, an admission with no parser — is refused
      BEFORE anything is written. The database CHECK enforces the same pairings and is
      the guarantee; this is the error message, and it names which clause failed
      instead of which constraint did.
    */
    assertAdmissionRecordIsCoherent(input.admission, input.httpStatus);

    const address = snapshotContentAddress(computeSha256Hex(input.bytes));
    const byteLength = input.bytes.byteLength;

    /*
      R2 · SNAP-R2-12 — QUARANTINE PRODUCES NO PAYLOAD AND NO ADDRESS.

      A capture refused for SECRET_DETECTED writes the metadata row and SKIPS THE
      PAYLOAD UPSERT ENTIRELY. The address computed above is deliberately discarded
      rather than recorded, and the reason is sharper than "we did not keep the bytes":
      the hash of a body KNOWN to contain a specific secret is itself a confirmation
      oracle. Anyone holding a candidate secret could construct the body, hash it, and
      read the answer out of our evidence table.

      Provider error bodies routinely echo the request — including our own key — so
      this is not a hypothetical: the very retention SR-8 permits for audit is exactly
      where a credential would come to rest.
    */
    const quarantined =
      input.admission.admissibility === 'REFUSED' &&
      input.admission.refusalKey === 'SECRET_DETECTED';

    const retrieval: OfficialDataRetrieval = {
      retrievalId: input.retrievalId,
      request: input.request,
      retrievedAt: input.retrievedAt,
      httpStatus: input.httpStatus,
      mediaType: input.mediaType,
      byteLength,
      ...(quarantined ? {} : { contentAddress: address }),
      completeness: input.completeness,
      rights: input.rights,
      editionAnnotations: input.editionAnnotations,
      ...(input.publisherReleasedAt === undefined
        ? {}
        : { publisherReleasedAt: input.publisherReleasedAt }),
      ...(input.publisherChangedAt === undefined
        ? {}
        : { publisherChangedAt: input.publisherChangedAt }),
    };

    // SR-13's sibling rule from the integration boundary: this store is for
    // allowlisted official-data providers, not arbitrary retrieval. Refused, not
    // logged and not quarantined.
    assertProviderScoped(retrieval, this.allowlistedProviderIds);

    /*
      SR-18 IN ITS SUBTRACTIVE FORM. Where the publisher's terms forbid
      retention the bytes are hashed and MEASURED but never written. The address
      and the length are still recorded, because "we held bytes that hashed to X
      and chose not to keep them" and "we have no snapshot" are different facts —
      and `retrievalIsReproducible()` is what reports the consequence.
    */
    const storageState: SnapshotStorageState = input.rights.payloadRetentionPermitted
      ? 'RETAINED'
      : 'NOT_RETAINED_BY_RIGHTS';

    await this.db.$transaction(async (tx: SnapshotTransactionClient) => {
      if (!quarantined) {
        await tx.snapshotPayload.upsert({
          where: { contentAddress: address },
          create: {
            contentAddress: address,
            bytes: storageState === 'RETAINED' ? input.bytes : null,
            byteLength,
            mediaType: input.mediaType,
            storageState,
          },
          // EMPTY ON PURPOSE — SR-4. A second sighting of the same bytes changes
          // nothing about the payload; it produces a retrieval row and no more.
          update: {},
        });
      }

      await tx.snapshotRetrieval.create({
        data: {
          retrievalId: input.retrievalId,
          providerId: input.request.providerId,
          endpointId: input.request.endpointId,
          requestPath: input.request.requestPath,
          parameters: input.request.parameters.map((p) => ({ key: p.key, value: p.value })),
          requestedAt: new Date(input.request.requestedAt),
          retrievedAt: new Date(input.retrievedAt),
          httpStatus: input.httpStatus,
          mediaType: input.mediaType,
          byteLength,
          contentAddress: quarantined ? null : address,
          contentEncoding: input.admission.transport.contentEncoding,
          wireByteLength: input.admission.transport.wireByteLength,
          admissibility: input.admission.admissibility,
          refusalKey: input.admission.refusalKey ?? null,
          refusalClass: input.admission.refusalClass ?? null,
          parserId: input.admission.parse?.parserId ?? null,
          parserVersion: input.admission.parse?.parserVersion ?? null,
          parsedAt:
            input.admission.parse === undefined ? null : new Date(input.admission.parse.parsedAt),
          completeness: input.completeness,
          rightsGrade: input.rights.grade,
          rightsInstrumentRef: input.rights.instrumentRef,
          payloadRetentionPermitted: input.rights.payloadRetentionPermitted,
          editionAnnotations: { ...input.editionAnnotations },
          publisherReleasedAt:
            input.publisherReleasedAt === undefined ? null : new Date(input.publisherReleasedAt),
          publisherChangedAt:
            input.publisherChangedAt === undefined ? null : new Date(input.publisherChangedAt),
        },
      });
    });

    return retrieval;
  }

  /**
   * SR-6 — re-open retained bytes.
   *
   * `null` for all three of "never retained", "not retained by rights" and
   * "collected", which is exactly what the contract specifies: the caller asked
   * for bytes and there are none. WHICH of the three it is remains answerable —
   * `retentionClassOf()` and the tombstone say so — but `open()` does not
   * overload its return value to carry that.
   */
  async open(address: SnapshotContentAddress): Promise<RetainedPayload | null> {
    const row = await this.db.snapshotPayload.findUnique({ where: { contentAddress: address } });

    if (row === null || row.bytes === null) return null;

    return sealPayload(row.bytes, address, row.mediaType);
  }

  /**
   * SR-19 — mark a payload as evidence behind a published figure.
   *
   * IDEMPOTENT BY CITATION. Re-pinning the same `citedBy` re-arms an existing
   * pin rather than creating a second one that would later have to be released
   * twice — which is how a payload ends up collectable while still cited.
   */
  async pin(address: SnapshotContentAddress, reason: SnapshotPinReason): Promise<void> {
    if (reason.citedBy.trim() === '') {
      throw new SnapshotStoreError(
        'SNAPSHOT_PIN_WITHOUT_CITATION: a pin names the observation lineage key that cites ' +
          'these bytes. A pin that cannot be re-derived cannot be safely released.',
      );
    }

    const payload = await this.db.snapshotPayload.findUnique({
      where: { contentAddress: address },
    });

    if (payload === null) {
      throw new SnapshotStoreError(
        `SNAPSHOT_PIN_UNKNOWN_PAYLOAD: ${address} was never retained, so nothing can cite it.`,
      );
    }

    if (payload.storageState === 'COLLECTED') {
      throw new SnapshotStoreError(
        `SNAPSHOT_PIN_AFTER_COLLECTION: ${address} was collected under policy; its bytes are ` +
          'gone and pinning them now would assert evidence that no longer exists.',
      );
    }

    await this.db.snapshotPin.upsert({
      where: { contentAddress_citedBy: { contentAddress: address, citedBy: reason.citedBy } },
      create: {
        contentAddress: address,
        citedBy: reason.citedBy,
        pinnedAt: new Date(reason.pinnedAt),
      },
      update: { releasedAt: null },
    });
  }

  /** True while any unreleased pin cites these bytes. The pin table is the source of truth. */
  async isPinned(address: SnapshotContentAddress): Promise<boolean> {
    const pin = await this.db.snapshotPin.findFirst({
      where: { contentAddress: address, releasedAt: null },
    });

    return pin !== null;
  }

  /** SR-6 — every retrieval that produced these bytes, oldest first. */
  async retrievalsFor(address: SnapshotContentAddress): Promise<readonly OfficialDataRetrieval[]> {
    const rows = await this.db.snapshotRetrieval.findMany({
      where: { contentAddress: address },
      orderBy: [{ retrievedAt: 'asc' }],
    });

    return rows.map(toRetrieval);
  }

  /**
   * The contract's four-valued retention class, DERIVED rather than stored.
   *
   * PINNED wins over everything because it is the one class that forbids an
   * action, and deriving it from the pin table is what makes it impossible for
   * the flag and the pins to disagree.
   */
  async retentionClassOf(address: SnapshotContentAddress): Promise<SnapshotRetentionClass | null> {
    const row = await this.db.snapshotPayload.findUnique({ where: { contentAddress: address } });

    if (row === null) return null;
    if (await this.isPinned(address)) return 'PINNED';

    return row.storageState as SnapshotRetentionClass;
  }

  /**
   * Release a citation. NOT a delete, and not a collection.
   *
   * Un-publishing makes a payload eligible after the grace window; republishing
   * inside the window therefore costs nothing and a mistaken un-publish is
   * recoverable. Deleting the pin row would erase the timestamp the window is
   * measured from.
   */
  async releasePin(
    address: SnapshotContentAddress,
    citedBy: string,
    releasedAt: string,
  ): Promise<void> {
    await this.db.snapshotPin.update({
      where: { contentAddress_citedBy: { contentAddress: address, citedBy } },
      data: { releasedAt: new Date(releasedAt) },
    });
  }

  /**
   * SR-19 · SR-20 — collect bytes under a NAMED policy, leaving a tombstone.
   *
   * THERE IS NO `force` PARAMETER, AND ADDING ONE WOULD BE THE END OF THIS
   * CAPABILITY. Storage pressure is a reason to have a policy, not to bypass
   * one.
   *
   * The pin check here is the third of three: `assertCollectable()` in the
   * contract, this, and the `snapshot_payload_pinned_not_collectable` trigger.
   * Three because the caller may be this store, another service, or a psql
   * session during an incident — and the last of those is both the most likely
   * to be asked for space and the least likely to be reviewed.
   */
  async collect(input: CollectInput): Promise<SnapshotTombstone> {
    const row = await this.db.snapshotPayload.findUnique({
      where: { contentAddress: input.address },
    });

    if (row === null) {
      throw new SnapshotStoreError(
        `SNAPSHOT_COLLECT_UNKNOWN_PAYLOAD: ${input.address} was never retained.`,
      );
    }

    if (input.policyId.trim() === '') {
      throw new SnapshotStoreError(
        'SNAPSHOT_COLLECT_WITHOUT_POLICY: collection is authorised by a named policy. ' +
          'There is no ad-hoc collection in this contract.',
      );
    }

    if (await this.isPinned(input.address)) {
      throw new SnapshotStoreError(
        `SNAPSHOT_PINNED_NOT_COLLECTABLE: ${input.address} is evidence behind a published figure.`,
      );
    }

    if (row.storageState === 'COLLECTED') {
      const existing = await this.db.snapshotTombstone.findUnique({
        where: { contentAddress: input.address },
      });

      if (existing !== null) return toTombstone(existing);
    }

    const tombstone = await this.db.$transaction(async (tx: SnapshotTransactionClient) => {
      await tx.snapshotPayload.update({
        where: { contentAddress: input.address },
        data: { bytes: null, storageState: 'COLLECTED' },
      });

      return tx.snapshotTombstone.create({
        data: {
          contentAddress: input.address,
          byteLength: row.byteLength,
          mediaType: row.mediaType,
          collectedAt: new Date(input.collectedAt),
          policyId: input.policyId,
        },
      });
    });

    return toTombstone(tombstone);
  }

  /** The tombstone for a collected payload, or null. */
  async tombstoneFor(address: SnapshotContentAddress): Promise<SnapshotTombstone | null> {
    const row = await this.db.snapshotTombstone.findUnique({ where: { contentAddress: address } });

    return row === null ? null : toTombstone(row);
  }
}

/**
 * THE ONLY PLACE A `RetainedPayload` IS CONSTRUCTED.
 *
 * The cast is the one the seal requires — the symbol is not exported, so no
 * object literal can satisfy the type — and it is safe here because the address
 * was computed from these very bytes one line earlier at every call site.
 * `assertPayloadMatchesItsAddress()` re-proves it at the boundary for the case
 * where someone later adds a call site that is less careful.
 */
function sealPayload(
  bytes: Uint8Array,
  address: SnapshotContentAddress,
  mediaType: string,
): RetainedPayload {
  const actual = computeSha256Hex(bytes);

  if (actual !== (address as string)) {
    throw new SnapshotStoreError(
      `SNAPSHOT_ADDRESS_MISMATCH: retained bytes hash to ${actual} and are filed under ${address}. ` +
        'The stored payload and its address have diverged.',
    );
  }

  return {
    contentAddress: address,
    byteLength: bytes.byteLength,
    mediaType,
    bytes,
  } as unknown as RetainedPayload;
}

function toRetrieval(row: SnapshotRetrievalRow): OfficialDataRetrieval {
  const parameters = Array.isArray(row.parameters)
    ? (row.parameters as Array<{ key: string; value: string }>).map((p) => ({
        key: p.key,
        value: p.value,
      }))
    : [];

  return {
    retrievalId: row.retrievalId,
    request: {
      providerId: row.providerId,
      endpointId: row.endpointId,
      requestPath: row.requestPath,
      parameters,
      requestedAt: row.requestedAt.toISOString(),
    },
    retrievedAt: row.retrievedAt.toISOString(),
    httpStatus: row.httpStatus,
    mediaType: row.mediaType,
    byteLength: row.byteLength,
    ...(row.contentAddress === null
      ? {}
      : { contentAddress: snapshotContentAddress(row.contentAddress) }),
    completeness: row.completeness as SnapshotCompleteness,
    rights: {
      grade: row.rightsGrade,
      instrumentRef: row.rightsInstrumentRef,
      payloadRetentionPermitted: row.payloadRetentionPermitted,
    },
    editionAnnotations: (row.editionAnnotations ?? {}) as Readonly<Record<string, string>>,
    ...(row.publisherReleasedAt === null
      ? {}
      : { publisherReleasedAt: row.publisherReleasedAt.toISOString() }),
    ...(row.publisherChangedAt === null
      ? {}
      : { publisherChangedAt: row.publisherChangedAt.toISOString() }),
  };
}

function toTombstone(row: {
  contentAddress: string;
  byteLength: number;
  mediaType: string;
  collectedAt: Date;
  policyId: string;
}): SnapshotTombstone {
  return {
    contentAddress: snapshotContentAddress(row.contentAddress),
    byteLength: row.byteLength,
    mediaType: row.mediaType,
    collectedAt: row.collectedAt.toISOString(),
    policyId: row.policyId,
  };
}

/** Re-exported so a consumer can type a row without reaching into the port. */
export type { SnapshotPayloadRow };
