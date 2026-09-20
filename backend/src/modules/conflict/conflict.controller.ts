import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { ConflictReadResult } from '@globalnews-ai/shared';

import { ConflictRetainedReadService } from './conflict-retained.read';

@Controller('conflict')
export class ConflictController {
  constructor(private readonly reads: ConflictRetainedReadService) {}

  @Get('events')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async events(
    @Query('country') country?: string,
    @Query('days') daysRaw?: string,
    @Query('limit') limitRaw?: string,
  ): Promise<ConflictReadResult> {
    const days = parseOptionalPositiveInteger(daysRaw, 'days', 3660);
    const limit = parseOptionalPositiveInteger(limitRaw, 'limit', 1000);

    return this.reads.read({
      ...(country?.trim() ? { countryIso3: country.trim() } : {}),
      ...(days !== undefined ? { days } : {}),
      ...(limit !== undefined ? { limit } : {}),
    });
  }
}

function parseOptionalPositiveInteger(raw: string | undefined, field: string, max: number): number | undefined {
  if (raw === undefined || raw.trim() === '') return undefined;
  if (!/^\d+$/.test(raw.trim())) throw new BadRequestException(`${field} must be a positive integer`);
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > max) {
    throw new BadRequestException(`${field} must be between 1 and ${max}`);
  }
  return value;
}