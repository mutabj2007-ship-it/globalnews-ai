import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../database/prisma.service';

/**
 * Milestone #34: exempt from rate limiting — infrastructure liveness/
 * readiness checks must never be throttled. Uses the named-throttler
 * form (@SkipThrottle({ default: true })) rather than the bare
 * @SkipThrottle(), since app.module.ts configures ThrottlerModule with
 * an explicitly named 'default' throttler (v5 named-throttler
 * semantics) — this targets that throttler by name rather than relying
 * on the no-argument "skip everything" shorthand.
 */
@Controller('health')
@SkipThrottle({ default: true })
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<{
    status: string;
    timestamp: string;
    database: string;
  }> {
    await this.prisma.$queryRaw`SELECT 1`;

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'ok',
    };
  }
}
