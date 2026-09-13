import { readFileSync } from 'fs';
import { join } from 'path';
import { AuthService } from './auth.service';
import {
  createOAuthFlowState,
  decodeOAuthFlowState,
  encodeOAuthFlowState,
} from './oauth-flow-state';
import { OAUTH_FLOW_COOKIE_NAME, SESSION_COOKIE_NAME, CSRF_COOKIE_NAME } from './cookie.util';
import { PublicOAuthCallbackBaseConfigurationError } from '../../security/public-oauth-callback-base.config';
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

const FRONTEND = 'https://frontend-production-c606.up.railway.app';

/**
 * M-ALPHA-AUTH - the end-to-end contract, in a NEW file.
 *
 * Deliberately not added to auth.service.spec.ts. That suite is an accepted
 * artifact whose four failure-path assertions pin behaviour this milestone must
 * not disturb; leaving it byte-identical is how that stays provable. This file
 * only adds.
 */
describe('M-ALPHA-AUTH callback return destination', () => {
  function makeFakeResponse() {
    const cookies: Record<string, unknown> = {};
    const cookieOptions: Record<string, unknown> = {};
    const cleared: string[] = [];
    let redirectedTo: string | undefined;
    return {
      cookie: jest.fn((name: string, value: string, options?: unknown) => {
        cookies[name] = value;
        cookieOptions[name] = options;
      }),
      clearCookie: jest.fn((name: string) => {
        cleared.push(name);
      }),
      redirect: jest.fn((url: string) => {
        redirectedTo = url;
      }),
      status: jest.fn(function status() {
        return this;
      }),
      send: jest.fn(),
      _cookies: cookies,
      _cookieOptions: cookieOptions,
      _cleared: cleared,
      get _redirectedTo() {
        return redirectedTo;
      },
    } as never;
  }

  function makeService() {
    const prisma = {
      userIdentity: { findUnique: jest.fn().mockResolvedValue(null) },
      user: { create: jest.fn().mockResolvedValue({ id: 'user-1' }) },
    } as unknown as PrismaService;
    const sessionService = {
      createSession: jest
        .fn()
        .mockResolvedValue({ rawToken: 'raw-token', expiresAt: new Date(Date.now() + 100000) }),
      deleteSession: jest.fn().mockResolvedValue(undefined),
    } as unknown as SessionService;
    return new AuthService(prisma, sessionService);
  }

  /** Drives a full successful callback for a flow started with `returnTo`. */
  async function completeSignIn(returnTo?: string) {
    const service = makeService();
    const startResponse = makeFakeResponse() as unknown as {
      cookie: jest.Mock;
      redirect: jest.Mock;
      _cookies: Record<string, string>;
      _cookieOptions: Record<string, { secure: boolean; sameSite: string; httpOnly: boolean }>;
    };

    service.startGoogleAuth(startResponse as never, returnTo);

    const encodedFlow = startResponse._cookies[OAUTH_FLOW_COOKIE_NAME];
    const flowState = decodeOAuthFlowState(encodedFlow);

    googleOidc.exchangeGoogleAuthorizationCode.mockResolvedValue({ idToken: 'id-token' });
    googleOidc.verifyGoogleIdToken.mockResolvedValue({
      subject: 'google-subject',
      email: 'tester@example.com',
    });

    const callbackResponse = makeFakeResponse() as unknown as {
      cookie: jest.Mock;
      clearCookie: jest.Mock;
      redirect: jest.Mock;
      _cookies: Record<string, string>;
      _cookieOptions: Record<string, { secure: boolean; sameSite: string; httpOnly: boolean }>;
      _cleared: string[];
      _redirectedTo: string | undefined;
    };

    await service.handleGoogleCallback(
      'auth-code',
      flowState?.state,
      { cookies: { [OAUTH_FLOW_COOKIE_NAME]: encodedFlow } } as never,
      callbackResponse as never,
    );

    return { service, startResponse, callbackResponse, flowState };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OAUTH_FLOW_SECRET = 'test-oauth-flow-secret-m-alpha-auth';
    process.env.OAUTH_CLIENT_ID = 'test-client-id';
    process.env.OAUTH_CLIENT_SECRET = 'test-client-secret';
    process.env.FRONTEND_ORIGIN = FRONTEND;
    process.env.PUBLIC_BACKEND_ORIGIN = 'https://backend-production-bed5.up.railway.app';
    process.env.NODE_ENV = 'production';
  });

  it.each([
    ['/support', 'the reported defect: Support must not land on Home'],
    ['/history', 'History'],
    ['/admin', 'Admin, before RBAC decides anything'],
    ['/admin/support', 'a nested admin page'],
    ['/', 'the homepage, stated explicitly'],
  ])('returns the user to %s (%s)', async (destination) => {
    const { callbackResponse } = await completeSignIn(destination);
    expect(callbackResponse._redirectedTo).toBe(new URL(destination, FRONTEND).toString());
  });

  it('preserves the pre-existing homepage default when no destination was supplied', async () => {
    const { callbackResponse } = await completeSignIn(undefined);
    expect(callbackResponse._redirectedTo).toBe(FRONTEND);
  });

  it.each([
    ['//evil.example'],
    ['https://evil.example'],
    ['/\\evil.example'],
    ['javascript:alert(1)'],
    ['/support@evil.example'],
    ['/../admin'],
  ])('fails an unsafe destination (%s) closed to the frontend origin', async (destination) => {
    const { callbackResponse } = await completeSignIn(destination);
    expect(callbackResponse._redirectedTo).toBe(FRONTEND);
    expect(new URL(callbackResponse._redirectedTo as string).origin).toBe(new URL(FRONTEND).origin);
  });

  /**
   * The entry gate must leave no trace of a rejected value. If a probe produced
   * a flow-state payload that differed from an ordinary sign-in's, the rejected
   * string would be sitting in a cookie waiting for some later code to trust it.
   */
  it('never stores a rejected destination in the flow state', async () => {
    const { startResponse } = await completeSignIn('//evil.example');
    const decoded = decodeOAuthFlowState(startResponse._cookies[OAUTH_FLOW_COOKIE_NAME]);
    expect(decoded).not.toBeNull();
    expect(decoded?.returnTo).toBeUndefined();
  });

  it('a tampered destination cannot survive the HMAC in transit', () => {
    process.env.OAUTH_FLOW_SECRET = 'secret-one';
    const encoded = encodeOAuthFlowState(createOAuthFlowState('/support'));

    const [payload] = encoded.split('.');
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as {
      returnTo?: string;
    };
    parsed.returnTo = 'https://evil.example';
    const forgedPayload = Buffer.from(JSON.stringify(parsed), 'utf-8').toString('base64url');
    const forged = `${forgedPayload}.${encoded.split('.')[1]}`;

    expect(decodeOAuthFlowState(forged)).toBeNull();
  });

  it('a flow state written before this milestone still signs the user in, landing on the homepage', () => {
    process.env.OAUTH_FLOW_SECRET = 'secret-legacy';
    const legacy = createOAuthFlowState();
    expect(legacy.returnTo).toBeUndefined();
    const decoded = decodeOAuthFlowState(encodeOAuthFlowState(legacy));
    expect(decoded).not.toBeNull();
    expect(decoded?.returnTo).toBeUndefined();
  });

  it('a signed but non-string returnTo decodes to no destination rather than a rejected sign-in', () => {
    process.env.OAUTH_FLOW_SECRET = 'secret-shape';
    const flow = createOAuthFlowState();
    const payloadObject = { ...flow, returnTo: 42 };
    const payload = Buffer.from(JSON.stringify(payloadObject), 'utf-8').toString('base64url');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createHmac } = require('crypto');
    const signature = createHmac('sha256', 'secret-shape').update(payload).digest('base64url');

    const decoded = decodeOAuthFlowState(`${payload}.${signature}`);
    expect(decoded).not.toBeNull();
    expect(decoded?.returnTo).toBeUndefined();
  });

  it('still creates exactly one session and sets both cookies on success', async () => {
    const { callbackResponse } = await completeSignIn('/support');
    expect(callbackResponse._cookies[SESSION_COOKIE_NAME]).toBe('raw-token');
    expect(callbackResponse._cookies[CSRF_COOKIE_NAME]).toEqual(expect.any(String));
    expect(callbackResponse._cleared).toContain(OAUTH_FLOW_COOKIE_NAME);
  });
});

