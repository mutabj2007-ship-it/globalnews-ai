import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OfficialBulletinCollector } from './official-bulletin.collector';

/** CTO R158 — the Rwanda National Police metadata connector. One collector per process; off unless enabled. */
@Module({
  imports: [ConfigModule],
  providers: [OfficialBulletinCollector],
  exports: [OfficialBulletinCollector],
})
export class OfficialBulletinModule {}
