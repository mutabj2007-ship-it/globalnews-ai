import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GLOBAL_REACH_AUTHORITY, GlobalReachService } from './global-reach.service';
import { GlobalReachAcquisitionService } from './global-reach-acquisition.service';
import { GLOBAL_REACH_REGIONS, GLOBAL_REACH_SOURCE_PACKS } from './source-pack.registry';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: GLOBAL_REACH_AUTHORITY,
      useValue: { regions: GLOBAL_REACH_REGIONS, packs: GLOBAL_REACH_SOURCE_PACKS },
    },
    GlobalReachService,
    GlobalReachAcquisitionService,
  ],
  exports: [GlobalReachService, GlobalReachAcquisitionService],
})
export class GlobalReachModule {}
