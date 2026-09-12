import { Controller, Get, INestApplication, Module, Post } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { SkipThrottle, Throttle, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { resolveTrustProxySetting, type TrustProxySetting } from './trusted-proxy.config';

/**
 * B-1 - load-style acceptance coverage for client-address resolution and the
 * rate-limit buckets that depend on it.
 *
 * MAKES NO REAL PROVIDER CALL. The probe controller below mirrors the real
 * controllers' throttle decorators exactly - the 120/60s override now on
 * NewsController.topHeadlines, the 5/60s override on
 * AnalysisController.analyzeNews, and HealthController's @SkipThrottle - so
 * this exercises the genuine ThrottlerModule/ThrottlerGuard wiring without
 * NewsService, GNewsProvider or OpenAiAnalysisProvider. Thirty-five unstubbed
 * requests would make thirty-five real GNews calls, hit that provider's own
 * rate limit, and prove nothing. This follows the convention
 * security/rate-limit.e2e-spec.ts already established.
 *
 * EVERY describe BUILDS A FRESH APP. ThrottlerStorageService is in-memory and
 * per process, so bucket state leaks between cases otherwise. That matters far
 * more here than in the existing spec, because these tests issue many more
 * requests.
 */

@Controller('probe')
class ProbeController {
  /** Mirrors NewsController.topHeadlines' B-1 defensive override. */
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @Get('headlines')
  headlines(): string {
    return 'ok';
  }

  /** Mirrors the global default (20/60s) with no override. */
  @Get('default')
  byDefault(): string {
    return 'ok';
  }

  /** Mirrors AnalysisController.analyzeNews' cost control exactly. */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('analysis')
  analysis(): string {
    return 'ok';
  }

  @SkipThrottle({ default: true })
  @Get('health')
  health(): string {
    return 'ok';
  }
}

@Module({
  imports: [ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 20 }])],
  controllers: [ProbeController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
class ProbeModule {}

/**
 * Builds an app whose Express instance has the given trust-proxy model, set
 * through the SAME resolver main.ts uses - so these tests can never pass
 * against a trust model the real application would refuse.
 */
async function buildApp(trustProxyValue?: string): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [ProbeModule] }).compile();
  const app = moduleRef.createNestApplication();

  const setting: TrustProxySetting = resolveTrustProxySetting(undefined, trustProxyValue);
  app.getHttpAdapter().getInstance().set('trust proxy', setting);

  await app.init();
  return app;
}

/** One distinct simulated visitor address. */
function visitor(index: number): string {
  return `203.0.113.${index}`;
}

describe('B-1 Test A/B/C/D - homepage SSR renders must not share one bucket', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  it('TEST A - 35 renders in one window, each carrying a distinct visitor address, produce ZERO 429s', async () => {
    app = await buildApp('1');

    const statuses: number[] = [];
    for (let i = 0; i < 35; i += 1) {
      const response = await request(app.getHttpServer())
        .get('/probe/headlines')
        .set('X-Forwarded-For', visitor(i));
      statuses.push(response.status);
    }

    expect(statuses).toHaveLength(35);
    expect(statuses.filter((status) => status === 429)).toEqual([]);
    expect(statuses.every((status) => status === 200)).toBe(true);
  }, 60000);

  it('TEST B - negative control: the SAME 35 requests with no forwarded identity and no trust are refused from the 21st, proving Test A measures the fix and not a disabled throttler', async () => {
    app = await buildApp(undefined);

    const statuses: number[] = [];
    for (let i = 0; i < 35; i += 1) {
      const response = await request(app.getHttpServer()).get('/probe/default');
      statuses.push(response.status);
    }

    expect(statuses.slice(0, 20).every((status) => status === 200)).toBe(true);
    expect(statuses[20]).toBe(429);
    expect(statuses.filter((status) => status === 429).length).toBe(15);
  });

  it('TEST C - one visitor cannot exhaust another visitor’s allowance', async () => {
    app = await buildApp('1');

    for (let i = 0; i < 20; i += 1) {
      await request(app.getHttpServer())
        .get('/probe/default')
        .set('X-Forwarded-For', visitor(1))
        .expect(200);
    }

    // Visitor 1 is now exhausted; visitor 2 must be untouched.
    await request(app.getHttpServer())
      .get('/probe/default')
      .set('X-Forwarded-For', visitor(1))
      .expect(429);

    for (let i = 0; i < 20; i += 1) {
      await request(app.getHttpServer())
        .get('/probe/default')
        .set('X-Forwarded-For', visitor(2))
        .expect(200);
    }
  });

  it('TEST D - the 120/60s backstop bounds the DEGRADED case: with no identity resolution at all, 120 renders pass and the 121st is refused', async () => {
    app = await buildApp(undefined);

    for (let i = 0; i < 120; i += 1) {
      await request(app.getHttpServer()).get('/probe/headlines').expect(200);
    }

    await request(app.getHttpServer()).get('/probe/headlines').expect(429);
  }, 60000);
});

