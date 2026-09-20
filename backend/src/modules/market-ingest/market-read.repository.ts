import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * READ-ONLY MARKET OBSERVATION PORT.
 *
 * This is deliberately separate from the ingest repository: reader traffic must
 * never acquire a lease, run a provider, mutate an observation or know an
 * acquisition URL. It reads only observations already retained by the platform.
 */
export interface MarketReadObservation {
  readonly observationKey: string;
  readonly seriesId: string;
  readonly periodId: string;
  readonly value: number | null;
  readonly unit: string;
  readonly publisherVintage: string | null;
  readonly publisherChangedAt: string | null;
  readonly vintageProvenance: string;
  readonly releaseStatus: string;
  readonly provider: string;
  readonly sourceClass: string;
}

@Injectable()
export class MarketReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async latest(limit = 100): Promise<readonly MarketReadObservation[]> {
    const bounded = Math.max(1, Math.min(Math.trunc(limit), 250));
    const rows = await this.prisma.marketObservation.findMany({
      take: bounded,
      orderBy: { ingestedAt: 'desc' },
      select: {
        observationKey: true,
        seriesId: true,
        periodId: true,
        value: true,
        unit: true,
        publisherVintage: true,
        publisherChangedAt: true,
        vintageProvenance: true,
        releaseStatus: true,
        providerId: true,
        subjectClass: true,
      },
    });

    return rows.map((row) => ({
      observationKey: row.observationKey,
      seriesId: row.seriesId,
      periodId: row.periodId,
      value: row.value,
      unit: row.unit,
      publisherVintage: row.publisherVintage?.toISOString() ?? null,
      publisherChangedAt: row.publisherChangedAt?.toISOString() ?? null,
      vintageProvenance: row.vintageProvenance,
      releaseStatus: row.releaseStatus,
      provider: row.providerId,
      sourceClass: row.subjectClass,
    }));
  }
}
