/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE SAFE-FETCH DRIVER — C-P2 … C-P13
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Every case runs against a STUB resolver and connector. No network is required and none
 * is authorised: the single live exchange (C-P1) is the operator-run one-shot proof, by
 * hand, once.
 *
 * C-P3, C-P4, C-P5 and C-P13 are the ones that keep the rest honest. A suite with C-P1
 * and C-P2 alone would report PASS for a driver that resolves once, caches it, and
 * re-implements the denylist.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { OfficialDataTransportFailure, SNAPSHOT_WIRE_BYTE_CAP } from '@globalnews-ai/shared';

import {
  SAFE_FETCH_DENIED_HOST_SUFFIXES,
  finalUrlFor,
  type AddressBoundConnector,
  type AddressBoundRequest,
  type AddressBoundResult,
  type AddressResolver,
  type SafeFetchPolicy,
} from './official-artifact-safe-fetch';
import { makeSafeWireFetch } from './safe-wire-fetch.node';

const GOVERNED_HOST = 'statistics.gov.rw';
const PUBLIC_IP = '93.184.216.34';

const POLICY: SafeFetchPolicy = Object.freeze({
  wireByteCap: SNAPSHOT_WIRE_BYTE_CAP,
  maxRedirectHops: 3,
  totalDeadlineMs: 60_000,
  perHopDeadlineMs: 30_000,
  admittedScheme: 'https:' as const,
  deniedHostSuffixes: SAFE_FETCH_DENIED_HOST_SUFFIXES,
  ownOrigins: ['api.globalnews.ai'],
});

interface Recorder {
  readonly calls: AddressBoundRequest[];
  readonly resolutions: string[];
}

function harness(opts: {
  resolutions?: readonly (readonly string[])[];
  responses?: readonly Partial<AddressBoundResult>[];
  resolverThrows?: boolean;
  connectorThrows?: Error;
  credential?: Parameters<typeof makeSafeWireFetch>[0]['credential'];
}) {
  const rec: Recorder = { calls: [], resolutions: [] };
  let resolveIdx = 0;
  let responseIdx = 0;

  const resolver: AddressResolver = async (hostname) => {
    rec.resolutions.push(hostname);
    if (opts.resolverThrows === true) throw new Error('ENOTFOUND');
    const sets = opts.resolutions ?? [[PUBLIC_IP]];
    const set = sets[Math.min(resolveIdx, sets.length - 1)] ?? [PUBLIC_IP];
    resolveIdx += 1;
    return set;
  };

  const connector: AddressBoundConnector = async (req) => {
    rec.calls.push(req);
    if (opts.connectorThrows !== undefined) throw opts.connectorThrows;
    const list = opts.responses ?? [{}];
    const r = list[Math.min(responseIdx, list.length - 1)] ?? {};
    responseIdx += 1;
    const bytes = r.bytes ?? new Uint8Array([1, 2, 3]);
    return {
      status: r.status ?? 200,
      headers: r.headers ?? { 'content-type': 'application/pdf' },
      bytes,
      capHit: r.capHit ?? false,
    };
  };

  const fetch = makeSafeWireFetch({
    resolver,
    connector,
    policy: POLICY,
    resolveHost: (p) => (p === 'rw-nisr' ? GOVERNED_HOST : undefined),
    ...(opts.credential === undefined ? {} : { credential: opts.credential }),
  });

  return { fetch, rec };
}

const REQUEST = {
  providerId: 'rw-nisr',
  endpointId: 'cpi-monthly-en',
  url: `https://${GOVERNED_HOST}/docs/cpi.pdf`,
  accept: 'application/pdf',
  query: {},
};

async function kindOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'NO_FAILURE';
  } catch (e) {
    if (e instanceof OfficialDataTransportFailure) return e.kind;
    return `UNEXPECTED:${(e as Error).message}`;
  }
}

/* ══════════════════════════════════════════════════════════════════════════ */

describe('C-P2 · the connector dials the IP and names the governed host', () => {
  it('passes the validated address, and the hostname only for TLS and Host', async () => {
    const { fetch, rec } = harness({});
    await fetch(REQUEST, new AbortController().signal);

    expect(rec.calls).toHaveLength(1);
    const call = rec.calls[0]!;
    /* A driver passing the hostname to the connector has not been checked. */
    expect(call.address).toBe(PUBLIC_IP);
    expect(call.tlsServerName).toBe(GOVERNED_HOST);
    expect(call.hostHeader).toBe(GOVERNED_HOST);
    expect(call.byteCap).toBe(SNAPSHOT_WIRE_BYTE_CAP);
  });
});

