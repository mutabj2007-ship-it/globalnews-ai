import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  assertComparableDimensions,
  type CompletedAnalysisRecord,
  type SituationIdentity,
  type SituationObservation,
  type SituationSnapshotState,
} from './situation.contract';
import {
  MAX_DISCRIMINATOR_LENGTH,
  MAX_PARTITION_KEY_LENGTH,
  assertStorableIdentityValue,
  type SituationAnchor,
} from './situation-identity.port';
import {
  asSituationPrismaPort,
  type SituationPrismaPort,
  type SituationRow,
  type SituationTransactionClient,
} from './situation.prisma-port';
import { deriveSnapshotState } from './situation.state';

/**
 * SITUATION MEMORY — S1-R2. THE REPOSITORY.
 *
 * THE ONLY WRITER of the five Situation tables. Every guarantee the store makes
 * — append-only history, all-or-nothing appends, honest timestamps, an
 * assign-once identity — is a property of this file, and each is only true
 * while this file remains the sole write path.
 *
 * WHAT R2 CHANGED HERE.
 *
 * S1 looked a situation up by its key and treated a hit as "the same
 * situation". Under G's ratified contract that is wrong: `sit:v1:RWA` is a
 * BUCKET holding every Rwandan situation, and a hit on it means only "same
 * partition". Identity is now the TRIPLE (partitionKey, keyVersion,
 * discriminator), and the caller supplies it — because deriving it means
 * deciding tier-2 attachment, and tier 2 is shadow-only.
 *
 * WHAT THIS FILE STILL DOES NOT DO, ON PURPOSE:
 *
 *   - it does not derive a partition key (G's, via the identity port);
 *   - it does not decide attachment (tier 2, shadow-only);
 *   - it does not bridge buckets (G's §7 partial-mention false split is an open
 *     M0 decision; a bridge changes what "one situation" means);
 *   - it does not schedule anything. There is no scheduler in this backend —
 *     @nestjs/schedule, bull and bullmq are absent, and there is no @Cron,
 *     @Interval or ScheduleModule anywhere in backend/src;
 *   - it does not write, read or widen `AnalysisRun`. AnalysisRun is telemetry:
 *     one row per analysis REQUEST, written only by telemetry.service.ts and
 *     read only by admin-analytics.service.ts.
 */
@Injectable()
export class SituationRepository {
  private readonly db: SituationPrismaPort;

  constructor(prisma: PrismaService) {
    this.db = asSituationPrismaPort(prisma);
  }

  /**
   * LOAD THE BUCKET — the only lookup G's write path performs.
   *
   * Returns the situations sharing this observation's partition AT THIS KEY
   * VERSION. The version is part of the filter and not an afterthought: G's
   * invariant 3 is that a v1 situation must never be matched against a v2 key,
   * and the way to honour that is to make the mismatch unreachable rather than
   * to remember to check.
   *
   * `take` bounds the anchor set. G's contract makes the comparison bounded by
   * construction (an observation is compared only against its own bucket); this
   * bounds it again by count, because a bucket like `sit:v1:USA` will not stay
   * small and an unbounded anchor scan would quietly become the whole history.
   */
  async loadBucketAnchors(
    partitionKey: string,
    keyVersion: string,
    take = 50,
  ): Promise<SituationAnchor[]> {
    const rows = await this.db.situation.findMany({
      where: { partitionKey, keyVersion },
      // Most recently analysed first: the anchors most likely to be the live
      // continuation of a running story.
      orderBy: [{ lastAnalysedAt: 'desc' }, { firstObservedAt: 'desc' }],
      take,
    });

    return rows.map((row) => ({
      situationId: row.id,
      discriminator: row.discriminator,
      anchorArticleUrl: row.seedArticleUrl,
      // The seed is the anchor this layer can offer without inventing history:
      // it is the one observation known to have opened the situation. A richer
      // anchor set is a tier-2 design question and belongs to G.
      anchorTitle: '',
      anchorObservedAt: row.seedObservedAt,
    }));
  }

