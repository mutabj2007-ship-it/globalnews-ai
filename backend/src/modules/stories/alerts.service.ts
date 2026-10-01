import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { isArticleRef } from '../news/identity/article-ref.util';
import { authorLabelOf } from './discussion.service';
import { isLiveStatus, logicalAlert } from './alert-logic';
import { StoryIdentityService } from './story-identity.service';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * STAGE B — IN-APP ALERTS. Explicit, reader-owned, on a canonical story.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * NOT FOLLOW: nothing here reads or writes CountryFollow / interests, and following never
 * creates an alert. NOT WATCH: the dormant Watch runtime is not imported, activated or reused.
 * NO DELIVERY: there is no email, push, webhook, scheduler or provider call anywhere in this
 * module — an alert's events are rows a signed-in reader reads in the app. `alerts.delivery`
 * stays OFF because it does not exist.
 *
 * CHANGE IDENTITY: an event is written only when the canonical story's `briefVersion` rises
 * (a new source host proven to join, or an operator merge) — by StoryIdentityService, in the
 * same transaction, deduplicated by UNIQUE (alertId, briefVersion). This service never
 * invents a change: status is computed from stored versions and retained articles only.
 */

export type AlertOp = 'pause' | 'resume' | 'mute' | 'unmute' | 'remove' | 'restore';
export type AlertChangeState = 'NO_CHANGE_YET' | 'CHANGED' | 'NO_RETAINED_EVIDENCE';
export const ALERT_LIST_LIMIT = 100;
export const INBOX_LIMIT = 50;

export interface AlertView {
  readonly id: string;
  readonly storyId: string;
  readonly status: 'ACTIVE' | 'PAUSED';
  readonly muted: boolean;
  readonly change: AlertChangeState;
  readonly briefVersion: number;
  readonly createdBriefVersion: number;
  readonly lastChangeAt: string | null;
  readonly createdAt: string;
  readonly unread: number;
  readonly subject: { readonly articleRef: string; readonly title: string; readonly url: string; readonly sourceName: string } | null;
}

