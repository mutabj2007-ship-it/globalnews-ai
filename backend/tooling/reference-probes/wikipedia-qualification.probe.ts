/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R2 CONSOLIDATED INTEGRATION R1 · GATE D — QQ-9 LIVE QUALIFICATION PROBES
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Main R1.1 QQ-9: "A defines 16 tests and 6 required live probes and executed none of
 * them." A's package is not on disk (input register: MISSING, non-blocking), so these
 * six are written from contract §6 and reported as the equivalents, not as A's.
 *
 * THIS IS QUALIFICATION, NOT ACTIVATION. It runs from tooling/, through the PRODUCTION
 * transport (`makeSafeWireFetch`, DIRECT address-bound, §11) and the production adapter
 * in `QUALIFICATION_PROBE` mode. The registry entry stays `enabled: false`; nothing here
 * changes it, and no product path gains a call site (reference-providers.spec asserts).
 *
 * Bounded: ≤ 10 GET requests to en/pl.wikipedia.org, paced by the entry's own limits.
 * The User-Agent names this probe; the production template's placeholders (PB-8) are
 * NOT filled by this run.
 *
 *   run:  node tooling/reference-probes/run-probe.cjs   (from backend/)
 */

import { lookup } from 'node:dns/promises';
import { SNAPSHOT_WIRE_BYTE_CAP, referenceUserAgent } from '@globalnews-ai/shared';
import {
  makeSafeWireFetch,
  nodeAddressBoundConnector,
  nodeAddressResolver,
} from '../../src/modules/official-data/safe-wire-fetch.node';
import { buildSafeFetchPolicy } from '../../src/modules/official-data/official-data.boot';
import {
  WIKIPEDIA_REFERENCE_PROVIDER as W,
  referenceHostResolver,
} from '../../src/modules/reference-providers/reference-provider-registry';
import {
  createWikipediaSummaryClient,
  summaryUrl,
} from '../../src/modules/reference-providers/wikipedia/wikipedia-summary';
import type {
  WireFetch,
  WireResponse,
} from '../../src/modules/official-data/official-data-transport.node';

interface ProbeResult {
  readonly id: string;
  readonly claim: string;
  readonly pass: boolean;
  readonly observed: Record<string, unknown>;
}

