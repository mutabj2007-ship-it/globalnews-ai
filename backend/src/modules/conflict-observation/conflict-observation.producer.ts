import {
  decodeRetainedConflictRow,
  validateConflictObservation,
} from './conflict-observation.validation';
import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { assertRevisionAppends, type ConflictRevision } from '@globalnews-ai/shared';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import {
  ConflictAdmissionRefused,
  MAX_CONFLICT_CAPTURE_BYTES,
  normalizeUcdpGed,
  type ReviewedUcdpCapture,
} from './ucdp-ged.normalizer';
import {
  MAX_UCDP_CANDIDATE_CSV_BYTES,
  normalizeUcdpCandidateCsv,
  type ReviewedUcdpCandidateCsvCapture,
} from './ucdp-candidate-csv.normalizer';
import { UCDP_CANDIDATE_RIGHTS } from './ucdp-candidate.reviewed';

export const REVIEWED_UCDP_CAPTURES = Symbol('REVIEWED_UCDP_CAPTURES');
export const CONFLICT_ADMISSION_TRANSACTION_TIMEOUT_MS = 120_000;

/** Internal DI service only. No controller, timer, downloader, or boot-time work. */
@Injectable()
export class ConflictObservationProducer {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REVIEWED_UCDP_CAPTURES)
    private readonly reviewed: readonly (ReviewedUcdpCapture | ReviewedUcdpCandidateCsvCapture)[],
  ) {}

  async admitRetained(retrievalId: string, runId: string) {
    if (
      typeof retrievalId !== 'string' ||
      !retrievalId.trim() ||
      retrievalId.length > 256 ||
      typeof runId !== 'string' ||
      !runId.trim() ||
      runId.length > 256
    ) {
      throw new ConflictAdmissionRefused('INVALID_ADMISSION_ID');
    }
    // All validation and writes are one serializable transaction. A conflict fails closed;
    // the internal caller can retry the same retained retrieval, with no provider request.
    return this.prisma.$transaction(
      async (tx) => {
        const capture = await tx.snapshotRetrieval.findUnique({
          where: { retrievalId },
          include: { payload: true },
        });
        if (
          !capture ||
          capture.providerId !== 'UCDP_GED' ||
          capture.admissibility !== 'ADMITTED' ||
          capture.completeness !== 'COMPLETE' ||
          capture.refusalKey !== null ||
          capture.httpStatus !== 200 ||
          !capture.payloadRetentionPermitted ||
          capture.rightsGrade !== UCDP_CANDIDATE_RIGHTS.rightsGrade ||
          !capture.rightsInstrumentRef?.trim() ||
          capture.parserVersion !== '1' ||
          !capture.parsedAt ||
          !(
            (capture.parserId === 'ucdp-ged-json' &&
              capture.mediaType.split(';')[0].trim().toLowerCase() === 'application/json') ||
            (capture.parserId === 'ucdp-candidate-csv' &&
              capture.mediaType.split(';')[0].trim().toLowerCase() === 'text/csv')
          ) ||
          capture.payload?.storageState !== 'RETAINED' ||
          !capture.payload.bytes
        ) {
          throw new ConflictAdmissionRefused('CAPTURE_NOT_ADMITTED_OR_RETAINED');
        }
        const bytes = capture.payload.bytes;
        if (
          bytes.byteLength >
            (capture.parserId === 'ucdp-candidate-csv'
              ? MAX_UCDP_CANDIDATE_CSV_BYTES
              : MAX_CONFLICT_CAPTURE_BYTES) ||
          bytes.byteLength !== capture.byteLength ||
          bytes.byteLength !== capture.payload.byteLength ||
          capture.mediaType !== capture.payload.mediaType
        ) {
          throw new ConflictAdmissionRefused('CAPTURE_INTEGRITY_REFUSED');
        }
        const hash = createHash('sha256').update(bytes).digest('hex');
        if (hash !== capture.contentAddress || hash !== capture.payload.contentAddress) {
          throw new ConflictAdmissionRefused('CAPTURE_INTEGRITY_REFUSED');
        }
        const profile = this.reviewed.find((entry) => entry.sha256 === hash);
        if (!profile) throw new ConflictAdmissionRefused('SCHEMA_NOT_CONFIRMED_BY_CAPTURE');
        const context = {
          retrievalId,
          runId,
          ingestedAt: new Date().toISOString(),
        };
        const observations =
          profile.schema === 'ucdp-candidate-csv-v1' && capture.parserId === 'ucdp-candidate-csv'
            ? normalizeUcdpCandidateCsv(
                bytes,
                profile as ReviewedUcdpCandidateCsvCapture,
                context,
              )
            : profile.schema === 'ucdp-ged-json-v1' && capture.parserId === 'ucdp-ged-json'
              ? normalizeUcdpGed(bytes, profile as ReviewedUcdpCapture, context)
              : (() => {
                  throw new ConflictAdmissionRefused('SCHEMA_NOT_CONFIRMED_BY_CAPTURE');
                })();
        const json = (value: unknown) => value as Prisma.InputJsonValue;
        const observationKeys = observations.map((observation) => observation.observationKey);

        /*
          One bounded read replaces the former N×(history + duplicate) queries.
          Ordering makes the first row for each key the latest revision, while
          every row remains available to detect a replay of this exact capture.
        */
        const retainedRows =
          observationKeys.length === 0
            ? []
            : await tx.conflictObservation.findMany({
                where: { observationKey: { in: observationKeys } },
                orderBy: [{ observationKey: 'asc' }, { revisionOrdinal: 'desc' }],
              });

        const latestByKey = new Map<string, (typeof retainedRows)[number]>();
        const replayedKeys = new Set<string>();
        for (const row of retainedRows) {
          if (row.captureHash === hash) replayedKeys.add(row.observationKey);
          if (!latestByKey.has(row.observationKey)) {
            decodeRetainedConflictRow(row);
            latestByKey.set(row.observationKey, row);
          }
        }

        let duplicates = 0;
        const pinRows: Prisma.SnapshotPinCreateManyInput[] = [];
        const observationRows: Prisma.ConflictObservationCreateManyInput[] = [];

        for (const observation of observations) {
          if (replayedKeys.has(observation.observationKey)) {
            duplicates++;
            continue;
          }

          const prior = latestByKey.get(observation.observationKey);
          const revision: ConflictRevision = prior
            ? {
                ...observation.revision,
                revisionOrdinal: prior.revisionOrdinal + 1,
                supersedesRevisionOrdinal: prior.revisionOrdinal,
                revisionKind: 'SOURCE_REVISION',
              }
            : observation.revision;

          if (prior) {
            if (
              !prior.captureRetrievedAt ||
              capture.retrievedAt.getTime() <= prior.captureRetrievedAt.getTime()
            ) {
              throw new ConflictAdmissionRefused('STALE_OR_UNORDERED_CAPTURE');
            }
            assertRevisionAppends(prior.revision as unknown as ConflictRevision, revision);
          }

          validateConflictObservation({ ...observation, revision });
          const citedBy = `${observation.observationKey}:revision:${revision.revisionOrdinal}`;

          pinRows.push({
            id: randomUUID(),
            contentAddress: hash,
            citedBy,
            pinnedAt: new Date(observation.temporal.ingestedAt),
          });

          observationRows.push({
            id: randomUUID(),
            observationKey: observation.observationKey,
            authority: observation.identity.authority,
            upstreamEventId: observation.identity.upstreamEventId,
            eventType: observation.eventType,
            owner: observation.owner,
            actors: json(observation.actors),
            geography: json(observation.geography),
            temporal: json(observation.temporal),
            severity: json(observation.severity),
            sourceReference: json(observation.sourceReference),
            acquisition: json(observation.acquisition),
            revision: json(revision),
            revisionOrdinal: revision.revisionOrdinal,
            occurredOn: new Date(observation.temporal.eventStartedAt),
            ingestedAt: new Date(observation.temporal.ingestedAt),
            countryIso3: observation.geography.countryIso3 ?? null,
            snapshotRetrievalId: retrievalId,
            snapshotAdmissibility: 'ADMITTED',
            captureHash: hash,
            captureRetrievedAt: capture.retrievedAt,
          });
        }

        if (pinRows.length > 0) {
          /*
            A released historical pin for the same citation is reactivated just
            as the former per-row upsert did, but with one bounded update.
          */
          await tx.snapshotPin.updateMany({
            where: {
              contentAddress: hash,
              citedBy: { in: pinRows.map((row) => row.citedBy) },
              releasedAt: { not: null },
            },
            data: { releasedAt: null },
          });
          await tx.snapshotPin.createMany({ data: pinRows, skipDuplicates: true });
        }

        if (observationRows.length > 0) {
          /*
            No skipDuplicates here. A uniqueness collision that was not present
            in the single prefetch is a concurrent-write conflict and must fail
            the serializable transaction rather than be silently swallowed.
          */
          await tx.conflictObservation.createMany({ data: observationRows });
        }

        return { inserted: observationRows.length, duplicates };
      },
      {
        isolationLevel: 'Serializable',
        // The governed Candidate capture is bounded to <=500 admitted rows.
        // History/dedup are prefetched once and pins/observations are written in
        // bounded batches, but the ceiling stays explicit so a stalled database
        // cannot hold a serializable transaction indefinitely.
        timeout: CONFLICT_ADMISSION_TRANSACTION_TIMEOUT_MS,
      },
    );
  }
}
