import { Injectable, Logger } from '@nestjs/common';
import type { NewsArticle } from '@globalnews-ai/shared';
import { PrismaService } from '../../../database/prisma.service';

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
}