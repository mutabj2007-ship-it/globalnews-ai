/**
 * ════════════════════════════════════════════════════════════════════════════
 * OFFICIAL ARTIFACT SAFE FETCH — THE `WireFetch` SECURITY CONTRACT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * E1-OFFICIAL-ARTIFACT-SAFE-FETCH-R1. Reconciles E1-BETA-SECURITY-GATES-R3 §B onto the
 * seam that is already in the tree, and adds the five controls §B did not cover because
 * §B was written for RSS feeds and this is an artifact retrieval.
 *
 * ── THE SEAM IS NOT NEW, AND IS NOT REOPENED ──────────────────────────────
 *
 * `backend/src/modules/official-data/official-data-transport.node.ts` already declares
 * the exact shape the safe fetch must satisfy, and already names §B as the thing to
 * supply:
 *
 *     export type WireFetch = (
 *       request: OfficialDataTransportRequest,
 *       signal: AbortSignal,
 *     ) => Promise<WireResponse>;
 *
 * So this contract implements that type and nothing wider. It does NOT re-author:
 * `decodePermittedEncoding` (the decompression bound), `captureAllowedHeaders` (the
 * response-header allowlist), `classifyContentType` / `ALPHA_ADMITTED_MEDIA_TYPES` (the
 * media-type allowlist), or `TRANSPORT_FAILURE_KINDS`. Those are landed and accepted.
 * Re-implementing any of them here is the two-tables drift, and a second copy of a cap
 * is a cap that will disagree with the first one.
 *
 * ── THIS MODULE CANNOT FETCH, AND THAT IS THE POINT ───────────────────────
 *
 * There is no `node:net`, no `node:https`, no `fetch` and no socket anywhere below.
 * Every network primitive is an INJECTED function declared as a type. The whole file is
 * policy: address classification, redirect adjudication, cap arithmetic, content-length
 * adjudication. A module with no path to a socket cannot activate a provider by
 * accident, which is the same reasoning the transport port already applies — and it is
 * what lets every rule here be proven without a network.
 */

/* ══════════════════════════════════════════════════════════════════════════
 * 0 · WHAT THIS CONTRACT BORROWS RATHER THAN DECLARES
 * ══════════════════════════════════════════════════════════════════════════ */

/*
 * ── LANDED: THE BORROWED TYPES ARE NOW THE REAL ONES ──────────────────────
 *
 * ALPHA MAJOR CONVERGENCE R1. The contract mirrored these shapes so it could be
 * read standalone, with its own note that *"Code imports the real one."* This is
 * Code, so it does. Importing rather than restating is the same rule the contract
 * applies to the caps: a second copy of a type is a type that will disagree with
 * the first one.
 */
import type { TransportFailureKind } from '@globalnews-ai/shared';
import type {
  OfficialDataTransportRequest,
} from '@globalnews-ai/shared';
import type { WireResponse } from './official-data-transport.node';

export type { TransportFailureKind, OfficialDataTransportRequest, WireResponse };

/* ══════════════════════════════════════════════════════════════════════════
 * 1 · THE POLICY — ONE FROZEN OBJECT, BUILT FROM THE LANDED CAPS
 * ══════════════════════════════════════════════════════════════════════════
 *
 * The wire cap is NOT re-declared here. `SNAPSHOT_WIRE_BYTE_CAP` is landed at 4 MiB and
 * the safe fetch streams under THAT number, so the byte the evaluator would refuse is a
 * byte the fetch never accepted. Two caps that agree today are two caps that will
 * disagree the day one of them moves.
 */
