import { readFileSync } from 'fs';
import { join } from 'path';
import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import {
  AnalysisRateLimitGuard,
  ANALYSIS_WINDOW_MS,
  ANONYMOUS_LIMIT_PER_WINDOW,
  AUTHENTICATED_LIMIT_PER_WINDOW,
  GLOBAL_LIMIT_PER_WINDOW,
} from './analysis-rate-limit.guard';

/**
 * PH-1 — BOUNDED ANONYMOUS ANALYSIS.
 *
 * The CTO-approved MVP policy under test:
 *   anonymous       5 / 15 min / trustworthy client network identity
 *   authenticated  30 / 15 min / authenticated user
 *   global         300 / 15 min / application instance
 *
 * Every test drives the guard through canActivate(), which is where the real
 * request path enters it. Nothing here reaches into private state.
 */

type Cookies = Record<string, string>;

function makeContext(
  options: {
    ip?: string;
    cookies?: Cookies;
    csrfHeader?: string;
    /** Supply a spy to assert the Retry-After header this guard sets on a 429. */
    setHeader?: jest.Mock;
  } = {},
): ExecutionContext {
  const request = {
    ip: options.ip ?? '203.0.113.7',
    cookies: options.cookies ?? {},
    headers: options.csrfHeader === undefined ? {} : { 'x-csrf-token': options.csrfHeader },
  };

  const response = { setHeader: options.setHeader ?? jest.fn() };

  return {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
    getHandler: () => function analyzeNews() {},
    getClass: () => class AnalysisController {},
  } as unknown as ExecutionContext;
}

/** A SessionService stand-in. `validateSession` is the only member the guard uses. */
function makeSessionService(
  behaviour: {
    userId?: string;
    throws?: boolean;
  } = {},
): { validateSession: jest.Mock } {
  return {
    validateSession: jest.fn(async (token: string) => {
      if (behaviour.throws) throw new Error('session store unreachable');
      if (behaviour.userId && token === 'valid-token') return { userId: behaviour.userId };
      return null;
    }),
  };
}

function signedIn(userId = 'user-1'): {
  guard: AnalysisRateLimitGuard;
  context: ExecutionContext;
  sessions: { validateSession: jest.Mock };
} {
  const sessions = makeSessionService({ userId });
  const guard = new AnalysisRateLimitGuard(sessions as never);
  const context = makeContext({
    cookies: { gna_session: 'valid-token', gna_csrf: 'csrf-abc' },
    csrfHeader: 'csrf-abc',
  });
  return { guard, context, sessions };
}

async function drive(
  guard: AnalysisRateLimitGuard,
  context: ExecutionContext,
  times: number,
): Promise<number> {
  let accepted = 0;
  for (let i = 0; i < times; i += 1) {
    try {
      await guard.canActivate(context);
      accepted += 1;
    } catch {
      /* rejected */
    }
  }
  return accepted;
}

