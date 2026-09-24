import {
  assertPrecisionNotInferredFromGeometry,
  conflictEventKey,
  GEOMETRY_CRS,
  resolveConflictEventOwner,
  resolveCountryByAnyIdentifier,
  SEVERITY_UNAVAILABLE_NO_RULE,
  type ConflictObservation,
  type ConflictRetainedEvidenceDetail,
  type SpatialPrecision,
} from '@globalnews-ai/shared';

export const MAX_UCDP_CANDIDATE_CSV_BYTES = 2_000_000;
export const MAX_UCDP_CANDIDATE_CSV_RECORDS = 3_000;

export interface ReviewedUcdpCandidateCsvCapture {
  readonly sha256: string;
  readonly datasetVersion: string;
  readonly sourceUrl: string;
  readonly schema: 'ucdp-candidate-csv-v1';
  /** Optional governed output scope. Source bytes remain whole and retained. */
  readonly countryAllowlistIso3?: readonly string[];
}

const HEADERS = [
  'id','relid','year','active_year','code_status','type_of_violence',
  'conflict_dset_id','conflict_new_id','conflict_name','dyad_dset_id','dyad_new_id','dyad_name',
  'side_a_dset_id','side_a_new_id','side_a','side_b_dset_id','side_b_new_id','side_b',
  'number_of_sources','source_article','source_office','source_date','source_headline','source_original',
  'where_prec','where_coordinates','where_description','adm_1','adm_2','latitude','longitude','geom_wkt',
  'priogrid_gid','country','country_id','region','event_clarity','date_prec','date_start','date_end',
  'deaths_a','deaths_b','deaths_civilians','deaths_unknown','best','high','low','gwnoa','gwnob',
] as const;

const PRECISIONS: Readonly<Record<number, SpatialPrecision>> = {
  1: 'EXACT',
  2: 'CITY',
  3: 'DISTRICT',
  4: 'PROVINCE',
  5: 'COUNTRY',
  6: 'UNKNOWN',
  7: 'UNKNOWN',
};

export class UcdpCandidateCsvAdmissionRefused extends Error {}

function refuse(reason: string): never {
  throw new UcdpCandidateCsvAdmissionRefused(reason);
}

function parseCsv(bytes: Uint8Array): string[][] {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_UCDP_CANDIDATE_CSV_BYTES)
    refuse('CAPTURE_SIZE_REFUSED');

  let input: string;
  try {
    input = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    refuse('MALFORMED_CAPTURE');
  }

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let closedQuote = false;

  const finishField = () => {
    row.push(field);
    field = '';
    closedQuote = false;
  };
  const finishRow = () => {
    finishField();
    rows.push(row);
    row = [];
    if (rows.length > MAX_UCDP_CANDIDATE_CSV_RECORDS + 1)
      refuse('UNSUPPORTED_SCHEMA_OR_RECORD_BOUND');
  };

  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closedQuote = true;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (closedQuote && c !== ',' && c !== '\r' && c !== '\n')
      refuse('MALFORMED_CAPTURE');

    if (c === '"') {
      if (field.length !== 0) refuse('MALFORMED_CAPTURE');
      quoted = true;
    } else if (c === ',') {
      finishField();
    } else if (c === '\r') {
      if (input[i + 1] === '\n') i++;
      finishRow();
    } else if (c === '\n') {
      finishRow();
    } else {
      field += c;
    }
  }

  if (quoted) refuse('MALFORMED_CAPTURE');
  if (field.length > 0 || row.length > 0) finishRow();

  while (rows.length > 0 && rows[rows.length - 1].every((v) => v === '')) rows.pop();
  return rows;
}

function rowObject(header: readonly string[], row: readonly string[]): Record<string, string> {
  if (row.length !== header.length) refuse('SCHEMA_ROW_WIDTH_MISMATCH');
  return Object.fromEntries(header.map((key, index) => [key, row[index]]));
}

function requiredText(value: string | undefined, field: string, max = 100_000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    refuse(`SCHEMA_FIELD_INVALID:${field}`);
  return value;
}

function integer(value: string | undefined, field: string): number {
  if (typeof value !== 'string' || !/^-?\d+$/.test(value)) refuse(`SCHEMA_FIELD_INVALID:${field}`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) refuse(`SCHEMA_FIELD_INVALID:${field}`);
  return parsed;
}

