import { createHash } from 'node:crypto';
import {
  isEnergyObservation,
  parseStrictJson,
  type EnergyObservation,
} from '@globalnews-ai/shared';

export const EUROSTAT_ENERGY_ALPHA_R1_ENDPOINT_ID = 'EUROSTAT_NRG_CB_PEM_ALPHA_R1';
export const EUROSTAT_ENERGY_ALPHA_R1_REQUEST_PATH =
  'api/dissemination/statistics/1.0/data/nrg_cb_pem';
export const EUROSTAT_ENERGY_ALPHA_R1_PARSER_ID = 'eurostat-energy-nrg-cb-pem';
export const EUROSTAT_ENERGY_ALPHA_R1_PARSER_VERSION = '1';
export const EUROSTAT_ENERGY_ROW_PARSER_VERSION = 'energy-eurostat-pem-v1';

export const EUROSTAT_ENERGY_ALPHA_R1_PARAMETERS = Object.freeze([
  { key: 'format', value: 'JSON' },
  { key: 'lang', value: 'EN' },
  { key: 'geo', value: 'ES' },
  { key: 'siec', value: 'TOTAL' },
  { key: 'unit', value: 'GWH' },
  { key: 'time', value: '2026-07' },
]);

export class InvalidEurostatEnergyCapture extends Error {}

function refuse(reason: string): never {
  throw new InvalidEurostatEnergyCapture(reason);
}

function object(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) refuse('EXPECTED_OBJECT');
  return value as Record<string, any>;
}

function text(value: unknown, reason: string): string {
  if (typeof value !== 'string' || !value.trim()) refuse(reason);
  return value;
}

function exactParameters(value: unknown): void {
  if (!Array.isArray(value)) refuse('REQUEST_PARAMETERS_MISSING');
  const actual = new Map<string, string>();
  for (const raw of value) {
    const entry = object(raw);
    if (
      typeof entry.key !== 'string' ||
      typeof entry.value !== 'string' ||
      actual.has(entry.key)
    ) {
      refuse('REQUEST_PARAMETERS_INVALID');
    }
    actual.set(entry.key, entry.value);
  }
  if (actual.size !== EUROSTAT_ENERGY_ALPHA_R1_PARAMETERS.length) {
    refuse('REQUEST_PARAMETERS_DRIFT');
  }
  for (const expected of EUROSTAT_ENERGY_ALPHA_R1_PARAMETERS) {
    if (actual.get(expected.key) !== expected.value) {
      refuse(`REQUEST_PARAMETERS_DRIFT:${expected.key}`);
    }
  }
}

function singletonCode(
  dimension: any,
  expected: string,
  reason: string,
): { code: string; label: string } {
  const index = dimension?.category?.index;
  const labels = dimension?.category?.label;
  if (
    !index ||
    typeof index !== 'object' ||
    Object.keys(index).length !== 1 ||
    index[expected] !== 0 ||
    !labels ||
    typeof labels[expected] !== 'string'
  ) {
    refuse(reason);
  }
  return { code: expected, label: labels[expected] };
}

function releaseStatus(flag: unknown): EnergyObservation['releaseStatus'] {
  if (flag === 'p') return 'PRELIMINARY';
  if (flag === 'r') return 'REVISED';
  refuse('RELEASE_STATUS_UNSUPPORTED');
}

