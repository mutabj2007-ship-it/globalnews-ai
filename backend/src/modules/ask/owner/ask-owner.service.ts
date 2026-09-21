import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import { SessionService } from '../../auth/session.service';
import { SESSION_COOKIE_NAME } from '../../auth/cookie.util';
import type { OperationOwner } from '../../compute/operation/compute-operation.service';

/**
 * BETA-SIMPLE-ASK-SAND-1 §3 — who owns an Ask thread.
 *
 * §3 asks for "stable Ask thread/session identity" and "persisted
 * thread state WHERE ACCOUNT/SESSION ARCHITECTURE PERMITS". That
 * qualifier is the whole problem this service solves.
 *
 * Every AI capability in this product is currently unauthenticated
 * (confirmed by inspection: RequireAuthGuard is applied only to
 * /users/me, /history and /auth/signout — never to /analysis). A
 * conversational Ask that required sign-in would be a regression in
 * capability, not an upgrade. So guests get threads too.
 *
 * WHY THE GUEST KEY IS SERVER-ISSUED AND httpOnly, rather than a
 * client-generated id sent in the request body.
 *
 * A client-supplied thread owner key is an access-control decision
 * made by the caller. Anyone who learned or guessed another guest's
 * key could read that guest's conversation — and since the key would
 * be visible to any script on the page, "learned" is not
 * hypothetical. Issuing it server-side as an httpOnly cookie means:
 *
 *   - the value is generated from a CSPRNG, not chosen by the caller;
 *   - page JavaScript cannot read it, so it cannot leak through an
 *     XSS payload, an analytics script, or a copied URL;
 *   - it is attached automatically, so the frontend has no identity
 *     state to manage or accidentally share.
 *
 * This mirrors exactly how the existing session cookie is handled
 * (see cookie.util.ts), including the dev-permissive/prod-strict
 * `secure` gate — hardcoding Secure=true would silently break local
 * development over http://localhost, which is the same trap
 * SESSION_COOKIE_NAME's own helper documents.
 */

/** Distinct from gna_session: a guest marker is not a sign-in. */
export const ASK_GUEST_COOKIE_NAME = 'gna_ask_guest';

/**
 * 256 bits. Guest thread ownership is the only thing this value
 * protects, and it must be infeasible to guess even at scale.
 */
const GUEST_KEY_BYTES = 32;

/** One year. A guest's conversations should outlive a browser restart. */
const GUEST_COOKIE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

@Injectable()
export class AskOwnerService {
  constructor(
    private readonly sessionService: SessionService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Resolves the caller's owner identity, issuing a guest cookie if
   * this is their first Ask.
   *
   * A VALID SESSION ALWAYS WINS. A signed-in user's threads are keyed
   * by userId, never by their guest cookie, so possessing a guest
   * cookie can never grant access to an account-owned thread — the
   * two identity spaces do not overlap.
   *
   * @param response used only to set the guest cookie when one is
   *   issued. Pass a `@Res({ passthrough: true })` response so Nest
   *   still handles serialization.
   */
  async resolve(request: Request, response: Response): Promise<OperationOwner> {
    const rawSessionToken =
      (request.cookies?.[SESSION_COOKIE_NAME] as string | undefined) ?? undefined;

    if (rawSessionToken) {
      const session = await this.sessionService.validateSession(rawSessionToken);
      if (session) {
        return { kind: 'user', key: `user:${session.userId}`, userId: session.userId };
      }
      // An expired or forged session token falls through to guest
      // identity rather than rejecting the request. Ask is a public
      // capability; a stale cookie must not lock someone out of it.
    }

    const existing = request.cookies?.[ASK_GUEST_COOKIE_NAME] as string | undefined;

    // Length is validated, not just presence: a caller can send any
    // cookie value they like, and an absurd one should not become a
    // database key. Anything unexpected is replaced with a fresh
    // server-generated key rather than trusted.
    if (existing && /^[0-9a-f]{64}$/.test(existing)) {
      return { kind: 'anonymous', key: `guest:${existing}`, sessionKey: existing };
    }

    const issued = randomBytes(GUEST_KEY_BYTES).toString('hex');

    response.cookie(ASK_GUEST_COOKIE_NAME, issued, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get<string>('NODE_ENV') === 'production',
      path: '/',
      maxAge: GUEST_COOKIE_MAX_AGE_MS,
    });

    return { kind: 'anonymous', key: `guest:${issued}`, sessionKey: issued };
  }

  /**
   * Resolves an owner for a READ, without ever issuing a cookie.
   *
   * Reads must not mint identity. If a caller with no cookie could be
   * handed a brand-new guest key on a GET, then every crawler hit
   * would create an identity, and — more importantly — a
   * Set-Cookie on a cacheable GET response is a well-known way to
   * leak one visitor's identity to another through a shared cache.
   * Returns null when there is nothing to resolve, and the caller
   * treats that as "no threads".
   */
  async resolveForRead(request: Request): Promise<OperationOwner | null> {
    const rawSessionToken =
      (request.cookies?.[SESSION_COOKIE_NAME] as string | undefined) ?? undefined;

    if (rawSessionToken) {
      const session = await this.sessionService.validateSession(rawSessionToken);
      if (session) {
        return { kind: 'user', key: `user:${session.userId}`, userId: session.userId };
      }
    }

    const existing = request.cookies?.[ASK_GUEST_COOKIE_NAME] as string | undefined;
    if (existing && /^[0-9a-f]{64}$/.test(existing)) {
      return { kind: 'anonymous', key: `guest:${existing}`, sessionKey: existing };
    }

    return null;
  }
}
