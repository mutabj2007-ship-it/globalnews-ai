import type { NextFunction, Request, Response } from 'express';

/**
 * E1-N-4 — EXPLICIT PUBLIC CACHE CLASSIFICATION FOR THE PROXIED NEWS FAMILY.
 *
 * WHY THIS IS STATED HERE AND NOT IN next.config.mjs. M-4 declared the
 * authenticated headers in the frontend config, and the rehearsal measured what
 * actually came back: on a REWRITTEN response, nothing of that block
 * participates. `/sw.js` receives its configured headers because Next serves it;
 * `/api/users/me` received none because Next proxies it. A `/news` entry in
 * `headers()` would be inert in exactly the same way — it would read as
 * compliance while doing nothing. So the classification is stated where the
 * response is produced, as the authenticated one now is.
 *
 * WHY IT IS NEEDED AT ALL. `/news` used to be fetched cross-site from the
 * backend origin; it is now a same-origin PUBLIC rewrite. Same-origin means the
 * session cookies (Path='/') travel on every news request — a TRANSMISSION
 * change, not a privilege change (news-session-blindness.spec.ts holds that
 * line). What must not happen is a public, session-blind response drifting into
 * an unstated caching posture while cookies are present on the request.
 *
 * WHY `max-age=0, must-revalidate` AND NOT A POSITIVE TTL. The Product Owner
 * ruled the classification explicit and the freshness policy deferred. This
 * states "public" without inventing a stale-news product decision: shared caches
 * may store it, but must revalidate every time. A real TTL is later work, driven
 * by measured cost and freshness — not chosen here by default.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO.
 *   - It does NOT set `Vary: Cookie`. That would be untrue: the response does
 *     not vary by session, and saying it does destroys shared cacheability for
 *     no gain. It is truthful ONLY while the session-blindness guard holds — if
 *     `/news` ever varies by session, `Vary: Cookie` becomes mandatory in the
 *     same change that makes it vary.
 *   - It does NOT touch any existing `Vary`. `Vary: Origin` from the cors
 *     package and `Accept-Encoding` from the transport are left exactly as they
 *     are; this module never assigns that header.
 *   - It does NOT strip cookies, and nothing may. E1-N-5 forbids frontend
 *     middleware for that purpose: it would alter the forwarding topology the
 *     TRUST_PROXY=1 evidence depends on, which seven authenticated families rely
 *     on. The transmission is accepted and controlled, not tidied away.
 *
 * MUTUALLY EXCLUSIVE WITH THE AUTHENTICATED MIDDLEWARE, AND ASSERTED SO. A path
 * cannot be both public and private. `/news` is absent from
 * AUTHENTICATED_API_FAMILIES by construction, and the spec proves the two sets
 * do not intersect rather than trusting that they don't.
 */

/** The public families, backend-side. `/news` only, today. */
/*
  G-2 — `/geo` JOINS `/news` AS A PUBLIC FAMILY (E1-GEO-PUBLIC-REWRITE-REVIEW-1).

  The Geo routes resolve text against a shipped gazetteer. They read no
  session, no user and no stored evidence, so their responses are the same
  for every caller and are classified PUBLIC — the same classification
  `/news` carries, for the same reason.

  APPLIED BACKEND-SIDE, DELIBERATELY. Next's `headers()` does not reach a
  REWRITTEN response — measured: `/sw.js` got its headers and
  `/api/users/me` got none — so a header declared in `next.config.mjs`
  would simply not exist on `/geo/*`. The middleware here runs on the
  response that is actually served.

  AND STILL NO `Vary: Cookie`. This file never calls `res.vary()`; that is
  the authenticated classification's primitive and adding it here would
  fragment a public cache on a header the response does not depend on.
*/
export const PUBLIC_API_FAMILIES: readonly string[] = Object.freeze(['/news', '/geo', '/conflict']);

/** Explicit public classification; freshness policy deliberately deferred. */
export const PUBLIC_CACHE_CONTROL = 'public, max-age=0, must-revalidate';

/**
 * True when `pathname` lies inside a public family. Matches the family root and
 * anything beneath it, and nothing else: `/news` and `/news/country/FRA` match,
 * `/newsroom` does not.
 *
 * Case-insensitive for the same reason the authenticated guard is: Express
 * routing is case-insensitive by default, so `/NEWS/top-headlines` reaches the
 * same controller and must receive the same classification.
 */
export function isPublicApiFamilyPath(pathname: string): boolean {
  const lowered = pathname.toLowerCase();

  return PUBLIC_API_FAMILIES.some(
    (family) => lowered === family || lowered.startsWith(`${family}/`),
  );
}

/**
 * Express middleware applying the public classification.
 *
 * Registered globally in main.ts alongside the authenticated one and
 * self-selecting by path, matching the shape M-2 established. Headers are set on
 * the way in, so a 200, a 404 and a 429 from the throttler all carry the same
 * classification without any handler having to remember.
 */
export function createPublicCacheHeaders() {
  return function publicCacheHeaders(req: Request, res: Response, next: NextFunction): void {
    if (isPublicApiFamilyPath(req.path)) {
      res.setHeader('Cache-Control', PUBLIC_CACHE_CONTROL);
    }

    next();
  };
}
