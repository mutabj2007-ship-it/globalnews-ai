import { BadRequestException, Controller, Get, Injectable, Module, Query } from '@nestjs/common';
import type { PoliticsReadResponse } from '@globalnews-ai/shared';
import { producePoliticsLedger } from './politics.producer';
import { POLITICS_RETAINED_CAPTURES } from './politics.retained';

@Injectable()
export class PoliticsReadService {
  private readonly ledger = producePoliticsLedger(POLITICS_RETAINED_CAPTURES);

  read(subjectId?: string, limit = 50): PoliticsReadResponse {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 || (subjectId !== undefined && (typeof subjectId !== 'string' || !subjectId.trim() || subjectId.length > 200))) {
      throw new BadRequestException('Invalid Politics read bounds');
    }
    const rows = this.ledger.observations.filter(o => subjectId === undefined || o.subjectId === subjectId);
    return {
      observations: rows.slice(0, limit), truncated: rows.length > limit,
      absence: rows.length ? null : this.ledger.withheld ? 'EVIDENCE_WITHHELD' : 'NOT_ASSESSED',
      acquisition: 'RETAINED_ONLY',
    };
  }
}

@Controller('politics/observations')
export class PoliticsReadController {
  constructor(private readonly service: PoliticsReadService) {}

  @Get()
  read(@Query('subjectId') subjectId?: string, @Query('limit') limit?: string): PoliticsReadResponse {
    if (limit !== undefined && (typeof limit !== 'string' || !/^\d{1,3}$/.test(limit))) throw new BadRequestException('Invalid limit');
    return this.service.read(subjectId, limit === undefined ? 50 : Number(limit));
  }
}

/** No transport, provider, database, Watch or scheduler dependencies. */
@Module({ controllers: [PoliticsReadController], providers: [PoliticsReadService] })
export class PoliticsReadModule {}
