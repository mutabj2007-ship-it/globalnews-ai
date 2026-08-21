import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { parseAdminRole, type AdminRoleName } from './rbac/capabilities';

/**
 * F1.a — the single read of administrative role state.
 *
 * The role is read PER REQUEST and never cached in the session. That
 * costs one indexed primary-key lookup per admin request and buys a
 * property worth far more: revoking a role takes effect on the very
 * next request, with no session invalidation, no token rotation and no
 * sign-out required.
 *
 * F1.a contains NO write path for adminRole. There is no method here,
 * and no endpoint anywhere, that assigns or changes a role — the first
 * SUPER_ADMIN is granted deliberately at database level, and role
 * management through the product arrives only alongside the
 * append-only audit store.
 */
@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the caller's role, or `null` for "not an administrator".
   *
   * `null` is returned identically for: a user row that no longer
   * exists (deleted mid-session), a row with adminRole NULL, and a row
   * whose adminRole is a value this build does not recognise. Every
   * one of those is a denial, and none of them is distinguishable to
   * the caller.
   */
  async findAdminRole(userId: string): Promise<AdminRoleName | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { adminRole: true },
    });

    return parseAdminRole(user?.adminRole ?? null);
  }
}
