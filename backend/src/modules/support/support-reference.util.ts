import { randomInt } from 'crypto';
import {
  SUPPORT_REFERENCE_ALPHABET,
  SUPPORT_REFERENCE_BODY_LENGTH,
  SUPPORT_REFERENCE_PATTERN,
  SUPPORT_REFERENCE_PREFIX,
} from '@globalnews-ai/shared';

/**
 * S2 — the ticket reference generator.
 *
 * Pure: no Prisma, no Nest, no I/O beyond the system CSPRNG. Uniqueness
 * is NOT this function's job — see the note below.
 *
 * WHY `randomInt` AND NOT `randomBytes[i] % 32`.
 * The obvious implementation draws a byte and takes it modulo the
 * alphabet length. 256 is not a multiple of 32 here — it happens to be,
 * but the moment the alphabet changes length that shortcut becomes
 * biased, and a biased identifier is a weaker identifier for no gain.
 * `crypto.randomInt` is CSPRNG-backed and rejection-samples internally,
 * so it is unbiased for ANY range, today and after any future change to
 * the alphabet.
 *
 * WHY THIS FUNCTION DOES NOT CHECK THE DATABASE.
 * A `findUnique`-then-`create` has a race between its two statements:
 * two requests can both find a reference free and both use it. The
 * `@unique` constraint on SupportTicket.reference has no such gap, so
 * the constraint is the authority and this function only supplies
 * candidates. SupportService retries on a confirmed reference-target
 * P2002; it never pre-checks.
 *
 * THE SPACE IS 32^10 (about 1.13e15). At a million tickets the chance
 * that any single insert collides is under one in a billion, so the
 * retry exists to keep a vanishingly rare event from surfacing as an
 * error, not as the uniqueness mechanism.
 *
 * The alphabet is Crockford Base32 — no I, L, O or U — so a reference
 * survives being read aloud, written down and typed back without the
 * 1/I and 0/O confusions. It is deliberately NOT sequential: a counter
 * would tell anyone holding one reference roughly how many tickets the
 * platform has ever issued.
 */
export function generateSupportReference(): string {
  let body = '';

  for (let index = 0; index < SUPPORT_REFERENCE_BODY_LENGTH; index += 1) {
    body += SUPPORT_REFERENCE_ALPHABET[randomInt(0, SUPPORT_REFERENCE_ALPHABET.length)];
  }

  return `${SUPPORT_REFERENCE_PREFIX}${body}`;
}

/**
 * Whether a string is a well-formed reference.
 *
 * A REFERENCE IS AN IDENTIFIER, NEVER A CAPABILITY. This says nothing
 * about who may see the ticket; ownership is enforced separately, in
 * the database query, on every single read. Guessing a well-formed
 * reference gains nothing.
 */
export function isSupportReference(value: string): boolean {
  return SUPPORT_REFERENCE_PATTERN.test(value);
}

/**
 * Normalize a caller-supplied reference for lookup.
 *
 * `SupportTicket.reference` is a plain `String @unique`, which
 * PostgreSQL compares case-sensitively, and generation only ever emits
 * upper case. Upper-casing here lets a user type or paste
 * `gn-7qk2m4xr9t` and still find their own ticket, without a schema
 * change and without a case-insensitive query that could not use the
 * unique index.
 */
export function normalizeSupportReference(value: string): string {
  return value.trim().toUpperCase();
}
