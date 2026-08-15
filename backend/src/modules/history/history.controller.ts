import { Body, Controller, Delete, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { RequireAuthGuard } from '../auth/require-auth.guard';
import { CsrfGuard } from '../auth/csrf.guard';
import { CurrentUser } from '../users/current-user.decorator';
import { CreateHistoryEntryDto } from './create-history-entry.dto';
import { HistoryService, type HistoryEntrySummary } from './history.service';

@Controller('history')
@UseGuards(RequireAuthGuard)
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get()
  async list(@CurrentUser() user: { id: string }): Promise<HistoryEntrySummary[]> {
    return this.historyService.listForUser(user.id);
  }

  @Post()
  @UseGuards(CsrfGuard)
  async create(
    @CurrentUser() user: { id: string },
    @Body() body: CreateHistoryEntryDto,
  ): Promise<HistoryEntrySummary> {
    return this.historyService.create(user.id, body.query, body.countryCode);
  }

  @Delete()
  @UseGuards(CsrfGuard)
  @HttpCode(204)
  async clear(@CurrentUser() user: { id: string }): Promise<void> {
    await this.historyService.clearForUser(user.id);
  }
}
