import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ConflictObservationRepository } from './conflict-observation.repository';
import { toPublicConflictObservation, toPublicEvidenceDetail } from './conflict-public-reader';

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
 * CTO R150 / PD-1: every response leaves through the public reader shape (conflict-public-reader.ts), so the
 * recorded publisher citation, headline and source_original never reach a reader from here.
 */
@Controller('conflict')
export class ConflictObservationController {
  constructor(private readonly repository: ConflictObservationRepository) {}

  @Get('observations')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async observations(@Query() query: ConflictObservationQuery) {
    return (await this.repository.latest(query.limit ?? 250)).map(toPublicConflictObservation);
  }

  @Get('observations/:observationKey/evidence')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async evidence(@Param('observationKey') observationKey: string) {
    if (!observationKey || observationKey.length > 512) {
      throw new BadRequestException('INVALID_OBSERVATION_KEY');
    }
    const detail = await this.repository.evidenceDetail(observationKey);
    return detail === null ? null : toPublicEvidenceDetail(detail);
  }
}
