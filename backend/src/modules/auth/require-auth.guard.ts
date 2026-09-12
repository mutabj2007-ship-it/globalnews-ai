import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { SessionService } from './session.service';
import { SESSION_COOKIE_NAME } from './cookie.util';

/**
 * Milestone #57 — applied ONLY to the specific endpoints that require
 * a signed-in user (GET/DELETE /users/me, GET/POST/DELETE /history,
 * POST /auth/signout). Every existing public route — homepage, search,
 * map, analysis, health — has this guard applied nowhere, preserving
 * the core product principle unchanged: no existing capability
 * requires authentication.
 */
@Injectable()
export class RequireAuthGuard implements CanActivate {
  constructor(private readonly sessionService: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: { id: string } }>();
    const rawToken = request.cookies?.[SESSION_COOKIE_NAME] as string | undefined;

    if (!rawToken) {
      throw new UnauthorizedException();
    }

    const session = await this.sessionService.validateSession(rawToken);

    if (!session) {
      throw new UnauthorizedException();
    }

    request.user = { id: session.userId };
    return true;
  }
}
