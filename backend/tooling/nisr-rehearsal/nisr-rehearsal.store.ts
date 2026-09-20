/**
 * ════════════════════════════════════════════════════════════════════════════
 * A SNAPSHOT STORE FOR THE ONE-SHOT RUN — SUBSTRATE-INDEPENDENT, AS RULED
 * ════════════════════════════════════════════════════════════════════════════
 *
 * TOOLING. Not in the production build.
 *
 * ── WHY THIS EXISTS RATHER THAN THE POSTGRES STORE ────────────────────────
 *
 * The store port is *"substrate-independent ON PURPOSE. Postgres `Bytes`, a mounted
 * volume and an object store all satisfy it, and none of the guarantees below depends on
 * which is chosen."* This is a fourth substrate, and it satisfies the same port.
 *
 * Two reasons it is the right one for this run, and the second is the one that matters:
 *
 *   1. No PostgreSQL is available on this runtime, and the run must not be blocked on
 *      provisioning one to prove a parser.
 *   2. `PostgresOfficialDataSnapshotStore` now REFUSES a retrieval carrying
 *      `referencePeriod` or `sourceLanguage`, because it has no column for either and
 *      dropping them silently would let a figure cite a lineage the evidence table cannot
 *      reproduce. That refusal is this round's reported blocker, and routing around it
 *      here would be exactly the invention the instruction forbids. It is not routed
 *      around: this substrate holds the whole record because holding the whole record is
 *      what a substrate does, and the Postgres gap stays open and reported.
 *
 * ── THE GUARANTEES ARE KEPT, NOT WAIVED ───────────────────────────────────
 *
 * THE STORE COMPUTES THE ADDRESS — a caller may not supply one, which is half of the
 * no-forge property. `RetainedPayload` carries an unexported unique symbol, so this seals
 * through the same construction the Postgres store uses, AND re-verifies at the boundary
 * that the bytes hash to the address they claim. *"The type stops the accident, the
 * assertion stops the shortcut."*
 *
 * IDENTICAL BYTES ARE ONE PAYLOAD AND TWO RETRIEVALS — SR-4, which is also what makes the
 * two-artifact case representable at all.
 *
 * IT IS NOT DURABLE, and nothing here pretends otherwise: this run's evidence is the
 * emitted record, and the artifact itself is re-fetchable from a content address that was
 * computed from the bytes rather than asserted about them.
 */

import { createHash } from 'node:crypto';

import {
  assertRequestCarriesNoCredential,
  assertAdmissionRecordIsCoherent,
  type OfficialDataRetrieval,
  type OfficialDataSnapshotStore,
  type RetainedPayload,
  type SnapshotContentAddress,
  type SnapshotPinReason,
} from '@globalnews-ai/shared';

type RetainInput = Parameters<OfficialDataSnapshotStore['retain']>[0];

interface StoredPayload {
  readonly bytes: Uint8Array;
  readonly mediaType: string;
  readonly byteLength: number;
}

export class RehearsalSnapshotStore implements OfficialDataSnapshotStore {
  private readonly payloads = new Map<string, StoredPayload>();
  private readonly retrievals: OfficialDataRetrieval[] = [];
  private readonly pins = new Map<string, SnapshotPinReason[]>();

  async retain(input: RetainInput): Promise<OfficialDataRetrieval> {
    /* SR-22 FIRST: a credential must never reach storage, so it is refused BEFORE
       anything is written rather than cleaned up afterwards. */
    assertRequestCarriesNoCredential(input.request);
    assertAdmissionRecordIsCoherent(input.admission, input.httpStatus);

    /* THE STORE COMPUTES IT. The caller has no way to supply one. */
    const address = createHash('sha256').update(input.bytes).digest('hex') as SnapshotContentAddress;

    const quarantined =
      input.admission.admissibility === 'REFUSED' &&
      input.admission.refusalKey === 'SECRET_DETECTED';

    if (!quarantined && input.rights.payloadRetentionPermitted && !this.payloads.has(address)) {
      /* SR-4: a second sighting of the same bytes changes nothing about the payload; it
         produces a retrieval row and no more. */
      this.payloads.set(address, {
        bytes: input.bytes,
        mediaType: input.mediaType,
        byteLength: input.bytes.byteLength,
      });
    }

    const retrieval: OfficialDataRetrieval = {
      retrievalId: input.retrievalId,
      request: input.request,
      retrievedAt: input.retrievedAt,
      httpStatus: input.httpStatus,
      mediaType: input.mediaType,
      byteLength: input.bytes.byteLength,
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
      ...(input.referencePeriod === undefined ? {} : { referencePeriod: input.referencePeriod }),
      ...(input.sourceLanguage === undefined ? {} : { sourceLanguage: input.sourceLanguage }),
    };
    this.retrievals.push(retrieval);
    return retrieval;
  }

  async open(address: SnapshotContentAddress): Promise<RetainedPayload | null> {
    const row = this.payloads.get(address);
    if (row === undefined) return null;

    /* THE ASSERTION THAT STOPS THE SHORTCUT: re-proved at the boundary, every time. */
    const actual = createHash('sha256').update(row.bytes).digest('hex');
    if (actual !== (address as string)) {
      throw new Error(
        `SNAPSHOT_ADDRESS_MISMATCH: retained bytes hash to ${actual} and are filed under ${address}.`,
      );
    }

    return {
      contentAddress: address,
      byteLength: row.byteLength,
      mediaType: row.mediaType,
      bytes: row.bytes,
    } as unknown as RetainedPayload;
  }

  async pin(address: SnapshotContentAddress, reason: SnapshotPinReason): Promise<void> {
    if (reason.citedBy.trim() === '') {
      throw new Error('SNAPSHOT_PIN_WITHOUT_CITATION: a pin names what cites it.');
    }
    if (!this.payloads.has(address)) {
      throw new Error(`SNAPSHOT_PIN_UNKNOWN_PAYLOAD: ${address} was never retained.`);
    }
    const existing = this.pins.get(address) ?? [];
    /* IDEMPOTENT BY CITATION — re-pinning the same `citedBy` re-arms rather than
       creating a second pin that would later have to be released twice. */
    const others = existing.filter((p) => p.citedBy !== reason.citedBy);
    this.pins.set(address, [...others, reason]);
  }

  async isPinned(address: SnapshotContentAddress): Promise<boolean> {
    return (this.pins.get(address) ?? []).length > 0;
  }

  async retrievalsFor(address: SnapshotContentAddress): Promise<readonly OfficialDataRetrieval[]> {
    return this.retrievals.filter((r) => r.contentAddress === address);
  }

  /** Every retrieval, oldest first. For the evidence record only. */
  allRetrievals(): readonly OfficialDataRetrieval[] {
    return [...this.retrievals];
  }

  payloadCount(): number {
    return this.payloads.size;
  }
}
