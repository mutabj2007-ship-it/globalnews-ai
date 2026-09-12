import { Controller, Get, Logger, Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { RequestIdMiddleware } from '../src/observability/request-id.middleware';
import { LoggingInterceptor } from '../src/observability/logging.interceptor';
import { GlobalExceptionFilter } from '../src/observability/global-exception.filter';

/**
 * Milestone #55 (unmatched-route correlation fix) â€” real end-to-end
 * HTTP pipeline test, reproducing the exact defect the CTO's Docker
 * evidence found: a request to a route that matches NOTHING must
 * still receive a correlated X-Request-Id, because RequestIdMiddleware
 * runs before Nest's router even attempts to match anything â€”
 * unlike LoggingInterceptor, which only runs after a route has
 * matched and therefore cannot cover this case on its own.
 *
 * Builds the smallest real app that mirrors AppModule's actual M55
 * wiring (the same middleware/interceptor/filter registration
 * pattern) plus one real, known route â€” so this test can prove BOTH
 * halves of the required behavior in one place: a matched request
 * keeps working exactly as before, and an unmatched request is now
 * correlated too.
 */
@Controller('probe')
class ProbeController {
  @Get()
  probe(): { status: string } {
    return { status: 'ok' };
  }
}

@Module({
  controllers: [ProbeController],
  providers: [
    RequestIdMiddleware,
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
class ProbeModule {
  configure(consumer: import('@nestjs/common').MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}

describe('Unmatched-route request correlation (Milestone #55 e2e)', () => {
  let app: INestApplication;
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ProbeModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('a genuinely nonexistent route still returns 404 with a valid X-Request-Id header', async () => {
    const response = await request(app.getHttpServer()).get('/m55-observability-nonexistent-route');

    expect(response.status).toBe(404);
    expect(response.headers['x-request-id']).toMatch(uuidPattern);
  });

  it('the exception filter\u2019s log line for that 404 contains the same request ID as the response header \u2014 no duplicate ID generated anywhere in the pipeline', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    const response = await request(app.getHttpServer()).get('/m55-observability-nonexistent-route');

    const requestId = response.headers['x-request-id'];
    const matchingLogCall = warnSpy.mock.calls.find((call) =>
      String(call[0]).includes(`[${requestId}]`),
    );
    expect(matchingLogCall).toBeDefined();

    warnSpy.mockRestore();
  });

  it('two separate unmatched requests receive two different request IDs \u2014 correlation is genuinely per-request, not a fixed/shared value', async () => {
    const first = await request(app.getHttpServer()).get('/m55-observability-nonexistent-route');
    const second = await request(app.getHttpServer()).get('/m55-observability-nonexistent-route');

    expect(first.headers['x-request-id']).not.toBe(second.headers['x-request-id']);
  });

  it('a known, matched route continues to use the same request ID throughout the request \u2014 existing successful-route correlation is unchanged', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    const response = await request(app.getHttpServer()).get('/probe');

    expect(response.status).toBe(200);
    const requestId = response.headers['x-request-id'];
    expect(requestId).toMatch(uuidPattern);

    const interceptorLogs = logSpy.mock.calls.filter((call) =>
      String(call[0]).includes(`[${requestId}]`),
    );
    expect(interceptorLogs.length).toBe(2);

    logSpy.mockRestore();
  });
});
