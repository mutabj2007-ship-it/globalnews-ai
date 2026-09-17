/**
 * ════════════════════════════════════════════════════════════════════════════
 * OAUTH V1 — THE FROZEN AUTH-ERROR STATE SET
 * ════════════════════════════════════════════════════════════════════════════
 *
 * E1-BETA-SECURITY-GATES-R3 §C. The state set is exactly `cancelled | failed`.
 * Adding, removing or renaming a state requires a NEW E1 milestone; it is not a
 * refactor.
 *
 * ── ONE LIST, TWO CONSUMERS ──────────────────────────────────────────────
 *
 * The backend writes this parameter and the frontend reads it. They must agree
 * on the admissible set exactly, so the set is declared once, here, and both
 * sides import it. A second copy is a second answer.
 *
 * ── WHY `isAuthErrorCode` IS THE ONLY ADMISSION TEST ─────────────────────
 *
 * `auth_error` is ATTACKER-SUPPLIED — anyone can send a victim to
 * `/?auth_error=failed` and manufacture a real-looking failure banner on the
 * real site. Everything downstream is built so that forgery is inert.
 *
 * The `typeof value === 'string'` clause is doing real work, not defensive
 * padding. Express and Next both hand back an ARRAY for a repeated parameter
 * (`?auth_error=a&auth_error=b`) and an OBJECT for a bracketed one
 * (`?auth_error[x]=y`). Testing the type first makes BOTH shapes inert without
 * a special case for either — and a special case is exactly where the next
 * shape would be forgotten.
 *
 * ── STATES REFUSED AND NOT REOPENED ──────────────────────────────────────
 *
 * "session could not be created" — the try block spans exchange, JWKS,
 * findOrCreateUser and createSession under ONE catch, so THE CODE CANNOT TELL
 * which failed. A message naming a stage the code cannot distinguish is a guess
 * presented as a diagnosis.
 *
 * "invalid return destination" — an allowlist enumeration oracle. An invalid
 * `returnTo` succeeds SILENTLY to the homepage and must continue to.
 */

export const AUTH_ERROR_CODES = ['cancelled', 'failed'] as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

export const AUTH_ERROR_PARAM = 'auth_error';

export function isAuthErrorCode(value: unknown): value is AuthErrorCode {
  return typeof value === 'string' && (AUTH_ERROR_CODES as readonly string[]).includes(value);
}
