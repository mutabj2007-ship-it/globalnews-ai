import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import {
  ADMIN_SUPPORT_STATUS_ACTIONS,
  SUPPORT_MESSAGE_VISIBILITIES,
  SUPPORT_REFERENCE_PATTERN,
  SUPPORT_TICKET_STATUSES,
  type AdminSupportStatusAction,
  type SupportMessageVisibility,
  type SupportTicketStatus,
} from '@globalnews-ai/shared';

/**
 * S3 — the request contracts for the ADMIN support API.
 *
 * VISIBILITY IS REQUIRED HERE AND HAS NO DEFAULT. That is the single
 * most important line in this file. The Prisma column defaults to
 * PUBLIC, which is the right default for a user reply and exactly the
 * wrong one for an administrator: a note meant to stay internal that
 * arrived without the field would be written as PUBLIC and shown to the
 * requester. `@IsIn` with no `@IsOptional` makes an omitted visibility a
 * 400 rather than a disclosure. An administrator must SAY who a message
 * is for, every single time.
 *
 * WHY THE USER DTOs ARE NOT REUSED. `CreateSupportMessageDto` in
 * `support.dto.ts` deliberately has no `visibility` field, and the S2
 * security spec asserts that it never gains one. Adding an optional
 * field there for the admin path would break that assertion and, worse,
 * would make it possible for a user request body carrying `visibility`
 * to stop being rejected by `forbidNonWhitelisted`. Two audiences, two
 * contracts.
 *
 * STILL ABSENT, ON PURPOSE: no `userId`, no `authorId`, no `reference`
 * in a body, no `priority` and no `assigneeId`. The acting
 * administrator comes from `@CurrentAdmin()`, which only AdminGuard
 * sets; the ticket comes from the path. Neither is expressible as
 * input, and the schema has no column for the last two.
 */
const trimmed = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value));

export class CreateAdminSupportMessageDto {
  /**
   * PUBLIC — the requester reads it, and the ticket moves to
   * AWAITING_USER.
   * INTERNAL — the requester can never read it, and the ticket's status
   * does not move at all.
   *
   * Required. There is no default and no fallback anywhere on this path.
   */
  @IsIn(SUPPORT_MESSAGE_VISIBILITIES)
  visibility!: SupportMessageVisibility;

  @IsString()
  @trimmed()
  @MinLength(2)
  @MaxLength(5000)
  message!: string;
}

/**
 * The status an administrator may set directly: RESOLVED, or
 * AWAITING_ADMIN to reopen.
 *
 * OPEN and AWAITING_USER are absent from the permitted set and a
 * request naming either is a 400. OPEN means "nobody has looked at this
 * yet" and is creation-only; AWAITING_USER is derived from posting a
 * PUBLIC reply and is never submitted. Validated against the shared
 * array so this file cannot drift from the declared contract.
 */
export class UpdateSupportStatusDto {
  @IsIn(ADMIN_SUPPORT_STATUS_ACTIONS)
  status!: AdminSupportStatusAction;
}

/**
 * The optional queue filter.
 *
 * Optional and validated against the full status vocabulary: filtering
 * is a view concern, not an authorization one — every ticket is visible
 * to a holder of support.handle regardless — so all four members are
 * accepted here even though only two are settable above.
 */
export class AdminSupportQueueQueryDto {
  @IsOptional()
  @IsIn(SUPPORT_TICKET_STATUSES)
  status?: SupportTicketStatus;
}

/**
 * The `:reference` path parameter on the admin routes.
 *
 * A separate class from the user-facing `SupportTicketReferenceParamsDto`
 * only because that file is S2's and stays untouched; the validation is
 * deliberately identical, so a malformed reference is a 400 that never
 * reaches the database on either surface.
 */
export class AdminSupportReferenceParamsDto {
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @Matches(SUPPORT_REFERENCE_PATTERN)
  reference!: string;
}
