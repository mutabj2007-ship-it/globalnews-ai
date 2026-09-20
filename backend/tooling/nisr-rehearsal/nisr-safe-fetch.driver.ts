/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE SAFE-FETCH DRIVER — E1's LANDED PRIMITIVES, ASSEMBLED
 * ════════════════════════════════════════════════════════════════════════════
 *
 * TOOLING. Not in the production build. One request, manually authorised, never scheduled.
 *
 * ── WHAT IS MINE HERE AND WHAT IS NOT ─────────────────────────────────────
 *
 * `official-artifact-safe-fetch.ts` is landed and it deliberately does NOT own a driver:
 * it declares the policy and the decisions — the URL gate, address classification over
 * EVERY resolved address, redirect adjudication per hop, the length adjudication, and
 * origin-bound credentials — and takes the two primitives (`AddressResolver`,
 * `AddressBoundConnector`) as injected. THE DECISIONS BELOW ARE ALL ITS. What this file
 * adds is the loop and the two Node primitives, and nothing it decides.
 *
 * The previous round's rehearsal had to say the opposite — *"the real one … IS NOT IN
 * THIS TREE (measured: no safeFetch symbol anywhere)"* and its wire fetch "does not
 * implement the address-revalidation, denylist or connect-to-validated-IP behaviour E1
 * specifies". It is in the tree now, and this run goes through it.
 *
 * ── TLS ───────────────────────────────────────────────────────────────────
 *
 * VERIFICATION IS ON AND THERE IS NO FLAG HERE TO TURN IT OFF — `R-EA-TR-7` forbids
 * routing around a TLS failure, and `AddressBoundConnector`'s own contract says "TLS
 * verification is not a parameter of this contract: there is no flag to disable it, which
 * is how it stays always on." The connection is made TO A VALIDATED IP with `servername`
 * set to the governed hostname, so the certificate is checked against the name the
 * registry governs and a resolver that answered public at check time cannot answer
 * loopback at connect time.
 */

import { lookup as dnsLookup, resolve4, resolve6 } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';

import {
  SAFE_FETCH_DENIED_HOST_SUFFIXES,
  adjudicateContentLength,
  adjudicateRedirect,
  assertUrlIsFetchable,
  classifyResolvedSet,
  credentialHeadersFor,
  finalUrlFor,
  type AddressBoundConnector,
  type AddressResolver,
  type SafeFetchPolicy,
} from '../../src/modules/official-data/official-artifact-safe-fetch';

export interface SafeFetchOutcome {
  readonly ok: boolean;
  readonly failureKind?: string;
  readonly reason?: string;
  readonly status?: number;
  readonly headers?: Readonly<Record<string, string>>;
  readonly bytes?: Uint8Array;
  readonly finalUrl?: string;
  readonly redirectChain: readonly string[];
  readonly wireByteLength: number;
  readonly resolvedAddressCount: number;
  readonly wallMs: number;
}

/**
 * EVERY address for the name, not the first.
 *
 * *"A name that resolves to one public and one loopback address is refused on the
 * loopback, because the client is free to try them in any order and will eventually try
 * that one."* So A and AAAA are both asked for, and the full set is classified.
 */
export const nodeAddressResolver: AddressResolver = async (hostname) => {
  const out: string[] = [];
  const both = await Promise.allSettled([resolve4(hostname), resolve6(hostname)]);
  for (const r of both) if (r.status === 'fulfilled') out.push(...r.value);
  if (out.length === 0) {
    /* Last resort so a host with only a hosts-file entry still classifies rather than
       failing as a resolution error — the classification is what matters. */
    const one = await dnsLookup(hostname, { all: true });
    out.push(...one.map((a) => a.address));
  }
  return out;
};

/** Connects to the VALIDATED ADDRESS and sends the ORIGINAL Host. Caps while streaming. */
export const nodeAddressBoundConnector: AddressBoundConnector = (req, signal) =>
  new Promise((resolve, reject) => {
    const r = httpsRequest(
      {
        host: req.address,
        port: req.port,
        /* SNI and certificate verification against the GOVERNED NAME, not the IP. */
        servername: req.tlsServerName,
        path: req.path,
        method: 'GET',
        headers: { Host: req.hostHeader, ...req.headers },
        timeout: req.deadlineMs,
        signal,
      },
      (res) => {
        const chunks: Buffer[] = [];
        let received = 0;
        let capHit = false;
        res.on('data', (c: Buffer) => {
          received += c.length;
          if (received > req.byteCap) {
            /* THE CAP IS APPLIED WHILE STREAMING. A cap enforced after the fact is not
               a cap: the bytes are already in memory. */
            capHit = true;
            res.destroy();
            return;
          }
          chunks.push(c);
        });
        res.on('end', () =>
          resolve({
            status: res.statusCode ?? 0,
            headers: Object.fromEntries(
              Object.entries(res.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : String(v ?? '')]),
            ),
            bytes: new Uint8Array(Buffer.concat(chunks)),
            capHit,
          }),
        );
        res.on('close', () => {
          if (capHit) {
            resolve({
              status: res.statusCode ?? 0,
              headers: {},
              bytes: new Uint8Array(Buffer.concat(chunks)),
              capHit: true,
            });
          }
        });
        res.on('error', reject);
      },
    );
    r.on('timeout', () => r.destroy(new Error('PER_HOP_TIMEOUT')));
    r.on('error', reject);
    r.end();
  });

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/**
 * The loop. Every decision in it belongs to the landed contract; the loop only sequences
 * them and carries the evidence out.
 */
