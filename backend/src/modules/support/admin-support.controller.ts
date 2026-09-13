import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import type { AdminSupportQueueResponse, AdminSupportTicketDetail } from '@globalnews-ai/shared';
import { RequireAuthGuard } from '../auth/require-auth.guard';
import { CsrfGuard } from '../auth/csrf.guard';
import { AdminPlatformEnabledGuard } from '../admin/admin-platform.guard';
import { AdminGuard } from '../admin/admin.guard';
import { CurrentAdmin } from '../admin/current-admin.decorator';
import type { AdminContext } from '../admin/admin.guard';
import { CAPABILITIES } from '../admin/rbac/capabilities';
import { RequireCapability } from '../admin/rbac/require-capability.decorator';
import { AdminSupportService } from './admin-support.service';
import {
  AdminSupportQueueQueryDto,
  AdminSupportReferenceParamsDto,
  CreateAdminSupportMessageDto,
  UpdateSupportStatusDto,
} from './dto/admin-support.dto';

/**
 * S3 — the ADMIN support API. Four routes, no more.
 *
 * WHY THIS FILE LIVES IN modules/support AND NOT IN modules/admin.
 * `admin.contract.spec.ts` bans `.create(`, `.update(`, `.updateMany(`
 * and `.upsert(` in every non-spec file under `modules/admin` — the
 * guarantee that F1.a's admin surface has no write path for a role.
 * Handling support tickets is inherently a write, so putting the service
 * there would have forced that ban to be weakened, and a security guard
 * that has been loosened once is easier to loosen again. Placing the
 * code beside the data it operates on costs nothing and leaves F1.a's
 * guard byte-for-byte intact. `admin.contract.spec.ts` now sweeps for
 * admin controllers WHEREVER they live, so this file does not escape
 * the contract by moving.
 *
 * THE GUARD CHAIN IS THE ADMIN CHAIN, IN THE ADMIN ORDER, and it is
 * copied from AdminReadonlyController rather than reinvented:
 *   AdminPlatformEnabledGuard -> 404 when the platform is switched off
 *   RequireAuthGuard          -> 401 when the caller is not signed in
 *   AdminGuard                -> 403 when the caller is not an admin or
 *                                lacks support.handle
 * CsrfGuard is added to each mutation, matching SupportController: the
 * admin surface is cookie-authenticated exactly like the user surface,
 * so it needs the same double-submit protection.
 *
 * `support.handle` IS THE CAPABILITY, WHICH EXCLUDES ANALYST. The
 * approved role matrix grants "Support tickets & notes" to SUPER_ADMIN,
 * ADMIN and SUPPORT and denies it to ANALYST. Nothing here re-derives
 * that; `capabilities.ts` already states it and AdminGuard already
 * enforces it, so an ANALYST receives the same bare 403 as any other
 * caller without the capability.
 *
 * NO ROUTE ACCEPTS AN IDENTITY. The acting administrator comes from
 * `@CurrentAdmin()`, which only AdminGuard sets. No DTO on this surface
 * declares a `userId` or an `authorId`, and the global ValidationPipe
 * runs with `forbidNonWhitelisted`, so a request that supplies one is a
 * 400 before this class is entered.
 *
 * NO ROUTE RETURNS A REQUESTER IDENTITY EITHER (CTO decision, S3). The
 * response shapes carry a ticket reference and a conversation; they have
 * no field for an email address or a display name, so this surface
 * cannot become a user directory.
 */
@Controller('admin/support')
@UseGuards(AdminPlatformEnabledGuard, RequireAuthGuard, AdminGuard)
export class AdminSupportController {
  constructor(private readonly adminSupportService: AdminSupportService) {}

  /** GET /admin/support/tickets — the queue, optionally filtered by status. */
  @Get('tickets')
  @RequireCapability(CAPABILITIES.SupportHandle)
  queue(@Query() query: AdminSupportQueueQueryDto): Promise<AdminSupportQueueResponse> {
    return this.adminSupportService.queue(query.status);
  }

  /** GET /admin/support/tickets/:reference — one ticket, internal notes included. */
  @Get('tickets/:reference')
  @RequireCapability(CAPABILITIES.SupportHandle)
  ticket(@Param() params: AdminSupportReferenceParamsDto): Promise<AdminSupportTicketDetail> {
    return this.adminSupportService.ticket(params.reference);
  }

  /**
   * POST /admin/support/tickets/:reference/messages — a reply or a note.
   *
   * ONE ROUTE FOR BOTH, DISCRIMINATED BY A REQUIRED FIELD, rather than
   * two routes whose paths could be confused. `visibility` has no
   * default: an administrator states who each message is for, and a body
   * that omits it is a 400.
   */
  @Post('tickets/:reference/messages')
  @UseGuards(CsrfGuard)
  @RequireCapability(CAPABILITIES.SupportHandle)
  addMessage(
    @CurrentAdmin() admin: AdminContext,
    @Param() params: AdminSupportReferenceParamsDto,
    @Body() body: CreateAdminSupportMessageDto,
  ): Promise<AdminSupportTicketDetail> {
    return this.adminSupportService.addMessage(admin.id, params.reference, {
      visibility: body.visibility,
      message: body.message,
    });
  }

  /** POST /admin/support/tickets/:reference/status — resolve, or reopen. */
  @Post('tickets/:reference/status')
  @UseGuards(CsrfGuard)
  @RequireCapability(CAPABILITIES.SupportHandle)
  setStatus(
    @Param() params: AdminSupportReferenceParamsDto,
    @Body() body: UpdateSupportStatusDto,
  ): Promise<AdminSupportTicketDetail> {
    return this.adminSupportService.setStatus(params.reference, body.status);
  }
}