export interface SafeFetchPolicy {
  /** MUST be `SNAPSHOT_WIRE_BYTE_CAP`, passed in, never re-declared. */
  readonly wireByteCap: number;
  /** §B. Three is the accepted number and it is a policy refusal, not a retryable one. */
  readonly maxRedirectHops: number;
  /** Whole-exchange deadline, including DNS, TLS, every hop and the body. */
  readonly totalDeadlineMs: number;
  /** Per-hop deadline, so one slow hop cannot consume the whole budget silently. */
  readonly perHopDeadlineMs: number;
  /** The one scheme. `http:` is not a downgrade case, it is simply not admitted. */
  readonly admittedScheme: 'https:';
  /** Hostnames refused BY NAME, before any resolution. Matched as suffixes. */
  readonly deniedHostSuffixes: readonly string[];
  /** The app's own origins. A fetch into your own API from inside the boundary is SSRF. */
  readonly ownOrigins: readonly string[];
}

export const SAFE_FETCH_DENIED_HOST_SUFFIXES: readonly string[] = [
  '.railway.internal',
  '.internal',
  '.local',
  '.localdomain',
  'localhost',
  '.cluster.local',
];

/* ══════════════════════════════════════════════════════════════════════════
 * 2 · ADDRESS CLASSIFICATION — THE SSRF CORE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Every address the resolver returns is classified. Not the first — EVERY one. A name
 * that resolves to one public and one loopback address is refused on the loopback,
 * because the client is free to try them in any order and will eventually try that one.
 */
export type AddressVerdict =
  | { readonly admitted: true }
  | { readonly admitted: false; readonly reason: string };

const ADMITTED: AddressVerdict = Object.freeze({ admitted: true as const });
const refusedAddress = (reason: string): AddressVerdict =>
  Object.freeze({ admitted: false as const, reason });

function parseIPv4(text: string): readonly number[] | null {
  const parts = text.split('.');
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const value = Number(part);
    if (value > 255) return null;
    octets.push(value);
  }
  return octets;
}

/** IPv4 ranges that are never a governed publisher. */
function classifyIPv4(o: readonly number[]): AddressVerdict {
  const [a, b] = [o[0] as number, o[1] as number];
  if (a === 0) return refusedAddress('IPV4_THIS_NETWORK');
  if (a === 10) return refusedAddress('IPV4_PRIVATE_10');
  if (a === 127) return refusedAddress('IPV4_LOOPBACK');
  if (a === 100 && b >= 64 && b <= 127) return refusedAddress('IPV4_CGNAT');
  if (a === 169 && b === 254) return refusedAddress('IPV4_LINK_LOCAL_INCLUDING_METADATA');
  if (a === 172 && b >= 16 && b <= 31) return refusedAddress('IPV4_PRIVATE_172');
  if (a === 192 && b === 0) return refusedAddress('IPV4_IETF_PROTOCOL_ASSIGNMENTS');
  if (a === 192 && b === 168) return refusedAddress('IPV4_PRIVATE_192');
  if (a === 198 && (b === 18 || b === 19)) return refusedAddress('IPV4_BENCHMARK');
  if (a === 192 && b === 88) return refusedAddress('IPV4_6TO4_RELAY_ANYCAST');
  if ((a === 192 && b === 0) || (a === 198 && b === 51) || (a === 203 && b === 0)) {
    return refusedAddress('IPV4_TEST_NET');
  }
  if (a >= 224 && a <= 239) return refusedAddress('IPV4_MULTICAST');
  if (a >= 240) return refusedAddress('IPV4_RESERVED_OR_BROADCAST');
  return ADMITTED;
}

/**
 * IPv6, INCLUDING THE EMBEDDED-IPv4 FORMS, WHICH ARE THE CLASSIC BYPASS.
 *
 * `::ffff:127.0.0.1` is loopback wearing an IPv6 costume. So is `::127.0.0.1`,
 * `64:ff9b::7f00:1` (NAT64) and `2002:7f00:0001::` (6to4). In each case the embedded
 * IPv4 is EXTRACTED and re-classified — checking the IPv6 text alone admits all four.
 */
