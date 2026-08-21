import { Injectable, Logger } from '@nestjs/common';
import { logWithRequestId } from '../../../observability/log-with-request-id';
import type { NewsArticle, NewsCategory } from '@globalnews-ai/shared';
import { PrismaService } from '../../../database/prisma.service';

interface FindRecentArticlesOptions {
  limit?: number;
  maxAgeMinutes?: number;
  category?: NewsCategory;
  query?: string;
}

interface ArticleCountryRelationInput {
  articleId: string;
  countryCode: string;
  countryName: string;
  relevanceScore: number;
  isRelevant: boolean;
}
interface FindRecentByCountryOptions {
  countryCode: string;
  limit?: number;
  maxAgeMinutes?: number;
  category?: NewsCategory;
  relevantOnly?: boolean;
}
@Injectable()
export class ArticlePersistenceService {
  private readonly logger = new Logger(ArticlePersistenceService.name);

  constructor(private readonly prisma: PrismaService) {}

  async persistMany(articles: NewsArticle[]): Promise<void> {
    if (articles.length === 0) {
      return;
    }

    try {
      await this.prisma.$transaction(
        articles.map((article) =>
          this.prisma.article.upsert({
            where: {
              url: article.url,
            },
            update: {
              title: article.title,
              summary: article.summary,
              imageUrl: article.imageUrl ?? null,
              sourceId: article.sourceId,
              sourceName: article.sourceName,
              sourcesCount: article.sourcesCount,
              category: article.category,
              publishedAt: new Date(article.publishedAt),
              confidenceScore:
                article.confidence !== undefined ? Math.round(article.confidence) : null,
              // M66.14B — the resolved canonical country, or NULL when the
              // article genuinely has none. Never a placeholder.
              countryCode: article.countryCode ?? null,
              countryName: article.countryName ?? null,
            },
            create: {
              id: article.id,
              title: article.title,
              summary: article.summary,
              url: article.url,
              imageUrl: article.imageUrl ?? null,
              sourceId: article.sourceId,
              sourceName: article.sourceName,
              sourcesCount: article.sourcesCount,
              category: article.category,
              publishedAt: new Date(article.publishedAt),
              confidenceScore:
                article.confidence !== undefined ? Math.round(article.confidence) : null,
              // M66.14B — the resolved canonical country, or NULL when the
              // article genuinely has none. Never a placeholder.
              countryCode: article.countryCode ?? null,
              countryName: article.countryName ?? null,
            },
          }),
        ),
      );
    } catch (error) {
      logWithRequestId(
        this.logger,
        'warn',
        `Failed to persist ${articles.length} article(s); continuing without database persistence`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  async persistCountryRelations(relations: ArticleCountryRelationInput[]): Promise<void> {
    if (relations.length === 0) {
      return;
    }

    try {
      await this.prisma.$transaction(
        relations.map((relation) =>
          this.prisma.articleCountry.upsert({
            where: {
              articleId_countryCode: {
                articleId: relation.articleId,
                countryCode: relation.countryCode,
              },
            },
            update: {
              countryName: relation.countryName,
              relevanceScore: relation.relevanceScore,
              isRelevant: relation.isRelevant,
            },
            create: {
              articleId: relation.articleId,
              countryCode: relation.countryCode,
              countryName: relation.countryName,
              relevanceScore: relation.relevanceScore,
              isRelevant: relation.isRelevant,
            },
          }),
        ),
      );
    } catch (error) {
      logWithRequestId(
        this.logger,
        'warn',
        `Failed to persist ${relations.length} article-country relation(s); continuing without country persistence`,
        error instanceof Error ? error : undefined,
      );
    }
  }
  async findRecentByCountry(options: FindRecentByCountryOptions): Promise<NewsArticle[]> {
    const {
      countryCode,
      limit = 20,
      maxAgeMinutes = 1440,
      category,
      relevantOnly = true,
    } = options;

    const safeLimit = Math.max(1, Math.min(limit, 100));

    const safeMaxAgeMinutes = Math.max(1, maxAgeMinutes);

    const normalizedCountryCode = countryCode.trim().toUpperCase();

    if (!normalizedCountryCode) {
      return [];
    }

    const cutoff = new Date(Date.now() - safeMaxAgeMinutes * 60 * 1000);

    try {
      const rows = await this.prisma.articleCountry.findMany({
        where: {
          countryCode: normalizedCountryCode,
          ...(relevantOnly ? { isRelevant: true } : {}),
          article: {
            publishedAt: {
              gte: cutoff,
            },
            ...(category ? { category } : {}),
          },
        },
        include: {
          article: true,
        },
        orderBy: [
          {
            relevanceScore: 'desc',
          },
          {
            article: {
              publishedAt: 'desc',
            },
          },
        ],
        take: safeLimit,
      });

      return rows.map((row) => ({
        id: row.article.id,
        title: row.article.title,
        summary: row.article.summary,
        url: row.article.url,
        imageUrl: row.article.imageUrl ?? undefined,
        sourceId: row.article.sourceId,
        sourceName: row.article.sourceName,
        category: row.article.category as NewsCategory,
        sourcesCount: row.article.sourcesCount,
        publishedAt: row.article.publishedAt.toISOString(),
        confidence: row.article.confidenceScore ?? undefined,
        countryCode: row.article.countryCode ?? undefined,
        countryName: row.article.countryName ?? undefined,
      }));
    } catch (error) {
      logWithRequestId(
        this.logger,
        'warn',
        `Failed to read recent articles for country "${normalizedCountryCode}" from database`,
        error instanceof Error ? error : undefined,
      );

      return [];
    }
  }
  async findRecent(options: FindRecentArticlesOptions = {}): Promise<NewsArticle[]> {
    const { limit = 20, maxAgeMinutes = 1440, category, query } = options;

    const safeLimit = Math.max(1, Math.min(limit, 100));

    const safeMaxAgeMinutes = Math.max(1, maxAgeMinutes);

    const normalizedQuery = query?.trim();

    const cutoff = new Date(Date.now() - safeMaxAgeMinutes * 60 * 1000);

    try {
      const rows = await this.prisma.article.findMany({
        where: {
          publishedAt: {
            gte: cutoff,
          },
          ...(category ? { category } : {}),
          ...(normalizedQuery
            ? {
                OR: [
                  {
                    title: {
                      contains: normalizedQuery,
                      mode: 'insensitive',
                    },
                  },
                  {
                    summary: {
                      contains: normalizedQuery,
                      mode: 'insensitive',
                    },
                  },
                  {
                    sourceName: {
                      contains: normalizedQuery,
                      mode: 'insensitive',
                    },
                  },
                ],
              }
            : {}),
        },
        orderBy: {
          publishedAt: 'desc',
        },
        take: safeLimit,
      });

      return rows.map((row) => ({
        id: row.id,
        title: row.title,
        summary: row.summary,
        url: row.url,
        imageUrl: row.imageUrl ?? undefined,
        sourceId: row.sourceId,
        sourceName: row.sourceName,
        category: row.category as NewsCategory,
        sourcesCount: row.sourcesCount,
        publishedAt: row.publishedAt.toISOString(),
        confidence: row.confidenceScore ?? undefined,
        countryCode: row.countryCode ?? undefined,
        countryName: row.countryName ?? undefined,
      }));
    } catch (error) {
      logWithRequestId(
        this.logger,
        'warn',
        'Failed to read recent articles from database; continuing without database fallback',
        error instanceof Error ? error : undefined,
      );

      return [];
    }
  }

  /**
   * Milestone #51 Phase B — resolves ONE article by its trusted
   * server-side identity (the same Prisma `article.id` primary key
   * `persistMany`'s upsert already writes/reads), so a story
   * selected via the World Map country feed can be resolved as a
   * genuine evidence anchor rather than trusted purely from
   * frontend-supplied text. Mirrors findRecent/findRecentByCountry's
   * own error-handling convention exactly: never throws, logs a
   * warning and returns null on any database failure (including when
   * the id genuinely doesn't exist), so a resolution failure always
   * degrades safely rather than crashing the request.
   */
  async findById(articleId: string): Promise<NewsArticle | null> {
    const normalizedId = articleId.trim();

    if (!normalizedId) {
      return null;
    }

    try {
      const row = await this.prisma.article.findUnique({
        where: { id: normalizedId },
      });

      if (!row) {
        return null;
      }

      return {
        id: row.id,
        title: row.title,
        summary: row.summary,
        url: row.url,
        imageUrl: row.imageUrl ?? undefined,
        sourceId: row.sourceId,
        sourceName: row.sourceName,
        category: row.category as NewsCategory,
        sourcesCount: row.sourcesCount,
        publishedAt: row.publishedAt.toISOString(),
        confidence: row.confidenceScore ?? undefined,
        countryCode: row.countryCode ?? undefined,
        countryName: row.countryName ?? undefined,
      };
    } catch (error) {
      logWithRequestId(
        this.logger,
        'warn',
        `Failed to resolve article "${normalizedId}" by id from database`,
        error instanceof Error ? error : undefined,
      );

      return null;
    }
  }
}
