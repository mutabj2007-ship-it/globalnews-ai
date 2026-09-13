import {
  hasSafeRelativeShape,
  resolveSafeReturnUrl,
  sameOriginUrlOrFallback,
  validateReturnDestination,
} from './return-destination.util';

/**
 * M-ALPHA-AUTH - the open-redirect matrix.
 *
 * This is the security core of the milestone, so the rejection cases outnumber
 * the acceptance cases on purpose. Every rejection asserts BOTH that the input
 * was refused AND that what comes back is a safe local value: a validator that
 * returned the attacker's string alongside an error flag would satisfy a
 * "rejected" assertion while still handing a caller something dangerous.
 */

const FRONTEND = 'https://frontend-production-c606.up.railway.app';

describe('validateReturnDestination - accepted destinations', () => {
  it.each([
    ['/', 'the homepage'],
    ['/support', 'the surface whose defect was reported'],
    ['/history', 'History'],
    ['/map', 'the map'],
    ['/search', 'search'],
    ['/workspace', 'the workspace'],
    ['/admin', 'the admin root'],
    ['/admin/support', 'an admin sub-page'],
    ['/admin/system/health', 'a nested admin sub-page'],
    ['/admin/news/sources', 'another nested admin page'],
    ['/admin/payments/ksef', 'a deeper admin page'],
  ])('accepts %s (%s) unchanged', (input) => {
    expect(validateReturnDestination(input)).toBe(input);
  });
});

describe('validateReturnDestination - open-redirect and injection refusals', () => {
  /**
   * Each entry is a real technique, not a random malformed string. The note on
   * each says what it would achieve if it got through.
   */
  it.each([
    ['//evil.example', 'protocol-relative: a browser reads this as another host'],
    ['///evil.example', 'protocol-relative with an extra slash'],
    ['/\\evil.example', 'backslash form of protocol-relative'],
    ['\\\\evil.example', 'UNC-style, no leading forward slash at all'],
    ['https://evil.example', 'a plain absolute URL'],
    ['http://evil.example', 'a plain absolute URL, insecure scheme'],
    ['//evil.example/support', 'a foreign host wearing an allowlisted path'],
    ['javascript:alert(1)', 'script execution scheme'],
    ['data:text/html,x', 'data scheme'],
    ['/support@evil.example', 'userinfo trick - the real host is after the @'],
    ['/%2f%2fevil.example', 'encoded protocol-relative: decodes to // after a naive check'],
    ['%2f%2fevil.example', 'encoded, no leading slash'],
    ['/support%00', 'null byte, percent-encoded'],
    ['/support?next=https://evil.example', 'a query string smuggling a second destination'],
    ['/support#@evil.example', 'a fragment smuggling a host'],
    ['/../admin', 'dot-segment traversal'],
    ['/admin/../../etc/passwd', 'interior traversal'],
    ['/admin/Support', 'uppercase - outside the declared route vocabulary'],
    ['/adminx', 'a prefix that merely starts with admin'],
    ['/administrator', 'a longer word starting with admin'],
    ['/privacy', 'a real page that is deliberately not an allowlisted return'],
    ['support', 'relative with no leading slash'],
    ['', 'empty'],
    [' ', 'whitespace only'],
  ])('refuses %s (%s)', (input) => {
    expect(validateReturnDestination(input)).toBeNull();
  });

  it('refuses a value longer than the bound', () => {
    expect(validateReturnDestination('/'.padEnd(200, 'a'))).toBeNull();
  });

  it('refuses a CR/LF response-splitting payload', () => {
    expect(validateReturnDestination('/support\r\nSet-Cookie: x=1')).toBeNull();
    expect(validateReturnDestination('/support\nLocation: https://evil.example')).toBeNull();
  });

  it('refuses every C0 control character and DEL, exhaustively', () => {
    for (let code = 0; code <= 0x1f; code += 1) {
      expect(validateReturnDestination(`/support${String.fromCharCode(code)}`)).toBeNull();
    }
    expect(validateReturnDestination(`/support${String.fromCharCode(0x7f)}`)).toBeNull();
  });

  it.each([[undefined], [null]])('treats %p as no destination rather than an error', (input) => {
    expect(validateReturnDestination(input)).toBeNull();
  });

  it('never throws, whatever it is given', () => {
    const hostile = [
      '/'.repeat(5000),
      ' ',
      String.fromCharCode(0xd800),
      `/support${String.fromCharCode(0xfeff)}`,
      '/%',
      '/%zz',
    ];
    for (const value of hostile) {
      expect(() => validateReturnDestination(value)).not.toThrow();
    }
  });
});

