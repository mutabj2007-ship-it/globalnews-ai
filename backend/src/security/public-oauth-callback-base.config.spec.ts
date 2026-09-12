import {
  PUBLIC_OAUTH_CALLBACK_BASE_ENV,
  PublicOAuthCallbackBaseConfigurationError,
  resolvePublicOAuthCallbackBase,
} from './public-oauth-callback-base.config';

/**
 * M-ALPHA-AUTH OPTION A - the callback-base validation matrix.
 *
 * The rejection cases outnumber the acceptance cases deliberately. This value
 * becomes the redirect_uri Google is asked to send a freshly-authenticated user
 * to, so it is the one piece of configuration where being permissive is the
 * expensive mistake.
 */
const FRONTEND = 'https://frontend-production-c606.up.railway.app';
const BACKEND = 'https://backend-production-bed5.up.railway.app';

describe('resolvePublicOAuthCallbackBase - accepted values', () => {
  it('accepts the Option A shape: an https origin plus a single path segment', () => {
    expect(resolvePublicOAuthCallbackBase('production', `${FRONTEND}/api`, BACKEND)).toBe(
      `${FRONTEND}/api`,
    );
  });

  it('builds exactly the Option A callback URI from it', () => {
    const base = resolvePublicOAuthCallbackBase('production', `${FRONTEND}/api`, BACKEND);
    expect(`${base}/auth/google/callback`).toBe(`${FRONTEND}/api/auth/google/callback`);
  });

  it('accepts a bare origin - the rollback shape and the ordinary backend-hosted callback', () => {
    expect(resolvePublicOAuthCallbackBase('production', BACKEND, BACKEND)).toBe(BACKEND);
  });

  it('accepts a deeper but still narrow path', () => {
    expect(resolvePublicOAuthCallbackBase('production', `${FRONTEND}/api/v2`, BACKEND)).toBe(
      `${FRONTEND}/api/v2`,
    );
  });

  it('normalises a single trailing slash on a bare origin, which URL treats as no path', () => {
    expect(resolvePublicOAuthCallbackBase('production', `${BACKEND}/`, BACKEND)).toBe(BACKEND);
  });

  it('accepts http outside production, so local development is unchanged', () => {
    expect(
      resolvePublicOAuthCallbackBase('development', 'http://localhost:3100/api', BACKEND),
    ).toBe('http://localhost:3100/api');
  });

  it('trims surrounding whitespace rather than failing on it', () => {
    expect(resolvePublicOAuthCallbackBase('production', `  ${FRONTEND}/api  `, BACKEND)).toBe(
      `${FRONTEND}/api`,
    );
  });
});

describe('resolvePublicOAuthCallbackBase - unset defers to PUBLIC_BACKEND_ORIGIN', () => {
  /**
   * THE ROLLBACK CONTRACT. Unset means "behave exactly as before this
   * milestone", which is what makes rollback a single unset rather than an edit.
   */
  it.each([[undefined], [''], ['   ']])(
    'with the callback base %p, falls back to the backend origin',
    (value) => {
      expect(resolvePublicOAuthCallbackBase('production', value, BACKEND)).toBe(BACKEND);
    },
  );

  it('inherits the development localhost fallback when both are unset', () => {
    expect(resolvePublicOAuthCallbackBase('development', undefined, undefined)).toBe(
      'http://localhost:4000',
    );
  });

  it('inherits the production fail-closed behaviour when both are unset', () => {
    expect(() => resolvePublicOAuthCallbackBase('production', undefined, undefined)).toThrow();
  });

  it('does NOT let a valid callback base rescue an invalid backend origin it never reads', () => {
    // The backend origin is only consulted when the callback base is unset, so a
    // malformed one must not matter here. This pins that the two are independent.
    expect(resolvePublicOAuthCallbackBase('production', `${FRONTEND}/api`, 'not-a-url')).toBe(
      `${FRONTEND}/api`,
    );
  });
});

