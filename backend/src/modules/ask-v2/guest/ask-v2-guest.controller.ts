import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AskV2EnabledGuard } from '../ask-v2.controller';
import { AskV2Service } from '../ask-v2.service';
import { AskRequestContextInterceptor } from '../ask-request-context';
import { ClaimGuestThreadDto, CreateThreadDto, HistoryPageDto, QuoteTurnDto } from '../ask-v2.dto';
import { clientIpScope } from '../../compute-controls/compute-scopes';
import { SessionService } from '../../auth/session.service';
import { resolveAuthCookieNames } from '../../auth/cookie.util';
import { guestPrincipal } from './ask-principal';
import { GUEST_ANSWER_ALLOWANCE } from './guest-trial.config';
import { GuestSessionService } from './guest-session.service';
import { GuestClaimService } from './guest-claim.service';
import {
  GuestFirstWriteGuard,
  GuestForgetGuard,
  GuestWriteGuard,
  RequireGuestGuard,
} from './guest.guards';

type GuestRequest = Request & { guest?: { id: string; tokenHash: string } };

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK GUEST TRIAL R3 — THE SCOPED GUEST SURFACE (`/ask-v2/guest/*`)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * A SEPARATE surface. The account controller keeps its class-level RequireAuthGuard; its
 * private lists (Recent, Saved, bookmarks) and `GET /ask-v2/threads` stay unauthorized when
 * signed out. Here, every read and write is authorized against the ONE guest session behind
 * the request's HttpOnly cookie; a thread or operation id alone authorizes nothing.
 *
 * AskV2EnabledGuard runs first on every route, so the private, no-store, Vary: Cookie headers
 * ride every outcome — success and refusal alike — and a disabled Ask V2 is a 404 here too.
 * The guest switch and configuration gate NEW work only; a guest can still read what it
 * already has while its session lives.
 */
