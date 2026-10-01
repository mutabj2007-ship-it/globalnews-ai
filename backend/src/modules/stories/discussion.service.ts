import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { isArticleRef } from '../news/identity/article-ref.util';
import { StoryIdentityService } from './story-identity.service';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * STAGE B — DISCUSSION. Reader conversation bound to a CANONICAL STORY.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * NEVER EVIDENCE. This module is imported by nothing in ask-v2, analysis, news retrieval,
 * evidence or prompt construction (structural spec: discussion-isolation.spec.ts). A comment
 * cannot reach an Ask answer, a source count, a prompt or a retrieval pool.
 *
 * - READ is public and never writes (an article with no story has an empty thread, count 0).
 * - COUNT is real: VISIBLE comments across the story's alias set, from the database. No
 *   placeholder, no estimate; a story with none reports none.
 * - BODIES of HIDDEN / REMOVED / DELETED comments are never returned to readers. An author's
 *   delete ERASES the text (body ''), a moderator's removal keeps it for the audit queue only.
 * - AUTHOR LABEL is the display name or null (the UI says "Reader"). Never an email or id.
 * - ONE REPLY LEVEL: a reply to a reply attaches to its top-level comment.
 * - MERGE CONTINUITY: comments keep their storyId; reads span the canonical alias set.
 */

