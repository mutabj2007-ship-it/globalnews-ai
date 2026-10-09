import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ALL_ISO3_CODES } from '@globalnews-ai/shared';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import { readStoryMaterialVersion } from '../../stories/story-relation.read';
import { retrievalFailed } from '../ask-r2-execution.adapter';
import {
  briefingSnapshotOf,
  type BriefingEvidenceRef,
  type BriefingIntelligence,
} from './briefing-snapshot';
import {
  assessFollowedCheck,
  VERSIONING_OUTCOMES,
  type FollowedBaseline,
  type FollowedCandidate,
} from './followed-change';

type Tx = Prisma.TransactionClient;

export const BRIEFING_LIMIT_PER_USER = 100;
export const BRIEFING_VERSION_LIMIT = 50;
export const BRIEFING_TITLE_MAX = 160;

export interface BriefingScopeInput {
  readonly countryCode?: string;
  readonly storyId?: string;
}

/** REASON TO RETURN R1 · §8 — checks kept per followed question in the detail view. */
export const BRIEFING_CHECK_HISTORY = 20;
const IN_FLIGHT = new Set(['QUOTED', 'ACCEPTED', 'RESERVED', 'RUNNING']);

export interface BriefingUpdateInput {
  readonly title?: string;
  readonly status?: 'ACTIVE' | 'PAUSED';
  readonly question?: string;
}

/** The comparable reading of one stored version (blocks are our own validated output). */
function baselineOf(row: {
  version: number;
  asOf: Date;
  blocks: unknown;
  evidenceRefs: unknown;
}): FollowedBaseline {
  const blocks = (row.blocks ?? {}) as {
    answerState?: unknown;
    summary?: unknown;
    scopeRevision?: unknown;
    intelligence?: unknown;
  };
  return {
    version: row.version,
    asOf: row.asOf.toISOString(),
    answerState: typeof blocks.answerState === 'string' ? blocks.answerState : null,
    summaryPresent: typeof blocks.summary === 'string' && blocks.summary.trim() !== '',
    evidenceRefs: Array.isArray(row.evidenceRefs) ? (row.evidenceRefs as BriefingEvidenceRef[]) : [],
    /*
      CTO R1-B §3 — the governed specialist basis that version stored (payload.intelligence as the
      coordinator wrote it). Absent on versions saved before the field existed: undefined, which
      the comparison treats as "no comparable structured baseline", never as "none".
    */
    intelligence:
      'intelligence' in blocks ? ((blocks.intelligence ?? null) as BriefingIntelligence | null) : undefined,
    /* versions saved before Reason to Return carry no revision: they are revision 0 */
    scopeRevision: typeof blocks.scopeRevision === 'number' ? blocks.scopeRevision : 0,
  };
}

function scopeRevisionOf(scope: unknown): number {
  const value = (scope as { scopeRevision?: unknown } | null)?.scopeRevision;
  return typeof value === 'number' ? value : 0;
}

/** The list row's compact view of a check: outcome, when, and counts — no evidence detail. */
function summaryOfCheck(check: {
  outcome: string;
  checkedAt: Date;
  resultingVersion: number | null;
  assessment: unknown;
}) {
  const a = (check.assessment ?? {}) as {
    newEvidence?: unknown[];
    possibleCorrections?: unknown[];
    supportedChanges?: unknown[];
    unassessedSources?: unknown[];
    structured?: {
      newEvents?: unknown[];
      lateAdmitted?: unknown[];
      revised?: unknown[];
      unassessed?: unknown[];
    };
  };
  const structuredUnassessed = (a.structured?.unassessed ?? []).filter(
    (u): u is string => typeof u === 'string',
  );
  return {
    outcome: check.outcome,
    checkedAt: check.checkedAt,
    resultingVersion: check.resultingVersion,
    newEvidenceCount: a.newEvidence?.length ?? 0,
    possibleCorrectionCount: a.possibleCorrections?.length ?? 0,
    supportedChangeCount: a.supportedChanges?.length ?? 0,
    /* CTO R1-B §3 — governed specialist records: new / late-admitted / revised, and the holes */
    structuredChangeCount:
      (a.structured?.newEvents?.length ?? 0) +
      (a.structured?.lateAdmitted?.length ?? 0) +
      (a.structured?.revised?.length ?? 0),
    structuredUnassessed,
    partial: (a.unassessedSources?.length ?? 0) > 0 || structuredUnassessed.length > 0,
  };
}

