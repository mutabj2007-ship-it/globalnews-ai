import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { RequireAuthGuard } from '../auth/require-auth.guard';
import { CsrfGuard } from '../auth/csrf.guard';
import { AdminPlatformEnabledGuard } from '../admin/admin-platform.guard';
import { AdminGuard, type AdminContext } from '../admin/admin.guard';
import { CurrentAdmin } from '../admin/current-admin.decorator';
import { CAPABILITIES } from '../admin/rbac/capabilities';
import { RequireCapability } from '../admin/rbac/require-capability.decorator';
import { DiscussionService } from './discussion.service';
import { StoryIdentityService } from './story-identity.service';
import { ParseArticleRefPipe } from './parse-article-ref.pipe';
import { BackfillDto, LockDiscussionDto, MergeStoriesDto, ModerateCommentDto, SplitStoryDto } from './stories.dto';

/**
 * STAGE B — operator acts on canonical stories and their discussion.
 *
 * AUTHORIZATION is the existing admin stack, unchanged: AdminPlatformEnabledGuard →
 * RequireAuthGuard → AdminGuard → @RequireCapability(news.manage) (SUPER_ADMIN, ADMIN); every
 * mutation adds the CSRF double-submit. No new capability is minted. Every act is audited
 * (StoryIdentityEvent / StoryModerationAction) with the operator id and a stated reason.
 * Moderation stays available while the reader gates are OFF (rollback must stay moderatable).
 */
@Controller('admin/stories')
@UseGuards(AdminPlatformEnabledGuard, RequireAuthGuard, AdminGuard)
export class AdminStoriesController {
  constructor(
    private readonly identity: StoryIdentityService,
    private readonly discussion: DiscussionService,
  ) {}

  @Get('by-article/:articleRef')
  @RequireCapability(CAPABILITIES.NewsManage)
  async byArticle(@Param('articleRef', ParseArticleRefPipe) articleRef: string) {
    return { story: await this.identity.resolveByArticleRef(articleRef) };
  }

  @Post('merge')
  @RequireCapability(CAPABILITIES.NewsManage)
  @UseGuards(CsrfGuard)
  @HttpCode(200)
  async merge(@CurrentAdmin() admin: AdminContext, @Body() dto: MergeStoriesDto) {
    return { story: await this.identity.merge({ survivorId: dto.survivorId, mergedId: dto.mergedId, actorId: admin.id, reason: dto.reason }) };
  }

  @Post(':id/split')
  @RequireCapability(CAPABILITIES.NewsManage)
  @UseGuards(CsrfGuard)
  @HttpCode(200)
  async split(@CurrentAdmin() admin: AdminContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SplitStoryDto) {
    return this.identity.split({ storyId: id, articleRefs: dto.articleRefs, actorId: admin.id, reason: dto.reason });
  }

  @Post('backfill')
  @RequireCapability(CAPABILITIES.NewsManage)
  @UseGuards(CsrfGuard)
  @HttpCode(200)
  async backfill(@Body() dto: BackfillDto) {
    return this.identity.backfill({ limit: dto.limit, cursor: dto.cursor ?? null });
  }

  @Get('discussion/reports')
  @RequireCapability(CAPABILITIES.NewsManage)
  async reports() {
    return { reports: await this.discussion.reportQueue() };
  }

  @Post('discussion/comments/:id/moderate')
  @RequireCapability(CAPABILITIES.NewsManage)
  @UseGuards(CsrfGuard)
  @HttpCode(200)
  async moderate(@CurrentAdmin() admin: AdminContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ModerateCommentDto) {
    return this.discussion.moderate(admin.id, id, dto.action, dto.reason);
  }

  @Post(':id/discussion/lock')
  @RequireCapability(CAPABILITIES.NewsManage)
  @UseGuards(CsrfGuard)
  @HttpCode(200)
  async lock(@CurrentAdmin() admin: AdminContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: LockDiscussionDto) {
    return this.discussion.setLock(admin.id, id, dto.locked, dto.reason);
  }
}
