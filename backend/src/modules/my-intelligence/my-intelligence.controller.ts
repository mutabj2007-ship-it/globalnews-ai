import { Controller, Get, UseGuards } from '@nestjs/common';
import type { MyIntelligenceFeedResponse } from '@globalnews-ai/shared';
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
  constructor(private readonly feedService: MyIntelligenceFeedService) {}

  @Get('feed')
  feed(@CurrentUser() user: { id: string }): Promise<MyIntelligenceFeedResponse> {
    return this.feedService.feed(user.id);
  }
}
