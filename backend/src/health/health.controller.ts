import { Controller, Get } from '@nestjs/common';

/**
 * Basic liveness endpoint used by Docker healthchecks, load balancers,
 * and CI smoke tests. This is infrastructure plumbing, not a product
 * feature, and belongs in the project foundation.
 */
@Controller('health')
export class HealthController {
  @Get()
  check(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
