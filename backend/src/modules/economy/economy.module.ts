import { Module } from '@nestjs/common';

import { PrismaModule } from '../../database/prisma.module';
import { EconomyController } from './economy.controller';
import { EconomyObservationReadService } from './economy-observation.read';

import { RetainedNisrCpiReader } from '../official-data/nisr/nisr-cpi-retained.reader';

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
  /*
    THE READER IS AN OFFICIAL-DATA PROVIDER, REGISTERED HERE AND OWNED THERE.

    It opens and decodes the retained artifact. That is deliberately NOT Economy code:
    the implementation-boundary guard forbids this module reaching into another
    domain’s runtime, and deciding which decoder may read a NISR artifact is an
    official-data decision. Registering it adds no transport — it has none.
  */
  providers: [EconomyObservationReadService, RetainedNisrCpiReader],
  exports: [EconomyObservationReadService],
})
export class EconomyModule {}