async function main(): Promise<void> {
  const userAgent = referenceUserAgent(W, {
    '{PRODUCT_DOMAIN}': 'globalnewsai.live',
    '{OPERATIONS_CONTACT}': 'Ask R2 integration qualification probe',
  });
  const policy = buildSafeFetchPolicy(['api.globalnews.ai']);
  const resolveHost = referenceHostResolver();
  /*
    RESOLVER. The production resolver (`nodeAddressResolver`) queries A and AAAA directly,
    by design, so EVERY address is classified. On a machine whose Node DNS client points at
    a local stub that refuses direct queries, that step cannot run at all; the probe then
    may be told `PROBE_RESOLVER=os` and uses the OS resolver's COMPLETE address list
    (`lookup {all:true}`). Everything after resolution — the SSRF classification of every
    address, the address-bound connect, SNI/Host, TLS verification, redirects — is the
    production code unchanged. Which resolver ran is recorded in the output.
  */
  const resolverName =
    process.env['PROBE_RESOLVER'] === 'os'
      ? 'OS_LOOKUP_ALL (probe host only)'
      : 'nodeAddressResolver (production)';
  const resolver: typeof nodeAddressResolver =
    process.env['PROBE_RESOLVER'] === 'os'
      ? async (hostname) =>
          (await lookup(hostname, { all: true, verbatim: true })).map((a) => a.address)
      : nodeAddressResolver;
  const governed = makeSafeWireFetch({
    resolver,
    connector: nodeAddressBoundConnector,
    policy,
    resolveHost,
    userAgent,
  });

  /* Record every exchange so raw-body facts (the tid) can be checked independently. */
  const exchanges: {
    url: string;
    status: number;
    finalUrl: string;
    redirects: number;
    body: unknown;
  }[] = [];
  const recording: WireFetch = async (req, signal) => {
    const r: WireResponse = await governed(req, signal);
    let body: unknown;
    try {
      body = JSON.parse(new TextDecoder().decode(r.wireBytes));
    } catch {
      body = null;
    }
    exchanges.push({
      url: req.url,
      status: r.status,
      finalUrl: r.finalUrl,
      redirects: r.redirectChain.length,
      body,
    });
    return r;
  };

  const client = createWikipediaSummaryClient({
    entry: W,
    wireFetch: recording,
    nowMs: () => Date.now(),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    mode: 'QUALIFICATION_PROBE',
  });
  const signal = AbortSignal.timeout(policy.totalDeadlineMs);
  const results: ProbeResult[] = [];

  /* P1 — EN edition page */
  const p1 = await client.lookup('en', 'Inflation', signal);
  results.push({
    id: 'P1',
    claim:
      'EN edition: a standard page yields PAGE with page id, revision version and provider timestamp',
    pass: p1.kind === 'PAGE' && p1.evidence.edition === 'en' && /^\d+$/.test(p1.evidence.versionId),
    observed:
      p1.kind === 'PAGE'
        ? {
            kind: p1.kind,
            pageId: p1.evidence.pageId,
            versionId: p1.evidence.versionId,
            sourceTimestamp: p1.evidence.sourceTimestamp,
            title: p1.evidence.canonicalTitle,
          }
        : { kind: p1.kind, ...p1 },
  });

  /* P2 — PL edition page, separate edition */
  const p2 = await client.lookup('pl', 'Inflacja', signal);
  results.push({
    id: 'P2',
    claim: 'PL edition: read from pl.wikipedia.org as its own edition (no cross-edition merge)',
    pass:
      p2.kind === 'PAGE' &&
      p2.evidence.edition === 'pl' &&
      p2.evidence.providerId === 'wikipedia-pl',
    observed:
      p2.kind === 'PAGE'
        ? {
            kind: p2.kind,
            pageId: p2.evidence.pageId,
            versionId: p2.evidence.versionId,
            sourceTimestamp: p2.evidence.sourceTimestamp,
            title: p2.evidence.canonicalTitle,
          }
        : { kind: p2.kind, ...p2 },
  });

  /* P3 — missing page */
  const p3 = await client.lookup('en', 'Zzqxv Nonexistent Page GlobalNewsAI Probe 7c1', signal);
  results.push({
    id: 'P3',
    claim: 'a missing page is the explicit MISSING_PAGE outcome',
    pass: p3.kind === 'MISSING_PAGE',
    observed: { ...p3 },
  });

  /* P4 — disambiguation */
  const p4 = await client.lookup('en', 'Mercury', signal);
  results.push({
    id: 'P4',
    claim: 'a disambiguation page is the explicit DISAMBIGUATION outcome',
    pass: p4.kind === 'DISAMBIGUATION',
    observed: { ...p4 },
  });

  /* P5 — version identity is the revision, never the tid; stable across re-reads */
  const p5 = await client.lookup('en', 'Inflation', signal);
  const raw = exchanges.find((e) => e.url === summaryUrl('en.wikipedia.org', 'Inflation'))?.body as
    Record<string, unknown> | undefined;
  const tid = typeof raw?.['tid'] === 'string' ? (raw['tid'] as string) : null;
  results.push({
    id: 'P5',
    claim:
      'version = revision id (digits); the transport tid is present, differs, and is never used; re-read is stable',
    pass:
      p1.kind === 'PAGE' &&
      p5.kind === 'PAGE' &&
      p5.evidence.versionId === p1.evidence.versionId &&
      (tid === null || tid !== p1.evidence.versionId),
    observed: {
      firstVersion: p1.kind === 'PAGE' ? p1.evidence.versionId : null,
      secondVersion: p5.kind === 'PAGE' ? p5.evidence.versionId : null,
      tidPresent: tid !== null,
      tidEqualsVersion: tid !== null && p1.kind === 'PAGE' && tid === p1.evidence.versionId,
    },
  });

  /* P6 — egress: governed host only, a same-host redirect is followed under the gate */
  const p6 = await client.lookup('en', 'USA', signal);
  const p6x = exchanges.find((e) => e.url === summaryUrl('en.wikipedia.org', 'USA'));
  results.push({
    id: 'P6',
    claim:
      'DIRECT address-bound egress to the governed host only; a redirecting title (USA) resolves to its canonical page on the edition host (redirect hops recorded as observed)',
    pass:
      p6.kind === 'PAGE' &&
      p6x !== undefined &&
      new URL(p6x.finalUrl).hostname === 'en.wikipedia.org',
    observed: {
      kind: p6.kind,
      canonicalTitle: p6.kind === 'PAGE' ? p6.evidence.canonicalTitle : null,
      redirects: p6x?.redirects ?? null,
      finalHost: p6x === undefined ? null : new URL(p6x.finalUrl).hostname,
    },
  });

  const out = {
    probe:
      'ASK-R2-INTEGRATION-R1 · QQ-9 Wikipedia EN/PL live qualification (equivalents of A’s six)',
    transport: 'makeSafeWireFetch (production), DIRECT_ADDRESS_BOUND',
    resolver: resolverName,
    wireByteCap: SNAPSHOT_WIRE_BYTE_CAP,
    userAgent,
    requests: exchanges.length,
    registryEnabledAfterRun: W.activation.enabled,
    results,
    passed: results.filter((r) => r.pass).length,
    of: results.length,
  };
  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
  if (out.passed !== out.of) process.exitCode = 1;
}

main().catch((e: unknown) => {
  process.stderr.write(`PROBE_FAILED ${(e as Error).name}: ${(e as Error).message}\n`);
  process.exitCode = 2;
});