describe('resolveSafeReturnUrl - the exit gate', () => {
  it('resolves an allowlisted destination against the frontend origin', () => {
    expect(resolveSafeReturnUrl(FRONTEND, '/support')).toBe(`${FRONTEND}/support`);
    expect(resolveSafeReturnUrl(FRONTEND, '/admin/support')).toBe(`${FRONTEND}/admin/support`);
  });

  it('preserves the pre-existing homepage default when there is no destination', () => {
    expect(resolveSafeReturnUrl(FRONTEND, undefined)).toBe(FRONTEND);
    expect(resolveSafeReturnUrl(FRONTEND, null)).toBe(FRONTEND);
  });

  /**
   * THE ASSERTION THE WHOLE MODULE EXISTS FOR. Even for inputs a future
   * careless widening of the allowlist might let through, the resolved URL is
   * compared origin-to-origin against the frontend and anything foreign is
   * replaced with the frontend origin itself.
   */
  it.each([
    ['//evil.example'],
    ['https://evil.example/support'],
    ['/\\evil.example'],
    ['/support@evil.example'],
  ])('never emits a URL outside the frontend origin for %s', (input) => {
    const result = resolveSafeReturnUrl(FRONTEND, input);
    expect(result).toBe(FRONTEND);
    expect(new URL(result).origin).toBe(new URL(FRONTEND).origin);
  });

  it('never emits a foreign origin for ANY input, allowlisted or not', () => {
    const inputs = [
      '/',
      '/support',
      '/admin/system/health',
      '//evil.example',
      'https://evil.example',
      'javascript:alert(1)',
      '/../../evil',
      '',
    ];
    for (const input of inputs) {
      expect(new URL(resolveSafeReturnUrl(FRONTEND, input)).origin).toBe(new URL(FRONTEND).origin);
    }
  });

  it('falls back to the given origin rather than throwing when the origin is malformed', () => {
    expect(resolveSafeReturnUrl('not-a-url', '/support')).toBe('not-a-url');
  });

  it('works for the http localhost origin used in development', () => {
    expect(resolveSafeReturnUrl('http://localhost:3000', '/history')).toBe(
      'http://localhost:3000/history',
    );
  });
});

/**
 * THE ORIGIN ASSERTION, PROVED ON ITS OWN.
 *
 * These tests exist because of a mutation that FAILED to fail. With the
 * assertion inline in resolveSafeReturnUrl, deleting it broke nothing: the
 * allowlist upstream rejects every hostile input before the assertion can be
 * reached, so no test could tell the two versions apart. A mutation proof that
 * passes for that reason is not a proof.
 *
 * The layer's whole purpose is to hold when something UPSTREAM is wrong - a
 * widened allowlist, a second writer of the flow state, a relaxed HMAC. So it
 * is tested with exactly the candidates a broken upstream would hand it, which
 * is the only honest way to prove a defence-in-depth layer.
 */
