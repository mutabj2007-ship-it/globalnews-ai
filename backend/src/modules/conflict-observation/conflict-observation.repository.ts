import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { ConflictObservation as RetainedRow } from '../../generated/prisma/client';
import type {
  ConflictObservation,
  ConflictRetainedEvidenceDetail,
} from '@globalnews-ai/shared';
import { extractUcdpCandidateEvidenceDetail } from './ucdp-candidate-csv.normalizer';
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


  async evidenceDetail(observationKey: string): Promise<ConflictRetainedEvidenceDetail | null> {
    const row = await this.prisma.conflictObservation.findFirst({
      where: { observationKey },
      orderBy: { revisionOrdinal: 'desc' },
      select: {
        observationKey: true,
        authority: true,
        upstreamEventId: true,
        snapshotRetrievalId: true,
        snapshotAdmissibility: true,
      },
    });

    if (
      !row ||
      row.authority !== 'UCDP_GED' ||
      !row.snapshotRetrievalId ||
      row.snapshotAdmissibility !== 'ADMITTED'
    ) {
      return null;
    }

    const capture = await this.prisma.snapshotRetrieval.findUnique({
      where: { retrievalId: row.snapshotRetrievalId },
      select: {
        retrievalId: true,
        providerId: true,
        admissibility: true,
        completeness: true,
        refusalKey: true,
        parserId: true,
        parserVersion: true,
        mediaType: true,
        contentAddress: true,
        payload: {
          select: {
            storageState: true,
            bytes: true,
            contentAddress: true,
          },
        },
      },
    });

    if (
      !capture ||
      capture.providerId !== 'UCDP_GED' ||
      capture.admissibility !== 'ADMITTED' ||
      capture.completeness !== 'COMPLETE' ||
      capture.refusalKey !== null ||
      capture.parserId !== 'ucdp-candidate-csv' ||
      capture.parserVersion !== '1' ||
      capture.mediaType.split(';')[0].trim().toLowerCase() !== 'text/csv' ||
      !capture.contentAddress ||
      capture.payload?.storageState !== 'RETAINED' ||
      !capture.payload.bytes ||
      capture.payload.contentAddress !== capture.contentAddress
    ) {
      return null;
    }

    try {
      return extractUcdpCandidateEvidenceDetail(capture.payload.bytes, {
        observationKey: row.observationKey,
        upstreamEventId: row.upstreamEventId,
        retrievalId: capture.retrievalId,
        contentAddress: capture.contentAddress,
      });
    } catch {
      // Detail is supplementary. A malformed retained payload must not turn the
      // canonical observation read into an availability failure or cause a
      // reader-visible 500. The observation remains readable without detail.
      return null;
    }
  }

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
