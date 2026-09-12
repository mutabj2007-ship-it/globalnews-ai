/**
 * MAIN-C2 ADDENDUM 1 — A CLIENT-SIDE HINT. NEVER AN AUTHORIZATION DECISION.
 *
 * ── WHAT THIS IS FOR ──────────────────────────────────────────────────────
 *
 * The overwhelming majority of visits are anonymous, and every one of them
 * used to fire GET /users/me and GET /follows/countries whose answer was
 * already determined before the request left the browser: no session cookie
 * exists, so the server can only answer 401. Those are guaranteed-anonymous
 * requests — network, backend work, and rate-limit budget spent to learn
 * something the client could already tell.
 *
 * ── WHY `gna_csrf` IS A SOUND HINT, AND EXACTLY HOW FAR IT GOES ───────────
 *
 * `gna_csrf` and `gna_session` are set TOGETHER, at one call site, from the
 * SAME remaining lifetime (auth.service.ts builds both from `remainingMs`), and
 * are cleared together. `gna_csrf` is deliberately not httpOnly so the frontend
 * can echo it for double-submit CSRF; `gna_session` is httpOnly and invisible
 * to JS. So the readable cookie's PRESENCE is a faithful proxy for "a session
 * probably exists", and its ABSENCE means no session cookie will be sent.
 *
 * Both of those preconditions are asserted by `sessionHint.spec.ts`, which
 * reads the backend as text. If someone splits the two cookies' lifetimes or
 * makes the CSRF cookie httpOnly, that spec fails — the hint is guarded, not
 * assumed.
 *
 * ── IT GRANTS NOTHING ─────────────────────────────────────────────────────
 *
 * A present cookie causes a request to be MADE. It never causes a user to be
 * treated as signed in, never populates a user object, never unlocks a
 * surface, and never reaches a guard. Authorization remains exactly where it
 * was: the server validating `gna_session` against the Session table. Anyone
 * can set `gna_csrf` in their own browser; all they achieve is asking the
 * server a question it will answer with 401.
 *
 * ── AND THE ABSENT CASE IS SAFE ───────────────────────────────────────────
 *
 * If the cookie is absent we render signed-out WITHOUT asking. That is the
 * same outcome the request would have produced, because the same absence means
 * no session accompanies it. The only configuration where this could differ —
 * a readable-cookie-less browser that still carries a session — is one where
 * the request would have failed to authenticate anyway.
 */
export const CSRF_COOKIE_NAME = 'gna_csrf';

/**
 * True when this document can see a `gna_csrf` cookie with a non-empty value.
 *
 * An empty value counts as absent: a cookie cleared by setting it to "" is
 * still listed by `document.cookie`, and treating that as a session would
 * reintroduce the request this exists to avoid on exactly the signed-out path.
 *
 * Returns false during server rendering, where there is no document. That is
 * correct rather than merely safe: the hooks that consult it only fetch inside
 * an effect, which never runs on the server.
 */
export function hasSessionHint(): boolean {
  if (typeof document === 'undefined') return false;

  return document.cookie
    .split('; ')
    .some((entry) => {
      if (!entry.startsWith(`${CSRF_COOKIE_NAME}=`)) return false;
      return entry.slice(CSRF_COOKIE_NAME.length + 1).trim().length > 0;
    });
}
