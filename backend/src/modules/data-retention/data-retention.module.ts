import { Module } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { DataRetentionService } from './data-retention.service';
import { resolveRetentionPolicy } from './retention-policy';

/** TRUST R1 (CTO §7) — the Beta retention policy, enforced. PrismaModule is global. */
@Module({
  providers: [
    {
      provide: DataRetentionService,
      useFactory: (prisma: PrismaService) =>
        new DataRetentionService(prisma, resolveRetentionPolicy()),
      inject: [PrismaService],
    },
  ],
  exports: [DataRetentionService],
})
export class DataRetentionModule {}
