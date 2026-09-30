import { accountSignInUrl } from '@/lib/api/accountLinks';
import type { AskGuestStatus } from '@/lib/api/askV2Api';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK GUEST TRIAL R3 — THE FIRST-VISIT GUEST, CLIENT SIDE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The client MIRRORS the server; it never decides. The remaining count, the exhaustion and
 * every refusal come from `/ask-v2/guest/*`. Nothing here is stored in localStorage, and no
 * counter is kept client-side that could be edited to grant anything.
 *
 * Sign-in from a guest conversation is the CONTINUATION of that conversation: the guest's own
 * thread is claimed server-side first, then the browser navigates to Google with only
 * `returnTo=/ask&intent=ask-guest` — no thread, no claim and no question in any URL. The
 * unsent draft waits in sessionStorage (askKeptQuestion) and returns to the composer; it is
 * never sent automatically.
 */

export type GuestNotice =
  | 'EXHAUSTED'
  | 'IN_PROGRESS'
  | 'COOLDOWN'
  | 'LIMITED'
  | 'ATTEMPTS_EXHAUSTED'
  | 'UNAVAILABLE'
  | 'DEEPER'
  | 'CANCELLED'
  | 'FAILED'
  | 'RESUMED';

/** The Google sign-in that continues THIS guest conversation. */
export function guestSignInHref(): string {
  return `${accountSignInUrl('/ask')}&intent=ask-guest`;
}

/** A guest may ask right now (the server said so). */
export function isGuestMode(status: AskGuestStatus | null): boolean {
  return status !== null && !status.signedIn && status.available;
}

/** The server's typed refusal → the one truthful notice the reader sees. */
export function guestNoticeOf(code: string | undefined): GuestNotice | null {
  switch (code) {
    case 'GUEST_TRIAL_EXHAUSTED':
      return 'EXHAUSTED';
    case 'GUEST_ANSWER_IN_PROGRESS':
      return 'IN_PROGRESS';
    case 'GUEST_COOLDOWN':
      return 'COOLDOWN';
    case 'GUEST_TEMPORARILY_LIMITED':
      return 'LIMITED';
    case 'GUEST_ATTEMPTS_EXHAUSTED':
      return 'ATTEMPTS_EXHAUSTED';
    case 'GUEST_TRIAL_UNAVAILABLE':
    case 'GUEST_TRIAL_NOT_CONFIGURED':
      return 'UNAVAILABLE';
    case 'GUEST_SIGN_IN_REQUIRED':
      return 'DEEPER';
    default:
      return null;
  }
}

/** The `auth_error` a guest-continuation sign-in came back with, if any. */
export function authReturnNotice(search: string): GuestNotice | null {
  const value = new URLSearchParams(search).get('auth_error');
  return value === 'cancelled' ? 'CANCELLED' : value === 'failed' ? 'FAILED' : null;
}
