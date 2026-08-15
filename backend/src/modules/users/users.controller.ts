import { Controller, Delete, Get, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { RequireAuthGuard } from '../auth/require-auth.guard';
import { CsrfGuard } from '../auth/csrf.guard';
import { CSRF_COOKIE_NAME, SESSION_COOKIE_NAME } from '../auth/cookie.util';
import { CurrentUser } from './current-user.decorator';
import { UsersService, type UserSummary } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(RequireAuthGuard)
  async me(@CurrentUser() user: { id: string }): Promise<UserSummary | null> {
    return this.usersService.getById(user.id);
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

    response.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    response.clearCookie(CSRF_COOKIE_NAME, { path: '/' });
    response.status(204).send();
  }
}
