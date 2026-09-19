import type {
  GeometryCoordinateValue,
  GeometryCrs,
  GeometryDenotation,
  GeometryOrigin,
  KeyedGeometry,
  SourceGeometryKind,
} from '@globalnews-ai/shared';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * AC-1 · THE GOVERNED INTAKE BOUNDARY
 * ════════════════════════════════════════════════════════════════════════════
 *
 * G-HUMANITARIAN-COPERNICUS-PRODUCER-R1-2.
 *
 * E1 · AC-1: *"Do not create a direct INSERT path into the authority table. The producer
 * may prepare source evidence for persistence, but protection-owned fields must be
 * supplied through the governed intake layer."*
 *
 * ── WHY A PORT AND NOT A REPOSITORY ───────────────────────────────────────
 *
 * PA-E1-1 is the column-level GRANT that stops a producer role blanking
 * `protection_class_id` and `presentation_partition_key` on a governed record. E1
 * executed that attack before the grant existed and it succeeded with `UPDATE 1`. The
 * grant is the control; this file is the SHAPE that makes the control redundant rather
 * than load-bearing, because a producer that never holds the fields cannot blank them.
 *
 * So there is no repository here, no Prisma client, no SQL and no implementation of
 * `GovernedHumanitarianIntake` at all. This lane defines the door and hands it to the
 * intake layer. A test asserts the absence, because "we did not write one" is a fact
 * that decays the moment somebody needs one quickly.
 *
 * ── THE TWO FIELDS THAT ARE NOT HERE ──────────────────────────────────────
 *
 * The producer DOES receive `protectionClassId` and `presentationPartitionKey` — from
 * the authority port, at emit time, because they decide whether a record may be emitted
 * at all. They are deliberately dropped again on the way to persistence. Carrying a
 * protection-owned value on the producer's write payload would make the producer the
 * thing that states it, and the difference between "the producer relayed the authority's
 * value" and "the producer supplied a value" is invisible in a row.
 *
 * `recordKey` IS carried. It is an identity handle, not a protection decision: the
 * intake layer uses it to ask the authority for the protection-owned fields itself.
 */

/** The field names AC-1 reserves to the governed intake layer. Never on this payload. */
export const PROTECTION_OWNED_FIELDS: readonly string[] = Object.freeze([
  'protectionClassId',
  'presentationPartitionKey',
  'protection_class_id',
  'presentation_partition_key',
]);

/**
 * What a producer may hand to persistence: the SOURCE's own assertion, and nothing the
 * protection system owns.
 */
export interface SourceEvidenceRecord {
  /** Identity handle assigned by the authority. Not a protection decision. */
  readonly recordKey: string;
  readonly sourceId: string;
  readonly sourceGeometryId: string;
  readonly emittingDomainId: string;
  readonly geometryKind: SourceGeometryKind;
  readonly denotation: GeometryDenotation;
  readonly origin: GeometryOrigin;
  readonly crs: GeometryCrs;
  /** GX-12 · the governed closed carrier, by reference. Never rebuilt here. */
  readonly coordinates: GeometryCoordinateValue;
}

export interface GovernedIntakeReceipt {
  readonly admitted: number;
  readonly recordKeys: readonly string[];
}

/**
 * THE DOOR. Implemented by the governed intake layer, never by a producer.
 *
 * The intake layer is what supplies the protection-owned fields, reading them from the
 * installed authority rather than from anything a producer sent it.
 */
export interface GovernedHumanitarianIntake {
  admit(evidence: readonly SourceEvidenceRecord[]): Promise<GovernedIntakeReceipt>;
}

export class ProtectionOwnedFieldPresent extends Error {}

/** Fails loudly if a protection-owned field ever appears on a prepared record. */
export function assertNoProtectionOwnedFields(record: object): void {
  const names = Object.getOwnPropertyNames(record);
  for (const forbidden of PROTECTION_OWNED_FIELDS) {
    if (names.includes(forbidden)) {
      throw new ProtectionOwnedFieldPresent(
        `PROTECTION_OWNED_FIELD_ON_PRODUCER_PAYLOAD: '${forbidden}'. AC-1 reserves it to the ` +
          'governed intake layer; a producer that carries it is a producer that can state it.',
      );
    }
  }
}

/**
 * Prepare emitted records for the governed intake layer.
 *
 * PURE, and it persists nothing. The geometry's coordinate carrier is passed BY
 * REFERENCE — this is the same source-native array the publisher supplied, and copying
 * it here would be the first step of the reshaping this domain forbids.
 */
export function prepareSourceEvidence(
  emitted: readonly KeyedGeometry[],
): readonly SourceEvidenceRecord[] {
  return emitted.map((record) => {
    const { geometry } = record;
    if (geometry.coordinates === undefined) {
      // Kind NONE carries no coordinates and this domain emits no NONE records.
      throw new ProtectionOwnedFieldPresent(
        'SOURCE_EVIDENCE_WITHOUT_COORDINATES: a Humanitarian extent record always carries the ' +
          "source's coordinates; a record without them is not evidence of an extent.",
      );
    }

    const evidence: SourceEvidenceRecord = {
      recordKey: record.recordKey,
      sourceId: geometry.sourceId,
      sourceGeometryId: geometry.sourceGeometryId ?? '',
      emittingDomainId: record.emittingDomainId,
      geometryKind: geometry.kind,
      denotation: geometry.denotation,
      origin: geometry.origin,
      crs: geometry.crs,
      coordinates: geometry.coordinates,
    };

    assertNoProtectionOwnedFields(evidence);
    return evidence;
  });
}
