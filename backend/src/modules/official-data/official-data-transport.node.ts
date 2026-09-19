import { gunzipSync } from 'node:zlib';

import {
  captureAllowedHeaders,
  decodePermittedEncoding,
  normaliseContentEncoding,
  OfficialDataTransportFailure,
  type GunzipFn,
  type OfficialDataTransportEvidence,
  type OfficialDataTransportRequest,
  type OfficialDataTransport,
} from '@globalnews-ai/shared';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE NODE SIDE OF THE CANONICAL TRANSPORT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ALPHA-OFFICIAL-DATA-CANONICAL-ADMISSION-R1 · §1.
 *
 * `shared` is bundled into the frontend, so it cannot `import 'node:zlib'`. The
 * decompression primitive therefore lives here and is INJECTED into the shared decode
 * policy — the caps and the ratio bound stay in `shared`, where the rule belongs, and
 * only the mechanism is platform-specific.
 *
 * ── WHAT THIS FILE DELIBERATELY DOES NOT CONTAIN ──────────────────────────
 *
 * There is NO production `fetch`. `MeasuringOfficialDataTransport` is given a
 * `WireFetch` and can do nothing the injected function does not do for it, which is the
 * same reasoning G applied to the Market port: a package with no path to a real request
 * cannot activate a provider by accident, and "no provider activation" becomes a
 * property of the code rather than a promise in a document.
 *
 * The real implementation supplied later is E1-BETA-SECURITY-GATES-R3 §B's safe fetch,
 * unmodified — scheme allowlist, userinfo/port rejection, hostname denylist, resolve,
 * VALIDATE EVERY RETURNED ADDRESS, connect to the validated IP, stream caps, repeated
 * for every redirect. This file does not reopen any of it (E1 · §10: transport is not
 * reopened) and adds only the evidentiary measurement the admission gate needs.
 */

/**
 * gzip with a HARD OUTPUT BOUND.
 *
 * `maxOutputLength` makes zlib abort DURING inflation rather than after it, which is
 * what E1 · T-7 requires: a 1 KiB body that expands past the cap must be aborted
 * mid-decompression, not expanded to completion and then measured. By the time you can
 * measure it, the memory the cap exists to protect has already been allocated.
 */
export const nodeGunzip: GunzipFn = (input: Uint8Array, maxOutputBytes: number): Uint8Array => {
  const out = gunzipSync(Buffer.from(input), { maxOutputLength: maxOutputBytes });
  return new Uint8Array(out.buffer, out.byteOffset, out.byteLength);
};

/**
 * The raw result of one HTTP exchange, as the safe fetch reports it.
 *
 * Note that it carries BYTES, not a string. A transport that handed over text would
 * have already made the UTF-8 decision — and the lenient decode substitutes U+FFFD,
 * which changes the bytes whose hash becomes the content address. The exact octets
 * survive all the way to the store.
 */
export interface WireResponse {
  readonly status: number;
  readonly finalUrl: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly wireBytes: Uint8Array;
  readonly redirectChain: readonly string[];
}

export type WireFetch = (
  request: OfficialDataTransportRequest,
  signal: AbortSignal,
) => Promise<WireResponse>;

/** Where each governed provider is allowed to have come from. Compared, never derived. */
export type ProviderHostResolver = (providerId: string) => string | undefined;

/**
 * Turns one wire exchange into `OfficialDataTransportEvidence`.
 *
 * Every field is MEASURED here and forwarded unchanged thereafter. This is the component
 * G identified as missing: an adapter is handed a decoded body and has never seen the
 * wire, so anything it stated about the wire would be a reconstruction presented as a
 * measurement.
 */
export class MeasuringOfficialDataTransport implements OfficialDataTransport {
  constructor(
    private readonly wireFetch: WireFetch,
    private readonly resolveHost: ProviderHostResolver,
    private readonly now: () => string,
  ) {}

  async fetch(
    request: OfficialDataTransportRequest,
    signal: AbortSignal,
  ): Promise<OfficialDataTransportEvidence> {
    const configuredHost = this.resolveHost(request.providerId);
    if (configuredHost === undefined) {
      /*
        A provider with no configured host is not a provenance refusal — there is nothing
        to compare against, and issuing the request to find out would be the mistake. It
        fails BEFORE the network, which is also what makes the allowlist meaningful:
        §8's "no caller-supplied arbitrary URL" holds because a caller that cannot name a
        governed provider never reaches the fetch at all.
      */
      throw new OfficialDataTransportFailure(
        'ADDRESS_REFUSED',
        request.providerId,
        'no configured host for this provider; the request is not issued',
      );
    }

    const requestedAt = this.now();
    const wire = await this.wireFetch(request, signal);
    const retrievedAt = this.now();

    const headers = captureAllowedHeaders(wire.headers);
    const encoding = normaliseContentEncoding(wire.headers['content-encoding']);

    /*
      The decode happens here so `decodedBytes` is available to the rest of the pipeline,
      using the SAME shared `decodePermittedEncoding` the evaluator calls. When it
      refuses — an unsupported encoding, a bomb — the WIRE BYTES are carried forward
      unchanged and the evaluator issues the refusal.

      The transport does not refuse on its own account, because a refusal is a verdict
      and there is exactly one component allowed to reach one.
    */
    const decode = decodePermittedEncoding(wire.wireBytes, encoding.contentEncoding, nodeGunzip);

    return {
      providerId: request.providerId,
      endpointId: request.endpointId,
      finalUrl: wire.finalUrl,
      configuredHost,
      redirectChain: wire.redirectChain,
      httpStatus: wire.status,
      requestedAt,
      retrievedAt,
      contentTypeHeader: headers['content-type'] ?? '',
      contentEncoding: encoding.contentEncoding,
      contentEncodingHeaderPresent: encoding.present,
      wireByteLength: wire.wireBytes.byteLength,
      wireBytes: wire.wireBytes,
      decodedBytes: decode.ok ? decode.decodedBytes : wire.wireBytes,
      headers,
    };
  }
}
