import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { ConflictObservation as RetainedRow } from '../../generated/prisma/client';
import type { ConflictObservation } from '@globalnews-ai/shared';
import { decodeRetainedConflictRow } from './conflict-observation.validation';

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
    const bounded = Number.isFinite(limit) ? Math.max(1, Math.min(Math.trunc(limit), 500)) : 250;
    // Select the current revision BEFORE sorting/limiting. A corrected event date must
    // not resurrect its older revision. Historical evidence remains in the table.
    const rows = await this.prisma.$queryRaw<RetainedRow[]>`
      SELECT * FROM (
        SELECT DISTINCT ON ("observationKey") * FROM "ConflictObservation"
        ORDER BY "observationKey", "revisionOrdinal" DESC
      ) AS current_observations
      ORDER BY "occurredOn" DESC, "ingestedAt" DESC, "observationKey" ASC
      LIMIT ${bounded}
    `;

    return rows.map(decodeRetainedConflictRow);
  }
}
