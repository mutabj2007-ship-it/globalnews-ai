import { Controller, Get, UseGuards } from '@nestjs/common';
import { RequireAuthGuard } from '../auth/require-auth.guard';
import { AdminPlatformEnabledGuard } from './admin-platform.guard';
import { AdminGuard } from './admin.guard';
import { CAPABILITIES } from './rbac/capabilities';
import { RequireCapability } from './rbac/require-capability.decorator';
import { AdminSystemService } from './system/admin-system.service';
import { AdminNewsService } from './news/admin-news.service';
import type {
  AdminNewsProvidersResponse,
  AdminSystemHealthResponse,
} from './system/admin-system.contract';

/**
 * F1.b — the two authorized read-only admin surfaces.
 *
 * Both are pure reads over information the platform already produces.
 * Neither introduces a schema change, a metric store, a counter, or any
 * value that is not already asserted somewhere in this system today.
 *
 * Guard order is identical to AdminController's and must not be
 * reordered:
 *   AdminPlatformEnabledGuard -> 404 when the platform is switched off
 *   RequireAuthGuard          -> 401 when the caller is not signed in
 *   AdminGuard                -> 403 when the caller is not an admin or
 *                                lacks the required capability
 *
 * Both routes require analytics.view, which every one of the four roles
 * holds — matching the approved design, where ADMIN-07 states "all
 * roles may view" and ADMIN-06 is "read-only for analysts". Provider
 * CONFIGURATION remains SUPER_ADMIN-only and is not implemented here.
 */
@Controller('admin')
@UseGuards(AdminPlatformEnabledGuard, RequireAuthGuard, AdminGuard)
export class AdminReadonlyController {
  constructor(
    private readonly systemService: AdminSystemService,
    private readonly newsService: AdminNewsService,
  ) {}

  /** GET /admin/system/health — the ADMIN-07 eight-component probe fan-in. */
  @Get('system/health')
  @RequireCapability(CAPABILITIES.AnalyticsView)
  systemHealth(): Promise<AdminSystemHealthResponse> {
    return this.systemService.health();
  }

  /** GET /admin/news/providers — the ADMIN-06 provider health projection. */
  @Get('news/providers')
  @RequireCapability(CAPABILITIES.AnalyticsView)
  newsProviders(): Promise<AdminNewsProvidersResponse> {
    return this.newsService.providers();
  }
}
