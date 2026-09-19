/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE CANONICAL OFFICIAL-DATA TRANSPORT — FACTS AN ADAPTER CANNOT INVENT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ALPHA-OFFICIAL-DATA-CANONICAL-ADMISSION-R1 · §1.
 *
 * ── THE PROBLEM THIS SOLVES, STATED PRECISELY ─────────────────────────────
 *
 * `SnapshotAdmissionRecord.transport` is EVIDENCE ABOUT THE WIRE: the octet count before
 * decode, and the `Content-Encoding` that was actually received. G's Market lane found
 * the structural reason an adapter must not supply them — it is handed a decoded body
 * and HAS NEVER SEEN THE WIRE. Any value it produced would be a reconstruction presented
 * as a measurement.
 *
 * So the transport measures, and the adapter forwards. Everything on
 * `OfficialDataTransportEvidence` is a thing only the component that performed the fetch
 * can truthfully state.
 *
 * ── THE ABSENT-HEADER RULE, DECIDED ONCE AND HERE ─────────────────────────
 *
 * An absent `Content-Encoding` means `identity` — RFC 9110 §8.4 — and that decision is
 * made in ONE place, at the moment of measurement, rather than defaulted by whoever
 * happens to read the header later.
 *
 * The distinction matters more than it looks. If each consumer defaults it, then one
 * consumer deciding "absent means unknown, refuse" and another deciding "absent means
 * identity, proceed" is a DISAGREEMENT ABOUT WHAT THE PUBLISHER SENT, reached without
 * anyone editing a rule. `normaliseContentEncoding` exists so the question is answered
 * before the value is ever stored, and so a stored `'identity'` always means the same
 * thing regardless of whether the header was present.
 *
 * The real captures make this concrete: the accepted Eurostat D-2 captures carry NO
 * `Content-Encoding` header at all, and must still be admissible.
 */

import {
  ALPHA_ADMITTED_CONTENT_ENCODINGS,
  SNAPSHOT_DECODED_BYTE_CAP,
  SNAPSHOT_MAX_COMPRESSION_RATIO,
  SNAPSHOT_WIRE_BYTE_CAP,
  type AdmittedContentEncoding,
  type SnapshotRefusalKey,
} from './snapshot-admission';

/**
 * What an absent `Content-Encoding` header means. RFC 9110 §8.4.
 *
 * Exported as a NAMED CONSTANT rather than written as a bare `'identity'` at the one
 * call site, because the value is a RULE and a rule wants a name that can be searched
 * for, cited in a review and asserted against in a test.
 */
export const CANONICAL_ABSENT_CONTENT_ENCODING: AdmittedContentEncoding = 'identity';

/**
 * The governed request. There is no free-text URL: the transport is given a provider and
 * an endpoint that the registry already approved, plus the query it resolved.
 *
 * §8 — "no caller-supplied arbitrary URL". A caller that cannot name a host cannot reach
 * one, which is a stronger statement than validating a URL it was handed.
 */
export interface OfficialDataTransportRequest {
  readonly providerId: string;
  readonly endpointId: string;
  /** Resolved by the governed registry from `providerId` + `endpointId`. */
  readonly url: string;
  readonly accept: string;
  /** Deterministic: no timestamp, nonce or client-generated id. */
  readonly query: Readonly<Record<string, string>>;
}

/**
 * Everything the admission evaluator is allowed to treat as measured fact.
 *
 * Note what is NOT here: no verdict, no refusal key, no notion of admissibility. The
 * transport reports; it does not judge. Keeping the two apart is what makes it possible
 * to say there is exactly one admission authority.
 */
export interface OfficialDataTransportEvidence {
  readonly providerId: string;
  readonly endpointId: string;

  /** The URL the response actually came from, AFTER every redirect. */
  readonly finalUrl: string;
  /** The host the registry says this provider is. Compared, never derived from the response. */
  readonly configuredHost: string;
  /** Hosts traversed, in order, for audit. */
  readonly redirectChain: readonly string[];

  readonly httpStatus: number;
  readonly requestedAt: string;
  readonly retrievedAt: string;

  /** `Content-Type` verbatim and unparsed, exactly as received. */
  readonly contentTypeHeader: string;
  /**
   * Already normalised by `normaliseContentEncoding`: an absent header is `'identity'`
   * by the canonical rule above, not by a downstream guess.
   */
  readonly contentEncoding: string;
  /** Whether the header was physically present — kept because the two cases differ in audit. */
  readonly contentEncodingHeaderPresent: boolean;

