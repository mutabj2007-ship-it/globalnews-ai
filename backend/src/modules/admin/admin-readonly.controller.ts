import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RequireAuthGuard } from '../auth/require-auth.guard';
import { AdminPlatformEnabledGuard } from './admin-platform.guard';
import { AdminGuard } from './admin.guard';
import { CAPABILITIES } from './rbac/capabilities';
import { RequireCapability } from './rbac/require-capability.decorator';
import { AdminSystemService } from './system/admin-system.service';
import { AdminNewsService } from './news/admin-news.service';
import { AdminAnalyticsService } from './analytics/admin-analytics.service';
import type {
  AdminNewsProvidersResponse,
  AdminSystemHealthResponse,
} from './system/admin-system.contract';
import type {
  AdminAnalyticsUsageResponse,
  AdminCoverageGeographyResponse,
  AdminUsersResponse,
} from './analytics/admin-analytics.contract';

/**
 * F1.b, extended by ADMIN-03 — the authorized read-only admin surfaces.
 *
 * F1.b opened two; ADMIN-03 adds three. Every one is a pure read over
 * information the platform already produces. None introduces a schema
 * change, a migration, a metric store, a counter, or any value that is
 * not already asserted somewhere in this system today.
 *
 * Guard order is identical to AdminController's and must not be
 * reordered:
 *   AdminPlatformEnabledGuard -> 404 when the platform is switched off
 *   RequireAuthGuard          -> 401 when the caller is not signed in
 *   AdminGuard                -> 403 when the caller is not an admin or
 *                                lacks the required capability
 *
 * The first four routes require analytics.view, which every one of the
 * four roles holds — matching the approved design, where ADMIN-07 states
 * "all roles may view" and ADMIN-06 is "read-only for analysts". Provider
 * CONFIGURATION remains SUPER_ADMIN-only and is not implemented here.
 *
 * ADMIN-03 — THE FIFTH ROUTE IS THE EXCEPTION, AND IT IS DELIBERATE.
 * GET /admin/users requires access.manage, which only SUPER_ADMIN holds.
 * Putting a paginated list of every account behind analytics.view would
 * have given SUPPORT and ANALYST bulk enumeration of the user base —
 * exactly what the role matrix refuses when it denies SUPPORT the
 * evidence-export capability so that an operator handling one person's
 * data cannot export everyone's. The two analytics routes stay on
 * analytics.view because they return aggregates and no row at all.
 */
@Controller('admin')
@UseGuards(AdminPlatformEnabledGuard, RequireAuthGuard, AdminGuard)
export class AdminReadonlyController {
  constructor(
    private readonly systemService: AdminSystemService,
    private readonly newsService: AdminNewsService,
    private readonly analyticsService: AdminAnalyticsService,
  ) {}

  /** GET /admin/system/health — the ADMIN-07 eight-component probe fan-in. */
  @Get('system/health')
  @RequireCapability(CAPABILITIES.AnalyticsView)
  systemHealth(): Promise<AdminSystemHealthResponse> {
    return this.systemService.health({ skipProviderProbes: true });
  }

  /** GET /admin/news/providers — the ADMIN-06 provider health projection. */
  @Get('news/providers')
  @RequireCapability(CAPABILITIES.AnalyticsView)
  newsProviders(): Promise<AdminNewsProvidersResponse> {
    return this.newsService.providers();
  }

  /**
   * GET /admin/analytics/usage — ADMIN-03 account, analysis and product
   * event aggregates.
   *
   * AGGREGATES ONLY. No row, no identifier and no free text leaves this
   * route, and the service that builds the response selects no column
   * that could carry one.
   */
  @Get('analytics/usage')
  @RequireCapability(CAPABILITIES.AnalyticsView)
  analyticsUsage(): Promise<AdminAnalyticsUsageResponse> {
    return this.analyticsService.usage();
  }

  /**
   * GET /admin/analytics/coverage-geography — where stored coverage is
   * about, and which countries signed-in accounts follow.
   *
   * NOT AUDIENCE GEOGRAPHY. The response has no field for a viewer's
   * location and none is inferred from anything in it.
   */
  @Get('analytics/coverage-geography')
  @RequireCapability(CAPABILITIES.AnalyticsView)
  coverageGeography(): Promise<AdminCoverageGeographyResponse> {
    return this.analyticsService.coverageGeography();
  }

  /**
   * GET /admin/users — the paginated account list. SUPER_ADMIN only.
   *
   * The query values are taken as raw strings and handed to the service
   * unvalidated ON PURPOSE: the service already clamps a missing, zero,
   * negative, fractional or NaN page size to its documented bounds, and
   * routing that logic through a pipe as well would create a second
   * place where the bounds are decided.
   */
  @Get('users')
  @RequireCapability(CAPABILITIES.AccessManage)
  users(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<AdminUsersResponse> {
    return this.analyticsService.users(Number(page), Number(pageSize));
  }
}
