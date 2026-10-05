import { Controller, Get, UseGuards } from '@nestjs/common';
import { RequireAuthGuard } from '../../auth/require-auth.guard';
import { AdminPlatformEnabledGuard } from '../admin-platform.guard';
import { AdminGuard } from '../admin.guard';
import { CAPABILITIES } from '../rbac/capabilities';
import { RequireCapability } from '../rbac/require-capability.decorator';
import { legacyRouteUsage, type LegacyUsageSnapshot } from '../../legacy-usage/legacy-route-usage';

/**
 * STAGE 2 / T4 — GET /admin/analytics/legacy-usage: is anyone still calling the legacy analysis
 * family (POST /analysis/news, GET /news/search, GET|DELETE /history)?
 *
 * READ-ONLY, AGGREGATES ONLY, SAME GUARD CHAIN AND CAPABILITY AS GET /admin/analytics/usage.
 * Every value is a count over a closed bucket enum (route literal, caller class, auth class,
 * user-agent family) plus timestamps; there is no row, identifier, query text, address or raw
 * header in the response because none is ever stored (see legacy-route-usage.ts).
 *
 * PER PROCESS: `scope: 'process'` and `countingSince` travel with the counts so the screen can
 * say "since this instance started" rather than imply a platform-wide total. The durable record
 * is the structured `legacy_route_use` log line.
 *
 * A separate controller, not a fifth method on AdminReadonlyController, so no existing
 * constructor (and no test that builds one positionally) changes.
 */
@Controller('admin')
@UseGuards(AdminPlatformEnabledGuard, RequireAuthGuard, AdminGuard)
export class AdminLegacyUsageController {
  @Get('analytics/legacy-usage')
  @RequireCapability(CAPABILITIES.AnalyticsView)
  legacyUsage(): LegacyUsageSnapshot {
    return legacyRouteUsage.snapshot();
  }
}