describe('C-P3 · every address is classified, and refusal precedes connection', () => {
  it('MUTATION — a mixed public/loopback resolution is refused', async () => {
    const { fetch, rec } = harness({ resolutions: [[PUBLIC_IP, '127.0.0.1']] });

    expect(await kindOf(fetch(REQUEST, new AbortController().signal))).toBe('ADDRESS_REFUSED');
    /* REFUSING AFTER CONNECTING IS NOT REFUSING. */
    expect(rec.calls).toHaveLength(0);
  });

  it('refuses a private address even when it is the only one', async () => {
    const { fetch, rec } = harness({ resolutions: [['10.0.0.5']] });
    expect(await kindOf(fetch(REQUEST, new AbortController().signal))).toBe('ADDRESS_REFUSED');
    expect(rec.calls).toHaveLength(0);
  });
});

describe('C-P4 · an empty resolution refuses — the R-B control', () => {
  it('refuses DNS_FAILURE and never connects', async () => {
    const { fetch, rec } = harness({ resolutions: [[]] });
    /*
      WITHOUT THIS, C-P3 IS VACUOUS: `classifyResolvedSet([])` satisfies every "contains
      no forbidden address" assertion, so the address check would pass hardest exactly
      when it knows least.
    */
    expect(await kindOf(fetch(REQUEST, new AbortController().signal))).toBe('DNS_FAILURE');
    expect(rec.calls).toHaveLength(0);
  });

  it('a resolver that throws is DNS_FAILURE, not a crash', async () => {
    const { fetch, rec } = harness({ resolverThrows: true });
    expect(await kindOf(fetch(REQUEST, new AbortController().signal))).toBe('DNS_FAILURE');
    expect(rec.calls).toHaveLength(0);
  });
});

describe('C-P5 · every hop re-resolves and re-gates', () => {
  it('MUTATION — a hop whose SECOND resolution is private is refused', async () => {
    const { fetch, rec } = harness({
      /* first resolution public, second private */
      resolutions: [[PUBLIC_IP], ['127.0.0.1']],
      responses: [
        { status: 302, headers: { location: `https://${GOVERNED_HOST}/docs/moved.pdf` } },
        { status: 200 },
      ],
    });

    expect(await kindOf(fetch(REQUEST, new AbortController().signal))).toBe('ADDRESS_REFUSED');
    /* It connected ONCE — for the first hop — and refused before the second. A driver
       that resolves once passes C-P3 and fails here. */
    expect(rec.calls).toHaveLength(1);
    expect(rec.resolutions).toHaveLength(2);
  });
});

describe('C-P6 · an off-host hop is refused', () => {
  it('a subdomain of the governed host is a registry event, not a fetch-time inference', async () => {
    const { fetch } = harness({
      responses: [
        { status: 302, headers: { location: 'https://files.statistics.gov.rw/docs/cpi.pdf' } },
        { status: 200 },
      ],
    });
    expect(await kindOf(fetch(REQUEST, new AbortController().signal))).toBe('REDIRECT_REFUSED');
  });
});

describe('C-P7 · a credential never leaves its origin', () => {
  it('a hop to another origin carries no header from the first, by name', async () => {
    const credential = {
      providerId: 'rw-nisr',
      origin: `https://${GOVERNED_HOST}:443`,
      headerName: 'X-Api-Key',
      headerValue: 'secret-value',
    };
    /* The redirect stays on the governed host (an off-host hop is refused by C-P6), so
       the origin differs by PORT — which is the case a "drop on cross-host" rule misses
       and origin binding catches. */
    const { fetch, rec } = harness({
      credential,
      responses: [
        { status: 302, headers: { location: `https://${GOVERNED_HOST}:8443/docs/cpi.pdf` } },
        { status: 200 },
      ],
    });

    await kindOf(fetch(REQUEST, new AbortController().signal));
    expect(rec.calls.length).toBeGreaterThanOrEqual(1);
    expect(rec.calls[0]!.headers['X-Api-Key']).toBe('secret-value');
    for (const call of rec.calls.slice(1)) {
      expect(Object.keys(call.headers)).not.toContain('X-Api-Key');
    }
  });

  it('no credential yields no credential header at all — NISR has none', async () => {
    const { fetch, rec } = harness({});
    await fetch(REQUEST, new AbortController().signal);
    expect(Object.keys(rec.calls[0]!.headers)).toEqual(['Accept']);
  });
});

