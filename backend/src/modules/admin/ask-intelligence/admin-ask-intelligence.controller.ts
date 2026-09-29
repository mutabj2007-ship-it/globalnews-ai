import { Controller, Get, UseGuards } from '@nestjs/common';
import { RequireAuthGuard } from '../../auth/require-auth.guard';
import { AdminPlatformEnabledGuard } from '../admin-platform.guard';
import { AdminGuard } from '../admin.guard';
import { CAPABILITIES } from '../rbac/capabilities';
import { RequireCapability } from '../rbac/require-capability.decorator';
import { AdminAskIntelligenceService } from './admin-ask-intelligence.service';
import type { AdminAskIntelligenceResponse } from './admin-ask-intelligence.contract';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ADMIN → AI → ASK INTELLIGENCE — R1, READ-ONLY
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ONE GET AND NOTHING ELSE. R1 exposes no action, no export and no mutation: no POST, and
 * PUT/PATCH/DELETE are banned across the whole admin surface by `admin.contract.spec.ts`.
 * The read-only rule is therefore enforced by a test over the shipped source, not by this
 * comment.
 *
 * Guard order is identical to the other admin controllers' and must not be reordered:
 *   AdminPlatformEnabledGuard -> 404 when the admin platform is switched off, for
 *                                everyone, so "disabled" means absent and not merely locked
 *   RequireAuthGuard          -> 401 when the caller is not signed in
 *   AdminGuard                -> 403 when the caller is not an administrator or lacks the
 *                                required capability
 *
 * analytics.view, WHICH ALL FOUR ROLES HOLD, AND THAT IS THE CORRECT CHOICE HERE.
 * The response is aggregates: no row, no identifier, no free text, and nothing a person
 * could be picked out of. It carries none of the properties that made the account list
 * SUPER_ADMIN-only — there is no enumeration of anybody, because there is nobody in it.
 *
 * WHY THIS IS A SEPARATE CONTROLLER RATHER THAN A ROUTE ON THE EXISTING READ-ONLY ONE.
 * `AdminReadonlyController` currently fails to construct in three admin specs, which
 * predate this branch: it gained a fourth constructor dependency and those specs still
 * build it with three. Adding a route to it would have entangled a new surface with a
 * broken one and made the failure look like this lane's. The defect is reported
 * unmodified; this controller does not touch it.
 */
@Controller('admin/ai')
@UseGuards(AdminPlatformEnabledGuard, RequireAuthGuard, AdminGuard)
export class AdminAskIntelligenceController {
  constructor(private readonly askIntelligenceService: AdminAskIntelligenceService) {}

  /**
   * GET /admin/ai/ask-intelligence — what TYPES of questions readers ask, what
   * capabilities they need, what evidence succeeds or fails, and where Ask needs work.
   *
   * AGGREGATES ONLY. No question, no query, no account and no free text leaves this route,
   * and the service that builds the response selects no column that could carry one.
   */
  @Get('ask-intelligence')
  @RequireCapability(CAPABILITIES.AnalyticsView)
  askIntelligence(): Promise<AdminAskIntelligenceResponse> {
    return this.askIntelligenceService.askIntelligence();
  }
}
