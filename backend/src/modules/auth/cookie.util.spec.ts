import {
  buildCsrfCookieOptions,
  buildOAuthFlowCookieOptions,
  buildSessionCookieOptions,
} from './cookie.util';

describe('cookie.util (Milestone #57)', () => {
  describe('buildSessionCookieOptions', () => {
    it('is httpOnly regardless of environment', () => {
      expect(buildSessionCookieOptions('development', 1000).httpOnly).toBe(true);
      expect(buildSessionCookieOptions('production', 1000).httpOnly).toBe(true);
    });

    it('Secure is false in development \u2014 required for plain http://localhost to work at all', () => {
      expect(buildSessionCookieOptions('development', 1000).secure).toBe(false);
    });

    it('Secure is true in production', () => {
      expect(buildSessionCookieOptions('production', 1000).secure).toBe(true);
    });

    it('an undefined NODE_ENV defaults to the dev-permissive (Secure=false) behavior, matching the existing startup-validator convention', () => {
      expect(buildSessionCookieOptions(undefined, 1000).secure).toBe(false);
    });

    it('uses SameSite=Lax (required for the OAuth top-level-redirect callback to include the cookie)', () => {
      expect(buildSessionCookieOptions('production', 1000).sameSite).toBe('lax');
    });

    it('uses Path=/', () => {
      expect(buildSessionCookieOptions('production', 1000).path).toBe('/');
    });
  });

  describe('buildCsrfCookieOptions', () => {
    it('is NOT httpOnly \u2014 frontend JavaScript must be able to read it to echo it back as a header', () => {
      expect(buildCsrfCookieOptions('production', 1000).httpOnly).toBe(false);
    });

    it('still gates Secure on production, same as the session cookie', () => {
      expect(buildCsrfCookieOptions('development', 1000).secure).toBe(false);
      expect(buildCsrfCookieOptions('production', 1000).secure).toBe(true);
    });
  });

  describe('buildOAuthFlowCookieOptions', () => {
    it('is httpOnly \u2014 the flow state is never exposed to frontend JavaScript', () => {
      expect(buildOAuthFlowCookieOptions('production', 1000).httpOnly).toBe(true);
    });

    it('accepts an explicit short maxAge distinct from the session cookie\u2019s', () => {
      const options = buildOAuthFlowCookieOptions('production', 5 * 60 * 1000);
      expect(options.maxAge).toBe(5 * 60 * 1000);
    });
  });
});

/**
 * R-h — NODE_ENV normalization.
 *
 * Behavioural regression coverage for the defect these tests exist to prevent:
 * a NODE_ENV that every startup validator accepts as production, while the
 * session, CSRF and OAuth-flow cookies are still issued without `Secure`.
 * Behind TLS termination that is a session token on a connection the user
 * believes is protected.
 *
 * The casing and whitespace variants below are the exact ones
 * `?.trim().toLowerCase()` is there to absorb, and they are asserted against
 * ALL THREE builders — a fix applied to only one of them is the realistic
 * regression, not a fix applied to none.
 */
describe('cookie.util — R-h NODE_ENV normalization', () => {
  const BUILDERS: ReadonlyArray<readonly [string, (nodeEnv: string | undefined) => boolean]> = [
    ['buildSessionCookieOptions', (e) => buildSessionCookieOptions(e, 1000).secure],
    ['buildCsrfCookieOptions', (e) => buildCsrfCookieOptions(e, 1000).secure],
    ['buildOAuthFlowCookieOptions', (e) => buildOAuthFlowCookieOptions(e, 1000).secure],
  ];

  const PRODUCTION_VARIANTS = [
    'production',
    'Production',
    'PRODUCTION',
    ' production',
    'production ',
    '  Production  ',
    '\tproduction\n',
  ];
  const NON_PRODUCTION_VARIANTS = [
    'development',
    'Development',
    'test',
    'staging',
    'prod',
    'productions',
    '',
    '   ',
    undefined,
  ];

  describe.each(BUILDERS)('%s', (_name, secureFor) => {
    it.each(PRODUCTION_VARIANTS)(
      'sets Secure for a production NODE_ENV written as %j',
      (nodeEnv) => {
        expect(secureFor(nodeEnv)).toBe(true);
      },
    );

    it.each(NON_PRODUCTION_VARIANTS)('does NOT set Secure for %j', (nodeEnv) => {
      expect(secureFor(nodeEnv)).toBe(false);
    });
  });

  it('agrees with the startup validators, which is the whole point of the change', () => {
    // The exact normalization CorsStartupValidator / NewsStartupValidator /
    // AnalysisConfigService apply. Reproduced here rather than imported so this
    // test still fails if a builder silently stops normalizing.
    const validatorSaysProduction = (nodeEnv: string | undefined): boolean =>
      nodeEnv?.trim().toLowerCase() === 'production';

    for (const nodeEnv of [...PRODUCTION_VARIANTS, ...NON_PRODUCTION_VARIANTS]) {
      for (const [name, secureFor] of BUILDERS) {
        expect({ name, nodeEnv, secure: secureFor(nodeEnv) }).toEqual({
          name,
          nodeEnv,
          secure: validatorSaysProduction(nodeEnv),
        });
      }
    }
  });

  it('leaves every other cookie attribute untouched', () => {
    const session = buildSessionCookieOptions('Production', 1000);
    expect(session.httpOnly).toBe(true);
    expect(session.sameSite).toBe('lax');
    expect(session.path).toBe('/');
    expect(session.maxAge).toBe(1000);
    // The CSRF cookie must stay readable by frontend JavaScript.
    expect(buildCsrfCookieOptions('Production', 1000).httpOnly).toBe(false);
    expect(buildOAuthFlowCookieOptions('Production', 1000).httpOnly).toBe(true);
  });
});