function finiteNumber(value: string | undefined, field: string): number {
  if (typeof value !== 'string' || !/^-?(?:\d+\.?\d*|\.\d+)$/.test(value))
    refuse(`SCHEMA_FIELD_INVALID:${field}`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) refuse(`SCHEMA_FIELD_INVALID:${field}`);
  return parsed;
}

function eventDate(value: string | undefined, field: string): string {
  const raw = requiredText(value, field, 32);
  const match = /^(\d{4}-\d{2}-\d{2})(?: 00:00:00\.000)?$/.exec(raw);
  if (!match) refuse('DATE_UNUSABLE');
  const day = match[1];
  const calendar = new Date(`${day}T00:00:00.000Z`);
  if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== day)
    refuse('DATE_UNUSABLE');
  return day;
}

function optionalSource(value: string | undefined): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function normalizeCountryJoin(sourceCountryName: string): {
  sourceCountryName: string;
  countryIso3?: string;
  countryIso3Basis?: 'SOURCE_COUNTRY_NAME_NORMALIZED';
} {
  // UCDP sometimes appends a historical label in parentheses (e.g. "DR Congo (Zaire)").
  // The source name is preserved verbatim and only the join candidate drops that suffix.
  const joinCandidate = sourceCountryName.replace(/\s+\([^()]+\)\s*$/, '').trim();
  const country = resolveCountryByAnyIdentifier(joinCandidate);
  return country
    ? {
        sourceCountryName,
        countryIso3: country.iso3,
        countryIso3Basis: 'SOURCE_COUNTRY_NAME_NORMALIZED',
      }
    : { sourceCountryName };
}

