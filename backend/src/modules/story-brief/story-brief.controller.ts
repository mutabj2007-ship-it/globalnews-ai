import { BadRequestException, Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { AskRequestContextInterceptor } from '../ask-v2/ask-request-context';
import { Throttle } from '@nestjs/throttler';
import { RequireAuthGuard } from '../auth/require-auth.guard';
import { CsrfGuard } from '../auth/csrf.guard';
import { CurrentUser } from '../users/current-user.decorator';
import { StoryBriefService, type StoryBriefView } from './story-brief.service';
import { StoryBriefGate } from '../stories/story-gate.guards';
import { ParseArticleRefPipe } from '../stories/parse-article-ref.pipe';

/**
 * EA-STORY-BRIEF-01 — the canonical Story Brief surface (STORY_BRIEF_ENABLED, default OFF → 404).
 *   GET  /stories/by-article/:articleRef  public canonical resolution (articleRef → storyId,
 *                                  materialVersion); read-only, no Discussion dependency.
 *   GET  /stories/:storyId/brief   public, ZERO COMPUTE: the current Brief, STALE / CHECKING /
 *                                  FAILED / NOT_GENERATED, and whether generation is available.
 *   POST /stories/:storyId/brief   the explicit Read Brief / stale refresh: SIGNED-IN + CSRF only
 *                                  (guests may read, never generate — CTO §3). Reuses a current
 *                                  Brief (zero compute); otherwise one deduplicated attempt,
 *                                  generated through the governed Ask path.
 */
@Controller('stories')
export class StoryBriefController {
  constructor(private readonly briefs: StoryBriefService) {}

  /**
   * CTO baseline §2 — the public canonical story resolution the visual uses to find a story's
   * Brief. Read-only, zero compute, no user identity, and NOT dependent on Discussion: Read Brief
   * never needs Discussion ON to discover story identity. Declared before ':storyId/brief'.
   */
  @UseGuards(StoryBriefGate)
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @Get('by-article/:articleRef')
  async byArticle(@Param('articleRef', ParseArticleRefPipe) articleRef: string) {
    return this.briefs.resolveByArticle(articleRef);
  }

  /** ASK RELIABILITY R1 (§9) — signed-in + CSRF: place a retained article in its canonical story. */
  @UseGuards(StoryBriefGate, RequireAuthGuard, CsrfGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('by-article/:articleRef/ensure')
  @HttpCode(200)
  async ensure(@Param('articleRef', ParseArticleRefPipe) articleRef: string, @Body() body: { url?: unknown }) {
    if (typeof body?.url !== 'string' || body.url.length === 0 || body.url.length > 2048) {
      throw new BadRequestException('url is required');
    }
    return this.briefs.ensureByArticle(articleRef, body.url);
  }

  @UseGuards(StoryBriefGate)
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @Get(':storyId/brief')
  async read(@Param('storyId', ParseUUIDPipe) storyId: string): Promise<StoryBriefView> {
    return this.briefs.read(storyId);
  }

  @UseGuards(StoryBriefGate, RequireAuthGuard, CsrfGuard)
  /* The governed Ask run needs the SAME request context every Ask route carries (account + trusted
     IP scope): it is what the per-account / per-IP budgets are enforced against. */
  @UseInterceptors(AskRequestContextInterceptor)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post(':storyId/brief')
  @HttpCode(200)
  async request(@CurrentUser() user: { id: string }, @Param('storyId', ParseUUIDPipe) storyId: string): Promise<StoryBriefView> {
    return this.briefs.request(storyId, { userId: user.id });
  }
}
