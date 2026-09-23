import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { inspectMarketCapture, InvalidMarketCapture } from './market-retained-capture';

export interface MarketReadObservation {
  readonly context: {
    reporterLabel?: string; partnerLabel?: string; productLabel?: string; flowLabel?: string; indicatorsLabel?: string;
    reporter: string;
    partner: string;
    product: string;
    flow: string;
    indicators: string;
    freq: string;
  };
  readonly retainedAt: string;
  readonly retrievalId: string;
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
  readonly retentionIsFinal: false;
  /** Offline retained evidence does not establish the provider's current edition. */
  readonly freshnessBasis: 'RETAINED_ONLY';
}

/** Read-only: no provider, scheduler, activation gate or backfill is reachable here. */
@Injectable()
export class MarketReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async latest(limit?: number): Promise<readonly MarketReadObservation[]> {
    const bounded =
      limit === undefined
        ? Infinity
        : Number.isFinite(limit)
          ? Math.max(1, Math.min(Math.trunc(limit), 250))
          : 100;
    const result: MarketReadObservation[] = [];
    const seen = new Set<string>();
    let offset = 0;
    while (result.length < bounded) {
      const rows = await this.prisma.marketObservation.findMany({
        take: 250,
        skip: offset,
        orderBy: [{ publisherChangedAt: 'desc' }, { ingestedAt: 'desc' }, { id: 'asc' }],
        include: { run: true, snapshotRetrieval: { include: { payload: true } } },
      });
      for (const row of rows) {
        const identity = `${row.providerId}:${row.observationKey}`;
        // The latest retained revision suppresses older values even if it is withdrawn,
        // malformed, or no longer reproducible. Never resurrect a superseded figure.
        if (seen.has(identity)) continue;
        seen.add(identity);
        const capture = row.snapshotRetrieval;
        if (
          !capture ||
          row.providerId !== capture.providerId ||
          row.subjectClass !== 'CORRIDOR' ||
          row.run.providerId !== row.providerId ||
          row.run.subjectClass !== row.subjectClass ||
          row.run.outcome !== 'SUCCEEDED' ||
          row.snapshotAdmissibility !== 'ADMITTED' ||
          row.snapshotContentAddress !== capture.contentAddress ||
          row.ingestedAt < capture.retrievedAt
        )
          continue;
        try {
          const artifact = inspectMarketCapture(capture);
          const draft = artifact.observations.find((o) => o.observationKey === row.observationKey);
          if (
            !draft ||
            draft.seriesId !== row.seriesId ||
            draft.periodId !== row.periodId ||
            draft.value !== row.value ||
            draft.unit !== row.unit ||
            draft.publisherChangedAt !== row.publisherChangedAt?.toISOString() ||
            row.publisherVintage !== null ||
            row.vintageProvenance !== draft.vintageProvenance ||
            row.releaseStatus !== draft.releaseStatus
          )
            continue;
          result.push({
            ...draft,
            context: { ...artifact.geography, ...artifact.labels },
            retainedAt: capture.retrievedAt.toISOString(),
            retrievalId: capture.retrievalId,
            provider: row.providerId,
            sourceClass: artifact.sourceClass,
            retentionIsFinal: false,
            freshnessBasis: 'RETAINED_ONLY',
          });
          if (result.length === bounded) break;
        } catch (error) {
          if (!(error instanceof InvalidMarketCapture)) throw error;
        }
      }
      if (rows.length < 250) break;
      offset += rows.length;
    }
    return result;
  }
}