describe('B-1 Test E/F/G/H - direct clients cannot manufacture fresh identities', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  it('TEST E - with trust disabled, 25 requests each carrying a DIFFERENT forged address are still refused at the 21st', async () => {
    app = await buildApp(undefined);

    const statuses: number[] = [];
    for (let i = 0; i < 25; i += 1) {
      const response = await request(app.getHttpServer())
        .get('/probe/default')
        .set('X-Forwarded-For', `198.51.100.${i}`);
      statuses.push(response.status);
    }

    expect(statuses[19]).toBe(200);
    expect(statuses[20]).toBe(429);
  });

  it('TEST F - with an allowlist that does NOT include this caller, forged addresses are ignored and the caller is throttled as themselves. This is the property a hop count cannot provide', async () => {
    app = await buildApp('10.0.0.0/8');

    const statuses: number[] = [];
    for (let i = 0; i < 25; i += 1) {
      const response = await request(app.getHttpServer())
        .get('/probe/default')
        .set('X-Forwarded-For', `198.51.100.${i}`);
      statuses.push(response.status);
    }

    expect(statuses[19]).toBe(200);
    expect(statuses[20]).toBe(429);
  });

  /**
   * The honest boundary of the hop-count model, recorded in executable form
   * rather than left in prose. With TRUST_PROXY=1 the caller IS the single
   * trusted hop, so a forged X-Forwarded-For is believed and each forged value
   * receives its own bucket.
   *
   * This is not a defect in the implementation - it is the documented reason
   * the allowlist form is preferred for production, and the reason the hop
   * count is permitted ONLY where ingress topology guarantees this backend is
   * unreachable except through the trusted proxies. Test F is the same
   * scenario with the safer model, and it holds.
   */
  it('TEST G - hop-count honest boundary: when the caller IS the trusted hop, forged addresses ARE believed', async () => {
    app = await buildApp('1');

    const statuses: number[] = [];
    for (let i = 0; i < 25; i += 1) {
      const response = await request(app.getHttpServer())
        .get('/probe/default')
        .set('X-Forwarded-For', `198.51.100.${i}`);
      statuses.push(response.status);
    }

    expect(statuses.filter((status) => status === 429)).toEqual([]);
  });

  it('TEST H - a request with no forwarded header behaves identically under every trust model', async () => {
    for (const trust of [undefined, '1', '10.0.0.0/8']) {
      const scoped = await buildApp(trust);
      try {
        for (let i = 0; i < 20; i += 1) {
          await request(scoped.getHttpServer()).get('/probe/default').expect(200);
        }
        await request(scoped.getHttpServer()).get('/probe/default').expect(429);
      } finally {
        await scoped.close();
      }
    }
  }, 60000);

  it('a forged address to the LEFT of the proxy-supplied one is discarded, so a client behind the real proxy cannot displace their own identity', async () => {
    app = await buildApp('1');

    // Chain as a real edge proxy would produce it: the client's forged value
    // first, the address the proxy actually observed appended on the right.
    for (let i = 0; i < 20; i += 1) {
      await request(app.getHttpServer())
        .get('/probe/default')
        .set('X-Forwarded-For', `198.51.100.${i}, ${visitor(7)}`)
        .expect(200);
    }

    await request(app.getHttpServer())
      .get('/probe/default')
      .set('X-Forwarded-For', `198.51.100.99, ${visitor(7)}`)
      .expect(429);
  });
});

describe('B-1 Test I/J/K/L - /analysis/news protection is unchanged and unbypassable', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  it('TEST I - request #6 from one resolved visitor returns 429', async () => {
    app = await buildApp('1');

    for (let i = 0; i < 5; i += 1) {
      await request(app.getHttpServer())
        .post('/probe/analysis')
        .set('X-Forwarded-For', visitor(1))
        .expect(201);
    }

    await request(app.getHttpServer())
      .post('/probe/analysis')
      .set('X-Forwarded-For', visitor(1))
      .expect(429);
  });

  it('TEST J - the limit is now per visitor rather than per site: a second visitor still gets their own five', async () => {
    app = await buildApp('1');

    for (const who of [visitor(1), visitor(2)]) {
      for (let i = 0; i < 5; i += 1) {
        await request(app.getHttpServer())
          .post('/probe/analysis')
          .set('X-Forwarded-For', who)
          .expect(201);
      }
    }

    await request(app.getHttpServer())
      .post('/probe/analysis')
      .set('X-Forwarded-For', visitor(1))
      .expect(429);
  });

  it('TEST K - analysis never inherits the 120/60s read backstop: the 6th call is refused, not the 121st', async () => {
    app = await buildApp('1');

    const statuses: number[] = [];
    for (let i = 0; i < 8; i += 1) {
      const response = await request(app.getHttpServer())
        .post('/probe/analysis')
        .set('X-Forwarded-For', visitor(3));
      statuses.push(response.status);
    }

    expect(statuses.slice(0, 5).every((status) => status === 201)).toBe(true);
    expect(statuses[5]).toBe(429);
  });

  it('TEST L - no header a client can set exempts analysis. There is no bypass credential in this design and this test exists so a future one cannot be added quietly', async () => {
    app = await buildApp('1');

    const bypassAttempts = {
      'x-internal-client': 'trusted',
      'x-internal-service': 'true',
      'x-real-ip': '10.0.0.1',
      'x-skip-throttle': 'true',
    };

    for (let i = 0; i < 5; i += 1) {
      await request(app.getHttpServer())
        .post('/probe/analysis')
        .set('X-Forwarded-For', visitor(4))
        .set(bypassAttempts)
        .expect(201);
    }

    await request(app.getHttpServer())
      .post('/probe/analysis')
      .set('X-Forwarded-For', visitor(4))
      .set(bypassAttempts)
      .expect(429);
  });

  it('a genuinely exempt route stays exempt, confirming the probe wiring matches the real app', async () => {
    app = await buildApp('1');

    for (let i = 0; i < 25; i += 1) {
      await request(app.getHttpServer()).get('/probe/health').expect(200);
    }
  });
});
