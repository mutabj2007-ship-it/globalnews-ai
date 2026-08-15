import { ServiceUnavailableException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { GoogleOidcError } from './google-oidc.util';
import { createOAuthFlowState, encodeOAuthFlowState } from './oauth-flow-state';
import { OAUTH_FLOW_COOKIE_NAME, SESSION_COOKIE_NAME, CSRF_COOKIE_NAME } from './cookie.util';
import type { PrismaService } from '../../database/prisma.service';
import type { SessionService } from './session.service';

jest.mock('./google-oidc.util', () => {
  const actual = jest.requireActual('./google-oidc.util');
  return {
    ...actual,
    exchangeGoogleAuthorizationCode: jest.fn(),
    verifyGoogleIdToken: jest.fn(),
  };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const googleOidc = require('./google-oidc.util');

/**
 * Milestone #57 — proves AuthService's own orchestration/control-flow
 * logic: every rejection path (missing/mismatched state, a thrown
 * GoogleOidcError from token exchange or ID-token verification)
 * results in the SAME safe outcome — the flow-state cookie is cleared
 * and the browser is redirected to a generic error indicator, never a
 * partial or inconsistent session. The real jose-based signature/aud/
 * iss/exp/nonce verification itself lives in google-oidc.util.ts and
 * is exercised there against real jose (see that file's own spec) —
 * this file mocks it to isolate AuthService's OWN behavior around
 * whatever verifyGoogleIdToken decides.
 */
describe('AuthService.handleGoogleCallback (Milestone #57)', () => {
  function makeFakeResponse() {
    const cookies: Record<string, unknown> = {};
    const cleared: string[] = [];
    let redirectedTo: string | undefined;
    return {
      cookie: jest.fn((name: string, value: string) => {
        cookies[name] = value;
      }),
      clearCookie: jest.fn((name: string) => {
        cleared.push(name);
      }),
      redirect: jest.fn((url: string) => {
        redirectedTo = url;
      }),
      _cookies: cookies,
      _cleared: cleared,
      get _redirectedTo() {
        return redirectedTo;
      },
    } as never;
  }

  function makeFakeRequest(flowStateCookieValue: string | undefined) {
    return {
      cookies: { [OAUTH_FLOW_COOKIE_NAME]: flowStateCookieValue },
      protocol: 'http',
      get: () => 'localhost:4000',
    } as never;
  }

  function makeService() {
    const prisma = {
      userIdentity: { findUnique: jest.fn().mockResolvedValue(null) },
      user: { create: jest.fn().mockResolvedValue({ id: 'user-1' }) },
    } as unknown as PrismaService;
    const sessionService = {
      createSession: jest.fn().mockResolvedValue({ rawToken: 'raw-token', expiresAt: new Date(Date.now() + 1000) }),
    } as unknown as SessionService;
    return new AuthService(prisma, sessionService);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    // Milestone #57 security correction — oauth-flow-state.ts now
    // HMAC-signs the flow-state cookie using OAUTH_FLOW_SECRET.
    // Existing tests below construct/decode flow-state cookies via
    // createOAuthFlowState()/encodeOAuthFlowState() directly, so a
    // real value is set here for every test by default; the one new
    // fail-closed test explicitly unsets it to prove that specific
    // behavior.
    process.env.OAUTH_FLOW_SECRET = 'test-oauth-flow-secret-for-auth-service-spec';
  });

  it('rejects the callback when the flow-state cookie is entirely absent', async () => {
    const service = makeService();
    const response = makeFakeResponse() as unknown as {
      clearCookie: jest.Mock;
      redirect: jest.Mock;
      _redirectedTo: string | undefined;
    };
    const request = makeFakeRequest(undefined);

    await service.handleGoogleCallback('some-code', 'some-state', request, response as never);

    expect(response.clearCookie).toHaveBeenCalledWith(OAUTH_FLOW_COOKIE_NAME, expect.anything());
    expect(response._redirectedTo).toContain('auth_error=1');
    expect(googleOidc.exchangeGoogleAuthorizationCode).not.toHaveBeenCalled();
  });

  it('rejects the callback when the returned state does not match the stored flow-state', async () => {
    const service = makeService();
    const flowState = createOAuthFlowState();
    const response = makeFakeResponse() as unknown as { redirect: jest.Mock; _redirectedTo: string | undefined };
    const request = makeFakeRequest(encodeOAuthFlowState(flowState));

    await service.handleGoogleCallback('some-code', 'a-completely-different-state', request, response as never);

    expect(response._redirectedTo).toContain('auth_error=1');
    expect(googleOidc.exchangeGoogleAuthorizationCode).not.toHaveBeenCalled();
  });

  it('rejects the callback when the code query parameter is missing', async () => {
    const service = makeService();
    const flowState = createOAuthFlowState();
    const response = makeFakeResponse() as unknown as { redirect: jest.Mock; _redirectedTo: string | undefined };
    const request = makeFakeRequest(encodeOAuthFlowState(flowState));

    await service.handleGoogleCallback(undefined, flowState.state, request, response as never);

    expect(response._redirectedTo).toContain('auth_error=1');
  });

  it('proceeds to token exchange and ID-token verification when state matches, passing the stored nonce through unchanged', async () => {
    const service = makeService();
    const flowState = createOAuthFlowState();
    const response = makeFakeResponse() as unknown as { redirect: jest.Mock; cookie: jest.Mock };
    const request = makeFakeRequest(encodeOAuthFlowState(flowState));

    googleOidc.exchangeGoogleAuthorizationCode.mockResolvedValue({ idToken: 'fake-id-token' });
    googleOidc.verifyGoogleIdToken.mockResolvedValue({ subject: 'google-sub-1', email: 'user@example.com' });

    await service.handleGoogleCallback('real-code', flowState.state, request, response as never);

    expect(googleOidc.exchangeGoogleAuthorizationCode).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'real-code', codeVerifier: flowState.codeVerifier }),
    );
    expect(googleOidc.verifyGoogleIdToken).toHaveBeenCalledWith('fake-id-token', expect.any(String), flowState.nonce);
  });

  it('a nonce mismatch (surfaced as a thrown GoogleOidcError from verifyGoogleIdToken) results in the same safe error redirect, never a partial session', async () => {
    const service = makeService();
    const flowState = createOAuthFlowState();
    const response = makeFakeResponse() as unknown as {
      redirect: jest.Mock;
      cookie: jest.Mock;
      _redirectedTo: string | undefined;
    };
    const request = makeFakeRequest(encodeOAuthFlowState(flowState));

    googleOidc.exchangeGoogleAuthorizationCode.mockResolvedValue({ idToken: 'fake-id-token' });
    googleOidc.verifyGoogleIdToken.mockRejectedValue(new GoogleOidcError('ID token nonce did not match.'));

    await service.handleGoogleCallback('real-code', flowState.state, request, response as never);

    expect(response._redirectedTo).toContain('auth_error=1');
    expect(response.cookie).not.toHaveBeenCalledWith(SESSION_COOKIE_NAME, expect.anything(), expect.anything());
  });

  it('on success, sets both the session cookie and the CSRF cookie, and redirects to the frontend origin (not an error)', async () => {
    const service = makeService();
    const flowState = createOAuthFlowState();
    const response = makeFakeResponse() as unknown as {
      redirect: jest.Mock;
      cookie: jest.Mock;
      _redirectedTo: string | undefined;
    };
    const request = makeFakeRequest(encodeOAuthFlowState(flowState));

    googleOidc.exchangeGoogleAuthorizationCode.mockResolvedValue({ idToken: 'fake-id-token' });
    googleOidc.verifyGoogleIdToken.mockResolvedValue({ subject: 'google-sub-1', email: 'user@example.com' });

    await service.handleGoogleCallback('real-code', flowState.state, request, response as never);

    expect(response.cookie).toHaveBeenCalledWith(SESSION_COOKIE_NAME, expect.any(String), expect.anything());
    expect(response.cookie).toHaveBeenCalledWith(CSRF_COOKIE_NAME, expect.any(String), expect.anything());
    expect(response._redirectedTo).not.toContain('auth_error');
  });

  /**
   * Milestone #57 security correction — previously, startGoogleAuth
   * would build a Google authorization URL and redirect to it even
   * with a blank client_id (or without a configured flow-state
   * secret), sending the user into a broken sign-in attempt instead
   * of a controlled failure.
   */
  describe('startGoogleAuth configuration fail-closed check (Milestone #57 security correction)', () => {
    const originalClientId = process.env.OAUTH_CLIENT_ID;
    const originalClientSecret = process.env.OAUTH_CLIENT_SECRET;
    const originalFlowSecret = process.env.OAUTH_FLOW_SECRET;

    afterEach(() => {
      process.env.OAUTH_CLIENT_ID = originalClientId;
      process.env.OAUTH_CLIENT_SECRET = originalClientSecret;
      process.env.OAUTH_FLOW_SECRET = originalFlowSecret;
    });

    it('throws ServiceUnavailableException instead of redirecting when OAUTH_CLIENT_ID is missing', () => {
      const service = makeService();
      const response = makeFakeResponse() as unknown as { redirect: jest.Mock };
      const request = makeFakeRequest(undefined);

      delete process.env.OAUTH_CLIENT_ID;
      process.env.OAUTH_CLIENT_SECRET = 'present';
      process.env.OAUTH_FLOW_SECRET = 'present';

      expect(() => service.startGoogleAuth(request, response as never)).toThrow(ServiceUnavailableException);
      expect(response.redirect).not.toHaveBeenCalled();
    });

    it('throws ServiceUnavailableException instead of redirecting when OAUTH_FLOW_SECRET is missing, even though the Google client credentials are present', () => {
      const service = makeService();
      const response = makeFakeResponse() as unknown as { redirect: jest.Mock };
      const request = makeFakeRequest(undefined);

      process.env.OAUTH_CLIENT_ID = 'present';
      process.env.OAUTH_CLIENT_SECRET = 'present';
      delete process.env.OAUTH_FLOW_SECRET;

      expect(() => service.startGoogleAuth(request, response as never)).toThrow(ServiceUnavailableException);
      expect(response.redirect).not.toHaveBeenCalled();
    });

    it('the error message never names which specific variable is missing', () => {
      const service = makeService();
      const response = makeFakeResponse() as unknown as { redirect: jest.Mock };
      const request = makeFakeRequest(undefined);

      delete process.env.OAUTH_CLIENT_ID;
      delete process.env.OAUTH_CLIENT_SECRET;
      delete process.env.OAUTH_FLOW_SECRET;

      try {
        service.startGoogleAuth(request, response as never);
        fail('expected startGoogleAuth to throw');
      } catch (error) {
        const message = (error as ServiceUnavailableException).message;
        expect(message).not.toMatch(/OAUTH_CLIENT_ID/);
        expect(message).not.toMatch(/OAUTH_CLIENT_SECRET/);
        expect(message).not.toMatch(/OAUTH_FLOW_SECRET/);
      }
    });

    it('proceeds to redirect normally when all three required variables are present', () => {
      const service = makeService();
      const response = makeFakeResponse() as unknown as { redirect: jest.Mock; cookie: jest.Mock };
      const request = makeFakeRequest(undefined);

      process.env.OAUTH_CLIENT_ID = 'present';
      process.env.OAUTH_CLIENT_SECRET = 'present';
      process.env.OAUTH_FLOW_SECRET = 'present';

      expect(() => service.startGoogleAuth(request, response as never)).not.toThrow();
      expect(response.redirect).toHaveBeenCalledTimes(1);
    });
  });
});
