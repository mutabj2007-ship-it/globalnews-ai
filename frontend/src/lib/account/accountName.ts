import { addressableName } from '@globalnews-ai/shared';

/**
 * R3.1 GOOGLE PROFILE PERSONALIZATION (PO/CTO, 2026-10-11) — THE NAME SHOWN FOR A SIGNED-IN
 * ACCOUNT, and where it came from.
 *
 *   1. the reader's own saved name (`displayName`, written only by the reader);
 *   2. the greeting name the backend stored at sign-in (`greetingName`): the Google given name,
 *      else a first name from a VERIFIED email;
 *   3. null — the neutral greeting.
 *
 * Both pass the shared display-name rule, so neither can render an address, markup or a
 * bidirectional override. A backend that sends no `greetingName` (today's Alpha backend) gives
 * exactly the earlier behaviour: the saved name or nothing.
 *
 * SUPERSEDED (R3.1 FIX 4 first proposal): the automatic `accountAlias` ("amina.k-4821") is no
 * longer used for display — the revised purpose is a natural greeting, not a handle. See the
 * R3.1 profile personalization proposal (doc 02) for the decision on backend 1c79d36.
 */
export interface AccountNameFields {
  readonly displayName: string | null;
  readonly greetingName?: string | null;
  readonly greetingNameSource?: string | null;
}

export type AccountNameSource = 'CHOSEN' | 'GOOGLE_PROFILE' | 'EMAIL';

export function shownAccountName(user: AccountNameFields | null): string | null {
  if (user === null) return null;
  return addressableName(user.displayName) ?? addressableName(user.greetingName ?? null);
}

export function accountNameSource(user: AccountNameFields | null): AccountNameSource | null {
  if (user === null) return null;
  if (addressableName(user.displayName) !== null) return 'CHOSEN';
  if (addressableName(user.greetingName ?? null) === null) return null;
  if (user.greetingNameSource === 'EMAIL') return 'EMAIL';
  if (user.greetingNameSource === 'GOOGLE_PROFILE') return 'GOOGLE_PROFILE';
  return null;
}