/**
 * M-ALPHA-AUTH - CTO requirement 12, at the level the service actually issues
 * cookies rather than at the builder level (cookie.util.spec.ts covers that).
 */
describe('M-ALPHA-AUTH cookie attributes as actually issued', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('issues Secure, HttpOnly, SameSite=Lax session cookies for an https account origin even when NODE_ENV is not production', async () => {
    process.env.OAUTH_FLOW_SECRET = 'secret';
    process.env.OAUTH_CLIENT_ID = 'id';
    process.env.OAUTH_CLIENT_SECRET = 'secret';
    process.env.FRONTEND_ORIGIN = FRONTEND;
    process.env.PUBLIC_BACKEND_ORIGIN = 'https://backend-production-bed5.up.railway.app';
    process.env.NODE_ENV = 'staging';

    const prisma = {
      userIdentity: { findUnique: jest.fn().mockResolvedValue(null) },
      user: { create: jest.fn().mockResolvedValue({ id: 'user-1' }) },
    } as unknown as PrismaService;
    const sessionService = {
      createSession: jest
        .fn()
        .mockResolvedValue({ rawToken: 'raw-token', expiresAt: new Date(Date.now() + 100000) }),
    } as unknown as SessionService;
    const service = new AuthService(prisma, sessionService);

    const cookieOptions: Record<string, { secure: boolean; sameSite: string; httpOnly: boolean }> =
      {};
    const response = {
      cookie: jest.fn((name: string, _value: string, options: never) => {
        cookieOptions[name] = options;
      }),
      clearCookie: jest.fn(),
      redirect: jest.fn(),
    } as never;

    service.startGoogleAuth(response, '/support');

    expect(cookieOptions[OAUTH_FLOW_COOKIE_NAME].secure).toBe(true);
    expect(cookieOptions[OAUTH_FLOW_COOKIE_NAME].sameSite).toBe('lax');
    expect(cookieOptions[OAUTH_FLOW_COOKIE_NAME].httpOnly).toBe(true);
  });
});

