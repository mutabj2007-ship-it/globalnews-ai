import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Milestone #57 — reads the `user` property RequireAuthGuard attaches
 * to the request after successfully validating the session cookie.
 * Only usable on a route that already has RequireAuthGuard applied —
 * this decorator does no validation of its own, it only reads what
 * the guard already established.
 */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): { id: string } => {
  const request = ctx.switchToHttp().getRequest<Request & { user?: { id: string } }>();
  return request.user as { id: string };
});
