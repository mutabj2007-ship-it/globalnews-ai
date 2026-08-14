import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import type { PrismaService } from '../database/prisma.service';

/**
 * Milestone #54 — regression coverage for the liveness/readiness
 * split. Real defect this protects against: the original single
 * GET /health always executed a real database query, so a Postgres
 * outage made a perfectly healthy Node process look dead to any
 * orchestrator watching that one endpoint.
 */
describe('HealthController', () => {
  function makePrismaService(queryRawImpl: () => Promise<unknown>): PrismaService {
    return {
      $queryRaw: queryRawImpl,
    } as unknown as PrismaService;
  }

  describe('GET /health (liveness)', () => {
    it('never calls the database — a live process reports healthy regardless of Postgres state', async () => {
      const queryRaw = jest.fn().mockRejectedValue(new Error('should never be called'));
      const controller = new HealthController(makePrismaService(queryRaw));

      const result = controller.check();

      expect(queryRaw).not.toHaveBeenCalled();
      expect(result.status).toBe('ok');
      expect(typeof result.timestamp).toBe('string');
      expect(() => new Date(result.timestamp).toISOString()).not.toThrow();
    });

    it('response shape has no database field — liveness never claims anything about a downstream dependency', () => {
      const controller = new HealthController(makePrismaService(jest.fn()));

      const result = controller.check();

      expect(result).not.toHaveProperty('database');
    });
  });

  describe('GET /health/ready (readiness)', () => {
    it('returns a structured 200-shaped ok response when the database is reachable', async () => {
      const queryRaw = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
      const controller = new HealthController(makePrismaService(queryRaw));

      const result = await controller.ready();

      expect(queryRaw).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        status: 'ok',
        timestamp: expect.any(String),
        database: 'ok',
      });
    });

    it('throws ServiceUnavailableException (503) with a structured unhealthy body when the database is unreachable', async () => {
      const queryRaw = jest.fn().mockRejectedValue(new Error('connection refused'));
      const controller = new HealthController(makePrismaService(queryRaw));

      await expect(controller.ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('the unhealthy response body is a clean, structured shape — never the raw caught error, message, or stack', async () => {
      const sensitiveError = new Error(
        'password authentication failed for user "globalnews_ai_user" at postgresql://globalnews_ai_user:REAL_SECRET@prod-db-host:5432/globalnews_ai',
      );
      const queryRaw = jest.fn().mockRejectedValue(sensitiveError);
      const controller = new HealthController(makePrismaService(queryRaw));

      try {
        await controller.ready();
        fail('expected controller.ready() to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceUnavailableException);
        const response = (error as ServiceUnavailableException).getResponse();
        const responseText = JSON.stringify(response);

        expect(response).toEqual({
          status: 'unavailable',
          timestamp: expect.any(String),
          database: 'unavailable',
        });
        // The exact assertion this test exists for: none of the
        // caught error's own text (which could contain a password,
        // hostname, or stack trace) ever reaches the response body.
        expect(responseText).not.toContain('REAL_SECRET');
        expect(responseText).not.toContain('password authentication failed');
        expect(responseText).not.toContain('prod-db-host');
      }
    });

    it('the ServiceUnavailableException carries HTTP status 503', async () => {
      const queryRaw = jest.fn().mockRejectedValue(new Error('timeout'));
      const controller = new HealthController(makePrismaService(queryRaw));

      try {
        await controller.ready();
        fail('expected controller.ready() to throw');
      } catch (error) {
        expect((error as ServiceUnavailableException).getStatus()).toBe(503);
      }
    });
  });
});
