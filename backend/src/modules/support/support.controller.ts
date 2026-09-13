import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { SupportTicketDetail, SupportTicketSummary } from '@globalnews-ai/shared';
import { RequireAuthGuard } from '../auth/require-auth.guard';
import { CsrfGuard } from '../auth/csrf.guard';
import { CurrentUser } from '../users/current-user.decorator';
import { SupportService } from './support.service';
import {
  CreateSupportMessageDto,
  CreateSupportTicketDto,
  SupportTicketReferenceParamsDto,
} from './dto/support.dto';

/**
 * S2 — the authenticated user support API. Four routes, no more.
 *
 * The guard shape is HistoryController's, deliberately and exactly:
 * RequireAuthGuard at class level so no route can be reached
 * anonymously, and CsrfGuard on each mutation so a cross-site POST
 * cannot open a ticket or speak on the user's behalf. Reads carry no
 * CSRF guard because they are safe methods, matching the existing
 * account endpoints rather than inventing a different rule here.
 *
 * OWNERSHIP NEVER TRAVELS IN A REQUEST. `@CurrentUser()` reads
 * `request.user`, which only RequireAuthGuard sets, from a session
 * cookie the browser cannot forge. No DTO in this module declares a
 * user identifier, and the global ValidationPipe runs with
 * `forbidNonWhitelisted`, so a request that tries to supply one is
 * rejected with a 400 before this class is entered.
 *
 * NO ROUTE ACCEPTS A STATUS. Reopening a resolved ticket is a
 * consequence of replying to it, derived in the service; it is not a
 * field, a query parameter or an endpoint. There is no PATCH and no
 * DELETE here, and no admin route — the admin support queue is a later,
 * separately authorized milestone.
 *
 * THE THROTTLE LIMITS BELOW ARE A BACKSTOP, NOT THE ABUSE CONTROL. The
 * throttler keys on client IP, and behind a reverse proxy with
 * TRUST_PROXY unset every user shares one bucket. The real limit is the
 * per-user open-ticket cap enforced in SupportService against the
 * database, which no proxy topology can weaken.
 */
@Controller('support')
@UseGuards(RequireAuthGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  /** POST /support/tickets — open a ticket and post its first message. */
  @Post('tickets')
  @UseGuards(CsrfGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  createTicket(
    @CurrentUser() user: { id: string },
    @Body() body: CreateSupportTicketDto,
  ): Promise<SupportTicketDetail> {
    /*
      SUPPORT-AI-1 — RETURNS THE THREAD, NOT THE SUMMARY.
      SupportTicketDetail extends SupportTicketSummary, so this widens the
      response rather than changing it, and no existing consumer breaks.
      It is what lets the submitting client show the agent's stored first
      response immediately, from the RECORD, instead of imitating one
      locally while it waits for a separate read.
    */
    return this.supportService.createTicket(user.id, {
      category: body.category,
      subject: body.subject,
      message: body.message,
      language: body.language,
    });
  }

  /** GET /support/tickets — the caller's own tickets, newest activity first. */
  @Get('tickets')
  listTickets(@CurrentUser() user: { id: string }): Promise<SupportTicketSummary[]> {
    return this.supportService.listTickets(user.id);
  }

  /**
   * GET /support/tickets/:reference — one of the caller's own tickets.
   *
   * A reference that does not exist and a reference belonging to
   * somebody else produce the same 404, so this route cannot be used to
   * discover which references are real.
   */
  @Get('tickets/:reference')
  getTicket(
    @CurrentUser() user: { id: string },
    @Param() params: SupportTicketReferenceParamsDto,
  ): Promise<SupportTicketDetail> {
    return this.supportService.getTicket(user.id, params.reference);
  }

  /** POST /support/tickets/:reference/messages — the owner's reply. */
  @Post('tickets/:reference/messages')
  @UseGuards(CsrfGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  addMessage(
    @CurrentUser() user: { id: string },
    @Param() params: SupportTicketReferenceParamsDto,
    @Body() body: CreateSupportMessageDto,
  ): Promise<SupportTicketDetail> {
    return this.supportService.addMessage(user.id, params.reference, body.message);
  }
}
