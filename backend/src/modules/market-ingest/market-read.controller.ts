import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { MarketReadRepository } from './market-read.repository';

class MarketReadQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(250)
  limit?: number;
}

/**
 * PUBLIC RETAINED-DATA READER. No provider and no scheduler is reachable from
 * this controller; it exposes only observations already retained in Prisma.
 */
@Controller('market')
export class MarketReadController {
  constructor(private readonly repository: MarketReadRepository) {}

  @Get('observations')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  observations(@Query() query: MarketReadQuery) {
    return this.repository.latest(query.limit);
  }

  @Get('procurement')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  procurement(@Query() query: MarketReadQuery) {
    return this.repository.procurement(query.limit ?? 25);
  }
}
