import { resolveApiBaseUrl } from './apiBase';

/**
 * M-ALPHA-AUTH — the FIRST-PARTY base for every authenticated account request,
 * and the one place the sign-in URL is constructed.
 *
 * WHY THIS MODULE EXISTS. Account requests used to go straight to
 * `NEXT_PUBLIC_API_URL`, i.e. the backend's own Railway host. Because the two
 * Railway hosts are different sites, the browser withheld the SameSite=Lax
 * session cookie on every one of those requests and no user could ever appear
 * signed in. Routing account traffic through THIS origin's /api path (see
 * next.config.mjs) makes the cookie first-party and the problem disappears
 * without weakening the cookie.
 *
 * A RELATIVE PATH IS THE POINT, NOT A SHORTHAND. `/api/...` cannot be anything
 * but same-origin — there is no environment variable to misconfigure, no way for
 * a deployment to accidentally point account traffic at another host, and no way
 * for this to silently become cross-site again. That property is what the repair
 * rests on, so it is expressed in a form that cannot be configured away.
 *
 * DELIBERATELY NOT USED BY ANALYSIS OR NEWS. `analysisApi.ts` and `newsApi.ts`
 * keep calling the backend origin directly and are untouched by this milestone.
 * They carry no cookie, they work in the live Alpha, and putting the product's
 * core surface behind a proxy hop to fix an authentication defect would be
 * trading a working thing for an unrelated repair. Anonymous Analysis must not
 * regress (CTO requirement 2).
 */

/**
 * The first-party prefix, matching the six rewrite families in next.config.mjs
 * exactly. Declared once here and asserted against that file by
 * accountProxy.spec.ts, so the two cannot drift.
 */
export const ACCOUNT_API_PATH_PREFIX = '/api';

/**
 * Resolves the base for an account request in the CURRENT execution context.
 *
 * BROWSER: the relative prefix, so the request is same-origin by construction
 * and carries the first-party session cookie.
 *
 * SERVER: the direct backend base, via the existing `resolveApiBaseUrl()`. Two
 * reasons, and the second is the important one. First, `fetch` in the Node
 * runtime cannot resolve a relative URL — it has no document to resolve it
 * against. Second, a server-side render has no browser cookie jar, so it could
 * not be making an authenticated request in the first place; every current
 * caller of `accountFetch` is inside a `'use client'` hook. This branch
 * therefore exists to keep the module total and honest about both contexts, not
 * because a signed-in server request is expected to work.
 *
 * Evaluated per call rather than captured at module scope, matching
 * `resolveApiBaseUrl()`: Next.js evaluates modules during the build, before
 * container runtime variables exist.
 */
export function resolveAccountApiBase(): string {
  if (typeof window === 'undefined') {
    return resolveApiBaseUrl();
  }

  return ACCOUNT_API_PATH_PREFIX;
}

/**
 * Builds the sign-in URL for ONE of the five entry points, carrying where the
 * user should be returned to.
 *
 * ALWAYS RELATIVE, in every execution context. This value is an `<a href>`
 * rendered into HTML, never a fetch target, so the browser resolves it — and a
 * relative href is first-party by construction on both a server-rendered and a
 * client-rendered page. That also means this function needs no environment
 * variable at all, which is one fewer thing a deployment can get wrong.
 *
 * THE DESTINATION IS A HINT, NOT AN INSTRUCTION. It is validated by the backend
 * against an allowlist of this application's own routes on the way in, carried
 * inside the HMAC-signed httpOnly OAuth flow-state cookie, and revalidated with
 * a same-origin assertion before the callback redirects. Nothing this function
 * emits is trusted; passing an unknown path simply returns the user to the
 * homepage, exactly as before this milestone.
 *
 * `encodeURIComponent` is applied because this is a query parameter and that is
 * what correctness requires here — it is NOT the security control. The backend's
 * allowlist is.
 */
export function accountSignInUrl(returnTo?: string): string {
  const base = `${ACCOUNT_API_PATH_PREFIX}/auth/google`;

  if (returnTo === undefined || returnTo.length === 0) {
    return base;
  }

  return `${base}?returnTo=${encodeURIComponent(returnTo)}`;
}
