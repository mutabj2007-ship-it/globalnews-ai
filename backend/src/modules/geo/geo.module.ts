import { Module } from '@nestjs/common';
import { GeoController } from './geo.controller';

/**
 * GEO — the geographic resolution module.
 *
 * NO PROVIDERS AND NO DEPENDENCIES, DELIBERATELY. The resolver is a pure
 * function over a gazetteer loaded from disk once, so there is nothing to
 * inject and nothing to mock. Registering it as a Nest module buys exactly one
 * thing - the controller's route - and buys it without dragging DI into a layer
 * that does not need it.
 */
@Module({
  controllers: [GeoController],
})
export class GeoModule {}
