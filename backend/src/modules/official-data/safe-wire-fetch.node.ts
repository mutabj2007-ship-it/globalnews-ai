/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE PRODUCTION SAFE-FETCH DRIVER — THREE ADAPTERS AND ONE LOOP
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `official-artifact-safe-fetch.ts` already decides everything, and its own header says
 * why it cannot fetch: *"THIS MODULE CANNOT FETCH, AND THAT IS THE POINT. There is no
 * `node:net`, no `node:https`, no `fetch` and no socket anywhere below. Every network
 * primitive is an INJECTED function declared as a type. The whole file is policy."*
 *
 * This file is the other half, and it contains **no policy of its own**. Scheme, userinfo,
 * literal-address hosts, denied suffixes, our own origins, the exact governed-host
 * comparison, port, every resolved address, every redirect hop, the declared length and
 * the cap arithmetic are all imported verdicts being obeyed.
 *
 * **EVERY PREDICATE THIS FILE RE-IMPLEMENTED WOULD BE A DEFECT, NOT AN IMPLEMENTATION**
 * — C-3.1 — because the policy module's premise is that the rule lives in exactly one
 * place, and the copy that diverges is the one that gets relaxed. `C-P13` asserts the
 * absence of every policy literal in this module, by source inspection, so the rule is
 * measured rather than promised.
 *
 * ── WHAT THIS FILE IS NOT ─────────────────────────────────────────────────
 *
 * **NO SCHEDULER. NO RECURRENCE. NO RETRY LOOP.** One call, one exchange, and
 * `C-P11` counts the connector calls to prove it. `transportFailureMayRetry()` classifies
 * a failure for a CALLER to act on; it is not permission for this driver to act on it
 * itself — a retry here would be a request the producer never asked for.
 *
 * **CONSTRUCTING THIS IS NOT ACTIVATING A PROVIDER.** The registry decides which
 * providers are enabled and is untouched by this module. A `WireFetch` that exists and is
 * never called issues no request.
 */

import { resolve4, resolve6 } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';

import {
  OfficialDataTransportFailure,
  type OfficialDataTransportRequest,
} from '@globalnews-ai/shared';

import {
  adjudicateContentLength,
  adjudicateRedirect,
  assertUrlIsFetchable,
  classifyResolvedSet,
  credentialHeadersFor,
  finalUrlFor,
  type AddressBoundConnector,
  type AddressResolver,
  type OriginBoundCredential,
  type SafeFetchPolicy,
} from './official-artifact-safe-fetch';
import type {
  ProviderHostResolver,
  WireFetch,
  WireResponse,
} from './official-data-transport.node';

/* ══════════════════════════════════════════════════════════════════════════
 * 1 · THE RESOLVER — EVERY ADDRESS, NEVER `dns.lookup`
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `resolve4` AND `resolve6`, both, concatenated.
 *
 * **NOT `dns.lookup`.** `lookup` consults the OS resolver, honours `/etc/hosts` and NSS,
 * and returns ONE address by default — so a name with one public and one loopback address
 * could return the public one to the check and the loopback one to the connection. The
 * whole of `classifyResolvedSet` exists because *"the client is free to try them in any
 * order and will eventually try that one"*, and `lookup` silently defeats it.
 *
 * **NO CACHING.** A cached address set is a TOCTOU window against exactly the rebinding
 * this mechanism exists to stop.
 */
/**
 * WHY BOTH FAMILIES ARE ASKED FOR AND NEITHER IS REQUIRED.
 *
 * A host with an A record and no AAAA is ordinary, and `resolve6` answers `ENODATA` or
 * `ENOTFOUND` for it — a fact, not a failure. So a rejection from either family is
 * tolerated and only an EMPTY UNION is a resolution failure, which the loop refuses
 * explicitly before classification.
 *
 * BUT THE REASONS ARE KEPT. An earlier version discarded them, and a `DNS_FAILURE`
 * that cannot say whether the name does not exist, the query timed out, or the
 * nameserver refused is a failure an operator cannot act on. The errors are carried
 * out on the returned array so the driver can name them.
 */
export interface ResolutionDiagnostics {
  readonly v4?: string;
  readonly v6?: string;
}

export const lastResolutionDiagnostics = new WeakMap<object, ResolutionDiagnostics>();

export const nodeAddressResolver: AddressResolver = async (hostname) => {
  const settled = await Promise.allSettled([resolve4(hostname), resolve6(hostname)]);
  const addresses: string[] = [];
  const diagnostics: { v4?: string; v6?: string } = {};

  const [v4, v6] = settled;
  if (v4!.status === 'fulfilled') addresses.push(...v4!.value);
  else diagnostics.v4 = (v4!.reason as { code?: string })?.code ?? 'UNKNOWN';
  if (v6!.status === 'fulfilled') addresses.push(...v6!.value);
  else diagnostics.v6 = (v6!.reason as { code?: string })?.code ?? 'UNKNOWN';

  const result = Object.freeze([...addresses]);
  lastResolutionDiagnostics.set(result, Object.freeze(diagnostics));
  return result;
};

