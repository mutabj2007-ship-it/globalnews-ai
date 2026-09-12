import { Inject, Injectable } from '@nestjs/common';
import type {
  CompletedAnalysisRecord,
  SituationIdentity,
  SituationObservation,
  SituationReAnalysisEvidence,
} from './situation.contract';
import {
  SITUATION_IDENTITY_PORT,
  UNWIRED_SITUATION_IDENTITY_PORT,
  assertStorableIdentityValue,
  MAX_PARTITION_KEY_LENGTH,
  type SituationIdentityPort,
} from './situation-identity.port';
import { resolveShadowOnly, type AttachmentResolution } from './situation-attachment';
import { classifyReAnalysisEvidence } from './situation.state';
import { SituationRepository, type AppendResult } from './situation.repository';
import { SituationShadowRepository } from './situation-shadow.repository';

/**
 * SITUATION MEMORY — S1-R2. THE SERVICE, AND THE PHASE BOUNDARY.
 *
 * The transactional guarantees live in the repository and the state rules in
 * situation.state.ts. What lives HERE is the one thing neither of those can
 * express: which phase we are in.
 *
 * PHASE 1 (today). `observeCompletedAnalysis` derives the partition key through
 * G's port, loads the bucket, asks tier 2 for a decision, RECORDS that decision
 * in the shadow store, and then declines to resolve an identity. It returns
 * `persisted: false` and does not throw, because refusing to guess is the
 * EXPECTED outcome of every observation until the threshold is validated —
 * modelling the normal case as an error would fill the logs with alarm about
 * the system working correctly.
 *
 * PHASE 2 (not now). The same method resolves an identity and calls the
 * repository. Nothing here decides when that begins; G's exit criterion is a
 * live-scored distribution with visible bimodal separation.
 */
@Injectable()
export class SituationService {
  constructor(
    private readonly repository: SituationRepository,
    private readonly shadow: SituationShadowRepository,
    @Inject(SITUATION_IDENTITY_PORT) private readonly identity: SituationIdentityPort,
  ) {}

  /**
   * OBSERVE A COMPLETED, REQUEST-TRIGGERED ANALYSIS.
   *
   * The whole tier-1 → bucket → tier-2 → record sequence, with the phase gate
   * at the end. In phase 1 this NEVER writes a Situation row.
   */
  async observeCompletedAnalysis(
    input: ObserveCompletedAnalysisInput,
  ): Promise<ObserveResult> {
    // TIER 1 — SETTLED. Pure, deterministic, no I/O. If G's package is not
    // wired the port throws here and nothing at all has happened yet.
    const partitionKey = assertStorableIdentityValue(
      this.identity.derivePartitionKey(input.observation),
      'partitionKey',
      MAX_PARTITION_KEY_LENGTH,
      `The situation identity port "${this.identity.policyId}"`,
    );
    const keyVersion = this.identity.keyVersion;

    // THE ONLY LOOKUP. Bounded by construction: this observation's bucket, at
    // this key version, and nothing else.
    const anchors = await this.repository.loadBucketAnchors(partitionKey, keyVersion);

    // TIER 2 — NOT SETTLED.
    const decision = this.identity.decideAttachment(input.observation, anchors);
    const candidate =
      anchors.find((a) => a.anchorArticleUrl === decision.anchorArticleUrl) ?? null;

    const recorded = await this.shadow.record({
      decidedAt: input.analysedAt,
      partitionKey,
      keyVersion,
      observation: input.observation,
      anchorCount: anchors.length,
      candidate,
      decision,
      policyId: this.identity.policyId,
      policyThreshold: this.identity.policyThreshold,
    });

    // THE PHASE GATE. `shadowOnly` comes from G's decision, so phase 2 is
    // reached by G's contract changing its answer — not by a flag here that
    // somebody could flip without the threshold ever having been validated.
    const resolution: AttachmentResolution = decision.shadowOnly
      ? resolveShadowOnly(input.observation, decision, candidate)
      : { outcome: 'RESOLVED', identity: null, decision, candidate };

    if (resolution.identity === null) {
      return {
        persisted: false,
        reason:
          resolution.outcome === 'SHADOW_ONLY'
            ? 'TIER2_SHADOW_ONLY'
            : 'TIER2_RESOLUTION_NOT_IMPLEMENTED',
        partitionKey,
        keyVersion,
        anchorCount: anchors.length,
        shadowDecisionId: recorded.shadowDecisionId,
        recommendation: recorded.recommendation,
        append: null,
      };
    }

    const append = await this.repository.appendCompletedAnalysis({
      identity: resolution.identity,
      observation: input.observation,
      analysedAt: input.analysedAt,
      dimensions: input.dimensions,
      clusters: input.clusters,
      analysisRunId: input.analysisRunId ?? null,
    });

    return {
      persisted: true,
      reason: 'RESOLVED',
      partitionKey,
      keyVersion,
      anchorCount: anchors.length,
      shadowDecisionId: recorded.shadowDecisionId,
      recommendation: recorded.recommendation,
      append,
    };
  }

  /**
   * Append against an identity the caller has already resolved.
   *
   * THIS METHOD THROWS. The failure policy — whether a store failure should
   * fail the user's analysis response, or be absorbed the way telemetry
   * deliberately absorbs its own — is NOT decided here. It belongs to the
   * eventual call site, and hard-coding the lenient answer now would quietly
   * make it unrevisitable.
   */
  async recordCompletedAnalysis(record: CompletedAnalysisRecord): Promise<AppendResult> {
    return this.repository.appendCompletedAnalysis(record);
  }

  /** Retrieval, with no claim that anything was analysed. Null if unknown. */
  async recordRetrieval(identity: SituationIdentity, retrievedAt: Date): Promise<string | null> {
    return this.repository.recordRetrieval(identity, retrievedAt);
  }

  /**
   * WHICH PHASE THIS INSTANCE IS IN, read from what is actually wired rather
   * than from a flag somebody has to remember to update.
   */
  writePathStatus(): {
    identityPortWired: boolean;
    keyVersion: string;
    policyId: string;
    tier2: 'SHADOW_ONLY';
  } {
    return {
      identityPortWired: this.identity !== UNWIRED_SITUATION_IDENTITY_PORT,
      keyVersion: this.identity.keyVersion,
      policyId: this.identity.policyId,
      // Not computed. Tier 2 is shadow-only in this tranche by CTO ruling, and
      // a value that could read otherwise would be a lie waiting to happen.
      tier2: 'SHADOW_ONLY',
    };
  }

  /** What a stored `lastAnalysedAt` supports relative to a reference point. */
  classifyReAnalysis(
    lastAnalysedAt: Date | null,
    reference: Date | null | undefined,
  ): SituationReAnalysisEvidence {
    return classifyReAnalysisEvidence(lastAnalysedAt, reference);
  }
}

export interface ObserveCompletedAnalysisInput {
  readonly observation: SituationObservation;
  readonly analysedAt: Date;
  readonly dimensions: CompletedAnalysisRecord['dimensions'];
  readonly clusters: CompletedAnalysisRecord['clusters'];
  readonly analysisRunId?: string | null;
}

export interface ObserveResult {
  /** False for every observation in phase 1. */
  readonly persisted: boolean;
  readonly reason: 'TIER2_SHADOW_ONLY' | 'TIER2_RESOLUTION_NOT_IMPLEMENTED' | 'RESOLVED';
  readonly partitionKey: string;
  readonly keyVersion: string;
  readonly anchorCount: number;
  /** Always present: the decision is recorded whatever the phase. */
  readonly shadowDecisionId: string;
  readonly recommendation: string;
  readonly append: AppendResult | null;
}
