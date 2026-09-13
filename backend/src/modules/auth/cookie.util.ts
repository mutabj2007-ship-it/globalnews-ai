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
 * R-h — the single normalized production test for every cookie this module
 * sets, matching CorsStartupValidator (M34), NewsStartupValidator (M33) and
 * AnalysisConfigService exactly.
 *
 * Before this, the three builders below used a bare `nodeEnv === 'production'`
 * while all three startup validators normalized with `?.trim().toLowerCase()`.
 * A value such as "Production" or " production" therefore satisfied every
 * fail-closed guard — CORS restricted, GNews and OpenAI keys required, the
 * application considering itself in production — while these cookies were
 * still issued WITHOUT `Secure`. Behind a TLS-terminating reverse proxy that
 * means a session token transmitted over a connection the user has every reason
 * to believe is protected.
 *
 * Defined once here so the three builders can never disagree with each other,
 * for the same reason resolveFrontendOrigin() is shared between main.ts and
 * CorsStartupValidator.
 */
function isProductionEnvironment(nodeEnv: string | undefined): boolean {
  return nodeEnv?.trim().toLowerCase() === 'production';
}

/**
 * M-ALPHA-AUTH — CTO requirement 12: Secure must be GUARANTEED for the
 * production HTTPS account origin.
 *
 * THE GAP THIS CLOSES. Until now `secure` depended on one thing only: the
 * spelling of NODE_ENV. That is a variable nobody in this repository can verify
 * from the code, it is set outside it, and if it is anything other than
 * `production` — unset, `prod`, `PRODUCTION ` with a stray space that the
 * normalizer above does handle, or simply absent on a platform that does not
 * inject it — a session cookie is issued WITHOUT Secure over a connection the
 * user believes is protected. The application would look completely healthy.
 *
 * THE FIX IS TO ASK THE QUESTION THAT ACTUALLY MATTERS. "Is the origin this
 * cookie is being issued for served over HTTPS?" is answerable from
 * configuration this codebase already resolves and already fails closed on:
 * FRONTEND_ORIGIN, via resolveFrontendOrigin(). Under the Option A first-party
 * architecture the frontend origin IS the account origin — the browser reaches
 * every authenticated route through it — so its scheme is exactly the right
 * test.
 *
 * ADDITIVE, NOT A REPLACEMENT. The NODE_ENV term is kept and ORed with this
 * one, so every existing behaviour is preserved bit for bit: a production
 * deployment stays Secure whatever its origin string says, http://localhost
 * development stays non-Secure (Secure cookies are simply never sent over plain
 * HTTP, so hardcoding it would break every local sign-in), and the only
 * behaviour that CHANGES is the one that was dangerous — an https account
 * origin now gets Secure even if NODE_ENV lies.
 *
 * Deliberately a literal prefix test rather than `new URL(...)`: this function
 * must never throw, and it is asked about a value that has already been
 * fail-closed validated elsewhere. Case-insensitive because an origin is
 * scheme-case-insensitive.
 */
function isSecureAccountOrigin(accountOrigin: string | undefined): boolean {
  return accountOrigin?.trim().toLowerCase().startsWith('https://') === true;
}

/**
 * The single Secure decision for all three cookies. One function so the three
 * builders below cannot drift apart, for the same reason isProductionEnvironment
 * is shared.
 */
function resolveSecureFlag(
  nodeEnv: string | undefined,
  accountOrigin: string | undefined,
): boolean {
  return isProductionEnvironment(nodeEnv) || isSecureAccountOrigin(accountOrigin);
}

/**
 * Milestone #57 — shared attribute logic for every cookie this module
 * sets. `secure` is gated on isProductionEnvironment() above, mirroring the
 * exact existing dev-permissive/prod-strict pattern already used by
 * AnalysisStartupValidator/NewsStartupValidator/CorsStartupValidator
 * elsewhere in this codebase — Secure cookies are simply never sent
 * over plain HTTP, which is how local development runs
 * (http://localhost), so hardcoding Secure=true would silently break
 * every local sign-in attempt. `sameSite: 'lax'` is required (not
 * 'strict') so the cookie is still included on the top-level
 * navigation redirect landing back from Google after consent —
 * 'strict' would block cookies on that exact cross-site navigation.
 *
 * M-ALPHA-AUTH — SameSite STAYS 'lax', AND UNDER OPTION A THAT IS NOW ACTUALLY
 * SUFFICIENT RATHER THAN A COMPROMISE. Please read this before "fixing" it.
 *
 * The live defect was NOT that Lax is the wrong attribute. It was that the
 * browser was talking to two different sites: the page lived on the frontend
 * Railway host and every authenticated request went to the backend Railway host,
 * and `up.railway.app` is a public suffix, so those are cross-site to each
 * other. A Lax cookie is never attached to a cross-site SUBRESOURCE request, so
 * `GET /users/me` arrived with no session and the header could never leave
 * "Sign In" — while the Google hops kept working, because those are TOP-LEVEL
 * navigations, where Lax cookies are sent.
 *
 * Option A removes the cross-site condition instead of loosening the cookie: the
 * account surfaces are reached through the frontend origin's own /api path (see
 * frontend/next.config.mjs), so every authenticated request is first-party and
 * Lax applies to it as intended.
 *
 * SameSite=None WAS CONSIDERED AND REJECTED BY THE CTO. It would have made the
 * session a third-party cookie, which Safari's ITP and Firefox's ETP block by
 * default — so it would have fixed Chrome and left every iPhone tester looking
 * at "Sign In" after a successful Google sign-in. Do not reintroduce it.
 */
export function buildSessionCookieOptions(
  nodeEnv: string | undefined,
  maxAgeMs: number,
  accountOrigin?: string,
): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: resolveSecureFlag(nodeEnv, accountOrigin),
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
export function buildOAuthFlowCookieOptions(
  nodeEnv: string | undefined,
  maxAgeMs: number,
  accountOrigin?: string,
): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: resolveSecureFlag(nodeEnv, accountOrigin),
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
export function buildCsrfCookieOptions(
  nodeEnv: string | undefined,
  maxAgeMs: number,
  accountOrigin?: string,
): CookieOptions {
  return {
    httpOnly: false,
    sameSite: 'lax',
    secure: resolveSecureFlag(nodeEnv, accountOrigin),
    path: '/',
    maxAge: maxAgeMs,
  };
}