@Controller('ask-v2/guest')
@UseGuards(AskV2EnabledGuard)
@UseInterceptors(AskRequestContextInterceptor)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class AskV2GuestController {
  constructor(
    private readonly ask: AskV2Service,
    private readonly guests: GuestSessionService,
    private readonly claims: GuestClaimService,
    private readonly sessions: SessionService,
  ) {}

  /**
   * What the composer shows before and during the trial. Never mints a session. A signed-in
   * reader is told so (the account path applies); a visitor without a guest cookie sees the
   * full allowance when the trial is available.
   */
  @Get('status')
  async status(@Req() request: GuestRequest) {
    const raw = request.cookies?.[resolveAuthCookieNames().session] as string | undefined;
    if (raw && (await this.sessions.validateSession(raw).catch(() => null))) {
      return { signedIn: true, available: false };
    }
    /* T5 Part B — the configured lifetime / deletion grace, so copy never hard-codes them. */
    const policy = this.guests.policy();
    const guest = await this.guests.resolve(request);
    if (guest === null) {
      return {
        signedIn: false,
        available: await this.ask.guestTrialAvailable(),
        policy,
        session: null,
        allowance: GUEST_ANSWER_ALLOWANCE,
        remaining: GUEST_ANSWER_ALLOWANCE,
        committed: 0,
        reserved: 0,
        state: 'OPEN',
        cooldownUntil: null,
      };
    }
    const a = await this.ask.guestAllowance(guest.id);
    return {
      signedIn: false,
      available: a.available,
      policy,
      session: { expiresAt: guest.expiresAt, purgeAfter: this.guests.purgeAfter(guest.expiresAt) },
      allowance: a.allowance,
      remaining: a.remaining,
      committed: a.committed,
      reserved: a.reserved,
      state: a.state,
      cooldownUntil: a.cooldownUntil,
      /* The CSRF value bound to this guest, for a reader whose CSRF cookie was lost. */
      csrf: this.guests.csrfForRequest(request),
    };
  }

  /** The first explicit submission mints the guest session; later ones reuse it. */
  @Post('threads')
  @UseGuards(GuestFirstWriteGuard)
  async create(
    @Req() request: GuestRequest,
    @Res({ passthrough: true }) response: Response,
    @Body() dto: CreateThreadDto,
  ) {
    let guest = await this.guests.resolve(request);
    if (guest !== null) {
      const raw = this.guests.rawTokenFrom(request) as string;
      const header = request.headers['x-csrf-token'];
      if (
        typeof header !== 'string' ||
        !this.guests.csrfMatches(GuestSessionService.hashToken(raw), header)
      ) {
        throw new ForbiddenException('CSRF validation failed.');
      }
    } else {
      guest = await this.guests.issue(clientIpScope(request.ip), response);
    }
    return this.ask.createThread(guestPrincipal(guest.id), dto);
  }

  @Get('threads')
  @UseGuards(RequireGuestGuard)
  list(@Req() request: GuestRequest) {
    return this.ask.listGuestThreads(request.guest!.id);
  }

  @Get('threads/:id')
  @UseGuards(RequireGuestGuard)
  history(@Req() request: GuestRequest, @Param('id') id: string, @Query() page: HistoryPageDto) {
    return this.ask.getThread(guestPrincipal(request.guest!.id), id, page.after);
  }

  @Get('operations/:id')
  @UseGuards(RequireGuestGuard)
  operation(@Req() request: GuestRequest, @Param('id') id: string) {
    return this.ask.getOperation(guestPrincipal(request.guest!.id), id);
  }

  @Post('threads/:id/turns')
  @UseGuards(RequireGuestGuard, GuestWriteGuard)
  submit(@Req() request: GuestRequest, @Param('id') id: string, @Body() dto: QuoteTurnDto) {
    return this.ask.submit(guestPrincipal(request.guest!.id), id, dto);
  }

  /** Bind this guest's own thread to its next Google sign-in from this browser. */
  @Post('claim')
  @UseGuards(RequireGuestGuard, GuestWriteGuard)
  async claim(@Req() request: GuestRequest, @Body() dto: ClaimGuestThreadDto) {
    await this.claims.createClaim(request.guest!.id, dto.threadId);
    return { claimed: true };
  }

  /**
   * T5 PART B — "delete my guest data now". Deletes the CALLER's own guest session with the
   * sweep's cascade (threads, turns, operations, stored results, slots, claims) and clears the
   * guest and CSRF cookies. Idempotent: with no live guest cookie it deletes nothing and still
   * answers `{ forgotten: true, deleted: false }`. Gated like every guest route (Ask V2 off ⇒
   * 404) but NOT by the guest switch: the switch gates new work, and a guest must be able to
   * delete what it already has while the trial is off. Never reaches account data.
   */
  @Post('forget')
  @HttpCode(200)
  @UseGuards(GuestForgetGuard)
  async forget(@Req() request: GuestRequest, @Res({ passthrough: true }) response: Response) {
    const raw = this.guests.rawTokenFrom(request);
    if (raw === undefined) {
      /* Nothing to delete. A malformed leftover cookie is cleared; the CSRF cookie is left alone. */
      if (request.cookies?.[this.guests.cookieName()] !== undefined) {
        this.guests.clearCookie(response);
      }
      return { forgotten: true, deleted: false };
    }
    const tokenHash = GuestSessionService.hashToken(raw);
    const header = request.headers['x-csrf-token'];
    const cookie = request.cookies?.[resolveAuthCookieNames().csrf] as string | undefined;
    if (
      typeof header !== 'string' ||
      header !== cookie ||
      !this.guests.csrfMatches(tokenHash, header)
    ) {
      throw new ForbiddenException('CSRF validation failed.');
    }
    const { deleted } = await this.guests.forget(tokenHash);
    this.guests.clearGuestCookies(response);
    return { forgotten: true, deleted };
  }
}
