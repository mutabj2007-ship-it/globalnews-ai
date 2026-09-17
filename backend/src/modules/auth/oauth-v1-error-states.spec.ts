import { readFileSync } from 'fs';
import { join } from 'path';
import { Logger } from '@nestjs/common';
import { AUTH_ERROR_CODES, AUTH_ERROR_PARAM, isAuthErrorCode } from '@globalnews-ai/shared';
import { AuthService } from './auth.service';
import { createOAuthFlowState, encodeOAuthFlowState } from './oauth-flow-state';
import { OAUTH_FLOW_COOKIE_NAME } from './cookie.util';
import type { PrismaService } from '../../database/prisma.service';
import type { SessionService } from './session.service';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * B5-A · OAUTH V1 — THE FROZEN ERROR STATES, BACKEND HALF
 * ════════════════════════════════════════════════════════════════════════════
 *
 * E1-BETA-SECURITY-GATES-R3 §C. Tests C-T6, C-T7, C-T9 and C-T11.
 *
 * ── THE DEFECT THIS CLOSES ───────────────────────────────────────────────
 *
 * A cancelled sign-in arrives back from Google with NO code and NO state, so it
 * fell into the state-mismatch branch and was logged as
 * "OAuth callback rejected: missing or mismatched state." — a security-relevant
 * warning, raised every time somebody pressed Cancel.
 *
 * That is worse than a cosmetic mislabel. It is the same line the trace gate
 * depends on to notice a genuine state attack, and burying it under ordinary
 * user cancellations is how a real signal stops being read.
 */
