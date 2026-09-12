import {
  FORWARDED_FOR_HEADER,
  forwardedHeadersFrom,
  resolveForwardedClientHeaders,
} from './forwardedClient';

/**
 * B-1 - trusted and untrusted boundary coverage for SSR visitor-identity
 * forwarding, mandated by the CTO approval.
 *
 * Behavioural, not source-text locks. The jest environment for this workspace
 * is `node`, so `window` is genuinely absent by default - that IS the server
 * execution context, exactly as apiBase.spec.ts documents.
 */

type MutableGlobal = { window?: unknown };

function inBrowserContext<T>(run: () => T): T {
  (globalThis as MutableGlobal).window = {};
  try {
    return run();
  } finally {
    delete (globalThis as MutableGlobal).window;
  }
}

describe('B-1 - forwardedHeadersFrom() - the trusted boundary', () => {
  it('forwards a proxy-supplied chain verbatim', () => {
    expect(forwardedHeadersFrom(() => '203.0.113.5')).toEqual({
      [FORWARDED_FOR_HEADER]: '203.0.113.5',
    });
  });

  it('preserves a multi-hop chain exactly, without reordering or appending - the backend performs its hop arithmetic against the chain the edge proxy actually produced', () => {
    expect(forwardedHeadersFrom(() => '198.51.100.9, 203.0.113.5')).toEqual({
      [FORWARDED_FOR_HEADER]: '198.51.100.9, 203.0.113.5',
    });
  });

  it('trims surrounding whitespace but changes nothing inside the chain', () => {
    expect(forwardedHeadersFrom(() => '  203.0.113.5, 10.0.0.1  ')).toEqual({
      [FORWARDED_FOR_HEADER]: '203.0.113.5, 10.0.0.1',
    });
  });

  it('reads exactly one header, by its lower-cased name, and nothing else', () => {
    const requested: string[] = [];
    forwardedHeadersFrom((name) => {
      requested.push(name);
      return null;
    });
    expect(requested).toEqual([FORWARDED_FOR_HEADER]);
  });
});

describe('B-1 - forwardedHeadersFrom() - the untrusted boundary', () => {
  it.each([
    ['absent (null)', null],
    ['absent (undefined)', undefined],
    ['empty', ''],
    ['whitespace only', '   '],
  ])('forwards NOTHING when the incoming header is %s', (_label, value) => {
    expect(forwardedHeadersFrom(() => value as string | null | undefined)).toEqual({});
  });

  it('never synthesises an address - an empty result is the honest answer when nothing trustworthy identified the visitor', () => {
    expect(forwardedHeadersFrom(() => null)).toEqual({});
  });

  it('NEVER reads a client-settable substitute header. x-real-ip, client-ip and forwarded are all ignored, because treating one as a client address would let any visitor mint a fresh throttle identity per request', () => {
    const store: Record<string, string> = {
      'x-real-ip': '1.2.3.4',
      'client-ip': '1.2.3.4',
      forwarded: 'for=1.2.3.4',
      'true-client-ip': '1.2.3.4',
    };

    expect(forwardedHeadersFrom((name) => store[name] ?? null)).toEqual({});
  });

  it('emits at most the single forwarded header, never an extra key a backend might trust', () => {
    const result = forwardedHeadersFrom(() => '203.0.113.5');
    expect(Object.keys(result)).toEqual([FORWARDED_FOR_HEADER]);
  });

  it('degrades to {} rather than throwing when the header store itself throws - a render must never fail over identity forwarding', () => {
    expect(
      forwardedHeadersFrom(() => {
        throw new Error('called outside a request scope');
      }),
    ).toEqual({});
  });
});

describe('B-1 - resolveForwardedClientHeaders() - execution context', () => {
  it('forwards NOTHING in the browser: a browser request already carries the visitor’s real source address, and page JavaScript must not be able to claim otherwise', async () => {
    await expect(inBrowserContext(() => resolveForwardedClientHeaders())).resolves.toEqual({});
  });

  it('degrades to {} on the server when there is no request scope - a static prerender must not fail the build', async () => {
    await expect(resolveForwardedClientHeaders()).resolves.toEqual({});
  });

  it('always resolves to a plain object, so it can be spread into fetch() unconditionally', async () => {
    const headers = await resolveForwardedClientHeaders();
    expect(typeof headers).toBe('object');
    expect(headers).not.toBeNull();
  });
});
