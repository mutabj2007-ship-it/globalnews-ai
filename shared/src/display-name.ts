/**
 * REASON TO RETURN R1 · §7 / G6 — THE ONE RULE FOR A READER'S DISPLAY NAME.
 *
 * Ask may address a signed-in reader by a name ONLY when that reader saved it themselves (or a
 * verified profile supplied it). A name is never inferred from an email local part, an OAuth
 * token, another reader's content or a guess. No saved name → the neutral fallback, always.
 *
 * The backend validates every write with this function and the frontend previews with it, so a
 * value the composer accepts is a value the server stores, byte for byte.
 *
 * WHAT A NAME MAY CONTAIN. Letters and combining marks of any script, digits, spaces, and the
 * punctuation real names use (apostrophes, hyphen, period). Anything else is refused rather than
 * silently stripped, so the reader sees exactly what will be stored:
 *   - control, format and bidirectional-override characters (spoofing / layout attacks);
 *   - "@" (an email address is not a name, and must never be displayed as one);
 *   - markup or URL characters (< > / \ : and friends).
 * Whitespace runs collapse to one space; the result is trimmed and NFC-normalised.
 */
export const DISPLAY_NAME_MAX_CHARS = 40;

export type DisplayNameRefusal = 'DISPLAY_NAME_TOO_LONG' | 'DISPLAY_NAME_INVALID';

export type DisplayNameResult =
  | { readonly ok: true; readonly value: string | null }
  | { readonly ok: false; readonly code: DisplayNameRefusal };

const ALLOWED = /^[\p{L}\p{M}\p{N} '’.\-‐]+$/u;

/** Normalise a submitted name. Empty (after trimming) means "clear it" → null. */
export function normalizeDisplayName(input: string | null | undefined): DisplayNameResult {
  if (input === null || input === undefined) return { ok: true, value: null };
  const value = input.normalize('NFC').replace(/\s+/gu, ' ').trim();
  if (value === '') return { ok: true, value: null };
  if (Array.from(value).length > DISPLAY_NAME_MAX_CHARS) {
    return { ok: false, code: 'DISPLAY_NAME_TOO_LONG' };
  }
  if (!ALLOWED.test(value)) return { ok: false, code: 'DISPLAY_NAME_INVALID' };
  /* a name needs at least one letter: "..." or "123" is not a way to address someone */
  if (!/\p{L}/u.test(value)) return { ok: false, code: 'DISPLAY_NAME_INVALID' };
  return { ok: true, value };
}

/**
 * The name to address the reader by, or null for the neutral fallback. A stored value that no
 * longer passes the rule (saved before the rule existed, or written by another path) is NOT shown.
 */
export function addressableName(stored: string | null | undefined): string | null {
  const result = normalizeDisplayName(stored ?? null);
  return result.ok ? result.value : null;
}
