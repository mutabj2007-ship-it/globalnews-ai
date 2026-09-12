import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { SituationObservation } from './situation.contract';
import type { AttachmentDecision, SituationAnchor } from './situation-identity.port';
import { recommendationFrom, type ShadowRecommendation } from './situation-attachment';
import { asSituationPrismaPort, type SituationPrismaPort } from './situation.prisma-port';

/**
 * SITUATION MEMORY — S1-R2. THE SHADOW-DECISION STORE.
 *
 * WHAT THIS TABLE IS FOR, EXACTLY. G measured the continuity policy's
 * separation margin at 0.042 — lowest true positive 0.375, highest true
 * negative 0.333 — over eighteen hand-built pairs, and declined to certify a
 * threshold from it. G's exit criterion for phase 2 is a LIVE-SCORED
 * DISTRIBUTION with visible bimodal separation, and a threshold chosen from
 * that. This table is how that distribution gets gathered without anything
 * being at risk while it is gathered.
 *
 * THE ASYMMETRY THAT JUSTIFIES SHADOW MODE. A false merge acted on in
 * production is a reader shown two unrelated matters as one continuing
 * situation — and, worse, the situation memory then records that merge as
 * history. A false merge recorded here is a row in a table that nothing reads
 * for continuity.
 *
 * WHY THE POLICY AND THRESHOLD ARE ON EVERY ROW. The threshold WILL change —
 * changing it is the point of gathering the distribution. A corpus of scores
 * without the threshold each was judged against cannot be re-read afterwards:
 * you would know the scores but not which of them the policy of the day called
 * a match. Storing both makes every row self-describing.
 *
 * WHY THERE IS NO FOREIGN KEY TO Situation. The candidate may later be deleted;
 * the record of what was compared must not vanish with it, or the corpus
 * silently loses exactly the cases that were later judged wrong. The
 * discriminator is stored beside the id so the comparison target stays
 * identifiable after the row is gone.
 */
@Injectable()
export class SituationShadowRepository {
  private readonly db: SituationPrismaPort;

  constructor(prisma: PrismaService) {
    this.db = asSituationPrismaPort(prisma);
  }

  /**
   * RECORD ONE TIER-2 DECISION, AND ACT ON NONE OF IT.
   *
   * Writes exactly one row and returns its id. It touches no Situation,
   * Snapshot, Cluster or Member — a shadow decision that could modify the store
   * it is shadowing would not be a shadow.
   *
   * `shadowOnly: true` is a LITERAL, not a parameter. There is no argument a
   * caller could pass to write false, the column's type in the port is the
   * literal `true`, and the migration adds a CHECK constraint that rejects
   * false at the database. Three layers, because the whole value of this table
   * is that nothing in it is authoritative.
   */
  async record(input: ShadowDecisionInput): Promise<ShadowDecisionResult> {
    const recommendation: ShadowRecommendation = recommendationFrom(
      input.decision,
      input.anchorCount,
    );

    const row = await this.db.situationShadowDecision.create({
      data: {
        decidedAt: input.decidedAt,
        partitionKey: input.partitionKey,
        keyVersion: input.keyVersion,
        // ARTICLE URL, for the same reason as cluster membership: `id` is a
        // 32-bit rolling hash and is not a safe key.
        observationUrl: input.observation.url,
        candidateSituationId: input.candidate?.situationId ?? null,
        candidateDiscriminator: input.candidate?.discriminator ?? null,
        anchorArticleUrl: input.decision.anchorArticleUrl,
        // NULL ONLY WHEN THERE WAS NOTHING TO SCORE — never 0, which is a real
        // score and a different fact. An empty bucket that recorded 0 would
        // pile up at the bottom of the distribution and drag the threshold.
        score: input.anchorCount === 0 ? null : input.decision.bestScore,
        recommendation,
        reason: input.decision.reason,
        features: input.decision.features,
        policyId: input.policyId,
        policyThreshold: input.policyThreshold,
        shadowOnly: true,
      },
    });

    return { shadowDecisionId: row.id, recommendation, shadowOnly: true };
  }
}

export interface ShadowDecisionInput {
  readonly decidedAt: Date;
  readonly partitionKey: string;
  readonly keyVersion: string;
  readonly observation: SituationObservation;
  /**
   * How many anchors the bucket actually offered. Kept separate from
   * `candidate` because ZERO ANCHORS IS ITS OWN OUTCOME: it is recorded as
   * NO_CANDIDATE with a null score rather than omitted, and a distribution
   * missing its empty-bucket cases is a biased one.
   */
  readonly anchorCount: number;
  readonly candidate: SituationAnchor | null;
  readonly decision: AttachmentDecision;
  readonly policyId: string;
  readonly policyThreshold: number;
}

export interface ShadowDecisionResult {
  readonly shadowDecisionId: string;
  readonly recommendation: ShadowRecommendation;
  /** Always true. Present so a caller reading the result cannot miss it. */
  readonly shadowOnly: true;
}