describe('sameOriginUrlOrFallback - the origin assertion, isolated', () => {
  it.each([
    ['//evil.example', 'protocol-relative'],
    ['https://evil.example', 'absolute URL'],
    ['https://evil.example/support', 'absolute URL wearing an allowlisted path'],
    ['http://evil.example', 'absolute URL, insecure scheme'],
    ['//evil.example/admin', 'protocol-relative into an allowlisted path'],
    ['https://frontend-production-c606.up.railway.app.evil.example/', 'lookalike host'],
    ['https://evil.example:443/support', 'explicit port'],
    ['//user@evil.example/', 'userinfo'],
  ])('refuses %s (%s) even though the allowlist never would have passed it', (candidate) => {
    expect(sameOriginUrlOrFallback(FRONTEND, candidate)).toBe(FRONTEND);
  });

  it('refuses a different scheme on the SAME host, because origin includes scheme', () => {
    expect(
      sameOriginUrlOrFallback(FRONTEND, 'http://frontend-production-c606.up.railway.app/'),
    ).toBe(FRONTEND);
  });

  it('refuses a different PORT on the same host and scheme', () => {
    expect(
      sameOriginUrlOrFallback('https://app.example.com', 'https://app.example.com:8443/x'),
    ).toBe('https://app.example.com');
  });

  it('allows a genuine same-origin path through unchanged', () => {
    expect(sameOriginUrlOrFallback(FRONTEND, '/support')).toBe(`${FRONTEND}/support`);
    expect(sameOriginUrlOrFallback(FRONTEND, `${FRONTEND}/history`)).toBe(`${FRONTEND}/history`);
  });

  it('falls back rather than throwing on a malformed origin or candidate', () => {
    expect(sameOriginUrlOrFallback('not-a-url', '/support')).toBe('not-a-url');
    expect(sameOriginUrlOrFallback(FRONTEND, 'http://')).toBe(FRONTEND);
  });

  it('never emits a foreign origin for any candidate at all', () => {
    const candidates = [
      '/',
      '/support',
      '//evil.example',
      'https://evil.example',
      'http://frontend-production-c606.up.railway.app/',
      '//user@evil.example/',
      'x',
    ];
    for (const candidate of candidates) {
      expect(new URL(sameOriginUrlOrFallback(FRONTEND, candidate)).origin).toBe(
        new URL(FRONTEND).origin,
      );
    }
  });
});

/**
 * THE STRUCTURAL GATE, PROVED ON ITS OWN.
 *
 * These tests exist for the same reason the origin-assertion tests above do: a
 * mutation that deleted the protocol-relative guard passed everything, because
 * the allowlist rejects those inputs anyway. That made the guard's presence
 * indistinguishable from its absence through the composed function - which is
 * not evidence that the guard is strong, only that it is untestable from
 * outside.
 *
 * This layer is the second opinion that has to hold if the allowlist is ever
 * widened carelessly, so it is proved directly, against inputs that a widened
 * allowlist would happily pass to it.
 */
describe('hasSafeRelativeShape - the structural gate, isolated', () => {
  it.each([
    ['//evil.example', 'protocol-relative'],
    ['///evil.example', 'protocol-relative, extra slash'],
    ['/\\evil.example', 'backslash protocol-relative'],
    ['https://evil.example', 'absolute URL'],
    ['javascript:alert(1)', 'scheme'],
    ['/support@evil.example', 'userinfo'],
    ['/%2f%2fevil.example', 'percent-encoded'],
    ['/support?x=1', 'query string'],
    ['/support#x', 'fragment'],
    ['/../admin', 'traversal'],
    ['/admin/../../etc/passwd', 'interior traversal'],
    ['support', 'no leading slash'],
    ['', 'empty'],
  ])('rejects %s (%s) on shape alone, before any allowlist is consulted', (input) => {
    expect(hasSafeRelativeShape(input)).toBe(false);
  });

  /**
   * THE POINT OF THIS BLOCK. These paths are NOT in the allowlist and never
   * will be reachable through validateReturnDestination - but they are
   * structurally fine, which is what proves this layer is testing shape rather
   * than merely echoing the allowlist.
   */
  it.each(['/', '/support', '/admin/system/health', '/some-future-page', '/a/b/c'])(
    'accepts the shape of %s regardless of whether it is allowlisted',
    (input) => {
      expect(hasSafeRelativeShape(input)).toBe(true);
    },
  );

  it('a structurally valid but unknown path is still refused by the composed validator', () => {
    expect(hasSafeRelativeShape('/some-future-page')).toBe(true);
    expect(validateReturnDestination('/some-future-page')).toBeNull();
  });

  it('rejects every C0 control character and DEL on shape alone', () => {
    for (let code = 0; code <= 0x1f; code += 1) {
      expect(hasSafeRelativeShape(`/support${String.fromCharCode(code)}`)).toBe(false);
    }
    expect(hasSafeRelativeShape(`/support${String.fromCharCode(0x7f)}`)).toBe(false);
  });

  it('rejects an over-length value on shape alone', () => {
    expect(hasSafeRelativeShape('/'.padEnd(200, 'a'))).toBe(false);
  });

  it.each([[undefined], [null]])('treats %p as unusable rather than throwing', (input) => {
    expect(hasSafeRelativeShape(input)).toBe(false);
  });
});
