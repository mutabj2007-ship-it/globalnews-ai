import { Injectable, Logger } from '@nestjs/common';
import { logWithRequestId } from '../../../observability/log-with-request-id';
import { readPublishedAtBasis, writePublishedAtBasis } from './published-at-basis.util';
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

/**
 * R0.5 — what `persistMany()` observed, keyed by the article's `url`.
 *
 * The key is `url` and NOT `id`, deliberately. The upsert below matches on
 * `url` (the table's only unique key) but writes `id` only inside `create:`,
 * so when two providers carry the same story the stored row keeps whichever
 * `id` was inserted first and the second provider's article carries an `id`
 * that matches no row. `url` is the identity the database actually uses, so
 * it is the only safe key for handing an observation back to a caller.
 *
 * The value is `Article.fetchedAt` rendered as an ISO 8601 string — the exact
 * value `findRecent()` / `findById()` already return as `firstSeenAt`, read
 * from the same column. It is never computed, never defaulted and never
 * derived from anything the provider supplied.
 *
 * An EMPTY map is a complete and honest answer: it means "this call recorded
 * no first observation", which is what a caller must render as an ABSENT
 * `firstSeenAt`. It is not an error signal and must never be treated as one.
 */
export type FirstSeenByUrl = ReadonlyMap<string, string>;

const NO_OBSERVATIONS: FirstSeenByUrl = new Map<string, string>();

