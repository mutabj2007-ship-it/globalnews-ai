import type { PrismaService } from '../../database/prisma.service';
import { inspectMarketCapture } from './market-retained-capture';

/** Internal offline backfill only. Not registered in any HTTP or scheduler module. */
export class MarketRetainedProducer {
  constructor(
    private readonly db: PrismaService,
    private readonly approvedRetrievalIds: readonly string[] = [],
  ) {}

  async admit(retrievalId: string, authorisedBy: string): Promise<number> {
    if (!this.approvedRetrievalIds.includes(retrievalId) || !authorisedBy.trim()) {
      throw new Error('Retained Market backfill requires an explicit capture approval and author');
    }
    return this.db.$transaction(
      async (tx) => {
        const capture = await tx.snapshotRetrieval.findUnique({
          where: { retrievalId },
          include: { payload: true },
        });
        if (!capture) throw new Error('Approved capture not retained');
        const inspected = inspectMarketCapture(capture);
        const now = new Date();
        const runKey = `market-retained:${retrievalId}`;
        const previous = await tx.marketIngestRun.findUnique({ where: { runKey } });
        if (previous) return 0;
        const run = await tx.marketIngestRun.create({
          data: {
            runKey,
            providerId: capture.providerId,
            subjectClass: inspected.subjectClass,
            cadenceWindow: retrievalId,
            triggerKind: 'BACKFILL',
            authorisedBy,
            startedAt: now,
          },
        });
        let written = 0;
        for (const draft of inspected.observations) {
          const publisherChangedAt = new Date(draft.publisherChangedAt!);
          const identity = {
            observationKey: draft.observationKey,
            vintageProvenance: draft.vintageProvenance,
            publisherChangedAt,
          };
          const existing = await tx.marketObservation.findUnique({
            where: { observationKey_vintageProvenance_publisherChangedAt: identity },
          });
          if (existing) {
            if (
              existing.releaseStatus !== draft.releaseStatus ||
              existing.value !== draft.value ||
              existing.unit !== draft.unit ||
              existing.providerId !== capture.providerId
            ) {
              throw new Error('Conflicting value for an existing publisher revision');
            }
            continue;
          }
          const row = await tx.marketObservation.create({
            data: {
              ...draft,
              publisherChangedAt,
              publisherVintage: null,
              providerId: capture.providerId,
              subjectClass: inspected.subjectClass,
              snapshotRetrievalId: retrievalId,
              snapshotAdmissibility: 'ADMITTED',
              snapshotContentAddress: capture.contentAddress,
              runId: run.id,
              ingestedAt: now,
            },
          });
          await tx.snapshotPin.upsert({
            where: {
              contentAddress_citedBy: {
                contentAddress: capture.contentAddress!,
                citedBy: row.observationKey,
              },
            },
            create: {
              contentAddress: capture.contentAddress!,
              citedBy: row.observationKey,
              pinnedAt: now,
            },
            update: { releasedAt: null },
          });
          written += 1;
        }
        await tx.marketIngestRun.update({
          where: { id: run.id },
          data: {
            outcome: written ? 'SUCCEEDED' : 'NO_NEW_DATA',
            finishedAt: now,
            observationsWritten: written,
          },
        });
        return written;
      },
      { isolationLevel: 'Serializable' },
    );
  }
}
