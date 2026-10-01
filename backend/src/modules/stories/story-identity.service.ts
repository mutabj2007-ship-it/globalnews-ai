import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  normalizeArticleUrl,
  STORY_IDENTITY_MAX_PUBLICATION_GAP_MS,
  type NewsArticle,
} from '@globalnews-ai/shared';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { articleRefMatchesUrl, computeArticleRef, isArticleRef } from '../news/identity/article-ref.util';
import { readPublishedAtBasis } from '../news/persistence/published-at-basis.util';
import { isWriteConflict } from '../follows/follows.service';
import { MAX_ALIAS_DEPTH, bringsNewEvidence, provableJoin, sourceHostOf } from './story-identity.rules';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * STAGE B — CANONICAL STORY IDENTITY (the one authority)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * - `articleRef` is never recomputed for an existing row and never rewritten: membership is
 *   keyed BY it. SavedStory is not read or written here — a saved article stays that article.
 * - READ NEVER WRITES. `resolveByArticleRef` and `aliasSet` are pure lookups; a story is
 *   created only by an explicit act (`ensureStoryForArticle` — first comment, first alert,
 *   operator backfill), and only for an article that is RETAINED and whose URL hashes to the
 *   articleRef. No story exists for an arbitrary URL.
 * - JOIN ONLY ON PROOF (story-identity.rules.ts → isSameStory). Unproven = singleton.
 * - MERGE is an operator act: the merged story becomes an ALIAS (status MERGED) of the
 *   survivor; its memberships move (previousStoryId kept), its comments and alerts keep their
 *   rows and are read through the alias set. A merge always raises the survivor's
 *   briefVersion to max(both)+1, so no alert can see a version number twice.
 * - SPLIT is an operator act: named articles move to a NEW story; comments and alerts stay
 *   with the original story (their subject); the split is audited, so Compare can say
 *   "separated by an editor" without guessing.
 * - Every change writes a StoryIdentityEvent. Alert events for a new version are written in
 *   the SAME transaction (dedup: UNIQUE (alertId, briefVersion)); nothing is delivered.
 */

type Tx = Prisma.TransactionClient;

export interface CanonicalStory {
  readonly storyId: string;
  readonly briefVersion: number;
  readonly briefUpdatedAt: Date | null;
  readonly discussionLockedAt: Date | null;
  /** Every story id that resolves to this one (itself first). Comments/alerts are read across it. */
  readonly aliasIds: readonly string[];
}

export type EnsureOutcome = 'EXISTING' | 'CREATED' | 'JOINED';

export interface BackfillReport {
  readonly processed: number;
  readonly created: number;
  readonly joined: number;
  readonly existing: number;
  readonly skipped: number;
  readonly nextCursor: string | null;
}

const RUNG3_CANDIDATES = 25;
export const MAX_BACKFILL_BATCH = 500;

function toArticle(row: {
  id: string;
  title: string;
  url: string;
  imageUrl: string | null;
  sourceId: string;
  sourceName: string;
  publishedAt: Date;
  publishedAtBasis: string;
}): NewsArticle {
  return {
    id: row.id,
    title: row.title,
    summary: '',
    url: row.url,
    imageUrl: row.imageUrl ?? undefined,
    sourceId: row.sourceId,
    sourceName: row.sourceName,
    category: 'world',
    sourcesCount: 1,
    publishedAt: row.publishedAt.toISOString(),
    publishedAtBasis: readPublishedAtBasis(row.publishedAtBasis),
  } as NewsArticle;
}

const ARTICLE_FIELDS = {
  id: true,
  title: true,
  url: true,
  imageUrl: true,
  sourceId: true,
  sourceName: true,
  publishedAt: true,
  publishedAtBasis: true,
} as const;

@Injectable()
export class StoryIdentityService {
  constructor(private readonly prisma: PrismaService) {}