  /**
   * RECORD ONE COMPLETED, REQUEST-TRIGGERED ANALYSIS AGAINST A RESOLVED IDENTITY.
   *
   * ALL OR NOTHING. The situation row, the snapshot, its clusters and their
   * members are written inside a single `$transaction`. A partial append is
   * worse than a failed one: a snapshot whose clusters are missing looks exactly
   * like a subject analysed and found to have no clustered coverage, and every
   * comparison against it afterwards would be wrong.
   *
   * APPEND-ONLY. No existing snapshot, cluster or member is ever updated or
   * deleted here — there is no update or delete call on those three models in
   * this file, and none should ever be added.
   *
   * ASSIGN-ONCE. On the create path the identity columns are written once. On
   * the update path they are not in the argument at all — see the narrow
   * `update` signature in situation.prisma-port.ts — and the database trigger
   * installed by the migration rejects any statement that changes them anyway.
   *
   * IN PHASE 1 NOTHING CALLS THIS, because nothing can resolve an identity.
   */
  async appendCompletedAnalysis(record: CompletedAnalysisRecord): Promise<AppendResult> {
    const identity = assertStorableIdentity(record.identity);
    assertComparableDimensions(record.dimensions);
    assertClusterInputsAreUsable(record);

    return this.db.$transaction(async (tx) => {
      const situation = await this.upsertSituation(tx, identity, record);

      // THE PREVIOUS SNAPSHOT IS READ BEFORE THE NEW ONE IS WRITTEN, inside the
      // same transaction. Read it afterwards and it might be the row just
      // written; read it outside and a concurrent append could land between the
      // read and the write, and the state would describe a comparison that
      // never happened.
      const previous = await tx.situationSnapshot.findFirst({
        where: { situationId: situation.id },
        orderBy: [{ analysedAt: 'desc' }, { createdAt: 'desc' }],
      });

      const state: SituationSnapshotState = deriveSnapshotState(
        previous === null
          ? null
          : { analysedAt: previous.analysedAt, dimensions: asDimensions(previous.dimensions) },
        { analysedAt: record.analysedAt, dimensions: record.dimensions },
      );

      const snapshot = await tx.situationSnapshot.create({
        data: {
          situationId: situation.id,
          analysedAt: record.analysedAt,
          state,
          dimensions: record.dimensions,
          // A POINTER, NOT A FOREIGN KEY. AnalysisRun is telemetry and subject
          // to retention rules this store has no say over. A real FK would mean
          // either that trimming telemetry cascades into deleting analysis
          // history, or that telemetry can never be trimmed.
          analysisRunId: record.analysisRunId ?? null,
        },
      });

      let clustersWritten = 0;
      let membersWritten = 0;

      for (const cluster of record.clusters) {
        const created = await tx.situationCluster.create({
          data: {
            snapshotId: snapshot.id,
            clusterKey: cluster.clusterKey,
            publisherCount: cluster.publisherCount,
            // The count of members ACTUALLY written on the next statement, not
            // a number supplied by the caller, so the two cannot disagree.
            memberCount: cluster.articleUrls.length,
          },
        });

        const { count } = await tx.situationClusterMember.createMany({
          data: cluster.articleUrls.map((articleUrl) => ({ clusterId: created.id, articleUrl })),
        });

        clustersWritten += 1;
        membersWritten += count;
      }

      return {
        situationId: situation.id,
        identity,
        snapshotId: snapshot.id,
        state,
        clustersWritten,
        membersWritten,
      };
    });
  }

  /**
   * RECORD THAT ARTICLES WERE RETRIEVED FOR A SITUATION, WITHOUT CLAIMING IT
   * WAS ANALYSED.
   *
   * The two timestamps are two columns precisely so this is expressible.
   * Retrieval touches `lastRetrievedAt` ONLY; `lastAnalysedAt` is not passed,
   * not defaulted and not touched. Collapsing them would make every retrieval
   * look like an analysis, and "not re-analysed since you last saw it" would
   * become unprovable.
   *
   * Unlike S1 this does NOT create a situation. Creating one means asserting a
   * new identity in a bucket, which is the tier-2 decision; a retrieval that
   * finds no situation records nothing and says so by returning null.
   */
  async recordRetrieval(identity: SituationIdentity, retrievedAt: Date): Promise<string | null> {
    const checked = assertStorableIdentity(identity);

    return this.db.$transaction(async (tx) => {
      const existing = await tx.situation.findUnique({
        where: {
          partitionKey_keyVersion_discriminator: {
            partitionKey: checked.partitionKey,
            keyVersion: checked.keyVersion,
            discriminator: checked.discriminator,
          },
        },
      });

      if (existing === null) {
        return null;
      }

      const updated = await tx.situation.update({
        where: { id: existing.id },
        data: { lastRetrievedAt: retrievedAt },
      });
      return updated.id;
    });
  }

