import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CsrfGuard } from '../../auth/csrf.guard';
import { RequireAuthGuard } from '../../auth/require-auth.guard';
import { AdminPlatformEnabledGuard } from '../admin-platform.guard';
import { AdminGuard, type AdminContext } from '../admin.guard';
import { CurrentAdmin } from '../current-admin.decorator';
import { CAPABILITIES } from '../rbac/capabilities';
import { RequireCapability } from '../rbac/require-capability.decorator';
import type { OperationalSwitchName } from '../../compute-controls/operational-switch.service';
import { AdminOperationsService } from './admin-operations.service';
import { AdminOperationsSwitchDto } from './admin-operations.dto';
import type {
  AdminOperationsState,
  AdminOperationsSwitchResult,
} from './admin-operations.contract';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ADMIN OPERATIONS R1 — THE ONLY WRITE ON THE ADMIN SURFACE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The admin surface is read-only by design and `adminRoutes.ts` says so. This
 * controller is the single, deliberate exception, and it is a SEPARATE
 * controller for exactly that reason: the analytics controllers keep their
 * no-mutation property, and the boundary assertion can name one permitted
 * write path instead of being relaxed across the whole surface.
 *
 * GUARD CHAIN, unchanged from every other admin route:
 *   AdminPlatformEnabledGuard  404 — the platform is off, so nothing exists
 *   RequireAuthGuard           401 — signed out
 *   AdminGuard                 403 — not an administrator, or lacks the capability
 *   CsrfGuard                  on the mutation only, as SupportController does
 *
 * THE READ AND THE WRITE NEED DIFFERENT CAPABILITIES, and that is the point.
 * Seeing the switches is `analytics.view`, which every admin role holds.
 * Changing one is `operations.control`, which SUPPORT and ANALYST do not hold.
 * A reader who cannot operate still gets an honest screen: `mayOperate` false.
 *
 * THE ACTOR IS NOT IN THE BODY. It comes from `@CurrentAdmin()`, which only
 * AdminGuard sets, so no caller can write the audit trail under another name.
 * The DTO declares `enabled` and `reason` and nothing else; the global
 * ValidationPipe strips anything further.
 */
@Controller('admin/operations')
@UseGuards(AdminPlatformEnabledGuard, RequireAuthGuard, AdminGuard)
export class AdminOperationsController {
  constructor(private readonly operations: AdminOperationsService) {}

  @Get()
  @RequireCapability(CAPABILITIES.AnalyticsView)
  state(@CurrentAdmin() admin: AdminContext): Promise<AdminOperationsState> {
    return this.operations.state(admin.capabilities.includes(CAPABILITIES.OperationsControl));
  }

  @Post('switches/:name')
  @RequireCapability(CAPABILITIES.OperationsControl)
  @UseGuards(CsrfGuard)
  setSwitch(
    @CurrentAdmin() admin: AdminContext,
    @Param('name') name: string,
    @Body() body: AdminOperationsSwitchDto,
  ): Promise<AdminOperationsSwitchResult> {
    return this.operations.setSwitch(
      name as OperationalSwitchName,
      body.enabled,
      admin.id,
      body.reason,
    );
  }
}