function sameQuestion(a: string, b: string): boolean {
  return a.normalize('NFC').trim() === b.normalize('NFC').trim();
}

/** Which sources did not answer, when at least one did (a partial search). */
function unassessedSourcesOf(analysis: unknown): string[] {
  const ctx = (analysis as { retrievalContext?: unknown } | null)?.retrievalContext as
    | {
        providers?: readonly string[];
        providerFailures?: readonly { providerId?: unknown }[];
        retrievalTrace?: { lanesUnavailable?: readonly { lane?: unknown }[] };
      }
    | undefined;
  if (!ctx || (ctx.providers ?? []).length === 0) return [];
  const names = [
    ...(ctx.providerFailures ?? []).map((f) => f.providerId),
    ...(ctx.retrievalTrace?.lanesUnavailable ?? []).map((l) => l.lane),
  ].filter((n): n is string => typeof n === 'string' && n !== '');
  return [...new Set(names)].sort();
}

/**
 * R2 · D1 — DURABLE BRIEFINGS (CTO checkpoint 3 ruling §10).
 *
 * A briefing is the reader's own saved document: a stable identity plus immutable versions.
 * Every version is a SNAPSHOT of one of the reader's own completed Ask turns (briefing-snapshot.ts:
 * our output + evidence references, never source text). Reading a version is a database read:
 * no AI runs and nothing is re-retrieved.
 *
 * PRIVATE BY CONSTRUCTION: every query carries `userId`; another reader's briefing and a missing
 * one take the same bare 404. A turn is resolved through its thread's owner, exactly as bookmarks
 * are. Versions are append-only: adding version n+1 never touches version n, and a reader of an
 * older version is told that a newer one exists (superseded, not rewritten).
 */
@Injectable()
export class BriefingsService {
  constructor(private readonly prisma: PrismaService) {}

  /*
    R2 · ITEM 3 (CTO checkpoint 3 ruling §9, option B) — THE PILOT'S "FOLLOW" IS THE EXPLICIT
    STORY SUBJECT, NOT COUNTRY FOLLOW. A briefing scoped to a canonical story records, per version,
    the story's material-evidence version (Story.briefVersion — the same counter Stage-B Story
    Alerts dedup on). A later rise of that counter is the material update: the briefing reports
    it, the reader's Story Alert (if they set one) lists what joined, and "Ask about this update"
    produces the turn that becomes the next version. Read-only identity read (stories/story-relation.read, as Compare does); no
    second alert engine, no CountryFollow read or write.
  */
  private async storySubject(tx: Tx | PrismaService, storyId: string | undefined) {
    if (storyId === undefined) return null;
    const story = await readStoryMaterialVersion(this.prisma, storyId, tx);
    if (!story) throw new UnprocessableEntityException({ code: 'BRIEFING_SCOPE_UNKNOWN_STORY' });
    return { kind: 'STORY' as const, storyId: story.storyId, briefVersion: story.briefVersion };
  }

  /** The material update since a version was taken (story subjects only). */
  private async updateOf(scope: unknown, latestBlocks: unknown) {
    const storyId = (scope as { storyId?: unknown } | null)?.storyId;
    const recorded = (latestBlocks as { subject?: { briefVersion?: unknown } } | null)?.subject
      ?.briefVersion;
    if (typeof storyId !== 'string' || typeof recorded !== 'number') return null;
    const story = await readStoryMaterialVersion(this.prisma, storyId);
    if (!story)
      return { kind: 'STORY_MATERIAL_UPDATE' as const, available: false, storyGone: true };
    return {
      kind: 'STORY_MATERIAL_UPDATE' as const,
      available: story.briefVersion > recorded,
      recordedBriefVersion: recorded,
      currentBriefVersion: story.briefVersion,
      updatedAt: story.briefUpdatedAt,
      storyId: story.storyId,
    };
  }

  private user(userId: string): void {
    if (!userId) throw new UnauthorizedException();
  }

