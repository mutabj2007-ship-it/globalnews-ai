// Browser-safe navigation links; no backend resolver belongs in this module.
export const ACCOUNT_API_PATH_PREFIX = '/api';

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
