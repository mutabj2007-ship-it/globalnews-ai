/**
 * REPROCESS THE FOUR RETAINED ROWS UNDER THE NEW CANONICAL NUMERIC SEMANTICS.
 *
 * NO NETWORK. The transport is a replay of the ALREADY-RETAINED bytes, read from disk and
 * hash-checked against the Snapshot R2 content addresses recorded in R1. That is the whole
 * point of the snapshot store, and Main's acceptance condition is explicit: "the four
 * Poland series must be re-run against the already-retained bytes. No new capture."
 *
 * Everything downstream of the transport is the real canonical path: the canonical
 * admission evaluator, the real parser binding, and G's producer.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

import {
  CanonicalOfficialDataAdmissionEvaluator,
  snapshotContentAddress,
  type OfficialDataRetrieval,
  type OfficialDataSnapshotStore,
  type OfficialDataTransport,
  type OfficialDataTransportEvidence,
} from '@globalnews-ai/shared';

import { nodeGunzip } from '../src/modules/official-data/official-data-transport.node';
import { ALPHA_SERIES } from '../src/modules/economy/producers/eurostat-economy.series';
import { produceAlphaSet } from '../src/modules/economy/producers/eurostat-economy.producer';

const BODIES = process.argv[2];
const OUT = process.argv[3];
const NOW = '2026-09-19T12:00:00.000Z';

/** The R1 Snapshot R2 content addresses. A replay that does not match is not a replay. */
const RETAINED: Readonly<Record<string, string>> = {
  prc_hicp_minr: 'cb685cf74b28b4dab314e8da68ce4b2f29ec04de93a1cb4ac78d1742a95a6866',
  namq_10_gdp: 'e6da52b213e327acff5f512561b4ef00710db9ae721c68c2d8b06f8f9ca29d84',
  une_rt_m: 'c37c607cf568606316269f3afaadbc5596fa5c2c8a14a3ba789e4f47e1077bc9',
  gov_10q_ggdebt: '7331ecbaf5fb0bedd1b72616f8174af52682fb335472a43374e5923ff67af4ce',
};

class RetainedBytesTransport implements OfficialDataTransport {
  readonly served: string[] = [];
  async fetch(request: {
    readonly providerId: string;
    readonly endpointId: string;
    readonly url: string;
  }): Promise<OfficialDataTransportEvidence> {
    const ds = request.endpointId;
    const body = new Uint8Array(readFileSync(join(BODIES, `${ds}.json`)));
    const sha = createHash('sha256').update(Buffer.from(body)).digest('hex');
    if (sha !== RETAINED[ds]) {
      throw new Error(`REPLAY_BYTES_DIFFER: ${ds} expected ${RETAINED[ds]} got ${sha}`);
    }
    this.served.push(`${ds} ${sha}`);
    return {
      providerId: request.providerId,
      endpointId: ds,
      finalUrl: request.url,
      configuredHost: 'ec.europa.eu',
      redirectChain: [],
      httpStatus: 200,
      requestedAt: NOW,
      retrievedAt: NOW,
      contentTypeHeader: 'application/json',
      contentEncoding: 'identity',
      contentEncodingHeaderPresent: false,
      wireByteLength: body.byteLength,
      wireBytes: body,
      decodedBytes: body,
      headers: {},
    };
  }
}

class ReplayStore implements Pick<OfficialDataSnapshotStore, 'retain'> {
  async retain(
    input: Parameters<OfficialDataSnapshotStore['retain']>[0],
  ): Promise<OfficialDataRetrieval> {
    const sha = createHash('sha256').update(Buffer.from(input.bytes)).digest('hex');
    return {
      retrievalId: input.retrievalId,
      request: input.request,
      retrievedAt: input.retrievedAt,
      httpStatus: input.httpStatus,
      mediaType: input.mediaType,
      byteLength: input.bytes.byteLength,
      contentAddress: snapshotContentAddress(sha),
      completeness: input.completeness,
      rights: input.rights,
      editionAnnotations: input.editionAnnotations,
      ...(input.publisherChangedAt === undefined ? {} : { publisherChangedAt: input.publisherChangedAt }),
      ...(input.publisherReleasedAt === undefined ? {} : { publisherReleasedAt: input.publisherReleasedAt }),
      admission: input.admission,
    } as OfficialDataRetrieval;
  }
}

async function main(): Promise<void> {
  const transport = new RetainedBytesTransport();
  const result = await produceAlphaSet(
    {
      transport,
      evaluator: new CanonicalOfficialDataAdmissionEvaluator({
        gunzip: nodeGunzip,
        secrets: { configuredSecrets: [] },
        now: () => NOW,
      }),
      snapshots: new ReplayStore(),
      now: () => NOW,
      signal: new AbortController().signal,
    },
    ALPHA_SERIES,
  );

  console.log('=== BYTES REPLAYED (hash-checked against the R1 content addresses) ===');
  for (const s of transport.served) console.log('   ', s);
  console.log('');
  console.log('=== THE FOUR ROWS UNDER THE NEW CANONICAL NUMERIC SEMANTICS ===');
  const summary: unknown[] = [];
  for (const c of result.cells) {
    if (c.kind === 'OBSERVATION') {
      const o = c.observation as unknown as Record<string, unknown>;
      console.log(`  OBSERVATION  ${String(o['seriesId'])}`);
      console.log(`               value=${String(o['value'])} (${typeof o['value']}) unit=${String(o['unit'])} period=${String(o['periodId'])} publishable=${c.publishable}`);
      summary.push({ kind: 'OBSERVATION', seriesId: o['seriesId'], value: o['value'], valueType: typeof o['value'], period: o['periodId'], publishable: c.publishable });
    } else {
      console.log(`  GAP          ${c.seriesId}`);
      console.log(`               ${c.reason} · ${c.detail}`);
      summary.push({ kind: 'GAP', seriesId: c.seriesId, reason: c.reason, detail: c.detail });
    }
  }
  const obs = result.cells.filter((c) => c.kind === 'OBSERVATION');
  console.log('');
  console.log(`  observations: ${obs.length}   gaps: ${result.cells.length - obs.length}`);
  writeFileSync(join(OUT, 'reprocess.json'), JSON.stringify(summary, null, 1));
}

main().catch((e) => { console.error('REPROCESS FAILED:', e); process.exit(1); });
