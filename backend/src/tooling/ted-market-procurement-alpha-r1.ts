import { createHash } from 'node:crypto';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { MarketProviderRegistry } from '../modules/market-ingest/market-provider-registry';
import {
  inspectTedProcurementCapture,
  MAX_TED_MARKET_ALPHA_R1_BYTES,
  TED_MARKET_ALPHA_R1_ENDPOINT_ID,
  TED_MARKET_ALPHA_R1_FIELDS,
  TED_MARKET_ALPHA_R1_LIMIT,
  TED_MARKET_ALPHA_R1_PARSER_ID,
  TED_MARKET_ALPHA_R1_PARSER_VERSION,
  TED_MARKET_ALPHA_R1_QUERY,
  TED_MARKET_ALPHA_R1_REQUEST_PATH,
} from '../modules/market-ingest/ted-procurement-retained';

const SOURCE_URL = 'https://api.ted.europa.eu/v3/notices/search';
const CITED_BY = 'market:procurement:alpha-r1:2026-09-24:POL';

function fail(reason: string): never {
  throw new Error(`TED_MARKET_ALPHA_R1_REFUSED:${reason}`);
}

function digest(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

const PARAMETERS = [
  { key: 'method', value: 'POST' },
  { key: 'query', value: TED_MARKET_ALPHA_R1_QUERY },
  { key: 'fields', value: JSON.stringify(TED_MARKET_ALPHA_R1_FIELDS) },
  { key: 'page', value: '1' },
  { key: 'limit', value: String(TED_MARKET_ALPHA_R1_LIMIT) },
  { key: 'scope', value: 'ALL' },
  { key: 'checkQuerySyntax', value: 'false' },
  { key: 'paginationMode', value: 'PAGE_NUMBER' },
  { key: 'onlyLatestVersions', value: 'true' },
] as const;

const REQUEST_BODY = {
  query: TED_MARKET_ALPHA_R1_QUERY,
  fields: [...TED_MARKET_ALPHA_R1_FIELDS],
  page: 1,
  limit: TED_MARKET_ALPHA_R1_LIMIT,
  scope: 'ALL',
  checkQuerySyntax: false,
  paginationMode: 'PAGE_NUMBER',
  onlyLatestVersions: true,
} as const;

async function acquire() {
  const registry = new MarketProviderRegistry(['TED']);
  const permitted = registry.resolve('TED', 'PROCUREMENT_OPPORTUNITY', 'ACQUIRE');
  registry.resolve('TED', 'PROCUREMENT_OPPORTUNITY', 'RETAIN_PAYLOAD');

  const requestedAt = new Date();
  const response = await fetch(SOURCE_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify(REQUEST_BODY),
    signal: AbortSignal.timeout(permitted.fetchTimeoutMs),
    redirect: 'error',
  });
  const retrievedAt = new Date();

  if (!response.ok || response.status !== 200) fail(`HTTP_${response.status}`);
  if (response.url !== SOURCE_URL) fail('REDIRECT_ORIGIN_DRIFT');

  const mediaType = response.headers.get('content-type') ?? '';
  if (mediaType.split(';')[0].trim().toLowerCase() !== 'application/json') {
    fail('MEDIA_TYPE');
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_TED_MARKET_ALPHA_R1_BYTES) {
    fail('SIZE');
  }

  const contentAddress = digest(bytes);
  const retrievalId = `ted-search:2026-09-24:POL:cn-standard:${contentAddress}`;
  const parsedAt = new Date();

  const candidate = {
    retrievalId,
    providerId: 'TED',
    endpointId: TED_MARKET_ALPHA_R1_ENDPOINT_ID,
    requestPath: TED_MARKET_ALPHA_R1_REQUEST_PATH,
    parameters: PARAMETERS,
    requestedAt,
    retrievedAt,
    httpStatus: 200,
    mediaType,
    byteLength: bytes.byteLength,
    contentAddress,
    completeness: 'COMPLETE',
    admissibility: 'ADMITTED',
    refusalKey: null,
    parserId: TED_MARKET_ALPHA_R1_PARSER_ID,
    parserVersion: TED_MARKET_ALPHA_R1_PARSER_VERSION,
    parsedAt,
    rightsGrade: permitted.rights.rightsClass,
    rightsInstrumentRef: permitted.rights.instrument,
    payloadRetentionPermitted: true,
    payload: {
      bytes,
      storageState: 'RETAINED',
      byteLength: bytes.byteLength,
      mediaType,
      contentAddress,
    },
  };

  const notices = inspectTedProcurementCapture(candidate);
  if (notices.length < 1 || notices.length > TED_MARKET_ALPHA_R1_LIMIT) {
    fail('NOTICE_COUNT_BOUND');
  }

  return {
    permitted,
    candidate,
    notices,
    bytes,
    contentAddress,
    retrievalId,
    mediaType,
    requestedAt,
    retrievedAt,
    parsedAt,
  };
}
