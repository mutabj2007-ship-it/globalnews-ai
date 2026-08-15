import { buildCsrfCookieOptions, buildOAuthFlowCookieOptions, buildSessionCookieOptions } from './cookie.util';

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
