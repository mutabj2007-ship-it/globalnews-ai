import type {
  ConflictObservation,
  ConflictRetainedEvidenceDetail,
  ConflictSourceReference,
} from '@globalnews-ai/shared';

/**
 * CTO R150 / PD-1 · E1 R143 addendum 01 Part A — the ONE outbound shape of the public Conflict reader
 * (`GET /conflict/observations` and `GET /conflict/observations/:key/evidence`, served to backend-origin clients
 * and to the frontend's same-origin `/conflict-data` rewrite alike).
 *
 * UCDP's CC BY 4.0 licenses UCDP's coded data, not the reporting publisher's expression that UCDP recorded. So the
 * reader gets UCDP's facts and never:
 *   - `sourceReference.citation` — UCDP `source_article` (outlet, date AND headline);
 *   - `sourceHeadline` — UCDP `source_headline`;
 *   - `sourceOriginal` — UCDP `source_original`, free text no ingest constrains to names (E1-CONF-3).
 * Built by ALLOWLIST, so a field added upstream later is withheld until someone rules on it. Storage, the internal
 * Ask read and the owner-only admin review are untouched: this is the reader edge only, not a deletion.
 */
export function toPublicConflictObservation(observation: ConflictObservation): ConflictObservation {
  return {
    observationKey: observation.observationKey,
    identity: observation.identity,
    eventType: observation.eventType,
    owner: observation.owner,
    actors: observation.actors,
    geography: observation.geography,
    temporal: observation.temporal,
    severity: observation.severity,
    sourceReference: publicSourceReference(observation.sourceReference),
    acquisition: observation.acquisition,
    revision: observation.revision,
  };
}

export function toPublicEvidenceDetail(
  detail: ConflictRetainedEvidenceDetail,
): ConflictRetainedEvidenceDetail {
  return {
    observationKey: detail.observationKey,
    authority: detail.authority,
    upstreamEventId: detail.upstreamEventId,
    sourceParties: detail.sourceParties,
    ...(detail.whereDescription !== undefined ? { whereDescription: detail.whereDescription } : {}),
    ...(detail.conflictName !== undefined ? { conflictName: detail.conflictName } : {}),
    ...(detail.dyadName !== undefined ? { dyadName: detail.dyadName } : {}),
    ...(detail.numberOfSources !== undefined ? { numberOfSources: detail.numberOfSources } : {}),
    ...(detail.sourceCountryName !== undefined ? { sourceCountryName: detail.sourceCountryName } : {}),
    snapshotRetrievalId: detail.snapshotRetrievalId,
    snapshotContentAddress: detail.snapshotContentAddress,
  };
}

/**
 * UCDP `source_office` (outlet NAMES, `;`-separated) and the record's own UCDP link stay (E1 Part A1). A social
 * handle — a person's account — is dropped (CTO R144), the same rule the frontend applies.
 */
function publicSourceReference(reference: ConflictSourceReference): ConflictSourceReference {
  const office = reportingOfficeNames(reference.reportingOffice);
  return {
    ...(office ? { reportingOffice: office } : {}),
    ...(reference.sourceUrl !== undefined ? { sourceUrl: reference.sourceUrl } : {}),
  };
}

function reportingOfficeNames(value: string | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const names = value
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !part.startsWith('@') && !/\bon X\b/i.test(part));
  return names.length > 0 ? Array.from(new Set(names)).join('; ') : undefined;
}
