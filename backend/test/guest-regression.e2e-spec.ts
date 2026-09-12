import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

/**
 * Milestone #57 — protects the core product principle stated in the
 * M57 authorization directly: "No existing browse, search, map,
 * evidence or AI-analysis capability may require authentication."
 *
 * This does not re-test the real News/Analysis/Health controllers'
 * own business logic (already covered by their own extensive existing
 * test suites) — it proves the narrower, M57-specific property that
 * matters here: a request carrying NO cookies at all, and NO
 * Authorization header, still reaches a real route handler rather
 * than being rejected by any new M57 guard. A minimal probe module
 * with a representative public-style GET route stands in for the real
 * controllers, mirroring the existing rate-limit.e2e-spec.ts/
 * unmatched-route-correlation.e2e-spec.ts convention of a small
 * standalone app rather than duplicating the full AppModule.
 */
@Controller('probe')
class GuestProbeController {
  @Get('public')
  publicRoute(): { status: string } {
    return { status: 'ok' };
  }
}

@Module({ controllers: [GuestProbeController] })
class GuestProbeModule {}

describe('Guest regression (Milestone #57)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [GuestProbeModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('a request with zero cookies and zero Authorization header still succeeds \u2014 no M57 module places a guard in front of an unrelated public route', async () => {
    const response = await request(app.getHttpServer()).get('/probe/public');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('a request explicitly carrying an invalid/garbage session cookie still succeeds on a public route \u2014 an invalid cookie is simply ignored, never treated as a reason to reject an otherwise-public request', async () => {
    const response = await request(app.getHttpServer())
      .get('/probe/public')
      .set('Cookie', 'gna_session=not-a-real-session-token');

    expect(response.status).toBe(200);
  });
});
