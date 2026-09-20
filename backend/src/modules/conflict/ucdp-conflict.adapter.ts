import {
  GEOMETRY_CRS,
  SEVERITY_UNAVAILABLE_NO_RULE,
  assertPrecisionNotInferredFromGeometry,
  assertSchemaConfirmedByCapture,
  conflictEventKey,
  findCountryByIso3,
  resolveConflictEventOwner,
  resolveCountryByAnyIdentifier,
  type ConflictActorRef,
  type ConflictEventType,
  type ConflictMapEvent,
  type ConflictObservation,
  type ConflictTemporal,
  type PartitionUnitLevel,
  type SpatialPrecision,
  type UcdpGedCsvDecoded,
} from '@globalnews-ai/shared';

const DATASET_VERSION = '26.0.7';

export interface UcdpNormalizationContext {
  readonly snapshotRetrievalId: string;
  readonly retrievedAt: string;
}

export interface NormalizedUcdpEvent {
  readonly observation: ConflictObservation;
  readonly mapEvent: ConflictMapEvent;
}

/**
 * UCDP Candidate GED -> canonical Conflict observation.
 *
 * This adapter maps only facts the captured schema actually carries. It does NOT derive
 * GlobalNews severity, situation identity, escalation, fronts, displacement or policy
 * interpretation. Those remain different producers.
 */
export function normalizeUcdpCandidateGed(
  decoded: UcdpGedCsvDecoded,
  context: UcdpNormalizationContext,
): readonly NormalizedUcdpEvent[] {
  assertSchemaConfirmedByCapture('UCDP_GED');

  const out: NormalizedUcdpEvent[] = [];

  for (const row of decoded.rows) {
    const event = normalizeRow(row, context);
    if (event !== null) out.push(event);
  }

  return out;
}

function normalizeRow(
  row: UcdpGedCsvDecoded['rows'][number],
  context: UcdpNormalizationContext,
): NormalizedUcdpEvent | null {
  const upstreamEventId = row.id.trim();
  const dateStart = isoDate(row.date_start);
  const latitude = finiteNumber(row.latitude);
  const longitude = finiteNumber(row.longitude);
  const wherePrec = integer(row.where_prec);

  /* These are the minimum facts needed for an event that can be placed and dated. */
  if (
    upstreamEventId.length === 0 ||
    dateStart === null ||
    latitude === null ||
    longitude === null ||
    wherePrec === null
  ) {
    return null;
  }

  const identity = { authority: 'UCDP_GED' as const, upstreamEventId };
  const observationKey = conflictEventKey(identity);
  const geography = geographyFor(row.country, latitude, longitude, wherePrec);

  try {
    assertPrecisionNotInferredFromGeometry(geography);
  } catch {
    return null;
  }

  const temporal = temporalFor(row.date_start, row.date_end, context.retrievedAt);
  if (temporal === null) return null;

  const observation: ConflictObservation = {
    observationKey,
    identity,
    eventType: eventTypeFor(row.type_of_violence),
    /*
      Candidate GED is an organised-violence event dataset. That satisfies both accepted
      ownership thresholds for events that survive this adapter: violence occurred and
      an organised armed actor participates. This is domain ownership, not severity.
    */
    owner: resolveConflictEventOwner({
      violenceOrProtectivePosture: true,
      organisedArmedActorParticipates: true,
    }),
    actors: actorsFor(row.type_of_violence, row.side_a, row.side_b),
    geography,
    temporal,
    severity: SEVERITY_UNAVAILABLE_NO_RULE,
    sourceReference: {
      ...(row.source_article.trim().length > 0 ? { citation: row.source_article } : {}),
      ...(row.source_office.trim().length > 0 ? { reportingOffice: row.source_office } : {}),
    },
    acquisition: {
      snapshotRetrievalId: context.snapshotRetrievalId,
      snapshotAdmissibility: 'ADMITTED',
      runId: context.snapshotRetrievalId,
    },
    revision: {
      revisionOrdinal: 0,
      supersedesRevisionOrdinal: null,
      upstreamVersion: DATASET_VERSION,
      recordedAt: context.retrievedAt,
    },
  };

  return {
    observation,
    mapEvent: {
      observationKey,
      upstreamEventId,
      eventType: observation.eventType,
      actors: observation.actors,
      ...(observation.geography.countryIso3 ? { countryIso3: observation.geography.countryIso3 } : {}),
      latitude,
      longitude,
      precision: observation.geography.precision,
      locationProvenance: observation.geography.locationProvenance,
      denotation: observation.geography.denotation,
      eventStartedAt: temporal.eventStartedAt,
      ...(temporal.eventEndedAt ? { eventEndedAt: temporal.eventEndedAt } : {}),
      severity: observation.severity,
      sourceReference: observation.sourceReference,
      sourceCount: nonNegativeInteger(row.number_of_sources),
      revision: observation.revision,
    },
  };
}

