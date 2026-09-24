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
