import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AskObservationRetentionService } from './ask-observation-retention.service';
import { withDeadline } from '../compute-controls/compute-scopes';
import {
  ASK_OBSERVATION_SCHEMA,
  ASK_OBSERVATION_STORE_DEADLINE_MS,
  accessBucketStart,
  governedCode,
  OBSERVED_ARTIFACT_KINDS,
  OBSERVED_DISCOURSE_REFERENCES,
  OBSERVED_JOB_DEPTHS,
  OBSERVED_JOB_FRESHNESS,
  OBSERVED_JOB_KINDS,
  OBSERVED_JOB_SOURCES,
  OBSERVED_TRANSFORMATIONS,
  sanitizeGeographyCodes,
  type AskAccessEvent,
  type AskObservationInput,
} from './ask-observation.contract';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ADMIN ASK INTELLIGENCE OBSERVABILITY R1 — THE WRITE SIDE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * APPEND-ONLY, AND THAT IS A PROPERTY OF THIS FILE. There is no read method, no update
 * path and no delete path here; the counter's merge is an increment and nothing else.
 * Reading is the Admin module's job, behind the admin guard chain — the same separation
 * `telemetry.privacy.spec.ts` already enforces for product events, and the reason this
 * service is not given a controller.
 *
 * EVERY WRITE IS BEST-EFFORT AND CANNOT FAIL THE CALLER. A reader must never lose an Ask
 * answer because a measurement would not insert. Every path is wrapped, bounded by a
 * deadline, and a failure is logged and swallowed. The asymmetry is deliberate and is the
 * telemetry module's own: losing a measurement is cheap, losing the thing being measured
 * is not.
 *
 * NO QUESTION REACHES THIS FILE. It takes a typed input of codes, counts and booleans. It
 * never sees an `AskRequest`, never reads `AskTurn`, and has no parameter a question could
 * travel through — so there is no place in it where one could be forgotten.
 *
 * THE UNIQUE CONSTRAINT IS THE DUPLICATE GUARD, NOT A CHECK-THEN-WRITE. Two replicas
 * racing on the same operation would both pass a "does it exist" read; the database
 * decides instead, and the loser's P2002 is treated as success because the observation it
 * wanted is already there.
 */
@Injectable()
export class AskObservationService {
  private readonly logger = new Logger(AskObservationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly retention: AskObservationRetentionService,
  ) {}

