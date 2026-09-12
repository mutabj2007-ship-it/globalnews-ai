import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AdminService } from './admin.service';
import { ADMIN_CAPABILITY_METADATA } from './rbac/require-capability.decorator';
import { capabilitiesFor, type AdminRoleName, type Capability } from './rbac/capabilities';

/** Established by AdminGuard on a successful authorization, read by @CurrentAdmin. */
export interface AdminContext {
  id: string;
  role: AdminRoleName;
  capabilities: readonly Capability[];
}

export type RequestWithAdmin = Request & {
  user?: { id: string };
  admin?: AdminContext;
};

/**
 * F1.a — administrative authorization.
 *
 * Composed AFTER RequireAuthGuard, which is left completely unmodified
 * (it is shared with /users/me and /history and its contract is not
 * this milestone's to change). RequireAuthGuard establishes
 * `request.user = { id }`; this guard turns that identity into a role
 * and a capability set, or refuses.
 *
 * ORDER OF CHECKS IS A SECURITY PROPERTY, not a style choice:
 *
 *  1. missing route metadata  -> 403  (fail closed; see the decorator)
 *  2. no authenticated user   -> 401  (guard mis-ordering, never a leak)
 *  3. role is null            -> 403
 *  4. capability missing      -> 403
 *
 * Steps 3 and 4 throw the SAME bare ForbiddenException, producing a
 * byte-identical body: `{"statusCode":403,"message":"Forbidden"}`. An
 * ordinary user probing /admin and a SUPPORT administrator probing a
 * SUPER_ADMIN route receive indistinguishable responses, so neither
 * the existence of a role nor the identity of a capability can be
 * mapped by enumeration. No message, no role name, no capability name,
 * no resource detail is ever returned.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly adminService: AdminService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Capability[] | undefined>(
      ADMIN_CAPABILITY_METADATA,
      [context.getHandler(), context.getClass()],
    );

    // A route protected by this guard but carrying no capability
    // metadata is DENIED. A forgotten decorator loses access; it can
    // never grant it.
    if (required === undefined) {
      throw new ForbiddenException();
    }

    const request = context.switchToHttp().getRequest<RequestWithAdmin>();
    const userId = request.user?.id;

    // Only reachable if this guard were ever wired without
    // RequireAuthGuard in front of it. 401 (not 403) so an
    // unauthenticated caller never learns anything about privilege.
    if (!userId) {
      throw new UnauthorizedException();
    }

    const role = await this.adminService.findAdminRole(userId);

    if (role === null) {
      throw new ForbiddenException();
    }

    const capabilities = capabilitiesFor(role);

    if (required.length > 0 && !required.every((capability) => capabilities.includes(capability))) {
      throw new ForbiddenException();
    }

    request.admin = { id: userId, role, capabilities };
    return true;
  }
}
