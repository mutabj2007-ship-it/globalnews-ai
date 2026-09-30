import { AUTH_ERROR_PARAM } from '@globalnews-ai/shared';
import { AuthService } from './auth.service';
import {
  createOAuthFlowState,
  decodeOAuthFlowState,
  encodeOAuthFlowState,
} from './oauth-flow-state';
import { resolveAuthCookieNames } from './cookie.util';
import { GuestSessionService } from '../ask-v2/guest/guest-session.service';
import type { PrismaService } from '../../database/prisma.service';
import type { SessionService } from './session.service';
import type { GuestClaimService } from '../ask-v2/guest/guest-claim.service';

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
 * ASK GUEST TRIAL R3 — CTO D7. The return-to-Ask behaviour exists ONLY for an Ask
 * guest-continuation flow whose server-bound, signed state carries a claim. Every other entry
 * point keeps its landed behaviour; the draft is never executed; no identifier is in any URL.
 */

const CLAIM = '6f3c1a52-9d0e-4c1b-8a55-0c2f8d7b1e90';
const GUEST_RAW = 'a'.repeat(64);
const FRONTEND = 'http://localhost:3000';

function response() {
  let redirectedTo: string | undefined;
  const cleared: string[] = [];
  const cookies: Record<string, string> = {};
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
    _cleared: cleared,
    _cookies: cookies,
    get _to() {
      return redirectedTo;
    },
  };
}

function build(opts: { pendingClaim?: string | null; guest?: boolean } = {}) {
  const prisma = {
    userIdentity: { findUnique: jest.fn().mockResolvedValue(null) },
    user: { create: jest.fn().mockResolvedValue({ id: 'user-1' }) },
  } as unknown as PrismaService;
  const sessions = {
    createSession: jest
      .fn()
      .mockResolvedValue({ rawToken: 'raw-token', expiresAt: new Date(Date.now() + 60_000) }),
  } as unknown as SessionService;
  const guestSessions = {
    resolve: jest
      .fn()
      .mockResolvedValue(opts.guest === false ? null : { id: 'guest-1', expiresAt: new Date() }),
    rawTokenFrom: jest.fn((req: { cookies?: Record<string, string> }) => req.cookies?.gna_guest),
    clearCookie: jest.fn(),
  } as unknown as GuestSessionService;
  const guestClaims = {
    pendingClaimFor: jest
      .fn()
      .mockResolvedValue(opts.pendingClaim === undefined ? CLAIM : opts.pendingClaim),
    transfer: jest.fn().mockResolvedValue({ transferred: true, threadId: 't-1' }),
  } as unknown as GuestClaimService & { transfer: jest.Mock; pendingClaimFor: jest.Mock };
  return {
    service: new AuthService(prisma, sessions, guestSessions, guestClaims),
    guestClaims,
    guestSessions,
  };
}

function callbackRequest(flow: string | undefined, guestCookie = true) {
  const names = resolveAuthCookieNames();
  return {
    cookies: {
      ...(flow ? { [names.oauthFlow]: flow } : {}),
      ...(guestCookie ? { gna_guest: GUEST_RAW } : {}),
    },
    headers: {},
  } as never;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.OAUTH_FLOW_SECRET = 'test-oauth-flow-secret-r3';
  process.env.OAUTH_CLIENT_ID = 'client-id';
  process.env.OAUTH_CLIENT_SECRET = 'client-secret';
  process.env.FRONTEND_ORIGIN = FRONTEND;
});