  /** Serializable, retried on write conflict / unique race. Never runs a provider. */
  async atomic<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        const code = (error as { code?: string })?.code;
        if (attempt >= 7 || !(isWriteConflict(error) || code === 'P2002')) throw error;
      }
    }
  }

  // ── Deterministic lookup (read-only) ─────────────────────────────────────

  /** Follow mergedInto to the canonical story. Bounded; a cycle is impossible by CHECK + depth. */
  async canonicalOf(storyId: string, db: Tx | PrismaService = this.prisma) {
    let current = await db.story.findUnique({ where: { id: storyId } });
    for (let depth = 0; current && current.mergedIntoId !== null; depth++) {
      if (depth >= MAX_ALIAS_DEPTH) throw new ConflictException('STORY_ALIAS_DEPTH');
      current = await db.story.findUnique({ where: { id: current.mergedIntoId } });
    }
    return current;
  }

  /** The canonical story and every alias that resolves to it (breadth-first, bounded). */
  async aliasSet(canonicalId: string, db: Tx | PrismaService = this.prisma): Promise<string[]> {
    const ids = [canonicalId];
    let frontier = [canonicalId];
    for (let depth = 0; frontier.length > 0 && depth < MAX_ALIAS_DEPTH; depth++) {
      const next = await db.story.findMany({ where: { mergedIntoId: { in: frontier } }, select: { id: true }, orderBy: { id: 'asc' } });
      frontier = next.map((s) => s.id).filter((id) => !ids.includes(id));
      ids.push(...frontier);
    }
    return ids;
  }

  async describe(storyId: string, db: Tx | PrismaService = this.prisma): Promise<CanonicalStory | null> {
    const story = await this.canonicalOf(storyId, db);
    if (!story) return null;
    return {
      storyId: story.id,
      briefVersion: story.briefVersion,
      briefUpdatedAt: story.briefUpdatedAt,
      discussionLockedAt: story.discussionLockedAt,
      aliasIds: await this.aliasSet(story.id, db),
    };
  }

  /** articleRef → canonical story, or null when the article has no story yet. Never writes. */
  async resolveByArticleRef(articleRef: string, db: Tx | PrismaService = this.prisma): Promise<CanonicalStory | null> {
    if (!isArticleRef(articleRef)) return null;
    const member = await db.storyArticle.findUnique({ where: { articleRef }, select: { storyId: true } });
    return member === null ? null : this.describe(member.storyId, db);
  }

  /** Batched articleRef → canonical story id (read-only; absent refs are omitted). */
  async canonicalIdsByArticleRef(articleRefs: readonly string[]): Promise<Map<string, string>> {
    const refs = articleRefs.filter(isArticleRef);
    const out = new Map<string, string>();
    if (refs.length === 0) return out;
    const members = await this.prisma.storyArticle.findMany({ where: { articleRef: { in: refs } }, select: { articleRef: true, storyId: true } });
    const cache = new Map<string, string>();
    for (const m of members) {
      if (!cache.has(m.storyId)) {
        const canonical = await this.canonicalOf(m.storyId);
        if (canonical) cache.set(m.storyId, canonical.id);
      }
      const id = cache.get(m.storyId);
      if (id !== undefined) out.set(m.articleRef, id);
    }
    return out;
  }

  // ── Explicit creation (first comment / first alert / backfill) ──────────

  /**
   * Make sure a RETAINED article belongs to a story. The URL must hash to the articleRef and
   * the article must be retained; otherwise NotFound (no story for unknown reporting).
   */
  async ensureStoryForArticle(input: { articleRef: string; url: string }): Promise<{ story: CanonicalStory; outcome: EnsureOutcome }> {
    if (!articleRefMatchesUrl(input.articleRef, input.url)) throw new BadRequestException('REF_URL_MISMATCH');
    const existing = await this.resolveByArticleRef(input.articleRef);
    if (existing) return { story: existing, outcome: 'EXISTING' };

    const row = await this.findRetained(input.url);
    if (row === null) throw new NotFoundException('NOT_RETAINED');
    const outcome = await this.placeArticle(input.articleRef, row);
    const story = await this.resolveByArticleRef(input.articleRef);
    if (!story) throw new ConflictException('STORY_PLACEMENT_FAILED');
    return { story, outcome };
  }

  private async findRetained(url: string) {
    const trimmed = url.trim();
    if (!trimmed) return null;
    return this.prisma.article.findFirst({
      where: { url: { in: Array.from(new Set([trimmed, normalizeArticleUrl(trimmed)])) } },
      select: ARTICLE_FIELDS,
      orderBy: { id: 'asc' },
    });
  }

  /** Rung-3 candidates: same title (case-insensitive), inside the publication window. */
  private async rung3Candidates(row: { id: string; title: string; publishedAt: Date }) {
    if (row.title.trim().length === 0) return [];
    const gap = STORY_IDENTITY_MAX_PUBLICATION_GAP_MS;
    return this.prisma.article.findMany({
      where: {
        id: { not: row.id },
        title: { equals: row.title, mode: 'insensitive' },
        publishedAt: { gte: new Date(row.publishedAt.getTime() - gap), lte: new Date(row.publishedAt.getTime() + gap) },
      },
      select: ARTICLE_FIELDS,
      orderBy: [{ publishedAt: 'asc' }, { id: 'asc' }],
      take: RUNG3_CANDIDATES,
    });
  }

  private async placeArticle(articleRef: string, row: Parameters<typeof toArticle>[0]): Promise<EnsureOutcome> {
    const article = toArticle(row);
    const candidates = (await this.rung3Candidates(row)).map((c) => ({ article: toArticle(c), ref: computeArticleRef(c.url) }));
    const host = sourceHostOf(row.url);

    return this.atomic(async (tx) => {
      const already = await tx.storyArticle.findUnique({ where: { articleRef } });
      if (already) return 'EXISTING' as const;

      const members = candidates.length === 0
        ? []
        : await tx.storyArticle.findMany({ where: { articleRef: { in: candidates.map((c) => c.ref) } }, select: { articleRef: true, storyId: true } });
      const memberOf = new Map(members.map((m) => [m.articleRef, m.storyId]));
      const join = provableJoin(article, candidates.filter((c) => memberOf.has(c.ref)));

      if (join === null) {
        const story = await tx.story.create({ data: {} });
        await tx.storyArticle.create({ data: { storyId: story.id, articleRef, articleUrl: row.url, sourceHost: host } });
        await tx.storyIdentityEvent.create({ data: { kind: 'CREATE', storyId: story.id, articleRefs: [articleRef], briefVersion: 1 } });
        return 'CREATED' as const;
      }

      const canonical = await this.canonicalOf(memberOf.get(join.ref)!, tx);
      if (!canonical) throw new ConflictException('STORY_PLACEMENT_FAILED');
      const present = await tx.storyArticle.findMany({ where: { storyId: canonical.id }, select: { sourceHost: true } });
      await tx.storyArticle.create({ data: { storyId: canonical.id, articleRef, articleUrl: row.url, sourceHost: host } });
      const material = bringsNewEvidence(present.map((p) => p.sourceHost), [host]);
      const version = material ? canonical.briefVersion + 1 : canonical.briefVersion;
      await tx.storyIdentityEvent.create({ data: { kind: 'JOIN', storyId: canonical.id, articleRefs: [articleRef], briefVersion: version } });
      if (material) await this.raiseVersion(tx, canonical.id, version, 'NEW_EVIDENCE');
      return 'JOINED' as const;
    });
  }

  /** Set the new version and record one deduplicated in-app event per ACTIVE alert. */
  private async raiseVersion(tx: Tx, canonicalId: string, version: number, kind: 'NEW_EVIDENCE' | 'STORY_MERGED'): Promise<void> {
    await tx.story.update({ where: { id: canonicalId }, data: { briefVersion: version, briefUpdatedAt: new Date() } });
    await tx.storyIdentityEvent.create({ data: { kind: 'VERSION', storyId: canonicalId, briefVersion: version } });
    const aliasIds = await this.aliasSet(canonicalId, tx);
    const alerts = await tx.storyAlert.findMany({ where: { storyId: { in: aliasIds }, status: 'ACTIVE' }, select: { id: true } });
    if (alerts.length === 0) return;
    await tx.storyAlertEvent.createMany({
      data: alerts.map((a) => ({ alertId: a.id, storyId: canonicalId, briefVersion: version, kind })),
      skipDuplicates: true,
    });
  }

  // ── Operator acts (audited) ──────────────────────────────────────────────

  async merge(input: { survivorId: string; mergedId: string; actorId: string; reason: string }): Promise<CanonicalStory> {
    if (input.survivorId === input.mergedId) throw new BadRequestException('MERGE_SELF');
    await this.atomic(async (tx) => {
      const survivor = await tx.story.findUnique({ where: { id: input.survivorId } });
      const merged = await tx.story.findUnique({ where: { id: input.mergedId } });
      if (!survivor || !merged) throw new NotFoundException();
      if (survivor.status !== 'ACTIVE' || merged.status !== 'ACTIVE') throw new ConflictException('MERGE_REQUIRES_CANONICAL');

      const movedRefs = (await tx.storyArticle.findMany({ where: { storyId: merged.id }, select: { articleRef: true }, orderBy: { articleRef: 'asc' } })).map((m) => m.articleRef);
      await tx.storyArticle.updateMany({ where: { storyId: merged.id }, data: { storyId: survivor.id, previousStoryId: merged.id } });
      await tx.story.update({ where: { id: merged.id }, data: { status: 'MERGED', mergedIntoId: survivor.id } });

      // A reader alerting on both sides keeps ONE alert: the survivor's. The other is removed
      // (row kept, removedAt set) so the account never sees one change twice.
      const survivorOwners = (await tx.storyAlert.findMany({ where: { storyId: survivor.id }, select: { userId: true } })).map((a) => a.userId);
      if (survivorOwners.length > 0) {
        await tx.storyAlert.updateMany({
          where: { storyId: merged.id, userId: { in: survivorOwners }, status: { not: 'REMOVED' } },
          data: { status: 'REMOVED', removedAt: new Date() },
        });
      }

      // Discussion lock: the stricter state wins (a locked side stays locked).
      if (survivor.discussionLockedAt === null && merged.discussionLockedAt !== null) {
        await tx.story.update({ where: { id: survivor.id }, data: { discussionLockedAt: merged.discussionLockedAt, discussionLockReason: merged.discussionLockReason } });
      }

      const version = Math.max(survivor.briefVersion, merged.briefVersion) + 1;
      await tx.storyIdentityEvent.create({
        data: { kind: 'MERGE', storyId: survivor.id, otherStoryId: merged.id, articleRefs: movedRefs, briefVersion: version, actorId: input.actorId, reason: input.reason },
      });
      await this.raiseVersion(tx, survivor.id, version, 'STORY_MERGED');
    });
    const out = await this.describe(input.survivorId);
    if (!out) throw new NotFoundException();
    return out;
  }

  async split(input: { storyId: string; articleRefs: readonly string[]; actorId: string; reason: string }): Promise<{ original: CanonicalStory; created: CanonicalStory }> {
    const refs = Array.from(new Set(input.articleRefs));
    if (refs.length === 0 || !refs.every(isArticleRef)) throw new BadRequestException('SPLIT_REFS');
    const createdId = await this.atomic(async (tx) => {
      const story = await tx.story.findUnique({ where: { id: input.storyId } });
      if (!story) throw new NotFoundException();
      if (story.status !== 'ACTIVE') throw new ConflictException('SPLIT_REQUIRES_CANONICAL');
      const members = await tx.storyArticle.findMany({ where: { storyId: story.id }, select: { articleRef: true } });
      const memberRefs = new Set(members.map((m) => m.articleRef));
      if (!refs.every((r) => memberRefs.has(r))) throw new BadRequestException('SPLIT_REFS_NOT_MEMBERS');
      if (refs.length >= memberRefs.size) throw new BadRequestException('SPLIT_WOULD_EMPTY');

      const created = await tx.story.create({ data: {} });
      await tx.storyArticle.updateMany({ where: { articleRef: { in: refs } }, data: { storyId: created.id, previousStoryId: story.id } });
      await tx.storyIdentityEvent.create({
        data: { kind: 'SPLIT', storyId: story.id, otherStoryId: created.id, articleRefs: [...refs].sort(), briefVersion: story.briefVersion, actorId: input.actorId, reason: input.reason },
      });
      await tx.storyIdentityEvent.create({ data: { kind: 'CREATE', storyId: created.id, articleRefs: [...refs].sort(), briefVersion: 1, actorId: input.actorId, reason: input.reason } });
      return created.id;
    });
    const original = await this.describe(input.storyId);
    const created = await this.describe(createdId);
    if (!original || !created) throw new NotFoundException();
    return { original, created };
  }

  /** Did an editor explicitly separate these two canonical stories (a SPLIT between their alias sets)? */
  async separatedByEditor(firstCanonicalId: string, secondCanonicalId: string): Promise<boolean> {
    const [a, b] = await Promise.all([this.aliasSet(firstCanonicalId), this.aliasSet(secondCanonicalId)]);
    const hit = await this.prisma.storyIdentityEvent.findFirst({
      where: {
        kind: 'SPLIT',
        OR: [
          { storyId: { in: a }, otherStoryId: { in: b } },
          { storyId: { in: b }, otherStoryId: { in: a } },
        ],
      },
      select: { id: true },
    });
    return hit !== null;
  }

  /**
   * Conservative backfill over RETAINED articles, oldest first, in bounded batches. Each
   * article is placed exactly as a live ensure would place it: a join only on proof.
   * Re-runnable and idempotent (an article already placed is counted as existing).
   */
  async backfill(options: { limit?: number; cursor?: string | null } = {}): Promise<BackfillReport> {
    const limit = Math.max(1, Math.min(MAX_BACKFILL_BATCH, options.limit ?? 200));
    const rows = await this.prisma.article.findMany({
      where: options.cursor ? { id: { gt: options.cursor } } : {},
      select: ARTICLE_FIELDS,
      orderBy: { id: 'asc' },
      take: limit,
    });
    let created = 0;
    let joined = 0;
    let existing = 0;
    let skipped = 0;
    for (const row of rows) {
      if (!row.url?.trim()) {
        skipped++;
        continue;
      }
      const outcome = await this.placeArticle(computeArticleRef(row.url), row);
      if (outcome === 'CREATED') created++;
      else if (outcome === 'JOINED') joined++;
      else existing++;
    }
    return {
      processed: rows.length,
      created,
      joined,
      existing,
      skipped,
      nextCursor: rows.length === limit ? rows[rows.length - 1].id : null,
    };
  }
}