  private async upsertSituation(
    tx: SituationTransactionClient,
    identity: SituationIdentity,
    record: CompletedAnalysisRecord,
  ): Promise<SituationRow> {
    const existing = await tx.situation.findUnique({
      where: {
        partitionKey_keyVersion_discriminator: {
          partitionKey: identity.partitionKey,
          keyVersion: identity.keyVersion,
          discriminator: identity.discriminator,
        },
      },
    });

    if (existing === null) {
      return tx.situation.create({
        data: {
          partitionKey: identity.partitionKey,
          keyVersion: identity.keyVersion,
          // ASSIGN-ONCE, AND THIS IS THE ONLY PLACE IT IS EVER WRITTEN.
          discriminator: identity.discriminator,
          discriminatorBasis: identity.discriminatorBasis,
          // The seed: the observation that opened this situation. Provenance
          // for the discriminator, and the anchor tier 2 will compare against.
          seedArticleUrl: record.observation.url,
          seedObservedAt: record.observation.observedAt,
          countryCode: record.observation.countryCode,
          // The analysis time rather than "now", so a row inserted from a
          // completed analysis carries the time the evidence belongs to.
          firstObservedAt: record.analysedAt,
          // A completed analysis necessarily retrieved what it analysed, so
          // both advance here. This is the ONLY place lastAnalysedAt is set.
          lastRetrievedAt: record.analysedAt,
          lastAnalysedAt: record.analysedAt,
        },
      });
    }

    return tx.situation.update({
      where: { id: existing.id },
      data: {
        // NOT IN THIS ARGUMENT, AND NOT EXPRESSIBLE IN ITS TYPE: discriminator,
        // discriminatorBasis, partitionKey, keyVersion, seedArticleUrl,
        // seedObservedAt, firstObservedAt. The first observation happened once
        // and re-observing does not move it.
        lastRetrievedAt: record.analysedAt,
        lastAnalysedAt: record.analysedAt,
        // countryCode is only ever FILLED IN, never overwritten with null: a
        // later analysis that could not establish a country is not evidence
        // that the earlier one was wrong.
        ...(record.observation.countryCode !== null
          ? { countryCode: record.observation.countryCode }
          : {}),
      },
    });
  }
}

export interface AppendResult {
  readonly situationId: string;
  readonly identity: SituationIdentity;
  readonly snapshotId: string;
  readonly state: SituationSnapshotState;
  readonly clustersWritten: number;
  readonly membersWritten: number;
}

export class InvalidSituationClusterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSituationClusterError';
  }
}

/** Main's storability constraint applied to all three identity components. */
function assertStorableIdentity(identity: SituationIdentity): SituationIdentity {
  return {
    partitionKey: assertStorableIdentityValue(
      identity.partitionKey,
      'partitionKey',
      MAX_PARTITION_KEY_LENGTH,
      'The situation identity',
    ),
    keyVersion: assertStorableIdentityValue(
      identity.keyVersion,
      'keyVersion',
      32,
      'The situation identity',
    ),
    discriminator: assertStorableIdentityValue(
      identity.discriminator,
      'discriminator',
      MAX_DISCRIMINATOR_LENGTH,
      'The situation identity',
    ),
    discriminatorBasis: assertStorableIdentityValue(
      identity.discriminatorBasis,
      'discriminatorBasis',
      128,
      'The situation identity',
    ),
  };
}

/**
 * Reject an append the schema's own unique constraints would reject anyway, but
 * with a message naming which cluster and why. Failing at the door beats a
 * constraint violation from inside a transaction that has already written half
 * a snapshot.
 */
function assertClusterInputsAreUsable(record: CompletedAnalysisRecord): void {
  const seenClusterKeys = new Set<string>();

  for (const cluster of record.clusters) {
    if (cluster.clusterKey.trim().length === 0) {
      throw new InvalidSituationClusterError('A cluster key may not be blank.');
    }
    if (seenClusterKeys.has(cluster.clusterKey)) {
      throw new InvalidSituationClusterError(
        `Cluster key "${cluster.clusterKey}" appears twice in one snapshot. ` +
          'SituationCluster is unique on (snapshotId, clusterKey).',
      );
    }
    seenClusterKeys.add(cluster.clusterKey);

    if (!Number.isInteger(cluster.publisherCount) || cluster.publisherCount < 0) {
      throw new InvalidSituationClusterError(
        `Cluster "${cluster.clusterKey}" has a publisherCount that is not a whole number of publishers.`,
      );
    }

    const seenUrls = new Set<string>();
    for (const url of cluster.articleUrls) {
      if (url.trim().length === 0) {
        throw new InvalidSituationClusterError(
          `Cluster "${cluster.clusterKey}" carries a blank article URL.`,
        );
      }
      if (seenUrls.has(url)) {
        throw new InvalidSituationClusterError(
          `Cluster "${cluster.clusterKey}" lists ${url} twice. ` +
            'SituationClusterMember is unique on (clusterId, articleUrl).',
        );
      }
      seenUrls.add(url);
    }
  }
}

/** `dimensions` returns from Prisma as Json; it was written validated. */
function asDimensions(value: unknown): Record<string, string | number | boolean | null> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, string | number | boolean | null>;
}

/** Re-exported so the service does not need a second import path. */
export type { SituationObservation };
