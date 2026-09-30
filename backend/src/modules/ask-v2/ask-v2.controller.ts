import {
  Body,
  CanActivate,
  Controller,
  Delete,
  ExecutionContext,
  Get,
  Injectable,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
  UseFilters,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RequireAuthGuard } from '../auth/require-auth.guard';
import { CsrfGuard } from '../auth/csrf.guard';
import { CurrentUser } from '../users/current-user.decorator';
import { BookmarkTurnDto, CreateThreadDto, HistoryPageDto, QuoteTurnDto } from './ask-v2.dto';
import { AskV2Service } from './ask-v2.service';
import { AskRequestContextInterceptor } from './ask-request-context';
import { AskAccessObservationFilter } from './ask-access-observation.filter';
import { accountPrincipal } from './guest/ask-principal';
import { GuestClaimService } from './guest/guest-claim.service';

/**
 * ASK R2 INTEGRATION R1 · §14 — PRIVACY HEADERS ON EVERY ASK V2 RESPONSE.
 *
 * Set BEFORE the enable check and before authentication, so they ride every outcome the
 * route family can produce — success, the disabled 404, the unauthenticated 401, the
 * owner-sensitive 404 for someone else's operation, conflicts and refusals. A response
 * that varies by session cookie but is cacheable, or that is private on success and
 * public on refusal, leaks whether an account-owned operation exists.
 */
export function applyAskPrivacyHeaders(response: {
  setHeader(name: string, value: string): void;
  getHeader?(name: string): unknown;
}): void {
  response.setHeader('Cache-Control', 'private, no-store');
  const existing = response.getHeader?.('Vary');
  const vary =
    typeof existing === 'string' && existing.length > 0
      ? existing.split(',').map((v) => v.trim())
      : [];
  if (!vary.some((v) => v.toLowerCase() === 'cookie')) vary.push('Cookie');
  response.setHeader('Vary', vary.join(', '));
}

@Injectable()
export class AskV2EnabledGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(context: ExecutionContext): boolean {
    /* Headers only where there is an HTTP response to carry them; the enable decision never
       depends on it (a non-HTTP context is still refused with the same 404). */
    const response = context.switchToHttp?.()?.getResponse?.();
    if (response && typeof response.setHeader === 'function') applyAskPrivacyHeaders(response);
    if (this.config.get<string>('ASK_V2_ENABLED') !== 'true') throw new NotFoundException();
    return true;
  }
}
@Controller('ask-v2')
@UseGuards(AskV2EnabledGuard, RequireAuthGuard)
/* R1 observability: counts the refusals no observation can ever exist for. Changes no
   status, no body and no header — see ask-access-observation.filter.ts. */
@UseFilters(AskAccessObservationFilter)
/* Gate E: server-held account + IP scope for the budget, set after authentication. */
@UseInterceptors(AskRequestContextInterceptor)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class AskV2Controller {
  constructor(
    private readonly ask: AskV2Service,
    private readonly claims: GuestClaimService,
  ) {}

  /**
   * ASK GUEST TRIAL R3 — after a Google sign-in that consumed a guest claim, the conversation
   * this account just continued (a short window only). Resolved server-side from the consumed
   * claim, so no thread id ever travels through the OAuth URLs. The thread has already moved
   * to this account, so it is read through the ordinary account routes.
   */
  @Get('continuation') async continuation(@CurrentUser() user: { id: string }) {
    return { threadId: await this.claims.continuationFor(user.id) };
  }
  @Get('threads') list(@CurrentUser() user: { id: string }) {
    return this.ask.listThreads(user.id);
  }
  @Get('threads/:id') history(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Query() page: HistoryPageDto,
  ) {
    return this.ask.getThread(accountPrincipal(user.id), id, page.after);
  }
  @Get('operations/:id') operation(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.ask.getOperation(accountPrincipal(user.id), id);
  }

  /*
    ══════════════════════════════════════════════════════════════════════════
    PUBLIC BETA ASK CONTINUITY R1 — SAVED (QUESTIONS)
    ══════════════════════════════════════════════════════════════════════════

    These sit on THIS controller deliberately. A bookmark points at an `AskTurn`,
    so the reads and writes belong to the lane that owns Ask threads and turns —
    a separate controller would be a second identity for the same content, and
    would need its own ownership rules to keep in step with these.

    They inherit the class-level guards: `AskV2EnabledGuard` (so the whole surface
    is a 404 unless Ask V2 is enabled, with the privacy headers already applied),
    `RequireAuthGuard` (signed out is refused, never served an empty list), and the
    whitelisting ValidationPipe. `CsrfGuard` is added to the two mutations only —
    the GET stays safe and idempotent, exactly as that guard's own contract says.
  */
  @Get('bookmarks') bookmarks(@CurrentUser() user: { id: string }) {
    return this.ask.listBookmarks(user.id);
  }
  @Post('bookmarks')
  @UseGuards(CsrfGuard)
  bookmark(@CurrentUser() user: { id: string }, @Body() dto: BookmarkTurnDto) {
    return this.ask.addBookmark(user.id, dto.turnId);
  }
  @Delete('bookmarks/:turnId')
  @UseGuards(CsrfGuard)
  unbookmark(@CurrentUser() user: { id: string }, @Param('turnId') turnId: string) {
    return this.ask.removeBookmark(user.id, turnId);
  }
  @Post('threads')
  @UseGuards(CsrfGuard)
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateThreadDto) {
    return this.ask.createThread(accountPrincipal(user.id), dto);
  }
  @Post('threads/:id/turns')
  @UseGuards(CsrfGuard)
  submit(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() dto: QuoteTurnDto) {
    return this.ask.submit(accountPrincipal(user.id), id, dto);
  }
  @Post('threads/:id/quote')
  @UseGuards(CsrfGuard)
  quote(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() dto: QuoteTurnDto) {
    return this.ask.quote(accountPrincipal(user.id), id, dto);
  }
  @Post('operations/:id/accept')
  @UseGuards(CsrfGuard)
  accept(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.ask.accept(accountPrincipal(user.id), id);
  }
  @Post('operations/:id/reserve')
  @UseGuards(CsrfGuard)
  reserve(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.ask.reserve(accountPrincipal(user.id), id);
  }
  @Post('operations/:id/execute')
  @UseGuards(CsrfGuard)
  execute(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.ask.execute(accountPrincipal(user.id), id);
  }
  @Post('operations/:id/release')
  @UseGuards(CsrfGuard)
  release(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.ask.release(accountPrincipal(user.id), id);
  }
}
