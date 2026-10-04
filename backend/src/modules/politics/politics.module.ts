import { BadRequestException, Controller, Get, Injectable, Module, Query } from '@nestjs/common';
import type { PoliticsReadResponse } from '@globalnews-ai/shared';
import { PoliticsObservationRepository } from './politics-observation.repository';

/**
 * POLITICS INTEL R1 — the Politics surface reads the SAME retained store shared retrieval reads
 * (no dashboard-only authority). Evidence enters only through `PoliticsObservationRepository.append`;
 * there is no static ledger and no public write route.
 */
@Injectable()
export class PoliticsReadService {
  constructor(private readonly repository: PoliticsObservationRepository) {}

  async read(subjectId?: string, limit = 50): Promise<PoliticsReadResponse> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 || (subjectId !== undefined && (typeof subjectId !== 'string' || !subjectId.trim() || subjectId.length > 200))) {
      throw new BadRequestException('Invalid Politics read bounds');
    }
    try {
      const [rows, inventory] = await Promise.all([
        this.repository.current(subjectId === undefined ? {} : { subjectId }, limit + 1),
        this.repository.inventory(),
      ]);
      return {
        observations: rows.slice(0, limit), truncated: rows.length > limit,
        absence: rows.length ? null : inventory.withheld ? 'EVIDENCE_WITHHELD' : 'NOT_ASSESSED',
        acquisition: 'RETAINED_ONLY',
        coverage: { checkedCaptures: inventory.identities, admittedObservations: inventory.admitted, withheld: inventory.withheld },
      };
    } catch {
      // An unreadable store is NOT_ASSESSED: never "nothing happened", never a reader-visible 500.
      return { observations: [], truncated: false, absence: 'NOT_ASSESSED', acquisition: 'RETAINED_ONLY' };
    }
  }
}

@Controller('politics/observations')
export class PoliticsReadController {
  constructor(private readonly service: PoliticsReadService) {}

  @Get()
  read(@Query('subjectId') subjectId?: string, @Query('limit') limit?: string): Promise<PoliticsReadResponse> {
    if (limit !== undefined && (typeof limit !== 'string' || !/^\d{1,3}$/.test(limit))) throw new BadRequestException('Invalid limit');
    return this.service.read(subjectId, limit === undefined ? 50 : Number(limit));
  }
}

/** No transport, provider, Watch or scheduler dependencies. Database: the retained store only. */
@Module({
  controllers: [PoliticsReadController],
  providers: [PoliticsReadService, PoliticsObservationRepository],
  exports: [PoliticsObservationRepository],
})
export class PoliticsReadModule {}
