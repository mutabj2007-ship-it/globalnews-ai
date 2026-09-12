import type { NextFunction, Request, Response } from 'express';

/**
 * E1-M-4 / R-2 — CACHE PRIVACY FOR THE SAME-ORIGIN PROXIED API FAMILIES.
 *
 * WHY THIS EXISTS RATHER THAN THE next.config.mjs headers() BLOCK. M-4 declared
 * `Cache-Control: private, no-store` and `Vary: Cookie` for `/api/:path*` in the
 * frontend config, and said in the same breath that the rehearsal would
 * "measure the header actually returned ... rather than trusting this block to
 * have taken effect". The rehearsal measured it. On a request Next REWRITES to
 * this backend, the response carried `Vary: Origin, Accept-Encoding` and no
 * `Cache-Control` at all — the `cors` package's header and the transport's,
 * passed straight through. Next contributed nothing. A header configured for a
 * proxied external response is a statement of intent, not a guarantee.
 *
 * So the directive is stated where the response is actually produced. This
 * server owns these responses, and nothing between here and the browser has to
 * cooperate for the header to exist.
 *
 * WHAT IT PROTECTS. `/users/me` and its siblings now leave an origin whose other
 * job is serving immutable static assets, behind an edge tuned for exactly that.
 * An intermediary that decided to cache a 200 from `/users/me` would serve one
 * signed-in user's identity to the next visitor. `private` forbids any shared
 * cache from storing it; `no-store` forbids even the browser's own disk cache,
 * so a session response cannot be recovered from a shared machine after
 * sign-out. `Vary: Cookie` is the belt to those braces: an intermediary that
 * ignores the directives is at least told the response depends on the cookie, so
 * two sessions cannot collapse onto one cache entry.
 *
 * `res.vary()` RATHER THAN `res.setHeader('Vary', ...)`, AND THAT IS THE POINT.
 * `enableCors()` adds `Vary: Origin` to these same responses and the transport
 * adds `Accept-Encoding`. Assigning the header whole would silently destroy
 * whichever was already there, turning a privacy fix into a CORS or compression
 * defect. `res.vary()` is Express's merge primitive: it appends a field only if
 * absent and leaves the rest untouched, in either registration order.
 *
 * SCOPE IS THE SEVEN PROXIED FAMILIES, DERIVED FROM THE REWRITE CONTRACT. These
 * are exactly the destinations of the seven rewrite families in
 * frontend/next.config.mjs, with the `/api` prefix stripped as the rewrite
 * strips it. `/news` is deliberately ABSENT: it is public, cacheable and carries
 * no session. Marking it `private, no-store` would be a performance regression
 * to the public surface dressed as a security fix.
 *
 * CASE-INSENSITIVE BY DELIBERATE CHOICE. Express routing is case-insensitive by
 * default, so `/USERS/me` reaches the same controller as `/users/me`. A
 * case-sensitive prefix test would therefore be a one-character bypass of this
 * control. The comparison lowercases before matching.
 */

/**
 * The seven proxied families, backend-side — the rewrite destinations with the
 * `/api` prefix stripped. Asserted against next.config.mjs by the spec, so the
 * two cannot drift.
 */
export const AUTHENTICATED_API_FAMILIES: readonly string[] = Object.freeze([
  '/analysis',
  '/auth',
  '/users',
  '/history',
  '/follows',
  '/support',
  '/admin',
]);

/** The single cache directive. Declared once so the spec asserts this string. */
export const AUTHENTICATED_CACHE_CONTROL = 'private, no-store';

/** The field appended to Vary. Never assigned as the whole header. */
export const AUTHENTICATED_VARY_FIELD = 'Cookie';

/**
 * True when `pathname` lies inside one of the seven families.
 *
 * A family matches its own path and anything beneath it, and nothing else:
 * `/users` and `/users/me` match, `/usersomething` does not. The `${family}/`
 * test is what draws that line.
 */
export function isAuthenticatedApiFamilyPath(pathname: string): boolean {
  const lowered = pathname.toLowerCase();

  return AUTHENTICATED_API_FAMILIES.some(
    (family) => lowered === family || lowered.startsWith(`${family}/`),
  );
}

/**
 * Express middleware applying the directives to the seven families.
 *
 * Registered globally in main.ts and self-selecting by path, matching the shape
 * M-2's proxy-chain diagnostic already established in that file.
 *
 * Headers are set on the way IN, before any guard, controller or exception
 * filter runs. That is what makes the control total: a 401 refused by
 * RequireAuthGuard, a 200 from a controller, and a 302 from the OAuth callback
 * all carry the directives, because none of them has to remember to add
 * anything. Nothing else in this backend assigns `Cache-Control`, so there is no
 * later writer to contend with.
 */
export function createAuthenticatedCacheHeaders() {
  return function authenticatedCacheHeaders(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    if (isAuthenticatedApiFamilyPath(req.path)) {
      res.setHeader('Cache-Control', AUTHENTICATED_CACHE_CONTROL);
      res.vary(AUTHENTICATED_VARY_FIELD);
    }

    next();
  };
}
