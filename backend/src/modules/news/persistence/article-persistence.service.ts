import { Injectable, Logger } from '@nestjs/common';
import type {
  NewsArticle,
  NewsCategory,
} from '@globalnews-ai/shared';
import { PrismaService } from '../../../database/prisma.service';

interface FindRecentArticlesOptions {
  limit?: number;
  maxAgeMinutes?: number;
  category?: NewsCategory;
  query?: string;
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
                article.confidence !== undefined
                  ? Math.round(article.confidence)
                  : null,
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
                article.confidence !== undefined
                  ? Math.round(article.confidence)
                  : null,
            },
          }),
        ),
      );
    } catch (error) {
      this.logger.warn(
        `Failed to persist ${articles.length} article(s); continuing without database persistence`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  async findRecent(
    options: FindRecentArticlesOptions = {},
  ): Promise<NewsArticle[]> {
    const {
      limit = 20,
      maxAgeMinutes = 1440,
      category,
      query,
    } = options;

    const safeLimit = Math.max(1, Math.min(limit, 100));
    const safeMaxAgeMinutes = Math.max(1, maxAgeMinutes);
    const normalizedQuery = query?.trim();

    const cutoff = new Date(
      Date.now() - safeMaxAgeMinutes * 60 * 1000,
    );

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
        confidence:
          row.confidenceScore ?? undefined,
      }));
    } catch (error) {
      this.logger.warn(
        'Failed to read recent articles from database; continuing without database fallback',
        error instanceof Error ? error : undefined,
      );

      return [];
    }
  }
}