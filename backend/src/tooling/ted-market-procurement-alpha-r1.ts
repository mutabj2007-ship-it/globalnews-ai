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
