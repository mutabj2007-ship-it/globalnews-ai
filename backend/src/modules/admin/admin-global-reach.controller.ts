import { Controller, Get, UseGuards } from '@nestjs/common';
import { RequireAuthGuard } from '../auth/require-auth.guard';
import { AdminPlatformEnabledGuard } from './admin-platform.guard';
import { AdminGuard } from './admin.guard';
import { CAPABILITIES } from './rbac/capabilities';
import { RequireCapability } from './rbac/require-capability.decorator';
import { GlobalReachService } from '../global-reach/global-reach.service';

/** Pure projections of a validated snapshot. No provider or acquisition dependency. */
@Controller('admin/global-reach')
@UseGuards(AdminPlatformEnabledGuard, RequireAuthGuard, AdminGuard)
export class AdminGlobalReachController {
  constructor(private readonly reach: GlobalReachService) {}

  @Get('summary')
  @RequireCapability(CAPABILITIES.AnalyticsView)
  summary() {
    return this.reach.summary();
  }

  @Get('countries-governed')
  @RequireCapability(CAPABILITIES.AnalyticsView)
  countriesGoverned() {
    return this.reach.coverage();
  }

  @Get('validated-local-baseline')
  @RequireCapability(CAPABILITIES.AnalyticsView)
  validatedLocalBaseline() {
    return this.reach.coverage().filter((r) => r.state === 'VALIDATED_LOCAL_BASELINE');
  }

  @Get('countries-partial')
  @RequireCapability(CAPABILITIES.AnalyticsView)
  countriesPartial() {
    return this.reach.coverage().filter((r) => r.state === 'PARTIAL');
  }

  @Get('coverage-gaps')
  @RequireCapability(CAPABILITIES.AnalyticsView)
  coverageGaps() {
    return this.reach.coverage().filter((r) => r.state === 'COVERAGE_GAP');
  }

  @Get('unverified')
  @RequireCapability(CAPABILITIES.AnalyticsView)
  unverified() {
    return this.reach.coverage().filter((r) => r.state === 'UNVERIFIED');
  }

  @Get('publishers-by-country')
  @RequireCapability(CAPABILITIES.AnalyticsView)
  publishersByCountry() {
    return this.reach.coverage().map(({ iso2, iso3, governedRegion, publishers }) => ({
      iso2,
      iso3,
      governedRegion,
      publishers,
    }));
  }

  @Get('language-coverage')
  @RequireCapability(CAPABILITIES.AnalyticsView)
  languageCoverage() {
    return this.reach.coverage().map(({ iso3, governedRegion, languages, validatedLanguages }) => ({
      iso3,
      governedRegion,
      languages,
      validatedLanguages,
    }));
  }

  @Get('last-verification')
  @RequireCapability(CAPABILITIES.AnalyticsView)
  lastVerification() {
    return this.reach.coverage().map(({ iso3, governedRegion, lastVerification, publishers }) => ({
      iso3,
      governedRegion,
      lastVerification,
      sources: publishers.map(({ sourceId, verifiedAt }) => ({ sourceId, verifiedAt })),
    }));
  }
}
