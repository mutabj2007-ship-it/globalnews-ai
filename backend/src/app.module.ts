import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './database/prisma.module';
import { HealthModule } from './health/health.module';
import { AnalysisModule } from './modules/analysis/analysis.module';
import { NewsModule } from './modules/news/news.module';
import { CorsStartupValidator } from './security/cors-startup-validator';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Milestone #34: global default rate limit — 20 requests / 60s per
    // client (see ThrottlerGuard registration below, applied globally
    // via APP_GUARD). Individual routes override this with @Throttle()
    // (e.g. POST /analysis/news) or opt out with @SkipThrottle()
    // (e.g. GET /health).
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 20,
      },
    ]),
    PrismaModule,
    HealthModule,
    NewsModule,
    AnalysisModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Milestone #34: fail-closed startup guard, same registration
    // pattern as AnalysisStartupValidator (M30) / NewsStartupValidator
    // (M33) — see security/cors-startup-validator.ts.
    CorsStartupValidator,
    // Milestone #34: applies the ThrottlerModule config above to every
    // route by default.
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