export async function safeFetchArtifact(args: {
  readonly url: string;
  readonly governedHost: string;
  readonly policy: SafeFetchPolicy;
  readonly accept: string;
  readonly resolver?: AddressResolver;
  readonly connector?: AddressBoundConnector;
}): Promise<SafeFetchOutcome> {
  const resolver = args.resolver ?? nodeAddressResolver;
  const connector = args.connector ?? nodeAddressBoundConnector;
  const started = Date.now();
  const controller = new AbortController();
  const whole = setTimeout(() => controller.abort(), args.policy.totalDeadlineMs);

  const redirectChain: string[] = [];
  let resolvedAddressCount = 0;
  let current = args.url;

  try {
    for (let hop = 0; ; hop += 1) {
      /* ── THE URL GATE, BEFORE ANY RESOLUTION ───────────────────────────── */
      const urlVerdict = assertUrlIsFetchable(current, args.governedHost, args.policy);
      if (!urlVerdict.admitted) {
        return {
          ok: false,
          failureKind: urlVerdict.kind,
          reason: urlVerdict.reason,
          redirectChain,
          wireByteLength: 0,
          resolvedAddressCount,
          wallMs: Date.now() - started,
        };
      }
      redirectChain.push(current);

      /* ── EVERY RESOLVED ADDRESS IS CLASSIFIED — THE SSRF CORE ───────────── */
      const addresses = await resolver(urlVerdict.hostname, controller.signal);
      resolvedAddressCount = addresses.length;
      const setVerdict = classifyResolvedSet(addresses);
      if (!setVerdict.admitted) {
        return {
          ok: false,
          failureKind: 'ADDRESS_REFUSED',
          reason: setVerdict.reason,
          redirectChain,
          wireByteLength: 0,
          resolvedAddressCount,
          wallMs: Date.now() - started,
        };
      }

      const target = new URL(current);
      const result = await connector(
        {
          address: addresses[0]!,
          port: urlVerdict.port,
          tlsServerName: urlVerdict.hostname,
          hostHeader: urlVerdict.hostname,
          path: `${target.pathname}${target.search}`,
          headers: {
            Accept: args.accept,
            /* A credential is ATTACHED only to the exact origin the registry binds it
               to. There is none for this provider, and the function is called anyway so
               the absence is the contract's answer rather than an omission here. */
            ...credentialHeadersFor(undefined, current),
          },
          byteCap: args.policy.wireByteCap,
          deadlineMs: args.policy.perHopDeadlineMs,
        },
        controller.signal,
      );

      if (REDIRECT_STATUSES.has(result.status)) {
        const verdict = adjudicateRedirect(
          current,
          result.headers['location'],
          hop,
          args.governedHost,
          args.policy,
        );
        if (!verdict.follow) {
          return {
            ok: false,
            failureKind: verdict.kind,
            reason: verdict.reason,
            redirectChain,
            wireByteLength: 0,
            resolvedAddressCount,
            wallMs: Date.now() - started,
          };
        }
        current = verdict.nextUrl;
        continue;
      }

      /* ── THE LENGTH ADJUDICATION, AGAINST THE DECLARED HEADER ───────────── */
      if (result.capHit) {
        /* The stream was aborted AT the cap. Reported as its own failure rather than
           reaching the length adjudication as a short read, because a truncated body and
           a body the publisher sent short are different facts. */
        return {
          ok: false,
          failureKind: 'ABORTED_BY_CAP',
          reason: `WIRE_CAP_EXCEEDED:${args.policy.wireByteCap}`,
          redirectChain,
          wireByteLength: result.bytes.byteLength,
          resolvedAddressCount,
          wallMs: Date.now() - started,
        };
      }
      const lengthVerdict = adjudicateContentLength(
        result.headers['content-length'],
        result.bytes.byteLength,
        args.policy,
      );
      if (!lengthVerdict.ok) {
        return {
          ok: false,
          failureKind: lengthVerdict.kind,
          reason: lengthVerdict.reason,
          redirectChain,
          wireByteLength: result.bytes.byteLength,
          resolvedAddressCount,
          wallMs: Date.now() - started,
        };
      }

      return {
        ok: true,
        status: result.status,
        headers: result.headers,
        bytes: result.bytes,
        /* THE FINAL URL STATES THE GOVERNED HOSTNAME, never the validated IP. */
        finalUrl: finalUrlFor(current),
        redirectChain,
        wireByteLength: result.bytes.byteLength,
        resolvedAddressCount,
        wallMs: Date.now() - started,
      };
    }
  } catch (e) {
    return {
      ok: false,
      failureKind: 'CONNECT_FAILURE',
      reason: (e as Error).message,
      redirectChain,
      wireByteLength: 0,
      resolvedAddressCount,
      wallMs: Date.now() - started,
    };
  } finally {
    clearTimeout(whole);
  }
}

export const NISR_SAFE_FETCH_POLICY = (wireByteCap: number): SafeFetchPolicy =>
  Object.freeze({
    wireByteCap,
    maxRedirectHops: 3,
    totalDeadlineMs: 60_000,
    perHopDeadlineMs: 30_000,
    admittedScheme: 'https:' as const,
    deniedHostSuffixes: SAFE_FETCH_DENIED_HOST_SUFFIXES,
    ownOrigins: [],
  });
