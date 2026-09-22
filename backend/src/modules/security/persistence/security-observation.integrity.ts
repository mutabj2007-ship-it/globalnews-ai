import {
  assertSecurityObservationIsWellFormed,
  securityObservationKey,
  type SecurityObservation,
} from '@globalnews-ai/shared';
import type { SecuritySourceEligibility } from '../security-source-eligibility';
type Evidence = SecurityObservation & {
  sourceEligibility: SecuritySourceEligibility;
  corpusPublishedAt: string;
};
function payloadGuard(value: unknown): asserts value is Evidence {
  const p = value as Evidence;
  assertSecurityObservationIsWellFormed(p);
  if (
    p.observationKey !==
    securityObservationKey(p.identity.upstreamAuthority, p.sourceReference.sourceUrl!, p.subjectId)
  )
    throw new Error('Country identity disagreement');
  const e = p.sourceEligibility;
  if (
    !e ||
    e.policyVersion !== 'SECURITY-RETAINED-REVIEW-1' ||
    !e.internalReviewPermitted ||
    e.publicEvidencePermitted !== false ||
    e.publicDecision !== 'NOT_AUTHORISED' ||
    e.sourceRights !== 'UNVERIFIED' ||
    e.synthesisStatus !== 'UNVERIFIED' ||
    e.reasons.length !== 0 ||
    e.sourceId !== p.identity.upstreamAuthority ||
    e.sourceUrl !== p.sourceReference.sourceUrl ||
    !Number.isFinite(Date.parse(p.corpusPublishedAt))
  )
    throw new Error('Eligibility audit disagreement');
  const v = p.revision;
  if (
    !Number.isInteger(v.revisionOrdinal) ||
    v.revisionOrdinal < 0 ||
    v.supersedesRevisionOrdinal !== (v.revisionOrdinal ? v.revisionOrdinal - 1 : null) ||
    !Number.isFinite(Date.parse(v.recordedAt)) ||
    (v.revisionOrdinal === 0
      ? v.revisionKind != null
      : !['SOURCE_REVISION', 'CLASSIFICATION_CHANGE'].includes(v.revisionKind!))
  )
    throw new Error('Invalid revision');
}
export function assertSecurityDraft(value: SecurityObservation, geographyId: string) {
  payloadGuard(value);
  if (
    value.subjectId !== geographyId ||
    value.revision.revisionOrdinal !== 0 ||
    value.revision.supersedesRevisionOrdinal !== null
  )
    throw new Error('Draft scope/revision disagreement');
}
export function assertSecurityStoredBinding(
  row: {
    runId: number;
    observationKey: string;
    geographyId: string;
    revisionOrdinal: number;
    supersedesRevisionOrdinal: number | null;
    ownershipT1: boolean;
    ownershipT2: boolean;
    resolvedOwner: string;
    payload: unknown;
  },
  creationRun: { id: number; geographyId: string } | null,
  geographyId: string,
) {
  payloadGuard(row.payload);
  const p = row.payload;
  if (
    !creationRun ||
    row.runId !== creationRun.id ||
    creationRun.geographyId !== geographyId ||
    row.geographyId !== geographyId ||
    p.subjectId !== geographyId ||
    p.geography.geographyId !== geographyId ||
    row.observationKey !== p.observationKey ||
    row.ownershipT1 !== true ||
    row.ownershipT2 !== false ||
    row.resolvedOwner !== 'SECURITY' ||
    p.claim.ownership.violenceOrProtectivePosture !== row.ownershipT1 ||
    p.claim.ownership.organisedArmedActorParticipates !== row.ownershipT2 ||
    row.revisionOrdinal !== p.revision.revisionOrdinal ||
    row.supersedesRevisionOrdinal !== p.revision.supersedesRevisionOrdinal
  )
    throw new Error('Row/payload/run disagreement');
}
