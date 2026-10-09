import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  Res,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Response } from 'express';
import { IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { RequireAuthGuard } from '../auth/require-auth.guard';
import { CsrfGuard } from '../auth/csrf.guard';
import { clearAuthCookies } from '../auth/cookie.util';
import { CurrentUser } from './current-user.decorator';
import { UsersService, type ReturnStateView, type UserSummary } from './users.service';

/** REASON TO RETURN R1 · G6 — a string to save, or null / empty to clear. Content rule in shared. */
export class UpdateProfileDto {
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(200)
  displayName?: string | null;
}

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(RequireAuthGuard)
  async me(@CurrentUser() user: { id: string }): Promise<UserSummary | null> {
    return this.usersService.getById(user.id);
  }

  /**
   * PATCH /users/me — REASON TO RETURN R1 · G6. The reader's own preferred name (or null to
   * clear it). Signed-in + CSRF; only `displayName` is accepted, anything else is a 400.
   */
  @Patch('me')
  @UseGuards(RequireAuthGuard, CsrfGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async updateMe(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateProfileDto,
  ): Promise<UserSummary> {
    return this.usersService.updateDisplayName(user.id, dto.displayName ?? null);
  }

  /**
   * POST /users/me/seen — R1/T2. Record a meaningful return-surface visit
   * and receive the PREVIOUS one.
   *
   * AUTHENTICATED ONLY, AND THAT IS THE PRODUCT BOUNDARY, NOT AN
   * OVERSIGHT. The accepted architecture rules out anonymous return state
   * before MVP: a visitor-side timestamp is the visitor's own clock,
   * multi-device visitors get contradictory answers, and writing one to
   * a device for personalisation engages consent in the EU. Return state
   * is a signed-in benefit. This route sits behind RequireAuthGuard, so
   * an anonymous caller cannot reach it, and nothing in this milestone
   * mints an anonymous identifier anywhere.
   *
   * WHY AN ENDPOINT RATHER THAN RIDING ON THE FEED RESPONSE. The value
   * could ride on an authenticated Today/feed response and save a route,
   * but that would couple this lane to the Today frontend, which is a
   * different owner on a deliberately parallel gate — and would put this
   * lane's hands on a frozen SSR client. One small route keeps the two
   * independent. When the Today surface exists it calls this once per
   * load.
   *
   * CsrfGuard because this mutates, matching every other mutation on this
   * controller. 200 rather than 204 because the response body IS the
   * point.
   */
  @Post('me/seen')
  @HttpCode(200)
  @UseGuards(RequireAuthGuard, CsrfGuard)
  async seen(@CurrentUser() user: { id: string }): Promise<ReturnStateView> {
    return this.usersService.recordSeen(user.id);
  }

  /**
   * Milestone #58 privacy hardening — previously deleted the account
   * row (and, via the existing schema cascade, every related
   * UserIdentity/Session/SearchHistoryEntry row) but never cleared the
   * gna_session/gna_csrf cookies from the browser. Not a security
   * hole on its own (the underlying Session row is already gone, so
   * RequireAuthGuard rejects the stale cookie on the very next
   * request regardless), but a real hygiene gap this closes.
   *
   * Ordering is deliberate: `await this.usersService.deleteAccount(...)`
   * is the FIRST statement in this handler, with no try/catch around
   * it. If it throws (a real database failure), execution never
   * reaches the cookie-clearing lines below, and the thrown error
   * propagates to the existing global exception filter, which returns
   * a genuine error response — the account/database deletion is
   * therefore always the sole source of truth for whether this
   * request is treated as successful; clearing cookies can never make
   * a failed deletion look like a success.
   *
   * Uses the exact same SESSION_COOKIE_NAME/CSRF_COOKIE_NAME constants
   * and clearCookie({ path: '/' }) pattern AuthService.signOut already
   * uses — no second cookie configuration mechanism introduced.
   */
  @Delete('me')
  @UseGuards(RequireAuthGuard, CsrfGuard)
  async deleteMe(@CurrentUser() user: { id: string }, @Res() response: Response): Promise<void> {
    await this.usersService.deleteAccount(user.id);

    clearAuthCookies(response, ['session', 'csrf']);
    response.status(204).send();
  }
}