  /** Octets on the wire, before decode. */
  readonly wireByteLength: number;
  /**
   * THE OCTETS THEMSELVES, before decode.
   *
   * Carried because the admission evaluator performs its own bounded decode from these.
   * Handing it only the decoded bytes would mean the decompression caps were enforced
   * solely by whoever implemented the transport — and a cap the authority cannot check
   * is a cap that holds until someone writes a second transport.
   */
  readonly wireBytes: Uint8Array;
  /**
   * Bytes after PERMITTED `Content-Encoding` removal AND NOTHING ELSE.
   *
   * This is what SR-1 hashes. Never a re-encoded string: a body that is not valid UTF-8
   * would round-trip through `string` with U+FFFD substituted, changing the content
   * address of the thing being stored. Bytes in, bytes out.
   *
   * Produced by `decodePermittedEncoding` — the SAME function the evaluator calls, so
   * the two cannot disagree about what "decoded" means.
   */
  readonly decodedBytes: Uint8Array;

  /**
   * Response headers, ALLOWLISTED. E1 · C-1 — captured from a list, never wholesale, so
   * `Set-Cookie` and `Authorization` cannot arrive by accident.
   */
  readonly headers: Readonly<Record<string, string>>;
}

/** E1 · C-1 — the capture list, and the refusal list, both stated rather than implied. */
export const CAPTURED_RESPONSE_HEADERS = [
  'content-type',
  'content-length',
  'content-encoding',
  'etag',
  'last-modified',
  'date',
] as const;

export const NEVER_CAPTURED_RESPONSE_HEADERS = [
  'set-cookie',
  'authorization',
  'proxy-authorization',
  'www-authenticate',
] as const;

/**
 * Reduce a response's headers to the allowlist.
 *
 * An ALLOWLIST rather than a denylist, and the difference is the whole control: a
 * denylist is only as good as the last time somebody thought about it, and the header a
 * provider invents next year is on it by omission.
 */
export function captureAllowedHeaders(
  raw: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const lower = k.toLowerCase();
    if ((CAPTURED_RESPONSE_HEADERS as readonly string[]).includes(lower)) out[lower] = v;
  }
  return Object.freeze(out);
}

/**
 * Apply the canonical absent-header rule and report whether the header was there.
 *
 * A multi-valued encoding (`gzip, br`) is returned VERBATIM and is therefore not in the
 * admitted set — the evaluator refuses it as `ENCODING_NOT_ALLOWED`. It is deliberately
 * not split and not partially honoured: E1 · §3 refuses "any multi-value encoding", and
 * quietly taking the first token would honour half of what the publisher said.
 */
export function normaliseContentEncoding(headerValue: string | undefined | null): {
  readonly contentEncoding: string;
  readonly present: boolean;
} {
  if (headerValue === undefined || headerValue === null || headerValue.trim() === '') {
    return { contentEncoding: CANONICAL_ABSENT_CONTENT_ENCODING, present: false };
  }
  return { contentEncoding: headerValue.trim().toLowerCase(), present: true };
}

