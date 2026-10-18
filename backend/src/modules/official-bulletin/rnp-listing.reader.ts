import { createHash } from 'node:crypto';
import { OfficialDataTransportFailure } from '@globalnews-ai/shared';
import type { WireFetch } from '../official-data/official-data-transport.node';
import { parseRnpListing, RNP_HOST, type RnpListingItem } from './rnp-listing.parser';

/*
  Rwanda National Police listing — the ONE permitted read (E1 ADDENDUM-02 §3, ADDENDUM-04).

  · One GET of the listing, never a detail page. 1 MB / 10 s, redirects only on police.gov.rw — enforced by the
    injected safe-wire-fetch (exact-host redirect gate, byte cap, SSRF core). No retry on any status.
  · At most ONE poll per 30 minutes: the result — success OR failure — is cached for 30 minutes, and concurrent
    readers share one in-flight read. The listing serves no ETag/Last-Modified (measured 2026-10-18), so there is no
    conditional request to make.
  · Cookie-less: the transport has no cookie jar and sends no Cookie header; a Set-Cookie is never read.
  · robots.txt (ADDENDUM-04 §3.2): re-read before the first listing read, every 30 days, and immediately after any
    429 or 4xx. The cleared state is the measured one — 200 with an EMPTY body (Last-Modified 2023-05-07). Anything
    else (directives, 403/5xx, unreadable) STOPS the lane until a new E1 determination: unreachable is not permission.
  · Circuit: 429, 404, 410, any other 4xx, an off-host redirect or a changed robots.txt opens it for the life of the
    process. A restart costs one robots read plus one listing read (in-memory state only; nothing is persisted).

  States are the CTO R155 vocabulary. Nothing here reaches a model; the listing title never leaves the parser.
*/
export const RNP_LISTING_URL = `https://${RNP_HOST}/media/news/`;
export const RNP_ROBOTS_URL = `https://${RNP_HOST}/robots.txt`;
export const RNP_PROVIDER_ID = 'rnp';
export const RNP_POLL_INTERVAL_MS = 30 * 60 * 1000;
export const RNP_ROBOTS_RECHECK_MS = 30 * 24 * 60 * 60 * 1000;
const RNP_DEADLINE_MS = 10_000;

export type RnpReadState = 'SEARCHED' | 'UPSTREAM_FAILED' | 'RIGHTS_NOT_ADMITTED';

export interface RnpRead {
  readonly state: RnpReadState;
  /** Why, as a closed code — never upstream text. */
  readonly reason: string | null;
  readonly items: readonly RnpListingItem[];
  /** When the listing was actually read (the "checked at" a reader is shown). Null when no read succeeded. */
  readonly retrievedAt: string | null;
}

interface Cached {
  readonly at: number;
  readonly read: RnpRead;
}

export class RnpListingReader {
  private cached: Cached | null = null;
  private inFlight: Promise<RnpRead> | null = null;
  private robotsCheckedAt: number | null = null;
  private robotsDueNow = true;
  private circuit: string | null = null;

  constructor(
    private readonly wireFetch: WireFetch,
    private readonly now: () => number = Date.now,
  ) {}

  read(): Promise<RnpRead> {
    const t = this.now();
    if (this.circuit !== null) return Promise.resolve(this.failed(this.circuit.startsWith('ROBOTS') ? 'RIGHTS_NOT_ADMITTED' : 'UPSTREAM_FAILED', this.circuit));
    if (this.cached !== null && t - this.cached.at < RNP_POLL_INTERVAL_MS) return Promise.resolve(this.cached.read);
    if (this.inFlight === null) {
      this.inFlight = this.readOnce(t).finally(() => {
        this.inFlight = null;
      });
    }
    return this.inFlight;
  }

  private async readOnce(t: number): Promise<RnpRead> {
    if (this.robotsDueNow || this.robotsCheckedAt === null || t - this.robotsCheckedAt >= RNP_ROBOTS_RECHECK_MS) {
      const robots = await this.robots();
      if (robots !== null) return this.remember(t, this.open(robots, 'RIGHTS_NOT_ADMITTED'));
      this.robotsCheckedAt = t;
      this.robotsDueNow = false;
    }
    let status: number;
    let body: string;
    try {
      const response = await this.wireFetch(
        { providerId: RNP_PROVIDER_ID, endpointId: 'listing', url: RNP_LISTING_URL, accept: 'text/html', query: {} },
        AbortSignal.timeout(RNP_DEADLINE_MS),
      );
      status = response.status;
      body = new TextDecoder().decode(response.wireBytes);
    } catch (error) {
      const kind = error instanceof OfficialDataTransportFailure ? error.kind : 'CONNECT_FAILURE';
      if (/REDIRECT/.test(kind) || kind === 'ADDRESS_REFUSED') return this.remember(t, this.open(`LISTING_${kind}`, 'UPSTREAM_FAILED'));
      return this.remember(t, this.failed('UPSTREAM_FAILED', `LISTING_${kind}`));
    }
    if (status === 200) {
      const parsed = parseRnpListing(body);
      if (!parsed.listingMarkup) return this.remember(t, this.failed('UPSTREAM_FAILED', 'LISTING_UNPARSEABLE'));
      return this.remember(t, { state: 'SEARCHED', reason: null, items: parsed.items, retrievedAt: new Date(t).toISOString() });
    }
    if (status >= 400 && status < 500) {
      /* ADDENDUM-04 §3.2: robots is re-read immediately after any 4xx — on the next process start, the circuit
         being open for this one. */
      this.robotsDueNow = true;
      return this.remember(t, this.open(`LISTING_HTTP_${status}`, 'UPSTREAM_FAILED'));
    }
    return this.remember(t, this.failed('UPSTREAM_FAILED', `LISTING_HTTP_${status}`));
  }

  /** Null when robots.txt is still in its cleared state; otherwise the closed reason the lane stops on. */
  private async robots(): Promise<string | null> {
    try {
      const response = await this.wireFetch(
        { providerId: RNP_PROVIDER_ID, endpointId: 'robots', url: RNP_ROBOTS_URL, accept: 'text/plain', query: {} },
        AbortSignal.timeout(RNP_DEADLINE_MS),
      );
      if (response.status === 404) return null;
      if (response.status !== 200) return `ROBOTS_HTTP_${response.status}`;
      const text = new TextDecoder().decode(response.wireBytes);
      if (text.trim() === '') return null;
      return `ROBOTS_CHANGED_${createHash('sha256').update(text).digest('hex').slice(0, 12)}`;
    } catch (error) {
      return `ROBOTS_NOT_READABLE_${error instanceof OfficialDataTransportFailure ? error.kind : 'CONNECT_FAILURE'}`;
    }
  }

  private open(reason: string, state: RnpReadState): RnpRead {
    this.circuit = reason;
    return this.failed(state, reason);
  }

  private failed(state: RnpReadState, reason: string): RnpRead {
    return { state, reason, items: [], retrievedAt: null };
  }

  private remember(t: number, read: RnpRead): RnpRead {
    this.cached = { at: t, read };
    return read;
  }
}