/* ══════════════════════════════════════════════════════════════════════════
 * 2 · THE CONNECTOR — DIAL THE VALIDATED IP, VERIFY THE GOVERNED NAME
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE PIVOT OF THE WHOLE DESIGN, AND IT MUST NOT BE SOFTENED: the socket goes to **the
 * address that was classified**, while TLS validates and the `Host` header names **the
 * governed hostname**. Passing the hostname to `https.request` would re-resolve it inside
 * Node — a second resolution, unclassified, at connect time — which is precisely the
 * rebind window `classifyResolvedSet` was written to close. Connect to the IP or the
 * check was theatre.
 */
export const nodeAddressBoundConnector: AddressBoundConnector = (req, signal) =>
  new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      fn();
    };

    const r = httpsRequest(
      {
        /* The validated IP. Never the hostname. */
        host: req.address,
        port: req.port,
        /* SNI and certificate verification against the GOVERNED NAME, not the address. */
        servername: req.tlsServerName,
        /*
          TLS VERIFICATION IS ON AND THERE IS NO BRANCH THAT CONTINUES PAST A FAILURE.
          Default CA store, never a custom CA. There is deliberately no option plumbed
          through `AddressBoundRequest` that could turn this off, which is how it stays on.
        */
        rejectUnauthorized: true,
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
            /*
              STREAM AND DESTROY, NEVER BUFFER THEN MEASURE. Measuring afterwards has
              already allocated the memory the cap exists to protect — the same reasoning
              `nodeGunzip`'s `maxOutputLength` is built on.
            */
            capHit = true;
            res.destroy();
            return;
          }
          chunks.push(c);
        });

        const done = (): void =>
          finish(() =>
            resolve({
              status: res.statusCode ?? 0,
              headers: Object.fromEntries(
                Object.entries(res.headers).map(([k, v]) => [
                  k,
                  Array.isArray(v) ? v.join(', ') : String(v ?? ''),
                ]),
              ),
              /* BYTES, never a string: a lenient decode substitutes U+FFFD, which changes
                 the bytes whose hash becomes the content address. */
              bytes: new Uint8Array(Buffer.concat(capHit ? [] : chunks)),
              capHit,
            }),
          );

        res.on('end', done);
        res.on('close', done);
        res.on('error', (e) => finish(() => reject(e)));
      },
    );

    r.on('timeout', () => r.destroy(new Error('PER_HOP_TIMEOUT')));
    r.on('error', (e) => finish(() => reject(e)));
    r.end();
  });

/* ══════════════════════════════════════════════════════════════════════════
 * 3 · THE LOOP — IT DECIDES NOTHING
 * ══════════════════════════════════════════════════════════════════════════ */

const REDIRECT_STATUSES: ReadonlySet<number> = new Set([301, 302, 303, 307, 308]);

/** Which Node error is which transport failure. Classification of an ERROR, not a policy. */
function failureKindOf(error: unknown): 'TLS_FAILURE' | 'TIMEOUT' | 'CONNECT_FAILURE' {
  const e = error as { code?: string; message?: string };
  const code = e?.code ?? '';
  const message = e?.message ?? '';
  if (code.startsWith('ERR_TLS') || code.startsWith('CERT_') || code.startsWith('UNABLE_TO_VERIFY') ||
      code === 'DEPTH_ZERO_SELF_SIGNED_CERT' || code === 'SELF_SIGNED_CERT_IN_CHAIN' ||
      code === 'ERR_SSL_WRONG_VERSION_NUMBER' || /certificate|SSL|TLS/i.test(message)) {
    return 'TLS_FAILURE';
  }
  if (code === 'ETIMEDOUT' || code === 'ABORT_ERR' || /TIMEOUT/i.test(message)) return 'TIMEOUT';
  return 'CONNECT_FAILURE';
}

export interface SafeWireFetchDeps {
  readonly resolver: AddressResolver;
  readonly connector: AddressBoundConnector;
  readonly policy: SafeFetchPolicy;
  /** C-3.3 — THE SAME INSTANCE the transport is given. Two resolvers is a silent fork. */
  readonly resolveHost: ProviderHostResolver;
  readonly credential?: OriginBoundCredential;
}

