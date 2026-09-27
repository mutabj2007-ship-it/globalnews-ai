import { Controller, Delete, Get, HttpCode, UseGuards } from '@nestjs/common';
import { RequireAuthGuard } from '../auth/require-auth.guard';
import { CsrfGuard } from '../auth/csrf.guard';
import { CurrentUser } from '../users/current-user.decorator';
import { HistoryService, type HistoryEntrySummary } from './history.service';

/**
 * Recent Intelligence — READ and CLEAR only.
 *
 * MY INTELLIGENCE R1.1 — there is deliberately NO POST here. The only product
 * writer of question history is HistoryService.recordExplicitQuestion,
 * called from the verified explicit-compute boundary (POST /analysis/news).
 * A client can therefore never create a history entry by staging, reopening
 * or posting a question directly — only by actually asking it.
 */
@Controller('history')
@UseGuards(RequireAuthGuard)
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get()
  async list(@CurrentUser() user: { id: string }): Promise<HistoryEntrySummary[]> {
    return this.historyService.listForUser(user.id);
  }

  @Delete()
  @UseGuards(CsrfGuard)
  @HttpCode(204)
  async clear(@CurrentUser() user: { id: string }): Promise<void> {
    await this.historyService.clearForUser(user.id);
  }
}
