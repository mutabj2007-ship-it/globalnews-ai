import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { StoryIdentityService, type CanonicalStory } from '../stories/story-identity.service';
import {
  STORY_BRIEF_GENERATOR,
  type StoryBriefGenerator,
  type StoryBriefRequester,
} from './story-brief.generator';
import {
  STORY_BRIEF_LEASE_MS,
  evidenceRevisionOf,
  isConclusion,
  readStateOf,
  type AttemptFact,
  type StoryBriefConclusion,
  type StoryBriefFailureKind,
  type StoryBriefReadState,
  type VersionFact,
} from './story-brief.rules';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * EA-STORY-BRIEF-01 — THE CANONICAL, STORY-OWNED BRIEF
 * ════════════════════════════════════════════════════════════════════════════
 *
 * docs/convergence/east-africa/STORY-BRIEF-CONTRACT.md.
 *   read()     ZERO COMPUTE. Facts only; the generator is never called.
 *   request()  the explicit Read Brief: a current Brief is returned as-is (zero compute); else ONE
 *              claim per (story, evidence revision) — concurrent callers collapse onto it — and one
 *              generator call. A conclusion appends an immutable version; a failure is recorded on
 *              the attempt, never as an insufficient-evidence Brief.
 * Shared and story-owned: no user id is ever written to a version. Private Ask Briefings are not
 * touched. Discussion content is never read here.
 */

type Tx = Prisma.TransactionClient;

export interface StoryBriefVersionView {
  readonly version: number;
  readonly state: StoryBriefConclusion;
  readonly evidenceRevision: string;
  readonly materialVersion: number;
  readonly blocks: unknown;
  readonly evidenceRefs: unknown;
  readonly coverageGaps: unknown;
  readonly uncertainty: unknown;
  readonly asOf: string;
  readonly generatedAt: string;
}

export interface StoryBriefView {
  /** Canonical story id (an alias id resolves to its survivor). */
  readonly storyId: string;
  readonly state: StoryBriefReadState;
  readonly currentEvidenceRevision: string;
  /** The Brief for the current evidence, or — when STALE — the latest one (still inspectable). */
  readonly brief: StoryBriefVersionView | null;
  readonly versions: number;
  /** STALE only: the evidence set changed since the shown Brief. Not a claim of materiality. */
  readonly changedSince: { readonly fromRevision: string; readonly toRevision: string; readonly basis: 'EVIDENCE_SET_CHANGED' } | null;
  readonly lastAttempt: {
    readonly status: 'CHECKING' | 'DONE' | 'FAILED';
    readonly failureKind: StoryBriefFailureKind | null;
    readonly failureCode: string | null;
    readonly startedAt: string;
    readonly finishedAt: string | null;
  } | null;
  /** False while no governed generator is bound: surfaces must not offer Read Brief. */
  readonly generationAvailable: boolean;
}

type VersionRow = {
  id: string;
  storyId: string;
  version: number;
  state: string;
  evidenceRevision: string;
  materialVersion: number;
  blocks: Prisma.JsonValue;
  evidenceRefs: Prisma.JsonValue;
  coverageGaps: Prisma.JsonValue;
  uncertainty: Prisma.JsonValue;
  asOf: Date;
  generatedAt: Date;
};

function versionView(row: VersionRow): StoryBriefVersionView {
  return {
    version: row.version,
    state: row.state as StoryBriefConclusion,
    evidenceRevision: row.evidenceRevision,
    materialVersion: row.materialVersion,
    blocks: row.blocks,
    evidenceRefs: row.evidenceRefs,
    coverageGaps: row.coverageGaps,
    uncertainty: row.uncertainty,
    asOf: row.asOf.toISOString(),
    generatedAt: row.generatedAt.toISOString(),
  };
}

const fact = (row: VersionRow | null): VersionFact | null =>
  row !== null && isConclusion(row.state) ? { evidenceRevision: row.evidenceRevision, state: row.state } : null;

