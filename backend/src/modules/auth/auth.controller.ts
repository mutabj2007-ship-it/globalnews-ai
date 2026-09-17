import { Controller, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RequireAuthGuard } from './require-auth.guard';
import { CsrfGuard } from './csrf.guard';

/**
 * Milestone #57 — every handler here writes directly to the response
 * (redirects, cookies, a bare 204) rather than returning a value, so
 * @Res() is used without `{ passthrough: true }` — the standard,
 * correct NestJS pattern when a handler needs full control over
 * headers/redirects rather than letting Nest serialize a return value.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * B-2 repair — no longer takes the request.
   *
   * The public OAuth callback URI is now resolved from PUBLIC_BACKEND_ORIGIN
   * inside AuthService, so this handler has nothing left to read from the
   * incoming request. The parameter is REMOVED rather than left unused: a
   * signature that still asks for the request implies the request still
   * decides something, and the whole point of the repair is that it does not.
   */
  /**
   * M-ALPHA-AUTH — now takes ONE optional query parameter: where to return the
   * user after a successful sign-in.
   *
   * The B-2 repair removed `@Req()` from this handler because the request had
   * stopped deciding anything, and that reasoning still holds: the callback URI
   * is still built from configuration and the request still has no say in it.
   * What arrives here is a single, explicitly-named, fully-validated preference
   * about a LOCAL page — never a URL, never an origin, never anything that could
   * influence where Google sends the browser.
   *
   * It is deliberately NOT a DTO. The global ValidationPipe runs with
   * `forbidNonWhitelisted`, and validation of this value is not a shape check
   * that class-validator could express: it is an allowlist of this
   * application's own routes plus an open-redirect gate, which lives in
   * return-destination.util.ts and is applied by AuthService.
   */
  @Get('google')
  startGoogleAuth(
    @Query('returnTo') returnTo: string | undefined,
    @Res() response: Response,
  ): void {
    this.authService.startGoogleAuth(response, returnTo);
  }

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    /**
     * B5-A · C-5 — READ GOOGLE'S ERROR.
     *
     * The callback previously took `code` and `state` only, which is exactly
     * why a cancellation was logged as a state rejection: a cancelled sign-in
     * arrives with NO code and NO state, so it fell into the mismatch branch
     * and was recorded as a security-relevant event. Reading this parameter is
     * what lets the two be told apart.
     *
     * C-7 — the provider's string never leaves the process. It is passed to the
     * service to be CLASSIFIED and is never logged, echoed, stored or placed in
     * a URL. `error_description` is not read at all.
     */
    @Query('error') providerError: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    await this.authService.handleGoogleCallback(code, state, providerError, request, response);
  }

  @Post('signout')
  @UseGuards(RequireAuthGuard, CsrfGuard)
  async signOut(@Req() request: Request, @Res() response: Response): Promise<void> {
    await this.authService.signOut(request, response);
  }
}
