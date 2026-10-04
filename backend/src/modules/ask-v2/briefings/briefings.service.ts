import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  ALL_ISO3_CODES,
  BRIEFING_UNAVAILABLE_GOVERNED_EVIDENCE,
  briefingPreservesEvidence,
} from '@globalnews-ai/shared';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import { readStoryMaterialVersion } from '../../stories/story-relation.read';
import { briefingSnapshotOf } from './briefing-snapshot';

type Tx = Prisma.TransactionClient;

export const BRIEFING_LIMIT_PER_USER = 100;
export const BRIEFING_VERSION_LIMIT = 50;
export const BRIEFING_TITLE_MAX = 160;

export interface BriefingScopeInput {
  readonly countryCode?: string;
  readonly storyId?: string;
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
    /* CTO Politics ruling (briefings) — the snapshot cannot carry governed specialist evidence, so an answer
       that rests on it is refused BEFORE any write (create and addVersion both pass here first). */
    if (stored && !briefingPreservesEvidence(stored.payload)) {
      throw new UnprocessableEntityException({ code: BRIEFING_UNAVAILABLE_GOVERNED_EVIDENCE });
    }
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
            ...(countryCode === undefined ? {} : { countryCode }),
            ...(subject === null ? {} : { storyId: subject.storyId }),
          },
          versions: {
            create: {
              version: 1,
              asOf: new Date(snapshot.asOf),
              windowFrom: null,
              windowTo: new Date(snapshot.asOf),
              blocks: { ...snapshot.blocks, subject } as unknown as Prisma.InputJsonValue,
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
          blocks: { ...snapshot.blocks, subject } as unknown as Prisma.InputJsonValue,
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
      },
    });
    return rows.map(({ versions, ...row }) => ({
      ...row,
      latestVersion: versions[0]?.version ?? null,
      latestAsOf: versions[0]?.asOf ?? null,
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
      },
    });
    if (!row) throw new NotFoundException();
    const latest = row.versions[row.versions.length - 1];
    return {
      ...row,
      versions: row.versions.map(({ blocks: _blocks, ...v }) => v),
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
