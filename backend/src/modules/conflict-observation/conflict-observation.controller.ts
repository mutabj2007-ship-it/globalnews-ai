import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ConflictObservationRepository } from './conflict-observation.repository';

class ConflictObservationQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

/**
 * Retained-data reader only. It cannot activate UCDP or any other producer.
 */
@Controller('conflict')
export class ConflictObservationController {
  constructor(private readonly repository: ConflictObservationRepository) {}

  @Get('observations')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  observations(@Query() query: ConflictObservationQuery) {
    return this.repository.latest(query.limit ?? 250);
  }

  @Get('observations/:observationKey/evidence')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  evidence(@Param('observationKey') observationKey: string) {
    if (!observationKey || observationKey.length > 512) {
      throw new BadRequestException('INVALID_OBSERVATION_KEY');
    }
    return this.repository.evidenceDetail(observationKey);
  }
}
