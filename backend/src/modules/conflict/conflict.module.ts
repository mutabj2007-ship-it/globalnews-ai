import { Module } from '@nestjs/common';

import { PrismaModule } from '../../database/prisma.module';
import { ConflictController } from './conflict.controller';
import { ConflictRetainedReadService } from './conflict-retained.read';

/** Read-only Conflict module over retained canonical evidence. No provider or scheduler. */
@Module({
  imports: [PrismaModule],
  controllers: [ConflictController],
  providers: [ConflictRetainedReadService],
  exports: [ConflictRetainedReadService],
})
export class ConflictModule {}