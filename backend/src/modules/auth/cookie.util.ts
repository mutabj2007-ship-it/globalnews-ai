export const SESSION_COOKIE_NAME = 'gna_session';
export const CSRF_COOKIE_NAME = 'gna_csrf';
export const OAUTH_FLOW_COOKIE_NAME = 'gna_oauth_flow';

export interface CookieOptions {
  httpOnly: boolean;
  sameSite: 'lax';
  secure: boolean;
  path: string;
  maxAge?: number;
}

/**
 * Milestone #57 — shared attribute logic for every cookie this module
 * sets. `secure` is gated on NODE_ENV === 'production', mirroring the
 * exact existing dev-permissive/prod-strict pattern already used by
 * AnalysisStartupValidator/NewsStartupValidator/CorsStartupValidator
 * elsewhere in this codebase — Secure cookies are simply never sent
 * over plain HTTP, which is how local development runs
 * (http://localhost), so hardcoding Secure=true would silently break
 * every local sign-in attempt. `sameSite: 'lax'` is required (not
 * 'strict') so the cookie is still included on the top-level
 * navigation redirect landing back from Google after consent —
 * 'strict' would block cookies on that exact cross-site navigation.
 */
export function buildSessionCookieOptions(nodeEnv: string | undefined, maxAgeMs: number): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: nodeEnv === 'production',
    path: '/',
    maxAge: maxAgeMs,
  };
}

/**
 * Milestone #57 — the OAuth flow-state cookie carries the state/PKCE
 * verifier/nonce for one in-progress attempt. httpOnly (never
 * readable by frontend JS) and short-lived (its own maxAge, separate
 * from and much shorter than the session cookie's).
 */
export function buildOAuthFlowCookieOptions(nodeEnv: string | undefined, maxAgeMs: number): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: nodeEnv === 'production',
    path: '/',
    maxAge: maxAgeMs,
  };
}

/**
 * Milestone #57 — the CSRF cookie is deliberately NOT httpOnly: the
 * frontend's own JavaScript must be able to read its value in order
 * to echo it back as the X-CSRF-Token header on a mutating request —
 * that read/echo round trip is the entire double-submit mechanism. A
 * cross-site attacker's page can trigger a request with the session
 * cookie auto-attached but cannot read this cookie's value itself
 * (same-origin policy), so it can never construct a matching header.
 */
export function buildCsrfCookieOptions(nodeEnv: string | undefined, maxAgeMs: number): CookieOptions {
  return {
    httpOnly: false,
    sameSite: 'lax',
    secure: nodeEnv === 'production',
    path: '/',
    maxAge: maxAgeMs,
  };
}
