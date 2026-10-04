import { Controller, Delete, Get, HttpCode, UseGuards, UseInterceptors } from '@nestjs/common';
import { RequireAuthGuard } from '../auth/require-auth.guard';
import { CsrfGuard } from '../auth/csrf.guard';
import { CurrentUser } from '../users/current-user.decorator';
import { HistoryService, type HistoryEntrySummary } from './history.service';
import { LegacyRouteUsageInterceptor } from '../legacy-usage/legacy-route-usage.interceptor';

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

  /*
   * STAGE 2 / T4 — the legacy SearchHistoryEntry store is written only by POST /analysis/news, so
   * Ask V2 questions never appear here. Reads and clears are measured (PII-free) to size the
   * /history -> Ask V2 recent-threads migration. RequireAuthGuard runs first, so every counted
   * request is signed in; the user id is never passed to the measurement.
   */
  @UseInterceptors(new LegacyRouteUsageInterceptor('GET /history', () => 'signed-in'))
  @Get()
  async list(@CurrentUser() user: { id: string }): Promise<HistoryEntrySummary[]> {
    return this.historyService.listForUser(user.id);
  }

  @Delete()
  @UseGuards(CsrfGuard)
  @UseInterceptors(new LegacyRouteUsageInterceptor('DELETE /history', () => 'signed-in'))
  @HttpCode(204)
  async clear(@CurrentUser() user: { id: string }): Promise<void> {
    await this.historyService.clearForUser(user.id);
  }
}
