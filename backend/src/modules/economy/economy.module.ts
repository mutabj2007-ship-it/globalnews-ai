import { Module } from '@nestjs/common';

import { PrismaModule } from '../../database/prisma.module';
import { EconomyController } from './economy.controller';
import { EconomyObservationReadService } from './economy-observation.read';

/**
 * ECONOMY — ONE READ ROUTE OVER RETAINED EVIDENCE.
 *
 * NO PROVIDER, NO SCHEDULER, NO TRANSPORT. Registering this module buys exactly one
 * thing: a route that opens bytes the snapshot store already holds. It cannot fetch,
 * because nothing in its dependency graph can.
 */
@Module({
  imports: [PrismaModule],
  controllers: [EconomyController],
  providers: [EconomyObservationReadService],
  exports: [EconomyObservationReadService],
})
export class EconomyModule {}