  private async atomic<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.prisma.$transaction(work, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        const code = (error as { code?: string })?.code;
        /* the pg driver adapter reports a serialization failure as a TransactionWriteConflict
           DriverAdapterError rather than P2034; it is the same retryable conflict */
        const conflict =
          ['P2034', 'P2002'].includes(code ?? '') ||
          (error as { cause?: { kind?: string } })?.cause?.kind === 'TransactionWriteConflict' ||
          /TransactionWriteConflict/.test(String((error as Error)?.message ?? ''));
        if (attempt >= 7 || !conflict) throw error;
      }
    }
  }

  /** The snapshot of one of the reader's OWN completed turns, or a refusal. */
  private async snapshotOfTurn(tx: Tx, userId: string, turnId: string) {
    const turn = await tx.askTurn.findFirst({
      where: { id: turnId, thread: { userId } },
      select: {
        id: true,
        question: true,
        language: true,
        operation: {
          select: {
            status: true,
            storedResult: { select: { payload: true, evidenceRevision: true } },
          },
        },
      },
    });
    if (!turn) throw new NotFoundException();
    const stored = turn.operation?.status === 'COMPLETED' ? turn.operation.storedResult : null;
    const snapshot = stored ? briefingSnapshotOf(stored.payload) : null;
    if (!stored || !snapshot) {
      throw new UnprocessableEntityException({ code: 'BRIEFING_TURN_NOT_SAVEABLE' });
    }
    return { turn, snapshot, evidenceRevision: stored.evidenceRevision };
  }

  async create(
    userId: string,
    input: { readonly turnId: string; readonly title?: string } & BriefingScopeInput,
  ) {
    this.user(userId);
    const countryCode = input.countryCode?.toUpperCase();
    if (countryCode !== undefined && !ALL_ISO3_CODES.includes(countryCode)) {
      throw new UnprocessableEntityException({ code: 'BRIEFING_SCOPE_UNKNOWN_COUNTRY' });
    }
    return this.atomic(async (tx) => {
      if ((await tx.briefing.count({ where: { userId } })) >= BRIEFING_LIMIT_PER_USER) {
        throw new ConflictException({ code: 'BRIEFING_LIMIT' });
      }
      const { turn, snapshot, evidenceRevision } = await this.snapshotOfTurn(
        tx,
        userId,
        input.turnId,
      );
      const subject = await this.storySubject(tx, input.storyId);
      const title = (input.title?.trim() || turn.question.trim()).slice(0, BRIEFING_TITLE_MAX);
      const briefing = await tx.briefing.create({
        data: {
          userId,
          title,
          scope: {
            kind: 'ASK_QUESTION',
            question: turn.question,
            language: turn.language,
            scopeRevision: 0,
            ...(countryCode === undefined ? {} : { countryCode }),
            ...(subject === null ? {} : { storyId: subject.storyId }),
          },
          versions: {
            create: {
              version: 1,
              asOf: new Date(snapshot.asOf),
              windowFrom: null,
              windowTo: new Date(snapshot.asOf),
              blocks: {
                ...snapshot.blocks,
                subject,
                scopeRevision: 0,
              } as unknown as Prisma.InputJsonValue,
              evidenceRefs: snapshot.evidenceRefs as unknown as Prisma.InputJsonValue,
              evidenceRevision,
              coverageGaps: snapshot.coverageGaps as unknown as Prisma.InputJsonValue,
              sourceTurnId: turn.id,
            },
          },
        },
        select: { id: true, title: true, createdAt: true },
      });
      return { ...briefing, version: 1 };
    });
  }

  /** Append version n+1 from another of the reader's own completed turns. Never edits n. */
  async addVersion(userId: string, briefingId: string, turnId: string) {
    this.user(userId);
    return this.atomic(async (tx) => {
      const briefing = await tx.briefing.findFirst({
        where: { id: briefingId, userId },
        select: {
          id: true,
          scope: true,
          versions: {
            orderBy: { version: 'desc' },
            take: 1,
            select: { version: true, asOf: true },
          },
        },
      });
      if (!briefing) throw new NotFoundException();
      const storyId = (briefing.scope as { storyId?: unknown } | null)?.storyId;
      const subject = await this.storySubject(
        tx,
        typeof storyId === 'string' ? storyId : undefined,
      );
      const latest = briefing.versions[0];
      const next = (latest?.version ?? 0) + 1;
      if (next > BRIEFING_VERSION_LIMIT)
        throw new ConflictException({ code: 'BRIEFING_VERSION_LIMIT' });
      const { turn, snapshot, evidenceRevision } = await this.snapshotOfTurn(tx, userId, turnId);
      const created = await tx.briefingVersion.create({
        data: {
          briefingId,
          version: next,
          asOf: new Date(snapshot.asOf),
          /* the monitoring window: since the previous version was taken */
          windowFrom: latest?.asOf ?? null,
          windowTo: new Date(snapshot.asOf),
          blocks: {
            ...snapshot.blocks,
            subject,
            scopeRevision: scopeRevisionOf(briefing.scope),
          } as unknown as Prisma.InputJsonValue,
          evidenceRefs: snapshot.evidenceRefs as unknown as Prisma.InputJsonValue,
          evidenceRevision,
          coverageGaps: snapshot.coverageGaps as unknown as Prisma.InputJsonValue,
          sourceTurnId: turn.id,
        },
        select: { version: true, asOf: true, createdAt: true },
      });
      await tx.briefing.update({ where: { id: briefingId }, data: { status: 'ACTIVE' } });
      return { briefingId, ...created };
    });
  }

  /**
   * REASON TO RETURN R1 · §8 / G8 — RECORD ONE MANUAL CHECK OF A FOLLOWED QUESTION.
   *
   * The check itself was an ordinary Ask turn the reader explicitly sent (metered, quoted and
   * accepted like any other — this method runs no search and no model). Here we only compare
   * that turn's stored result with the latest version and record the outcome:
   *   - the turn must be the reader's own, ask exactly the followed question, and be newer than
   *     the latest version (an old turn cannot be passed off as a check);
   *   - a usable changed reading appends version n+1 (the baseline moves forward);
   *   - an unchanged, no-update, failed or partial check is recorded WITHOUT a version, so the
   *     last successful baseline stays intact and visible with its age;
   *   - recording the same turn twice returns the first record (idempotent).
   */
  async recordCheck(userId: string, briefingId: string, turnId: string) {
    this.user(userId);
    return this.atomic(async (tx) => {
      const briefing = await tx.briefing.findFirst({
        where: { id: briefingId, userId },
        select: {
          id: true,
          scope: true,
          status: true,
          versions: {
            orderBy: { version: 'desc' },
            take: 1,
            select: { version: true, asOf: true, createdAt: true, blocks: true, evidenceRefs: true },
          },
        },
      });
      if (!briefing) throw new NotFoundException();
      const existing = await tx.briefingCheck.findUnique({
        where: { briefingId_turnId: { briefingId, turnId } },
      });
      if (existing) return this.checkView(existing);
      if (briefing.status !== 'ACTIVE') {
        throw new ConflictException({ code: 'BRIEFING_NOT_ACTIVE', status: briefing.status });
      }

      const turn = await tx.askTurn.findFirst({
        where: { id: turnId, thread: { userId } },
        select: {
          id: true,
          question: true,
          operation: {
            select: {
              status: true,
              createdAt: true,
              storedResult: { select: { payload: true, evidenceRevision: true } },
            },
          },
        },
      });
      if (!turn) throw new NotFoundException();
      const followed = (briefing.scope as { question?: unknown } | null)?.question;
      if (typeof followed !== 'string' || !sameQuestion(turn.question, followed)) {
        throw new UnprocessableEntityException({ code: 'BRIEFING_CHECK_QUESTION_MISMATCH' });
      }
      const latest = briefing.versions[0] ?? null;
      if (latest !== null && turn.operation.createdAt <= latest.createdAt) {
        throw new UnprocessableEntityException({ code: 'BRIEFING_CHECK_TURN_NOT_NEWER' });
      }
      if (IN_FLIGHT.has(turn.operation.status)) {
        throw new ConflictException({ code: 'BRIEFING_CHECK_NOT_FINISHED' });
      }

      const payload =
        turn.operation.status === 'COMPLETED' ? (turn.operation.storedResult?.payload ?? null) : null;
      const snapshot = payload === null ? null : briefingSnapshotOf(payload);
      const analysis = (payload as { analysis?: unknown } | null)?.analysis ?? null;
      const candidate: FollowedCandidate = {
        snapshot:
          snapshot === null
            ? null
            : {
                asOf: snapshot.asOf,
                answerState: snapshot.blocks.answerState,
                summaryPresent: snapshot.blocks.summary !== null,
                keyFacts: snapshot.blocks.keyFacts,
                evidenceRefs: snapshot.evidenceRefs,
                /* the specialist contributions THIS check's turn stored — no reader is called here */
                intelligence: snapshot.blocks.intelligence,
              },
        retrievalFailed: retrievalFailed(analysis as { retrievalContext?: unknown } | null),
        unassessedSources: unassessedSourcesOf(analysis),
        scopeRevision: scopeRevisionOf(briefing.scope),
      };
      const assessment = assessFollowedCheck(latest === null ? null : baselineOf(latest), candidate);

      let resultingVersion: number | null = null;
      if (VERSIONING_OUTCOMES.has(assessment.outcome) && snapshot !== null) {
        const next = (latest?.version ?? 0) + 1;
        if (next > BRIEFING_VERSION_LIMIT) {
          throw new ConflictException({ code: 'BRIEFING_VERSION_LIMIT' });
        }
        const storyId = (briefing.scope as { storyId?: unknown } | null)?.storyId;
        const subject = await this.storySubject(tx, typeof storyId === 'string' ? storyId : undefined);
        const evidenceRevision = turn.operation.storedResult?.evidenceRevision ?? 'unrecorded';
        await tx.briefingVersion.create({
          data: {
            briefingId,
            version: next,
            asOf: new Date(snapshot.asOf),
            windowFrom: latest?.asOf ?? null,
            windowTo: new Date(snapshot.asOf),
            blocks: {
              ...snapshot.blocks,
              subject,
              scopeRevision: scopeRevisionOf(briefing.scope),
            } as unknown as Prisma.InputJsonValue,
            evidenceRefs: snapshot.evidenceRefs as unknown as Prisma.InputJsonValue,
            evidenceRevision,
            coverageGaps: snapshot.coverageGaps as unknown as Prisma.InputJsonValue,
            sourceTurnId: turn.id,
          },
        });
        resultingVersion = next;
      }
      const created = await tx.briefingCheck.create({
        data: {
          briefingId,
          turnId: turn.id,
          outcome: assessment.outcome,
          assessment: assessment as unknown as Prisma.InputJsonValue,
          baselineVersion: latest?.version ?? null,
          resultingVersion,
        },
      });
      /* the followed question moves to the top of My updates once it has been checked */
      await tx.briefing.update({ where: { id: briefingId }, data: { updatedAt: new Date() } });
      return this.checkView(created);
    });
  }

  private checkView(row: {
    id: string;
    turnId: string;
    outcome: string;
    assessment: unknown;
    baselineVersion: number | null;
    resultingVersion: number | null;
    checkedAt: Date;
  }) {
    return {
      id: row.id,
      turnId: row.turnId,
      outcome: row.outcome,
      assessment: row.assessment,
      baselineVersion: row.baselineVersion,
      resultingVersion: row.resultingVersion,
      checkedAt: row.checkedAt,
      aiExecuted: false,
    };
  }

  /**
   * REASON TO RETURN R1 · G8 — rename, pause / resume, or edit the followed question. Editing the
   * question bumps the scope revision: the next check starts a new baseline instead of comparing
   * answers to two different questions. Versions and checks already recorded are never rewritten.
   */
  async update(userId: string, id: string, input: BriefingUpdateInput) {
    this.user(userId);
    return this.atomic(async (tx) => {
      const row = await tx.briefing.findFirst({
        where: { id, userId },
        select: { id: true, scope: true, status: true },
      });
      if (!row) throw new NotFoundException();
      const data: Prisma.BriefingUpdateInput = {};
      if (input.title !== undefined) {
        const title = input.title.trim().slice(0, BRIEFING_TITLE_MAX);
        if (title === '') throw new UnprocessableEntityException({ code: 'BRIEFING_TITLE_EMPTY' });
        data.title = title;
      }
      if (input.status !== undefined) {
        if (row.status === 'ARCHIVED') throw new ConflictException({ code: 'BRIEFING_ARCHIVED' });
        data.status = input.status;
      }
      if (input.question !== undefined) {
        const question = input.question.normalize('NFC').trim();
        if (Array.from(question).length < 2) {
          throw new UnprocessableEntityException({ code: 'BRIEFING_QUESTION_EMPTY' });
        }
        const scope = (row.scope ?? {}) as Record<string, unknown>;
        if (typeof scope.question !== 'string' || !sameQuestion(scope.question, question)) {
          data.scope = {
            ...scope,
            question,
            scopeRevision: scopeRevisionOf(scope) + 1,
          } as Prisma.InputJsonValue;
        }
      }
      return tx.briefing.update({
        where: { id: row.id },
        data,
        select: { id: true, title: true, scope: true, status: true, updatedAt: true },
      });
    });
  }

  async list(userId: string) {
    this.user(userId);
    const rows = await this.prisma.briefing.findMany({
      where: { userId },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      take: BRIEFING_LIMIT_PER_USER,
      select: {
        id: true,
        title: true,
        scope: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        versions: { orderBy: { version: 'desc' }, take: 1, select: { version: true, asOf: true } },
        checks: {
          orderBy: { checkedAt: 'desc' },
          take: 1,
          select: { outcome: true, checkedAt: true, resultingVersion: true, assessment: true },
        },
      },
    });
    /* the last check that actually completed (not INCOMPLETE): "last successful check" */
    const ids = rows.map((r) => r.id);
    const successful =
      ids.length === 0
        ? []
        : await this.prisma.briefingCheck.groupBy({
            by: ['briefingId'],
            where: { briefingId: { in: ids }, outcome: { not: 'INCOMPLETE_CHECK' } },
            _max: { checkedAt: true },
          });
    const lastSuccess = new Map(successful.map((s) => [s.briefingId, s._max.checkedAt]));
    return rows.map(({ versions, checks, ...row }) => ({
      ...row,
      latestVersion: versions[0]?.version ?? null,
      latestAsOf: versions[0]?.asOf ?? null,
      latestCheck: checks[0] === undefined ? null : summaryOfCheck(checks[0]),
      lastSuccessfulCheckAt: lastSuccess.get(row.id) ?? null,
    }));
  }

  async get(userId: string, id: string) {
    this.user(userId);
    const row = await this.prisma.briefing.findFirst({
      where: { id, userId },
      select: {
        id: true,
        title: true,
        scope: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        versions: {
          orderBy: { version: 'asc' },
          select: {
            version: true,
            asOf: true,
            windowFrom: true,
            windowTo: true,
            createdAt: true,
            blocks: true,
          },
        },
        checks: {
          orderBy: { checkedAt: 'desc' },
          take: BRIEFING_CHECK_HISTORY,
          select: {
            id: true,
            turnId: true,
            outcome: true,
            assessment: true,
            baselineVersion: true,
            resultingVersion: true,
            checkedAt: true,
          },
        },
      },
    });
    if (!row) throw new NotFoundException();
    const latest = row.versions[row.versions.length - 1];
    return {
      ...row,
      versions: row.versions.map(({ blocks: _blocks, ...v }) => v),
      checks: row.checks.map((check) => this.checkView(check)),
      update: await this.updateOf(row.scope, latest?.blocks ?? null),
    };
  }

  /** One stored version, exactly as saved; no AI, no retrieval. */
  async getVersion(userId: string, id: string, version: number) {
    this.user(userId);
    const briefing = await this.prisma.briefing.findFirst({
      where: { id, userId },
      select: {
        id: true,
        title: true,
        versions: { orderBy: { version: 'desc' }, take: 1, select: { version: true } },
      },
    });
    if (!briefing) throw new NotFoundException();
    const row = await this.prisma.briefingVersion.findUnique({
      where: { briefingId_version: { briefingId: id, version } },
      select: {
        version: true,
        asOf: true,
        windowFrom: true,
        windowTo: true,
        blocks: true,
        evidenceRefs: true,
        evidenceRevision: true,
        coverageGaps: true,
        createdAt: true,
      },
    });
    if (!row) throw new NotFoundException();
    const latest = briefing.versions[0]?.version ?? version;
    return {
      briefingId: briefing.id,
      title: briefing.title,
      ...row,
      /* superseded is disclosed, never rewritten */
      supersededBy: latest > version ? latest : null,
      aiExecuted: false,
    };
  }

  async remove(userId: string, id: string) {
    this.user(userId);
    const outcome = await this.prisma.briefing.deleteMany({ where: { id, userId } });
    return { id, removed: outcome.count > 0 };
  }
}
