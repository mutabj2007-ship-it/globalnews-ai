import { TransportFailure, ValidationFailure } from '../market-ingest.scheduler';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE TRANSPORT PORT — THE ONLY WAY AN ADAPTER TOUCHES THE NETWORK
 * ════════════════════════════════════════════════════════════════════════════
 *
 * G-MARKET-PROVIDER-CONVERGENCE-R3.
 *
 * No adapter in this package constructs a socket, calls `fetch`, imports an HTTP client
 * or names a transport library. Each one is handed a `MarketHttpPort` and can do nothing
 * the port does not do for it.
 *
 * ── WHY A PORT RATHER THAN A CLIENT ───────────────────────────────────────
 *
 * Three properties fall out of it, and each is otherwise a convention someone has to
 * remember:
 *
 *   1. **The real implementation is E1 R3 contract B's safe fetch, unmodified.** SI-17.6
 *      requires that order of operations — parse, scheme allowlist, userinfo/port,
 *      hostname denylist, resolve, VALIDATE EVERY RETURNED ADDRESS, connect to the
 *      validated IP, stream caps, content type, repeated for every redirect. An adapter
 *      that cannot make its own request cannot skip a step of it.
 *   2. **A test can prove ZERO network activity**, because the port counts its calls. An
 *      assertion that "the rights gate refuses before the network" is otherwise an
 *      assertion about ordering in prose.
 *   3. **This package activates nothing.** No production implementation of this port is
 *      supplied here, so there is no code path from this package to a real request.
 */

export interface MarketHttpRequest {
  readonly method: 'GET';
  readonly url: string;
  readonly accept: string;
  /** Deterministic: a request carries no timestamp, nonce or client-generated id. */
  readonly query: Readonly<Record<string, string>>;
}

export interface MarketHttpResponse {
  readonly status: number;
  readonly contentType: string;
  readonly body: string;
  /** Verbatim response headers the adapter is allowed to read. */
  readonly headers: Readonly<Record<string, string>>;
  /** Byte length of the exact bytes received, before parsing. Feeds the snapshot seam. */
  readonly byteLength: number;
  /**
   * THE OCTETS ON THE WIRE, BEFORE DECODE, and the encoding header verbatim.
   *
   * These exist on the PORT and not on the adapter for a reason Snapshot R2 makes
   * concrete: `SnapshotAdmissionRecord.transport` is evidence about the wire, and only
   * something that performed the fetch has seen it. The adapter forwards these; it
   * never derives them, and it never supplies a default for an absent header — what an
   * absent `Content-Encoding` means is the canonical evaluator's call, not ours.
   */
  readonly wireBytes: Uint8Array;
  readonly contentEncodingHeader: string;
}

export interface MarketHttpPort {
  /**
   * Performs one request under E1 R3 contract B's order of operations.
   * `signal` is the scheduler's fetch deadline (SI-5.1) and must be honoured.
   */
  request(req: MarketHttpRequest, signal: AbortSignal): Promise<MarketHttpResponse>;
}

/**
 * SI-4.2 — only transport-class failures are retried. This is the one place that decides,
 * so two adapters cannot disagree about whether a 403 is worth asking again.
 *
 * A 403 is a publisher saying no. Retrying it is asking the same forbidden question
 * repeatedly, which is a worse thing to do than failing.
 */
export function classifyHttpStatus(status: number, providerId: string): void {
  if (status >= 200 && status < 300) return;

  if (status === 429 || status >= 500) {
    throw new TransportFailure(`${providerId}: HTTP ${status}`, status);
  }

  throw new ValidationFailure(
    `${providerId}: HTTP ${status} is terminal and is not retried — a 4xx other than 429 is the ` +
      `publisher declining, and asking again does not change the answer`,
  );
}

/** A recording fake, for tests. Never reaches a network and counts every call. */
/** Builds the wire fields for a test response from a body string. */
export function wireOf(body: string, contentEncodingHeader = 'identity'): {
  wireBytes: Uint8Array;
  contentEncodingHeader: string;
} {
  return { wireBytes: new TextEncoder().encode(body), contentEncodingHeader };
}

export class RecordingHttpPort implements MarketHttpPort {
  readonly calls: MarketHttpRequest[] = [];

  constructor(private readonly responder: (req: MarketHttpRequest) => MarketHttpResponse) {}

  async request(req: MarketHttpRequest, signal: AbortSignal): Promise<MarketHttpResponse> {
    if (signal.aborted) throw new TransportFailure('aborted before dispatch', 0);
    this.calls.push(req);
    return this.responder(req);
  }
}

/** A port that fails the test if it is ever called. Used to prove refusal-before-network. */
export class ForbiddenHttpPort implements MarketHttpPort {
  calls = 0;

  async request(): Promise<MarketHttpResponse> {
    this.calls += 1;
    throw new Error('NETWORK REACHED: this port must never be called');
  }
}
