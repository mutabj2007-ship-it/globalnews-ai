import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AdminContext, RequestWithAdmin } from './admin.guard';

/**
 * F1.a — reads the AdminContext that AdminGuard attaches to the
 * request after a successful authorization. Mirrors the existing
 * @CurrentUser decorator exactly: it performs NO validation of its
 * own and is only usable on a route that already carries AdminGuard.
 */
export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AdminContext => {
    const request = ctx.switchToHttp().getRequest<RequestWithAdmin>();
    return request.admin as AdminContext;
  },
);
