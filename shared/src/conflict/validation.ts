import {
  CONFLICT_UPSTREAM_AUTHORITIES,
  CONFLICT_EVENT_TYPES,
  CONFLICT_EVENT_OWNERS,
  CONFLICT_ACTOR_KINDS,
  CONFLICT_TEMPORAL_PROVENANCES,
  CONFLICT_REVISION_KINDS,
  CONFLICT_SEVERITIES,
  SEVERITY_UNAVAILABLE_REASONS,
  SPATIAL_PRECISION_LADDER,
  LOCATION_PROVENANCES,
  SOURCE_GEOMETRY_KINDS,
  GEOMETRY_DENOTATIONS,
  GEOMETRY_ORIGINS,
  PARTITION_UNIT_LEVELS,
  GEOMETRY_CRS,
  conflictEventKey,
  assertCoordinatesAreClosed,
  assertPrecisionNotInferredFromGeometry,
  type ConflictObservation,
} from '../index';

/** No row values in errors: corrupt evidence must not become a partial API response. */
export class InvalidRetainedConflictObservation extends Error {
  constructor() {
    super('INVALID_RETAINED_CONFLICT_OBSERVATION');
  }
}
function requireValid(condition: unknown): asserts condition {
  if (!condition) throw new InvalidRetainedConflictObservation();
}
function obj(value: unknown, required: string[], optional: string[] = []): Record<string, unknown> {
  requireValid(value !== null && typeof value === 'object' && !Array.isArray(value));
  const r = value as Record<string, unknown>;
  requireValid(
    required.every((k) => Object.prototype.hasOwnProperty.call(r, k)) &&
      Object.keys(r).every((k) => [...required, ...optional].includes(k)),
  );
  return r;
}
function text(value: unknown): asserts value is string {
  requireValid(typeof value === 'string' && value.trim().length > 0);
}
function member(value: unknown, choices: readonly string[]) {
  requireValid(typeof value === 'string' && choices.includes(value));
}
function optionalText(r: Record<string, unknown>, names: string[]) {
  for (const name of names) if (Object.prototype.hasOwnProperty.call(r, name)) text(r[name]);
}
function iso(value: unknown): number {
  text(value);
  requireValid(
    /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value),
  );
  const day = value.slice(0, 10);
  const calendar = new Date(`${day}T00:00:00Z`);
  requireValid(Number.isFinite(calendar.getTime()) && calendar.toISOString().slice(0, 10) === day);
  const time = Date.parse(value);
  requireValid(Number.isFinite(time));
  return time;
}

function positions(value: unknown, depth: number, minimum = 1): void {
  requireValid(Array.isArray(value));
  if (depth === 0) {
    requireValid(
      value.length >= 2 &&
        value.every((n) => typeof n === 'number' && Number.isFinite(n)) &&
        Math.abs(value[0]) <= 180 &&
        Math.abs(value[1]) <= 90,
    );
  } else {
    requireValid(value.length >= minimum);
    for (const item of value) positions(item, depth - 1);
  }
}

