/**
 * ════════════════════════════════════════════════════════════════════════════
 * ECONOMY REAL DATA ALPHA CONVERGENCE R1 — THE CAPTURE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Executes G's four approved requests from this workstation through the DIRECT egress
 * path, and drives them through the canonical pipeline with nothing substituted:
 *
 *   MeasuringOfficialDataTransport        the canonical transport — measures the wire
 *     → CanonicalOfficialDataAdmissionEvaluator   the ONLY admission authority
 *       → PostgresOfficialDataSnapshotStore       Snapshot R2, real PostgreSQL
 *         → produceAlphaSet                       G's producer, unmodified
 *
 * NOTHING HERE CONSTRUCTS AN ADMISSION. The evaluator is handed transport evidence and
 * its verdict is used as returned. There is no second snapshot structure: retention goes
 * through the same store the live-Postgres suite validates.
 *
 * NO RETRY. One request per series, exactly as the manifest requires — a retry would make
 * "one capture" a claim about the last attempt rather than about the exchange.
 *
 * THE BLOCKED ROWS NEVER REACH THE NETWORK. `irt_lt_mcby_m` (ECON-BLOCK-YIELD-CATEGORY)
 * and `ert_bil_eur_m` (ECON-BLOCK-FX-DIRECTION) are BLOCKED in G's matrix and the producer
 * short-circuits them before the transport. That is asserted afterwards against the
 * dispatched list rather than assumed.
 */
import { writeFileSync } from 'node:fs';

import {
  CanonicalOfficialDataAdmissionEvaluator,
  type OfficialDataTransportRequest,
} from '@globalnews-ai/shared';

import {
  MeasuringOfficialDataTransport,
  nodeGunzip,
  type WireResponse,
} from '../src/modules/official-data/official-data-transport.node';
import { PostgresOfficialDataSnapshotStore } from '../src/modules/official-data/official-data-snapshot.store';
import { ALPHA_SERIES } from '../src/modules/economy/producers/eurostat-economy.series';
import { produceAlphaSet } from '../src/modules/economy/producers/eurostat-economy.producer';

/* eslint-disable @typescript-eslint/no-var-requires */
const { PrismaClient } = require('../src/generated/prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const OUT = process.env['ECON_CAPTURE_OUT'] ?? './econ-capture.json';

/**
 * WHERE EUROSTAT IS ALLOWED TO HAVE COME FROM.
 *
 * The transport compares the response's host against a CONFIGURED one and never derives
 * it from the response, which is the whole point of the resolver being injected. It is
 * supplied here rather than read from `OFFICIAL_SOURCES` because that registry is
 * deliberately empty — see the route-eligibility matrix, where E-4a is measured and
 * reported rather than satisfied by this line. A host resolver for a capture harness is
 * not a registry entry, and this file must not be mistaken for one.
 */
const resolveHost = (providerId: string): string | undefined =>
  providerId === 'EUROSTAT' ? 'ec.europa.eu' : undefined;

/** Headers the manifest declares. Nothing else is sent; no credential exists to send. */
const MANIFEST_HEADERS: Readonly<Record<string, string>> = {
  'User-Agent': 'GlobalNewsAI-OfficialData/1.0',
  Accept: 'application/json',
  /* ALPHA_ADMITTED_CONTENT_ENCODINGS — identity or gzip only. */
  'Accept-Encoding': 'identity',
};

const wireLog: unknown[] = [];

/**
 * The real network call. Redirects are followed MANUALLY so the chain is measured rather
 * than reported as whatever the runtime happened to do, and capped so a redirect loop is
 * a failure rather than a hang.
 */
const wireFetch = async (
  request: OfficialDataTransportRequest,
  signal: AbortSignal,
): Promise<WireResponse> => {
  const redirectChain: string[] = [];
  let url = request.url;

  for (let hop = 0; hop <= 5; hop += 1) {
    const res = await fetch(url, {
      method: 'GET',
      headers: MANIFEST_HEADERS,
      redirect: 'manual',
      signal,
    });

    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      headers[k.toLowerCase()] = v;
    });

    if (res.status >= 300 && res.status < 400 && headers['location'] !== undefined) {
      redirectChain.push(url);
      url = new URL(headers['location'], url).toString();
      continue;
    }

    const wireBytes = new Uint8Array(await res.arrayBuffer());
    wireLog.push({
      requestedUrl: request.url,
      finalUrl: url,
      status: res.status,
      redirectChain,
      wireByteLength: wireBytes.byteLength,
      contentType: headers['content-type'] ?? null,
      contentEncoding: headers['content-encoding'] ?? null,
    });
    return { status: res.status, finalUrl: url, headers, wireBytes, redirectChain };
  }
  throw new Error('REDIRECT_LIMIT_EXCEEDED');
};

async function main(): Promise<void> {
  /*
    The same adapter construction `PrismaService` uses. A disposable LOCAL cluster only —
    the runner refuses anything that is not loopback, so an Alpha or Production
    connection string cannot be used here by accident.
  */
  const connectionString = process.env['DATABASE_URL'];
  if (connectionString === undefined) throw new Error('DATABASE_URL is not configured');
  const host = new URL(connectionString).hostname;
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error(`REFUSED: capture target must be a local disposable cluster, got host ${host}`);
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const store = new PostgresOfficialDataSnapshotStore(prisma, ['EUROSTAT']);

  const evaluator = new CanonicalOfficialDataAdmissionEvaluator({
    gunzip: nodeGunzip,
    secrets: { configuredSecrets: [] },
    now: () => new Date().toISOString(),
  });

  const transport = new MeasuringOfficialDataTransport(
    wireFetch,
    resolveHost,
    () => new Date().toISOString(),
  );

  const controller = new AbortController();
  const result = await produceAlphaSet(
    {
      transport,
      evaluator,
      snapshots: store,
      now: () => new Date().toISOString(),
      signal: controller.signal,
    },
    ALPHA_SERIES,
  );

  writeFileSync(
    OUT,
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        requestsDispatched: result.requestsDispatched,
        wire: wireLog,
        cells: result.cells,
      },
      null,
      1,
    ),
  );

  console.log('=== REQUESTS DISPATCHED ===');
  for (const u of result.requestsDispatched) console.log('  ' + u);
  console.log('');
  console.log('=== CELLS ===');
  for (const c of result.cells) {
    if (c.kind === 'GAP') {
      console.log(`  GAP          ${c.seriesId}`);
      console.log(`                 ${c.reason} · ${c.detail}`);
    } else {
      const o = c.observation as unknown as Record<string, unknown>;
      const l = c.lineage as unknown as Record<string, unknown>;
      console.log(`  OBSERVATION  ${String(o['seriesId'] ?? '')}  publishable=${c.publishable}`);
      console.log(
        `                 value=${String(o['value'])} unit=${String(o['unit'])} period=${String(o['period'])}`,
      );
      console.log(
        `                 vintageBasis=${String(l['vintageBasis'])} retrievalId=${String(l['retrievalId'])}`,
      );
    }
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('CAPTURE FAILED:', e);
  process.exit(1);
});
