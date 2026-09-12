import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { PrismaService } from '../../database/prisma.service';
import { logWithRequestId } from '../../observability/log-with-request-id';
import { SessionService } from './session.service';
import {
  createOAuthFlowState,
  decodeOAuthFlowState,
  deriveCodeChallenge,
  encodeOAuthFlowState,
} from './oauth-flow-state';
import {
  buildGoogleAuthUrl,
  exchangeGoogleAuthorizationCode,
  verifyGoogleIdToken,
} from './google-oidc.util';
import {
  buildCsrfCookieOptions,
  buildOAuthFlowCookieOptions,
  buildSessionCookieOptions,
  CSRF_COOKIE_NAME,
  OAUTH_FLOW_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from './cookie.util';
import { generateCsrfToken } from './session-token.util';
import { resolveSafeReturnUrl, validateReturnDestination } from './return-destination.util';
import { PUBLIC_BACKEND_ORIGIN_ENV } from '../../security/public-backend-origin.config';
import { resolveFrontendOrigin } from '../../security/cors-startup-validator';
import {
  PUBLIC_OAUTH_CALLBACK_BASE_ENV,
  resolvePublicOAuthCallbackBase,
} from '../../security/public-oauth-callback-base.config';

const OAUTH_FLOW_COOKIE_TTL_MS = 5 * 60 * 1000;
const GOOGLE_PROVIDER = 'google';

/**
 * Milestone #57 — orchestrates the three /auth routes. Every method
 * here either redirects the browser (start/callback) or clears
 * session state (signOut) — none of them return JSON, matching the
 * fact that the OAuth handshake is fundamentally a sequence of
 * browser navigations, not an API call sequence.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
  ) {}

  private get clientId(): string {
    return process.env.OAUTH_CLIENT_ID ?? '';
  }

  private get clientSecret(): string {
    return process.env.OAUTH_CLIENT_SECRET ?? '';
  }

  /**
   * B-2 repair — the public OAuth callback URI, built from CONFIGURATION
   * rather than from the incoming request.
   *
   * IT USED TO READ:
   *   `${request.protocol}://${request.get('host')}/auth/google/callback`
   * and that was the public-MVP blocker. `req.protocol` reflects
   * X-Forwarded-Proto only when Express's `trust proxy` is truthy, and that
   * setting ships as false, so behind a TLS-terminating proxy this produced
   * `http://` while the URI registered with Google is `https://`. Google
   * answered redirect_uri_mismatch and sign-in was impossible — which took
   * history, support and the entire admin platform with it, since all of them
   * are behind an account.
   *
   * Two client-controlled inputs are gone: the protocol, which was wrong by
   * default, and the Host header, which the caller supplies and which had no
   * business deciding where Google sends a user.
   *
   * THIS METHOD TAKES NO ARGUMENTS, AND THAT IS THE POINT. Both call sites —
   * the authorization URL in startGoogleAuth and the token exchange in
   * handleGoogleCallback — go through it, and Google compares the two values
   * against each other and against the registered one. A method with no inputs
   * cannot return different strings to its two callers.
   *
   * Reads process.env directly, matching clientId/clientSecret/frontendOrigin
   * above rather than introducing a second configuration idiom inside one
   * class. The BOOT-TIME guarantee comes from
   * PublicBackendOriginStartupValidator, which is registered in app.module.ts
   * and calls this same resolver — without it a misconfigured production
   * deployment would start healthy and fail at the first sign-in.
   */
  private redirectUri(): string {
    /*
      M-ALPHA-AUTH OPTION A — the base is now the BROWSER-VISIBLE callback base,
      which under Option A is <FRONTEND>/api, because the callback is reached
      through the frontend's first-party proxy so that Set-Cookie lands on the
      frontend origin.

      PUBLIC_BACKEND_ORIGIN is untouched and still origin-only. When
      PUBLIC_OAUTH_CALLBACK_BASE is unset this resolver defers to it, so a
      deployment that sets nothing behaves exactly as it did before this change,
      and rollback is unsetting one variable.

      THE B-2 PROPERTY IS PRESERVED VERBATIM: this method still takes NO
      arguments and is still the single source used by both the authorization
      URL and the token exchange. A method with no inputs cannot return
      different strings to its two callers, which is what makes Google's
      byte-for-byte comparison of the two redirect_uri values safe.
    */
    const base = resolvePublicOAuthCallbackBase(
      process.env.NODE_ENV,
      process.env[PUBLIC_OAUTH_CALLBACK_BASE_ENV],
      process.env[PUBLIC_BACKEND_ORIGIN_ENV],
    );

    return `${base}/auth/google/callback`;
  }

  /**
   * E1-M-9 — ROUTED THROUGH THE VALIDATED RESOLVER, NOT RAW ENV.
   *
   * This method used to read `process.env.FRONTEND_ORIGIN` directly and fall
   * back to `http://localhost:3000` when it was missing. `enableCors()` in
   * main.ts already went through `resolveFrontendOrigin()`, so a production
   * deployment with FRONTEND_ORIGIN unset had TWO different answers to the same
   * question in one process: CORS refused to boot, while this method quietly
   * decided the frontend was localhost. The one that ran first won, and which
   * one that was depended on startup ordering rather than on configuration.
   *
   * Every value this method produces is a Location header sent to a real
   * browser — the post-sign-in landing, the `?auth_error=1` failure landing, and
   * the origin `resolveSafeReturnUrl()` resolves the validated returnTo against.
   * A silent localhost fallback in production therefore does not degrade: it
   * redirects users off the product, and it makes the returnTo allowlist
   * resolve against the wrong origin.
   *
   * `resolveFrontendOrigin()` THROWS in production when the value is missing,
   * empty or whitespace-only, and keeps the localhost default outside
   * production — so development is unchanged and production fails closed. The
   * throw is reachable at boot rather than only at first sign-in because
   * main.ts calls the same resolver before `app.listen()`; this call site can
   * no longer disagree with that one, which is the whole point.
   */
  private frontendOrigin(): string {
    return resolveFrontendOrigin(process.env.NODE_ENV, process.env.FRONTEND_ORIGIN);
  }

  /**
   * M-ALPHA-AUTH — `returnTo` is validated HERE, at the boundary, and the raw
   * value is never stored, never logged and never reflected. What travels
   * onward is either a known relative application path or nothing at all.
   */
  startGoogleAuth(response: Response, returnTo?: string): void {
    // Milestone #57 security correction — previously, an unset
    // OAUTH_CLIENT_ID/OAUTH_CLIENT_SECRET/OAUTH_FLOW_SECRET produced a
    // redirect to Google with a blank client_id= rather than a clear
    // failure, sending the user into a broken sign-in attempt instead
    // of a controlled, understandable error. Fails closed with a
    // generic message — deliberately never names which specific
    // variable is missing, matching this codebase's existing
    // discipline of never surfacing internal configuration detail to
    // the client (see HealthController's ServiceUnavailableException,
    // GlobalExceptionFilter's sanitized-500 behavior).
    if (!this.clientId || !this.clientSecret || !process.env.OAUTH_FLOW_SECRET) {
      throw new ServiceUnavailableException('Sign-in is not currently available.');
    }

    /*
      ENTRY GATE. An unusable value becomes null, which createOAuthFlowState
      omits entirely — so a probe and an ordinary sign-in produce
      byte-identical flow-state payloads and behave identically. No error, no
      rejection, no echo of what was sent.
    */
    const validatedReturnTo = validateReturnDestination(returnTo);
    const flowState = createOAuthFlowState(validatedReturnTo ?? undefined);
    const codeChallenge = deriveCodeChallenge(flowState.codeVerifier);

    const authUrl = buildGoogleAuthUrl({
      clientId: this.clientId,
      redirectUri: this.redirectUri(),
      state: flowState.state,
      nonce: flowState.nonce,
      codeChallenge,
    });

    response.cookie(
      OAUTH_FLOW_COOKIE_NAME,
      encodeOAuthFlowState(flowState),
      buildOAuthFlowCookieOptions(
        process.env.NODE_ENV,
        OAUTH_FLOW_COOKIE_TTL_MS,
        this.frontendOrigin(),
      ),
    );
    response.redirect(authUrl);
  }

  async handleGoogleCallback(
    code: string | undefined,
    state: string | undefined,
    request: Request,
    response: Response,
  ): Promise<void> {
    const flowState = decodeOAuthFlowState(
      request.cookies?.[OAUTH_FLOW_COOKIE_NAME] as string | undefined,
    );

    // Milestone #57 — one-time callback semantics: the flow-state
    // cookie is cleared immediately, before any further processing,
    // regardless of outcome — the same encoded value can never be
    // presented again for a second callback attempt.
    response.clearCookie(OAUTH_FLOW_COOKIE_NAME, { path: '/' });

    if (!flowState || !code || !state || state !== flowState.state) {
      logWithRequestId(
        this.logger,
        'warn',
        'OAuth callback rejected: missing or mismatched state.',
      );
      response.redirect(`${this.frontendOrigin()}/?auth_error=1`);
      return;
    }

    try {
      const { idToken } = await exchangeGoogleAuthorizationCode({
        code,
        codeVerifier: flowState.codeVerifier,
        clientId: this.clientId,
        clientSecret: this.clientSecret,
        redirectUri: this.redirectUri(),
      });

      const identity = await verifyGoogleIdToken(idToken, this.clientId, flowState.nonce);
      const user = await this.findOrCreateUser(GOOGLE_PROVIDER, identity.subject, identity.email);

      const { rawToken, expiresAt } = await this.sessionService.createSession(user.id);
      const csrfToken = generateCsrfToken();
      const remainingMs = expiresAt.getTime() - Date.now();

      response.cookie(
        SESSION_COOKIE_NAME,
        rawToken,
        buildSessionCookieOptions(process.env.NODE_ENV, remainingMs, this.frontendOrigin()),
      );
      response.cookie(
        CSRF_COOKIE_NAME,
        csrfToken,
        buildCsrfCookieOptions(process.env.NODE_ENV, remainingMs, this.frontendOrigin()),
      );

      /*
        EXIT GATE — CTO requirements 7 and 10.

        The destination is revalidated and re-resolved here even though it was
        validated at entry and HMAC-signed in transit. The signature proves the
        value was not EDITED; it does not prove it was SAFE when written, and
        those are different claims. resolveSafeReturnUrl() re-applies the
        allowlist and then asserts that the URL a browser would actually
        navigate to has this frontend's origin, byte for byte.

        With no destination it returns the frontend origin unchanged, so the
        pre-existing homepage behaviour is preserved exactly.
      */
      response.redirect(resolveSafeReturnUrl(this.frontendOrigin(), flowState.returnTo));
    } catch (error) {
      logWithRequestId(
        this.logger,
        'warn',
        'OAuth callback failed',
        error instanceof Error ? error : undefined,
      );
      response.redirect(`${this.frontendOrigin()}/?auth_error=1`);
    }
  }

  private async findOrCreateUser(provider: string, providerAccountId: string, email: string) {
    const existingIdentity = await this.prisma.userIdentity.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId } },
      include: { user: true },
    });

    if (existingIdentity) {
      return existingIdentity.user;
    }

    return this.prisma.user.create({
      data: {
        email,
        identities: { create: { provider, providerAccountId } },
      },
    });
  }

  async signOut(request: Request, response: Response): Promise<void> {
    const rawToken = request.cookies?.[SESSION_COOKIE_NAME] as string | undefined;

    if (rawToken) {
      await this.sessionService.deleteSession(rawToken);
    }

    response.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    response.clearCookie(CSRF_COOKIE_NAME, { path: '/' });
    response.status(204).send();
  }
}
