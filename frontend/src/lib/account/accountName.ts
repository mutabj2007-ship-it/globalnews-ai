import { addressableName } from '@globalnews-ai/shared';

/**
 * THE NAME SHOWN FOR A SIGNED-IN ACCOUNT, and where it came from.
 *
 * R76 (E1_B_NAME_PRIVACY_CONDITIONAL, C-1 / C-2; CTO R76 #93/#95) — the ORDERED name-source rule
 * has exactly ONE rung:
 *
 *   1. the reader's own saved name (`displayName`, written only by the reader in Settings);
 *   →  otherwise null: the neutral greeting.
 *
 * No other source is read here: no Google profile name (the OAuth scope is `openid email`, and E1
 * recommends against widening it), no name taken from an email address or its local part, no
 * avatar, no token claim, no other reader's content. The shared rule `addressableName` re-validates
 * the saved value on the way out, so a stored address, markup or bidi override shows NEUTRAL.
 * `accountName.spec.ts` fails if a second source is added without being ranked here.
 *
 * SUPERSEDED (R3.1, 2026-10-11): the `greetingName` / `greetingNameSource` rung (Google given name,
 * else an email-derived first name). No backend ever sent it; E1 R76 closes it.
 */
export interface AccountNameFields {
  readonly displayName: string | null;
}

export type AccountNameSource = 'CHOSEN';

export function shownAccountName(user: AccountNameFields | null): string | null {
  if (user === null) return null;
  return addressableName(user.displayName);
}

export function accountNameSource(user: AccountNameFields | null): AccountNameSource | null {
  return shownAccountName(user) === null ? null : 'CHOSEN';
}
