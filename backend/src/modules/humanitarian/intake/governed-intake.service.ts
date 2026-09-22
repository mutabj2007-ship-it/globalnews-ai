import {
  assertAuthorityIsInstalled,
  assertGeometryIsWellFormed,
  recordIsProtectedUnderAuthority,
  type ProtectionAuthority,
  type SourceGeometryKind,
  type GeometryCoordinateValue,
  type GeometryCrs,
  type GeometryDenotation,
  type GeometryOrigin,
} from '@globalnews-ai/shared';

import {
  assertNoProtectionOwnedFields,
  type GovernedHumanitarianIntake,
  type GovernedIntakeReceipt,
  type SourceEvidenceRecord,
} from '../humanitarian-intake.port';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * AC-1 · THE GOVERNED INTAKE LAYER — THE IMPLEMENTATION BEHIND G's DOOR
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ALPHA-HUMANITARIAN-BOOT-INTAKE-R1 · part A.
 *
 * ── THIS FILE WAS WRITTEN TWICE, AND THE FIRST VERSION WAS THE MISTAKE ────
 *
 * The first draft declared its own `GovernedHumanitarianIntake` class, its own
 * submission type and its own repository port. Then `humanitarian-intake.port.ts`
 * arrived from G's R1.2 and said, in as many words:
 *
 *     "This lane defines the door and hands it to the intake layer… there is no
 *      implementation of `GovernedHumanitarianIntake` at all."
 *
 * The door already existed. A second one would have been a SECOND ARCHITECTURE for the
 * same boundary — two `SourceEvidenceRecord` shapes, two definitions of which fields are
 * protection-owned, agreeing only by discipline. That is the failure the snapshot lane
 * caught in itself and discarded a draft over, and the same answer applies: implement
 * the accepted port, declare nothing of your own.
 *
 * So this file declares NO interface. It implements G's.
 *
 * ── WHAT THE INTAKE LAYER OWNS ────────────────────────────────────────────
 *
 * G's port carries `recordKey` — an identity handle — and deliberately drops
 * `protectionClassId` and `presentationPartitionKey` on the way to persistence. This
 * layer is what supplies them, "reading them from the installed authority rather than
 * from anything a producer sent it".
 *
 * That sentence is the whole design, and it has a consequence worth stating: the
 * resolution is keyed on `recordKey` ALONE. Nothing about the evidence influences which
 * protection class comes back, so a producer cannot steer the answer by varying what it
 * sends.
 */

/**
 * The authority-side answer. Keyed on the identity handle and nothing else.
 *
 * `null` is a real answer and the important one: the authority declines to key this
 * record. AS-4 then applies — withheld, never defaulted into an unprotected key.
 */
export interface GovernedProtectionResolution {
  readonly presentationPartitionKey: string;
  readonly protectionClassId?: string;
}

export interface GovernedProtectionResolver {
  resolve(recordKey: string): GovernedProtectionResolution | null;
}

/** The row as it reaches the authority table. Assembled HERE and nowhere else. */
export interface GovernedGeometryRow {
  readonly recordKey: string;
  readonly protectionClassId: string | null;
  readonly presentationPartitionKey: string;
  readonly emittingDomainId: string;
  readonly sourceId: string;
  readonly sourceGeometryId: string;
  readonly geometryKind: SourceGeometryKind;
  readonly denotation: GeometryDenotation;
  readonly origin: GeometryOrigin;
  readonly crs: GeometryCrs;
  readonly coordinates: GeometryCoordinateValue;
}

/**
 * The write capability — a PORT, so that the only concrete writer is the one the
 * authority side binds. There is no concrete writer in this package, which is what makes
 * "the producer holds no connection" a fact about the module graph rather than a habit.
 */
export interface AuthorityIntakeRepository {
  insertGeometryRecord(row: GovernedGeometryRow): Promise<void>;
}

export class GovernedIntakeService implements GovernedHumanitarianIntake {
  constructor(
    private readonly resolver: GovernedProtectionResolver,
    private readonly repository: AuthorityIntakeRepository,
    /** Read at admit time, never cached — an epoch may advance between batches. */
    private readonly authorityOf: () => ProtectionAuthority,
  ) {}

  async admit(evidence: readonly SourceEvidenceRecord[]): Promise<GovernedIntakeReceipt> {
    const authority = this.authorityOf();

    /*
      AS-E1-2, before anything is resolved or written. A structurally valid forgery
      carries an empty dark set, so resolving against one would classify every record as
      unprotected — and this is a WRITE path, so that mistake would be durable in a way
      a read-path mistake is not.
    */
    assertAuthorityIsInstalled(authority);

    // Queue/retry callers can bypass the producer. Validate the entire batch before
    // the first durable write, preserving the shared geometry refusal vocabulary.
    const identities = new Set<string>();
    for (const record of evidence) {
      assertNoProtectionOwnedFields(record);
      for (const id of [record.recordKey, record.sourceId, record.sourceGeometryId, record.emittingDomainId]) {
        if (typeof id !== 'string' || id.trim().length === 0) throw new Error('Missing evidence identity');
      }
      if (identities.has(record.recordKey)) throw new Error('Duplicate record requires revision reconciliation');
      identities.add(record.recordKey);
      assertGeometryIsWellFormed({
        kind: record.geometryKind, denotation: record.denotation, origin: record.origin,
        crs: record.crs, coordinates: record.coordinates, sourceId: record.sourceId,
        sourceGeometryId: record.sourceGeometryId, relationToAssertion: 'THE_ASSERTION',
      });
    }

    const recordKeys: string[] = [];

    for (const record of evidence) {
      /*
        G's own guard, run again HERE rather than trusted from `prepareSourceEvidence`.
        A record can reach this method from anywhere — a queue, a retry, a test double —
        and a check that only runs in the happy path is a check that runs where it is
        least needed.
      */
      assertNoProtectionOwnedFields(record);

      const resolution = this.resolver.resolve(record.recordKey);
      if (resolution === null) {
        // AS-4 — withheld, never defaulted into an unprotected key. A default here is
        // precisely the fail-open the table-level INSERT grant could not close.
        continue;
      }

      const classId = resolution.protectionClassId;

      /*
        A resolver naming a class the authority does not declare is a resolver
        DISAGREEING WITH THE REGISTRY. The safe reading of that disagreement is that the
        record is not keyed — the alternative is persisting a protection class that the
        authority has never heard of, which would be unreviewable afterwards.
      */
      if (classId !== undefined && !recordIsProtectedUnderAuthority(classId, authority)) {
        continue;
      }

      /*
        ── BUILT FROM THE RESOLUTION, NEVER SPREAD FROM THE EVIDENCE ────────

        Every protection-owned value below comes from `resolution`. `...record` would
        carry whatever a caller attached, and the one row this must never produce is one
        whose protection came from the thing being protected against.
      */
      await this.repository.insertGeometryRecord({
        recordKey: record.recordKey,
        protectionClassId: classId ?? null,
        presentationPartitionKey: resolution.presentationPartitionKey,
        emittingDomainId: record.emittingDomainId,
        sourceId: record.sourceId,
        sourceGeometryId: record.sourceGeometryId,
        geometryKind: record.geometryKind,
        denotation: record.denotation,
        origin: record.origin,
        crs: record.crs,
        // GX-12 — the governed closed carrier, by reference. Rebuilding it here would be
        // the first step of the reshaping this domain forbids.
        coordinates: record.coordinates,
      });

      recordKeys.push(record.recordKey);
    }

    return { admitted: recordKeys.length, recordKeys };
  }
}
