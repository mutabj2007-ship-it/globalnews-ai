import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import type { MyIntelligenceFeedResponse, MyIntelligenceInterestsResponse } from '@globalnews-ai/shared';
import { CsrfGuard } from '../auth/csrf.guard';
import { MyIntelligenceInterestsService } from './my-intelligence-interests.service';
import { UpdateInterestsDto } from './dto/update-interests.dto';
import { RequireAuthGuard } from '../auth/require-auth.guard';
import { CurrentUser } from '../users/current-user.decorator';
import { MyIntelligenceFeedService } from './my-intelligence-feed.service';

/**
 * MY INTELLIGENCE R1 — the read-only retained feed.
 *
 * Mounted under /users/me so it travels through the already-proxied `users`
 * /api family. GET only: reading it never writes, never touches the visit
 * clock (POST /users/me/seen does that), never calls a provider or the AI.
 */
@Controller('users/me/intelligence')
@UseGuards(RequireAuthGuard)
export class MyIntelligenceController {
  constructor(
    private readonly feedService: MyIntelligenceFeedService,
    private readonly interestsService: MyIntelligenceInterestsService,
  ) {}

  @Get('feed')
  feed(@CurrentUser() user: { id: string }): Promise<MyIntelligenceFeedResponse> {
    return this.feedService.feed(user.id);
  }

  /** INTEREST + SELECTION HOOK R1 — the reader's explicit interests. Account data only. */
  @Get('interests')
  interests(@CurrentUser() user: { id: string }): Promise<MyIntelligenceInterestsResponse> {
    return this.interestsService.get(user.id);
  }

  /** One mutation replaces the set; an empty list clears it. CSRF-guarded like every account write. */
  @Put('interests')
  @UseGuards(CsrfGuard)
  replaceInterests(
    @CurrentUser() user: { id: string },
    @Body() body: UpdateInterestsDto,
  ): Promise<MyIntelligenceInterestsResponse> {
    return this.interestsService.replace(user.id, body.interests);
  }
}
