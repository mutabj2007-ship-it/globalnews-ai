import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import type { CountryFollowListResponse, CountryFollowView } from '@globalnews-ai/shared';
import { RequireAuthGuard } from '../auth/require-auth.guard';
import { CsrfGuard } from '../auth/csrf.guard';
import { CurrentUser } from '../users/current-user.decorator';
import { FollowsService } from './follows.service';
import { FollowCountryDto } from './dto/follow-country.dto';
import { FollowCountryParamsDto } from './dto/follow-country-params.dto';

/**
 * R1/T3 — the authenticated country-follow API. Three routes, no more.
 *
 * The guard shape is HistoryController's, deliberately and exactly:
 * RequireAuthGuard at class level so no route can be reached
 * anonymously, and CsrfGuard on each mutation so a cross-site request
 * cannot follow or unfollow on the user's behalf. The read carries no
 * CSRF guard because it is a safe method, matching the existing account
 * endpoints rather than inventing a different rule here.
 *
 * OWNERSHIP NEVER TRAVELS IN A REQUEST. `@CurrentUser()` reads
 * `request.user`, which only RequireAuthGuard sets, from a session cookie
 * the browser cannot forge. No DTO in this module declares a user
 * identifier, and the global ValidationPipe runs with
 * `forbidNonWhitelisted`, so a request that tries to supply one is
 * rejected with a 400 before this class is entered.
 *
 * THERE IS NO ADMIN ROUTE HERE, no bulk endpoint and no route that reads
 * another account's follows. "Who follows PL" is a question the schema
 * can answer efficiently, and deliberately not one this API exposes.
 */
@Controller('follows')
@UseGuards(RequireAuthGuard)
export class FollowsController {
  constructor(private readonly followsService: FollowsService) {}

  /** GET /follows/countries — the caller's own follows. */
  @Get('countries')
  list(@CurrentUser() user: { id: string }): Promise<CountryFollowListResponse> {
    return this.followsService.listForUser(user.id);
  }

  /**
   * POST /follows/countries — follow a country. Idempotent: a repeat
   * follow returns the existing row unchanged rather than an error.
   */
  @Post('countries')
  @UseGuards(CsrfGuard)
  follow(
    @CurrentUser() user: { id: string },
    @Body() body: FollowCountryDto,
  ): Promise<CountryFollowView> {
    return this.followsService.follow(user.id, body.countryCode);
  }

  /**
   * DELETE /follows/countries/:countryCode — unfollow.
   *
   * 204 whether or not a row existed. Reporting "not found" would
   * disclose whether a follow was there, and the caller's desired end
   * state — not following this country — is true either way.
   */
  @Delete('countries/:countryCode')
  @UseGuards(CsrfGuard)
  @HttpCode(204)
  async unfollow(
    @CurrentUser() user: { id: string },
    @Param() params: FollowCountryParamsDto,
  ): Promise<void> {
    await this.followsService.unfollow(user.id, params.countryCode);
  }
}