describe('B5-A · OAuth V1 — cancelled | failed', () => {
  function makeFakeResponse() {
    const cleared: string[] = [];
    let redirectedTo: string | undefined;

    return {
      cookie: jest.fn(),
      clearCookie: jest.fn((name: string) => {
        cleared.push(name);
      }),
      redirect: jest.fn((url: string) => {
        redirectedTo = url;
      }),
      _cleared: cleared,
      get _redirectedTo() {
        return redirectedTo;
      },
    };
  }

  function makeService() {
    const prisma = {
      userIdentity: { findUnique: jest.fn().mockResolvedValue(null) },
      user: { create: jest.fn().mockResolvedValue({ id: 'user-1' }) },
    } as unknown as PrismaService;

    const sessionService = {
      createSession: jest
        .fn()
        .mockResolvedValue({ rawToken: 'raw-token', expiresAt: new Date(Date.now() + 1000) }),
    } as unknown as SessionService;

    return new AuthService(prisma, sessionService);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OAUTH_FLOW_SECRET = 'test-oauth-flow-secret-for-oauth-v1-spec';
  });

  /* ──────────────────────────────────────────────────────────────────────
     C-T11 — THE ORDERING TEST. The only one that catches the branch placed
     one line too early, and the reason it is written first.
     ────────────────────────────────────────────────────────────────────── */

  describe('C-T11 — the flow cookie is cleared on a CANCELLED callback', () => {
    it('clears the one-time flow cookie even though the branch returns early', async () => {
      /*
        IF THE CANCELLATION BRANCH IS MOVED ABOVE clearCookie, THIS IS THE ONLY
        TEST THAT FAILS. Everything else about a cancellation would still look
        correct: the redirect, the code, the log line. What would be left behind
        is a REPLAYABLE flow cookie — a one-time value that is no longer
        one-time — held by the person who just chose to stop.
      */
      const service = makeService();
      const response = makeFakeResponse();
      const flowState = createOAuthFlowState('/');

      const request = {
        cookies: { [OAUTH_FLOW_COOKIE_NAME]: encodeOAuthFlowState(flowState) },
      } as never;

      await service.handleGoogleCallback(
        undefined,
        undefined,
        'access_denied',
        request,
        response as never,
      );

      expect(response._cleared).toContain(OAUTH_FLOW_COOKIE_NAME);
      expect(response.clearCookie).toHaveBeenCalledTimes(1);
    });

    it('and the clear happens for a cancellation that carries no flow cookie at all', async () => {
      const service = makeService();
      const response = makeFakeResponse();

      await service.handleGoogleCallback(
        undefined,
        undefined,
        'access_denied',
        { cookies: {} } as never,
        response as never,
      );

      expect(response._cleared).toContain(OAUTH_FLOW_COOKIE_NAME);
    });
  });

  /* ──────────────────────────────────────────────────────────────────────
     C-T7 — classification and the corrected log line
     ────────────────────────────────────────────────────────────────────── */

  describe('C-T7 — a provider error is a cancellation, and logs as one', () => {
    it('error=access_denied redirects with cancelled', async () => {
      const service = makeService();
      const response = makeFakeResponse();

      await service.handleGoogleCallback(
        undefined,
        undefined,
        'access_denied',
        { cookies: {} } as never,
        response as never,
      );

      expect(response._redirectedTo).toContain(`${AUTH_ERROR_PARAM}=cancelled`);
      expect(response._redirectedTo).not.toContain('failed');
    });

    it('C-6 — ANY non-empty provider error is cancelled; the value is not switched on', async () => {
      /*
        A value-specific branch would turn a provider-controlled string into a
        control-flow selector. Google may add a value tomorrow; a reader who
        cancelled must not become a reader who "failed" because of it.
      */
      for (const value of [
        'access_denied',
        'consent_required',
        'interaction_required',
        'server_error',
        'something_google_has_not_invented_yet',
        'x',
      ]) {
        const response = makeFakeResponse();

        await makeService().handleGoogleCallback(
          undefined,
          undefined,
          value,
          { cookies: {} } as never,
          response as never,
        );

        expect(response._redirectedTo).toContain(`${AUTH_ERROR_PARAM}=cancelled`);
      }
    });

    it('an EMPTY provider error is not a cancellation — it falls through to failed', async () => {
      /*
        `?error=` is not a cancellation. Treating the empty string as one would
        let a bare parameter suppress a genuine state rejection.
      */
      const service = makeService();
      const response = makeFakeResponse();

      await service.handleGoogleCallback(
        undefined,
        undefined,
        '',
        { cookies: {} } as never,
        response as never,
      );

      expect(response._redirectedTo).toContain(`${AUTH_ERROR_PARAM}=failed`);
    });

    it('C-8 — a cancellation does NOT log as a state mismatch', async () => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

      await makeService().handleGoogleCallback(
        undefined,
        undefined,
        'access_denied',
        { cookies: {} } as never,
        makeFakeResponse() as never,
      );

      const warned = warn.mock.calls.flat().join(' ');

      expect(warned).not.toContain('missing or mismatched state');
      expect(log.mock.calls.flat().join(' ')).toContain('cancelled at the provider');

      warn.mockRestore();
      log.mockRestore();
    });

    it('and a GENUINE state mismatch still logs the warning, which now means what it says', async () => {
      /*
        The other half of C-8, and the point of the whole correction: the line
        recovers its value as evidence precisely because ordinary cancellations
        no longer produce it.
      */
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

      await makeService().handleGoogleCallback(
        'a-code',
        'a-state-that-does-not-match',
        undefined,
        { cookies: {} } as never,
        makeFakeResponse() as never,
      );

      expect(warn.mock.calls.flat().join(' ')).toContain('missing or mismatched state');

      warn.mockRestore();
    });
  });

  /* ──────────────────────────────────────────────────────────────────────
     C-T9 / C-7 — the provider's strings never leave the process
     ────────────────────────────────────────────────────────────────────── */

  describe('C-T9 — nothing sensitive reaches a log or a URL', () => {
    it("the provider's error string is never logged and never appears in the redirect", async () => {
      const marker = 'MARKER_PROVIDER_ERROR_VALUE_9f3a';
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
      const response = makeFakeResponse();

      await makeService().handleGoogleCallback(
        undefined,
        undefined,
        marker,
        { cookies: {} } as never,
        response as never,
      );

      const everythingLogged = [...warn.mock.calls, ...log.mock.calls].flat().join(' ');

      expect(everythingLogged).not.toContain(marker);
      expect(response._redirectedTo).not.toContain(marker);

      warn.mockRestore();
      log.mockRestore();
    });

    it('the callback never logs code, state, id_token, code_verifier, email or sub', () => {
      /*
        SOURCE-READING, deliberately: this must hold for every path through the
        handler, including ones a unit test would have to construct a real
        Google response to reach. Comments are stripped first — the words appear
        in the prose above precisely because the prose explains the rule.
      */
      const source = readFileSync(join(__dirname, 'auth.service.ts'), 'utf-8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');

      const logCalls = source.match(/logWithRequestId\([\s\S]*?\);/g) ?? [];

      expect(logCalls.length).toBeGreaterThan(0);

      for (const call of logCalls) {
        for (const forbidden of [
          'code',
          'state',
          'idToken',
          'id_token',
          'codeVerifier',
          'email',
          'subject',
          'providerError',
          'error_description',
        ]) {
          /* A template hole is how a value would get in. Literal prose is fine. */
          expect(call).not.toContain(`\${${forbidden}`);
        }
      }
    });
  });

  /* ──────────────────────────────────────────────────────────────────────
     C-T6 — the silence around returnTo is preserved
     ────────────────────────────────────────────────────────────────────── */

  describe('C-T6 — an invalid returnTo stays silent', () => {
    it('no auth-error state exists for a rejected return destination', () => {
      /*
        "invalid return destination" was REFUSED as a state: it is an allowlist
        ENUMERATION ORACLE. An attacker who can distinguish "rejected" from
        "accepted" can map the allowlist one probe at a time. An invalid
        returnTo succeeds silently to the homepage, and the frozen set below is
        what keeps that true.
      */
      expect([...AUTH_ERROR_CODES]).toEqual(['cancelled', 'failed']);
      expect(isAuthErrorCode('invalid_return')).toBe(false);
    });

    it('the source contains no redirect that reports a return-destination problem', () => {
      const source = readFileSync(join(__dirname, 'auth.service.ts'), 'utf-8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');

      /*
        CORRECTED. My first version forbade /return_?destination/i outright and
        failed on `validateReturnDestination` — the allowlist validator itself,
        which is REQUIRED and whose presence is the reason the silence is safe.
        The rule is that no ERROR STATE may report a return-destination problem,
        not that the validator may not be named.
      */
      expect(source).not.toMatch(/auth_error=invalid/i);
      expect(source).not.toMatch(/auth_error=[a-z_]*return/i);
      expect(source).not.toMatch(/auth_error=[a-z_]*destination/i);

      /* And the validator IS still called — the silence is validated, not absent. */
      expect(source).toContain('validateReturnDestination');
    });
  });

  /* ──────────────────────────────────────────────────────────────────────
     THE SHAPE OF THE HANDLER
     ────────────────────────────────────────────────────────────────────── */

  describe('C-2 / C-3 / C-4 — the handler shape is the contract', () => {
    const source = readFileSync(join(__dirname, 'auth.service.ts'), 'utf-8');

    it('C-3 — the cancellation branch sits AFTER the unconditional clear', () => {
      /*
        The ordering asserted structurally as well as behaviourally. C-T11 proves
        the observable consequence; this proves the arrangement that produces it,
        so a refactor that reorders the file fails here even if it somehow kept
        the mock happy.
      */
      const clearAt = source.indexOf('response.clearCookie(OAUTH_FLOW_COOKIE_NAME');
      const cancelAt = source.indexOf("typeof providerError === 'string'");
      const stateAt = source.indexOf('if (!flowState || !code || !state');

      expect(clearAt).toBeGreaterThan(0);
      expect(cancelAt).toBeGreaterThan(clearAt);
      expect(stateAt).toBeGreaterThan(cancelAt);
    });

    it('C-4 — redirectUri() still takes NO arguments', () => {
      /*
        Unchanged and load-bearing: a method with no inputs cannot return
        different strings to its two callers, which is what makes Google's
        byte-for-byte comparison of the two redirect_uri values safe.
      */
      expect(source).toContain('private redirectUri(): string {');
    });

    it('C-4 — the try block was NOT split', () => {
      /*
        "session could not be created" was refused because the try spans
        exchange, JWKS, findOrCreateUser and createSession under ONE catch. If a
        later change splits it to produce a finer message, that is a NEW E1
        milestone, not a refactor — and this is where it announces itself.
      */
      const body = source.slice(source.indexOf('async handleGoogleCallback'));
      const tryCount = (body.match(/\n\s*try \{/g) ?? []).length;

      expect(tryCount).toBe(1);
    });

    it('no auth_error value other than the two frozen codes is emitted', () => {
      /*
        Scoped to the PARAMETER's own value. My first version swept the whole
        line and caught `?auth_error=1` inside a doc comment that still
        described the pre-B5 behaviour — a real finding, and the comment was
        corrected rather than the assertion loosened.
      */
      const emitted = [...source.matchAll(/auth_error=([A-Za-z0-9_]+)/g)].map((m) => m[1]);

      expect(emitted.length).toBeGreaterThan(0);

      for (const value of emitted) {
        expect(['cancelled', 'failed']).toContain(value);
      }
    });
  });
});
