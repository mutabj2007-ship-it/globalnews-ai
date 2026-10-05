import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { RequireAuthGuard } from '../auth/require-auth.guard';
import { CsrfGuard } from '../auth/csrf.guard';
import { buildSessionCookieOptions } from '../auth/cookie.util';
import { CurrentUser } from '../users/current-user.decorator';
import { OWNER_PREVIEW_COOKIE, ownerAccessMode, type OwnerAccessMode } from './alpha-owner-entitlement';

export interface OwnerAccessView {
  /** NOT_OWNER for every account except the verified owner on the real Alpha deployment. */
  readonly mode: OwnerAccessMode;
}

const PREVIEW_MAX_AGE_MS = 12 * 60 * 60 * 1000;

/**
 * PHONE-FIRST HOME CORRECTION R1 · §2 — the owner's own view of the entitlement, and the explicit
 * "Preview ordinary user experience" switch. Signed in only. The switch can only REMOVE the
 * exemption; for anyone but the Alpha owner it is a no-op that reports NOT_OWNER.
 */
@Controller('users/me/access')
@UseGuards(RequireAuthGuard)
export class OwnerAccessController {
  @Get()
  view(@CurrentUser() user: { id: string }, @Req() request: Request): OwnerAccessView {
    return { mode: ownerAccessMode(user.id, request.cookies?.[OWNER_PREVIEW_COOKIE] === '1') };
  }

  @Post('preview')
  @HttpCode(200)
  @UseGuards(CsrfGuard)
  preview(
    @CurrentUser() user: { id: string },
    @Body() body: { enabled?: unknown },
    @Res({ passthrough: true }) response: Response,
  ): OwnerAccessView {
    const enabled = body?.enabled === true;
    if (ownerAccessMode(user.id, false) === 'NOT_OWNER') return { mode: 'NOT_OWNER' };
    const options = buildSessionCookieOptions(process.env.NODE_ENV, PREVIEW_MAX_AGE_MS, process.env.PUBLIC_BACKEND_ORIGIN);
    if (enabled) response.cookie(OWNER_PREVIEW_COOKIE, '1', options);
    else response.clearCookie(OWNER_PREVIEW_COOKIE, { path: '/', sameSite: options.sameSite, secure: options.secure });
    return { mode: enabled ? 'ORDINARY_PREVIEW' : 'UNRESTRICTED' };
  }
}
