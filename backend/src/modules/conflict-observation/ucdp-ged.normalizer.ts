import {
  assertPrecisionNotInferredFromGeometry,
  conflictEventKey,
  GEOMETRY_CRS,
  resolveConflictEventOwner,
  SEVERITY_UNAVAILABLE_NO_RULE,
  type ConflictObservation,
  type SpatialPrecision,
} from '@globalnews-ai/shared';

/** Adapted from the recovery candidate; deliberately no duplicate domain contract. */
export const MAX_CONFLICT_CAPTURE_BYTES = 1_048_576;
export const MAX_CONFLICT_CAPTURE_RECORDS = 500;

/** Server-owned review of exact retained bytes, never a flag supplied by an API caller. */
export interface ReviewedUcdpCapture {
  readonly sha256: string;
  readonly datasetVersion: string;
  readonly envelope: 'array' | 'results';
  readonly schema: 'ucdp-ged-json-v1';
}

export class ConflictAdmissionRefused extends Error {}

function refuse(reason: string): never {
  throw new ConflictAdmissionRefused(reason);
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) refuse('MALFORMED_CAPTURE');
  return value as Record<string, unknown>;
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 4096) {
    refuse(`SCHEMA_FIELD_INVALID:${field}`);
  }
  return value;
}

function date(value: unknown): string {
  const text = requiredText(value, 'event_date');
  // This reviewed subset accepts calendar dates only; no permissive Date.parse coercion.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) refuse('DATE_UNUSABLE');
  const parsed = new Date(`${text}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
    refuse('DATE_UNUSABLE');
  }
  return text;
}

const PRECISIONS: Readonly<Record<number, SpatialPrecision>> = {
  1: 'EXACT',
  2: 'CITY',
  3: 'DISTRICT',
  4: 'PROVINCE',
  5: 'COUNTRY',
  6: 'UNKNOWN',
  7: 'UNKNOWN',
};

/** Pure parser for a bounded, reviewed subset. Tests are synthetic, not capture evidence. */
export function normalizeUcdpGed(
  bytes: Uint8Array,
  profile: ReviewedUcdpCapture,
  context: { retrievalId: string; runId: string; ingestedAt: string },
): readonly ConflictObservation[] {
  if (profile.schema !== 'ucdp-ged-json-v1' || !['array', 'results'].includes(profile.envelope))
    refuse('UNSUPPORTED_SCHEMA');
  requiredText(profile.datasetVersion, 'datasetVersion');
  requiredText(context.retrievalId, 'retrievalId');
  requiredText(context.runId, 'runId');
  if (!Number.isFinite(Date.parse(context.ingestedAt))) refuse('DATE_UNUSABLE');
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_CONFLICT_CAPTURE_BYTES) {
    refuse('CAPTURE_SIZE_REFUSED');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    refuse('MALFORMED_CAPTURE');
  }
  const records = profile.envelope === 'array' ? parsed : object(parsed).Result;
  if (!Array.isArray(records) || records.length > MAX_CONFLICT_CAPTURE_RECORDS) {
    refuse('UNSUPPORTED_SCHEMA_OR_RECORD_BOUND');
  }
  const seen = new Set<string>();
  return records.map((value) => {
    const r = object(value);
    const rawId = r.id;
    if (
      !(typeof rawId === 'string' && rawId.trim() && rawId.length <= 128) &&
      !(typeof rawId === 'number' && Number.isSafeInteger(rawId) && rawId > 0)
    ) {
      refuse('EVENT_IDENTITY_DEPENDENCY');
    }
    const identity = { authority: 'UCDP_GED' as const, upstreamEventId: String(rawId) };
    const observationKey = conflictEventKey(identity);
    if (seen.has(observationKey)) refuse('DUPLICATE_EVENT_IN_CAPTURE');
    seen.add(observationKey);
    const namedActor = typeof r.side_a === 'string' && r.side_a.trim().length > 0;
    const knownType = [1, 2, 3].includes(r.type_of_violence as number);
    const owner = resolveConflictEventOwner({
      violenceOrProtectivePosture: knownType ? true : undefined,
      organisedArmedActorParticipates: knownType && namedActor ? true : undefined,
    });
    if (owner !== 'CONFLICT') refuse('OWNERSHIP_UNRESOLVED');
    requiredText(r.side_a, 'side_a');
    if (r.side_b !== undefined) requiredText(r.side_b, 'side_b');
    const start = date(r.date_start);
    const end = date(r.date_end);
    if (end < start) refuse('DATE_UNUSABLE');
    if (
      !Number.isInteger(r.date_prec) ||
      (r.date_prec as number) < 1 ||
      (r.date_prec as number) > 5
    )
      refuse('SCHEMA_FIELD_INVALID:date_prec');
    const precisionCode = r.where_prec;
    if (!Number.isInteger(precisionCode) || !PRECISIONS[precisionCode as number]) {
      refuse('GEOGRAPHY_UNUSABLE');
    }
    if (
      typeof r.latitude !== 'number' ||
      !Number.isFinite(r.latitude) ||
      Math.abs(r.latitude) > 90 ||
      typeof r.longitude !== 'number' ||
      !Number.isFinite(r.longitude) ||
      Math.abs(r.longitude) > 180
    ) {
      refuse('GEOGRAPHY_UNUSABLE');
    }
    const geography: ConflictObservation['geography'] = {
      geometryKind: 'POINT',
      coordinates: { type: 'Point', coordinates: [r.longitude, r.latitude] },
      crs: GEOMETRY_CRS,
      denotation: (precisionCode as number) >= 4 ? 'SOURCE_REPORTED_CENTROID' : 'EVENT_LOCATION',
      origin: 'SOURCE_NATIVE',
      precision: PRECISIONS[precisionCode as number],
      locationProvenance: 'STATED',
      // GED country names/ids are not source-published ISO3. Do not guess a code.
    };
    assertPrecisionNotInferredFromGeometry(geography);
    const sourceReference: { citation?: string; reportingOffice?: string } = {};
    if (r.source_article !== undefined)
      sourceReference.citation = requiredText(r.source_article, 'source_article');
    if (r.source_office !== undefined)
      sourceReference.reportingOffice = requiredText(r.source_office, 'source_office');
    return {
      observationKey,
      identity,
      owner,
      // Violence type does not establish a weapon, battle, or incident subtype.
      eventType: 'EVENT_TYPE_NOT_CLASSIFIED',
      // Names need the governed entity/person-risk seam before reader representation.
      actors: [{ kind: 'ACTOR_UNIDENTIFIED' }],
      geography,
      temporal: {
        eventStartedAt: start,
        eventEndedAt: end,
        ingestedAt: context.ingestedAt,
        temporalProvenance: start === end ? 'EVENT_DATED_BY_SOURCE' : 'EVENT_DATE_RANGE_BY_SOURCE',
      },
      severity: SEVERITY_UNAVAILABLE_NO_RULE,
      sourceReference,
      acquisition: {
        snapshotRetrievalId: context.retrievalId,
        snapshotAdmissibility: 'ADMITTED',
        runId: context.runId,
      },
      revision: {
        revisionOrdinal: 0,
        supersedesRevisionOrdinal: null,
        upstreamVersion: profile.datasetVersion,
        recordedAt: context.ingestedAt,
      },
    };
  });
}