describe('resolvePublicOAuthCallbackBase - refusals', () => {
  it.each([
    ['not-a-url', 'not an absolute URL'],
    ['/api', 'a bare path with no origin'],
    ['ftp://example.com/api', 'a non-http scheme'],
    ['javascript:alert(1)', 'a script scheme'],
    [`${FRONTEND}/api?x=1`, 'a query string'],
    [`${FRONTEND}/api#x`, 'a fragment'],
    [`${FRONTEND}/api/`, 'a trailing slash after a path'],
    [`${FRONTEND}/../api`, 'a dot segment'],
    [`${FRONTEND}/api/../..`, 'interior dot segments'],
    [`${FRONTEND}//api`, 'a doubled slash'],
    ['https://user:pass@evil.example/api', 'embedded credentials'],
    [`${FRONTEND}/API`, 'an uppercase path segment'],
    [`${FRONTEND}/api_v2`, 'an underscore, outside the allowed character class'],
    [`${FRONTEND}/api%2f..`, 'a percent-encoded segment'],
    [`${FRONTEND}/api;x`, 'a path parameter'],
  ])('refuses %s (%s)', (value) => {
    expect(() => resolvePublicOAuthCallbackBase('production', value, BACKEND)).toThrow(
      PublicOAuthCallbackBaseConfigurationError,
    );
  });

  it('refuses http in production - Google compares redirect_uri byte for byte', () => {
    expect(() =>
      resolvePublicOAuthCallbackBase('production', 'http://app.example.com/api', BACKEND),
    ).toThrow(PublicOAuthCallbackBaseConfigurationError);
  });

  it.each(['Production', ' production ', 'PRODUCTION'])(
    'applies the https rule for NODE_ENV=%p, matching the normaliser used elsewhere',
    (nodeEnv) => {
      expect(() =>
        resolvePublicOAuthCallbackBase(nodeEnv, 'http://app.example.com/api', BACKEND),
      ).toThrow(PublicOAuthCallbackBaseConfigurationError);
    },
  );

  it('refuses an over-length value', () => {
    const long = `${FRONTEND}/${'a'.repeat(300)}`;
    expect(() => resolvePublicOAuthCallbackBase('production', long, BACKEND)).toThrow(
      PublicOAuthCallbackBaseConfigurationError,
    );
  });

  /**
   * PRESENT BUT MALFORMED IS FATAL EVERYWHERE, INCLUDING DEVELOPMENT. A silently
   * ignored setting looks configured and is not - the failure mode the B-2
   * repair exists to end. This module must not reintroduce it one variable over.
   */
  it.each(['development', 'test', undefined])(
    'still throws for a malformed value when NODE_ENV is %p',
    (nodeEnv) => {
      expect(() => resolvePublicOAuthCallbackBase(nodeEnv, `${FRONTEND}/api?x=1`, BACKEND)).toThrow(
        PublicOAuthCallbackBaseConfigurationError,
      );
    },
  );

  it('names the variable in every message, so a boot failure is self-explaining', () => {
    for (const bad of [`${FRONTEND}/api?x=1`, `${FRONTEND}/API`, 'not-a-url']) {
      expect(() => resolvePublicOAuthCallbackBase('production', bad, BACKEND)).toThrow(
        new RegExp(PUBLIC_OAUTH_CALLBACK_BASE_ENV),
      );
    }
  });

  /**
   * THE PROPERTY THAT MATTERS MOST: no accepted value can point at another host.
   */
  it('never yields a base outside the host that was configured', () => {
    for (const candidate of [`${FRONTEND}/api`, `${FRONTEND}/api/v2`, BACKEND, `${BACKEND}/`]) {
      const resolved = resolvePublicOAuthCallbackBase('production', candidate, BACKEND);
      expect(new URL(resolved).host).toBe(new URL(candidate).host);
    }
  });
});
