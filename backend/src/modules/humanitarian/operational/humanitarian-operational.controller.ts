import { Controller, Get, UseGuards } from '@nestjs/common';
import { RequireAuthGuard } from '../../auth/require-auth.guard';
import { AdminPlatformEnabledGuard } from '../../admin/admin-platform.guard';
import { AdminGuard } from '../../admin/admin.guard';
import { CAPABILITIES } from '../../admin/rbac/capabilities';
import { RequireCapability } from '../../admin/rbac/require-capability.decorator';
import { HumanitarianOperationalService } from './humanitarian-operational.service';
import type { HumanitarianOperationalStatus } from './humanitarian-operational.contract';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * `GET /admin/humanitarian/status` — READ-ONLY, AND ONLY READ
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ONE VERB. There is no `@Post`, `@Patch`, `@Put` or `@Delete` on this class,
 * and `humanitarianOperational.spec.ts` asserts that over the source. The brief
 * says "prefer read-only operational status in this lane"; a class with no
 * mutation decorator cannot drift into having one quietly.
 *
 * NO SWITCH, PROPOSED OR OTHERWISE. The brief permits proposing a new
 * `OperationalSwitch` for CTO review. I am not proposing one, and the reason is
 * in the code it would have to override: `assertActivationPermitted()` has
 * return type `never` and its message says *"There is no flag that changes
 * this, because a flag is what gets changed."* An admin switch over humanitarian
 * activation would be exactly the bypass of E1's source admission the brief
 * forbids. The delivery records this as a decision rather than an omission.
 *
 * THE GUARD CHAIN IS THE LANDED ONE, UNCHANGED — platform gate, then
 * authentication, then admin authorisation, then capability. Nothing here
 * weakens it and no new guard is introduced.
 *
 * WHY `analytics.view` AND NOT A NEW CAPABILITY: this is read-only operational
 * status, which is what that capability already governs across the admin
 * surface. Minting a humanitarian-specific capability would change the role
 * matrix — a Product Owner decision, and one this lane was not asked to make.
 */
@Controller('admin/humanitarian')
@UseGuards(AdminPlatformEnabledGuard, RequireAuthGuard, AdminGuard)
export class HumanitarianOperationalController {
  constructor(private readonly operational: HumanitarianOperationalService) {}

  @Get('status')
  @RequireCapability(CAPABILITIES.AnalyticsView)
  status(): HumanitarianOperationalStatus {
    return this.operational.status();
  }
}