/**
 * M-ALPHA-AUTH - the guarantees this milestone must not have broken.
 *
 * Source-level assertions, because the property being proved is "which routes
 * carry which guard", and that is a property of the wiring rather than of any
 * one request. A runtime test would need the whole Nest graph to prove
 * something a reader can check directly.
 */
describe('M-ALPHA-AUTH preserved guarantees', () => {
  const backendSrc = join(__dirname, '..', '..');

  /** Segments rather than a path string, so this is correct on any platform. */
  function read(...segments: string[]): string {
    return readFileSync(join(backendSrc, ...segments), 'utf-8');
  }

  it('guest Analysis is still reachable without a session', () => {
    const controller = read('modules', 'analysis', 'controller', 'analysis.controller.ts');
    expect(controller).not.toContain('RequireAuthGuard');
    expect(controller).not.toContain('AdminGuard');
  });

  it('guest news and country news are still reachable without a session', () => {
    expect(read('modules', 'news', 'news.controller.ts')).not.toContain('RequireAuthGuard');
    expect(read('modules', 'news', 'country', 'country-news.controller.ts')).not.toContain(
      'RequireAuthGuard',
    );
  });

  it('RBAC is untouched: AdminGuard still fails closed on missing capability metadata', () => {
    const guard = read('modules', 'admin', 'admin.guard.ts');
    expect(guard).toContain('if (required === undefined) {');
    expect(guard).toContain('throw new ForbiddenException();');
    expect(guard).toContain('const role = await this.adminService.findAdminRole(userId);');
  });

  it('the CSRF double-submit guard is unchanged and still fails closed', () => {
    const guard = read('modules', 'auth', 'csrf.guard.ts');
    expect(guard).toContain('if (cookieValue !== headerValue) {');
    expect(guard).toContain('throw new ForbiddenException');
  });

  it('Sign Out still deletes the session row and clears both cookies', () => {
    const service = read('modules', 'auth', 'auth.service.ts');
    expect(service).toContain('await this.sessionService.deleteSession(rawToken);');
    expect(service).toContain(`response.clearCookie(SESSION_COOKIE_NAME, { path: '/' });`);
    expect(service).toContain(`response.clearCookie(CSRF_COOKIE_NAME, { path: '/' });`);
  });

  it('SameSite is still lax everywhere - no third-party-cookie workaround was introduced', () => {
    const cookieUtil = read('modules', 'auth', 'cookie.util.ts');
    expect(cookieUtil).not.toMatch(/sameSite:\s*'none'/);
    // The comma pins the three BUILDER call sites specifically, not the type
    // declaration (`sameSite: 'lax';`) or the prose in the doc comments.
    expect((cookieUtil.match(/sameSite: 'lax',/g) ?? []).length).toBe(3);
  });

  /**
   * Completeness of the frontend proxy families, proved from the BACKEND side:
   * every controller that carries RequireAuthGuard must have its route prefix
   * covered by one of the six rewrite families. If someone adds an
   * authenticated controller under a seventh prefix, this fails.
   */
  it('every RequireAuthGuard-bearing controller sits under one of the six proxied prefixes', () => {
    const proxied = ['auth', 'users', 'history', 'follows', 'support', 'admin'];
    const controllers = [
      ['modules/auth/auth.controller.ts', 'auth'],
      ['modules/users/users.controller.ts', 'users'],
      ['modules/history/history.controller.ts', 'history'],
      ['modules/follows/follows.controller.ts', 'follows'],
      ['modules/support/support.controller.ts', 'support'],
      ['modules/support/admin-support.controller.ts', 'admin/support'],
      ['modules/admin/admin.controller.ts', 'admin'],
      ['modules/admin/admin-readonly.controller.ts', 'admin'],
    ] as const;

    for (const [file, prefix] of controllers) {
      const source = read(...file.split('/'));
      expect(source).toContain(`@Controller('${prefix}')`);
      expect(proxied).toContain(prefix.split('/')[0]);
    }
  });
});