describe('start — the claim is bound server-side, never carried in a URL', () => {
  it('guest-continuation start puts the claim in the SIGNED flow cookie only', async () => {
    const { service } = build();
    const res = response();
    await service.startGoogleAuth(res as never, '/ask', 'ask-guest', callbackRequest(undefined));
    const flow = decodeOAuthFlowState(res._cookies[resolveAuthCookieNames().oauthFlow]);
    expect(flow?.guestClaimId).toBe(CLAIM);
    expect(flow?.returnTo).toBe('/ask');
    expect(res._to).not.toContain(CLAIM);
    expect(res._to).not.toContain('guest');
  });

  it('an ordinary sign-in (no intent) is the landed synchronous path, with no claim', () => {
    const { service, guestClaims } = build();
    const res = response();
    expect(service.startGoogleAuth(res as never, '/ask')).toBeUndefined();
    expect(
      decodeOAuthFlowState(res._cookies[resolveAuthCookieNames().oauthFlow])?.guestClaimId,
    ).toBeUndefined();
    expect(guestClaims.pendingClaimFor).not.toHaveBeenCalled();
  });

  it('the intent is ignored for any destination other than /ask', async () => {
    const { service } = build();
    const res = response();
    await service.startGoogleAuth(res as never, '/map', 'ask-guest', callbackRequest(undefined));
    expect(
      decodeOAuthFlowState(res._cookies[resolveAuthCookieNames().oauthFlow])?.guestClaimId,
    ).toBeUndefined();
  });

  it('no guest cookie (or no pending claim) → an ordinary flow, no claim', async () => {
    for (const opts of [{ guest: false }, { pendingClaim: null }]) {
      const { service } = build(opts);
      const res = response();
      await service.startGoogleAuth(res as never, '/ask', 'ask-guest', callbackRequest(undefined));
      expect(
        decodeOAuthFlowState(res._cookies[resolveAuthCookieNames().oauthFlow])?.guestClaimId,
      ).toBeUndefined();
    }
  });
});

