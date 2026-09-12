import { buildGoogleAuthUrl } from './google-oidc.util';

/**
 * Milestone #57 — buildGoogleAuthUrl has no external dependency (pure
 * URL construction), so it is directly, fully testable. verifyGoogleIdToken
 * and exchangeGoogleAuthorizationCode depend on `jose`'s remote JWKS
 * fetch and Google's live token endpoint respectively, and are
 * covered by AuthService-level tests using mocked responses instead
 * (see auth.service.spec.ts) rather than duplicated here.
 */
describe('buildGoogleAuthUrl (Milestone #57)', () => {
  const baseParams = {
    clientId: 'test-client-id',
    redirectUri: 'http://localhost:4000/auth/google/callback',
    state: 'test-state-value',
    nonce: 'test-nonce-value',
    codeChallenge: 'test-code-challenge',
  };

  it('targets Google\u2019s real authorization endpoint', () => {
    const url = new URL(buildGoogleAuthUrl(baseParams));
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
  });

  it('uses response_type=code \u2014 the authorization-code flow, never implicit', () => {
    const url = new URL(buildGoogleAuthUrl(baseParams));
    expect(url.searchParams.get('response_type')).toBe('code');
  });

  it('uses code_challenge_method=S256 \u2014 PKCE, never the weaker "plain" method', () => {
    const url = new URL(buildGoogleAuthUrl(baseParams));
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('includes state, nonce, and code_challenge exactly as supplied', () => {
    const url = new URL(buildGoogleAuthUrl(baseParams));
    expect(url.searchParams.get('state')).toBe('test-state-value');
    expect(url.searchParams.get('nonce')).toBe('test-nonce-value');
    expect(url.searchParams.get('code_challenge')).toBe('test-code-challenge');
  });

  it('requests only openid/email scope \u2014 Milestone #58 privacy hardening narrowed this from the broader "profile" scope, which was requested but never used', () => {
    const url = new URL(buildGoogleAuthUrl(baseParams));
    expect(url.searchParams.get('scope')).toBe('openid email');
  });

  it('does not request the "profile" scope', () => {
    const url = new URL(buildGoogleAuthUrl(baseParams));
    expect(url.searchParams.get('scope')).not.toMatch(/\bprofile\b/);
  });

  it('includes the exact redirect_uri and client_id supplied', () => {
    const url = new URL(buildGoogleAuthUrl(baseParams));
    expect(url.searchParams.get('redirect_uri')).toBe(baseParams.redirectUri);
    expect(url.searchParams.get('client_id')).toBe(baseParams.clientId);
  });
});
