import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './database/prisma.module';
import { HealthModule } from './health/health.module';
import { AnalysisModule } from './modules/analysis/analysis.module';
import { NewsModule } from './modules/news/news.module';
import { CorsStartupValidator } from './security/cors-startup-validator';
import { LoggingInterceptor } from './observability/logging.interceptor';
import { GlobalExceptionFilter } from './observability/global-exception.filter';
import { RequestIdMiddleware } from './observability/request-id.middleware';

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
    // Milestone #55 (unmatched-route correlation fix) — must be
    // registered as a provider so Nest's DI can construct it for
    // consumer.apply() in configure() below.
    RequestIdMiddleware,
    // Milestone #34: applies the ThrottlerModule config above to every
    // route by default.
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Milestone #55 — global request correlation + HTTP access
    // logging. Runs on every request (registered before the exception
    // filter so its own request-start log always precedes anything
    // the filter might log for the same request).
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    // Milestone #55 — catches every exception app-wide. Preserves the
    // existing status code/response body for any HttpException
    // (validation 400s, throttling 429s, health-check 503s, 404s,
    // etc.) unchanged; only genuinely unexpected errors are converted
    // to a sanitized generic 500 — see global-exception.filter.ts's
    // own doc comment for the full reasoning.
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  /**
   * Milestone #55 (unmatched-route correlation fix) — RequestIdMiddleware
   * must run before Nest's router, so it (and therefore the
   * X-Request-Id header + AsyncLocalStorage context it establishes)
   * covers every request, including one that matches no route at all
   * and produces a 404 straight from GlobalExceptionFilter — a case
   * LoggingInterceptor (which only runs after routing succeeds) can
   * never reach.
   *
   * Wildcard syntax note: this repository's real installed
   * @nestjs/platform-express is ^10.3.0 (confirmed via direct
   * package.json inspection, not assumed), which uses Express 4 and
   * path-to-regexp v6. The newer named-wildcard form ('{*splat}') is
   * specific to path-to-regexp v8, paired with Express 5 / NestJS 11
   * — NOT what this repository runs. The classic '*' form is the
   * version-correct choice here.
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