export function normalizeUcdpCandidateCsv(
  bytes: Uint8Array,
  profile: ReviewedUcdpCandidateCsvCapture,
  context: { retrievalId: string; runId: string; ingestedAt: string },
): readonly ConflictObservation[] {
  if (profile.schema !== 'ucdp-candidate-csv-v1') refuse('UNSUPPORTED_SCHEMA');
  requiredText(profile.datasetVersion, 'datasetVersion', 128);
  const sourceUrl = new URL(requiredText(profile.sourceUrl, 'sourceUrl', 2048));
  if (sourceUrl.protocol !== 'https:' || sourceUrl.hostname !== 'ucdp.uu.se')
    refuse('UNSUPPORTED_SOURCE');
  requiredText(context.retrievalId, 'retrievalId', 256);
  requiredText(context.runId, 'runId', 256);
  if (!Number.isFinite(Date.parse(context.ingestedAt))) refuse('DATE_UNUSABLE');

  const rows = parseCsv(bytes);
  if (rows.length < 2) refuse('UNSUPPORTED_SCHEMA_OR_RECORD_BOUND');
  const header = rows[0];
  if (
    header.length !== HEADERS.length ||
    HEADERS.some((name, index) => header[index] !== name)
  ) {
    refuse('SCHEMA_NOT_CONFIRMED_BY_CAPTURE');
  }

  const seen = new Set<string>();
  const observations: ConflictObservation[] = rows.slice(1).map(
    (values): ConflictObservation => {
    const r = rowObject(header, values);
    const rawId = requiredText(r.id, 'id', 128);
    if (!/^\d+$/.test(rawId)) refuse('EVENT_IDENTITY_DEPENDENCY');
    const identity = { authority: 'UCDP_GED' as const, upstreamEventId: rawId };
    const observationKey = conflictEventKey(identity);
    if (seen.has(observationKey)) refuse('DUPLICATE_EVENT_IN_CAPTURE');
    seen.add(observationKey);

    const violenceType = integer(r.type_of_violence, 'type_of_violence');
    const sideA = requiredText(r.side_a, 'side_a', 4096);
    const owner = resolveConflictEventOwner({
      violenceOrProtectivePosture: [1, 2, 3].includes(violenceType) ? true : undefined,
      organisedArmedActorParticipates:
        [1, 2, 3].includes(violenceType) && sideA.trim().length > 0 ? true : undefined,
    });
    if (owner !== 'CONFLICT') refuse('OWNERSHIP_UNRESOLVED');
    if (r.side_b !== '') requiredText(r.side_b, 'side_b', 4096);

    const start = eventDate(r.date_start, 'date_start');
    const end = eventDate(r.date_end, 'date_end');
    if (end < start) refuse('DATE_UNUSABLE');
    const datePrecision = integer(r.date_prec, 'date_prec');
    if (datePrecision < 1 || datePrecision > 5) refuse('SCHEMA_FIELD_INVALID:date_prec');

    const precisionCode = integer(r.where_prec, 'where_prec');
    const precision = PRECISIONS[precisionCode];
    if (!precision) refuse('GEOGRAPHY_UNUSABLE');
    const latitude = finiteNumber(r.latitude, 'latitude');
    const longitude = finiteNumber(r.longitude, 'longitude');
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) refuse('GEOGRAPHY_UNUSABLE');

    const country = normalizeCountryJoin(requiredText(r.country, 'country', 256));
    const geography: ConflictObservation['geography'] = {
      geometryKind: 'POINT',
      coordinates: { type: 'Point', coordinates: [longitude, latitude] },
      crs: GEOMETRY_CRS,
      denotation: precisionCode >= 4 ? 'SOURCE_REPORTED_CENTROID' : 'EVENT_LOCATION',
      origin: 'SOURCE_NATIVE',
      precision,
      locationProvenance: 'STATED',
      ...country,
    };
    assertPrecisionNotInferredFromGeometry(geography);

    const citation = optionalSource(r.source_article);
    const office = optionalSource(r.source_office);
    const sourceReference: ConflictObservation['sourceReference'] = {
      ...(citation ? { citation } : {}),
      ...(office ? { reportingOffice: office } : {}),
    };

    return {
      observationKey,
      identity,
      owner,
      eventType: 'EVENT_TYPE_NOT_CLASSIFIED',
      actors: [{ kind: 'ACTOR_UNIDENTIFIED' }],
      geography,
      temporal: {
        eventStartedAt: start,
        eventEndedAt: end,
        ingestedAt: context.ingestedAt,
        temporalProvenance:
          start === end ? 'EVENT_DATED_BY_SOURCE' : 'EVENT_DATE_RANGE_BY_SOURCE',
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
    },
  );

  if (!profile.countryAllowlistIso3) return observations;
  const allow = new Set(profile.countryAllowlistIso3);
  return observations.filter(
    (observation) =>
      observation.geography.countryIso3 !== undefined &&
      allow.has(observation.geography.countryIso3),
  );
}


export function extractUcdpCandidateEvidenceDetail(
  bytes: Uint8Array,
  args: {
    observationKey: string;
    upstreamEventId: string;
    retrievalId: string;
    contentAddress: string;
  },
): ConflictRetainedEvidenceDetail | null {
  requiredText(args.observationKey, 'observationKey', 512);
  requiredText(args.upstreamEventId, 'upstreamEventId', 128);
  requiredText(args.retrievalId, 'retrievalId', 256);
  if (!/^[0-9a-f]{64}$/.test(args.contentAddress)) refuse('CONTENT_ADDRESS_INVALID');

  const rows = parseCsv(bytes);
  if (rows.length < 2) refuse('UNSUPPORTED_SCHEMA_OR_RECORD_BOUND');
  const header = rows[0];
  if (
    header.length !== HEADERS.length ||
    HEADERS.some((name, index) => header[index] !== name)
  ) {
    refuse('SCHEMA_NOT_CONFIRMED_BY_CAPTURE');
  }

  for (const values of rows.slice(1)) {
    const row = rowObject(header, values);
    if (row.id !== args.upstreamEventId) continue;

    const partyA = requiredText(row.side_a, 'side_a', 4096);
    const partyB = optionalSource(row.side_b);
    const count =
      row.number_of_sources && /^\d+$/.test(row.number_of_sources)
        ? Number(row.number_of_sources)
        : undefined;

    return {
      observationKey: args.observationKey,
      authority: 'UCDP_GED',
      upstreamEventId: args.upstreamEventId,
      sourceParties: [...new Set([partyA, ...(partyB ? [partyB] : [])])],
      ...(optionalSource(row.where_description)
        ? { whereDescription: row.where_description }
        : {}),
      ...(optionalSource(row.source_headline)
        ? { sourceHeadline: row.source_headline }
        : {}),
      ...(optionalSource(row.source_original)
        ? { sourceOriginal: row.source_original }
        : {}),
      ...(optionalSource(row.conflict_name)
        ? { conflictName: row.conflict_name }
        : {}),
      ...(optionalSource(row.dyad_name) ? { dyadName: row.dyad_name } : {}),
      ...(count !== undefined ? { numberOfSources: count } : {}),
      ...(optionalSource(row.country) ? { sourceCountryName: row.country } : {}),
      snapshotRetrievalId: args.retrievalId,
      snapshotContentAddress: args.contentAddress,
    };
  }

  return null;
}

export const UCDP_CANDIDATE_CSV_HEADERS = HEADERS;
