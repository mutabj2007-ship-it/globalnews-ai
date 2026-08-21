import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { NewsModule } from '../news/news.module';
import { AdminController } from './admin.controller';
import { AdminReadonlyController } from './admin-readonly.controller';
import { AdminNewsService } from './news/admin-news.service';
import { AdminSystemService } from './system/admin-system.service';
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
 * The controllers are registered unconditionally; the kill switch is
 * enforced at request time by AdminPlatformEnabledGuard, because
 * conditional controller registration would have to read process.env
 * before ConfigModule has loaded .env.
 *
 * F1.b — NewsModule is imported so the two authorized read-only
 * surfaces can consume NewsService.providersHealth(), the provider
 * probe this platform already runs. NewsModule already exports
 * NewsService (news.module.ts:138); nothing inside modules/news is
 * modified, and no existing news endpoint changes behaviour. This is a
 * one-directional read: the news module knows nothing about admin.
 */
@Module({
  imports: [ConfigModule, AuthModule, NewsModule],
  controllers: [AdminController, AdminReadonlyController],
  providers: [
    AdminService,
    AdminSystemService,
    AdminNewsService,
    AdminGuard,
    AdminPlatformEnabledGuard,
  ],
  exports: [AdminService],
})
export class AdminModule {}