describe('callback — cancel, denial, failure, success, replay', () => {
  const guestFlow = () => createOAuthFlowState('/ask', CLAIM);

  it('cancel/denial on a VALID guest-continuation flow returns to Ask, consuming nothing', async () => {
    for (const denial of ['access_denied', 'consent_required']) {
      const { service, guestClaims } = build();
      const flow = guestFlow();
      const res = response();
      await service.handleGoogleCallback(
        undefined,
        flow.state,
        denial,
        callbackRequest(encodeOAuthFlowState(flow)),
        res as never,
      );
      expect(res._to).toBe(`${FRONTEND}/ask?${AUTH_ERROR_PARAM}=cancelled`);
      expect(guestClaims.transfer).not.toHaveBeenCalled();
      expect(res._cleared).toContain(resolveAuthCookieNames().oauthFlow);
    }
  });

  it('cancel on an ORDINARY flow keeps the landed Home fallback (unchanged)', async () => {
    const { service } = build();
    const flow = createOAuthFlowState('/ask');
    const res = response();
    await service.handleGoogleCallback(
      undefined,
      flow.state,
      'access_denied',
      callbackRequest(encodeOAuthFlowState(flow)),
      res as never,
    );
    expect(res._to).toBe(`${FRONTEND}/?${AUTH_ERROR_PARAM}=cancelled`);
  });

  it('cancel with an invalid, missing or expired flow cookie keeps the landed Home fallback', async () => {
    const expired = { ...guestFlow(), expiresAt: Date.now() - 1 };
    for (const cookie of [undefined, 'tampered.value', encodeOAuthFlowState(expired)]) {
      const { service } = build();
      const res = response();
      await service.handleGoogleCallback(
        undefined,
        'x',
        'access_denied',
        callbackRequest(cookie),
        res as never,
      );
      expect(res._to).toBe(`${FRONTEND}/?${AUTH_ERROR_PARAM}=cancelled`);
    }
  });

  it('state mismatch keeps the landed failure (no Ask return, no transfer)', async () => {
    const { service, guestClaims } = build();
    const flow = guestFlow();
    const res = response();
    await service.handleGoogleCallback(
      'code',
      'WRONG',
      undefined,
      callbackRequest(encodeOAuthFlowState(flow)),
      res as never,
    );
    expect(res._to).toBe(`${FRONTEND}/?${AUTH_ERROR_PARAM}=failed`);
    expect(guestClaims.transfer).not.toHaveBeenCalled();
  });

  it('success consumes the claim with the guest cookie PRESENTED ON THIS CALLBACK, renews the session, lands on /ask', async () => {
    googleOidc.exchangeGoogleAuthorizationCode.mockResolvedValue({ idToken: 't' });
    googleOidc.verifyGoogleIdToken.mockResolvedValue({
      subject: 'sub-1',
      email: 'a@example.invalid',
    });
    const { service, guestClaims, guestSessions } = build();
    const flow = guestFlow();
    const res = response();
    await service.handleGoogleCallback(
      'code',
      flow.state,
      undefined,
      callbackRequest(encodeOAuthFlowState(flow)),
      res as never,
    );
    expect(guestClaims.transfer).toHaveBeenCalledWith(
      CLAIM,
      GuestSessionService.hashToken(GUEST_RAW),
      'user-1',
    );
    expect(guestSessions.clearCookie).toHaveBeenCalled();
    expect(res._cookies[resolveAuthCookieNames().session]).toBe('raw-token');
    expect(res._to).toBe(`${FRONTEND}/ask`);
  });

  it('success WITHOUT the guest cookie on the callback presents null: the transfer cannot happen', async () => {
    googleOidc.exchangeGoogleAuthorizationCode.mockResolvedValue({ idToken: 't' });
    googleOidc.verifyGoogleIdToken.mockResolvedValue({
      subject: 'sub-1',
      email: 'a@example.invalid',
    });
    const { service, guestClaims } = build();
    (guestClaims.transfer as jest.Mock).mockResolvedValue({ transferred: false, threadId: null });
    const flow = guestFlow();
    const res = response();
    await service.handleGoogleCallback(
      'code',
      flow.state,
      undefined,
      callbackRequest(encodeOAuthFlowState(flow), false),
      res as never,
    );
    expect(guestClaims.transfer).toHaveBeenCalledWith(CLAIM, null, 'user-1');
    expect(res._to).toBe(`${FRONTEND}/ask`);
  });

  it('a transfer failure never blocks sign-in', async () => {
    googleOidc.exchangeGoogleAuthorizationCode.mockResolvedValue({ idToken: 't' });
    googleOidc.verifyGoogleIdToken.mockResolvedValue({
      subject: 'sub-1',
      email: 'a@example.invalid',
    });
    const { service, guestClaims } = build();
    (guestClaims.transfer as jest.Mock).mockRejectedValue(new Error('db down'));
    const flow = guestFlow();
    const res = response();
    await service.handleGoogleCallback(
      'code',
      flow.state,
      undefined,
      callbackRequest(encodeOAuthFlowState(flow)),
      res as never,
    );
    expect(res._cookies[resolveAuthCookieNames().session]).toBe('raw-token');
    expect(res._to).toBe(`${FRONTEND}/ask`);
  });

  it('a failure AFTER a valid guest-continuation state returns to Ask, not Home', async () => {
    googleOidc.exchangeGoogleAuthorizationCode.mockRejectedValue(new Error('exchange failed'));
    const { service } = build();
    const flow = guestFlow();
    const res = response();
    await service.handleGoogleCallback(
      'code',
      flow.state,
      undefined,
      callbackRequest(encodeOAuthFlowState(flow)),
      res as never,
    );
    expect(res._to).toBe(`${FRONTEND}/ask?${AUTH_ERROR_PARAM}=failed`);
  });

  it('replay: the one-time flow cookie is cleared first, so a second callback cannot consume anything', async () => {
    googleOidc.exchangeGoogleAuthorizationCode.mockResolvedValue({ idToken: 't' });
    googleOidc.verifyGoogleIdToken.mockResolvedValue({
      subject: 'sub-1',
      email: 'a@example.invalid',
    });
    const { service, guestClaims } = build();
    const flow = guestFlow();
    const first = response();
    await service.handleGoogleCallback(
      'code',
      flow.state,
      undefined,
      callbackRequest(encodeOAuthFlowState(flow)),
      first as never,
    );
    expect(first._cleared).toContain(resolveAuthCookieNames().oauthFlow);
    const second = response();
    /* The browser no longer holds the flow cookie. */
    await service.handleGoogleCallback(
      'code',
      flow.state,
      undefined,
      callbackRequest(undefined),
      second as never,
    );
    expect(guestClaims.transfer).toHaveBeenCalledTimes(1);
    expect(second._to).toBe(`${FRONTEND}/?${AUTH_ERROR_PARAM}=failed`);
  });
});
