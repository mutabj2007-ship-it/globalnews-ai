import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { RequireAuthGuard } from '../auth/require-auth.guard';
import { AdminPlatformEnabledGuard } from '../admin/admin-platform.guard';
import { AdminGuard } from '../admin/admin.guard';
import { CAPABILITIES } from '../admin/rbac/capabilities';
import { RequireCapability } from '../admin/rbac/require-capability.decorator';
import { StoryBriefService } from './story-brief.service';

/**
 * ADMIN ↔ PUBLIC CONTRACT (CTO §8) — Alpha Admin inspects the operational truth behind a Story
 * Brief through the SAME canonical identities the public view uses (no second store). Read-only,
 * zero compute, same guard stack + capability as the existing Admin story routes. Not behind
 * STORY_BRIEF_ENABLED: operators must be able to inspect while the public gate is OFF.
 */
@Controller('admin/stories')
@UseGuards(AdminPlatformEnabledGuard, RequireAuthGuard, AdminGuard)
export class AdminStoryBriefController {
  constructor(private readonly briefs: StoryBriefService) {}

  @Get(':storyId/brief')
  @RequireCapability(CAPABILITIES.NewsManage)
  async inspect(@Param('storyId', ParseUUIDPipe) storyId: string) {
    return this.briefs.adminInspect(storyId);
  }
}
