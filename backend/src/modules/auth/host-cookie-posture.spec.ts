import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import {
  authCookieNames,
  buildCsrfCookieOptions,
  buildSessionCookieOptions,
  clearAuthCookies,
  CSRF_COOKIE_NAME,
  HOST_COOKIE_PREFIX,
  resolveAuthCookieNames,
  SESSION_COOKIE_NAME,
} from './cookie.util';
import { CsrfGuard } from './csrf.guard';
import { RequireAuthGuard } from './require-auth.guard';

/**
 * ASK R2 CONSOLIDATED INTEGRATION R1 · §14 / R1.1 SQ-11 — THE `__Host-` COOKIE POSTURE.
 * Implementation-facing: E1 verifies independently.
 */

const HTTPS = 'https://alpha.example.test';
const HTTP = 'http://localhost:3000';

function ctx(
  cookies: Record<string, string>,
  headers: Record<string, string> = {},
): ExecutionContext {
  const request = { cookies, headers } as unknown;
  return { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
}

describe('SQ-11 — cookie names follow the Secure decision exactly', () => {
  it('Secure ⇒ __Host- names; not Secure ⇒ plain names', () => {
    expect(authCookieNames(true)).toEqual({
      session: '__Host-gna_session',
      csrf: '__Host-gna_csrf',
      oauthFlow: '__Host-gna_oauth_flow',
      secure: true,
    });
    expect(authCookieNames(false).session).toBe(SESSION_COOKIE_NAME);
  });

  it('production, or an https account origin, resolves the prefixed names; http development does not', () => {
    expect(resolveAuthCookieNames('production', HTTPS).session).toBe(
      `${HOST_COOKIE_PREFIX}${SESSION_COOKIE_NAME}`,
    );
    expect(resolveAuthCookieNames('development', HTTPS).csrf).toBe(
      `${HOST_COOKIE_PREFIX}${CSRF_COOKIE_NAME}`,
    );
    expect(resolveAuthCookieNames('development', HTTP).session).toBe(SESSION_COOKIE_NAME);
    expect(resolveAuthCookieNames('test', undefined).session).toBe(SESSION_COOKIE_NAME);
  });

  it('the prefix is only ever paired with Secure, Path=/ and no Domain (the __Host- preconditions)', () => {
    for (const [env, origin] of [
      ['production', HTTPS],
      ['development', HTTPS],
    ] as const) {
      const names = resolveAuthCookieNames(env, origin);
      const session = buildSessionCookieOptions(env, 1000, origin);
      const csrf = buildCsrfCookieOptions(env, 1000, origin);
      expect(names.secure).toBe(true);
      for (const options of [session, csrf]) {
        expect(options.secure).toBe(true);
        expect(options.path).toBe('/');
        expect('domain' in options).toBe(false);
      }
    }
    expect(readFileSync(join(__dirname, 'cookie.util.ts'), 'utf8')).not.toMatch(/\bdomain\s*:/);
  });

  it('clearing a __Host- cookie carries Secure + Path=/ (or the browser ignores the deletion)', () => {
    const calls: Array<[string, unknown]> = [];
    const response = {
      clearCookie: (name: string, options: unknown) => calls.push([name, options]),
    };
    clearAuthCookies(response, ['session', 'csrf'], authCookieNames(true));
    expect(calls).toEqual([
      ['__Host-gna_session', { path: '/', secure: true, sameSite: 'lax' }],
      ['__Host-gna_csrf', { path: '/', secure: true, sameSite: 'lax' }],
    ]);
    calls.length = 0;
    clearAuthCookies(response, ['oauthFlow'], authCookieNames(false));
    expect(calls).toEqual([['gna_oauth_flow', { path: '/' }]]);
  });
});

describe('SQ-11 — the guards read ONLY the name for their environment', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it('in a Secure deployment a plain-named (tossable) CSRF cookie is refused', () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_ORIGIN = HTTPS;
    const guard = new CsrfGuard();
    expect(() => guard.canActivate(ctx({ gna_csrf: 'x' }, { 'x-csrf-token': 'x' }))).toThrow(
      ForbiddenException,
    );
    expect(guard.canActivate(ctx({ '__Host-gna_csrf': 'x' }, { 'x-csrf-token': 'x' }))).toBe(true);
  });

  it('in a Secure deployment a plain-named session cookie authenticates nobody', async () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_ORIGIN = HTTPS;
    const validateSession = jest.fn().mockResolvedValue({ userId: 'u1' });
    const guard = new RequireAuthGuard({ validateSession } as never);
    await expect(guard.canActivate(ctx({ gna_session: 'token' }))).rejects.toThrow(
      UnauthorizedException,
    );
    expect(validateSession).not.toHaveBeenCalled();
    await expect(guard.canActivate(ctx({ '__Host-gna_session': 'token' }))).resolves.toBe(true);
  });

  it('http development keeps the plain names working (local sign-in is not broken)', () => {
    process.env.NODE_ENV = 'development';
    process.env.FRONTEND_ORIGIN = HTTP;
    expect(new CsrfGuard().canActivate(ctx({ gna_csrf: 'x' }, { 'x-csrf-token': 'x' }))).toBe(true);
  });
});
