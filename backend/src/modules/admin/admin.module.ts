import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';
import { AdminPlatformEnabledGuard } from './admin-platform.guard';
import { AdminService } from './admin.service';

/**
 * F1.a — administrative authorization foundation.
 *
 * `imports: [ConfigModule]` is declared explicitly rather than relying
 * on AppModule's global ConfigModule, so this module compiles
 * standalone in a test and its ConfigService dependency is a stated
 * fact rather than an accident of registration order. That is the same
 * DI repair E1 applied to NewsModule, and admin.module.spec.ts fails
 * immediately if a future edit removes it.
 *
 * AuthModule is imported for RequireAuthGuard and SessionService — the
 * existing session validation is reused wholesale, never reimplemented.
 * Neither AuthModule nor any file inside it is modified by F1.a.
 *
 * The controller is registered unconditionally; the kill switch is
 * enforced at request time by AdminPlatformEnabledGuard, because
 * conditional controller registration would have to read process.env
 * before ConfigModule has loaded .env.
 */
@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard, AdminPlatformEnabledGuard],
  exports: [AdminService],
})
export class AdminModule {}