describe('C-P8 · the cap aborts mid-stream and returns no bytes', () => {
  it('capHit is ABORTED_BY_CAP', async () => {
    const { fetch } = harness({ responses: [{ capHit: true, bytes: new Uint8Array(0) }] });
    expect(await kindOf(fetch(REQUEST, new AbortController().signal))).toBe('ABORTED_BY_CAP');
  });
});

describe('C-P9 · short and long reads are different facts', () => {
  it('declared 100 / received 90 is CONNECT_FAILURE, which is retryable', async () => {
    const { fetch } = harness({
      responses: [{ headers: { 'content-length': '100' }, bytes: new Uint8Array(90) }],
    });
    expect(await kindOf(fetch(REQUEST, new AbortController().signal))).toBe('CONNECT_FAILURE');
  });

  it('declared 100 / received 110 is ABORTED_BY_CAP, which is not', async () => {
    /* BOTH, IN ONE SUITE — asserting only one lets the sign be dropped. */
    const { fetch } = harness({
      responses: [{ headers: { 'content-length': '100' }, bytes: new Uint8Array(110) }],
    });
    expect(await kindOf(fetch(REQUEST, new AbortController().signal))).toBe('ABORTED_BY_CAP');
  });
});

describe('C-P10 · the driver reaches no admission verdict', () => {
  it('serves text/html with 200 SUCCESSFULLY, and lets the evaluator judge it', async () => {
    const { fetch } = harness({
      responses: [{ status: 200, headers: { 'content-type': 'text/html' }, bytes: new Uint8Array([60]) }],
    });
    const out = await fetch(REQUEST, new AbortController().signal);
    /*
      A driver that refused here would have taken the evaluator's job and broken the retry
      grading: MEDIA_TYPE_NOT_ALLOWED is PERMANENT while CONNECT_FAILURE is retryable, so
      refusing on type converts a permanent refusal into a retryable transport failure and
      the producer goes back to a host permanently serving the wrong thing.
    */
    expect(out.status).toBe(200);
    expect(out.wireBytes.byteLength).toBe(1);
  });

  it('a 404 is REPORTED, never judged — STATUS_NOT_OK is the evaluator’s key', async () => {
    const { fetch } = harness({ responses: [{ status: 404 }] });
    const out = await fetch(REQUEST, new AbortController().signal);
    expect(out.status).toBe(404);
  });
});

describe('C-P11 · one call, one exchange', () => {
  it('a non-redirected fetch calls the connector exactly once', async () => {
    const { fetch, rec } = harness({});
    await fetch(REQUEST, new AbortController().signal);
    /* THIS IS "NO SCHEDULER / NO RETRY" AS A MEASUREMENT. */
    expect(rec.calls).toHaveLength(1);
  });

  it('a redirected fetch calls it exactly hops + 1 times', async () => {
    const { fetch, rec } = harness({
      responses: [
        { status: 302, headers: { location: `https://${GOVERNED_HOST}/a.pdf` } },
        { status: 302, headers: { location: `https://${GOVERNED_HOST}/b.pdf` } },
        { status: 200 },
      ],
    });
    await fetch(REQUEST, new AbortController().signal);
    expect(rec.calls).toHaveLength(3);
  });

  it('does not retry a failure it is allowed to classify as retryable', async () => {
    const { fetch, rec } = harness({ connectorThrows: new Error('ECONNRESET') });
    await kindOf(fetch(REQUEST, new AbortController().signal));
    /* `transportFailureMayRetry()` classifies a failure for a CALLER. It is not
       permission for the driver to act on it itself. */
    expect(rec.calls).toHaveLength(1);
  });

  it('refuses an unregistered provider before any resolution or connection', async () => {
    const { fetch, rec } = harness({});
    const kind = await kindOf(
      fetch({ ...REQUEST, providerId: 'NOT_REGISTERED' }, new AbortController().signal),
    );
    expect(kind).toBe('ADDRESS_REFUSED');
    expect(rec.resolutions).toHaveLength(0);
    expect(rec.calls).toHaveLength(0);
  });
});

