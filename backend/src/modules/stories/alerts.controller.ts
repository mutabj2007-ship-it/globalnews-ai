import { BadRequestException, Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { RequireAuthGuard } from '../auth/require-auth.guard';
import { CsrfGuard } from '../auth/csrf.guard';
import { CurrentUser } from '../users/current-user.decorator';
import { AlertsService, type AlertOp } from './alerts.service';
import { AlertsInAppGate } from './story-gate.guards';
import { discussionReadEnabled } from './story-gates';
import { ALERT_OPS, ArticleRefsDto, StoryArticleDto } from './stories.dto';

/**
 * STAGE B — in-app Alerts (ALERTS_IN_APP_ENABLED). Signed-in only; every query is scoped by
 * the session's user id. Mutations carry the CSRF double-submit. Nothing here delivers.
 */
@Controller('alerts')
@UseGuards(AlertsInAppGate, RequireAuthGuard)
export class AlertsController {
  constructor(
    private readonly alerts: AlertsService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  async list(@CurrentUser() user: { id: string }) {
    return { alerts: await this.alerts.list(user.id) };
  }

  @UseGuards(CsrfGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post()
  @HttpCode(200)
  async create(@CurrentUser() user: { id: string }, @Body() dto: StoryArticleDto) {
    return this.alerts.create(user.id, dto);
  }

  @Post('by-article')
  @HttpCode(200)
  async byArticle(@CurrentUser() user: { id: string }, @Body() dto: ArticleRefsDto) {
    return { alerts: await this.alerts.byArticle(user.id, dto.articleRefs) };
  }

  @Get('inbox')
  async inbox(@CurrentUser() user: { id: string }) {
    // Replies are discussion content: shown only while discussion.read exists.
    return this.alerts.inbox(user.id, discussionReadEnabled(this.config));
  }

  @UseGuards(CsrfGuard)
  @Post('inbox/read-all')
  @HttpCode(204)
  async readAll(@CurrentUser() user: { id: string }): Promise<void> {
    await this.alerts.markAllRead(user.id);
  }

  @UseGuards(CsrfGuard)
  @Post('events/:id/read')
  @HttpCode(204)
  async read(@CurrentUser() user: { id: string }, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.alerts.markRead(user.id, id);
  }

  @UseGuards(CsrfGuard)
  @Post(':id/:op')
  @HttpCode(200)
  async apply(@CurrentUser() user: { id: string }, @Param('id', ParseUUIDPipe) id: string, @Param('op') op: string) {
    if (!(ALERT_OPS as readonly string[]).includes(op)) throw new BadRequestException('ALERT_OP');
    return this.alerts.apply(user.id, id, op as AlertOp);
  }
}