@Injectable()
export class StoryBriefService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identity: StoryIdentityService,
    @Inject(STORY_BRIEF_GENERATOR) private readonly generator: StoryBriefGenerator,
  ) {}

  /** The canonical story and its current admitted evidence set (alias set included). */
  private async evidenceOf(storyId: string, db: Tx | PrismaService = this.prisma) {
    const story = await this.identity.describe(storyId, db);
    if (!story) throw new NotFoundException('STORY');
    const members = await db.storyArticle.findMany({
      where: { storyId: { in: [...story.aliasIds] } },
      select: { articleRef: true, articleUrl: true },
      orderBy: [{ addedAt: 'asc' }, { articleRef: 'asc' }],
    });
    if (members.length === 0) throw new NotFoundException('STORY_EVIDENCE');
    const articleRefs = members.map((m) => m.articleRef).sort();
    const leadArticle = { articleRef: members[0]!.articleRef, articleUrl: members[0]!.articleUrl };
    return { story, articleRefs, leadArticle, revision: evidenceRevisionOf(articleRefs) };
  }

  /**
   * CANONICAL STORY RESOLUTION (CTO baseline §2) — articleRef → canonical story, read-only and
   * independent of Discussion: no compute, no write (an article with no story yet stays storyless;
   * nothing is created by reading), no user identity. An alias resolves to its survivor.
   */
  async resolveByArticle(articleRef: string): Promise<{ articleRef: string; storyId: string | null; materialVersion: number | null }> {
    const story = await this.identity.resolveByArticleRef(articleRef);
    return { articleRef, storyId: story?.storyId ?? null, materialVersion: story?.briefVersion ?? null };
  }

  /** ZERO COMPUTE. Never calls the generator. */
  async read(storyId: string, now: Date = new Date()): Promise<StoryBriefView> {
    const { story, revision } = await this.evidenceOf(storyId);
    return this.viewOf(story, revision, now);
  }

  private async viewOf(story: CanonicalStory, revision: string, now: Date): Promise<StoryBriefView> {
    const aliasIds = [...story.aliasIds];
    const [forCurrent, latest, versions, lastAttempt] = await Promise.all([
      this.prisma.storyBriefVersion.findFirst({ where: { storyId: { in: aliasIds }, evidenceRevision: revision } }),
      this.prisma.storyBriefVersion.findFirst({ where: { storyId: { in: aliasIds } }, orderBy: [{ version: 'desc' }, { createdAt: 'desc' }] }),
      this.prisma.storyBriefVersion.count({ where: { storyId: { in: aliasIds } } }),
      this.prisma.storyBriefAttempt.findFirst({ where: { storyId: { in: aliasIds }, evidenceRevision: revision }, orderBy: { startedAt: 'desc' } }),
    ]);
    const attemptFact: AttemptFact | null =
      lastAttempt === null
        ? null
        : {
            evidenceRevision: lastAttempt.evidenceRevision,
            status: lastAttempt.status as AttemptFact['status'],
            failureKind: lastAttempt.failureKind as StoryBriefFailureKind | null,
            leaseExpiresAt: lastAttempt.leaseExpiresAt,
          };
    const state = readStateOf({
      currentRevision: revision,
      versionForCurrent: fact(forCurrent),
      latestVersion: fact(latest),
      lastAttemptForCurrent: attemptFact,
      now,
    });
    const shown = forCurrent ?? latest;
    return {
      storyId: story.storyId,
      state,
      currentEvidenceRevision: revision,
      brief: shown === null ? null : versionView(shown),
      versions,
      changedSince:
        forCurrent === null && latest !== null
          ? { fromRevision: latest.evidenceRevision, toRevision: revision, basis: 'EVIDENCE_SET_CHANGED' }
          : null,
      lastAttempt:
        lastAttempt === null
          ? null
          : {
              status: lastAttempt.status as AttemptFact['status'],
              failureKind: lastAttempt.failureKind as StoryBriefFailureKind | null,
              failureCode: lastAttempt.failureCode,
              startedAt: lastAttempt.startedAt.toISOString(),
              finishedAt: lastAttempt.finishedAt?.toISOString() ?? null,
            },
      generationAvailable: this.generator.available,
    };
  }

  /** The explicit Read Brief. The ONLY path that may call the generator. */
  async request(storyId: string, requester: StoryBriefRequester, now: Date = new Date()): Promise<StoryBriefView> {
    const { story, articleRefs, leadArticle, revision } = await this.evidenceOf(storyId);
    const aliasIds = [...story.aliasIds];

    /* A current Brief reopens with zero compute (PARTIAL / INSUFFICIENT included: per revision). */
    const current = await this.prisma.storyBriefVersion.findFirst({ where: { storyId: { in: aliasIds }, evidenceRevision: revision } });
    if (current !== null) return this.viewOf(story, revision, now);

    /* An expired claim's outcome is unknown: closed, never re-run. */
    await this.prisma.storyBriefAttempt.updateMany({
      where: { storyId: { in: aliasIds }, evidenceRevision: revision, status: 'CHECKING', leaseExpiresAt: { lte: now } },
      data: { status: 'FAILED', failureKind: 'OUTCOME_UNKNOWN', failureCode: 'LEASE_EXPIRED', finishedAt: now },
    });

    /* One claim per (story, evidence revision): concurrent Read Brief / Discuss collapse here. */
    let attemptId: string;
    try {
      const attempt = await this.prisma.storyBriefAttempt.create({
        data: { storyId: story.storyId, evidenceRevision: revision, status: 'CHECKING', leaseExpiresAt: new Date(now.getTime() + STORY_BRIEF_LEASE_MS) },
      });
      attemptId = attempt.id;
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') return this.viewOf(story, revision, now);
      throw error;
    }

    let outcome: Awaited<ReturnType<StoryBriefGenerator['generate']>>;
    try {
      outcome = await this.generator.generate(
        { storyId: story.storyId, attemptId, evidenceRevision: revision, materialVersion: story.briefVersion, articleRefs, leadArticle },
        requester,
      );
    } catch {
      outcome = { outcome: 'FAILED', failureKind: 'EXECUTION_FAILED', failureCode: 'GENERATOR_THREW', operationId: null };
    }

    const finishedAt = new Date();
    if (outcome.outcome === 'FAILED') {
      await this.prisma.storyBriefAttempt.update({
        where: { id: attemptId },
        data: { status: 'FAILED', failureKind: outcome.failureKind, failureCode: outcome.failureCode, operationId: outcome.operationId, finishedAt },
      });
      return this.viewOf(story, revision, finishedAt);
    }

    const concluded = outcome;
    await this.identity.atomic(async (tx) => {
      const top = await tx.storyBriefVersion.aggregate({ where: { storyId: { in: aliasIds } }, _max: { version: true } });
      const created = await tx.storyBriefVersion.create({
        data: {
          storyId: story.storyId,
          version: (top._max.version ?? 0) + 1,
          evidenceRevision: revision,
          materialVersion: story.briefVersion,
          state: concluded.state,
          blocks: concluded.blocks as Prisma.InputJsonValue,
          evidenceRefs: concluded.evidenceRefs as unknown as Prisma.InputJsonValue,
          coverageGaps: [...concluded.coverageGaps],
          uncertainty: [...concluded.uncertainty],
          asOf: concluded.asOf,
          generatedAt: finishedAt,
          sourceOperationId: concluded.operationId,
        },
      });
      await tx.storyBriefAttempt.update({
        where: { id: attemptId },
        data: { status: 'DONE', briefVersionId: created.id, operationId: concluded.operationId, finishedAt },
      });
    });
    return this.viewOf(story, revision, finishedAt);
  }

  /**
   * ADMIN ↔ PUBLIC CONTRACT (CTO §8) — the operational truth behind what a reader sees, keyed by the
   * SAME canonical identities: story + alias set, member articles (articleRef / url / publisher
   * host), the current evidence revision and derived state, every immutable version (with the
   * governed sourceOperationId), and every attempt (status, failure kind/code, operationId).
   * Read-only, zero compute. No requester identity exists to show: none is stored on a Brief.
   */
  async adminInspect(storyId: string, now: Date = new Date()) {
    const { story, revision } = await this.evidenceOf(storyId);
    const aliasIds = [...story.aliasIds];
    const [members, versions, attempts, view] = await Promise.all([
      this.prisma.storyArticle.findMany({
        where: { storyId: { in: aliasIds } },
        select: { articleRef: true, articleUrl: true, sourceHost: true, storyId: true, addedAt: true },
        orderBy: [{ addedAt: 'asc' }, { articleRef: 'asc' }],
      }),
      this.prisma.storyBriefVersion.findMany({ where: { storyId: { in: aliasIds } }, orderBy: [{ version: 'asc' }, { createdAt: 'asc' }] }),
      this.prisma.storyBriefAttempt.findMany({ where: { storyId: { in: aliasIds } }, orderBy: { startedAt: 'asc' } }),
      this.viewOf(story, revision, now),
    ]);
    return {
      story: { storyId: story.storyId, aliasIds, materialVersion: story.briefVersion },
      currentEvidenceRevision: revision,
      state: view.state,
      generationAvailable: view.generationAvailable,
      members,
      versions: versions.map((v) => ({ ...versionView(v), id: v.id, storyId: v.storyId, sourceOperationId: v.sourceOperationId, createdAt: v.createdAt.toISOString() })),
      attempts: attempts.map((a) => ({
        id: a.id,
        storyId: a.storyId,
        evidenceRevision: a.evidenceRevision,
        status: a.status,
        failureKind: a.failureKind,
        failureCode: a.failureCode,
        operationId: a.operationId,
        briefVersionId: a.briefVersionId,
        leaseExpiresAt: a.leaseExpiresAt.toISOString(),
        startedAt: a.startedAt.toISOString(),
        finishedAt: a.finishedAt?.toISOString() ?? null,
      })),
    };
  }
}