function eventTypeFor(raw: string): ConflictEventType {
  switch (integer(raw)) {
    case 1:
    case 2:
      return 'ARMED_CLASH';
    case 3:
      return 'VIOLENCE_AGAINST_CIVILIANS';
    default:
      return 'EVENT_TYPE_NOT_CLASSIFIED';
  }
}

function actorsFor(typeRaw: string, sideA: string, sideB: string): readonly ConflictActorRef[] {
  const values: string[] = [];

  if (sideA.trim().length > 0) values.push(sideA.trim());

  /*
    In UCDP one-sided violence (type 3), side B is the civilian target class rather than
    an organised armed participant. The canonical actor vocabulary is institutions /
    organised groups only, so that target is not forced into an actor slot.
  */
  if (integer(typeRaw) !== 3 && sideB.trim().length > 0) values.push(sideB.trim());

  return values.map((upstreamName) => ({ kind: 'ACTOR_UNIDENTIFIED' as const, upstreamName }));
}

function geographyFor(
  countryName: string,
  latitude: number,
  longitude: number,
  wherePrec: number,
): ConflictObservation['geography'] {
  const precision = precisionFor(wherePrec);
  const partitionUnitLevel = partitionFor(wherePrec);
  const country = resolveCountryByAnyIdentifier(countryName);

  return {
    geometryKind: 'POINT',
    coordinates: { type: 'Point', coordinates: [longitude, latitude] },
    crs: GEOMETRY_CRS,
    denotation: wherePrec === 1 || wherePrec === 2 || wherePrec === 7
      ? 'EVENT_LOCATION'
      : 'SOURCE_REPORTED_CENTROID',
    origin: 'SOURCE_NATIVE',
    precision,
    locationProvenance: 'STATED',
    ...(partitionUnitLevel ? { partitionUnitLevel } : {}),
    ...(country ? { countryIso3: country.iso3 } : {}),
  };
}

function precisionFor(wherePrec: number): SpatialPrecision {
  switch (wherePrec) {
    case 1: return 'EXACT';
    case 3: return 'DISTRICT';
    case 4: return 'PROVINCE';
    case 6: return 'COUNTRY';
    /*
      UCDP where_prec 2 is within ~25 km, 5 is a broader representative point and 7
      represents international waters/airspace. None maps honestly onto the closed
      GlobalNews precision ladder, so the canonical answer is UNKNOWN.
    */
    case 2:
    case 5:
    case 7:
    default:
      return 'UNKNOWN';
  }
}

function partitionFor(wherePrec: number): PartitionUnitLevel | undefined {
  switch (wherePrec) {
    case 3: return 'DISTRICT';
    case 4: return 'PROVINCE';
    case 6: return 'COUNTRY';
    default: return undefined;
  }
}

function temporalFor(startRaw: string, endRaw: string, ingestedAt: string): ConflictTemporal | null {
  const start = isoDate(startRaw);
  if (start === null) return null;
  const end = isoDate(endRaw);

  return {
    eventStartedAt: start,
    ...(end !== null && end !== start ? { eventEndedAt: end } : {}),
    ingestedAt,
    temporalProvenance:
      end !== null && end !== start ? 'EVENT_DATE_RANGE_BY_SOURCE' : 'EVENT_DATED_BY_SOURCE',
  };
}

function isoDate(raw: string): string | null {
  const trimmed = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (iso !== null) return trimmed;

  /* Refuse ambiguous slash-separated dates rather than guessing day/month order. */
  return null;
}

function finiteNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

function integer(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^-?\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isInteger(value) ? value : null;
}

function nonNegativeInteger(raw: string): number | null {
  const value = integer(raw);
  return value !== null && value >= 0 ? value : null;
}

export function iso3ForUcdpCountry(countryName: string): string | null {
  return resolveCountryByAnyIdentifier(countryName)?.iso3 ?? null;
}

export function knownConflictCountry(iso3: string): boolean {
  return findCountryByIso3(iso3) !== undefined;
}