/** Runtime boundary, using the shared vocabularies and guards; no fallback/default data. */
export function validateConflictObservation(value: unknown): ConflictObservation {
  try {
    const o = obj(value, [
      'observationKey',
      'identity',
      'eventType',
      'owner',
      'actors',
      'geography',
      'temporal',
      'severity',
      'sourceReference',
      'acquisition',
      'revision',
    ]);
    const identity = obj(o.identity, ['authority', 'upstreamEventId']);
    member(identity.authority, CONFLICT_UPSTREAM_AUTHORITIES);
    text(identity.upstreamEventId);
    requireValid(
      o.observationKey === conflictEventKey(identity as unknown as ConflictObservation['identity']),
    );
    member(o.eventType, CONFLICT_EVENT_TYPES);
    member(o.owner, CONFLICT_EVENT_OWNERS);
    requireValid(Array.isArray(o.actors));
    for (const actor of o.actors) {
      const a = obj(actor, ['kind'], ['upstreamName', 'entityKey']);
      member(a.kind, CONFLICT_ACTOR_KINDS);
      optionalText(a, ['upstreamName', 'entityKey']);
    }
    const g = obj(
      o.geography,
      ['geometryKind', 'crs', 'denotation', 'origin', 'precision', 'locationProvenance'],
      ['coordinates', 'partitionUnitLevel', 'countryIso3'],
    );
    member(g.geometryKind, SOURCE_GEOMETRY_KINDS);
    member(g.denotation, GEOMETRY_DENOTATIONS);
    member(g.origin, GEOMETRY_ORIGINS);
    member(g.precision, SPATIAL_PRECISION_LADDER);
    member(g.locationProvenance, LOCATION_PROVENANCES);
    requireValid(g.crs === GEOMETRY_CRS);
    if (g.partitionUnitLevel !== undefined) member(g.partitionUnitLevel, PARTITION_UNIT_LEVELS);
    if (Object.prototype.hasOwnProperty.call(g, 'countryIso3'))
      requireValid(typeof g.countryIso3 === 'string' && /^[A-Z]{3}$/.test(g.countryIso3));
    if (g.geometryKind === 'NONE') requireValid(g.coordinates === undefined);
    else {
      assertCoordinatesAreClosed(
        g.geometryKind as ConflictObservation['geography']['geometryKind'],
        g.coordinates,
      );
      const depth = {
        POINT: 0,
        MULTIPOINT: 1,
        LINE: 1,
        MULTILINE: 2,
        POLYGON: 2,
        MULTIPOLYGON: 3,
        BBOX: 2,
      }[g.geometryKind as string];
      requireValid(depth !== undefined);
      positions(
        (g.coordinates as { coordinates: unknown }).coordinates,
        depth,
        g.geometryKind === 'LINE' ? 2 : 1,
      );
    }
    requireValid(g.denotation !== 'SOURCE_REPORTED_CENTROID' || g.origin === 'SOURCE_NATIVE');
    requireValid(g.denotation !== 'DERIVED_REPRESENTATIVE_POINT' || g.origin === 'DERIVED');
    assertPrecisionNotInferredFromGeometry(g as unknown as ConflictObservation['geography']);
    const t = obj(
      o.temporal,
      ['eventStartedAt', 'ingestedAt', 'temporalProvenance'],
      ['eventEndedAt', 'publisherRecordedAt'],
    );
    const start = iso(t.eventStartedAt);
    iso(t.ingestedAt);
    if (Object.prototype.hasOwnProperty.call(t, 'eventEndedAt'))
      requireValid(iso(t.eventEndedAt) >= start);
    if (Object.prototype.hasOwnProperty.call(t, 'publisherRecordedAt')) iso(t.publisherRecordedAt);
    member(t.temporalProvenance, CONFLICT_TEMPORAL_PROVENANCES);
    if (t.temporalProvenance === 'EVENT_DATE_RANGE_BY_SOURCE')
      requireValid(Object.prototype.hasOwnProperty.call(t, 'eventEndedAt'));
    const s = obj(
      o.severity,
      ['kind'],
      ['value', 'publisherAuthority', 'publisherScaleRef', 'reason'],
    );
    if (s.kind === 'UNAVAILABLE') {
      obj(s, ['kind', 'reason']);
      member(s.reason, SEVERITY_UNAVAILABLE_REASONS);
    } else {
      // GNAI_DERIVED has no accepted rule and is intentionally unreachable.
      obj(s, ['kind', 'value', 'publisherAuthority', 'publisherScaleRef']);
      requireValid(s.kind === 'PUBLISHER_STATED');
      member(s.value, CONFLICT_SEVERITIES);
      member(s.publisherAuthority, CONFLICT_UPSTREAM_AUTHORITIES);
      text(s.publisherScaleRef);
    }
    const source = obj(o.sourceReference, [], ['citation', 'reportingOffice', 'sourceUrl']);
    optionalText(source, ['citation', 'reportingOffice', 'sourceUrl']);
    if (source.sourceUrl !== undefined)
      requireValid(['https:', 'http:'].includes(new URL(source.sourceUrl as string).protocol));
    const a = obj(o.acquisition, ['snapshotRetrievalId', 'snapshotAdmissibility', 'runId']);
    text(a.runId);
    if (a.snapshotRetrievalId === null) requireValid(a.snapshotAdmissibility === null);
    else {
      text(a.snapshotRetrievalId);
      requireValid(a.snapshotAdmissibility === 'ADMITTED');
    }
    const r = obj(
      o.revision,
      ['revisionOrdinal', 'supersedesRevisionOrdinal', 'recordedAt'],
      ['revisionKind', 'upstreamVersion'],
    );
    requireValid(Number.isSafeInteger(r.revisionOrdinal) && (r.revisionOrdinal as number) >= 0);
    if (r.revisionOrdinal === 0)
      requireValid(
        r.supersedesRevisionOrdinal === null &&
          !Object.prototype.hasOwnProperty.call(r, 'revisionKind'),
      );
    else {
      requireValid(r.supersedesRevisionOrdinal === (r.revisionOrdinal as number) - 1);
      member(r.revisionKind, CONFLICT_REVISION_KINDS);
    }
    optionalText(r, ['upstreamVersion']);
    iso(r.recordedAt);
    return value as ConflictObservation;
  } catch {
    throw new InvalidRetainedConflictObservation();
  }
}
