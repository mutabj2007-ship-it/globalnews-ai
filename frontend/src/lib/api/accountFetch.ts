import { resolveAccountApiBase } from './accountBase';

/**
 * Milestone #57 — the smallest shared helper needed for the frontend
 * to talk to the new authenticated account endpoints. Two
 * responsibilities only:
 *
 * 1. `credentials: 'include'` on every call, so the browser sends the
 *    httpOnly session cookie on cross-origin requests to the backend
 *    (required now that main.ts registers CORS with credentials:
 *    true).
 * 2. Reading the (deliberately non-httpOnly) CSRF cookie and echoing
 *    it back as the X-CSRF-Token header on any mutating request
 *    (POST/DELETE) — the frontend half of the double-submit CSRF
 *    protection; the backend half is CsrfGuard.
 *
 * Deliberately not a general-purpose API client — GlobalNews AI's
 * existing public endpoints (analyzeNews, country news, etc.) are
 * completely unaffected by this file and continue using their own
 * existing fetch calls unchanged, since they need neither cookies nor
 * CSRF protection.
 */

const CSRF_COOKIE_NAME = 'gna_csrf';

function readCsrfCookie(): string | undefined {
  if (typeof document === 'undefined') return undefined;

  const match = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${CSRF_COOKIE_NAME}=`));

  return match?.split('=')[1];
}

export interface AccountFetchOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
}

const MUTATING_METHODS = new Set(['POST', 'DELETE']);

export async function accountFetch(path: string, options: AccountFetchOptions = {}): Promise<Response> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = {};

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (MUTATING_METHODS.has(method)) {
    const csrfToken = readCsrfCookie();
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    } else {
      /*
        E1-M-8 — THE OMISSION IS NOW OBSERVABLE. IT USED TO BE SILENT, AND THAT
        SILENCE IS WHY THE LIVE DEFECT SURVIVED AS LONG AS IT DID.

        When `gna_csrf` cannot be read, this function sends the mutation ANYWAY,
        without the header, and CsrfGuard refuses it. The refusal is correct.
        What was wrong is that nothing on the client ever said the header had
        been dropped, so the failure surfaced only as a status code from a guard
        that was working perfectly — indistinguishable, from the outside, from a
        genuine CSRF rejection. On the live deployment the cookie was set on the
        backend's origin and read from the frontend's, so this branch was taken
        on EVERY mutation, and it said nothing.

        THE REQUEST IS STILL SENT. This is an observation, not a new client-side
        gate: refusing here would move the security decision off the server and
        into a place an attacker controls, and would also turn a
        legitimately-expired session into a different failure mode than the one
        the server would have produced.

        NO VALUE IS LOGGED. The token is not printed, and neither is any cookie,
        header or body — only the fact of the omission, the method and the path,
        which is exactly what a rehearsal needs to prove the branch is not being
        taken. `console.warn` rather than `console.error` because a signed-out
        or expired caller reaching a mutating path is an ordinary event, not a
        fault.
      */
      // eslint-disable-next-line no-console
      console.warn(
        `[account] CSRF cookie ${CSRF_COOKIE_NAME} unreadable; sending ${method} ${path} without X-CSRF-Token`,
      );
    }
  }

  /*
    M-ALPHA-AUTH — the base is now resolved per call and is FIRST-PARTY in the
    browser ('/api'), not the backend's own origin. This one line is what makes
    both mechanisms below actually work in production:

      * `credentials: 'include'` can finally deliver a session, because a
        SameSite=Lax cookie IS sent on a same-origin request and was being
        withheld on the cross-site one this used to make; and
      * `readCsrfCookie()` above can finally see `gna_csrf`, because the cookie
        and this document now share an origin. A document can only read cookies
        of its own origin, so while the backend set that cookie on ITS host this
        read returned undefined every time, no header was sent, and CsrfGuard
        would have rejected every mutation with 403 — a defect that was invisible
        only because the session never arrived to expose it.

    `credentials: 'include'` is KEPT rather than dropped to 'same-origin'. It is
    correct for both, it is what the server-side branch would need if it ever
    carried a cookie, and changing it would be an unrelated edit to a line that
    is not wrong.
  */
  return fetch(`${resolveAccountApiBase()}${path}`, {
    method,
    credentials: 'include',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}
