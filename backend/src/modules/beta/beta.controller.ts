import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { isBetaCategory, resolveCountryByAnyIdentifier } from '@globalnews-ai/shared';
import type { BetaCategoryView } from '@globalnews-ai/shared';
import { BetaCategoryService } from './category/beta-category.service';

/**
 * BETA-SIMPLE-ASK-SAND-1 §15/§16/§17/§21 — the public Beta category API.
 *
 * @SkipThrottle, and the reasoning matters.
 *
 * The global 20/60s limit exists to protect cost-bearing work, and
 * POST /analysis/news tightens it to 5/60s for exactly that reason.
 * This route bears NO AI cost: it is a bounded SELECT over already-
 * stored articles (§16). Applying an AI-shaped rate limit to it would
 * throttle plain reading — which §7 says explicitly is not something
 * this product charges for, and §19 warns against by insisting
 * reading stored public intelligence "should remain generous".
 *
 * This is the same judgment the repository already applies to
 * GET /health, which opts out for its own reasons. The route remains
 * protected at the infrastructure layer like any other public read.
 */
@Controller('beta')
export class BetaController {
  constructor(private readonly categories: BetaCategoryService) {}

  /**
   * §17 — the reusable category view, for all five categories.
   *
   * A 400 for an unknown category, not a 404: the set of categories
   * is a closed, documented vocabulary (BETA_CATEGORIES), so an
   * unrecognised value is a malformed request rather than a missing
   * resource.
   */
  @SkipThrottle()
  @Get('categories/:category')
  async getCategory(
    @Param('category') category: string,
    @Query('country') country?: string,
  ): Promise<BetaCategoryView> {
    if (!isBetaCategory(category)) {
      throw new BadRequestException(`Unknown category: ${category}`);
    }

    /**
     * The country filter is RESOLVED, not passed through. An
     * unresolvable value becomes `undefined` (an unfiltered view)
     * rather than a query for a country that does not exist, which
     * would return an empty surface and look like a product failure
     * instead of a bad parameter.
     */
    const resolved = country ? resolveCountryByAnyIdentifier(country) : undefined;

    return this.categories.getCategoryView(category, resolved?.iso2);
  }
}
