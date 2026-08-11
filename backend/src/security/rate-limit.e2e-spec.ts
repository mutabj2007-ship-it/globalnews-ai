import { Controller, Get, INestApplication, Module, Post } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { SkipThrottle, Throttle, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';

/**
 * Milestone #34 — minimal stand-ins mirroring the real
 * AnalysisController/HealthController's throttle decorators exactly
 * (same @Throttle({ default: { limit, ttl } }) / @SkipThrottle()
 * shapes used in modules/analysis/controller/analysis.controller.ts
 * and health/health.controller.ts), so this test exercises the actual
 * ThrottlerModule/ThrottlerGuard wiring configured in app.module.ts
 * without needing AnalysisService, GNewsProvider, or OpenAiAnalysisProvider —
 * per M34 test requirements, this suite makes no real provider calls.
 */
@Controller('probe')
class ProbeController {
  @Get()
  get(): string {
    return 'ok';
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('strict')
  strict(): string {
    return 'ok';
  }

  @SkipThrottle({ default: true })
  @Get('health')
  health(): string {
    return 'ok';
  }
}

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 20,
      },
    ]),
  ],
  controllers: [ProbeController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
class ProbeModule {}

describe('Rate limiting (Milestone #34)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ProbeModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows requests up to the global default limit (20/60s)', async () => {
    for (let i = 0; i < 20; i += 1) {
      await request(app.getHttpServer()).get('/probe').expect(200);
    }
  });

  it('returns 429 once the global default limit is exceeded', async () => {
    await request(app.getHttpServer()).get('/probe').expect(429);
  });

  it('applies the stricter 5/60s override on a @Throttle()-decorated route', async () => {
    for (let i = 0; i < 5; i += 1) {
      await request(app.getHttpServer()).post('/probe/strict').expect(201);
    }
    await request(app.getHttpServer()).post('/probe/strict').expect(429);
  });

  it('never throttles a @SkipThrottle() route, even past the global limit', async () => {
    for (let i = 0; i < 25; i += 1) {
      await request(app.getHttpServer()).get('/probe/health').expect(200);
    }
  });
});
