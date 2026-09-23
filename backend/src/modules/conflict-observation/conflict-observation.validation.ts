import {
  validateConflictObservation,
  InvalidRetainedConflictObservation,
  type ConflictObservation,
} from '@globalnews-ai/shared';
import type { ConflictObservation as RetainedRow } from '../../generated/prisma/client';
export {
  validateConflictObservation,
  InvalidRetainedConflictObservation,
} from '@globalnews-ai/shared';
function requireValid(condition: unknown): asserts condition {
  if (!condition) throw new InvalidRetainedConflictObservation();
}
export function decodeRetainedConflictRow(row: RetainedRow): ConflictObservation {
  const observation = validateConflictObservation({
    observationKey: row.observationKey,
    identity: { authority: row.authority, upstreamEventId: row.upstreamEventId },
    eventType: row.eventType,
    owner: row.owner,
    actors: row.actors,
    geography: row.geography,
    temporal: row.temporal,
    severity: row.severity,
    sourceReference: row.sourceReference,
    acquisition: row.acquisition,
    revision: row.revision,
  });
  requireValid(row.revisionOrdinal === observation.revision.revisionOrdinal);
  requireValid(
    row.occurredOn instanceof Date &&
      row.occurredOn.getTime() === Date.parse(observation.temporal.eventStartedAt),
  );
  requireValid(
    row.ingestedAt instanceof Date &&
      row.ingestedAt.getTime() === Date.parse(observation.temporal.ingestedAt),
  );
  requireValid((row.countryIso3 ?? null) === (observation.geography.countryIso3 ?? null));
  requireValid(
    row.snapshotRetrievalId === observation.acquisition.snapshotRetrievalId &&
      row.snapshotAdmissibility === observation.acquisition.snapshotAdmissibility,
  );
  return observation;
}
