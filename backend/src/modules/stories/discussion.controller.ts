import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { RequireAuthGuard } from '../auth/require-auth.guard';
import { CsrfGuard } from '../auth/csrf.guard';
import { SessionService } from '../auth/session.service';
import { resolveAuthCookieNames } from '../auth/cookie.util';
import { CurrentUser } from '../users/current-user.decorator';
import { DiscussionService, type CommentView, type ThreadView } from './discussion.service';
import { DiscussionReadGate, DiscussionWriteGate } from './story-gate.guards';
import { ArticleRefsDto, EditCommentDto, PostCommentDto, ReportCommentDto } from './stories.dto';
import { ParseArticleRefPipe } from './parse-article-ref.pipe';

/**
 * STAGE B — the public Discussion surface.
 *   discussion.read  (DISCUSSION_READ_ENABLED)  GET thread, POST counts — public, read-only.
 *   discussion.write (DISCUSSION_WRITE_ENABLED) post / edit / delete / report — signed-in +
 *                                               CSRF double-submit; ownership in the query.
 * The viewer on a public read is resolved only to mark the reader's own comments; a missing
 * or invalid session is simply "anonymous", never an error.
 */
@Controller('discussion')
export class DiscussionController {
  constructor(
    private readonly discussion: DiscussionService,
    private readonly sessions: SessionService,
  ) {}

  private async viewer(request: Request): Promise<string | null> {
    const raw = request.cookies?.[resolveAuthCookieNames().session] as string | undefined;
    if (!raw) return null;
    try {
      return (await this.sessions.validateSession(raw))?.userId ?? null;
    } catch {
      return null;
    }
  }

  @UseGuards(DiscussionReadGate)
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @Get('articles/:articleRef')
  async thread(@Param('articleRef', ParseArticleRefPipe) articleRef: string, @Req() request: Request): Promise<ThreadView> {
    return this.discussion.thread(articleRef, await this.viewer(request));
  }

  @UseGuards(DiscussionReadGate)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Post('counts')
  @HttpCode(200)
  async counts(@Body() dto: ArticleRefsDto): Promise<{ counts: Record<string, number> }> {
    return { counts: await this.discussion.counts(dto.articleRefs) };
  }

  @UseGuards(DiscussionWriteGate, RequireAuthGuard, CsrfGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('comments')
  async post(@CurrentUser() user: { id: string }, @Body() dto: PostCommentDto): Promise<CommentView> {
    return this.discussion.post(user.id, dto);
  }

  @UseGuards(DiscussionWriteGate, RequireAuthGuard, CsrfGuard)
  @Patch('comments/:id')
  async edit(@CurrentUser() user: { id: string }, @Param('id', ParseUUIDPipe) id: string, @Body() dto: EditCommentDto): Promise<CommentView> {
    return this.discussion.edit(user.id, id, dto.body);
  }

  @UseGuards(DiscussionWriteGate, RequireAuthGuard, CsrfGuard)
  @Delete('comments/:id')
  @HttpCode(204)
  async remove(@CurrentUser() user: { id: string }, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.discussion.remove(user.id, id);
  }

  @UseGuards(DiscussionWriteGate, RequireAuthGuard, CsrfGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('comments/:id/report')
  @HttpCode(204)
  async report(@CurrentUser() user: { id: string }, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReportCommentDto): Promise<void> {
    await this.discussion.report(user.id, id, dto.reason);
  }
}
