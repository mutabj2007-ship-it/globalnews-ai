import { Body, Controller, Get, Param, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { AskThread, AskThreadWithTurns, AskTurnResponse } from '@globalnews-ai/shared';
import { AskService } from './ask.service';
import { AskOwnerService } from './owner/ask-owner.service';
import { AddAskTurnDto } from './dto/add-ask-turn.dto';

/**
 * BETA-SIMPLE-ASK-SAND-1 §3 — the conversational Ask routes.
 *
 * NO RequireAuthGuard ANYWHERE ON THIS CONTROLLER, and that is a
 * deliberate product decision, not an oversight. Every existing AI
 * capability in this repository is unauthenticated (RequireAuthGuard
 * is applied only to /users/me, /history and /auth/signout). Putting
 * Ask behind sign-in would be a regression in capability dressed up
 * as an upgrade, and §19 explicitly warns against implementing
 * Professional as "all useful information is locked".
 *
 * Ownership is established instead by AskOwnerService, which resolves
 * a signed-in user from the existing session cookie when one is
 * present and otherwise issues an httpOnly guest cookie. Thread reads
 * are scoped by ownerKey, so a guest can only ever see their own
 * conversations.
 *
 * NO CsrfGuard on POST /ask/turns, and this one deserves stating
 * plainly. CsrfGuard exists to protect ACCOUNT-OWNED MUTATIONS
 * (creating history, deleting an account) from cross-site forgery.
 * This route creates no account-owned state for a guest and — more
 * importantly — its existing sibling, POST /analysis/news, carries no
 * CSRF guard either. Adding one here would mean the frontend's Ask
 * surface needs the double-submit token while its Search surface does
 * not, for the same underlying operation. The genuine risk a forged
 * cross-site Ask poses is quota consumption, and that is addressed
 * where it belongs: by the @Throttle limit below, and by §5's
 * classification gating expensive work behind explicit confirmation.
 */
@Controller('ask')
export class AskController {
  constructor(
    private readonly askService: AskService,
    private readonly owners: AskOwnerService,
  ) {}

  /**
   * §3 — add a turn to a conversation, creating the thread on the
   * first turn.
   *
   * Rate limited to 5/60s, matching POST /analysis/news exactly. That
   * route's own comment explains why: it triggers a real,
   * cost-bearing AI provider call. This route reaches the same
   * provider through the same service, so it inherits the same limit
   * rather than inventing a looser one — a conversational wrapper
   * must not become a cheaper way to spend the same quota.
   */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('turns')
  async addTurn(
    @Body() dto: AddAskTurnDto,
    @Req() request: Request,
    // passthrough: true so Nest still serializes the return value —
    // the response object is needed only to set the guest cookie.
    @Res({ passthrough: true }) response: Response,
  ): Promise<AskTurnResponse> {
    const owner = await this.owners.resolve(request, response);

    return this.askService.addTurn({
      owner,
      threadId: dto.threadId,
      question: dto.question,
      language: dto.language ?? 'en',
      context: dto.context,
      idempotencyKey: dto.idempotencyKey,
      confirmedOperationId: dto.confirmedOperationId,
    });
  }

  /**
   * §3 — reopen a conversation.
   *
   * Reading a thread performs no retrieval and calls no provider, so
   * it keeps the global 20/60s default rather than the strict AI
   * limit. §7: reopening stored analysis is not a metered operation.
   */
  @Get('threads/:id')
  async getThread(@Param('id') id: string, @Req() request: Request): Promise<AskThreadWithTurns> {
    // resolveForRead never issues a cookie — a GET must not mint
    // identity, and a Set-Cookie on a cacheable response is a known
    // way to leak one visitor's identity to another via a shared
    // cache.
    const owner = await this.owners.resolveForRead(request);

    if (!owner) {
      // No identity means no threads; AskThreadService's own
      // ownership check would reach the same conclusion, but this
      // avoids a pointless database round trip.
      return this.askService.getThread(id, { kind: 'anonymous', key: 'guest:none' });
    }

    return this.askService.getThread(id, owner);
  }

  /** §3 — the caller's conversations, most recently active first. */
  @Get('threads')
  async listThreads(@Req() request: Request): Promise<AskThread[]> {
    const owner = await this.owners.resolveForRead(request);
    if (!owner) return [];
    return this.askService.listThreads(owner);
  }
}
