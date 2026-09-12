import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { PrismaService } from '../database/prisma.service';

/**
 * Milestone #34: exempt from rate limiting — infrastructure liveness/
 * readiness checks must never be throttled. Uses the named-throttler
 * form (@SkipThrottle({ default: true })) rather than the bare
 * @SkipThrottle(), since app.module.ts configures ThrottlerModule with
 * an explicitly named 'default' throttler (v5 named-throttler
 * semantics) — this targets that throttler by name rather than relying
 * on the no-argument "skip everything" shorthand.
 *
 * S1 CORRECTION — that decorator was CLASS-level, so it also exempted
 * /health/ready, which runs a real database query and therefore consumes a
 * connection-pool slot. A public endpoint that touches the database with no
 * limit at all is a pool-exhaustion lever. The exemption now sits on the
 * liveness method alone; readiness carries its own generous limit. See each
 * method below.
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
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liveness — deliberately makes NO database call, so a Postgres
   * outage never fails this check. An orchestrator restarting the
   * process based on this endpoint should only ever do so for a
   * genuinely wedged/crashed Node process, never for a downstream
   * dependency being temporarily unavailable.
   */
  // S1 — the exemption moved here from the class. Liveness makes no database
  // call and allocates nothing, so it is safe to leave genuinely unlimited,
  // and an orchestrator must never be throttled out of asking whether a
  // process is alive.
  @SkipThrottle({ default: true })
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
  /**
   * S1 — readiness no longer inherits the class-level SkipThrottle.
   *
   * The exemption used to sit on the CLASS, so it covered this route too — and
   * this route runs a real query and therefore takes one of the backend's
   * connection-pool slots (see PrismaService). A public, completely
   * unthrottled endpoint that touches the database is a pool-exhaustion lever
   * that needs no credential and no cleverness.
   *
   * 60/60s is chosen to be far above any real prober and far below a flood: a
   * 10-second probe interval uses 6 of it, a 5-second interval 12, and even a
   * one-second interval fits. Orchestrator probing is unaffected in every
   * realistic configuration, which is what makes this safe to apply rather
   * than a risk to availability.
   *
   * It remains a per-tracker limit, so it is only a per-prober control once
   * TRUST_PROXY describes the real topology — the same precondition every
   * other limit in this application carries. Restricting /health/ready to the
   * orchestrator's own network at the edge remains the stronger control and is
   * documented in .env.example.
   */
  @Throttle({ default: { limit: 60, ttl: 60000 } })
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
