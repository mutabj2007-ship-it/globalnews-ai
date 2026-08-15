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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
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
    }
  }

  return fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: 'include',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}
