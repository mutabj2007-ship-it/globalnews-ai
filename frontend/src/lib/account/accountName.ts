import { addressableName } from '@globalnews-ai/shared';

/**
 * R3.1 PRODUCT OWNER ACCEPTANCE · FIX 4 — THE NAME SHOWN FOR A SIGNED-IN ACCOUNT.
 *
 * The reader's own preferred name when they saved one; otherwise the automatic account alias the
 * backend assigns (`accountAlias`: the normalised email local part plus a unique numerical suffix,
 * never the address, "@" or the domain); otherwise null — the neutral fallback. Both values pass
 * the same shared display-name rule, so neither can render an address, markup or a bidirectional
 * override. Mirrors the shared `effectiveAccountName` on the alias backend line; kept local so this
 * frontend also runs, unchanged in behaviour, against a backend that sends no alias.
 */
export function shownAccountName(
  user: { readonly displayName: string | null; readonly accountAlias?: string | null } | null,
): string | null {
  if (user === null) return null;
  return addressableName(user.displayName) ?? addressableName(user.accountAlias ?? null);
}
