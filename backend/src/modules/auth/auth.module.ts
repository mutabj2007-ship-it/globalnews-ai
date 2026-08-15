import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { RequireAuthGuard } from './require-auth.guard';
import { CsrfGuard } from './csrf.guard';

/**
 * Milestone #57 — SessionService/RequireAuthGuard are exported so
 * UsersModule/HistoryModule can depend on them without duplicating
 * session-validation logic.
 */
@Module({
  controllers: [AuthController],
  providers: [AuthService, SessionService, RequireAuthGuard, CsrfGuard],
  exports: [SessionService, RequireAuthGuard, CsrfGuard],
})
export class AuthModule {}
