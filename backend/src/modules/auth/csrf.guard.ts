import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { CSRF_COOKIE_NAME } from './cookie.util';

/**
 * Milestone #57 — the double-submit CSRF check. Applied ONLY to
 * state-changing authenticated routes (POST /auth/signout,
 * POST /history, DELETE /history, DELETE /users/me) — never to GET
 * requests, which must remain safe/idempotent by definition and are
 * not a CSRF target. Fails closed: any missing or mismatched value
 * throws, never falls through to "allow." CORS alone is never relied
 * on for this protection — this check runs independently of it.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const cookieValue = request.cookies?.[CSRF_COOKIE_NAME] as string | undefined;
    const headerValue = request.headers['x-csrf-token'];

    if (!cookieValue || typeof headerValue !== 'string' || headerValue.length === 0) {
      throw new ForbiddenException('CSRF validation failed.');
    }

    if (cookieValue !== headerValue) {
      throw new ForbiddenException('CSRF validation failed.');
    }

    return true;
  }
}