export function classifyAddress(address: string): AddressVerdict {
  const text = address.trim().toLowerCase();
  if (text === '') return refusedAddress('EMPTY_ADDRESS');

  const v4 = parseIPv4(text);
  if (v4 !== null) return classifyIPv4(v4);

  if (!text.includes(':')) return refusedAddress('UNPARSEABLE_ADDRESS');

  /* IPv4-mapped / IPv4-compatible, in dotted form: ::ffff:127.0.0.1 or ::127.0.0.1 */
  const dotted = text.match(/^::(?:ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (dotted) {
    const embedded = parseIPv4(dotted[1] as string);
    if (embedded === null) return refusedAddress('UNPARSEABLE_EMBEDDED_IPV4');
    const verdict = classifyIPv4(embedded);
    return verdict.admitted ? verdict : refusedAddress(`EMBEDDED_${verdict.reason}`);
  }

  const groups = text.split(':');
  const hex = (g: string | undefined): number => (g === undefined || g === '' ? 0 : parseInt(g, 16));

  /* IPv4-mapped in hex form: ::ffff:7f00:1 */
  const ffffAt = groups.indexOf('ffff');
  if (ffffAt !== -1 && groups.length >= ffffAt + 3 && text.startsWith('::')) {
    const hi = hex(groups[ffffAt + 1]);
    const lo = hex(groups[ffffAt + 2]);
    const verdict = classifyIPv4([hi >> 8, hi & 0xff, lo >> 8, lo & 0xff]);
    if (!verdict.admitted) return refusedAddress(`EMBEDDED_${verdict.reason}`);
  }

  /* NAT64 well-known prefix 64:ff9b::/96 — the embedded IPv4 is the last 32 bits. */
  if (text.startsWith('64:ff9b:')) {
    const tail = groups.slice(-2);
    const hi = hex(tail[0]);
    const lo = hex(tail[1]);
    const verdict = classifyIPv4([hi >> 8, hi & 0xff, lo >> 8, lo & 0xff]);
    if (!verdict.admitted) return refusedAddress(`NAT64_EMBEDDED_${verdict.reason}`);
    return refusedAddress('NAT64_PREFIX_NOT_A_GOVERNED_PUBLISHER');
  }

  /* 6to4 2002::/16 — the embedded IPv4 is the next 32 bits. */
  if (groups[0] === '2002') {
    const hi = hex(groups[1]);
    const lo = hex(groups[2]);
    const verdict = classifyIPv4([hi >> 8, hi & 0xff, lo >> 8, lo & 0xff]);
    if (!verdict.admitted) return refusedAddress(`SIXTOFOUR_EMBEDDED_${verdict.reason}`);
    return refusedAddress('SIXTOFOUR_PREFIX_NOT_A_GOVERNED_PUBLISHER');
  }

  if (text === '::' || text === '::0') return refusedAddress('IPV6_UNSPECIFIED');
  if (text === '::1') return refusedAddress('IPV6_LOOPBACK');
  const first = hex(groups[0]);
  if ((first & 0xfe00) === 0xfc00) return refusedAddress('IPV6_UNIQUE_LOCAL');
  if ((first & 0xffc0) === 0xfe80) return refusedAddress('IPV6_LINK_LOCAL');
  if (first === 0x2001 && hex(groups[1]) === 0x0db8) return refusedAddress('IPV6_DOCUMENTATION');
  if ((first & 0xff00) === 0xff00) return refusedAddress('IPV6_MULTICAST');
  return ADMITTED;
}

/** EVERY address, not the first. One refusal refuses the name. */
export function classifyResolvedSet(addresses: readonly string[]): AddressVerdict {
  if (addresses.length === 0) return refusedAddress('RESOLVED_TO_NOTHING');
  for (const address of addresses) {
    const verdict = classifyAddress(address);
    if (!verdict.admitted) return refusedAddress(`${verdict.reason} (${address})`);
  }
  return ADMITTED;
}

/* ══════════════════════════════════════════════════════════════════════════
 * 3 · THE URL GATE — BEFORE ANY RESOLUTION
 * ══════════════════════════════════════════════════════════════════════════ */

export type UrlVerdict =
  | { readonly admitted: true; readonly hostname: string; readonly port: number }
  | { readonly admitted: false; readonly kind: TransportFailureKind; readonly reason: string };

export function assertUrlIsFetchable(
  rawUrl: string,
  governedHost: string,
  policy: SafeFetchPolicy,
): UrlVerdict {
  const refuse = (reason: string): UrlVerdict =>
    Object.freeze({ admitted: false as const, kind: 'ADDRESS_REFUSED' as const, reason });

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return refuse('URL_UNPARSEABLE');
  }
  if (url.protocol !== policy.admittedScheme) return refuse(`SCHEME_NOT_ADMITTED:${url.protocol}`);
  if (url.username !== '' || url.password !== '') return refuse('USERINFO_PRESENT');

  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (hostname === '') return refuse('HOST_EMPTY');
  if (hostname.startsWith('[')) return refuse('LITERAL_IPV6_HOST_NOT_ADMITTED');
  if (parseIPv4(hostname) !== null) return refuse('LITERAL_IPV4_HOST_NOT_ADMITTED');

  for (const suffix of policy.deniedHostSuffixes) {
    if (hostname === suffix || hostname.endsWith(suffix)) {
      return refuse(`HOST_DENIED_BY_NAME:${suffix}`);
    }
  }
  for (const origin of policy.ownOrigins) {
    if (hostname === origin.toLowerCase()) return refuse('HOST_IS_OUR_OWN_ORIGIN');
  }

  /*
    THE GOVERNED-HOST COMPARISON, AND IT IS EXACT.

    The registry names the host. A subdomain of it is a DIFFERENT host and is refused —
    `files.statistics.gov.rw` is not `statistics.gov.rw`, and a publisher that starts
    serving artifacts from a subdomain is a registry change, not a fetch-time inference.
  */
  if (hostname !== governedHost.toLowerCase()) {
    return refuse(`HOST_NOT_THE_GOVERNED_HOST:${hostname}`);
  }

  const port = url.port === '' ? 443 : Number(url.port);
  if (port !== 443) return refuse(`PORT_NOT_ADMITTED:${port}`);

  return Object.freeze({ admitted: true as const, hostname, port });
}

/* ══════════════════════════════════════════════════════════════════════════
 * 4 · REDIRECTS — EVERY HOP IS A NEW FETCH
 * ══════════════════════════════════════════════════════════════════════════ */

export type RedirectVerdict =
  | { readonly follow: true; readonly nextUrl: string; readonly dropAllHeaders: boolean }
  | { readonly follow: false; readonly kind: TransportFailureKind; readonly reason: string };

export function adjudicateRedirect(
  fromUrl: string,
  locationHeader: string | undefined,
  hopsTaken: number,
  governedHost: string,
  policy: SafeFetchPolicy,
): RedirectVerdict {
  const refuse = (kind: TransportFailureKind, reason: string): RedirectVerdict =>
    Object.freeze({ follow: false as const, kind, reason });

  if (locationHeader === undefined || locationHeader.trim() === '') {
    return refuse('REDIRECT_REFUSED', 'REDIRECT_WITHOUT_LOCATION');
  }
  if (hopsTaken >= policy.maxRedirectHops) {
    return refuse('REDIRECT_REFUSED', `HOP_LIMIT_EXCEEDED:${policy.maxRedirectHops}`);
  }

  let next: URL;
  try {
    next = new URL(locationHeader, fromUrl);
  } catch {
    return refuse('REDIRECT_REFUSED', 'LOCATION_UNPARSEABLE');
  }

  const from = new URL(fromUrl);
  if (from.protocol === 'https:' && next.protocol !== 'https:') {
    return refuse('REDIRECT_REFUSED', `SCHEME_DOWNGRADE:${next.protocol}`);
  }

  /*
    THE HOP RE-RUNS THE WHOLE URL GATE, INCLUDING THE GOVERNED-HOST COMPARISON.

    This is the rule the Product Owner named as "no redirect to an ungoverned host", and
    it is stricter than §B's feed case on purpose: a feed may legitimately redirect to a
    CDN, an official artifact may not redirect off the host the registry named. A
    publisher that moves its artifacts is a REGISTRY event — which is exactly the
    `SUPERSEDED_HOST` finding from the East Africa round, arriving as a 301.
  */
  const gate = assertUrlIsFetchable(next.toString(), governedHost, policy);
  if (!gate.admitted) return refuse('REDIRECT_REFUSED', `HOP_${gate.reason}`);

  const crossOrigin =
    next.hostname.toLowerCase() !== from.hostname.toLowerCase() ||
    next.protocol !== from.protocol ||
    next.port !== from.port;

  return Object.freeze({
    follow: true as const,
    nextUrl: next.toString(),
    dropAllHeaders: crossOrigin,
  });
}

/* ══════════════════════════════════════════════════════════════════════════
 * 5 · CONTENT-LENGTH — THE TWO DIRECTIONS ARE DIFFERENT FACTS
 * ══════════════════════════════════════════════════════════════════════════
 *
 * A short read and a long read are not one condition with a sign. A short read is a
 * connection that ended early — truncation, a proxy giving up, a flaky link — and it is
 * RETRYABLE. A long read is a server sending more octets than it declared, which is
 * never benign, and the extra octets are refused rather than accepted.
 *
 * Neither is minted as a new `TransportFailureKind`. Both map onto landed kinds whose
 * retry semantics are already correct, because adding a kind to an accepted union is a
 * contract change and this does not need one.
 */
export type LengthVerdict =
  | { readonly ok: true }
  | { readonly ok: false; readonly kind: TransportFailureKind; readonly reason: string };

export function adjudicateContentLength(
  declaredHeader: string | undefined,
  receivedBytes: number,
  policy: SafeFetchPolicy,
): LengthVerdict {
  const fail = (kind: TransportFailureKind, reason: string): LengthVerdict =>
    Object.freeze({ ok: false as const, kind, reason });

  if (receivedBytes > policy.wireByteCap) {
    return fail('ABORTED_BY_CAP', `WIRE_CAP_EXCEEDED:${receivedBytes}>${policy.wireByteCap}`);
  }
  if (declaredHeader === undefined || declaredHeader.trim() === '') {
    /* Chunked, or simply absent. The cap is the only bound and it already applied. */
    return Object.freeze({ ok: true as const });
  }
  if (!/^\d+$/.test(declaredHeader.trim())) {
    return fail('CONNECT_FAILURE', `CONTENT_LENGTH_MALFORMED:${declaredHeader}`);
  }
  const declared = Number(declaredHeader.trim());
  if (declared > policy.wireByteCap) {
    /* Refused on the DECLARATION, before a byte is read. */
    return fail('ABORTED_BY_CAP', `DECLARED_LENGTH_EXCEEDS_CAP:${declared}`);
  }
  if (receivedBytes < declared) {
    return fail('CONNECT_FAILURE', `SHORT_READ:${receivedBytes}<${declared}`);
  }
  if (receivedBytes > declared) {
    return fail('ABORTED_BY_CAP', `OVERLONG_READ:${receivedBytes}>${declared}`);
  }
  return Object.freeze({ ok: true as const });
}

/* ══════════════════════════════════════════════════════════════════════════
 * 6 · THE INJECTED PRIMITIVES — DECLARED, NEVER OWNED
 * ══════════════════════════════════════════════════════════════════════════ */

/** Returns EVERY address for the name. A resolver that returns one is not sufficient. */
export type AddressResolver = (hostname: string, signal: AbortSignal) => Promise<readonly string[]>;

/**
 * Connects to a VALIDATED IP and sends the ORIGINAL `Host`.
 *
 * Step 7 of §B and the whole DNS-rebinding defence: validating a hostname and then
 * handing that hostname to an HTTP client lets the resolver answer public at check time
 * and loopback at connect time. The signature takes an `address`, not a hostname, so an
 * implementation that re-resolves does not typecheck against it.
 *
 * `tlsServerName` is the HOSTNAME, so certificate verification is against the name the
 * registry governs and not against an IP. TLS verification is not a parameter of this
 * contract: there is no flag to disable it, which is how it stays always on.
 */
export interface AddressBoundRequest {
  readonly address: string;
  readonly port: number;
  readonly tlsServerName: string;
  readonly hostHeader: string;
  readonly path: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly byteCap: number;
  readonly deadlineMs: number;
}
export interface AddressBoundResult {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly bytes: Uint8Array;
  readonly capHit: boolean;
}
export type AddressBoundConnector = (
  request: AddressBoundRequest,
  signal: AbortSignal,
) => Promise<AddressBoundResult>;

/* ══════════════════════════════════════════════════════════════════════════
 * 7 · CREDENTIALS — BOUND TO AN ORIGIN, NOT DROPPED ON A HOP
 * ══════════════════════════════════════════════════════════════════════════
 *
 * §B says a cross-host hop drops every header. That is necessary and it is not
 * sufficient: "drop on cross-host" is a rule about the SECOND request, so it is one
 * forgotten branch away from a credential travelling. The stronger construction is that
 * a credential is only ever ATTACHED to the exact origin the registry binds it to, so
 * there is no branch in which it travels — a redirect to the same host on a different
 * port or scheme carries nothing, without anyone having remembered to remove it.
 */
export interface OriginBoundCredential {
  readonly providerId: string;
  /** scheme://host:port, exact. */
  readonly origin: string;
  readonly headerName: string;
  readonly headerValue: string;
}

export function credentialHeadersFor(
  credential: OriginBoundCredential | undefined,
  targetUrl: string,
): Readonly<Record<string, string>> {
  if (credential === undefined) return Object.freeze({});
  const target = new URL(targetUrl);
  const targetOrigin = `${target.protocol}//${target.hostname}:${target.port === '' ? '443' : target.port}`;
  if (targetOrigin !== credential.origin) return Object.freeze({});
  return Object.freeze({ [credential.headerName]: credential.headerValue });
}

/* ══════════════════════════════════════════════════════════════════════════
 * 8 · WHAT THE SAFE FETCH MAY NOT DECIDE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * The transport reports; it does not judge. `MeasuringOfficialDataTransport` says so and
 * the admission evaluator is the one component allowed to reach a verdict.
 *
 * So the safe fetch refuses ONLY on `TransportFailureKind`. It must NOT refuse on media
 * type, however obviously wrong the type is, because `MEDIA_TYPE_NOT_ALLOWED` is graded
 * PERMANENT by the snapshot authority while `CONNECT_FAILURE` and `TIMEOUT` are
 * retryable — a transport that refused on type would convert a permanent admission
 * refusal into a retryable transport failure, and the producer would go back to a host
 * that is permanently serving the wrong thing.
 *
 * The `Accept` header is where the media-type allowlist belongs INSIDE the fetch: it is
 * supplied by the governed request, it is a request for the right thing, and it is not
 * a verdict about the answer.
 */
export const SAFE_FETCH_MAY_NOT_REACH_AN_ADMISSION_VERDICT = true as const;

/** The exact final resolved URL carries the HOSTNAME, never the validated IP. */
export function finalUrlFor(lastRequestedUrl: string): string {
  const url = new URL(lastRequestedUrl);
  if (parseIPv4(url.hostname) !== null || url.hostname.startsWith('[')) {
    throw new Error('FINAL_URL_CARRIES_AN_ADDRESS: the final URL states the governed hostname.');
  }
  return url.toString();
}
