import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../database/prisma.service';

/**
 * Milestone #34: exempt from rate limiting — infrastructure liveness/
 * readiness checks must never be throttled. Uses the named-throttler
 * form (@SkipThrottle({ default: true })) rather than the bare
 * @SkipThrottle(), since app.module.ts configures ThrottlerModule with
 * an explicitly named 'default' throttler (v5 named-throttler
 * semantics) — this targets that throttler by name rather than relying
 * on the no-argument "skip everything" shorthand. Applies to both
 * routes below (class-level decorator).
 *
 * Milestone #54 — split into two distinct checks. The original single
 * GET /health always ran a real database query, so any Postgres
 * outage made the WHOLE process look dead to an orchestrator —
 * including to a liveness probe, which would then restart a perfectly
 * healthy Node process for a problem restarting it can't fix. Now:
 *
 * - GET /health (liveness): is this process up at all? No database
 *   dependency, ever.
 * - GET /health/ready (readiness): is this process ready to serve
 *   real traffic (i.e., is the database reachable)? This is where the
 *   real connectivity check belongs.
 */
@Controller('health')
@SkipThrottle({ default: true })
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liveness — deliberately makes NO database call, so a Postgres
   * outage never fails this check. An orchestrator restarting the
   * process based on this endpoint should only ever do so for a
   * genuinely wedged/crashed Node process, never for a downstream
   * dependency being temporarily unavailable.
   */
  @Get()
  check(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness — runs the same lightweight connectivity check
   * (`SELECT 1`) the old single /health endpoint used to run
   * unconditionally, but now properly wrapped: a reachable database
   * returns 200 with a structured "ok" body; an unreachable one
   * returns a structured "unavailable" body with a 503 via
   * ServiceUnavailableException, never an unhandled exception. The
   * caught error is deliberately never included in the response (no
   * error.message, no stack, no connection details) — only the fact
   * that the database is unavailable is ever surfaced.
   */
  @Get('ready')
  async ready(): Promise<{ status: string; timestamp: string; database: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'ok',
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'unavailable',
        timestamp: new Date().toISOString(),
        database: 'unavailable',
      });
    }
  }
}