export const MAX_COMMENT_LENGTH = 2000;
export const THREAD_LIMIT = 200;
export const COMMENT_RATE_WINDOW_MS = 10 * 60 * 1000;
export const COMMENT_RATE_LIMIT = 10;
export const REPORT_REASONS = ['SPAM', 'ABUSE', 'HARASSMENT', 'MISINFORMATION', 'OFF_TOPIC', 'OTHER'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export type CommentState = 'VISIBLE' | 'HIDDEN' | 'REMOVED' | 'DELETED';

export interface CommentView {
  readonly id: string;
  readonly parentId: string | null;
  readonly state: CommentState;
  readonly body: string | null;
  readonly authorLabel: string | null;
  readonly mine: boolean;
  readonly createdAt: string;
  readonly editedAt: string | null;
  readonly briefVersion: number;
}

export interface ThreadView {
  readonly articleRef: string;
  readonly storyId: string | null;
  readonly briefVersion: number | null;
  readonly locked: boolean;
  readonly count: number;
  readonly comments: readonly CommentView[];
}

type CommentRow = {
  id: string;
  parentId: string | null;
  state: string;
  body: string;
  userId: string;
  createdAt: Date;
  editedAt: Date | null;
  briefVersion: number;
  user: { displayName: string | null } | null;
};

export function authorLabelOf(displayName: string | null | undefined): string | null {
  const name = (displayName ?? '').trim();
  if (name.length === 0 || name.includes('@')) return null;
  return name.slice(0, 40);
}

/** The ONE reader projection. A non-VISIBLE body never leaves this function. */
export function commentView(row: CommentRow, viewerId: string | null): CommentView {
  const visible = row.state === 'VISIBLE';
  return {
    id: row.id,
    parentId: row.parentId,
    state: row.state as CommentState,
    body: visible ? row.body : null,
    authorLabel: visible ? authorLabelOf(row.user?.displayName) : null,
    mine: viewerId !== null && row.userId === viewerId,
    createdAt: row.createdAt.toISOString(),
    editedAt: visible && row.editedAt ? row.editedAt.toISOString() : null,
    briefVersion: row.briefVersion,
  };
}

export function normalizeBody(raw: unknown): string {
  if (typeof raw !== 'string') throw new BadRequestException('COMMENT_BODY');
  const body = raw.replace(/\r\n/g, '\n').trim();
  if (body.length === 0 || body.length > MAX_COMMENT_LENGTH) throw new BadRequestException('COMMENT_BODY');
  return body;
}

@Injectable()
export class DiscussionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identity: StoryIdentityService,
  ) {}

  private async countVisible(aliasIds: readonly string[]): Promise<number> {
    return this.prisma.storyComment.count({ where: { storyId: { in: [...aliasIds] }, state: 'VISIBLE' } });
  }

  /** Public thread. Read-only. */
  async thread(articleRef: string, viewerId: string | null): Promise<ThreadView> {
    if (!isArticleRef(articleRef)) throw new BadRequestException('ARTICLE_REF');
    const story = await this.identity.resolveByArticleRef(articleRef);
    if (story === null) return { articleRef, storyId: null, briefVersion: null, locked: false, count: 0, comments: [] };
    const rows = await this.prisma.storyComment.findMany({
      where: { storyId: { in: [...story.aliasIds] } },
      select: { id: true, parentId: true, state: true, body: true, userId: true, createdAt: true, editedAt: true, briefVersion: true, user: { select: { displayName: true } } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: THREAD_LIMIT,
    });
    // A non-visible comment is shown only as a placeholder that keeps its visible replies in place.
    const visibleParents = new Set(rows.filter((r) => r.state === 'VISIBLE' && r.parentId !== null).map((r) => r.parentId));
    const shown = rows.filter((r) => r.state === 'VISIBLE' || (r.parentId === null && visibleParents.has(r.id)));
    return {
      articleRef,
      storyId: story.storyId,
      briefVersion: story.briefVersion,
      locked: story.discussionLockedAt !== null,
      count: await this.countVisible(story.aliasIds),
      comments: shown.map((r) => commentView(r, viewerId)),
    };
  }

  /** Batched real counts: only refs with a story AND at least one visible comment appear. */
  async counts(articleRefs: readonly string[]): Promise<Record<string, number>> {
    const refs = Array.from(new Set(articleRefs.filter(isArticleRef))).slice(0, 60);
    const canonical = await this.identity.canonicalIdsByArticleRef(refs);
    const out: Record<string, number> = {};
    const byStory = new Map<string, number>();
    for (const [ref, storyId] of canonical) {
      if (!byStory.has(storyId)) byStory.set(storyId, await this.countVisible(await this.identity.aliasSet(storyId)));
      const n = byStory.get(storyId)!;
      if (n > 0) out[ref] = n;
    }
    return out;
  }

  async post(userId: string, input: { articleRef: string; url: string; body: unknown; parentId?: string | null; idempotencyKey: string }): Promise<CommentView> {
    const body = normalizeBody(input.body);
    const prior = await this.prisma.storyComment.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey: input.idempotencyKey } },
      include: { user: { select: { displayName: true } } },
    });
    if (prior) return commentView(prior, userId);

    const recent = await this.prisma.storyComment.count({ where: { userId, createdAt: { gte: new Date(Date.now() - COMMENT_RATE_WINDOW_MS) } } });
    if (recent >= COMMENT_RATE_LIMIT) throw new HttpException('COMMENT_RATE_LIMITED', HttpStatus.TOO_MANY_REQUESTS);

    const { story } = await this.identity.ensureStoryForArticle({ articleRef: input.articleRef, url: input.url });
    if (story.discussionLockedAt !== null) throw new ConflictException('DISCUSSION_LOCKED');

    let parentId: string | null = null;
    if (input.parentId) {
      const parent = await this.prisma.storyComment.findUnique({ where: { id: input.parentId } });
      if (!parent || !story.aliasIds.includes(parent.storyId)) throw new NotFoundException('PARENT');
      if (parent.state !== 'VISIBLE') throw new ConflictException('PARENT_NOT_VISIBLE');
      parentId = parent.parentId ?? parent.id;
    }

    try {
      const row = await this.prisma.storyComment.create({
        data: { storyId: story.storyId, userId, parentId, body, briefVersion: story.briefVersion, originArticleRef: input.articleRef, idempotencyKey: input.idempotencyKey },
        include: { user: { select: { displayName: true } } },
      });
      return commentView(row, userId);
    } catch (error) {
      if ((error as { code?: string })?.code !== 'P2002') throw error;
      const raced = await this.prisma.storyComment.findUniqueOrThrow({
        where: { userId_idempotencyKey: { userId, idempotencyKey: input.idempotencyKey } },
        include: { user: { select: { displayName: true } } },
      });
      return commentView(raced, userId);
    }
  }

  private async own(userId: string, commentId: string) {
    const row = await this.prisma.storyComment.findFirst({ where: { id: commentId, userId } });
    if (!row) throw new NotFoundException();
    return row;
  }

  private async assertUnlocked(storyId: string): Promise<void> {
    const story = await this.identity.canonicalOf(storyId);
    if (story?.discussionLockedAt) throw new ConflictException('DISCUSSION_LOCKED');
  }

  async edit(userId: string, commentId: string, rawBody: unknown): Promise<CommentView> {
    const body = normalizeBody(rawBody);
    const row = await this.own(userId, commentId);
    if (row.state !== 'VISIBLE') throw new ConflictException('COMMENT_NOT_EDITABLE');
    await this.assertUnlocked(row.storyId);
    const updated = await this.prisma.storyComment.update({
      where: { id: row.id },
      data: { body, editedAt: new Date() },
      include: { user: { select: { displayName: true } } },
    });
    return commentView(updated, userId);
  }

  /** The author's delete erases the text. Idempotent. */
  async remove(userId: string, commentId: string): Promise<void> {
    const row = await this.own(userId, commentId);
    if (row.state === 'DELETED') return;
    await this.prisma.storyComment.update({ where: { id: row.id }, data: { state: 'DELETED', body: '', deletedAt: new Date() } });
  }

  /** Once per reader per comment; a reader cannot report their own comment. */
  async report(userId: string, commentId: string, reason: string): Promise<void> {
    if (!(REPORT_REASONS as readonly string[]).includes(reason)) throw new BadRequestException('REPORT_REASON');
    const row = await this.prisma.storyComment.findUnique({ where: { id: commentId } });
    if (!row || row.state === 'DELETED') throw new NotFoundException();
    if (row.userId === userId) throw new ForbiddenException('REPORT_OWN');
    await this.prisma.storyCommentReport.createMany({ data: [{ commentId, userId, reason }], skipDuplicates: true });
  }

  // ── Moderation (admin routes only; authorization is the guard stack) ────

  async moderate(actorId: string, commentId: string, action: 'HIDE' | 'REMOVE' | 'RESTORE', reason: string): Promise<{ state: CommentState }> {
    const row = await this.prisma.storyComment.findUnique({ where: { id: commentId } });
    if (!row) throw new NotFoundException();
    if (row.state === 'DELETED') throw new ConflictException('COMMENT_DELETED_BY_AUTHOR');
    const state: CommentState = action === 'HIDE' ? 'HIDDEN' : action === 'REMOVE' ? 'REMOVED' : 'VISIBLE';
    await this.prisma.$transaction([
      this.prisma.storyComment.update({ where: { id: row.id }, data: { state } }),
      this.prisma.storyModerationAction.create({ data: { action, storyId: row.storyId, commentId: row.id, actorId, reason } }),
    ]);
    return { state };
  }

  async setLock(actorId: string, storyId: string, locked: boolean, reason: string): Promise<{ locked: boolean }> {
    const story = await this.identity.canonicalOf(storyId);
    if (!story) throw new NotFoundException();
    await this.prisma.$transaction([
      this.prisma.story.update({
        where: { id: story.id },
        data: locked ? { discussionLockedAt: new Date(), discussionLockReason: reason } : { discussionLockedAt: null, discussionLockReason: null },
      }),
      this.prisma.storyModerationAction.create({ data: { action: locked ? 'LOCK' : 'UNLOCK', storyId: story.id, actorId, reason } }),
    ]);
    return { locked };
  }

  /** Reported comments, most reported first. Moderators see the body (never to readers). */
  async reportQueue() {
    const grouped = await this.prisma.storyCommentReport.groupBy({
      by: ['commentId'],
      _count: { commentId: true },
      orderBy: { _count: { commentId: 'desc' } },
      take: 100,
    });
    if (grouped.length === 0) return [];
    const rows = await this.prisma.storyComment.findMany({
      where: { id: { in: grouped.map((g) => g.commentId) }, state: { in: ['VISIBLE', 'HIDDEN'] } },
      select: { id: true, storyId: true, state: true, body: true, createdAt: true, reports: { select: { reason: true } } },
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return grouped
      .filter((g) => byId.has(g.commentId))
      .map((g) => {
        const r = byId.get(g.commentId)!;
        return { id: r.id, storyId: r.storyId, state: r.state, body: r.body, createdAt: r.createdAt.toISOString(), reports: g._count.commentId, reasons: Array.from(new Set(r.reports.map((x) => x.reason))).sort() };
      });
  }
}