@Injectable()
export class ArticlePersistenceService {
  private readonly logger = new Logger(ArticlePersistenceService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * R0.5 — persists the batch and RETURNS what the database observed.
   *
   * Before R0.5 this returned `Promise<void>` while Prisma was already
   * returning every upserted row (no `select:` was present, so all 17 columns
   * came back) and the result was discarded. The live read path was therefore
   * never missing `fetchedAt`; it was throwing it away. R0.5 removes that
   * discard and narrows the projection to the two columns actually needed, so
   * this round trip is SMALLER than it was before — no extra query, no extra
   * round trip, no extra transaction.
   *
   * Still non-fatal, exactly as before: any failure is logged at warn level
   * and swallowed, and the caller receives an empty map. A caller can now
   * distinguish "nothing was persisted" from "something was", and that
   * capability is deliberately NOT to be used as an error path, a `dataMode`
   * change, a `fallbackReason`, a new response field, or a retry. It means
   * one thing: omit `firstSeenAt`.
   */
  async persistMany(articles: NewsArticle[]): Promise<FirstSeenByUrl> {
    if (articles.length === 0) {
      return NO_OBSERVATIONS;
    }

    /*
     * ── R4 GDELT — THE BASIS TRAVELS WITH THE TIMESTAMP INTO THE STORE ──
     *
     * The first cut of this milestone REFUSED to persist an observed-basis
     * article, because `Article` had no column able to describe what kind of
     * time it held and `providerId` is not persisted either. A stored GDELT
     * row would have come back on the next read indistinguishable from an
     * outlet's own publication time — provenance lost silently rather than
     * loudly.
     *
     * The CTO approved the additive column, so the refusal is gone and the
     * basis is written like any other field. What replaces the filter is
     * READ-SIDE VALIDATION (published-at-basis.util.ts): the column is TEXT,
     * so an unrecognized value is treated as UNPROVEN on the way out rather
     * than being trusted as 'publisher'.
     *
     * An article with no basis is stored as 'publisher', matching the column
     * default. That is a true statement rather than a guess — see
     * writePublishedAtBasis for why write and read treat absence differently.
     */
    try {
      const rows = await this.prisma.$transaction(
        articles.map((article) =>
          this.prisma.article.upsert({
            where: {
              url: article.url,
            },
            // R0 INVARIANT — `fetchedAt` appears in NEITHER `create` nor
            // `update` below, and that is deliberate, not an omission.
            // `create` omits it so it is stamped exactly once at first
            // insert; `update` never mentions it, so re-observing the same
            // URL cannot move it.
            //
            // R0.5 CORRECTION, from reading the statements PostgreSQL
            // actually received: omitting it from `create` does NOT mean the
            // database's own DEFAULT CURRENT_TIMESTAMP fills it. Prisma
            // resolves `@default(now())` in this process and binds the value
            // as an explicit INSERT parameter; the column default is a
            // backstop this path never reaches. The invariant that matters is
            // unaffected and was verified in the emitted SQL: the statement
            // compiles to INSERT ... ON CONFLICT ("url") DO UPDATE SET
            // "title" = $n, "updatedAt" = $n — `fetchedAt` is absent from the
            // updated columns, so it is written once and never rewritten.
            // That is what makes NewsArticle.firstSeenAt honestly mean
            // "first observed" rather than "most recently seen". Adding
            // `fetchedAt` to `update` would silently destroy that meaning
            // for every article already stored.
            update: {
              title: article.title,
              summary: article.summary,
              imageUrl: article.imageUrl ?? null,
              sourceId: article.sourceId,
              sourceName: article.sourceName,
              sourcesCount: article.sourcesCount,
              category: article.category,
              publishedAt: new Date(article.publishedAt),
              // R4 GDELT — what kind of time the line above is.
              publishedAtBasis: writePublishedAtBasis(article.publishedAtBasis),
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
              // R4 GDELT — what kind of time the line above is.
              publishedAtBasis: writePublishedAtBasis(article.publishedAtBasis),
              confidenceScore:
                article.confidence !== undefined ? Math.round(article.confidence) : null,
              // M66.14B — the resolved canonical country, or NULL when the
              // article genuinely has none. Never a placeholder.
              countryCode: article.countryCode ?? null,
              countryName: article.countryName ?? null,
            },
            // R0.5 — the ONLY behavioural change to this query. Without a
            // `select` Prisma already returned every column and the caller
            // discarded them; naming the two we need makes the response
            // strictly smaller than it was before R0.5. `fetchedAt` is READ
            // here, never written — see the R0 INVARIANT above.
            select: {
              url: true,
              fetchedAt: true,
            },
          }),
        ),
      );

      const firstSeenByUrl = new Map<string, string>();

      // `$transaction` resolves only AFTER commit, so every row reaching this
      // loop describes state that is actually in the database. A rollback
      // rejects instead, and the catch below answers with an empty map — so
      // this can never report a first observation for a row that does not
      // exist. Verified natively rather than assumed: a batch whose last
      // statement violates a constraint leaves ZERO rows behind, and the
      // server log shows the whole batch wrapped in one BEGIN/COMMIT.
      //
      // Keyed by `url`, so two articles sharing one URL inside a single batch
      // collapse to one entry carrying the one correct value, and index drift
      // is impossible by construction.
      //
      // A row whose `fetchedAt` is not a real Date is DROPPED rather than
      // coerced. Absence is honest; a repaired timestamp would not be.
      for (const row of rows ?? []) {
        if (row?.url && row.fetchedAt instanceof Date) {
          firstSeenByUrl.set(row.url, row.fetchedAt.toISOString());
        }
      }

      return firstSeenByUrl;
    } catch (error) {
      logWithRequestId(
        this.logger,
        'warn',
        `Failed to persist ${articles.length} article(s); continuing without database persistence`,
        error instanceof Error ? error : undefined,
      );

      // Unchanged in spirit: the failure stays non-fatal and invisible to the
      // reader. The empty map is what makes `firstSeenAt` ABSENT rather than
      // guessed.
      return NO_OBSERVATIONS;
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
        // R4 GDELT — VALIDATED, not trusted. Same rule as the other two read
        // paths: an unrecognized stored value is UNPROVEN, never 'publisher'.
        publishedAtBasis: readPublishedAtBasis(row.article.publishedAtBasis),
        // R0 — the immutable first-observation timestamp. See
        // NewsArticle.firstSeenAt for the full semantic contract, and the
        // upsert above for why it is never rewritten.
        firstSeenAt: row.article.fetchedAt.toISOString(),
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
        // R4 GDELT — VALIDATED, not trusted. An unrecognized stored value
        // becomes undefined (UNPROVEN), never 'publisher'.
        publishedAtBasis: readPublishedAtBasis(row.publishedAtBasis),
        // R0 — see NewsArticle.firstSeenAt. Read straight from the
        // immutable database column; never derived from publishedAt and
        // never defaulted to "now" when reading.
        firstSeenAt: row.fetchedAt.toISOString(),
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
        // R4 GDELT — VALIDATED, not trusted. An unrecognized stored value
        // becomes undefined (UNPROVEN), never 'publisher'.
        publishedAtBasis: readPublishedAtBasis(row.publishedAtBasis),
        // R0 — see NewsArticle.firstSeenAt. Read straight from the
        // immutable database column; never derived from publishedAt and
        // never defaulted to "now" when reading.
        firstSeenAt: row.fetchedAt.toISOString(),
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
