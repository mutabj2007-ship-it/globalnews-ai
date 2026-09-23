import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { NewsModule } from '../news/news.module';
import { AdminController } from './admin.controller';
import { AdminReadonlyController } from './admin-readonly.controller';
import { AdminNewsService } from './news/admin-news.service';
import { AdminSystemService } from './system/admin-system.service';
import { AdminAnalyticsService } from './analytics/admin-analytics.service';
import { AdminGuard } from './admin.guard';
import { AdminPlatformEnabledGuard } from './admin-platform.guard';
import { AdminService } from './admin.service';
import { AdminGlobalReachController } from './admin-global-reach.controller';
import { GlobalReachModule } from '../global-reach/global-reach.module';
import { EconomyModule } from '../economy/economy.module';
import { ElectionReadModule } from '../election/election-read.module';
import { AlphaReviewService } from './alpha-review.service';

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
 *
 * S3 — THE ONLY CHANGE IS TO `exports`, AND IT IS AN EXPORTS-ONLY
 * CHANGE. AdminGuard and AdminPlatformEnabledGuard become available to
 * SupportModule's admin support controller, so that surface is
 * authorized by THIS guard rather than by a second copy of the admin
 * security model living somewhere else. Nothing is added to `imports`,
 * `controllers` or `providers`; no behaviour in this module changes; and
 * no Prisma write call of any kind is introduced anywhere under
 * modules/admin, so F1.a's no-write-path guard still passes over this
 * directory unchanged. (The guard scans raw source, comments included,
 * so the call names it forbids are deliberately not spelled out here.)
 */
@Module({
  imports: [ConfigModule, AuthModule, NewsModule, GlobalReachModule, EconomyModule, ElectionReadModule],
  controllers: [AdminController, AdminReadonlyController, AdminGlobalReachController],
  providers: [
    AdminService,
    AdminSystemService,
    AdminNewsService,
    AdminAnalyticsService,
    AlphaReviewService,
    AdminGuard,
    AdminPlatformEnabledGuard,
  ],
  exports: [AdminService, AdminGuard, AdminPlatformEnabledGuard],
})
export class AdminModule {}
