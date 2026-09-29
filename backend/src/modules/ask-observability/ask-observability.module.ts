import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { AskObservationService } from './ask-observation.service';
import { AskObservationRetentionService } from './ask-observation-retention.service';

/**
 * ADMIN ASK INTELLIGENCE OBSERVABILITY R1 — the Ask observation writer.
 *
 * A module of its own rather than a file added to `modules/telemetry`, and the reason is
 * a test: `telemetry.privacy.spec.ts` pins that module's product file list EXACTLY, so
 * adding a seventh file there would break a privacy contract in order to write a privacy-
 * safe record. The separation also keeps the telemetry module's own promise intact — it
 * writes product events and nothing else.
 *
 * NO CONTROLLER. Nothing here is served. The Admin module reads this data behind the
 * admin guard chain, which is the only way it is ever exposed.
 */
@Module({
  imports: [PrismaModule],
  providers: [AskObservationService, AskObservationRetentionService],
  exports: [AskObservationService, AskObservationRetentionService],
})
export class AskObservabilityModule {}
