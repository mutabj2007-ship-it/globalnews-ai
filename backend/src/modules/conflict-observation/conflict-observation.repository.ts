import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type {
  ConflictObservation,
  ConflictActorRef,
  ConflictGeography,
  ConflictTemporal,
  ConflictSeverityState,
  ConflictSourceReference,
  ConflictAcquisitionProvenance,
  ConflictRevision,
  ConflictEventType,
  ConflictEventOwner,
  ConflictUpstreamAuthority,
} from '@globalnews-ai/shared';

/**
 * READ-ONLY CONFLICT PORT.
 *
 * No provider, downloader or scheduler is reachable here. Until an approved
 * producer writes canonical retained rows, this returns an honest empty array.
 *
 * The database duplicates authority/event id/time/country only as index columns.
 * The accepted complex axes are read from their canonical JSON fields and are
 * never reconstructed from those indexes.
 */
@Injectable()
export class ConflictObservationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async latest(limit = 250): Promise<readonly ConflictObservation[]> {
    const bounded = Math.max(1, Math.min(Math.trunc(limit), 500));
    const rows = await this.prisma.conflictObservation.findMany({
      take: bounded,
      orderBy: [{ occurredOn: 'desc' }, { ingestedAt: 'desc' }],
    });

    return rows.map((row) => ({
      observationKey: row.observationKey,
      identity: {
        authority: row.authority as ConflictUpstreamAuthority,
        upstreamEventId: row.upstreamEventId,
      },
      eventType: row.eventType as ConflictEventType,
      owner: row.owner as ConflictEventOwner,
      actors: row.actors as unknown as readonly ConflictActorRef[],
      geography: row.geography as unknown as ConflictGeography,
      temporal: row.temporal as unknown as ConflictTemporal,
      severity: row.severity as unknown as ConflictSeverityState,
      sourceReference: row.sourceReference as unknown as ConflictSourceReference,
      acquisition: row.acquisition as unknown as ConflictAcquisitionProvenance,
      revision: row.revision as unknown as ConflictRevision,
    }));
  }
}
