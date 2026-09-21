import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * READ-ONLY CONFLICT PORT.
 *
 * No provider, downloader or scheduler is reachable here. Until an approved
 * producer writes retained rows, this returns an honest empty collection.
 */
@Injectable()
export interface RetainedConflictObservationRow {
  readonly observationKey: string;
  readonly providerId: string;
  readonly providerEventId: string;
  readonly occurredOn: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly countryIso3: string | null;
  readonly placeLabel: string | null;
  readonly sourceUrl: string | null;
  readonly sourceName: string | null;
  readonly ingestedAt: string;
}

/**
 * STORAGE SHAPE IS NOT THE CANONICAL CONFLICT OBSERVATION.
 *
 * shared/src/conflict/observation.ts already owns the accepted canonical
 * ConflictObservation contract, including geography, temporal provenance,
 * ownership, severity state, acquisition provenance and revision semantics.
 * This repository returns a deliberately named retained-row DTO until a
 * governed adapter can prove every canonical field. It must never masquerade
 * a thin database row as that canonical type.
 */
export class ConflictObservationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async latest(limit = 250): Promise<readonly RetainedConflictObservationRow[]> {
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
