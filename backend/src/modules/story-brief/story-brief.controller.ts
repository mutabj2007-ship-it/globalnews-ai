import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { AskRequestContextInterceptor } from '../ask-v2/ask-request-context';
import { Throttle } from '@nestjs/throttler';
import { RequireAuthGuard } from '../auth/require-auth.guard';
import { CsrfGuard } from '../auth/csrf.guard';
import { CurrentUser } from '../users/current-user.decorator';
import { StoryBriefService, type StoryBriefView } from './story-brief.service';
import { StoryBriefGate } from '../stories/story-gate.guards';

/**
 * EA-STORY-BRIEF-01 — the canonical Story Brief surface (STORY_BRIEF_ENABLED, default OFF → 404).
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
