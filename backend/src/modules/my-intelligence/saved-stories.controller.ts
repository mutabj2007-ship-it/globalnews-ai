import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import type { SavedStoryListResponse, SavedStoryView } from '@globalnews-ai/shared';
import { RequireAuthGuard } from '../auth/require-auth.guard';
import { CsrfGuard } from '../auth/csrf.guard';
import { CurrentUser } from '../users/current-user.decorator';
import { SavedStoriesService } from './saved-stories.service';
import { SaveStoryDto } from './dto/save-story.dto';
import { ArticleRefParamsDto } from './dto/article-ref-params.dto';

/**
 * MY INTELLIGENCE R1 — Saved Stories. Authenticated; mutations require the
 * existing double-submit CSRF guard. No DTO carries a userId: the account is
 * always the session's. Database only: no provider, no AI.
 *
 * MOUNTED UNDER /users/me, deliberately. The contract named the resource
 * /saved/stories; a new top-level prefix would need an EIGHTH authenticated
 * /api proxy family, and frontend/next.config.mjs states the authenticated
 * set as exactly seven ("NOT ONE MORE"). The same resource under the existing
 * `users` family keeps that invariant: GET/POST /users/me/saved/stories and
 * DELETE /users/me/saved/stories/:articleRef.
 */
@Controller('users/me/saved')
@UseGuards(RequireAuthGuard)
export class SavedStoriesController {
  constructor(private readonly savedStories: SavedStoriesService) {}

  @Get('stories')
  list(@CurrentUser() user: { id: string }): Promise<SavedStoryListResponse> {
    return this.savedStories.list(user.id);
  }

  @Post('stories')
  @UseGuards(CsrfGuard)
  save(@CurrentUser() user: { id: string }, @Body() body: SaveStoryDto): Promise<SavedStoryView> {
    return this.savedStories.save(user.id, body.url, body.providerArticleId);
  }

  @Delete('stories/:articleRef')
  @UseGuards(CsrfGuard)
  @HttpCode(204)
  async remove(@CurrentUser() user: { id: string }, @Param() params: ArticleRefParamsDto): Promise<void> {
    await this.savedStories.remove(user.id, params.articleRef);
  }
}