describe('C-P12 · the final URL carries the hostname', () => {
  it('reports the governed hostname, never the validated address', async () => {
    const { fetch } = harness({});
    const out = await fetch(REQUEST, new AbortController().signal);
    expect(new URL(out.finalUrl).hostname).toBe(GOVERNED_HOST);
  });

  it('finalUrlFor THROWS when handed an address', () => {
    expect(() => finalUrlFor('https://93.184.216.34/x')).toThrow(/FINAL_URL_CARRIES_AN_ADDRESS/);
  });

  it('the final URL is the LAST hop, not the first', async () => {
    const { fetch } = harness({
      responses: [
        { status: 302, headers: { location: `https://${GOVERNED_HOST}/final.pdf` } },
        { status: 200 },
      ],
    });
    const out = await fetch(REQUEST, new AbortController().signal);
    expect(out.finalUrl).toContain('/final.pdf');
    expect(out.redirectChain).toEqual([`https://${GOVERNED_HOST}/final.pdf`]);
  });
});

describe('C-P13 · no policy is duplicated in the driver', () => {
  /*
    A SOURCE-LEVEL CHECK, AND IT IS THE ONE THAT KEEPS THE REST HONEST. Every predicate
    the driver re-implements is a second copy of a rule that will diverge from the first,
    and the copy that diverges is the one that gets relaxed.
  */
  const source = readFileSync(join(__dirname, 'safe-wire-fetch.node.ts'), 'utf8');
  /* Comments quote the policy by name; the CODE must not contain it. */
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  it.each([
    ["the scheme literal", /['"`]https:['"`]/],
    ['an internal suffix', /\.internal/],
    ['localhost', /localhost/],
    ['a loopback prefix', /127\./],
    ['a private-range prefix', /\b10\.0\./],
    ['another private range', /192\.168/],
    ['the byte cap arithmetic', /4 \* 1024 \* 1024/],
  ])('contains no %s', (_label, pattern) => {
    expect(pattern.test(code)).toBe(false);
  });

  it('compares no numeric literal against a hop count', () => {
    /*
      COMPARISON operators only. `hops += 1` is an INCREMENT — the driver carrying the
      count it hands to `adjudicateRedirect` — and that is the driver obeying the policy.
      A literal COMPARISON would be the driver deciding the limit for itself, which is
      the defect this check exists for. The first version of this assertion matched
      `[<>=]+` and so fired on `+=`, reporting the correct code as a violation.
    */
    const COMPARISON = /hops\s*(?:<=|>=|<|>|={2,3}|!==?)\s*\d/;
    expect(COMPARISON.test(code)).toBe(false);
    expect(/maxRedirectHops\s*(?:<=|>=|<|>|={2,3}|!==?)\s*\d/.test(code)).toBe(false);
    /* and the count it keeps is handed STRAIGHT to the landed adjudicator */
    expect(code).toContain('hops,');
  });

  it('imports its constants rather than declaring them', () => {
    expect(code).toContain('adjudicateRedirect');
    expect(code).toContain('adjudicateContentLength');
    expect(code).toContain('assertUrlIsFetchable');
    expect(code).toContain('classifyResolvedSet');
    expect(code).toContain('credentialHeadersFor');
    expect(code).toContain('policy.wireByteCap');
  });

  it('resolves with resolve4 and resolve6, and never with dns.lookup', () => {
    /* `lookup` consults the OS resolver and returns ONE address, which silently defeats
       `classifyResolvedSet`. */
    expect(code).toContain('resolve4');
    expect(code).toContain('resolve6');
    expect(/\blookup\b/.test(code)).toBe(false);
  });

  it('never relaxes TLS', () => {
    expect(code).toContain('rejectUnauthorized: true');
    expect(/rejectUnauthorized:\s*false/.test(code)).toBe(false);
    expect(/NODE_TLS_REJECT_UNAUTHORIZED/.test(source)).toBe(false);
    expect(/\bca:\s/.test(code)).toBe(false);
  });

  it('contains no retry, no timer and no schedule', () => {
    expect(/setInterval|setTimeout\(|cron|schedule/i.test(code)).toBe(false);
    expect(/for\s*\(\s*let\s+attempt/.test(code)).toBe(false);
  });
});