export function contentEncodingIsAdmitted(value: string): value is AdmittedContentEncoding {
  return (ALPHA_ADMITTED_CONTENT_ENCODINGS as readonly string[]).includes(value);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * TRANSPORT FAILURE CLASSIFICATION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A transport failure is NOT an admission refusal — there is no response to adjudicate.
 * It is reported as its own outcome so the two never blur: "we could not ask" and "the
 * answer was unacceptable" have different remedies and different retry semantics.
 */

export const TRANSPORT_FAILURE_KINDS = [
  'DNS_FAILURE',
  'CONNECT_FAILURE',
  'TLS_FAILURE',
  'TIMEOUT',
  'ABORTED_BY_CAP',
  'REDIRECT_REFUSED',
  'ADDRESS_REFUSED',
] as const;
export type TransportFailureKind = (typeof TRANSPORT_FAILURE_KINDS)[number];

/** Only these may be retried; the rest are configuration or policy, and repeat identically. */
const RETRYABLE_TRANSPORT_FAILURES: readonly TransportFailureKind[] = [
  'DNS_FAILURE',
  'CONNECT_FAILURE',
  'TIMEOUT',
];

export function transportFailureMayRetry(kind: TransportFailureKind): boolean {
  return RETRYABLE_TRANSPORT_FAILURES.includes(kind);
}

export class OfficialDataTransportFailure extends Error {
  constructor(
    readonly kind: TransportFailureKind,
    readonly providerId: string,
    message: string,
  ) {
    super(`${providerId}: ${kind} — ${message}`);
    this.name = 'OfficialDataTransportFailure';
  }
}

/**
 * THE PORT. The only way the official-data pipeline reaches a network.
 *
 * No production implementation is supplied by this task, by the same reasoning G applied
 * to the Market port: a package that contains no path to a real request cannot activate
 * a provider by accident, and "no provider activation" becomes a structural property
 * rather than a promise.
 */
export interface OfficialDataTransport {
  fetch(
    request: OfficialDataTransportRequest,
    signal: AbortSignal,
  ): Promise<OfficialDataTransportEvidence>;
}

/**
 * Decompression, injected rather than imported.
 *
 * `shared` is imported by the frontend bundle, so it cannot `import 'node:zlib'`. The
 * primitive is supplied by the backend composition root. The bound and the ratio are
 * enforced HERE, around whatever implementation is passed, so a caller cannot supply a
 * gunzip that forgets them.
 */
export type GunzipFn = (input: Uint8Array, maxOutputBytes: number) => Uint8Array;

export type DecodeOutcome =
  | { readonly ok: true; readonly decodedBytes: Uint8Array }
  | { readonly ok: false; readonly refusalKey: SnapshotRefusalKey; readonly detail: string };

/**
 * Remove a PERMITTED `Content-Encoding` and nothing else — SR-1's definition of
 * "decoded", enforced rather than described.
 *
 * The caps are checked in the order E1 · §4 gives them, and the order is load-bearing:
 * the WIRE cap (step 6) is checked before any decode is attempted, so a decompression
 * bomb is refused on its compressed size before a single byte is expanded.
 */
export function decodePermittedEncoding(
  wireBytes: Uint8Array,
  contentEncoding: string,
  gunzip: GunzipFn,
): DecodeOutcome {
  if (wireBytes.byteLength > SNAPSHOT_WIRE_BYTE_CAP) {
    return { ok: false, refusalKey: 'SIZE_EXCEEDED', detail: 'WIRE_CAP_EXCEEDED' };
  }

  if (!contentEncodingIsAdmitted(contentEncoding)) {
    // `br`, `deflate`, `compress` and any multi-value header land here (T-9).
    return { ok: false, refusalKey: 'ENCODING_NOT_ALLOWED', detail: 'ENCODING_NOT_IN_ALLOWLIST' };
  }

  if (contentEncoding === 'identity') {
    if (wireBytes.byteLength > SNAPSHOT_DECODED_BYTE_CAP) {
      return { ok: false, refusalKey: 'SIZE_EXCEEDED', detail: 'DECODED_CAP_EXCEEDED' };
    }
    return { ok: true, decodedBytes: wireBytes };
  }

  /*
    THE RATIO CAP IS APPLIED AS A BOUND ON THE OUTPUT, NOT AS A CHECK AFTER IT.

    E1 · T-7 requires the abort to happen DURING decompression. A gunzip that produces
    the full output and is then measured has already allocated the memory the cap exists
    to prevent — so the cap is passed INTO the primitive as its output limit, and the
    tighter of the two bounds is the one handed over.
  */
  const ratioBound = wireBytes.byteLength * SNAPSHOT_MAX_COMPRESSION_RATIO;
  const bound = Math.min(SNAPSHOT_DECODED_BYTE_CAP, ratioBound);

  let decodedBytes: Uint8Array;
  try {
    decodedBytes = gunzip(wireBytes, bound);
  } catch {
    return {
      ok: false,
      refusalKey: 'DECOMPRESSION_BOUND_EXCEEDED',
      detail: 'DECOMPRESSION_ABORTED_AT_BOUND',
    };
  }

  // Belt and braces: a primitive that ignored the bound is still caught, so the
  // guarantee does not rest on the injected implementation behaving.
  if (decodedBytes.byteLength > bound) {
    return {
      ok: false,
      refusalKey: 'DECOMPRESSION_BOUND_EXCEEDED',
      detail: 'DECOMPRESSION_EXCEEDED_BOUND',
    };
  }

  return { ok: true, decodedBytes };
}
