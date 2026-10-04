import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { SessionService } from '../../auth/session.service';
import { resolveAuthCookieNames } from '../../auth/cookie.util';
import { guestRefusal } from './ask-principal';
import { GuestSessionService } from './guest-session.service';

type GuestRequest = Request & { guest?: { id: string; tokenHash: string } };

/** A signed-in reader never uses the guest path: one browser, one principal at a time. */
async function signedIn(request: Request, sessions: SessionService): Promise<boolean> {
  const raw = request.cookies?.[resolveAuthCookieNames().session] as string | undefined;
  if (!raw) return false;
  try {
    return (await sessions.validateSession(raw)) !== null;
  } catch {
    return false;
  }
}

/**
 * ASK GUEST TRIAL R3 — the request's guest, resolved from its HttpOnly cookie ONLY. An absent,
 * unknown, expired, claimed or revoked guest session is a bare 401; nothing about any other
 * guest or thread is revealed. Expiry is enforced here on every access (D2).
 */
@Injectable()
export class RequireGuestGuard implements CanActivate {
  constructor(
    private readonly guests: GuestSessionService,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<GuestRequest>();
    if (await signedIn(request, this.sessions)) throw guestRefusal('SIGNED_IN_USE_ACCOUNT');
    const guest = await this.guests.resolve(request);
    if (guest === null) throw new UnauthorizedException();
    const raw = this.guests.rawTokenFrom(request) as string;
    request.guest = { id: guest.id, tokenHash: GuestSessionService.hashToken(raw) };
    return true;
  }
}

/**
 * Guest MUTATIONS: the product's own Origin AND the guest-bound CSRF value in both the CSRF
 * cookie and the `x-csrf-token` header. A forged or tossed CSRF cookie cannot match, because
 * the expected value is an HMAC of THIS guest's token hash under a server key.
 */
@Injectable()
export class GuestWriteGuard implements CanActivate {
  constructor(private readonly guests: GuestSessionService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<GuestRequest>();
    if (!this.guests.originAllowed(request)) throw new ForbiddenException('Origin not allowed.');
    const header = request.headers['x-csrf-token'];
    const cookie = request.cookies?.[resolveAuthCookieNames().csrf] as string | undefined;
    const tokenHash = request.guest?.tokenHash;
    if (
      tokenHash === undefined ||
      typeof header !== 'string' ||
      header !== cookie ||
      !this.guests.csrfMatches(tokenHash, header)
    ) {
      throw new ForbiddenException('CSRF validation failed.');
    }
    return true;
  }
}

/**
 * The FIRST guest submission, before any guest session exists: same-origin, a JSON body, and
 * the non-simple `x-requested-with` header (which a cross-site form cannot send without a CORS
 * preflight this backend never grants). A signed-in reader is refused.
 */
@Injectable()
export class GuestFirstWriteGuard implements CanActivate {
  constructor(
    private readonly guests: GuestSessionService,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<GuestRequest>();
    if (!this.guests.originAllowed(request)) throw new ForbiddenException('Origin not allowed.');
    if (request.headers['x-requested-with'] !== 'globalnews-ask') {
      throw new ForbiddenException('CSRF validation failed.');
    }
    if (!String(request.headers['content-type'] ?? '').startsWith('application/json')) {
      throw new ForbiddenException('CSRF validation failed.');
    }
    if (await signedIn(request, this.sessions)) throw guestRefusal('SIGNED_IN_USE_ACCOUNT');
    return true;
  }
}

/**
 * T5 PART B — `POST /ask-v2/guest/forget`. Same-origin and the non-simple
 * `x-requested-with` header (a cross-site form cannot send it), and never for a signed-in
 * reader (one browser, one principal; account data is never in reach of this route). The
 * guest-bound CSRF check runs in the handler whenever a guest token is presented, because the
 * route must ALSO succeed — idempotently — when no live guest exists any more.
 */
@Injectable()
export class GuestForgetGuard implements CanActivate {
  constructor(
    private readonly guests: GuestSessionService,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<GuestRequest>();
    if (!this.guests.originAllowed(request)) throw new ForbiddenException('Origin not allowed.');
    if (request.headers['x-requested-with'] !== 'globalnews-ask') {
      throw new ForbiddenException('CSRF validation failed.');
    }
    if (await signedIn(request, this.sessions)) throw guestRefusal('SIGNED_IN_USE_ACCOUNT');
    return true;
  }
}
