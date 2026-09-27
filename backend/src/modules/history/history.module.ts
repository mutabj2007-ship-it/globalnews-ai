import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HistoryController } from './history.controller';
import { HistoryService } from './history.service';

@Module({
  imports: [AuthModule],
  controllers: [HistoryController],
  providers: [HistoryService],
  // MY INTELLIGENCE R1 — the analysis entry point records explicit questions through it.
  exports: [HistoryService],
})
export class HistoryModule {}
