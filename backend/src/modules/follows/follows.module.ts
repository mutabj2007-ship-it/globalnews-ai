import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FollowsController } from './follows.controller';
import { FollowsService } from './follows.service';

/**
 * R1/T3 — the country-follow module.
 *
 * AuthModule is imported for RequireAuthGuard and CsrfGuard, which it
 * already exports for UsersModule, HistoryModule and SupportModule — the
 * same dependency, not a second copy of session validation. PrismaModule
 * is @Global(), so PrismaService needs no import here, matching
 * HistoryModule exactly.
 *
 * TelemetryModule is @Global(), so TelemetryService needs no import here
 * either. follow_created and follow_removed are two of the five events
 * this platform can honestly emit today, and they are emitted
 * SERVER-SIDE from the code that changed the state — not reported by a
 * client that might be wrong about whether anything happened.
 */
@Module({
  imports: [AuthModule],
  controllers: [FollowsController],
  providers: [FollowsService],
})
export class FollowsModule {}
