import { ConflictException, HttpException, HttpStatus } from '@nestjs/common';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK GUEST TRIAL R3 — WHO OWNS AN ASK ROW
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Exactly one of two principals, both SERVER-resolved: a signed-in account (from the session
 * cookie, RequireAuthGuard) or a server-issued guest session (from the guest cookie,
 * RequireGuestGuard). Nothing a caller sends in a body, a header or a URL can name either.
 *
 * `ownerOf` is the ONE place an ownership predicate is built. Every read and write in
 * AskV2Service passes through it, so a guest can only ever match rows whose guestSessionId is
 * its own session, and an account only rows whose userId is its own account. An opaque id
 * alone never authorizes anything: another owner's row and a missing row both give the same
 * bare 404.
 */
export type AskPrincipal =
  | { readonly kind: 'account'; readonly userId: string }
  | { readonly kind: 'guest'; readonly guestSessionId: string };

export type OwnerWhere = { userId: string } | { guestSessionId: string };

export function ownerOf(principal: AskPrincipal): OwnerWhere {
  return principal.kind === 'account'
    ? { userId: principal.userId }
    : { guestSessionId: principal.guestSessionId };
}

export const accountPrincipal = (userId: string): AskPrincipal => ({ kind: 'account', userId });
export const guestPrincipal = (guestSessionId: string): AskPrincipal => ({
  kind: 'guest',
  guestSessionId,
});

/**
 * The typed guest refusals. Each is a statement the reader can be told truthfully:
 *   GUEST_TRIAL_EXHAUSTED        three substantive answers have been completed
 *   GUEST_ANSWER_IN_PROGRESS     the only open slot is held by an answer still running
 *   GUEST_COOLDOWN               repeated no-answer results: temporarily limited
 *   GUEST_ATTEMPTS_EXHAUSTED     the attempt ceiling (answers + no-answers) is reached
 *   GUEST_TEMPORARILY_LIMITED    a shared/aggregate control is busy (never "you used them")
 *   GUEST_TRIAL_UNAVAILABLE      the guest switch is off
 *   GUEST_TRIAL_NOT_CONFIGURED   live guest settings are missing/invalid (fail closed)
 *   GUEST_SIGN_IN_REQUIRED       deeper, quoted work is for signed-in readers
 *   SIGNED_IN_USE_ACCOUNT        a signed-in reader uses the account path, not the guest one
 */
export type GuestRefusalCode =
  | 'GUEST_TRIAL_EXHAUSTED'
  | 'GUEST_ANSWER_IN_PROGRESS'
  | 'GUEST_COOLDOWN'
  | 'GUEST_ATTEMPTS_EXHAUSTED'
  | 'GUEST_TEMPORARILY_LIMITED'
  | 'GUEST_TRIAL_UNAVAILABLE'
  | 'GUEST_TRIAL_NOT_CONFIGURED'
  | 'GUEST_SIGN_IN_REQUIRED'
  | 'SIGNED_IN_USE_ACCOUNT';

export function guestRefusal(code: GuestRefusalCode, retryAfterS?: number): HttpException {
  const body = { statusCode: 0, code, ...(retryAfterS ? { retryAfterS } : {}) };
  if (code === 'GUEST_TEMPORARILY_LIMITED' || code === 'GUEST_COOLDOWN') {
    return new HttpException(
      { ...body, statusCode: HttpStatus.TOO_MANY_REQUESTS },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
  if (code === 'GUEST_TRIAL_UNAVAILABLE' || code === 'GUEST_TRIAL_NOT_CONFIGURED') {
    return new HttpException(
      { ...body, statusCode: HttpStatus.SERVICE_UNAVAILABLE },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
  return new ConflictException({ ...body, statusCode: HttpStatus.CONFLICT });
}