  /**
   * Record one Ask execution attempt. Returns whether the row was written, for tests —
   * callers ignore it, because nothing they do may depend on it.
   */
  async record(input: AskObservationInput): Promise<boolean> {
    try {
      const geography = sanitizeGeographyCodes(input.geographyCodes);
      const tokensMeasured = input.promptTokens !== null || input.completionTokens !== null;

      await withDeadline(
        this.prisma.askObservation.create({
          data: {
            operationId: input.operationId,
            schemaVersion: ASK_OBSERVATION_SCHEMA,
            routePath: input.routePath,
            adapterVersion: input.adapterVersion,

            questionClass: input.questionClass,
            queryIntent: input.queryIntent,
            terminalState: input.terminalState,
            answerState: input.answerState,
            answerBasis: input.answerBasis,
            clarificationRequired: input.clarificationRequired,
            capabilityUnavailable: input.capabilityUnavailable,
            refusalCodes: [...input.refusalCodes],
            disclosureCodes: [...input.disclosureCodes],
            clarificationCodes: [...input.clarificationCodes],

            requestLanguage: input.requestLanguage,
            questionLanguage: input.questionLanguage,
            languageClassification: input.languageClassification,
            normalizationStatus: input.normalizationStatus,

            geographyPresent: geography.codes.length > 0,
            geographyCodes: [...geography.codes],
            geographySources: [...input.geographySources],
            geographyPrecision: input.geographyPrecision,
            geographyCodesDropped: geography.dropped,
            scopedBy: input.scopedBy,

            domains: [...input.domains],
            domainCount: input.domains.length,
            topicPresent: input.topicPresent,
            temporalRequirement: input.temporalRequirement,
            statedPeriodPresent: input.statedPeriodPresent,

            evidenceRolesRequested: [...input.evidenceRolesRequested],
            evidenceRolesObtained: [...input.evidenceRolesObtained],
            evidenceRolesMissing: [...input.evidenceRolesMissing],
            reportingItemCount: input.reportingItemCount,
            contributorsConsidered: [...input.contributorsConsidered],
            contributorsUsed: [...input.contributorsUsed],
            contributorsDegraded: [...input.contributorsDegraded],
            contributorItemCount: input.contributorItemCount,

            computeClass: input.computeClass,
            providerId: input.providerId,
            providerCallCount: input.providerCallCount,
            modelInvocationCount: input.modelInvocationCount,
            aiExecuted: input.aiExecuted,
            breakerOutcome: input.breakerOutcome,
            promptTokens: input.promptTokens,
            completionTokens: input.completionTokens,
            tokensMeasured,
            latencyMs: input.latencyMs,

            failureCode: input.failureCode,
            identityState: input.identityState,

            askR2Enabled: input.askR2Enabled,
            askPublicComputeEnabled: input.askPublicComputeEnabled,

            /* CTO R4 closeout — codes from closed vocabularies only; anything else is null */
            jobKind: governedCode(input.jobKind, OBSERVED_JOB_KINDS),
            jobSource: governedCode(input.jobSource, OBSERVED_JOB_SOURCES),
            jobDepth: governedCode(input.jobDepth, OBSERVED_JOB_DEPTHS),
            jobFreshness: governedCode(input.jobFreshness, OBSERVED_JOB_FRESHNESS),
            jobClassifierUsed: input.jobClassifierUsed,
            jobTransformation: governedCode(input.jobTransformation, OBSERVED_TRANSFORMATIONS),
            jobDiscourseReference: governedCode(
              input.jobDiscourseReference,
              OBSERVED_DISCOURSE_REFERENCES,
            ),
            jobArtifactUsedKind: governedCode(input.jobArtifactUsedKind, OBSERVED_ARTIFACT_KINDS),
            jobArtifactProducedKind: governedCode(
              input.jobArtifactProducedKind,
              OBSERVED_ARTIFACT_KINDS,
            ),
          },
        }),
        ASK_OBSERVATION_STORE_DEADLINE_MS,
        'ask-observation',
      );
      /*
        RETENTION IS OFFERED HERE, AFTER THE WRITE HAS ALREADY SUCCEEDED, AND NEVER AWAITED
        BY THE CALLER'S PATH. The sweep is rate-limited to once per interval per process and
        swallows its own failures, so the cost on a normal write is one clock comparison.
        Placing it after the write is what guarantees a sweep can never be the reason an
        observation was lost.
      */
      void Promise.resolve(this.retention.sweepIfDue()).catch(() => undefined);
      return true;
    } catch (error) {
      /* A duplicate is the guarantee working, not a failure: the observation exists. */
      if ((error as { code?: string })?.code === 'P2002') return false;
      this.logger.warn(
        `ask observation not recorded for operation ${input.operationId}: ${
          (error as Error)?.message ?? 'unknown'
        }`,
      );
      return false;
    }
  }

  /**
   * Count one Ask attempt that never became an execution.
   *
   * An upsert on (event, hour) rather than a row per attempt, because both events are
   * reachable WITHOUT a credential. A per-row write there is unbounded amplification an
   * attacker controls; an increment is bounded by the clock.
   */
  async countAccess(event: AskAccessEvent, now: Date = new Date()): Promise<boolean> {
    const bucketStart = accessBucketStart(now);
    try {
      await withDeadline(
        this.prisma.askAccessCounter.upsert({
          where: { event_bucketStart: { event, bucketStart } },
          create: { event, bucketStart, count: 1 },
          update: { count: { increment: 1 } },
        }),
        ASK_OBSERVATION_STORE_DEADLINE_MS,
        'ask-access-counter',
      );
      return true;
    } catch (error) {
      this.logger.warn(
        `ask access counter not advanced for ${event}: ${(error as Error)?.message ?? 'unknown'}`,
      );
      return false;
    }
  }
}
