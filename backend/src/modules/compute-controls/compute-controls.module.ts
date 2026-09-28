import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../database/prisma.module';
import { CircuitBreakerService } from './circuit-breaker.service';
import { ComputeMeterService } from './compute-meter.service';
import { OperationalSwitchService } from './operational-switch.service';

/**
 * ASK R2 CONSOLIDATED INTEGRATION R1 · GATE B — the public Ask operational controls
 * (F 01/02/03). Imported by the Ask execution path in Gate E; nothing here calls a provider.
 */
@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [ComputeMeterService, CircuitBreakerService, OperationalSwitchService],
  exports: [ComputeMeterService, CircuitBreakerService, OperationalSwitchService],
})
export class ComputeControlsModule {}
