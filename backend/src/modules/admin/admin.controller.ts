import { Controller, Get, UseGuards } from '@nestjs/common';
import { RequireAuthGuard } from '../auth/require-auth.guard';
import { AdminPlatformEnabledGuard } from './admin-platform.guard';
import { AdminGuard, type AdminContext } from './admin.guard';
import { CurrentAdmin } from './current-admin.decorator';
import { AdminOnly } from './rbac/require-capability.decorator';
import type { AdminRoleName, Capability } from './rbac/capabilities';

/**
 * F1.a — the minimum admin surface required to establish and prove the
 * security boundary. ONE route.
 *
 * There is deliberately no analytics, health, payments, support, audit
 * or role-management endpoint here. Those follow F1.a acceptance.
 *
 * Guard order is load-bearing and must not be reordered:
 *   AdminPlatformEnabledGuard -> 404 when the platform is switched off
 *   RequireAuthGuard          -> 401 when the caller is not signed in
 *   AdminGuard                -> 403 when the caller is not an admin
 *                                or lacks the required capability
 */
export interface AdminMeResponse {
  adminId: string;
  role: AdminRoleName;
  capabilities: readonly Capability[];
}

@Controller('admin')
@UseGuards(AdminPlatformEnabledGuard, RequireAuthGuard, AdminGuard)
export class AdminController {
  /**
   * GET /admin/me
   *
   * The capability list is derived server-side and handed to the
   * client; the frontend never re-derives the role matrix. It sits
   * behind AdminOnly() rather than a specific capability so that an
   * administrator of any role can discover what they may do — and
   * behind AdminGuard nonetheless, so a non-administrator cannot
   * enumerate the capability vocabulary.
   */
  @Get('me')
  @AdminOnly()
  me(@CurrentAdmin() admin: AdminContext): AdminMeResponse {
    return {
      adminId: admin.id,
      role: admin.role,
      capabilities: admin.capabilities,
    };
  }
}
