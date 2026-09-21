import { Injectable, Logger } from '@nestjs/common';
import type { BetaCategory, BetaCategoryView, BetaDevelopment } from '@globalnews-ai/shared';
import { PrismaService } from '../../../database/prisma.service';
import { BETA_CATEGORY_MAPPINGS, matchesBetaCategory } from './beta-category.mapping';

/**
 * BETA-SIMPLE-ASK-SAND-1 §16/§17 — the simple public category surface.
 *
 * §16 is the governing rule and it is absolute:
 *
 *   "A click on Economy or Energy or Security must not automatically
 *    trigger expensive new synthesis."
 *
 * This service therefore reads ONLY already-stored Articles. It
 * injects PrismaService and nothing else — no NewsService, no
 * AnalysisService, no provider, no SignalsService. That is not a
 * stylistic preference: an injected retrieval service is an
 * invitation for a later change to call it, and §16's guarantee
 * should be visible in the constructor rather than relied upon in a
 * comment.
 *
 * WHY IT DOES NOT GO THROUGH ArticlePersistenceService, which already
 * has findRecent(): that service is a provider of NewsModule but is
 * not exported from it, so consuming it would mean editing
 * news.module.ts — a file the other CTO's active M64 lane is
 * currently modifying (confirmed in the §1 inspection: news.module.ts
 * is among the 97 dirty entries). §25 tells me to consume existing
 * retrieval contracts rather than redesign them, and the lowest-
 * collision way to read stored articles here is to read them
 * directly. No provider logic is duplicated — this is a SELECT.
 *
 * §17 asks for ONE reusable template, and this is its data half: all
 * five categories are served by this one method.
 */

/** Developments shown on a category surface. Enough to be useful, few enough to scan. */
const DEVELOPMENT_LIMIT = 12;

/**
 * How far back a "current developments" surface looks.
 *
 * Bounded so an idle corpus shows an honestly-empty surface rather
 * than month-old stories presented as current. §17 requires an
 * update/freshness signal, and a surface that silently reaches
 * further back the staler it gets would make that signal meaningless.
 */
const MAX_AGE_DAYS = 14;

/**
 * Rows scanned before term filtering.
 *
 * Term narrowing happens in application code (the terms are stems
 * matched against two columns; pushing that into SQL would mean a
 * dozen ILIKEs per query against an unindexed expression), so the
 * candidate pool has to be bounded or a large corpus would pull
 * unbounded rows into memory. 400 is comfortably more than
 * DEVELOPMENT_LIMIT needs even when most candidates are filtered out.
 */
const CANDIDATE_SCAN_LIMIT = 400;

@Injectable()
export class BetaCategoryService {
  private readonly logger = new Logger(BetaCategoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Builds a category view from stored intelligence.
   *
   * Never throws and never returns null: a public entry surface that
   * errors because the database hiccuped is worse than one that
   * honestly reports having nothing to show. An empty view is a real,
   * renderable state (§17's freshness and count fields carry the
   * truth), not a failure the user has to interpret.
   */
  async getCategoryView(
    category: BetaCategory,
    countryCode?: string,
  ): Promise<BetaCategoryView> {
    const mapping = BETA_CATEGORY_MAPPINGS[category];

    let rows: Array<{
      id: string;
      title: string;
      summary: string;
      url: string;
      sourceName: string;
      publishedAt: Date;
      countryCode: string | null;
      countryName: string | null;
    }> = [];

    try {
      rows = await this.prisma.article.findMany({
        where: {
          publishedAt: { gte: new Date(Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000) },
          ...(mapping.sourceCategories.length > 0
            ? { category: { in: [...mapping.sourceCategories] } }
            : {}),
          ...(countryCode ? { countryCode: countryCode.toUpperCase() } : {}),
        },
        orderBy: { publishedAt: 'desc' },
        take: CANDIDATE_SCAN_LIMIT,
        select: {
          id: true,
          title: true,
          summary: true,
          url: true,
          sourceName: true,
          publishedAt: true,
          countryCode: true,
          countryName: true,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Category view query failed for ${category}; returning an empty view. ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }

    const matched = rows.filter((row) => matchesBetaCategory(category, row));
    const developments: BetaDevelopment[] = matched.slice(0, DEVELOPMENT_LIMIT).map((row) => ({
      id: row.id,
      title: row.title,
      summary: row.summary,
      sourceName: row.sourceName,
      url: row.url,
      publishedAt: row.publishedAt.toISOString(),
      countryCode: row.countryCode ?? undefined,
      countryName: row.countryName ?? undefined,
    }));

    /**
     * §17 counts describe the MATCHED pool, not the rendered slice.
     * "12 developments, 47 sources" would be a lie if only 12 were
     * ever examined; the user is being told how much evidence stands
     * behind the surface, not how many cards are on screen.
     */
    const distinctSources = new Set(matched.map((row) => row.sourceName));
    const mapCountryCodes = [
      ...new Set(matched.map((row) => row.countryCode).filter((code): code is string => !!code)),
    ];

    const newest = matched[0]?.publishedAt;

    return {
      category,
      title: mapping.title,
      // §17's "current assessment" is deliberately ABSENT rather than
      // generated. Producing a narrative assessment here would be
      // exactly the "expensive new synthesis" §16 forbids. The field
      // exists on the contract so a stored, separately-produced
      // assessment can be attached later without a contract change.
      assessment: undefined,
      developments,
      countryCode: countryCode?.toUpperCase(),
      countryName: matched.find((row) => row.countryName)?.countryName ?? undefined,
      lastUpdatedAt: newest?.toISOString(),
      evidenceCount: matched.length,
      distinctSourceCount: distinctSources.size,
      mapCountryCodes,
      // §5/§16 — always CONTEXTUAL. Nothing above ran a model or a
      // provider, and the classifier independently caps this kind at
      // CONTEXTUAL too, so the two agree by construction.
      computeClass: 'CONTEXTUAL',
      entries: {
        ask: true,
        analysis: true,
        // §19 — Watch is a Professional capability. Offered as an
        // entry point only where the tier permits it, and no tier
        // does yet (see EntitlementService.resolveTier), so it is
        // reported honestly as unavailable rather than shown and
        // then refused.
        watch: false,
      },
    };
  }
}