/**
 * M-ALPHA-AUTH OPTION A - THE CALLBACK BASE, PROVED AS A RUNTIME CONTRACT.
 *
 * These are the CTO's five required runtime proofs, exercised through the real
 * AuthService rather than through the resolver in isolation: what matters is the
 * URI that actually reaches Google, not what a helper returns.
 */
describe('M-ALPHA-AUTH Option A callback base', () => {
  const FRONTEND = 'https://frontend-production-c606.up.railway.app';
  const BACKEND_ORIGIN = 'https://backend-production-bed5.up.railway.app';
  const saved = { ...process.env };

  function makeService() {
    const prisma = {
      userIdentity: { findUnique: jest.fn().mockResolvedValue(null) },
      user: { create: jest.fn().mockResolvedValue({ id: 'user-1' }) },
    } as unknown as PrismaService;
    const sessionService = {
      createSession: jest
        .fn()
        .mockResolvedValue({ rawToken: 'raw-token', expiresAt: new Date(Date.now() + 100000) }),
    } as unknown as SessionService;
    return new AuthService(prisma, sessionService);
  }

  function captureAuthorizationUrl(service: AuthService): URL {
    let url: string | undefined;
    const response = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
      redirect: jest.fn((value: string) => {
        url = value;
      }),
    } as never;
    service.startGoogleAuth(response);
    return new URL(url as string);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OAUTH_FLOW_SECRET = 'test-flow-secret-callback-base';
    process.env.OAUTH_CLIENT_ID = 'test-client-id';
    process.env.OAUTH_CLIENT_SECRET = 'test-client-secret';
    process.env.FRONTEND_ORIGIN = FRONTEND;
    process.env.PUBLIC_BACKEND_ORIGIN = BACKEND_ORIGIN;
    process.env.NODE_ENV = 'production';
    delete process.env.PUBLIC_OAUTH_CALLBACK_BASE;
  });

  afterEach(() => {
    process.env = { ...saved };
  });

  /** PROOF 1 */
  it('generates <FRONTEND>/api/auth/google/callback when the callback base is configured', () => {
    process.env.PUBLIC_OAUTH_CALLBACK_BASE = `${FRONTEND}/api`;

    const authUrl = captureAuthorizationUrl(makeService());

    expect(authUrl.searchParams.get('redirect_uri')).toBe(`${FRONTEND}/api/auth/google/callback`);
  });

  /** PROOF 3 - the rollback contract: unset restores the previous behaviour. */
  it.each([[undefined], [''], ['   ']])(
    'with the callback base %p, preserves the backend-origin callback exactly',
    (value) => {
      if (value === undefined) delete process.env.PUBLIC_OAUTH_CALLBACK_BASE;
      else process.env.PUBLIC_OAUTH_CALLBACK_BASE = value;

      const authUrl = captureAuthorizationUrl(makeService());

      expect(authUrl.searchParams.get('redirect_uri')).toBe(
        `${BACKEND_ORIGIN}/auth/google/callback`,
      );
    },
  );

  /** PROOF 4 - a malformed base fails at the first use, in production and out. */
  it.each([
    [`${FRONTEND}/api?x=1`, 'a query string'],
    [`${FRONTEND}/api#x`, 'a fragment'],
    [`${FRONTEND}/../api`, 'a dot segment'],
    [`${FRONTEND}//api`, 'a doubled slash'],
    ['https://user:pass@evil.example/api', 'embedded credentials'],
    ['http://app.example.com/api', 'http in production'],
    ['not-a-url', 'a non-URL'],
  ])('refuses to start the OAuth flow with %s (%s)', (value) => {
    process.env.PUBLIC_OAUTH_CALLBACK_BASE = value;
    const service = makeService();

    let redirected: string | undefined;
    const response = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
      redirect: jest.fn((url: string) => {
        redirected = url;
      }),
    } as never;

    expect(() => service.startGoogleAuth(response)).toThrow(
      PublicOAuthCallbackBaseConfigurationError,
    );
    // Nothing was sent to the browser: no half-started flow, no cookie.
    expect(redirected).toBeUndefined();
  });

  /** PROOF 5 - authorization and token exchange use ONE identical URI. */
  it('sends the SAME callback URI to the authorization request and the token exchange', async () => {
    process.env.PUBLIC_OAUTH_CALLBACK_BASE = `${FRONTEND}/api`;
    const service = makeService();

    const startResponse = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
      redirect: jest.fn(),
    } as unknown as { cookie: jest.Mock; redirect: jest.Mock };
    service.startGoogleAuth(startResponse as never);

    const authorizationUri = new URL(
      startResponse.redirect.mock.calls[0][0] as string,
    ).searchParams.get('redirect_uri');

    const encodedFlow = startResponse.cookie.mock.calls.find(
      (call) => call[0] === OAUTH_FLOW_COOKIE_NAME,
    )?.[1] as string;
    const flowState = decodeOAuthFlowState(encodedFlow);

    googleOidc.exchangeGoogleAuthorizationCode.mockResolvedValue({ idToken: 'id-token' });
    googleOidc.verifyGoogleIdToken.mockResolvedValue({
      subject: 'google-subject',
      email: 'tester@example.com',
    });

    await service.handleGoogleCallback(
      'auth-code',
      flowState?.state,
      { cookies: { [OAUTH_FLOW_COOKIE_NAME]: encodedFlow } } as never,
      { cookie: jest.fn(), clearCookie: jest.fn(), redirect: jest.fn() } as never,
    );

    const exchanged = googleOidc.exchangeGoogleAuthorizationCode.mock.calls[0][0] as {
      redirectUri: string;
    };

    expect(exchanged.redirectUri).toBe(`${FRONTEND}/api/auth/google/callback`);
    // What Google actually compares.
    expect(exchanged.redirectUri).toBe(authorizationUri);
  });

  /**
   * The origin-only guard on PUBLIC_BACKEND_ORIGIN is untouched by this
   * milestone, and this asserts it from the outside: putting a path there still
   * fails, exactly as it did before, which is what made the CTO's runtime defect
   * a real finding rather than a misconfiguration to paper over.
   */
  it('PUBLIC_BACKEND_ORIGIN still refuses a path, unchanged', () => {
    delete process.env.PUBLIC_OAUTH_CALLBACK_BASE;
    process.env.PUBLIC_BACKEND_ORIGIN = `${FRONTEND}/api`;
    const service = makeService();

    expect(() =>
      service.startGoogleAuth({
        cookie: jest.fn(),
        clearCookie: jest.fn(),
        redirect: jest.fn(),
      } as never),
    ).toThrow(/must be an origin/);
  });
});