export function makeSafeWireFetch(deps: SafeWireFetchDeps): WireFetch {
  const { resolver, connector, policy, resolveHost, credential } = deps;

  return async function safeWireFetch(
    request: OfficialDataTransportRequest,
    signal: AbortSignal,
  ): Promise<WireResponse> {
    /*
      A FUNCTION DECLARATION, NOT AN ARROW. TypeScript narrows control flow after a call
      to a `never`-returning function DECLARATION but not after an arrow assigned to a
      const — so written as an arrow, every `if (!gate.admitted) refuse(...)` below would
      leave the verdict un-narrowed and every field access would need a cast. The point of
      obeying a landed verdict is that the compiler checks you obeyed it.
    */
    function refuse(
      kind: ConstructorParameters<typeof OfficialDataTransportFailure>[0],
      reason: string,
    ): never {
      throw new OfficialDataTransportFailure(kind, request.providerId, reason);
    }

    /* ── 0 · THE GOVERNED HOST, FROM THE SHARED RESOLVER ─────────────────── */
    const governedHost = resolveHost(request.providerId);
    if (governedHost === undefined) {
      /* No request is issued. An unregistered provider is refused before the network. */
      refuse('ADDRESS_REFUSED', 'PROVIDER_HAS_NO_GOVERNED_HOST');
    }

    let url = request.url;
    let hops = 0;
    const redirectChain: string[] = [];
    let carryHeaders = true;

    for (;;) {
      /* ── 1 · THE URL GATE, BEFORE ANY RESOLUTION ───────────────────────── */
      const gate = assertUrlIsFetchable(url, governedHost!, policy);
      if (!gate.admitted) refuse(gate.kind, gate.reason);

      /* ── 2 · EVERY ADDRESS FOR THE NAME ────────────────────────────────── */
      let addresses: readonly string[];
      try {
        addresses = await resolver(gate.hostname, signal);
      } catch (e) {
        refuse('DNS_FAILURE', `RESOLUTION_FAILED:${(e as Error).message}`);
      }
      /*
        AN EMPTY SET IS REFUSED EXPLICITLY, BEFORE CLASSIFICATION, AND THIS IS THE R-B
        CONTROL: `classifyResolvedSet([])` satisfies every "contains no forbidden address"
        assertion vacuously, so without this line the address check passes hardest exactly
        when it knows least.
      */
      if (addresses!.length === 0) {
        /* Name WHY, because an operator cannot act on "no addresses". */
        const d = lastResolutionDiagnostics.get(addresses! as unknown as object);
        const detail =
          d === undefined
            ? 'RESOLVED_TO_NO_ADDRESSES'
            : `RESOLVED_TO_NO_ADDRESSES:A=${d.v4 ?? 'EMPTY'}:AAAA=${d.v6 ?? 'EMPTY'}`;
        refuse('DNS_FAILURE', detail);
      }

      /* ── 3 · THE SSRF CORE ─────────────────────────────────────────────── */
      const set = classifyResolvedSet(addresses!);
      if (!set.admitted) refuse('ADDRESS_REFUSED', set.reason);

      /* ── 4 · HEADERS, REBUILT ON EVERY PASS ────────────────────────────── */
      const target = new URL(url);
      const headers: Record<string, string> = { Accept: request.accept };
      if (carryHeaders) {
        /* The credential is attached ONLY to its exact bound origin, so there is no
           branch in which it travels. `dropAllHeaders` is the belt; this is the braces. */
        Object.assign(headers, credentialHeadersFor(credential, url));
      }

      /* ── 5 · ONE EXCHANGE ──────────────────────────────────────────────── */
      let result;
      try {
        result = await connector(
          {
            address: addresses![0]!,
            port: gate.port,
            tlsServerName: gate.hostname,
            hostHeader: gate.hostname,
            path: `${target.pathname}${target.search}`,
            headers,
            byteCap: policy.wireByteCap,
            deadlineMs: policy.perHopDeadlineMs,
          },
          signal,
        );
      } catch (e) {
        refuse(failureKindOf(e), (e as Error).message);
      }

      if (result!.capHit) refuse('ABORTED_BY_CAP', 'WIRE_CAP_EXCEEDED_MID_STREAM');

      /* ── 6 · A HOP IS A NEW FETCH, AND IT RETURNS TO STEP 1 ─────────────
         `adjudicateRedirect` re-runs the URL gate internally; the loop re-runs the
         RESOLUTION too, which it cannot do because it has no resolver. A hop that
         resolves to a private address after the first one did not is refused. */
      if (REDIRECT_STATUSES.has(result!.status)) {
        const verdict = adjudicateRedirect(
          url,
          result!.headers['location'],
          hops,
          governedHost!,
          policy,
        );
        if (!verdict.follow) refuse(verdict.kind, verdict.reason);
        url = verdict.nextUrl;
        hops += 1;
        redirectChain.push(verdict.nextUrl);
        carryHeaders = !verdict.dropAllHeaders;
        continue;
      }

      /* ── 7 · THE LENGTH, AFTER THE BODY ────────────────────────────────── */
      const length = adjudicateContentLength(
        result!.headers['content-length'],
        result!.bytes.byteLength,
        policy,
      );
      if (!length.ok) refuse(length.kind, length.reason);

      /* ── 8 · REPORTED, NEVER JUDGED ────────────────────────────────────────
         The status and the media type are carried out as measured fact. This driver
         fails only on a `TransportFailureKind`: refusing on a media type here would
         convert a PERMANENT admission refusal into a retryable transport failure, and
         the producer would go back to a host that is permanently serving the wrong
         thing. `SAFE_FETCH_MAY_NOT_REACH_AN_ADMISSION_VERDICT`. */
      return {
        status: result!.status,
        finalUrl: finalUrlFor(url),
        headers: result!.headers,
        wireBytes: result!.bytes,
        redirectChain,
      };
    }
  };
}