describe('PH-1 — AnalysisRateLimitGuard', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  describe('1-3 — the anonymous tier', () => {
    it('1. accepts anonymous requests 1 through 5', async () => {
      const guard = new AnalysisRateLimitGuard(makeSessionService() as never);
      const context = makeContext();

      for (let i = 1; i <= ANONYMOUS_LIMIT_PER_WINDOW; i += 1) {
        await expect(guard.canActivate(context)).resolves.toBe(true);
      }
    });

    it('2. rejects anonymous request 6 inside the same 15-minute window', async () => {
      const guard = new AnalysisRateLimitGuard(makeSessionService() as never);
      const context = makeContext();

      await drive(guard, context, ANONYMOUS_LIMIT_PER_WINDOW);
      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(HttpException);

      try {
        await guard.canActivate(context);
      } catch (error) {
        expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      }
    });

    it('3. resets the window correctly once 15 minutes have elapsed', async () => {
      const start = 1_000_000;
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(start);
      const guard = new AnalysisRateLimitGuard(makeSessionService() as never);
      const context = makeContext();

      await drive(guard, context, ANONYMOUS_LIMIT_PER_WINDOW);
      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(HttpException);

      // One millisecond short of the window: still rejected.
      nowSpy.mockReturnValue(start + ANALYSIS_WINDOW_MS - 1);
      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(HttpException);

      // The window has now elapsed: accepted again, and the full allowance is back.
      nowSpy.mockReturnValue(start + ANALYSIS_WINDOW_MS);
      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(await drive(guard, context, ANONYMOUS_LIMIT_PER_WINDOW)).toBe(
        ANONYMOUS_LIMIT_PER_WINDOW - 1,
      );
    });

    it('keys the anonymous tier per address — one visitor cannot exhaust another', async () => {
      const guard = new AnalysisRateLimitGuard(makeSessionService() as never);
      const first = makeContext({ ip: '198.51.100.1' });
      const second = makeContext({ ip: '198.51.100.2' });

      await drive(guard, first, ANONYMOUS_LIMIT_PER_WINDOW);
      await expect(guard.canActivate(first)).rejects.toBeInstanceOf(HttpException);
      await expect(guard.canActivate(second)).resolves.toBe(true);
    });
  });

  describe('4-6 — identity, and who is allowed to choose it', () => {
    it('4. an authenticated caller receives the approved authenticated ceiling', async () => {
      const { guard, context } = signedIn();

      expect(await drive(guard, context, AUTHENTICATED_LIMIT_PER_WINDOW)).toBe(
        AUTHENTICATED_LIMIT_PER_WINDOW,
      );
      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(HttpException);
      expect(AUTHENTICATED_LIMIT_PER_WINDOW).toBeGreaterThan(ANONYMOUS_LIMIT_PER_WINDOW);
    });

    it('4b. two different users have independent authenticated allowances', async () => {
      const sessions = {
        validateSession: jest.fn(async (token: string) => ({ userId: `user-for-${token}` })),
      };
      const guard = new AnalysisRateLimitGuard(sessions as never);
      const a = makeContext({ cookies: { gna_session: 'a', gna_csrf: 'c' }, csrfHeader: 'c' });
      const b = makeContext({ cookies: { gna_session: 'b', gna_csrf: 'c' }, csrfHeader: 'c' });

      await drive(guard, a, AUTHENTICATED_LIMIT_PER_WINDOW);
      await expect(guard.canActivate(a)).rejects.toBeInstanceOf(HttpException);
      await expect(guard.canActivate(b)).resolves.toBe(true);
    });

    it('5. authenticated identity CANNOT be selected by the caller — the userId comes from the validated session, never from the request', async () => {
      const sessions = makeSessionService({ userId: 'the-real-user' });
      const guard = new AnalysisRateLimitGuard(sessions as never);

      // A caller asserting an identity in every way a request can assert one.
      const forged = makeContext({
        cookies: { gna_session: 'not-a-real-token', gna_csrf: 'c' },
        csrfHeader: 'c',
      });

      // Not authenticated: validateSession returns null for an unknown token,
      // so the caller falls back to the ANONYMOUS allowance of 5, not 30.
      expect(await drive(guard, forged, AUTHENTICATED_LIMIT_PER_WINDOW)).toBe(
        ANONYMOUS_LIMIT_PER_WINDOW,
      );
      expect(sessions.validateSession).toHaveBeenCalledWith('not-a-real-token');
    });

    it('5b. a session cookie WITHOUT the CSRF echo does not elevate — a cross-site form POST cannot spend a signed-in visitor allowance', async () => {
      const sessions = makeSessionService({ userId: 'victim' });
      const guard = new AnalysisRateLimitGuard(sessions as never);

      // Cookies are sent by the browser; a cross-site <form> cannot set a header.
      const crossSite = makeContext({
        cookies: { gna_session: 'valid-token', gna_csrf: 'csrf-abc' },
        // no x-csrf-token header
      });

      expect(await drive(guard, crossSite, AUTHENTICATED_LIMIT_PER_WINDOW)).toBe(
        ANONYMOUS_LIMIT_PER_WINDOW,
      );
      // The session store is never even consulted for such a request.
      expect(sessions.validateSession).not.toHaveBeenCalled();
    });

    it('5c. a MISMATCHED CSRF echo does not elevate either', async () => {
      const sessions = makeSessionService({ userId: 'victim' });
      const guard = new AnalysisRateLimitGuard(sessions as never);
      const context = makeContext({
        cookies: { gna_session: 'valid-token', gna_csrf: 'csrf-abc' },
        csrfHeader: 'csrf-GUESSED',
      });

      expect(await drive(guard, context, AUTHENTICATED_LIMIT_PER_WINDOW)).toBe(
        ANONYMOUS_LIMIT_PER_WINDOW,
      );
      expect(sessions.validateSession).not.toHaveBeenCalled();
    });

    it('5d. a session-store failure fails towards the TIGHTER ceiling, never towards a free upgrade', async () => {
      const sessions = makeSessionService({ throws: true });
      const guard = new AnalysisRateLimitGuard(sessions as never);
      const context = makeContext({
        cookies: { gna_session: 'valid-token', gna_csrf: 'c' },
        csrfHeader: 'c',
      });

      expect(await drive(guard, context, AUTHENTICATED_LIMIT_PER_WINDOW)).toBe(
        ANONYMOUS_LIMIT_PER_WINDOW,
      );
    });

    it('6. anonymous identity CANNOT be selected by a caller-controlled value — the guard reads req.ip only, never a forwarding header', () => {
      const source = readFileSync(join(__dirname, 'analysis-rate-limit.guard.ts'), 'utf-8');
      const executable = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

      expect(executable).toMatch(/`ip:\$\{request\.ip/);
      // No forwarding/client-address header is ever consulted.
      for (const header of [
        'x-forwarded-for',
        'x-real-ip',
        'cf-connecting-ip',
        'x-client-ip',
        'forwarded',
      ]) {
        expect(executable.toLowerCase()).not.toContain(header);
      }
    });

    it('6b. req.ip itself is trustworthy here because TRUST_PROXY=true is refused at boot', () => {
      const trustProxy = readFileSync(
        join(__dirname, '../../../security/trusted-proxy.config.ts'),
        'utf-8',
      );
      // The whole anonymous key rests on this: were "true" ever accepted, a
      // client could mint a fresh identity per request and this guard would be
      // decorative.
      expect(trustProxy).toMatch(/UNRESTRICTED_TOKENS\s*=\s*new Set\(\[[^\]]*'true'/);
      expect(trustProxy).toMatch(/throw new TrustProxyConfigurationError/);
    });
  });

  describe('7 & 11 — rejection happens before any expensive work', () => {
    it('7. the guard is a GUARD, so a rejected request never reaches the controller method or the service', () => {
      const controller = readFileSync(
        join(__dirname, '../controller/analysis.controller.ts'),
        'utf-8',
      );
      // Applied at the route. Nest runs guards before the handler, so
      // AnalysisService — and therefore all news retrieval and the OpenAI
      // call — cannot be entered for a rejected request.
      expect(controller).toMatch(/@UseGuards\(AnalysisRateLimitGuard\)/);
      expect(controller).toMatch(/@Post\('news'\)/);

      // And the guard itself reaches for nothing expensive: no provider, no
      // AnalysisService, no OpenAI. Executable source only — the guard's doc
      // comments necessarily NAME those things in order to explain what they
      // must never touch, and a doc comment must not be able to trip an
      // assertion (the same `executable()` discipline supportSurface.spec.ts
      // uses).
      const guardSource = readFileSync(join(__dirname, 'analysis-rate-limit.guard.ts'), 'utf-8');
      const guardExecutable = guardSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(guardExecutable).not.toMatch(/AnalysisService|NewsService|OpenAi|openai/);
      expect(guardExecutable).not.toMatch(/import .*(analysis\.service|news\.service|provider)/);
    });

    it('11. the global emergency ceiling blocks execution, and does so before identity resolution', async () => {
      const sessions = makeSessionService({ userId: 'u' });
      const guard = new AnalysisRateLimitGuard(sessions as never);

      // Spread the load across many distinct addresses so no per-identity
      // ceiling is what stops it — only the global one can.
      let accepted = 0;
      for (let i = 0; i < GLOBAL_LIMIT_PER_WINDOW + 20; i += 1) {
        const context = makeContext({ ip: `10.0.${Math.floor(i / 250)}.${i % 250}` });
        try {
          await guard.canActivate(context);
          accepted += 1;
        } catch {
          /* rejected */
        }
      }

      expect(accepted).toBe(GLOBAL_LIMIT_PER_WINDOW);
    });

    it('11b. once the global ceiling is reached, the session store is not consulted at all', async () => {
      const sessions = makeSessionService({ userId: 'u' });
      const guard = new AnalysisRateLimitGuard(sessions as never);

      for (let i = 0; i < GLOBAL_LIMIT_PER_WINDOW; i += 1) {
        await guard
          .canActivate(makeContext({ ip: `10.1.${Math.floor(i / 250)}.${i % 250}` }))
          .catch(() => undefined);
      }
      sessions.validateSession.mockClear();

      const signedInContext = makeContext({
        cookies: { gna_session: 'valid-token', gna_csrf: 'c' },
        csrfHeader: 'c',
      });
      await expect(guard.canActivate(signedInContext)).rejects.toBeInstanceOf(HttpException);
      expect(sessions.validateSession).not.toHaveBeenCalled();
    });

    it('11c. the global ceiling resets with its window', async () => {
      const start = 5_000_000;
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(start);
      const guard = new AnalysisRateLimitGuard(makeSessionService() as never);

      for (let i = 0; i < GLOBAL_LIMIT_PER_WINDOW; i += 1) {
        await guard
          .canActivate(makeContext({ ip: `10.2.${Math.floor(i / 250)}.${i % 250}` }))
          .catch(() => undefined);
      }
      await expect(guard.canActivate(makeContext({ ip: '10.9.9.9' }))).rejects.toBeInstanceOf(
        HttpException,
      );

      nowSpy.mockReturnValue(start + ANALYSIS_WINDOW_MS);
      await expect(guard.canActivate(makeContext({ ip: '10.9.9.9' }))).resolves.toBe(true);
    });
  });

  describe('8-10 — nothing else changed', () => {
    it('8. malformed requests remain rejected by the EXISTING ValidationPipe, which this guard does not touch', () => {
      const controller = readFileSync(
        join(__dirname, '../controller/analysis.controller.ts'),
        'utf-8',
      );
      // The DTO is still the body type, so the global ValidationPipe still
      // rejects a malformed body exactly as before.
      expect(controller).toMatch(/AnalyzeNewsDto/);
      const guardExecutable = readFileSync(join(__dirname, 'analysis-rate-limit.guard.ts'), 'utf-8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      // The guard never reads or validates the body; that stays entirely the
      // ValidationPipe's job, untouched.
      expect(guardExecutable).not.toMatch(/AnalyzeNewsDto|ValidationPipe|request\.body/);
    });

    it('9. legitimate anonymous analysis remains functional — the route is NOT authenticated', () => {
      const controller = readFileSync(
        join(__dirname, '../controller/analysis.controller.ts'),
        'utf-8',
      );
      expect(controller).not.toMatch(/RequireAuthGuard/);
      expect(controller).not.toMatch(/CsrfGuard/);
      // And the existing burst throttle was not removed.
      expect(controller).toMatch(/@Throttle\(\{ default: \{ limit: 5, ttl: 60000 \} \}\)/);
    });

    it('9b. a caller with no cookies at all is served, not rejected', async () => {
      const guard = new AnalysisRateLimitGuard(makeSessionService() as never);
      await expect(guard.canActivate(makeContext({ cookies: {} }))).resolves.toBe(true);
    });

    it('10. existing authenticated analysis behaviour is intact — a signed-in caller is served, with a larger allowance', async () => {
      const { guard, context, sessions } = signedIn();
      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(sessions.validateSession).toHaveBeenCalledWith('valid-token');
    });
  });

  describe('12 — negative control', () => {
    /**
     * The point of a negative control is to prove the tests above are bound to
     * the protection rather than passing for some incidental reason. Removing
     * the protection is simulated in the only way a unit test honestly can:
     * by asserting the exact wiring whose deletion would disable it, and by
     * showing that a guard with the ceiling raised admits what the real one
     * refuses.
     */
    it('12a. deleting @UseGuards(AnalysisRateLimitGuard) from the controller breaks this suite', () => {
      const controller = readFileSync(
        join(__dirname, '../controller/analysis.controller.ts'),
        'utf-8',
      );
      const withProtectionRemoved = controller.replace(
        /@UseGuards\(AnalysisRateLimitGuard\)\s*/,
        '',
      );

      expect(withProtectionRemoved).not.toMatch(/@UseGuards\(AnalysisRateLimitGuard\)/);
      // Test 7 asserts exactly this string, so its removal fails that test.
      expect(controller).toMatch(/@UseGuards\(AnalysisRateLimitGuard\)/);
    });

    it('12b. the ceilings are what does the rejecting — raise them and the same traffic is admitted', async () => {
      const guard = new AnalysisRateLimitGuard(makeSessionService() as never);
      const context = makeContext({ ip: '192.0.2.55' });

      // Real ceiling: the 6th is refused.
      expect(await drive(guard, context, ANONYMOUS_LIMIT_PER_WINDOW + 1)).toBe(
        ANONYMOUS_LIMIT_PER_WINDOW,
      );

      // Same traffic, a fresh guard, one request per distinct identity: all
      // admitted. The refusal above was the per-identity ceiling and nothing
      // else — not an accident of the harness.
      const control = new AnalysisRateLimitGuard(makeSessionService() as never);
      let admitted = 0;
      for (let i = 0; i <= ANONYMOUS_LIMIT_PER_WINDOW; i += 1) {
        await control.canActivate(makeContext({ ip: `192.0.2.${100 + i}` }));
        admitted += 1;
      }
      expect(admitted).toBe(ANONYMOUS_LIMIT_PER_WINDOW + 1);
    });

    it('12c. the approved MVP numbers are the ones in force', () => {
      expect(ANONYMOUS_LIMIT_PER_WINDOW).toBe(5);
      expect(AUTHENTICATED_LIMIT_PER_WINDOW).toBe(30);
      expect(GLOBAL_LIMIT_PER_WINDOW).toBe(300);
      expect(ANALYSIS_WINDOW_MS).toBe(15 * 60_000);
    });
  });

  describe('Retry-After — every 429 states how long the caller is blocked', () => {
    it('a rejected ANONYMOUS request carries Retry-After with the seconds left in its window', async () => {
      const setHeader = jest.fn();
      const guard = new AnalysisRateLimitGuard(makeSessionService() as never);
      const context = makeContext({ setHeader });

      await drive(guard, context, ANONYMOUS_LIMIT_PER_WINDOW);
      setHeader.mockClear();

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(HttpException);

      expect(setHeader).toHaveBeenCalledTimes(1);
      const [name, value] = setHeader.mock.calls[0];
      expect(name).toBe('Retry-After');
      // A whole number of seconds, as a string, never above the window and never below 1.
      expect(value).toMatch(/^[1-9][0-9]*$/);
      expect(Number(value)).toBeLessThanOrEqual(ANALYSIS_WINDOW_MS / 1000);
      expect(Number(value)).toBeGreaterThan(0);
    });

    it('a rejection at the GLOBAL ceiling carries Retry-After too — that caller is blocked by capacity, not by their own use', async () => {
      const setHeader = jest.fn();
      const guard = new AnalysisRateLimitGuard(makeSessionService() as never);

      for (let i = 0; i < GLOBAL_LIMIT_PER_WINDOW; i += 1) {
        await drive(guard, makeContext({ ip: `10.0.${Math.floor(i / 250)}.${i % 250}` }), 1);
      }

      const fresh = makeContext({ ip: '198.51.100.250', setHeader });
      await expect(guard.canActivate(fresh)).rejects.toBeInstanceOf(HttpException);

      expect(setHeader).toHaveBeenCalledWith('Retry-After', expect.stringMatching(/^[1-9][0-9]*$/));
    });

    it('an ACCEPTED request sets no Retry-After — the header appears only on a refusal', async () => {
      const setHeader = jest.fn();
      const guard = new AnalysisRateLimitGuard(makeSessionService() as never);

      await expect(guard.canActivate(makeContext({ setHeader }))).resolves.toBe(true);

      expect(setHeader).not.toHaveBeenCalled();
    });
  });
});
