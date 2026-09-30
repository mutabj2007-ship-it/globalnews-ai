import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AnalysisModule } from '../analysis/analysis.module';
import { ComputeControlsModule } from '../compute-controls/compute-controls.module';
import { SpecialistModule } from '../specialist/specialist.module';
import { AskObservabilityModule } from '../ask-observability/ask-observability.module';
import { AskIntelligenceModule } from '../ask-intelligence/ask-intelligence.module';
import { ASK_EXECUTION_PORT } from './ask-compute.contract';
import { AskV2Controller, AskV2EnabledGuard } from './ask-v2.controller';
import { AskV2Service } from './ask-v2.service';
import { AskR2ExecutionAdapter } from './ask-r2-execution.adapter';
import { AskRequestContextInterceptor } from './ask-request-context';
import { AskAccessObservationFilter } from './ask-access-observation.filter';
import { GuestCoreModule } from './guest/guest-core.module';
import { AskV2GuestController } from './guest/ask-v2-guest.controller';
import { GuestFirstWriteGuard, GuestWriteGuard, RequireGuestGuard } from './guest/guest.guards';
import { GuestMaintenanceService } from './guest/guest-maintenance.service';

/*
  ASK R2 CONSOLIDATED INTEGRATION R1 · GATE E — ASK_EXECUTION_PORT is bound to the Ask R2
  adapter (frozen C routing + the landed analysis path under the Gate B controls).
  Binding it is NOT activation: the routes stay 404 unless ASK_V2_ENABLED is 'true'
  (default off), and no AI runs unless ASK_R2_ENABLED and ASK_PUBLIC_COMPUTE_ENABLED are
  both on (two-key: deployment literal 'true' AND an audited DB row; default off).
  UNWIRED_ASK_EXECUTION_PORT remains exported as the explicit-HOLD value.
*/
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuthModule,
    AnalysisModule,
    ComputeControlsModule,
    SpecialistModule,
    AskObservabilityModule,
    AskIntelligenceModule,
    GuestCoreModule,
  ],
  controllers: [AskV2Controller, AskV2GuestController],
  providers: [
    AskV2Service,
    AskV2EnabledGuard,
    AskRequestContextInterceptor,
    AskAccessObservationFilter,
    AskR2ExecutionAdapter,
    RequireGuestGuard,
    GuestWriteGuard,
    GuestFirstWriteGuard,
    GuestMaintenanceService,
    { provide: ASK_EXECUTION_PORT, useExisting: AskR2ExecutionAdapter },
  ],
  exports: [AskV2Service],
})
export class AskV2Module {}
