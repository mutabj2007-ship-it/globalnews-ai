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
