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
import { buildGoogleAuthUrl, exchangeGoogleAuthorizationCode, verifyGoogleIdToken } from './google-oidc.util';
import {
  buildCsrfCookieOptions,
  buildOAuthFlowCookieOptions,
  buildSessionCookieOptions,
  CSRF_COOKIE_NAME,
  OAUTH_FLOW_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from './cookie.util';
import { generateCsrfToken } from './session-token.util';

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
   * Milestone #57 — derived from the incoming request's own protocol/
   * host rather than a new stored config value, so it naturally
   * differs between local development and a real deployment without
   * requiring a third OAuth-specific environment variable beyond the
   * two approved (OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET). This exact
   * string must be registered with Google as an authorized redirect
   * URI for both the development and production origins.
   */
  private redirectUri(request: Request): string {
    return `${request.protocol}://${request.get('host')}/auth/google/callback`;
  }

  private frontendOrigin(): string {
    return process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000';
  }

  startGoogleAuth(request: Request, response: Response): void {
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

    const flowState = createOAuthFlowState();
    const codeChallenge = deriveCodeChallenge(flowState.codeVerifier);

    const authUrl = buildGoogleAuthUrl({
      clientId: this.clientId,
      redirectUri: this.redirectUri(request),
      state: flowState.state,
      nonce: flowState.nonce,
      codeChallenge,
    });

    response.cookie(
      OAUTH_FLOW_COOKIE_NAME,
      encodeOAuthFlowState(flowState),
      buildOAuthFlowCookieOptions(process.env.NODE_ENV, OAUTH_FLOW_COOKIE_TTL_MS),
    );
    response.redirect(authUrl);
  }

  async handleGoogleCallback(
    code: string | undefined,
    state: string | undefined,
    request: Request,
    response: Response,
  ): Promise<void> {
    const flowState = decodeOAuthFlowState(request.cookies?.[OAUTH_FLOW_COOKIE_NAME] as string | undefined);

    // Milestone #57 — one-time callback semantics: the flow-state
    // cookie is cleared immediately, before any further processing,
    // regardless of outcome — the same encoded value can never be
    // presented again for a second callback attempt.
    response.clearCookie(OAUTH_FLOW_COOKIE_NAME, { path: '/' });

    if (!flowState || !code || !state || state !== flowState.state) {
      logWithRequestId(this.logger, 'warn', 'OAuth callback rejected: missing or mismatched state.');
      response.redirect(`${this.frontendOrigin()}/?auth_error=1`);
      return;
    }

    try {
      const { idToken } = await exchangeGoogleAuthorizationCode({
        code,
        codeVerifier: flowState.codeVerifier,
        clientId: this.clientId,
        clientSecret: this.clientSecret,
        redirectUri: this.redirectUri(request),
      });

      const identity = await verifyGoogleIdToken(idToken, this.clientId, flowState.nonce);
      const user = await this.findOrCreateUser(GOOGLE_PROVIDER, identity.subject, identity.email);

      const { rawToken, expiresAt } = await this.sessionService.createSession(user.id);
      const csrfToken = generateCsrfToken();
      const remainingMs = expiresAt.getTime() - Date.now();

      response.cookie(SESSION_COOKIE_NAME, rawToken, buildSessionCookieOptions(process.env.NODE_ENV, remainingMs));
      response.cookie(CSRF_COOKIE_NAME, csrfToken, buildCsrfCookieOptions(process.env.NODE_ENV, remainingMs));

      response.redirect(this.frontendOrigin());
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
