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
        if (attempt >= 7 || !['P2034', 'P2002'].includes(code ?? '')) throw error;
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
            ...(input.storyId === undefined ? {} : { storyId: input.storyId }),
          },
          versions: {
            create: {
              version: 1,
              asOf: new Date(snapshot.asOf),
              windowFrom: null,
              windowTo: new Date(snapshot.asOf),
              blocks: snapshot.blocks as unknown as Prisma.InputJsonValue,
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
          versions: {
            orderBy: { version: 'desc' },
            take: 1,
            select: { version: true, asOf: true },
          },
        },
      });
      if (!briefing) throw new NotFoundException();
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
          blocks: snapshot.blocks as unknown as Prisma.InputJsonValue,
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
          select: { version: true, asOf: true, windowFrom: true, windowTo: true, createdAt: true },
        },
      },
    });
    if (!row) throw new NotFoundException();
    return row;
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
