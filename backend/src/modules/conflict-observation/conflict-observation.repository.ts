import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { ConflictObservation } from '@globalnews-ai/shared';

/**
 * READ-ONLY CONFLICT PORT.
 *
 * No provider, downloader or scheduler is reachable here. Until an approved
 * producer writes retained rows, this returns an honest empty collection.
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
      providerId: row.providerId,
      providerEventId: row.providerEventId,
      occurredOn: row.occurredOn.toISOString().slice(0, 10),
      latitude: row.latitude,
      longitude: row.longitude,
      countryIso3: row.countryIso3,
      placeLabel: row.placeLabel,
      sourceUrl: row.sourceUrl,
      sourceName: row.sourceName,
      ingestedAt: row.ingestedAt.toISOString(),
    }));
  }
}
