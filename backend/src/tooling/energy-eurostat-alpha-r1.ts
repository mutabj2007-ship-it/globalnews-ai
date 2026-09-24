import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { assertProviderRightsPermitRunning } from '../modules/market-ingest/market-acquisition-declarations';
import {
  EUROSTAT_ENERGY_ALPHA_R1_ENDPOINT_ID,
  EUROSTAT_ENERGY_ALPHA_R1_PARAMETERS,
  EUROSTAT_ENERGY_ALPHA_R1_PARSER_ID,
  EUROSTAT_ENERGY_ALPHA_R1_PARSER_VERSION,
  EUROSTAT_ENERGY_ALPHA_R1_REQUEST_PATH,
  EUROSTAT_ENERGY_ROW_PARSER_VERSION,
  normalizeEurostatEnergyCapture,
} from '../modules/energy/energy-eurostat-pem';

const BASE_URL =
  'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/nrg_cb_pem';
const REVIEWED_BY = 'PRODUCT_OWNER_ALPHA';
const REVIEW_REF = 'ALPHA:DESIGN_NATIVE_DATA_CONVERGENCE_R1:ENERGY_EUROSTAT_R1';

function fail(reason: string): never {
  throw new Error(`ENERGY_EUROSTAT_ALPHA_R1_REFUSED:${reason}`);
}

function digest(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

async function acquire() {
  const rights = assertProviderRightsPermitRunning('EUROSTAT');
  const url = new URL(BASE_URL);
  for (const parameter of EUROSTAT_ENERGY_ALPHA_R1_PARAMETERS) {
    url.searchParams.append(parameter.key, parameter.value);
  }

  const requestedAt = new Date();
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(12_000),
    redirect: 'error',
  });
  const retrievedAt = new Date();

  if (!response.ok || response.status !== 200) fail(`HTTP_${response.status}`);
  if (response.url !== url.toString()) fail('REDIRECT_OR_QUERY_DRIFT');

  const mediaType = response.headers.get('content-type') ?? '';
  if (mediaType.split(';')[0].trim().toLowerCase() !== 'application/json') {
    fail('MEDIA_TYPE');
  }

  const contentEncoding =
    response.headers.get('content-encoding')?.trim().toLowerCase() || 'identity';
  if (!['identity', 'gzip'].includes(contentEncoding)) fail('CONTENT_ENCODING');

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length === 0 || bytes.length > 4 * 1024 * 1024) fail('SIZE');

  const contentAddress = digest(bytes);
  const retrievalId =
    `eurostat-energy:nrg_cb_pem:ES:TOTAL:GWH:2026-07:${contentAddress}`;
  const parsedAt = new Date();

  const candidate = {
    retrievalId,
    providerId: 'EUROSTAT',
    endpointId: EUROSTAT_ENERGY_ALPHA_R1_ENDPOINT_ID,
    requestPath: EUROSTAT_ENERGY_ALPHA_R1_REQUEST_PATH,
    parameters: EUROSTAT_ENERGY_ALPHA_R1_PARAMETERS,
    requestedAt,
    retrievedAt,
    httpStatus: 200,
    mediaType,
    byteLength: bytes.length,
    contentAddress,
    completeness: 'COMPLETE',
    admissibility: 'ADMITTED',
    refusalKey: null,
    parserId: EUROSTAT_ENERGY_ALPHA_R1_PARSER_ID,
    parserVersion: EUROSTAT_ENERGY_ALPHA_R1_PARSER_VERSION,
    rightsGrade: rights.rightsClass,
    rightsInstrumentRef: rights.instrument,
    payloadRetentionPermitted: true,
    payload: {
      bytes,
      storageState: 'RETAINED',
      byteLength: bytes.length,
      contentAddress,
    },
  };

  const observation = normalizeEurostatEnergyCapture(candidate);
  return {
    rights,
    candidate,
    observation,
    bytes,
    contentAddress,
    retrievalId,
    requestedAt,
    retrievedAt,
    parsedAt,
    mediaType,
    contentEncoding,
  };
}