export function normalizeEurostatEnergyCapture(capture: any): EnergyObservation {
  const c = capture;
  if (
    c.providerId !== 'EUROSTAT' ||
    c.endpointId !== EUROSTAT_ENERGY_ALPHA_R1_ENDPOINT_ID ||
    c.requestPath !== EUROSTAT_ENERGY_ALPHA_R1_REQUEST_PATH ||
    c.admissibility !== 'ADMITTED' ||
    c.completeness !== 'COMPLETE' ||
    c.refusalKey !== null ||
    c.httpStatus !== 200 ||
    c.parserId !== EUROSTAT_ENERGY_ALPHA_R1_PARSER_ID ||
    c.parserVersion !== EUROSTAT_ENERGY_ALPHA_R1_PARSER_VERSION ||
    c.rightsGrade !== 'E-5' ||
    !c.rightsInstrumentRef?.trim() ||
    !c.payloadRetentionPermitted ||
    c.payload?.storageState !== 'RETAINED' ||
    !c.payload.bytes ||
    !c.contentAddress ||
    c.payload.contentAddress !== c.contentAddress
  ) {
    refuse('CAPTURE_NOT_ADMITTED');
  }

  exactParameters(c.parameters);

  const mediaType = c.mediaType.split(';')[0].trim().toLowerCase();
  if (mediaType !== 'application/json') refuse('MEDIA_TYPE');

  const bytes: Uint8Array = c.payload.bytes;
  if (
    bytes.length === 0 ||
    bytes.length > 4 * 1024 * 1024 ||
    bytes.length !== c.byteLength ||
    bytes.length !== c.payload.byteLength ||
    createHash('sha256').update(bytes).digest('hex') !== c.contentAddress
  ) {
    refuse('CAPTURE_DIGEST_OR_LENGTH');
  }

  const parsed = parseStrictJson(bytes);
  if (!parsed.ok) refuse('JSON_REFUSED');
  const root = object(parsed.value);

  if (
    root.class !== 'dataset' ||
    root.version !== '2.0' ||
    root.source !== 'ESTAT' ||
    root.label !== 'Net electricity generation by type of fuel - monthly data' ||
    JSON.stringify(root.id) !== JSON.stringify(['freq', 'siec', 'unit', 'geo', 'time']) ||
    JSON.stringify(root.size) !== JSON.stringify([1, 1, 1, 1, 1])
  ) {
    refuse('SCHEMA_DRIFT');
  }

  const dimension = object(root.dimension);
  singletonCode(dimension.freq, 'M', 'FREQ_DRIFT');
  const siec = singletonCode(dimension.siec, 'TOTAL', 'SIEC_DRIFT');
  const unit = singletonCode(dimension.unit, 'GWH', 'UNIT_DRIFT');
  const geo = singletonCode(dimension.geo, 'ES', 'GEO_DRIFT');
  const period = singletonCode(dimension.time, '2026-07', 'TIME_DRIFT');

  const values = object(root.value);
  const statuses = object(root.status);
  if (
    Object.keys(values).length !== 1 ||
    typeof values['0'] !== 'number' ||
    !Number.isFinite(values['0']) ||
    Object.keys(statuses).length !== 1
  ) {
    refuse('OBSERVATION_CELL_INVALID');
  }

  const updated = text(root.updated, 'UPDATED_MISSING');
  if (!Number.isFinite(Date.parse(updated))) refuse('UPDATED_INVALID');
  if (!Number.isFinite(c.retrievedAt?.getTime?.())) refuse('RETRIEVAL_TIME_INVALID');
  if (Date.parse(updated) > c.retrievedAt.getTime()) refuse('UPDATED_AFTER_RETRIEVAL');

  const observation: EnergyObservation = {
    observationKey: 'energy:1:EUROSTAT:nrg_cb_pem:ES:TOTAL:GWH:2026-07',
    subjectId: 'energy:supply:ES:net-electricity-generation',
    subjectName: `${geo.label} · ${siec.label} · Net electricity generation`,
    subjectType: 'SUPPLY_SITUATION',
    geographyId: geo.code,
    spatialPrecision: 'COUNTRY',
    metric: 'GENERATION',
    period: period.code,
    value: values['0'],
    unit: unit.code,
    releaseStatus: releaseStatus(statuses['0']),
    publisherChangedAt: updated,
    provenance: {
      sourceType: 'OFFICIAL_SOURCE',
      providerId: 'EUROSTAT',
      institution: 'Eurostat',
      evidenceRole: 'PRIMARY_RECORD',
      retrievedAt: c.retrievedAt.toISOString(),
    },
    retrievalId: c.retrievalId,
    freshnessBasis: 'RETAINED_ONLY',
  };

  if (!isEnergyObservation(observation)) refuse('NORMALIZED_OBSERVATION_INVALID');
  return observation;
}
