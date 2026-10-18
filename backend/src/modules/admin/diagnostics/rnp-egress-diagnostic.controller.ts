import { Controller, Get, UseGuards } from '@nestjs/common';
import { RequireAuthGuard } from '../../auth/require-auth.guard';
import {
  OfficialBulletinCollector,
  type OfficialBulletinSnapshot,
} from '../../official-bulletin/official-bulletin.collector';
import { AdminPlatformEnabledGuard } from '../admin-platform.guard';
import { AdminGuard } from '../admin.guard';
import { CAPABILITIES } from '../rbac/capabilities';
import { RequireCapability } from '../rbac/require-capability.decorator';
import { RnpEgressDiagnosticService, type RnpEgressProbe } from './rnp-egress-diagnostic.service';

/** CTO R157 decision D — admin-only, opt-in, fixed-target egress measurement. No body, no parameters, no state written
    (a GET: it changes nothing here, which keeps this surface's no-mutation boundary intact).
    CTO R158 — plus a read of the official-bulletin collector's last snapshot: metadata only, never a network read. */
@Controller('admin/diagnostics')
@UseGuards(AdminPlatformEnabledGuard, RequireAuthGuard, AdminGuard)
export class RnpEgressDiagnosticController {
  constructor(
    private readonly diagnostic: RnpEgressDiagnosticService,
    private readonly collector: OfficialBulletinCollector,
  ) {}

  @Get('rnp-egress')
  @RequireCapability(CAPABILITIES.ProviderConfigure)
  probe(): Promise<RnpEgressProbe> {
    return this.diagnostic.probe();
  }

  @Get('rnp-bulletin')
  @RequireCapability(CAPABILITIES.ProviderConfigure)
  bulletin(): OfficialBulletinSnapshot {
    return this.collector.current();
  }
}
