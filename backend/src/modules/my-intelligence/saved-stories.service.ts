import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  articleHost,
  MAX_SAVED_STORIES,
  normalizeArticleUrl,
  type SavedStoryListResponse,
  type SavedStoryView,
} from '@globalnews-ai/shared';
import { PrismaService } from '../../database/prisma.service';
import { ArticlePersistenceService } from '../news/persistence/article-persistence.service';
import { computeArticleRef, isArticleRef } from '../news/identity/article-ref.util';

interface SavedStoryRow {
  articleRef: string;
  canonicalUrl: string;
  sourceUrl: string;
  title: string;
  sourceName: string;
  sourceDomain: string;
  publishedAt: Date;
  publishedAtBasis: string;
  imageUrl: string | null;
  countryCodes: string[];
  savedAt: Date;
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MY INTELLIGENCE R1 — SAVED STORIES
 * ════════════════════════════════════════════════════════════════════════════
 *
 * IDENTITY is articleRef = sha256(normalizeArticleUrl(url)). A provider
 * article id may be sent, but only as a lookup hint: it can locate a retained
 * row, never decide which story is being saved.
 *
 * METADATA is resolved here, from the retained Article row. The client sends a
 * URL and nothing it says about the story is trusted. A story that is not in
 * retained reporting cannot be saved (404) — there is nothing trustworthy to
 * store for it.
 *
 * NEVER STORED: article body, provider summary or excerpt, AI answer,
 * generated briefing, publisher full text. The table has no column for them.
 *
 * COST: saving and removing are database operations only — no provider, no AI.
 */
@Injectable()
export class SavedStoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly articles: ArticlePersistenceService,
  ) {}

  async list(userId: string): Promise<SavedStoryListResponse> {
    const rows: SavedStoryRow[] = await this.prisma.savedStory.findMany({
      where: { userId },
      orderBy: { savedAt: 'desc' },
      take: MAX_SAVED_STORIES,
    });

    /* firstSeenAt comes from the retained Article when it still exists — read, never stored. */
    const retained = rows.length
      ? await this.prisma.article.findMany({
          where: { url: { in: rows.map((row) => row.sourceUrl) } },
          select: { url: true, fetchedAt: true },
        })
      : [];
    const firstSeenByUrl = new Map(
      retained.map((article: { url: string; fetchedAt: Date }) => [article.url, article.fetchedAt.toISOString()]),
    );

    return {
      stories: rows.map((row) => toView(row, firstSeenByUrl.get(row.sourceUrl))),
      limit: MAX_SAVED_STORIES,
    };
  }

  async save(userId: string, url: string, providerArticleId?: string): Promise<SavedStoryView> {
    const articleRef = computeArticleRef(url);

    const existing: SavedStoryRow | null = await this.prisma.savedStory.findUnique({
      where: { userId_articleRef: { userId, articleRef } },
    });
    /* Idempotent: a repeat save returns the story already saved, unchanged. */
    if (existing) {
      const retained = await this.articles.findRetainedByUrl(existing.sourceUrl);
      return toView(existing, retained?.article.firstSeenAt);
    }

    const record = await this.resolveRetained(url, providerArticleId, articleRef);
    if (!record) {
      throw new NotFoundException('This story is not available in retained reporting.');
    }

    const count = await this.prisma.savedStory.count({ where: { userId } });
    if (count >= MAX_SAVED_STORIES) {
      throw new ConflictException(`Saved Stories is limited to ${MAX_SAVED_STORIES} stories.`);
    }

    const { article, countryCodes } = record;
    const row: SavedStoryRow = await this.prisma.savedStory.upsert({
      where: { userId_articleRef: { userId, articleRef } },
      update: {},
      create: {
        userId,
        articleRef,
        canonicalUrl: normalizeArticleUrl(article.url),
        sourceUrl: article.url,
        providerArticleId: providerArticleId?.trim() || null,
        title: article.title,
        sourceName: article.sourceName,
        sourceDomain: articleHost(article.url) ?? '',
        publishedAt: new Date(article.publishedAt),
        publishedAtBasis: article.publishedAtBasis ?? 'publisher',
        imageUrl: article.imageUrl ?? null,
        countryCodes: [...countryCodes],
      },
    });
    return toView(row, article.firstSeenAt);
  }

  /** Idempotent: removing a story that is not saved is still a success. */
  async remove(userId: string, articleRef: string): Promise<void> {
    if (!isArticleRef(articleRef)) return;
    await this.prisma.savedStory.deleteMany({ where: { userId, articleRef } });
  }

  /**
   * The retained Article this URL identifies. The provider id hint is only
   * accepted when the row it finds has the SAME identity as the URL — a hint
   * can never make a different story be saved.
   */
  private async resolveRetained(url: string, providerArticleId: string | undefined, articleRef: string) {
    const byUrl = await this.articles.findRetainedByUrl(url);
    if (byUrl) return byUrl;

    const hint = providerArticleId?.trim();
    if (!hint) return null;
    const byHint = await this.articles.findById(hint);
    if (!byHint || computeArticleRef(byHint.url) !== articleRef) return null;
    return this.articles.findRetainedByUrl(byHint.url);
  }
}

function toView(row: SavedStoryRow, firstSeenAt?: string): SavedStoryView {
  return {
    articleRef: row.articleRef,
    canonicalUrl: row.canonicalUrl,
    sourceUrl: row.sourceUrl,
    title: row.title,
    sourceName: row.sourceName,
    sourceDomain: row.sourceDomain,
    publishedAt: row.publishedAt.toISOString(),
    publishedAtBasis: row.publishedAtBasis === 'observed' ? 'observed' : 'publisher',
    ...(row.imageUrl ? { imageUrl: row.imageUrl } : {}),
    countryCodes: row.countryCodes,
    savedAt: row.savedAt.toISOString(),
    ...(firstSeenAt ? { firstSeenAt } : {}),
  };
}