/** Pure: the honest status of one alert from stored facts. */
export function changeStateOf(input: { retained: boolean; briefVersion: number; createdBriefVersion: number }): AlertChangeState {
  if (!input.retained) return 'NO_RETAINED_EVIDENCE';
  return input.briefVersion > input.createdBriefVersion ? 'CHANGED' : 'NO_CHANGE_YET';
}

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identity: StoryIdentityService,
  ) {}

  /** All of the reader's rows across a canonical alias set (live and removed). */
  private async rowsForStory(userId: string, aliasIds: readonly string[]) {
    return this.prisma.storyAlert.findMany({ where: { userId, storyId: { in: [...aliasIds] } } });
  }

  /** The reader's LOGICAL alert on a canonical alias set (alert-logic.ts rank), or null. */
  private async findForStory(userId: string, aliasIds: readonly string[]) {
    return logicalAlert(await this.rowsForStory(userId, aliasIds));
  }

  /** The alias set of the canonical story a row currently belongs to. */
  private async aliasSetOfRow(storyId: string): Promise<readonly string[]> {
    const story = await this.identity.describe(storyId);
    return story?.aliasIds ?? [storyId];
  }

  /**
   * Explicit creation. Idempotent: a repeat returns the same logical alert; when only removed
   * rows exist, the best one is restored (never a second live row). The new row records the
   * article it was created FROM (originArticleRef) for split continuity.
   */
  async create(userId: string, input: { articleRef: string; url: string }): Promise<AlertView> {
    const { story } = await this.identity.ensureStoryForArticle(input);
    const existing = await this.findForStory(userId, story.aliasIds);
    if (existing) {
      if (existing.status === 'REMOVED') {
        await this.prisma.storyAlert.update({ where: { id: existing.id }, data: { status: 'ACTIVE', removedAt: null, createdBriefVersion: story.briefVersion } });
      }
      return this.view(userId, existing.id);
    }
    try {
      const row = await this.prisma.storyAlert.create({
        data: { userId, storyId: story.storyId, originArticleRef: input.articleRef, createdBriefVersion: story.briefVersion },
      });
      return this.view(userId, row.id);
    } catch (error) {
      if ((error as { code?: string })?.code !== 'P2002') throw error;
      const raced = await this.findForStory(userId, story.aliasIds);
      if (!raced) throw error;
      return this.view(userId, raced.id);
    }
  }

  /** The subject shown for an alert: its ORIGINATING article when still in the story, else the first retained member. */
  private async subjectOf(canonicalId: string, preferRef?: string | null): Promise<AlertView['subject']> {
    const members = await this.prisma.storyArticle.findMany({ where: { storyId: canonicalId }, orderBy: [{ addedAt: 'asc' }, { articleRef: 'asc' }], take: 20 });
    if (preferRef) members.sort((a, b) => Number(b.articleRef === preferRef) - Number(a.articleRef === preferRef));
    for (const m of members) {
      const article = await this.prisma.article.findFirst({ where: { url: m.articleUrl }, select: { title: true, url: true, sourceName: true } });
      if (article) return { articleRef: m.articleRef, title: article.title, url: article.url, sourceName: article.sourceName };
    }
    return null;
  }

  private async view(userId: string, alertId: string): Promise<AlertView> {
    const row = await this.prisma.storyAlert.findFirst({ where: { id: alertId, userId } });
    if (!row || row.status === 'REMOVED') throw new NotFoundException();
    const story = await this.identity.describe(row.storyId);
    if (!story) throw new NotFoundException();
    const subject = await this.subjectOf(story.storyId, row.originArticleRef);
    const unread = await this.prisma.storyAlertEvent.count({ where: { alertId: row.id, readAt: null } });
    return {
      id: row.id,
      storyId: story.storyId,
      status: row.status as 'ACTIVE' | 'PAUSED',
      muted: row.muted,
      change: changeStateOf({ retained: subject !== null, briefVersion: story.briefVersion, createdBriefVersion: row.createdBriefVersion }),
      briefVersion: story.briefVersion,
      createdBriefVersion: row.createdBriefVersion,
      lastChangeAt: story.briefVersion > row.createdBriefVersion && story.briefUpdatedAt ? story.briefUpdatedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      unread,
      subject,
    };
  }

  /** One entry per LOGICAL live alert (one per canonical story), newest first. */
  async list(userId: string): Promise<AlertView[]> {
    const rows = await this.prisma.storyAlert.findMany({
      where: { userId, status: { not: 'REMOVED' } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: ALERT_LIST_LIMIT,
    });
    const byCanonical = new Map<string, (typeof rows)[number][]>();
    for (const r of rows) {
      const canonical = (await this.identity.canonicalOf(r.storyId))?.id ?? r.storyId;
      byCanonical.set(canonical, [...(byCanonical.get(canonical) ?? []), r]);
    }
    const chosen = [...byCanonical.values()].map((list) => logicalAlert(list)!).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? -1 : 1));
    const out: AlertView[] = [];
    for (const r of chosen) out.push(await this.view(userId, r.id));
    return out;
  }

  /** For card state: which of these articles does the reader alert on (via the canonical story)? */
  async byArticle(userId: string, articleRefs: readonly string[]): Promise<Record<string, { alertId: string; status: string }>> {
    const refs = Array.from(new Set(articleRefs.filter(isArticleRef))).slice(0, 60);
    const canonical = await this.identity.canonicalIdsByArticleRef(refs);
    const out: Record<string, { alertId: string; status: string }> = {};
    for (const [ref, storyId] of canonical) {
      const alert = await this.findForStory(userId, await this.identity.aliasSet(storyId));
      if (alert && isLiveStatus(alert.status)) out[ref] = { alertId: alert.id, status: alert.status };
    }
    return out;
  }

  async apply(userId: string, alertId: string, op: AlertOp): Promise<AlertView | { id: string; status: 'REMOVED' }> {
    const row = await this.prisma.storyAlert.findFirst({ where: { id: alertId, userId } });
    if (!row) throw new NotFoundException();
    const now = new Date();
    switch (op) {
      case 'pause':
        if (row.status === 'REMOVED') throw new NotFoundException();
        await this.prisma.storyAlert.update({ where: { id: row.id }, data: { status: 'PAUSED' } });
        break;
      case 'resume':
        if (row.status === 'REMOVED') throw new NotFoundException();
        await this.prisma.storyAlert.update({ where: { id: row.id }, data: { status: 'ACTIVE' } });
        break;
      case 'mute':
      case 'unmute':
        if (row.status === 'REMOVED') throw new NotFoundException();
        await this.prisma.storyAlert.update({ where: { id: row.id }, data: { muted: op === 'mute' } });
        break;
      case 'remove':
        if (row.status !== 'REMOVED') await this.prisma.storyAlert.update({ where: { id: row.id }, data: { status: 'REMOVED', removedAt: now } });
        return { id: row.id, status: 'REMOVED' };
      case 'restore': {
        if (row.status !== 'REMOVED') break;
        // Never a second live row: if another alias row is already live, that one IS the
        // reader's logical alert and is returned unchanged.
        const live = (await this.rowsForStory(userId, await this.aliasSetOfRow(row.storyId))).filter((r) => r.id !== row.id && isLiveStatus(r.status));
        const winner = logicalAlert(live);
        if (winner !== null) return this.view(userId, winner.id);
        await this.prisma.storyAlert.update({ where: { id: row.id }, data: { status: 'ACTIVE', removedAt: null } });
        break;
      }
      default:
        throw new BadRequestException('ALERT_OP');
    }
    return this.view(userId, row.id);
  }

  // ── Inbox: Developments (alert events) and Replies (to the reader's comments) ──

  async inbox(userId: string, includeReplies: boolean) {
    const events = await this.prisma.storyAlertEvent.findMany({
      where: { alert: { userId, status: { not: 'REMOVED' } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: INBOX_LIMIT,
      include: { alert: { select: { id: true, muted: true, storyId: true, originArticleRef: true } } },
    });
    const subjects = new Map<string, AlertView['subject']>();
    const developments = [];
    for (const e of events) {
      const canonical = (await this.identity.canonicalOf(e.storyId))?.id ?? e.storyId;
      const key = `${canonical}:${e.alert.originArticleRef}`;
      if (!subjects.has(key)) subjects.set(key, await this.subjectOf(canonical, e.alert.originArticleRef));
      developments.push({
        id: e.id,
        alertId: e.alertId,
        kind: e.kind as 'NEW_EVIDENCE' | 'STORY_MERGED',
        briefVersion: e.briefVersion,
        createdAt: e.createdAt.toISOString(),
        read: e.readAt !== null,
        muted: e.alert.muted,
        subject: subjects.get(key) ?? null,
      });
    }
    const unreadDevelopments = await this.prisma.storyAlertEvent.count({ where: { readAt: null, alert: { userId, status: { not: 'REMOVED' }, muted: false } } });

    let replies: Array<{ id: string; createdAt: string; read: boolean; authorLabel: string | null; storyId: string }> = [];
    let unreadReplies = 0;
    if (includeReplies) {
      const cursor = await this.prisma.userInboxCursor.findUnique({ where: { userId } });
      const seenAt = cursor?.repliesSeenAt ?? new Date(0);
      const where = { state: 'VISIBLE', userId: { not: userId }, parent: { userId, state: { not: 'DELETED' } } };
      const rows = await this.prisma.storyComment.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: INBOX_LIMIT,
        select: { id: true, createdAt: true, storyId: true, user: { select: { displayName: true } } },
      });
      replies = rows.map((r) => ({ id: r.id, createdAt: r.createdAt.toISOString(), read: r.createdAt <= seenAt, authorLabel: authorLabelOf(r.user?.displayName), storyId: r.storyId }));
      unreadReplies = await this.prisma.storyComment.count({ where: { ...where, createdAt: { gt: seenAt } } });
    }
    return { developments, replies, unread: { developments: unreadDevelopments, replies: unreadReplies } };
  }

  async markRead(userId: string, eventId: string): Promise<void> {
    const updated = await this.prisma.storyAlertEvent.updateMany({ where: { id: eventId, alert: { userId }, readAt: null }, data: { readAt: new Date() } });
    if (updated.count === 0) {
      const exists = await this.prisma.storyAlertEvent.findFirst({ where: { id: eventId, alert: { userId } }, select: { id: true } });
      if (!exists) throw new NotFoundException();
    }
  }

  async markAllRead(userId: string): Promise<void> {
    const now = new Date();
    await this.prisma.storyAlertEvent.updateMany({ where: { alert: { userId }, readAt: null }, data: { readAt: now } });
    await this.prisma.userInboxCursor.upsert({ where: { userId }, create: { userId, repliesSeenAt: now }, update: { repliesSeenAt: now } });
  }
}
