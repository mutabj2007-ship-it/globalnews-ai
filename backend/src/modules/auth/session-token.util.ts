import { randomBytes, createHash } from 'crypto';

/**
 * Milestone #57 — the raw session token is a 256-bit
 * (crypto.randomBytes(32)) cryptographically random value, returned
 * to the caller exactly once (to be set as the cookie value) and NEVER
 * persisted or logged in its raw form. Only its SHA-256 hash is stored
 * in the database (Session.tokenHash) — a database compromise alone
 * can never be used to impersonate a session, since the hash cannot be
 * reversed back into a token an attacker could present as a cookie.
 */
export function generateRawSessionToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Deterministic, one-way. The same raw token always hashes to the
 * same value (required for the DB lookup-by-hash pattern), but the
 * hash cannot be reversed. SHA-256 (not a slow password-hashing
 * function like bcrypt/argon2) is the correct choice here — unlike a
 * user-chosen password, this token already has 256 bits of entropy
 * from a CSPRNG, so it is not vulnerable to offline brute-force
 * guessing the way a low-entropy password would be; a slow hash would
 * only add unnecessary latency to every authenticated request.
 */
export function hashSessionToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Milestone #57 — the separate, non-httpOnly CSRF token. Deliberately
 * NOT derived from or related to the session token — a distinct,
 * independently-random value so that CSRF protection and session
 * authentication remain two genuinely separate security properties.
 * Never persisted in the database at all: it only needs to match
 * between the cookie the browser holds and the header the frontend's
 * own JavaScript echoes back on a mutating request — a cross-site
 * attacker's page can trigger a request with the session cookie
 * auto-attached, but cannot read this cookie's value (same-origin
 * policy) to also set the matching header.
 */
export function generateCsrfToken(): string {
  return randomBytes(16).toString('hex');
}