/**
 * M-ALPHA-AUTH - CTO requirement 12: Secure GUARANTEED for the production HTTPS
 * account origin.
 *
 * Appended as a new describe block. Nothing above is modified: every existing
 * assertion, including the NODE_ENV normalization matrix, still runs unchanged,
 * because the new behaviour is an OR added to the old one rather than a
 * replacement for it. If any assertion above had needed relaxing to make room
 * for this, that would have been a signal the change was doing more than it
 * claimed.
 */
describe('secure flag - the HTTPS account origin guarantee (M-ALPHA-AUTH)', () => {
  const BUILDERS_WITH_ORIGIN: ReadonlyArray<
    [string, (nodeEnv: string | undefined, origin: string | undefined) => boolean]
  > = [
    ['buildSessionCookieOptions', (e, o) => buildSessionCookieOptions(e, 1000, o).secure],
    ['buildCsrfCookieOptions', (e, o) => buildCsrfCookieOptions(e, 1000, o).secure],
    ['buildOAuthFlowCookieOptions', (e, o) => buildOAuthFlowCookieOptions(e, 1000, o).secure],
  ];

  /**
   * THE DEFECT THIS CLOSES. `secure` used to depend on the spelling of NODE_ENV
   * and on nothing else, so a deployment whose NODE_ENV was unset, or 'prod', or
   * anything the normalizer does not map to 'production', issued session cookies
   * WITHOUT Secure over HTTPS while looking entirely healthy.
   */
  it.each(['staging', 'prod', 'PROD', '', undefined, 'development'])(
    'is Secure for an https account origin even when NODE_ENV is %p',
    (nodeEnv) => {
      for (const [name, secureFor] of BUILDERS_WITH_ORIGIN) {
        expect({ name, secure: secureFor(nodeEnv, 'https://app.example.com') }).toEqual({
          name,
          secure: true,
        });
      }
    },
  );

  it('is Secure in production regardless of the origin, preserving the previous rule exactly', () => {
    for (const [name, secureFor] of BUILDERS_WITH_ORIGIN) {
      expect({ name, secure: secureFor('production', 'http://localhost:3000') }).toEqual({
        name,
        secure: true,
      });
      expect({ name, secure: secureFor('production', undefined) }).toEqual({ name, secure: true });
    }
  });

  /**
   * Local development must keep working. A Secure cookie is never sent over
   * plain HTTP, so making this unconditionally true would break every local
   * sign-in - which is exactly why the original author gated it in the first
   * place.
   */
  it('is NOT Secure for an http origin outside production, so local sign-in still works', () => {
    for (const [name, secureFor] of BUILDERS_WITH_ORIGIN) {
      expect({ name, secure: secureFor('development', 'http://localhost:3000') }).toEqual({
        name,
        secure: false,
      });
      expect({ name, secure: secureFor(undefined, undefined) }).toEqual({ name, secure: false });
    }
  });

  it('is case- and whitespace-insensitive about the scheme, matching the NODE_ENV normalizer', () => {
    for (const [name, secureFor] of BUILDERS_WITH_ORIGIN) {
      expect({ name, secure: secureFor('development', '  HTTPS://app.example.com ') }).toEqual({
        name,
        secure: true,
      });
    }
  });

  it('is not fooled by an origin that merely mentions https', () => {
    for (const [name, secureFor] of BUILDERS_WITH_ORIGIN) {
      expect({ name, secure: secureFor('development', 'http://https.example.com') }).toEqual({
        name,
        secure: false,
      });
    }
  });

  it('keeps SameSite=Lax and the httpOnly split unchanged when an origin is supplied', () => {
    const origin = 'https://app.example.com';
    expect(buildSessionCookieOptions('production', 1000, origin).sameSite).toBe('lax');
    expect(buildSessionCookieOptions('production', 1000, origin).httpOnly).toBe(true);
    expect(buildCsrfCookieOptions('production', 1000, origin).httpOnly).toBe(false);
    expect(buildOAuthFlowCookieOptions('production', 1000, origin).httpOnly).toBe(true);
  });
});
