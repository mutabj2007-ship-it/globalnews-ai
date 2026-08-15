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

  @Get('google')
  startGoogleAuth(@Req() request: Request, @Res() response: Response): void {
    this.authService.startGoogleAuth(request, response);
  }

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    await this.authService.handleGoogleCallback(code, state, request, response);
  }

  @Post('signout')
  @UseGuards(RequireAuthGuard, CsrfGuard)
  async signOut(@Req() request: Request, @Res() response: Response): Promise<void> {
    await this.authService.signOut(request, response);
  }
}
